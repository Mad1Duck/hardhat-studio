import { CommandConfig, ProcessState, ProjectInfo, NavTab } from '../../types';
import { cn, truncate } from '../../lib/utils';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

import {
  Activity,
  BookOpen,
  Bug,
  Camera,
  ChevronDown,
  Code2,
  Coins,
  Cpu,
  Database,
  Droplets,
  FileCode,
  FileText,
  FlaskConical,
  FolderOpen,
  FolderSearch,
  Fuel,
  GitBranch,
  GitCompare,
  GitFork,
  GitFork as GitFork2,
  Globe,
  Layers,
  LayoutGrid,
  ListOrdered,
  MessageSquare,
  Network,
  Package,
  Play,
  Radio,
  Rocket,
  RotateCcw,
  Save,
  Server,
  Settings,
  Shield,
  ShieldCheck,
  Square,
  Terminal,
  RefreshCw,
  Trash2,
  Wallet,
  Zap,
} from 'lucide-react';

import { useState } from 'react';
import { ThemeToggle } from '../ui/ThemeToggle';
import { UpdateChecker } from '../UpdateChecker';
import { DiscordLoginButton } from '@/integrations/discord/components/DiscordLoginButton';
import { LicenseBadge, LicenseModal } from '@/integrations/license';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  server: Server,
  layers: Layers,
  rocket: Rocket,
  'flask-conical': FlaskConical,
  terminal: Terminal,
  zap: Zap,
};

interface Props {
  projectInfo: ProjectInfo;
  projectPath: string;
  commands: CommandConfig[];
  processStates: Map<string, ProcessState>;
  activeTab: NavTab;
  activeCommandId: string;
  abisCount: number;
  deployedCount: number;
  errorCount: number;
  onTabChange: (tab: NavTab) => void;
  onCommandSelect: (id: string) => void;
  onChangeProject: () => void;
  onRunCommand: (id: string) => void;
  onStopCommand: (id: string) => void;
  onRefreshAbis: () => void;
  onSaveWorkspace: () => void;
  onLoadWorkspace: () => void;
  onResetState: () => void;
}

const NAV_GROUPS = [
  {
    label: 'Run',
    items: [
      {
        id: 'commands' as NavTab,
        icon: LayoutGrid,
        label: 'Commands',
        tooltip: 'Run Hardhat commands: node, compile, deploy, test',
      },
      {
        id: 'terminal' as NavTab,
        icon: Terminal,
        label: 'Terminal',
        tooltip: 'Full terminal with command history and log export',
      },
      {
        id: 'scripts' as NavTab,
        icon: FileCode,
        label: 'Scripts',
        tooltip: 'Edit and run Hardhat scripts with built-in editor',
      },
      {
        id: 'scheduler' as NavTab,
        icon: RotateCcw,
        label: 'Scheduler',
        tooltip: 'Schedule recurring contract calls or scripts',
      },
    ],
  },

  {
    label: 'Contracts',
    items: [
      {
        id: 'abis' as NavTab,
        icon: FolderSearch,
        label: 'ABI Explorer',
        tooltip: 'Browse compiled contract ABIs and artifacts',
      },
      {
        id: 'interact' as NavTab,
        icon: Zap,
        label: 'Interact',
        tooltip: 'Call contract read/write functions',
      },
      {
        id: 'deployed' as NavTab,
        icon: GitBranch,
        label: 'Deployed',
        tooltip: 'Manage deployed contract addresses',
      },
      {
        id: 'storage' as NavTab,
        icon: Database,
        label: 'Storage Layout',
        tooltip: 'Inspect storage slots and values',
      },
      {
        id: 'proxy' as NavTab,
        icon: Shield,
        label: 'Proxy Inspector',
        tooltip: 'Detect proxy contracts and implementation',
      },
      {
        id: 'upgrade' as NavTab,
        icon: Rocket,
        label: 'Upgrade Wizard',
        tooltip: 'Upgrade proxy contracts safely',
      },
    ],
  },

  {
    label: 'Network',
    items: [
      {
        id: 'network' as NavTab,
        icon: Globe,
        label: 'Network',
        tooltip: 'Switch networks and configure RPC',
      },
      {
        id: 'accounts' as NavTab,
        icon: Wallet,
        label: 'Accounts',
        tooltip: 'View Hardhat accounts and balances',
      },
      // {
      //   id: 'snapshots' as NavTab,
      //   icon: Camera,
      //   label: 'Snapshots',
      //   tooltip: 'Save and restore EVM state snapshots',
      // },
      {
        id: 'explorer' as NavTab,
        icon: Layers,
        label: 'Block Explorer',
        tooltip: 'Browse blocks, transactions, and state',
      },
    ],
  },

  {
    label: 'Analysis',
    items: [
      // {
      //   id: 'security' as NavTab,
      //   icon: Shield,
      //   label: 'Security',
      //   tooltip: 'Static analysis for vulnerabilities',
      // },
      {
        id: 'gas' as NavTab,
        icon: Fuel,
        label: 'Gas Profiler',
        tooltip: 'Estimate and analyze gas usage',
      },
      {
        id: 'opcodes' as NavTab,
        icon: Cpu,
        label: 'Opcode Viewer',
        tooltip: 'Inspect EVM bytecode and opcodes',
      },
      {
        id: 'graph' as NavTab,
        icon: Network,
        label: 'Contract Graph',
        tooltip: 'Visualize inheritance and call graph',
      },
      {
        id: 'tx-graph' as NavTab,
        icon: GitFork2,
        label: 'Tx Graph',
        tooltip: 'Visualize transaction flow',
      },
      {
        id: 'analytics' as NavTab,
        icon: Activity,
        label: 'Analytics',
        tooltip: 'Transaction metrics and stats',
      },
    ],
  },

  {
    label: 'Simulation',
    items: [
      {
        id: 'simulation' as NavTab,
        icon: FlaskConical,
        label: 'Simulation Lab',
        tooltip: 'Run DeFi and protocol simulations',
      },
      {
        id: 'lp' as NavTab,
        icon: Droplets,
        label: 'LP Simulator',
        tooltip: 'Simulate AMM liquidity pools',
      },
      {
        id: 'scenario' as NavTab,
        icon: ListOrdered,
        label: 'Scenario Builder',
        tooltip: 'Build multi-step transaction scenarios',
      },
    ],
  },

  {
    label: 'Development',
    items: [
      {
        id: 'frontend' as NavTab,
        icon: Code2,
        label: 'Frontend Helper',
        tooltip: 'Generate React hooks and integration code',
      },
      {
        id: 'verify' as NavTab,
        icon: ShieldCheck,
        label: 'Verify Contract',
        tooltip: 'Verify contract on explorers',
      },
      {
        id: 'abi-compat' as NavTab,
        icon: GitCompare,
        label: 'ABI Compat',
        tooltip: 'Check ABI compatibility',
      },
      {
        id: 'events' as NavTab,
        icon: Radio,
        label: 'Event Schema',
        tooltip: 'Detect event changes',
      },
    ],
  },

  {
    label: 'Project',
    items: [
      {
        id: 'environment' as NavTab,
        icon: Settings,
        label: 'Environment',
        tooltip: 'Manage .env variables',
      },
      {
        id: 'git' as NavTab,
        icon: GitFork,
        label: 'Git',
        tooltip: 'Commit, push, and manage branches',
      },
      {
        id: 'docs' as NavTab,
        icon: BookOpen,
        label: 'Docs',
        tooltip: 'Hardhat, Solidity and ethers docs',
      },
      {
        id: 'erc' as NavTab,
        icon: BookOpen,
        label: 'ERC Standards',
        tooltip: 'Browse ERC and EIP standards',
      },
      {
        id: 'audit' as NavTab,
        icon: MessageSquare,
        label: 'Audit Notes',
        tooltip: 'Track audit findings',
      },
      {
        id: 'notes',
        icon: FileText,
        label: 'Notes',
        tooltip: 'Project notes',
      },
      {
        id: 'debug' as NavTab,
        icon: Bug,
        label: 'Debug',
        tooltip: 'Logs, traces, and error debugging',
      },
      {
        id: 'erc20' as NavTab,
        icon: Coins,
        label: 'ERC-20 Reader',
        tooltip: 'Inspect ERC20 token data',
      },
      {
        id: 'nft' as NavTab,
        icon: Package,
        label: 'NFT Viewer',
        tooltip: 'Preview NFT metadata',
      },
    ],
  },
];
export default function Sidebar({
  projectInfo,
  projectPath,
  commands,
  processStates,
  activeTab,
  activeCommandId,
  abisCount,
  deployedCount,
  errorCount,
  onTabChange,
  onCommandSelect,
  onChangeProject,
  onRunCommand,
  onStopCommand,
  onRefreshAbis,
  onSaveWorkspace,
  onLoadWorkspace,
  onResetState,
}: Props) {
  const runningCount = Array.from(processStates.values()).filter(
    (s) => s.status === 'running',
  ).length;

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [showLicenseModal, setShowLicenseModal] = useState(false);

  const getBadge = (id: NavTab) => {
    if (id === 'abis') return abisCount;
    if (id === 'deployed') return deployedCount;
    if (id === 'debug') return errorCount;
    return 0;
  };

  const toggleGroup = (label: string) => setCollapsedGroups((p) => ({ ...p, [label]: !p[label] }));

  const frameworkColor =
    projectInfo.framework === 'ethers'
      ? 'text-blue-400'
      : projectInfo.framework === 'viem'
        ? 'text-purple-400'
        : 'text-muted-foreground/40';

  return (
    <aside className="w-[220px] flex-shrink-0 h-full flex flex-col bg-card border-r border-border overflow-hidden">
      {/* Project Header */}
      <div className="px-3 pt-3 pb-2 border-b border-border">
        <div className="flex items-center min-w-0 gap-2">
          <div className="flex items-center justify-center flex-shrink-0 border rounded-md w-7 h-7 bg-orange-500/15 border-orange-500/25">
            <Cpu className="w-3.5 h-3.5 text-orange-400" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold truncate text-foreground">{projectInfo.name}</div>
            <div
              className="text-[10px] text-muted-foreground font-mono truncate"
              title={projectPath}>
              {truncate(projectPath, 22)}
            </div>
          </div>

          <div className="flex items-center flex-shrink-0 gap-1">
            <ThemeToggle size="sm" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onChangeProject}
                  className="flex-shrink-0 w-6 h-6">
                  <RotateCcw className="w-3 h-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Change project</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Meta badges */}
        <div className="flex flex-wrap gap-1 mt-2">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-secondary text-[10px] font-mono text-muted-foreground">
            <Package className="w-2.5 h-2.5" />
            {projectInfo.packageManager}
          </span>

          {projectInfo.framework && (
            <span
              className={cn(
                'px-1.5 py-0.5 rounded bg-secondary text-[10px] font-mono',
                frameworkColor,
              )}>
              {projectInfo.framework}
            </span>
          )}

          {runningCount > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-[10px] font-mono text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
              {runningCount} running
            </span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-1 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <button
              className="flex items-center gap-1.5 w-full px-3 py-1 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/40"
              onClick={() => toggleGroup(group.label)}>
              <ChevronDown
                className={cn(
                  'w-2.5 h-2.5 transition-transform',
                  collapsedGroups[group.label] && '-rotate-90',
                )}
              />
              {group.label}
            </button>

            {!collapsedGroups[group.label] &&
              group.items.map(({ id, icon: Icon, label, tooltip }) => {
                const badge = getBadge(id as any);

                return (
                  <div key={id} className="relative flex items-center group/nav">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => onTabChange(id as any)}
                          className={cn(
                            'flex items-center gap-2.5 flex-1 px-3 py-1.5 text-xs transition-all relative',
                            activeTab === id
                              ? 'text-foreground bg-accent'
                              : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
                          )}>
                          {activeTab === id && (
                            <span className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r bg-orange-500" />
                          )}

                          <Icon className="w-3.5 h-3.5 flex-shrink-0" />

                          <span className="flex-1 font-medium text-left">{label}</span>

                          {badge > 0 && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-400/80">
                              {badge}
                            </span>
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-[180px] text-[11px]">
                        {tooltip}
                      </TooltipContent>
                    </Tooltip>
                    {id === 'abis' && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onRefreshAbis();
                            }}
                            className="absolute flex items-center justify-center w-5 h-5 transition-all rounded opacity-0 right-1 group-hover/nav:opacity-100 hover:bg-accent text-muted-foreground/40 hover:text-orange-400">
                            <RefreshCw className="w-3 h-3" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="text-[11px]">
                          Re-scan ABIs from project
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                );
              })}
          </div>
        ))}
      </nav>

      {/* Footer - Workspace controls */}
      <div className="border-t border-border px-3 py-2 space-y-1.5">
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-6 text-[10px] gap-1 truncate"
                onClick={onSaveWorkspace}>
                <Save className="w-2.5 h-2.5 flex-shrink-0" /> Save
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Save entire workspace state (contracts, history, settings)
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-6 text-[10px] gap-1 truncate"
                onClick={onLoadWorkspace}>
                <FolderOpen className="w-2.5 h-2.5 flex-shrink-0" /> Load
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Load a saved workspace</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="flex-shrink-0 w-6 h-6 text-rose-400/50 hover:text-rose-400 hover:bg-rose-500/10"
                onClick={onResetState}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-rose-400">
              Reset all state to default
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-muted-foreground/30">Hardhat Studio</span>
          <span className="text-[10px] font-mono text-muted-foreground/20">v6.0.6</span>
        </div>
        <LicenseBadge onClick={() => setShowLicenseModal(true)} />
        <UpdateChecker compact />
      </div>
      <DiscordLoginButton />
      {showLicenseModal && <LicenseModal onClose={() => setShowLicenseModal(false)} />}
    </aside>
  );
}
