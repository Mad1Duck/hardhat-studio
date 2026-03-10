import { app, shell, BrowserWindow, ipcMain, dialog, session } from 'electron';
import { join } from 'path';
import { spawn, ChildProcess, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
const isDev = process.env.NODE_ENV === 'development' || !!process.env['ELECTRON_RENDERER_URL'];
import axios from "axios";
import { deleteStorage, getStorage, setStorage } from "../database/storage";
import dotenv from "dotenv";

dotenv.config();
// ─── Auto updater ─────────────────────────────────────────────────────────────
// electron-updater reads publish config from package.json build.publish
let autoUpdater: any = null;
if (!isDev) {
  try {
    const updater = require('electron-updater');
    autoUpdater = updater.autoUpdater;
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
  } catch {
    // electron-updater not installed yet
  }
}

function setupAutoUpdater(win: BrowserWindow) {
  if (!autoUpdater) return;
  const send = (payload: object) => win.webContents.send('update-status', payload);

  autoUpdater.on('checking-for-update', () => send({ type: 'checking' }));
  autoUpdater.on('update-not-available', () => send({ type: 'not-available' }));
  autoUpdater.on('update-available', (info: any) => send({ type: 'available', version: info.version, releaseNotes: info.releaseNotes }));
  autoUpdater.on('download-progress', (p: any) => send({ type: 'download-progress', percent: p.percent }));
  autoUpdater.on('update-downloaded', (info: any) => send({ type: 'downloaded', version: info.version }));
  autoUpdater.on('error', (e: Error) => send({ type: 'error', message: e.message }));

  // Check on startup after 3s
  setTimeout(() => autoUpdater.checkForUpdates().catch(() => { }), 3000);
}

ipcMain.handle('check-for-update', async () => {
  if (!autoUpdater) return false;
  try { await autoUpdater.checkForUpdates(); return true; } catch { return false; }
});

ipcMain.handle('download-update', async () => {
  if (!autoUpdater) return false;
  try { await autoUpdater.downloadUpdate(); return true; } catch { return false; }
});

ipcMain.handle('install-update', async () => {
  if (!autoUpdater) return false;
  autoUpdater.quitAndInstall();
  return true;
});

// ─── WalletConnect v2 — Inline QR (no popup) ─────────────────────────────────
let wcPendingResolve: ((result: { address: string; chainId: number; } | null) => void) | null = null;
let _wcClient: any = null;
let _wcLastResult: { address: string; chainId: number; } | null = null;

function sendWcApproved(result: { address: string; chainId: number; } | null) {
  if (result) { _wcLastResult = result; console.log('[WC] sendWcApproved →', result); }
  if (wcPendingResolve) { wcPendingResolve(result); wcPendingResolve = null; }
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('wc-approved', result);
}

/**
 * Get or initialise the SignClient singleton.
 * On restart, SignClient.init() automatically restores persisted sessions
 * from its built-in IndexedDB/filesystem store — so existing sessions survive
 * an Electron restart without needing to re-scan the QR.
 */
async function getOrInitWcClient(): Promise<any> {
  if (_wcClient) return _wcClient;

  const projectId = process.env.VITE_WC_PROJECT_ID || process.env.WC_PROJECT_ID || '3721e5967517bd23fc60c504c8ded53c';

  // Polyfill crypto for Node < 19
  if (!globalThis.crypto || !(globalThis.crypto as any).getRandomValues) {
    const nodeCrypto = require('node:crypto');
    (globalThis as any).crypto = nodeCrypto.webcrypto;
  }

  const { SignClient } = require('@walletconnect/sign-client');
  _wcClient = await SignClient.init({
    projectId,
    metadata: {
      name: 'Hardhat Studio',
      description: 'Professional Hardhat Development Environment',
      url: 'https://hardhatstudio.dev',
      icons: ['https://hardhatstudio.dev/icon.png'],
    },
  });

  console.log('[WC] Client initialised, existing sessions:', _wcClient.session?.getAll?.()?.length ?? 0);
  return _wcClient;
}

ipcMain.handle('wc-session-approved', async (_, result: { address: string; chainId: number; }) => {
  sendWcApproved(result);
});

ipcMain.handle('wc-poll-result', async () => {
  const r = _wcLastResult; _wcLastResult = null; return r;
});

ipcMain.handle('wc-get-uri', async (): Promise<{ uri: string; } | { error: string; }> => {
  const projectId = process.env.VITE_WC_PROJECT_ID || process.env.WC_PROJECT_ID || '3721e5967517bd23fc60c504c8ded53c';
  if (!projectId) return { error: 'NO_PROJECT_ID' };
  try {
    const client = await getOrInitWcClient();
    const { uri, approval } = await client.connect({
      requiredNamespaces: {
        eip155: {
          methods: ['eth_sendTransaction', 'personal_sign', 'eth_sign', 'eth_accounts', 'eth_chainId'],
          chains: ['eip155:1', 'eip155:137', 'eip155:42161', 'eip155:56', 'eip155:10', 'eip155:8453', 'eip155:11155111'],
          events: ['chainChanged', 'accountsChanged'],
        },
      },
    });
    if (!uri) return { error: 'NO_URI' };

    approval().then((session: any) => {
      try {
        const ns = session.namespaces?.eip155 || Object.values(session.namespaces || {})[0] as any;
        const accounts: string[] = ns?.accounts ?? [];
        if (!accounts.length) { sendWcApproved(null); return; }
        let addr: string, chainId: number;
        if (accounts[0].includes(':')) {
          const p = accounts[0].split(':'); addr = p[2]; chainId = parseInt(p[1] || '1');
        } else { addr = accounts[0]; chainId = 1; }
        sendWcApproved({ address: addr, chainId });
      } catch { sendWcApproved(null); }
    }).catch((e: any) => console.error('[WC] approval rejected:', e?.message));

    return { uri };
  } catch (err: any) {
    return { error: err?.message ?? 'INIT_FAILED' };
  }
});

// ─── WalletConnect: send transaction via active WC session ───────────────────
// Works after restart because getOrInitWcClient() restores persisted sessions.
ipcMain.handle('wc-send-transaction', async (_, { from, to, data, chainId }: {
  from: string; to: string; data: string; chainId: number;
}): Promise<{ txHash: string; } | { error: string; }> => {
  try {
    const client = await getOrInitWcClient();
    const sessions = client.session?.getAll?.() ?? [];

    if (!sessions.length) {
      return { error: 'NO_WC_SESSION: No active WalletConnect session. Please reconnect your wallet via QR.' };
    }

    // Pick the most recent session
    const session = sessions[sessions.length - 1];
    const topic = session.topic;

    console.log(`[WC] Sending tx via session ${topic.slice(0, 8)}… chainId=eip155:${chainId}`);

    const txHash = await client.request({
      topic,
      chainId: `eip155:${chainId}`,
      request: {
        method: 'eth_sendTransaction',
        params: [{ from, to, data }],
      },
    });

    return { txHash };
  } catch (err: any) {
    return { error: err?.message ?? String(err) };
  }
});


ipcMain.handle("get-user", async () => {
  return await getStorage("discord_user");
});

ipcMain.handle("logout", async () => {
  await deleteStorage("discord_user");
});

ipcMain.handle("discord-login", async () => {
  return new Promise(async (resolve, reject) => {
    const CLIENT_ID = process.env.DISCORD_CLIENT_ID!;
    const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET!;
    const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI!;


    await session.fromPartition("oauth").clearStorageData();
    await session.fromPartition("oauth").clearCache();

    await deleteStorage("discord_access_token");
    await deleteStorage("discord_user");

    const authUrl =
      `https://discord.com/oauth2/authorize` +
      `?client_id=${CLIENT_ID}` +
      `&response_type=code` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&scope=identify`;

    console.log(authUrl, "=====authUrl=====");
    const authWindow = new BrowserWindow({
      width: 500,
      height: 700,
      webPreferences: {
        partition: "oauth",
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    authWindow.loadURL(authUrl);

    authWindow.webContents.on("will-redirect", async (event, newUrl) => {
      if (!newUrl.startsWith(REDIRECT_URI)) return;

      event.preventDefault();

      const url = new URL(newUrl);
      const code = url.searchParams.get("code");

      try {

        const tokenRes = await axios.post(
          "https://discord.com/api/oauth2/token",
          new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            grant_type: "authorization_code",
            code: code!,
            redirect_uri: REDIRECT_URI,
          }),
          {
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
          }
        );

        const accessToken = tokenRes.data.access_token;

        const userRes = await axios.get(
          "https://discord.com/api/users/@me",
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        const user = userRes.data;

        await setStorage("discord_access_token", accessToken);
        await setStorage("discord_user", user);

        authWindow.close();

        resolve(user);

      } catch (err) {

        authWindow.close();
        reject(err);

      }
    });
  });
});
// ─── WalletConnect: check if active session exists (used by renderer before sending tx) ──
ipcMain.handle('wc-has-session', async (): Promise<boolean> => {
  try {
    const client = await getOrInitWcClient();
    return (client.session?.getAll?.() ?? []).length > 0;
  } catch {
    return false;
  }
});

// ─── License validation (Lemon Squeezy) ──────────────────────────────────────
ipcMain.handle('validate-license', async (_, key: string) => {
  try {
    const res = await fetch('https://api.lemonsqueezy.com/v1/licenses/validate', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ license_key: key }),
    });
    const data = await res.json() as any;
    if (data.valid) {
      return {
        valid: true,
        email: data.license_key?.user_email ?? null,
        expiresAt: data.license_key?.expires_at ?? null,
      };
    }
    return { valid: false, error: data.error ?? 'Invalid license key' };
  } catch (e) {
    return { valid: false, error: String(e) };
  }
});



let mainWindow: BrowserWindow | null = null;
const processes = new Map<string, ChildProcess>();
const watchers = new Map<string, fs.FSWatcher>();

const iconPath = app.isPackaged
  ? join(process.resourcesPath, 'build/icon.png')
  : join(__dirname, '../../build/icon.png');


function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 960,
    minWidth: 1200,
    minHeight: 720,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#090c12',
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show();
    setupAutoUpdater(mainWindow!);
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  const rendererUrl = process.env['ELECTRON_RENDERER_URL'];
  if (isDev && rendererUrl) {
    mainWindow.loadURL(rendererUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.hardhatstudio');
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  processes.forEach(p => { try { p.kill(); } catch { } });
  watchers.forEach(w => { try { w.close(); } catch { } });
  if (process.platform !== 'darwin') app.quit();
});

// ─── Folder selection ────────────────────────────────────────────────────────
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
    title: 'Select Hardhat Project Folder'
  });
  return result.canceled ? null : result.filePaths[0];
});

// ─── Validate project ────────────────────────────────────────────────────────
ipcMain.handle('validate-project', async (_, folderPath: string) => {
  try {
    const configs = ['hardhat.config.js', 'hardhat.config.ts', 'hardhat.config.cjs', 'hardhat.config.mjs'];
    const configFile = configs.find(f => fs.existsSync(path.join(folderPath, f)));
    const hasPkg = fs.existsSync(path.join(folderPath, 'package.json'));
    let pkg: Record<string, unknown> = {};
    if (hasPkg) {
      try { pkg = JSON.parse(fs.readFileSync(path.join(folderPath, 'package.json'), 'utf-8')); } catch { }
    }

    // Detect package manager with bun support
    const isBun = fs.existsSync(path.join(folderPath, 'bun.lockb'));
    const pm = isBun ? 'bun'
      : fs.existsSync(path.join(folderPath, 'pnpm-lock.yaml')) ? 'pnpm'
        : fs.existsSync(path.join(folderPath, 'yarn.lock')) ? 'yarn' : 'npm';

    // Check if bun is installed globally
    let bunInstalled = false;
    try { execSync('bun --version', { stdio: 'ignore' }); bunInstalled = true; } catch { }

    let hardhatVersion: string | null = null;
    try {
      const hhPkg = JSON.parse(fs.readFileSync(path.join(folderPath, 'node_modules', 'hardhat', 'package.json'), 'utf-8'));
      hardhatVersion = hhPkg.version;
    } catch { }

    const deps = { ...(pkg.dependencies as object || {}), ...(pkg.devDependencies as object || {}) };
    const hasHardhat = 'hardhat' in deps || !!hardhatVersion;

    // Detect framework
    const hasEthers = 'ethers' in deps || '@nomicfoundation/hardhat-ethers' in deps;
    const hasViem = 'viem' in deps || '@nomicfoundation/hardhat-viem' in deps;
    const framework = hasEthers && hasViem ? 'both' : hasEthers ? 'ethers' : hasViem ? 'viem' : null;

    // Detect plugins
    const plugins: string[] = [];
    if ('@openzeppelin/contracts' in deps) plugins.push('openzeppelin');
    if ('@nomicfoundation/hardhat-toolbox' in deps) plugins.push('toolbox');
    if ('hardhat-gas-reporter' in deps) plugins.push('gas-reporter');
    if ('solidity-coverage' in deps) plugins.push('coverage');
    if ('@typechain/hardhat' in deps) plugins.push('typechain');
    if ('hardhat-deploy' in deps) plugins.push('hardhat-deploy');
    if ('@openzeppelin/hardhat-upgrades' in deps) plugins.push('upgrades');

    // Read env file
    const envFile = fs.existsSync(path.join(folderPath, '.env'));

    // Parse hardhat config for networks
    let networks: Record<string, unknown> = {};
    if (configFile) {
      try {
        const cfgContent = fs.readFileSync(path.join(folderPath, configFile), 'utf-8');
        const netMatch = cfgContent.match(/networks\s*:\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/s);
        if (netMatch) {
          // Simple extraction of network names
          const networkNames = [...netMatch[1].matchAll(/(\w+)\s*:/g)].map(m => m[1]);
          networkNames.filter(n => !['accounts', 'url', 'chainId', 'gas', 'gasPrice', 'timeout'].includes(n))
            .forEach(n => { networks[n] = {}; });
        }
      } catch { }
    }

    return {
      valid: !!configFile || hasHardhat,
      configFile: configFile || null,
      packageManager: pm,
      name: (pkg.name as string) || path.basename(folderPath),
      hardhatVersion,
      nodeModulesExist: fs.existsSync(path.join(folderPath, 'node_modules')),
      framework,
      plugins,
      networks,
      envFile,
      bunInstalled,
      isBun
    };
  } catch (e) {
    return { valid: false, error: String(e) };
  }
});

// ─── Scan ABIs ───────────────────────────────────────────────────────────────
ipcMain.handle('scan-abis', async (_, folderPath: string) => {
  const abis: unknown[] = [];
  const scan = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'build-info') {
          scan(full);
        } else if (entry.isFile() && entry.name.endsWith('.json') && !entry.name.endsWith('.dbg.json')) {
          try {
            const content = JSON.parse(fs.readFileSync(full, 'utf-8'));
            if (Array.isArray(content.abi) && content.abi.length > 0) {
              abis.push({
                name: entry.name.replace('.json', ''),
                contractName: content.contractName || entry.name.replace('.json', ''),
                path: full,
                abi: content.abi,
                bytecode: content.bytecode || null,
                sourceName: content.sourceName || null
              });
            }
          } catch { }
        }
      }
    } catch { }
  };
  const dirs = ['artifacts', 'artifacts/contracts', 'out', 'build/contracts', 'deployments'];
  dirs.forEach(d => scan(path.join(folderPath, d)));
  return abis;
});

// ─── Watch ABIs ───────────────────────────────────────────────────────────────
ipcMain.handle('watch-abis', async (_, folderPath: string) => {
  const existing = watchers.get(folderPath);
  if (existing) { try { existing.close(); } catch { } }
  const artifactsPath = path.join(folderPath, 'artifacts');
  if (!fs.existsSync(artifactsPath)) return false;
  try {
    const w = fs.watch(artifactsPath, { recursive: true }, (_event: string, filename: string | null) => {
      if (filename && filename.endsWith('.json') && !filename.includes('dbg')) {
        mainWindow?.webContents.send('abis-changed', folderPath);
      }
    });
    watchers.set(folderPath, w);
    return true;
  } catch { return false; }
});

// ─── Scan source files ───────────────────────────────────────────────────────
ipcMain.handle('scan-sources', async (_, folderPath: string) => {
  const files: Array<{ name: string; path: string; size: number; }> = [];
  const scan = (dir: string, depth = 0) => {
    if (depth > 4 || !fs.existsSync(dir)) return;
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory() && depth < 3) scan(full, depth + 1);
        else if (entry.isFile() && (entry.name.endsWith('.sol') || entry.name.endsWith('.js') || entry.name.endsWith('.ts'))) {
          const stat = fs.statSync(full);
          files.push({ name: entry.name, path: full, size: stat.size });
        }
      }
    } catch { }
  };
  scan(folderPath);
  return files;
});

// ─── Run command ─────────────────────────────────────────────────────────────
ipcMain.handle('run-command', async (_, { id, command, cwd }: { id: string; command: string; cwd: string; }) => {
  const existing = processes.get(id);
  if (existing) { try { existing.kill('SIGTERM'); } catch { } processes.delete(id); }

  return new Promise<{ success: boolean; error?: string; }>((resolve) => {
    try {
      const isWin = process.platform === 'win32';
      const child = spawn(isWin ? 'cmd' : '/bin/sh', [isWin ? '/c' : '-c', command], {
        cwd,
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe']
      });
      processes.set(id, child);

      child.stdout?.on('data', (data: Buffer) => {
        mainWindow?.webContents.send('process-output', { id, type: 'stdout', data: data.toString() });
      });
      child.stderr?.on('data', (data: Buffer) => {
        mainWindow?.webContents.send('process-output', { id, type: 'stderr', data: data.toString() });
      });
      child.on('spawn', () => {
        mainWindow?.webContents.send('process-status', { id, status: 'running' });
        resolve({ success: true });
      });
      child.on('close', (code: number | null) => {
        processes.delete(id);
        mainWindow?.webContents.send('process-status', { id, status: 'stopped', code });
      });
      child.on('error', (err: Error) => {
        processes.delete(id);
        mainWindow?.webContents.send('process-status', { id, status: 'error', error: err.message });
        resolve({ success: false, error: err.message });
      });
    } catch (e) {
      resolve({ success: false, error: String(e) });
    }
  });
});

// ─── Stop command ─────────────────────────────────────────────────────────────
ipcMain.handle('stop-command', async (_, id: string) => {
  const proc = processes.get(id);
  if (!proc) return false;
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(proc.pid), '/f', '/t']);
    } else {
      proc.kill('SIGTERM');
      setTimeout(() => { try { proc.kill('SIGKILL'); } catch { } }, 2000);
    }
    processes.delete(id);
    return true;
  } catch { return false; }
});

ipcMain.handle('get-process-status', async (_, id: string) => processes.has(id) ? 'running' : 'stopped');

// ─── File operations ─────────────────────────────────────────────────────────
ipcMain.handle('read-file', async (_, filePath: string) => {
  try { return fs.readFileSync(filePath, 'utf-8'); } catch { return null; }
});

ipcMain.handle('write-file', async (_, { filePath, content }: { filePath: string; content: string; }) => {
  try { fs.writeFileSync(filePath, content, 'utf-8'); return true; } catch { return false; }
});

ipcMain.handle('list-dir', async (_, dirPath: string) => {
  try {
    if (!fs.existsSync(dirPath)) return [];
    return fs.readdirSync(dirPath, { withFileTypes: true }).map(e => ({
      name: e.name,
      isDir: e.isDirectory(),
      path: path.join(dirPath, e.name)
    }));
  } catch { return []; }
});

ipcMain.handle('open-external', async (_, url: string) => shell.openExternal(url));

ipcMain.handle('open-in-editor', async (_, filePath: string) => {
  const editors = ['code', 'cursor', 'subl', 'vim', 'nano'];
  for (const editor of editors) {
    try {
      spawn(editor, [filePath], { detached: true, stdio: 'ignore' });
      return true;
    } catch { }
  }
  try { shell.openPath(filePath); return true; } catch { return false; }
});

// ─── Read env file ────────────────────────────────────────────────────────────
ipcMain.handle('read-env', async (_, folderPath: string) => {
  const envPath = path.join(folderPath, '.env');
  if (!fs.existsSync(envPath)) return [];
  try {
    const content = fs.readFileSync(envPath, 'utf-8');
    return content.split('\n')
      .filter(l => l.trim() && !l.startsWith('#'))
      .map(l => {
        const idx = l.indexOf('=');
        if (idx === -1) return null;
        return { key: l.slice(0, idx).trim(), value: l.slice(idx + 1).trim() };
      })
      .filter(Boolean);
  } catch { return []; }
});

ipcMain.handle('write-env', async (_, { folderPath, entries }: { folderPath: string; entries: Array<{ key: string; value: string; }>; }) => {
  const envPath = path.join(folderPath, '.env');
  try {
    const content = entries.map(e => `${e.key}=${e.value}`).join('\n');
    fs.writeFileSync(envPath, content, 'utf-8');
    return true;
  } catch { return false; }
});

// ─── Git operations ───────────────────────────────────────────────────────────
const gitCmd = (cmd: string, cwd: string): string => {
  try { return execSync(`git ${cmd}`, { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim(); } catch { return ''; }
};

ipcMain.handle('git-status', async (_, cwd: string) => {
  try {
    const branch = gitCmd('rev-parse --abbrev-ref HEAD', cwd);
    if (!branch) return null;
    const remoteUrl = gitCmd('remote get-url origin', cwd);
    const ahead = parseInt(gitCmd('rev-list --count @{u}..HEAD', cwd) || '0');
    const behind = parseInt(gitCmd('rev-list --count HEAD..@{u}', cwd) || '0');
    const statusRaw = gitCmd('status --porcelain', cwd);
    const staged: string[] = [], unstaged: string[] = [], untracked: string[] = [];
    statusRaw.split('\n').filter(Boolean).forEach(l => {
      const s = l.slice(0, 2);
      const f = l.slice(3);
      if (s[0] !== ' ' && s[0] !== '?') staged.push(f);
      if (s[1] === 'M' || s[1] === 'D') unstaged.push(f);
      if (s === '??') untracked.push(f);
    });
    return { branch, ahead: isNaN(ahead) ? 0 : ahead, behind: isNaN(behind) ? 0 : behind, staged, unstaged, untracked, remoteUrl };
  } catch { return null; }
});

ipcMain.handle('git-branches', async (_, cwd: string) => {
  try {
    const raw = gitCmd('branch -a', cwd);
    return raw.split('\n').filter(Boolean).map(b => {
      const current = b.startsWith('*');
      const name = b.replace(/^\*?\s+/, '').trim();
      return { name, current, remote: name.startsWith('remotes/') };
    });
  } catch { return []; }
});

ipcMain.handle('git-log', async (_, cwd: string) => {
  try {
    const raw = gitCmd('log --oneline --format="%H|%h|%s|%an|%ar" -20', cwd);
    return raw.split('\n').filter(Boolean).map(l => {
      const [hash, shortHash, message, author, date] = l.split('|');
      return { hash, shortHash, message, author, date };
    });
  } catch { return []; }
});

ipcMain.handle('git-diff', async (_, { cwd, file }: { cwd: string; file?: string; }) => {
  try {
    const cmd = file ? `diff HEAD -- "${file}"` : 'diff HEAD';
    return gitCmd(cmd, cwd);
  } catch { return ''; }
});

ipcMain.handle('git-commit', async (_, { cwd, message, push }: { cwd: string; message: string; push: boolean; }) => {
  try {
    gitCmd('add -A', cwd);
    gitCmd(`commit -m "${message.replace(/"/g, '\\"')}"`, cwd);
    if (push) gitCmd('push', cwd);
    return { success: true };
  } catch (e) { return { success: false, error: String(e) }; }
});

ipcMain.handle('git-checkout', async (_, { cwd, branch, create }: { cwd: string; branch: string; create: boolean; }) => {
  try {
    if (create) gitCmd(`checkout -b ${branch}`, cwd);
    else gitCmd(`checkout ${branch}`, cwd);
    return { success: true };
  } catch (e) { return { success: false, error: String(e) }; }
});

ipcMain.handle('git-pull', async (_, cwd: string) => {
  try { gitCmd('pull', cwd); return { success: true }; } catch (e) { return { success: false, error: String(e) }; }
});

// ─── Hardhat accounts ─────────────────────────────────────────────────────────
ipcMain.handle('get-hardhat-accounts', async (_, rpcUrl: string) => {
  // All 20 standard Hardhat default accounts (mnemonic: "test test test test test test test test test test test junk")
  const DEFAULT_ACCOUNTS = [
    { address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' },
    { address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', privateKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' },
    { address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', privateKey: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a' },
    { address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906', privateKey: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6' },
    { address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', privateKey: '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926b' },
    { address: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc', privateKey: '0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba' },
    { address: '0x976EA74026E726554dB657fA54763abd0C3a0aa9', privateKey: '0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564' },
    { address: '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955', privateKey: '0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356' },
    { address: '0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f', privateKey: '0xdbda1821b80551c9d65939329250132c444b4a15823c01d4b8a5e64d03c5a8a5' },
    { address: '0xa0Ee7A142d267C1f36714E4a8F75612F20a79720', privateKey: '0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6' },
    // Accounts 10–19
    { address: '0xBcd4042DE499D14e55001CcbB24a551F3b954096', privateKey: '0xf214f2b2cd398c806f84e317254e0f0b801d0643303237d97a22a48e01628897' },
    { address: '0x71bE63f3384f5fb98995898A86B02Fb2426c5788', privateKey: '0x701b615bbdfb9de65240bc28bd21bbc0d996645a3dd57e7b12bc2bdf6f192c82' },
    { address: '0xFABB0ac9d68B0B445fB7357272Ff202C5651694a', privateKey: '0xa267530f49f8280200edf313ee7af6b827f2a8bce2897751d06a843f644967b1' },
    { address: '0x1CBd3b2770909D4e10f157cABC84C7264073C9Ec', privateKey: '0x47c99abed3324a2707c28affff1267e45918ec8c3f20b8aa892e8b065d2942dd' },
    { address: '0xdF3e18d64BC6A983f673Ab319CCaE4f1a57C7097', privateKey: '0xc526ee95bf44d8fc405a158bb884d9d1238d99f0612e9f33d006bb0789009aaa' },
    { address: '0xcd3B766CCDd6AE721141F452C550Ca635964ce71', privateKey: '0x8166f546bab6da521a8369cab06c5d2b9e46670292d85ca9517fb0706b19e7b' },
    { address: '0x2546BcD3c84621e976D8185a91A922aE77ECEc30', privateKey: '0xea6c44ac03bff858b476bba28179e2f12f3a5cb5e89fa64dd57ce40de0e4c8a' },
    { address: '0xbDA5747bFD65F08deb54cb465eB87D40e51B197E', privateKey: '0x689af8efa8c651a91ad287602527f3af2fe9f6501a7ac4b061667b5a93e037fd' },
    { address: '0xdD2FD4581271e230360230F9337D5c0430Bf44C0', privateKey: '0xde9be857da6a0e9c9f7a5c2f8c22a0d5f8a2bbb60b87f6bebc02fb17f9ca0d2' },
    { address: '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199', privateKey: '0xdf57089febbacf7ba0bc227dafbffa9fc08a93fdc68e1e42411a14efcf23656e' },
  ];

  // Try to fetch live accounts from the running Hardhat node.
  // eth_accounts returns the same 20 addresses when node is active.
  // We match them against our known keys; if the node is down, fall back to defaults.
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_accounts', params: [] }),
    });
    const data = await res.json() as { result?: string[]; error?: { message: string; }; };
    if (data.result && Array.isArray(data.result) && data.result.length > 0) {
      const liveAddresses: string[] = data.result;
      // Build a lookup from our known list (lower-case address → entry)
      const knownMap = new Map(DEFAULT_ACCOUNTS.map(a => [a.address.toLowerCase(), a]));
      return liveAddresses.map((addr, i) => {
        const known = knownMap.get(addr.toLowerCase());
        return {
          address: addr,
          privateKey: known?.privateKey ?? '',
          index: i,
          balance: '0',
        };
      });
    }
  } catch {
    // Node not reachable — fall through to static list
  }

  // Fallback: return full static 20-account list
  return DEFAULT_ACCOUNTS.map((a, i) => ({ ...a, index: i, balance: '0' }));
});

// ─── Read README ──────────────────────────────────────────────────────────────
ipcMain.handle('read-readme', async (_, folderPath: string) => {
  const names = ['README.md', 'readme.md', 'README.MD', 'Readme.md'];
  for (const n of names) {
    const p = path.join(folderPath, n);
    if (fs.existsSync(p)) {
      try { return fs.readFileSync(p, 'utf-8'); } catch { }
    }
  }
  return null;
});

// ─── Security analysis ────────────────────────────────────────────────────────
ipcMain.handle('analyze-security', async (_, { folderPath }: { folderPath: string; }) => {
  const findings: unknown[] = [];
  const scan = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) scan(full);
        else if (entry.name.endsWith('.sol')) {
          try {
            const content = fs.readFileSync(full, 'utf-8');
            const lines = content.split('\n');

            lines.forEach((line, i) => {
              if (line.includes('tx.origin'))
                findings.push({ severity: 'high', title: 'tx.origin Usage', description: `tx.origin used in ${entry.name}:${i + 1}`, line: i + 1, function: '', recommendation: 'Use msg.sender instead' });
              if (line.includes('selfdestruct') || line.includes('suicide'))
                findings.push({ severity: 'critical', title: 'Selfdestruct', description: `Selfdestruct in ${entry.name}:${i + 1}`, line: i + 1, recommendation: 'Remove selfdestruct or add strict access control' });
              if (line.match(/\.call\s*\{/))
                findings.push({ severity: 'medium', title: 'Low-level call', description: `Low-level call in ${entry.name}:${i + 1}`, line: i + 1, recommendation: 'Check return value and add reentrancy guard' });
              if (line.includes('block.timestamp') || line.includes('now'))
                findings.push({ severity: 'low', title: 'Timestamp Dependency', description: `Timestamp usage in ${entry.name}:${i + 1}`, line: i + 1, recommendation: 'Avoid relying on block.timestamp for critical logic' });
              if (line.match(/\.transfer\s*\(/) || line.match(/\.send\s*\(/))
                findings.push({ severity: 'medium', title: 'transfer/send Usage', description: `transfer/send in ${entry.name}:${i + 1}`, line: i + 1, recommendation: 'Use call{value:...}() with reentrancy guard instead' });
              if (line.includes('delegatecall'))
                findings.push({ severity: 'high', title: 'Delegatecall', description: `Delegatecall in ${entry.name}:${i + 1}`, line: i + 1, recommendation: 'Ensure delegatecall target is trusted and not upgradeable' });
            });

            if (!content.includes('pragma solidity') || content.match(/pragma solidity\s+\^0\.[0-7]/))
              findings.push({ severity: 'medium', title: 'Outdated Solidity', description: `${entry.name} may use outdated compiler`, recommendation: 'Use solidity 0.8.x or later' });
            if (!content.includes('Ownable') && !content.includes('AccessControl') && content.includes('onlyOwner'))
              findings.push({ severity: 'low', title: 'Custom Access Control', description: `Custom access control in ${entry.name}`, recommendation: 'Use OpenZeppelin Ownable or AccessControl' });

          } catch { }
        }
      }
    } catch { }
  };

  const contractsDir = path.join(folderPath, 'contracts');
  if (fs.existsSync(contractsDir)) scan(contractsDir);
  else scan(folderPath);

  return findings;
});

// ─── Export logs ──────────────────────────────────────────────────────────────
ipcMain.handle('export-logs', async (_, { content, filename }: { content: string; filename: string; }) => {
  const result = await dialog.showSaveDialog(mainWindow!, {
    defaultPath: filename,
    filters: [{ name: 'Log Files', extensions: ['log', 'txt', 'json'] }]
  });
  if (result.canceled || !result.filePath) return false;
  try { fs.writeFileSync(result.filePath, content, 'utf-8'); return true; } catch { return false; }
});

// ─── Save/load workspace ──────────────────────────────────────────────────────
ipcMain.handle('save-workspace', async (_, { workspace, savePath }: { workspace: unknown; savePath?: string; }) => {
  const filePath = savePath || (await dialog.showSaveDialog(mainWindow!, {
    defaultPath: 'workspace.hhws',
    filters: [{ name: 'Hardhat Studio Workspace', extensions: ['hhws', 'json'] }]
  })).filePath;
  if (!filePath) return null;
  try { fs.writeFileSync(filePath, JSON.stringify(workspace, null, 2), 'utf-8'); return filePath; } catch { return null; }
});

ipcMain.handle('load-workspace', async (_, loadPath?: string) => {
  const filePath = loadPath || (await dialog.showOpenDialog(mainWindow!, {
    filters: [{ name: 'Hardhat Studio Workspace', extensions: ['hhws', 'json'] }],
    properties: ['openFile']
  })).filePaths?.[0];
  if (!filePath || !fs.existsSync(filePath)) return null;
  try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')); } catch { return null; }
});

// ─── Generate Obsidian docs ───────────────────────────────────────────────────
ipcMain.handle('generate-docs', async (_, { abis, projectName, outputPath }: { abis: unknown[]; projectName: string; outputPath?: string; }) => {
  const outDir = outputPath || (await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
    title: 'Select Obsidian Vault or Output Folder'
  })).filePaths?.[0];
  if (!outDir) return false;

  try {
    const docsDir = path.join(outDir, projectName);
    fs.mkdirSync(docsDir, { recursive: true });

    const abiList = abis as Array<{ contractName: string; abi: Array<{ type: string; name?: string; inputs?: Array<{ name: string; type: string; }>; outputs?: Array<{ name: string; type: string; }>; stateMutability?: string; }>; sourceName?: string; }>;

    for (const abi of abiList) {
      const fns = abi.abi.filter(i => i.type === 'function');
      const events = abi.abi.filter(i => i.type === 'event');

      let doc = `# ${abi.contractName}\n\n`;
      doc += `> Source: \`${abi.sourceName || 'unknown'}\`\n\n`;
      doc += `## Functions\n\n`;
      for (const fn of fns) {
        doc += `### \`${fn.name}(${(fn.inputs || []).map(i => `${i.type} ${i.name}`).join(', ')})\`\n`;
        doc += `- **Mutability**: \`${fn.stateMutability}\`\n`;
        if (fn.outputs?.length) doc += `- **Returns**: \`${fn.outputs.map(o => o.type).join(', ')}\`\n`;
        doc += `\n`;
      }
      if (events.length) {
        doc += `## Events\n\n`;
        for (const ev of events) {
          doc += `### \`${ev.name}(${(ev.inputs || []).map(i => `${i.type} ${i.name}`).join(', ')})\`\n\n`;
        }
      }
      fs.writeFileSync(path.join(docsDir, `${abi.contractName}.md`), doc, 'utf-8');
    }

    // Index file
    let index = `# ${projectName} - Contract Index\n\n`;
    for (const abi of abiList) index += `- [[${abi.contractName}]]\n`;
    fs.writeFileSync(path.join(docsDir, 'INDEX.md'), index, 'utf-8');

    return true;
  } catch { return false; }
});

// ─── Scan scripts folder ──────────────────────────────────────────────────────
ipcMain.handle(
  'scan-scripts',
  async (_, folderPath: string, subDir: string | null = null) => {

    const targetDir = subDir
      ? path.join(folderPath, subDir)
      : path.join(folderPath, 'scripts');

    if (!fs.existsSync(targetDir)) return [];

    const results: any[] = [];

    const scan = (dir: string, depth = 0) => {
      if (depth > 3) return;

      try {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

          const full = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            scan(full, depth + 1);
            continue;
          }

          if (
            entry.name.endsWith('.js') ||
            entry.name.endsWith('.ts') ||
            entry.name.endsWith('.mjs')
          ) {
            const stat = fs.statSync(full);
            const rel = path.relative(folderPath, full);

            results.push({
              id: rel,
              name: entry.name,
              path: full,
              relativePath: rel,
              size: stat.size
            });
          }
        }
      } catch { }
    };

    scan(targetDir);

    return results;
  }
);

// ─── Chain snapshot / fork (via JSON-RPC) ────────────────────────────────────
ipcMain.handle('evm-snapshot', async (_, rpcUrl: string) => {
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'evm_snapshot', params: [] })
    });
    const data = await res.json() as { result?: string; error?: { message: string; }; };
    if (data.error) return { success: false, error: data.error.message };
    return { success: true, snapshotId: data.result };
  } catch (e) { return { success: false, error: String(e) }; }
});

ipcMain.handle('evm-revert', async (_, { rpcUrl, snapshotId }: { rpcUrl: string; snapshotId: string; }) => {
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'evm_revert', params: [snapshotId] })
    });
    const data = await res.json() as { result?: boolean; error?: { message: string; }; };
    if (data.error) return { success: false, error: data.error.message };
    return { success: true, result: data.result };
  } catch (e) { return { success: false, error: String(e) }; }
});

ipcMain.handle('evm-mine', async (_, rpcUrl: string) => {
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'evm_mine', params: [] })
    });
    const data = await res.json() as { result?: string; error?: { message: string; }; };
    return { success: !data.error };
  } catch (e) { return { success: false, error: String(e) }; }
});

ipcMain.handle('eth-block-number', async (_, rpcUrl: string) => {
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] })
    });
    const data = await res.json() as { result?: string; };
    return data.result ? parseInt(data.result, 16) : 0;
  } catch { return 0; }
});

// ─── Artifact diff ────────────────────────────────────────────────────────────
ipcMain.handle('scan-artifacts-meta', async (_, folderPath: string) => {
  const results: unknown[] = [];
  const artifactsDir = path.join(folderPath, 'artifacts');
  if (!fs.existsSync(artifactsDir)) return results;

  const scan = (dir: string) => {
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== 'build-info') { scan(full); continue; }
        if (entry.isFile() && entry.name.endsWith('.json') && !entry.name.endsWith('.dbg.json')) {
          try {
            const content = JSON.parse(fs.readFileSync(full, 'utf-8'));
            if (Array.isArray(content.abi)) {
              const stat = fs.statSync(full);
              results.push({
                contractName: content.contractName || entry.name.replace('.json', ''),
                path: full,
                bytecodeSizeBytes: content.bytecode ? (content.bytecode.length - 2) / 2 : 0,
                abiCount: content.abi.length,
                modifiedAt: stat.mtimeMs,
                abi: content.abi
              });
            }
          } catch { }
        }
      }
    } catch { }
  };
  scan(artifactsDir);
  return results;
});

// ─── Read token balances (ERC-20) ─────────────────────────────────────────────
ipcMain.handle('get-token-balances', async (_, { rpcUrl, address, tokenAddresses }: { rpcUrl: string; address: string; tokenAddresses: string[]; }) => {
  const ERC20_BALANCE_OF = '0x70a08231'; // balanceOf(address)
  const ERC20_SYMBOL = '0x95d89b41';
  const ERC20_DECIMALS = '0x313ce567';
  const ERC20_NAME = '0x06fdde03';
  const results: unknown[] = [];

  for (const tokenAddr of tokenAddresses) {
    try {
      const padAddr = address.slice(2).padStart(64, '0');

      const [balRes, symRes, decRes, nameRes] = await Promise.all([
        fetch(rpcUrl, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: tokenAddr, data: ERC20_BALANCE_OF + padAddr }, 'latest'] })
        }),
        fetch(rpcUrl, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'eth_call', params: [{ to: tokenAddr, data: ERC20_SYMBOL }, 'latest'] })
        }),
        fetch(rpcUrl, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'eth_call', params: [{ to: tokenAddr, data: ERC20_DECIMALS }, 'latest'] })
        }),
        fetch(rpcUrl, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 4, method: 'eth_call', params: [{ to: tokenAddr, data: ERC20_NAME }, 'latest'] })
        }),
      ]);

      const [balData, symData, decData, nameData] = await Promise.all([
        balRes.json() as Promise<{ result?: string; }>,
        symRes.json() as Promise<{ result?: string; }>,
        decRes.json() as Promise<{ result?: string; }>,
        nameRes.json() as Promise<{ result?: string; }>,
      ]);

      const balance = balData.result && balData.result !== '0x' ? BigInt(balData.result).toString() : '0';
      const decimals = decData.result && decData.result !== '0x' ? parseInt(decData.result, 16) : 18;

      // Decode string from hex
      const decodeStr = (hex: string) => {
        if (!hex || hex === '0x') return '';
        try {
          const clean = hex.slice(2);
          const offset = parseInt(clean.slice(0, 64), 16) * 2;
          const len = parseInt(clean.slice(64, 128), 16) * 2;
          const str = clean.slice(128, 128 + len);
          return Buffer.from(str, 'hex').toString('utf8').replace(/\0/g, '');
        } catch { return ''; }
      };

      results.push({
        address: tokenAddr,
        name: decodeStr(nameData.result || ''),
        symbol: decodeStr(symData.result || ''),
        decimals,
        balance,
        balanceFormatted: decimals > 0 ? (Number(balance) / Math.pow(10, decimals)).toFixed(4) : balance,
      });
    } catch { }
  }
  return results;
});

// ─── Proxy inspector (EIP-1967 slots) ─────────────────────────────────────────
ipcMain.handle('inspect-proxy', async (_, { rpcUrl, address }: { rpcUrl: string; address: string; }) => {
  // EIP-1967 storage slots
  const SLOTS = {
    implementation: '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc',
    admin: '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103',
    beacon: '0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50',
  };

  const getSlot = async (slot: string) => {
    try {
      const res = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getStorageAt', params: [address, slot, 'latest'] })
      });
      const data = await res.json() as { result?: string; };
      return data.result || '0x0000000000000000000000000000000000000000000000000000000000000000';
    } catch { return '0x' + '0'.repeat(64); }
  };

  const [implSlot, adminSlot, beaconSlot] = await Promise.all([
    getSlot(SLOTS.implementation),
    getSlot(SLOTS.admin),
    getSlot(SLOTS.beacon),
  ]);

  const toAddr = (slot: string) => '0x' + slot.slice(-40);
  const isZero = (addr: string) => addr === '0x' + '0'.repeat(40);

  const impl = toAddr(implSlot);
  const admin = toAddr(adminSlot);
  const beacon = toAddr(beaconSlot);

  let type: string = 'unknown';
  if (!isZero(impl) && !isZero(admin)) type = 'transparent';
  else if (!isZero(impl) && isZero(admin)) type = 'uups';
  else if (!isZero(beacon)) type = 'beacon';

  // Check code at address to see if it's even a proxy
  const codeRes = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getCode', params: [address, 'latest'] })
  });
  const codeData = await codeRes.json() as { result?: string; };
  const code = codeData.result || '0x';
  // Minimal proxy pattern check (EIP-1167)
  if (code.includes('363d3d37')) type = 'minimal';

  return {
    type,
    proxyAddress: address,
    implementationAddress: isZero(impl) ? null : impl,
    adminAddress: isZero(admin) ? null : admin,
    beaconAddress: isZero(beacon) ? null : beacon,
    slots: [
      { slot: SLOTS.implementation, value: implSlot, label: 'Implementation' },
      { slot: SLOTS.admin, value: adminSlot, label: 'Admin' },
      { slot: SLOTS.beacon, value: beaconSlot, label: 'Beacon' },
    ],
    bytecodeSize: (code.length - 2) / 2,
    isProxy: type !== 'unknown' && code.length > 2,
  };
});

// ─── Decode bytecode to opcodes ───────────────────────────────────────────────
ipcMain.handle('decode-opcodes', async (_, bytecode: string) => {
  // Minimal EVM opcode map
  const OPCODES: Record<number, { name: string; gas: number; operandBytes?: number; }> = {
    0x00: { name: 'STOP', gas: 0 },
    0x01: { name: 'ADD', gas: 3 },
    0x02: { name: 'MUL', gas: 5 },
    0x03: { name: 'SUB', gas: 3 },
    0x04: { name: 'DIV', gas: 5 },
    0x05: { name: 'SDIV', gas: 5 },
    0x06: { name: 'MOD', gas: 5 },
    0x07: { name: 'SMOD', gas: 5 },
    0x08: { name: 'ADDMOD', gas: 8 },
    0x09: { name: 'MULMOD', gas: 8 },
    0x0a: { name: 'EXP', gas: 10 },
    0x0b: { name: 'SIGNEXTEND', gas: 5 },
    0x10: { name: 'LT', gas: 3 },
    0x11: { name: 'GT', gas: 3 },
    0x12: { name: 'SLT', gas: 3 },
    0x13: { name: 'SGT', gas: 3 },
    0x14: { name: 'EQ', gas: 3 },
    0x15: { name: 'ISZERO', gas: 3 },
    0x16: { name: 'AND', gas: 3 },
    0x17: { name: 'OR', gas: 3 },
    0x18: { name: 'XOR', gas: 3 },
    0x19: { name: 'NOT', gas: 3 },
    0x1a: { name: 'BYTE', gas: 3 },
    0x1b: { name: 'SHL', gas: 3 },
    0x1c: { name: 'SHR', gas: 3 },
    0x1d: { name: 'SAR', gas: 3 },
    0x20: { name: 'SHA3', gas: 30 },
    0x30: { name: 'ADDRESS', gas: 2 },
    0x31: { name: 'BALANCE', gas: 100 },
    0x32: { name: 'ORIGIN', gas: 2 },
    0x33: { name: 'CALLER', gas: 2 },
    0x34: { name: 'CALLVALUE', gas: 2 },
    0x35: { name: 'CALLDATALOAD', gas: 3 },
    0x36: { name: 'CALLDATASIZE', gas: 2 },
    0x37: { name: 'CALLDATACOPY', gas: 3 },
    0x38: { name: 'CODESIZE', gas: 2 },
    0x39: { name: 'CODECOPY', gas: 3 },
    0x3a: { name: 'GASPRICE', gas: 2 },
    0x3b: { name: 'EXTCODESIZE', gas: 100 },
    0x3c: { name: 'EXTCODECOPY', gas: 100 },
    0x3d: { name: 'RETURNDATASIZE', gas: 2 },
    0x3e: { name: 'RETURNDATACOPY', gas: 3 },
    0x3f: { name: 'EXTCODEHASH', gas: 100 },
    0x40: { name: 'BLOCKHASH', gas: 20 },
    0x41: { name: 'COINBASE', gas: 2 },
    0x42: { name: 'TIMESTAMP', gas: 2 },
    0x43: { name: 'NUMBER', gas: 2 },
    0x44: { name: 'DIFFICULTY', gas: 2 },
    0x45: { name: 'GASLIMIT', gas: 2 },
    0x46: { name: 'CHAINID', gas: 2 },
    0x47: { name: 'SELFBALANCE', gas: 5 },
    0x50: { name: 'POP', gas: 2 },
    0x51: { name: 'MLOAD', gas: 3 },
    0x52: { name: 'MSTORE', gas: 3 },
    0x53: { name: 'MSTORE8', gas: 3 },
    0x54: { name: 'SLOAD', gas: 100 },
    0x55: { name: 'SSTORE', gas: 100 },
    0x56: { name: 'JUMP', gas: 8 },
    0x57: { name: 'JUMPI', gas: 10 },
    0x58: { name: 'PC', gas: 2 },
    0x59: { name: 'MSIZE', gas: 2 },
    0x5a: { name: 'GAS', gas: 2 },
    0x5b: { name: 'JUMPDEST', gas: 1 },
    0xf0: { name: 'CREATE', gas: 32000 },
    0xf1: { name: 'CALL', gas: 100 },
    0xf2: { name: 'CALLCODE', gas: 100 },
    0xf3: { name: 'RETURN', gas: 0 },
    0xf4: { name: 'DELEGATECALL', gas: 100 },
    0xf5: { name: 'CREATE2', gas: 32000 },
    0xfa: { name: 'STATICCALL', gas: 100 },
    0xfd: { name: 'REVERT', gas: 0 },
    0xfe: { name: 'INVALID', gas: 0 },
    0xff: { name: 'SELFDESTRUCT', gas: 5000 },
  };
  // PUSH1..PUSH32
  for (let i = 0; i < 32; i++) {
    OPCODES[0x60 + i] = { name: `PUSH${i + 1}`, gas: 3, operandBytes: i + 1 };
  }
  // DUP1..DUP16
  for (let i = 0; i < 16; i++) OPCODES[0x80 + i] = { name: `DUP${i + 1}`, gas: 3 };
  // SWAP1..SWAP16
  for (let i = 0; i < 16; i++) OPCODES[0x90 + i] = { name: `SWAP${i + 1}`, gas: 3 };
  // LOG0..LOG4
  for (let i = 0; i < 5; i++) OPCODES[0xa0 + i] = { name: `LOG${i}`, gas: 375 };

  const hex = bytecode.startsWith('0x') ? bytecode.slice(2) : bytecode;
  const bytes = Buffer.from(hex, 'hex');
  const result: unknown[] = [];
  let i = 0;
  while (i < bytes.length && result.length < 2000) {
    const byte = bytes[i];
    const op = OPCODES[byte] || { name: `0x${byte.toString(16).padStart(2, '0')}`, gas: 0 };
    const operandBytes = op.operandBytes || 0;
    let operand: string | undefined;
    if (operandBytes > 0 && i + operandBytes < bytes.length) {
      operand = '0x' + bytes.slice(i + 1, i + 1 + operandBytes).toString('hex');
    }
    result.push({ offset: i, opcode: op.name, operand, gasCost: op.gas });
    i += 1 + operandBytes;
  }
  return result;
});

// ─── File dialog helpers (untuk NotesEditorPanel) ───────────────────────────
ipcMain.handle(
  'show-open-file-dialog',
  async (
    _,
    opts: {
      filters?: Array<{ name: string; extensions: string[]; }>;
      title?: string;
    } = {},
  ) => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile'],
      title: opts.title || 'Open File',
      filters: opts.filters || [{ name: 'All Files', extensions: ['*'] }],
    });
    return result.canceled || !result.filePaths[0] ? null : result.filePaths[0];
  },
);

ipcMain.handle(
  'show-save-file-dialog',
  async (
    _,
    opts: {
      defaultPath?: string;
      filters?: Array<{ name: string; extensions: string[]; }>;
      title?: string;
    } = {},
  ) => {
    const result = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: opts.defaultPath || 'untitled.txt',
      title: opts.title || 'Save File',
      filters: opts.filters || [{ name: 'All Files', extensions: ['*'] }],
    });
    return result.canceled ? null : result.filePath ?? null;
  },
);

// ─── Storage layout from source (heuristic) ──────────────────────────────────
ipcMain.handle('analyze-storage-layout', async (_, { folderPath, contractName }: { folderPath: string; contractName: string; }) => {
  const solDirs = [
    path.join(folderPath, 'contracts'),
    folderPath,
  ];
  const slots: unknown[] = [];

  const TYPE_SIZES: Record<string, number> = {
    bool: 1, uint8: 1, int8: 1, uint16: 2, int16: 2, uint32: 4, int32: 4,
    uint64: 8, int64: 8, uint128: 16, int128: 16, uint256: 32, int256: 32,
    uint: 32, int: 32, address: 20, bytes1: 1, bytes2: 2, bytes4: 4, bytes8: 8,
    bytes16: 16, bytes20: 20, bytes32: 32, bytes: 32, string: 32,
  };

  const scan = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { scan(full); continue; }
      if (!entry.name.endsWith('.sol')) continue;
      try {
        const src = fs.readFileSync(full, 'utf-8');
        // Find the contract block
        const contractMatch = new RegExp(`contract\\s+${contractName}[^{]*\\{([\\s\\S]*?)^\\}`, 'm').exec(src);
        if (!contractMatch) continue;

        const body = contractMatch[1];
        // Extract state variable declarations
        const varRe = /^\s*(uint\d*|int\d*|bool|address|bytes\d*|string|bytes|mapping[^;]+|[A-Z]\w+)\s+(?:public\s+|private\s+|internal\s+|immutable\s+|constant\s+)*(\w+)\s*[;=]/gm;
        let slotNum = 0;
        let byteOffset = 0;
        let match: RegExpExecArray | null;

        while ((match = varRe.exec(body)) !== null) {
          const typeName = match[1].trim().split(/\s+/)[0];
          const varName = match[2];
          if (varName === 'constant' || varName === 'immutable') continue;

          const bytes = TYPE_SIZES[typeName] || 32;
          if (byteOffset + bytes > 32) { slotNum++; byteOffset = 0; }

          slots.push({ slot: slotNum, name: varName, type: typeName, bytes, offset: byteOffset });
          byteOffset += bytes;
          if (byteOffset >= 32) { slotNum++; byteOffset = 0; }
        }
      } catch { }
    }
  };

  solDirs.forEach(scan);
  return slots;
});

// ─── Audit notes persist ──────────────────────────────────────────────────────
ipcMain.handle('save-audit-notes', async (_, { folderPath, notes }: { folderPath: string; notes: unknown[]; }) => {
  try {
    const p = path.join(folderPath, '.hardhat-studio', 'audit-notes.json');
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(notes, null, 2), 'utf-8');
    return true;
  } catch { return false; }
});

ipcMain.handle('load-audit-notes', async (_, folderPath: string) => {
  try {
    const p = path.join(folderPath, '.hardhat-studio', 'audit-notes.json');
    if (!fs.existsSync(p)) return [];
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch { return []; }
});