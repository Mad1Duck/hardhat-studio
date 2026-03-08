import { useState, useCallback } from 'react'
import { ContractAbi, GasEstimate, TxRecord } from '../../types'
import { Button } from '../ui/button'
import { Input, Label, ScrollArea } from '../ui/primitives'
import { Fuel, RefreshCw, BarChart3, Zap, Globe, Plus, X } from 'lucide-react'
import { cn } from '../../lib/utils'

interface Props { abis: ContractAbi[]; txHistory: TxRecord[]; rpcUrl: string }

interface Chain {
  id: number; name: string; symbol: string; color: string
  rpc?: string; gasMultiplier?: number; custom?: boolean
}

const CHAINS: Chain[] = [
  { id:1,      name:'Ethereum',  symbol:'ETH',  color:'text-blue-400',   gasMultiplier:1 },
  { id:1337,   name:'Hardhat',   symbol:'ETH',  color:'text-amber-400',  gasMultiplier:1 },
  { id:8453,   name:'Base',      symbol:'ETH',  color:'text-sky-400',    rpc:'https://mainnet.base.org', gasMultiplier:0.1 },
  { id:10,     name:'Optimism',  symbol:'ETH',  color:'text-red-400',    rpc:'https://mainnet.optimism.io', gasMultiplier:0.05 },
  { id:42161,  name:'Arbitrum',  symbol:'ETH',  color:'text-cyan-400',   rpc:'https://arb1.arbitrum.io/rpc', gasMultiplier:0.02 },
  { id:137,    name:'Polygon',   symbol:'MATIC', color:'text-purple-400', rpc:'https://polygon-rpc.com', gasMultiplier:0.01 },
  { id:1135,   name:'Lisk',      symbol:'ETH',  color:'text-teal-400',   rpc:'https://rpc.api.lisk.com', gasMultiplier:0.001 },
  { id:10143,  name:'Monad',     symbol:'MON',  color:'text-violet-400', rpc:'https://rpc.monad.xyz', gasMultiplier:0.01 },
  { id:56,     name:'BSC',       symbol:'BNB',  color:'text-yellow-400', rpc:'https://bsc-dataseed.binance.org', gasMultiplier:0.5 },
  { id:43114,  name:'Avalanche', symbol:'AVAX', color:'text-red-300',    rpc:'https://api.avax.network/ext/bc/C/rpc', gasMultiplier:2 },
  { id:250,    name:'Fantom',    symbol:'FTM',  color:'text-blue-300',   rpc:'https://rpc.ftm.tools', gasMultiplier:0.5 },
]

// Rough USD prices
const PRICE: Record<string,number> = {
  ETH:3200, BNB:400, MATIC:1, AVAX:35, FTM:0.5, MON:1, default:1
}

export default function GasPanel({ abis, txHistory, rpcUrl }: Props) {
  const [selectedAbi, setSelectedAbi] = useState<ContractAbi|null>(null)
  const [estimates, setEstimates]     = useState<GasEstimate[]>([])
  const [loading, setLoading]         = useState(false)
  const [gasPrice, setGasPrice]       = useState('20')         // gwei
  const [selectedChain, setSelectedChain] = useState<Chain>(CHAINS[1]) // Hardhat default
  const [liveGasPrice, setLiveGasPrice] = useState<string|null>(null)
  const [fetchingGas, setFetchingGas] = useState(false)
  const [customChains, setCustomChains] = useState<Chain[]>(() => {
    try { return JSON.parse(localStorage.getItem('gasPanel_customChains') || '[]') } catch { return [] }
  })
  const [showAddNetwork, setShowAddNetwork] = useState(false)
  const [newNet, setNewNet] = useState({ name: '', symbol: 'ETH', rpc: '', chainId: '', price: '1' })

  const allChains = [...CHAINS, ...customChains]

  const addCustomChain = () => {
    if (!newNet.name || !newNet.chainId) return
    const chain: Chain = {
      id: parseInt(newNet.chainId) || Date.now(),
      name: newNet.name,
      symbol: newNet.symbol || 'ETH',
      color: 'text-emerald-400',
      rpc: newNet.rpc || undefined,
      gasMultiplier: 1,
      custom: true,
    }
    if (newNet.price) PRICE[newNet.symbol] = parseFloat(newNet.price)
    const updated = [...customChains, chain]
    setCustomChains(updated)
    try { localStorage.setItem('gasPanel_customChains', JSON.stringify(updated)) } catch {}
    setSelectedChain(chain)
    setNewNet({ name: '', symbol: 'ETH', rpc: '', chainId: '', price: '1' })
    setShowAddNetwork(false)
  }

  const removeCustomChain = (id: number) => {
    const updated = customChains.filter(c => c.id !== id)
    setCustomChains(updated)
    try { localStorage.setItem('gasPanel_customChains', JSON.stringify(updated)) } catch {}
    if (selectedChain.id === id) setSelectedChain(CHAINS[1])
  }

  const fetchLiveGas = async () => {
    const url = selectedChain.rpc || rpcUrl
    setFetchingGas(true)
    try {
      const r = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_gasPrice',params:[]}) })
      const d = await r.json()
      if (d.result) {
        const gwei = (parseInt(d.result,16) / 1e9).toFixed(2)
        setLiveGasPrice(gwei)
        setGasPrice(gwei)
      }
    } catch {}
    setFetchingGas(false)
  }

  const nativePrice = PRICE[selectedChain.symbol] ?? PRICE.default

  const estimateAll = useCallback(async () => {
    if (!selectedAbi) return
    setLoading(true)
    try {
      const fns = selectedAbi.abi.filter(i => i.type==='function' && i.stateMutability!=='view' && i.stateMutability!=='pure')
      const est: GasEstimate[] = fns.map(fn => {
        const name = fn.name || ''
        const inputs = fn.inputs || []
        const hasBytes  = inputs.some(i=>i.type.includes('bytes')||i.type.includes('string'))
        const hasArray  = inputs.some(i=>i.type.endsWith(']'))
        let base = 21000 + 2300 + inputs.length * 500
        if (hasBytes) base += 20000
        if (hasArray) base += 15000
        if (/transfer/i.test(name)) base += 30000
        if (/mint/i.test(name))     base += 50000
        if (/deploy/i.test(name))   base += 100000
        if (/swap/i.test(name))     base += 80000
        if (/stake|deposit/i.test(name)) base += 60000

        const effectiveGas = parseFloat(gasPrice) * (selectedChain.gasMultiplier ?? 1)
        const costNative = (base * Math.max(effectiveGas, 0.0001) * 1e-9).toFixed(8)
        const costUSD    = (parseFloat(costNative) * nativePrice).toFixed(4)

        return { functionName: name, gasEstimate: base.toString(), gasCostETH: costNative, gasCostUSD: costUSD }
      })
      setEstimates(est)
    } finally { setLoading(false) }
  }, [selectedAbi, gasPrice, selectedChain, nativePrice])

  const txGas = txHistory.filter(t=>t.gasUsed).slice(0,20).map(t => ({
    fn:`${t.contractName}.${t.functionName}`, gas:parseInt(t.gasUsed||'0'), status:t.status, hash:t.hash.slice(0,10)+'…'
  }))
  const maxGas = Math.max(...txGas.map(t=>t.gas), 1)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <Fuel className="w-4 h-4 text-amber-400"/>
          <span className="text-sm font-semibold">Gas Estimator & Profiler</span>
        </div>
      </div>

      <div className="grid grid-cols-2 h-full overflow-hidden">
        {/* Estimator */}
        <div className="border-r border-border flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-card/50 space-y-3">
            {/* Chain selector */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="flex items-center gap-1"><Globe className="w-3 h-3"/> Network / Chain</Label>
                <button onClick={() => setShowAddNetwork(p => !p)}
                  className="flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300">
                  <Plus className="w-2.5 h-2.5"/> Add network
                </button>
              </div>

              {/* Add network form */}
              {showAddNetwork && (
                <div className="mb-2 p-2 rounded border border-emerald-500/20 bg-emerald-500/5 space-y-1.5">
                  <div className="text-[10px] font-semibold text-emerald-400 mb-1">Add Custom Network</div>
                  <div className="grid grid-cols-2 gap-1">
                    <Input value={newNet.name} onChange={e => setNewNet(p => ({...p, name: e.target.value}))} placeholder="Name" className="h-6 text-[10px]"/>
                    <Input value={newNet.chainId} onChange={e => setNewNet(p => ({...p, chainId: e.target.value}))} placeholder="Chain ID" className="h-6 text-[10px]"/>
                    <Input value={newNet.symbol} onChange={e => setNewNet(p => ({...p, symbol: e.target.value}))} placeholder="Symbol" className="h-6 text-[10px]"/>
                    <Input value={newNet.price} onChange={e => setNewNet(p => ({...p, price: e.target.value}))} placeholder="USD price" className="h-6 text-[10px]"/>
                  </div>
                  <Input value={newNet.rpc} onChange={e => setNewNet(p => ({...p, rpc: e.target.value}))} placeholder="RPC URL (optional)" className="h-6 text-[10px]"/>
                  <div className="flex gap-1">
                    <Button size="sm" className="flex-1 h-6 text-[10px] bg-emerald-600 hover:bg-emerald-500" onClick={addCustomChain} disabled={!newNet.name || !newNet.chainId}>
                      Add
                    </Button>
                    <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => setShowAddNetwork(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-1 mb-2">
                {allChains.map(c => (
                  <button key={c.id} onClick={()=>setSelectedChain(c)}
                    className={cn('text-[10px] px-2 py-1 rounded border transition-all text-left relative',
                      selectedChain.id===c.id ? `border-amber-500/50 bg-amber-500/10 ${c.color}` : 'border-border text-muted-foreground/50 hover:border-muted-foreground/30')}>
                    <div className={cn('font-semibold',selectedChain.id===c.id?c.color:'')}>{c.name}</div>
                    <div className="text-[9px] opacity-60">{c.symbol}</div>
                    {c.custom && (
                      <button onClick={e => { e.stopPropagation(); removeCustomChain(c.id) }}
                        className="absolute top-0.5 right-0.5 opacity-0 hover:opacity-100 text-rose-400">
                        <X className="w-2.5 h-2.5"/>
                      </button>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="mb-1 block">Contract</Label>
              <select value={selectedAbi?.path||''} onChange={e=>setSelectedAbi(abis.find(a=>a.path===e.target.value)||null)}
                className="w-full h-7 text-xs bg-background border border-border rounded px-2 outline-none">
                <option value="">Select contract…</option>
                {abis.map(a => <option key={a.path} value={a.path}>{a.contractName}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Gas Price (gwei)</Label>
                  <button onClick={fetchLiveGas} className="text-[9px] text-blue-400 hover:text-blue-300 flex items-center gap-1">
                    {fetchingGas ? <RefreshCw className="w-2.5 h-2.5 animate-spin"/> : '↺'} live
                  </button>
                </div>
                <Input value={gasPrice} onChange={e=>setGasPrice(e.target.value)} className="h-7 text-xs"/>
                {liveGasPrice && <p className="text-[9px] text-emerald-400 mt-0.5">Live: {liveGasPrice} gwei</p>}
              </div>
              <div>
                <Label className="mb-1 block">{selectedChain.symbol} Price (USD)</Label>
                <Input value={String(nativePrice)} readOnly className="h-7 text-xs text-muted-foreground/60"/>
              </div>
            </div>

            <Button size="sm" className="w-full h-7 text-xs gap-1" onClick={estimateAll} disabled={!selectedAbi||loading}>
              {loading ? <RefreshCw className="w-3 h-3 animate-spin"/> : <Zap className="w-3 h-3"/>}
              Estimate All Functions on {selectedChain.name}
            </Button>
          </div>

          <ScrollArea className="flex-1 overflow-y-auto">
            <div className="p-3 space-y-1.5">
              {estimates.length===0 ? (
                <div className="text-center py-8 text-muted-foreground/30 text-sm">Select a contract and estimate</div>
              ) : estimates.sort((a,b)=>parseInt(b.gasEstimate)-parseInt(a.gasEstimate)).map((e,i) => (
                <div key={`est-${i}`} className="rounded-lg border border-border bg-card px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-semibold">{e.functionName||'(constructor)'}</span>
                    <span className={cn('text-[11px] font-mono', selectedChain.color)}>{parseInt(e.gasEstimate).toLocaleString()} gas</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] font-mono text-muted-foreground/60">{e.gasCostETH} {selectedChain.symbol}</span>
                    <span className="text-[10px] font-mono text-emerald-400">${e.gasCostUSD}</span>
                  </div>
                  <div className="mt-1.5 h-1 rounded-full bg-border overflow-hidden">
                    <div className="h-full rounded-full bg-amber-500/60" style={{width:`${Math.min(100,(parseInt(e.gasEstimate)/300000)*100)}%`}}/>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Profiler */}
        <div className="flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-card/50">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5 text-sky-400"/>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Live Gas Profiler (from Tx History)</p>
            </div>
          </div>
          <ScrollArea className="flex-1 overflow-y-auto">
            <div className="p-4 space-y-2">
              {txGas.length===0 ? (
                <div className="text-center py-8 text-muted-foreground/30 text-sm">Send transactions to see gas profiling</div>
              ) : txGas.map((t,i) => (
                <div key={`txgas-${i}`} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono truncate max-w-[60%]">{t.fn}</span>
                    <span className={cn('text-[11px] font-mono', t.status==='success'?'text-emerald-400':'text-rose-400')}>
                      {t.gas.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-4 rounded bg-border overflow-hidden relative">
                    <div className={cn('h-full rounded',t.status==='success'?'bg-emerald-500/40':'bg-rose-500/40')} style={{width:`${(t.gas/maxGas)*100}%`}}/>
                    <span className="absolute right-2 top-0 bottom-0 flex items-center text-[10px] font-mono text-muted-foreground/50">{t.hash}</span>
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
