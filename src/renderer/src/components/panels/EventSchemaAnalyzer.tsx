import { useState, useEffect } from 'react'
import { ContractAbi, AbiItem } from '../../types'
import { Button } from '../ui/button'
import { ScrollArea } from '../ui/primitives'
import { cn } from '../../lib/utils'
import { Radio, AlertTriangle, CheckCircle2, XCircle, Info, RefreshCw, Upload, Copy, Check } from 'lucide-react'

interface Props {
  abis: ContractAbi[]
  projectPath: string | null
}

interface EventParam { name: string; type: string; indexed: boolean }
interface EventSchema { name: string; params: EventParam[]; topic0: string }
interface EventDiff {
  type: 'removed' | 'added' | 'param_changed' | 'indexed_changed' | 'topic_changed'
  severity: 'critical' | 'warning' | 'info'
  eventName: string
  detail: string
}

function buildEventSchema(abi: AbiItem[]): EventSchema[] {
  return abi.filter(i => i.type === 'event').map(ev => ({
    name: ev.name || '',
    params: (ev.inputs || []).map(i => ({ name: i.name, type: i.type, indexed: !!(i as any).indexed })),
    topic0: computeTopic0Sig(ev.name || '', ev.inputs || []),
  }))
}

function computeTopic0Sig(name: string, inputs: any[]): string {
  const sig = `${name}(${inputs.map(i => i.type).join(',')})`
  // Simplified representation since we can't run keccak256 in browser without lib
  return `keccak256("${sig}")`
}

function diffEventSchemas(oldSchemas: EventSchema[], newSchemas: EventSchema[]): EventDiff[] {
  const diffs: EventDiff[] = []
  const oldMap = new Map(oldSchemas.map(e => [e.name, e]))
  const newMap = new Map(newSchemas.map(e => [e.name, e]))

  // Removed events
  for (const [name, ev] of oldMap) {
    if (!newMap.has(name)) {
      diffs.push({
        type: 'removed', severity: 'critical', eventName: name,
        detail: `Event "${name}" was removed. Indexers and frontends relying on this event will break.`
      })
    }
  }

  // Added events
  for (const [name] of newMap) {
    if (!oldMap.has(name)) {
      diffs.push({
        type: 'added', severity: 'info', eventName: name,
        detail: `Event "${name}" is new. Update indexer/frontend to handle it.`
      })
    }
  }

  // Changed events
  for (const [name, oldEv] of oldMap) {
    const newEv = newMap.get(name)
    if (!newEv) continue

    // Parameter count changed
    if (oldEv.params.length !== newEv.params.length) {
      diffs.push({
        type: 'param_changed', severity: 'critical', eventName: name,
        detail: `Parameter count changed from ${oldEv.params.length} to ${newEv.params.length}. topic0 will be different.`
      })
      continue
    }

    // Check each param
    oldEv.params.forEach((op, idx) => {
      const np = newEv.params[idx]
      if (!np) return
      if (op.type !== np.type) {
        diffs.push({
          type: 'param_changed', severity: 'critical', eventName: name,
          detail: `Param #${idx + 1} ("${op.name}") type changed: ${op.type} → ${np.type}. topic0 hash changed.`
        })
      } else if (op.indexed !== np.indexed) {
        diffs.push({
          type: 'indexed_changed', severity: 'warning', eventName: name,
          detail: `Param "${op.name}" indexed flag changed: ${op.indexed} → ${np.indexed}. Filter queries may break.`
        })
      } else if (op.name !== np.name) {
        diffs.push({
          type: 'param_changed', severity: 'info', eventName: name,
          detail: `Param #${idx + 1} renamed: "${op.name}" → "${np.name}". Update frontend decoding code.`
        })
      }
    })

    // Topic0 check
    if (oldEv.topic0 !== newEv.topic0) {
      const alreadyHas = diffs.some(d => d.eventName === name && d.severity === 'critical')
      if (!alreadyHas) {
        diffs.push({
          type: 'topic_changed', severity: 'critical', eventName: name,
          detail: `Event signature (topic0) changed. All event filters using this event will need updating.`
        })
      }
    }
  }

  return diffs
}

export default function EventSchemaAnalyzer({ abis, projectPath }: Props) {
  const [selectedAbi, setSelectedAbi] = useState<ContractAbi | null>(null)
  const [oldAbiJson, setOldAbiJson] = useState('')
  const [diffs, setDiffs] = useState<EventDiff[] | null>(null)
  const [currentSchemas, setCurrentSchemas] = useState<EventSchema[]>([])
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [tab, setTab] = useState<'schema' | 'diff'>('schema')

  useEffect(() => {
    if (abis.length > 0 && !selectedAbi) setSelectedAbi(abis[0])
  }, [abis])

  useEffect(() => {
    if (selectedAbi) {
      setCurrentSchemas(buildEventSchema(selectedAbi.abi))
      setDiffs(null)
      setOldAbiJson('')
    }
  }, [selectedAbi])

  const runDiff = () => {
    if (!selectedAbi || !oldAbiJson.trim()) return
    try {
      const oldAbi: AbiItem[] = JSON.parse(oldAbiJson)
      const oldSchemas = buildEventSchema(oldAbi)
      const newSchemas = buildEventSchema(selectedAbi.abi)
      setDiffs(diffEventSchemas(oldSchemas, newSchemas))
      setTab('diff')
    } catch {
      alert('Invalid JSON in old ABI field')
    }
  }

  const severityIcon = (s: EventDiff['severity']) => {
    if (s === 'critical') return <XCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0"/>
    if (s === 'warning') return <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0"/>
    return <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0"/>
  }

  const severityLabel = (s: EventDiff['severity']) => {
    if (s === 'critical') return 'bg-rose-500/10 text-rose-400 border-rose-500/20'
    if (s === 'warning') return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
    return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
  }

  const copyTopic0 = async (schema: EventSchema, idx: number) => {
    await navigator.clipboard.writeText(schema.topic0)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 2000)
  }

  const criticals = diffs?.filter(d => d.severity === 'critical').length || 0
  const warnings = diffs?.filter(d => d.severity === 'warning').length || 0

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card">
        <Radio className="w-4 h-4 text-violet-400"/>
        <span className="text-sm font-semibold">Event Schema Analyzer</span>
        <span className="text-[10px] bg-violet-500/10 text-violet-400 px-1.5 py-0.5 rounded">Indexer compatibility</span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: config */}
        <div className="w-64 flex-shrink-0 border-r border-border flex flex-col bg-card/50 overflow-y-auto">
          <div className="p-3 border-b border-border space-y-2">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Current Contract ABI</label>
            <select
              value={selectedAbi?.path || ''}
              onChange={e => setSelectedAbi(abis.find(a => a.path === e.target.value) || null)}
              className="w-full h-7 text-xs bg-background border border-border rounded px-2 outline-none">
              <option value="">Select contract…</option>
              {abis.map(a => <option key={a.path} value={a.path}>{a.contractName}</option>)}
            </select>
          </div>

          {/* Old ABI for diff */}
          <div className="p-3 border-b border-border space-y-2 flex-1">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Old ABI (for diff)</label>
            <p className="text-[10px] text-muted-foreground/40">Paste the previous version's ABI JSON to detect changes</p>
            <textarea
              value={oldAbiJson}
              onChange={e => setOldAbiJson(e.target.value)}
              placeholder='[{"type":"event","name":"Transfer",...}]'
              className="w-full h-36 resize-none rounded border border-border bg-background p-2 text-[10px] font-mono text-muted-foreground/70 outline-none focus:border-violet-500/30"
            />
            <Button
              size="sm"
              className="w-full h-7 text-xs bg-violet-600 hover:bg-violet-500 gap-1.5"
              onClick={runDiff}
              disabled={!selectedAbi || !oldAbiJson.trim()}>
              <RefreshCw className="w-3 h-3"/> Compare ABIs
            </Button>
          </div>

          {/* Summary if diff ran */}
          {diffs !== null && (
            <div className="p-3 space-y-2">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Diff Summary</label>
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
                  <span className="font-mono text-blue-400">{(diffs.length - criticals - warnings)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: schema / diff view */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center gap-0 px-4 border-b border-border bg-card/50">
            <button onClick={() => setTab('schema')}
              className={cn('px-4 py-2.5 text-xs font-medium border-b-2 transition-all',
                tab === 'schema' ? 'border-violet-500 text-violet-400' : 'border-transparent text-muted-foreground/50 hover:text-muted-foreground')}>
              Current Schema
            </button>
            <button onClick={() => setTab('diff')}
              className={cn('px-4 py-2.5 text-xs font-medium border-b-2 transition-all flex items-center gap-1.5',
                tab === 'diff' ? 'border-violet-500 text-violet-400' : 'border-transparent text-muted-foreground/50 hover:text-muted-foreground')}>
              Diff
              {diffs && diffs.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-rose-500/20 text-rose-400">{diffs.length}</span>
              )}
            </button>
          </div>

          <ScrollArea className="flex-1 overflow-y-auto">
            {tab === 'schema' && (
              <div className="p-4 space-y-3">
                {!selectedAbi ? (
                  <div className="text-center py-10 text-muted-foreground/30 text-sm">Select a contract</div>
                ) : currentSchemas.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground/30 text-sm">No events found in this ABI</div>
                ) : currentSchemas.map((ev, idx) => (
                  <div key={ev.name} className="rounded-lg border border-border bg-card p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Radio className="w-3.5 h-3.5 text-violet-400"/>
                        <span className="text-sm font-semibold font-mono">{ev.name}</span>
                      </div>
                      <button onClick={() => copyTopic0(ev, idx)}
                        className="flex items-center gap-1 text-[10px] text-muted-foreground/40 hover:text-muted-foreground">
                        {copiedIdx === idx ? <Check className="w-3 h-3 text-emerald-400"/> : <Copy className="w-3 h-3"/>}
                        topic0
                      </button>
                    </div>

                    {/* Params */}
                    <div className="space-y-1">
                      {ev.params.length === 0 ? (
                        <span className="text-[10px] text-muted-foreground/30 italic">No parameters</span>
                      ) : ev.params.map((p, pi) => (
                        <div key={pi} className="flex items-center gap-2 text-[11px] font-mono">
                          <span className="text-[10px] text-muted-foreground/30 w-4">{pi}</span>
                          {p.indexed && <span className="px-1 rounded bg-blue-500/10 text-blue-400 text-[9px]">indexed</span>}
                          <span className="text-amber-300/70">{p.type}</span>
                          <span className="text-muted-foreground/60">{p.name}</span>
                        </div>
                      ))}
                    </div>

                    {/* Signature */}
                    <div className="mt-1 px-2 py-1 bg-muted/20 rounded text-[9px] font-mono text-muted-foreground/40 truncate">
                      {ev.name}({ev.params.map(p => `${p.indexed ? 'indexed ' : ''}${p.type} ${p.name}`).join(', ')})
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === 'diff' && (
              <div className="p-4 space-y-2">
                {diffs === null ? (
                  <div className="text-center py-10 text-muted-foreground/30 text-sm">Paste an old ABI and click Compare to see differences</div>
                ) : diffs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <CheckCircle2 className="w-10 h-10 text-emerald-400/60"/>
                    <p className="text-sm text-emerald-400">No event schema changes detected</p>
                    <p className="text-[11px] text-muted-foreground/40">All events are backward compatible</p>
                  </div>
                ) : diffs.map((diff, i) => (
                  <div key={i} className={cn('rounded-lg border p-3 flex items-start gap-3', severityLabel(diff.severity))}>
                    {severityIcon(diff.severity)}
                    <div className="space-y-0.5 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold font-mono">{diff.eventName}</span>
                        <span className={cn('text-[9px] uppercase font-semibold px-1.5 rounded', {
                          'bg-rose-500/20 text-rose-400': diff.type === 'removed',
                          'bg-emerald-500/20 text-emerald-400': diff.type === 'added',
                          'bg-amber-500/20 text-amber-400': diff.type.includes('changed'),
                        })}>{diff.type.replace('_', ' ')}</span>
                      </div>
                      <p className="text-[11px] opacity-80">{diff.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}
