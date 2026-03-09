/**
 * SablierContext — Per-plan stream-based subscription gating
 *
 * SISTEM PLAN (3 tier):
 *   FREE   → tidak perlu stream, fitur dasar
 *   BASIC  → stream ≥ $9.99/bulan  → Tools & Analysis
 *   PRO    → stream ≥ $29.99/bulan → semua fitur
 *
 * ENV VARS (.env):
 *   VITE_DEV_UNLOCK=true          → unlock semua fitur tanpa stream (dev only)
 *   VITE_NODE_ENV=development     → aktifkan testnet mode (deposit threshold dikecilkan, default chain = Sepolia)
 *   VITE_NODE_ENV=production      → mainnet only (default)
 *   VITE_RECIPIENT_ADDRESS=0x...  → treasury wallet tujuan stream
 *
 * Di production build (electron-builder / vite build), set:
 *   VITE_NODE_ENV=production
 * Di development (npm run dev), set:
 *   VITE_NODE_ENV=development
 *
 * TESTNET MODE (VITE_NODE_ENV=development):
 *   - Default chain: Sepolia (chainId 11155111)
 *   - Deposit threshold dikecilkan: basic=$0.01, pro=$0.02 (buat testing)
 *   - Durasi minimum: 1 hari (bukan 25 hari)
 *   - Semua chain testnet tersedia di dropdown
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

// ─── Plan Tiers ───────────────────────────────────────────────────────────────

export type Plan = 'free' | 'basic' | 'pro';

/**
 * IS_TESTNET_MODE — true jika VITE_NODE_ENV=development
 *
 * Digunakan untuk:
 *   - Mengecilkan deposit threshold (biar bisa test dengan token testnet murah)
 *   - Memperpendek durasi minimum stream
 *   - Default chain ke Sepolia di UI
 */
export const IS_TESTNET_MODE = import.meta.env.VITE_NODE_ENV === 'development';

/**
 * Minimum deposit per plan (USDC, 6 desimal).
 *
 * Production: nilai normal ($9.99 / $29.99)
 * Development/testnet: nilai kecil ($0.01 / $0.02) supaya mudah di-test
 *
 * Formula: jumlah_usd * 10^6 = units USDC
 */
export const PLAN_MIN_DEPOSIT: Record<Exclude<Plan, 'free'>, bigint> = IS_TESTNET_MODE
  ? {
      basic: BigInt('10000'), // $0.01 USDC — testnet
      pro: BigInt('20000'), // $0.02 USDC — testnet
    }
  : {
      basic: BigInt('9990000'), // $9.99 USDC — production
      pro: BigInt('29990000'), // $29.99 USDC — production
    };

/**
 * Duration minimum stream dalam detik.
 *
 * Production: 25 hari (toleransi gas timing, sedikit di bawah 1 bulan)
 * Development/testnet: 1 hari (biar mudah di-test)
 */
export const PLAN_MIN_DURATION_SEC = IS_TESTNET_MODE
  ? 1 * 24 * 3600 // 1 hari — testnet
  : 25 * 24 * 3600; // 25 hari — production

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

/**
 * Sablier Lockup Subgraph endpoints — updated 2024
 *
 * The Graph hosted service (api.thegraph.com/subgraphs/name/...) was SHUT DOWN.
 * Sablier migrated to:
 *   - The Graph Studio: per-chain, FREE testing URL (3000 req/day, no key needed)
 *   - Envio HyperIndex: single multi-chain endpoint, FREE, no API key needed
 *
 * Strategy: try Studio per-chain first, fallback to Envio for unsupported chains.
 * Source: https://docs.sablier.com/api/lockup/indexers
 */

// The Graph Studio — per-chain, free, no key needed (rate-limited 3000/day)
const STUDIO_URLS: Record<number, string> = {
  // ── Mainnets ──────────────────────────────────────────────────────────────
  1: 'https://api.studio.thegraph.com/query/57079/sablier/version/latest',
  137: 'https://api.studio.thegraph.com/query/57079/sablier-matic/version/latest',
  42161: 'https://api.studio.thegraph.com/query/57079/sablier-arbitrum/version/latest',
  56: 'https://api.studio.thegraph.com/query/57079/sablier-bsc/version/latest',
  10: 'https://api.studio.thegraph.com/query/57079/sablier-optimism/version/latest',
  8453: 'https://api.studio.thegraph.com/query/57079/sablier-base/version/latest',
  // ── Testnets ──────────────────────────────────────────────────────────────
  11155111: 'https://api.studio.thegraph.com/query/57079/sablier-sepolia/version/latest',
  84532: 'https://api.studio.thegraph.com/query/57079/sablier-base-sepolia/version/latest',
  421614: 'https://api.studio.thegraph.com/query/57079/sablier-arbitrum-sepolia/version/latest',
  11155420: 'https://api.studio.thegraph.com/query/57079/sablier-optimism-sepolia/version/latest',
};

// Envio Lockup HyperIndex — multi-chain, no key needed, covers Monad + all chains
// See: https://envio.dev/app/sablier-labs/lockup-envio
export const ENVIO_URL = 'https://indexer.hyperindex.xyz/c1c8e48/v1/graphql';

export const CHAIN_NAMES: Record<number, string> = {
  // ── Mainnets ──────────────────────────────────────────────────────────────
  1: 'Ethereum',
  137: 'Polygon',
  42161: 'Arbitrum',
  56: 'BNB Chain',
  10: 'Optimism',
  8453: 'Base',
  10143: 'Monad',
  // ── Testnets ──────────────────────────────────────────────────────────────
  11155111: 'Sepolia',
  84532: 'Base Sepolia',
  421614: 'Arbitrum Sepolia',
  11155420: 'Optimism Sepolia',
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
  connect: (manualAddress?: string, manualChainId?: number) => Promise<void>;
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

  /**
   * connect(address?, chainId?) — dua mode:
   *
   * Mode A — tanpa argumen:
   *   Electron tidak punya window.ethereum (MetaMask hanya inject ke browser).
   *   Coba window.ethereum dulu (jika ada — dev via Vite browser mode),
   *   lalu fallback ke status 'no_wallet' supaya UI bisa tampilkan input manual.
   *
   * Mode B — dengan argumen (dari manual address input di UI):
   *   Langsung set address + chainId dan query subgraph.
   */
  const connect = useCallback(
    async (manualAddress?: string, manualChainId?: number) => {
      if (isDev) return;

      // Mode B — manual address dari input UI
      if (manualAddress) {
        const address = manualAddress.trim().toLowerCase();
        if (!/^0x[0-9a-f]{40}$/.test(address)) {
          setState((s) => ({
            ...s,
            status: 'no_wallet',
            error: 'Alamat wallet tidak valid (harus 0x + 40 hex).',
          }));
          return;
        }
        const chainId = manualChainId ?? 137; // default Polygon
        try {
          localStorage.setItem('hs_wallet', address);
        } catch {}
        setState((s) => ({
          ...s,
          status: 'loading',
          error: null,
          walletAddress: address,
          chainId,
          chainName: CHAIN_NAMES[chainId] ?? `Chain ${chainId}`,
        }));
        await _checkStreams(address, chainId, setState);
        return;
      }

      // Mode A — coba window.ethereum (hanya ada di browser dev, bukan Electron prod)
      const eth = (window as any).ethereum;
      if (!eth) {
        // Di Electron, window.ethereum tidak ada — tampilkan UI input manual
        setState((s) => ({
          ...s,
          status: 'no_wallet',
          error: null, // bukan error, UI akan tampilkan input manual
        }));
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
          error: e?.code === 4001 ? 'Ditolak user.' : 'Gagal connect.',
        }));
      }
    },
    [isDev],
  );

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
 * Primary: The Graph Studio (per-chain, confirmed URLs, no key needed)
 * Fallback: Envio HyperIndex (multi-chain, covers Monad & chains not in Studio)
 *
 * NOTE: Envio uses different GraphQL syntax from The Graph:
 *   - `Stream(where: {chainId: {_eq: "137"}})` instead of `streams(where: {...})`
 *   - `limit` instead of `first`
 *   - asset_id, asset: { symbol, decimals } nested differently
 */
/**
 * queryBestStream — cek Lockup DAN Flow streams dari user
 *
 * Sablier punya dua protokol berbeda:
 *   - Lockup (LL/LD/LT/LK): stream dengan endTime tetap, pakai `depositAmount`
 *   - Flow (FL): stream open-ended tanpa endTime, pakai `ratePerSecond` + `balance`
 *
 * User di screenshot pakai FL3 (SablierFlow) — harus support keduanya.
 *
 * Plan detection:
 *   Lockup → normalize depositAmount ke USD 6-dec, bandingkan dengan PLAN_MIN_DEPOSIT
 *   Flow   → hitung monthly rate dari ratePerSecond, bandingkan dengan PLAN_MIN_DEPOSIT
 */
async function queryBestStream(sender: string, chainId: number): Promise<StreamInfo | null> {
  const studioUrl = STUDIO_URLS[chainId];

  // Query Lockup dan Flow secara paralel untuk kecepatan
  const [lockupResult, flowResult] = await Promise.allSettled([
    studioUrl ? queryLockupStudio(sender, chainId, studioUrl) : Promise.resolve(null),
    studioUrl ? queryFlowStudio(sender, chainId, studioUrl) : Promise.resolve(null),
  ]);

  const lockup = lockupResult.status === 'fulfilled' ? lockupResult.value : null;
  const flow = flowResult.status === 'fulfilled' ? flowResult.value : null;

  // Pilih yang plan-nya lebih tinggi
  const PLAN_RANK: Record<Plan, number> = { free: 0, basic: 1, pro: 2 };
  if (lockup && flow) {
    return PLAN_RANK[lockup.detectedPlan] >= PLAN_RANK[flow.detectedPlan] ? lockup : flow;
  }
  return lockup ?? flow ?? null;
}

// ─── Lockup Stream Query ───────────────────────────────────────────────────────
// Entity: streams — punya endTime tetap, depositAmount total, withdrawn, dll.

async function queryLockupStudio(
  sender: string,
  chainId: number,
  url: string,
): Promise<StreamInfo | null> {
  const nowSec = Math.floor(Date.now() / 1000);
  const recipient = RECIPIENT_ADDRESS.toLowerCase();

  const query = `{
    streams(
      where: {
        sender: "${sender.toLowerCase()}"
        recipient: "${recipient}"
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

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) return null;

  const json = await res.json();
  const raw: any[] = json?.data?.streams ?? [];

  for (const s of raw) {
    const decimals = Number(s.asset?.decimals ?? 6);
    const deposit = BigInt(s.depositAmount ?? '0');
    const duration = Number(s.endTime) - Number(s.startTime);

    // Normalize ke 6-decimal USDC untuk perbandingan
    const depositNorm = normalizeToUsdc(deposit, decimals);

    const detectedPlan = detectPlan(depositNorm, duration);
    if (detectedPlan === 'free') continue;

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
  return null;
}

// ─── Flow Stream Query ─────────────────────────────────────────────────────────
// Entity: flows — open-ended stream tanpa endTime tetap.
// Field kunci: ratePerSecond (token/detik yang di-stream), balance (saldo tersisa)
//
// Plan detection untuk Flow:
//   monthly_rate_usdc = ratePerSecond * 30 * 24 * 3600  (normalize ke 6-dec)
//   Kalau monthly_rate >= PLAN_MIN_DEPOSIT → plan valid
//   Durasi "effective" = balance / ratePerSecond (berapa detik lagi bisa jalan)

async function queryFlowStudio(
  sender: string,
  chainId: number,
  url: string,
): Promise<StreamInfo | null> {
  const nowSec = Math.floor(Date.now() / 1000);
  const recipient = RECIPIENT_ADDRESS.toLowerCase();

  // Flow entity di subgraph sablier-matic/sablier-arbitrum/dll
  const query = `{
    flows(
      where: {
        sender: "${sender.toLowerCase()}"
        recipient: "${recipient}"
        paused: false
        voided: false
      }
      orderBy: ratePerSecond
      orderDirection: desc
      first: 5
    ) {
      id
      sender
      ratePerSecond
      balance
      depositedAmount
      withdrawnAmount
      snapshotTime
      asset { id symbol decimals }
    }
  }`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) return null;

  const json = await res.json();
  if (json?.errors) return null; // endpoint tidak support flows — skip
  const raw: any[] = json?.data?.flows ?? [];

  for (const s of raw) {
    const decimals = Number(s.asset?.decimals ?? 18);
    const rps = BigInt(s.ratePerSecond ?? '0'); // token/detik dalam raw units
    const balance = BigInt(s.balance ?? '0'); // saldo tersisa di stream

    // Effective duration — berapa detik lagi stream bisa jalan dengan saldo sekarang
    const effectiveDuration = rps > 0n ? Number(balance / rps) : 0;

    // Monthly rate dalam raw token units
    const SECS_PER_MONTH = 30 * 24 * 3600;
    const monthlyRaw = rps * BigInt(SECS_PER_MONTH);

    // Normalize ke 6-decimal USDC untuk perbandingan dengan PLAN_MIN_DEPOSIT
    const monthlyNorm = normalizeToUsdc(monthlyRaw, decimals);

    const detectedPlan = detectPlan(monthlyNorm, effectiveDuration);
    if (detectedPlan === 'free') continue;

    // Untuk display, hitung "virtual" endTime dari balance yang tersisa
    const virtualEndTime = nowSec + effectiveDuration;

    return {
      id: s.id,
      sender: s.sender,
      tokenSymbol: s.asset?.symbol ?? 'TOKEN',
      tokenAddress: s.asset?.id ?? '',
      depositAmount: s.depositedAmount ?? s.balance,
      withdrawnAmount: s.withdrawnAmount ?? '0',
      startTime: Number(s.snapshotTime ?? nowSec),
      endTime: virtualEndTime,
      chainId,
      chainName: CHAIN_NAMES[chainId] ?? `Chain ${chainId}`,
      detectedPlan,
    };
  }
  return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Normalize token amount ke 6-decimal USDC units untuk perbandingan plan */
function normalizeToUsdc(amount: bigint, decimals: number): bigint {
  if (decimals === 6) return amount;
  if (decimals > 6) return amount / BigInt(10 ** (decimals - 6));
  return amount * BigInt(10 ** (6 - decimals));
}

/** Tentukan plan dari amount (sudah dinormalisasi ke 6-dec) dan durasi (detik) */
function detectPlan(amountNorm: bigint, durationSec: number): Plan {
  if (amountNorm >= PLAN_MIN_DEPOSIT.pro && durationSec >= PLAN_MIN_DURATION_SEC) return 'pro';
  if (amountNorm >= PLAN_MIN_DEPOSIT.basic && durationSec >= PLAN_MIN_DURATION_SEC) return 'basic';
  return 'free';
}
