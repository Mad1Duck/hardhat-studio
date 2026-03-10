// 
//  SABLIER UI — Shared constants & tiny helpers
// 
import type { LogLevel, Plan } from '@/integrations/license';

export const LOG_STYLE: Record<LogLevel, { dot: string; text: string; label: string; }> = {
  info: { dot: 'bg-sky-400', text: 'text-sky-300', label: 'INFO' },
  success: { dot: 'bg-emerald-400', text: 'text-emerald-300', label: 'OK  ' },
  warn: { dot: 'bg-amber-400', text: 'text-amber-300', label: 'WARN' },
  error: { dot: 'bg-red-400', text: 'text-red-300', label: 'ERR ' },
  debug: { dot: 'bg-violet-400', text: 'text-violet-300', label: 'DBG ' },
};

export const CHAIN_ICONS: Record<number, string> = {
  1: '🔵',
  137: '🟣',
  42161: '🔷',
  56: '🟡',
  10: '🔴',
  8453: '🟦',
  10143: '⚫',
  11155111: '🧪',
  84532: '🧪',
  421614: '🧪',
  11155420: '🧪',
};

export const TESTNET_IDS = new Set([11155111, 84532, 421614, 11155420]);

/** Plan accent colors for inline styles (tooltip uses raw CSS, not Tailwind). */
export const PLAN_ACCENT: Record<Plan, { color: string; border: string; gradient: string; bg: string; }> = {
  free: {
    color: '#6ee7b7',
    border: 'rgba(110,231,183,0.2)',
    gradient: 'rgba(110,231,183,0.6)',
    bg: 'rgba(110,231,183,0.05)',
  },
  basic: {
    color: '#60a5fa',
    border: 'rgba(96,165,250,0.2)',
    gradient: 'rgba(96,165,250,0.6)',
    bg: 'rgba(96,165,250,0.05)',
  },
  pro: {
    color: '#a78bfa',
    border: 'rgba(167,139,250,0.2)',
    gradient: 'rgba(167,139,250,0.6)',
    bg: 'rgba(167,139,250,0.05)',
  },
};

export const fmt = {
  addr: (a: string) => `${a?.slice(0, 6)}…${a?.slice(-4)}`,
  date: (ts: number) =>
    new Date(ts * 1000).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric',
    }),
  usd: (raw: string, dec = 6) => {
    const n = Number(raw) / 10 ** dec;
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },
  usdNum: (n: number) =>
    n < 0.001
      ? '<$0.001'
      : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  token: (n: number, sym: string) => {
    const s = n < 0.00001
      ? n.toExponential(3)
      : n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
    return `${s} ${sym}`;
  },
};

/** Open Sablier app — respects Electron's api.openExternal if available. */
export function openSablier() {
  if ((window as any).api?.openExternal) {
    (window as any).api.openExternal('https://app.sablier.com');
  } else {
    window.open('https://app.sablier.com', '_blank');
  }
}

/** Feature group metadata for the Plans tab. */
export const FEATURE_GROUPS = [
  {
    label: 'Free — Selalu Tersedia',
    items: [
      { feature: 'accounts' as const, label: 'Accounts & Wallets' },
      { feature: 'environment' as const, label: 'Environment (.env)' },
      { feature: 'git' as const, label: 'Git Integration' },
      { feature: 'docs' as const, label: 'Documentation' },
      { feature: 'notes' as const, label: 'Notes Editor' },
      { feature: 'debug' as const, label: 'Debug & Logs' },
      { feature: 'erc_standards' as const, label: 'ERC Standards' },
      { feature: 'block_explorer' as const, label: 'Block Explorer' },
    ],
  },
  {
    label: 'Basic — Tools & Analysis',
    items: [
      { feature: 'security' as const, label: 'Security Audit' },
      { feature: 'gas_profiler' as const, label: 'Gas Profiler' },
      { feature: 'opcode_viewer' as const, label: 'Opcode Viewer' },
      { feature: 'snapshots' as const, label: 'EVM Snapshots' },
      { feature: 'erc20_reader' as const, label: 'ERC-20 Reader' },
      { feature: 'nft_viewer' as const, label: 'NFT Viewer' },
      { feature: 'verify_contract' as const, label: 'Verify Contract' },
      { feature: 'audit_notes' as const, label: 'Audit Notes' },
    ],
  },
  {
    label: 'Pro — Advanced + DeFi',
    items: [
      { feature: 'contract_graph' as const, label: 'Contract Graph' },
      { feature: 'tx_graph' as const, label: 'Transaction Graph' },
      { feature: 'analytics' as const, label: 'Analytics Dashboard' },
      { feature: 'simulation_lab' as const, label: 'Simulation Lab' },
      { feature: 'lp_simulator' as const, label: 'LP Simulator' },
      { feature: 'scenario_builder' as const, label: 'Scenario Builder' },
      { feature: 'frontend_helper' as const, label: 'Frontend Helper' },
      { feature: 'abi_compat' as const, label: 'ABI Compatibility' },
      { feature: 'event_schema' as const, label: 'Event Schema' },
    ],
  },
] as const;
