import type { ActionType } from '../types';

export interface ActionMeta {
  id: ActionType;
  icon: string;
  label: string;
  color: string;
  bg: string;
  border: string;
  group: string;
  desc: string;
}

export const ACTIONS: ActionMeta[] = [
  { id: 'call',          icon: '⚡',  label: 'Call (read)',    color: '#38bdf8', bg: '#0c1a2e', border: '#0ea5e9', group: 'contract', desc: 'Read data from contract (view/pure)' },
  { id: 'send',          icon: '📤',  label: 'Send Tx',        color: '#34d399', bg: '#0a1f16', border: '#10b981', group: 'contract', desc: 'Write transaction to contract' },
  { id: 'assert',        icon: '✅',  label: 'Assert Equal',   color: '#4ade80', bg: '#0a1a0a', border: '#22c55e', group: 'test',     desc: 'Assert a return value equals expected' },
  { id: 'assert_revert', icon: '💥',  label: 'Assert Revert',  color: '#fb923c', bg: '#1f0e00', border: '#f97316', group: 'test',     desc: 'Assert a tx reverts with message' },
  { id: 'wait',          icon: '⛏️', label: 'Mine Blocks',    color: '#fbbf24', bg: '#1a1200', border: '#f59e0b', group: 'chain',    desc: 'Mine N blocks on local chain' },
  { id: 'timeout',       icon: '⏱️', label: 'Sleep',          color: '#c084fc', bg: '#150a24', border: '#a855f7', group: 'chain',    desc: 'Pause execution for N milliseconds' },
  { id: 'snapshot',      icon: '📸',  label: 'Snapshot',       color: '#22d3ee', bg: '#001a1f', border: '#06b6d4', group: 'chain',    desc: 'Save EVM state snapshot ID' },
  { id: 'revert',        icon: '⏪',  label: 'Revert Snap',    color: '#f472b6', bg: '#1f0015', border: '#ec4899', group: 'chain',    desc: 'Revert EVM to a snapshot ID' },
  { id: 'impersonate',   icon: '🎭',  label: 'Impersonate',    color: '#818cf8', bg: '#0d0f24', border: '#6366f1', group: 'chain',    desc: 'Impersonate an address (Hardhat only)' },
  { id: 'set_balance',   icon: '💰',  label: 'Set Balance',    color: '#fde68a', bg: '#1a1400', border: '#fcd34d', group: 'chain',    desc: 'Set ETH balance for an address' },
  { id: 'log',           icon: '📝',  label: 'Log',            color: '#94a3b8', bg: '#0f1520', border: '#334155', group: 'util',     desc: 'Print a message to the run log' },
  { id: 'custom_script', icon: '🧩',  label: 'Custom Script',  color: '#f472b6', bg: '#1f0d18', border: '#ec4899', group: 'util',     desc: 'Run arbitrary JS with ethers + contracts' },
];

export const ACTION_GROUPS = ['contract', 'test', 'chain', 'util'] as const;

export const GROUP_LABELS: Record<string, string> = {
  contract: '📄 Contract',
  test:     '🧪 Test',
  chain:    '⛓ Chain',
  util:     '🔧 Util',
};
