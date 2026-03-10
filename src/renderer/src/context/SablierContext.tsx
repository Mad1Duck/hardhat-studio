import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from 'react';

// Poll interval: configurable via VITE_POLL_INTERVAL_SECONDS (default 60)
const STREAM_POLL_INTERVAL_MS = (() => {
  const v = Number(import.meta.env.VITE_POLL_INTERVAL_SECONDS ?? 60);
  return Math.max(10, isNaN(v) ? 60 : v) * 1000;
})();

export const RECIPIENT_ADDRESS = import.meta.env.VITE_RECIPIENT_ADDRESS;

export const IS_TESTNET_MODE = import.meta.env.VITE_NODE_ENV === 'development';

// Plan thresholds: configurable via VITE_BASIC_PLAN_USD / VITE_PRO_PLAN_USD
// In testnet mode: default $0.01 / $0.02 (tiny, for testing)
// In production:   default $9.99 / $29.99
export const PLAN_MIN_DEPOSIT = (() => {
  const basic = Number(import.meta.env.VITE_BASIC_PLAN_USD ?? (IS_TESTNET_MODE ? 0.01 : 9.99));
  const pro = Number(import.meta.env.VITE_PRO_PLAN_USD ?? (IS_TESTNET_MODE ? 0.02 : 29.99));
  return {
    basic: isNaN(basic) ? (IS_TESTNET_MODE ? 0.01 : 9.99) : basic,
    pro: isNaN(pro) ? (IS_TESTNET_MODE ? 0.02 : 29.99) : pro,
  };
})();

/**
 * ALLOWED_TOKENS — token symbols or addresses that count as valid payment.
 * Set in .env:  VITE_ALLOWED_TOKENS=WETH,USDC,USDT,DAI
 * If empty/unset → ALL tokens accepted.
 */
export const ALLOWED_TOKENS: string[] = (() => {
  const raw = import.meta.env.VITE_ALLOWED_TOKENS ?? '';
  return raw
    .split(',')
    .map((t: string) => t.trim().toLowerCase())
    .filter(Boolean);
})();

// Runtime-mutable custom endpoints (user can add their own chains)
export const CUSTOM_ENDPOINTS: Record<number, string> = {};
export const CUSTOM_CHAIN_NAMES: Record<number, string> = {};

export function addCustomChain(chainId: number, name: string, graphEndpoint: string) {
  CUSTOM_ENDPOINTS[chainId] = graphEndpoint;
  CUSTOM_CHAIN_NAMES[chainId] = name;
  // Merge into main maps
  (THEGRAPH_ENDPOINTS as any)[chainId] = graphEndpoint;
  (CHAIN_NAMES as any)[chainId] = name;
}

export function isTokenAllowed(symbolOrAddress: string): boolean {
  if (ALLOWED_TOKENS.length === 0) return true; // no restriction
  const lower = symbolOrAddress.toLowerCase();
  return ALLOWED_TOKENS.some((t) => t === lower);
}

/* 
   SABLIER FLOW SUBGRAPH ENDPOINTS (TheGraph Studio)
   
   Stream #FL3-11155111-163 → prefix FL3 = SablierFlow v1.1
   This is the FLOW protocol (open-ended payment streams),
   NOT Lockup (time-locked vesting streams).
   
   Flow subgraph naming pattern: "sablier-flow-{chain}"
   Query ID: 112500 (same Sablier org account on TheGraph Studio)
   
   No API key needed (testing URLs), rate-limited 3000 queries/day.
   https://docs.sablier.com/api/flow/indexers#the-graph
 */

// Envio: single multi-chain endpoint for ALL Flow streams (primary, most reliable)
// Source: https://docs.sablier.com/api/flow/envio/endpoints
export const ENVIO_FLOW_ENDPOINT = 'https://indexer.hyperindex.xyz/a0b4e0b/v1/graphql';

// The Graph: per-chain endpoints (fallback)
// Query ID 112500 = Flow subgraphs. 57079 = Lockup/Legacy (WRONG for Flow!)
// Source: https://docs.sablier.com/api/flow/the-graph/endpoints
export const THEGRAPH_ENDPOINTS: Record<number, string> = {
  // Mainnets
  1: 'https://api.studio.thegraph.com/query/112500/sablier-flow-ethereum/version/latest',
  137: 'https://api.studio.thegraph.com/query/112500/sablier-flow-polygon/version/latest',
  42161: 'https://api.studio.thegraph.com/query/112500/sablier-flow-arbitrum/version/latest',
  56: 'https://api.studio.thegraph.com/query/112500/sablier-flow-bsc/version/latest',
  10: 'https://api.studio.thegraph.com/query/112500/sablier-flow-optimism/version/latest',
  8453: 'https://api.studio.thegraph.com/query/112500/sablier-flow-base/version/latest',
  43114: 'https://api.studio.thegraph.com/query/112500/sablier-flow-avalanche/version/latest',
  534352: 'https://api.studio.thegraph.com/query/112500/sablier-flow-scroll/version/latest',
  100: 'https://api.studio.thegraph.com/query/112500/sablier-flow-gnosis/version/latest',
  59144: 'https://api.studio.thegraph.com/query/112500/sablier-flow-linea/version/latest',
  146: 'https://api.studio.thegraph.com/query/112500/sablier-flow-sonic/version/latest',
  // Testnets
  11155111: 'https://api.studio.thegraph.com/query/112500/sablier-flow-sepolia/version/latest',
  84532: 'https://api.studio.thegraph.com/query/112500/sablier-flow-base-sepolia/version/latest',
  421614:
    'https://api.studio.thegraph.com/query/112500/sablier-flow-arbitrum-sepolia/version/latest',
  11155420:
    'https://api.studio.thegraph.com/query/112500/sablier-flow-optimism-sepolia/version/latest',
};

/* 
   TYPES
 */

export type Plan = 'free' | 'basic' | 'pro';
export type Status = 'loading' | 'free' | 'basic' | 'pro' | 'dev' | 'no_wallet' | 'debt' | 'paused';

export type Feature =
  | 'accounts'
  | 'environment'
  | 'git'
  | 'docs'
  | 'notes'
  | 'debug'
  | 'erc_standards'
  | 'block_explorer'
  | 'security'
  | 'gas_profiler'
  | 'opcode_viewer'
  | 'snapshots'
  | 'erc20_reader'
  | 'nft_viewer'
  | 'verify_contract'
  | 'audit_notes'
  | 'contract_graph'
  | 'tx_graph'
  | 'analytics'
  | 'simulation_lab'
  | 'lp_simulator'
  | 'scenario_builder'
  | 'frontend_helper'
  | 'abi_compat'
  | 'event_schema';

export const FEATURE_TIERS: Record<Feature, Plan> = {
  accounts: 'free',
  environment: 'free',
  git: 'free',
  docs: 'free',
  notes: 'free',
  debug: 'free',
  erc_standards: 'free',
  block_explorer: 'free',
  security: 'basic',
  gas_profiler: 'basic',
  opcode_viewer: 'basic',
  snapshots: 'basic',
  erc20_reader: 'basic',
  nft_viewer: 'basic',
  verify_contract: 'basic',
  audit_notes: 'basic',
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

export const PLAN_META = {
  free: { label: 'Free', price: '0', desc: 'Basic tools', color: 'text-muted-foreground' },
  basic: { label: 'Basic', price: '9.99', desc: 'Tools & Analysis', color: 'text-blue-400' },
  pro: { label: 'Pro', price: '29.99', desc: 'Advanced + DeFi', color: 'text-violet-400' },
};

/* 
   LOG TYPES
 */

export type LogLevel = 'info' | 'success' | 'warn' | 'error' | 'debug';

export type LogEntry = {
  id: string;
  ts: number;
  level: LogLevel;
  msg: string;
  data?: unknown;
};

/* 
   STREAM TYPE
 */

export type ActiveStream = {
  streamId: string; // subgraph ID (e.g. "0xabc...def-163")
  streamAlias: string; // human alias (e.g. "FL3-11155111-163")
  sender: string;
  tokenSymbol: string;
  tokenAddress: string;
  tokenDecimals: number;
  chainId: number;
  chainName: string;
  ratePerSecond: string;
  // Deposit/balance fields (raw BigInt strings, token-decimals)
  balance: string; // remaining tokens in stream (net deposits - withdrawn)
  totalStreamed: string; // total ever streamed (withdrawnAmount)
  netDeposited: string; // total net deposits ever made (depositedAmount from subgraph)
  depositAmount: string; // alias for netDeposited (display compat)
  withdrawnAmount: string; // alias for totalStreamed (display compat)
  // Debt: stream ran dry — sender owes tokens → features LOCKED
  // NOTE: We cannot accurately compute debt from subgraph alone (we don't know
  // exact time of last top-up). hasDebt=true only if balance=0 AND rate>0 AND paused=false.
  hasDebt: boolean;
  debtRaw: string; // raw BigInt string of debt estimate
  // Timestamps
  startTime: number;
  lastAdjustmentTime: number;
  // Status
  paused: boolean;
  endTime: number; // synthesized: now + (balance / ratePerSecond)
};

/* 
   CONTEXT TYPE
 */

type LicenseContextType = {
  status: Status;
  walletAddress?: string;
  chainId?: number;
  chainName?: string;
  currentPlan: Plan;
  activeStream?: ActiveStream;
  // Multi-stream support
  availableStreams: ActiveStream[]; // all valid streams for this recipient
  selectedStreamId: string | null; // streamId of user-selected stream
  selectStream: (streamId: string) => void; // switch active stream
  error?: string;
  isDev: boolean;
  logs: LogEntry[];
  lastChecked?: number;
  streamRevoked: boolean;
  tokenPrice: number | null; // cached CoinGecko price

  selectedChainId: number | null;
  setSelectedChainId: (id: number | null) => void;

  connect: (addr: string, chainId: number) => Promise<void>;
  disconnect: () => void;
  logout: () => void;
  refresh: () => Promise<void>;
  clearLogs: () => void;
  pauseStream: () => Promise<void>;
  resumeStream: () => Promise<void>;
  streamActionPending: boolean;
  // Stream selection
  applyStreamStatus: (stream: ActiveStream) => Promise<void>;

  can: (feature: Feature) => boolean;
  planFor: (feature: Feature) => Plan;
};

const LicenseContext = createContext<LicenseContextType | null>(null);

/* 
   CHAIN NAME MAP
 */

export const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  137: 'Polygon',
  42161: 'Arbitrum',
  56: 'BNB Chain',
  10: 'Optimism',
  8453: 'Base',
  10143: 'Monad',
  11155111: 'Sepolia',
  84532: 'Base Sepolia',
  421614: 'Arbitrum Sepolia',
  11155420: 'Optimism Sepolia',
};

/* 
   TOKEN PRICE
 */

// CoinGecko price cache: symbol → { price, fetchedAt }
const _priceCache: Record<string, { price: number; fetchedAt: number }> = {};
const PRICE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function fetchTokenPrice(symbol: string, forceRefresh = false): Promise<number | null> {
  const sym = symbol.toUpperCase();
  // Stablecoins: always $1
  if (['USDC', 'USDT', 'DAI', 'LUSD', 'FRAX', 'USDS', 'GUSD'].includes(sym)) return 1;

  const cached = _priceCache[sym];
  if (!forceRefresh && cached && Date.now() - cached.fetchedAt < PRICE_CACHE_TTL_MS) {
    return cached.price;
  }

  try {
    const coinId =
      sym === 'WETH'
        ? 'ethereum'
        : sym === 'WBTC'
          ? 'wrapped-bitcoin'
          : sym === 'LINK'
            ? 'chainlink'
            : sym === 'UNI'
              ? 'uniswap'
              : sym === 'AAVE'
                ? 'aave'
                : sym === 'MKR'
                  ? 'maker'
                  : sym === 'SNX'
                    ? 'havven'
                    : sym === 'CRV'
                      ? 'curve-dao-token'
                      : sym === 'LDO'
                        ? 'lido-dao'
                        : sym === 'RPL'
                          ? 'rocket-pool'
                          : sym === 'ENS'
                            ? 'ethereum-name-service'
                            : symbol.toLowerCase();

    const r = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`,
      { signal: AbortSignal.timeout(8000) },
    );
    const j = await r.json();
    const price = j[coinId]?.usd ?? null;
    if (price != null) _priceCache[sym] = { price, fetchedAt: Date.now() };
    return price;
  } catch {
    return cached?.price ?? null; // return stale cache on error
  }
}

/* 
   PLAN DETECTION
 */

function detectPlan(monthlyUSD: number): Plan {
  if (monthlyUSD >= PLAN_MIN_DEPOSIT.pro) return 'pro';
  if (monthlyUSD >= PLAN_MIN_DEPOSIT.basic) return 'basic';
  return 'free';
}

const INTROSPECT_QUERY = /* graphql */ `
  query {
    __type(name: "Stream") {
      fields {
        name
        type { name kind ofType { name kind } }
      }
    }
  }
`;

/* 
  We use a cascading query strategy to handle all subgraph versions:
  
  Flow v1.0 (FL)  — uses "token", has "snapshotTime", "depositedAmount"  
  Flow v1.1 (FL2) — same as v1.0
  Flow v2.0 (FL3) — uses "token", may rename fields
  
  We try queries from most-fields → least-fields, stopping at first success.
  "snapshotTime" is optional (not in all deployments) so we handle its absence.
*/

// Query A: Full fields (most modern subgraphs)
const STREAMS_QUERY_FULL = /* graphql */ `
  query GetStreams($sender: String!) {
    streams(
      where: { sender: $sender }
      orderBy: timestamp
      orderDirection: desc
      first: 50
    ) {
      id
      alias
      sender
      recipient
      paused
      ratePerSecond
      withdrawnAmount
      depositedAmount
      startTime
      timestamp
      token {
        id
        symbol
        decimals
        name
      }
    }
  }
`;

// Query B: Without depositedAmount (some older deployments)
const STREAMS_QUERY_NO_DEPOSIT = /* graphql */ `
  query GetStreamsNoDeposit($sender: String!) {
    streams(
      where: { sender: $sender }
      orderBy: timestamp
      orderDirection: desc
      first: 50
    ) {
      id
      alias
      sender
      recipient
      paused
      ratePerSecond
      withdrawnAmount
      startTime
      timestamp
      token {
        id
        symbol
        decimals
        name
      }
    }
  }
`;

// Query C: Fallback "asset" field (Flow v1.0 / legacy)
const STREAMS_QUERY_ASSET = /* graphql */ `
  query GetStreamsAsset($sender: String!) {
    streams(
      where: { sender: $sender }
      orderBy: timestamp
      orderDirection: desc
      first: 50
    ) {
      id
      alias
      sender
      recipient
      paused
      ratePerSecond
      withdrawnAmount
      startTime
      timestamp
      asset {
        id
        symbol
        decimals
      }
    }
  }
`;

// Keep STREAMS_QUERY_THEGRAPH and STREAMS_QUERY_FALLBACK as aliases for compatibility
const STREAMS_QUERY_THEGRAPH = STREAMS_QUERY_FULL;
const STREAMS_QUERY_FALLBACK = STREAMS_QUERY_ASSET;

type QueryResult = {
  streams: ActiveStream[]; // ALL valid streams for this recipient (not just one)
  logs: LogEntry[];
};

/* ─────────────────────────────────────────────────────────────────────────────
   SABLIER FLOW v2.0 — Contract Addresses & ABI Helpers
   Source: docs.sablier.com/guides/flow/deployments  (FL3 = v2.0)
   The SENDER (wallet that created the stream) can pause/restart.
   ───────────────────────────────────────────────────────────────────────────── */

export const SABLIER_FLOW_CONTRACTS: Record<number, string> = {
  // ── Mainnets ───────────────────────────────────────────────────────────────
  1: '0x7a86d3e6894f9c5b5f25ffbdaae658cfc7569623', // Ethereum
  137: '0x62b6d5a3ac0cc91ecebd019d1c70fe955d8c7426', // Polygon
  42161: '0xf0f6477422a346378458f73cf02f05a7492e0c25', // Arbitrum
  8453: '0x8551208f75375abfaee1fbe0a69e390a94000ec2', // Base
  10: '0xd18491649440d6338532f260761cee64e79d7bb2', // OP Mainnet
  56: '0x5505c2397B0BeBEEE64919F21Df84F83C008C51b', // BNB Chain
  43114: '0x64dc318ba879eca8222e963d319728f211c600c7', // Avalanche
  534352: '0xc3e92b9714ed01b51fdc29bb88b17af5cddd2c22', // Scroll
  100: '0xcdd3eb5283e4a675f16ba83e9d8c28c871a550a2', // Gnosis
  59144: '0x977FDf70abeD6b60eECcee85322beA4575B0b6Ed', // Linea
  146: '0x3954146884425accb86a6476dad69ec3591838cd', // Sonic
  // ── Testnets ───────────────────────────────────────────────────────────────
  11155111: '0xde489096eC9C718358c52a8BBe4ffD74857356e9', // Sepolia ✅
  84532: '0x19e99dcdbaf2fbf43c60cfd026d571860da29d43', // Base Sepolia
  421614: '0x73a474c9995b659bc4736486f25501e0a4a671ed', // Arbitrum Sepolia
  11155420: '0x4cc7b50b0856c607edee0b6547221360e82e768c', // OP Sepolia
};

// ── Function selectors (keccak256 of ABI signature, first 4 bytes) ──────────
const SEL_PAUSE = '0xf7888aec'; // pause(uint256)
const SEL_RESTART = '0x5bcb2fc6'; // restart(uint256,uint128)
const SEL_OWNER_OF = '0x6352211e'; // ownerOf(uint256) — ERC-721, stream NFT owner = recipient

function encodeUint256(n: number | bigint): string {
  return BigInt(n).toString(16).padStart(64, '0');
}

export function encodePause(numericId: number): string {
  return SEL_PAUSE + encodeUint256(numericId);
}

export function encodeRestart(numericId: number, ratePerSecond: string): string {
  return SEL_RESTART + encodeUint256(numericId) + encodeUint256(BigInt(ratePerSecond));
}

/** ownerOf(streamId) → recipient address — verifies stream is really flowing to our wallet */
export async function verifyStreamOnChain(
  streamNumericId: number,
  chainId: number,
): Promise<{ ok: boolean; onchainRecipient: string; error?: string }> {
  const eth = typeof window !== 'undefined' ? (window as any).ethereum : null;
  if (!eth) return { ok: false, onchainRecipient: '', error: 'No ethereum provider' };

  const contractAddr = SABLIER_FLOW_CONTRACTS[chainId];
  if (!contractAddr)
    return { ok: false, onchainRecipient: '', error: `No contract for chainId ${chainId}` };

  try {
    const calldata = SEL_OWNER_OF + encodeUint256(streamNumericId);
    const result: string = await eth.request({
      method: 'eth_call',
      params: [{ to: contractAddr, data: calldata }, 'latest'],
    });
    const onchainRecipient = '0x' + result.slice(-40);
    const ok = onchainRecipient.toLowerCase() === RECIPIENT_ADDRESS.toLowerCase();
    return { ok, onchainRecipient };
  } catch (err: any) {
    return { ok: false, onchainRecipient: '', error: err.message ?? String(err) };
  }
}

async function queryStreams(
  wallet: string,
  chainId: number,
  chainName: string,
  selectedChainId: number | null = null,
): Promise<QueryResult> {
  const logs: LogEntry[] = [];
  const log = (level: LogLevel, msg: string, data?: unknown): void => {
    logs.push({ id: `${Date.now()}-${Math.random()}`, ts: Date.now(), level, msg, data });
  };

  const senderLower = wallet.toLowerCase();
  const recipientLower = RECIPIENT_ADDRESS.toLowerCase();

  log('info', `Flow query start`, { wallet: senderLower.slice(0, 10) + '…', chainId, chainName });
  log('info', `Recipient: ${RECIPIENT_ADDRESS}`);

  if (ALLOWED_TOKENS.length > 0) {
    log('info', `[Token Filter] Allowed tokens: ${ALLOWED_TOKENS.join(', ')}`);
  } else {
    log('debug', `[Token Filter] All tokens accepted (VITE_ALLOWED_TOKENS not set)`);
  }

  // ── Strategy: Envio first (multi-chain, single request), The Graph as fallback ──
  // Envio indexes ALL chains in one endpoint — no need to know which chain upfront.
  // The Graph endpoints are per-chain with correct query ID 112500 for Flow.

  let foundOnChainId = chainId;
  let foundOnChainName = chainName;
  let bestStreams: any[] | null = null;

  // Helper for any GraphQL POST
  const gqlFetch = async (
    endpoint: string,
    query: string,
    variables: Record<string, any>,
    label: string,
  ): Promise<any[] | null> => {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) {
        log('warn', `[${label}] HTTP ${res.status}`);
        return null;
      }
      const json = await res.json();
      if (json.errors) {
        log('warn', `[${label}] GraphQL error: ${json.errors[0]?.message ?? 'unknown'}`);
        return null;
      }
      // Envio uses Stream{} (capital), The Graph uses streams{}
      const streams = json.data?.Stream ?? json.data?.streams ?? [];
      log(streams.length > 0 ? 'success' : 'debug', `[${label}] ${streams.length} stream(s)`);
      return streams;
    } catch (err: any) {
      log('warn', `[${label}] ${err.message ?? String(err)}`);
      return null;
    }
  };

  // ── Step 1: Try Envio (all chains, single request) ──────────────────────────
  // IMPORTANT: Always search ALL chains — selectedChainId is a UI preference only,
  // not a hard filter. Stream may be on a different chain than the connected wallet.
  // Envio returns chainId per-stream so we can detect which chain it's on.
  const ENVIO_QUERY = `query {
    Stream(limit: 50, order_by: { timestamp: desc }, where: { sender: { _ilike: "${senderLower}" } }) {
      id
      alias
      chainId
      sender
      recipient
      paused
      ratePerSecond
      withdrawnAmount
      depositedAmount
      startTime
      timestamp
      token {
        id
        symbol
        decimals
        name
      }
    }
  }`;

  // Also prepare asset-field variant for older Envio deployments
  const ENVIO_QUERY_ASSET = `query {
    Stream(limit: 50, order_by: { timestamp: desc }, where: { sender: { _ilike: "${senderLower}" } }) {
      id
      alias
      chainId
      sender
      recipient
      paused
      ratePerSecond
      withdrawnAmount
      depositedAmount
      startTime
      timestamp
      asset {
        id
        symbol
        decimals
        name
      }
    }
  }`;

  log('info', `[Envio] Querying all chains for sender ${senderLower.slice(0, 10)}…`);
  let envioStreams = await gqlFetch(ENVIO_FLOW_ENDPOINT, ENVIO_QUERY, {}, 'Envio');
  if (!envioStreams) {
    log('debug', `[Envio] Retrying with asset field…`);
    envioStreams = await gqlFetch(ENVIO_FLOW_ENDPOINT, ENVIO_QUERY_ASSET, {}, 'Envio/asset');
  }

  if (envioStreams && envioStreams.length > 0) {
    log('success', `[Envio] Found ${envioStreams.length} stream(s) across all chains`);
    bestStreams = envioStreams;
    // Determine chain from the first matching stream (after recipient filter below)
    // We'll set foundOnChainId after filtering
  } else {
    log('warn', `[Envio] No streams found — falling back to The Graph (query/112500)…`);

    // ── Step 2: The Graph fallback — ALWAYS search all chains ──────────────
    // Never restrict to selectedChainId — stream may be on any chain.
    // Connected chainId gets priority but we search everything.
    const allChainIds = Object.keys(THEGRAPH_ENDPOINTS).map(Number);
    const searchChains = [chainId, ...allChainIds.filter((id) => id !== chainId)];

    log(
      'info',
      `[TheGraph] Searching all chains: ${searchChains.map((id) => CHAIN_NAMES[id] ?? id).join(', ')}`,
    );

    const chainResults = await Promise.all(
      searchChains.map(async (cid) => {
        const ep = THEGRAPH_ENDPOINTS[cid];
        if (!ep) return { cid, streams: null as any[] | null, ep };
        const cname = CHAIN_NAMES[cid] ?? `Chain ${cid}`;
        // Try queries in order: full → no-deposit → asset fallback
        let streams = await gqlFetch(
          ep,
          STREAMS_QUERY_FULL,
          { sender: senderLower },
          `TheGraph/${cname}`,
        );
        if (!streams)
          streams = await gqlFetch(
            ep,
            STREAMS_QUERY_NO_DEPOSIT,
            { sender: senderLower },
            `TheGraph/${cname}/nodep`,
          );
        if (!streams)
          streams = await gqlFetch(
            ep,
            STREAMS_QUERY_ASSET,
            { sender: senderLower },
            `TheGraph/${cname}/asset`,
          );
        return { cid, streams, ep };
      }),
    );

    const hit =
      chainResults.find((r) => r.cid === chainId && r.streams && r.streams.length > 0) ??
      chainResults.find((r) => r.streams && r.streams.length > 0);

    if (hit?.streams && hit.streams.length > 0) {
      bestStreams = hit.streams;
      foundOnChainId = hit.cid;
      foundOnChainName = CHAIN_NAMES[hit.cid] ?? `Chain ${hit.cid}`;
      log('success', `[TheGraph] Found on ${foundOnChainName}`);
    }
  }

  if (!bestStreams || bestStreams.length === 0) {
    log('warn', `No active Flow streams found (Envio + TheGraph both returned empty)`);
    log('warn', `wallet=${senderLower} recipient=${recipientLower}`);
    log('warn', `Check: is VITE_RECIPIENT_ADDRESS correct? Is the stream active (not voided)?`);
    return { streams: [], logs };
  }

  /* ── Step 3: Filter by recipient + token, parse ALL valid streams ──────────
     We return ALL streams that pass the filters so the user can pick which one.
  */
  const allRaw = bestStreams!;
  log('info', `[Streams] ${allRaw.length} raw stream(s) — filtering by recipient + token…`);

  // Helper: parse one raw subgraph stream into ActiveStream
  function parseStream(s: any, cid: number, cname: string): ActiveStream | null {
    const tok = s.token ?? s.asset;
    if (!tok) return null;

    const sym = tok.symbol ?? '';
    const addr = tok.id ?? '';
    if (ALLOWED_TOKENS.length > 0 && !isTokenAllowed(sym) && !isTokenAllowed(addr)) {
      log('debug', `  Skip ${s.alias ?? s.id}: token ${sym} not allowed`);
      return null;
    }
    const decimals: number = Number(tok.decimals ?? 18);
    const rateRaw = BigInt(s.ratePerSecond ?? '0');
    const withdrawnRaw = BigInt(s.withdrawnAmount ?? '0');
    const netDepositedRaw = BigInt(s.depositedAmount ?? s.depositAmount ?? '0');
    const balanceRaw = netDepositedRaw > withdrawnRaw ? netDepositedRaw - withdrawnRaw : 0n;
    const nowSec2 = Math.floor(Date.now() / 1000);
    const lastEventTime = Number(s.startTime ?? s.timestamp ?? nowSec2);

    // ── Debt detection ───────────────────────────────────────────────────────
    // A stream has debt when it has been flowing but ran out of balance.
    // netDeposited tracks total ever deposited. withdrawnAmount = already withdrawn.
    // remainingBalance = netDeposited - withdrawnAmount (tokens still in stream).
    // If rate > 0 and balance = 0 and NOT paused → stream has debt (owes tokens).
    // We also check elapsed accrual vs balance for accuracy.
    const streamIsPaused = Boolean(s.paused);
    let hasDebt = false;
    let debtRaw = 0n;

    console.log(streamIsPaused, rateRaw, '====cname====', s.ratePerSecond);

    if (!streamIsPaused && rateRaw > 0n) {
      const hasDepositData = netDepositedRaw > 0n;

      if (hasDepositData && balanceRaw === 0n) {
        hasDebt = true;
        // Estimate debt: tokens accrued since last event minus total deposited
        const elapsedSecs = BigInt(Math.max(0, nowSec2 - lastEventTime));
        const totalAccrued = rateRaw * elapsedSecs;
        debtRaw = totalAccrued > netDepositedRaw ? totalAccrued - netDepositedRaw : rateRaw; // fallback: 1 second worth
      } else {
        hasDebt = false;
        debtRaw = 0n;
      }
    }
    const ratePerSec = Number(rateRaw) / 10 ** decimals;
    const remainingTokens = Number(balanceRaw) / 10 ** decimals;
    const secondsRemaining = ratePerSec > 0 ? remainingTokens / ratePerSec : 86400 * 30;
    const synthesizedEndTime = nowSec2 + Math.max(secondsRemaining, 0);

    // Use Envio chainId if available, otherwise use foundOnChainId
    const streamChainId = s.chainId ? Number(s.chainId) : cid;
    const streamChainName = CHAIN_NAMES[streamChainId] ?? cname;

    return {
      streamId: s.id ?? '',
      streamAlias: s.alias ?? s.id ?? '',
      sender: s.sender,
      tokenAddress: addr,
      tokenSymbol: sym || 'UNKNOWN',
      tokenDecimals: decimals,
      chainId: streamChainId,
      chainName: streamChainName,
      ratePerSecond: String(rateRaw),
      balance: String(balanceRaw),
      totalStreamed: String(withdrawnRaw),
      netDeposited: String(netDepositedRaw),
      depositAmount: String(netDepositedRaw),
      withdrawnAmount: String(withdrawnRaw),
      hasDebt,
      debtRaw: String(debtRaw),
      startTime: Number(s.startTime ?? nowSec2),
      lastAdjustmentTime: lastEventTime,
      paused: streamIsPaused,
      endTime: Math.floor(synthesizedEndTime),
    };
  }

  const parsedStreams: ActiveStream[] = [];

  for (const s of allRaw) {
    // Must match recipient
    if (s.recipient?.toLowerCase() !== recipientLower) {
      log('debug', `  Skip ${s.alias ?? s.id}: recipient mismatch (${s.recipient})`);
      continue;
    }

    const cid2 = s.chainId ? Number(s.chainId) : foundOnChainId;
    const cname2 = CHAIN_NAMES[cid2] ?? foundOnChainName;
    console.log(s, cid2, cname2);

    const parsed = parseStream(s, cid2, cname2);
    if (!parsed) continue;

    log(
      'success',
      `[Stream] ${parsed.streamAlias} — ${parsed.tokenSymbol} ${parsed.paused ? '⏸ paused' : parsed.hasDebt ? `⚠ debt (${(Number(parsed.debtRaw) / 10 ** parsed.tokenDecimals).toFixed(6)} ${parsed.tokenSymbol})` : '✓ active'} on ${parsed.chainName}`,
    );
    parsedStreams.push(parsed);
  }

  if (parsedStreams.length === 0) {
    log('warn', `[Filter] No streams passed recipient + token filter`);
    log(
      'warn',
      `Recipients in data: ${[...new Set(allRaw.map((s: any) => s.recipient))].join(', ')}`,
    );
    return { streams: [], logs };
  }

  log('info', `[Result] ${parsedStreams.length} valid stream(s) for recipient ✓`);
  return { streams: parsedStreams, logs };
}

/* 
   PROVIDER
 */

export function LicenseProvider({ children }: { children: ReactNode }) {
  const [walletAddress, setWallet] = useState<string>();
  const [chainId, setChainId] = useState<number>();
  const [chainName, setChainName] = useState<string>();
  const [status, setStatus] = useState<Status>('no_wallet');
  const [currentPlan, setPlan] = useState<Plan>('free');
  const [activeStream, setStream] = useState<ActiveStream>();
  // Multi-stream support
  const [availableStreams, setAvailableStreams] = useState<ActiveStream[]>([]);
  const [selectedStreamId, setSelectedStreamId] = useState<string | null>(null);
  // CoinGecko price cache (refreshed every 5 min)
  const [tokenPrice, setTokenPrice] = useState<number | null>(null);
  const priceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [error, setError] = useState<string>();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [lastChecked, setLastChecked] = useState<number>();
  const [streamRevoked, setStreamRevoked] = useState<boolean>(false);
  const [streamActionPending, setStreamActionPending] = useState<boolean>(false);
  const [selectedChainId, setSelectedChainId] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isDev = import.meta.env.VITE_DEV_UNLOCK === 'true';

  // ── localStorage persistence ─────────────────────────────────────────────
  // Restore session on mount — ONLY restore wallet address + chain for reconnect.
  // Plan/status are NOT restored from cache; they are always re-verified live
  // to prevent spoofed sessions (e.g. "Pro" stuck after stream is cancelled).
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sablier_session');
      if (!saved) return;
      const session = JSON.parse(saved) as {
        walletAddress: string;
        chainId: number;
        chainName: string;
        plan: Plan;
        status: Status;
        selectedChainId: number | null;
        ts: number;
      };
      // Expire after 24h
      if (Date.now() - session.ts > 86_400_000) {
        localStorage.removeItem('sablier_session');
        return;
      }
      // Restore wallet identity only — plan will be re-fetched via connect()
      setSelectedChainId(session.selectedChainId ?? null);
      // Trigger a fresh connect() with restored wallet + chain
      // This re-queries the stream and sets plan correctly
      connect(session.walletAddress, session.chainId).catch(() => {
        // If re-verify fails (stream gone, network error), clear session
        localStorage.removeItem('sablier_session');
      });
    } catch {
      // ignore parse errors
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Save session whenever wallet/plan changes
  useEffect(() => {
    if (!walletAddress) return;
    try {
      localStorage.setItem(
        'sablier_session',
        JSON.stringify({
          walletAddress,
          chainId: chainId ?? 1,
          chainName: chainName ?? 'Unknown',
          plan: currentPlan,
          status,
          selectedChainId,
          ts: Date.now(),
        }),
      );
    } catch {
      // ignore storage errors
    }
  }, [walletAddress, chainId, chainName, currentPlan, status, selectedChainId]);

  function appendLogs(newLogs: LogEntry[]) {
    setLogs((prev) => [...prev, ...newLogs]);
  }

  function clearLogs() {
    setLogs([]);
  }

  // ── Price polling: refresh every 5 min ───────────────────────────────────
  const startPricePolling = useCallback((symbol: string) => {
    if (priceIntervalRef.current) clearInterval(priceIntervalRef.current);
    const doFetch = async () => {
      const price = await fetchTokenPrice(symbol);
      if (price != null) setTokenPrice(price);
    };
    doFetch(); // immediate first fetch
    priceIntervalRef.current = setInterval(doFetch, 5 * 60 * 1000);
  }, []);

  // ── applyStreamStatus: given a chosen stream, compute plan + set status ──
  const applyStreamStatus = useCallback(
    async (chosen: ActiveStream) => {
      const price = await fetchTokenPrice(chosen.tokenSymbol);
      const usdPrice = price ?? 1;
      if (price != null) setTokenPrice(price);

      const ratePerSecondTokens = Number(chosen.ratePerSecond) / 10 ** chosen.tokenDecimals;
      const monthlyUSD = ratePerSecondTokens * 86400 * 30 * usdPrice;
      const plan = detectPlan(monthlyUSD);

      appendLogs([
        {
          id: `${Date.now()}-plan`,
          ts: Date.now(),
          level: 'success',
          msg: `Stream accepted: ${chosen.streamAlias} — ${chosen.tokenSymbol} ${(ratePerSecondTokens * 86400 * 30).toFixed(6)}/mo ≈ $${monthlyUSD.toFixed(4)}/mo`,
        },
      ]);

      if (chosen.paused) {
        appendLogs([
          {
            id: `${Date.now()}-paused`,
            ts: Date.now(),
            level: 'warn',
            msg: `[Security] Stream paused — features locked until resumed`,
          },
        ]);
        setStatus('paused' as any);
        setPlan('free');
      } else if (chosen.hasDebt) {
        appendLogs([
          {
            id: `${Date.now()}-debt`,
            ts: Date.now(),
            level: 'warn',
            msg: `[Security] Stream has debt — features locked until sender tops up`,
          },
        ]);
        setStatus('debt' as any);
        setPlan('free');
      } else {
        setStatus(plan);
        setPlan(plan);
      }

      setStream(chosen);
      setStreamRevoked(false);
      startPricePolling(chosen.tokenSymbol);
      setLastChecked(Date.now());
    },
    [startPricePolling],
  );

  // ── applyStreams: store all streams, pick one ─────────────────────────────
  const applyStreams = useCallback(
    async (streams: ActiveStream[], preserveSelectedId?: string | null) => {
      setAvailableStreams(streams);

      if (streams.length === 0) {
        setStream(undefined);
        setSelectedStreamId(null);
        setStatus('free');
        setPlan('free');
        setStreamRevoked(true);
        return;
      }

      // Pick stream: prefer preserved selection > first healthy (active, no debt) > first
      const preferred = preserveSelectedId ?? selectedStreamId;
      const found = streams.find((s) => s.streamId === preferred);
      const firstHealthy = streams.find((s) => !s.paused && !s.hasDebt);
      const chosen = found ?? firstHealthy ?? streams[0];

      setSelectedStreamId(chosen.streamId);
      await applyStreamStatus(chosen);
    },
    [selectedStreamId, applyStreamStatus],
  );

  // ── selectStream: user manually picks a different stream ─────────────────
  const selectStream = useCallback(
    async (streamId: string) => {
      const found = availableStreams.find((s) => s.streamId === streamId);
      if (!found) {
        appendLogs([
          {
            id: `${Date.now()}-select-err`,
            ts: Date.now(),
            level: 'warn',
            msg: `[Stream] selectStream: ID not found: ${streamId}`,
          },
        ]);
        return;
      }
      setSelectedStreamId(streamId);
      appendLogs([
        {
          id: `${Date.now()}-select`,
          ts: Date.now(),
          level: 'info',
          msg: `[Stream] User selected ${found.streamAlias} — ${found.tokenSymbol} on ${found.chainName}`,
        },
      ]);
      await applyStreamStatus(found);
    },
    [availableStreams, applyStreamStatus],
  );

  /*  refresh  */
  async function refresh() {
    if (!walletAddress || !chainId) return;
    const resolvedChainName = chainName ?? CHAIN_NAMES[chainId] ?? `Chain ${chainId}`;
    setStatus('loading');
    setError(undefined);
    appendLogs([
      { id: `${Date.now()}-refresh`, ts: Date.now(), level: 'info', msg: `Refreshing streams…` },
    ]);

    const { streams, logs: queryLogs } = await queryStreams(
      walletAddress,
      chainId,
      resolvedChainName,
      selectedChainId,
    );
    appendLogs(queryLogs);
    setLastChecked(Date.now());
    await applyStreams(streams, selectedStreamId);
  }

  /*  connect — queries all streams, lets user pick  */
  async function connect(addr: string, cid: number) {
    const name = CHAIN_NAMES[cid] ?? `Chain ${cid}`;
    setWallet(addr);
    setChainId(cid);
    setChainName(name);
    clearLogs();

    appendLogs([
      {
        id: `${Date.now()}-connect`,
        ts: Date.now(),
        level: 'info',
        msg: `Wallet connected: ${addr.slice(0, 6)}…${addr.slice(-4)} on ${name}`,
      },
    ]);

    if (isDev) {
      appendLogs([
        {
          id: `${Date.now()}-dev`,
          ts: Date.now(),
          level: 'success',
          msg: `[Dev Mode] All features unlocked`,
        },
      ]);
      setStatus('dev' as any);
      setPlan('pro');
      return;
    }

    setStatus('loading');
    setError(undefined);

    if (IS_TESTNET_MODE) {
      appendLogs([
        {
          id: `${Date.now()}-testnet`,
          ts: Date.now(),
          level: 'info',
          msg: `[Testnet] Threshold $${PLAN_MIN_DEPOSIT.basic}/$${PLAN_MIN_DEPOSIT.pro}`,
        },
      ]);
    }

    const { streams, logs: queryLogs } = await queryStreams(addr, cid, name, selectedChainId);
    appendLogs(queryLogs);
    setLastChecked(Date.now());

    if (streams.length === 0) {
      appendLogs([
        {
          id: `${Date.now()}-no-stream`,
          ts: Date.now(),
          level: 'warn',
          msg: 'No active stream found → plan: Free',
        },
      ]);
      setStatus('free');
      setPlan('free');
      return;
    }

    appendLogs([
      {
        id: `${Date.now()}-found`,
        ts: Date.now(),
        level: 'success',
        msg: `Found ${streams.length} stream(s) for recipient`,
      },
    ]);
    await applyStreams(streams, null); // null = auto-pick best stream
  }

  // Parse numeric stream ID from alias like "FL3-11155111-163" → 163
  function parseStreamNumericId(stream: { streamAlias: string; streamId: string }): number | null {
    const aliasMatch = stream.streamAlias.match(/-(\d+)$/);
    if (aliasMatch) return parseInt(aliasMatch[1], 10);
    const idMatch = stream.streamId.match(/-(\d+)$/);
    if (idMatch) return parseInt(idMatch[1], 10);
    return null;
  }

  async function sendSablierTx(calldata: string, actionLabel: string): Promise<void> {
    if (!walletAddress || !chainId) throw new Error('Wallet not connected.');
    if (!activeStream) throw new Error('No active stream.');

    // IMPORTANT: use the stream's chainId, not the wallet's connected chainId.
    // Stream may be on Sepolia while wallet is connected to Mainnet/Base Sepolia.
    const streamChainId = activeStream.chainId;
    const contractAddr = SABLIER_FLOW_CONTRACTS[streamChainId];
    if (!contractAddr || contractAddr === '0x0000000000000000000000000000000000000000') {
      throw new Error(
        `Sablier Flow contract not found for chainId ${streamChainId}. Stream: ${activeStream.streamAlias}`,
      );
    }

    appendLogs([
      {
        id: `${Date.now()}-tx-start`,
        ts: Date.now(),
        level: 'info',
        msg: `[Sablier] Sending ${actionLabel} tx via ${(window as any).api?.wcSendTransaction ? 'WalletConnect' : 'window.ethereum'}…`,
        data: { to: contractAddr, chainId: streamChainId },
      },
    ]);

    let txHash: string;

    // Prefer WalletConnect (Electron) — uses the active WC session
    const api = (window as any).api;
    console.log(api, '=====api=====');

    if (api?.wcSendTransaction) {
      // Check session exists first for a better error message
      const hasSession = (await api.wcHasSession?.()) ?? false;
      if (!hasSession) {
        throw new Error(
          'Tidak ada sesi WalletConnect aktif. Klik tombol "Connect Wallet" untuk scan QR ulang.',
        );
      }
      const result = await api.wcSendTransaction({
        from: walletAddress,
        to: contractAddr,
        data: calldata,
        chainId: streamChainId, // use stream's chain, not wallet's connected chain
      });
      if ('error' in result) throw new Error(`WalletConnect tx gagal: ${result.error}`);
      txHash = result.txHash;
    } else {
      // Fallback: injected provider (MetaMask, Rabby, etc.)
      const eth = (window as any).ethereum;
      if (!eth)
        throw new Error('No provider found. Connect via WalletConnect or install MetaMask.');
      txHash = await eth.request({
        method: 'eth_sendTransaction',
        params: [{ from: walletAddress, to: contractAddr, data: calldata }],
      });
    }

    appendLogs([
      {
        id: `${Date.now()}-tx-sent`,
        ts: Date.now(),
        level: 'success',
        msg: `[Sablier] ${actionLabel} tx sent: ${txHash}`,
        data: { txHash },
      },
    ]);

    // Wait a few seconds then refresh stream status
    await new Promise((r) => setTimeout(r, 4000));
    await refresh();
  }

  async function pauseStream(): Promise<void> {
    if (!activeStream) throw new Error('No active stream to pause.');
    const numId = parseStreamNumericId(activeStream);
    if (numId === null) throw new Error(`Cannot parse stream ID from: ${activeStream.streamAlias}`);

    setStreamActionPending(true);
    appendLogs([
      {
        id: `${Date.now()}-pause-init`,
        ts: Date.now(),
        level: 'info',
        msg: `[Pause] Stream ${activeStream.streamAlias} (ID: ${numId})`,
      },
    ]);

    try {
      await sendSablierTx(encodePause(numId), 'pause');
    } catch (err: any) {
      appendLogs([
        {
          id: `${Date.now()}-pause-err`,
          ts: Date.now(),
          level: 'error',
          msg: `[Pause] Failed: ${err.message ?? String(err)}`,
        },
      ]);
      throw err;
    } finally {
      setStreamActionPending(false);
    }
  }

  async function resumeStream(): Promise<void> {
    if (!activeStream) throw new Error('No paused stream to resume.');
    const numId = parseStreamNumericId(activeStream);
    if (numId === null) throw new Error(`Cannot parse stream ID from: ${activeStream.streamAlias}`);

    setStreamActionPending(true);
    appendLogs([
      {
        id: `${Date.now()}-resume-init`,
        ts: Date.now(),
        level: 'info',
        msg: `[Resume] Stream ${activeStream.streamAlias} (ID: ${numId}) rate: ${activeStream.ratePerSecond}`,
      },
    ]);

    try {
      await sendSablierTx(encodeRestart(numId, activeStream.ratePerSecond), 'restart');
    } catch (err: any) {
      appendLogs([
        {
          id: `${Date.now()}-resume-err`,
          ts: Date.now(),
          level: 'error',
          msg: `[Resume] Failed: ${err.message ?? String(err)}`,
        },
      ]);
      throw err;
    } finally {
      setStreamActionPending(false);
    }
  }

  /*  logout — clears wallet + stops polling  */
  function logout() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (priceIntervalRef.current) {
      clearInterval(priceIntervalRef.current);
      priceIntervalRef.current = null;
    }
    setWallet(undefined);
    setChainId(undefined);
    setChainName(undefined);
    setStatus('no_wallet');
    setPlan('free');
    setStream(undefined);
    setAvailableStreams([]);
    setSelectedStreamId(null);
    setTokenPrice(null);
    setError(undefined);
    setLastChecked(undefined);
    setStreamRevoked(false);
    setSelectedChainId(null);
    try {
      localStorage.removeItem('sablier_session');
    } catch {}
    clearLogs();
    appendLogs([
      {
        id: `${Date.now()}-logout`,
        ts: Date.now(),
        level: 'info',
        msg: 'Logged out — wallet disconnected',
      },
    ]);
  }

  /*  disconnect (alias for logout)  */
  function disconnect() {
    logout();
  }

  /*  auto-poll: every STREAM_POLL_INTERVAL_MS, re-check ONLY the selected stream  */
  useEffect(() => {
    if (!walletAddress || !chainId) return;
    if (isDev) return; // dev mode skips polling

    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      // Re-fetch all streams to get fresh state of the selected one
      const resolvedChainName = chainName ?? CHAIN_NAMES[chainId] ?? `Chain ${chainId}`;
      appendLogs([
        {
          id: `${Date.now()}-poll`,
          ts: Date.now(),
          level: 'debug',
          msg: `[Auto-check] Checking stream status…`,
        },
      ]);

      const { streams, logs: queryLogs } = await queryStreams(
        walletAddress,
        chainId,
        resolvedChainName,
        null,
      );
      appendLogs(queryLogs);
      setLastChecked(Date.now());

      if (streams.length === 0) {
        appendLogs([
          {
            id: `${Date.now()}-revoked`,
            ts: Date.now(),
            level: 'error',
            msg: '[Security] No streams found — downgrading to Free',
          },
        ]);
        setStreamRevoked(true);
        setStatus('free');
        setPlan('free');
        setStream(undefined);
        setAvailableStreams([]);
        return;
      }

      // Update available streams list (in case new streams appeared)
      setAvailableStreams(streams);

      // Find the selected stream in fresh results
      const currentSelectedId = selectedStreamId;
      const freshSelected = streams.find((s) => s.streamId === currentSelectedId);

      if (!freshSelected) {
        // Selected stream gone — auto-pick a healthy one
        appendLogs([
          {
            id: `${Date.now()}-poll-lost`,
            ts: Date.now(),
            level: 'warn',
            msg: `[Security] Selected stream not found — switching to best available`,
          },
        ]);
        const firstHealthy = streams.find((s) => !s.paused && !s.hasDebt) ?? streams[0];
        setSelectedStreamId(firstHealthy.streamId);
        await applyStreamStatus(firstHealthy);
        return;
      }

      // Re-apply status for the selected stream (detects paused/debt changes)
      await applyStreamStatus(freshSelected);
    }, STREAM_POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress, chainId, chainName, isDev, selectedStreamId, applyStreamStatus]);

  /*  permission helpers  */
  function can(feature: Feature) {
    const required = FEATURE_TIERS[feature];
    if (isDev) return true;
    // Hard-lock: paused stream or debt → only free features accessible
    if (activeStream?.paused) return required === 'free';
    if (activeStream?.hasDebt) return required === 'free';
    if (status === 'debt' || status === 'paused') return required === 'free';
    if (required === 'free') return true;
    if (required === 'basic' && (currentPlan === 'basic' || currentPlan === 'pro')) return true;
    if (required === 'pro' && currentPlan === 'pro') return true;
    return false;
  }

  function planFor(feature: Feature) {
    return FEATURE_TIERS[feature];
  }

  return (
    <LicenseContext.Provider
      value={{
        status,
        walletAddress,
        chainId,
        chainName,
        activeStream,
        availableStreams,
        selectedStreamId,
        selectStream,
        tokenPrice,
        currentPlan,
        error,
        isDev,
        logs,
        lastChecked,
        streamRevoked,
        selectedChainId,
        setSelectedChainId,
        connect,
        disconnect,
        logout,
        refresh,
        clearLogs,
        pauseStream,
        resumeStream,
        streamActionPending,
        applyStreamStatus,
        can,
        planFor,
      }}>
      {children}
    </LicenseContext.Provider>
  );
}

/* 
   HOOK
 */

export function useLicense() {
  const ctx = useContext(LicenseContext);
  if (!ctx) throw new Error('useLicense must be used inside LicenseProvider');
  return ctx;
}
