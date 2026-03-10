//
//  LICENSE PROVIDER — React context that wires everything together
//

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from 'react';

import type { Plan, Status, Feature, LogEntry, ActiveStream, LicenseContextType } from './types';

import {
  IS_DEV_UNLOCK,
  IS_TESTNET_MODE,
  STREAM_POLL_INTERVAL_MS,
  PLAN_CONFIG,
  FEATURE_TIERS,
  detectPlan,
} from './config/planConfig';

import { CHAIN_NAMES, SABLIER_FLOW_CONTRACTS } from './config/chainConfig';
import { fetchTokenPrice } from './lib/tokenPrice';
import { queryStreams } from './lib/queryStreams';
import { encodePause, encodeRestart, parseStreamNumericId } from './lib/contractUtils';

// Discord — config + role helpers (adjust path to your discord.config location)
import { DISCORD_RULES, getDiscordBypassPlan } from '../discord/config/discord.config';
import { clearRoleCache, resolveMatchedRules } from '../discord/libs/discord.role.lib';
// import { resolveMatchedRules, clearRoleCache } from '../discord/lib/discordRoles';

//  Context
const LicenseContext = createContext<LicenseContextType | null>(null);

//  Helper to create a log entry
function mkLog(level: LogEntry['level'], msg: string, data?: unknown): LogEntry {
  return { id: `${Date.now()}-${Math.random()}`, ts: Date.now(), level, msg, data };
}

//
//  PROVIDER
//
export function LicenseProvider({ children }: { children: ReactNode }) {
  //  Core state
  const [walletAddress, setWallet] = useState<string>();
  const [chainId, setChainId] = useState<number>();
  const [chainName, setChainName] = useState<string>();
  const [status, setStatus] = useState<Status>('no_wallet');
  const [currentPlan, setPlan] = useState<Plan>('free');
  const [activeStream, setStream] = useState<ActiveStream>();
  const [availableStreams, setAvailableStreams] = useState<ActiveStream[]>([]);
  const [selectedStreamId, setSelectedStreamId] = useState<string | null>(null);
  const [tokenPrice, setTokenPrice] = useState<number | null>(null);
  const [error, setError] = useState<string>();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [lastChecked, setLastChecked] = useState<number>();
  const [streamRevoked, setStreamRevoked] = useState(false);
  const [streamActionPending, setStreamActionPending] = useState(false);
  const [selectedChainId, setSelectedChainId] = useState<number | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const priceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isDev = IS_DEV_UNLOCK;

  //  Log helpers
  const appendLogs = (entries: LogEntry[]) => setLogs((prev) => [...prev, ...entries]);
  function clearLogs() {
    setLogs([]);
  }

  //  Price polling
  const startPricePolling = useCallback((symbol: string) => {
    if (priceIntervalRef.current) clearInterval(priceIntervalRef.current);
    const doFetch = async () => {
      const price = await fetchTokenPrice(symbol);
      if (price != null) setTokenPrice(price);
    };
    doFetch();
    priceIntervalRef.current = setInterval(doFetch, 5 * 60 * 1000);
  }, []);

  //  applyStreamStatus
  const applyStreamStatus = useCallback(
    async (chosen: ActiveStream) => {
      const price = await fetchTokenPrice(chosen.tokenSymbol);
      const usdPrice = price ?? 1;
      if (price != null) setTokenPrice(price);

      const ratePerSecondTokens = Number(chosen.ratePerSecond) / 10 ** chosen.tokenDecimals;
      const monthlyUSD = ratePerSecondTokens * 86_400 * 30 * usdPrice;
      const plan = detectPlan(monthlyUSD);

      appendLogs([
        mkLog(
          'success',
          `Stream accepted: ${chosen.streamAlias} — ${chosen.tokenSymbol} ${(ratePerSecondTokens * 86_400 * 30).toFixed(6)}/mo ≈ $${monthlyUSD.toFixed(4)}/mo → plan: ${plan}`,
        ),
      ]);

      if (chosen.paused) {
        appendLogs([mkLog('warn', '[Security] Stream paused — features locked until resumed')]);
        setStatus('paused');
        setPlan('free');
      } else if (chosen.hasDebt) {
        appendLogs([mkLog('warn', '[Security] Stream has debt — features locked until topped up')]);
        setStatus('debt');
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

  //  applyStreams
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
      const preferred = preserveSelectedId ?? selectedStreamId;
      const found = streams.find((s) => s.streamId === preferred);
      const firstHealthy = streams.find((s) => !s.paused && !s.hasDebt);
      const chosen = found ?? firstHealthy ?? streams[0];
      setSelectedStreamId(chosen.streamId);
      await applyStreamStatus(chosen);
    },
    [selectedStreamId, applyStreamStatus],
  );

  //  selectStream
  const selectStream = useCallback(
    async (streamId: string) => {
      const found = availableStreams.find((s) => s.streamId === streamId);
      if (!found) {
        appendLogs([mkLog('warn', `[Stream] selectStream: ID not found: ${streamId}`)]);
        return;
      }
      setSelectedStreamId(streamId);
      appendLogs([
        mkLog(
          'info',
          `[Stream] User selected ${found.streamAlias} — ${found.tokenSymbol} on ${found.chainName}`,
        ),
      ]);
      await applyStreamStatus(found);
    },
    [availableStreams, applyStreamStatus],
  );

  //  refresh
  async function refresh() {
    if (!walletAddress || !chainId) return;
    const resolvedName = chainName ?? CHAIN_NAMES[chainId] ?? `Chain ${chainId}`;
    setStatus('loading');
    setError(undefined);
    appendLogs([mkLog('info', 'Refreshing streams…')]);
    const { streams, logs: qLogs } = await queryStreams(
      walletAddress,
      chainId,
      resolvedName,
      selectedChainId,
    );
    appendLogs(qLogs);
    setLastChecked(Date.now());
    await applyStreams(streams, selectedStreamId);
  }

  //  connect
  async function connect(addr: string, cid: number) {
    const name = CHAIN_NAMES[cid] ?? `Chain ${cid}`;
    setWallet(addr);
    setChainId(cid);
    setChainName(name);
    clearLogs();
    appendLogs([
      mkLog('info', `Wallet connected: ${addr.slice(0, 6)}…${addr.slice(-4)} on ${name}`),
    ]);

    if (isDev) {
      appendLogs([mkLog('success', '[Dev Mode] All features unlocked')]);
      setStatus('dev');
      setPlan('pro');
      return;
    }

    setStatus('loading');
    setError(undefined);

    if (IS_TESTNET_MODE) {
      appendLogs([
        mkLog(
          'info',
          `[Testnet] Threshold $${PLAN_CONFIG.basic.monthlyUSD}/$${PLAN_CONFIG.pro.monthlyUSD}`,
        ),
      ]);
    }

    const { streams, logs: qLogs } = await queryStreams(addr, cid, name, selectedChainId);
    appendLogs(qLogs);
    setLastChecked(Date.now());

    if (streams.length === 0) {
      appendLogs([mkLog('warn', 'No active stream found → plan: Free')]);
      setStatus('free');
      setPlan('free');
      return;
    }

    appendLogs([mkLog('success', `Found ${streams.length} stream(s) for recipient`)]);
    await applyStreams(streams, null);
  }

  //  Sablier transaction sender
  async function sendSablierTx(calldata: string, actionLabel: string): Promise<void> {
    if (!walletAddress || !chainId) throw new Error('Wallet not connected.');
    if (!activeStream) throw new Error('No active stream.');

    const streamChainId = activeStream.chainId;
    const contractAddr = SABLIER_FLOW_CONTRACTS[streamChainId];

    if (!contractAddr || contractAddr === '0x0000000000000000000000000000000000000000') {
      throw new Error(`Sablier Flow contract not found for chainId ${streamChainId}.`);
    }

    appendLogs([
      mkLog('info', `[Sablier] Sending ${actionLabel}…`, {
        to: contractAddr,
        chainId: streamChainId,
      }),
    ]);

    let txHash: string;
    const api = (window as any).api;

    if (api?.wcSendTransaction) {
      const hasSession = (await api.wcHasSession?.()) ?? false;
      if (!hasSession) throw new Error('No active WalletConnect session. Please re-scan QR.');
      const result = await api.wcSendTransaction({
        from: walletAddress,
        to: contractAddr,
        data: calldata,
        chainId: streamChainId,
      });
      if ('error' in result) throw new Error(`WalletConnect tx failed: ${result.error}`);
      txHash = result.txHash;
    } else {
      const eth = (window as any).ethereum;
      if (!eth) throw new Error('No provider found. Install MetaMask or use WalletConnect.');
      txHash = await eth.request({
        method: 'eth_sendTransaction',
        params: [{ from: walletAddress, to: contractAddr, data: calldata }],
      });
    }

    appendLogs([mkLog('success', `[Sablier] ${actionLabel} tx sent: ${txHash}`, { txHash })]);
    await new Promise((r) => setTimeout(r, 4000));
    await refresh();
  }

  //  pauseStream
  async function pauseStream(): Promise<void> {
    if (!activeStream) throw new Error('No active stream to pause.');
    const numId = parseStreamNumericId(activeStream);
    if (numId === null) throw new Error(`Cannot parse stream ID: ${activeStream.streamAlias}`);
    setStreamActionPending(true);
    appendLogs([mkLog('info', `[Pause] Stream ${activeStream.streamAlias} (ID: ${numId})`)]);
    try {
      await sendSablierTx(encodePause(numId), 'pause');
    } catch (err: any) {
      appendLogs([mkLog('error', `[Pause] Failed: ${err.message ?? String(err)}`)]);
      throw err;
    } finally {
      setStreamActionPending(false);
    }
  }

  //  resumeStream
  async function resumeStream(): Promise<void> {
    if (!activeStream) throw new Error('No paused stream to resume.');
    const numId = parseStreamNumericId(activeStream);
    if (numId === null) throw new Error(`Cannot parse stream ID: ${activeStream.streamAlias}`);
    setStreamActionPending(true);
    appendLogs([
      mkLog(
        'info',
        `[Resume] Stream ${activeStream.streamAlias} (ID: ${numId}) rate: ${activeStream.ratePerSecond}`,
      ),
    ]);
    try {
      await sendSablierTx(encodeRestart(numId, activeStream.ratePerSecond), 'restart');
    } catch (err: any) {
      appendLogs([mkLog('error', `[Resume] Failed: ${err.message ?? String(err)}`)]);
      throw err;
    } finally {
      setStreamActionPending(false);
    }
  }

  //  logout / disconnect
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
    appendLogs([mkLog('info', 'Logged out — wallet disconnected')]);
  }

  const disconnect = logout;

  //  Persist session
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
      if (Date.now() - session.ts > 86_400_000) {
        localStorage.removeItem('sablier_session');
        return;
      }
      setSelectedChainId(session.selectedChainId ?? null);
      connect(session.walletAddress, session.chainId).catch(() =>
        localStorage.removeItem('sablier_session'),
      );
    } catch {
      /* ignore */
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      /* ignore */
    }
  }, [walletAddress, chainId, chainName, currentPlan, status, selectedChainId]);

  //  Auto-poll
  useEffect(() => {
    if (!walletAddress || !chainId || isDev) return;
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      const resolvedName = chainName ?? CHAIN_NAMES[chainId] ?? `Chain ${chainId}`;
      appendLogs([mkLog('debug', '[Auto-check] Checking stream status…')]);
      const { streams, logs: qLogs } = await queryStreams(
        walletAddress,
        chainId,
        resolvedName,
        null,
      );
      appendLogs(qLogs);
      setLastChecked(Date.now());

      if (streams.length === 0) {
        appendLogs([mkLog('error', '[Security] No streams found — downgrading to Free')]);
        setStreamRevoked(true);
        setStatus('free');
        setPlan('free');
        setStream(undefined);
        setAvailableStreams([]);
        return;
      }

      setAvailableStreams(streams);
      const freshSelected = streams.find((s) => s.streamId === selectedStreamId);
      if (!freshSelected) {
        appendLogs([
          mkLog('warn', '[Security] Selected stream gone — switching to best available'),
        ]);
        const best = streams.find((s) => !s.paused && !s.hasDebt) ?? streams[0];
        setSelectedStreamId(best.streamId);
        await applyStreamStatus(best);
        return;
      }
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

  // ── Discord role-based bypass ───────────────────────────────────────────────
  // discordBypassPlan is 'free' | 'basic' | 'pro' based on actual guild role.
  // 'free' = not logged in OR logged in but no matching role in any DISCORD_RULES guild.
  const [discordBypassPlan, setDiscordBypassPlan] = useState<Plan>('free');

  const refreshDiscordStatus = useCallback(async () => {
    if (DISCORD_RULES.length === 0) return;
    const api = (window as any).api;
    if (!api?.getUser) return;
    try {
      const user = await api.getUser();
      if (!user?.id) {
        setDiscordBypassPlan('free');
        return;
      }
      clearRoleCache();
      const matched = await resolveMatchedRules(user.id, DISCORD_RULES);
      setDiscordBypassPlan(getDiscordBypassPlan(matched));
    } catch {
      setDiscordBypassPlan('free');
    }
  }, []);

  // Check on mount
  useEffect(() => {
    refreshDiscordStatus();
  }, [refreshDiscordStatus]);

  // Expose as boolean for context consumers that just need "is bypassed"
  const isDiscordLoggedIn = discordBypassPlan !== 'free';

  // ── Permission helpers ──────────────────────────────────────────────────────
  function can(feature: Feature): boolean {
    const required = FEATURE_TIERS[feature];

    // 1. Dev unlock — highest priority
    if (isDev) return true;

    // 2. Discord role bypass
    if (discordBypassPlan === 'pro') return true;
    if (discordBypassPlan === 'basic') return required === 'free' || required === 'basic';

    // 3. Stream-based access (normal flow)
    if (activeStream?.paused || activeStream?.hasDebt) return required === 'free';
    if (status === 'debt' || status === 'paused') return required === 'free';
    if (required === 'free') return true;
    if (required === 'basic') return currentPlan === 'basic' || currentPlan === 'pro';
    if (required === 'pro') return currentPlan === 'pro';
    return false;
  }

  function planFor(feature: Feature): Plan {
    return FEATURE_TIERS[feature];
  }

  //  Render
  return (
    <LicenseContext.Provider
      value={{
        status,
        walletAddress,
        chainId,
        chainName,
        currentPlan,
        activeStream,
        availableStreams,
        selectedStreamId,
        selectStream,
        tokenPrice,
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
        isDiscordLoggedIn,
        refreshDiscordStatus,
      }}>
      {children}
    </LicenseContext.Provider>
  );
}

//  Hook
export function useLicense(): LicenseContextType {
  const ctx = useContext(LicenseContext);
  if (!ctx) throw new Error('useLicense must be used inside <LicenseProvider>');
  return ctx;
}
