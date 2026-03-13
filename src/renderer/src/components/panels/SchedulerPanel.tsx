import { useState, useEffect, useRef, useCallback } from 'react';
import { ContractAbi, DeployedContract } from '../../types';
import { Button } from '../ui/button';
import { Input, Label, ScrollArea } from '../ui/primitives';
import { cn } from '../../lib/utils';
import {
  Clock, Play, Square, Plus, Trash2, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, Loader2, Terminal, FileText, Zap,
  RotateCcw, ChevronRight,
} from 'lucide-react';

const api = (window as any).api;

//  Types 
type TaskType = 'contract_call' | 'script' | 'rpc_call';
type TaskStatus = 'idle' | 'running' | 'success' | 'error' | 'stopped';

interface ScheduledTask {
  id: string;
  name: string;
  type: TaskType;
  intervalMs: number;
  enabled: boolean;
  status: TaskStatus;
  lastRun?: number;
  lastResult?: string;
  runCount: number;
  contractAddress?: string;
  contractName?: string;
  functionName?: string;
  argValues?: string[]; // per-input array
  privateKey?: string;
  scriptPath?: string;
  rpcMethod?: string;
  rpcParams?: string;
}

interface LogEntry { ts: string; ok: boolean; msg: string }

const INTERVAL_PRESETS = [
  { label: '5s', ms: 5000 }, { label: '10s', ms: 10000 },
  { label: '30s', ms: 30000 }, { label: '1m', ms: 60000 },
  { label: '5m', ms: 300000 }, { label: '15m', ms: 900000 },
];

async function rpcFetch(url: string, method: string, params: unknown[]) {
  const r = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const d = await r.json() as { result?: unknown; error?: { message: string } };
  if (d.error) throw new Error(d.error.message);
  return d.result;
}

//  Countdown hook 
function useCountdown(lastRun: number | undefined, intervalMs: number, enabled: boolean) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (!enabled || !lastRun) { setRemaining(0); return; }
    const tick = () => {
      const elapsed = Date.now() - lastRun;
      const rem = Math.max(0, intervalMs - elapsed);
      setRemaining(rem);
    };
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [lastRun, intervalMs, enabled]);
  return remaining;
}

//  Countdown bar component 
function CountdownBar({ remaining, intervalMs, status }: { remaining: number; intervalMs: number; status: TaskStatus }) {
  const pct = intervalMs > 0 ? ((intervalMs - remaining) / intervalMs) * 100 : 0;
  const secs = Math.ceil(remaining / 1000);
  const color =
    status === 'running' ? 'bg-blue-400 animate-pulse' :
    status === 'error'   ? 'bg-rose-400' :
    status === 'success' ? 'bg-emerald-400' : 'bg-sky-400';

  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="flex-1 h-1.5 bg-muted/30 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-300', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-muted-foreground/40 w-10 text-right flex-shrink-0">
        {status === 'running' ? '…' : remaining > 0 ? `${secs}s` : 'now'}
      </span>
    </div>
  );
}

//  Per-task log viewer 
function TaskLogViewer({ logs }: { logs: LogEntry[] }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  return (
    <div className="mt-2 rounded-lg border border-border bg-[#0d0d0d] overflow-hidden">
      <div className="flex items-center gap-1.5 px-2 py-1 border-b border-border/60 bg-muted/10">
        <Terminal className="w-3 h-3 text-muted-foreground/40" />
        <span className="text-[9px] text-muted-foreground/40 uppercase tracking-widest">Log</span>
        <span className="ml-auto text-[9px] text-muted-foreground/30">{logs.length} entries</span>
      </div>
      <ScrollArea className="overflow-y-auto max-h-36">
        <div className="p-2 space-y-0.5 font-mono">
          {logs.length === 0 && (
            <div className="text-[10px] text-muted-foreground/20 py-2 text-center">No runs yet</div>
          )}
          {logs.map((l, i) => (
            <div key={i} className="flex items-start gap-2 text-[10px] leading-relaxed">
              <span className="flex-shrink-0 text-muted-foreground/25">{l.ts}</span>
              {l.ok
                ? <CheckCircle2 className="w-3 h-3 text-emerald-400/70 flex-shrink-0 mt-0.5" />
                : <XCircle    className="w-3 h-3 text-rose-400/70    flex-shrink-0 mt-0.5" />}
              <span className={l.ok ? 'text-emerald-300/80' : 'text-rose-300/80'}>{l.msg}</span>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </ScrollArea>
    </div>
  );
}

//  Task card 
function TaskCard({
  task, logs, onStart, onStop, onRemove, onRunOnce,
  deployedContracts, rpcUrl,
}: {
  task: ScheduledTask;
  logs: LogEntry[];
  onStart: () => void;
  onStop: () => void;
  onRemove: () => void;
  onRunOnce: () => void;
  deployedContracts: DeployedContract[];
  rpcUrl: string;
}) {
  const [showLog, setShowLog] = useState(false);
  const remaining = useCountdown(task.lastRun, task.intervalMs, task.enabled);

  const presetLabel = INTERVAL_PRESETS.find(p => p.ms === task.intervalMs)?.label
    || `${task.intervalMs / 1000}s`;

  const STATUS_ICON = {
    idle: <Clock className="w-3 h-3 text-muted-foreground/50" />,
    running: <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />,
    success: <CheckCircle2 className="w-3 h-3 text-emerald-400" />,
    error: <XCircle className="w-3 h-3 text-rose-400" />,
    stopped: <Square className="w-3 h-3 text-muted-foreground/30" />,
  }[task.status];

  const TYPE_COLOR = {
    contract_call: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    rpc_call: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    script: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  }[task.type];

  const lastRunStr = task.lastRun
    ? new Date(task.lastRun).toLocaleTimeString([], { hour12: false })
    : '—';

  return (
    <div className={cn(
      'border rounded-xl overflow-hidden transition-all',
      task.enabled ? 'border-blue-500/30 bg-blue-500/5' :
      task.status === 'error' ? 'border-rose-500/20 bg-rose-500/5' : 'border-border bg-card'
    )}>
      {/* Header */}
      <div className="flex items-start gap-3 p-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {STATUS_ICON}
            <span className="text-sm font-semibold">{task.name}</span>
            <span className={cn('text-[9px] px-1.5 py-0.5 rounded border capitalize', TYPE_COLOR)}>
              {task.type.replace('_', ' ')}
            </span>
            <span className="text-[10px] text-muted-foreground/40 flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" /> every {presetLabel}
            </span>
            {task.runCount > 0 && (
              <span className="text-[10px] text-muted-foreground/30">{task.runCount}× runs</span>
            )}
          </div>

          {/* Subtitle */}
          <div className="text-[10px] font-mono text-muted-foreground/50 mt-0.5 truncate">
            {task.type === 'contract_call' && `${task.contractName ?? '?'}.${task.functionName ?? '?'}(${(task.argValues || []).join(', ')})`}
            {task.type === 'rpc_call' && (task.rpcMethod || 'eth_blockNumber')}
            {task.type === 'script' && (task.scriptPath || 'no script')}
          </div>

          {/* Last result */}
          {task.lastResult && (
            <div className={cn(
              'text-[10px] font-mono mt-1 truncate max-w-md',
              task.status === 'error' ? 'text-rose-400/80' : 'text-emerald-400/70'
            )}>
              → {task.lastResult}
            </div>
          )}

          {/* Countdown */}
          {task.enabled && (
            <CountdownBar remaining={remaining} intervalMs={task.intervalMs} status={task.status} />
          )}
          {!task.enabled && task.lastRun && (
            <div className="text-[9px] text-muted-foreground/30 mt-1">Last run: {lastRunStr}</div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center flex-shrink-0 gap-1">
          <button onClick={onRunOnce} title="Run once now"
            className="p-1.5 rounded hover:bg-sky-500/20 text-muted-foreground/30 hover:text-sky-400 transition-all">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          {!task.enabled ? (
            <Button size="sm" className="gap-1 text-xs bg-blue-600 h-7 hover:bg-blue-500" onClick={onStart}>
              <Play className="w-3 h-3" /> Start
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="gap-1 text-xs h-7 border-rose-500/30 text-rose-400 hover:bg-rose-500/10" onClick={onStop}>
              <Square className="w-3 h-3" /> Stop
            </Button>
          )}
          <button onClick={onRemove}
            className="p-1.5 rounded hover:bg-rose-500/20 text-muted-foreground/20 hover:text-rose-400 transition-all">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setShowLog(v => !v)}
            className="p-1.5 rounded hover:bg-muted/40 text-muted-foreground/30 hover:text-muted-foreground transition-all">
            {showLog ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Log (collapsible) */}
      {showLog && (
        <div className="px-3 pt-2 pb-3 border-t border-border/40">
          <TaskLogViewer logs={logs} />
        </div>
      )}
    </div>
  );
}

//  Main Panel 
interface Props {
  abis: ContractAbi[];
  deployedContracts: DeployedContract[];
  rpcUrl: string;
  projectPath: string | null;
  onRunInTerminal: (cmd: string) => void;
}

export default function SchedulerPanel({ abis, deployedContracts, rpcUrl, projectPath, onRunInTerminal }: Props) {
  const [tasks, setTasks] = useState<ScheduledTask[]>(() => {
    try { return JSON.parse(localStorage.getItem('scheduler_tasks') || '[]'); } catch { return []; }
  });
  const [logs, setLogs] = useState<Record<string, LogEntry[]>>({});
  const [creating, setCreating] = useState(false);
  const [newTask, setNewTask] = useState<Partial<ScheduledTask>>({
    type: 'contract_call', intervalMs: 10000, name: '', argValues: [],
  });

  const intervals = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  // Persist tasks
  const persist = (list: ScheduledTask[]) => {
    setTasks(list);
    try { localStorage.setItem('scheduler_tasks', JSON.stringify(list.map(t => ({ ...t, status: 'idle' as TaskStatus })))); } catch {}
  };

  const addLog = useCallback((taskId: string, ok: boolean, msg: string) => {
    const ts = new Date().toLocaleTimeString([], { hour12: false });
    setLogs(prev => ({ ...prev, [taskId]: [...(prev[taskId] || []).slice(-199), { ts, ok, msg }] }));
  }, []);

  // Execute a task
  const executeTask = useCallback(async (task: ScheduledTask): Promise<{ ok: boolean; result: string }> => {
    try {
      if (task.type === 'rpc_call') {
        const params = task.rpcParams ? JSON.parse(task.rpcParams) : [];
        const result = await rpcFetch(rpcUrl, task.rpcMethod || 'eth_blockNumber', params);
        return { ok: true, result: JSON.stringify(result) };
      }

      if (task.type === 'script') {
        if (!projectPath || !task.scriptPath) return { ok: false, result: 'No script path set' };
        onRunInTerminal(`npx hardhat run ${task.scriptPath} --network localhost`);
        return { ok: true, result: `Script launched: ${task.scriptPath}` };
      }

      if (task.type === 'contract_call') {
        const contract = deployedContracts.find(c =>
          c.address.toLowerCase() === task.contractAddress?.toLowerCase()
        );
        if (!contract) return { ok: false, result: `Contract not found: ${task.contractAddress}` };
        const fn = contract.abi.find(i => i.name === task.functionName);
        if (!fn) return { ok: false, result: `Function not found: ${task.functionName}` };

        const { ethers } = await import('ethers');
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const argValues = task.argValues?.filter(Boolean) || [];

        if (fn.stateMutability === 'view' || fn.stateMutability === 'pure') {
          const iface = new ethers.Interface([fn]);
          const data = iface.encodeFunctionData(fn.name!, argValues);
          const raw = await provider.call({ to: contract.address, data });
          const decoded = iface.decodeFunctionResult(fn.name!, raw);
          return { ok: true, result: decoded.map((v: unknown) => String(v)).join(', ') };
        } else {
          if (!task.privateKey) return { ok: false, result: 'Write function requires private key' };
          const wallet = new ethers.Wallet(
            task.privateKey.startsWith('0x') ? task.privateKey : `0x${task.privateKey}`,
            provider
          );
          const iface = new ethers.Interface([fn]);
          const data = iface.encodeFunctionData(fn.name!, argValues);
          const tx = await wallet.sendTransaction({ to: contract.address, data });
          const receipt = await tx.wait();
          return { ok: true, result: `tx: ${tx.hash.slice(0, 14)}… block #${receipt?.blockNumber}` };
        }
      }
      return { ok: false, result: 'Unknown task type' };
    } catch (e: any) {
      return { ok: false, result: e?.message || String(e) };
    }
  }, [rpcUrl, projectPath, deployedContracts, onRunInTerminal]);

  const runTask = useCallback(async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const label = task.type === 'contract_call'
      ? `${task.contractName}.${task.functionName}(${(task.argValues || []).join(', ')})`
      : task.type === 'script' ? task.scriptPath || '' : task.rpcMethod || '';

    addLog(taskId, true, `▶ ${label}`);
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'running' } : t));

    const { ok, result } = await executeTask(task);
    addLog(taskId, ok, result);
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, status: ok ? 'success' : 'error', lastRun: Date.now(), lastResult: result, runCount: t.runCount + 1 } : t
    ));
  }, [tasks, executeTask, addLog]);

  const startTask = (taskId: string) => {
    if (intervals.current[taskId]) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, enabled: true } : t));
    runTask(taskId); // immediate first run
    intervals.current[taskId] = setInterval(() => runTask(taskId), task.intervalMs);
  };

  const stopTask = (taskId: string) => {
    clearInterval(intervals.current[taskId]);
    delete intervals.current[taskId];
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, enabled: false, status: 'stopped' } : t));
  };

  const removeTask = (taskId: string) => {
    stopTask(taskId);
    persist(tasks.filter(t => t.id !== taskId));
  };

  const addTask = () => {
    if (!newTask.name?.trim()) return;
    const task: ScheduledTask = {
      id: crypto.randomUUID(),
      name: newTask.name,
      type: newTask.type || 'contract_call',
      intervalMs: newTask.intervalMs || 10000,
      enabled: false, status: 'idle', runCount: 0,
      argValues: newTask.argValues || [],
      ...newTask,
    };
    persist([...tasks, task]);
    setCreating(false);
    setNewTask({ type: 'contract_call', intervalMs: 10000, name: '', argValues: [] });
  };

  useEffect(() => {
    return () => { Object.values(intervals.current).forEach(clearInterval); };
  }, []);

  //  Helpers for form 
  const selectedContract = deployedContracts.find(c => c.address === newTask.contractAddress);
  const selectedFn = selectedContract?.abi.find(i => i.name === newTask.functionName);
  const fnInputs = selectedFn?.inputs || [];
  const isWrite = selectedFn && selectedFn.stateMutability !== 'view' && selectedFn.stateMutability !== 'pure';

  const setArg = (idx: number, val: string) => {
    setNewTask(p => {
      const args = [...(p.argValues || [])];
      while (args.length <= idx) args.push('');
      args[idx] = val;
      return { ...p, argValues: args };
    });
  };

  const activeTasks = tasks.filter(t => t.enabled).length;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card flex-shrink-0">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-semibold">Scheduler / Keeper</span>
          <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{tasks.length} tasks</span>
          {activeTasks > 0 && (
            <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              {activeTasks} active
            </span>
          )}
        </div>
        <Button size="sm" className="gap-1 text-xs h-7" onClick={() => setCreating(v => !v)}>
          {creating ? <ChevronUp className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
          {creating ? 'Cancel' : 'New Task'}
        </Button>
      </div>

      <ScrollArea className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-3">

          {/*  Create form  */}
          {creating && (
            <div className="p-4 space-y-3 border border-blue-500/20 bg-blue-500/5 rounded-xl">
              <h3 className="text-sm font-semibold text-blue-300">New Scheduled Task</h3>

              <div className="grid grid-cols-2 gap-3">
                {/* Name */}
                <div className="col-span-2">
                  <Label className="text-[10px] mb-1 block">Task Name *</Label>
                  <Input value={newTask.name || ''} onChange={e => setNewTask(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Monitor oracle price" className="text-xs h-7" />
                </div>

                {/* Type */}
                <div>
                  <Label className="text-[10px] mb-1 block">Type</Label>
                  <select value={newTask.type} onChange={e => setNewTask(p => ({ ...p, type: e.target.value as TaskType, functionName: '', argValues: [] }))}
                    className="w-full px-2 text-xs border rounded outline-none h-7 bg-muted/20 border-border text-foreground/80">
                    <option value="contract_call">Contract Call</option>
                    <option value="rpc_call">RPC Call</option>
                    <option value="script">Hardhat Script</option>
                  </select>
                </div>

                {/* Interval */}
                <div>
                  <Label className="text-[10px] mb-1 block">Interval</Label>
                  <div className="flex flex-wrap gap-1">
                    {INTERVAL_PRESETS.map(p => (
                      <button key={p.label} onClick={() => setNewTask(prev => ({ ...prev, intervalMs: p.ms }))}
                        className={cn('px-2 py-0.5 text-[9px] rounded border transition-all',
                          newTask.intervalMs === p.ms
                            ? 'border-blue-500 text-blue-400 bg-blue-500/10'
                            : 'border-border text-muted-foreground/50 hover:border-muted-foreground/30')}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/*  Contract call fields  */}
                {newTask.type === 'contract_call' && (<>
                  <div>
                    <Label className="text-[10px] mb-1 block">Contract</Label>
                    <select value={newTask.contractAddress || ''}
                      onChange={e => {
                        const c = deployedContracts.find(c => c.address === e.target.value);
                        setNewTask(p => ({ ...p, contractAddress: e.target.value, contractName: c?.name, functionName: '', argValues: [] }));
                      }}
                      className="w-full px-2 text-xs border rounded outline-none h-7 bg-muted/20 border-border text-foreground/80">
                      <option value="">— Select deployed contract —</option>
                      {deployedContracts.map(c => <option key={c.id} value={c.address}>{c.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <Label className="text-[10px] mb-1 block">Function</Label>
                    <select value={newTask.functionName || ''}
                      onChange={e => setNewTask(p => ({ ...p, functionName: e.target.value, argValues: [] }))}
                      className="w-full px-2 text-xs border rounded outline-none h-7 bg-muted/20 border-border text-foreground/80"
                      disabled={!newTask.contractAddress}>
                      <option value="">— Select function —</option>
                      {selectedContract?.abi.filter(i => i.type === 'function').map(i => (
                        <option key={i.name} value={i.name || ''}>
                          {i.name}() [{i.stateMutability}]
                        </option>
                      ))}
                    </select>
                  </div>

                  {/*  Dynamic arg inputs  */}
                  {fnInputs.length > 0 && (
                    <div className="col-span-2">
                      <Label className="text-[10px] mb-2 block text-sky-400">Arguments</Label>
                      <div className="space-y-1.5">
                        {fnInputs.map((inp, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <div className="flex-shrink-0 w-36">
                              <span className="text-[10px] text-muted-foreground/70 font-mono">{inp.name || `arg${idx}`}</span>
                              <span className="text-[9px] text-sky-400/60 ml-1">({inp.type})</span>
                            </div>
                            <Input
                              value={(newTask.argValues || [])[idx] || ''}
                              onChange={e => setArg(idx, e.target.value)}
                              placeholder={inp.type}
                              className="flex-1 font-mono text-xs h-7"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/*  Private key for write  */}
                  {isWrite && (
                    <div className="col-span-2">
                      <Label className="text-[10px] mb-1 block text-amber-400">⚠ Private Key (write function)</Label>
                      <Input type="password" value={newTask.privateKey || ''}
                        onChange={e => setNewTask(p => ({ ...p, privateKey: e.target.value }))}
                        placeholder="0x..." className="font-mono text-xs h-7" />
                      <p className="text-[9px] text-amber-500/60 mt-1">Stored locally. Never share this key.</p>
                    </div>
                  )}
                </>)}

                {/*  RPC fields  */}
                {newTask.type === 'rpc_call' && (<>
                  <div>
                    <Label className="text-[10px] mb-1 block">RPC Method</Label>
                    <Input value={newTask.rpcMethod || ''} onChange={e => setNewTask(p => ({ ...p, rpcMethod: e.target.value }))}
                      placeholder="eth_blockNumber" className="font-mono text-xs h-7" />
                  </div>
                  <div>
                    <Label className="text-[10px] mb-1 block">Params (JSON array)</Label>
                    <Input value={newTask.rpcParams || '[]'} onChange={e => setNewTask(p => ({ ...p, rpcParams: e.target.value }))}
                      placeholder='["latest"]' className="font-mono text-xs h-7" />
                  </div>
                </>)}

                {/*  Script fields  */}
                {newTask.type === 'script' && (
                  <div className="col-span-2">
                    <Label className="text-[10px] mb-1 block">Script Path</Label>
                    <Input value={newTask.scriptPath || ''} onChange={e => setNewTask(p => ({ ...p, scriptPath: e.target.value }))}
                      placeholder="scripts/keeper.js" className="font-mono text-xs h-7" />
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <Button size="sm" className="text-xs bg-blue-600 h-7 hover:bg-blue-500" onClick={addTask} disabled={!newTask.name?.trim()}>
                  <Plus className="w-3 h-3 mr-1" /> Add Task
                </Button>
                <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setCreating(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/*  Task list  */}
          {tasks.length === 0 && !creating ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground/30">
              <Clock className="w-12 h-12 opacity-20" />
              <p className="text-sm">No scheduled tasks</p>
              <p className="text-xs text-center opacity-60">
                Schedule contract calls, RPC polls, or scripts<br/>to run automatically at fixed intervals
              </p>
              <Button size="sm" className="gap-1 mt-2 text-xs h-7" onClick={() => setCreating(true)}>
                <Plus className="w-3 h-3" /> Create First Task
              </Button>
            </div>
          ) : (
            tasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                logs={logs[task.id] || []}
                deployedContracts={deployedContracts}
                rpcUrl={rpcUrl}
                onStart={() => startTask(task.id)}
                onStop={() => stopTask(task.id)}
                onRemove={() => removeTask(task.id)}
                onRunOnce={() => runTask(task.id)}
              />
            ))
          )}

          {/* Info box */}
          <div className="p-3 text-xs leading-relaxed border rounded-lg bg-amber-500/5 border-amber-500/15 text-foreground/50">
            <span className="font-semibold text-amber-400">⚠ Runs while Hardhat Studio is open.</span>
            {' '}For production keepers, use Chainlink Automation or a cron service. Read functions call RPC directly; write functions need a private key.
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}