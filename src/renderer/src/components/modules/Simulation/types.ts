// ─── Shared simulation types ─────────────────────────────────────────────────

export interface SimUser {
  id: string;
  address: string;
  privateKey: string;
  label: string;
  balanceETH: number;
  balanceToken: number;
  balanceNFT: number[];        // token IDs
  balanceCollateral: number;
  borrowedAmount: number;
  healthFactor: number;
  lpTokens: number;
  votingPower: number;
  stakedAmount: number;
}

export type SimEventType =
  | 'deposit' | 'borrow' | 'repay' | 'liquidate'
  | 'mint' | 'burn' | 'transfer' | 'approve'
  | 'swap' | 'addLiq' | 'removeLiq'
  | 'flashloan' | 'price' | 'oracle'
  | 'nft_mint' | 'nft_transfer' | 'nft_list' | 'nft_sale' | 'nft_bid'
  | 'vote' | 'propose' | 'execute'
  | 'attack' | 'upgrade' | 'bridge'
  | 'mev' | 'gas' | 'block'
  | 'vest' | 'airdrop'
  | 'info' | 'warn' | 'error' | 'success';

export interface SimEvent {
  id: string;
  timestamp: number;
  type: SimEventType;
  actor: string;
  message: string;
  value?: number;
  gasUsed?: number;
  txHash?: string;
  success: boolean;
  tag?: string;   // module tag e.g. "ERC20", "AMM"
  contractMethod?: string;
  realTx?: boolean;  // was this a real on-chain tx?
}

export interface PoolState {
  totalDeposited: number;
  totalBorrowed: number;
  utilizationRate: number;
  collateralPrice: number;
  liquidationThreshold: number;
  interestRate: number;
  tokenTotalSupply: number;
  oraclePrice: number;
  // AMM
  reserveA: number;
  reserveB: number;
  lpTotalSupply: number;
  // NFT
  nftTotalSupply: number;
  floorPrice: number;
  // Governance
  totalVotingPower: number;
  proposalCount: number;
}

export interface ContractSupport {
  supported: boolean;
  missing: string[];
  suggestions: ContractSuggestion[];
}

export interface ContractSuggestion {
  interface: string;
  package: string;
  import: string;
  snippet: string;
}

export interface SimContext {
  users: SimUser[];
  pool: PoolState;
  rpcUrl: string;
  deployedContracts: any[];
  log: (type: SimEventType, actor: string, msg: string, value?: number, success?: boolean, realTx?: boolean) => void;
  stop: () => boolean;   // returns true if should stop
  setPool: React.Dispatch<React.SetStateAction<PoolState>>;
  setUsers: React.Dispatch<React.SetStateAction<SimUser[]>>;
  onTxRecorded: (tx: any) => void;
  sleep: (ms: number) => Promise<void>;
  callContract: (contractName: string, fn: string, args: any[], signer?: string, rawAmounts?: boolean) => Promise<{ ok: boolean; result?: any; error?: string; gasUsed?: string; txHash?: string; resolvedContract?: string; decimals?: number }>;
  /** Returns the decimals of the first matching deployed ERC20 contract */
  getContractDecimals: (contractName: string) => Promise<number>;
  checkSupport: (required: string[]) => ContractSupport;
}

export interface SimModule {
  id: string;
  label: string;
  icon: string;
  category: string;
  desc: string;
  longDesc: string;
  params: SimParam[];
  requiredMethods: string[];   // ABI methods needed for real execution
  requiredEvents: string[];
  suggestedContracts: ContractSuggestion[];
  run: (ctx: SimContext, params: Record<string, string>) => Promise<void>;
}

export interface SimParam {
  id: string;
  label: string;
  type: 'number' | 'text' | 'select' | 'boolean' | 'address';
  default: string;
  options?: string[];
  hint?: string;
  min?: number;
  max?: number;
}

// ─── Hardhat default accounts ─────────────────────────────────────────────────
export const HH_ACCOUNTS = [
  { address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' },
  { address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', privateKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' },
  { address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', privateKey: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a' },
  { address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906', privateKey: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6' },
  { address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', privateKey: '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926b' },
  { address: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc', privateKey: '0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba' },
  { address: '0x976EA74026E726554dB657fA54763abd0C3a0aa9', privateKey: '0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564' },
  { address: '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955', privateKey: '0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356' },
];

export const makeUser = (index: number, label?: string): SimUser => ({
  id: crypto.randomUUID(),
  address: HH_ACCOUNTS[index % HH_ACCOUNTS.length].address,
  privateKey: HH_ACCOUNTS[index % HH_ACCOUNTS.length].privateKey,
  label: label || `User ${index + 1}`,
  balanceETH: 0,
  balanceToken: 0,
  balanceNFT: [],
  balanceCollateral: 0,
  borrowedAmount: 0,
  healthFactor: 999,
  lpTokens: 0,
  votingPower: 0,
  stakedAmount: 0,
});

export const defaultPool = (): PoolState => ({
  totalDeposited: 0, totalBorrowed: 0, utilizationRate: 0,
  collateralPrice: 1000, liquidationThreshold: 0.8,
  interestRate: 5, tokenTotalSupply: 0, oraclePrice: 1000,
  reserveA: 100000, reserveB: 100000, lpTotalSupply: 0,
  nftTotalSupply: 0, floorPrice: 0.1,
  totalVotingPower: 0, proposalCount: 0,
});