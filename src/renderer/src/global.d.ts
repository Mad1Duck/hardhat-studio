export { };

declare global {
  interface Window {
    api: {
      // ── Discord ──────────────────────────────────────────────────────────────
      discordLogin: () => Promise<DiscordUser | null>;
      exchangeDiscordCode: (code: string) => Promise<DiscordUser>;
      checkDiscordRole: (params: { guildId: string; userId: string; roleIds: string[]; }) => Promise<boolean>;
      getUser: () => Promise<DiscordUser | null>;
      logout: () => Promise<void>;
      onOAuthCallback: (cb: (code: string) => void) => void;
      offOAuthCallback: () => void;

      // ── Project ──────────────────────────────────────────────────────────────
      selectFolder: () => Promise<string | null>;
      validateProject: (p: string) => Promise<ProjectInfo>;
      scanAbis: (p: string) => Promise<ContractAbi[]>;
      watchAbis: (p: string) => Promise<boolean>;
      scanSources: (p: string) => Promise<SourceFile[]>;

      // ── Commands ─────────────────────────────────────────────────────────────
      runCommand: (params: { id: string; command: string; cwd: string; }) => Promise<{ success: boolean; error?: string; }>;
      stopCommand: (id: string) => Promise<boolean>;
      getProcessStatus: (id: string) => Promise<string>;

      // ── Files ────────────────────────────────────────────────────────────────
      readFile: (p: string) => Promise<string | null>;
      writeFile: (filePath: string, content: string) => Promise<boolean>;
      listDir: (dirPath: string) => Promise<Array<{ name: string; isDir: boolean; path: string; }>>;
      openExternal: (url: string) => void;
      openInEditor: (p: string) => Promise<boolean>;
      showOpenFileDialog: (opts?: { filters?: Array<{ name: string; extensions: string[]; }>; title?: string; }) => Promise<string | null>;
      showSaveFileDialog: (opts?: { defaultPath?: string; filters?: Array<{ name: string; extensions: string[]; }>; title?: string; }) => Promise<string | null>;
      exportLogs: (content: string, filename: string) => Promise<boolean>;

      // ── Env ──────────────────────────────────────────────────────────────────
      readEnv: (folderPath: string) => Promise<Array<{ key: string; value: string; }>>;
      writeEnv: (folderPath: string, entries: Array<{ key: string; value: string; }>) => Promise<boolean>;

      // ── Git ──────────────────────────────────────────────────────────────────
      gitStatus: (cwd: string) => Promise<import('./types').GitStatus | null>;
      gitBranches: (cwd: string) => Promise<import('./types').GitBranch[]>;
      gitLog: (cwd: string) => Promise<import('./types').GitCommit[]>;
      gitDiff: (cwd: string, file?: string) => Promise<string>;
      gitCommit: (cwd: string, message: string, push: boolean) => Promise<{ success: boolean; error?: string; }>;
      gitCheckout: (cwd: string, branch: string, create: boolean) => Promise<{ success: boolean; error?: string; }>;
      gitPull: (cwd: string) => Promise<{ success: boolean; error?: string; }>;

      // ── Accounts ─────────────────────────────────────────────────────────────
      getHardhatAccounts: (rpcUrl: string) => Promise<HardhatAccount[]>;

      // ── Security ─────────────────────────────────────────────────────────────
      analyzeSecurity: (folderPath: string) => Promise<import('./types').SecurityFinding[]>;

      // ── Docs / README ────────────────────────────────────────────────────────
      generateDocs: (abis: ContractAbi[], projectName: string) => Promise<boolean>;
      readReadme: (folderPath: string) => Promise<string | null>;

      // ── Workspace ────────────────────────────────────────────────────────────
      saveWorkspace: (workspace: unknown, savePath?: string) => Promise<string | null>;
      loadWorkspace: (loadPath?: string) => Promise<unknown>;
      scanScripts: (folderPath: string, parentFolder: string) => Promise<unknown>;

      // ── Chain control ────────────────────────────────────────────────────────
      evmSnapshot: (rpcUrl: string) => Promise<string>;
      evmRevert: (rpcUrl: string, snapshotId: string) => Promise<boolean>;
      evmMine: (rpcUrl: string) => Promise<boolean>;
      ethBlockNumber: (rpcUrl: string) => Promise<number>;

      // ── Artifacts ────────────────────────────────────────────────────────────
      scanArtifactsMeta: (folderPath: string) => Promise<unknown>;
      getTokenBalances: (rpcUrl: string, address: string, tokenAddresses: string[]) => Promise<unknown>;
      inspectProxy: (rpcUrl: string, address: string) => Promise<unknown>;
      decodeOpcodes: (bytecode: string) => Promise<unknown>;
      analyzeStorageLayout: (folderPath: string, contractName: string) => Promise<unknown>;

      // ── Audit notes ──────────────────────────────────────────────────────────
      saveAuditNotes: (folderPath: string, notes: unknown[]) => Promise<boolean>;
      loadAuditNotes: (folderPath: string) => Promise<unknown[]>;

      // ── Events ───────────────────────────────────────────────────────────────
      onProcessOutput: (cb: (d: { id: string; type: 'stdout' | 'stderr'; data: string; }) => void) => () => void;
      onProcessStatus: (cb: (d: { id: string; status: string; code?: number; error?: string; }) => void) => () => void;
      onAbisChanged: (cb: (p: string) => void) => () => void;

      // ── WalletConnect ────────────────────────────────────────────────────────
      connectWallet: () => Promise<{ address: string; chainId: number; } | null>;
      wcGetUri: () => Promise<{ uri: string; } | { error: string; } | null>;
      wcSessionApproved: (result: { address: string; chainId: number; }) => Promise<void>;
      wcPollResult: () => Promise<{ address: string; chainId: number; } | null>;
      wcHasSession: () => Promise<boolean>;
      wcSendTransaction: (params: { from: string; to: string; data: string; chainId: number; }) => Promise<unknown>;
      onWcApproved: (cb: (result: { address: string; chainId: number; }) => void) => () => void;

      // ── License ──────────────────────────────────────────────────────────────
      validateLicense: (key: string) => Promise<{ valid: boolean; email?: string | null; expiresAt?: string | null; error?: string; }>;

      // ── Auto updater ─────────────────────────────────────────────────────────
      checkForUpdate: () => Promise<boolean>;
      downloadUpdate: () => Promise<boolean>;
      installUpdate: () => Promise<boolean>;
      onUpdateStatus: (cb: (event: UpdateStatusEvent) => void) => () => void;

      // ── Colaboration ─────────────────────────────────────────────────────────
      getLanIp: () => Promise<string | null>;
      checkHardhatPort: (port: number) => Promise<{ running: boolean; port: number; }>;
      detectHardhatNode: () => Promise<{ found: boolean; port: number | null; rpcUrl: string | null; }>;
    };
  }
}