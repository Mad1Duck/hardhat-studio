// 
//  LICENSE MODULE — public API
//  Import everything from here, not from sub-files directly.
//
//  Usage:
//    import { LicenseProvider, useLicense, PLAN_CONFIG, planDailyUSD } from '@/license'
// 


// Provider + hook
export { LicenseProvider, useLicense } from './LicenseProvider';

// Types
export type {
  Plan,
  Status,
  Feature,
  LogLevel,
  LogEntry,
  ActiveStream,
  LicenseContextType,
} from './types';

// Plan config (pricing, feature tiers, detection)
export {
  IS_TESTNET_MODE,
  IS_DEV_UNLOCK,
  RECIPIENT_ADDRESS,
  STREAM_POLL_INTERVAL_MS,
  PLAN_CONFIG,
  PLAN_FREE_META,
  PLAN_META,          // ← backward-compat alias
  PLAN_MIN_DEPOSIT,   // ← backward-compat alias
  FEATURE_TIERS,
  ALLOWED_TOKENS,
  TIME,
  detectPlan,
  isTokenAllowed,
  planDailyUSD,
  planWeeklyUSD,
  planYearlyUSD,
  planMinRatePerSecond,
} from './config/planConfig';

// Chain config
export {
  CHAIN_NAMES,
  SABLIER_FLOW_CONTRACTS,
  ENVIO_FLOW_ENDPOINT,
  THEGRAPH_ENDPOINTS,
  addCustomChain,
} from './config/chainConfig';

// Contract utils (useful for external tx builders)
export {
  encodePause,
  encodeRestart,
  verifyStreamOnChain,
  parseStreamNumericId,
} from './lib/contractUtils';

// Token price
export { fetchTokenPrice } from './lib/tokenPrice';

// Discord role bypass
export {
  resolveMatchedRules,
  clearRoleCache,
  getHighestPlan,
} from '@/integrations/discord/libs/discord.role.lib';

export {
  DISCORD_RULES,
  type DiscordRuleEntry,
} from '@/integrations/discord/config/discord.config';

export { getDiscordBypassPlan } from '@/integrations/discord/config/discord.config';

// Components
export { LicenseGate } from './components/LicenseGate';
export { LicenseModal } from './components/LicenseModal';
export { LicenseBadge } from './components/LicenseBadge';