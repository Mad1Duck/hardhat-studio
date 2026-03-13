import { useState, useEffect, useCallback } from 'react';
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
import { UpdateChecker } from './components/UpdateChecker';
import { LicenseGate, useLicense } from './integrations/license';
import CollabPanel from './components/panels/CollabPanel';

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
  const [collabMode, setCollabMode] = useState<'none' | 'host' | 'guest'>('none');
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
    if (info.valid) {
      setCollabMode('none');
      setActiveTab('commands');
    }
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

  const handleCollabTabChange = useCallback(
    (tab: NavTab) => {
      if (tab === 'collab' && collabMode === 'none') {
      }
      setActiveTab(tab);
    },
    [collabMode],
  );

  const handleCollabExit = useCallback(() => {
    setCollabMode('none');
    setActiveTab('commands');
    if (collabMode === 'guest') {
      setDeployedContracts([]);
      setAbis([]);
      setRpcUrl('http://127.0.0.1:8545');
      setTxHistory([]);
    }
    if (collabMode === 'host') {
      setCommands((prev) =>
        prev.map((c) => (c.id === 'node' ? { ...c, command: 'npx hardhat node' } : c)),
      );
    }
  }, [collabMode]);

  const handleExitProject = useCallback(() => {
    if (
      !confirm('Exit project? This will stop all running processes and clear the current session.')
    )
      return;

    processStates.forEach((_, id) => {
      window.api.stopCommand(id).catch(() => {});
    });

    // Clear all state
    setProjectPath(null);
    setProjectInfo(null);
    setDeployedContracts([]);
    setAbis([]);
    setSelectedAbi(null);
    setSourceFiles([]);
    setTxHistory([]);
    setAllLogs([]);
    setRpcUrl('http://127.0.0.1:8545');
    setSelectedPrivateKey('');
    setPinnedTab(null);
    setActiveTab('commands');
    setCollabMode('none');
    setCommands(DEFAULT_COMMANDS);
    setProcessStates(
      new Map(DEFAULT_COMMANDS.map((c) => [c.id, { status: 'idle' as const, logs: [] }])),
    );

    try {
      localStorage.removeItem('lastProject');
    } catch {}
    try {
      localStorage.removeItem('deployedContracts');
    } catch {}
  }, [processStates]);

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

  const handleRunCollabNode = useCallback(async () => {
    const cwd = projectPath ?? '.';

    const nodeState = processStates.get('node');
    if (nodeState?.status === 'running') {
      await window.api.stopCommand('node');
      await new Promise((r) => setTimeout(r, 800));
    }

    setCommands((prev) =>
      prev.map((c) =>
        c.id === 'node' ? { ...c, command: 'npx hardhat node --hostname 0.0.0.0' } : c,
      ),
    );

    setProcessStates((prev) => {
      const next = new Map(prev);
      next.set('node', {
        status: 'running',
        logs: [
          {
            id: crypto.randomUUID(),
            type: 'system',
            data: '$ npx hardhat node --hostname 0.0.0.0',
            timestamp: Date.now(),
            level: 'info',
          },
        ],
        startedAt: Date.now(),
      });
      return next;
    });

    const result = await window.api.runCommand({
      id: 'node',
      command: 'npx hardhat node --hostname 0.0.0.0',
      cwd,
    });

    if (!result.success) {
      setProcessStates((prev) => {
        const next = new Map(prev);
        next.set('node', {
          status: 'error',
          logs: [
            {
              id: crypto.randomUUID(),
              type: 'system',
              data: `✗ Failed to start: ${result.error}`,
              timestamp: Date.now(),
              level: 'error',
            },
          ],
          error: result.error,
        });
        return next;
      });
    }
  }, [projectPath, processStates]);

  const handleEndCollabNode = useCallback(() => {
    setCommands((prev) =>
      prev.map((c) => (c.id === 'node' ? { ...c, command: 'npx hardhat node' } : c)),
    );
  }, []);

  const isNodeRunning = processStates.get('node')?.status === 'running';

  const handleSaveWorkspace = useCallback(async () => {
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
      alert(`✓ Workspace saved to:\n${path}`);
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

  const handleGuestJoin = useCallback(() => setCollabMode('guest'), []);
  const handleHostStart = useCallback(() => setCollabMode('host'), []);
  const handleReceiveContracts = useCallback((contracts: unknown[]) => {
    setDeployedContracts(contracts as DeployedContract[]);
  }, []);
  const handleReceiveAbis = useCallback((received: unknown[]) => {
    setAbis(received as ContractAbi[]);
  }, []);
  const handleReceiveRpcUrl = useCallback((url: string) => {
    setRpcUrl(url);
  }, []);
  const handleReceiveTxHistory = useCallback((history: unknown[]) => {
    setTxHistory(history as TxRecord[]);
  }, []);

  const renderCollabPanel = () => (
    <CollabPanel
      onEndCollabNode={handleEndCollabNode}
      onRunCollabNode={handleRunCollabNode}
      isNodeRunning={isNodeRunning}
      deployedContracts={deployedContracts}
      abis={abis}
      rpcUrl={rpcUrl}
      txHistory={txHistory}
      projectName={projectInfo?.name ?? ''}
      onGuestJoin={handleGuestJoin}
      onHostStart={handleHostStart}
      onReceiveContracts={handleReceiveContracts}
      onReceiveAbis={handleReceiveAbis}
      onReceiveRpcUrl={handleReceiveRpcUrl}
      onReceiveTxHistory={handleReceiveTxHistory}
    />
  );

  const { can } = useLicense();
  const renderPanel = (tab: NavTab) => {
    switch (tab) {
      case 'commands':
        return (
          <CommandPanel
            onEndCollabNode={handleEndCollabNode}
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
              setDeployedContracts((prev) => {
                const existingIdx = prev.findIndex(
                  (x) =>
                    x.name.toLowerCase() === c.name.toLowerCase() &&
                    x.network === c.network &&
                    x.rpcUrl === c.rpcUrl,
                );
                if (existingIdx === -1) {
                  return [{ ...c, version: 1, previousVersions: [] }, ...prev];
                }
                const existing = prev[existingIdx];
                if (existing.address.toLowerCase() === c.address.toLowerCase()) return prev;
                const prevVersions = existing.previousVersions ?? [];
                const newVersion = (existing.version ?? 1) + 1;
                const archived = {
                  version: existing.version ?? 1,
                  address: existing.address,
                  txHash: existing.txHash,
                  deployedAt: existing.deployedAt,
                };
                const updated = {
                  ...c,
                  id: existing.id,
                  version: newVersion,
                  previousVersions: [archived, ...prevVersions].slice(0, 10),
                };
                const next = [...prev];
                next.splice(existingIdx, 1);
                return [updated, ...next];
              })
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
        return (
          <LicenseGate feature="security">
            <SecurityPanel projectPath={projectPath!} />
          </LicenseGate>
        );
      case 'gas':
        return (
          <LicenseGate feature="gas_profiler">
            <GasPanel abis={abis} txHistory={txHistory} rpcUrl={rpcUrl} />
          </LicenseGate>
        );
      case 'graph':
        return (
          <LicenseGate feature="contract_graph">
            <ContractGraphPanel
              abis={abis}
              sourceFiles={sourceFiles}
              projectPath={projectPath ?? ''}
            />
          </LicenseGate>
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
        return (
          <LicenseGate feature="snapshots">
            <SnapshotsPanel rpcUrl={rpcUrl} projectPath={projectPath ?? ''} />
          </LicenseGate>
        );
      case 'opcodes':
        return (
          <LicenseGate feature="opcode_viewer">
            <OpcodeViewer abis={abis} selectedAbi={selectedAbi} onSelectAbi={setSelectedAbi} />
          </LicenseGate>
        );
      case 'storage':
        return (
          <LicenseGate feature="opcode_viewer">
            <StorageLayoutPanel
              abis={abis}
              selectedAbi={selectedAbi}
              onSelectAbi={setSelectedAbi}
              projectPath={projectPath ?? ''}
              rpcUrl={rpcUrl}
              deployedContracts={deployedContracts}
            />
          </LicenseGate>
        );
      case 'artifacts':
        return (
          <LicenseGate feature="opcode_viewer">
            <ArtifactDiffPanel projectPath={projectPath!} />
          </LicenseGate>
        );
      case 'proxy':
        return (
          <LicenseGate feature="opcode_viewer">
            <ProxyInspectorPanel
              rpcUrl={rpcUrl}
              deployedContracts={deployedContracts}
              onNavigateToInteract={() => setActiveTab('interact')}
            />
          </LicenseGate>
        );
      case 'audit':
        return (
          <LicenseGate feature="audit_notes">
            <AuditNotesPanel abis={abis} projectPath={projectPath ?? ''} />
          </LicenseGate>
        );
      case 'scenario':
        return (
          <LicenseGate feature="scenario_builder">
            <ScenarioBuilderPanel
              abis={abis}
              deployedContracts={deployedContracts}
              rpcUrl={rpcUrl}
              onTxRecorded={(tx) => setTxHistory((prev) => [tx, ...prev.slice(0, 499)])}
            />
          </LicenseGate>
        );
      case 'lp':
        return (
          <LicenseGate feature="lp_simulator">
            <LiquidityPoolPanel deployedContracts={deployedContracts} rpcUrl={rpcUrl} />
          </LicenseGate>
        );
      case 'nft':
        return (
          <LicenseGate feature="nft_viewer">
            <NFTViewerPanel rpcUrl={rpcUrl} deployedContracts={deployedContracts} />
          </LicenseGate>
        );
      case 'erc':
        return (
          <ERCStandardsPanel abis={abis} deployedContracts={deployedContracts} rpcUrl={rpcUrl} />
        );
      case 'explorer':
        return <BlockExplorerPanel rpcUrl={rpcUrl} deployedContracts={deployedContracts} />;
      case 'scheduler':
        return (
          <LicenseGate feature="simulation_lab">
            <SchedulerPanel
              abis={abis}
              deployedContracts={deployedContracts}
              rpcUrl={rpcUrl}
              projectPath={projectPath ?? ''}
              onRunInTerminal={(cmd) => setTerminalCmdQueue((prev) => [...prev, cmd])}
            />
          </LicenseGate>
        );
      case 'upgrade':
        return (
          <LicenseGate feature="simulation_lab">
            <UpgradeWizardPanel
              abis={abis}
              deployedContracts={deployedContracts}
              projectPath={projectPath ?? ''}
              rpcUrl={rpcUrl}
              onRunInTerminal={(cmd) => setTerminalCmdQueue((prev) => [...prev, cmd])}
            />
          </LicenseGate>
        );
      case 'simulation':
        return (
          <LicenseGate feature="simulation_lab">
            <SimulationPanel
              abis={abis}
              deployedContracts={deployedContracts}
              rpcUrl={rpcUrl}
              onTxRecorded={(tx) => setTxHistory((prev) => [tx, ...prev.slice(0, 499)])}
            />
          </LicenseGate>
        );
      case 'analytics':
        return (
          <LicenseGate feature="analytics">
            <AnalyticsPanel
              txHistory={txHistory}
              deployedContracts={deployedContracts}
              rpcUrl={rpcUrl}
            />
          </LicenseGate>
        );
      case 'frontend':
        return (
          <LicenseGate feature="frontend_helper">
            <FrontendIntegrationPanel
              abis={abis}
              deployedContracts={deployedContracts}
              rpcUrl={rpcUrl}
            />
          </LicenseGate>
        );
      case 'verify':
        return (
          <LicenseGate feature="verify_contract">
            <VerificationHelperPanel
              abis={abis}
              deployedContracts={deployedContracts}
              projectPath={projectPath ?? ''}
              rpcUrl={rpcUrl}
            />
          </LicenseGate>
        );
      case 'events':
        return (
          <LicenseGate feature="event_schema">
            <EventSchemaAnalyzer abis={abis} projectPath={projectPath ?? ''} rpcUrl={rpcUrl} />
          </LicenseGate>
        );
      case 'abi-compat':
        return (
          <LicenseGate feature="abi_compat">
            <ABICompatibilityChecker abis={abis} projectPath={projectPath ?? ''} />
          </LicenseGate>
        );
      case 'tx-graph':
        return (
          <LicenseGate feature="tx_graph">
            <TransactionGraphPanel
              txHistory={txHistory}
              rpcUrl={rpcUrl}
              deployedContracts={deployedContracts}
            />
          </LicenseGate>
        );
      case 'notes':
        return <NotesEditorPanel projectPath={projectPath} />;
      case 'erc20':
        return (
          <LicenseGate feature="erc20_reader">
            <ERC20TokenReader rpcUrl={rpcUrl} deployedContracts={deployedContracts} />
          </LicenseGate>
        );
      case 'collab':
        return null;
      default:
        return null;
    }
  };

  if (!projectPath || !projectInfo?.valid) {
    if (activeTab === 'collab' || collabMode !== 'none') {
      return (
        <div className="flex w-screen h-screen overflow-hidden bg-background">
          <Sidebar
            projectInfo={null}
            projectPath=""
            commands={commands}
            processStates={processStates}
            activeTab={activeTab}
            activeCommandId={activeCommandId}
            abisCount={abis.length}
            deployedCount={deployedContracts.length}
            errorCount={0}
            collabMode={collabMode}
            onCollabExit={() => {
              handleCollabExit();
              setActiveTab('collab');
            }}
            onExitProject={handleExitProject}
            onTabChange={handleCollabTabChange}
            onCommandSelect={(id) => {
              setActiveCommandId(id);
              setActiveTab('commands');
            }}
            onChangeProject={handleSelectProject}
            onRunCommand={handleRunCommand}
            onStopCommand={handleStopCommand}
            onRefreshAbis={() => {}}
            onSaveWorkspace={handleSaveWorkspace}
            onLoadWorkspace={handleLoadWorkspace}
            onResetState={handleResetState}
          />
          <main className="flex flex-1 min-w-0 overflow-hidden">
            <div
              className="flex-1 min-w-0 overflow-hidden"
              style={{ display: 'flex', flexDirection: 'column' }}>
              <div
                style={{
                  display: activeTab === 'collab' ? 'flex' : 'none',
                  height: '100%',
                  flexDirection: 'column',
                }}>
                {renderCollabPanel()}
              </div>
              {activeTab !== 'collab' && (
                <div style={{ height: '100%' }}>{renderPanel(activeTab)}</div>
              )}
            </div>
          </main>
        </div>
      );
    }

    return (
      <ProjectSelector
        onSelect={handleSelectProject}
        lastProject={projectPath}
        onJoinCollab={() => {
          setCollabMode('guest');
          setActiveTab('collab');
        }}
      />
    );
  }

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-background">
      <UpdateChecker />
      <div className="flex flex-1 min-h-0 overflow-hidden">
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
          collabMode={collabMode}
          onCollabExit={handleCollabExit}
          onExitProject={handleExitProject}
          onTabChange={handleCollabTabChange}
          onCommandSelect={(id) => {
            setActiveCommandId(id);
            setActiveTab('commands');
          }}
          onChangeProject={handleSelectProject}
          onRunCommand={handleRunCommand}
          onStopCommand={handleStopCommand}
          onRefreshAbis={async () => {
            if (projectPath) setAbis(await window.api.scanAbis(projectPath));
          }}
          onSaveWorkspace={handleSaveWorkspace}
          onLoadWorkspace={handleLoadWorkspace}
          onResetState={handleResetState}
        />
        <main className="relative flex flex-1 min-w-0 overflow-hidden">
          <div className="flex-1 min-w-0 overflow-hidden">
            {collabMode !== 'none' && (
              <div
                style={{
                  display: activeTab === 'collab' ? 'flex' : 'none',
                  height: '100%',
                  flexDirection: 'column',
                }}>
                {renderCollabPanel()}
              </div>
            )}
            <div
              style={{
                display: activeTab !== 'collab' ? 'flex' : 'none',
                height: '100%',
                flexDirection: 'column',
              }}>
              {renderPanel(activeTab)}
            </div>
            {collabMode === 'none' && activeTab === 'collab' && (
              <div style={{ height: '100%' }}>{renderCollabPanel()}</div>
            )}
          </div>
          <PinnedPanel
            pinnedTab={pinnedTab}
            renderPanel={renderPanel}
            onClose={() => setPinnedTab(null)}
          />
        </main>
        <PinFloatingButton pinnedTab={pinnedTab} activeTab={activeTab} onPin={setPinnedTab} />
      </div>
    </div>
  );
}
