import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { TxRecord, DeployedContract } from '../../types';
import { ScrollArea } from '../ui/primitives';
import {
  Activity,
  TrendingUp,
  Clock,
  Hash,
  Layers,
  CheckCircle2,
  XCircle,
  Zap,
  Flame,
  Radio,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  Minus,
  Wallet,
  Box,
  ArrowRight,
  BarChart3,
  GitBranch,
  Cpu,
  Database,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts';

interface Props {
  txHistory: TxRecord[];
  deployedContracts: DeployedContract[];
  rpcUrl: string;
}

type ViewMode = 'overview' | 'gas' | 'functions' | 'blocks';

interface BlockInfo {
  number: number;
  timestamp: number;
  txCount: number;
  gasUsed: number;
  gasLimit: number;
  baseFeePerGas?: number;
  miner: string;
  hash: string;
  transactions: string[];
}

interface BlockHistory {
  number: number;
  gasUsed: number;
  gasLimit: number;
  txCount: number;
  baseFee: number;
  time: string;
  hash: string;
}

interface ChainTx {
  hash: string;
  from: string;
  to: string | null;
  value: string;
  gas: string;
  blockNumber: number;
  status?: 'success' | 'failed' | 'pending';
  contractName?: string;
  functionSig?: string;
}

async function rpc(url: string, method: string, params: any[] = []) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return d.result;
}

//  Sparkline 
function Sparkline({ data, color = '#f97316', height = 32 }: { data: number[]; color?: string; height?: number }) {
  if (data.length < 2) return <div style={{ height }} className="flex items-center justify-center opacity-10"><div className="w-full h-px bg-current opacity-30" /></div>;
  const max = Math.max(...data, 1), min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  const gradId = `sg-${color.replace(/[^a-z0-9]/gi, '')}${height}`;
  return (
    <svg width="100%" height={height} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={`0,${height} ${pts} 100,${height}`} fill={`url(#${gradId})`} stroke="none" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

//  KPI Card 
function KpiCard({ icon: Icon, label, value, sub, accent, trend, spark }: {
  icon: any; label: string; value: string; sub?: string;
  accent: string; trend?: 'up' | 'down' | 'flat'; spark?: number[];
}) {
  const accentMap: Record<string, { text: string; bg: string; border: string; spark: string }> = {
    sky:     { text: 'text-sky-400',     bg: 'bg-sky-500/8',     border: 'border-sky-500/20',     spark: '#0ea5e9' },
    orange:  { text: 'text-orange-400',  bg: 'bg-orange-500/8',  border: 'border-orange-500/20',  spark: '#f97316' },
    amber:   { text: 'text-amber-400',   bg: 'bg-amber-500/8',   border: 'border-amber-500/20',   spark: '#f59e0b' },
    violet:  { text: 'text-violet-400',  bg: 'bg-violet-500/8',  border: 'border-violet-500/20',  spark: '#8b5cf6' },
    emerald: { text: 'text-emerald-400', bg: 'bg-emerald-500/8', border: 'border-emerald-500/20', spark: '#10b981' },
    rose:    { text: 'text-rose-400',    bg: 'bg-rose-500/8',    border: 'border-rose-500/20',    spark: '#f43f5e' },
    cyan:    { text: 'text-cyan-400',    bg: 'bg-cyan-500/8',    border: 'border-cyan-500/20',    spark: '#06b6d4' },
  };
  const a = accentMap[accent] ?? accentMap.sky;

  return (
    <div className={cn('relative flex flex-col gap-1 p-3.5 overflow-hidden border rounded-xl transition-all group hover:border-opacity-60', a.bg, a.border)}>
      <div className="flex items-start justify-between">
        <div className={cn('w-6 h-6 rounded-md flex items-center justify-center', `bg-${accent}-500/15`)}>
          <Icon className={cn('w-3.5 h-3.5', a.text)} />
        </div>
        {trend && (
          <span className={cn('text-[9px] flex items-center gap-0.5 font-mono',
            trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-rose-400' : 'text-muted-foreground/30')}>
            {trend === 'up' ? <ChevronUp className="w-2.5 h-2.5" /> : trend === 'down' ? <ChevronDown className="w-2.5 h-2.5" /> : <Minus className="w-2.5 h-2.5" />}
          </span>
        )}
      </div>
      <div className={cn('text-2xl font-mono font-bold leading-none mt-0.5 tracking-tight', a.text)}>{value}</div>
      <div className="text-[10px] text-muted-foreground/60 font-medium">{label}</div>
      {sub && <div className="text-[9px] text-muted-foreground/35 font-mono">{sub}</div>}
      {spark && spark.length > 1 && (
        <div className="mt-1.5 opacity-60 group-hover:opacity-90 transition-opacity">
          <Sparkline data={spark} color={a.spark} height={26} />
        </div>
      )}
    </div>
  );
}

//  Chart Tooltip 
function CT({ active, payload, label, unit = '' }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover/95 backdrop-blur-sm border border-border/60 rounded-lg px-3 py-2 shadow-xl text-[11px]">
      {label && <p className="mb-1.5 font-mono text-muted-foreground/60 text-[10px]">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-mono font-semibold">
          {p.name}: {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}{unit}
        </p>
      ))}
    </div>
  );
}

//  Tx Badge 
function TxBadge({ status }: { status: 'success' | 'failed' | 'pending' }) {
  return status === 'success'
    ? <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0 shadow-[0_0_4px_#10b981]" />
    : status === 'failed'
    ? <span className="w-1.5 h-1.5 rounded-full bg-rose-400 flex-shrink-0" />
    : <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0 animate-pulse" />;
}

function heatColor(ratio: number) {
  if (ratio === 0) return 'rgba(255,255,255,0.03)';
  if (ratio < 0.2) return 'rgba(251,146,60,0.15)';
  if (ratio < 0.4) return 'rgba(251,146,60,0.32)';
  if (ratio < 0.6) return 'rgba(251,146,60,0.52)';
  if (ratio < 0.8) return 'rgba(249,115,22,0.72)';
  return 'rgba(234,88,12,0.92)';
}

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#f43f5e', '#06b6d4'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ══════════════════════════════════════════════════════════════════════════════
export default function AnalyticsPanel({ txHistory, deployedContracts, rpcUrl }: Props) {
  const [view, setView] = useState<ViewMode>('overview');
  const [blockInfo, setBlockInfo] = useState<BlockInfo | null>(null);
  const [blockHistory, setBlockHistory] = useState<BlockHistory[]>([]);
  const [chainTxs, setChainTxs] = useState<ChainTx[]>([]); // live-fetched from chain
  const [live, setLive] = useState(true);
  const [pulse, setPulse] = useState(false);
  const lastBlockRef = useRef<number>(-1);
  const knownAddresses = useMemo(() => {
    const m: Record<string, string> = {};
    deployedContracts.forEach(dc => { m[dc.address.toLowerCase()] = dc.name; });
    return m;
  }, [deployedContracts]);

  //  Fetch block + its txs 
  const fetchLatest = useCallback(async () => {
    if (!rpcUrl) return;
    try {
      const b = await rpc(rpcUrl, 'eth_getBlockByNumber', ['latest', true]);
      if (!b) return;
      const num = parseInt(b.number, 16);
      if (num === lastBlockRef.current) return; // same block, skip
      lastBlockRef.current = num;
      setPulse(true);
      setTimeout(() => setPulse(false), 600);

      const info: BlockInfo = {
        number: num,
        timestamp: parseInt(b.timestamp, 16),
        txCount: (b.transactions || []).length,
        gasUsed: parseInt(b.gasUsed, 16),
        gasLimit: parseInt(b.gasLimit, 16),
        baseFeePerGas: b.baseFeePerGas ? parseInt(b.baseFeePerGas, 16) : undefined,
        miner: b.miner || '',
        hash: b.hash || '',
        transactions: (b.transactions || []).map((t: any) => typeof t === 'string' ? t : t.hash),
      };
      setBlockInfo(info);

      const entry: BlockHistory = {
        number: num,
        gasUsed: info.gasUsed,
        gasLimit: info.gasLimit,
        txCount: info.txCount,
        baseFee: info.baseFeePerGas ? info.baseFeePerGas / 1e9 : 0,
        time: new Date(info.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        hash: info.hash,
      };
      setBlockHistory(prev => {
        if (prev.find(p => p.number === num)) return prev;
        return [...prev.slice(-49), entry];
      });

      // Fetch tx details + receipts for live tx feed
      const txObjs = (b.transactions || []).filter((t: any) => typeof t === 'object');
      if (txObjs.length > 0) {
        const newTxs: ChainTx[] = await Promise.all(
          txObjs.slice(0, 20).map(async (t: any) => {
            let status: 'success' | 'failed' | 'pending' = 'pending';
            try {
              const receipt = await rpc(rpcUrl, 'eth_getTransactionReceipt', [t.hash]);
              if (receipt) status = parseInt(receipt.status, 16) === 1 ? 'success' : 'failed';
            } catch {}
            const toAddr = (t.to || '').toLowerCase();
            const contractName = knownAddresses[toAddr];
            let functionSig = t.input && t.input.length >= 10 ? t.input.slice(0, 10) : undefined;
            return {
              hash: t.hash,
              from: t.from || '',
              to: t.to || null,
              value: t.value || '0x0',
              gas: t.gas || '0x0',
              blockNumber: num,
              status,
              contractName,
              functionSig,
            };
          })
        );
        setChainTxs(prev => {
          const existing = new Set(prev.map(t => t.hash));
          const fresh = newTxs.filter(t => !existing.has(t.hash));
          return [...fresh, ...prev].slice(0, 200);
        });
      }
    } catch {}
  }, [rpcUrl, knownAddresses]);

  // Also fetch recent blocks history on mount
  const fetchHistory = useCallback(async () => {
    if (!rpcUrl) return;
    try {
      const latest = await rpc(rpcUrl, 'eth_getBlockByNumber', ['latest', false]);
      if (!latest) return;
      const latestNum = parseInt(latest.number, 16);
      const toFetch = Array.from({ length: Math.min(20, latestNum + 1) }, (_, i) => latestNum - i);
      const blocks = await Promise.all(
        toFetch.map(n => rpc(rpcUrl, 'eth_getBlockByNumber', [`0x${n.toString(16)}`, true]).catch(() => null))
      );
      const entries: BlockHistory[] = blocks
        .filter(Boolean)
        .map((b: any) => ({
          number: parseInt(b.number, 16),
          gasUsed: parseInt(b.gasUsed, 16),
          gasLimit: parseInt(b.gasLimit, 16),
          txCount: (b.transactions || []).length,
          baseFee: b.baseFeePerGas ? parseInt(b.baseFeePerGas, 16) / 1e9 : 0,
          time: new Date(parseInt(b.timestamp, 16) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          hash: b.hash || '',
        }))
        .sort((a, b) => a.number - b.number);
      setBlockHistory(entries);

      // Collect chain txs from recent blocks
      const allChainTxs: ChainTx[] = [];
      for (const b of blocks.filter(Boolean)) {
        const txObjs = (b.transactions || []).filter((t: any) => typeof t === 'object');
        for (const t of txObjs.slice(0, 10)) {
          const toAddr = (t.to || '').toLowerCase();
          allChainTxs.push({
            hash: t.hash,
            from: t.from || '',
            to: t.to || null,
            value: t.value || '0x0',
            gas: t.gas || '0x0',
            blockNumber: parseInt(b.number, 16),
            status: 'success', // assume success for historical
            contractName: knownAddresses[toAddr],
            functionSig: t.input?.length >= 10 ? t.input.slice(0, 10) : undefined,
          });
        }
      }
      if (allChainTxs.length > 0) setChainTxs(allChainTxs.slice(0, 200));
    } catch {}
  }, [rpcUrl, knownAddresses]);

  useEffect(() => {
    fetchHistory();
  }, [rpcUrl]);

  useEffect(() => {
    fetchLatest();
    if (!live) return;
    const id = setInterval(fetchLatest, 3000);
    return () => clearInterval(id);
  }, [rpcUrl, live, fetchLatest]);

  //  Merge txHistory (app) + chainTxs (chain) 
  const mergedTxs = useMemo(() => {
    const appHashes = new Set(txHistory.map(t => t.hash?.toLowerCase()));
    const chainOnly = chainTxs.filter(t => !appHashes.has(t.hash?.toLowerCase()));
    return {
      appTxs: txHistory,
      chainTxs: chainOnly,
      total: txHistory.length + chainOnly.length,
    };
  }, [txHistory, chainTxs]);

  //  Derived stats 
  const stats = useMemo(() => {
    const all = txHistory;
    const success = all.filter(t => t.status === 'success');
    const failed = all.filter(t => t.status === 'failed');
    const withGas = all.filter(t => t.gasUsed);
    const avgGas = withGas.length ? withGas.reduce((a, t) => a + parseInt(t.gasUsed!), 0) / withGas.length : 0;
    const maxGas = withGas.length ? Math.max(...withGas.map(t => parseInt(t.gasUsed!))) : 0;
    const minGas = withGas.length ? Math.min(...withGas.map(t => parseInt(t.gasUsed!))) : 0;
    const totalGas = withGas.reduce((a, t) => a + parseInt(t.gasUsed!), 0);

    const fnCounts: Record<string, number> = {};
    all.forEach(t => {
      const key = `${t.contractName}.${t.functionName}`;
      fnCounts[key] = (fnCounts[key] || 0) + 1;
    });
    const topFns = Object.entries(fnCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

    const contractCounts: Record<string, { success: number; failed: number; gas: number }> = {};
    all.forEach(t => {
      if (!contractCounts[t.contractName]) contractCounts[t.contractName] = { success: 0, failed: 0, gas: 0 };
      if (t.status === 'success') contractCounts[t.contractName].success++;
      else contractCounts[t.contractName].failed++;
      if (t.gasUsed) contractCounts[t.contractName].gas += parseInt(t.gasUsed);
    });

    const gasTimeline = all.slice(-30).filter(t => t.gasUsed).map((t, i) => ({
      i,
      gas: parseInt(t.gasUsed!),
      name: `${t.contractName}.${t.functionName}`,
      status: t.status,
      time: new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    }));

    const heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    all.forEach(t => {
      const d = new Date(t.timestamp);
      heatmap[d.getDay()][d.getHours()]++;
    });

    const pieData = Object.entries(contractCounts)
      .map(([name, v]) => ({ name, value: v.success + v.failed, success: v.success, failed: v.failed }))
      .slice(0, 6);

    return { success, failed, avgGas, maxGas, minGas, totalGas, topFns, contractCounts, gasTimeline, heatmap, pieData };
  }, [txHistory]);

  const successRate = txHistory.length ? Math.round((stats.success.length / txHistory.length) * 100) : 0;
  const gasSparkData = blockHistory.map(b => b.gasUsed);
  const txSparkData = blockHistory.map(b => b.txCount);
  const baseFeeData = blockHistory.map(b => b.baseFee);

  // All transactions to show in recent feed (app + chain)
  const recentFeed = useMemo(() => {
    const appItems = txHistory.slice(0, 30).map(t => ({
      hash: t.hash || '',
      label: `${t.contractName}.${t.functionName}()`,
      gas: t.gasUsed ? parseInt(t.gasUsed).toLocaleString() : null,
      status: t.status as 'success' | 'failed' | 'pending',
      time: new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      source: 'app' as const,
      from: t.from || '',
    }));
    const chainItems = mergedTxs.chainTxs.slice(0, 20).map(t => ({
      hash: t.hash,
      label: t.contractName
        ? `${t.contractName}${t.functionSig ? ` [${t.functionSig}]` : ''}`
        : t.to ? `→ ${t.to.slice(0, 10)}…` : 'Contract Deploy',
      gas: t.gas ? parseInt(t.gas, 16).toLocaleString() : null,
      status: t.status || 'success' as 'success' | 'failed' | 'pending',
      time: '',
      source: 'chain' as const,
      from: t.from,
    }));
    return [...appItems, ...chainItems].slice(0, 30);
  }, [txHistory, mergedTxs]);

  // 
  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">

      {/*  Header  */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card/80 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <Activity className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-semibold tracking-tight">Analytics</span>
          {blockInfo && (
            <span className={cn(
              'text-[10px] font-mono px-1.5 py-0.5 rounded transition-all',
              pulse ? 'bg-emerald-500/25 text-emerald-300' : 'bg-sky-500/10 text-sky-400'
            )}>
              #{blockInfo.number.toLocaleString()}
            </span>
          )}
          <button
            onClick={() => setLive(p => !p)}
            className={cn(
              'flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full transition-all border',
              live
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                : 'bg-muted text-muted-foreground border-border'
            )}>
            <Radio className={cn('w-2.5 h-2.5', live && 'animate-pulse')} />
            {live ? 'Live' : 'Paused'}
          </button>
          {mergedTxs.total > 0 && (
            <span className="text-[9px] text-muted-foreground/40 font-mono">
              {mergedTxs.total} tx{mergedTxs.total !== 1 ? 's' : ''} tracked
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <div className="flex overflow-hidden border rounded-lg bg-muted/50 border-border/60">
            {([
              { v: 'overview', label: 'Overview', icon: BarChart3 },
              { v: 'gas',      label: 'Gas',      icon: Flame },
              { v: 'functions',label: 'Functions', icon: Cpu },
              { v: 'blocks',   label: 'Blocks',   icon: Box },
            ] as const).map(({ v, label, icon: Icon }) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium transition-all',
                  view === v
                    ? 'bg-violet-600/90 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}>
                <Icon className="w-3 h-3" />
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => { fetchHistory(); fetchLatest(); }}
            className="flex items-center justify-center transition-colors rounded-md w-7 h-7 hover:bg-muted">
            <RefreshCw className="w-3 h-3 text-muted-foreground/60" />
          </button>
        </div>
      </div>

      <ScrollArea className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-5">

          {/* ════════════════════ OVERVIEW ════════════════════ */}
          {view === 'overview' && (
            <>
              {/* Live chain KPIs */}
              <section>
                <SectionLabel icon={Layers} label="Live Chain" />
                <div className="grid grid-cols-4 gap-2">
                  <KpiCard icon={Layers}      label="Latest Block"  accent="sky"    value={blockInfo ? `#${blockInfo.number.toLocaleString()}` : '…'}          sub={blockInfo ? new Date(blockInfo.timestamp * 1000).toLocaleTimeString() : undefined} spark={blockHistory.map(b => b.number)} />
                  <KpiCard icon={Hash}        label="Block Txs"     accent="orange" value={blockInfo ? blockInfo.txCount.toString() : '…'}                      sub={blockInfo ? `gas limit ${(blockInfo.gasLimit / 1e6).toFixed(0)}M` : undefined}   spark={txSparkData} />
                  <KpiCard icon={TrendingUp}  label="Gas Used"      accent="amber"  value={blockInfo ? `${(blockInfo.gasUsed / 1e6).toFixed(1)}M` : '…'}        sub={blockInfo ? `${Math.round(blockInfo.gasUsed / blockInfo.gasLimit * 100)}% full` : undefined} spark={gasSparkData} />
                  <KpiCard icon={Zap}         label="Base Fee"      accent="violet" value={blockInfo?.baseFeePerGas ? `${(blockInfo.baseFeePerGas / 1e9).toFixed(2)} gwei` : '0.00 gwei'} spark={baseFeeData} />
                </div>
              </section>

              {/* Session KPIs */}
              <section>
                <SectionLabel icon={Activity} label="Session Stats" />
                <div className="grid grid-cols-4 gap-2">
                  <KpiCard icon={CheckCircle2} label="Success"  accent="emerald" value={stats.success.length.toString()} trend={stats.success.length > 0 ? 'up' : 'flat'} />
                  <KpiCard icon={XCircle}      label="Failed"   accent="rose"    value={stats.failed.length.toString()}   trend={stats.failed.length > 0 ? 'down' : 'flat'} />
                  <KpiCard icon={Flame}        label="Avg Gas"  accent="amber"   value={stats.avgGas > 0 ? `${Math.round(stats.avgGas / 1000)}k` : '—'} sub={stats.maxGas > 0 ? `max ${Math.round(stats.maxGas / 1000)}k` : undefined} />
                  <KpiCard icon={Activity}     label="Success Rate" accent={successRate >= 80 ? 'emerald' : successRate >= 50 ? 'amber' : 'rose'} value={txHistory.length > 0 ? `${successRate}%` : '—'} />
                </div>
              </section>

              {/* Chain Stats summary */}
              {(blockHistory.length > 0 || mergedTxs.total > 0) && (
                <section>
                  <SectionLabel icon={Database} label="Chain Activity" />
                  <div className="grid grid-cols-3 gap-2">
                    <KpiCard icon={Box}        label="Blocks Seen"   accent="sky"    value={blockHistory.length.toString()}  sub={blockHistory.length > 0 ? `from #${blockHistory[0]?.number}` : undefined} />
                    <KpiCard icon={GitBranch}  label="Chain Txs"     accent="cyan"   value={chainTxs.length.toString()}       sub="pulled from RPC" />
                    <KpiCard icon={Database}   label="Contracts"     accent="violet" value={deployedContracts.length.toString()} sub={deployedContracts.length > 0 ? deployedContracts.map(d => d.name).slice(0,2).join(', ') : 'none deployed'} />
                  </div>
                </section>
              )}

              {/* Tx breakdown donut */}
              {(stats.pieData.length > 0 || mergedTxs.total > 0) && (
                <section>
                  <SectionLabel icon={BarChart3} label="Tx Breakdown by Contract" />
                  {stats.pieData.length > 0 ? (
                    <div className="p-4 border bg-card border-border/60 rounded-xl">
                      <div className="h-44">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={stats.pieData} cx="50%" cy="50%" innerRadius={44} outerRadius={72} dataKey="value" nameKey="name" paddingAngle={2}>
                              {stats.pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} opacity={0.88} />)}
                            </Pie>
                            <Tooltip content={<CT />} />
                            <Legend iconSize={7} iconType="circle" formatter={(v: any) => <span className="text-[10px] text-muted-foreground font-mono">{v}</span>} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ) : (
                    <EmptyState label="No named contract transactions yet" sub="Deploy & interact with contracts to see breakdown" />
                  )}
                </section>
              )}

              {/* Block activity sparkline */}
              {blockHistory.length > 2 && (
                <section>
                  <SectionLabel icon={TrendingUp} label="Block Activity (Txs/Block)" />
                  <div className="p-4 border bg-card border-border/60 rounded-xl">
                    <div className="h-28">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={blockHistory} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                          <defs>
                            <linearGradient id="txG" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor="#0ea5e9" stopOpacity={0.25} />
                              <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                          <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                          <YAxis tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }} tickLine={false} axisLine={false} width={24} allowDecimals={false} />
                          <Tooltip content={<CT unit=" txs" />} />
                          <Area type="monotone" dataKey="txCount" name="Txs" stroke="#0ea5e9" strokeWidth={1.5} fill="url(#txG)" dot={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </section>
              )}

              {/* Recent tx feed */}
              <section>
                <div className="flex items-center justify-between mb-2">
                  <SectionLabel icon={Clock} label="Recent Transactions" inline />
                  <span className="text-[9px] text-muted-foreground/35 font-mono">{recentFeed.length} entries</span>
                </div>
                {recentFeed.length > 0 ? (
                  <div className="overflow-hidden border border-border/60 bg-card rounded-xl">
                    {recentFeed.slice(0, 15).map((tx, i) => (
                      <div key={tx.hash || i} className={cn(
                        'flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-muted/20 transition-colors',
                        i !== 0 && 'border-t border-border/30'
                      )}>
                        <TxBadge status={tx.status} />
                        <div className="flex-1 min-w-0 flex items-center gap-1.5">
                          <span className="font-mono text-[10px] text-foreground/70 truncate">{tx.label}</span>
                          {tx.source === 'chain' && (
                            <span className="text-[8px] px-1 py-0.5 rounded bg-sky-500/10 text-sky-400/70 border border-sky-500/20 flex-shrink-0">chain</span>
                          )}
                        </div>
                        {tx.gas && (
                          <span className="font-mono text-[9px] text-amber-400/50 flex-shrink-0">{tx.gas} gas</span>
                        )}
                        {tx.hash && (
                          <span className="font-mono text-[9px] text-muted-foreground/25 flex-shrink-0 hidden sm:block">{tx.hash.slice(0, 8)}…</span>
                        )}
                        {tx.time && (
                          <span className="text-[9px] text-muted-foreground/30 font-mono flex-shrink-0">{tx.time}</span>
                        )}
                      </div>
                    ))}
                    {recentFeed.length > 15 && (
                      <div className="px-3 py-1.5 border-t border-border/30 text-[9px] text-muted-foreground/30 font-mono text-center">
                        + {recentFeed.length - 15} more
                      </div>
                    )}
                  </div>
                ) : (
                  <EmptyState label="No transactions yet" sub="Interact with deployed contracts or run a simulation" />
                )}
              </section>
            </>
          )}

          {/* ════════════════════ GAS ════════════════════ */}
          {view === 'gas' && (
            <>
              {/* Gas KPIs */}
              <section>
                <SectionLabel icon={Flame} label="Gas Overview" />
                <div className="grid grid-cols-3 gap-2">
                  <KpiCard icon={TrendingUp} label="Avg Gas / Tx"  accent="amber"  value={stats.avgGas > 0 ? `${(stats.avgGas / 1000).toFixed(1)}k` : '—'} />
                  <KpiCard icon={Flame}      label="Max Gas"        accent="orange" value={stats.maxGas > 0 ? `${(stats.maxGas / 1000).toFixed(1)}k` : '—'} />
                  <KpiCard icon={Activity}   label="Total Gas"      accent="violet" value={stats.totalGas > 0 ? `${(stats.totalGas / 1e6).toFixed(2)}M` : '—'} />
                </div>
              </section>

              <section>
                <SectionLabel icon={TrendingUp} label="Gas Per Transaction" />
                <div className="p-4 border bg-card border-border/60 rounded-xl">
                  {stats.gasTimeline.length > 1 ? (
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={stats.gasTimeline} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                          <defs>
                            <linearGradient id="gasGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor="#f97316" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                          <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                          <YAxis tickFormatter={(v: any) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }} tickLine={false} axisLine={false} width={36} />
                          <Tooltip content={<CT />} />
                          <Area type="monotone" dataKey="gas" name="Gas Used" stroke="#f97316" strokeWidth={1.5} fill="url(#gasGrad)" dot={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <EmptyState label="Send transactions to see gas chart" />}
                </div>
              </section>

              <section>
                <SectionLabel icon={Box} label="Block Gas Utilisation %" />
                <div className="p-4 border bg-card border-border/60 rounded-xl">
                  {blockHistory.length > 1 ? (
                    <div className="h-40">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={blockHistory.slice(-25)} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barSize={6}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                          <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }} tickLine={false} axisLine={false} interval={4} />
                          <YAxis tickFormatter={(v: any) => `${v}%`} tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }} tickLine={false} axisLine={false} width={30} domain={[0, 100]} />
                          <Tooltip content={<CT unit="%" />} />
                          <Bar dataKey={(d: BlockHistory) => Math.round(d.gasUsed / d.gasLimit * 100)} name="Utilisation" radius={[2, 2, 0, 0]}>
                            {blockHistory.slice(-25).map((b, i) => {
                              const pct = b.gasUsed / b.gasLimit;
                              return <Cell key={i} fill={pct > 0.9 ? '#f43f5e' : pct > 0.7 ? '#f97316' : '#22c55e'} opacity={0.8} />;
                            })}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <EmptyState label="Waiting for block history…" />}
                </div>
              </section>

              {baseFeeData.some(v => v > 0) && (
                <section>
                  <SectionLabel icon={Zap} label="Base Fee (gwei)" />
                  <div className="p-4 border bg-card border-border/60 rounded-xl">
                    <div className="h-36">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={blockHistory.slice(-25)} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                          <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }} tickLine={false} axisLine={false} interval={4} />
                          <YAxis tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }} tickLine={false} axisLine={false} width={36} tickFormatter={v => v.toFixed(1)} />
                          <Tooltip content={<CT unit=" gwei" />} />
                          <Line type="monotone" dataKey="baseFee" name="Base Fee" stroke="#a78bfa" strokeWidth={1.5} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </section>
              )}

              {Object.keys(stats.contractCounts).length > 0 && (
                <section>
                  <SectionLabel icon={Database} label="Total Gas by Contract" />
                  <div className="p-4 border bg-card border-border/60 rounded-xl">
                    <div className="h-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={Object.entries(stats.contractCounts).map(([name, v]) => ({ name, gas: v.gas }))}
                          layout="vertical" margin={{ top: 4, right: 8, bottom: 0, left: 4 }} barSize={10}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                          <XAxis type="number" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }} tickLine={false} axisLine={false} />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8', fontFamily: 'monospace' }} tickLine={false} axisLine={false} width={80} />
                          <Tooltip content={<CT />} />
                          <Bar dataKey="gas" name="Total Gas" fill="#f59e0b" radius={[0, 3, 3, 0]} opacity={0.8} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </section>
              )}
            </>
          )}

          {/* ════════════════════ FUNCTIONS ════════════════════ */}
          {view === 'functions' && (
            <>
              <section>
                <SectionLabel icon={Cpu} label="Function Call Frequency" />
                <div className="p-4 border bg-card border-border/60 rounded-xl">
                  {stats.topFns.length > 0 ? (
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={stats.topFns.map(([fn, count]) => ({ fn: fn.split('.')[1] || fn, full: fn, count }))}
                          layout="vertical" margin={{ top: 4, right: 8, bottom: 0, left: 4 }} barSize={12}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }} tickLine={false} axisLine={false} allowDecimals={false} />
                          <YAxis type="category" dataKey="fn" tick={{ fontSize: 10, fill: '#7dd3fc', fontFamily: 'monospace' }} tickLine={false} axisLine={false} width={90} />
                          <Tooltip content={<CT />} />
                          <Bar dataKey="count" name="Calls" radius={[0, 4, 4, 0]}>
                            {stats.topFns.map((_, i) => <Cell key={i} fill={`hsl(${200 + i * 20}, 80%, 60%)`} opacity={0.88} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <EmptyState label="No transactions yet" sub="Interact with contracts to see function stats" />}
                </div>
              </section>

              <section>
                <SectionLabel icon={Clock} label="Activity Heatmap — Hour × Day" />
                <div className="p-4 overflow-x-auto border bg-card border-border/60 rounded-xl">
                  <div className="min-w-max">
                    <div className="flex gap-px mb-1 ml-7">
                      {Array.from({ length: 24 }, (_, h) => (
                        <div key={h} style={{ width: 18 }} className="text-center text-[8px] text-muted-foreground/30 font-mono">
                          {h % 6 === 0 ? h : ''}
                        </div>
                      ))}
                    </div>
                    {DAYS.map((day, d) => {
                      const maxInRow = Math.max(...stats.heatmap[d], 1);
                      return (
                        <div key={day} className="flex items-center gap-px mb-px">
                          <div className="w-6 text-[9px] text-muted-foreground/40 font-mono text-right mr-1">{day}</div>
                          {stats.heatmap[d].map((count, h) => (
                            <div key={h} title={`${day} ${h}:00 — ${count} txs`}
                              style={{ width: 18, height: 14, borderRadius: 2, background: heatColor(count / maxInRow), transition: 'background 0.2s' }}
                              className="cursor-default hover:ring-1 hover:ring-orange-400/50" />
                          ))}
                        </div>
                      );
                    })}
                    <div className="flex items-center gap-2 mt-3 ml-7">
                      <span className="text-[9px] text-muted-foreground/30">Less</span>
                      {[0, 0.2, 0.4, 0.6, 0.8, 1].map(r => (
                        <div key={r} style={{ width: 12, height: 12, borderRadius: 2, background: heatColor(r) }} />
                      ))}
                      <span className="text-[9px] text-muted-foreground/30">More</span>
                    </div>
                  </div>
                </div>
              </section>

              {stats.topFns.length > 0 && (
                <section>
                  <SectionLabel icon={CheckCircle2} label="Success Rate by Function" />
                  <div className="space-y-1.5">
                    {stats.topFns.map(([fn, total]) => {
                      const ok = txHistory.filter(t => `${t.contractName}.${t.functionName}` === fn && t.status === 'success').length;
                      const pct = Math.round(ok / total * 100);
                      return (
                        <div key={fn} className="bg-card border border-border/60 rounded-lg px-3 py-2.5">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-mono text-foreground/75 truncate max-w-[60%]">{fn}</span>
                            <div className="flex items-center gap-2 text-[10px] font-mono flex-shrink-0">
                              <span className="text-emerald-400">{ok}✓</span>
                              <span className="text-rose-400">{total - ok}✗</span>
                              <span className={cn('font-bold', pct >= 80 ? 'text-emerald-400' : pct >= 50 ? 'text-amber-400' : 'text-rose-400')}>{pct}%</span>
                            </div>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden bg-border/30">
                            <div className="h-full transition-all rounded-full" style={{ width: `${pct}%`, background: pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#f43f5e' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </>
          )}

          {/* ════════════════════ BLOCKS ════════════════════ */}
          {view === 'blocks' && (
            <>
              <section>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <KpiCard icon={Box}       label="Blocks Tracked"  accent="sky"   value={blockHistory.length.toString()} />
                  <KpiCard icon={Hash}      label="Chain Txs Seen"  accent="cyan"  value={chainTxs.length.toString()} sub="from recent blocks" />
                  <KpiCard icon={TrendingUp}label="Avg Txs/Block"   accent="amber" value={blockHistory.length > 0 ? (blockHistory.reduce((a, b) => a + b.txCount, 0) / blockHistory.length).toFixed(1) : '—'} />
                </div>
              </section>

              <section>
                <SectionLabel icon={TrendingUp} label="Tx Count per Block" />
                <div className="p-4 border bg-card border-border/60 rounded-xl">
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={blockHistory} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                        <defs>
                          <linearGradient id="txGrad2" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#0ea5e9" stopOpacity={0.28} />
                            <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }} tickLine={false} axisLine={false} width={24} allowDecimals={false} />
                        <Tooltip content={<CT unit=" txs" />} />
                        <Area type="monotone" dataKey="txCount" name="Transactions" stroke="#0ea5e9" strokeWidth={1.5} fill="url(#txGrad2)" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </section>

              <section>
                <SectionLabel icon={Box} label="Block History" />
                <div className="overflow-hidden border border-border/60 bg-card rounded-xl">
                  <div className="grid grid-cols-5 gap-2 px-3 py-2 border-b border-border/50 bg-muted/20">
                    {['Block', 'Txs', 'Gas Used', 'Fill %', 'Time'].map(h => (
                      <span key={h} className="text-[9px] font-semibold text-muted-foreground/50 uppercase tracking-wider font-mono">{h}</span>
                    ))}
                  </div>
                  {blockHistory.length === 0 ? (
                    <div className="flex items-center justify-center h-24 text-xs text-muted-foreground/30">Waiting for blocks…</div>
                  ) : (
                    [...blockHistory].reverse().map((b, i) => {
                      const fillPct = Math.round(b.gasUsed / b.gasLimit * 100);
                      return (
                        <div key={b.number} className={cn(
                          'grid grid-cols-5 gap-2 px-3 py-2 hover:bg-muted/15 transition-colors',
                          i !== 0 && 'border-t border-border/20',
                          i === 0 && 'bg-sky-500/5'
                        )}>
                          <span className="text-[11px] font-mono text-sky-400">#{b.number.toLocaleString()}</span>
                          <span className="text-[11px] font-mono text-foreground/70">{b.txCount}</span>
                          <span className="text-[11px] font-mono text-amber-400/80">{(b.gasUsed / 1e6).toFixed(2)}M</span>
                          <div className="flex items-center gap-1.5">
                            <div className="flex-1 h-1 overflow-hidden rounded-full bg-border/30">
                              <div className="h-full rounded-full" style={{ width: `${fillPct}%`, background: fillPct > 90 ? '#f43f5e' : fillPct > 70 ? '#f97316' : '#22c55e' }} />
                            </div>
                            <span className={cn('text-[9px] font-mono w-7', fillPct > 90 ? 'text-rose-400' : fillPct > 70 ? 'text-orange-400' : 'text-emerald-400')}>{fillPct}%</span>
                          </div>
                          <span className="text-[10px] font-mono text-muted-foreground/40">{b.time}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>

              {/* Live chain tx feed */}
              {chainTxs.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-2">
                    <SectionLabel icon={ArrowRight} label="Chain Transaction Feed" inline />
                    <span className="text-[9px] text-muted-foreground/35 font-mono">{chainTxs.length} txs</span>
                  </div>
                  <div className="overflow-hidden border border-border/60 bg-card rounded-xl">
                    {chainTxs.slice(0, 20).map((tx, i) => (
                      <div key={tx.hash} className={cn(
                        'flex items-center gap-2.5 px-3 py-2 hover:bg-muted/15 transition-colors',
                        i !== 0 && 'border-t border-border/20'
                      )}>
                        <TxBadge status={tx.status || 'success'} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono text-muted-foreground/50">{tx.from.slice(0, 8)}…</span>
                            <ArrowRight className="w-2.5 h-2.5 text-muted-foreground/25 flex-shrink-0" />
                            {tx.contractName
                              ? <span className="text-[10px] font-mono text-violet-400">{tx.contractName}</span>
                              : tx.to
                              ? <span className="text-[10px] font-mono text-muted-foreground/40">{tx.to.slice(0, 8)}…</span>
                              : <span className="text-[10px] font-mono text-emerald-400">Deploy</span>}
                          </div>
                          {tx.functionSig && (
                            <span className="text-[8px] font-mono text-sky-400/60">{tx.functionSig}</span>
                          )}
                        </div>
                        <span className="text-[9px] font-mono text-muted-foreground/25 flex-shrink-0">#{tx.blockNumber}</span>
                        <span className="text-[9px] font-mono text-muted-foreground/20 flex-shrink-0">{tx.hash.slice(0, 8)}…</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {blockInfo?.miner && (
                <section>
                  <SectionLabel icon={Wallet} label="Last Block Miner" />
                  <div className="flex items-center gap-3 px-4 py-3 border border-border/60 bg-card rounded-xl">
                    <Wallet className="flex-shrink-0 w-4 h-4 text-muted-foreground/30" />
                    <span className="text-[11px] font-mono text-foreground/50 break-all">{blockInfo.miner}</span>
                  </div>
                </section>
              )}
            </>
          )}

        </div>
      </ScrollArea>
    </div>
  );
}

//  Helper components 
function SectionLabel({ icon: Icon, label, inline }: { icon: any; label: string; inline?: boolean }) {
  if (inline) return (
    <div className="flex items-center gap-1.5">
      <Icon className="w-3 h-3 text-muted-foreground/40" />
      <span className="text-[10px] text-muted-foreground/50 uppercase tracking-widest font-mono font-medium">{label}</span>
    </div>
  );
  return (
    <div className="flex items-center gap-1.5 mb-2">
      <Icon className="w-3 h-3 text-muted-foreground/40" />
      <span className="text-[10px] text-muted-foreground/50 uppercase tracking-widest font-mono font-medium">{label}</span>
    </div>
  );
}

function EmptyState({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-1.5">
      <div className="flex items-center justify-center w-8 h-8 mb-1 rounded-lg bg-muted/30">
        <BarChart3 className="w-4 h-4 text-muted-foreground/20" />
      </div>
      <p className="text-[11px] text-muted-foreground/30 text-center">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground/20 text-center">{sub}</p>}
    </div>
  );
}