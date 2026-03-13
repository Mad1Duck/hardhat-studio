import { ContractAbi, DeployedContract, TxRecord } from '../../../../types';

export interface SimulationPanelProps {
  abis: ContractAbi[];
  deployedContracts: DeployedContract[];
  rpcUrl: string;
  onTxRecorded: (tx: TxRecord) => void;
}

export interface CallContractResult {
  ok: boolean;
  result?: any;
  error?: string;
  gasUsed?: string;
  txHash?: string;
  resolvedContract?: string;
  decimals?: number;
}

export type ContractCompatibility = 'full' | 'partial' | 'none';
