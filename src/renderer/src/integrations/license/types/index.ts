// ─────────────────────────────────────────────────────────────────────────────
//  LICENSE TYPES — single source of truth for all shared types
// ─────────────────────────────────────────────────────────────────────────────

export type Plan = 'free' | 'basic' | 'pro';

export type Status =
  | 'loading'
  | 'free'
  | 'basic'
  | 'pro'
  | 'dev'
  | 'no_wallet'
  | 'debt'
  | 'paused';

export type Feature =
  | 'accounts'
  | 'environment'
  | 'git'
  | 'docs'
  | 'notes'
  | 'debug'
  | 'erc_standards'
  | 'block_explorer'
  | 'security'
  | 'gas_profiler'
  | 'opcode_viewer'
  | 'snapshots'
  | 'erc20_reader'
  | 'nft_viewer'
  | 'verify_contract'
  | 'audit_notes'
  | 'contract_graph'
  | 'tx_graph'
  | 'analytics'
  | 'simulation_lab'
  | 'lp_simulator'
  | 'scenario_builder'
  | 'frontend_helper'
  | 'abi_compat'
  | 'event_schema';

export type LogLevel = 'info' | 'success' | 'warn' | 'error' | 'debug';

export type LogEntry = {
  id: string;
  ts: number;
  level: LogLevel;
  msg: string;
  data?: unknown;
};

export type ActiveStream = {
  streamId: string;
  streamAlias: string;
  sender: string;
  tokenSymbol: string;
  tokenAddress: string;
  tokenDecimals: number;
  chainId: number;
  chainName: string;
  ratePerSecond: string;
  // Deposit/balance fields (raw BigInt strings, token-decimals)
  balance: string;
  totalStreamed: string;
  netDeposited: string;
  depositAmount: string;
  withdrawnAmount: string;
  // Debt state
  hasDebt: boolean;
  debtRaw: string;
  // Timestamps
  startTime: number;
  lastAdjustmentTime: number;
  // Status
  paused: boolean;
  endTime: number;
};

export type LicenseContextType = {
  status: Status;
  walletAddress?: string;
  chainId?: number;
  chainName?: string;
  currentPlan: Plan;
  activeStream?: ActiveStream;
  availableStreams: ActiveStream[];
  selectedStreamId: string | null;
  selectStream: (streamId: string) => void;
  error?: string;
  isDev: boolean;
  logs: LogEntry[];
  lastChecked?: number;
  streamRevoked: boolean;
  tokenPrice: number | null;
  selectedChainId: number | null;
  setSelectedChainId: (id: number | null) => void;
  connect: (addr: string, chainId: number) => Promise<void>;
  disconnect: () => void;
  logout: () => void;
  refresh: () => Promise<void>;
  clearLogs: () => void;
  pauseStream: () => Promise<void>;
  resumeStream: () => Promise<void>;
  streamActionPending: boolean;
  applyStreamStatus: (stream: ActiveStream) => Promise<void>;
  can: (feature: Feature) => boolean;
  planFor: (feature: Feature) => Plan;
  // Discord bypass
  isDiscordLoggedIn: boolean;
  refreshDiscordStatus: () => Promise<void>;
};