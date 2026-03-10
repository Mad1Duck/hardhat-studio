export { };

declare global {
  interface Window {
    api: {
      discordLogin: () => Promise<DiscordUser>;
      getUser: () => Promise<DiscordUser | null>;
      logout: () => Promise<void>;
      selectFolder: () => Promise<string | null>;
      validateProject: (p: string) => Promise<ProjectInfo>;
      scanAbis: (p: string) => Promise<ContractAbi[]>;
      watchAbis: (p: string) => Promise<boolean>;
      scanSources: (p: string) => Promise<SourceFile[]>;
      runCommand: (params: {
        id: string;
        command: string;
        cwd: string;
      }) => Promise<{ success: boolean; error?: string; }>;
      stopCommand: (id: string) => Promise<boolean>;
      getProcessStatus: (id: string) => Promise<string>;
      readFile: (p: string) => Promise<string | null>;
      writeFile: (filePath: string, content: string) => Promise<boolean>;
      listDir: (dirPath: string) => Promise<Array<{ name: string; isDir: boolean; path: string; }>>;
      openExternal: (url: string) => void;
      openInEditor: (p: string) => Promise<boolean>;
      readEnv: (folderPath: string) => Promise<Array<{ key: string; value: string; }>>;
      writeEnv: (
        folderPath: string,
        entries: Array<{ key: string; value: string; }>,
      ) => Promise<boolean>;
      gitStatus: (cwd: string) => Promise<import('./types').GitStatus | null>;
      gitBranches: (cwd: string) => Promise<import('./types').GitBranch[]>;
      gitLog: (cwd: string) => Promise<import('./types').GitCommit[]>;
      gitDiff: (cwd: string, file?: string) => Promise<string>;
      gitCommit: (
        cwd: string,
        message: string,
        push: boolean,
      ) => Promise<{ success: boolean; error?: string; }>;
      gitCheckout: (
        cwd: string,
        branch: string,
        create: boolean,
      ) => Promise<{ success: boolean; error?: string; }>;
      gitPull: (cwd: string) => Promise<{ success: boolean; error?: string; }>;
      getHardhatAccounts: (rpcUrl: string) => Promise<HardhatAccount[]>;
      analyzeSecurity: (folderPath: string) => Promise<import('./types').SecurityFinding[]>;
      generateDocs: (abis: ContractAbi[], projectName: string) => Promise<boolean>;
      readReadme: (folderPath: string) => Promise<string | null>;
      exportLogs: (content: string, filename: string) => Promise<boolean>;
      saveWorkspace: (workspace: unknown, savePath?: string) => Promise<string | null>;
      loadWorkspace: (loadPath?: string) => Promise<unknown>;
      onProcessOutput: (
        cb: (d: { id: string; type: 'stdout' | 'stderr'; data: string; }) => void,
      ) => () => void;
      onProcessStatus: (
        cb: (d: { id: string; status: string; code?: number; error?: string; }) => void,
      ) => () => void;
      onAbisChanged: (cb: (p: string) => void) => () => void;
      showOpenFileDialog: (opts?: {
        filters?: Array<{ name: string; extensions: string[]; }>;
        title?: string;
      }) => Promise<string | null>;
      checkForUpdate: () => Promise<string | null>;
      validateLicense: (key: string) => Promise<{
        valid: boolean;
        email?: string | null;
        expiresAt?: string | null;
        error?: string;
      }>;
      downloadUpdate: () => Promise<boolean>;
      installUpdate: () => Promise<boolean>;
      onUpdateStatus: (cb: (event: UpdateStatusEvent) => void) => () => void;
      showSaveFileDialog: (opts?: {
        defaultPath?: string;
        filters?: Array<{ name: string; extensions: string[]; }>;
        title?: string;
      }) => Promise<string | null>;
    };
  }
}