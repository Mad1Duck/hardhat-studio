/**
 * SablierUI — Per-plan stream subscription UI
 * Drop-in replacement untuk LicenseUI.tsx (semua export sama)
 *
 * 3 Plan:
 *   FREE  → gratis, fitur dasar
 *   BASIC → stream ≥ $9.99/bln → Tools & Analysis
 *   PRO   → stream ≥ $29.99/bln → Semua fitur
 */
import React, { useState, ReactNode, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  TrendingUp,
  DollarSign,
  ArrowUpRight,
  Gauge,
  CircleDot,
} from 'lucide-react';
import {
  useLicense,
  Feature,
  FEATURE_TIERS,
  PLAN_META,
  RECIPIENT_ADDRESS,
  Plan,
  Status,
  PLAN_MIN_DEPOSIT,
  IS_TESTNET_MODE,
  LogEntry,
  LogLevel,
  ActiveStream,
  THEGRAPH_ENDPOINTS,
  CHAIN_NAMES,
  addCustomChain,
} from '../context/SablierContext';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

// ── Inline WalletConnect QR component ────────────────────────────────────────
// Loads QRCode.js from CDN once, renders QR directly in the main UI (no popup)

let _qrScriptLoaded = false;
function loadQrScript(): Promise<void> {
  if (_qrScriptLoaded || (window as any).QRCode) {
    _qrScriptLoaded = true;
    return Promise.resolve();
  }
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    s.onload = () => {
      _qrScriptLoaded = true;
      res();
    };
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
    loadQrScript()
      .then(() => {
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
      })
      .catch(console.warn);
  }, [uri]);

  const DL: Record<string, string> = {
    '🦊 MetaMask': `metamask://wc?uri=${encodeURIComponent(uri ?? '')}`,
    '🛡️ Trust': `trust://wc?uri=${encodeURIComponent(uri ?? '')}`,
    '🔵 Coinbase': `cbwallet://wc?uri=${encodeURIComponent(uri ?? '')}`,
    '🐰 Rabby': `rabby://wc?uri=${encodeURIComponent(uri ?? '')}`,
  };

  return (
    <div className="overflow-hidden border rounded-xl border-border/50 bg-card/60">
      {/* QR section */}
      <div className="flex gap-3 p-3">
        {/* QR box */}
        <div className="flex-shrink-0 w-[162px] h-[162px] rounded-lg bg-white flex items-center justify-center overflow-hidden">
          {loading && (
            <div className="flex flex-col items-center gap-2">
              <div className="w-5 h-5 border-2 rounded-full border-violet-300 border-t-violet-600 animate-spin" />
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
        <div className="flex flex-col flex-1 min-w-0 gap-2">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-blue-400 rounded-full" />
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
                className="flex flex-col items-center gap-1 py-2 text-center transition-all border rounded-lg border-border/50 bg-muted/20 hover:border-violet-500/50 hover:bg-violet-500/10 disabled:opacity-30 disabled:pointer-events-none">
                <span className="text-base leading-none">{label.split(' ')[0]}</span>
                <span className="text-[8px] text-muted-foreground leading-none">
                  {label.split(' ').slice(1).join(' ')}
                </span>
              </button>
            ))}
          </div>
          {/* Copy URI */}
          {uri && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(uri);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-border/40 bg-muted/20 hover:border-violet-500/40 transition-all text-left w-full">
              <code className="flex-1 text-[8px] text-muted-foreground font-mono truncate">
                {uri.slice(0, 36)}…
              </code>
              <span className="text-[8px] text-violet-400 flex-shrink-0">
                {copied ? '✓' : 'Copy'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Manual divider */}
      <div className="flex items-center gap-2 px-3">
        <div className="flex-1 h-px bg-border/40" />
        <span className="text-[9px] text-muted-foreground uppercase tracking-wider">
          atau input manual
        </span>
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

// ── NetworkManager ────────────────────────────────────────────────────────────
// Shows all supported chains, lets user toggle which to search + add custom

const CHAIN_ICONS: Record<number, string> = {
  1: '🔵', // Ethereum
  137: '🟣', // Polygon
  42161: '🔷', // Arbitrum
  56: '🟡', // BNB Chain
  10: '🔴', // Optimism
  8453: '🟦', // Base
  10143: '⚫', // Monad
  11155111: '🧪', // Sepolia
  84532: '🧪', // Base Sepolia
  421614: '🧪', // Arbitrum Sepolia
  11155420: '🧪', // Optimism Sepolia
};

function NetworkManager() {
  const { refresh } = useLicense();
  const [customName, setCustomName] = useState('');
  const [customChainId, setCustomChainId] = useState('');
  const [customEndpoint, setCustomEndpoint] = useState('');
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Live snapshot of all chains (built-in + custom)
  const [chainSnapshot, setChainSnapshot] = useState(() =>
    Object.entries(THEGRAPH_ENDPOINTS).map(([id, ep]) => ({
      chainId: Number(id),
      name: CHAIN_NAMES[Number(id)] ?? `Chain ${id}`,
      endpoint: ep,
      isTestnet: [11155111, 84532, 421614, 11155420].includes(Number(id)),
    })),
  );

  const handleAddChain = () => {
    setAddError('');
    setAddSuccess('');
    const cid = parseInt(customChainId.trim(), 10);
    if (isNaN(cid) || cid <= 0) {
      setAddError('Chain ID harus angka valid');
      return;
    }
    if (!customName.trim()) {
      setAddError('Nama chain wajib diisi');
      return;
    }
    if (!customEndpoint.trim().startsWith('http')) {
      setAddError('Endpoint harus URL valid');
      return;
    }

    addCustomChain(cid, customName.trim(), customEndpoint.trim());

    setChainSnapshot((prev) => {
      const exists = prev.find((c) => c.chainId === cid);
      if (exists)
        return prev.map((c) =>
          c.chainId === cid
            ? { ...c, name: customName.trim(), endpoint: customEndpoint.trim() }
            : c,
        );
      return [
        ...prev,
        {
          chainId: cid,
          name: customName.trim(),
          endpoint: customEndpoint.trim(),
          isTestnet: false,
        },
      ];
    });

    setAddSuccess(`✓ ${customName} (${cid}) ditambahkan`);
    setCustomName('');
    setCustomChainId('');
    setCustomEndpoint('');
    setTimeout(() => setAddSuccess(''), 3000);
  };

  const handleRefreshAll = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const mainnets = chainSnapshot.filter((c) => !c.isTestnet);
  const testnets = chainSnapshot.filter((c) => c.isTestnet);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Jaringan yang Di-search
        </p>
        <button
          onClick={handleRefreshAll}
          disabled={refreshing}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className={cn('w-2.5 h-2.5', refreshing && 'animate-spin')} />
          {refreshing ? 'Searching…' : 'Search Ulang'}
        </button>
      </div>

      {/* Mainnet list */}
      <div className="space-y-1">
        <p className="text-[9px] text-muted-foreground/50 uppercase tracking-widest px-1">
          Mainnet
        </p>
        {mainnets.map(({ chainId, name }) => (
          <div
            key={chainId}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted/20 border border-border/30">
            <span className="text-sm leading-none">{CHAIN_ICONS[chainId] ?? '🔗'}</span>
            <span className="flex-1 text-[10px] text-foreground font-medium">{name}</span>
            <span className="text-[9px] font-mono text-muted-foreground/40">{chainId}</span>
          </div>
        ))}
      </div>

      {/* Testnet list */}
      <div className="space-y-1">
        <p className="text-[9px] text-muted-foreground/50 uppercase tracking-widest px-1">
          Testnet
        </p>
        {testnets.map(({ chainId, name }) => (
          <div
            key={chainId}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-amber-500/5 border border-amber-500/15">
            <span className="text-sm leading-none">{CHAIN_ICONS[chainId] ?? '🧪'}</span>
            <span className="flex-1 text-[10px] text-amber-400/80 font-medium">{name}</span>
            <span className="text-[9px] font-mono text-muted-foreground/40">{chainId}</span>
          </div>
        ))}
      </div>

      {/* Add custom chain */}
      <div className="overflow-hidden border border-border/40 rounded-xl">
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="flex items-center gap-2 w-full px-3 py-2 text-[10px] text-muted-foreground hover:text-foreground bg-muted/10 hover:bg-muted/20 transition-colors">
          <span className="text-sm">{showAdd ? '▾' : '▸'}</span>
          <span className="font-medium">Tambah Network Custom</span>
          <span className="ml-auto text-[9px] opacity-50">The Graph endpoint</span>
        </button>

        {showAdd && (
          <div className="p-3 space-y-2 border-t border-border/30">
            <div className="grid grid-cols-2 gap-2">
              <input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Nama (e.g. Monad Testnet)"
                className="px-2.5 py-1.5 text-[10px] rounded-lg border border-border/50 bg-muted/20 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-violet-500/60"
              />
              <input
                value={customChainId}
                onChange={(e) => setCustomChainId(e.target.value)}
                placeholder="Chain ID (e.g. 10143)"
                className="px-2.5 py-1.5 text-[10px] rounded-lg border border-border/50 bg-muted/20 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-violet-500/60"
              />
            </div>
            <input
              value={customEndpoint}
              onChange={(e) => setCustomEndpoint(e.target.value)}
              placeholder="https://api.studio.thegraph.com/query/.../sablier-flow-.../version/latest"
              className="w-full px-2.5 py-1.5 text-[10px] font-mono rounded-lg border border-border/50 bg-muted/20 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-violet-500/60"
            />
            {addError && <p className="text-[9px] text-red-400">{addError}</p>}
            {addSuccess && <p className="text-[9px] text-emerald-400">{addSuccess}</p>}
            <button
              onClick={handleAddChain}
              className="w-full py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-semibold transition-colors">
              Tambahkan & Search
            </button>
            <p className="text-[9px] text-muted-foreground/40 leading-relaxed">
              Endpoint harus Sablier Flow subgraph di The Graph Studio. Format:{' '}
              <code className="text-violet-400/60">
                api.studio.thegraph.com/query/ID/sablier-flow-CHAIN/version/latest
              </code>
            </p>
          </div>
        )}
      </div>
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
    availableStreams,
    selectedStreamId,
    selectStream,
    tokenPrice,
    currentPlan,
    isDev,
    error,
    connect,
    disconnect,
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
  // Stream exists but locked (paused or debt) — show stream card but with lock banner
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
        const msg =
          res?.error === 'NO_PROJECT_ID'
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
        } catch {
          /* ignore */
        }
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
          {(
            [
              { id: 'status', label: '📡 Status' },
              { id: 'networks', label: '🌐 Networks' },
              { id: 'plans', label: '📋 Fitur' },
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

              {/* Logout row — always visible when paid/connected */}
              {(hasPaidPlan || hasLockedStream) && walletAddress && (
                <div className="flex items-center justify-between px-1 -mb-1">
                  <span className="text-[10px] text-muted-foreground/50 font-mono">
                    {fmt.addr(walletAddress)}
                    {selectedChainId && (
                      <span className="ml-1.5 text-[9px] opacity-60">
                        · {CHAIN_NAMES[selectedChainId] ?? `Chain ${selectedChainId}`}
                      </span>
                    )}
                  </span>
                  <button
                    onClick={logout}
                    className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-red-400 transition-colors">
                    <LogOut className="w-3 h-3" /> Logout
                  </button>
                </div>
              )}

              {/* Active stream card */}
              {showStreamCard && activeStream && (
                <div className="space-y-3">
                  {/* Multi-stream selector — shown when >1 stream available */}
                  {availableStreams.length > 1 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-semibold px-0.5">
                        Streams ({availableStreams.length})
                      </p>
                      <div className="space-y-1.5">
                        {availableStreams.map((s) => {
                          const isSelected = s.streamId === selectedStreamId;
                          const isLocked = s.paused || s.hasDebt;
                          return (
                            <button
                              key={s.streamId}
                              onClick={() => selectStream(s.streamId)}
                              className={cn(
                                'w-full flex items-center justify-between px-3 py-2 rounded-lg border text-left transition-all',
                                isSelected
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
                              <div className="flex items-center flex-shrink-0 gap-2 ml-2">
                                {(() => {
                                  const rate = Number(s.ratePerSecond) / 10 ** s.tokenDecimals;
                                  const mo = rate * 86400 * 30;
                                  const usd = tokenPrice != null ? mo * tokenPrice : null;
                                  return (
                                    <span className="text-[10px] text-muted-foreground text-right">
                                      {usd != null
                                        ? `$${usd.toFixed(2)}/mo`
                                        : `${mo.toFixed(4)} ${s.tokenSymbol}/mo`}
                                    </span>
                                  );
                                })()}
                                {isSelected && (
                                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
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
                            hasLockedStream ? 'bg-amber-400' : 'animate-pulse',
                            !hasLockedStream && currentPlan === 'pro' ? 'bg-violet-400' : '',
                            !hasLockedStream && currentPlan !== 'pro' ? 'bg-blue-400' : '',
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
                      {/* Token + Network */}
                      <div className="space-y-0.5">
                        <p className="text-muted-foreground">Token</p>
                        <p className="font-medium">{activeStream.tokenSymbol}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-muted-foreground">Network</p>
                        <p className="font-medium">{activeStream.chainName}</p>
                      </div>
                      {/* Net Deposits (total ever deposited by sender) */}
                      <div className="space-y-0.5">
                        <p className="text-muted-foreground">Net Deposit</p>
                        <p className="font-medium">
                          {fmt.usd(activeStream.netDeposited ?? activeStream.depositAmount)}{' '}
                          {activeStream.tokenSymbol}
                        </p>
                      </div>
                      {/* Balance = refundable / remaining in stream */}
                      <div className="space-y-0.5">
                        <p className="text-muted-foreground">Balance</p>
                        <p className="font-medium">
                          {fmt.usd(activeStream.balance)} {activeStream.tokenSymbol}
                        </p>
                      </div>
                      {/* Withdrawn by recipient */}
                      <div className="space-y-0.5">
                        <p className="text-muted-foreground">Withdrawn</p>
                        <p className="font-medium">
                          {fmt.usd(activeStream.withdrawnAmount)} {activeStream.tokenSymbol}
                        </p>
                      </div>
                      {/* Debt — shown in red if > 0 */}
                      <div className="space-y-0.5">
                        <p
                          className={cn(
                            'text-muted-foreground',
                            activeStream.hasDebt && 'text-red-400 font-semibold',
                          )}>
                          {activeStream.hasDebt ? '⚠ Debt' : 'Debt'}
                        </p>
                        <p
                          className={cn(
                            'font-medium',
                            activeStream.hasDebt ? 'text-red-400' : 'text-foreground',
                          )}>
                          {activeStream.hasDebt
                            ? `${fmt.usd(activeStream.debtRaw)} ${activeStream.tokenSymbol}`
                            : '—'}
                        </p>
                      </div>
                      {/* Dates */}
                      <div className="space-y-0.5">
                        <p className="text-muted-foreground">Mulai</p>
                        <p className="font-medium">{fmt.date(activeStream.startTime)}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-muted-foreground">Berakhir</p>
                        <p className="font-medium">{fmt.date(activeStream.endTime)}</p>
                      </div>
                    </div>

                    <StreamProgressBar stream={activeStream} plan={currentPlan} />
                  </div>

                  {/* Security lock banners */}
                  {(status as string) === 'paused' && (
                    <div className="flex items-start gap-2 p-3 text-xs border rounded-lg border-amber-500/30 bg-amber-500/10">
                      <span className="text-base leading-none text-amber-400">⏸</span>
                      <div>
                        <p className="font-semibold text-amber-400">Stream Paused</p>
                        <p className="text-amber-400/70 mt-0.5">
                          Semua fitur Basic &amp; Pro terkunci. Resume stream untuk mengaktifkan
                          kembali.
                        </p>
                      </div>
                    </div>
                  )}
                  {(status as string) === 'debt' && (
                    <div className="flex items-start gap-2 p-3 text-xs border rounded-lg border-red-500/30 bg-red-500/10">
                      <span className="text-base leading-none text-red-400">⚠</span>
                      <div>
                        <p className="font-semibold text-red-400">Stream Has Debt</p>
                        <p className="text-red-400/70 mt-0.5">
                          Sender perlu top-up stream. Fitur terkunci sampai debt = 0.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Stream Controls */}
                  <div className="space-y-2">
                    {/* Pause / Resume buttons */}
                    <div className="flex items-center gap-2">
                      {activeStream?.paused ? (
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
                          className="flex-1 h-7 text-xs gap-1.5 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/50">
                          {streamAction === 'pause' ? (
                            <>
                              <RefreshCw className="w-3 h-3 animate-spin" /> Pausing…
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3" /> Pause Stream
                            </>
                          )}
                        </Button>
                      )}
                      <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded border border-border/40 hover:border-border/60">
                        <RefreshCw className={cn('w-3 h-3', refreshing && 'animate-spin')} />
                        {refreshing ? 'Cek…' : 'Refresh'}
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

              {/* No stream — 3-step flow */}
              {!isDev && !hasPaidPlan && (
                <div className="space-y-3">
                  {error && (
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Network Selector — shown before connect */}
                  {!isConnected && (
                    <div className="overflow-hidden border rounded-xl border-border/40">
                      <div className="px-3 py-2 border-b bg-muted/10 border-border/30">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                          🌐 Pilih Network Stream
                        </p>
                        <p className="text-[9px] text-muted-foreground/50 mt-0.5">
                          Pilih network tempat kamu membuat Sablier stream. Kosongkan untuk
                          auto-detect.
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-1 p-2 overflow-y-auto max-h-48">
                        {/* Auto option */}
                        <button
                          onClick={() => setSelectedChainId(null)}
                          className={cn(
                            'col-span-2 flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-colors border',
                            selectedChainId === null
                              ? 'bg-violet-500/20 border-violet-500/50 text-violet-300'
                              : 'border-border/30 text-muted-foreground hover:bg-muted/20 hover:text-foreground',
                          )}>
                          <span>🔍</span>
                          <span className="flex-1 text-left">Auto-detect (search all chains)</span>
                          {selectedChainId === null && <span className="text-violet-400">✓</span>}
                        </button>
                        {/* Chain options */}
                        {Object.entries(THEGRAPH_ENDPOINTS).map(([cid]) => {
                          const id = Number(cid);
                          const name = CHAIN_NAMES[id] ?? `Chain ${id}`;
                          const isTestnet = [11155111, 84532, 421614, 11155420].includes(id);
                          const icons: Record<number, string> = {
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
                          return (
                            <button
                              key={id}
                              onClick={() => setSelectedChainId(id)}
                              className={cn(
                                'flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[9px] font-medium transition-colors border text-left',
                                selectedChainId === id
                                  ? isTestnet
                                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                                    : 'bg-violet-500/20 border-violet-500/50 text-violet-300'
                                  : 'border-border/20 text-muted-foreground hover:bg-muted/20 hover:text-foreground',
                              )}>
                              <span>{icons[id] ?? '🔗'}</span>
                              <span className="flex-1 truncate">{name}</span>
                              {selectedChainId === id && <span className="text-[8px]">✓</span>}
                            </button>
                          );
                        })}
                      </div>
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
                        ? `${chainName ?? `Chain ${chainId}`}${selectedChainId ? ` · Stream on ${CHAIN_NAMES[selectedChainId] ?? selectedChainId}` : ' · Auto-detect'}`
                        : 'WalletConnect QR · MetaMask · Trust · Rabby'
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

          {/* TAB: NETWORKS */}
          {activeTab === 'networks' && (
            <div className="p-5">
              <NetworkManager />
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

// ── StreamPaymentTooltip ─────────────────────────────────────────────────────
// Hover card yang muncul di atas LicenseBadge, menampilkan breakdown pembayaran

function useTokenPrice(symbol: string | undefined) {
  const [price, setPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!symbol) return;
    const stable = ['USDC', 'USDT', 'DAI', 'FRAX', 'LUSD'];
    if (stable.includes(symbol.toUpperCase())) {
      setPrice(1);
      return;
    }

    setLoading(true);
    const coinId =
      symbol.toUpperCase() === 'WETH'
        ? 'ethereum'
        : symbol.toUpperCase() === 'WBTC'
          ? 'bitcoin'
          : symbol.toLowerCase();

    fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`, {
      signal: AbortSignal.timeout(8000),
    })
      .then((r) => r.json())
      .then((j) => setPrice(j[coinId]?.usd ?? null))
      .catch(() => setPrice(null))
      .finally(() => setLoading(false));
  }, [symbol]);

  return { price, loading };
}

function StreamPaymentCard({ stream, plan }: { stream: ActiveStream; plan: Plan }) {
  const { price: tokenPrice, loading: priceLoading } = useTokenPrice(stream.tokenSymbol);
  const [now, setNow] = useState(() => Date.now() / 1000);

  // Tick every second for live calculation
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() / 1000), 1000);
    return () => clearInterval(id);
  }, []);

  const decimals = stream.tokenDecimals;
  const rateRaw = Number(stream.ratePerSecond);
  const ratePerSec = rateRaw / 10 ** decimals;
  const ratePerMin = ratePerSec * 60;
  const ratePerHour = ratePerSec * 3600;
  const ratePerDay = ratePerSec * 86400;
  const ratePerMonth = ratePerSec * 86400 * 30;

  const usdPerSec = tokenPrice != null ? ratePerSec * tokenPrice : null;
  const usdPerMin = tokenPrice != null ? ratePerMin * tokenPrice : null;
  const usdPerHour = tokenPrice != null ? ratePerHour * tokenPrice : null;
  const usdPerDay = tokenPrice != null ? ratePerDay * tokenPrice : null;
  const usdPerMonth = tokenPrice != null ? ratePerMonth * tokenPrice : null;

  // Total streamed so far (withdrawn amount from contract + live accrual since lastAdjustmentTime)
  const alreadyWithdrawnTokens = Number(stream.withdrawnAmount) / 10 ** decimals;
  const liveAccrued = ratePerSec * Math.max(0, now - stream.lastAdjustmentTime);
  const totalStreamedTokens = alreadyWithdrawnTokens + liveAccrued;
  const totalStreamedUsd = tokenPrice != null ? totalStreamedTokens * tokenPrice : null;

  const fmt = (n: number, dp = 4) =>
    n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  const fmtUsd = (n: number) =>
    n < 0.01
      ? `<$0.01`
      : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtToken = (n: number) => (n < 0.00001 ? n.toExponential(3) : fmt(n, 6));

  const planColor = plan === 'pro' ? 'text-violet-400' : 'text-blue-400';
  const planBg =
    plan === 'pro' ? 'bg-violet-500/10 border-violet-500/25' : 'bg-blue-500/10 border-blue-500/25';
  const barColor = plan === 'pro' ? 'from-violet-500 to-violet-400' : 'from-blue-500 to-blue-400';

  const rows: Array<{ label: string; tokens: number; usd: number | null }> = [
    { label: 'per detik', tokens: ratePerSec, usd: usdPerSec },
    { label: 'per menit', tokens: ratePerMin, usd: usdPerMin },
    { label: 'per jam', tokens: ratePerHour, usd: usdPerHour },
    { label: 'per hari', tokens: ratePerDay, usd: usdPerDay },
    { label: 'per bulan', tokens: ratePerMonth, usd: usdPerMonth },
  ];

  return (
    <div
      className={`w-[280px] rounded-xl border ${planBg} bg-card/95 backdrop-blur-sm shadow-2xl shadow-black/60 overflow-hidden`}>
      {/* Top gradient line */}
      <div
        className={`h-[1.5px] bg-gradient-to-r from-transparent ${plan === 'pro' ? 'via-violet-500/60' : 'via-blue-500/60'} to-transparent`}
      />

      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-b border-border/30">
        <div className="flex items-center gap-2 mb-1">
          <div
            className={`w-1.5 h-1.5 rounded-full animate-pulse ${plan === 'pro' ? 'bg-violet-400' : 'bg-blue-400'}`}
          />
          <span className={`text-[10px] font-semibold ${planColor}`}>
            Stream Aktif — {PLAN_META[plan].label}
          </span>
          <span className="ml-auto text-[9px] text-muted-foreground font-mono">
            {stream.chainName}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground font-mono">
            {stream.tokenSymbol}
            {tokenPrice != null && (
              <span className="ml-1 text-emerald-400">
                @ ${tokenPrice.toLocaleString('en-US', { maximumFractionDigits: 4 })}
              </span>
            )}
            {priceLoading && <span className="ml-1 text-muted-foreground/50">fetching…</span>}
          </span>
          <span className="text-[9px] text-muted-foreground font-mono">
            dari {stream.sender.slice(0, 6)}…{stream.sender.slice(-4)}
          </span>
        </div>
      </div>

      {/* Rate breakdown table */}
      <div className="px-3 py-2 space-y-0.5">
        <p className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-widest mb-1.5 flex items-center gap-1">
          <Gauge className="w-2.5 h-2.5" /> Rate Pembayaran
        </p>
        {rows.map(({ label, tokens, usd }) => (
          <div key={label} className="flex items-center justify-between py-0.5">
            <span className="text-[10px] text-muted-foreground w-[68px]">{label}</span>
            <span className="text-[10px] font-mono text-foreground/80 flex-1 text-right">
              {fmtToken(tokens)} {stream.tokenSymbol}
            </span>
            <span
              className={`text-[10px] font-semibold w-[68px] text-right ${usd != null ? 'text-emerald-400' : 'text-muted-foreground/40'}`}>
              {usd != null ? fmtUsd(usd) : '—'}
            </span>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="h-px mx-3 bg-border/30" />

      {/* Total streamed */}
      <div className="px-3 py-2 space-y-1">
        <p className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-widest mb-1.5 flex items-center gap-1">
          <TrendingUp className="w-2.5 h-2.5" /> Total Diterima (Live)
        </p>
        <div className="flex items-end justify-between">
          <div>
            <p className="font-mono text-sm font-bold text-foreground">
              {fmtToken(totalStreamedTokens)}{' '}
              <span className="text-xs font-normal text-muted-foreground">
                {stream.tokenSymbol}
              </span>
            </p>
            {totalStreamedUsd != null && (
              <p className={`text-xs font-semibold ${planColor} flex items-center gap-1`}>
                <DollarSign className="w-3 h-3" />
                {fmtUsd(totalStreamedUsd)} USD
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-[9px] text-muted-foreground">Tujuan</p>
            <p className="text-[9px] font-mono text-muted-foreground/70">
              {RECIPIENT_ADDRESS.slice(0, 8)}…{RECIPIENT_ADDRESS.slice(-6)}
            </p>
          </div>
        </div>

        {/* Live streaming indicator */}
        <div className="flex items-center gap-1.5 mt-1">
          <div className="flex-1 h-1 overflow-hidden rounded-full bg-muted/40">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${barColor} animate-pulse`}
              style={{ width: '100%', opacity: 0.7 }}
            />
          </div>
          <span className="text-[9px] text-muted-foreground/60 flex items-center gap-0.5">
            <CircleDot className="w-2 h-2 text-emerald-400" />
            streaming...
          </span>
        </div>
      </div>

      {/* Monthly plan context */}
      <div className="px-3 pb-3">
        <div
          className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg ${plan === 'pro' ? 'bg-violet-500/10' : 'bg-blue-500/10'}`}>
          <span className="text-[9px] text-muted-foreground">
            {PLAN_META[plan].label} threshold
          </span>
          <span className={`text-[10px] font-semibold ${planColor}`}>
            ≥ ${PLAN_MIN_DEPOSIT[plan === 'pro' ? 'pro' : 'basic']}/bln
          </span>
          {usdPerMonth != null && (
            <span className="flex items-center gap-0.5 text-[10px] text-emerald-400 font-semibold">
              <ArrowUpRight className="w-2.5 h-2.5" />
              {fmtUsd(usdPerMonth)}/bln ✓
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// LicenseBadge — sidebar footer
export function LicenseBadge({ onClick }: { onClick?: () => void }) {
  const {
    status,
    currentPlan,
    activeStream,
    walletAddress,
    chainName,
    chainId,
    isDev,
    pauseStream,
    resumeStream,
    streamActionPending,
  } = useLicense();
  const [showModal, setShowModal] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const badgeRef = useRef<HTMLDivElement>(null);

  const hasPaidPlan = status === 'basic' || status === 'pro' || isDev || status === 'dev';

  const updateTooltipPos = () => {
    if (!badgeRef.current) return;
    const rect = badgeRef.current.getBoundingClientRect();
    const W = 292;
    // Always show ABOVE the badge, anchored to right edge of sidebar
    const left = Math.max(8, rect.left - W + rect.width);
    setTooltipStyle({
      position: 'fixed',
      bottom: window.innerHeight - rect.top + 10,
      left,
      width: W,
      zIndex: 99999,
    });
  };

  const handleMouseEnter = () => {
    updateTooltipPos();
    setHovered(true);
  };
  const handleMouseLeave = () => setHovered(false);

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

  const showTooltip = hovered && hasPaidPlan && !!walletAddress;

  return (
    <div
      ref={badgeRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={(e) => {
        // Only hide if not hovering over the tooltip itself
        const related = e.relatedTarget as HTMLElement | null;
        if (related && related.closest?.('[data-tooltip-root]')) return;
        handleMouseLeave();
      }}>
      {/* Portal tooltip — renders into document.body, bypasses sidebar overflow:hidden */}
      {showTooltip &&
        createPortal(
          <StreamInfoTooltip
            style={tooltipStyle}
            status={status}
            currentPlan={currentPlan}
            activeStream={activeStream}
            walletAddress={walletAddress}
            chainName={chainName}
            chainId={chainId}
            isDev={isDev}
            onPause={pauseStream}
            onResume={resumeStream}
            streamActionPending={streamActionPending}
          />,
          document.body,
        )}

      <button
        onClick={() => {
          onClick?.();
          setShowModal(true);
        }}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-medium transition-all w-full',
          cfg.cls,
          hasPaidPlan && 'hover:brightness-110',
        )}>
        {cfg.icon}
        <span className="flex-1 text-left">{cfg.text}</span>
        {hasPaidPlan && <TrendingUp className="w-2.5 h-2.5 opacity-40" />}
      </button>
      {showModal && <LicenseModal onClose={() => setShowModal(false)} />}
    </div>
  );
}

// ── StreamInfoTooltip ─────────────────────────────────────────────────────────
// Standalone tooltip — works with OR without activeStream (dev/testnet bypass)

function StreamInfoTooltip({
  style,
  status,
  currentPlan,
  activeStream,
  walletAddress,
  chainName,
  chainId,
  isDev,
  onPause,
  onResume,
  streamActionPending,
}: {
  style: React.CSSProperties;
  status: Status;
  currentPlan: Plan;
  activeStream?: ActiveStream;
  walletAddress?: string;
  chainName?: string;
  chainId?: number;
  isDev: boolean;
  onPause: () => Promise<void>;
  onResume: () => Promise<void>;
  streamActionPending: boolean;
}) {
  const [localAction, setLocalAction] = useState<'pause' | 'resume' | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const handlePauseClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLocalAction('pause');
    setLocalError(null);
    try {
      await onPause();
    } catch (err: any) {
      setLocalError(err.message ?? 'Error');
    } finally {
      setLocalAction(null);
    }
  };
  const handleResumeClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLocalAction('resume');
    setLocalError(null);
    try {
      await onResume();
    } catch (err: any) {
      setLocalError(err.message ?? 'Error');
    } finally {
      setLocalAction(null);
    }
  };
  const { price: tokenPrice, loading: priceLoading } = useTokenPrice(activeStream?.tokenSymbol);
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() / 1000), 1000);
    return () => clearInterval(id);
  }, []);

  const planColor =
    currentPlan === 'pro' ? '#a78bfa' : currentPlan === 'basic' ? '#60a5fa' : '#6ee7b7';
  const planBorder =
    currentPlan === 'pro'
      ? 'rgba(167,139,250,0.2)'
      : currentPlan === 'basic'
        ? 'rgba(96,165,250,0.2)'
        : 'rgba(110,231,183,0.2)';
  const planGradient =
    currentPlan === 'pro'
      ? 'rgba(167,139,250,0.6)'
      : currentPlan === 'basic'
        ? 'rgba(96,165,250,0.6)'
        : 'rgba(110,231,183,0.6)';
  const planBg =
    currentPlan === 'pro'
      ? 'rgba(167,139,250,0.05)'
      : currentPlan === 'basic'
        ? 'rgba(96,165,250,0.05)'
        : 'rgba(110,231,183,0.05)';

  // ── With stream data ──
  let ratePerSec = 0,
    ratePerMin = 0,
    ratePerHour = 0,
    ratePerDay = 0,
    ratePerMonth = 0;
  let totalStreamedTokens = 0;
  let usdPerDay: number | null = null,
    usdPerMonth: number | null = null,
    usdTotal: number | null = null;
  let decimals = 6;

  if (activeStream) {
    decimals = activeStream.tokenDecimals;
    ratePerSec = Number(activeStream.ratePerSecond) / 10 ** decimals;
    ratePerMin = ratePerSec * 60;
    ratePerHour = ratePerSec * 3600;
    ratePerDay = ratePerSec * 86400;
    ratePerMonth = ratePerSec * 86400 * 30;
    const withdrawn = Number(activeStream.withdrawnAmount) / 10 ** decimals;
    const liveAccrued = ratePerSec * Math.max(0, now - activeStream.lastAdjustmentTime);
    totalStreamedTokens = withdrawn + liveAccrued;

    if (tokenPrice != null) {
      usdPerDay = ratePerDay * tokenPrice;
      usdPerMonth = ratePerMonth * tokenPrice;
      usdTotal = totalStreamedTokens * tokenPrice;
    }
  }

  const fmtAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
  const fmtUsd = (n: number) =>
    n < 0.001
      ? '<$0.001'
      : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtTok = (n: number, sym: string) => {
    const s =
      n < 0.00001
        ? n.toExponential(3)
        : n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
    return `${s} ${sym}`;
  };

  return (
    <div
      style={{
        ...style,
        background: 'hsl(var(--card, 222 47% 11%))',
        border: `1px solid ${planBorder}`,
        borderRadius: 14,
        overflow: 'hidden',
        fontFamily: 'inherit',
        boxShadow: '0 20px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04)',
      }}>
      {/* Top gradient line */}
      <div
        style={{
          height: 2,
          background: `linear-gradient(90deg, transparent, ${planGradient}, transparent)`,
        }}
      />

      {/* Header — wallet + plan + network */}
      <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 4,
          }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: planColor,
                boxShadow: `0 0 6px ${planColor}`,
                animation: 'pulse 2s infinite',
              }}
            />
            <span
              style={{ fontSize: 10, fontWeight: 700, color: planColor, letterSpacing: '0.02em' }}>
              {isDev ? 'Dev Mode' : `${PLAN_META[currentPlan].label} Plan`}
            </span>
          </div>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>
            {chainName ?? `Chain ${chainId}`}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>
            {walletAddress ? fmtAddr(walletAddress) : '—'}
          </span>
          {activeStream && (
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>
              {activeStream.tokenSymbol}
              {tokenPrice != null && (
                <span style={{ color: '#6ee7b7', marginLeft: 4 }}>
                  @ ${tokenPrice.toLocaleString('en-US', { maximumFractionDigits: 4 })}
                </span>
              )}
              {priceLoading && (
                <span style={{ color: 'rgba(255,255,255,0.2)', marginLeft: 4 }}>…</span>
              )}
            </span>
          )}
        </div>
      </div>

      {activeStream ? (
        <>
          {/* Rate rows */}
          <div style={{ padding: '8px 12px 6px' }}>
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: 'rgba(255,255,255,0.3)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}>
              <span>⚡</span> Rate Transfer
            </div>
            {[
              {
                label: 'Per detik',
                tok: ratePerSec,
                usd: tokenPrice != null ? ratePerSec * tokenPrice : null,
              },
              {
                label: 'Per menit',
                tok: ratePerMin,
                usd: tokenPrice != null ? ratePerMin * tokenPrice : null,
              },
              {
                label: 'Per jam',
                tok: ratePerHour,
                usd: tokenPrice != null ? ratePerHour * tokenPrice : null,
              },
              { label: 'Per hari', tok: ratePerDay, usd: usdPerDay },
              { label: 'Per bulan', tok: ratePerMonth, usd: usdPerMonth },
            ].map(({ label, tok, usd }) => (
              <div
                key={label}
                style={{ display: 'flex', alignItems: 'center', padding: '2px 0', gap: 4 }}>
                <span
                  style={{
                    fontSize: 9,
                    color: 'rgba(255,255,255,0.35)',
                    width: 58,
                    flexShrink: 0,
                  }}>
                  {label}
                </span>
                <span
                  style={{
                    fontSize: 9,
                    fontFamily: 'monospace',
                    color: 'rgba(255,255,255,0.65)',
                    flex: 1,
                    textAlign: 'right',
                  }}>
                  {fmtTok(tok, activeStream.tokenSymbol)}
                </span>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    color: usd != null ? '#6ee7b7' : 'rgba(255,255,255,0.2)',
                    width: 62,
                    textAlign: 'right',
                    fontFamily: 'monospace',
                  }}>
                  {usd != null ? fmtUsd(usd) : '—'}
                </span>
              </div>
            ))}
          </div>

          <div style={{ margin: '0 12px', height: 1, background: 'rgba(255,255,255,0.06)' }} />

          {/* Total streamed — live counter */}
          <div style={{ padding: '8px 12px 10px' }}>
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: 'rgba(255,255,255,0.3)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}>
              <span>📈</span> Total Dikirim (Live)
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                marginBottom: 6,
              }}>
              <div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: 'white',
                    fontFamily: 'monospace',
                    letterSpacing: '-0.02em',
                  }}>
                  {fmtTok(totalStreamedTokens, activeStream.tokenSymbol)}
                </div>
                {usdTotal != null && (
                  <div style={{ fontSize: 11, fontWeight: 600, color: planColor, marginTop: 1 }}>
                    ≈ {fmtUsd(usdTotal)}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)' }}>ke</div>
                <div
                  style={{ fontSize: 8, fontFamily: 'monospace', color: 'rgba(255,255,255,0.3)' }}>
                  {fmtAddr(RECIPIENT_ADDRESS)}
                </div>
              </div>
            </div>

            {/* Live stream bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div
                style={{
                  flex: 1,
                  height: 3,
                  borderRadius: 99,
                  background: 'rgba(255,255,255,0.08)',
                  overflow: 'hidden',
                }}>
                <div
                  style={{
                    height: '100%',
                    borderRadius: 99,
                    background: `linear-gradient(90deg, ${planColor}, ${planGradient})`,
                    width: '100%',
                    opacity: 0.7,
                    animation: 'pulse 2s ease-in-out infinite',
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: 8,
                  color: activeStream?.paused ? '#f59e0b' : '#6ee7b7',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  flexShrink: 0,
                }}>
                {activeStream?.paused ? '⏸ paused' : '● streaming…'}
              </span>
            </div>

            {/* Pause / Resume button */}
            <div style={{ marginTop: 8, display: 'flex', gap: 6, pointerEvents: 'all' }}>
              {activeStream?.paused ? (
                <button
                  onClick={handleResumeClick}
                  disabled={!!localAction || streamActionPending}
                  style={{
                    flex: 1,
                    padding: '5px 10px',
                    borderRadius: 7,
                    border: '1px solid rgba(110,231,183,0.35)',
                    background:
                      localAction === 'resume' ? 'rgba(110,231,183,0.2)' : 'rgba(110,231,183,0.1)',
                    color: '#6ee7b7',
                    fontSize: 9,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    opacity: !!localAction || streamActionPending ? 0.5 : 1,
                  }}>
                  {localAction === 'resume' ? '↻ Resuming…' : '▶ Resume Stream'}
                </button>
              ) : (
                <button
                  onClick={handlePauseClick}
                  disabled={!!localAction || streamActionPending}
                  style={{
                    flex: 1,
                    padding: '5px 10px',
                    borderRadius: 7,
                    border: '1px solid rgba(245,158,11,0.35)',
                    background:
                      localAction === 'pause' ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.08)',
                    color: '#f59e0b',
                    fontSize: 9,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    opacity: !!localAction || streamActionPending ? 0.5 : 1,
                  }}>
                  {localAction === 'pause' ? '↻ Pausing…' : '⏸ Pause Stream'}
                </button>
              )}
            </div>
            {localError && (
              <div
                style={{
                  marginTop: 4,
                  fontSize: 8,
                  color: '#f87171',
                  wordBreak: 'break-all',
                  padding: '4px 6px',
                  borderRadius: 5,
                  background: 'rgba(248,113,113,0.1)',
                  pointerEvents: 'all',
                }}>
                ⚠ {localError}
              </div>
            )}
          </div>

          {/* Plan threshold check */}
          <div
            style={{
              margin: '0 12px 10px',
              padding: '6px 10px',
              borderRadius: 8,
              background: planBg,
              border: `1px solid ${planBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>
              {PLAN_META[currentPlan].label} threshold
            </span>
            <span
              style={{ fontSize: 9, fontWeight: 700, color: planColor, fontFamily: 'monospace' }}>
              ≥ ${PLAN_MIN_DEPOSIT[currentPlan === 'pro' ? 'pro' : 'basic']}/bln
            </span>
            {usdPerMonth != null && (
              <span
                style={{ fontSize: 9, fontWeight: 700, color: '#6ee7b7', fontFamily: 'monospace' }}>
                ↑ {fmtUsd(usdPerMonth)}/bln ✓
              </span>
            )}
          </div>
        </>
      ) : (
        /* No stream — dev bypass or testnet mode */
        <div style={{ padding: '12px' }}>
          <div
            style={{
              padding: '10px',
              borderRadius: 8,
              background: planBg,
              border: `1px solid ${planBorder}`,
              marginBottom: 8,
            }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: planColor, marginBottom: 4 }}>
              {isDev ? '🛡️ Dev Mode — Semua fitur unlock' : '🧪 Testnet bypass aktif'}
            </div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
              Stream check dilewati. Untuk production, buat Sablier stream ke recipient address.
            </div>
          </div>
          <div
            style={{
              fontSize: 9,
              color: 'rgba(255,255,255,0.3)',
              fontFamily: 'monospace',
              wordBreak: 'break-all',
            }}>
            Recipient: {RECIPIENT_ADDRESS}
          </div>
        </div>
      )}
    </div>
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
