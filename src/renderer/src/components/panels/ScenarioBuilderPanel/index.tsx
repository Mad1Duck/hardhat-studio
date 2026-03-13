import { useState, useEffect, useCallback } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

//  Internal
import type { ScenarioBuilderProps, Step, CustomEdge } from './types';
import { useScenario } from './hooks/useScenario';
import { useFlowGraph } from './hooks/useFlowGraph';
import { CanvasInner } from './components/CanvasInner';
import { MonacoScriptEditor } from './components/MonacoScriptEditor';
import { ACTIONS, ACTION_GROUPS, GROUP_LABELS } from './config/actions';
import { GROUP_COLORS, GROUP_IDS } from './config/groups';
import { parseScriptToSteps } from './lib/parseScript';

//  Shared UI
import { Button } from '../../ui/button';
import { Input, Label, ScrollArea } from '../../ui/primitives';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { cn } from '../../../lib/utils';
import type { HardhatAccount } from '../../../types';

//  Icons
import {
  ListOrdered,
  Plus,
  Trash2,
  Play,
  Download,
  Upload,
  RefreshCw,
  Terminal,
  X,
  ChevronDown,
  CheckCircle2,
  XCircle,
  Copy,
  User,
  Eye,
  Timer,
  FileCode,
  ArrowRight,
  Hash,
  Fuel,
  RotateCcw,
  GitBranch,
  Package,
  Merge,
  Sparkles,
} from 'lucide-react';

//
export default function ScenarioBuilderPanel({
  abis,
  deployedContracts,
  rpcUrl,
  onTxRecorded,
}: ScenarioBuilderProps) {
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [hhAccounts, setHHAccounts] = useState<HardhatAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [view, setView] = useState<'canvas' | 'list'>('canvas');
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [rightTab, setRightTab] = useState<'log' | 'connections'>('log');
  const [newConnSrc, setNewConnSrc] = useState('');
  const [newConnTgt, setNewConnTgt] = useState('');
  const [stepConnTarget, setStepConnTarget] = useState('');

  //  Core state
  const {
    scenarios,
    active,
    setActive,
    runLogs,
    running,
    activeStepIds,
    activeRef,
    createScenario,
    deleteScenario,
    updateScenario,
    addStep,
    removeStep,
    patchStep,
    runScenario,
    resetRun,
  } = useScenario(deployedContracts, rpcUrl, onTxRecorded);

  //  Flow graph
  const handleSelect = useCallback(
    (id: string) => setSelectedStepId((prev) => (prev === id ? null : id)),
    [],
  );

  const { rfNodes, rfEdges, setRfNodes, onNodesChange, onEdgesChange, onConnect, rebuild } =
    useFlowGraph(active, selectedStepId, handleSelect, updateScenario, activeRef);

  useEffect(() => {
    rebuild();
  }, [active?.steps, active?.customEdges, active?.nodePositions, selectedStepId]);
  useEffect(() => {
    setStepConnTarget('');
  }, [selectedStepId]);

  //  Accounts
  const loadAccounts = async () => {
    setLoadingAccounts(true);
    try {
      setHHAccounts((await window.api.getHardhatAccounts(rpcUrl)) || []);
    } catch {}
    setLoadingAccounts(false);
  };

  //  Contract fn helpers
  const getFns = (addr: string, name: string, kind?: 'read' | 'write') => {
    const dc = deployedContracts.find(
      (c) => (addr && c.address.toLowerCase() === addr.toLowerCase()) || (name && c.name === name),
    );
    if (!dc) return [];
    return dc.abi
      .filter((i) => {
        if (i.type !== 'function') return false;
        if (kind === 'read') return i.stateMutability === 'view' || i.stateMutability === 'pure';
        if (kind === 'write') return i.stateMutability !== 'view' && i.stateMutability !== 'pure';
        return true;
      })
      .map((i) => ({
        name: i.name || '',
        inputs: (i.inputs || []).map((x: any) => x.type).join(','),
      }));
  };

  //  Parallel group helpers
  const usedGroups = Array.from(
    new Set((active?.steps || []).map((s) => s.parallelGroup).filter(Boolean) as string[]),
  );
  const assignGroup = (stepId: string, groupId: string | null) =>
    patchStep(stepId, { parallelGroup: groupId });
  const createNewGroup = (stepId: string) => {
    const available = GROUP_IDS.filter((g) => !usedGroups.includes(g));
    if (available.length) assignGroup(stepId, available[0]);
  };

  //  Custom edge helpers
  const addCustomEdge = (src: string, tgt: string) => {
    const cur = activeRef.current;
    if (!cur || !src || !tgt) return;
    const already = (cur.customEdges || []).some((e) => e.source === src && e.target === tgt);
    if (already) return;
    const edge: CustomEdge = { id: `custom-${src}-${tgt}-${Date.now()}`, source: src, target: tgt };
    updateScenario({ ...cur, customEdges: [...(cur.customEdges || []), edge] });
  };

  const removeCustomEdge = (id: string) => {
    const cur = activeRef.current;
    if (!cur) return;
    updateScenario({ ...cur, customEdges: cur.customEdges.filter((e) => e.id !== id) });
  };

  //  Import helpers
  const importFile = (accept: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      const steps = parseScriptToSteps(text);
      if (!steps.length) {
        alert(`No recognizable steps found in ${accept} file`);
        return;
      }
      const name = file.name.replace(/\.(test\.)?(ts|js)$/, '').replace(/-/g, ' ');
      const s = createScenario(name);
      updateScenario({ ...s, steps });
    };
    input.click();
  };

  const importJson = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        const list = (Array.isArray(data) ? data : [data]).map((s) => ({
          ...s,
          id: crypto.randomUUID(),
          createdAt: Date.now(),
          steps: s.steps || [],
          customEdges: s.customEdges || [],
        }));
        list.forEach((s) => updateScenario(s));
        if (list.length === 1) setActive(list[0]);
      } catch {
        alert('Invalid scenario JSON');
      }
    };
    input.click();
  };

  const exportJson = () => {
    if (!active) return;
    const posMap: Record<string, { x: number; y: number }> = {};
    rfNodes.forEach((n) => {
      posMap[n.id] = { x: n.position.x, y: n.position.y };
    });
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({ ...active, nodePositions: posMap }, null, 2)], {
        type: 'application/json',
      }),
    );
    Object.assign(document.createElement('a'), {
      href: url,
      download: `${active.name.replace(/\s+/g, '-')}.scenario.json`,
    }).click();
    URL.revokeObjectURL(url);
  };

  //  Derived
  const selectedStep = active?.steps.find((s) => s.id === selectedStepId) ?? null;
  const selectedMeta = selectedStep ? ACTIONS.find((a) => a.id === selectedStep.action) : null;
  const okCount = runLogs.filter((l) => l.status === 'ok').length;
  const failCount = runLogs.filter((l) => l.status === 'error').length;
  const totalMs = runLogs.reduce((a, l) => a + (l.duration || 0), 0);

  //  Render
  return (
    <div className="flex h-full overflow-hidden bg-background">
      {/*  Sidebar  */}
      <div className="flex flex-col flex-shrink-0 border-r w-52 border-border bg-card">
        <div className="px-3 py-2.5 border-b border-border">
          <div className="flex items-center gap-2 mb-2">
            <ListOrdered className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-semibold">Scenarios</span>
            <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded ml-auto font-mono">
              {scenarios.length}
            </span>
          </div>
          <div className="flex gap-1">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Scenario name…"
              className="flex-1 text-xs h-7"
              onKeyDown={(e) =>
                e.key === 'Enter' && newName.trim() && createScenario(newName) && setNewName('')
              }
            />
            <Button
              size="icon"
              className="flex-shrink-0 w-7 h-7 bg-emerald-600 hover:bg-emerald-500"
              onClick={() => {
                if (newName.trim()) {
                  createScenario(newName);
                  setNewName('');
                }
              }}
              disabled={!newName.trim()}>
              <Plus className="w-3 h-3" />
            </Button>
          </div>
        </div>

        <div className="px-3 py-1.5 border-b border-border">
          <button
            onClick={loadAccounts}
            className="flex items-center gap-1.5 text-[10px] w-full text-muted-foreground/50 hover:text-muted-foreground transition-colors">
            <User className="w-3 h-3" />
            {hhAccounts.length > 0
              ? `${hhAccounts.length} accounts loaded`
              : 'Load Hardhat accounts'}
            <RefreshCw className={cn('w-2.5 h-2.5 ml-auto', loadingAccounts && 'animate-spin')} />
          </button>
        </div>

        <div className="flex-1 py-1 overflow-y-auto">
          {scenarios.length === 0 && (
            <div className="text-center text-[10px] text-muted-foreground/25 py-8">
              No scenarios yet
            </div>
          )}
          {scenarios.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setActive(s);
                setSelectedStepId(null);
              }}
              className={cn(
                'w-full text-left px-3 py-2 transition-all group flex items-start justify-between border-b border-border/20',
                active?.id === s.id
                  ? 'bg-blue-500/10 border-l-2 border-l-blue-500'
                  : 'hover:bg-muted/30',
              )}>
              <div className="min-w-0">
                <div className="text-xs font-medium truncate">{s.name}</div>
                <div className="text-[9px] text-muted-foreground/40 font-mono mt-0.5">
                  {s.steps.length} steps
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteScenario(s.id);
                }}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground/20 hover:text-rose-400 p-0.5 mt-0.5 transition-opacity">
                <Trash2 className="w-3 h-3" />
              </button>
            </button>
          ))}
        </div>

        <div className="px-3 py-2 space-y-1 border-t border-border">
          <button
            onClick={importJson}
            className="w-full flex items-center gap-1.5 text-[10px] text-muted-foreground/40 hover:text-muted-foreground transition-colors">
            <Upload className="w-3 h-3" /> Import JSON
          </button>
        </div>
      </div>

      {/*  Main  */}
      {!active ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-4 text-muted-foreground/25">
          <ListOrdered className="w-14 h-14 opacity-15" />
          <p className="text-sm">Select or create a scenario</p>
        </div>
      ) : (
        <div className="flex flex-1 min-w-0 overflow-hidden">
          {/* Canvas + toolbar */}
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center flex-shrink-0 gap-2 px-3 py-2 border-b border-border bg-card/50">
              <span className="text-sm font-semibold text-foreground/90">{active.name}</span>
              <span className="text-[10px] text-muted-foreground/40 font-mono">
                {active.steps.length} steps
              </span>

              {usedGroups.length > 0 && (
                <div className="flex items-center gap-1 ml-1">
                  <GitBranch className="w-3 h-3 text-muted-foreground/30" />
                  {usedGroups.map((g) => {
                    const c = GROUP_COLORS[g];
                    return (
                      <span
                        key={g}
                        style={{ color: c.color, background: '#161b22f0', borderColor: c.border }}
                        className="text-[9px] px-1.5 py-0.5 rounded border font-mono">
                        {g}
                      </span>
                    );
                  })}
                </div>
              )}

              {runLogs.length > 0 && (
                <div className="flex items-center gap-2 ml-1">
                  {okCount > 0 && (
                    <span className="text-[9px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded font-mono">
                      ✓ {okCount}
                    </span>
                  )}
                  {failCount > 0 && (
                    <span className="text-[9px] text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded font-mono">
                      ✗ {failCount}
                    </span>
                  )}
                  {totalMs > 0 && (
                    <span className="text-[9px] text-muted-foreground/30 font-mono">
                      {totalMs}ms
                    </span>
                  )}
                </div>
              )}

              <div className="ml-auto flex items-center gap-1.5">
                <div className="flex overflow-hidden border rounded-lg bg-muted border-border">
                  {(['canvas', 'list'] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setView(v)}
                      className={cn(
                        'px-2.5 py-1 text-[10px] font-medium transition-colors',
                        view === v
                          ? 'bg-blue-600 text-white'
                          : 'text-muted-foreground hover:text-foreground',
                      )}>
                      {v === 'canvas' ? '⬡ Flow' : '≡ List'}
                    </button>
                  ))}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px] gap-1"
                  onClick={resetRun}
                  disabled={running || runLogs.length === 0}>
                  <RotateCcw className="w-3 h-3" /> Reset
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px] gap-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                  onClick={exportJson}
                  disabled={!active.steps.length}>
                  <Download className="w-3 h-3" /> .json
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px] gap-1 border-sky-500/30 text-sky-400 hover:bg-sky-500/10"
                  onClick={importJson}>
                  <Upload className="w-3 h-3" /> Import
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-[10px] gap-1.5 bg-emerald-600 hover:bg-emerald-500"
                  onClick={() => runScenario(hhAccounts)}
                  disabled={running || !active.steps.length}>
                  {running ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" /> Running…
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3" /> Run
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Canvas */}
            {view === 'canvas' && (
              <div className="relative flex-1 min-h-0">
                <ReactFlowProvider>
                  <CanvasInner
                    rfNodes={rfNodes}
                    rfEdges={rfEdges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    showAddMenu={showAddMenu}
                    setShowAddMenu={setShowAddMenu}
                    addStep={addStep}
                    active={active}
                    setRfNodes={setRfNodes}
                  />
                </ReactFlowProvider>
              </div>
            )}

            {/* List view */}
            {view === 'list' && (
              <ScrollArea className="flex-1 overflow-y-auto">
                <div className="p-3 space-y-1.5">
                  {active.steps.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground/25">
                      <p className="text-xs">No steps yet</p>
                    </div>
                  ) : (
                    active.steps.map((step, i) => {
                      const meta = ACTIONS.find((a) => a.id === step.action)!;
                      const isSelected = selectedStepId === step.id;
                      const status = step.status || 'idle';
                      const pgColor = step.parallelGroup ? GROUP_COLORS[step.parallelGroup] : null;
                      return (
                        <div
                          key={step.id}
                          onClick={() => setSelectedStepId(isSelected ? null : step.id)}
                          className={cn(
                            'rounded-lg border cursor-pointer transition-all',
                            status === 'ok'
                              ? 'border-emerald-500/30 bg-emerald-500/5'
                              : status === 'error'
                                ? 'border-rose-500/30 bg-rose-500/5'
                                : status === 'running'
                                  ? 'border-amber-500/40 bg-amber-500/5 animate-pulse'
                                  : isSelected
                                    ? 'border-blue-500/40 bg-blue-500/5'
                                    : 'border-border/50 hover:border-border',
                          )}
                          style={
                            pgColor ? { borderLeftColor: pgColor.border, borderLeftWidth: 3 } : {}
                          }>
                          <div className="flex items-center gap-2.5 px-3 py-2">
                            <span className="text-[10px] text-muted-foreground/30 font-mono w-4">
                              {i + 1}
                            </span>
                            <span className="flex-shrink-0 text-sm">{meta.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-medium" style={{ color: meta.color }}>
                                  {meta.label}
                                </span>
                                {step.parallelGroup && (
                                  <span
                                    className="text-[9px] font-mono px-1 py-0.5 rounded"
                                    style={{
                                      color: pgColor!.color,
                                      background: '#161b22f0',
                                      borderColor: pgColor!.border,
                                      border: '1px solid',
                                    }}>
                                    ⑆ {step.parallelGroup}
                                  </span>
                                )}
                                <span className="text-xs truncate text-muted-foreground/50">
                                  {step.description}
                                </span>
                              </div>
                              {step.log && (
                                <div
                                  className={cn(
                                    'text-[10px] font-mono mt-0.5 truncate',
                                    status === 'ok'
                                      ? 'text-emerald-400'
                                      : status === 'error'
                                        ? 'text-rose-400'
                                        : 'text-amber-400',
                                  )}>
                                  {step.log}
                                </div>
                              )}
                            </div>
                            {status !== 'idle' && (
                              <div className="flex-shrink-0">
                                {status === 'ok' && (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                )}
                                {status === 'error' && (
                                  <XCircle className="w-4 h-4 text-rose-400" />
                                )}
                                {status === 'running' && (
                                  <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />
                                )}
                              </div>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeStep(step.id);
                              }}
                              className="flex-shrink-0 text-muted-foreground/20 hover:text-rose-400 p-0.5 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            )}
          </div>

          {/*  Right panel  */}
          <div className="flex flex-col flex-shrink-0 overflow-hidden border-l w-72 border-border bg-card/30">
            {selectedStep && selectedMeta ? (
              /* Step editor — same JSX as original, wired to patchStep */
              <div className="flex flex-col h-full overflow-hidden">
                <div
                  className="flex items-center flex-shrink-0 gap-2 px-3 py-2 border-b border-border"
                  style={{ background: '#161b22f0' }}>
                  <span className="text-base">{selectedMeta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold" style={{ color: selectedMeta.color }}>
                      {selectedMeta.label}
                    </div>
                    <div className="text-[9px] text-muted-foreground/40">{selectedMeta.desc}</div>
                  </div>
                  <button
                    onClick={() => setSelectedStepId(null)}
                    className="text-muted-foreground/30 hover:text-foreground">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <ScrollArea className="flex-1 overflow-y-auto">
                  <div className="p-3 space-y-3">
                    {/* Label */}
                    <div>
                      <Label className="text-[10px] mb-1 block">Label</Label>
                      <Input
                        value={selectedStep.description}
                        onChange={(e) =>
                          patchStep(selectedStep.id, { description: e.target.value })
                        }
                        className="text-xs h-7"
                      />
                    </div>

                    {/* Parallel group */}
                    <div>
                      <Label className="text-[10px] mb-1.5 flex items-center gap-1.5 block">
                        <GitBranch className="w-3 h-3 text-indigo-400" /> Parallel Group
                        <span className="ml-auto font-normal text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400/80 border border-emerald-500/20">
                          ⚡ controls execution
                        </span>
                      </Label>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          onClick={() => assignGroup(selectedStep.id, null)}
                          className={cn(
                            'text-[10px] px-2 py-1 rounded-md border transition-all font-mono',
                            !selectedStep.parallelGroup
                              ? 'bg-muted border-muted-foreground/30 text-foreground'
                              : 'border-border/30 text-muted-foreground/40 hover:text-muted-foreground hover:border-border',
                          )}>
                          None
                        </button>
                        {usedGroups.map((g) => {
                          const c = GROUP_COLORS[g];
                          const isActive = selectedStep.parallelGroup === g;
                          return (
                            <button
                              key={g}
                              onClick={() => assignGroup(selectedStep.id, isActive ? null : g)}
                              style={{
                                color: c.color,
                                background: isActive ? '#161b22f0' : 'transparent',
                                borderColor: isActive ? c.border : `${c.border}44`,
                              }}
                              className="text-[10px] px-2 py-1 rounded-md border transition-all font-mono hover:opacity-90">
                              {isActive ? '✓ ' : ''}
                              {g}
                            </button>
                          );
                        })}
                        {GROUP_IDS.filter((g) => !usedGroups.includes(g)).length > 0 && (
                          <button
                            onClick={() => createNewGroup(selectedStep.id)}
                            className="text-[10px] px-2 py-1 rounded-md border border-dashed border-border/30 text-muted-foreground/30 hover:text-muted-foreground hover:border-border transition-all font-mono flex items-center gap-1">
                            <Plus className="w-2.5 h-2.5" /> New
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Flow arrows */}
                    <div>
                      <Label className="text-[10px] mb-1.5 flex items-center gap-1.5 block">
                        <ArrowRight className="w-3 h-3 text-indigo-400" /> Flow Arrows
                        <span className="ml-auto font-normal text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400/70 border border-indigo-500/20">
                          👁 visual only
                        </span>
                      </Label>
                      <div className="flex items-center gap-1.5">
                        <Select value={stepConnTarget} onValueChange={setStepConnTarget}>
                          <SelectTrigger className="flex-1 text-[10px] h-7">
                            <SelectValue placeholder="Connect to…" />
                          </SelectTrigger>
                          <SelectContent>
                            {active.steps
                              .filter((s) => s.id !== selectedStep.id)
                              .map((s) => {
                                const m = ACTIONS.find((a) => a.id === s.action)!;
                                return (
                                  <SelectItem key={s.id} value={s.id}>
                                    {m.icon} {s.description}
                                  </SelectItem>
                                );
                              })}
                          </SelectContent>
                        </Select>
                        <button
                          disabled={!stepConnTarget}
                          onClick={() => {
                            addCustomEdge(selectedStep.id, stepConnTarget);
                            setStepConnTarget('');
                          }}
                          className="flex-shrink-0 flex items-center gap-1 text-[10px] px-2 py-1 h-7 rounded-md border border-indigo-500/30 text-indigo-400 bg-indigo-500/5 hover:bg-indigo-500/10 transition-colors disabled:opacity-30">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Post-step delay */}
                    <div>
                      <Label className="text-[10px] mb-1 block flex items-center gap-1">
                        <Timer className="w-3 h-3 text-purple-400" /> Delay after step (ms)
                      </Label>
                      <Input
                        value={selectedStep.timeoutMs}
                        onChange={(e) => patchStep(selectedStep.id, { timeoutMs: e.target.value })}
                        className="text-xs h-7 w-28"
                        type="number"
                        min="0"
                        step="100"
                        placeholder="0"
                      />
                    </div>

                    {/* Contract / function pickers */}
                    {(selectedStep.action === 'call' ||
                      selectedStep.action === 'send' ||
                      selectedStep.action === 'assert_revert') && (
                      <>
                        <div>
                          <Label className="text-[10px] mb-1 block">Contract</Label>
                          <Select
                            value={selectedStep.contractAddress}
                            onValueChange={(v) => {
                              const dc = deployedContracts.find((c) => c.address === v);
                              patchStep(selectedStep.id, {
                                contractAddress: v,
                                contractName: dc?.name || '',
                                functionName: '',
                              });
                            }}>
                            <SelectTrigger className="text-xs h-7">
                              <SelectValue placeholder="Select contract…" />
                            </SelectTrigger>
                            <SelectContent>
                              {deployedContracts.length === 0 ? (
                                <SelectItem value="__none" disabled>
                                  No deployed contracts
                                </SelectItem>
                              ) : (
                                deployedContracts.map((c) => (
                                  <SelectItem key={c.id} value={c.address}>
                                    {c.name}{' '}
                                    <span className="text-muted-foreground/50 font-mono text-[9px]">
                                      ({c.address.slice(0, 8)}…)
                                    </span>
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-[10px] mb-1 block">Function</Label>
                          <Select
                            value={selectedStep.functionName}
                            onValueChange={(v) => patchStep(selectedStep.id, { functionName: v })}>
                            <SelectTrigger className="text-xs h-7">
                              <SelectValue placeholder="Select function…" />
                            </SelectTrigger>
                            <SelectContent>
                              {(selectedStep.action === 'call'
                                ? getFns(
                                    selectedStep.contractAddress,
                                    selectedStep.contractName,
                                    'read',
                                  )
                                : getFns(
                                    selectedStep.contractAddress,
                                    selectedStep.contractName,
                                    'write',
                                  )
                              ).map((fn) => (
                                <SelectItem key={fn.name} value={fn.name}>
                                  {fn.name}({fn.inputs})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-[10px] mb-1 block">
                            Args <span className="text-muted-foreground/40">(comma-separated)</span>
                          </Label>
                          <Input
                            value={selectedStep.args}
                            onChange={(e) => patchStep(selectedStep.id, { args: e.target.value })}
                            className="font-mono text-xs h-7"
                            placeholder="arg1, arg2…"
                          />
                        </div>
                        {selectedStep.action === 'send' && (
                          <div>
                            <Label className="text-[10px] mb-1 block">Value (ETH)</Label>
                            <Input
                              value={selectedStep.value}
                              onChange={(e) =>
                                patchStep(selectedStep.id, { value: e.target.value })
                              }
                              className="text-xs h-7 w-28"
                              type="number"
                              min="0"
                              step="0.001"
                            />
                          </div>
                        )}
                      </>
                    )}

                    {/* Assert */}
                    {selectedStep.action === 'assert' && (
                      <>
                        <div>
                          <Label className="text-[10px] mb-1 block">Contract</Label>
                          <Select
                            value={selectedStep.assertContract}
                            onValueChange={(v) =>
                              patchStep(selectedStep.id, { assertContract: v, assertFn: '' })
                            }>
                            <SelectTrigger className="text-xs h-7">
                              <SelectValue placeholder="Select contract…" />
                            </SelectTrigger>
                            <SelectContent>
                              {deployedContracts.map((c) => (
                                <SelectItem key={c.id} value={c.address}>
                                  {c.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-[10px] mb-1 block">Function</Label>
                          <Select
                            value={selectedStep.assertFn}
                            onValueChange={(v) => patchStep(selectedStep.id, { assertFn: v })}>
                            <SelectTrigger className="text-xs h-7">
                              <SelectValue placeholder="Read function…" />
                            </SelectTrigger>
                            <SelectContent>
                              {getFns(selectedStep.assertContract, '', 'read').map((fn) => (
                                <SelectItem key={fn.name} value={fn.name}>
                                  {fn.name}()
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-[10px] mb-1 block">Operator</Label>
                          <Select
                            value={selectedStep.assertOperator}
                            onValueChange={(v) =>
                              patchStep(selectedStep.id, { assertOperator: v as any })
                            }>
                            <SelectTrigger className="text-xs h-7">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[
                                { v: 'eq', l: '= equal' },
                                { v: 'gt', l: '> greater than' },
                                { v: 'lt', l: '< less than' },
                                { v: 'gte', l: '≥ gte' },
                                { v: 'lte', l: '≤ lte' },
                                { v: 'includes', l: '⊃ includes' },
                              ].map((op) => (
                                <SelectItem key={op.v} value={op.v}>
                                  {op.l}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-[10px] mb-1 block">Expected value</Label>
                          <Input
                            value={selectedStep.assertExpected}
                            onChange={(e) =>
                              patchStep(selectedStep.id, { assertExpected: e.target.value })
                            }
                            className="font-mono text-xs h-7"
                            placeholder="42, true, 0x…"
                          />
                        </div>
                      </>
                    )}

                    {/* Action-specific fields */}
                    {selectedStep.action === 'assert_revert' && (
                      <div>
                        <Label className="text-[10px] mb-1 block">
                          Expected revert msg{' '}
                          <span className="text-muted-foreground/40">(optional)</span>
                        </Label>
                        <Input
                          value={selectedStep.expectedRevertMsg}
                          onChange={(e) =>
                            patchStep(selectedStep.id, { expectedRevertMsg: e.target.value })
                          }
                          className="font-mono text-xs h-7"
                          placeholder="Ownable: not owner"
                        />
                      </div>
                    )}
                    {selectedStep.action === 'wait' && (
                      <div>
                        <Label className="text-[10px] mb-1 block">Blocks to mine</Label>
                        <Input
                          value={selectedStep.blocks}
                          onChange={(e) => patchStep(selectedStep.id, { blocks: e.target.value })}
                          className="w-24 text-xs h-7"
                          type="number"
                          min="1"
                        />
                      </div>
                    )}
                    {selectedStep.action === 'timeout' && (
                      <div>
                        <Label className="text-[10px] mb-1 block">Sleep duration (ms)</Label>
                        <Input
                          value={selectedStep.timeoutMs}
                          onChange={(e) =>
                            patchStep(selectedStep.id, { timeoutMs: e.target.value })
                          }
                          className="w-32 text-xs h-7"
                          type="number"
                          min="0"
                          step="100"
                        />
                      </div>
                    )}
                    {selectedStep.action === 'revert' && (
                      <div>
                        <Label className="text-[10px] mb-1 block">Snapshot ID</Label>
                        <Input
                          value={selectedStep.message}
                          onChange={(e) => patchStep(selectedStep.id, { message: e.target.value })}
                          className="font-mono text-xs h-7"
                          placeholder="0x1"
                        />
                      </div>
                    )}
                    {selectedStep.action === 'impersonate' && (
                      <div>
                        <Label className="text-[10px] mb-1 block">Address to impersonate</Label>
                        <Input
                          value={selectedStep.impersonateAddr}
                          onChange={(e) =>
                            patchStep(selectedStep.id, { impersonateAddr: e.target.value })
                          }
                          className="font-mono text-xs h-7"
                          placeholder="0x…"
                        />
                      </div>
                    )}
                    {selectedStep.action === 'set_balance' && (
                      <>
                        <div>
                          <Label className="text-[10px] mb-1 block">Address</Label>
                          <Input
                            value={selectedStep.balanceAddr}
                            onChange={(e) =>
                              patchStep(selectedStep.id, { balanceAddr: e.target.value })
                            }
                            className="font-mono text-xs h-7"
                            placeholder="0x…"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] mb-1 block">Balance (ETH)</Label>
                          <Input
                            value={selectedStep.balanceEth}
                            onChange={(e) =>
                              patchStep(selectedStep.id, { balanceEth: e.target.value })
                            }
                            className="w-24 text-xs h-7"
                            type="number"
                            min="0"
                          />
                        </div>
                      </>
                    )}
                    {selectedStep.action === 'log' && (
                      <div>
                        <Label className="text-[10px] mb-1 block">Message</Label>
                        <Input
                          value={selectedStep.message}
                          onChange={(e) => patchStep(selectedStep.id, { message: e.target.value })}
                          className="text-xs h-7"
                          placeholder="Log message…"
                        />
                      </div>
                    )}
                    {selectedStep.action === 'custom_script' && (
                      <MonacoScriptEditor
                        value={selectedStep.script}
                        onChange={(v) => patchStep(selectedStep.id, { script: v })}
                      />
                    )}

                    {/* Result */}
                    {selectedStep.log && (
                      <div
                        className={cn(
                          'rounded-lg border p-2.5 text-[10px] font-mono leading-relaxed break-all',
                          selectedStep.status === 'ok'
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            : 'bg-rose-500/10 border-rose-500/20 text-rose-400',
                        )}>
                        {selectedStep.log}
                        {selectedStep.txHash && (
                          <div className="flex items-center gap-1 mt-1.5 text-blue-400/60">
                            <Hash className="w-3 h-3" />
                            <span className="truncate">{selectedStep.txHash}</span>
                            <button
                              onClick={() => navigator.clipboard.writeText(selectedStep.txHash!)}
                              className="flex-shrink-0 ml-auto hover:text-blue-400">
                              <Copy className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        )}
                        {selectedStep.gasUsed && (
                          <div className="flex items-center gap-1 mt-0.5 text-amber-400/60">
                            <Fuel className="w-3 h-3" />
                            {parseInt(selectedStep.gasUsed).toLocaleString()} gas
                          </div>
                        )}
                      </div>
                    )}

                    <button
                      onClick={() => removeStep(selectedStep.id)}
                      className="w-full flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground/30 hover:text-rose-400 transition-colors py-1.5 rounded border border-transparent hover:border-rose-500/20 hover:bg-rose-500/5">
                      <Trash2 className="w-3 h-3" /> Remove this step
                    </button>
                  </div>
                </ScrollArea>
              </div>
            ) : (
              /* Run log / connections tabs */
              <div className="flex flex-col h-full overflow-hidden">
                <div className="flex flex-shrink-0 border-b border-border">
                  {(['connections', 'log'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setRightTab(tab)}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-[10px] font-medium transition-colors',
                        rightTab === tab
                          ? 'border-b-2 border-indigo-400 text-indigo-400'
                          : 'text-muted-foreground/40 hover:text-muted-foreground',
                      )}>
                      {tab === 'connections' ? (
                        <>
                          <ArrowRight className="w-3 h-3" /> Flow Arrows
                        </>
                      ) : (
                        <>
                          <Terminal className="w-3 h-3 text-emerald-400" /> Run Log
                        </>
                      )}
                    </button>
                  ))}
                </div>

                {rightTab === 'connections' && (
                  <div className="flex flex-col flex-1 overflow-hidden">
                    <div className="p-3 space-y-2 border-b border-border">
                      <div className="flex items-center gap-1.5">
                        <Select value={newConnSrc} onValueChange={setNewConnSrc}>
                          <SelectTrigger className="flex-1 text-[10px] h-7">
                            <SelectValue placeholder="From…" />
                          </SelectTrigger>
                          <SelectContent>
                            {active.steps.map((s) => {
                              const m = ACTIONS.find((a) => a.id === s.action)!;
                              return (
                                <SelectItem key={s.id} value={s.id}>
                                  {m.icon} {s.description}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        <ArrowRight className="flex-shrink-0 w-3 h-3 text-muted-foreground/30" />
                        <Select value={newConnTgt} onValueChange={setNewConnTgt}>
                          <SelectTrigger className="flex-1 text-[10px] h-7">
                            <SelectValue placeholder="To…" />
                          </SelectTrigger>
                          <SelectContent>
                            {active.steps
                              .filter((s) => s.id !== newConnSrc)
                              .map((s) => {
                                const m = ACTIONS.find((a) => a.id === s.action)!;
                                return (
                                  <SelectItem key={s.id} value={s.id}>
                                    {m.icon} {s.description}
                                  </SelectItem>
                                );
                              })}
                          </SelectContent>
                        </Select>
                      </div>
                      <button
                        disabled={!newConnSrc || !newConnTgt}
                        onClick={() => {
                          addCustomEdge(newConnSrc, newConnTgt);
                          setNewConnSrc('');
                          setNewConnTgt('');
                        }}
                        className="w-full flex items-center justify-center gap-1.5 text-[10px] py-1.5 rounded-lg border border-indigo-500/30 text-indigo-400 bg-indigo-500/5 hover:bg-indigo-500/10 transition-colors disabled:opacity-30">
                        <Plus className="w-3 h-3" /> Add Arrow
                      </button>
                    </div>
                    <ScrollArea className="flex-1 overflow-y-auto">
                      <div className="p-2 space-y-1">
                        {!active.customEdges?.length ? (
                          <p className="text-center text-[10px] text-muted-foreground/25 py-8">
                            No flow arrows yet
                          </p>
                        ) : (
                          (active.customEdges || []).map((ce) => {
                            const srcStep = active.steps.find((s) => s.id === ce.source);
                            const tgtStep = active.steps.find((s) => s.id === ce.target);
                            const srcMeta = srcStep
                              ? ACTIONS.find((a) => a.id === srcStep.action)
                              : null;
                            const tgtMeta = tgtStep
                              ? ACTIONS.find((a) => a.id === tgtStep.action)
                              : null;
                            return (
                              <div
                                key={ce.id}
                                className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-indigo-500/5 border border-indigo-500/15 group">
                                <div className="flex-1 min-w-0 text-[10px] font-mono">
                                  <span style={{ color: srcMeta?.color || '#94a3b8' }}>
                                    {srcMeta?.icon} {srcStep?.description || ce.source.slice(0, 8)}
                                  </span>
                                  <span className="mx-1 text-muted-foreground/30">→</span>
                                  <span style={{ color: tgtMeta?.color || '#94a3b8' }}>
                                    {tgtMeta?.icon} {tgtStep?.description || ce.target.slice(0, 8)}
                                  </span>
                                </div>
                                <button
                                  onClick={() => removeCustomEdge(ce.id)}
                                  className="transition-all opacity-0 group-hover:opacity-100 text-muted-foreground/20 hover:text-rose-400">
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {rightTab === 'log' && (
                  <ScrollArea className="flex-1 overflow-y-auto">
                    <div className="p-2 space-y-0.5">
                      {runLogs.length === 0 ? (
                        <p className="text-center text-[10px] text-muted-foreground/25 py-10">
                          {active.steps.length > 0 ? 'Click Run to execute' : 'Add steps first'}
                        </p>
                      ) : (
                        runLogs.map((log, i) => {
                          const step = active.steps.find((s) => s.id === log.stepId);
                          const meta = step ? ACTIONS.find((a) => a.id === step.action) : null;
                          const pgColor = step?.parallelGroup
                            ? GROUP_COLORS[step.parallelGroup]
                            : null;
                          return (
                            <div
                              key={`log-${i}`}
                              className={cn(
                                'rounded-lg px-2.5 py-2 text-[10px] break-all cursor-pointer transition-colors',
                                log.status === 'ok'
                                  ? 'bg-emerald-500/8 text-emerald-400 hover:bg-emerald-500/12'
                                  : log.status === 'error'
                                    ? 'bg-rose-500/8 text-rose-400 hover:bg-rose-500/12'
                                    : log.status === 'running'
                                      ? 'bg-amber-500/8 text-amber-400'
                                      : 'text-muted-foreground',
                              )}
                              style={pgColor ? { borderLeft: `2px solid ${pgColor.border}55` } : {}}
                              onClick={() => step && setSelectedStepId(step.id)}>
                              <div className="flex items-start gap-1.5">
                                {log.status === 'ok' && (
                                  <CheckCircle2 className="w-3 h-3 flex-shrink-0 mt-0.5" />
                                )}
                                {log.status === 'error' && (
                                  <XCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                                )}
                                {log.status === 'running' && (
                                  <RefreshCw className="w-3 h-3 flex-shrink-0 mt-0.5 animate-spin" />
                                )}
                                <div className="flex-1 min-w-0">
                                  {meta && (
                                    <span className="text-[9px] font-mono opacity-50 mr-1">
                                      {meta.icon} {step?.description}
                                    </span>
                                  )}
                                  <div className="font-mono leading-relaxed">{log.message}</div>
                                  {log.duration && (
                                    <div className="text-[9px] opacity-40 mt-0.5">
                                      {log.duration}ms
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
