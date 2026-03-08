import { useState, useEffect, useCallback, useRef } from 'react';
import {
  CommandConfig,
  ContractAbi,
  ProcessState,
  ProjectInfo,
  LogEntry,
  DeployedContract,
  TxRecord,
  SourceFile,
  NavTab,
  HardhatAccount,
} from './types';
import NotesEditorPanel from './components/panels/NotesEditorPanel';
import ProjectSelector from './components/panels/ProjectSelector';
import Sidebar from './components/layout/Sidebar';
import CommandPanel from './components/panels/CommandPanel';
import AbiExplorer from './components/panels/AbiExplorer';
import ContractInteract from './components/panels/ContractInteract';
import DeployedContracts from './components/panels/DeployedContracts';
import DebugPanel from './components/panels/DebugPanel';
import DocsPanel from './components/panels/DocsPanel';
import TerminalPanel from './components/panels/TerminalPanel';
import GitPanel from './components/panels/GitPanel';
import AccountsPanel from './components/panels/AccountsPanel';
import SecurityPanel from './components/panels/SecurityPanel';
import GasPanel from './components/panels/GasPanel';
import ContractGraphPanel from './components/panels/ContractGraphPanel';
import EnvironmentPanel from './components/panels/EnvironmentPanel';
import NetworkPanel from './components/panels/NetworkPanel';
import AnalyticsPanel from './components/panels/AnalyticsPanel';
import SimulationPanel from './components/panels/SimulationPanel';
import ScriptsPanel from './components/panels/ScriptsPanel';
import SnapshotsPanel from './components/panels/SnapshotsPanel';
import OpcodeViewer from './components/panels/OpcodeViewer';
import StorageLayoutPanel from './components/panels/StorageLayoutPanel';
import ArtifactDiffPanel from './components/panels/ArtifactDiffPanel';
import ProxyInspectorPanel from './components/panels/ProxyInspectorPanel';
import AuditNotesPanel from './components/panels/AuditNotesPanel';
import ScenarioBuilderPanel from './components/panels/ScenarioBuilderPanel';
import LiquidityPoolPanel from './components/panels/LiquidityPoolPanel';
import NFTViewerPanel from './components/panels/NFTViewerPanel';
import ERCStandardsPanel from './components/panels/ERCStandardsPanel';
import BlockExplorerPanel from './components/panels/BlockExplorerPanel';
import SchedulerPanel from './components/panels/SchedulerPanel';
import UpgradeWizardPanel from './components/panels/UpgradeWizardPanel';
import PinnedPanel from './components/layout/PinnedPanel';
import PinFloatingButton from './components/layout/PinFloatingButton';
import FrontendIntegrationPanel from './components/panels/FrontendIntegrationPanel';
import VerificationHelperPanel from './components/panels/VerificationHelperPanel';
import EventSchemaAnalyzer from './components/panels/EventSchemaAnalyzer';
import ABICompatibilityChecker from './components/panels/ABICompatibilityChecker';
import TransactionGraphPanel from './components/panels/TransactionGraphPanel';
import ERC20TokenReader from './components/panels/ERC20TokenReader';

declare global {
  interface Window {
    api: {
      selectFolder: () => Promise<string | null>;
      validateProject: (p: string) => Promise<ProjectInfo>;
      scanAbis: (p: string) => Promise<ContractAbi[]>;
      watchAbis: (p: string) => Promise<boolean>;
      scanSources: (p: string) => Promise<SourceFile[]>;
      runCommand: (params: {
        id: string;
        command: string;
        cwd: string;
      }) => Promise<{ success: boolean; error?: string }>;
      stopCommand: (id: string) => Promise<boolean>;
      getProcessStatus: (id: string) => Promise<string>;
      readFile: (p: string) => Promise<string | null>;
      writeFile: (filePath: string, content: string) => Promise<boolean>;
      listDir: (dirPath: string) => Promise<Array<{ name: string; isDir: boolean; path: string }>>;
      openExternal: (url: string) => void;
      openInEditor: (p: string) => Promise<boolean>;
      readEnv: (folderPath: string) => Promise<Array<{ key: string; value: string }>>;
      writeEnv: (
        folderPath: string,
        entries: Array<{ key: string; value: string }>,
      ) => Promise<boolean>;
      gitStatus: (cwd: string) => Promise<import('./types').GitStatus | null>;
      gitBranches: (cwd: string) => Promise<import('./types').GitBranch[]>;
      gitLog: (cwd: string) => Promise<import('./types').GitCommit[]>;
      gitDiff: (cwd: string, file?: string) => Promise<string>;
      gitCommit: (
        cwd: string,
        message: string,
        push: boolean,
      ) => Promise<{ success: boolean; error?: string }>;
      gitCheckout: (
        cwd: string,
        branch: string,
        create: boolean,
      ) => Promise<{ success: boolean; error?: string }>;
      gitPull: (cwd: string) => Promise<{ success: boolean; error?: string }>;
      getHardhatAccounts: (rpcUrl: string) => Promise<HardhatAccount[]>;
      analyzeSecurity: (folderPath: string) => Promise<import('./types').SecurityFinding[]>;
      generateDocs: (abis: ContractAbi[], projectName: string) => Promise<boolean>;
      readReadme: (folderPath: string) => Promise<string | null>;
      exportLogs: (content: string, filename: string) => Promise<boolean>;
      saveWorkspace: (workspace: unknown, savePath?: string) => Promise<string | null>;
      loadWorkspace: (loadPath?: string) => Promise<unknown>;
      onProcessOutput: (
        cb: (d: { id: string; type: 'stdout' | 'stderr'; data: string }) => void,
      ) => () => void;
      onProcessStatus: (
        cb: (d: { id: string; status: string; code?: number; error?: string }) => void,
      ) => () => void;
      onAbisChanged: (cb: (p: string) => void) => () => void;
      showOpenFileDialog: (opts?: {
        filters?: Array<{ name: string; extensions: string[] }>;
        title?: string;
      }) => Promise<string | null>;

      showSaveFileDialog: (opts?: {
        defaultPath?: string;
        filters?: Array<{ name: string; extensions: string[] }>;
        title?: string;
      }) => Promise<string | null>;
    };
  }
}

const DEFAULT_COMMANDS: CommandConfig[] = [
  {
    id: 'node',
    label: 'Node',
    icon: 'server',
    command: 'npx hardhat node',
    description: 'Local Hardhat network on port 8545',
    persistent: true,
    color: '#f7931a',
    group: 'hardhat',
  },
  {
    id: 'compile',
    label: 'Compile',
    icon: 'layers',
    command: 'npx hardhat compile',
    description: 'Compile all smart contracts',
    persistent: false,
    color: '#38bdf8',
    group: 'hardhat',
  },
  {
    id: 'deploy',
    label: 'Deploy',
    icon: 'rocket',
    command: 'npx hardhat run scripts/deploy.js --network localhost',
    description: 'Deploy contracts to network',
    persistent: false,
    color: '#34d399',
    group: 'hardhat',
  },
  {
    id: 'test',
    label: 'Test',
    icon: 'flask-conical',
    command: 'npx hardhat test',
    description: 'Run test suite',
    persistent: false,
    color: '#a78bfa',
    group: 'hardhat',
  },
  {
    id: 'custom1',
    label: 'Script 1',
    icon: 'terminal',
    command: '',
    description: 'Custom script',
    persistent: false,
    color: '#fbbf24',
    group: 'custom',
  },
  {
    id: 'custom2',
    label: 'Script 2',
    icon: 'terminal',
    command: '',
    description: 'Custom script',
    persistent: false,
    color: '#fb7185',
    group: 'custom',
  },
];

export default function App() {
  const [projectPath, setProjectPath] = useState<string | null>(() => {
    try {
      return localStorage.getItem('lastProject');
    } catch {
      return null;
    }
  });
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
  const [commands, setCommands] = useState<CommandConfig[]>(() => {
    try {
      const saved = localStorage.getItem('commands');
      return saved ? JSON.parse(saved) : DEFAULT_COMMANDS;
    } catch {
      return DEFAULT_COMMANDS;
    }
  });
  const [processStates, setProcessStates] = useState<Map<string, ProcessState>>(() => {
    const m = new Map<string, ProcessState>();
    DEFAULT_COMMANDS.forEach((c) => m.set(c.id, { status: 'idle', logs: [] }));
    return m;
  });
  const [abis, setAbis] = useState<ContractAbi[]>([]);
  const [selectedAbi, setSelectedAbi] = useState<ContractAbi | null>(null);
  const [deployedContracts, setDeployedContracts] = useState<DeployedContract[]>(() => {
    try {
      const parsed: DeployedContract[] = JSON.parse(
        localStorage.getItem('deployedContracts') || '[]',
      );
      const seen = new Set<string>();
      return parsed.filter((c) => {
        const key = c.address.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    } catch {
      return [];
    }
  });
  const [txHistory, setTxHistory] = useState<TxRecord[]>([]);
  const [sourceFiles, setSourceFiles] = useState<SourceFile[]>([]);
  const [activeTab, setActiveTab] = useState<NavTab>('commands');
  const [activeCommandId, setActiveCommandId] = useState<string>('node');
  const [allLogs, setAllLogs] = useState<
    (LogEntry & { commandId: string; commandLabel: string })[]
  >([]);
  const [rpcUrl, setRpcUrl] = useState('http://127.0.0.1:8545');
  const [selectedPrivateKey, setSelectedPrivateKey] = useState('');
  const [terminalCmdQueue, setTerminalCmdQueue] = useState<string[]>([]);
  const [pinnedTab, setPinnedTab] = useState<NavTab | null>(null);

  // Persist deployed contracts
  useEffect(() => {
    try {
      localStorage.setItem('deployedContracts', JSON.stringify(deployedContracts));
    } catch {}
  }, [deployedContracts]);

  // Persist commands
  useEffect(() => {
    try {
      localStorage.setItem('commands', JSON.stringify(commands));
    } catch {}
  }, [commands]);

  // Update deploy command based on detected package manager
  useEffect(() => {
    if (!projectInfo) return;
    const pm = projectInfo.packageManager;
    const runner =
      pm === 'bun' ? 'bunx' : pm === 'pnpm' ? 'pnpm exec' : pm === 'yarn' ? 'yarn' : 'npx';
    setCommands((prev) =>
      prev.map((c) => {
        if (c.group === 'hardhat' && c.id !== 'custom1' && c.id !== 'custom2') {
          return { ...c, command: c.command.replace(/^npx|^bunx|^pnpm exec|^yarn/, runner) };
        }
        return c;
      }),
    );
  }, [projectInfo?.packageManager]);

  // IPC listeners
  useEffect(() => {
    const u1 = window.api.onProcessOutput(({ id, type, data }) => {
      const entry: LogEntry = {
        id: crypto.randomUUID(),
        type,
        data,
        timestamp: Date.now(),
        level:
          type === 'stderr' || data.toLowerCase().includes('error')
            ? 'error'
            : data.toLowerCase().includes('warn')
              ? 'warn'
              : data.includes('✓') || data.includes('compiled') || data.includes('deployed')
                ? 'success'
                : 'info',
      };
      setProcessStates((prev) => {
        const next = new Map(prev);
        const s = next.get(id) || { status: 'running' as const, logs: [] };
        next.set(id, { ...s, logs: [...s.logs.slice(-3000), entry] });
        return next;
      });
      const cmd = commands.find((c) => c.id === id);
      if (cmd) {
        setAllLogs((prev) => [
          ...prev.slice(-5000),
          { ...entry, commandId: id, commandLabel: cmd.label },
        ]);
      }
    });

    const u2 = window.api.onProcessStatus(({ id, status, code, error }) => {
      const sysMsg =
        status === 'running'
          ? `▶ Process started`
          : status === 'stopped'
            ? `■ Exited (code ${code ?? 0})`
            : `✗ Error: ${error}`;
      const sysEntry: LogEntry = {
        id: crypto.randomUUID(),
        type: 'system',
        data: sysMsg,
        timestamp: Date.now(),
        level: status === 'error' ? 'error' : status === 'running' ? 'success' : 'info',
      };
      setProcessStates((prev) => {
        const next = new Map(prev);
        const s = next.get(id) || { status: 'idle' as const, logs: [] };
        next.set(id, {
          ...s,
          status: status as ProcessState['status'],
          logs: [...s.logs, sysEntry],
          exitCode: code,
          error,
          startedAt: status === 'running' ? Date.now() : s.startedAt,
        });
        return next;
      });
    });

    return () => {
      u1();
      u2();
    };
  }, [commands]);

  const loadProject = useCallback(
    async (folderPath: string) => {
      const info = await window.api.validateProject(folderPath);
      if (info.valid) {
        setProjectPath(folderPath);
        setProjectInfo(info);
        try {
          localStorage.setItem('lastProject', folderPath);
        } catch {}
        const [foundAbis, sources] = await Promise.all([
          window.api.scanAbis(folderPath),
          window.api.scanSources(folderPath),
        ]);
        setAbis(foundAbis);
        setSourceFiles(sources);
        if (foundAbis.length > 0 && !selectedAbi) setSelectedAbi(foundAbis[0]);
        window.api.watchAbis(folderPath);
      }
      return info;
    },
    [selectedAbi],
  );

  useEffect(() => {
    if (projectPath) loadProject(projectPath);
  }, []);

  useEffect(() => {
    if (!projectPath) return;
    const unsub = window.api.onAbisChanged(async (path) => {
      if (path === projectPath) {
        const updated = await window.api.scanAbis(projectPath);
        setAbis(updated);
      }
    });
    return unsub;
  }, [projectPath]);

  const handleSelectProject = useCallback(async () => {
    const folder = await window.api.selectFolder();
    if (!folder) return;
    const info = await loadProject(folder);
    if (info.valid) setActiveTab('commands');
  }, [loadProject]);

  const handleRunCommand = useCallback(
    async (id: string) => {
      if (!projectPath) return;
      const cmd = commands.find((c) => c.id === id);
      if (!cmd?.command.trim()) return;

      const cmdEntry: LogEntry = {
        id: crypto.randomUUID(),
        type: 'system',
        data: `$ ${cmd.command}`,
        timestamp: Date.now(),
        level: 'info',
      };
      setProcessStates((prev) => {
        const next = new Map(prev);
        const s = next.get(id) || { status: 'idle' as const, logs: [] };
        next.set(id, {
          ...s,
          status: 'running',
          logs: [...s.logs, cmdEntry],
          startedAt: Date.now(),
        });
        return next;
      });
      const result = await window.api.runCommand({ id, command: cmd.command, cwd: projectPath });
      if (!result.success) {
        setProcessStates((prev) => {
          const next = new Map(prev);
          const s = next.get(id)!;
          const errEntry: LogEntry = {
            id: crypto.randomUUID(),
            type: 'system',
            data: `✗ Failed to start: ${result.error}`,
            timestamp: Date.now(),
            level: 'error',
          };
          next.set(id, { ...s, status: 'error', error: result.error, logs: [...s.logs, errEntry] });
          return next;
        });
      }
    },
    [projectPath, commands],
  );

  const handleRunTerminalCmd = useCallback(
    async (cmd: string) => {
      if (!projectPath) return;
      const id = `term-${Date.now()}`;
      const newCmd: CommandConfig = {
        id,
        label: 'Terminal',
        icon: 'terminal',
        command: cmd,
        description: cmd,
        persistent: false,
        color: '#38bdf8',
        group: 'custom',
      };
      setCommands((prev) => [...prev.filter((c) => c.id !== id), newCmd]);
      setProcessStates((prev) => {
        const n = new Map(prev);
        n.set(id, { status: 'idle', logs: [] });
        return n;
      });
      await window.api.runCommand({ id, command: cmd, cwd: projectPath });
    },
    [projectPath],
  );

  const handleStopCommand = useCallback(async (id: string) => {
    await window.api.stopCommand(id);
  }, []);

  const handleClearLogs = useCallback((id: string) => {
    setProcessStates((prev) => {
      const next = new Map(prev);
      const s = next.get(id);
      if (s) next.set(id, { ...s, logs: [] });
      return next;
    });
  }, []);

  const handleUpdateCommand = useCallback((id: string, updates: Partial<CommandConfig>) => {
    setCommands((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  }, []);

  const handleSaveWorkspace = useCallback(async () => {
    // Collect all panel localStorage state keys to bundle into workspace
    const localKeys = [
      'hhs_scenarios',
      'docRefs',
      'erc_custom_standards',
      'erc_doc_overrides',
      'interact_bookmarks',
      'gasPanel_customChains',
      'verify_custom_explorers',
      'security_settings',
      'commands',
      'deployedContracts',
      'nft_gw2',
      'nft_custom_gw_list',
      'notes_panel_docs',
    ];
    const localData: Record<string, string> = {};
    localKeys.forEach((k) => {
      try {
        const v = localStorage.getItem(k);
        if (v) localData[k] = v;
      } catch {}
    });

    const workspace = {
      version: 2,
      projectPath,
      deployedContracts,
      txHistory,
      rpcUrl,
      activeTab,
      selectedPrivateKey,
      pinnedTab,
      localData,
      savedAt: Date.now(),
      projectName: projectInfo?.name || '',
    };
    const path = await window.api.saveWorkspace(workspace);
    if (path) {
      alert(`✓ Workspace saved to:
${path}`);
    }
  }, [
    projectPath,
    deployedContracts,
    txHistory,
    rpcUrl,
    activeTab,
    selectedPrivateKey,
    pinnedTab,
    projectInfo,
  ]);

  const handleLoadWorkspace = useCallback(async () => {
    const ws = (await window.api.loadWorkspace()) as {
      version?: number;
      projectPath?: string;
      deployedContracts?: DeployedContract[];
      txHistory?: TxRecord[];
      rpcUrl?: string;
      activeTab?: NavTab;
      selectedPrivateKey?: string;
      pinnedTab?: NavTab | null;
      localData?: Record<string, string>;
      projectName?: string;
    } | null;
    if (!ws) return;

    // Restore localStorage state first (so panels pick it up on mount)
    if (ws.localData) {
      Object.entries(ws.localData).forEach(([k, v]) => {
        try {
          localStorage.setItem(k, v);
        } catch {}
      });
    }

    if (ws.projectPath) await loadProject(ws.projectPath);
    if (ws.deployedContracts) setDeployedContracts(ws.deployedContracts);
    if (ws.txHistory) setTxHistory(ws.txHistory);
    if (ws.rpcUrl) setRpcUrl(ws.rpcUrl);
    if (ws.activeTab) setActiveTab(ws.activeTab);
    if (ws.selectedPrivateKey) setSelectedPrivateKey(ws.selectedPrivateKey);
    if (ws.pinnedTab !== undefined) setPinnedTab(ws.pinnedTab ?? null);
  }, [loadProject]);

  const handleResetState = useCallback(() => {
    if (
      !confirm(
        'Reset all studio state? This clears deployed contracts, tx history, bookmarks, custom settings, and all panel data. Project path is kept.',
      )
    )
      return;
    // Clear all localStorage keys used by panels
    const clearKeys = [
      'deployedContracts',
      'commands',
      'hhs_scenarios',
      'docRefs',
      'erc_custom_standards',
      'erc_doc_overrides',
      'interact_bookmarks',
      'gasPanel_customChains',
      'verify_custom_explorers',
      'security_settings',
      'nft_gw2',
      'nft_custom_gw_list',
      'notes_panel_docs',
    ];
    clearKeys.forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch {}
    });

    // Reset all state
    setDeployedContracts([]);
    setTxHistory([]);
    setAllLogs([]);
    setRpcUrl('http://127.0.0.1:8545');
    setSelectedPrivateKey('');
    setPinnedTab(null);
    setActiveTab('commands');
    setProcessStates(
      new Map(DEFAULT_COMMANDS.map((c) => [c.id, { status: 'idle' as const, logs: [] }])),
    );

    // Stop all running processes
    processStates.forEach((_, id) => {
      window.api.stopCommand(id).catch(() => {});
    });
  }, [processStates]);

  const handleExportLogs = useCallback(async (content: string, filename: string) => {
    await window.api.exportLogs(content, filename);
  }, []);

  const handleGenerateDocs = useCallback(async () => {
    if (!projectInfo) return;
    await window.api.generateDocs(abis, projectInfo.name);
  }, [abis, projectInfo]);

  // ── Panel renderer (used for both main + pinned) ──
  const renderPanel = (tab: NavTab) => {
    switch (tab) {
      case 'commands':
        return (
          <CommandPanel
            commands={commands}
            processStates={processStates}
            activeCommandId={activeCommandId}
            onRun={handleRunCommand}
            onStop={handleStopCommand}
            onClear={handleClearLogs}
            onUpdateCommand={handleUpdateCommand}
            onCommandSelect={setActiveCommandId}
          />
        );
      case 'terminal':
        return (
          <TerminalPanel
            projectPath={projectPath ?? ''}
            allLogs={allLogs}
            onExportLogs={handleExportLogs}
            onRunCommand={handleRunTerminalCmd}
          />
        );
      case 'abis':
        return (
          <AbiExplorer
            abis={abis}
            selectedAbi={selectedAbi}
            onSelectAbi={setSelectedAbi}
            onInteract={(abi) => {
              setSelectedAbi(abi);
              setActiveTab('interact');
            }}
            onRefresh={async () => {
              if (projectPath) setAbis(await window.api.scanAbis(projectPath));
            }}
          />
        );
      case 'interact':
        return (
          <ContractInteract
            abis={abis}
            selectedAbi={selectedAbi}
            onSelectAbi={setSelectedAbi}
            onDeployed={(c) =>
              setDeployedContracts((prev) => [
                c,
                ...prev.filter((x) => x.address.toLowerCase() !== c.address.toLowerCase()),
              ])
            }
            onTxRecorded={(tx) => setTxHistory((prev) => [tx, ...prev.slice(0, 499)])}
            defaultRpcUrl={rpcUrl}
            defaultPrivateKey={selectedPrivateKey}
            deployedContracts={deployedContracts}
            projectPath={projectPath ?? ''}
            projectInfo={projectInfo}
          />
        );
      case 'deployed':
        return (
          <DeployedContracts
            contracts={deployedContracts}
            onRemove={(id) => setDeployedContracts((prev) => prev.filter((c) => c.id !== id))}
            onInteract={(c) => {
              setSelectedAbi({ name: c.name, contractName: c.name, path: '', abi: c.abi });
              setActiveTab('interact');
            }}
          />
        );
      case 'debug':
        return (
          <DebugPanel
            allLogs={allLogs}
            txHistory={txHistory}
            processStates={processStates}
            commands={commands}
            sourceFiles={sourceFiles}
            projectPath={projectPath!}
            rpcUrl={rpcUrl}
          />
        );
      case 'docs':
        return (
          <DocsPanel
            onOpenExternal={(url) => window.api.openExternal(url)}
            projectPath={projectPath ?? ''}
            onGenerateDocs={handleGenerateDocs}
          />
        );
      case 'git':
        return <GitPanel projectPath={projectPath!} />;
      case 'accounts':
        return (
          <AccountsPanel
            rpcUrl={rpcUrl}
            onSelectAccount={(pk) => {
              setSelectedPrivateKey(pk);
              setActiveTab('interact');
            }}
          />
        );
      case 'security':
        return <SecurityPanel projectPath={projectPath!} />;
      case 'gas':
        return <GasPanel abis={abis} txHistory={txHistory} rpcUrl={rpcUrl} />;
      case 'graph':
        return (
          <ContractGraphPanel
            abis={abis}
            sourceFiles={sourceFiles}
            projectPath={projectPath ?? ''}
          />
        );
      case 'environment':
        return <EnvironmentPanel projectPath={projectPath!} />;
      case 'network':
        return (
          <NetworkPanel
            projectInfo={projectInfo}
            currentRpcUrl={rpcUrl}
            onNetworkChange={setRpcUrl}
          />
        );
      case 'scripts':
        return (
          <ScriptsPanel
            projectPath={projectPath ?? ''}
            projectInfo={projectInfo}
            onRunInTerminal={(cmd) => setTerminalCmdQueue((prev) => [...prev, cmd])}
          />
        );
      case 'snapshots':
        return <SnapshotsPanel rpcUrl={rpcUrl} projectPath={projectPath ?? ''} />;
      case 'opcodes':
        return <OpcodeViewer abis={abis} selectedAbi={selectedAbi} onSelectAbi={setSelectedAbi} />;
      case 'storage':
        return (
          <StorageLayoutPanel
            abis={abis}
            selectedAbi={selectedAbi}
            onSelectAbi={setSelectedAbi}
            projectPath={projectPath ?? ''}
            rpcUrl={rpcUrl}
            deployedContracts={deployedContracts}
          />
        );
      case 'artifacts':
        return <ArtifactDiffPanel projectPath={projectPath!} />;
      case 'proxy':
        return (
          <ProxyInspectorPanel
            rpcUrl={rpcUrl}
            deployedContracts={deployedContracts}
            onNavigateToInteract={() => {
              setActiveTab('interact');
            }}
          />
        );
      case 'audit':
        return <AuditNotesPanel abis={abis} projectPath={projectPath ?? ''} />;
      case 'scenario':
        return (
          <ScenarioBuilderPanel
            abis={abis}
            deployedContracts={deployedContracts}
            rpcUrl={rpcUrl}
            onTxRecorded={(tx) => setTxHistory((prev) => [tx, ...prev.slice(0, 499)])}
          />
        );
      case 'lp':
        return <LiquidityPoolPanel deployedContracts={deployedContracts} rpcUrl={rpcUrl} />;
      case 'nft':
        return <NFTViewerPanel rpcUrl={rpcUrl} deployedContracts={deployedContracts} />;
      case 'erc':
        return (
          <ERCStandardsPanel abis={abis} deployedContracts={deployedContracts} rpcUrl={rpcUrl} />
        );
      case 'explorer':
        return <BlockExplorerPanel rpcUrl={rpcUrl} deployedContracts={deployedContracts} />;
      case 'scheduler':
        return (
          <SchedulerPanel
            abis={abis}
            deployedContracts={deployedContracts}
            rpcUrl={rpcUrl}
            projectPath={projectPath ?? ''}
            onRunInTerminal={(cmd) => setTerminalCmdQueue((prev) => [...prev, cmd])}
          />
        );
      case 'upgrade':
        return (
          <UpgradeWizardPanel
            abis={abis}
            deployedContracts={deployedContracts}
            projectPath={projectPath ?? ''}
            rpcUrl={rpcUrl}
            onRunInTerminal={(cmd) => setTerminalCmdQueue((prev) => [...prev, cmd])}
          />
        );
      case 'simulation':
        return (
          <SimulationPanel
            abis={abis}
            deployedContracts={deployedContracts}
            rpcUrl={rpcUrl}
            onTxRecorded={(tx) => setTxHistory((prev) => [tx, ...prev.slice(0, 499)])}
          />
        );
      case 'analytics':
        return (
          <AnalyticsPanel
            txHistory={txHistory}
            deployedContracts={deployedContracts}
            rpcUrl={rpcUrl}
          />
        );
      case 'frontend':
        return (
          <FrontendIntegrationPanel
            abis={abis}
            deployedContracts={deployedContracts}
            rpcUrl={rpcUrl}
          />
        );
      case 'verify':
        return (
          <VerificationHelperPanel
            abis={abis}
            deployedContracts={deployedContracts}
            projectPath={projectPath ?? ''}
            rpcUrl={rpcUrl}
          />
        );
      case 'events':
        return <EventSchemaAnalyzer abis={abis} projectPath={projectPath ?? ''} />;
      case 'abi-compat':
        return <ABICompatibilityChecker abis={abis} projectPath={projectPath ?? ''} />;
      case 'tx-graph':
        return (
          <TransactionGraphPanel
            txHistory={txHistory}
            rpcUrl={rpcUrl}
            deployedContracts={deployedContracts}
          />
        );
      case 'notes':
        return <NotesEditorPanel projectPath={projectPath} />;
      case 'erc20':
        return <ERC20TokenReader rpcUrl={rpcUrl} deployedContracts={deployedContracts} />;
      default:
        return null;
    }
  };

  if (!projectPath || !projectInfo?.valid) {
    return <ProjectSelector onSelect={handleSelectProject} lastProject={projectPath} />;
  }

  return (
    <div className="flex w-screen h-screen overflow-hidden bg-background">
      <Sidebar
        projectInfo={projectInfo}
        projectPath={projectPath ?? ''}
        commands={commands}
        processStates={processStates}
        activeTab={activeTab}
        activeCommandId={activeCommandId}
        abisCount={abis.length}
        deployedCount={deployedContracts.length}
        errorCount={allLogs.filter((l) => l.level === 'error').length}
        onTabChange={setActiveTab}
        onCommandSelect={(id) => {
          setActiveCommandId(id);
          setActiveTab('commands');
        }}
        onChangeProject={handleSelectProject}
        onRunCommand={handleRunCommand}
        onStopCommand={handleStopCommand}
        onSaveWorkspace={handleSaveWorkspace}
        onLoadWorkspace={handleLoadWorkspace}
        onResetState={handleResetState}
      />
      <main className="relative flex flex-1 min-w-0 overflow-hidden">
        <div className="flex-1 min-w-0 overflow-hidden">{renderPanel(activeTab)}</div>
        <PinnedPanel
          pinnedTab={pinnedTab}
          renderPanel={renderPanel}
          onClose={() => setPinnedTab(null)}
        />
      </main>
      <PinFloatingButton pinnedTab={pinnedTab} activeTab={activeTab} onPin={setPinnedTab} />
    </div>
  );
}
