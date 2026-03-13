import { NodeType as NodeDataFlow } from '../types';

export const NODE_TYPE_STYLE: Record<NodeDataFlow, { bg: string; border: string; glow: string; icon: string; }> = {
  wallet: { bg: '#1c1404', border: '#f59e0b', glow: '#f59e0b40', icon: '◉' },
  contract: { bg: '#030e1f', border: '#3b82f6', glow: '#3b82f640', icon: '⬡' },
  miner: { bg: '#031a0f', border: '#10b981', glow: '#10b98140', icon: '⛏' },
  external: { bg: '#130b1f', border: '#8b5cf6', glow: '#8b5cf640', icon: '◈' },
};
