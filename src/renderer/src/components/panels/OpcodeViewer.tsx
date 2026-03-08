import { useState } from 'react'
import { ContractAbi, OpcodeEntry } from '../../types'
import { cn } from '../../lib/utils'
import { Cpu, Search, AlertCircle, BarChart3, Zap, Copy, ChevronDown } from 'lucide-react'
import { Button } from '../ui/button'
import { Input, Label, ScrollArea } from '../ui/primitives'

const api = (window as any).api

interface Props {
  abis: ContractAbi[]
  selectedAbi: ContractAbi | null
  onSelectAbi: (abi: ContractAbi) => void
}

const GAS_COLOR = (gas: number) => {
  if (gas === 0) return 'text-muted-foreground/30'
  if (gas <= 3) return 'text-emerald-400/70'
  if (gas <= 10) return 'text-amber-400/70'
  if (gas <= 100) return 'text-orange-400'
  return 'text-rose-400 font-semibold'
}

const OP_CATEGORIES: Record<string, string> = {
  STOP: 'control', JUMP: 'control', JUMPI: 'control', JUMPDEST: 'control', RETURN: 'control', REVERT: 'control', INVALID: 'control',
  ADD: 'arithmetic', MUL: 'arithmetic', SUB: 'arithmetic', DIV: 'arithmetic', MOD: 'arithmetic', EXP: 'arithmetic',
  SLOAD: 'storage', SSTORE: 'storage',
  MLOAD: 'memory', MSTORE: 'memory', MSTORE8: 'memory',
  CALL: 'external', STATICCALL: 'external', DELEGATECALL: 'external', CREATE: 'external', CREATE2: 'external',
  LOG0: 'events', LOG1: 'events', LOG2: 'events', LOG3: 'events', LOG4: 'events',
  SHA3: 'crypto',
  SELFDESTRUCT: 'dangerous', DELEGATECALL2: 'dangerous',
}
const CAT_COLORS: Record<string, string> = {
  control: 'text-sky-400', arithmetic: 'text-violet-400', storage: 'text-amber-400',
  memory: 'text-emerald-400', external: 'text-orange-400', events: 'text-pink-400',
  crypto: 'text-cyan-400', dangerous: 'text-rose-500',
}

export default function OpcodeViewer({ abis, selectedAbi, onSelectAbi }: Props) {
  const [opcodes, setOpcodes] = useState<OpcodeEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState<string>('all')
  const [customBytecode, setCustomBytecode] = useState('')
  const [mode, setMode] = useState<'abi' | 'custom'>('abi')

  const decode = async () => {
    setLoading(true); setError('')
    try {
      const bytecode = mode === 'abi' ? selectedAbi?.bytecode : customBytecode
      if (!bytecode || bytecode === '0x') { setError('No bytecode available'); setLoading(false); return }
      const result: OpcodeEntry[] = await api.decodeOpcodes(bytecode)
      setOpcodes(result)
    } catch (e) { setError(String(e)) }
    setLoading(false)
  }

  const totalGas = opcodes.reduce((s, o) => s + o.gasCost, 0)
  const opCounts: Record<string, number> = {}
  opcodes.forEach(o => { opCounts[o.opcode] = (opCounts[o.opcode] || 0) + 1 })
  const topOps = Object.entries(opCounts).sort((a, b) => b[1] - a[1]).slice(0, 10)

  const filtered = opcodes.filter(o => {
    const matchSearch = !search || o.opcode.includes(search.toUpperCase()) || o.offset.toString().includes(search)
    const matchCat = filterCat === 'all' || OP_CATEGORIES[o.opcode] === filterCat
    return matchSearch && matchCat
  })

  const categories = ['all', ...new Set(Object.values(OP_CATEGORIES))]

  const copyOpcodes = () => {
    const text = opcodes.map(o => `${o.offset.toString(16).padStart(4, '0')}: ${o.opcode}${o.operand ? ' ' + o.operand : ''}`).join('\n')
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: controls */}
      <div className="w-64 flex-shrink-0 border-r border-border bg-card flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-semibold">Opcode Viewer</span>
          </div>
        </div>

        <div className="p-4 space-y-4 flex-1 overflow-y-auto">
          {/* Mode */}
          <div>
            <p className="text-[9px] text-muted-foreground/50 uppercase tracking-widest mb-2">Source</p>
            <div className="flex rounded overflow-hidden border border-border">
              {(['abi', 'custom'] as const).map(m => (
                <button key={m} onClick={() => setMode(m)}
                  className={cn('flex-1 text-xs py-1.5 transition-all',
                    mode === m ? 'bg-violet-500/20 text-violet-300' : 'text-muted-foreground/50 hover:bg-muted/30')}>
                  {m === 'abi' ? 'From ABI' : 'Custom hex'}
                </button>
              ))}
            </div>
          </div>

          {mode === 'abi' ? (
            <div>
              <Label className="text-xs mb-1 block">Contract</Label>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {abis.map(a => (
                  <button key={a.path} onClick={() => onSelectAbi(a)}
                    className={cn('w-full text-left px-2 py-1.5 rounded text-xs transition-all',
                      selectedAbi?.path === a.path ? 'bg-violet-500/20 text-violet-300' : 'hover:bg-muted/40 text-muted-foreground/70')}>
                    {a.contractName}
                    {(!a.bytecode || a.bytecode === '0x') && <span className="text-[9px] text-muted-foreground/40 ml-1">(no bytecode)</span>}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <Label className="text-xs mb-1 block">Bytecode (hex)</Label>
              <textarea
                value={customBytecode}
                onChange={e => setCustomBytecode(e.target.value)}
                placeholder="0x608060405234801561001057..."
                className="w-full h-24 text-[10px] font-mono bg-muted/20 border border-border rounded p-2 resize-none text-foreground/80 placeholder:text-muted-foreground/30"
              />
            </div>
          )}

          <Button className="w-full gap-2 bg-violet-600 hover:bg-violet-500 h-8 text-xs" onClick={decode} disabled={loading}>
            <Cpu className="w-3.5 h-3.5" />
            {loading ? 'Decoding...' : 'Decode Opcodes'}
          </Button>

          {error && (
            <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 p-2 rounded border border-rose-500/20">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {opcodes.length > 0 && (
            <>
              {/* Stats */}
              <div className="space-y-1.5">
                <p className="text-[9px] text-muted-foreground/50 uppercase tracking-widest">Stats</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { label: 'Total Ops', value: opcodes.length.toLocaleString() },
                    { label: 'Gas (heuristic)', value: totalGas.toLocaleString() },
                    { label: 'Unique Ops', value: Object.keys(opCounts).length },
                    { label: 'Bytes', value: Math.floor(opcodes.reduce((s, o) => s + 1 + (o.operand ? (o.operand.length - 2) / 2 : 0), 0)).toString() },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-muted/20 rounded p-1.5 border border-border">
                      <div className="text-[9px] text-muted-foreground/50">{label}</div>
                      <div className="text-xs font-mono font-semibold text-violet-300">{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top opcodes */}
              <div>
                <p className="text-[9px] text-muted-foreground/50 uppercase tracking-widest mb-1.5">Top Opcodes</p>
                <div className="space-y-0.5">
                  {topOps.map(([op, count]) => {
                    const cat = OP_CATEGORIES[op]
                    const pct = Math.round((count / opcodes.length) * 100)
                    return (
                      <div key={op} className="flex items-center gap-2">
                        <span className={cn('text-[10px] font-mono w-20 flex-shrink-0', cat ? CAT_COLORS[cat] : 'text-foreground/60')}>{op}</span>
                        <div className="flex-1 bg-muted/30 rounded h-1.5 overflow-hidden">
                          <div className="h-full bg-violet-500/50 rounded" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[9px] text-muted-foreground/40 w-6 text-right">{count}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs h-7" onClick={copyOpcodes}>
                <Copy className="w-3 h-3" /> Copy All
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Right: opcode table */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        {opcodes.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card/50 flex-shrink-0 flex-wrap">
            <div className="relative">
              <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search opcode/offset..."
                className="pl-7 pr-3 h-7 text-xs bg-muted/20 border border-border rounded w-44 text-foreground/80 placeholder:text-muted-foreground/30 outline-none focus:border-violet-500/40" />
            </div>
            <div className="flex gap-1 flex-wrap">
              {categories.map(c => (
                <button key={c} onClick={() => setFilterCat(c)}
                  className={cn('text-[10px] px-2 py-0.5 rounded border transition-all capitalize',
                    filterCat === c ? 'bg-violet-500/20 border-violet-500/40 text-violet-300' : 'border-border text-muted-foreground/50 hover:border-muted-foreground/30')}>
                  {c}
                </button>
              ))}
            </div>
            <span className="ml-auto text-[10px] text-muted-foreground/40">{filtered.length} / {opcodes.length} ops</span>
          </div>
        )}

        <ScrollArea className="flex-1 overflow-y-auto">
          {opcodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground/30 py-20">
              <Cpu className="w-12 h-12 opacity-20" />
              <p className="text-sm">Select a contract and click Decode</p>
            </div>
          ) : (
            <table className="w-full text-[11px] font-mono">
              <thead className="sticky top-0 bg-card border-b border-border">
                <tr className="text-[9px] text-muted-foreground/40 uppercase tracking-widest">
                  <th className="text-left px-3 py-1.5 w-16">Offset</th>
                  <th className="text-left px-2 py-1.5 w-32">Opcode</th>
                  <th className="text-left px-2 py-1.5">Operand</th>
                  <th className="text-left px-2 py-1.5 w-16">Category</th>
                  <th className="text-right px-3 py-1.5 w-16">Gas</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((op, i) => {
                  const cat = OP_CATEGORIES[op.opcode]
                  return (
                    <tr key={`row-${i}`} className={cn('border-b border-border/30 hover:bg-accent/30 transition-colors',
                      cat === 'dangerous' && 'bg-rose-500/5',
                      cat === 'storage' && 'bg-amber-500/5',
                    )}>
                      <td className="px-3 py-0.5 text-muted-foreground/40">{op.offset.toString(16).padStart(4, '0')}</td>
                      <td className={cn('px-2 py-0.5 font-semibold', cat ? CAT_COLORS[cat] : 'text-foreground/80')}>{op.opcode}</td>
                      <td className="px-2 py-0.5 text-muted-foreground/60">{op.operand || ''}</td>
                      <td className="px-2 py-0.5">
                        {cat && <span className={cn('text-[9px] px-1 rounded', CAT_COLORS[cat])}>{cat}</span>}
                      </td>
                      <td className={cn('px-3 py-0.5 text-right', GAS_COLOR(op.gasCost))}>{op.gasCost || '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </ScrollArea>
      </div>
    </div>
  )
}
