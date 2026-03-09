/**
 * SablierContext — Per-plan stream-based subscription gating
 *
 * SISTEM PLAN (3 tier):
 *
 *   FREE   → tidak perlu stream, fitur dasar
 *   BASIC  → stream ≥ $9.99/bulan  → Tools & Analysis
 *   PRO    → stream ≥ $29.99/bulan → semua fitur
 *
 * Cara kerja:
 *   1. User connect wallet (MetaMask / injected provider)
 *   2. App query Sablier subgraph — cari stream aktif dari user ke RECIPIENT_ADDRESS
 *   3. Cek depositAmount → tentukan plan (Basic atau Pro)
 *   4. Fitur di-gate sesuai plan
 *
 * SETUP:
 *   1. Ganti RECIPIENT_ADDRESS dengan treasury wallet kamu
 *   2. Set VITE_DEV_UNLOCK=true di .env untuk dev mode
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

// ─── Plan Tiers ───────────────────────────────────────────────────────────────

export type Plan = 'free' | 'basic' | 'pro';

/**
 * Minimum deposit (dalam USD cents, 6 desimal USDC) untuk setiap plan.
 * Contoh: basic = $9.99/bulan = 9_990_000 units USDC (6 dec)
 *
 * Formula: jumlah_usd * 10^6 = units USDC
 * Kalau pakai token 18 desimal (DAI), kalikan lagi * 10^12
 */
export const PLAN_MIN_DEPOSIT: Record<Exclude<Plan, 'free'>, bigint> = {
  basic: BigInt('9990000'), // $9.99 USDC (6 dec)
  pro: BigInt('29990000'), // $29.99 USDC (6 dec)
};

/**
 * Duration minimum dalam detik.
 * Stream harus punya durasi minimal ini untuk valid.
 * Default: 25 hari (sedikit di bawah 1 bulan, toleransi gas timing)
 */
export const PLAN_MIN_DURATION_SEC = 25 * 24 * 3600; // 25 hari

// ─── Feature → Plan Mapping ───────────────────────────────────────────────────

export type Feature =
  | 'accounts'
  | 'snapshots'
  | 'block_explorer'
  | 'security'
  | 'gas_profiler'
  | 'opcode_viewer'
  | 'contract_graph'
  | 'tx_graph'
  | 'analytics'
  | 'simulation_lab'
  | 'lp_simulator'
  | 'scenario_builder'
  | 'frontend_helper'
  | 'verify_contract'
  | 'abi_compat'
  | 'event_schema'
  | 'environment'
  | 'git'
  | 'docs'
  | 'erc_standards'
  | 'audit_notes'
  | 'notes'
  | 'debug'
  | 'erc20_reader'
  | 'nft_viewer';

/**
 * PETA FITUR → PLAN
 *
 * free  = semua user bisa akses
 * basic = butuh stream ≥ $9.99/bulan
 * pro   = butuh stream ≥ $29.99/bulan
 */
export const FEATURE_TIERS: Record<Feature, Plan> = {
  // ── FREE (tidak butuh stream) ──────────────────────────────────────────────
  accounts: 'free',
  environment: 'free',
  git: 'free',
  docs: 'free',
  notes: 'free',
  debug: 'free',
  erc_standards: 'free',
  block_explorer: 'free',

  // ── BASIC ($9.99/bulan) ── Tools & Analysis ────────────────────────────────
  security: 'basic',
  gas_profiler: 'basic',
  opcode_viewer: 'basic',
  snapshots: 'basic',
  erc20_reader: 'basic',
  nft_viewer: 'basic',
  verify_contract: 'basic',
  audit_notes: 'basic',

  // ── PRO ($29.99/bulan) ── Advanced & DeFi ─────────────────────────────────
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

/** Label & deskripsi per plan untuk UI */
export const PLAN_META: Record<
  Plan,
  { label: string; price: string; color: string; desc: string }
> = {
  free: { label: 'Free', price: '$0', color: 'text-muted-foreground', desc: 'Tools dasar Hardhat' },
  basic: { label: 'Basic', price: '$9.99', color: 'text-blue-400', desc: 'Tools & Analysis' },
  pro: { label: 'Pro', price: '$29.99', color: 'text-violet-400', desc: 'All Features + DeFi' },
};

// ─── Sablier Config ───────────────────────────────────────────────────────────

/**
 * Treasury address kamu — user harus stream KE address ini.
 * GANTI INI sebelum deploy ke production!
 */
export const RECIPIENT_ADDRESS = import.meta.env.VITE_RECIPIENT_ADDRESS;

/** Sablier V2 Subgraph per chain — source: https://docs.sablier.com/api/subgraphs/overview */
const SUBGRAPH_URLS: Record<number, string | null> = {
  137: 'https://api.thegraph.com/subgraphs/name/sablier-labs/sablier-v2-polygon',
  42161: 'https://api.thegraph.com/subgraphs/name/sablier-labs/sablier-v2-arbitrum',
  56: 'https://api.thegraph.com/subgraphs/name/sablier-labs/sablier-v2-bsc',
  10143: null, // Monad — belum ada subgraph
};

export const CHAIN_NAMES: Record<number, string> = {
  137: 'Polygon',
  42161: 'Arbitrum',
  56: 'BNB Chain',
  10143: 'Monad',
  1: 'Ethereum',
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type SubscriptionStatus =
  | 'loading' // sedang check
  | 'no_wallet' // belum connect wallet
  | 'no_stream' // wallet connect, tidak ada stream aktif
  | 'basic' // stream aktif, plan Basic
  | 'pro' // stream aktif, plan Pro
  | 'dev'; // VITE_DEV_UNLOCK=true

export interface StreamInfo {
  id: string;
  sender: string;
  tokenSymbol: string;
  tokenAddress: string;
  depositAmount: string;
  withdrawnAmount: string;
  startTime: number;
  endTime: number;
  chainId: number;
  chainName: string;
  detectedPlan: Plan;
}

interface SablierState {
  status: SubscriptionStatus;
  currentPlan: Plan;
  walletAddress: string | null;
  chainId: number | null;
  chainName: string | null;
  activeStream: StreamInfo | null;
  isDev: boolean;
  error: string | null;
}

interface SablierContextValue extends SablierState {
  can: (feature: Feature) => boolean;
  planFor: (feature: Feature) => Plan;
  connect: () => Promise<void>;
  disconnect: () => void;
  refresh: () => Promise<void>;
  checkUpdate: () => void;
  // backwards compat
  activate: (key: string) => Promise<{ success: boolean; error?: string }>;
  deactivate: () => void;
}

const SablierContext = createContext<SablierContextValue | null>(null);

export function useLicense() {
  const ctx = useContext(SablierContext);
  if (!ctx) throw new Error('useLicense must be inside SablierProvider / LicenseProvider');
  return ctx;
}
export { useLicense as useSablier };

// ─── Provider ─────────────────────────────────────────────────────────────────

export function SablierProvider({ children }: { children: ReactNode }) {
  const isDev = import.meta.env.VITE_DEV_UNLOCK === 'true';

  const [state, setState] = useState<SablierState>({
    status: isDev ? 'dev' : 'loading',
    currentPlan: isDev ? 'pro' : 'free',
    walletAddress: null,
    chainId: null,
    chainName: null,
    activeStream: null,
    isDev,
    error: null,
  });

  const connect = useCallback(async () => {
    if (isDev) return;
    const eth = (window as any).ethereum;
    if (!eth) {
      setState((s) => ({ ...s, status: 'no_wallet', error: 'No wallet found. Install MetaMask.' }));
      return;
    }
    try {
      setState((s) => ({ ...s, status: 'loading', error: null }));
      const accounts: string[] = await eth.request({ method: 'eth_requestAccounts' });
      const chainHex: string = await eth.request({ method: 'eth_chainId' });
      const address = accounts[0]?.toLowerCase() ?? null;
      const chainId = parseInt(chainHex, 16);
      if (!address) {
        setState((s) => ({ ...s, status: 'no_wallet' }));
        return;
      }
      try {
        localStorage.setItem('hs_wallet', address);
      } catch {}
      setState((s) => ({
        ...s,
        walletAddress: address,
        chainId,
        chainName: CHAIN_NAMES[chainId] ?? `Chain ${chainId}`,
      }));
      await _checkStreams(address, chainId, setState);
    } catch (e: any) {
      setState((s) => ({
        ...s,
        status: 'no_wallet',
        error: e?.code === 4001 ? 'Rejected by user.' : 'Failed to connect.',
      }));
    }
  }, [isDev]);

  const disconnect = useCallback(() => {
    try {
      localStorage.removeItem('hs_wallet');
    } catch {}
    setState((s) => ({
      ...s,
      status: 'no_wallet',
      currentPlan: 'free',
      walletAddress: null,
      chainId: null,
      chainName: null,
      activeStream: null,
      error: null,
    }));
  }, []);

  const refresh = useCallback(async () => {
    if (isDev || !state.walletAddress || !state.chainId) return;
    setState((s) => ({ ...s, status: 'loading', error: null }));
    await _checkStreams(state.walletAddress, state.chainId, setState);
  }, [isDev, state.walletAddress, state.chainId]);

  /**
   * can(feature) — cek apakah user boleh akses feature ini
   * Logic:
   *   dev    → semua boleh
   *   pro    → semua boleh
   *   basic  → hanya free + basic
   *   free   → hanya free
   */
  const can = useCallback(
    (feature: Feature): boolean => {
      if (state.isDev || state.status === 'dev') return true;
      const required = FEATURE_TIERS[feature];
      if (required === 'free') return true;
      if (required === 'basic') return state.currentPlan === 'basic' || state.currentPlan === 'pro';
      if (required === 'pro') return state.currentPlan === 'pro';
      return false;
    },
    [state],
  );

  const planFor = useCallback((feature: Feature): Plan => FEATURE_TIERS[feature], []);

  const checkUpdate = useCallback(() => {
    window.api?.checkForUpdate?.();
  }, []);
  const activate = useCallback(
    async (_key: string) => ({ success: false, error: 'Use Sablier stream to activate.' }),
    [],
  );
  const deactivate = useCallback(() => {
    disconnect();
  }, [disconnect]);

  // Auto-connect on load
  useEffect(() => {
    if (isDev) return;
    const eth = (window as any).ethereum;
    if (!eth) {
      setState((s) => ({ ...s, status: 'no_wallet' }));
      return;
    }

    const cached = localStorage.getItem('hs_wallet');
    if (cached) {
      eth
        .request({ method: 'eth_accounts' })
        .then(async (accounts: string[]) => {
          if (accounts.map((a: string) => a.toLowerCase()).includes(cached)) {
            const chainHex = await eth.request({ method: 'eth_chainId' });
            const chainId = parseInt(chainHex, 16);
            setState((s) => ({
              ...s,
              walletAddress: cached,
              chainId,
              chainName: CHAIN_NAMES[chainId] ?? `Chain ${chainId}`,
            }));
            await _checkStreams(cached, chainId, setState);
          } else {
            setState((s) => ({ ...s, status: 'no_wallet' }));
          }
        })
        .catch(() => setState((s) => ({ ...s, status: 'no_wallet' })));
    } else {
      setState((s) => ({ ...s, status: 'no_wallet' }));
    }

    const onAccountsChanged = async (accounts: string[]) => {
      if (!accounts.length) {
        disconnect();
        return;
      }
      const addr = accounts[0].toLowerCase();
      try {
        localStorage.setItem('hs_wallet', addr);
      } catch {}
      setState((s) => ({ ...s, walletAddress: addr, status: 'loading' }));
      const chainHex = await eth.request({ method: 'eth_chainId' });
      await _checkStreams(addr, parseInt(chainHex, 16), setState);
    };
    const onChainChanged = async (chainHex: string) => {
      const chainId = parseInt(chainHex, 16);
      setState((s) => ({
        ...s,
        chainId,
        chainName: CHAIN_NAMES[chainId] ?? `Chain ${chainId}`,
        status: 'loading',
      }));
      const addr = localStorage.getItem('hs_wallet');
      if (addr) await _checkStreams(addr, chainId, setState);
    };

    eth.on?.('accountsChanged', onAccountsChanged);
    eth.on?.('chainChanged', onChainChanged);
    return () => {
      eth.removeListener?.('accountsChanged', onAccountsChanged);
      eth.removeListener?.('chainChanged', onChainChanged);
    };
  }, [isDev, disconnect]);

  return (
    <SablierContext.Provider
      value={{
        ...state,
        can,
        planFor,
        connect,
        disconnect,
        refresh,
        checkUpdate,
        activate,
        deactivate,
      }}>
      {children}
    </SablierContext.Provider>
  );
}

export { SablierProvider as LicenseProvider };
export type { SubscriptionStatus as LicenseStatus };

// ─── Stream Check Logic ───────────────────────────────────────────────────────

type SetState = React.Dispatch<React.SetStateAction<SablierState>>;

async function _checkStreams(address: string, chainId: number, setState: SetState) {
  try {
    const stream = await queryBestStream(address, chainId);
    if (!stream) {
      setState((s) => ({
        ...s,
        status: 'no_stream' as SubscriptionStatus,
        currentPlan: 'free',
        activeStream: null,
        error: null,
      }));
      return;
    }
    const plan = stream.detectedPlan;
    const status: SubscriptionStatus = plan === 'pro' ? 'pro' : 'basic';
    setState((s) => ({
      ...s,
      status,
      currentPlan: plan,
      activeStream: stream,
      error: null,
    }));
  } catch (e: any) {
    setState((s) => ({
      ...s,
      status: 'no_stream' as SubscriptionStatus,
      currentPlan: 'free',
      activeStream: null,
      error: 'Failed to check streams: ' + (e?.message ?? ''),
    }));
  }
}

/**
 * Query semua stream aktif dari user → pilih yang terbaik (depositAmount terbesar)
 * Kemudian tentukan plan berdasarkan depositAmount.
 */
async function queryBestStream(sender: string, chainId: number): Promise<StreamInfo | null> {
  const subgraphUrl = SUBGRAPH_URLS[chainId];
  if (subgraphUrl === null) {
    console.warn(`[Sablier] No subgraph for chain ${chainId}.`);
    return null;
  }
  if (!subgraphUrl) return null;

  const nowSec = Math.floor(Date.now() / 1000);
  const minEnd = nowSec + PLAN_MIN_DURATION_SEC;

  // Ambil top-5 stream aktif, sort by depositAmount desc
  const query = `{
    streams(
      where: {
        sender: "${sender.toLowerCase()}"
        recipient: "${RECIPIENT_ADDRESS.toLowerCase()}"
        canceled: false
        endTime_gt: "${nowSec}"
      }
      orderBy: depositAmount
      orderDirection: desc
      first: 5
    ) {
      id
      sender
      endTime
      startTime
      depositAmount
      withdrawnAmount
      asset { id symbol decimals }
    }
  }`;

  const res = await fetch(subgraphUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) return null;

  const json = await res.json();
  const raw: any[] = json?.data?.streams ?? [];
  if (!raw.length) return null;

  // Pilih stream terbaik dan tentukan plannya
  for (const s of raw) {
    const decimals = Number(s.asset?.decimals ?? 6);
    const deposit = BigInt(s.depositAmount);
    const duration = Number(s.endTime) - Number(s.startTime);

    // Normalkan ke 6 desimal USDC untuk perbandingan
    const depositNorm =
      decimals >= 6
        ? deposit / BigInt(10 ** (decimals - 6))
        : deposit * BigInt(10 ** (6 - decimals));

    let detectedPlan: Plan = 'free';
    if (depositNorm >= PLAN_MIN_DEPOSIT.pro && duration >= PLAN_MIN_DURATION_SEC)
      detectedPlan = 'pro';
    else if (depositNorm >= PLAN_MIN_DEPOSIT.basic && duration >= PLAN_MIN_DURATION_SEC)
      detectedPlan = 'basic';

    if (detectedPlan !== 'free') {
      return {
        id: s.id,
        sender: s.sender,
        tokenSymbol: s.asset?.symbol ?? 'TOKEN',
        tokenAddress: s.asset?.id ?? '',
        depositAmount: s.depositAmount,
        withdrawnAmount: s.withdrawnAmount,
        startTime: Number(s.startTime),
        endTime: Number(s.endTime),
        chainId,
        chainName: CHAIN_NAMES[chainId] ?? `Chain ${chainId}`,
        detectedPlan,
      };
    }
  }
  return null;
}
