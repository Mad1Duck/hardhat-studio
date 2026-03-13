export type ActionType =
  | 'call'
  | 'send'
  | 'wait'
  | 'timeout'
  | 'snapshot'
  | 'revert'
  | 'assert'
  | 'assert_revert'
  | 'log'
  | 'impersonate'
  | 'set_balance'
  | 'custom_script';

export type StepStatus = 'idle' | 'running' | 'ok' | 'error' | 'skipped';

export interface Step {
  id: string;
  action: ActionType;
  description: string;
  contractAddress: string;
  contractName: string;
  functionName: string;
  args: string;
  value: string;
  fromPrivateKey: string;
  blocks: string;
  timeoutMs: string;
  message: string;
  assertContract: string;
  assertFn: string;
  assertArgs: string;
  assertExpected: string;
  assertOperator: 'eq' | 'gt' | 'lt' | 'gte' | 'lte' | 'includes';
  expectedRevertMsg: string;
  impersonateAddr: string;
  balanceAddr: string;
  balanceEth: string;
  script: string;
  parallelGroup?: string | null;
  status?: StepStatus;
  log?: string;
  txHash?: string;
  gasUsed?: string;
  duration?: number;
}

export interface CustomEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface Scenario {
  id: string;
  name: string;
  steps: Step[];
  customEdges: CustomEdge[];
  createdAt: number;
  nodePositions?: Record<string, { x: number; y: number; }>;
}

export interface RunLog {
  stepId: string;
  status: StepStatus;
  message: string;
  txHash?: string;
  gasUsed?: string;
  duration?: number;
  timestamp: number;
}

export interface ScenarioBuilderProps {
  abis: import('../../../../types').ContractAbi[];
  deployedContracts: import('../../../../types').DeployedContract[];
  rpcUrl: string;
  onTxRecorded: (tx: import('../../../../types').TxRecord) => void;
}

export type StepNodeData = {
  step: Step;
  index: number;
  isActive: boolean;
  isSelected: boolean;
  onSelect: (id: string) => void;
};

export type ForkJoinData = {
  kind: 'fork' | 'join';
  groupId: string;
  allOk: boolean;
  anyRunning: boolean;
  anyError: boolean;
};
