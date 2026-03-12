import { contextBridge, ipcRenderer } from 'electron';

const api = {
  // Project
  selectFolder: (): Promise<string | null> => ipcRenderer.invoke('select-folder'),
  validateProject: (p: string) => ipcRenderer.invoke('validate-project', p),
  // ABIs
  scanAbis: (p: string) => ipcRenderer.invoke('scan-abis', p),
  watchAbis: (p: string) => ipcRenderer.invoke('watch-abis', p),
  // Sources
  scanSources: (p: string) => ipcRenderer.invoke('scan-sources', p),
  // Commands
  runCommand: (params: { id: string; command: string; cwd: string; }) =>
    ipcRenderer.invoke('run-command', params),
  stopCommand: (id: string) => ipcRenderer.invoke('stop-command', id),
  getProcessStatus: (id: string) => ipcRenderer.invoke('get-process-status', id),
  // Files
  readFile: (p: string): Promise<string | null> => ipcRenderer.invoke('read-file', p),
  writeFile: (filePath: string, content: string): Promise<boolean> => ipcRenderer.invoke('write-file', { filePath, content }),
  listDir: (dirPath: string): Promise<Array<{ name: string; isDir: boolean; path: string; }>> => ipcRenderer.invoke('list-dir', dirPath),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  openInEditor: (p: string): Promise<boolean> => ipcRenderer.invoke('open-in-editor', p),
  // Env
  readEnv: (folderPath: string) => ipcRenderer.invoke('read-env', folderPath),
  writeEnv: (folderPath: string, entries: Array<{ key: string; value: string; }>) => ipcRenderer.invoke('write-env', { folderPath, entries }),
  // Git
  gitStatus: (cwd: string) => ipcRenderer.invoke('git-status', cwd),
  gitBranches: (cwd: string) => ipcRenderer.invoke('git-branches', cwd),
  gitLog: (cwd: string) => ipcRenderer.invoke('git-log', cwd),
  gitDiff: (cwd: string, file?: string) => ipcRenderer.invoke('git-diff', { cwd, file }),
  gitCommit: (cwd: string, message: string, push: boolean) => ipcRenderer.invoke('git-commit', { cwd, message, push }),
  gitCheckout: (cwd: string, branch: string, create: boolean) => ipcRenderer.invoke('git-checkout', { cwd, branch, create }),
  gitPull: (cwd: string) => ipcRenderer.invoke('git-pull', cwd),
  // Accounts
  getHardhatAccounts: (rpcUrl: string) => ipcRenderer.invoke('get-hardhat-accounts', rpcUrl),
  // Security
  analyzeSecurity: (folderPath: string) => ipcRenderer.invoke('analyze-security', { folderPath }),
  // Docs
  generateDocs: (abis: unknown[], projectName: string) => ipcRenderer.invoke('generate-docs', { abis, projectName }),
  // README
  readReadme: (folderPath: string) => ipcRenderer.invoke('read-readme', folderPath),
  // Logs export
  exportLogs: (content: string, filename: string) => ipcRenderer.invoke('export-logs', { content, filename }),
  // Workspace
  saveWorkspace: (workspace: unknown, savePath?: string) => ipcRenderer.invoke('save-workspace', { workspace, savePath }),
  loadWorkspace: (loadPath?: string) => ipcRenderer.invoke('load-workspace', loadPath),

  // Scripts
  scanScripts: (folderPath: string, parentFolder: string) => ipcRenderer.invoke('scan-scripts', folderPath, parentFolder),
  // Chain control
  evmSnapshot: (rpcUrl: string) => ipcRenderer.invoke('evm-snapshot', rpcUrl),
  evmRevert: (rpcUrl: string, snapshotId: string) => ipcRenderer.invoke('evm-revert', { rpcUrl, snapshotId }),
  evmMine: (rpcUrl: string) => ipcRenderer.invoke('evm-mine', rpcUrl),
  ethBlockNumber: (rpcUrl: string) => ipcRenderer.invoke('eth-block-number', rpcUrl),
  // Artifacts
  scanArtifactsMeta: (folderPath: string) => ipcRenderer.invoke('scan-artifacts-meta', folderPath),
  // Token balances
  getTokenBalances: (rpcUrl: string, address: string, tokenAddresses: string[]) => ipcRenderer.invoke('get-token-balances', { rpcUrl, address, tokenAddresses }),
  // Proxy inspector
  inspectProxy: (rpcUrl: string, address: string) => ipcRenderer.invoke('inspect-proxy', { rpcUrl, address }),
  // Opcode decoder
  decodeOpcodes: (bytecode: string) => ipcRenderer.invoke('decode-opcodes', bytecode),
  // Storage layout
  analyzeStorageLayout: (folderPath: string, contractName: string) => ipcRenderer.invoke('analyze-storage-layout', { folderPath, contractName }),
  // Audit notes
  saveAuditNotes: (folderPath: string, notes: unknown[]) => ipcRenderer.invoke('save-audit-notes', { folderPath, notes }),
  loadAuditNotes: (folderPath: string) => ipcRenderer.invoke('load-audit-notes', folderPath),
  // Events
  onProcessOutput: (cb: (d: { id: string; type: 'stdout' | 'stderr'; data: string; }) => void) => {
    const fn = (_: Electron.IpcRendererEvent, d: { id: string; type: 'stdout' | 'stderr'; data: string; }) => cb(d);
    ipcRenderer.on('process-output', fn);
    return () => ipcRenderer.removeListener('process-output', fn);
  },
  showOpenFileDialog: (opts?: {
    filters?: Array<{ name: string; extensions: string[]; }>;
    title?: string;
  }) => ipcRenderer.invoke('show-open-file-dialog', opts ?? {}),

  showSaveFileDialog: (opts?: {
    defaultPath?: string;
    filters?: Array<{ name: string; extensions: string[]; }>;
    title?: string;
  }) => ipcRenderer.invoke('show-save-file-dialog', opts ?? {}),
  onProcessStatus: (cb: (d: { id: string; status: string; code?: number; error?: string; }) => void) => {
    const fn = (_: Electron.IpcRendererEvent, d: { id: string; status: string; code?: number; error?: string; }) => cb(d);
    ipcRenderer.on('process-status', fn);
    return () => ipcRenderer.removeListener('process-status', fn);
  },
  onAbisChanged: (cb: (p: string) => void) => {
    const fn = (_: Electron.IpcRendererEvent, p: string) => cb(p);
    ipcRenderer.on('abis-changed', fn);
    return () => ipcRenderer.removeListener('abis-changed', fn);
  },

  //  Wallet Connect 
  connectWallet: (): Promise<{ address: string; chainId: number; } | null> =>
    ipcRenderer.invoke('wallet-connect-popup'),

  // WalletConnect v2: get URI for inline QR (called from renderer)
  wcGetUri: (): Promise<{ uri: string; } | { error: string; } | null> =>
    ipcRenderer.invoke('wc-get-uri'),

  // WalletConnect v2: notify main of approved session
  wcSessionApproved: (result: { address: string; chainId: number; }) =>
    ipcRenderer.invoke('wc-session-approved', result),

  // WalletConnect v2: poll for result (fallback if push event was missed)
  wcPollResult: (): Promise<{ address: string; chainId: number; } | null> =>
    ipcRenderer.invoke('wc-poll-result'),

  // WalletConnect v2: listen for session approval from main process
  onWcApproved: (cb: (result: { address: string; chainId: number; }) => void) => {
    ipcRenderer.on('wc-approved', (_event, result) => cb(result));
    return () => ipcRenderer.removeAllListeners('wc-approved');
  },

  // WalletConnect v2: check if an active session exists (survives restarts)
  wcHasSession: (): Promise<boolean> =>
    ipcRenderer.invoke('wc-has-session'),

  // WalletConnect v2: send transaction via active WC session (for pause/resume)
  wcSendTransaction: (params: { from: string; to: string; data: string; chainId: number; }) =>
    ipcRenderer.invoke('wc-send-transaction', params),

  exchangeDiscordCode: (code: string) => ipcRenderer.invoke("discord-exchange-code", code),
  discordLogin: () => ipcRenderer.invoke("discord-login"),
  checkDiscordRole: (params: { guildId: string; userId: string; roleIds: string[]; }) => ipcRenderer.invoke("discord-check-role", params),
  getUser: () => ipcRenderer.invoke("get-user"),
  logout: () => ipcRenderer.invoke("logout"),

  //  License 
  validateLicense: (key: string): Promise<{ valid: boolean; email?: string | null; expiresAt?: string | null; error?: string; }> =>
    ipcRenderer.invoke('validate-license', key),

  //  Auto updater 
  checkForUpdate: (): Promise<boolean> => ipcRenderer.invoke('check-for-update'),
  downloadUpdate: (): Promise<boolean> => ipcRenderer.invoke('download-update'),
  installUpdate: (): Promise<boolean> => ipcRenderer.invoke('install-update'),
  onUpdateStatus: (cb: (event: {
    type: 'checking' | 'available' | 'not-available' | 'download-progress' | 'downloaded' | 'error';
    version?: string;
    releaseNotes?: string;
    percent?: number;
    message?: string;
  }) => void) => {
    const fn = (_: Electron.IpcRendererEvent, d: any) => cb(d);
    ipcRenderer.on('update-status', fn);
    return () => ipcRenderer.removeListener('update-status', fn);
  },
  onOAuthCallback: (cb: (code: string) => void) =>
    ipcRenderer.on('oauth-callback', (_, { code }) => cb(code)),
  offOAuthCallback: () =>
    ipcRenderer.removeAllListeners('oauth-callback'),
  getLanIp: (): Promise<string | null> => ipcRenderer.invoke('get-lan-ip'),
  checkHardhatPort: (port: number): Promise<{ running: boolean; port: number; }> =>
    ipcRenderer.invoke('check-hardhat-port', port),
  detectHardhatNode: (): Promise<{ found: boolean; port: number | null; rpcUrl: string | null; }> =>
    ipcRenderer.invoke('detect-hardhat-node'),
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api);
  } catch (error) {
    console.error(error);
  }
}