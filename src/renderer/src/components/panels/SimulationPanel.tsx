import { useState, useCallback, useRef, useEffect } from 'react';
import { ContractAbi, DeployedContract, HardhatAccount, TxRecord } from '../../types';
import { cn } from '../../lib/utils';
import {
  FlaskConical,
  Play,
  Square,
  Trash2,
  RefreshCw,
  Activity,
  Users,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  Zap,
  Wifi,
  WifiOff,
  BookOpen,
  Copy,
  ChevronDown,
  Search,
  Package,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input, Label, ScrollArea } from '../ui/primitives';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  SimUser,
  SimEvent,
  SimEventType,
  PoolState,
  SimContext,
  ContractSupport,
  makeUser,
  defaultPool,
  HH_ACCOUNTS,
  SimModule,
} from '../modules/Simulation/types';
import { ALL_MODULES, MODULE_CATEGORIES } from '../modules/Simulation/SimulationModule';
// import {
//   SimUser, SimEvent, SimEventType, PoolState, SimContext, ContractSupport,
//   makeUser, defaultPool, HH_ACCOUNTS,
// } from './sim/types'
// import { ALL_MODULES, MODULE_CATEGORIES, SimModule } from './sim/modules'

// ─── Event display config ─────────────────────────────────────────────────────
const EVENT_COLOR: Partial<Record<SimEventType, string>> = {
  deposit: 'text-emerald-400',
  borrow: 'text-amber-400',
  repay: 'text-sky-400',
  liquidate: 'text-rose-400',
  mint: 'text-violet-400',
  burn: 'text-orange-400',
  transfer: 'text-blue-400',
  approve: 'text-teal-400',
  swap: 'text-cyan-400',
  addLiq: 'text-emerald-300',
  removeLiq: 'text-orange-300',
  flashloan: 'text-pink-400',
  price: 'text-yellow-400',
  oracle: 'text-yellow-300',
  nft_mint: 'text-violet-300',
  nft_transfer: 'text-indigo-400',
  nft_list: 'text-blue-300',
  nft_sale: 'text-green-400',
  nft_bid: 'text-pink-300',
  vote: 'text-indigo-400',
  propose: 'text-violet-400',
  execute: 'text-green-400',
  attack: 'text-red-400',
  upgrade: 'text-teal-400',
  bridge: 'text-sky-300',
  mev: 'text-amber-500',
  gas: 'text-slate-400',
  block: 'text-slate-300',
  vest: 'text-purple-400',
  airdrop: 'text-violet-300',
  info: 'text-muted-foreground',
  warn: 'text-amber-400',
  error: 'text-rose-500',
  success: 'text-emerald-400',
};

// ─── RPC helpers ──────────────────────────────────────────────────────────────
async function rpcCall(url: string, method: string, params: any[] = []) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return d.result;
}

// ─── Contract supporter checker ───────────────────────────────────────────────
function checkContractSupport(
  deployedContracts: DeployedContract[],
  requiredMethods: string[],
): ContractSupport {
  if (requiredMethods.length === 0) return { supported: true, missing: [], suggestions: [] };
  const allMethods = new Set<string>();
  deployedContracts.forEach((dc) =>
    dc.abi.forEach((item: any) => {
      if (item.type === 'function') allMethods.add(item.name);
    }),
  );
  const missing = requiredMethods.filter((m) => !allMethods.has(m));
  return { supported: missing.length === 0, missing, suggestions: [] };
}

// ─── Call deployed contract ───────────────────────────────────────────────────
async function callDeployedContract(
  deployedContracts: DeployedContract[],
  rpcUrl: string,
  contractName: string,
  fn: string,
  args: any[],
  signerPk?: string,
): Promise<{ ok: boolean; result?: any; error?: string; gasUsed?: string; txHash?: string }> {
  // Special Hardhat RPC methods
  if (contractName === 'Hardhat') {
    try {
      const result = await rpcCall(rpcUrl, fn, args);
      return { ok: true, result };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }

  // Find matching deployed contract
  const dc = deployedContracts.find(
    (c) =>
      c.name === contractName ||
      c.name.toLowerCase().includes(contractName.toLowerCase()) ||
      contractName.toLowerCase().includes(c.name.toLowerCase()),
  );
  if (!dc) return { ok: false, error: `Contract "${contractName}" not deployed` };

  const fnDef = dc.abi.find((i: any) => i.name === fn && i.type === 'function');
  if (!fnDef) return { ok: false, error: `Function "${fn}" not in ABI of ${dc.name}` };

  try {
    const { ethers } = await import('ethers');
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const isRead = fnDef.stateMutability === 'view' || fnDef.stateMutability === 'pure';
    const signer = signerPk ? new ethers.Wallet(signerPk, provider) : null;
    const contract = new ethers.Contract(
      dc.address,
      dc.abi,
      isRead ? provider : signer || provider,
    );

    const parsedArgs = args.map((a) => {
      if (typeof a === 'string' && /^\d+$/.test(a)) return BigInt(a);
      if (typeof a === 'number') return BigInt(Math.floor(a));
      return a;
    });

    const result = await contract[fn](...parsedArgs);
    if (isRead) {
      return { ok: true, result: typeof result === 'bigint' ? result.toString() : result };
    } else {
      const receipt = await (result as any).wait();
      return { ok: true, txHash: receipt.hash, gasUsed: receipt.gasUsed?.toString() };
    }
  } catch (e: any) {
    return { ok: false, error: e.reason || e.shortMessage || e.message };
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  abis: ContractAbi[];
  deployedContracts: DeployedContract[];
  rpcUrl: string;
  onTxRecorded: (tx: TxRecord) => void;
}

// ─── Contract Notice component ────────────────────────────────────────────────
function ContractNotice({
  module,
  deployedContracts,
}: {
  module: SimModule;
  deployedContracts: DeployedContract[];
}) {
  const support = checkContractSupport(deployedContracts, module.requiredMethods);
  const [expanded, setExpanded] = useState(false);

  if (module.requiredMethods.length === 0) return null;

  if (support.supported) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
        <CheckCircle2 className="flex-shrink-0 w-3 h-3 text-emerald-400" />
        <span className="text-[10px] text-emerald-400">
          Contract connected — real transactions enabled
        </span>
        <Wifi className="w-3 h-3 ml-auto text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="overflow-hidden border rounded-lg border-amber-500/30 bg-amber-500/5">
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left">
        <WifiOff className="flex-shrink-0 w-3 h-3 text-amber-400" />
        <div className="flex-1 min-w-0">
          <span className="text-[10px] text-amber-400 font-medium">Running in simulation mode</span>
          <span className="text-[9px] text-amber-400/60 ml-1">
            ({support.missing.length} method{support.missing.length > 1 ? 's' : ''} missing)
          </span>
        </div>
        <ChevronDown
          className={cn('w-3 h-3 text-amber-400/60 transition-transform', expanded && 'rotate-180')}
        />
      </button>

      {expanded && (
        <div className="px-2.5 pb-2.5 space-y-2 border-t border-amber-500/20 pt-2">
          <div>
            <p className="text-[9px] text-amber-400/80 font-mono mb-1">Missing methods:</p>
            <div className="flex flex-wrap gap-1">
              {support.missing.map((m) => (
                <span
                  key={m}
                  className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  {m}()
                </span>
              ))}
            </div>
          </div>

          {module.suggestedContracts.length > 0 && (
            <div>
              <p className="text-[9px] text-amber-400/80 font-mono mb-1 flex items-center gap-1">
                <Package className="w-3 h-3" /> Deploy a compatible contract:
              </p>
              {module.suggestedContracts.map((sc, i) => (
                <div
                  key={i}
                  className="p-2 space-y-1 border rounded border-amber-500/15 bg-amber-500/5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-amber-300">{sc.interface}</span>
                    <span className="text-[9px] text-amber-400/50 font-mono">{sc.package}</span>
                  </div>
                  <code className="block text-[9px] text-amber-200/60 font-mono bg-black/20 px-1.5 py-0.5 rounded">
                    {sc.import}
                  </code>
                  <details className="text-[9px]">
                    <summary className="cursor-pointer select-none text-amber-400/60 hover:text-amber-400">
                      Show contract template
                    </summary>
                    <pre className="mt-1.5 text-[8.5px] text-amber-200/50 font-mono bg-black/30 p-2 rounded overflow-x-auto leading-relaxed whitespace-pre-wrap">
                      {sc.snippet}
                    </pre>
                  </details>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function SimulationPanel({ abis, deployedContracts, rpcUrl, onTxRecorded }: Props) {
  const [activeModuleId, setActiveModuleId] = useState<string>('token');
  const [events, setEvents] = useState<SimEvent[]>([]);
  const [running, setRunning] = useState(false);
  const stopRef = useRef(false);
  const eventsEndRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState('');
  const [expandedCats, setExpandedCats] = useState<Set<string>>(
    new Set(MODULE_CATEGORIES.map((c) => c.id)),
  );
  const [paramValues, setParamValues] = useState<Record<string, Record<string, string>>>({});
  const [users, setUsers] = useState<SimUser[]>([
    makeUser(0, 'Alice'),
    makeUser(1, 'Bob'),
    makeUser(2, 'Charlie'),
  ]);
  const [pool, setPool] = useState<PoolState>(defaultPool());

  const activeModule = ALL_MODULES.find((m) => m.id === activeModuleId)!;

  // Initialize param values
  useEffect(() => {
    const init: Record<string, Record<string, string>> = {};
    ALL_MODULES.forEach((m) => {
      init[m.id] = {};
      m.params.forEach((p) => {
        init[m.id][p.id] = p.default;
      });
    });
    setParamValues(init);
  }, []);

  const setParam = (moduleId: string, paramId: string, value: string) => {
    setParamValues((prev) => ({ ...prev, [moduleId]: { ...prev[moduleId], [paramId]: value } }));
  };

  const addEvent = useCallback((ev: Omit<SimEvent, 'id' | 'timestamp'>) => {
    const entry: SimEvent = { ...ev, id: crypto.randomUUID(), timestamp: Date.now() };
    setEvents((prev) => [...prev.slice(-800), entry]);
    setTimeout(() => eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, []);

  const stop = () => {
    stopRef.current = true;
    setRunning(false);
  };

  // Build simulation context
  const buildContext = useCallback(
    (): SimContext => ({
      users,
      pool,
      rpcUrl,
      deployedContracts,
      log: (type, actor, msg, value, success = true, realTx = false) =>
        addEvent({ type, actor, message: msg, value, success, realTx }),
      stop: () => stopRef.current,
      setPool,
      setUsers,
      onTxRecorded,
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      callContract: (name, fn, args, pk) =>
        callDeployedContract(deployedContracts, rpcUrl, name, fn, args, pk),
      checkSupport: (required) => checkContractSupport(deployedContracts, required),
    }),
    [users, pool, rpcUrl, deployedContracts, addEvent, onTxRecorded],
  );

  const runSim = async () => {
    if (!activeModule || running) return;
    stopRef.current = false;
    setRunning(true);
    setEvents([]);
    setPool(defaultPool());
    setUsers([
      makeUser(0, 'Alice'),
      makeUser(1, 'Bob'),
      makeUser(2, 'Charlie'),
      makeUser(3, 'Dave'),
    ]);
    const ctx = buildContext();
    const params = paramValues[activeModule.id] || {};
    try {
      await activeModule.run(ctx, params);
    } catch (e: any) {
      addEvent({
        type: 'error',
        actor: 'System',
        message: `Simulation error: ${e.message}`,
        success: false,
      });
    }
    setRunning(false);
  };

  const okCount = events.filter(
    (e: any) => e.status === 'ok' || (e.success && e.type === 'success'),
  ).length;
  const errCount = events.filter((e) => e.type === 'error' || !e.success).length;
  const realTxCount = events.filter((e) => e.realTx).length;

  const filtered = ALL_MODULES.filter(
    (m) =>
      !search ||
      m.label.toLowerCase().includes(search.toLowerCase()) ||
      m.desc.toLowerCase().includes(search.toLowerCase()) ||
      m.category.toLowerCase().includes(search.toLowerCase()),
  );

  const toggleCat = (cat: string) =>
    setExpandedCats((prev) => {
      const s = new Set(prev);
      s.has(cat) ? s.delete(cat) : s.add(cat);
      return s;
    });

  return (
    <div className="flex h-full overflow-hidden bg-background">
      {/* ── Left sidebar: module list ── */}
      <div className="flex flex-col flex-shrink-0 w-56 overflow-hidden border-r border-border bg-card">
        <div className="px-3 py-2.5 border-b border-border">
          <div className="flex items-center gap-2 mb-2">
            <FlaskConical className="w-3.5 h-3.5 text-violet-400" />
            <span className="text-xs font-semibold">Sim Lab</span>
            <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded ml-auto font-mono">
              {ALL_MODULES.length}
            </span>
          </div>
          <div className="relative">
            <Search className="absolute w-3 h-3 -translate-y-1/2 left-2 top-1/2 text-muted-foreground/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search modules…"
              className="w-full bg-muted border border-border rounded text-[10px] pl-6 pr-2 py-1 focus:outline-none focus:border-violet-500/50 text-foreground placeholder:text-muted-foreground/30"
            />
          </div>
        </div>

        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="py-1">
            {MODULE_CATEGORIES.map((cat) => {
              const catModules = filtered.filter((m) => m.category === cat.id);
              if (catModules.length === 0) return null;
              const isExpanded = expandedCats.has(cat.id);
              return (
                <div key={cat.id}>
                  <button
                    onClick={() => toggleCat(cat.id)}
                    className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[9px] text-muted-foreground/50 hover:text-muted-foreground uppercase tracking-widest font-mono transition-colors">
                    <span>{cat.icon}</span>
                    <span>{cat.id}</span>
                    <span
                      className={cn(
                        'ml-auto text-[8px] px-1 rounded',
                        cat.bg,
                        cat.color,
                        cat.border,
                        'border',
                      )}>
                      {catModules.length}
                    </span>
                    <ChevronRight
                      className={cn('w-3 h-3 transition-transform', isExpanded && 'rotate-90')}
                    />
                  </button>
                  {isExpanded &&
                    catModules.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setActiveModuleId(m.id)}
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-all text-left border-l-2',
                          activeModuleId === m.id
                            ? 'bg-violet-500/10 border-l-violet-500 text-foreground'
                            : 'border-l-transparent text-muted-foreground hover:bg-muted/30 hover:text-foreground',
                        )}>
                        <span className="flex-shrink-0 text-sm">{m.icon}</span>
                        <div className="min-w-0">
                          <div className="text-[11px] font-medium truncate">{m.label}</div>
                          <div className="text-[9px] text-muted-foreground/40 leading-tight truncate">
                            {m.desc}
                          </div>
                        </div>
                      </button>
                    ))}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* ── Center: params + run ── */}
      <div className="flex flex-col flex-shrink-0 overflow-hidden border-r w-60 border-border bg-card/30">
        {activeModule && (
          <>
            <div className="px-3 py-2.5 border-b border-border bg-card/50">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-lg">{activeModule.icon}</span>
                <div>
                  <div className="text-xs font-semibold">{activeModule.label}</div>
                  <div className="text-[9px] text-muted-foreground/50">{activeModule.category}</div>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground/60 mt-1.5">{activeModule.longDesc}</p>
            </div>

            <ScrollArea className="flex-1 overflow-y-auto">
              <div className="p-3 space-y-2.5">
                {/* Contract status */}
                <ContractNotice module={activeModule} deployedContracts={deployedContracts} />

                {/* Required methods hint */}
                {activeModule.requiredMethods.length > 0 && (
                  <div>
                    <p className="text-[9px] text-muted-foreground/40 uppercase tracking-widest font-mono mb-1">
                      Required ABI
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {activeModule.requiredMethods.map((m) => (
                        <span
                          key={m}
                          className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground/60">
                          {m}()
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-border/50">
                  <p className="text-[9px] text-muted-foreground/40 uppercase tracking-widest font-mono mb-2">
                    Parameters
                  </p>
                  {activeModule.params.map((param) => (
                    <div key={param.id} className="mb-2">
                      <Label className="text-[10px] mb-1 block flex items-center gap-1">
                        {param.label}
                        {param.hint && (
                          <span className="font-normal text-muted-foreground/30">{param.hint}</span>
                        )}
                      </Label>
                      {param.type === 'select' ? (
                        <Select
                          value={paramValues[activeModule.id]?.[param.id] ?? param.default}
                          onValueChange={(v) => setParam(activeModule.id, param.id, v)}>
                          <SelectTrigger className="h-7 text-[10px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {param.options?.map((o) => (
                              <SelectItem key={o} value={o}>
                                {o}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          value={paramValues[activeModule.id]?.[param.id] ?? param.default}
                          onChange={(e) => setParam(activeModule.id, param.id, e.target.value)}
                          className="h-7 text-[10px]"
                          type={param.type === 'number' ? 'number' : 'text'}
                          min={param.min}
                          max={param.max}
                        />
                      )}
                    </div>
                  ))}
                </div>

                {/* User config */}
                <div className="pt-2 border-t border-border/50">
                  <p className="text-[9px] text-muted-foreground/40 uppercase tracking-widest font-mono mb-1.5">
                    Users ({users.length})
                  </p>
                  <div className="space-y-1">
                    {users.slice(0, 3).map((u, i) => (
                      <div
                        key={u.id}
                        className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground/60">
                        <span className="w-3">{i + 1}.</span>
                        <span className="text-foreground/70">{u.label}</span>
                        <span className="ml-auto truncate">{u.address.slice(0, 8)}…</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>

            <div className="p-3 border-t border-border space-y-1.5">
              {running ? (
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full gap-1.5 h-8 text-xs"
                  onClick={stop}>
                  <Square className="w-3 h-3" /> Stop
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="w-full gap-1.5 h-8 text-xs bg-violet-600 hover:bg-violet-500"
                  onClick={runSim}>
                  <Play className="w-3 h-3" /> Run {activeModule.label}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full text-[10px] gap-1 h-7"
                onClick={() => setEvents([])}>
                <Trash2 className="w-3 h-3" /> Clear
              </Button>
            </div>
          </>
        )}
      </div>

      {/* ── Right: dashboard + log ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Pool state bar */}
        <div className="grid flex-shrink-0 grid-cols-6 gap-px border-b bg-border border-border">
          {[
            {
              label: 'Deposited',
              value: `${pool.totalDeposited.toFixed(0)} ETH`,
              color: 'text-emerald-400',
            },
            {
              label: 'Borrowed',
              value: `$${pool.totalBorrowed.toFixed(0)}`,
              color: 'text-amber-400',
            },
            {
              label: 'Utilization',
              value: `${Math.min(100, pool.utilizationRate).toFixed(1)}%`,
              color: 'text-sky-400',
            },
            {
              label: 'Price',
              value: `$${pool.collateralPrice.toFixed(0)}`,
              color: 'text-orange-400',
            },
            {
              label: 'Supply',
              value:
                pool.tokenTotalSupply >= 1e9
                  ? `${(pool.tokenTotalSupply / 1e9).toFixed(2)}B`
                  : pool.tokenTotalSupply.toLocaleString(),
              color: 'text-violet-400',
            },
            {
              label: 'Pool A/B',
              value: `${(pool.reserveA / 1000).toFixed(0)}k/${(pool.reserveB / 1000).toFixed(0)}k`,
              color: 'text-cyan-400',
            },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-card px-2 py-1.5">
              <div className="text-[8px] text-muted-foreground/40 uppercase tracking-widest">
                {label}
              </div>
              <div className={cn('text-xs font-mono font-semibold mt-0.5', color)}>{value}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-1 min-w-0 overflow-hidden">
          {/* Event log */}
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-card/50 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-violet-400" />
                <span className="text-xs font-semibold">Simulation Log</span>
                <span className="text-[9px] text-muted-foreground/40">{events.length} events</span>
                {realTxCount > 0 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                    <Wifi className="w-2.5 h-2.5" /> {realTxCount} on-chain
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {events.filter((e) => e.success && e.type !== 'error').length > 0 && (
                  <span className="text-[9px] text-emerald-400 font-mono">
                    ✓ {events.filter((e) => e.success && e.type !== 'error').length}
                  </span>
                )}
                {errCount > 0 && (
                  <span className="text-[9px] text-rose-400 font-mono">✗ {errCount}</span>
                )}
                {running && (
                  <div className="flex items-center gap-1 text-[10px] text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Running
                  </div>
                )}
              </div>
            </div>

            <ScrollArea className="flex-1 overflow-y-auto">
              <div className="p-2 space-y-px font-mono">
                {events.length === 0 && (
                  <div className="py-16 text-center text-muted-foreground/20">
                    <FlaskConical className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">Select a module and click Run</p>
                    <p className="text-[10px] mt-1 text-muted-foreground/30">
                      {deployedContracts.length > 0
                        ? `${deployedContracts.length} contract${deployedContracts.length > 1 ? 's' : ''} connected — real txs enabled`
                        : 'No deployed contracts — running in simulation mode'}
                    </p>
                  </div>
                )}
                {events.map((ev) => {
                  const color = EVENT_COLOR[ev.type] || 'text-muted-foreground/60';
                  const isLiquidate = ev.type === 'liquidate';
                  const isError = ev.type === 'error' || (!ev.success && ev.type !== 'info');
                  const isSuccess = ev.type === 'success';
                  const isRealTx = ev.realTx;
                  return (
                    <div
                      key={ev.id}
                      className={cn(
                        'flex items-start gap-2 px-2 py-1 rounded text-[10.5px] leading-relaxed group',
                        isLiquidate && 'bg-rose-500/8 border-l-2 border-rose-500/40',
                        isError && !isLiquidate && 'bg-rose-500/5',
                        isSuccess && 'bg-emerald-500/5',
                        ev.type === 'warn' && 'bg-amber-500/5',
                        ev.type === 'info' && 'opacity-60',
                      )}>
                      {/* Type indicator */}
                      <div
                        className={cn('flex-shrink-0 w-1.5 h-1.5 rounded-full mt-1.5', {
                          'bg-emerald-400': ev.success && ev.type !== 'info' && ev.type !== 'warn',
                          'bg-rose-400': !ev.success || isError,
                          'bg-amber-400': ev.type === 'warn',
                          'bg-muted-foreground/20': ev.type === 'info',
                        })}
                      />
                      <div className="flex-1 min-w-0">
                        <span className={cn('font-semibold mr-1.5', color)}>[{ev.actor}]</span>
                        <span className="text-foreground/80">{ev.message}</span>
                        {ev.value !== undefined &&
                          ev.type !== 'info' &&
                          ev.type !== 'error' &&
                          ev.type !== 'warn' &&
                          ev.type !== 'success' && (
                            <span className="text-muted-foreground/30 ml-1 text-[9px]">
                              {typeof ev.value === 'number'
                                ? ev.value.toLocaleString(undefined, { maximumFractionDigits: 4 })
                                : ev.value}
                            </span>
                          )}
                        {ev.txHash && (
                          <span className="ml-1.5 text-[9px] text-blue-400/60 font-mono">
                            {ev.txHash.slice(0, 12)}…
                          </span>
                        )}
                        {isRealTx && (
                          <span className="ml-1 text-[8px] text-emerald-400/60 border border-emerald-500/20 px-1 rounded">
                            on-chain
                          </span>
                        )}
                      </div>
                      <span className="text-[8px] text-muted-foreground/25 flex-shrink-0 mt-0.5">
                        {new Date(ev.timestamp).toLocaleTimeString([], {
                          hour12: false,
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                    </div>
                  );
                })}
                <div ref={eventsEndRef} />
              </div>
            </ScrollArea>
          </div>

          {/* User state panel */}
          <div className="flex flex-col flex-shrink-0 overflow-hidden border-l w-52 border-border">
            <div className="px-3 py-1.5 border-b border-border bg-card/50">
              <div className="flex items-center gap-1.5">
                <Users className="w-3 h-3 text-muted-foreground/50" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                  User State
                </span>
              </div>
            </div>
            <ScrollArea className="flex-1 overflow-y-auto">
              <div className="p-2 space-y-1.5">
                {users.map((u) => (
                  <div
                    key={u.id}
                    className={cn(
                      'rounded-lg border p-2 text-[10px] font-mono transition-colors',
                      u.healthFactor < 1.0 && u.borrowedAmount > 0
                        ? 'border-rose-500/40 bg-rose-500/5'
                        : u.healthFactor < 1.2 && u.borrowedAmount > 0
                          ? 'border-amber-500/30 bg-amber-500/5'
                          : 'border-border/50 bg-card/50',
                    )}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-foreground/90 text-[11px]">
                        {u.label}
                      </span>
                      {u.borrowedAmount > 0 && (
                        <span
                          className={cn(
                            'text-[8px] px-1 py-0.5 rounded font-mono',
                            u.healthFactor < 1.0
                              ? 'bg-rose-500/20 text-rose-400'
                              : u.healthFactor < 1.2
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-emerald-500/15 text-emerald-400',
                          )}>
                          HF {u.healthFactor > 100 ? '∞' : u.healthFactor.toFixed(2)}
                        </span>
                      )}
                    </div>
                    <div className="space-y-0.5 text-muted-foreground/60">
                      {u.balanceToken > 0 && (
                        <div className="flex items-center justify-between">
                          <span>🪙 Token</span>
                          <span className="text-foreground/70">
                            {u.balanceToken.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      )}
                      {u.balanceNFT.length > 0 && (
                        <div className="flex items-center justify-between">
                          <span>🖼️ NFTs</span>
                          <span className="text-foreground/70">{u.balanceNFT.length}</span>
                        </div>
                      )}
                      {u.balanceCollateral > 0 && (
                        <div className="flex items-center justify-between">
                          <span>💎 Collateral</span>
                          <span className="text-foreground/70">
                            {u.balanceCollateral.toFixed(1)}
                          </span>
                        </div>
                      )}
                      {u.borrowedAmount > 0 && (
                        <div className="flex items-center justify-between">
                          <span>💸 Debt</span>
                          <span className="text-amber-400/80">${u.borrowedAmount.toFixed(0)}</span>
                        </div>
                      )}
                      {u.lpTokens > 0 && (
                        <div className="flex items-center justify-between">
                          <span>🔄 LP</span>
                          <span className="text-cyan-400/80">{u.lpTokens.toFixed(1)}</span>
                        </div>
                      )}
                      {u.votingPower > 0 && (
                        <div className="flex items-center justify-between">
                          <span>🗳️ Votes</span>
                          <span className="text-indigo-400/80">
                            {(u.votingPower / 1000).toFixed(0)}k
                          </span>
                        </div>
                      )}
                      {u.stakedAmount > 0 && (
                        <div className="flex items-center justify-between">
                          <span>🔒 Staked</span>
                          <span className="text-violet-400/80">{u.stakedAmount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="text-muted-foreground/30 truncate mt-0.5">
                        {u.address.slice(0, 12)}…
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Connected contracts */}
            <div className="p-2 border-t border-border">
              <p className="text-[9px] text-muted-foreground/40 uppercase tracking-widest font-mono mb-1.5">
                Contracts ({deployedContracts.length})
              </p>
              {deployedContracts.length === 0 ? (
                <p className="text-[9px] text-muted-foreground/25 text-center py-1">
                  Deploy contracts first
                </p>
              ) : (
                <div className="space-y-1">
                  {deployedContracts.slice(0, 4).map((dc) => (
                    <div key={dc.id} className="flex items-center gap-1.5 text-[9px]">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                      <span className="font-semibold truncate text-foreground/70">{dc.name}</span>
                      <span className="flex-shrink-0 ml-auto font-mono text-muted-foreground/30">
                        {dc.address.slice(0, 7)}…
                      </span>
                    </div>
                  ))}
                  {deployedContracts.length > 4 && (
                    <p className="text-[9px] text-muted-foreground/30">
                      +{deployedContracts.length - 4} more
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
