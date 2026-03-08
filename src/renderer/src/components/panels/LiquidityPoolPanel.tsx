import { useState, useCallback, useEffect } from 'react'
import { cn } from '../../lib/utils'
import { DeployedContract } from '../../types'
import { Droplets, ArrowRightLeft, Plus, Minus, Activity, RefreshCw, Link, AlertCircle, Unlink, Globe, ChevronDown } from 'lucide-react'
import { Button } from '../ui/button'
import { Input, Label } from '../ui/primitives'

const NETWORKS = [
  { name: 'Hardhat Local', rpc: 'http://127.0.0.1:8545', chainId: 1337 },
  { name: 'Base Sepolia', rpc: 'https://sepolia.base.org', chainId: 84532 },
  { name: 'Lisk Sepolia', rpc: 'https://rpc.sepolia-api.lisk.com', chainId: 4202 },
  { name: 'Sepolia', rpc: 'https://rpc.sepolia.org', chainId: 11155111 },
  { name: 'Base', rpc: 'https://mainnet.base.org', chainId: 8453 },
  { name: 'Arbitrum', rpc: 'https://arb1.arbitrum.io/rpc', chainId: 42161 },
  { name: 'Polygon', rpc: 'https://polygon-rpc.com', chainId: 137 },
]

interface Props {
  deployedContracts?: DeployedContract[]
  rpcUrl?: string
}

interface PoolState {
  reserveA: number; reserveB: number
  tokenA: string; tokenB: string
  tokenAAddress: string; tokenBAddress: string
  poolAddress: string
  fee: number; totalLPTokens: number
}
interface Trade {
  id: string; type: 'swap_a_b' | 'swap_b_a' | 'add_liq' | 'remove_liq'
  amountIn: number; amountOut: number; priceImpact: number; newPrice: number; timestamp: number
}

async function rpc(url: string, method: string, params: unknown[]) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })
  const d = await r.json()
  if (d.error) throw new Error(d.error.message)
  return d.result as string
}

function call(url: string, to: string, data: string) {
  return rpc(url, 'eth_call', [{ to, data }, 'latest'])
}

// ERC-20 selectors
const SEL = {
  symbol:      '0x95d89b41',
  decimals:    '0x313ce567',
  balanceOf:   (addr: string) => '0x70a08231' + addr.replace('0x','').padStart(64,'0'),
  totalSupply: '0x18160ddd',
  token0:      '0x0dfe1681',
  token1:      '0xd21220a7',
  getReserves: '0x0902f1ac',
}

function decodeSym(hex: string) {
  if (!hex || hex === '0x') return ''
  try {
    const data = hex.slice(2)
    const offset = parseInt(data.slice(0, 64), 16) * 2
    const len    = parseInt(data.slice(offset, offset + 64), 16) * 2
    return Buffer.from(data.slice(offset + 64, offset + 64 + len), 'hex').toString('utf8').replace(/\0/g,'')
  } catch { return '' }
}
function decodeUint(hex: string) { return hex && hex !== '0x' ? BigInt(hex) : 0n }
function decodeAddr(hex: string) { return hex && hex.length >= 42 ? '0x' + hex.slice(-40) : '' }

const INIT: PoolState = {
  reserveA: 100000, reserveB: 50000,
  tokenA: 'ETH', tokenB: 'USDC',
  tokenAAddress: '', tokenBAddress: '', poolAddress: '',
  fee: 30, totalLPTokens: Math.sqrt(100000 * 50000),
}

export default function LiquidityPoolPanel({ deployedContracts = [], rpcUrl = 'http://127.0.0.1:8545' }: Props) {
  const [activeRpc, setActiveRpc] = useState(rpcUrl)
  const [selectedNetwork, setSelectedNetwork] = useState(NETWORKS[0])
  const [showNetworkPicker, setShowNetworkPicker] = useState(false)
  const [mockTokenA, setMockTokenA] = useState<DeployedContract | null>(null)
  const [mockTokenB, setMockTokenB] = useState<DeployedContract | null>(null)
  const [pool, setPool]           = useState<PoolState>(INIT)
  const [trades, setTrades]       = useState<Trade[]>([])
  const [swapAmount, setSwapAmount] = useState('1000')
  const [swapDir, setSwapDir]     = useState<'a_to_b' | 'b_to_a'>('a_to_b')
  const [addA, setAddA]           = useState('1000')
  const [removePct, setRemovePct] = useState('10')
  const [mode, setMode]           = useState<'sim' | 'live'>('sim')
  const [poolAddr, setPoolAddr]   = useState('')
  const [walletAddr, setWalletAddr] = useState('')
  const [balA, setBalA]           = useState<string|null>(null)
  const [balB, setBalB]           = useState<string|null>(null)
  const [loading, setLoading]     = useState(false)
  const [err, setErr]             = useState('')

  // Detect AMM / ERC-20 contracts from deployed list
  const ammContracts   = deployedContracts.filter(c => c.abi.some(i => i.name === 'getReserves') || c.abi.some(i => i.name === 'token0'))
  const tokenContracts = deployedContracts.filter(c => c.abi.some(i => i.name === 'balanceOf') && c.abi.some(i => i.name === 'transfer'))

  // Sync activeRpc when network changes
  const switchNetwork = (net: typeof NETWORKS[0]) => {
    setSelectedNetwork(net)
    setActiveRpc(net.rpc)
    setShowNetworkPicker(false)
  }

  // Apply mock tokens as pool tokens
  const applyMockTokens = () => {
    if (mockTokenA) setPool(p => ({ ...p, tokenA: mockTokenA.name, tokenAAddress: mockTokenA.address }))
    if (mockTokenB) setPool(p => ({ ...p, tokenB: mockTokenB.name, tokenBAddress: mockTokenB.address }))
  }

  const fetchLive = async (addr: string) => {
    setLoading(true); setErr('')
    try {
      const t0h = await call(activeRpc, addr, SEL.token0)
      const t1h = await call(activeRpc, addr, SEL.token1)
      const t0  = decodeAddr(t0h)
      const t1  = decodeAddr(t1h)
      const resHex = await call(activeRpc, addr, SEL.getReserves)
      const r0 = decodeUint('0x' + resHex.slice(2, 66))
      const r1 = decodeUint('0x' + resHex.slice(66,130))

      let sym0 = 'TK0', sym1 = 'TK1'
      try { sym0 = decodeSym(await call(activeRpc, t0, SEL.symbol)) || 'TK0' } catch {}
      try { sym1 = decodeSym(await call(activeRpc, t1, SEL.symbol)) || 'TK1' } catch {}

      setPool(p => ({ ...p,
        tokenA: sym0, tokenB: sym1,
        tokenAAddress: t0, tokenBAddress: t1, poolAddress: addr,
        reserveA: Number(r0) / 1e18, reserveB: Number(r1) / 1e18,
      }))
      setTrades([])
    } catch (e: any) { setErr(e.message) }
    setLoading(false)
  }

  const loadBalances = async () => {
    if (!walletAddr || !pool.tokenAAddress || !pool.tokenBAddress) return
    try {
      const ha = await call(activeRpc, pool.tokenAAddress, SEL.balanceOf(walletAddr))
      const hb = await call(activeRpc, pool.tokenBAddress, SEL.balanceOf(walletAddr))
      setBalA((Number(decodeUint(ha)) / 1e18).toFixed(4))
      setBalB((Number(decodeUint(hb)) / 1e18).toFixed(4))
    } catch {}
  }

  useEffect(() => { if (mode === 'live' && walletAddr && pool.tokenAAddress) loadBalances() }, [walletAddr, pool.tokenAAddress])

  const price = pool.reserveB / pool.reserveA
  const k     = pool.reserveA * pool.reserveB

  const getOut = useCallback((amtIn: number, rIn: number, rOut: number, fee: number) => {
    const withFee = amtIn * (10000 - fee) / 10000
    return (withFee * rOut) / (rIn + withFee)
  }, [])

  const previewAmt    = parseFloat(swapAmount) || 0
  const previewOut    = swapDir === 'a_to_b' ? getOut(previewAmt, pool.reserveA, pool.reserveB, pool.fee) : getOut(previewAmt, pool.reserveB, pool.reserveA, pool.fee)
  const previewImpact = previewAmt / ((swapDir === 'a_to_b' ? pool.reserveA : pool.reserveB) + previewAmt) * 100

  const doSwap = () => {
    if (previewAmt <= 0) return
    let p = { ...pool }
    if (swapDir === 'a_to_b') { p.reserveA += previewAmt; p.reserveB -= previewOut }
    else                       { p.reserveB += previewAmt; p.reserveA -= previewOut }
    setPool(p)
    setTrades(prev => [{ id: crypto.randomUUID(), type: swapDir === 'a_to_b' ? 'swap_a_b' : 'swap_b_a',
      amountIn: previewAmt, amountOut: previewOut, priceImpact: previewImpact,
      newPrice: p.reserveB / p.reserveA, timestamp: Date.now() }, ...prev.slice(0,49)])
  }
  const doAdd = () => {
    const a = parseFloat(addA) || 0; if (!a) return
    const b = a * price
    setPool(p => ({ ...p, reserveA: p.reserveA + a, reserveB: p.reserveB + b,
      totalLPTokens: p.totalLPTokens + Math.sqrt((p.reserveA+a)*(p.reserveB+b)) - p.totalLPTokens }))
    setTrades(prev => [{ id: crypto.randomUUID(), type: 'add_liq', amountIn: a, amountOut: b, priceImpact: 0, newPrice: price, timestamp: Date.now() }, ...prev.slice(0,49)])
  }
  const doRemove = () => {
    const pct = parseFloat(removePct) / 100
    setPool(p => ({ ...p, reserveA: p.reserveA*(1-pct), reserveB: p.reserveB*(1-pct), totalLPTokens: p.totalLPTokens*(1-pct) }))
    setTrades(prev => [{ id: crypto.randomUUID(), type: 'remove_liq', amountIn: pct*100, amountOut: pool.reserveA*pct, priceImpact: 0, newPrice: price, timestamp: Date.now() }, ...prev.slice(0,49)])
  }

  const ph   = [{ price, i: 0 }, ...trades.slice().reverse().map((t,i) => ({ price: t.newPrice, i: i+1 }))]
  const maxP = Math.max(...ph.map(p => p.price))
  const minP = Math.min(...ph.map(p => p.price))
  const pR   = maxP - minP || 1
  const H    = 80
  const pts  = ph.map((p,i) => `${(i/Math.max(ph.length-1,1))*280},${H - ((p.price-minP)/pR)*H}`).join(' ')

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left ── */}
      <div className="w-80 flex-shrink-0 border-r border-border bg-card flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Droplets className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-semibold">LP Simulator</span>
            </div>
            <div className="flex bg-muted rounded overflow-hidden">
              {(['sim','live'] as const).map(m => (
                <button key={m} onClick={() => setMode(m)}
                  className={cn('px-2.5 py-0.5 text-[10px] transition-colors',
                    mode === m ? 'bg-cyan-600 text-white' : 'text-muted-foreground hover:text-foreground')}>
                  {m === 'sim' ? '🧪 Sim' : '🔴 Live'}
                </button>
              ))}
            </div>
          </div>

          {/* Live mode: pool picker */}
          {mode === 'live' && (
            <div className="space-y-1.5">
              {ammContracts.length > 0 && (
                <select className="w-full h-7 text-xs bg-muted/20 border border-border rounded px-2"
                  onChange={e => { setPoolAddr(e.target.value) }}>
                  <option value="">Pick deployed pool...</option>
                  {ammContracts.map(c => <option key={c.id} value={c.address}>{c.name} — {c.address.slice(0,10)}…</option>)}
                </select>
              )}
              <div className="flex gap-1">
                <Input value={poolAddr} onChange={e => setPoolAddr(e.target.value)}
                  placeholder="Pool address (0x…)" className="h-7 text-xs flex-1 font-mono" />
                <Button size="sm" className="h-7 px-2 bg-cyan-600" onClick={() => fetchLive(poolAddr)} disabled={!poolAddr || loading}>
                  {loading ? <RefreshCw className="w-3 h-3 animate-spin"/> : <Link className="w-3 h-3"/>}
                </Button>
              </div>
              {pool.poolAddress && (
                <div className="flex gap-1">
                  <Input value={walletAddr} onChange={e => setWalletAddr(e.target.value)}
                    placeholder="Your wallet for balances…" className="h-7 text-xs flex-1 font-mono" />
                  <Button size="sm" variant="outline" className="h-7 px-2" onClick={loadBalances}>↺</Button>
                </div>
              )}
              {err && <p className="text-[10px] text-rose-400 flex items-center gap-1"><AlertCircle className="w-3 h-3"/>{err}</p>}
            </div>
          )}
        </div>

        {/* Sim config */}
        {mode === 'sim' && (
          <div className="px-4 py-2 border-b border-border grid grid-cols-2 gap-2">
            {[{ label:'Token A', val: pool.tokenA, set: (v:string) => setPool(p=>({...p,tokenA:v})) },
              { label:'Token B', val: pool.tokenB, set: (v:string) => setPool(p=>({...p,tokenB:v})) }].map(({label,val,set}) => (
              <div key={label}>
                <Label className="text-[10px] mb-0.5 block">{label}</Label>
                <Input value={val} onChange={e => set(e.target.value)} className="h-7 text-xs" />
              </div>
            ))}
            <div className="col-span-2">
              <Label className="text-[10px] mb-0.5 block">Fee (bps: 30 = 0.3%)</Label>
              <Input value={pool.fee} onChange={e => setPool(p=>({...p,fee:+e.target.value||30}))} className="h-7 text-xs" type="number"/>
            </div>
          </div>
        )}

        {/* Live balances */}
        {mode === 'live' && pool.tokenAAddress && (
          <div className="px-4 py-2 border-b border-border grid grid-cols-2 gap-2">
            <div className="bg-muted/20 rounded p-2">
              <p className="text-[9px] text-muted-foreground">{pool.tokenA}</p>
              <p className="text-xs font-mono text-cyan-400">{balA ?? '—'}</p>
            </div>
            <div className="bg-muted/20 rounded p-2">
              <p className="text-[9px] text-muted-foreground">{pool.tokenB}</p>
              <p className="text-xs font-mono text-violet-400">{balB ?? '—'}</p>
            </div>
          </div>
        )}

        {/* Mock Token Picker */}
        {tokenContracts.length > 0 && (
          <div className="px-4 pb-2 space-y-2 border-b border-border/50">
            <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">Select Mock Tokens</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] text-muted-foreground/40 block mb-1">Token A</label>
                <select value={mockTokenA?.address || ''} onChange={e => setMockTokenA(tokenContracts.find(c => c.address === e.target.value) || null)}
                  className="w-full h-6 text-[10px] bg-background border border-border rounded px-1.5 outline-none">
                  <option value="">Select…</option>
                  {tokenContracts.map(c => <option key={c.id} value={c.address}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[9px] text-muted-foreground/40 block mb-1">Token B</label>
                <select value={mockTokenB?.address || ''} onChange={e => setMockTokenB(tokenContracts.find(c => c.address === e.target.value) || null)}
                  className="w-full h-6 text-[10px] bg-background border border-border rounded px-1.5 outline-none">
                  <option value="">Select…</option>
                  {tokenContracts.map(c => <option key={c.id} value={c.address}>{c.name}</option>)}
                </select>
              </div>
            </div>
            {(mockTokenA || mockTokenB) && (
              <button onClick={applyMockTokens}
                className="w-full text-[10px] py-1 rounded border border-sky-500/30 text-sky-400 hover:bg-sky-500/10 transition-colors">
                Apply tokens to pool
              </button>
            )}
          </div>
        )}

        {/* Mock token contracts list */}
        {tokenContracts.length > 0 && (
          <div className="px-4 py-2 border-b border-border">
            <p className="text-[9px] text-muted-foreground/50 uppercase tracking-widest mb-1">Mock Tokens Detected</p>
            <div className="space-y-0.5">
              {tokenContracts.slice(0,4).map(c => (
                <div key={c.id} className="flex items-center gap-2 text-[10px]">
                  <span className="text-emerald-400">●</span>
                  <span className="font-mono text-foreground/70">{c.name}</span>
                  <span className="text-muted-foreground/40 truncate">{c.address.slice(0,10)}…</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Swap */}
          <div>
            <p className="text-[9px] text-muted-foreground/50 uppercase tracking-widest mb-2">🔄 Swap</p>
            <div className="flex rounded overflow-hidden border border-border mb-2">
              {(['a_to_b','b_to_a'] as const).map(d => (
                <button key={d} onClick={() => setSwapDir(d)}
                  className={cn('flex-1 text-xs py-1.5 transition-all',
                    swapDir===d ? 'bg-cyan-500/20 text-cyan-300' : 'text-muted-foreground/50 hover:bg-muted/20')}>
                  {d==='a_to_b' ? `${pool.tokenA} → ${pool.tokenB}` : `${pool.tokenB} → ${pool.tokenA}`}
                </button>
              ))}
            </div>
            <Input value={swapAmount} onChange={e=>setSwapAmount(e.target.value)} className="h-7 text-xs mb-1" placeholder="Amount…"/>
            {previewAmt > 0 && (
              <div className="text-[10px] mb-2 p-2 bg-muted/10 rounded border border-border space-y-0.5 text-muted-foreground/60">
                <div>Out: <span className="text-cyan-300 font-mono">{previewOut.toFixed(4)}</span></div>
                <div>Fee: <span className="font-mono">{(previewAmt * pool.fee / 10000).toFixed(4)}</span></div>
                <div className={previewImpact>5?'text-rose-400':previewImpact>1?'text-amber-400':'text-emerald-400'}>Impact: {previewImpact.toFixed(3)}%</div>
              </div>
            )}
            <Button className="w-full h-8 text-xs gap-1.5 bg-cyan-600 hover:bg-cyan-500" onClick={doSwap} disabled={!previewAmt}>
              <ArrowRightLeft className="w-3.5 h-3.5"/> Simulate Swap
            </Button>
          </div>
          {/* Add liq */}
          <div>
            <p className="text-[9px] text-muted-foreground/50 uppercase tracking-widest mb-2">➕ Add Liquidity</p>
            <Input value={addA} onChange={e=>setAddA(e.target.value)} className="h-7 text-xs mb-1" placeholder={`${pool.tokenA} amount`}/>
            <p className="text-[10px] text-muted-foreground/50 mb-2">+ {((parseFloat(addA)||0)*price).toFixed(2)} {pool.tokenB} (proportional)</p>
            <Button variant="outline" className="w-full h-8 text-xs gap-1.5 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10" onClick={doAdd}>
              <Plus className="w-3.5 h-3.5"/> Add Liquidity
            </Button>
          </div>
          {/* Remove */}
          <div>
            <p className="text-[9px] text-muted-foreground/50 uppercase tracking-widest mb-2">➖ Remove Liquidity</p>
            <div className="flex gap-1 mb-2">
              {['10','25','50','100'].map(p => (
                <button key={p} onClick={()=>setRemovePct(p)}
                  className={cn('flex-1 text-[10px] py-1 rounded border transition-all',
                    removePct===p?'bg-rose-500/20 border-rose-500/40 text-rose-400':'border-border text-muted-foreground/50')}>
                  {p}%
                </button>
              ))}
            </div>
            <Button variant="outline" className="w-full h-8 text-xs gap-1.5 border-rose-500/30 text-rose-400 hover:bg-rose-500/10" onClick={doRemove}>
              <Minus className="w-3.5 h-3.5"/> Remove {removePct}%
            </Button>
          </div>
        </div>
      </div>

      {/* ── Right ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-px bg-border border-b border-border flex-shrink-0">
          {[
            { label:`Reserve ${pool.tokenA}`, value: pool.reserveA.toLocaleString(undefined,{maximumFractionDigits:2}), color:'text-cyan-400' },
            { label:`Reserve ${pool.tokenB}`, value: pool.reserveB.toLocaleString(undefined,{maximumFractionDigits:2}), color:'text-violet-400' },
            { label:'Price',                  value: `${price.toFixed(4)} ${pool.tokenB}/${pool.tokenA}`,                color:'text-amber-400' },
            { label:'k (constant)',            value: k.toExponential(3),                                                 color:'text-emerald-400' },
          ].map(({label,value,color}) => (
            <div key={label} className="bg-card px-3 py-2">
              <div className="text-[9px] text-muted-foreground/50 uppercase tracking-widest">{label}</div>
              <div className={cn('text-xs font-mono font-semibold mt-0.5 truncate', color)}>{value}</div>
            </div>
          ))}
        </div>

        {/* Price chart */}
        {ph.length > 1 && (
          <div className="px-4 pt-3 pb-2 border-b border-border flex-shrink-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] text-muted-foreground/50 uppercase tracking-widest">Price Chart</span>
              {mode==='live' && pool.poolAddress && <span className="text-[10px] text-emerald-400">🔴 {pool.poolAddress.slice(0,12)}…</span>}
            </div>
            <svg viewBox={`0 0 280 ${H}`} className="w-full h-16" preserveAspectRatio="none">
              <polyline points={pts} fill="none" stroke="#22d3ee" strokeWidth="1.5"/>
              <polyline points={`0,${H} ${pts} 280,${H}`} fill="rgba(34,211,238,0.08)" stroke="none"/>
            </svg>
          </div>
        )}

        {/* Trade log */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-2 border-b border-border bg-card/40 sticky top-0 flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-cyan-400"/>
            <span className="text-xs font-semibold">Trade Log</span>
            <span className="text-[10px] text-muted-foreground/40">{trades.length} trades</span>
          </div>
          {trades.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground/30 gap-2">
              <Droplets className="w-8 h-8 opacity-20"/>
              <p className="text-xs">No trades yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {trades.map(t => {
                const isAdd = t.type==='add_liq', isRem = t.type==='remove_liq'
                const col = isAdd?'text-emerald-400':isRem?'text-rose-400':'text-cyan-400'
                const lbl = t.type==='swap_a_b'?`${pool.tokenA}→${pool.tokenB}`:t.type==='swap_b_a'?`${pool.tokenB}→${pool.tokenA}`:isAdd?'Add Liq':'Remove Liq'
                return (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-2 text-xs font-mono hover:bg-accent/20">
                    <span className={col}>{lbl}</span>
                    {!isAdd&&!isRem && <span className="text-muted-foreground/50">{t.amountIn.toFixed(2)}→{t.amountOut.toFixed(4)}</span>}
                    {!isAdd&&!isRem && <span className={cn('text-[10px] ml-auto',t.priceImpact>5?'text-rose-400':t.priceImpact>1?'text-amber-400':'text-muted-foreground/40')}>{t.priceImpact.toFixed(2)}%</span>}
                    <span className="text-[10px] text-muted-foreground/30">@{t.newPrice.toFixed(4)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
