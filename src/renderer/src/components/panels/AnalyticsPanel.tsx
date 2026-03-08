import { useState, useEffect, useMemo } from 'react';
import { TxRecord, DeployedContract } from '../../types';
import { ScrollArea } from '../ui/primitives';
import {
  Activity,
  TrendingUp,
  Clock,
  Hash,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  CheckCircle2,
  XCircle,
  Zap,
  BarChart2,
  Flame,
  Radio,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  Minus,
  AlertTriangle,
  Wallet,
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
}

interface BlockHistory {
  number: number;
  gasUsed: number;
  gasLimit: number;
  txCount: number;
  baseFee: number;
  time: string;
}

// ─── Mini sparkline component ──────────────────────────────────────────────
function Sparkline({
  data,
  color = '#f97316',
  height = 32,
}: {
  data: number[];
  color?: string;
  height?: number;
}) {
  if (!data.length)
    return (
      <div
        style={{ height }}
        className="opacity-20 flex items-center justify-center text-[9px] text-muted-foreground">
        no data
      </div>
    );
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg width="100%" height={height} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points={`0,${height} ${pts} 100,${height}`}
        fill={`url(#spark-${color.replace('#', '')})`}
        stroke="none"
      />
      <defs>
        <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ─── Stat card ─────────────────────────────────────────────────────────────
function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  trend,
  sparkData,
}: {
  icon: any;
  label: string;
  value: string;
  sub?: string;
  color: string;
  trend?: 'up' | 'down' | 'flat';
  sparkData?: number[];
}) {
  return (
    <div className="relative flex flex-col gap-1 p-3 overflow-hidden transition-colors border bg-card border-border rounded-xl group hover:border-border/80">
      <div className="flex items-start justify-between">
        <div
          className={cn(
            'w-7 h-7 rounded-lg flex items-center justify-center',
            `bg-${color}-500/10`,
          )}>
          <Icon className={cn('w-3.5 h-3.5', `text-${color}-400`)} />
        </div>
        {trend && (
          <span
            className={cn(
              'text-[9px] flex items-center gap-0.5 font-mono',
              trend === 'up'
                ? 'text-emerald-400'
                : trend === 'down'
                  ? 'text-rose-400'
                  : 'text-muted-foreground/40',
            )}>
            {trend === 'up' ? (
              <ChevronUp className="w-2.5 h-2.5" />
            ) : trend === 'down' ? (
              <ChevronDown className="w-2.5 h-2.5" />
            ) : (
              <Minus className="w-2.5 h-2.5" />
            )}
          </span>
        )}
      </div>
      <div className={cn('text-xl font-mono font-bold leading-none mt-1', `text-${color}-400`)}>
        {value}
      </div>
      <div className="text-[10px] text-muted-foreground/60">{label}</div>
      {sub && <div className="text-[9px] text-muted-foreground/35 font-mono">{sub}</div>}
      {sparkData && sparkData.length > 1 && (
        <div className="mt-1 transition-opacity opacity-50 group-hover:opacity-80">
          <Sparkline
            data={sparkData}
            color={
              color === 'emerald'
                ? '#10b981'
                : color === 'amber'
                  ? '#f59e0b'
                  : color === 'sky'
                    ? '#0ea5e9'
                    : color === 'rose'
                      ? '#f43f5e'
                      : '#f97316'
            }
            height={28}
          />
        </div>
      )}
    </div>
  );
}

// ─── Custom tooltip ────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, unit = '' }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-xl text-[11px]">
      <p className="mb-1 font-mono text-muted-foreground">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-mono font-semibold">
          {p.name}: {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
          {unit}
        </p>
      ))}
    </div>
  );
}

// ─── Heatmap cell colors ───────────────────────────────────────────────────
function heatColor(ratio: number) {
  if (ratio === 0) return 'rgba(255,255,255,0.03)';
  if (ratio < 0.2) return 'rgba(251,146,60,0.15)';
  if (ratio < 0.4) return 'rgba(251,146,60,0.30)';
  if (ratio < 0.6) return 'rgba(251,146,60,0.50)';
  if (ratio < 0.8) return 'rgba(249,115,22,0.70)';
  return 'rgba(234,88,12,0.90)';
}

async function rpc(url: string, method: string, params: any[] = []) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return d.result;
}

// ══════════════════════════════════════════════════════════════════════════
export default function AnalyticsPanel({ txHistory, deployedContracts, rpcUrl }: Props) {
  const [view, setView] = useState<ViewMode>('overview');
  const [blockInfo, setBlockInfo] = useState<BlockInfo | null>(null);
  const [blockHistory, setBlockHistory] = useState<BlockHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [live, setLive] = useState(true);

  // ── Fetch block data ───────────────────────────────────────────────────
  const fetchLatest = async () => {
    if (!rpcUrl) return;
    try {
      const b = await rpc(rpcUrl, 'eth_getBlockByNumber', ['latest', false]);
      if (!b) return;
      const info: BlockInfo = {
        number: parseInt(b.number, 16),
        timestamp: parseInt(b.timestamp, 16),
        txCount: (b.transactions || []).length,
        gasUsed: parseInt(b.gasUsed, 16),
        gasLimit: parseInt(b.gasLimit, 16),
        baseFeePerGas: b.baseFeePerGas ? parseInt(b.baseFeePerGas, 16) : undefined,
        miner: b.miner || '',
      };
      setBlockInfo(info);
      setBlockHistory((prev) => {
        const entry: BlockHistory = {
          number: info.number,
          gasUsed: info.gasUsed,
          gasLimit: info.gasLimit,
          txCount: info.txCount,
          baseFee: info.baseFeePerGas ? info.baseFeePerGas / 1e9 : 0,
          time: new Date(info.timestamp * 1000).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
        };
        if (prev.find((p) => p.number === info.number)) return prev;
        return [...prev.slice(-29), entry];
      });
    } catch {}
  };

  useEffect(() => {
    fetchLatest();
    if (!live) return;
    const id = setInterval(fetchLatest, 4000);
    return () => clearInterval(id);
  }, [rpcUrl, live]);

  // ── Derived stats ──────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const success = txHistory.filter((t) => t.status === 'success');
    const failed = txHistory.filter((t) => t.status === 'failed');
    const withGas = txHistory.filter((t) => t.gasUsed);
    const avgGas = withGas.length
      ? withGas.reduce((a, t) => a + parseInt(t.gasUsed!), 0) / withGas.length
      : 0;
    const maxGas = withGas.length ? Math.max(...withGas.map((t) => parseInt(t.gasUsed!))) : 0;

    // fn counts
    const fnCounts: Record<string, number> = {};
    txHistory.forEach((t) => {
      const key = `${t.contractName}.${t.functionName}`;
      fnCounts[key] = (fnCounts[key] || 0) + 1;
    });
    const topFns = Object.entries(fnCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    // contract breakdown
    const contractCounts: Record<string, { success: number; failed: number; gas: number }> = {};
    txHistory.forEach((t) => {
      if (!contractCounts[t.contractName])
        contractCounts[t.contractName] = { success: 0, failed: 0, gas: 0 };
      if (t.status === 'success') contractCounts[t.contractName].success++;
      else contractCounts[t.contractName].failed++;
      if (t.gasUsed) contractCounts[t.contractName].gas += parseInt(t.gasUsed);
    });

    // gas over time (last 20 tx)
    const gasTimeline = txHistory
      .slice(-20)
      .filter((t) => t.gasUsed)
      .map((t, i) => ({
        i,
        gas: parseInt(t.gasUsed!),
        name: `${t.contractName}.${t.functionName}`,
        status: t.status,
        time: new Date(t.timestamp).toLocaleTimeString(),
      }));

    // hourly heatmap (24h × 7 buckets)
    const heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    txHistory.forEach((t) => {
      const d = new Date(t.timestamp);
      heatmap[d.getDay()][d.getHours()]++;
    });

    // success rate per contract for pie
    const pieData = Object.entries(contractCounts)
      .map(([name, v]) => ({
        name,
        value: v.success + v.failed,
        success: v.success,
        failed: v.failed,
      }))
      .slice(0, 6);

    return {
      success,
      failed,
      avgGas,
      maxGas,
      topFns,
      contractCounts,
      gasTimeline,
      heatmap,
      pieData,
    };
  }, [txHistory]);

  const successRate = txHistory.length
    ? Math.round((stats.success.length / txHistory.length) * 100)
    : 0;
  const gasSparkData = blockHistory.map((b) => b.gasUsed);
  const txSparkData = blockHistory.map((b) => b.txCount);
  const baseFeeData = blockHistory.map((b) => b.baseFee);

  const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#f43f5e', '#06b6d4'];
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // ══════════════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card flex-shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-semibold">Analytics</span>
          {blockInfo && (
            <span className="text-[10px] font-mono text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded">
              #{blockInfo.number.toLocaleString()}
            </span>
          )}
          <button
            onClick={() => setLive((p) => !p)}
            className={cn(
              'flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition-colors',
              live ? 'bg-emerald-500/15 text-emerald-400' : 'bg-muted text-muted-foreground',
            )}>
            <Radio className="w-2.5 h-2.5" />
            {live ? 'Live' : 'Paused'}
          </button>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex overflow-hidden border rounded-lg bg-muted border-border">
            {(
              [
                { v: 'overview', label: '⬡ Overview' },
                { v: 'gas', label: '⛽ Gas' },
                { v: 'functions', label: '⚙ Functions' },
                { v: 'blocks', label: '🧱 Blocks' },
              ] as const
            ).map(({ v, label }) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  'px-2.5 py-1 text-[10px] font-medium transition-colors',
                  view === v
                    ? 'bg-blue-600 text-white'
                    : 'text-muted-foreground hover:text-foreground',
                )}>
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={fetchLatest}
            className="flex items-center justify-center transition-colors rounded-md w-7 h-7 hover:bg-muted">
            <RefreshCw className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>
      </div>

      <ScrollArea className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-5">
          {/* ════════ OVERVIEW VIEW ════════ */}
          {view === 'overview' && (
            <>
              {/* Live block grid */}
              <section>
                <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest mb-2 font-mono">
                  Live Chain
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <StatCard
                    icon={Layers}
                    label="Latest Block"
                    color="sky"
                    value={blockInfo ? `#${blockInfo.number.toLocaleString()}` : '…'}
                    sub={
                      blockInfo
                        ? new Date(blockInfo.timestamp * 1000).toLocaleTimeString()
                        : undefined
                    }
                    sparkData={blockHistory.map((b) => b.number)}
                  />
                  <StatCard
                    icon={Hash}
                    label="Block Txs"
                    color="orange"
                    value={blockInfo ? blockInfo.txCount.toString() : '…'}
                    sparkData={txSparkData}
                  />
                  <StatCard
                    icon={TrendingUp}
                    label="Gas Used"
                    color="amber"
                    value={blockInfo ? `${Math.round(blockInfo.gasUsed / 1e6)}M` : '…'}
                    sub={
                      blockInfo
                        ? `${Math.round((blockInfo.gasUsed / blockInfo.gasLimit) * 100)}% full`
                        : undefined
                    }
                    sparkData={gasSparkData}
                  />
                  <StatCard
                    icon={Zap}
                    label="Base Fee"
                    color="purple"
                    value={
                      blockInfo?.baseFeePerGas
                        ? `${(blockInfo.baseFeePerGas / 1e9).toFixed(2)} gwei`
                        : 'N/A'
                    }
                    sparkData={baseFeeData}
                  />
                </div>
              </section>

              {/* Session KPI */}
              <section>
                <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest mb-2 font-mono">
                  Session
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    {
                      icon: CheckCircle2,
                      label: 'Success',
                      value: stats.success.length.toString(),
                      color: 'emerald',
                      trend: 'up' as const,
                    },
                    {
                      icon: XCircle,
                      label: 'Failed',
                      value: stats.failed.length.toString(),
                      color: 'rose',
                      trend: stats.failed.length > 0 ? ('down' as const) : ('flat' as const),
                    },
                    {
                      icon: TrendingUp,
                      label: 'Avg Gas',
                      value: stats.avgGas > 0 ? `${Math.round(stats.avgGas / 1000)}k` : '—',
                      color: 'amber',
                      trend: 'flat' as const,
                    },
                    {
                      icon: Activity,
                      label: 'Rate',
                      value: `${successRate}%`,
                      color: successRate >= 80 ? 'emerald' : successRate >= 50 ? 'amber' : 'rose',
                      trend: 'flat' as const,
                    },
                  ].map((s) => (
                    <StatCard key={s.label} {...s} />
                  ))}
                </div>
              </section>

              {/* Success rate donut */}
              {txHistory.length > 0 && (
                <section>
                  <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest mb-2 font-mono">
                    Tx Breakdown by Contract
                  </p>
                  <div className="p-4 border bg-card border-border rounded-xl">
                    <div className="h-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={stats.pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={70}
                            dataKey="value"
                            nameKey="name"
                            paddingAngle={2}>
                            {stats.pieData.map((_, i) => (
                              <Cell
                                key={i}
                                fill={PIE_COLORS[i % PIE_COLORS.length]}
                                opacity={0.85}
                              />
                            ))}
                          </Pie>
                          <Tooltip content={<ChartTooltip />} />
                          <Legend
                            iconSize={8}
                            iconType="circle"
                            formatter={(v: any) => (
                              <span className="text-[10px] text-muted-foreground font-mono">
                                {v}
                              </span>
                            )}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </section>
              )}

              {/* Recent tx timeline */}
              {txHistory.length > 0 && (
                <section>
                  <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest mb-2 font-mono">
                    Recent Transactions
                  </p>
                  <div className="overflow-hidden border bg-card border-border rounded-xl">
                    {txHistory.slice(0, 12).map((tx, i) => (
                      <div
                        key={tx.id}
                        className={cn(
                          'flex items-center gap-2.5 px-3 py-2 text-xs group transition-colors hover:bg-muted/30',
                          i !== 0 && 'border-t border-border/40',
                        )}>
                        {tx.status === 'success' ? (
                          <CheckCircle2 className="flex-shrink-0 w-3 h-3 text-emerald-500" />
                        ) : (
                          <XCircle className="flex-shrink-0 w-3 h-3 text-rose-500" />
                        )}
                        <div className="flex-1 min-w-0 flex items-center gap-1.5">
                          <span className="font-mono truncate text-foreground/70">
                            {tx.contractName}
                          </span>
                          <span className="text-muted-foreground/30">·</span>
                          <span className="font-mono text-sky-400">{tx.functionName}()</span>
                        </div>
                        {tx.gasUsed && (
                          <span className="font-mono text-[10px] text-amber-400/60">
                            {parseInt(tx.gasUsed).toLocaleString()} gas
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground/30 font-mono">
                          {new Date(tx.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          {/* ════════ GAS VIEW ════════ */}
          {view === 'gas' && (
            <>
              {/* Gas usage over time line chart */}
              <section>
                <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest mb-2 font-mono">
                  Gas Per Transaction
                </p>
                <div className="p-4 border bg-card border-border rounded-xl">
                  {stats.gasTimeline.length > 1 ? (
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={stats.gasTimeline}
                          margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                          <defs>
                            <linearGradient id="gasGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                          <XAxis
                            dataKey="time"
                            tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }}
                            tickLine={false}
                            axisLine={false}
                            interval="preserveStartEnd"
                          />
                          <YAxis
                            tickFormatter={(v: any) => `${(v / 1000).toFixed(0)}k`}
                            tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }}
                            tickLine={false}
                            axisLine={false}
                            width={40}
                          />
                          <Tooltip content={<ChartTooltip />} />
                          <Area
                            type="monotone"
                            dataKey="gas"
                            name="Gas"
                            stroke="#f97316"
                            strokeWidth={1.5}
                            fill="url(#gasGrad)"
                            dot={false}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-48 text-xs text-muted-foreground/30">
                      Send transactions to see gas chart
                    </div>
                  )}
                </div>
              </section>

              {/* Block gas utilisation */}
              <section>
                <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest mb-2 font-mono">
                  Block Gas Utilisation %
                </p>
                <div className="p-4 border bg-card border-border rounded-xl">
                  {blockHistory.length > 1 ? (
                    <div className="h-40">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={blockHistory.slice(-20)}
                          margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
                          barSize={8}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                          <XAxis
                            dataKey="time"
                            tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }}
                            tickLine={false}
                            axisLine={false}
                            interval={3}
                          />
                          <YAxis
                            tickFormatter={(v: any) => `${v}%`}
                            tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }}
                            tickLine={false}
                            axisLine={false}
                            width={32}
                            domain={[0, 100]}
                          />
                          <Tooltip content={<ChartTooltip unit="%" />} />
                          <Bar
                            dataKey={(d: BlockHistory) =>
                              Math.round((d.gasUsed / d.gasLimit) * 100)
                            }
                            name="Utilisation"
                            radius={[2, 2, 0, 0]}>
                            {blockHistory.slice(-20).map((b, i) => {
                              const pct = b.gasUsed / b.gasLimit;
                              return (
                                <Cell
                                  key={i}
                                  fill={pct > 0.9 ? '#f43f5e' : pct > 0.7 ? '#f97316' : '#22c55e'}
                                  opacity={0.8}
                                />
                              );
                            })}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-40 text-xs text-muted-foreground/30">
                      Waiting for block history…
                    </div>
                  )}
                </div>
              </section>

              {/* Base fee trend */}
              {baseFeeData.some((v) => v > 0) && (
                <section>
                  <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest mb-2 font-mono">
                    Base Fee (gwei)
                  </p>
                  <div className="p-4 border bg-card border-border rounded-xl">
                    <div className="h-36">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={blockHistory.slice(-20)}
                          margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                          <XAxis
                            dataKey="time"
                            tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }}
                            tickLine={false}
                            axisLine={false}
                            interval={3}
                          />
                          <YAxis
                            tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }}
                            tickLine={false}
                            axisLine={false}
                            width={40}
                            tickFormatter={(v) => `${v.toFixed(1)}`}
                          />
                          <Tooltip content={<ChartTooltip unit=" gwei" />} />
                          <Line
                            type="monotone"
                            dataKey="baseFee"
                            name="Base Fee"
                            stroke="#a78bfa"
                            strokeWidth={1.5}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </section>
              )}

              {/* Gas by contract bar */}
              {Object.keys(stats.contractCounts).length > 0 && (
                <section>
                  <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest mb-2 font-mono">
                    Total Gas by Contract
                  </p>
                  <div className="p-4 border bg-card border-border rounded-xl">
                    <div className="h-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={Object.entries(stats.contractCounts).map(([name, v]) => ({
                            name,
                            gas: v.gas,
                          }))}
                          layout="vertical"
                          margin={{ top: 4, right: 8, bottom: 0, left: 4 }}
                          barSize={10}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="rgba(255,255,255,0.04)"
                            horizontal={false}
                          />
                          <XAxis
                            type="number"
                            tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                            tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            type="category"
                            dataKey="name"
                            tick={{ fontSize: 9, fill: '#94a3b8', fontFamily: 'monospace' }}
                            tickLine={false}
                            axisLine={false}
                            width={80}
                          />
                          <Tooltip content={<ChartTooltip />} />
                          <Bar
                            dataKey="gas"
                            name="Total Gas"
                            fill="#f59e0b"
                            radius={[0, 3, 3, 0]}
                            opacity={0.8}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </section>
              )}
            </>
          )}

          {/* ════════ FUNCTIONS VIEW ════════ */}
          {view === 'functions' && (
            <>
              {/* Function frequency bar chart */}
              <section>
                <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest mb-2 font-mono">
                  Function Call Frequency
                </p>
                <div className="p-4 border bg-card border-border rounded-xl">
                  {stats.topFns.length > 0 ? (
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={stats.topFns.map(([fn, count]) => ({
                            fn: fn.split('.')[1] || fn,
                            full: fn,
                            count,
                          }))}
                          layout="vertical"
                          margin={{ top: 4, right: 8, bottom: 0, left: 4 }}
                          barSize={12}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="rgba(255,255,255,0.04)"
                            horizontal={false}
                          />
                          <XAxis
                            type="number"
                            tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            type="category"
                            dataKey="fn"
                            tick={{ fontSize: 10, fill: '#7dd3fc', fontFamily: 'monospace' }}
                            tickLine={false}
                            axisLine={false}
                            width={90}
                          />
                          <Tooltip content={<ChartTooltip />} />
                          <Bar dataKey="count" name="Calls" radius={[0, 4, 4, 0]}>
                            {stats.topFns.map((_, i) => (
                              <Cell
                                key={i}
                                fill={`hsl(${210 + i * 18}, 80%, 60%)`}
                                opacity={0.85}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-56 text-xs text-muted-foreground/30">
                      No transactions yet
                    </div>
                  )}
                </div>
              </section>

              {/* Activity heatmap (hour × day) */}
              <section>
                <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest mb-2 font-mono">
                  Activity Heatmap — Hour × Day
                </p>
                <div className="p-4 overflow-x-auto border bg-card border-border rounded-xl">
                  <div className="min-w-max">
                    {/* Hour headers */}
                    <div className="flex gap-px mb-1 ml-7">
                      {Array.from({ length: 24 }, (_, h) => (
                        <div
                          key={h}
                          style={{ width: 18 }}
                          className="text-center text-[8px] text-muted-foreground/30 font-mono">
                          {h % 6 === 0 ? h : ''}
                        </div>
                      ))}
                    </div>
                    {DAYS.map((day, d) => {
                      const maxInRow = Math.max(...stats.heatmap[d], 1);
                      return (
                        <div key={day} className="flex items-center gap-px mb-px">
                          <div className="w-6 text-[9px] text-muted-foreground/40 font-mono text-right mr-1">
                            {day}
                          </div>
                          {stats.heatmap[d].map((count, h) => (
                            <div
                              key={h}
                              title={`${day} ${h}:00 — ${count} txs`}
                              style={{
                                width: 18,
                                height: 14,
                                borderRadius: 2,
                                background: heatColor(count / maxInRow),
                                transition: 'background 0.2s',
                              }}
                              className="cursor-default hover:ring-1 hover:ring-orange-400/50"
                            />
                          ))}
                        </div>
                      );
                    })}
                    <div className="flex items-center gap-2 mt-3 ml-7">
                      <span className="text-[9px] text-muted-foreground/30">Less</span>
                      {[0, 0.2, 0.4, 0.6, 0.8, 1].map((r) => (
                        <div
                          key={r}
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: 2,
                            background: heatColor(r),
                          }}
                        />
                      ))}
                      <span className="text-[9px] text-muted-foreground/30">More</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Success / fail per function */}
              {stats.topFns.length > 0 && (
                <section>
                  <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest mb-2 font-mono">
                    Success Rate by Function
                  </p>
                  <div className="space-y-2">
                    {stats.topFns.map(([fn, total]) => {
                      const ok = txHistory.filter(
                        (t) =>
                          `${t.contractName}.${t.functionName}` === fn && t.status === 'success',
                      ).length;
                      const pct = Math.round((ok / total) * 100);
                      return (
                        <div
                          key={fn}
                          className="bg-card border border-border rounded-lg px-3 py-2.5">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-mono text-foreground/75 truncate max-w-[65%]">
                              {fn}
                            </span>
                            <div className="flex items-center gap-2 text-[10px] font-mono">
                              <span className="text-emerald-400">{ok}✓</span>
                              <span className="text-rose-400">{total - ok}✗</span>
                              <span
                                className={cn(
                                  'font-bold',
                                  pct >= 80
                                    ? 'text-emerald-400'
                                    : pct >= 50
                                      ? 'text-amber-400'
                                      : 'text-rose-400',
                                )}>
                                {pct}%
                              </span>
                            </div>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden bg-border/40">
                            <div
                              className="h-full transition-all rounded-full"
                              style={{
                                width: `${pct}%`,
                                background:
                                  pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#f43f5e',
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </>
          )}

          {/* ════════ BLOCKS VIEW ════════ */}
          {view === 'blocks' && (
            <>
              {/* Block tx count sparkline */}
              <section>
                <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest mb-2 font-mono">
                  Tx Count per Block
                </p>
                <div className="p-4 border bg-card border-border rounded-xl">
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={blockHistory}
                        margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                        <defs>
                          <linearGradient id="txGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis
                          dataKey="time"
                          tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }}
                          tickLine={false}
                          axisLine={false}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }}
                          tickLine={false}
                          axisLine={false}
                          width={28}
                          allowDecimals={false}
                        />
                        <Tooltip content={<ChartTooltip unit=" txs" />} />
                        <Area
                          type="monotone"
                          dataKey="txCount"
                          name="Transactions"
                          stroke="#0ea5e9"
                          strokeWidth={1.5}
                          fill="url(#txGrad)"
                          dot={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </section>

              {/* Block list */}
              <section>
                <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest mb-2 font-mono">
                  Block History
                </p>
                <div className="overflow-hidden border bg-card border-border rounded-xl">
                  {/* Header */}
                  <div className="grid grid-cols-5 gap-2 px-3 py-1.5 border-b border-border bg-muted/30">
                    {['Block', 'Txs', 'Gas Used', 'Fill %', 'Time'].map((h) => (
                      <span
                        key={h}
                        className="text-[9px] font-semibold text-muted-foreground/50 uppercase tracking-wider font-mono">
                        {h}
                      </span>
                    ))}
                  </div>
                  {blockHistory.length === 0 ? (
                    <div className="flex items-center justify-center h-24 text-xs text-muted-foreground/30">
                      Waiting for blocks…
                    </div>
                  ) : (
                    [...blockHistory].reverse().map((b, i) => {
                      const fillPct = Math.round((b.gasUsed / b.gasLimit) * 100);
                      return (
                        <div
                          key={b.number}
                          className={cn(
                            'grid grid-cols-5 gap-2 px-3 py-2 hover:bg-muted/20 transition-colors',
                            i !== 0 && 'border-t border-border/30',
                            i === 0 && 'bg-sky-500/5',
                          )}>
                          <span className="text-[11px] font-mono text-sky-400">
                            #{b.number.toLocaleString()}
                          </span>
                          <span className="text-[11px] font-mono text-foreground/70">
                            {b.txCount}
                          </span>
                          <span className="text-[11px] font-mono text-amber-400/80">
                            {(b.gasUsed / 1e6).toFixed(1)}M
                          </span>
                          <div className="flex items-center gap-1.5">
                            <div className="flex-1 h-1 overflow-hidden rounded-full bg-border/40">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${fillPct}%`,
                                  background:
                                    fillPct > 90 ? '#f43f5e' : fillPct > 70 ? '#f97316' : '#22c55e',
                                }}
                              />
                            </div>
                            <span
                              className={cn(
                                'text-[9px] font-mono w-7',
                                fillPct > 90
                                  ? 'text-rose-400'
                                  : fillPct > 70
                                    ? 'text-orange-400'
                                    : 'text-emerald-400',
                              )}>
                              {fillPct}%
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-muted-foreground/40">
                            {b.time}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>

              {/* Miner info */}
              {blockInfo?.miner && (
                <section>
                  <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest mb-2 font-mono">
                    Last Block Miner
                  </p>
                  <div className="flex items-center gap-3 px-4 py-3 border bg-card border-border rounded-xl">
                    <Wallet className="flex-shrink-0 w-4 h-4 text-muted-foreground/40" />
                    <span className="text-[11px] font-mono text-foreground/60 break-all">
                      {blockInfo.miner}
                    </span>
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
