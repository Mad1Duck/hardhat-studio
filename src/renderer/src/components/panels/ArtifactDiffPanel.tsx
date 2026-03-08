import { useState } from 'react'
import { cn } from '../../lib/utils'
import { GitCompare, RefreshCw, Plus, Minus, AlertCircle, Package, ArrowRight, Upload } from 'lucide-react'
import { Button } from '../ui/button'
import { ScrollArea } from '../ui/primitives'

const api = (window as any).api

interface ArtifactMeta {
  contractName: string
  path: string
  bytecodeSizeBytes: number
  abiCount: number
  modifiedAt: number
  abi: { name?: string; type: string; stateMutability?: string }[]
}

interface DiffResult {
  contractName: string
  abiAdded: string[]
  abiRemoved: string[]
  abiChanged: string[]
  bytecodeSizeOld: number
  bytecodeSizeNew: number
  bytecodeSizeDelta: number
}

interface Props {
  projectPath: string | null
}

export default function ArtifactDiffPanel({ projectPath }: Props) {
  const [oldArtifacts, setOldArtifacts] = useState<ArtifactMeta[]>([])
  const [newArtifacts, setNewArtifacts] = useState<ArtifactMeta[]>([])
  const [diffs, setDiffs] = useState<DiffResult[]>([])
  const [loading, setLoading] = useState(false)
  const [oldLoaded, setOldLoaded] = useState(false)
  const [newLoaded, setNewLoaded] = useState(false)

  const loadOld = async () => {
    if (!projectPath) return
    setLoading(true)
    const result: ArtifactMeta[] = await api.scanArtifactsMeta(projectPath)
    setOldArtifacts(result)
    setOldLoaded(true)
    setDiffs([])
    setLoading(false)
  }

  const loadNew = async () => {
    if (!projectPath) return
    setLoading(true)
    const result: ArtifactMeta[] = await api.scanArtifactsMeta(projectPath)
    setNewArtifacts(result)
    setNewLoaded(true)
    setLoading(false)
    if (oldArtifacts.length > 0) computeDiff(oldArtifacts, result)
  }

  const computeDiff = (old: ArtifactMeta[], now: ArtifactMeta[]) => {
    const results: DiffResult[] = []
    const oldMap = new Map(old.map(a => [a.contractName, a]))
    const newMap = new Map(now.map(a => [a.contractName, a]))

    const allNames = new Set([...old.map(a => a.contractName), ...now.map(a => a.contractName)])
    for (const name of allNames) {
      const o = oldMap.get(name)
      const n = newMap.get(name)

      const oldSigs = new Set((o?.abi || []).filter(i => i.name).map(i => `${i.type}:${i.name}:${i.stateMutability || ''}`))
      const newSigs = new Set((n?.abi || []).filter(i => i.name).map(i => `${i.type}:${i.name}:${i.stateMutability || ''}`))

      const added = [...newSigs].filter(s => !oldSigs.has(s)).map(s => s.split(':')[1])
      const removed = [...oldSigs].filter(s => !newSigs.has(s)).map(s => s.split(':')[1])

      // Only include if changed or added/removed
      if (added.length > 0 || removed.length > 0 || !o || !n ||
        o.bytecodeSizeBytes !== n.bytecodeSizeBytes) {
        results.push({
          contractName: name,
          abiAdded: added,
          abiRemoved: removed,
          abiChanged: [],
          bytecodeSizeOld: o?.bytecodeSizeBytes || 0,
          bytecodeSizeNew: n?.bytecodeSizeBytes || 0,
          bytecodeSizeDelta: (n?.bytecodeSizeBytes || 0) - (o?.bytecodeSizeBytes || 0),
        })
      }
    }
    setDiffs(results.sort((a, b) => {
      // New contracts first, then by most changes
      const aScore = (a.abiAdded.length + a.abiRemoved.length) + Math.abs(a.bytecodeSizeDelta)
      const bScore = (b.abiAdded.length + b.abiRemoved.length) + Math.abs(b.bytecodeSizeDelta)
      return bScore - aScore
    }))
  }

  const allChanged = diffs.filter(d => d.abiAdded.length > 0 || d.abiRemoved.length > 0 || d.bytecodeSizeDelta !== 0)
  const added = diffs.filter(d => d.bytecodeSizeOld === 0)
  const removed = diffs.filter(d => d.bytecodeSizeNew === 0)
  const changed = diffs.filter(d => d.bytecodeSizeOld > 0 && d.bytecodeSizeNew > 0 && (d.abiAdded.length || d.abiRemoved.length || d.bytecodeSizeDelta))

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-card/50 flex-shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <GitCompare className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-semibold">Artifact Diff</span>
          <span className="text-[10px] text-muted-foreground/40">Compare compiled contract ABIs & bytecode sizes</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Old snapshot */}
          <div className="flex-1 border border-border rounded-lg p-3 bg-muted/10">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-xs font-semibold">Baseline</div>
                <div className="text-[10px] text-muted-foreground/50">{oldLoaded ? `${oldArtifacts.length} contracts loaded` : 'Compile, then capture baseline'}</div>
              </div>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5"
                onClick={loadOld} disabled={!projectPath || loading}>
                <Upload className="w-3 h-3" /> {oldLoaded ? 'Re-capture' : 'Capture Baseline'}
              </Button>
            </div>
            {oldLoaded && (
              <div className="flex flex-wrap gap-1">
                {oldArtifacts.slice(0, 5).map(a => (
                  <span key={a.contractName} className="text-[9px] bg-muted/30 px-1.5 py-0.5 rounded text-muted-foreground/60">{a.contractName}</span>
                ))}
                {oldArtifacts.length > 5 && <span className="text-[9px] text-muted-foreground/40">+{oldArtifacts.length - 5} more</span>}
              </div>
            )}
          </div>

          <ArrowRight className="w-4 h-4 text-muted-foreground/30 flex-shrink-0" />

          {/* New snapshot */}
          <div className="flex-1 border border-border rounded-lg p-3 bg-muted/10">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-xs font-semibold">After Compile</div>
                <div className="text-[10px] text-muted-foreground/50">{newLoaded ? `${newArtifacts.length} contracts loaded` : 'Compile, then compare'}</div>
              </div>
              <Button size="sm" className="h-7 text-xs gap-1.5 bg-cyan-600 hover:bg-cyan-500"
                onClick={loadNew} disabled={!projectPath || loading || !oldLoaded}>
                <GitCompare className="w-3 h-3" /> {newLoaded ? 'Re-compare' : 'Compare Now'}
              </Button>
            </div>
            {newLoaded && (
              <div className="flex flex-wrap gap-1">
                {newArtifacts.slice(0, 5).map(a => (
                  <span key={a.contractName} className="text-[9px] bg-muted/30 px-1.5 py-0.5 rounded text-muted-foreground/60">{a.contractName}</span>
                ))}
                {newArtifacts.length > 5 && <span className="text-[9px] text-muted-foreground/40">+{newArtifacts.length - 5} more</span>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary bar */}
      {diffs.length > 0 && (
        <div className="flex gap-px border-b border-border flex-shrink-0">
          {[
            { label: 'Added', count: added.length, color: 'text-emerald-400 bg-emerald-500/10' },
            { label: 'Removed', count: removed.length, color: 'text-rose-400 bg-rose-500/10' },
            { label: 'Changed', count: changed.length, color: 'text-amber-400 bg-amber-500/10' },
            { label: 'Total', count: allChanged.length, color: 'text-muted-foreground bg-muted/20' },
          ].map(({ label, count, color }) => (
            <div key={label} className={cn('flex-1 py-2 text-center', color)}>
              <div className="text-sm font-bold">{count}</div>
              <div className="text-[9px] uppercase tracking-widest opacity-70">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Diff results */}
      <ScrollArea className="flex-1 overflow-y-auto">
        {!oldLoaded ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground/30 py-20">
            <GitCompare className="w-12 h-12 opacity-20" />
            <p className="text-sm">How to use:</p>
            <ol className="text-xs opacity-60 space-y-1 text-center">
              <li>1. Compile your contracts</li>
              <li>2. Click "Capture Baseline"</li>
              <li>3. Make changes to your contracts</li>
              <li>4. Compile again</li>
              <li>5. Click "Compare Now"</li>
            </ol>
          </div>
        ) : diffs.length === 0 && newLoaded ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground/30 py-20">
            <Package className="w-10 h-10 opacity-20" />
            <p className="text-sm">No changes detected</p>
            <p className="text-xs opacity-60">All contracts are identical to the baseline</p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {diffs.map(diff => {
              const isNew = diff.bytecodeSizeOld === 0
              const isRemoved = diff.bytecodeSizeNew === 0
              const deltaColor = diff.bytecodeSizeDelta > 0 ? 'text-rose-400' : diff.bytecodeSizeDelta < 0 ? 'text-emerald-400' : 'text-muted-foreground/40'

              return (
                <div key={diff.contractName} className={cn('border rounded-lg overflow-hidden',
                  isNew ? 'border-emerald-500/30' : isRemoved ? 'border-rose-500/30' : 'border-amber-500/30')}>
                  <div className={cn('flex items-center justify-between px-3 py-2',
                    isNew ? 'bg-emerald-500/10' : isRemoved ? 'bg-rose-500/10' : 'bg-amber-500/10')}>
                    <div className="flex items-center gap-2">
                      {isNew ? <Plus className="w-3.5 h-3.5 text-emerald-400" /> :
                       isRemoved ? <Minus className="w-3.5 h-3.5 text-rose-400" /> :
                       <GitCompare className="w-3.5 h-3.5 text-amber-400" />}
                      <span className="text-sm font-semibold">{diff.contractName}</span>
                      <span className={cn('text-[9px] px-1.5 py-0.5 rounded border',
                        isNew ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' :
                        isRemoved ? 'bg-rose-500/20 border-rose-500/30 text-rose-400' :
                        'bg-amber-500/20 border-amber-500/30 text-amber-400')}>
                        {isNew ? 'NEW' : isRemoved ? 'REMOVED' : 'CHANGED'}
                      </span>
                    </div>
                    {!isNew && !isRemoved && (
                      <div className="flex items-center gap-3 text-[10px] font-mono">
                        <span className="text-muted-foreground/50">{diff.bytecodeSizeOld.toLocaleString()}B</span>
                        <ArrowRight className="w-3 h-3 text-muted-foreground/30" />
                        <span className="text-muted-foreground/70">{diff.bytecodeSizeNew.toLocaleString()}B</span>
                        <span className={cn('font-semibold', deltaColor)}>
                          {diff.bytecodeSizeDelta > 0 ? '+' : ''}{diff.bytecodeSizeDelta}B
                        </span>
                      </div>
                    )}
                  </div>

                  {(diff.abiAdded.length > 0 || diff.abiRemoved.length > 0) && (
                    <div className="px-3 py-2 space-y-1.5">
                      {diff.abiAdded.map(fn => (
                        <div key={fn} className="flex items-center gap-2 text-xs">
                          <Plus className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                          <code className="text-emerald-300 font-mono">{fn}</code>
                          <span className="text-[9px] text-emerald-500/60">added</span>
                        </div>
                      ))}
                      {diff.abiRemoved.map(fn => (
                        <div key={fn} className="flex items-center gap-2 text-xs">
                          <Minus className="w-3 h-3 text-rose-400 flex-shrink-0" />
                          <code className="text-rose-300 font-mono">{fn}</code>
                          <span className="text-[9px] text-rose-500/60">removed</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
