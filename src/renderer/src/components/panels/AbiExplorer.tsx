import { useState } from 'react'
import { ContractAbi, AbiItem } from '../../types'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { Input } from '../ui/primitives'
import { Badge } from '../ui/primitives'
import { RefreshCw, Zap, Search, FileCode, Copy, CheckCheck } from 'lucide-react'

const getMutBadge = (item: AbiItem) => {
  if (item.type === 'event') return <Badge variant="event">event</Badge>
  if (item.type === 'error') return <Badge variant="error">error</Badge>
  if (item.type === 'constructor') return <Badge variant="write">constructor</Badge>
  switch (item.stateMutability) {
    case 'view': return <Badge variant="view">view</Badge>
    case 'pure': return <Badge variant="pure">pure</Badge>
    case 'payable': return <Badge variant="payable">payable</Badge>
    default: return <Badge variant="write">write</Badge>
  }
}

const formatSig = (item: AbiItem) => {
  const params = (item.inputs || []).map(i => `${i.type}${i.name ? ' ' + i.name : ''}`).join(', ')
  const outs = item.outputs?.length ? ` → (${item.outputs.map(o => o.type).join(', ')})` : ''
  return `${item.name || item.type}(${params})${outs}`
}

interface Props {
  abis: ContractAbi[]
  selectedAbi: ContractAbi | null
  onSelectAbi: (a: ContractAbi) => void
  onInteract: (a: ContractAbi) => void
  onRefresh: () => void
}

export default function AbiExplorer({ abis, selectedAbi, onSelectAbi, onInteract, onRefresh }: Props) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<string>('all')
  const [copied, setCopied] = useState(false)

  const filtered = abis.filter(a => a.contractName.toLowerCase().includes(search.toLowerCase()))
  const items = selectedAbi?.abi || []
  const shown = items.filter(i => filter === 'all' || i.type === filter)

  const copyAbi = () => {
    if (!selectedAbi) return
    navigator.clipboard.writeText(JSON.stringify(selectedAbi.abi, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const FILTERS = ['all', 'function', 'event', 'error'] as const

  return (
    <div className="flex h-full bg-background overflow-hidden">
      {/* Contract list */}
      <div className="w-52 flex-shrink-0 border-r border-border bg-card flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">ABIs ({abis.length})</span>
          <Button variant="ghost" size="icon" className="w-6 h-6" onClick={onRefresh}>
            <RefreshCw className="w-3 h-3" />
          </Button>
        </div>
        <div className="p-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/40" />
            <Input
              className="pl-7 h-7 text-[11px]"
              placeholder="Search contracts…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-4 text-center text-[11px] text-muted-foreground/50">
              {abis.length === 0 ? 'Compile project to see ABIs' : 'No matches'}
            </div>
          ) : (
            filtered.map(abi => {
              const fnCount = abi.abi.filter(i => i.type === 'function').length
              const evCount = abi.abi.filter(i => i.type === 'event').length
              const active = selectedAbi?.path === abi.path
              return (
                <button
                  key={abi.path}
                  onClick={() => onSelectAbi(abi)}
                  className={cn(
                    'w-full px-3 py-2 text-left border-l-2 transition-all',
                    active ? 'bg-accent border-sky-500' : 'border-transparent hover:bg-accent/40'
                  )}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <FileCode className={cn('w-3 h-3 flex-shrink-0', active ? 'text-sky-400' : 'text-muted-foreground/50')} />
                    <span className="text-[11px] font-semibold text-foreground/90 truncate">{abi.contractName}</span>
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground/50 flex gap-2 ml-4.5">
                    <span>{fnCount}fn</span>
                    <span>{evCount}ev</span>
                    {abi.bytecode && abi.bytecode !== '0x' && (
                      <span className="text-emerald-400/60">deployable</span>
                    )}
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Detail */}
      {!selectedAbi ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground/40">
            <FileCode className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">Select a contract</p>
            <p className="text-xs mt-1">Choose from the list to view its ABI</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 px-6 py-3 border-b border-border bg-card flex-shrink-0">
            <div>
              <h2 className="text-sm font-bold text-foreground">{selectedAbi.contractName}</h2>
              <p className="text-[10px] font-mono text-muted-foreground/50 mt-0.5 truncate max-w-xs" title={selectedAbi.path}>{selectedAbi.path}</p>
            </div>
            <div className="flex items-center gap-4 flex-shrink-0">
              {(['function', 'event', 'error'] as const).map(type => {
                const count = items.filter(i => i.type === type).length
                return count > 0 ? (
                  <div key={type} className="text-center">
                    <div className="text-base font-bold font-mono text-foreground">{count}</div>
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground/60">{type}s</div>
                  </div>
                ) : null
              })}
              <Button variant="ghost" size="sm" className="gap-1" onClick={copyAbi}>
                {copied ? <CheckCheck className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied' : 'Copy ABI'}
              </Button>
              <Button variant="success" size="sm" className="gap-1" onClick={() => onInteract(selectedAbi)}>
                <Zap className="w-3 h-3" />Interact
              </Button>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 px-6 py-2 border-b border-border/50 bg-card/50 flex-shrink-0">
            {FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'px-3 py-1 rounded-full text-[11px] font-medium transition-all',
                  filter === f ? 'bg-accent text-foreground' : 'text-muted-foreground/60 hover:text-muted-foreground'
                )}
              >
                {f}
                {f !== 'all' && <span className="ml-1.5 font-mono opacity-50">{items.filter(i => i.type === f).length}</span>}
              </button>
            ))}
          </div>

          {/* ABI list */}
          <div className="flex-1 overflow-y-auto px-6 py-3 space-y-2">
            {shown.map((item, idx) => (
              <div key={idx} className="rounded-lg border border-border bg-card hover:border-border/70 transition-colors overflow-hidden">
                <div className="flex items-start justify-between gap-3 px-4 py-2.5 bg-card">
                  <code className="text-[12px] font-mono text-foreground/85 leading-relaxed flex-1">
                    {formatSig(item)}
                  </code>
                  {getMutBadge(item)}
                </div>
                {(item.inputs?.length ?? 0) > 0 && (
                  <div className="px-4 py-2 border-t border-border/50 bg-background/30">
                    <span className="text-[10px] text-muted-foreground/50 font-mono mr-2">inputs</span>
                    {item.inputs!.map((inp, i) => (
                      <span key={`row-${i}`} className="inline-flex items-center gap-1 mr-2">
                        <span className="text-[11px] font-mono text-sky-400">{inp.type}</span>
                        {inp.name && <span className="text-[11px] font-mono text-foreground/60">{inp.name}</span>}
                        {i < item.inputs!.length - 1 && <span className="text-muted-foreground/40">,</span>}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Raw JSON */}
          <details className="border-t border-border flex-shrink-0">
            <summary className="px-6 py-2 text-[11px] text-muted-foreground/50 cursor-pointer hover:text-muted-foreground/80 bg-card select-none">
              Raw JSON ({JSON.stringify(selectedAbi.abi).length} chars)
            </summary>
            <pre className="max-h-48 overflow-auto px-6 py-3 text-[11px] font-mono text-muted-foreground/70 bg-background">
              {JSON.stringify(selectedAbi.abi, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  )
}
