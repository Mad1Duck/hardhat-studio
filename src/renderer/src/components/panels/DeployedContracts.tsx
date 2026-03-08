import { useState } from 'react'
import { DeployedContract } from '../../types'
import { Button } from '../ui/button'
import { ScrollArea } from '../ui/primitives'
import { GitBranch, Trash2, Zap, Copy, ExternalLink, ChevronDown, ChevronRight, Clock, Hash, Fuel, Globe, History, RefreshCw } from 'lucide-react'
import { cn } from '../../lib/utils'

interface Props {
  contracts: DeployedContract[]
  onRemove: (id: string) => void
  onInteract: (c: DeployedContract) => void
}

export default function DeployedContracts({ contracts, onRemove, onInteract }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 1500)
  }

  const openEthScan = (address: string, chainId?: number) => {
    const explorers: Record<number, string> = {
      1: 'https://etherscan.io',
      11155111: 'https://sepolia.etherscan.io',
      137: 'https://polygonscan.com',
      42161: 'https://arbiscan.io',
      10: 'https://optimistic.etherscan.io',
      8453: 'https://basescan.org',
    }
    const base = explorers[chainId || 0] || 'https://etherscan.io'
    window.open(`${base}/address/${address}`, '_blank')
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-orange-400" />
          <span className="text-sm font-semibold">Deployed Contracts</span>
          <span className="text-xs text-muted-foreground/50">{contracts.length} total</span>
        </div>
      </div>

      {contracts.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground/30">
          <div className="text-center">
            <GitBranch className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No contracts deployed yet</p>
            <p className="text-xs mt-1">Deploy from the Interact tab or run your deploy script</p>
          </div>
        </div>
      ) : (
        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-2">
            {contracts.map(c => (
              <div key={c.id} className={cn(
                'rounded-lg border transition-all overflow-hidden',
                expanded === c.id ? 'border-orange-500/30' : 'border-border bg-card'
              )}>
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-accent/30 transition-colors"
                  onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                >
                  <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-mono font-bold text-orange-400">{c.name.slice(0, 2).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">{c.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground/60 font-mono">{c.network}</span>
                      {/* Version badge */}
                      {(c.version ?? 1) > 1 ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25 font-mono font-semibold">
                          v{c.version}
                        </span>
                      ) : (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400/60 border border-emerald-500/15 font-mono">
                          v1
                        </span>
                      )}
                      {(c.previousVersions?.length ?? 0) > 0 && (
                        <span className="text-[9px] text-amber-400/50 font-mono">
                          ({c.previousVersions!.length} prev)
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-[11px] font-mono text-muted-foreground/60">{c.address.slice(0, 14)}…{c.address.slice(-8)}</span>
                      <button
                        className="text-muted-foreground/30 hover:text-muted-foreground transition-colors"
                        onClick={e => { e.stopPropagation(); copy(c.address, `addr-${c.id}`) }}
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      {copied === `addr-${c.id}` && <span className="text-[10px] text-emerald-400">Copied!</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-[10px] gap-1"
                      onClick={e => { e.stopPropagation(); onInteract(c) }}
                    >
                      <Zap className="w-2.5 h-2.5" /> Interact
                    </Button>
                    {expanded === c.id ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/40" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40" />}
                  </div>
                </div>

                {expanded === c.id && (
                  <div className="border-t border-border/50 px-4 py-3 space-y-3 bg-accent/20">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className="flex items-center gap-1 text-muted-foreground/50 mb-1">
                          <Clock className="w-3 h-3" /> Deployed
                        </div>
                        <div className="font-mono text-foreground/70">{new Date(c.deployedAt).toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="flex items-center gap-1 text-muted-foreground/50 mb-1">
                          <Globe className="w-3 h-3" /> RPC
                        </div>
                        <div className="font-mono text-foreground/70 truncate">{c.rpcUrl}</div>
                      </div>
                      {c.gasUsed && (
                        <div>
                          <div className="flex items-center gap-1 text-muted-foreground/50 mb-1">
                            <Fuel className="w-3 h-3" /> Gas Used
                          </div>
                          <div className="font-mono text-amber-400">{parseInt(c.gasUsed).toLocaleString()}</div>
                        </div>
                      )}
                      {c.chainId && (
                        <div>
                          <div className="text-muted-foreground/50 mb-1">Chain ID</div>
                          <div className="font-mono text-foreground/70">{c.chainId}</div>
                        </div>
                      )}
                    </div>

                    {c.txHash && (
                      <div>
                        <div className="text-[10px] text-muted-foreground/50 mb-1 flex items-center gap-1">
                          <Hash className="w-3 h-3" /> Deploy Tx
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono text-foreground/60 break-all">{c.txHash}</span>
                          <button onClick={() => copy(c.txHash!, `tx-${c.id}`)} className="text-muted-foreground/30 hover:text-muted-foreground flex-shrink-0">
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}

                    <div>
                      <div className="text-[10px] text-muted-foreground/50 mb-2">
                        ABI Functions: {c.abi.filter(i => i.type === 'function').length} | Events: {c.abi.filter(i => i.type === 'event').length}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button size="sm" className="gap-1 h-7 text-xs flex-1" onClick={() => onInteract(c)}>
                        <Zap className="w-3 h-3" /> Open in Interact
                      </Button>
                      {c.chainId && c.chainId !== 31337 && (
                        <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => openEthScan(c.address, c.chainId)}>
                          <ExternalLink className="w-3 h-3" /> Explorer
                        </Button>
                      )}
                      {(c.previousVersions?.length ?? 0) > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-2 gap-1"
                          onClick={() => setShowHistory(showHistory === c.id ? null : c.id)}
                          title="View deployment history"
                        >
                          <History className="w-3 h-3" />
                        </Button>
                      )}
                      <Button size="sm" variant="destructive" className="h-7 text-xs px-2" onClick={() => onRemove(c.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>

                    {/* Version history panel */}
                    {showHistory === c.id && (c.previousVersions?.length ?? 0) > 0 && (
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <p className="text-[9px] text-muted-foreground/40 uppercase tracking-widest font-mono mb-2 flex items-center gap-1">
                          <History className="w-3 h-3" /> Deployment History
                        </p>
                        <div className="space-y-1.5">
                          {/* Current version */}
                          <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-orange-500/8 border border-orange-500/20 text-[10px]">
                            <span className="text-[8px] px-1 py-0.5 rounded bg-orange-500/20 text-orange-400 font-mono font-bold flex-shrink-0">
                              v{c.version ?? 1} CURRENT
                            </span>
                            <span className="font-mono text-foreground/70 truncate flex-1">{c.address.slice(0, 12)}…{c.address.slice(-6)}</span>
                            <button onClick={() => copy(c.address, `hist-cur-${c.id}`)} className="text-muted-foreground/30 hover:text-muted-foreground flex-shrink-0">
                              <Copy className="w-2.5 h-2.5" />
                            </button>
                            <span className="text-muted-foreground/30 flex-shrink-0 text-[8px]">
                              {new Date(c.deployedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          {/* Previous versions */}
                          {c.previousVersions!.map((pv) => (
                            <div key={pv.version} className="flex items-center gap-2 px-2 py-1.5 rounded bg-muted/20 border border-border/40 text-[10px] opacity-70">
                              <span className="text-[8px] px-1 py-0.5 rounded bg-muted text-muted-foreground/50 font-mono flex-shrink-0">
                                v{pv.version}
                              </span>
                              <span className="font-mono text-muted-foreground/60 truncate flex-1">{pv.address.slice(0, 12)}…{pv.address.slice(-6)}</span>
                              <button onClick={() => copy(pv.address, `hist-${c.id}-${pv.version}`)} className="text-muted-foreground/30 hover:text-muted-foreground flex-shrink-0">
                                <Copy className="w-2.5 h-2.5" />
                              </button>
                              {copied === `hist-${c.id}-${pv.version}` && <span className="text-[8px] text-emerald-400">Copied!</span>}
                              <span className="text-muted-foreground/30 flex-shrink-0 text-[8px]">
                                {new Date(pv.deployedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
