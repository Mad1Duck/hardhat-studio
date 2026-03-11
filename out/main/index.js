"use strict";
const electron = require("electron");
const path = require("path");
const dotenv = require("dotenv");
const axios = require("axios");
const http = require("http");
const keytar = require("keytar");
const child_process = require("child_process");
const fs = require("fs");
let autoUpdater = null;
function initAutoUpdater(isDev2) {
  if (isDev2) return;
  const { autoUpdater: au } = require("electron-updater");
  const log = require("electron-log");
  au.logger = log;
  au.logger.transports.file.level = "info";
  au.autoDownload = false;
  au.autoInstallOnAppQuit = true;
  au.allowPrerelease = false;
  au.allowDowngrade = false;
  autoUpdater = au;
}
function setupAutoUpdaterWindow(win) {
  if (!autoUpdater) return;
  const send = (payload) => win.webContents.send("update-status", payload);
  autoUpdater.on("checking-for-update", () => send({ type: "checking" }));
  autoUpdater.on("update-not-available", () => send({ type: "not-available" }));
  autoUpdater.on("update-available", (info) => {
    send({ type: "available", version: info.version, releaseNotes: info.releaseNotes });
    if (process.env.AUTO_UPDATE === "true") autoUpdater.downloadUpdate();
  });
  autoUpdater.on("download-progress", (p) => send({ type: "download-progress", percent: p.percent }));
  autoUpdater.on("update-downloaded", (info) => send({ type: "downloaded", version: info.version }));
  autoUpdater.on("error", (e) => send({ type: "error", message: e.message }));
  setTimeout(() => autoUpdater.checkForUpdates(), 5e3);
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {
  }), 60 * 60 * 1e3);
}
function registerUpdaterHandlers() {
  electron.ipcMain.handle("force-update", async () => {
    if (!autoUpdater) return false;
    const result = await autoUpdater.checkForUpdatesAndNotify();
    return !!result;
  });
  electron.ipcMain.handle("open-download-page", async () => {
    electron.shell.openExternal("https://github.com/RaihanArdianata/hardhat-studio/releases");
  });
  electron.ipcMain.handle("check-for-update", async () => {
    if (!autoUpdater) return false;
    try {
      await autoUpdater.checkForUpdates();
      return true;
    } catch {
      return false;
    }
  });
  electron.ipcMain.handle("download-update", async () => {
    if (!autoUpdater) return false;
    try {
      await autoUpdater.downloadUpdate();
      return true;
    } catch {
      return false;
    }
  });
  electron.ipcMain.handle("install-update", async () => {
    if (!autoUpdater) return false;
    autoUpdater.quitAndInstall();
    return true;
  });
}
let _wcClient = null;
let _wcLastResult = null;
function sendWcApproved(win, result) {
  if (result) _wcLastResult = result;
  if (win && !win.isDestroyed()) win.webContents.send("wc-approved", result);
}
async function getOrInitWcClient() {
  if (_wcClient) return _wcClient;
  const projectId = process.env.VITE_WC_PROJECT_ID || process.env.WC_PROJECT_ID || "3721e5967517bd23fc60c504c8ded53c";
  if (!globalThis.crypto || !globalThis.crypto.getRandomValues) {
    const nodeCrypto = require("node:crypto");
    globalThis.crypto = nodeCrypto.webcrypto;
  }
  const { SignClient } = require("@walletconnect/sign-client");
  _wcClient = await SignClient.init({
    projectId,
    metadata: {
      name: "Hardhat Studio",
      description: "Professional Hardhat Development Environment",
      url: "https://hardhatstudio.dev",
      icons: ["https://hardhatstudio.dev/icon.png"]
    }
  });
  console.log(
    "[WC] Client initialised, existing sessions:",
    _wcClient.session?.getAll?.()?.length ?? 0
  );
  return _wcClient;
}
function registerWalletConnectHandlers(getWin2) {
  electron.ipcMain.handle("wc-session-approved", async (_, result) => {
    sendWcApproved(getWin2(), result);
  });
  electron.ipcMain.handle("wc-poll-result", async () => {
    const r = _wcLastResult;
    _wcLastResult = null;
    return r;
  });
  electron.ipcMain.handle("wc-has-session", async () => {
    try {
      const client = await getOrInitWcClient();
      return (client.session?.getAll?.() ?? []).length > 0;
    } catch {
      return false;
    }
  });
  electron.ipcMain.handle("wc-get-uri", async () => {
    process.env.VITE_WC_PROJECT_ID || process.env.WC_PROJECT_ID || "3721e5967517bd23fc60c504c8ded53c";
    try {
      const client = await getOrInitWcClient();
      const { uri, approval } = await client.connect({
        requiredNamespaces: {
          eip155: {
            methods: [
              "eth_sendTransaction",
              "personal_sign",
              "eth_sign",
              "eth_accounts",
              "eth_chainId"
            ],
            chains: [
              "eip155:1",
              "eip155:137",
              "eip155:42161",
              "eip155:56",
              "eip155:10",
              "eip155:8453",
              "eip155:11155111"
            ],
            events: ["chainChanged", "accountsChanged"]
          }
        }
      });
      if (!uri) return { error: "NO_URI" };
      approval().then((session) => {
        try {
          const ns = session.namespaces?.eip155 || Object.values(session.namespaces || {})[0];
          const accounts = ns?.accounts ?? [];
          if (!accounts.length) {
            sendWcApproved(getWin2(), null);
            return;
          }
          let addr, chainId;
          if (accounts[0].includes(":")) {
            const [, chain, address] = accounts[0].split(":");
            addr = address;
            chainId = parseInt(chain || "1");
          } else {
            addr = accounts[0];
            chainId = 1;
          }
          sendWcApproved(getWin2(), { address: addr, chainId });
        } catch {
          sendWcApproved(getWin2(), null);
        }
      }).catch((e) => console.error("[WC] approval rejected:", e?.message));
      return { uri };
    } catch (err) {
      return { error: err?.message ?? "INIT_FAILED" };
    }
  });
  electron.ipcMain.handle(
    "wc-send-transaction",
    async (_, { from, to, data, chainId }) => {
      try {
        const client = await getOrInitWcClient();
        const sessions = client.session?.getAll?.() ?? [];
        if (!sessions.length) {
          return {
            error: "NO_WC_SESSION: No active WalletConnect session. Please reconnect your wallet via QR."
          };
        }
        const session = sessions[sessions.length - 1];
        console.log(`[WC] Sending tx via session ${session.topic.slice(0, 8)}… chainId=eip155:${chainId}`);
        const txHash = await client.request({
          topic: session.topic,
          chainId: `eip155:${chainId}`,
          request: {
            method: "eth_sendTransaction",
            params: [{ from, to, data }]
          }
        });
        return { txHash };
      } catch (err) {
        return { error: err?.message ?? String(err) };
      }
    }
  );
}
const SERVICE = "hardhat-studio";
async function setStorage(key, value) {
  await keytar.setPassword(SERVICE, key, JSON.stringify(value));
}
async function getStorage(key) {
  const value = await keytar.getPassword(SERVICE, key);
  if (!value) return null;
  return JSON.parse(value);
}
async function deleteStorage(key) {
  await keytar.deletePassword(SERVICE, key);
}
async function checkUserRoles({
  botToken,
  guildId,
  userId,
  roleIds
}) {
  try {
    const res = await axios.get(
      `https://discord.com/api/v10/guilds/${guildId}/members/${userId}`,
      { headers: { Authorization: `Bot ${botToken}` } }
    );
    const userRoles = res.data.roles;
    console.log("[Discord] User roles:", userRoles);
    return roleIds.some((id) => userRoles.includes(id));
  } catch (error) {
    if (error.response?.status === 404) {
      console.log("[Discord] User tidak ada di server:", guildId);
      return false;
    }
    console.error("[Discord] API error:", error.response?.data ?? error);
    throw error;
  }
}
function registerDiscordHandlers() {
  electron.ipcMain.handle("get-user", async () => {
    return getStorage("discord_user");
  });
  electron.ipcMain.handle("logout", async () => {
    await deleteStorage("discord_user");
  });
  electron.ipcMain.handle(
    "discord-check-role",
    async (_, { guildId, userId, roleIds }) => {
      const botToken = process.env.DISCORD_BOT_TOKEN ?? "";
      if (!botToken) {
        console.warn("[Discord] DISCORD_BOT_TOKEN not set in env");
        return false;
      }
      return checkUserRoles({ botToken, guildId, userId, roleIds });
    }
  );
  electron.ipcMain.handle("discord-login", async () => {
    return new Promise(async (resolve, reject) => {
      const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
      const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
      const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;
      await deleteStorage("discord_access_token");
      await deleteStorage("discord_user");
      const authUrl = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=identify`;
      const server = http.createServer(async (req, res) => {
        try {
          const url = new URL(req.url, REDIRECT_URI);
          const code = url.searchParams.get("code");
          if (!code) return;
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end("<h2>Login berhasil. Silakan kembali ke aplikasi.</h2>");
          server.close();
          const params = new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            grant_type: "authorization_code",
            code,
            redirect_uri: REDIRECT_URI
          });
          const tokenRes = await axios.post(
            "https://discord.com/api/oauth2/token",
            params.toString(),
            { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
          );
          const accessToken = tokenRes.data.access_token;
          const userRes = await axios.get("https://discord.com/api/users/@me", {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
          const user = userRes.data;
          await setStorage("discord_access_token", accessToken);
          await setStorage("discord_user", user);
          resolve(user);
        } catch (err) {
          server.close();
          reject(err);
        }
      });
      server.listen(4399);
      await electron.shell.openExternal(authUrl);
    });
  });
}
const LEMON_VALIDATE_URL = "https://api.lemonsqueezy.com/v1/licenses/validate";
function registerLicenseHandlers() {
  electron.ipcMain.handle("validate-license", async (_, key) => {
    try {
      const res = await fetch(LEMON_VALIDATE_URL, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ license_key: key })
      });
      const data = await res.json();
      if (data.valid) {
        return {
          valid: true,
          email: data.license_key?.user_email ?? null,
          expiresAt: data.license_key?.expires_at ?? null
        };
      }
      return { valid: false, error: data.error ?? "Invalid license key" };
    } catch (e) {
      return { valid: false, error: String(e) };
    }
  });
}
function detectPackageManager(folderPath) {
  if (fs.existsSync(path.join(folderPath, "bun.lockb"))) return "bun";
  if (fs.existsSync(path.join(folderPath, "pnpm-lock.yaml"))) return "pnpm";
  if (fs.existsSync(path.join(folderPath, "yarn.lock"))) return "yarn";
  return "npm";
}
function isBunInstalled() {
  try {
    child_process.execSync("bun --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
function readPkg(folderPath) {
  try {
    return JSON.parse(fs.readFileSync(path.join(folderPath, "package.json"), "utf-8"));
  } catch {
    return {};
  }
}
function detectHardhatVersion(folderPath) {
  try {
    const p = path.join(folderPath, "node_modules", "hardhat", "package.json");
    return JSON.parse(fs.readFileSync(p, "utf-8")).version;
  } catch {
    return null;
  }
}
function detectFramework(deps) {
  const hasEthers = "ethers" in deps || "@nomicfoundation/hardhat-ethers" in deps;
  const hasViem = "viem" in deps || "@nomicfoundation/hardhat-viem" in deps;
  if (hasEthers && hasViem) return "both";
  if (hasEthers) return "ethers";
  if (hasViem) return "viem";
  return null;
}
function detectPlugins(deps) {
  const map = {
    "@openzeppelin/contracts": "openzeppelin",
    "@nomicfoundation/hardhat-toolbox": "toolbox",
    "hardhat-gas-reporter": "gas-reporter",
    "solidity-coverage": "coverage",
    "@typechain/hardhat": "typechain",
    "hardhat-deploy": "hardhat-deploy",
    "@openzeppelin/hardhat-upgrades": "upgrades"
  };
  return Object.entries(map).filter(([pkg]) => pkg in deps).map(([, label]) => label);
}
function parseNetworkNames(folderPath, configFile) {
  const SKIP = /* @__PURE__ */ new Set(["accounts", "url", "chainId", "gas", "gasPrice", "timeout"]);
  try {
    const cfgContent = fs.readFileSync(path.join(folderPath, configFile), "utf-8");
    const netMatch = cfgContent.match(/networks\s*:\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/s);
    if (!netMatch) return {};
    const names = [...netMatch[1].matchAll(/(\w+)\s*:/g)].map((m) => m[1]).filter((n) => !SKIP.has(n));
    return Object.fromEntries(names.map((n) => [n, {}]));
  } catch {
    return {};
  }
}
function scanAbisInDir(dir, results) {
  if (!fs.existsSync(dir)) return;
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "build-info") {
        scanAbisInDir(full, results);
      } else if (entry.isFile() && entry.name.endsWith(".json") && !entry.name.endsWith(".dbg.json")) {
        try {
          const content = JSON.parse(fs.readFileSync(full, "utf-8"));
          if (Array.isArray(content.abi) && content.abi.length > 0) {
            results.push({
              name: entry.name.replace(".json", ""),
              contractName: content.contractName || entry.name.replace(".json", ""),
              path: full,
              abi: content.abi,
              bytecode: content.bytecode || null,
              sourceName: content.sourceName || null
            });
          }
        } catch {
        }
      }
    }
  } catch {
  }
}
function registerProjectHandlers(getWin2) {
  electron.ipcMain.handle("validate-project", async (_, folderPath) => {
    try {
      const CONFIGS = ["hardhat.config.js", "hardhat.config.ts", "hardhat.config.cjs", "hardhat.config.mjs"];
      const configFile = CONFIGS.find((f) => fs.existsSync(path.join(folderPath, f))) ?? null;
      const pkg = readPkg(folderPath);
      const deps = { ...pkg.dependencies || {}, ...pkg.devDependencies || {} };
      const hardhatVersion = detectHardhatVersion(folderPath);
      const pm = detectPackageManager(folderPath);
      const isBun = pm === "bun";
      return {
        valid: !!configFile || "hardhat" in deps || !!hardhatVersion,
        configFile,
        packageManager: pm,
        name: pkg.name || path.basename(folderPath),
        hardhatVersion,
        nodeModulesExist: fs.existsSync(path.join(folderPath, "node_modules")),
        framework: detectFramework(deps),
        plugins: detectPlugins(deps),
        networks: configFile ? parseNetworkNames(folderPath, configFile) : {},
        envFile: fs.existsSync(path.join(folderPath, ".env")),
        bunInstalled: isBunInstalled(),
        isBun
      };
    } catch (e) {
      return { valid: false, error: String(e) };
    }
  });
  electron.ipcMain.handle("scan-abis", async (_, folderPath) => {
    const results = [];
    const ABI_DIRS = ["artifacts", "artifacts/contracts", "out", "build/contracts", "deployments"];
    ABI_DIRS.forEach((d) => scanAbisInDir(path.join(folderPath, d), results));
    return results;
  });
  const watchers = /* @__PURE__ */ new Map();
  electron.ipcMain.handle("watch-abis", async (_, folderPath) => {
    const existing = watchers.get(folderPath);
    if (existing) {
      try {
        existing.close();
      } catch {
      }
    }
    const artifactsPath = path.join(folderPath, "artifacts");
    if (!fs.existsSync(artifactsPath)) return false;
    try {
      const w = fs.watch(
        artifactsPath,
        { recursive: true },
        (_event, filename) => {
          if (filename && filename.endsWith(".json") && !filename.includes("dbg")) {
            getWin2()?.webContents.send("abis-changed", folderPath);
          }
        }
      );
      watchers.set(folderPath, w);
      return true;
    } catch {
      return false;
    }
  });
  electron.ipcMain.handle("scan-sources", async (_, folderPath) => {
    const files = [];
    const EXTS = /* @__PURE__ */ new Set([".sol", ".js", ".ts"]);
    const scan = (dir, depth = 0) => {
      if (depth > 4 || !fs.existsSync(dir)) return;
      try {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
          const full = path.join(dir, entry.name);
          if (entry.isDirectory() && depth < 3) {
            scan(full, depth + 1);
            continue;
          }
          if (entry.isFile() && EXTS.has(path.extname(entry.name))) {
            files.push({ name: entry.name, path: full, size: fs.statSync(full).size });
          }
        }
      } catch {
      }
    };
    scan(folderPath);
    return files;
  });
  electron.ipcMain.handle(
    "scan-scripts",
    async (_, folderPath, subDir = null) => {
      const targetDir = subDir ? path.join(folderPath, subDir) : path.join(folderPath, "scripts");
      if (!fs.existsSync(targetDir)) return [];
      const results = [];
      const SCRIPT_EXTS = /* @__PURE__ */ new Set([".js", ".ts", ".mjs"]);
      const scan = (dir, depth = 0) => {
        if (depth > 3) return;
        try {
          for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              scan(full, depth + 1);
              continue;
            }
            if (SCRIPT_EXTS.has(path.extname(entry.name))) {
              const rel = path.relative(folderPath, full);
              results.push({ id: rel, name: entry.name, path: full, relativePath: rel, size: fs.statSync(full).size });
            }
          }
        } catch {
        }
      };
      scan(targetDir);
      return results;
    }
  );
  electron.ipcMain.handle("scan-artifacts-meta", async (_, folderPath) => {
    const results = [];
    const artifactsDir = path.join(folderPath, "artifacts");
    if (!fs.existsSync(artifactsDir)) return results;
    const scan = (dir) => {
      try {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory() && entry.name !== "build-info") {
            scan(full);
            continue;
          }
          if (entry.isFile() && entry.name.endsWith(".json") && !entry.name.endsWith(".dbg.json")) {
            try {
              const content = JSON.parse(fs.readFileSync(full, "utf-8"));
              if (Array.isArray(content.abi)) {
                results.push({
                  contractName: content.contractName || entry.name.replace(".json", ""),
                  path: full,
                  bytecodeSizeBytes: content.bytecode ? (content.bytecode.length - 2) / 2 : 0,
                  abiCount: content.abi.length,
                  modifiedAt: fs.statSync(full).mtimeMs,
                  abi: content.abi
                });
              }
            } catch {
            }
          }
        }
      } catch {
      }
    };
    scan(artifactsDir);
    return results;
  });
  electron.ipcMain.handle("read-readme", async (_, folderPath) => {
    const names = ["README.md", "readme.md", "README.MD", "Readme.md"];
    for (const n of names) {
      const p = path.join(folderPath, n);
      if (fs.existsSync(p)) {
        try {
          return fs.readFileSync(p, "utf-8");
        } catch {
        }
      }
    }
    return null;
  });
}
const processes = /* @__PURE__ */ new Map();
function getProcesses() {
  return processes;
}
function registerProcessHandlers(getWin2) {
  electron.ipcMain.handle("run-command", async (_, { id, command, cwd }) => {
    const existing = processes.get(id);
    if (existing) {
      try {
        existing.kill("SIGTERM");
      } catch {
      }
      processes.delete(id);
    }
    return new Promise((resolve) => {
      try {
        const isWin = process.platform === "win32";
        const shell = isWin ? "cmd" : "/bin/sh";
        const flag = isWin ? "/c" : "-c";
        const child = child_process.spawn(shell, [flag, command], {
          cwd,
          env: { ...process.env },
          stdio: ["pipe", "pipe", "pipe"]
        });
        processes.set(id, child);
        const send = (payload) => getWin2()?.webContents.send("process-output", payload);
        child.stdout?.on("data", (data) => send({ id, type: "stdout", data: data.toString() }));
        child.stderr?.on("data", (data) => send({ id, type: "stderr", data: data.toString() }));
        child.on("spawn", () => {
          getWin2()?.webContents.send("process-status", { id, status: "running" });
          resolve({ success: true });
        });
        child.on("close", (code) => {
          processes.delete(id);
          getWin2()?.webContents.send("process-status", { id, status: "stopped", code });
        });
        child.on("error", (err) => {
          processes.delete(id);
          getWin2()?.webContents.send("process-status", { id, status: "error", error: err.message });
          resolve({ success: false, error: err.message });
        });
      } catch (e) {
        resolve({ success: false, error: String(e) });
      }
    });
  });
  electron.ipcMain.handle("stop-command", async (_, id) => {
    const proc = processes.get(id);
    if (!proc) return false;
    try {
      if (process.platform === "win32") {
        child_process.spawn("taskkill", ["/pid", String(proc.pid), "/f", "/t"]);
      } else {
        proc.kill("SIGTERM");
        setTimeout(() => {
          try {
            proc.kill("SIGKILL");
          } catch {
          }
        }, 2e3);
      }
      processes.delete(id);
      return true;
    } catch {
      return false;
    }
  });
  electron.ipcMain.handle("get-process-status", async (_, id) => processes.has(id) ? "running" : "stopped");
}
function registerFilesystemHandlers(getWin2) {
  electron.ipcMain.handle("select-folder", async () => {
    const result = await electron.dialog.showOpenDialog(getWin2(), {
      properties: ["openDirectory"],
      title: "Select Hardhat Project Folder"
    });
    return result.canceled ? null : result.filePaths[0];
  });
  electron.ipcMain.handle("read-file", async (_, filePath) => {
    try {
      return fs.readFileSync(filePath, "utf-8");
    } catch {
      return null;
    }
  });
  electron.ipcMain.handle("write-file", async (_, { filePath, content }) => {
    try {
      fs.writeFileSync(filePath, content, "utf-8");
      return true;
    } catch {
      return false;
    }
  });
  electron.ipcMain.handle("list-dir", async (_, dirPath) => {
    try {
      if (!fs.existsSync(dirPath)) return [];
      return fs.readdirSync(dirPath, { withFileTypes: true }).map((e) => ({
        name: e.name,
        isDir: e.isDirectory(),
        path: path.join(dirPath, e.name)
      }));
    } catch {
      return [];
    }
  });
  electron.ipcMain.handle("open-external", async (_, url) => electron.shell.openExternal(url));
  electron.ipcMain.handle("open-in-editor", async (_, filePath) => {
    const editors = ["code", "cursor", "subl", "vim", "nano"];
    for (const editor of editors) {
      try {
        child_process.spawn(editor, [filePath], { detached: true, stdio: "ignore" });
        return true;
      } catch {
      }
    }
    try {
      await electron.shell.openPath(filePath);
      return true;
    } catch {
      return false;
    }
  });
  electron.ipcMain.handle("read-env", async (_, folderPath) => {
    const envPath = path.join(folderPath, ".env");
    if (!fs.existsSync(envPath)) return [];
    try {
      return fs.readFileSync(envPath, "utf-8").split("\n").filter((l) => l.trim() && !l.startsWith("#")).map((l) => {
        const idx = l.indexOf("=");
        if (idx === -1) return null;
        return { key: l.slice(0, idx).trim(), value: l.slice(idx + 1).trim() };
      }).filter(Boolean);
    } catch {
      return [];
    }
  });
  electron.ipcMain.handle("write-env", async (_, { folderPath, entries }) => {
    try {
      fs.writeFileSync(
        path.join(folderPath, ".env"),
        entries.map((e) => `${e.key}=${e.value}`).join("\n"),
        "utf-8"
      );
      return true;
    } catch {
      return false;
    }
  });
  electron.ipcMain.handle("export-logs", async (_, { content, filename }) => {
    const result = await electron.dialog.showSaveDialog(getWin2(), {
      defaultPath: filename,
      filters: [{ name: "Log Files", extensions: ["log", "txt", "json"] }]
    });
    if (result.canceled || !result.filePath) return false;
    try {
      fs.writeFileSync(result.filePath, content, "utf-8");
      return true;
    } catch {
      return false;
    }
  });
  electron.ipcMain.handle("save-workspace", async (_, { workspace, savePath }) => {
    const filePath = savePath ?? (await electron.dialog.showSaveDialog(getWin2(), {
      defaultPath: "workspace.hhws",
      filters: [{ name: "Hardhat Studio Workspace", extensions: ["hhws", "json"] }]
    })).filePath;
    if (!filePath) return null;
    try {
      fs.writeFileSync(filePath, JSON.stringify(workspace, null, 2), "utf-8");
      return filePath;
    } catch {
      return null;
    }
  });
  electron.ipcMain.handle("load-workspace", async (_, loadPath) => {
    const filePath = loadPath ?? (await electron.dialog.showOpenDialog(getWin2(), {
      filters: [{ name: "Hardhat Studio Workspace", extensions: ["hhws", "json"] }],
      properties: ["openFile"]
    })).filePaths?.[0];
    if (!filePath || !fs.existsSync(filePath)) return null;
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch {
      return null;
    }
  });
  electron.ipcMain.handle("show-open-file-dialog", async (_, opts = {}) => {
    const result = await electron.dialog.showOpenDialog(getWin2(), {
      properties: ["openFile"],
      title: opts.title ?? "Open File",
      filters: opts.filters ?? [{ name: "All Files", extensions: ["*"] }]
    });
    return result.canceled || !result.filePaths[0] ? null : result.filePaths[0];
  });
  electron.ipcMain.handle("show-save-file-dialog", async (_, opts = {}) => {
    const result = await electron.dialog.showSaveDialog(getWin2(), {
      defaultPath: opts.defaultPath ?? "untitled.txt",
      title: opts.title ?? "Save File",
      filters: opts.filters ?? [{ name: "All Files", extensions: ["*"] }]
    });
    return result.canceled ? null : result.filePath ?? null;
  });
  electron.ipcMain.handle("save-audit-notes", async (_, { folderPath, notes }) => {
    try {
      const p = path.join(folderPath, ".hardhat-studio", "audit-notes.json");
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, JSON.stringify(notes, null, 2), "utf-8");
      return true;
    } catch {
      return false;
    }
  });
  electron.ipcMain.handle("load-audit-notes", async (_, folderPath) => {
    try {
      const p = path.join(folderPath, ".hardhat-studio", "audit-notes.json");
      if (!fs.existsSync(p)) return [];
      return JSON.parse(fs.readFileSync(p, "utf-8"));
    } catch {
      return [];
    }
  });
}
function git(cmd, cwd) {
  try {
    return child_process.execSync(`git ${cmd}`, {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"]
    }).trim();
  } catch {
    return "";
  }
}
function registerGitHandlers() {
  electron.ipcMain.handle("git-status", async (_, cwd) => {
    try {
      const branch = git("rev-parse --abbrev-ref HEAD", cwd);
      if (!branch) return null;
      const remoteUrl = git("remote get-url origin", cwd);
      const ahead = parseInt(git("rev-list --count @{u}..HEAD", cwd) || "0");
      const behind = parseInt(git("rev-list --count HEAD..@{u}", cwd) || "0");
      const raw = git("status --porcelain", cwd);
      const staged = [];
      const unstaged = [];
      const untracked = [];
      raw.split("\n").filter(Boolean).forEach((l) => {
        const [x, y] = [l[0], l[1]];
        const file = l.slice(3);
        if (x !== " " && x !== "?") staged.push(file);
        if (y === "M" || y === "D") unstaged.push(file);
        if (l.startsWith("??")) untracked.push(file);
      });
      return {
        branch,
        ahead: isNaN(ahead) ? 0 : ahead,
        behind: isNaN(behind) ? 0 : behind,
        staged,
        unstaged,
        untracked,
        remoteUrl
      };
    } catch {
      return null;
    }
  });
  electron.ipcMain.handle("git-branches", async (_, cwd) => {
    try {
      return git("branch -a", cwd).split("\n").filter(Boolean).map((b) => ({
        name: b.replace(/^\*?\s+/, "").trim(),
        current: b.startsWith("*"),
        remote: b.trim().startsWith("remotes/")
      }));
    } catch {
      return [];
    }
  });
  electron.ipcMain.handle("git-log", async (_, cwd) => {
    try {
      return git('log --oneline --format="%H|%h|%s|%an|%ar" -20', cwd).split("\n").filter(Boolean).map((l) => {
        const [hash, shortHash, message, author, date] = l.split("|");
        return { hash, shortHash, message, author, date };
      });
    } catch {
      return [];
    }
  });
  electron.ipcMain.handle("git-diff", async (_, { cwd, file }) => {
    try {
      return git(file ? `diff HEAD -- "${file}"` : "diff HEAD", cwd);
    } catch {
      return "";
    }
  });
  electron.ipcMain.handle("git-commit", async (_, { cwd, message, push }) => {
    try {
      git("add -A", cwd);
      git(`commit -m "${message.replace(/"/g, '\\"')}"`, cwd);
      if (push) git("push", cwd);
      return { success: true };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  });
  electron.ipcMain.handle("git-checkout", async (_, { cwd, branch, create }) => {
    try {
      git(create ? `checkout -b ${branch}` : `checkout ${branch}`, cwd);
      return { success: true };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  });
  electron.ipcMain.handle("git-pull", async (_, cwd) => {
    try {
      git("pull", cwd);
      return { success: true };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  });
}
async function rpc(url, method, params = [], id = 1) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params })
  });
  return res.json();
}
const DEFAULT_ACCOUNTS = [
  { address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" },
  { address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", privateKey: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" },
  { address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", privateKey: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" },
  { address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906", privateKey: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6" },
  { address: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65", privateKey: "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926b" },
  { address: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc", privateKey: "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba" },
  { address: "0x976EA74026E726554dB657fA54763abd0C3a0aa9", privateKey: "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564" },
  { address: "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955", privateKey: "0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356" },
  { address: "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f", privateKey: "0xdbda1821b80551c9d65939329250132c444b4a15823c01d4b8a5e64d03c5a8a5" },
  { address: "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720", privateKey: "0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6" },
  { address: "0xBcd4042DE499D14e55001CcbB24a551F3b954096", privateKey: "0xf214f2b2cd398c806f84e317254e0f0b801d0643303237d97a22a48e01628897" },
  { address: "0x71bE63f3384f5fb98995898A86B02Fb2426c5788", privateKey: "0x701b615bbdfb9de65240bc28bd21bbc0d996645a3dd57e7b12bc2bdf6f192c82" },
  { address: "0xFABB0ac9d68B0B445fB7357272Ff202C5651694a", privateKey: "0xa267530f49f8280200edf313ee7af6b827f2a8bce2897751d06a843f644967b1" },
  { address: "0x1CBd3b2770909D4e10f157cABC84C7264073C9Ec", privateKey: "0x47c99abed3324a2707c28affff1267e45918ec8c3f20b8aa892e8b065d2942dd" },
  { address: "0xdF3e18d64BC6A983f673Ab319CCaE4f1a57C7097", privateKey: "0xc526ee95bf44d8fc405a158bb884d9d1238d99f0612e9f33d006bb0789009aaa" },
  { address: "0xcd3B766CCDd6AE721141F452C550Ca635964ce71", privateKey: "0x8166f546bab6da521a8369cab06c5d2b9e46670292d85ca9517fb0706b19e7b" },
  { address: "0x2546BcD3c84621e976D8185a91A922aE77ECEc30", privateKey: "0xea6c44ac03bff858b476bba28179e2f12f3a5cb5e89fa64dd57ce40de0e4c8a" },
  { address: "0xbDA5747bFD65F08deb54cb465eB87D40e51B197E", privateKey: "0x689af8efa8c651a91ad287602527f3af2fe9f6501a7ac4b061667b5a93e037fd" },
  { address: "0xdD2FD4581271e230360230F9337D5c0430Bf44C0", privateKey: "0xde9be857da6a0e9c9f7a5c2f8c22a0d5f8a2bbb60b87f6bebc02fb17f9ca0d2" },
  { address: "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199", privateKey: "0xdf57089febbacf7ba0bc227dafbffa9fc08a93fdc68e1e42411a14efcf23656e" }
];
const ERC20 = {
  balanceOf: "0x70a08231",
  symbol: "0x95d89b41",
  decimals: "0x313ce567",
  name: "0x06fdde03"
};
function decodeAbiString(hex) {
  if (!hex || hex === "0x") return "";
  try {
    const clean = hex.slice(2);
    const offset = parseInt(clean.slice(0, 64), 16) * 2;
    const len = parseInt(clean.slice(64, 128), 16) * 2;
    return Buffer.from(clean.slice(128, 128 + len), "hex").toString("utf8").replace(/\0/g, "");
  } catch {
    return "";
  }
}
const PROXY_SLOTS = {
  implementation: "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc",
  admin: "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103",
  beacon: "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50"
};
function registerEvmHandlers() {
  electron.ipcMain.handle("evm-snapshot", async (_, rpcUrl) => {
    try {
      const data = await rpc(rpcUrl, "evm_snapshot");
      if (data.error) return { success: false, error: data.error.message };
      return { success: true, snapshotId: data.result };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  });
  electron.ipcMain.handle("evm-revert", async (_, { rpcUrl, snapshotId }) => {
    try {
      const data = await rpc(rpcUrl, "evm_revert", [snapshotId]);
      if (data.error) return { success: false, error: data.error.message };
      return { success: true, result: data.result };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  });
  electron.ipcMain.handle("evm-mine", async (_, rpcUrl) => {
    try {
      const data = await rpc(rpcUrl, "evm_mine");
      return { success: !data.error };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  });
  electron.ipcMain.handle("eth-block-number", async (_, rpcUrl) => {
    try {
      const data = await rpc(rpcUrl, "eth_blockNumber");
      return data.result ? parseInt(data.result, 16) : 0;
    } catch {
      return 0;
    }
  });
  electron.ipcMain.handle("get-hardhat-accounts", async (_, rpcUrl) => {
    try {
      const data = await rpc(rpcUrl, "eth_accounts");
      if (data.result?.length) {
        const knownMap = new Map(DEFAULT_ACCOUNTS.map((a) => [a.address.toLowerCase(), a]));
        return data.result.map((addr, i) => ({
          ...knownMap.get(addr.toLowerCase()) ?? { address: addr, privateKey: "" },
          index: i,
          balance: "0"
        }));
      }
    } catch {
    }
    return DEFAULT_ACCOUNTS.map((a, i) => ({ ...a, index: i, balance: "0" }));
  });
  electron.ipcMain.handle("get-token-balances", async (_, { rpcUrl, address, tokenAddresses }) => {
    const padAddr = address.slice(2).padStart(64, "0");
    return Promise.all(tokenAddresses.map(async (tokenAddr) => {
      try {
        const call = (selector, id) => rpc(rpcUrl, "eth_call", [{ to: tokenAddr, data: selector + (selector === ERC20.balanceOf ? padAddr : "") }, "latest"], id);
        const [balData, symData, decData, nameData] = await Promise.all([
          call(ERC20.balanceOf, 1),
          call(ERC20.symbol, 2),
          call(ERC20.decimals, 3),
          call(ERC20.name, 4)
        ]);
        const balance = balData.result && balData.result !== "0x" ? BigInt(balData.result).toString() : "0";
        const decimals = decData.result && decData.result !== "0x" ? parseInt(decData.result, 16) : 18;
        return {
          address: tokenAddr,
          name: decodeAbiString(nameData.result ?? ""),
          symbol: decodeAbiString(symData.result ?? ""),
          decimals,
          balance,
          balanceFormatted: decimals > 0 ? (Number(balance) / 10 ** decimals).toFixed(4) : balance
        };
      } catch {
        return null;
      }
    })).then((r) => r.filter(Boolean));
  });
  electron.ipcMain.handle("inspect-proxy", async (_, { rpcUrl, address }) => {
    const getSlot = async (slot) => {
      try {
        const data = await rpc(rpcUrl, "eth_getStorageAt", [address, slot, "latest"]);
        return data.result ?? "0x" + "0".repeat(64);
      } catch {
        return "0x" + "0".repeat(64);
      }
    };
    const toAddr = (s) => "0x" + s.slice(-40);
    const isZero = (a) => a === "0x" + "0".repeat(40);
    const [implSlot, adminSlot, beaconSlot] = await Promise.all([
      getSlot(PROXY_SLOTS.implementation),
      getSlot(PROXY_SLOTS.admin),
      getSlot(PROXY_SLOTS.beacon)
    ]);
    const impl = toAddr(implSlot);
    const admin = toAddr(adminSlot);
    const beacon = toAddr(beaconSlot);
    let type = "unknown";
    if (!isZero(impl) && !isZero(admin)) type = "transparent";
    else if (!isZero(impl) && isZero(admin)) type = "uups";
    else if (!isZero(beacon)) type = "beacon";
    const codeData = await rpc(rpcUrl, "eth_getCode", [address, "latest"]);
    const code = codeData.result ?? "0x";
    if (code.includes("363d3d37")) type = "minimal";
    return {
      type,
      proxyAddress: address,
      implementationAddress: isZero(impl) ? null : impl,
      adminAddress: isZero(admin) ? null : admin,
      beaconAddress: isZero(beacon) ? null : beacon,
      slots: [
        { slot: PROXY_SLOTS.implementation, value: implSlot, label: "Implementation" },
        { slot: PROXY_SLOTS.admin, value: adminSlot, label: "Admin" },
        { slot: PROXY_SLOTS.beacon, value: beaconSlot, label: "Beacon" }
      ],
      bytecodeSize: (code.length - 2) / 2,
      isProxy: type !== "unknown" && code.length > 2
    };
  });
}
const LINE_RULES = [
  { test: "tx.origin", severity: "high", title: "tx.origin Usage", recommendation: "Use msg.sender instead" },
  { test: "selfdestruct", severity: "critical", title: "Selfdestruct", recommendation: "Remove selfdestruct or add strict access control" },
  { test: "suicide", severity: "critical", title: "Selfdestruct (alias)", recommendation: "Remove selfdestruct or add strict access control" },
  { test: /\.call\s*\{/, severity: "medium", title: "Low-level call", recommendation: "Check return value and add reentrancy guard" },
  { test: "block.timestamp", severity: "low", title: "Timestamp Dependency", recommendation: "Avoid relying on block.timestamp for critical logic" },
  { test: "now", severity: "low", title: "Timestamp Dependency", recommendation: "Avoid relying on block.timestamp for critical logic" },
  { test: /\.transfer\s*\(/, severity: "medium", title: "transfer/send Usage", recommendation: "Use call{value:...}() with reentrancy guard instead" },
  { test: /\.send\s*\(/, severity: "medium", title: "transfer/send Usage", recommendation: "Use call{value:...}() with reentrancy guard instead" },
  { test: "delegatecall", severity: "high", title: "Delegatecall", recommendation: "Ensure delegatecall target is trusted and not upgradeable" }
];
function matchRule(line, rule) {
  return typeof rule.test === "string" ? line.includes(rule.test) : rule.test.test(line);
}
const TYPE_SIZES = {
  bool: 1,
  address: 20,
  bytes: 32,
  string: 32,
  uint8: 1,
  int8: 1,
  uint16: 2,
  int16: 2,
  uint32: 4,
  int32: 4,
  uint64: 8,
  int64: 8,
  uint128: 16,
  int128: 16,
  uint256: 32,
  int256: 32,
  uint: 32,
  int: 32,
  bytes1: 1,
  bytes2: 2,
  bytes4: 4,
  bytes8: 8,
  bytes16: 16,
  bytes20: 20,
  bytes32: 32
};
function buildOpcodeTable() {
  const t = {
    0: { name: "STOP", gas: 0 },
    1: { name: "ADD", gas: 3 },
    2: { name: "MUL", gas: 5 },
    3: { name: "SUB", gas: 3 },
    4: { name: "DIV", gas: 5 },
    5: { name: "SDIV", gas: 5 },
    6: { name: "MOD", gas: 5 },
    7: { name: "SMOD", gas: 5 },
    8: { name: "ADDMOD", gas: 8 },
    9: { name: "MULMOD", gas: 8 },
    10: { name: "EXP", gas: 10 },
    11: { name: "SIGNEXTEND", gas: 5 },
    16: { name: "LT", gas: 3 },
    17: { name: "GT", gas: 3 },
    18: { name: "SLT", gas: 3 },
    19: { name: "SGT", gas: 3 },
    20: { name: "EQ", gas: 3 },
    21: { name: "ISZERO", gas: 3 },
    22: { name: "AND", gas: 3 },
    23: { name: "OR", gas: 3 },
    24: { name: "XOR", gas: 3 },
    25: { name: "NOT", gas: 3 },
    26: { name: "BYTE", gas: 3 },
    27: { name: "SHL", gas: 3 },
    28: { name: "SHR", gas: 3 },
    29: { name: "SAR", gas: 3 },
    32: { name: "SHA3", gas: 30 },
    48: { name: "ADDRESS", gas: 2 },
    49: { name: "BALANCE", gas: 100 },
    50: { name: "ORIGIN", gas: 2 },
    51: { name: "CALLER", gas: 2 },
    52: { name: "CALLVALUE", gas: 2 },
    53: { name: "CALLDATALOAD", gas: 3 },
    54: { name: "CALLDATASIZE", gas: 2 },
    55: { name: "CALLDATACOPY", gas: 3 },
    56: { name: "CODESIZE", gas: 2 },
    57: { name: "CODECOPY", gas: 3 },
    58: { name: "GASPRICE", gas: 2 },
    59: { name: "EXTCODESIZE", gas: 100 },
    60: { name: "EXTCODECOPY", gas: 100 },
    61: { name: "RETURNDATASIZE", gas: 2 },
    62: { name: "RETURNDATACOPY", gas: 3 },
    63: { name: "EXTCODEHASH", gas: 100 },
    64: { name: "BLOCKHASH", gas: 20 },
    65: { name: "COINBASE", gas: 2 },
    66: { name: "TIMESTAMP", gas: 2 },
    67: { name: "NUMBER", gas: 2 },
    68: { name: "DIFFICULTY", gas: 2 },
    69: { name: "GASLIMIT", gas: 2 },
    70: { name: "CHAINID", gas: 2 },
    71: { name: "SELFBALANCE", gas: 5 },
    80: { name: "POP", gas: 2 },
    81: { name: "MLOAD", gas: 3 },
    82: { name: "MSTORE", gas: 3 },
    83: { name: "MSTORE8", gas: 3 },
    84: { name: "SLOAD", gas: 100 },
    85: { name: "SSTORE", gas: 100 },
    86: { name: "JUMP", gas: 8 },
    87: { name: "JUMPI", gas: 10 },
    88: { name: "PC", gas: 2 },
    89: { name: "MSIZE", gas: 2 },
    90: { name: "GAS", gas: 2 },
    91: { name: "JUMPDEST", gas: 1 },
    240: { name: "CREATE", gas: 32e3 },
    241: { name: "CALL", gas: 100 },
    242: { name: "CALLCODE", gas: 100 },
    243: { name: "RETURN", gas: 0 },
    244: { name: "DELEGATECALL", gas: 100 },
    245: { name: "CREATE2", gas: 32e3 },
    250: { name: "STATICCALL", gas: 100 },
    253: { name: "REVERT", gas: 0 },
    254: { name: "INVALID", gas: 0 },
    255: { name: "SELFDESTRUCT", gas: 5e3 }
  };
  for (let i = 0; i < 32; i++) t[96 + i] = { name: `PUSH${i + 1}`, gas: 3, operandBytes: i + 1 };
  for (let i = 0; i < 16; i++) t[128 + i] = { name: `DUP${i + 1}`, gas: 3 };
  for (let i = 0; i < 16; i++) t[144 + i] = { name: `SWAP${i + 1}`, gas: 3 };
  for (let i = 0; i < 5; i++) t[160 + i] = { name: `LOG${i}`, gas: 375 };
  return t;
}
const OPCODES = buildOpcodeTable();
function registerAnalysisHandlers(getWin2) {
  electron.ipcMain.handle("analyze-security", async (_, { folderPath }) => {
    const findings = [];
    const scan = (dir) => {
      if (!fs.existsSync(dir)) return;
      try {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (entry.name === "node_modules") continue;
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            scan(full);
            continue;
          }
          if (!entry.name.endsWith(".sol")) continue;
          try {
            const content = fs.readFileSync(full, "utf-8");
            const lines = content.split("\n");
            lines.forEach((line, i) => {
              LINE_RULES.forEach((rule) => {
                if (matchRule(line, rule)) {
                  findings.push({
                    severity: rule.severity,
                    title: rule.title,
                    description: `${rule.title} in ${entry.name}:${i + 1}`,
                    line: i + 1,
                    recommendation: rule.recommendation
                  });
                }
              });
            });
            if (!content.includes("pragma solidity") || content.match(/pragma solidity\s+\^0\.[0-7]/)) {
              findings.push({ severity: "medium", title: "Outdated Solidity", description: `${entry.name} may use outdated compiler`, recommendation: "Use solidity 0.8.x or later" });
            }
            if (!content.includes("Ownable") && !content.includes("AccessControl") && content.includes("onlyOwner")) {
              findings.push({ severity: "low", title: "Custom Access Control", description: `Custom access control in ${entry.name}`, recommendation: "Use OpenZeppelin Ownable or AccessControl" });
            }
          } catch {
          }
        }
      } catch {
      }
    };
    const contractsDir = path.join(folderPath, "contracts");
    scan(fs.existsSync(contractsDir) ? contractsDir : folderPath);
    return findings;
  });
  electron.ipcMain.handle("analyze-storage-layout", async (_, { folderPath, contractName }) => {
    const slots = [];
    const VAR_RE = /^\s*(uint\d*|int\d*|bool|address|bytes\d*|string|bytes|mapping[^;]+|[A-Z]\w+)\s+(?:public\s+|private\s+|internal\s+|immutable\s+|constant\s+)*(\w+)\s*[;=]/gm;
    const scan = (dir) => {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules") continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scan(full);
          continue;
        }
        if (!entry.name.endsWith(".sol")) continue;
        try {
          const src = fs.readFileSync(full, "utf-8");
          const match = new RegExp(`contract\\s+${contractName}[^{]*\\{([\\s\\S]*?)^\\}`, "m").exec(src);
          if (!match) continue;
          let slotNum = 0, byteOffset = 0;
          let m;
          while ((m = VAR_RE.exec(match[1])) !== null) {
            const typeName = m[1].trim().split(/\s+/)[0];
            const varName = m[2];
            if (varName === "constant" || varName === "immutable") continue;
            const bytes = TYPE_SIZES[typeName] ?? 32;
            if (byteOffset + bytes > 32) {
              slotNum++;
              byteOffset = 0;
            }
            slots.push({ slot: slotNum, name: varName, type: typeName, bytes, offset: byteOffset });
            byteOffset += bytes;
            if (byteOffset >= 32) {
              slotNum++;
              byteOffset = 0;
            }
          }
        } catch {
        }
      }
    };
    [path.join(folderPath, "contracts"), folderPath].forEach(scan);
    return slots;
  });
  electron.ipcMain.handle("decode-opcodes", async (_, bytecode) => {
    const hex = bytecode.startsWith("0x") ? bytecode.slice(2) : bytecode;
    const bytes = Buffer.from(hex, "hex");
    const result = [];
    let i = 0;
    while (i < bytes.length && result.length < 2e3) {
      const byte = bytes[i];
      const op = OPCODES[byte] ?? { name: `0x${byte.toString(16).padStart(2, "0")}`, gas: 0 };
      const opLen = op.operandBytes ?? 0;
      const operand = opLen > 0 && i + opLen < bytes.length ? "0x" + bytes.slice(i + 1, i + 1 + opLen).toString("hex") : void 0;
      result.push({ offset: i, opcode: op.name, operand, gasCost: op.gas });
      i += 1 + opLen;
    }
    return result;
  });
  electron.ipcMain.handle("generate-docs", async (_, { abis, projectName, outputPath }) => {
    const outDir = outputPath ?? (await electron.dialog.showOpenDialog(getWin2(), {
      properties: ["openDirectory"],
      title: "Select Obsidian Vault or Output Folder"
    })).filePaths?.[0];
    if (!outDir) return false;
    try {
      const docsDir = path.join(outDir, projectName);
      fs.mkdirSync(docsDir, { recursive: true });
      for (const contract of abis) {
        const fns = contract.abi.filter((i) => i.type === "function");
        const events = contract.abi.filter((i) => i.type === "event");
        const sig = (item) => `${item.name}(${(item.inputs ?? []).map((i) => `${i.type} ${i.name}`).join(", ")})`;
        let doc = `# ${contract.contractName}

`;
        doc += `> Source: \`${contract.sourceName ?? "unknown"}\`

`;
        doc += `## Functions

`;
        for (const fn of fns) {
          doc += `### \`${sig(fn)}\`
`;
          doc += `- **Mutability**: \`${fn.stateMutability}\`
`;
          if (fn.outputs?.length) doc += `- **Returns**: \`${fn.outputs.map((o) => o.type).join(", ")}\`
`;
          doc += "\n";
        }
        if (events.length) {
          doc += `## Events

`;
          events.forEach((ev) => {
            doc += `### \`${sig(ev)}\`

`;
          });
        }
        fs.writeFileSync(path.join(docsDir, `${contract.contractName}.md`), doc, "utf-8");
      }
      const index = `# ${projectName} - Contract Index

` + abis.map((a) => `- [[${a.contractName}]]`).join("\n");
      fs.writeFileSync(path.join(docsDir, "INDEX.md"), index, "utf-8");
      return true;
    } catch {
      return false;
    }
  });
}
dotenv.config();
const isDev = process.env.NODE_ENV === "development" || !!process.env["ELECTRON_RENDERER_URL"];
const iconPath = electron.app.isPackaged ? path.join(process.resourcesPath, "build/icon.png") : path.join(__dirname, "../../build/icon.png");
let mainWindow = null;
const getWin = () => mainWindow;
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1600,
    height: 960,
    minWidth: 1200,
    minHeight: 720,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#090c12",
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true
    }
  });
  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
    setupAutoUpdaterWindow(mainWindow);
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    electron.shell.openExternal(url);
    return { action: "deny" };
  });
  const rendererUrl = process.env["ELECTRON_RENDERER_URL"];
  if (isDev && rendererUrl) {
    mainWindow.loadURL(rendererUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
function registerAllHandlers() {
  registerUpdaterHandlers();
  registerWalletConnectHandlers(getWin);
  registerDiscordHandlers();
  registerLicenseHandlers();
  registerProjectHandlers(getWin);
  registerProcessHandlers(getWin);
  registerFilesystemHandlers(getWin);
  registerGitHandlers();
  registerEvmHandlers();
  registerAnalysisHandlers(getWin);
}
initAutoUpdater(isDev);
registerAllHandlers();
electron.app.whenReady().then(() => {
  electron.app.setAppUserModelId("com.hardhatstudio");
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  getProcesses().forEach((p) => {
    try {
      p.kill();
    } catch {
    }
  });
  if (process.platform !== "darwin") electron.app.quit();
});
