//
//  LicenseModal — wallet connect + plan selection + stream management
//
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Wallet,
  CheckCircle,
  X,
  ExternalLink,
  Shield,
  RefreshCw,
  LogOut,
  Activity,
  AlertCircle,
  Crown,
  Star,
  Zap,
  ArrowRight,
  Droplets,
} from 'lucide-react';
import {
  useLicense,
  PLAN_META,
  PLAN_MIN_DEPOSIT,
  FEATURE_TIERS,
  RECIPIENT_ADDRESS,
  IS_TESTNET_MODE,
  THEGRAPH_ENDPOINTS,
  CHAIN_NAMES,
  Plan,
} from '@/integrations/license';
import { Button } from '../../../components/ui/button';
import { cn } from '@/lib/utils';
import { PlanIcon, StepCard, StreamProgressBar, DebugLogPanel } from './ui/Primitives';
import { InlineWcQr } from './ui/InlineWcQr';
import { NetworkManager } from './ui/NetworkManager';
import { FEATURE_GROUPS, TESTNET_IDS, fmt, openSablier } from '../config/constants';

const CHAIN_MAP_ICONS: Record<number, string> = {
  1: '🔵',
  137: '🟣',
  42161: '🔷',
  8453: '🟦',
  10: '🔴',
  56: '🟡',
  43114: '🔺',
  534352: '📜',
  100: '🍀',
  59144: '🔵',
  146: '🔊',
  11155111: '🧪',
  84532: '🧪',
  421614: '🧪',
  11155420: '🧪',
};

export function LicenseModal({ onClose }: { onClose: () => void }) {
  const {
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
    isDev,
    error,
    connect,
    logout,
    refresh,
    pauseStream,
    resumeStream,
    streamActionPending,
    selectedChainId,
    setSelectedChainId,
  } = useLicense();

  const [refreshing, setRefreshing] = useState(false);
  const [streamAction, setStreamAction] = useState<'pause' | 'resume' | null>(null);
  const [streamActionError, setStreamActionError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'status' | 'plans' | 'networks'>('status');
  const [wcQrUri, setWcQrUri] = useState<string | null>(null);
  const [wcQrLoading, setWcQrLoading] = useState(false);
  const [wcQrError, setWcQrError] = useState<string | null>(null);
  const wcPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isConnected = !!walletAddress;
  const hasPaidPlan = status === 'basic' || status === 'pro' || isDev;
  const hasLockedStream = (status as string) === 'paused' || (status as string) === 'debt';
  const showStreamCard = hasPaidPlan || hasLockedStream;

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const handlePause = async () => {
    setStreamAction('pause');
    setStreamActionError(null);
    try {
      await pauseStream();
    } catch (e: any) {
      setStreamActionError(e.message ?? 'Pause failed');
    } finally {
      setStreamAction(null);
    }
  };
  const handleResume = async () => {
    setStreamAction('resume');
    setStreamActionError(null);
    try {
      await resumeStream();
    } catch (e: any) {
      setStreamActionError(e.message ?? 'Resume failed');
    } finally {
      setStreamAction(null);
    }
  };

  const handleWalletConnect = useCallback(async () => {
    const api = (window as any).api;
    if (wcQrUri || wcQrLoading) {
      setWcQrUri(null);
      setWcQrError(null);
      setWcQrLoading(false);
      if (wcPollRef.current) clearInterval(wcPollRef.current);
      return;
    }
    if (!api?.wcGetUri) {
      const addr = window.prompt('Enter wallet address (0x...):');
      if (addr && /^0x[0-9a-fA-F]{40}$/.test(addr.trim()))
        await connect(addr.trim(), IS_TESTNET_MODE ? 11155111 : 137);
      return;
    }
    setWcQrLoading(true);
    setWcQrUri(null);
    setWcQrError(null);
    try {
      const res = await api.wcGetUri();
      if (!res || res.error) {
        setWcQrError(
          res?.error === 'NO_PROJECT_ID'
            ? 'Set VITE_WC_PROJECT_ID di .env'
            : `WC error: ${res?.error ?? 'unknown'}`,
        );
        setWcQrLoading(false);
        return;
      }
      setWcQrUri(res.uri);
      setWcQrLoading(false);
      if (wcPollRef.current) clearInterval(wcPollRef.current);
      wcPollRef.current = setInterval(async () => {
        try {
          const p = await api.wcPollResult?.();
          if (p?.address) {
            clearInterval(wcPollRef.current!);
            wcPollRef.current = null;
            setWcQrUri(null);
            setWcQrError(null);
            await connect(p.address, p.chainId);
          }
        } catch {}
      }, 1000);
    } catch (e: any) {
      setWcQrError(e?.message ?? 'Gagal generate QR');
      setWcQrLoading(false);
    }
  }, [wcQrUri, wcQrLoading, connect]);

  useEffect(() => {
    const api = (window as any).api;
    if (!api?.onWcApproved) return;
    const unsub = api.onWcApproved(async (result: { address: string; chainId: number }) => {
      if (result?.address) {
        if (wcPollRef.current) {
          clearInterval(wcPollRef.current);
          wcPollRef.current = null;
        }
        setWcQrUri(null);
        setWcQrError(null);
        setWcQrLoading(false);
        await connect(result.address, result.chainId);
      }
    });
    return () => unsub?.();
  }, [connect]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-md">
      <div className="relative w-full max-w-[460px] mx-4 bg-card border border-border rounded-2xl shadow-2xl shadow-black/60 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-violet-500/60 to-transparent" />

        {/* Header */}
        <div className="flex items-center flex-shrink-0 gap-3 px-5 py-4 border-b border-border/50">
          <div
            className={cn(
              'flex items-center justify-center w-8 h-8 rounded-lg border',
              hasPaidPlan
                ? 'bg-emerald-500/15 border-emerald-500/25'
                : 'bg-violet-500/15 border-violet-500/25',
            )}>
            {hasPaidPlan ? (
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            ) : (
              <Droplets className="w-4 h-4 text-violet-400" />
            )}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Hardhat Studio Subscription</h2>
            <p className="text-[10px] text-muted-foreground">
              Active plan:&nbsp;
              <span className={cn('font-semibold', PLAN_META[currentPlan].color)}>
                {PLAN_META[currentPlan].label}
              </span>
              &nbsp;·&nbsp;Stream to pay, cancel anytime
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto transition-colors text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex flex-shrink-0 border-b border-border/40">
          {(
            [
              { id: 'status', label: '📡 Status' },
              { id: 'networks', label: '🌐 Networks' },
              { id: 'plans', label: '📋 Feature' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 py-2.5 text-xs font-medium transition-colors',
                activeTab === tab.id
                  ? 'text-foreground border-b-2 border-violet-500'
                  : 'text-muted-foreground hover:text-foreground',
              )}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'status' && (
            <div className="p-5 space-y-4">
              {isDev && (
                <div className="flex items-start gap-3 p-3 text-xs border rounded-xl bg-emerald-500/10 border-emerald-500/20 text-emerald-400">
                  <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Dev Mode Active</p>
                    <p className="text-emerald-400/60 mt-0.5">
                      All feature unlocked via VITE_DEV_UNLOCK=true
                    </p>
                  </div>
                </div>
              )}
              {!isDev && IS_TESTNET_MODE && (
                <div className="flex items-start gap-3 p-3 text-xs border rounded-xl bg-amber-500/10 border-amber-500/20 text-amber-400">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Testnet Mode</p>
                    <p className="text-amber-400/60 mt-0.5">
                      Threshold dikecilkan · Default chain: Sepolia
                    </p>
                  </div>
                </div>
              )}

              {(hasPaidPlan || hasLockedStream) && walletAddress && (
                <div className="flex items-center justify-between px-1 -mb-1">
                  <span className="text-[10px] text-muted-foreground/50 font-mono">
                    {fmt.addr(walletAddress)}
                  </span>
                  <button
                    onClick={logout}
                    className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-red-400 transition-colors">
                    <LogOut className="w-3 h-3" /> Logout
                  </button>
                </div>
              )}

              {showStreamCard && activeStream && (
                <div className="space-y-3">
                  {/* Multi-stream selector */}
                  {availableStreams.length > 1 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-semibold px-0.5">
                        Streams ({availableStreams.length})
                      </p>
                      <div className="space-y-1.5">
                        {availableStreams.map((s) => (
                          <button
                            key={s.streamId}
                            onClick={() => selectStream(s.streamId)}
                            className={cn(
                              'w-full flex items-center justify-between px-3 py-2 rounded-lg border text-left transition-all',
                              s.streamId === selectedStreamId
                                ? 'border-violet-500/40 bg-violet-500/10 ring-1 ring-violet-500/20'
                                : 'border-border/40 bg-muted/20 hover:border-border/70 hover:bg-muted/40',
                            )}>
                            <div className="flex items-center min-w-0 gap-2">
                              <div
                                className={cn(
                                  'w-1.5 h-1.5 rounded-full flex-shrink-0',
                                  s.paused
                                    ? 'bg-amber-400'
                                    : s.hasDebt
                                      ? 'bg-red-400'
                                      : 'bg-emerald-400 animate-pulse',
                                )}
                              />
                              <div className="min-w-0">
                                <p className="font-mono text-xs font-medium truncate">
                                  {s.streamAlias}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  {s.chainName} · {s.tokenSymbol}
                                  {s.paused && (
                                    <span className="ml-1 text-amber-400">· Paused</span>
                                  )}
                                  {s.hasDebt && <span className="ml-1 text-red-400">· Debt</span>}
                                </p>
                              </div>
                            </div>
                            <span className="text-[10px] text-muted-foreground ml-2 flex-shrink-0">
                              {(() => {
                                const rate = Number(s.ratePerSecond) / 10 ** s.tokenDecimals;
                                const mo = rate * 86400 * 30;
                                const usd = tokenPrice != null ? mo * tokenPrice : null;
                                return usd != null
                                  ? `$${usd.toFixed(2)}/mo`
                                  : `${mo.toFixed(4)} ${s.tokenSymbol}/mo`;
                              })()}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Stream card */}
                  <div
                    className={cn(
                      'p-4 rounded-xl border space-y-3',
                      currentPlan === 'pro'
                        ? 'bg-violet-500/5 border-violet-500/20'
                        : 'bg-blue-500/5 border-blue-500/20',
                    )}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            'w-2 h-2 rounded-full',
                            hasLockedStream
                              ? 'bg-amber-400'
                              : currentPlan === 'pro'
                                ? 'bg-violet-400 animate-pulse'
                                : 'bg-blue-400 animate-pulse',
                          )}
                        />
                        <PlanIcon plan={currentPlan} className="w-3.5 h-3.5" />
                        <span
                          className={cn(
                            'text-xs font-semibold',
                            hasLockedStream ? 'text-amber-400' : PLAN_META[currentPlan].color,
                          )}>
                          {hasLockedStream
                            ? (status as string) === 'paused'
                              ? '⏸ Stream Paused — Features Locked'
                              : '⚠ Stream Has Debt — Features Locked'
                            : `${PLAN_META[currentPlan].label} — ${PLAN_META[currentPlan].desc}`}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {fmt.addr(activeStream.sender)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 text-xs gap-x-4 gap-y-2">
                      {[
                        ['Token', activeStream.tokenSymbol],
                        ['Network', activeStream.chainName],
                        [
                          'Net Deposit',
                          `${fmt.usd(activeStream.netDeposited)} ${activeStream.tokenSymbol}`,
                        ],
                        ['Balance', `${fmt.usd(activeStream.balance)} ${activeStream.tokenSymbol}`],
                        [
                          'Withdrawn',
                          `${fmt.usd(activeStream.withdrawnAmount)} ${activeStream.tokenSymbol}`,
                        ],
                        [
                          activeStream.hasDebt ? '⚠ Debt' : 'Debt',
                          activeStream.hasDebt
                            ? `${fmt.usd(activeStream.debtRaw)} ${activeStream.tokenSymbol}`
                            : '—',
                        ],
                        ['Start', fmt.date(activeStream.startTime)],
                        // ['End', fmt.date(activeStream.endTime)],
                      ].map(([label, value]) => (
                        <div key={label} className="space-y-0.5">
                          <p
                            className={cn(
                              'text-muted-foreground',
                              label === '⚠ Debt' && 'text-red-400 font-semibold',
                            )}>
                            {label}
                          </p>
                          <p
                            className={cn(
                              'font-medium',
                              label === '⚠ Debt' && activeStream.hasDebt ? 'text-red-400' : '',
                            )}>
                            {value}
                          </p>
                        </div>
                      ))}
                    </div>
                    <StreamProgressBar stream={activeStream} plan={currentPlan} />
                  </div>

                  {/* Lock banners */}
                  {(status as string) === 'paused' && (
                    <div className="flex items-start gap-2 p-3 text-xs border rounded-lg border-amber-500/30 bg-amber-500/10">
                      <span className="text-base text-amber-400">⏸</span>
                      <div>
                        <p className="font-semibold text-amber-400">Stream Paused</p>
                        <p className="text-amber-400/70 mt-0.5">
                          Resume stream untuk mengaktifkan kembali.
                        </p>
                      </div>
                    </div>
                  )}
                  {(status as string) === 'debt' && (
                    <div className="flex items-start gap-2 p-3 text-xs border rounded-lg border-red-500/30 bg-red-500/10">
                      <span className="text-base text-red-400">⚠</span>
                      <div>
                        <p className="font-semibold text-red-400">Stream Has Debt</p>
                        <p className="text-red-400/70 mt-0.5">Sender perlu top-up stream.</p>
                      </div>
                    </div>
                  )}

                  {/* Controls */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {/* {activeStream?.paused ? (
                        <Button
                          size="sm"
                          disabled={!!streamAction || streamActionPending}
                          onClick={handleResume}
                          className="flex-1 h-7 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white border-0">
                          {streamAction === 'resume' ? (
                            <>
                              <RefreshCw className="w-3 h-3 animate-spin" /> Resuming…
                            </>
                          ) : (
                            <>
                              <Activity className="w-3 h-3" /> Resume Stream
                            </>
                          )}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!!streamAction || streamActionPending}
                          onClick={handlePause}
                          className="flex-1 h-7 text-xs gap-1.5 border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
                          {streamAction === 'pause' ? (
                            <>
                              <RefreshCw className="w-3 h-3 animate-spin" /> Pausing…
                            </>
                          ) : (
                            <>⏸ Pause Stream</>
                          )}
                        </Button>
                      )} */}
                      <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded border border-border/40">
                        <RefreshCw className={cn('w-3 h-3', refreshing && 'animate-spin')} />
                        {refreshing ? 'Check…' : 'Refresh'}
                      </button>
                    </div>
                    {streamActionError && (
                      <div className="flex items-start gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-[10px] text-red-400">
                        <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                        <span className="break-all">{streamActionError}</span>
                      </div>
                    )}
                    <DebugLogPanel />
                  </div>
                </div>
              )}

              {/* No stream flow */}
              {!isDev && !hasPaidPlan && (
                <div className="space-y-3">
                  {error && (
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Network selector */}
                  {!isConnected && (
                    <div className="overflow-hidden border rounded-xl border-border/40">
                      <div className="px-3 py-2 border-b bg-muted/10 border-border/30">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                          🌐 NETWORK STREAM
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-1 p-2 overflow-y-auto max-h-48">
                        <button
                          onClick={() => setSelectedChainId(null)}
                          className={cn(
                            'col-span-2 flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-colors border',
                            selectedChainId === null
                              ? 'bg-violet-500/20 border-violet-500/50 text-violet-300'
                              : 'border-border/30 text-muted-foreground hover:bg-muted/20',
                          )}>
                          <span>🔍</span>
                          <span className="flex-1 text-left">Auto-detect (search all chains)</span>
                          {selectedChainId === null && <span className="text-violet-400">✓</span>}
                        </button>
                        {Object.keys(THEGRAPH_ENDPOINTS).map((cid) => {
                          const id = Number(cid);
                          const name = CHAIN_NAMES[id] ?? `Chain ${id}`;
                          const isTest = TESTNET_IDS.has(id);
                          return (
                            <button
                              key={id}
                              onClick={() => setSelectedChainId(id)}
                              className={cn(
                                'flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[9px] font-medium transition-colors border text-left',
                                selectedChainId === id
                                  ? isTest
                                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                                    : 'bg-violet-500/20 border-violet-500/50 text-violet-300'
                                  : 'border-border/20 text-muted-foreground hover:bg-muted/20',
                              )}>
                              <span>{CHAIN_MAP_ICONS[id] ?? '🔗'}</span>
                              <span className="flex-1 truncate">{name}</span>
                              {selectedChainId === id && <span>✓</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <StepCard
                    step={1}
                    done={false}
                    dimmed={!isConnected}
                    title="Create a payment Stream in Sablier"
                    subtitle={`Stream token → ${fmt.addr(RECIPIENT_ADDRESS)}`}
                    right={
                      <Button
                        size="sm"
                        disabled={!isConnected}
                        className="h-7 px-3 text-xs gap-1.5 bg-violet-600 hover:bg-violet-500 text-white border-0 disabled:opacity-40"
                        onClick={openSablier}>
                        <ExternalLink className="w-3 h-3" /> Sablier
                      </Button>
                    }
                  />

                  <StepCard
                    step={2}
                    done={isConnected}
                    dimmed={false}
                    title={isConnected ? fmt.addr(walletAddress!) : 'Connect Wallet'}
                    subtitle={
                      isConnected
                        ? `${chainName ?? `Chain ${chainId}`}`
                        : 'WalletConnect · MetaMask · Trust · Rabby'
                    }
                    right={
                      isConnected ? (
                        <button
                          onClick={logout}
                          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-red-400 transition-colors">
                          <LogOut className="w-3 h-3" /> Logout
                        </button>
                      ) : null
                    }
                  />

                  {!isConnected && (
                    <>
                      <Button
                        size="sm"
                        className={cn(
                          'w-full gap-2 text-xs text-white border-0 shadow-lg h-9',
                          wcQrUri || wcQrLoading
                            ? 'bg-violet-700 hover:bg-violet-600'
                            : 'bg-violet-600 hover:bg-violet-500',
                          'shadow-violet-500/20',
                        )}
                        onClick={handleWalletConnect}
                        disabled={status === 'loading'}>
                        <Wallet className="w-3.5 h-3.5" />
                        {status === 'loading'
                          ? 'Mengecek…'
                          : wcQrUri || wcQrLoading
                            ? 'Tutup QR'
                            : 'Connect Wallet'}
                      </Button>
                      {(wcQrUri || wcQrLoading || wcQrError) && (
                        <InlineWcQr
                          uri={wcQrUri}
                          loading={wcQrLoading}
                          error={wcQrError}
                          onManual={async (addr, cid) => {
                            setWcQrUri(null);
                            setWcQrError(null);
                            await connect(addr, cid);
                          }}
                        />
                      )}
                    </>
                  )}

                  <StepCard
                    step={3}
                    done={false}
                    dimmed={!isConnected}
                    title="Verify & Unlock"
                    subtitle="Click Refresh after the stream is created"
                    right={
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!isConnected || refreshing}
                        className="h-7 px-3 text-xs gap-1.5 disabled:opacity-40"
                        onClick={handleRefresh}>
                        <RefreshCw className={cn('w-3 h-3', refreshing && 'animate-spin')} />
                        {refreshing ? 'Check…' : 'Refresh'}
                      </Button>
                    }
                  />

                  {isConnected && <DebugLogPanel />}

                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-muted/20 border border-border/40">
                    <ArrowRight className="flex-shrink-0 w-3 h-3 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-muted-foreground">Stream to this address</p>
                      <p className="text-[10px] font-mono text-foreground break-all">
                        {RECIPIENT_ADDRESS}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'networks' && (
            <div className="p-5">
              <NetworkManager />
            </div>
          )}

          {activeTab === 'plans' && (
            <div className="p-5 space-y-4">
              {/* Plan cards */}
              <div className="grid grid-cols-3 gap-2">
                {(['free', 'basic', 'pro'] as Plan[]).map((plan) => {
                  const m = PLAN_META[plan];
                  const isActive = currentPlan === plan;
                  return (
                    <div
                      key={plan}
                      className={cn(
                        'p-3 rounded-xl border text-center space-y-1.5 transition-all',
                        isActive
                          ? plan === 'pro'
                            ? 'bg-violet-500/10 border-violet-500/30'
                            : plan === 'basic'
                              ? 'bg-blue-500/10 border-blue-500/30'
                              : 'bg-muted/30 border-border/50'
                          : 'bg-muted/10 border-border/30 opacity-60',
                      )}>
                      <PlanIcon plan={plan} className="w-4 h-4 mx-auto" />
                      <p className={cn('text-xs font-bold', m.color)}>{m.label}</p>
                      <p className="text-[10px] font-semibold text-foreground">
                        {m.price}
                        <span className="font-normal text-muted-foreground">/month</span>
                      </p>
                      {isActive && (
                        <div className="text-[9px] text-emerald-400 font-medium">✓ Active</div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Feature table */}
              <div className="overflow-hidden border rounded-xl border-border/50">
                <div className="px-3 py-2 border-b bg-muted/30 border-border/40">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Feature per Plan
                  </p>
                </div>
                <div className="overflow-y-auto divide-y divide-border/20 max-h-64">
                  {FEATURE_GROUPS.map((group) => (
                    <div key={group.label}>
                      <div className="px-3 py-1.5 bg-muted/20">
                        <p className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-widest">
                          {group.label}
                        </p>
                      </div>
                      {group.items.map(({ feature, label }) => {
                        const required = FEATURE_TIERS[feature];
                        const meta = PLAN_META[required];
                        const unlocked =
                          currentPlan === 'pro' ||
                          (currentPlan === 'basic' &&
                            (required === 'free' || required === 'basic')) ||
                          required === 'free';
                        return (
                          <div
                            key={feature}
                            className="flex items-center justify-between px-3 py-2">
                            <p
                              className={cn(
                                'text-xs',
                                unlocked ? 'text-foreground' : 'text-muted-foreground/50',
                              )}>
                              {label}
                            </p>
                            <div className="flex items-center gap-1.5">
                              <PlanIcon plan={required} className="w-3 h-3" />
                              <span className={cn('text-[10px] font-medium', meta.color)}>
                                {meta.label}
                              </span>
                              {unlocked ? (
                                <CheckCircle className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <div className="w-3 h-3 border rounded-full border-border/40" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* Amount table */}
              <div className="overflow-hidden border rounded-xl border-border/50">
                <div className="px-3 py-2 border-b bg-muted/30 border-border/40">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Jumlah Stream USDC
                  </p>
                </div>
                <div className="divide-y divide-border/30">
                  {[
                    { plan: 'basic' as Plan, duration: '30 hari', amount: PLAN_MIN_DEPOSIT.basic },
                    {
                      plan: 'basic' as Plan,
                      duration: '365 hari',
                      amount: PLAN_MIN_DEPOSIT.basic * 12,
                    },
                    { plan: 'pro' as Plan, duration: '30 hari', amount: PLAN_MIN_DEPOSIT.pro },
                    {
                      plan: 'pro' as Plan,
                      duration: '365 hari',
                      amount: PLAN_MIN_DEPOSIT.pro * 12,
                    },
                  ].map((row) => (
                    <div
                      key={`${row.plan}-${row.duration}`}
                      className="flex items-center justify-between px-3 py-2.5 text-xs">
                      <div className="flex items-center gap-2">
                        <PlanIcon plan={row.plan} className="w-3 h-3" />
                        <span className={cn('font-medium', PLAN_META[row.plan].color)}>
                          {PLAN_META[row.plan].label}
                        </span>
                        <span className="text-muted-foreground">· {row.duration}</span>
                      </div>
                      <span className="font-semibold text-foreground">
                        ${row.amount.toFixed(2)} USDC
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={openSablier}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-colors">
                <ExternalLink className="w-3.5 h-3.5" /> Stream to this address at app.sablier.com
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
