// 
//  LICENSE MODULE — public API
//  Import everything from here, not from sub-files directly.
//
//  Usage:
//    import { LicenseProvider, useLicense, PLAN_CONFIG, planDailyUSD } from '@/license'
// 

// Provider + hook
export { LicenseProvider, useLicense } from '@/integrations/license/LicenseProvider';

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
  FEATURE_TIERS,
  ALLOWED_TOKENS,
  TIME,
  detectPlan,
  isTokenAllowed,
  planDailyUSD,
  planWeeklyUSD,
  planYearlyUSD,
  planMinRatePerSecond,
  PLAN_MIN_DEPOSIT,
  PLAN_META
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

// Components
export { LicenseGate } from './components/LicenseGate';
export { LicenseModal } from './components/LicenseModal';
export { LicenseBadge } from './components/LicenseBadge';