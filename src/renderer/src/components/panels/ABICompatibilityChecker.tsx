import { useState, useEffect } from 'react'
import { ContractAbi, AbiItem } from '../../types'
import { Button } from '../ui/button'
import { ScrollArea } from '../ui/primitives'
import { cn } from '../../lib/utils'
import { GitCompare, AlertTriangle, CheckCircle2, XCircle, Info, RefreshCw, ChevronRight, Upload, FolderOpen } from 'lucide-react'

interface Props {
  abis: ContractAbi[]
  projectPath: string | null
}

type DiffType = 'function_removed' | 'function_added' | 'signature_changed' | 'event_changed' | 'return_changed' | 'mutability_changed'
type Severity = 'critical' | 'warning' | 'info'

interface ABIDiff {
  type: DiffType
  severity: Severity
  name: string
  detail: string
  oldSig?: string
  newSig?: string
}

function getSig(item: AbiItem): string {
  const inputs = (item.inputs || []).map(i => i.type).join(',')
  return `${item.name}(${inputs})`
}

function getFullSig(item: AbiItem): string {
  const inputs = (item.inputs || []).map(i => `${i.type} ${i.name || ''}`).join(', ')
  const outputs = item.outputs && item.outputs.length > 0 ? ` returns (${item.outputs.map(o => o.type).join(', ')})` : ''
  return `${item.stateMutability || ''} ${item.name}(${inputs})${outputs}`
}

function diffABIs(oldAbi: AbiItem[], newAbi: AbiItem[]): ABIDiff[] {
  const diffs: ABIDiff[] = []

  const oldFns = oldAbi.filter(i => i.type === 'function')
  const newFns = newAbi.filter(i => i.type === 'function')
  const oldEvents = oldAbi.filter(i => i.type === 'event')
  const newEvents = newAbi.filter(i => i.type === 'event')

  const oldFnMap = new Map(oldFns.map(f => [f.name, f]))
  const newFnMap = new Map(newFns.map(f => [f.name, f]))
  const oldEvMap = new Map(oldEvents.map(e => [e.name, e]))
  const newEvMap = new Map(newEvents.map(e => [e.name, e]))

  // Removed functions
  for (const [name, fn] of oldFnMap) {
    if (!newFnMap.has(name)) {
      diffs.push({
        type: 'function_removed', severity: 'critical', name,
        detail: 'Function removed. Frontend calls will throw at runtime.',
        oldSig: getFullSig(fn),
      })
    }
  }

  // Added functions
  for (const [name, fn] of newFnMap) {
    if (!oldFnMap.has(name)) {
      diffs.push({
        type: 'function_added', severity: 'info', name,
        detail: 'New function added. No breaking change.',
        newSig: getFullSig(fn),
      })
    }
  }

  // Changed functions
  for (const [name, oldFn] of oldFnMap) {
    const newFn = newFnMap.get(name)
    if (!newFn) continue

    // Input types changed
    const oldInputs = (oldFn.inputs || []).map(i => i.type).join(',')
    const newInputs = (newFn.inputs || []).map(i => i.type).join(',')
    if (oldInputs !== newInputs) {
      diffs.push({
        type: 'signature_changed', severity: 'critical', name,
        detail: `Input signature changed. All frontend calls will fail.`,
        oldSig: getFullSig(oldFn), newSig: getFullSig(newFn),
      })
    }

    // Output types changed
    const oldOutputs = (oldFn.outputs || []).map(o => o.type).join(',')
    const newOutputs = (newFn.outputs || []).map(o => o.type).join(',')
    if (oldOutputs !== newOutputs) {
      diffs.push({
        type: 'return_changed', severity: 'critical', name,
        detail: `Return type changed. Frontend decoding will produce wrong results.`,
        oldSig: `returns (${oldOutputs})`, newSig: `returns (${newOutputs})`,
      })
    }

    // State mutability changed
    if (oldFn.stateMutability !== newFn.stateMutability) {
      const isCritical = (oldFn.stateMutability === 'view' || oldFn.stateMutability === 'pure') !==
                          (newFn.stateMutability === 'view' || newFn.stateMutability === 'pure')
      diffs.push({
        type: 'mutability_changed', severity: isCritical ? 'critical' : 'warning', name,
        detail: `State mutability changed: ${oldFn.stateMutability} → ${newFn.stateMutability}. ${isCritical ? 'Read/write classification changed — frontend logic will break.' : 'Gas implications may change.'}`,
        oldSig: oldFn.stateMutability, newSig: newFn.stateMutability,
      })
    }

    // Param names changed
    const oldNames = (oldFn.inputs || []).map(i => i.name)
    const newNames = (newFn.inputs || []).map(i => i.name)
    if (JSON.stringify(oldNames) !== JSON.stringify(newNames) && oldInputs === newInputs) {
      diffs.push({
        type: 'signature_changed', severity: 'info', name,
        detail: `Parameter names changed: [${oldNames.join(', ')}] → [${newNames.join(', ')}]. Update frontend for clarity.`,
      })
    }
  }

  // Events
  for (const [name, oldEv] of oldEvMap) {
    if (!newEvMap.has(name)) {
      diffs.push({
        type: 'event_changed', severity: 'critical', name,
        detail: 'Event removed. Indexers and listeners will miss this event.',
        oldSig: getFullSig(oldEv),
      })
    } else {
      const newEv = newEvMap.get(name)!
      if (getSig(oldEv) !== getSig(newEv)) {
        diffs.push({
          type: 'event_changed', severity: 'critical', name,
          detail: 'Event signature changed. topic0 hash is different; all event filters will stop working.',
          oldSig: getFullSig(oldEv), newSig: getFullSig(newEv),
        })
      }
    }
  }
  for (const [name] of newEvMap) {
    if (!oldEvMap.has(name)) {
      diffs.push({
        type: 'event_changed', severity: 'info', name,
        detail: 'New event added. No breaking change.',
      })
    }
  }

  return diffs
}

export default function ABICompatibilityChecker({ abis, projectPath }: Props) {
  const [selectedAbi, setSelectedAbi] = useState<ContractAbi | null>(null)
  const [oldAbiJson, setOldAbiJson] = useState('')
  const [diffs, setDiffs] = useState<ABIDiff[] | null>(null)
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all')

  useEffect(() => {
    if (abis.length > 0 && !selectedAbi) setSelectedAbi(abis[0])
  }, [abis])

  const loadOldAbiFromFile = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const parsed = JSON.parse(text)
        // Support both raw ABI array and artifact format {abi: [...]}
        const abi = Array.isArray(parsed) ? parsed : (parsed.abi || parsed)
        setOldAbiJson(JSON.stringify(Array.isArray(abi) ? abi : [], null, 2))
        setDiffs(null)
      } catch { alert('Invalid JSON file') }
    }
    input.click()
  }

  const loadOldAbiFromProject = async () => {
    if (!projectPath) return
    // List artifacts directory
    try {
      const entries = await window.api.listDir(`${projectPath}/artifacts/contracts`)
      // Find first .json that's not .dbg.json
      const findArtifact = async (dir: string): Promise<string | null> => {
        try {
          const items = await window.api.listDir(dir)
          for (const item of items) {
            if (item.isDir) {
              const found = await findArtifact(item.path)
              if (found) return found
            } else if (item.name.endsWith('.json') && !item.name.endsWith('.dbg.json')) {
              return item.path
            }
          }
        } catch {}
        return null
      }
      const path = await findArtifact(`${projectPath}/artifacts/contracts`)
      if (path) {
        const content = await window.api.readFile(path)
        if (content) {
          const parsed = JSON.parse(content)
          const abi = parsed.abi || parsed
          setOldAbiJson(JSON.stringify(Array.isArray(abi) ? abi : [], null, 2))
          setDiffs(null)
        }
      }
    } catch {}
  }

  const runCheck = () => {
    if (!selectedAbi || !oldAbiJson.trim()) return
    try {
      const oldAbi: AbiItem[] = JSON.parse(oldAbiJson)
      setDiffs(diffABIs(oldAbi, selectedAbi.abi))
    } catch {
      alert('Invalid JSON in old ABI field')
    }
  }

  const filtered = diffs?.filter(d => filter === 'all' || d.severity === filter) || []
  const criticals = diffs?.filter(d => d.severity === 'critical').length || 0
  const warnings = diffs?.filter(d => d.severity === 'warning').length || 0
  const infos = diffs?.filter(d => d.severity === 'info').length || 0

  const severityStyle = (s: Severity) => ({
    critical: 'border-rose-500/30 bg-rose-500/5',
    warning: 'border-amber-500/30 bg-amber-500/5',
    info: 'border-blue-500/30 bg-blue-500/5',
  }[s])

  const severityIcon = (s: Severity) => {
    if (s === 'critical') return <XCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5"/>
    if (s === 'warning') return <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5"/>
    return <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5"/>
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card">
        <GitCompare className="w-4 h-4 text-cyan-400"/>
        <span className="text-sm font-semibold">ABI / Interface Compatibility Checker</span>
        <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-1.5 py-0.5 rounded">Breaking change detector</span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Config */}
        <div className="w-64 flex-shrink-0 border-r border-border flex flex-col bg-card/50 overflow-y-auto">
          <div className="p-3 border-b border-border space-y-2">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">New ABI (current)</label>
            <select
              value={selectedAbi?.path || ''}
              onChange={e => { setSelectedAbi(abis.find(a => a.path === e.target.value) || null); setDiffs(null) }}
              className="w-full h-7 text-xs bg-background border border-border rounded px-2 outline-none">
              <option value="">Select contract…</option>
              {abis.map(a => <option key={a.path} value={a.path}>{a.contractName}</option>)}
            </select>
          </div>

          <div className="p-3 border-b border-border space-y-2 flex-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Old ABI (previous version)</label>
              <div className="flex gap-1">
                <button onClick={loadOldAbiFromFile}
                  className="flex items-center gap-1 text-[10px] text-sky-400 hover:text-sky-300">
                  <Upload className="w-2.5 h-2.5"/> File
                </button>
                {projectPath && (
                  <button onClick={loadOldAbiFromProject}
                    className="flex items-center gap-1 text-[10px] text-violet-400 hover:text-violet-300">
                    <FolderOpen className="w-2.5 h-2.5"/> Project
                  </button>
                )}
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/40">Paste the old ABI JSON array to detect breaking changes</p>
            <textarea
              value={oldAbiJson}
              onChange={e => { setOldAbiJson(e.target.value); setDiffs(null) }}
              placeholder='[{"type":"function","name":"transfer",...}]'
              className="w-full h-40 resize-none rounded border border-border bg-background p-2 text-[10px] font-mono text-muted-foreground/70 outline-none focus:border-cyan-500/30"
            />
            <Button
              size="sm"
              className="w-full h-7 text-xs bg-cyan-700 hover:bg-cyan-600 gap-1.5"
              onClick={runCheck}
              disabled={!selectedAbi || !oldAbiJson.trim()}>
              <RefreshCw className="w-3 h-3"/> Check Compatibility
            </Button>
          </div>

          {diffs !== null && (
            <div className="p-3 space-y-2">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Filter</label>
              {(['all', 'critical', 'warning', 'info'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={cn('w-full text-left px-2 py-1.5 rounded text-xs flex items-center justify-between transition-all',
                    filter === f ? 'bg-accent text-foreground' : 'text-muted-foreground/50 hover:bg-accent/40')}>
                  <span className="capitalize">{f}</span>
                  <span className="font-mono text-[10px]">
                    {f === 'all' ? diffs.length : f === 'critical' ? criticals : f === 'warning' ? warnings : infos}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {diffs !== null && diffs.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-card/30">
              {criticals > 0 && <span className="flex items-center gap-1.5 text-[11px] text-rose-400"><XCircle className="w-3.5 h-3.5"/>{criticals} critical</span>}
              {warnings > 0 && <span className="flex items-center gap-1.5 text-[11px] text-amber-400"><AlertTriangle className="w-3.5 h-3.5"/>{warnings} warnings</span>}
              {infos > 0 && <span className="flex items-center gap-1.5 text-[11px] text-blue-400"><Info className="w-3.5 h-3.5"/>{infos} info</span>}
              {criticals > 0 && (
                <span className="ml-auto text-[10px] text-rose-400/70 bg-rose-500/10 px-2 py-0.5 rounded">⚠ Frontend will break</span>
              )}
            </div>
          )}

          <ScrollArea className="flex-1 overflow-y-auto">
            <div className="p-4 space-y-2">
              {diffs === null ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                  <GitCompare className="w-12 h-12 text-muted-foreground/20"/>
                  <p className="text-sm text-muted-foreground/40">Select current ABI and paste old ABI to detect breaking changes</p>
                  <div className="text-[10px] text-muted-foreground/30 space-y-1 max-w-xs">
                    <p>✓ Detects removed functions</p>
                    <p>✓ Detects signature changes</p>
                    <p>✓ Detects event changes</p>
                    <p>✓ Detects return type changes</p>
                    <p>✓ Detects mutability changes</p>
                  </div>
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400/60"/>
                  <p className="text-sm text-emerald-400">
                    {diffs.length === 0 ? 'ABIs are fully compatible — no breaking changes' : `No ${filter} issues found`}
                  </p>
                </div>
              ) : filtered.map((diff, i) => (
                <div key={i} className={cn('rounded-lg border p-3 space-y-2', severityStyle(diff.severity))}>
                  <div className="flex items-start gap-2">
                    {severityIcon(diff.severity)}
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold font-mono">{diff.name}</span>
                        <span className={cn('text-[9px] uppercase font-semibold px-1.5 py-0.5 rounded', {
                          'bg-rose-500/20 text-rose-400': diff.severity === 'critical',
                          'bg-amber-500/20 text-amber-400': diff.severity === 'warning',
                          'bg-blue-500/20 text-blue-400': diff.severity === 'info',
                        })}>{diff.type.replace(/_/g, ' ')}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground/80">{diff.detail}</p>
                      {(diff.oldSig || diff.newSig) && (
                        <div className="space-y-0.5 mt-1">
                          {diff.oldSig && (
                            <div className="flex items-start gap-2">
                              <span className="text-[9px] text-rose-400/60 w-8 flex-shrink-0 mt-0.5">OLD</span>
                              <code className="text-[10px] font-mono text-rose-300/60 line-through">{diff.oldSig}</code>
                            </div>
                          )}
                          {diff.newSig && (
                            <div className="flex items-start gap-2">
                              <span className="text-[9px] text-emerald-400/60 w-8 flex-shrink-0 mt-0.5">NEW</span>
                              <code className="text-[10px] font-mono text-emerald-300/60">{diff.newSig}</code>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}
