"use strict";
const electron = require("electron");
const api = {
  // Project
  selectFolder: () => electron.ipcRenderer.invoke("select-folder"),
  validateProject: (p) => electron.ipcRenderer.invoke("validate-project", p),
  // ABIs
  scanAbis: (p) => electron.ipcRenderer.invoke("scan-abis", p),
  watchAbis: (p) => electron.ipcRenderer.invoke("watch-abis", p),
  // Sources
  scanSources: (p) => electron.ipcRenderer.invoke("scan-sources", p),
  // Commands
  runCommand: (params) => electron.ipcRenderer.invoke("run-command", params),
  stopCommand: (id) => electron.ipcRenderer.invoke("stop-command", id),
  getProcessStatus: (id) => electron.ipcRenderer.invoke("get-process-status", id),
  // Files
  readFile: (p) => electron.ipcRenderer.invoke("read-file", p),
  writeFile: (filePath, content) => electron.ipcRenderer.invoke("write-file", { filePath, content }),
  listDir: (dirPath) => electron.ipcRenderer.invoke("list-dir", dirPath),
  openExternal: (url) => electron.ipcRenderer.invoke("open-external", url),
  openInEditor: (p) => electron.ipcRenderer.invoke("open-in-editor", p),
  // Env
  readEnv: (folderPath) => electron.ipcRenderer.invoke("read-env", folderPath),
  writeEnv: (folderPath, entries) => electron.ipcRenderer.invoke("write-env", { folderPath, entries }),
  // Git
  gitStatus: (cwd) => electron.ipcRenderer.invoke("git-status", cwd),
  gitBranches: (cwd) => electron.ipcRenderer.invoke("git-branches", cwd),
  gitLog: (cwd) => electron.ipcRenderer.invoke("git-log", cwd),
  gitDiff: (cwd, file) => electron.ipcRenderer.invoke("git-diff", { cwd, file }),
  gitCommit: (cwd, message, push) => electron.ipcRenderer.invoke("git-commit", { cwd, message, push }),
  gitCheckout: (cwd, branch, create) => electron.ipcRenderer.invoke("git-checkout", { cwd, branch, create }),
  gitPull: (cwd) => electron.ipcRenderer.invoke("git-pull", cwd),
  // Accounts
  getHardhatAccounts: (rpcUrl) => electron.ipcRenderer.invoke("get-hardhat-accounts", rpcUrl),
  // Security
  analyzeSecurity: (folderPath) => electron.ipcRenderer.invoke("analyze-security", { folderPath }),
  // Docs
  generateDocs: (abis, projectName) => electron.ipcRenderer.invoke("generate-docs", { abis, projectName }),
  // README
  readReadme: (folderPath) => electron.ipcRenderer.invoke("read-readme", folderPath),
  // Logs export
  exportLogs: (content, filename) => electron.ipcRenderer.invoke("export-logs", { content, filename }),
  // Workspace
  saveWorkspace: (workspace, savePath) => electron.ipcRenderer.invoke("save-workspace", { workspace, savePath }),
  loadWorkspace: (loadPath) => electron.ipcRenderer.invoke("load-workspace", loadPath),
  // Scripts
  scanScripts: (folderPath, parentFolder) => electron.ipcRenderer.invoke("scan-scripts", folderPath, parentFolder),
  // Chain control
  evmSnapshot: (rpcUrl) => electron.ipcRenderer.invoke("evm-snapshot", rpcUrl),
  evmRevert: (rpcUrl, snapshotId) => electron.ipcRenderer.invoke("evm-revert", { rpcUrl, snapshotId }),
  evmMine: (rpcUrl) => electron.ipcRenderer.invoke("evm-mine", rpcUrl),
  ethBlockNumber: (rpcUrl) => electron.ipcRenderer.invoke("eth-block-number", rpcUrl),
  // Artifacts
  scanArtifactsMeta: (folderPath) => electron.ipcRenderer.invoke("scan-artifacts-meta", folderPath),
  // Token balances
  getTokenBalances: (rpcUrl, address, tokenAddresses) => electron.ipcRenderer.invoke("get-token-balances", { rpcUrl, address, tokenAddresses }),
  // Proxy inspector
  inspectProxy: (rpcUrl, address) => electron.ipcRenderer.invoke("inspect-proxy", { rpcUrl, address }),
  // Opcode decoder
  decodeOpcodes: (bytecode) => electron.ipcRenderer.invoke("decode-opcodes", bytecode),
  // Storage layout
  analyzeStorageLayout: (folderPath, contractName) => electron.ipcRenderer.invoke("analyze-storage-layout", { folderPath, contractName }),
  // Audit notes
  saveAuditNotes: (folderPath, notes) => electron.ipcRenderer.invoke("save-audit-notes", { folderPath, notes }),
  loadAuditNotes: (folderPath) => electron.ipcRenderer.invoke("load-audit-notes", folderPath),
  // Events
  onProcessOutput: (cb) => {
    const fn = (_, d) => cb(d);
    electron.ipcRenderer.on("process-output", fn);
    return () => electron.ipcRenderer.removeListener("process-output", fn);
  },
  showOpenFileDialog: (opts) => electron.ipcRenderer.invoke("show-open-file-dialog", opts ?? {}),
  showSaveFileDialog: (opts) => electron.ipcRenderer.invoke("show-save-file-dialog", opts ?? {}),
  onProcessStatus: (cb) => {
    const fn = (_, d) => cb(d);
    electron.ipcRenderer.on("process-status", fn);
    return () => electron.ipcRenderer.removeListener("process-status", fn);
  },
  onAbisChanged: (cb) => {
    const fn = (_, p) => cb(p);
    electron.ipcRenderer.on("abis-changed", fn);
    return () => electron.ipcRenderer.removeListener("abis-changed", fn);
  },
  // ── Wallet Connect ────────────────────────────────────────────────────────
  connectWallet: () => electron.ipcRenderer.invoke("wallet-connect-popup"),
  // WalletConnect v2: get URI for inline QR (called from renderer)
  wcGetUri: () => electron.ipcRenderer.invoke("wc-get-uri"),
  // WalletConnect v2: notify main of approved session
  wcSessionApproved: (result) => electron.ipcRenderer.invoke("wc-session-approved", result),
  // WalletConnect v2: poll for result (fallback if push event was missed)
  wcPollResult: () => electron.ipcRenderer.invoke("wc-poll-result"),
  // WalletConnect v2: listen for session approval from main process
  onWcApproved: (cb) => {
    electron.ipcRenderer.on("wc-approved", (_event, result) => cb(result));
    return () => electron.ipcRenderer.removeAllListeners("wc-approved");
  },
  // WalletConnect v2: check if an active session exists (survives restarts)
  wcHasSession: () => electron.ipcRenderer.invoke("wc-has-session"),
  // WalletConnect v2: send transaction via active WC session (for pause/resume)
  wcSendTransaction: (params) => electron.ipcRenderer.invoke("wc-send-transaction", params),
  discordLogin: () => electron.ipcRenderer.invoke("discord-login"),
  // ── License ──────────────────────────────────────────────────────────────
  validateLicense: (key) => electron.ipcRenderer.invoke("validate-license", key),
  // ── Auto updater ─────────────────────────────────────────────────────────
  checkForUpdate: () => electron.ipcRenderer.invoke("check-for-update"),
  downloadUpdate: () => electron.ipcRenderer.invoke("download-update"),
  installUpdate: () => electron.ipcRenderer.invoke("install-update"),
  onUpdateStatus: (cb) => {
    const fn = (_, d) => cb(d);
    electron.ipcRenderer.on("update-status", fn);
    return () => electron.ipcRenderer.removeListener("update-status", fn);
  }
};
if (process.contextIsolated) {
  try {
    electron.contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error(error);
  }
}
