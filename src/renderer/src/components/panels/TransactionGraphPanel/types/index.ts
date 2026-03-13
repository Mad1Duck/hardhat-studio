import { TxRecord, DeployedContract } from '../../../../types';

export interface TransactionGraphPanelProps {
  txHistory: TxRecord[];
  rpcUrl: string;
  deployedContracts: DeployedContract[];
}

export interface RpcBlock {
  number: string;
  hash: string;
  timestamp: string;
  miner: string;
  transactions: RpcTx[];
  gasUsed: string;
  gasLimit: string;
  baseFeePerGas?: string;
  parentHash: string;
}

export interface RpcTx {
  hash: string;
  from: string;
  to: string | null;
  value: string;
  gas: string;
  gasPrice: string;
  nonce: string;
  blockNumber: string;
  input: string;
  transactionIndex: string;
}

export interface RpcReceipt {
  status: string;
  gasUsed: string;
  contractAddress?: string;
  logs: { address: string; topics: string[]; data: string; }[];
}

export type NodeType = 'wallet' | 'contract' | 'miner' | 'external';
export type EdgeStatus = 'success' | 'failed' | 'unknown';
export type ViewMode = 'graph' | 'list' | 'blocks';

export interface NodeData {
  address: string;
  label: string;
  nodeType: NodeType;
  txCount: number;
  contractName?: string;
}

export interface EdgeData {
  txHash: string;
  value: string;
  input: string;
  status: EdgeStatus;
  blockNumber: number;
  gasPrice: string;
  nonce: number;
  functionSig?: string;
  localName?: string;
}

export interface TxDetailState {
  tx: RpcTx;
  receipt: RpcReceipt | null;
}
