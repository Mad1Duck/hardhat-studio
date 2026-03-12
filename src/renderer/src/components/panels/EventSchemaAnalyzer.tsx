import { useState, useEffect, useRef, useCallback } from 'react';
import { ContractAbi, AbiItem } from '../../types';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/primitives';
import { cn } from '../../lib/utils';
import {
  Radio,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  RefreshCw,
  Upload,
  Copy,
  Check,
  Zap,
  Square,
  Play,
  ChevronDown,
  ChevronRight,
  Clock,
} from 'lucide-react';

interface Props {
  abis: ContractAbi[];
  projectPath: string | null;
  rpcUrl?: string;
  deployedContracts?: { address: string; name: string; abi: AbiItem[] }[];
}

interface EventParam {
  name: string;
  type: string;
  indexed: boolean;
}
interface EventSchema {
  name: string;
  params: EventParam[];
  topic0: string;
}
interface EventDiff {
  type: 'removed' | 'added' | 'param_changed' | 'indexed_changed' | 'topic_changed';
  severity: 'critical' | 'warning' | 'info';
  eventName: string;
  detail: string;
}

//  Live events
interface LiveEvent {
  id: string;
  contractName: string;
  contractAddress: string;
  eventName: string;
  blockNumber: number;
  txHash: string;
  logIndex: number;
  args: Record<string, string>;
  timestamp: number;
  raw: unknown;
}

function buildEventSig(item: AbiItem): string {
  const inputs = (item.inputs || []).map((i: any) => i.type).join(',');
  return `${item.name}(${inputs})`;
}

function buildEventSchema(abi: AbiItem[]): EventSchema[] {
  return abi
    .filter((i) => i.type === 'event')
    .map((ev) => ({
      name: ev.name || '',
      params: (ev.inputs || []).map((i: any) => ({
        name: i.name,
        type: i.type,
        indexed: !!i.indexed,
      })),
      topic0: `keccak256("${buildEventSig(ev)}")`,
    }));
}

function diffEventSchemas(oldSchemas: EventSchema[], newSchemas: EventSchema[]): EventDiff[] {
  const diffs: EventDiff[] = [];
  const oldMap = new Map(oldSchemas.map((e) => [e.name, e]));
  const newMap = new Map(newSchemas.map((e) => [e.name, e]));

  for (const [name] of oldMap) {
    if (!newMap.has(name)) {
      diffs.push({
        type: 'removed',
        severity: 'critical',
        eventName: name,
        detail: `Event "${name}" was removed. Indexers and frontends relying on this event will break.`,
      });
    }
  }
  for (const [name] of newMap) {
    if (!oldMap.has(name)) {
      diffs.push({
        type: 'added',
        severity: 'info',
        eventName: name,
        detail: `Event "${name}" is new. Update indexer/frontend to handle it.`,
      });
    }
  }
  for (const [name, oldEv] of oldMap) {
    const newEv = newMap.get(name);
    if (!newEv) continue;
    if (oldEv.params.length !== newEv.params.length) {
      diffs.push({
        type: 'param_changed',
        severity: 'critical',
        eventName: name,
        detail: `Parameter count changed ${oldEv.params.length} → ${newEv.params.length}. topic0 will differ.`,
      });
      continue;
    }
    oldEv.params.forEach((op, idx) => {
      const np = newEv.params[idx];
      if (!np) return;
      if (op.type !== np.type) {
        diffs.push({
          type: 'param_changed',
          severity: 'critical',
          eventName: name,
          detail: `Param #${idx + 1} ("${op.name}") type: ${op.type} → ${np.type}. topic0 hash changed.`,
        });
      } else if (op.indexed !== np.indexed) {
        diffs.push({
          type: 'indexed_changed',
          severity: 'warning',
          eventName: name,
          detail: `Param "${op.name}" indexed: ${op.indexed} → ${np.indexed}. Filter queries may break.`,
        });
      } else if (op.name !== np.name) {
        diffs.push({
          type: 'param_changed',
          severity: 'info',
          eventName: name,
          detail: `Param #${idx + 1} renamed: "${op.name}" → "${np.name}". Update frontend decoding.`,
        });
      }
    });
  }
  return diffs;
}

//  Decode log args from ABI
function decodeLogArgs(log: any, eventItem: AbiItem): Record<string, string> {
  const args: Record<string, string> = {};
  const inputs = eventItem.inputs || [];
  let dataIdx = 0;
  inputs.forEach((inp: any, i: number) => {
    if (inp.indexed) {
      const topic =
        log.topics[
          1 + inputs.filter((_: any, j: number) => j < i && (inputs[j] as any).indexed).length
        ];
      args[inp.name || `param${i}`] = topic || '?';
    } else {
      const data = (log.data || '').replace('0x', '');
      const chunk = data.slice(dataIdx * 64, (dataIdx + 1) * 64);
      args[inp.name || `param${i}`] = chunk ? `0x${chunk}` : '?';
      dataIdx++;
    }
  });
  return args;
}

function getEventTopic0(item: AbiItem): string {
  return buildEventSig(item);
}

export default function EventSchemaAnalyzer({
  abis,
  projectPath,
  rpcUrl = 'http://127.0.0.1:8545',
  deployedContracts = [],
}: Props) {
  const [selectedAbi, setSelectedAbi] = useState<ContractAbi | null>(null);
  const [oldAbiJson, setOldAbiJson] = useState('');
  const [diffs, setDiffs] = useState<EventDiff[] | null>(null);
  const [currentSchemas, setCurrentSchemas] = useState<EventSchema[]>([]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [tab, setTab] = useState<'schema' | 'diff' | 'live'>('schema');

  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [lastBlock, setLastBlock] = useState<number | null>(null);
  const [listenError, setListenError] = useState<string | null>(null);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [watchedContracts, setWatchedContracts] = useState<Set<string>>(new Set());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fromBlockRef = useRef<number | null>(null);

  useEffect(() => {
    if (abis.length > 0 && !selectedAbi) setSelectedAbi(abis[0]);
  }, [abis]);

  useEffect(() => {
    if (selectedAbi) {
      setCurrentSchemas(buildEventSchema(selectedAbi.abi));
      setDiffs(null);
      setOldAbiJson('');
    }
  }, [selectedAbi]);

  useEffect(() => {
    if (deployedContracts.length > 0 && watchedContracts.size === 0) {
      setWatchedContracts(new Set(deployedContracts.map((c) => c.address.toLowerCase())));
    }
  }, [deployedContracts]);

  const buildEventMap = useCallback(() => {
    const map = new Map<
      string,
      { item: AbiItem; contractName: string; contractAddress: string }[]
    >();
    deployedContracts.forEach((c) => {
      if (!watchedContracts.has(c.address.toLowerCase())) return;
      const abi = c.abi || abis.find((a) => a.contractName === c.name)?.abi || [];
      abi
        .filter((i: AbiItem) => i.type === 'event')
        .forEach((ev: AbiItem) => {
          const sig = buildEventSig(ev);
          if (!map.has(sig)) map.set(sig, []);
          map.get(sig)!.push({ item: ev, contractName: c.name, contractAddress: c.address });
        });
    });
    if (selectedAbi) {
      selectedAbi.abi
        .filter((i: AbiItem) => i.type === 'event')
        .forEach((ev) => {
          const sig = buildEventSig(ev);
          if (!map.has(sig)) map.set(sig, []);
          const exists = map.get(sig)!.some((e) => e.contractName === selectedAbi.contractName);
          if (!exists) {
            map
              .get(sig)!
              .push({ item: ev, contractName: selectedAbi.contractName, contractAddress: '—' });
          }
        });
    }
    return map;
  }, [deployedContracts, watchedContracts, abis, selectedAbi]);

  const rpcCall = useCallback(
    async (method: string, params: unknown[]) => {
      const res = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      return json.result;
    },
    [rpcUrl],
  );

  const pollLogs = useCallback(async () => {
    try {
      const blockHex: string = await rpcCall('eth_blockNumber', []);
      const currentBlock = parseInt(blockHex, 16);
      setLastBlock(currentBlock);

      if (fromBlockRef.current === null) {
        fromBlockRef.current = currentBlock;
        return;
      }

      if (currentBlock < fromBlockRef.current) return;

      const addresses = deployedContracts
        .filter((c) => watchedContracts.has(c.address.toLowerCase()))
        .map((c) => c.address);

      const filter: any = {
        fromBlock: `0x${fromBlockRef.current.toString(16)}`,
        toBlock: `0x${currentBlock.toString(16)}`,
      };
      if (addresses.length > 0) filter.address = addresses;

      const logs: any[] = await rpcCall('eth_getLogs', [filter]);
      fromBlockRef.current = currentBlock + 1;

      if (!logs.length) return;

      const eventMap = buildEventMap();
      const newEvents: LiveEvent[] = [];

      for (const log of logs) {
        const topic0 = log.topics?.[0];
        if (!topic0) continue;

        let matched = false;
        for (const [sig, entries] of eventMap) {
          for (const entry of entries) {
            const addrMatch =
              entry.contractAddress === '—' ||
              entry.contractAddress.toLowerCase() === log.address?.toLowerCase();
            if (!addrMatch) continue;

            const args = decodeLogArgs(log, entry.item);
            newEvents.push({
              id: `${log.transactionHash}-${log.logIndex}`,
              contractName: entry.contractName,
              contractAddress: log.address || '—',
              eventName: entry.item.name || 'Unknown',
              blockNumber: parseInt(log.blockNumber, 16),
              txHash: log.transactionHash || '',
              logIndex: parseInt(log.logIndex, 16),
              args,
              timestamp: Date.now(),
              raw: log,
            });
            matched = true;
            break;
          }
          if (matched) break;
        }

        if (!matched) {
          newEvents.push({
            id: `${log.transactionHash}-${log.logIndex}`,
            contractName: '?',
            contractAddress: log.address || '—',
            eventName: `topic0: ${topic0.slice(0, 10)}…`,
            blockNumber: parseInt(log.blockNumber, 16),
            txHash: log.transactionHash || '',
            logIndex: parseInt(log.logIndex, 16),
            args: {},
            timestamp: Date.now(),
            raw: log,
          });
        }
      }

      if (newEvents.length > 0) {
        setLiveEvents((prev) => [...newEvents.reverse(), ...prev].slice(0, 200));
      }

      setListenError(null);
    } catch (e) {
      setListenError(String(e));
    }
  }, [rpcCall, buildEventMap, deployedContracts, watchedContracts]);

  const startListening = useCallback(async () => {
    fromBlockRef.current = null;
    setLiveEvents([]);
    setListenError(null);
    setIsListening(true);
    await pollLogs();
    pollRef.current = setInterval(pollLogs, 2000);
  }, [pollLogs]);

  const stopListening = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setIsListening(false);
  }, []);

  useEffect(
    () => () => {
      if (pollRef.current) clearInterval(pollRef.current);
    },
    [],
  );

  const loadOldAbiFromFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const abi = Array.isArray(parsed) ? parsed : parsed.abi || parsed;
        setOldAbiJson(JSON.stringify(Array.isArray(abi) ? abi : [], null, 2));
        setDiffs(null);
      } catch {
        alert('Invalid JSON file');
      }
    };
    input.click();
  };

  const runDiff = () => {
    if (!selectedAbi || !oldAbiJson.trim()) return;
    try {
      const oldAbi: AbiItem[] = JSON.parse(oldAbiJson);
      const oldSchemas = buildEventSchema(oldAbi);
      const newSchemas = buildEventSchema(selectedAbi.abi);
      setDiffs(diffEventSchemas(oldSchemas, newSchemas));
      setTab('diff');
    } catch {
      alert('Invalid JSON in old ABI field');
    }
  };

  const severityIcon = (s: EventDiff['severity']) => {
    if (s === 'critical') return <XCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />;
    if (s === 'warning')
      return <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />;
    return <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />;
  };

  const severityBorder = (s: EventDiff['severity']) =>
    ({
      critical: 'border-rose-500/30 bg-rose-500/5',
      warning: 'border-amber-500/30 bg-amber-500/5',
      info: 'border-blue-500/30 bg-blue-500/5',
    })[s];

  const copyTopic0 = async (schema: EventSchema, idx: number) => {
    await navigator.clipboard.writeText(schema.topic0);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const criticals = diffs?.filter((d) => d.severity === 'critical').length || 0;
  const warnings = diffs?.filter((d) => d.severity === 'warning').length || 0;

  const TABS = [
    { key: 'schema', label: 'Current Schema', badge: '' },
    { key: 'diff', label: 'Diff', badge: diffs && diffs.length > 0 ? diffs.length : null },
    {
      key: 'live',
      label: 'Live Events',
      badge: liveEvents.length > 0 ? liveEvents.length : null,
      live: isListening,
    },
  ] as const;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card">
        <Radio className="w-4 h-4 text-violet-400" />
        <span className="text-sm font-semibold">Event Schema Analyzer</span>
        <span className="text-[10px] bg-violet-500/10 text-violet-400 px-1.5 py-0.5 rounded">
          Indexer compatibility
        </span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left config */}
        <div className="flex flex-col flex-shrink-0 w-64 overflow-y-auto border-r border-border bg-card/50">
          {/* Contract select */}
          <div className="p-3 space-y-2 border-b border-border">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              Current Contract ABI
            </label>
            <select
              value={selectedAbi?.path || ''}
              onChange={(e) => setSelectedAbi(abis.find((a) => a.path === e.target.value) || null)}
              className="w-full px-2 text-xs border rounded outline-none h-7 bg-background border-border">
              <option value="">Select contract…</option>
              {abis.map((a) => (
                <option key={a.path} value={a.path}>
                  {a.contractName}
                </option>
              ))}
            </select>
          </div>

          {/* Old ABI for diff */}
          <div className="flex-1 p-3 space-y-2 border-b border-border">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                Old ABI (for diff)
              </label>
              <button
                onClick={loadOldAbiFromFile}
                className="flex items-center gap-1 text-[10px] text-sky-400 hover:text-sky-300 transition-colors">
                <Upload className="w-2.5 h-2.5" /> File
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground/40">
              Paste or load the previous version's ABI JSON
            </p>
            <textarea
              value={oldAbiJson}
              onChange={(e) => setOldAbiJson(e.target.value)}
              placeholder='[{"type":"event","name":"Transfer",...}]'
              className="w-full h-36 resize-none rounded border border-border bg-background p-2 text-[10px] font-mono text-muted-foreground/70 outline-none focus:border-violet-500/30"
            />
            <Button
              size="sm"
              className="w-full h-7 text-xs bg-violet-600 hover:bg-violet-500 gap-1.5"
              onClick={runDiff}
              disabled={!selectedAbi || !oldAbiJson.trim()}>
              <RefreshCw className="w-3 h-3" /> Compare ABIs
            </Button>
          </div>

          {/* Diff summary */}
          {diffs !== null && (
            <div className="p-3 space-y-2 border-b border-border">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                Diff Summary
              </label>
              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-rose-400">Critical</span>
                  <span className="font-mono text-rose-400">{criticals}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-amber-400">Warnings</span>
                  <span className="font-mono text-amber-400">{warnings}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-blue-400">Info</span>
                  <span className="font-mono text-blue-400">
                    {diffs.length - criticals - warnings}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Live events config */}
          <div className="p-3 space-y-2">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              Live Event Monitor
            </label>
            <div className="text-[10px] text-muted-foreground/40 font-mono truncate">{rpcUrl}</div>
            {lastBlock && (
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50">
                <Clock className="w-2.5 h-2.5" />
                Block #{lastBlock}
              </div>
            )}

            {/* Contract watch toggles */}
            {deployedContracts.length > 0 && (
              <div className="space-y-1 overflow-y-auto max-h-28">
                {deployedContracts.map((c) => (
                  <label key={c.address} className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={watchedContracts.has(c.address.toLowerCase())}
                      onChange={(e) => {
                        const next = new Set(watchedContracts);
                        if (e.target.checked) next.add(c.address.toLowerCase());
                        else next.delete(c.address.toLowerCase());
                        setWatchedContracts(next);
                      }}
                      className="w-3 h-3 accent-violet-500"
                    />
                    <span className="text-[10px] text-muted-foreground group-hover:text-foreground truncate">
                      {c.name}
                    </span>
                  </label>
                ))}
              </div>
            )}

            <Button
              size="sm"
              className={cn(
                'w-full h-7 text-xs gap-1.5 border-0',
                isListening
                  ? 'bg-rose-700 hover:bg-rose-600 text-white'
                  : 'bg-emerald-700 hover:bg-emerald-600 text-white',
              )}
              onClick={() => {
                if (isListening) {
                  stopListening();
                } else {
                  startListening();
                  setTab('live');
                }
              }}>
              {isListening ? (
                <>
                  <Square className="w-3 h-3" /> Stop
                </>
              ) : (
                <>
                  <Play className="w-3 h-3" /> Start Listening
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Right: tabs */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Tab bar */}
          <div className="flex items-center gap-0 border-b border-border bg-card/50">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-all',
                  tab === t.key
                    ? 'border-violet-500 text-violet-400'
                    : 'border-transparent text-muted-foreground/50 hover:text-muted-foreground',
                )}>
                {t.label}
                {'live' in t && t.live && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                )}
                {t.badge != null && (
                  <span
                    className={cn(
                      'px-1.5 py-0.5 rounded-full text-[9px] font-bold',
                      t.key === 'live'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-rose-500/20 text-rose-400',
                    )}>
                    {t.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          <ScrollArea className="flex-1 overflow-y-auto">
            {/*  SCHEMA TAB  */}
            {tab === 'schema' && (
              <div className="p-4 space-y-3">
                {!selectedAbi ? (
                  <div className="py-10 text-sm text-center text-muted-foreground/30">
                    Select a contract
                  </div>
                ) : currentSchemas.length === 0 ? (
                  <div className="py-10 text-sm text-center text-muted-foreground/30">
                    No events found in this ABI
                  </div>
                ) : (
                  currentSchemas.map((ev, idx) => (
                    <div
                      key={ev.name}
                      className="p-3 space-y-2 border rounded-lg border-border bg-card">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Radio className="w-3.5 h-3.5 text-violet-400" />
                          <span className="font-mono text-sm font-semibold">{ev.name}</span>
                        </div>
                        <button
                          onClick={() => copyTopic0(ev, idx)}
                          className="flex items-center gap-1 text-[10px] text-muted-foreground/40 hover:text-muted-foreground">
                          {copiedIdx === idx ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          topic0
                        </button>
                      </div>
                      <div className="space-y-1">
                        {ev.params.length === 0 ? (
                          <span className="text-[10px] text-muted-foreground/30 italic">
                            No parameters
                          </span>
                        ) : (
                          ev.params.map((p, pi) => (
                            <div key={pi} className="flex items-center gap-2 text-[11px] font-mono">
                              <span className="text-[10px] text-muted-foreground/30 w-4">{pi}</span>
                              {p.indexed && (
                                <span className="px-1 rounded bg-blue-500/10 text-blue-400 text-[9px]">
                                  indexed
                                </span>
                              )}
                              <span className="text-amber-300/70">{p.type}</span>
                              <span className="text-muted-foreground/60">{p.name}</span>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="mt-1 px-2 py-1 bg-muted/20 rounded text-[9px] font-mono text-muted-foreground/40 truncate">
                        {ev.name}(
                        {ev.params
                          .map((p) => `${p.indexed ? 'indexed ' : ''}${p.type} ${p.name}`)
                          .join(', ')}
                        )
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/*  DIFF TAB  */}
            {tab === 'diff' && (
              <div className="p-4 space-y-2">
                {diffs === null ? (
                  <div className="py-10 text-sm text-center text-muted-foreground/30">
                    Paste an old ABI and click Compare
                  </div>
                ) : diffs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-12">
                    <CheckCircle2 className="w-10 h-10 text-emerald-400/60" />
                    <p className="text-sm text-emerald-400">No event schema changes detected</p>
                    <p className="text-[11px] text-muted-foreground/40">
                      All events are backward compatible
                    </p>
                  </div>
                ) : (
                  diffs.map((diff, i) => (
                    <div
                      key={i}
                      className={cn(
                        'rounded-lg border p-3 flex items-start gap-3',
                        severityBorder(diff.severity),
                      )}>
                      {severityIcon(diff.severity)}
                      <div className="space-y-0.5 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold">{diff.eventName}</span>
                          <span
                            className={cn('text-[9px] uppercase font-semibold px-1.5 rounded', {
                              'bg-rose-500/20 text-rose-400': diff.type === 'removed',
                              'bg-emerald-500/20 text-emerald-400': diff.type === 'added',
                              'bg-amber-500/20 text-amber-400': diff.type.includes('changed'),
                            })}>
                            {diff.type.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-[11px] opacity-80">{diff.detail}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/*  LIVE EVENTS TAB  */}
            {tab === 'live' && (
              <div className="p-3 space-y-2">
                {listenError && (
                  <div className="flex items-center gap-2 p-3 text-xs text-red-400 border rounded-lg bg-red-500/5 border-red-500/20">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    {listenError}
                  </div>
                )}

                {!isListening && liveEvents.length === 0 && (
                  <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                    <Zap className="w-12 h-12 text-muted-foreground/20" />
                    <p className="text-sm text-muted-foreground/40">
                      Click <strong>Start Listening</strong> to capture live contract events
                    </p>
                    <p className="text-[10px] text-muted-foreground/30">
                      Polls `eth_getLogs` every 2s
                    </p>
                  </div>
                )}

                {liveEvents.length > 0 && (
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-muted-foreground/50">
                      {liveEvents.length} event{liveEvents.length !== 1 ? 's' : ''} captured
                    </span>
                    <button
                      onClick={() => setLiveEvents([])}
                      className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground transition-colors">
                      Clear
                    </button>
                  </div>
                )}

                {liveEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="overflow-hidden border rounded-lg border-border bg-card">
                    <button
                      className="flex items-center w-full gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/20"
                      onClick={() => setExpandedEvent(expandedEvent === ev.id ? null : ev.id)}>
                      <Zap className="w-3 h-3 text-violet-400 shrink-0" />
                      <span className="flex-1 font-mono text-xs font-semibold text-foreground">
                        {ev.eventName}
                      </span>
                      <span className="text-[10px] text-muted-foreground/50 shrink-0">
                        {ev.contractName}
                      </span>
                      <span className="text-[10px] text-muted-foreground/30 shrink-0">
                        #{ev.blockNumber}
                      </span>
                      {expandedEvent === ev.id ? (
                        <ChevronDown className="w-3 h-3 text-muted-foreground/30 shrink-0" />
                      ) : (
                        <ChevronRight className="w-3 h-3 text-muted-foreground/30 shrink-0" />
                      )}
                    </button>

                    {expandedEvent === ev.id && (
                      <div className="px-3 pb-3 space-y-2 border-t border-border">
                        <div className="grid grid-cols-2 mt-2 gap-x-4 gap-y-1">
                          <div>
                            <p className="text-[9px] text-muted-foreground/40">Contract</p>
                            <p className="font-mono text-[10px] text-foreground truncate">
                              {ev.contractAddress}
                            </p>
                          </div>
                          <div>
                            <p className="text-[9px] text-muted-foreground/40">Block</p>
                            <p className="font-mono text-[10px] text-foreground">
                              #{ev.blockNumber}
                            </p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-[9px] text-muted-foreground/40">Tx Hash</p>
                            <p className="font-mono text-[10px] text-blue-400 truncate">
                              {ev.txHash}
                            </p>
                          </div>
                        </div>

                        {Object.keys(ev.args).length > 0 && (
                          <div className="space-y-1">
                            <p className="text-[9px] text-muted-foreground/40 uppercase tracking-widest">
                              Args
                            </p>
                            {Object.entries(ev.args).map(([k, v]) => (
                              <div key={k} className="flex items-start gap-2 font-mono text-[10px]">
                                <span className="text-amber-300/60 shrink-0">{k}</span>
                                <span className="break-all text-muted-foreground/70">{v}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
