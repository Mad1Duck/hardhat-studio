// 
//  PLAN CONFIG — edit this file to configure your subscription tiers
//
//  Pricing is set in USD per MONTH.
//  The system automatically converts to rate-per-second for stream matching.
//
//  ENV overrides (optional, in your .env):
//    VITE_BASIC_PLAN_USD=9      → override basic monthly price
//    VITE_PRO_PLAN_USD=15       → override pro monthly price
//    VITE_POLL_INTERVAL_SECONDS=60
//    VITE_ALLOWED_TOKENS=WETH,USDC,USDT,DAI
//    VITE_RECIPIENT_ADDRESS=0x...
//    VITE_NODE_ENV=development  → enables testnet mode
//    VITE_DEV_UNLOCK=true       → unlock all features (dev bypass)
// 

import type { Plan, Feature } from '../types';

//  Environment flags 
export const IS_TESTNET_MODE = import.meta.env.VITE_NODE_ENV === 'development';
export const IS_DEV_UNLOCK = import.meta.env.VITE_DEV_UNLOCK === 'true';

//  Recipient wallet (who receives the stream payment) 
export const RECIPIENT_ADDRESS: string = import.meta.env.VITE_RECIPIENT_ADDRESS ?? '';

//  Polling interval 
export const STREAM_POLL_INTERVAL_MS = (() => {
  const v = Number(import.meta.env.VITE_POLL_INTERVAL_SECONDS ?? 60);
  return Math.max(10, isNaN(v) ? 60 : v) * 1000;
})();

// 
//  PLAN PRICING
//  Expressed in USD/month. The system computes ratePerSecond from this.
//
//  Time reference constants:
//    SECONDS_PER_DAY   = 86_400
//    SECONDS_PER_WEEK  = 604_800
//    SECONDS_PER_MONTH = 2_592_000  (30 days)
//    SECONDS_PER_YEAR  = 31_536_000 (365 days)
//
//  Rate conversion helpers are exported below so UI components can show
//  "Basic = $0.30/day" or "Pro = $0.50/day" etc.
// 

export const TIME = {
  SECONDS_PER_DAY: 86_400,
  SECONDS_PER_WEEK: 604_800,
  SECONDS_PER_MONTH: 2_592_000, // 30 days
  SECONDS_PER_YEAR: 31_536_000,
} as const;

/**
 * PlanPricing — one entry per plan tier.
 *
 * Fields:
 *  - monthlyUSD   : minimum monthly payment in USD to activate this tier
 *  - label        : display name
 *  - desc         : short feature description
 *  - color        : Tailwind text color class
 *  - highlight    : hex accent for badges / borders
 */
export interface PlanPricing {
  monthlyUSD: number;
  label: string;
  desc: string;
  color: string;
  highlight: string;
}

//  Default plan prices (overridable from .env) 
const _basicUSD = (() => {
  const env = Number(import.meta.env.VITE_BASIC_PLAN_USD);
  if (!isNaN(env) && env > 0) return env;
  return IS_TESTNET_MODE ? 0.01 : 9;
})();

const _proUSD = (() => {
  const env = Number(import.meta.env.VITE_PRO_PLAN_USD);
  if (!isNaN(env) && env > 0) return env;
  return IS_TESTNET_MODE ? 0.02 : 15;
})();

export const PLAN_CONFIG: Record<Exclude<Plan, 'free'>, PlanPricing> = {
  basic: {
    monthlyUSD: _basicUSD,
    label: 'Basic',
    desc: 'Tools & Analysis',
    color: 'text-blue-400',
    highlight: '#60a5fa',
  },
  pro: {
    monthlyUSD: _proUSD,
    label: 'Pro',
    desc: 'Advanced + DeFi',
    color: 'text-violet-400',
    highlight: '#a78bfa',
  },
};

export const PLAN_FREE_META = {
  label: 'Free',
  desc: 'Basic tools',
  color: 'text-muted-foreground',
  highlight: '#9ca3af',
};

//  Rate helpers (computed from plan prices) 

/** USD per day for a given plan. */
export function planDailyUSD(plan: Exclude<Plan, 'free'>): number {
  return PLAN_CONFIG[plan].monthlyUSD / 30;
}

/** USD per week for a given plan. */
export function planWeeklyUSD(plan: Exclude<Plan, 'free'>): number {
  return PLAN_CONFIG[plan].monthlyUSD / 4;
}

/** USD per year for a given plan. */
export function planYearlyUSD(plan: Exclude<Plan, 'free'>): number {
  return PLAN_CONFIG[plan].monthlyUSD * 12;
}

/**
 * Minimum stream ratePerSecond in USD to qualify for a plan.
 * Used when comparing a stream's actual rate against the required threshold.
 */
export function planMinRatePerSecond(plan: Exclude<Plan, 'free'>): number {
  return PLAN_CONFIG[plan].monthlyUSD / TIME.SECONDS_PER_MONTH;
}

/**
 * detectPlan — given the stream's monthly USD value, return the correct Plan.
 */
export function detectPlan(monthlyUSD: number): Plan {
  if (monthlyUSD >= PLAN_CONFIG.pro.monthlyUSD) return 'pro';
  if (monthlyUSD >= PLAN_CONFIG.basic.monthlyUSD) return 'basic';
  return 'free';
}
//  Token allowlist 

/**
 * ALLOWED_TOKENS — symbols or addresses that count as valid payment.
 * Set VITE_ALLOWED_TOKENS=WETH,USDC,USDT,DAI in your .env.
 * If empty → ALL tokens accepted.
 */
export const ALLOWED_TOKENS: string[] = (() => {
  const raw = import.meta.env.VITE_ALLOWED_TOKENS ?? '';
  return raw
    .split(',')
    .map((t: string) => t.trim().toLowerCase())
    .filter(Boolean);
})();

export function isTokenAllowed(symbolOrAddress: string): boolean {
  if (ALLOWED_TOKENS.length === 0) return true;
  return ALLOWED_TOKENS.some((t) => t === symbolOrAddress.toLowerCase());
}

//  Backward-compatible aliases (used by UI components) 

/** PLAN_MIN_DEPOSIT — legacy alias, keeps existing UI imports working. */
export const PLAN_MIN_DEPOSIT = {
  basic: _basicUSD,
  pro: _proUSD,
} as const;

/**
 * PLAN_META — flat display metadata for all 3 plans (free + paid).
 * Matches the original shape: { label, price, desc, color }
 */
export const PLAN_META: Record<Plan, { label: string; price: string; desc: string; color: string; }> = {
  free: {
    label: 'Free',
    price: '0',
    desc: 'Basic tools',
    color: 'text-muted-foreground',
  },
  basic: {
    label: 'Basic',
    price: String(_basicUSD),
    desc: 'Tools & Analysis',
    color: 'text-blue-400',
  },
  pro: {
    label: 'Pro',
    price: String(_proUSD),
    desc: 'Advanced + DeFi',
    color: 'text-violet-400',
  },
};

//  Feature → Plan mapping 

export const FEATURE_TIERS: Record<Feature, Plan> = {
  // Free
  accounts: 'free',
  environment: 'free',
  git: 'free',
  docs: 'free',
  notes: 'free',
  debug: 'free',
  erc_standards: 'free',
  block_explorer: 'free',
  // Basic
  security: 'basic',
  gas_profiler: 'basic',
  opcode_viewer: 'basic',
  snapshots: 'basic',
  erc20_reader: 'basic',
  nft_viewer: 'basic',
  verify_contract: 'basic',
  audit_notes: 'basic',
  // Pro
  contract_graph: 'pro',
  tx_graph: 'pro',
  analytics: 'pro',
  simulation_lab: 'pro',
  lp_simulator: 'pro',
  scenario_builder: 'pro',
  frontend_helper: 'pro',
  abi_compat: 'pro',
  event_schema: 'pro',
};