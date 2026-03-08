import { useState, useMemo } from 'react'
import { LogEntry, ProcessState, CommandConfig, TxRecord, SourceFile } from '../../types'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { Input } from '../ui/primitives'
import { Badge } from '../ui/primitives'
import {
  Bug, AlertCircle, AlertTriangle, Info, CheckCircle2, Search, FileCode,
  ExternalLink, Hash, Fuel, Clock, ChevronRight, Terminal, X, Eye
} from 'lucide-react'

interface Props {
  allLogs: (LogEntry & { commandId: string; commandLabel: string })[]
  txHistory: TxRecord[]
  processStates: Map<string, ProcessState>
  commands: CommandConfig[]
  sourceFiles: SourceFile[]
  projectPath: string
  rpcUrl?: string
}

type DebugTab = 'errors' | 'transactions' | 'allLogs' | 'sources'

export default function DebugPanel({
  allLogs, txHistory, processStates, commands, sourceFiles, projectPath, rpcUrl = 'http://127.0.0.1:8545'
}: Props) {
  const [tab, setTab] = useState<DebugTab>('errors')
  const [search, setSearch] = useState('')
  const [selectedFile, setSelectedFile] = useState<SourceFile | null>(null)
  const [fileContent, setFileContent] = useState<string | null>(null)
  const [loadingFile, setLoadingFile] = useState(false)
  const [selectedTx, setSelectedTx] = useState<TxRecord | null>(null)
  const [traceData, setTraceData]   = useState<string | null>(null)
  const [tracing, setTracing]       = useState(false)

  const traceTransaction = async (tx: TxRecord) => {
    if (!tx.hash || !rpcUrl) return
    setTracing(true); setTraceData(null)
    try {
      const r = await fetch(rpcUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc:'2.0', id:1, method:'debug_traceTransaction', params:[tx.hash, { disableStorage:true }] })
      })
      const d = await r.json()
      if (d.result) {
        const calls = d.result.structLogs?.slice(0,100) || []
        setTraceData(JSON.stringify({ gas:d.result.gas, failed:d.result.failed, ops:calls.length, sample:calls.slice(0,5) }, null, 2))
      } else {
        setTraceData(JSON.stringify({ note:'debug_traceTransaction not available — enable in hardhat config', error: d.error?.message }, null, 2))
      }
    } catch(e:any) { setTraceData(JSON.stringify({ error:e.message }, null, 2)) }
    setTracing(false)
  }

  const errorLogs = useMemo(() =>
    allLogs.filter(l => l.level === 'error' || l.type === 'stderr'),
  [allLogs])

  const filteredLogs = useMemo(() => {
    const logs = tab === 'errors' ? errorLogs : allLogs
    if (!search) return logs
    return logs.filter(l =>
      l.data.toLowerCase().includes(search.toLowerCase()) ||
      l.commandLabel.toLowerCase().includes(search.toLowerCase())
    )
  }, [tab, errorLogs, allLogs, search])

  const filteredTxs = useMemo(() =>
    txHistory.filter(tx => !search || tx.functionName.includes(search) || tx.contractName.includes(search) || tx.hash.includes(search)),
  [txHistory, search])

  const filteredSources = useMemo(() =>
    sourceFiles.filter(f => !search || f.name.toLowerCase().includes(search.toLowerCase())),
  [sourceFiles, search])

  const loadFile = async (file: SourceFile) => {
    setSelectedFile(file)
    setLoadingFile(true)
    const content = await window.api.readFile(file.path)
    setFileContent(content)
    setLoadingFile(false)
  }

  const openInEditor = async (file: SourceFile) => {
    await window.api.openInEditor(file.path)
  }

  const TABS: { id: DebugTab; label: string; icon: React.ComponentType<{ className?: string }>; count?: number }[] = [
    { id: 'errors', label: 'Errors', icon: AlertCircle, count: errorLogs.length },
    { id: 'transactions', label: 'Transactions', icon: Hash, count: txHistory.length },
    { id: 'allLogs', label: 'All Logs', icon: Terminal, count: allLogs.length },
    { id: 'sources', label: 'Source Files', icon: FileCode, count: sourceFiles.length }
  ]

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 border-b border-border bg-card flex-shrink-0" style={{ height: 44 }}>
        <Bug className="w-4 h-4 text-violet-400" />
        <span className="text-xs font-semibold text-foreground">Debug Console</span>
        <div className="flex items-center gap-0.5 ml-2">
          {TABS.map(({ id, label, icon: Icon, count }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex items-center gap-1.5 px-3 h-7 rounded text-xs font-medium transition-all',
                tab === id ? 'bg-accent text-foreground' : 'text-muted-foreground/60 hover:text-muted-foreground'
              )}
            >
              <Icon className="w-3 h-3" />{label}
              {count !== undefined && count > 0 && (
                <span className={cn('font-mono text-[10px] px-1 rounded', id === 'errors' && count > 0 ? 'text-rose-400' : 'text-muted-foreground/50')}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="ml-auto relative w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/40" />
          <Input
            className="pl-8 h-7 text-[11px] bg-background"
            placeholder={`Search ${tab}…`}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Log views */}
        {(tab === 'errors' || tab === 'allLogs') && (
          <div className="flex-1 overflow-y-auto font-mono text-[11.5px]" style={{ background: 'hsl(222 24% 5%)' }}>
            {filteredLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground/30">
                {tab === 'errors'
                  ? <><CheckCircle2 className="w-8 h-8 opacity-20" /><p>No errors found</p></>
                  : <><Terminal className="w-8 h-8 opacity-20" /><p>No logs yet — run a command</p></>
                }
              </div>
            ) : (
              <div className="p-3 space-y-0.5">
                {filteredLogs.map(log => (
                  <div key={log.id} className={cn(
                    'flex items-start gap-3 px-3 py-1.5 rounded group hover:bg-white/[0.02] transition-colors'
                  )}>
                    <div className="flex-shrink-0 mt-0.5">
                      {log.level === 'error' ? <AlertCircle className="w-3 h-3 text-rose-400" />
                        : log.level === 'warn' ? <AlertTriangle className="w-3 h-3 text-amber-400" />
                        : log.level === 'success' ? <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        : <Info className="w-3 h-3 text-muted-foreground/30" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={cn(
                        'leading-relaxed whitespace-pre-wrap break-all',
                        log.level === 'error' ? 'text-rose-300' : log.level === 'warn' ? 'text-amber-300' : log.level === 'success' ? 'text-emerald-300' : 'text-foreground/70'
                      )}>
                        {log.data.trim()}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-[10px] text-muted-foreground/40">{log.commandLabel}</span>
                        <span className="text-[10px] text-muted-foreground/30">{new Date(log.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Transactions */}
        {tab === 'transactions' && (
          <div className="flex flex-1 overflow-hidden">
            <div className={cn('border-r border-border overflow-y-auto', selectedTx ? 'w-72 flex-shrink-0' : 'flex-1')}>
              {filteredTxs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground/30 p-8">
                  <Hash className="w-8 h-8 opacity-20" />
                  <p className="text-sm">No transactions yet</p>
                  <p className="text-xs text-center">Transactions sent through the Interact panel will appear here</p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {filteredTxs.map(tx => (
                    <div
                      key={tx.id}
                      onClick={() => setSelectedTx(tx)}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all',
                        selectedTx?.id === tx.id ? 'border-violet-500/30 bg-violet-500/5' : 'border-border hover:border-border/70 hover:bg-accent/20'
                      )}
                    >
                      <div className={cn('w-2 h-2 rounded-full flex-shrink-0',
                        tx.status === 'success' ? 'bg-emerald-400' : tx.status === 'failed' ? 'bg-rose-400' : 'bg-amber-400 animate-pulse'
                      )} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-foreground font-mono">{tx.functionName}()</span>
                          <span className="text-[10px] text-muted-foreground/50">{tx.contractName}</span>
                        </div>
                        {tx.hash && (
                          <p className="text-[10px] font-mono text-muted-foreground/40 truncate">{tx.hash}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {tx.gasUsed && (
                          <span className="text-[10px] font-mono text-muted-foreground/40 flex items-center gap-1">
                            <Fuel className="w-2.5 h-2.5" />{tx.gasUsed}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground/30 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />{new Date(tx.timestamp).toLocaleTimeString()}
                        </span>
                        <ChevronRight className="w-3 h-3 text-muted-foreground/30" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tx detail */}
            {selectedTx && (
              <div className="flex-1 overflow-y-auto p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold font-mono">{selectedTx.functionName}()</h3>
                  <button onClick={() => setSelectedTx(null)} className="text-muted-foreground/40 hover:text-muted-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <InfoCard label="Status" value={selectedTx.status} valueClass={selectedTx.status === 'success' ? 'text-emerald-400' : 'text-rose-400'} />
                    <InfoCard label="Contract" value={selectedTx.contractName} />
                    {selectedTx.blockNumber !== undefined && <InfoCard label="Block" value={`#${selectedTx.blockNumber}`} />}
                    {selectedTx.gasUsed && <InfoCard label="Gas Used" value={selectedTx.gasUsed} />}
                  </div>
                  {selectedTx.hash && (
                    <div className="p-3 rounded-lg bg-card border border-border">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-1">Transaction Hash</p>
                      <code className="font-mono text-sky-400 text-[11px] break-all">{selectedTx.hash}</code>
                      <button onClick={() => traceTransaction(selectedTx)} disabled={tracing}
                        className="mt-2 text-[10px] px-2 py-0.5 rounded bg-violet-500/10 border border-violet-500/30 text-violet-400 hover:bg-violet-500/20 flex items-center gap-1">
                        {tracing ? '⏳ Tracing…' : '🔍 Trace on Hardhat Node'}
                      </button>
                      {traceData && (
                        <pre className="mt-2 text-[9px] font-mono bg-muted/20 border border-border rounded p-2 overflow-auto max-h-40 text-emerald-400/70 whitespace-pre-wrap">{traceData}</pre>
                      )}
                    </div>
                  )}
                  {selectedTx.args.length > 0 && (
                    <div className="p-3 rounded-lg bg-card border border-border">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-2">Arguments</p>
                      {selectedTx.args.map((arg, i) => (
                        <div key={`row-${i}`} className="flex items-center gap-2 text-[11px] font-mono mb-1">
                          <span className="text-muted-foreground/40">{i}:</span>
                          <span className="text-foreground/80 break-all">{String(arg)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {selectedTx.error && (
                    <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-rose-400/70 mb-1">Error</p>
                      <code className="font-mono text-rose-300 text-[11px] whitespace-pre-wrap break-all">{selectedTx.error}</code>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Source files */}
        {tab === 'sources' && (
          <div className="flex flex-1 overflow-hidden">
            {/* File list */}
            <div className={cn('border-r border-border overflow-y-auto bg-card', selectedFile ? 'w-56 flex-shrink-0' : 'flex-1')}>
              <div className="p-2 space-y-1">
                {filteredSources.map(f => (
                  <div
                    key={f.path}
                    onClick={() => loadFile(f)}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-2 rounded-md cursor-pointer transition-all group',
                      selectedFile?.path === f.path ? 'bg-accent' : 'hover:bg-accent/40'
                    )}
                  >
                    <FileCode className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground/50" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-foreground/80 truncate">{f.name}</p>
                      <p className="text-[10px] font-mono text-muted-foreground/40">{(f.size / 1024).toFixed(1)}kb</p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); openInEditor(f) }}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-muted-foreground transition-all"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {filteredSources.length === 0 && (
                  <div className="p-6 text-center text-muted-foreground/30 text-sm">No source files found</div>
                )}
              </div>
            </div>

            {/* File content */}
            {selectedFile && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-3.5 h-3.5 text-muted-foreground/50" />
                    <span className="text-xs font-medium">{selectedFile.name}</span>
                    <span className="text-[10px] font-mono text-muted-foreground/40">{selectedFile.path}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => openInEditor(selectedFile)}>
                      <ExternalLink className="w-3 h-3" />Open in Editor
                    </Button>
                    <button onClick={() => setSelectedFile(null)} className="text-muted-foreground/40 hover:text-muted-foreground">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-auto" style={{ background: 'hsl(222 24% 5%)' }}>
                  {loadingFile ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground/30 text-sm">Loading…</div>
                  ) : (
                    <pre className="p-4 text-[12px] font-mono text-foreground/70 leading-relaxed min-w-max">
                      {fileContent?.split('\n').map((line, i) => (
                        <div key={`row-${i}`} className="flex">
                          <span className="select-none text-muted-foreground/20 w-10 text-right mr-4 flex-shrink-0">{i + 1}</span>
                          <span className={highlightSolidity(line)}>{line || ' '}</span>
                        </div>
                      ))}
                    </pre>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function InfoCard({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="p-3 rounded-lg bg-card border border-border">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-1">{label}</p>
      <p className={cn('font-mono text-xs break-all', valueClass || 'text-foreground')}>{value}</p>
    </div>
  )
}

function highlightSolidity(line: string): string {
  // Basic Solidity syntax highlighting hint via CSS class
  const l = line.trim()
  if (l.startsWith('//')) return 'text-muted-foreground/40 italic'
  if (l.startsWith('pragma') || l.startsWith('import')) return 'text-violet-400/80'
  if (l.match(/^(contract|interface|library|abstract|function|event|error|modifier|constructor|struct|enum|mapping)\b/)) return 'text-sky-300/90'
  if (l.match(/^\s*(public|private|internal|external|view|pure|payable|override|virtual|returns?)\b/)) return 'text-amber-300/80'
  return 'text-foreground/70'
}
