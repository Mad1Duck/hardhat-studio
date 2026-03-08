import { useState, useCallback } from 'react'
import { DeployedContract } from '../../types'
import { Button } from '../ui/button'
import { Input, Label, ScrollArea } from '../ui/primitives'
import { cn } from '../../lib/utils'
import { Coins, RefreshCw, Copy, Check, Search, ExternalLink, AlertCircle } from 'lucide-react'

interface Props {
  rpcUrl: string
  deployedContracts: DeployedContract[]
}

interface TokenInfo {
  address: string
  name: string
  symbol: string
  decimals: number
  totalSupply: string
  balances: { address: string; balance: string; formatted: string }[]
}

const ERC20_ABI_CALLS = [
  { fn: 'name', sig: '0x06fdde03' },
  { fn: 'symbol', sig: '0x95d89b41' },
  { fn: 'decimals', sig: '0x313ce567' },
  { fn: 'totalSupply', sig: '0x18160ddd' },
]

async function ethCall(rpcUrl: string, to: string, data: string): Promise<string | null> {
  try {
    const r = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to, data }, 'latest'] })
    })
    const d = await r.json()
    return d.result && d.result !== '0x' ? d.result : null
  } catch { return null }
}

function decodeString(hex: string): string {
  try {
    if (!hex || hex === '0x') return ''
    // Skip first 64 chars (offset) and next 64 (length), then decode
    const clean = hex.startsWith('0x') ? hex.slice(2) : hex
    if (clean.length < 128) return ''
    const lenHex = clean.slice(64, 128)
    const len = parseInt(lenHex, 16)
    const strHex = clean.slice(128, 128 + len * 2)
    let result = ''
    for (let i = 0; i < strHex.length; i += 2) {
      const code = parseInt(strHex.slice(i, i + 2), 16)
      if (code > 0) result += String.fromCharCode(code)
    }
    return result
  } catch { return '' }
}

function decodeUint(hex: string): bigint {
  try {
    if (!hex || hex === '0x') return 0n
    return BigInt(hex)
  } catch { return 0n }
}

function formatUnits(value: bigint, decimals: number): string {
  if (value === 0n) return '0'
  const divisor = 10n ** BigInt(decimals)
  const whole = value / divisor
  const frac = value % divisor
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '').slice(0, 6)
  return fracStr ? `${whole}.${fracStr}` : whole.toString()
}

function balanceOfCalldata(address: string): string {
  const cleanAddr = address.replace('0x', '').toLowerCase().padStart(64, '0')
  return '0x70a08231' + cleanAddr
}

export default function ERC20TokenReader({ rpcUrl, deployedContracts }: Props) {
  const [tokenAddress, setTokenAddress] = useState('')
  const [watchAddresses, setWatchAddresses] = useState('')
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  const loadToken = useCallback(async () => {
    const addr = tokenAddress.trim()
    if (!addr || !addr.startsWith('0x')) { setError('Enter a valid contract address'); return }
    setLoading(true)
    setError('')
    setTokenInfo(null)

    try {
      const [nameHex, symbolHex, decimalsHex, supplyHex] = await Promise.all(
        ERC20_ABI_CALLS.map(c => ethCall(rpcUrl, addr, c.sig))
      )

      const name = nameHex ? decodeString(nameHex) : '?'
      const symbol = symbolHex ? decodeString(symbolHex) : '?'
      const decimals = decimalsHex ? Number(decodeUint(decimalsHex)) : 18
      const totalSupply = supplyHex ? formatUnits(decodeUint(supplyHex), decimals) : '?'

      // Fetch balances for watch addresses
      const balances: TokenInfo['balances'] = []
      const addrsToWatch = watchAddresses.split('\n').map(a => a.trim()).filter(a => a.startsWith('0x'))
      for (const wAddr of addrsToWatch.slice(0, 20)) {
        const balHex = await ethCall(rpcUrl, addr, balanceOfCalldata(wAddr))
        const bal = balHex ? decodeUint(balHex) : 0n
        balances.push({
          address: wAddr,
          balance: bal.toString(),
          formatted: formatUnits(bal, decimals),
        })
      }

      setTokenInfo({ address: addr, name, symbol, decimals, totalSupply, balances })
    } catch (err: any) {
      setError(err?.message || 'Failed to read token')
    }
    setLoading(false)
  }, [tokenAddress, rpcUrl, watchAddresses])

  const copy = async (key: string, val: string) => {
    await navigator.clipboard.writeText(val)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  // Quick-fill deployed contracts
  const erc20Contracts = deployedContracts.filter(c => {
    const fnNames = c.abi.map(i => i.name)
    return fnNames.includes('transfer') && fnNames.includes('balanceOf') && fnNames.includes('totalSupply')
  })

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card">
        <Coins className="w-4 h-4 text-yellow-400"/>
        <span className="text-sm font-semibold">ERC-20 Token Reader</span>
        <span className="text-[10px] bg-yellow-500/10 text-yellow-400 px-1.5 py-0.5 rounded">Read balances & metadata</span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Config */}
        <div className="w-72 flex-shrink-0 border-r border-border flex flex-col bg-card/50 overflow-y-auto">
          <div className="p-3 border-b border-border space-y-2">
            <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Token Address</Label>
            <div className="flex gap-1">
              <Input value={tokenAddress} onChange={e => setTokenAddress(e.target.value)}
                placeholder="0x..." className="h-7 text-xs font-mono flex-1"/>
            </div>

            {/* Quick-fill ERC20 deployed contracts */}
            {erc20Contracts.length > 0 && (
              <div>
                <p className="text-[9px] text-muted-foreground/30 mb-1">Quick fill from deployed:</p>
                <div className="space-y-1">
                  {erc20Contracts.map(c => (
                    <button key={c.id} onClick={() => setTokenAddress(c.address)}
                      className={cn('w-full text-left px-2 py-1 rounded border text-[10px] transition-all flex items-center justify-between',
                        tokenAddress === c.address ? 'border-yellow-500/40 bg-yellow-500/10' : 'border-border hover:border-muted-foreground/30')}>
                      <span className="font-medium">{c.name}</span>
                      <span className="font-mono text-muted-foreground/40">{c.address.slice(0, 8)}…</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="p-3 border-b border-border flex-1 space-y-2">
            <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Watch Addresses</Label>
            <p className="text-[9px] text-muted-foreground/30">One address per line — check balances for each</p>
            <textarea
              value={watchAddresses}
              onChange={e => setWatchAddresses(e.target.value)}
              placeholder={"0x...\n0x...\n0x..."}
              className="w-full h-40 resize-none rounded border border-border bg-background p-2 text-[10px] font-mono text-muted-foreground/70 outline-none focus:border-yellow-500/30"
            />
          </div>

          <div className="p-3">
            <Button onClick={loadToken} disabled={loading || !tokenAddress.trim()}
              className="w-full bg-yellow-600 hover:bg-yellow-500 gap-2">
              {loading ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Search className="w-4 h-4"/>}
              {loading ? 'Reading…' : 'Read Token'}
            </Button>
          </div>
        </div>

        {/* Results */}
        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-2xl space-y-6">
            {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 rounded p-3 flex items-center gap-2 text-xs text-rose-400">
                <AlertCircle className="w-4 h-4 flex-shrink-0"/>
                {error}
              </div>
            )}

            {!tokenInfo && !loading && !error && (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground/30">
                <Coins className="w-12 h-12 opacity-20"/>
                <p className="text-sm">Enter a token address and click Read Token</p>
                <div className="text-[11px] space-y-1 text-center">
                  <p>✓ Reads name, symbol, decimals</p>
                  <p>✓ Shows total supply</p>
                  <p>✓ Checks balances for any address</p>
                </div>
              </div>
            )}

            {tokenInfo && (
              <>
                {/* Token Info Card */}
                <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-xl font-bold">{tokenInfo.symbol}</h2>
                      <p className="text-sm text-muted-foreground/60">{tokenInfo.name}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground/40">Decimals</div>
                      <div className="text-lg font-mono text-yellow-400">{tokenInfo.decimals}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Contract Address', value: tokenInfo.address, mono: true, copy: 'addr' },
                      { label: 'Total Supply', value: `${tokenInfo.totalSupply} ${tokenInfo.symbol}`, mono: true, copy: null },
                    ].map(({ label, value, mono, copy: ckey }) => (
                      <div key={label} className="rounded-lg bg-background/60 border border-border/50 p-3">
                        <div className="text-[10px] text-muted-foreground/40 mb-1">{label}</div>
                        <div className="flex items-center gap-1.5">
                          <span className={cn('text-xs flex-1 min-w-0', mono ? 'font-mono text-emerald-300/70 truncate' : 'text-foreground/80')}>{value}</span>
                          {ckey && (
                            <button onClick={() => copy(ckey, value)}>
                              {copied === ckey ? <Check className="w-3 h-3 text-emerald-400"/> : <Copy className="w-3 h-3 text-muted-foreground/30 hover:text-muted-foreground"/>}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ERC20 Interface Checklist */}
                <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                  <h3 className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-widest">ERC-20 Standard Functions</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {['transfer', 'transferFrom', 'approve', 'allowance', 'balanceOf', 'totalSupply', 'name', 'symbol', 'decimals'].map(fn => (
                      <div key={fn} className="flex items-center gap-2 text-[11px]">
                        <div className="w-3.5 h-3.5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"/>
                        </div>
                        <code className="font-mono text-muted-foreground/70">{fn}()</code>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Balances */}
                {tokenInfo.balances.length > 0 && (
                  <div className="rounded-lg border border-border bg-card overflow-hidden">
                    <div className="px-4 py-3 border-b border-border bg-card/50">
                      <h3 className="text-xs font-semibold">Address Balances</h3>
                    </div>
                    <div className="divide-y divide-border/40">
                      {tokenInfo.balances.map((b, i) => (
                        <div key={i} className="flex items-center justify-between px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-sky-400/40 flex-shrink-0"/>
                            <code className="text-[11px] font-mono text-muted-foreground/60 truncate max-w-[180px]">{b.address}</code>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-mono font-semibold">{b.formatted}</div>
                            <div className="text-[10px] text-muted-foreground/40">{tokenInfo.symbol}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
