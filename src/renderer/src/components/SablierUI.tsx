/**
 * SablierUI — Per-plan stream subscription UI
 * Drop-in replacement untuk LicenseUI.tsx (semua export sama)
 *
 * 3 Plan:
 *   FREE  → gratis, fitur dasar
 *   BASIC → stream ≥ $9.99/bln → Tools & Analysis
 *   PRO   → stream ≥ $29.99/bln → Semua fitur
 */
import { useState, ReactNode, useRef, useEffect, useCallback } from 'react';
import {
  Wallet,
  CheckCircle,
  X,
  ExternalLink,
  Shield,
  RefreshCw,
  LogOut,
  Clock,
  Droplets,
  ArrowRight,
  Activity,
  AlertCircle,
  Zap,
  Star,
  Crown,
  Terminal,
  ChevronDown,
  ChevronUp,
  Trash2,
} from 'lucide-react';
import {
  useLicense,
  Feature,
  FEATURE_TIERS,
  PLAN_META,
  RECIPIENT_ADDRESS,
  Plan,
  PLAN_MIN_DEPOSIT,
  IS_TESTNET_MODE,
  LogEntry,
  LogLevel,
} from '../context/SablierContext';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

// ── Inline WalletConnect QR component ────────────────────────────────────────
// Loads QRCode.js from CDN once, renders QR directly in the main UI (no popup)

let _qrScriptLoaded = false;
function loadQrScript(): Promise<void> {
  if (_qrScriptLoaded || (window as any).QRCode) { _qrScriptLoaded = true; return Promise.resolve(); }
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    s.onload = () => { _qrScriptLoaded = true; res(); };
    s.onerror = () => rej(new Error('QRCode CDN load failed'));
    document.head.appendChild(s);
  });
}

function InlineWcQr({
  uri,
  loading,
  error,
  onManual,
}: {
  uri: string | null;
  loading: boolean;
  error: string | null;
  onManual: (addr: string, chainId: number) => Promise<void>;
}) {
  const qrRef = useRef<HTMLDivElement>(null);
  const [addr, setAddr] = useState('');
  const [chainId, setChainId] = useState(11155111);
  const [addrOk, setAddrOk] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!uri || !qrRef.current) return;
    loadQrScript().then(() => {
      if (!qrRef.current) return;
      qrRef.current.innerHTML = '';
      new (window as any).QRCode(qrRef.current, {
        text: uri,
        width: 148,
        height: 148,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: (window as any).QRCode.CorrectLevel.M,
      });
    }).catch(console.warn);
  }, [uri]);

  const DL: Record<string, string> = {
    '🦊 MetaMask': `metamask://wc?uri=${encodeURIComponent(uri ?? '')}`,
    '🛡️ Trust':    `trust://wc?uri=${encodeURIComponent(uri ?? '')}`,
    '🔵 Coinbase': `cbwallet://wc?uri=${encodeURIComponent(uri ?? '')}`,
    '🐰 Rabby':    `rabby://wc?uri=${encodeURIComponent(uri ?? '')}`,
  };

  return (
    <div className="rounded-xl border border-border/50 bg-card/60 overflow-hidden">
      {/* QR section */}
      <div className="flex gap-3 p-3">
        {/* QR box */}
        <div className="flex-shrink-0 w-[162px] h-[162px] rounded-lg bg-white flex items-center justify-center overflow-hidden">
          {loading && (
            <div className="flex flex-col items-center gap-2">
              <div className="w-5 h-5 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
              <span className="text-[9px] text-gray-400">Menghubungkan…</span>
            </div>
          )}
          {error && (
            <div className="flex flex-col items-center gap-1 px-3 text-center">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <span className="text-[9px] text-red-400 leading-tight">{error}</span>
            </div>
          )}
          {uri && <div ref={qrRef} />}
        </div>

        {/* Right side */}
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-blue-400" />
            <span className="text-[10px] font-semibold text-blue-300">WalletConnect v2</span>
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Scan QR atau klik wallet untuk deep link ke app mobile.
          </p>
          {/* Wallet tiles */}
          <div className="grid grid-cols-4 gap-1.5">
            {Object.entries(DL).map(([label, href]) => (
              <button
                key={label}
                disabled={!uri}
                onClick={() => window.open(href, '_blank')}
                className="flex flex-col items-center gap-1 py-2 rounded-lg border border-border/50 bg-muted/20 hover:border-violet-500/50 hover:bg-violet-500/10 transition-all text-center disabled:opacity-30 disabled:pointer-events-none">
                <span className="text-base leading-none">{label.split(' ')[0]}</span>
                <span className="text-[8px] text-muted-foreground leading-none">{label.split(' ').slice(1).join(' ')}</span>
              </button>
            ))}
          </div>
          {/* Copy URI */}
          {uri && (
            <button
              onClick={() => { navigator.clipboard.writeText(uri); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-border/40 bg-muted/20 hover:border-violet-500/40 transition-all text-left w-full">
              <code className="flex-1 text-[8px] text-muted-foreground font-mono truncate">{uri.slice(0, 36)}…</code>
              <span className="text-[8px] text-violet-400 flex-shrink-0">{copied ? '✓' : 'Copy'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Manual divider */}
      <div className="flex items-center gap-2 px-3">
        <div className="flex-1 h-px bg-border/40" />
        <span className="text-[9px] text-muted-foreground uppercase tracking-wider">atau input manual</span>
        <div className="flex-1 h-px bg-border/40" />
      </div>

      {/* Manual input */}
      <div className="p-3 pt-2 space-y-2">
        <input
          type="text"
          value={addr}
          placeholder="0xAbc...def"
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => {
            setAddr(e.target.value);
            setAddrOk(/^0x[0-9a-fA-F]{40}$/.test(e.target.value.trim()));
          }}
          className="w-full px-3 py-2 text-[10px] font-mono rounded-lg border border-border/50 bg-muted/20 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-violet-500/60"
        />
        <div className="flex gap-2">
          <select
            value={chainId}
            onChange={(e) => setChainId(Number(e.target.value))}
            className="flex-1 px-2 py-1.5 text-[10px] rounded-lg border border-border/50 bg-muted/20 text-foreground focus:outline-none focus:border-violet-500/60">
            <optgroup label="Mainnet">
              <option value={1}>Ethereum</option>
              <option value={137}>Polygon</option>
              <option value={42161}>Arbitrum</option>
              <option value={8453}>Base</option>
            </optgroup>
            <optgroup label="Testnet">
              <option value={11155111}>Sepolia 🧪</option>
              <option value={84532}>Base Sepolia 🧪</option>
            </optgroup>
          </select>
          <button
            disabled={!addrOk}
            onClick={() => onManual(addr.trim(), chainId)}
            className="px-3 py-1.5 text-[10px] font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-30 disabled:pointer-events-none">
            ✓ Verifikasi
          </button>
        </div>
      </div>
    </div>
  );
}

// Plan Icon helper
function PlanIcon({ plan, className }: { plan: Plan; className?: string }) {
  if (plan === 'pro') return <Crown className={cn('text-violet-400', className)} />;
  if (plan === 'basic') return <Star className={cn('text-blue-400', className)} />;
  return <Zap className={cn('text-muted-foreground', className)} />;
}

// Log Level styling
const LOG_STYLE: Record<LogLevel, { dot: string; text: string; label: string }> = {
  info: { dot: 'bg-sky-400', text: 'text-sky-300', label: 'INFO' },
  success: { dot: 'bg-emerald-400', text: 'text-emerald-300', label: 'OK  ' },
  warn: { dot: 'bg-amber-400', text: 'text-amber-300', label: 'WARN' },
  error: { dot: 'bg-red-400', text: 'text-red-300', label: 'ERR ' },
  debug: { dot: 'bg-violet-400', text: 'text-violet-300', label: 'DBG ' },
};

// DebugLogPanel
function DebugLogPanel() {
  const { logs, clearLogs } = useLicense();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<LogLevel | 'all'>('all');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, open]);

  const filtered = filter === 'all' ? logs : logs.filter((l) => l.level === filter);
  const errorCount = logs.filter((l) => l.level === 'error').length;
  const warnCount = logs.filter((l) => l.level === 'warn').length;

  const fmtTime = (ts: number) =>
    new Date(ts).toLocaleTimeString('en-GB', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

  return (
    <div className="overflow-hidden border border-border/40 rounded-xl">
      {/* Toggle header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center w-full gap-2 px-3 py-2 text-left transition-colors bg-muted/20 hover:bg-muted/30">
        <Terminal className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <span className="text-[10px] font-mono font-semibold text-muted-foreground flex-1">
          Debug Logs
        </span>

        {/* badges */}
        <div className="flex items-center gap-1">
          {logs.length > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground font-mono">
              {logs.length}
            </span>
          )}
          {errorCount > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-mono">
              {errorCount} ERR
            </span>
          )}
          {warnCount > 0 && !errorCount && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono">
              {warnCount} WARN
            </span>
          )}
        </div>

        {open ? (
          <ChevronUp className="w-3 h-3 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        )}
      </button>

      {/* Panel body */}
      {open && (
        <div className="bg-black/60">
          {/* Filter bar + clear */}
          <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border/30 flex-wrap">
            {(['all', 'info', 'success', 'warn', 'error', 'debug'] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setFilter(lvl)}
                className={cn(
                  'text-[9px] font-mono px-1.5 py-0.5 rounded transition-colors',
                  filter === lvl
                    ? 'bg-violet-600/60 text-white'
                    : 'text-muted-foreground hover:text-foreground',
                )}>
                {lvl.toUpperCase()}
              </button>
            ))}
            <div className="flex-1" />
            <button
              onClick={clearLogs}
              className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-red-400 transition-colors">
              <Trash2 className="w-2.5 h-2.5" />
              Clear
            </button>
          </div>

          {/* Log lines */}
          <div className="overflow-y-auto max-h-48 font-mono text-[10px] leading-relaxed px-1 py-1">
            {filtered.length === 0 ? (
              <p className="text-center py-4 text-muted-foreground/40 text-[10px]">
                {logs.length === 0 ? 'No logs yet — click Refresh' : 'No logs match filter'}
              </p>
            ) : (
              filtered.map((entry) => {
                const s = LOG_STYLE[entry.level];
                return (
                  <div key={entry.id} className="flex gap-1.5 py-0.5 px-1 hover:bg-white/5 rounded">
                    {/* dot */}
                    <span className={cn('mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0', s.dot)} />
                    {/* time */}
                    <span className="text-muted-foreground/40 flex-shrink-0 w-[52px]">
                      {fmtTime(entry.ts)}
                    </span>
                    {/* level */}
                    <span className={cn('flex-shrink-0 w-8', s.text)}>{s.label}</span>
                    {/* message */}
                    <span className="flex-1 break-all text-foreground/80">{entry.msg}</span>
                    {/* data peek */}
                    {entry.data !== undefined && (
                      <span
                        className="text-muted-foreground/40 truncate max-w-[100px] hidden sm:block"
                        title={JSON.stringify(entry.data, null, 2)}>
                        {JSON.stringify(entry.data).slice(0, 40)}…
                      </span>
                    )}
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>
        </div>
      )}
    </div>
  );
}

// LicenseGate — wrapper panel, tampilkan upgrade jika plan tidak cukup
export function LicenseGate({
  feature,
  children,
  compact = false,
}: {
  feature: Feature;
  children: ReactNode;
  compact?: boolean;
}) {
  const { can, currentPlan, planFor } = useLicense();
  const [showModal, setShowModal] = useState(false);

  if (can(feature)) return <>{children}</>;

  const required = planFor(feature);
  const meta = PLAN_META[required];

  return (
    <>
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-5 text-center select-none',
          compact ? 'p-6' : 'flex-1 p-12',
        )}>
        <div className="relative flex items-center justify-center w-20 h-20">
          <div
            className={cn(
              'absolute inset-0 rounded-full animate-ping opacity-20',
              required === 'pro' ? 'bg-violet-500' : 'bg-blue-500',
            )}
            style={{ animationDuration: '2.5s' }}
          />
          <div
            className={cn(
              'absolute inset-3 rounded-full border animate-pulse',
              required === 'pro'
                ? 'bg-violet-500/10 border-violet-500/25'
                : 'bg-blue-500/10 border-blue-500/25',
            )}
            style={{ animationDuration: '2s' }}
          />
          <PlanIcon plan={required} className="relative w-8 h-8" />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-center gap-1.5">
            <PlanIcon plan={required} className="w-3.5 h-3.5" />
            <p className={cn('text-sm font-semibold', meta.color)}>{meta.label} Feature</p>
          </div>
          <p className="text-xs text-muted-foreground max-w-[210px] leading-relaxed">
            {required === 'pro'
              ? 'Upgrade ke Pro (stream ≥ $29.99/bln) untuk akses fitur ini.'
              : 'Upgrade ke Basic (stream ≥ $9.99/bln) untuk akses fitur ini.'}
          </p>
          <p className="text-[10px] text-muted-foreground/50">
            Plan kamu sekarang:{' '}
            <span className={cn('font-semibold', PLAN_META[currentPlan].color)}>
              {PLAN_META[currentPlan].label}
            </span>
          </p>
        </div>

        <Button
          size="sm"
          className={cn(
            'gap-2 text-white border-0 shadow-lg transition-all hover:-translate-y-px',
            required === 'pro'
              ? 'bg-violet-600 hover:bg-violet-500 shadow-violet-500/25'
              : 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/25',
          )}
          onClick={() => setShowModal(true)}>
          <Droplets className="w-3.5 h-3.5" />
          Upgrade ke {meta.label}
        </Button>
      </div>

      {showModal && <LicenseModal onClose={() => setShowModal(false)} />}
    </>
  );
}

// LicenseModal — wallet connect + plan selection + stream flow
export function LicenseModal({ onClose }: { onClose: () => void }) {
  const {
    status,
    walletAddress,
    chainId,
    chainName,
    activeStream,
    currentPlan,
    isDev,
    error,
    connect,
    disconnect,
    refresh,
  } = useLicense();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'status' | 'plans'>('status');
  const [wcQrUri, setWcQrUri] = useState<string | null>(null);
  const [wcQrLoading, setWcQrLoading] = useState(false);
  const [wcQrError, setWcQrError] = useState<string | null>(null);
  const wcPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isConnected = !!walletAddress;
  const hasPaidPlan = status === 'basic' || status === 'pro';

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  // Toggle inline QR — no popup, QR appears directly in UI
  const handleWalletConnect = useCallback(async () => {
    const api = (window as any).api;

    // If QR is already showing, collapse it
    if (wcQrUri || wcQrLoading) {
      setWcQrUri(null);
      setWcQrError(null);
      setWcQrLoading(false);
      if (wcPollRef.current) clearInterval(wcPollRef.current);
      return;
    }

    if (!api?.wcGetUri) {
      // Dev/non-Electron fallback: prompt
      const addr = window.prompt('Enter wallet address (0x...):');
      if (addr && /^0x[0-9a-fA-F]{40}$/.test(addr.trim())) {
        await connect(addr.trim(), IS_TESTNET_MODE ? 11155111 : 137);
      }
      return;
    }

    setWcQrLoading(true);
    setWcQrUri(null);
    setWcQrError(null);

    try {
      const res = await api.wcGetUri();
      if (!res || res.error) {
        const msg = res?.error === 'NO_PROJECT_ID'
          ? 'Set VITE_WC_PROJECT_ID di .env'
          : `WC error: ${res?.error ?? 'unknown'}`;
        setWcQrError(msg);
        setWcQrLoading(false);
        return;
      }
      setWcQrUri(res.uri);
      setWcQrLoading(false);

      // Poll wc-poll-result every 1s as fallback in case push event was missed
      // (can happen if listener wasn't ready when wallet approved)
      if (wcPollRef.current) clearInterval(wcPollRef.current);
      wcPollRef.current = setInterval(async () => {
        try {
          const polled = await api.wcPollResult?.();
          if (polled?.address) {
            clearInterval(wcPollRef.current!);
            wcPollRef.current = null;
            setWcQrUri(null);
            setWcQrError(null);
            await connect(polled.address, polled.chainId);
          }
        } catch { /* ignore */ }
      }, 1000);
    } catch (e: any) {
      setWcQrError(e?.message ?? 'Gagal generate QR');
      setWcQrLoading(false);
    }
  }, [wcQrUri, wcQrLoading, connect]);

  // Watch for WC session approval via push event from main process
  useEffect(() => {
    const api = (window as any).api;
    if (!api?.onWcApproved) return;
    const unsub = api.onWcApproved(async (result: { address: string; chainId: number }) => {
      if (result?.address) {
        if (wcPollRef.current) { clearInterval(wcPollRef.current); wcPollRef.current = null; }
        setWcQrUri(null);
        setWcQrError(null);
        setWcQrLoading(false);
        await connect(result.address, result.chainId);
      }
    });
    return () => unsub?.();
  }, [connect]);

  const openSablier = () => {
    if ((window as any).api?.openExternal) {
      (window as any).api.openExternal('https://app.sablier.com');
    } else {
      window.open('https://app.sablier.com', '_blank');
    }
  };

  const fmt = {
    addr: (a: string) => `${a?.slice(0, 6)}…${a?.slice(-4)}`,
    date: (ts: number) =>
      new Date(ts * 1000).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
    usd: (raw: string, dec = 6) => {
      const n = Number(raw) / 10 ** dec;
      return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-md">
      <div className="relative w-full max-w-[460px] mx-4 bg-card border border-border rounded-2xl shadow-2xl shadow-black/60 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Top accent */}
        <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-violet-500/60 to-transparent" />

        {/* Header */}
        <div className="flex items-center flex-shrink-0 gap-3 px-5 py-4 border-b border-border/50">
          <div
            className={cn(
              'flex items-center justify-center w-8 h-8 rounded-lg border',
              hasPaidPlan || isDev
                ? 'bg-emerald-500/15 border-emerald-500/25'
                : 'bg-violet-500/15 border-violet-500/25',
            )}>
            {hasPaidPlan || isDev ? (
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            ) : (
              <Droplets className="w-4 h-4 text-violet-400" />
            )}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Hardhat Studio Subscription</h2>
            <p className="text-[10px] text-muted-foreground">
              Plan aktif:&nbsp;
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

        {/* Tab bar */}
        <div className="flex flex-shrink-0 border-b border-border/40">
          {(['status', 'plans'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'flex-1 py-2.5 text-xs font-medium transition-colors',
                activeTab === tab
                  ? 'text-foreground border-b-2 border-violet-500'
                  : 'text-muted-foreground hover:text-foreground',
              )}>
              {tab === 'status' ? '📡 Status & Stream' : '📋 Daftar Fitur'}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          {/* TAB: STATUS */}
          {activeTab === 'status' && (
            <div className="p-5 space-y-4">
              {/* Dev mode */}
              {isDev && (
                <div className="flex items-start gap-3 p-3 text-xs border rounded-xl bg-emerald-500/10 border-emerald-500/20 text-emerald-400">
                  <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Dev Mode Active</p>
                    <p className="text-emerald-400/60 mt-0.5">
                      Semua fitur unlocked via VITE_DEV_UNLOCK=true
                    </p>
                  </div>
                </div>
              )}

              {/* Testnet mode banner */}
              {!isDev && IS_TESTNET_MODE && (
                <div className="flex items-start gap-3 p-3 text-xs border rounded-xl bg-amber-500/10 border-amber-500/20 text-amber-400">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Testnet Mode — VITE_NODE_ENV=development</p>
                    <p className="text-amber-400/60 mt-0.5">
                      Threshold dikecilkan ($0.01/$0.02) · Default chain: Sepolia
                    </p>
                  </div>
                </div>
              )}

              {/* Active stream card */}
              {hasPaidPlan && activeStream && (
                <div className="space-y-3">
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
                            'w-2 h-2 rounded-full animate-pulse',
                            currentPlan === 'pro' ? 'bg-violet-400' : 'bg-blue-400',
                          )}
                        />
                        <PlanIcon plan={currentPlan} className="w-3.5 h-3.5" />
                        <span className={cn('text-xs font-semibold', PLAN_META[currentPlan].color)}>
                          {PLAN_META[currentPlan].label} — {PLAN_META[currentPlan].desc}
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
                          'Deposit',
                          `${fmt.usd(activeStream.depositAmount)} ${activeStream.tokenSymbol}`,
                        ],
                        [
                          'Withdrawn',
                          `${fmt.usd(activeStream.withdrawnAmount)} ${activeStream.tokenSymbol}`,
                        ],
                        ['Mulai', fmt.date(activeStream.startTime)],
                        ['Berakhir', fmt.date(activeStream.endTime)],
                      ].map(([l, v]) => (
                        <div key={l} className="space-y-0.5">
                          <p className="text-muted-foreground">{l}</p>
                          <p className="font-medium text-foreground">{v}</p>
                        </div>
                      ))}
                    </div>

                    <StreamProgressBar stream={activeStream} plan={currentPlan} />
                  </div>

                  {/* Refresh + Log Panel */}
                  <div className="space-y-2">
                    <button
                      onClick={handleRefresh}
                      disabled={refreshing}
                      className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors mx-auto">
                      <RefreshCw className={cn('w-3 h-3', refreshing && 'animate-spin')} />
                      {refreshing ? 'Mengecek…' : 'Refresh status stream'}
                    </button>
                    <DebugLogPanel />
                  </div>
                </div>
              )}

              {/* No stream — 3-step flow */}
              {!isDev && !hasPaidPlan && (
                <div className="space-y-3">
                  {error && (
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Step 1 — Wallet Connect */}
                  <StepCard
                    step={1}
                    done={isConnected}
                    dimmed={false}
                    title={isConnected ? fmt.addr(walletAddress!) : 'Connect Wallet'}
                    subtitle={
                      isConnected
                        ? (chainName ?? `Chain ${chainId}`)
                        : 'WalletConnect QR · MetaMask · Trust · Rabby'
                    }
                    right={
                      isConnected ? (
                        <button
                          onClick={disconnect}
                          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                          <LogOut className="w-3 h-3" /> Disconnect
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
                          onManual={async (addr, chainId) => {
                            setWcQrUri(null);
                            setWcQrError(null);
                            await connect(addr, chainId);
                          }}
                        />
                      )}
                    </>
                  )}

                  <StepCard
                    step={2}
                    done={false}
                    dimmed={!isConnected}
                    title="Buat Stream di Sablier"
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
                    step={3}
                    done={false}
                    dimmed={!isConnected}
                    title="Verifikasi & Unlock"
                    subtitle="Klik Refresh setelah stream dibuat"
                    right={
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!isConnected || refreshing}
                        className="h-7 px-3 text-xs gap-1.5 disabled:opacity-40"
                        onClick={handleRefresh}>
                        <RefreshCw className={cn('w-3 h-3', refreshing && 'animate-spin')} />
                        {refreshing ? 'Cek…' : 'Refresh'}
                      </Button>
                    }
                  />

                  {/* Debug Log Panel — always visible once connected */}
                  {isConnected && <DebugLogPanel />}

                  {/* Recipient */}
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-muted/20 border border-border/40">
                    <ArrowRight className="flex-shrink-0 w-3 h-3 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-muted-foreground">Stream ke address ini</p>
                      <p className="text-[10px] font-mono text-foreground break-all">
                        {RECIPIENT_ADDRESS}
                      </p>
                    </div>
                  </div>

                  {/* Supported chains */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground">Mainnet:</span>
                    {[
                      'Ethereum',
                      'Polygon',
                      'Arbitrum',
                      'BNB Chain',
                      'Optimism',
                      'Base',
                      'Monad',
                    ].map((n) => (
                      <span
                        key={n}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-muted/50 border border-border/40 text-muted-foreground">
                        {n}
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground">Testnet:</span>
                    {['Sepolia', 'Base Sepolia', 'Arbitrum Sepolia', 'Optimism Sepolia'].map(
                      (n) => (
                        <span
                          key={n}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400/70">
                          🧪 {n}
                        </span>
                      ),
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: PLANS / FITUR */}
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
                        <span className="font-normal text-muted-foreground">/bln</span>
                      </p>
                      {isActive && (
                        <div className="text-[9px] text-emerald-400 font-medium">✓ Aktif</div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Feature table */}
              <div className="overflow-hidden border rounded-xl border-border/50">
                <div className="px-3 py-2 border-b bg-muted/30 border-border/40">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Fitur per Plan
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

              {/* Amounts */}
              <div className="overflow-hidden border rounded-xl border-border/50">
                <div className="px-3 py-2 border-b bg-muted/30 border-border/40">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Jumlah Stream USDC
                  </p>
                </div>
                <div className="divide-y divide-border/30">
                  {[
                    { plan: 'basic' as Plan, duration: '30 hari', amount: '9.99', token: 'USDC' },
                    { plan: 'basic' as Plan, duration: '365 hari', amount: '99.99', token: 'USDC' },
                    { plan: 'pro' as Plan, duration: '30 hari', amount: '29.99', token: 'USDC' },
                    { plan: 'pro' as Plan, duration: '365 hari', amount: '299.99', token: 'USDC' },
                  ].map((row) => {
                    const m = PLAN_META[row.plan];
                    return (
                      <div
                        key={`${row.plan}-${row.duration}`}
                        className="flex items-center justify-between px-3 py-2.5 text-xs">
                        <div className="flex items-center gap-2">
                          <PlanIcon plan={row.plan} className="w-3 h-3" />
                          <span className={cn('font-medium', m.color)}>{m.label}</span>
                          <span className="text-muted-foreground">· {row.duration}</span>
                        </div>
                        <span className="font-semibold text-foreground">
                          ${row.amount} {row.token}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-colors"
                onClick={openSablier}>
                <ExternalLink className="w-3.5 h-3.5" /> Buat Stream di app.sablier.com
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// LicenseBadge — sidebar footer
export function LicenseBadge({ onClick }: { onClick?: () => void }) {
  const { status, currentPlan, isDev } = useLicense();
  const [showModal, setShowModal] = useState(false);

  const cfg =
    isDev || status === 'dev'
      ? {
          icon: <Shield className="w-3 h-3" />,
          text: 'Dev Mode',
          cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        }
      : status === 'pro'
        ? {
            icon: <Crown className="w-3 h-3" />,
            text: 'Pro Active',
            cls: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
          }
        : status === 'basic'
          ? {
              icon: <Star className="w-3 h-3" />,
              text: 'Basic Active',
              cls: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
            }
          : status === 'loading'
            ? {
                icon: <Activity className="w-3 h-3 animate-pulse" />,
                text: 'Checking…',
                cls: 'text-muted-foreground bg-muted/30 border-border/40',
              }
            : status === 'no_wallet'
              ? {
                  icon: <Wallet className="w-3 h-3" />,
                  text: 'Connect Wallet',
                  cls: 'text-muted-foreground bg-muted/30 border-border/40 hover:border-violet-500/40 hover:text-violet-400',
                }
              : {
                  icon: <Zap className="w-3 h-3" />,
                  text: 'Free · Upgrade →',
                  cls: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
                };

  return (
    <>
      <button
        onClick={() => {
          onClick?.();
          setShowModal(true);
        }}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-medium transition-all w-full',
          cfg.cls,
        )}>
        {cfg.icon}
        <span className="flex-1 text-left">{cfg.text}</span>
      </button>
      {showModal && <LicenseModal onClose={() => setShowModal(false)} />}
    </>
  );
}

// Helper Components
function StepCard({
  step,
  done,
  dimmed,
  title,
  subtitle,
  right,
}: {
  step: number;
  done: boolean;
  dimmed: boolean;
  title: string;
  subtitle: string;
  right: ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl border transition-all',
        done
          ? 'bg-emerald-500/5 border-emerald-500/20'
          : dimmed
            ? 'bg-muted/10 border-border/20 opacity-40'
            : 'bg-muted/25 border-border/50',
      )}>
      <div
        className={cn(
          'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border',
          done
            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
            : 'bg-muted/50 border-border/50 text-muted-foreground',
        )}>
        {done ? <CheckCircle className="w-3.5 h-3.5" /> : step}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate text-foreground">{title}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>
      </div>
      <div className="flex-shrink-0">{right}</div>
    </div>
  );
}

function StreamProgressBar({
  stream,
  plan,
}: {
  stream: { startTime: number; endTime: number };
  plan: Plan;
}) {
  const now = Date.now() / 1000;
  const pct = Math.max(
    0,
    Math.min(((now - stream.startTime) / (stream.endTime - stream.startTime)) * 100, 100),
  );
  const daysLeft = Math.max(0, Math.ceil((stream.endTime - now) / 86400));
  return (
    <div className="space-y-1.5">
      <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full',
            plan === 'pro'
              ? 'bg-gradient-to-r from-violet-500 to-violet-400'
              : 'bg-gradient-to-r from-blue-500 to-blue-400',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{pct.toFixed(1)}% streamed</span>
        <span className="flex items-center gap-1">
          <Clock className="w-2.5 h-2.5" />
          {daysLeft}d remaining
        </span>
      </div>
    </div>
  );
}

// Helper for Plans tab
function openSablier() {
  if ((window as any).api?.openExternal) {
    (window as any).api.openExternal('https://app.sablier.com');
  } else {
    window.open('https://app.sablier.com', '_blank');
  }
}

// Feature groups untuk tab Plans
const FEATURE_GROUPS: Array<{ label: string; items: Array<{ feature: Feature; label: string }> }> =
  [
    {
      label: 'Free — Selalu Tersedia',
      items: [
        { feature: 'accounts', label: 'Accounts & Wallets' },
        { feature: 'environment', label: 'Environment (.env)' },
        { feature: 'git', label: 'Git Integration' },
        { feature: 'docs', label: 'Documentation' },
        { feature: 'notes', label: 'Notes Editor' },
        { feature: 'debug', label: 'Debug & Logs' },
        { feature: 'erc_standards', label: 'ERC Standards' },
        { feature: 'block_explorer', label: 'Block Explorer' },
      ],
    },
    {
      label: 'Basic — Tools & Analysis ($9.99/bln)',
      items: [
        { feature: 'security', label: 'Security Audit' },
        { feature: 'gas_profiler', label: 'Gas Profiler' },
        { feature: 'opcode_viewer', label: 'Opcode Viewer' },
        { feature: 'snapshots', label: 'EVM Snapshots' },
        { feature: 'erc20_reader', label: 'ERC-20 Reader' },
        { feature: 'nft_viewer', label: 'NFT Viewer' },
        { feature: 'verify_contract', label: 'Verify Contract' },
        { feature: 'audit_notes', label: 'Audit Notes' },
      ],
    },
    {
      label: 'Pro — Advanced + DeFi ($29.99/bln)',
      items: [
        { feature: 'contract_graph', label: 'Contract Graph' },
        { feature: 'tx_graph', label: 'Transaction Graph' },
        { feature: 'analytics', label: 'Analytics Dashboard' },
        { feature: 'simulation_lab', label: 'Simulation Lab' },
        { feature: 'lp_simulator', label: 'LP Simulator' },
        { feature: 'scenario_builder', label: 'Scenario Builder' },
        { feature: 'frontend_helper', label: 'Frontend Helper' },
        { feature: 'abi_compat', label: 'ABI Compatibility' },
        { feature: 'event_schema', label: 'Event Schema' },
      ],
    },
  ];
