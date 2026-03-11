import { ipcMain } from 'electron';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

//  Helpers 
function detectPackageManager(folderPath: string): string {
  if (fs.existsSync(path.join(folderPath, 'bun.lockb'))) return 'bun';
  if (fs.existsSync(path.join(folderPath, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(folderPath, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

function isBunInstalled(): boolean {
  try { execSync('bun --version', { stdio: 'ignore' }); return true; } catch { return false; }
}

function readPkg(folderPath: string): Record<string, unknown> {
  try {
    return JSON.parse(fs.readFileSync(path.join(folderPath, 'package.json'), 'utf-8'));
  } catch {
    return {};
  }
}

function detectHardhatVersion(folderPath: string): string | null {
  try {
    const p = path.join(folderPath, 'node_modules', 'hardhat', 'package.json');
    return JSON.parse(fs.readFileSync(p, 'utf-8')).version;
  } catch {
    return null;
  }
}

function detectFramework(deps: Record<string, unknown>): string | null {
  const hasEthers = 'ethers' in deps || '@nomicfoundation/hardhat-ethers' in deps;
  const hasViem = 'viem' in deps || '@nomicfoundation/hardhat-viem' in deps;
  if (hasEthers && hasViem) return 'both';
  if (hasEthers) return 'ethers';
  if (hasViem) return 'viem';
  return null;
}

function detectPlugins(deps: Record<string, unknown>): string[] {
  const map: Record<string, string> = {
    '@openzeppelin/contracts': 'openzeppelin',
    '@nomicfoundation/hardhat-toolbox': 'toolbox',
    'hardhat-gas-reporter': 'gas-reporter',
    'solidity-coverage': 'coverage',
    '@typechain/hardhat': 'typechain',
    'hardhat-deploy': 'hardhat-deploy',
    '@openzeppelin/hardhat-upgrades': 'upgrades',
  };
  return Object.entries(map).filter(([pkg]) => pkg in deps).map(([, label]) => label);
}

function parseNetworkNames(folderPath: string, configFile: string): Record<string, unknown> {
  const SKIP = new Set(['accounts', 'url', 'chainId', 'gas', 'gasPrice', 'timeout']);
  try {
    const cfgContent = fs.readFileSync(path.join(folderPath, configFile), 'utf-8');
    const netMatch = cfgContent.match(/networks\s*:\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/s);
    if (!netMatch) return {};
    const names = [...netMatch[1].matchAll(/(\w+)\s*:/g)]
      .map(m => m[1])
      .filter(n => !SKIP.has(n));
    return Object.fromEntries(names.map(n => [n, {}]));
  } catch {
    return {};
  }
}

//  Recursive ABI scanner 
function scanAbisInDir(dir: string, results: unknown[]): void {
  if (!fs.existsSync(dir)) return;
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'build-info') {
        scanAbisInDir(full, results);
      } else if (
        entry.isFile() &&
        entry.name.endsWith('.json') &&
        !entry.name.endsWith('.dbg.json')
      ) {
        try {
          const content = JSON.parse(fs.readFileSync(full, 'utf-8'));
          if (Array.isArray(content.abi) && content.abi.length > 0) {
            results.push({
              name: entry.name.replace('.json', ''),
              contractName: content.contractName || entry.name.replace('.json', ''),
              path: full,
              abi: content.abi,
              bytecode: content.bytecode || null,
              sourceName: content.sourceName || null,
            });
          }
        } catch { /* skip malformed JSON */ }
      }
    }
  } catch { /* skip unreadable dirs */ }
}

//  IPC Handlers 
export function registerProjectHandlers(getWin: () => Electron.BrowserWindow | null): void {

  //  Validate project 
  ipcMain.handle('validate-project', async (_, folderPath: string) => {
    try {
      const CONFIGS = ['hardhat.config.js', 'hardhat.config.ts', 'hardhat.config.cjs', 'hardhat.config.mjs'];
      const configFile = CONFIGS.find(f => fs.existsSync(path.join(folderPath, f))) ?? null;

      const pkg = readPkg(folderPath);
      const deps = { ...(pkg.dependencies as object || {}), ...(pkg.devDependencies as object || {}) };
      const hardhatVersion = detectHardhatVersion(folderPath);
      const pm = detectPackageManager(folderPath);
      const isBun = pm === 'bun';

      return {
        valid: !!configFile || 'hardhat' in deps || !!hardhatVersion,
        configFile,
        packageManager: pm,
        name: (pkg.name as string) || path.basename(folderPath),
        hardhatVersion,
        nodeModulesExist: fs.existsSync(path.join(folderPath, 'node_modules')),
        framework: detectFramework(deps),
        plugins: detectPlugins(deps),
        networks: configFile ? parseNetworkNames(folderPath, configFile) : {},
        envFile: fs.existsSync(path.join(folderPath, '.env')),
        bunInstalled: isBunInstalled(),
        isBun,
      };
    } catch (e) {
      return { valid: false, error: String(e) };
    }
  });

  //  Scan ABIs 
  ipcMain.handle('scan-abis', async (_, folderPath: string) => {
    const results: unknown[] = [];
    const ABI_DIRS = ['artifacts', 'artifacts/contracts', 'out', 'build/contracts', 'deployments'];
    ABI_DIRS.forEach(d => scanAbisInDir(path.join(folderPath, d), results));
    return results;
  });

  //  Watch ABIs (re-scan on artifact change) 
  const watchers = new Map<string, fs.FSWatcher>();

  ipcMain.handle('watch-abis', async (_, folderPath: string) => {
    const existing = watchers.get(folderPath);
    if (existing) { try { existing.close(); } catch { } }

    const artifactsPath = path.join(folderPath, 'artifacts');
    if (!fs.existsSync(artifactsPath)) return false;

    try {
      const w = fs.watch(
        artifactsPath,
        { recursive: true },
        (_event: string, filename: string | null) => {
          if (filename && filename.endsWith('.json') && !filename.includes('dbg')) {
            getWin()?.webContents.send('abis-changed', folderPath);
          }
        },
      );
      watchers.set(folderPath, w);
      return true;
    } catch {
      return false;
    }
  });

  //  Scan source files (.sol / .js / .ts) 
  ipcMain.handle('scan-sources', async (_, folderPath: string) => {
    const files: Array<{ name: string; path: string; size: number; }> = [];
    const EXTS = new Set(['.sol', '.js', '.ts']);

    const scan = (dir: string, depth = 0) => {
      if (depth > 4 || !fs.existsSync(dir)) return;
      try {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
          const full = path.join(dir, entry.name);
          if (entry.isDirectory() && depth < 3) { scan(full, depth + 1); continue; }
          if (entry.isFile() && EXTS.has(path.extname(entry.name))) {
            files.push({ name: entry.name, path: full, size: fs.statSync(full).size });
          }
        }
      } catch { /* skip */ }
    };

    scan(folderPath);
    return files;
  });

  //  Scan scripts folder 
  ipcMain.handle(
    'scan-scripts',
    async (_, folderPath: string, subDir: string | null = null) => {
      const targetDir = subDir
        ? path.join(folderPath, subDir)
        : path.join(folderPath, 'scripts');

      if (!fs.existsSync(targetDir)) return [];

      const results: unknown[] = [];
      const SCRIPT_EXTS = new Set(['.js', '.ts', '.mjs']);

      const scan = (dir: string, depth = 0) => {
        if (depth > 3) return;
        try {
          for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) { scan(full, depth + 1); continue; }
            if (SCRIPT_EXTS.has(path.extname(entry.name))) {
              const rel = path.relative(folderPath, full);
              results.push({ id: rel, name: entry.name, path: full, relativePath: rel, size: fs.statSync(full).size });
            }
          }
        } catch { /* skip */ }
      };

      scan(targetDir);
      return results;
    },
  );

  //  Scan artifacts metadata 
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
                results.push({
                  contractName: content.contractName || entry.name.replace('.json', ''),
                  path: full,
                  bytecodeSizeBytes: content.bytecode ? (content.bytecode.length - 2) / 2 : 0,
                  abiCount: content.abi.length,
                  modifiedAt: fs.statSync(full).mtimeMs,
                  abi: content.abi,
                });
              }
            } catch { /* skip */ }
          }
        }
      } catch { /* skip */ }
    };

    scan(artifactsDir);
    return results;
  });

  //  Read README 
  ipcMain.handle('read-readme', async (_, folderPath: string) => {
    const names = ['README.md', 'readme.md', 'README.MD', 'Readme.md'];
    for (const n of names) {
      const p = path.join(folderPath, n);
      if (fs.existsSync(p)) {
        try { return fs.readFileSync(p, 'utf-8'); } catch { /* skip */ }
      }
    }
    return null;
  });
}
