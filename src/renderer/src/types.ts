export interface AbiInput { name: string; type: string; components?: AbiInput[]; internalType?: string; }
export interface AbiOutput { name: string; type: string; components?: AbiOutput[]; internalType?: string; }

export interface AbiItem {
  type: 'function' | 'event' | 'constructor' | 'fallback' | 'receive' | 'error';
  name?: string;
  inputs?: AbiInput[];
  outputs?: AbiOutput[];
  stateMutability?: 'pure' | 'view' | 'nonpayable' | 'payable';
  anonymous?: boolean;
}

export interface ContractAbi {
  name: string;
  contractName: string;
  path: string;
  abi: AbiItem[];
  bytecode?: string | null;
  sourceName?: string | null;
}

export interface ProjectInfo {
  valid: boolean;
  configFile: string | null;
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun';
  name: string;
  hardhatVersion: string | null;
  nodeModulesExist: boolean;
  error?: string;
  framework?: 'ethers' | 'viem' | 'both' | null;
  plugins?: string[];
  networks?: Record<string, NetworkConfig>;
  envFile?: boolean;
  bunInstalled?: boolean;
  isBun?: boolean;
}

export interface NetworkConfig {
  url?: string;
  chainId?: number;
  accounts?: string[] | { mnemonic: string; } | 'remote';
}

export interface CommandConfig {
  id: string;
  label: string;
  icon: string;
  command: string;
  description: string;
  persistent: boolean;
  color: string;
  group: 'hardhat' | 'custom';
}

export interface LogEntry {
  id: string;
  type: 'stdout' | 'stderr' | 'system' | 'debug';
  data: string;
  timestamp: number;
  level?: 'info' | 'warn' | 'error' | 'success' | 'trace';
}

export interface ProcessState {
  status: 'idle' | 'running' | 'stopped' | 'error';
  logs: LogEntry[];
  exitCode?: number;
  error?: string;
  startedAt?: number;
}

export interface DeployedContract {
  id: string;
  name: string;
  address: string;
  network: string;
  rpcUrl: string;
  abi: AbiItem[];
  deployedAt: number;
  txHash?: string;
  constructorArgs?: Record<string, string>;
  chainId?: number;
  gasUsed?: string;
  version?: number;
  previousVersions?: Array<{ version: number; address: string; txHash?: string; deployedAt: number; }>;
}

export interface TxRecord {
  id: string;
  hash: string;
  contractName: string;
  functionName: string;
  args: unknown[];
  status: 'pending' | 'success' | 'failed';
  gasUsed?: string;
  gasPrice?: string;
  blockNumber?: number;
  timestamp: number;
  error?: string;
  value?: string;
  from?: string;
  to?: string;
  chainId?: number;
  rpcUrl?: string;
}

export interface SourceFile {
  name: string;
  path: string;
  size: number;
}

export interface HardhatAccount {
  address: string;
  privateKey: string;
  balance?: string;
  index: number;
}

export interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  balance: string;
}

export interface EnvEntry {
  key: string;
  value: string;
  masked: boolean;
}

export interface WorkspaceConfig {
  id: string;
  name: string;
  projectPath: string;
  rpcUrl: string;
  savedAt: number;
  deployedContracts?: DeployedContract[];
  notes?: string;
}

export interface GitBranch {
  name: string;
  current: boolean;
  remote?: string;
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
}

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: string[];
  unstaged: string[];
  untracked: string[];
  remoteUrl?: string;
}

export interface SecurityFinding {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  line?: number;
  function?: string;
  recommendation: string;
}

export interface GasEstimate {
  functionName: string;
  gasEstimate: string;
  gasCostETH: string;
  gasCostUSD?: string;
}

export interface ContractNode {
  name: string;
  path?: string;
  inherits: string[];
  functions: string[];
  events: string[];
  variables: string[];
}

export interface AuditNote {
  id: string;
  contractName: string;
  line?: number;
  functionName?: string;
  severity: 'note' | 'warning' | 'critical';
  content: string;
  createdAt: number;
}

export interface ScenarioStep {
  id: string;
  action: string;
  params: Record<string, string>;
  description?: string;
}

export interface TestScenario {
  id: string;
  name: string;
  steps: ScenarioStep[];
  createdAt: number;
}


export interface ScriptFile {
  id: string;
  name: string;
  path: string;
  relativePath: string;
  size: number;
}

export interface StorageSlot {
  slot: number;
  name: string;
  type: string;
  value?: string;
  bytes: number;
  offset: number;
}

export interface ArtifactDiff {
  contractName: string;
  oldPath: string;
  newPath: string;
  abiAdded: string[];
  abiRemoved: string[];
  abiChanged: string[];
  bytecodeSizeOld: number;
  bytecodeSizeNew: number;
  bytecodeSizeDelta: number;
}

export interface ChainSnapshot {
  id: string;
  snapshotId: string;
  label: string;
  blockNumber: number;
  createdAt: number;
  rpcUrl: string;
}

export interface OpcodeEntry {
  offset: number;
  opcode: string;
  operand?: string;
  gasCost: number;
}

export interface LiquidityPool {
  tokenA: string;
  tokenB: string;
  reserveA: number;
  reserveB: number;
  k: number;
  price: number;
  fee: number;
}

export interface ProxyInfo {
  type: 'transparent' | 'uups' | 'beacon' | 'minimal' | 'unknown';
  proxyAddress: string;
  implementationAddress?: string;
  adminAddress?: string;
  slots: { slot: string; value: string; label: string; }[];
}

export type NavTab =
  | 'commands'
  | 'abis'
  | 'interact'
  | 'deployed'
  | 'debug'
  | 'docs'
  | 'terminal'
  | 'git'
  | 'environment'
  | 'security'
  | 'gas'
  | 'graph'
  | 'accounts'
  | 'network'
  | 'scenarios'
  | 'analytics'
  | 'simulation'
  | 'scripts'
  | 'snapshots'
  | 'opcodes'
  | 'storage'
  | 'artifacts'
  | 'scenario'
  | 'proxy'
  | 'audit'
  | 'lp'
  | 'nft'
  | 'erc'
  | 'explorer'
  | 'scheduler'
  | 'upgrade'
  | 'frontend'
  | 'verify'
  | 'events'
  | 'abi-compat'
  | 'tx-graph'
  | 'erc20'
  | 'notes'
  | 'collab';

export interface ScheduledTask {
  id: string;
  name: string;
  type: 'contract_call' | 'script' | 'rpc_call';
  intervalMs: number;
  enabled: boolean;
  status: 'idle' | 'running' | 'success' | 'error' | 'stopped';
  lastRun?: number;
  lastResult?: string;
  runCount: number;
  contractAddress?: string;
  contractName?: string;
  functionName?: string;
  args?: string;
  scriptPath?: string;
  rpcMethod?: string;
  rpcParams?: string;
}
