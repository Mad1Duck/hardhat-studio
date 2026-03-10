import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export const RECIPIENT_ADDRESS = import.meta.env.VITE_RECIPIENT_ADDRESS;

export const IS_TESTNET_MODE = import.meta.env.VITE_NODE_ENV === 'development';

export const PLAN_MIN_DEPOSIT = IS_TESTNET_MODE
  ? { basic: 0.01, pro: 0.02 }
  : { basic: 9.99, pro: 29.99 };

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

const THEGRAPH_ENDPOINTS: Record<number, string> = {
  1: 'https://api.studio.thegraph.com/query/112500/sablier-flow-ethereum/version/latest',
  137: 'https://api.studio.thegraph.com/query/112500/sablier-flow-polygon/version/latest',
  42161: 'https://api.studio.thegraph.com/query/112500/sablier-flow-arbitrum/version/latest',
  56: 'https://api.studio.thegraph.com/query/112500/sablier-flow-bsc/version/latest',
  10: 'https://api.studio.thegraph.com/query/112500/sablier-flow-optimism/version/latest',
  8453: 'https://api.studio.thegraph.com/query/112500/sablier-flow-base/version/latest',
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
export type Status = 'loading' | 'free' | 'basic' | 'pro' | 'dev' | 'no_wallet';

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
  sender: string;
  tokenSymbol: string;
  tokenAddress: string;
  tokenDecimals: number;
  chainId: number;
  chainName: string;
  // Flow uses ratePerSecond (18-decimal BigInt string) instead of deposit/endTime
  ratePerSecond: string;
  // Balance fields
  balance: string; // current token balance in stream
  totalStreamed: string; // total ever streamed out
  // Timestamps
  startTime: number;
  lastAdjustmentTime: number;
  // Status
  paused: boolean;
  depositAmount: string; // alias for balance (display compat)
  withdrawnAmount: string; // alias for totalStreamed (display compat)
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
  error?: string;
  isDev: boolean;
  logs: LogEntry[];

  connect: (addr: string, chainId: number) => Promise<void>;
  disconnect: () => void;
  refresh: () => Promise<void>;
  clearLogs: () => void;

  can: (feature: Feature) => boolean;
  planFor: (feature: Feature) => Plan;
};

const LicenseContext = createContext<LicenseContextType | null>(null);

/* 
   CHAIN NAME MAP
 */

const CHAIN_NAMES: Record<number, string> = {
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

async function fetchTokenPrice(symbol: string): Promise<number | null> {
  try {
    const coinId =
      symbol.toUpperCase() === 'USDC'
        ? 'usd-coin'
        : symbol.toUpperCase() === 'USDT'
          ? 'tether'
          : symbol.toUpperCase() === 'DAI'
            ? 'dai'
            : symbol.toUpperCase() === 'WETH'
              ? 'ethereum'
              : symbol.toLowerCase();

    const r = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`,
      { signal: AbortSignal.timeout(8000) },
    );
    const j = await r.json();
    return j[coinId]?.usd ?? null;
  } catch {
    return null;
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

const STREAMS_QUERY_THEGRAPH = /* graphql */ `
  query GetStreams($sender: String!, $recipient: String!) {
    streams(
      where: {
        sender: $sender
        recipient: $recipient
        paused: false
      }
      orderBy: timestamp
      orderDirection: desc
      first: 10
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

type QueryResult = {
  stream: ActiveStream | null;
  logs: LogEntry[];
};

async function queryStreams(
  wallet: string,
  chainId: number,
  chainName: string,
): Promise<QueryResult> {
  const logs: LogEntry[] = [];
  const log = (level: LogLevel, msg: string, data?: unknown): void => {
    logs.push({ id: `${Date.now()}-${Math.random()}`, ts: Date.now(), level, msg, data });
  };

  const senderLower = wallet.toLowerCase();
  const recipientLower = RECIPIENT_ADDRESS.toLowerCase();

  log('info', `Starting Flow stream query`, { wallet: senderLower, chainId, chainName });
  log('info', `Recipient: ${RECIPIENT_ADDRESS}`);

  /*  TheGraph  */
  const graphEndpoint = THEGRAPH_ENDPOINTS[chainId];

  if (!graphEndpoint) {
    log('error', `No TheGraph endpoint for chainId ${chainId}`);
    log('error', `Supported chains: ${Object.keys(THEGRAPH_ENDPOINTS).join(', ')}`);
    return { stream: null, logs };
  }

  log('debug', `[TheGraph/Flow] Querying...`, { endpoint: graphEndpoint });

  /*  Step 1: Introspect schema to discover actual fields  */
  try {
    const introRes = await fetch(graphEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: INTROSPECT_QUERY }),
      signal: AbortSignal.timeout(10000),
    });
    if (introRes.ok) {
      const introJson = await introRes.json();
      const fields: string[] = (introJson.data?.__type?.fields ?? []).map((f: any) => f.name);
      log('info', `[Schema] Stream fields: ${fields.join(', ')}`, { total: fields.length });
      console.log('[Sablier] Stream schema fields:', fields);
    }
  } catch {
    log('debug', `[Schema] Introspection skipped`);
  }

  /*  Step 2: Main query  */

  try {
    const res = await fetch(graphEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: STREAMS_QUERY_THEGRAPH,
        variables: { sender: senderLower, recipient: recipientLower },
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      log('error', `[TheGraph] HTTP ${res.status} ${res.statusText}`);
      return { stream: null, logs };
    }

    const json = await res.json();
    log('debug', `[TheGraph] Raw response`, {
      hasData: !!json.data,
      hasErrors: !!json.errors,
      streamCount: json.data?.streams?.length ?? 'N/A',
      errors: json.errors ?? null,
    });
    console.log('[Sablier] raw json:', JSON.stringify(json, null, 2));

    if (json.errors) {
      log('error', `[TheGraph] GraphQL errors`, json.errors);
      const msg = json.errors[0]?.message ?? 'Unknown error';
      log('error', `First error: ${msg}`);
      return { stream: null, logs };
    }

    const streams: any[] = json.data?.streams ?? [];
    log('info', `[TheGraph] Received ${streams.length} active Flow stream(s)`);

    for (const s of streams) {
      log('debug', `Stream ${s.alias ?? s.id}`, {
        paused: s.paused,
        ratePerSecond: s.ratePerSecond,
        balance: s.balance,
        token: s.token?.symbol,
        snapshotTime: s.snapshotTime,
      });
    }

    if (streams.length === 0) {
      log('warn', `No active (unpaused) Flow streams found for this wallet → recipient`);
      log('warn', `Hint: Check RECIPIENT_ADDRESS and that stream is not paused`);
      return { stream: null, logs };
    }

    const s = streams[0];
    const decimals: number = Number(s.asset?.decimals ?? 18);
    const rateRaw = BigInt(s.ratePerSecond ?? '0');
    const withdrawnRaw = BigInt(s.withdrawnAmount ?? '0');

    // Synthesize a balance estimate: we don't have it yet until schema confirmed
    // Will be refined once introspection shows the actual balance field name
    const nowSec = Math.floor(Date.now() / 1000);
    // fallback endTime: 30 days from now (schema field TBD)
    const synthesizedEndTime = nowSec + 86400 * 30;

    log('success', `Flow stream found: ${s.alias ?? s.id} (${s.asset?.symbol ?? '?'})`);
    log('debug', `ratePerSecond raw: ${s.ratePerSecond}`, {
      decimals,
      withdrawn: s.withdrawnAmount,
      asset: s.asset,
    });

    return {
      stream: {
        sender: s.sender,
        tokenAddress: s.asset?.id ?? '',
        tokenSymbol: s.asset?.symbol ?? 'UNKNOWN',
        tokenDecimals: decimals,
        chainId,
        chainName,
        ratePerSecond: String(rateRaw),
        balance: '0',
        totalStreamed: String(withdrawnRaw),
        startTime: Number(s.startTime),
        lastAdjustmentTime: Number(s.startTime),
        paused: Boolean(s.paused),
        depositAmount: '0',
        withdrawnAmount: String(withdrawnRaw),
        endTime: synthesizedEndTime,
      },
      logs,
    };
  } catch (err: any) {
    log('error', `[TheGraph] Fetch failed: ${err.message ?? String(err)}`);
    return { stream: null, logs };
  }
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
  const [error, setError] = useState<string>();
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const isDev = import.meta.env.VITE_DEV_UNLOCK === 'true';

  function appendLogs(newLogs: LogEntry[]) {
    setLogs((prev) => [...prev, ...newLogs]);
  }

  function clearLogs() {
    setLogs([]);
  }

  /*  refresh  */
  async function refresh() {
    if (!walletAddress || !chainId) return;

    const resolvedChainName = chainName ?? CHAIN_NAMES[chainId] ?? `Chain ${chainId}`;

    setStatus('loading');
    setError(undefined);

    const startLog: LogEntry = {
      id: `${Date.now()}-start`,
      ts: Date.now(),
      level: 'info',
      msg: `Refresh triggered — ${resolvedChainName} (${chainId})`,
    };
    appendLogs([startLog]);

    const { stream, logs: queryLogs } = await queryStreams(
      walletAddress,
      chainId,
      resolvedChainName,
    );

    appendLogs(queryLogs);

    if (!stream) {
      const noStreamLog: LogEntry = {
        id: `${Date.now()}-result`,
        ts: Date.now(),
        level: 'warn',
        msg: 'No active stream detected → plan: Free',
      };
      appendLogs([noStreamLog]);
      setStatus('free');
      setPlan('free');
      setStream(undefined);
      return;
    }

    /* Price lookup */
    const priceLog: LogEntry = {
      id: `${Date.now()}-price`,
      ts: Date.now(),
      level: 'info',
      msg: `Fetching ${stream.tokenSymbol} price from CoinGecko...`,
    };
    appendLogs([priceLog]);

    const price = await fetchTokenPrice(stream.tokenSymbol);

    if (!price) {
      /* For stablecoins (USDC/USDT/DAI) assume $1 */
      const isStable = ['USDC', 'USDT', 'DAI', 'FRAX', 'LUSD'].includes(
        stream.tokenSymbol.toUpperCase(),
      );

      if (!isStable) {
        const errLog: LogEntry = {
          id: `${Date.now()}-price-err`,
          ts: Date.now(),
          level: 'error',
          msg: `Price lookup failed for ${stream.tokenSymbol}`,
        };
        appendLogs([errLog]);
        setError(`Price lookup failed for ${stream.tokenSymbol}`);
        setStatus('free');
        return;
      }

      appendLogs([
        {
          id: `${Date.now()}-stablecoin`,
          ts: Date.now(),
          level: 'info',
          msg: `${stream.tokenSymbol} assumed = $1.00 (stablecoin)`,
        },
      ]);
    }

    const usdPrice = price ?? 1;

    // Flow: ratePerSecond is 18-decimal WAD (like ETH wei)
    // ratePerSecond / 1e18 = tokens/sec → × 86400 × 30 = tokens/month
    const decimals = stream.tokenDecimals;
    const ratePerSecondTokens = Number(stream.ratePerSecond) / 10 ** decimals;
    const ratePerMonth = ratePerSecondTokens * 86400 * 30;
    const monthlyUSD = ratePerMonth * usdPrice;

    const plan = detectPlan(monthlyUSD);

    appendLogs([
      {
        id: `${Date.now()}-calc`,
        ts: Date.now(),
        level: 'debug',
        msg: `Flow stream math`,
        data: {
          rate_per_sec_raw: stream.ratePerSecond,
          decimals,
          rate_per_sec_tokens: ratePerSecondTokens.toFixed(10),
          rate_per_month_tokens: ratePerMonth.toFixed(6),
          price_usd: usdPrice,
          monthly_usd: monthlyUSD.toFixed(4),
        },
      },
      {
        id: `${Date.now()}-plan`,
        ts: Date.now(),
        level: 'success',
        msg: `Plan detected: ${plan.toUpperCase()} ($${monthlyUSD.toFixed(2)}/mo)`,
        data: {
          basic_threshold: PLAN_MIN_DEPOSIT.basic,
          pro_threshold: PLAN_MIN_DEPOSIT.pro,
        },
      },
    ]);

    setStream(stream);
    setPlan(plan);
    setStatus(plan);
  }

  /*  connect  */
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
    // auto-refresh after connect
    setStatus('loading');
    setError(undefined);

    const { stream, logs: queryLogs } = await queryStreams(addr, cid, name);
    appendLogs(queryLogs);

    if (!stream) {
      appendLogs([
        {
          id: `${Date.now()}-no-stream`,
          ts: Date.now(),
          level: 'warn',
          msg: 'No active stream on connect → plan: Free',
        },
      ]);
      setStatus('free');
      setPlan('free');
      return;
    }

    const price = await fetchTokenPrice(stream.tokenSymbol);
    const usdPrice = price ?? 1;
    const ratePerSecondTokens = Number(stream.ratePerSecond) / 10 ** stream.tokenDecimals;
    const monthlyUSD = ratePerSecondTokens * 86400 * 30 * usdPrice;
    const plan = detectPlan(monthlyUSD);

    appendLogs([
      {
        id: `${Date.now()}-plan-connect`,
        ts: Date.now(),
        level: 'success',
        msg: `Plan on connect: ${plan.toUpperCase()} ($${monthlyUSD.toFixed(2)}/mo)`,
      },
    ]);

    setStream(stream);
    setPlan(plan);
    setStatus(plan);
  }

  /*  disconnect  */
  function disconnect() {
    setWallet(undefined);
    setChainId(undefined);
    setChainName(undefined);
    setStatus('no_wallet');
    setPlan('free');
    setStream(undefined);
    setError(undefined);
    clearLogs();
  }

  /*  permission helpers  */
  function can(feature: Feature) {
    const required = FEATURE_TIERS[feature];
    if (isDev) return true;
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
        currentPlan,
        error,
        isDev,
        logs,
        connect,
        disconnect,
        refresh,
        clearLogs,
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
