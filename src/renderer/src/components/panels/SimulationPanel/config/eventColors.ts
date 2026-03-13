import { SimEventType } from '../../modules/Simulation/types';

export const EVENT_COLOR: Partial<Record<SimEventType, string>> = {
  deposit: 'text-emerald-400',
  borrow: 'text-amber-400',
  repay: 'text-sky-400',
  liquidate: 'text-rose-400',
  mint: 'text-violet-400',
  burn: 'text-orange-400',
  transfer: 'text-blue-400',
  approve: 'text-teal-400',
  swap: 'text-cyan-400',
  addLiq: 'text-emerald-300',
  removeLiq: 'text-orange-300',
  flashloan: 'text-pink-400',
  price: 'text-yellow-400',
  oracle: 'text-yellow-300',
  nft_mint: 'text-violet-300',
  nft_transfer: 'text-indigo-400',
  nft_list: 'text-blue-300',
  nft_sale: 'text-green-400',
  nft_bid: 'text-pink-300',
  vote: 'text-indigo-400',
  propose: 'text-violet-400',
  execute: 'text-green-400',
  attack: 'text-red-400',
  upgrade: 'text-teal-400',
  bridge: 'text-sky-300',
  mev: 'text-amber-500',
  gas: 'text-slate-400',
  block: 'text-slate-300',
  vest: 'text-purple-400',
  airdrop: 'text-violet-300',
  info: 'text-muted-foreground',
  warn: 'text-amber-400',
  error: 'text-rose-500',
  success: 'text-emerald-400',
};

// ERC20 token-amount function names — these args should be scaled by decimals
export const TOKEN_AMOUNT_FNS = new Set([
  'mint', 'burn', 'transfer', 'transferFrom', 'approve',
  'deposit', 'withdraw', 'stake', 'unstake', 'repay', 'borrow',
]);

// Arg indices that carry token amounts (for each function)
export const TOKEN_AMOUNT_ARGS: Record<string, number[]> = {
  mint: [1],
  burn: [0],
  transfer: [1],
  transferFrom: [2],
  approve: [1],
  deposit: [0],
  withdraw: [0],
  stake: [0],
  unstake: [0],
  repay: [0],
  borrow: [0],
};
