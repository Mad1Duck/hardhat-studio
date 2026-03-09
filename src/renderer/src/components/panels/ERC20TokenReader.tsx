import { useState, useCallback } from 'react'
import { DeployedContract } from '../../types'
import { Button } from '../ui/button'
import { Input, Label, ScrollArea } from '../ui/primitives'
import { cn } from '../../lib/utils'
import { Coins, RefreshCw, Copy, Check, Search, ExternalLink, AlertCircle, Lock, TrendingUp, Sparkles, Users, ChevronDown, ChevronUp } from 'lucide-react'

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
  totalSupplyRaw: bigint
  maxSupply: string | null      // null = no cap found
  maxSupplyRaw: bigint | null
  mintable: boolean             // has a public mint function
  burnable: boolean             // has a public burn function
  hasOwner: boolean             // Ownable / has owner()
  balances: { address: string; balance: string; formatted: string }[]
}

const ERC20_ABI_CALLS = [
  { fn: 'name', sig: '0x06fdde03' },
  { fn: 'symbol', sig: '0x95d89b41' },
  { fn: 'decimals', sig: '0x313ce567' },
  { fn: 'totalSupply', sig: '0x18160ddd' },
]

// ─── Hardhat default accounts ────────────────────────────────────────────────
const HH_ACCOUNTS = [
  { idx: 0,  address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', label: 'Account 0' },
  { idx: 1,  address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', label: 'Account 1' },
  { idx: 2,  address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', label: 'Account 2' },
  { idx: 3,  address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906', label: 'Account 3' },
  { idx: 4,  address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', label: 'Account 4' },
  { idx: 5,  address: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc', label: 'Account 5' },
  { idx: 6,  address: '0x976EA74026E726554dB657fA54763abd0C3a0aa9', label: 'Account 6' },
  { idx: 7,  address: '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955', label: 'Account 7' },
  { idx: 8,  address: '0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f', label: 'Account 8' },
  { idx: 9,  address: '0xa0Ee7A142d267C1f36714E4a8F75612F20a79720', label: 'Account 9' },
  { idx: 10, address: '0xBcd4042DE499D14e55001CcbB24a551F3b954096', label: 'Account 10' },
  { idx: 11, address: '0x71bE63f3384f5fb98995898A86B02Fb2426c5788', label: 'Account 11' },
  { idx: 12, address: '0xFABB0ac9d68B0B445fB7357272Ff202C5651694a', label: 'Account 12' },
  { idx: 13, address: '0x1CBd3b2770909D4e10f157cABC84C7264073C9Ec', label: 'Account 13' },
  { idx: 14, address: '0xdF3e18d64BC6A983f673Ab319CCaE4f1a57C7097', label: 'Account 14' },
  { idx: 15, address: '0xcd3B766CCDd6AE721141F452C550Ca635964ce71', label: 'Account 15' },
  { idx: 16, address: '0x2546BcD3c84621e976D8185a91A922aE77ECEc30', label: 'Account 16' },
  { idx: 17, address: '0xbDA5747bFD65F08deb54cb465eB87D40e51B197E', label: 'Account 17' },
  { idx: 18, address: '0xdD2FD4581271e230360230F9337D5c0430Bf44C0', label: 'Account 18' },
  { idx: 19, address: '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199', label: 'Account 19' },
]

// ─── Fetch live accounts from node (fallback to HH_ACCOUNTS) ─────────────────
async function fetchLiveAccounts(rpcUrl: string): Promise<{ idx: number; address: string; label: string }[]> {
  try {
    const r = await fetch(rpcUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_accounts', params: [] }),
    })
    const d = await r.json()
    if (d.result && Array.isArray(d.result) && d.result.length > 0) {
      return d.result.map((addr: string, i: number) => ({ idx: i, address: addr, label: `Account ${i}` }))
    }
  } catch {}
  return HH_ACCOUNTS
}

// Known max supply function selectors
const MAX_SUPPLY_SIGS: { fn: string; sig: string }[] = [
  { fn: 'cap()', sig: '0x355274ea' },           // ERC20Capped.cap()
  { fn: 'maxSupply()', sig: '0xd5abeb01' },      // common pattern
  { fn: 'MAX_SUPPLY()', sig: '0x32cb6b0c' },     // ALL_CAPS constant
  { fn: 'totalCap()', sig: '0x1a79fc30' },
  { fn: 'hardCap()', sig: '0xbef7a2f0' },
]

// Check if function selector responds (returns non-zero)
async function trySig(rpcUrl: string, to: string, sig: string): Promise<string | null> {
  try {
    const r = await fetch(rpcUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to, data: sig }, 'latest'] }),
    })
    const d = await r.json()
    if (d.error || !d.result || d.result === '0x' || d.result === '0x0000000000000000000000000000000000000000000000000000000000000000') return null
    return d.result
  } catch { return null }
}

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

  // ── Balance Discover state ────────────────────────────────────────────────
  interface DiscoveredBalance { idx: number; address: string; label: string; raw: bigint; formatted: string; hasBalance: boolean }
  const [discovering, setDiscovering] = useState(false)
  const [discovered, setDiscovered] = useState<DiscoveredBalance[]>([])
  const [showAllDiscovered, setShowAllDiscovered] = useState(false)
  const [discoverError, setDiscoverError] = useState('')

  const discoverBalances = useCallback(async () => {
    const addr = tokenAddress.trim()
    if (!addr || !addr.startsWith('0x')) { setError('Enter a token address first'); return }
    setDiscovering(true)
    setDiscoverError('')
    setDiscovered([])
    try {
      const accounts = await fetchLiveAccounts(rpcUrl)
      // Get decimals first
      const decimalsHex = await ethCall(rpcUrl, addr, '0x313ce567').catch(() => '0x')
      const decimals = decimalsHex !== '0x' ? Number(decodeUint(decimalsHex)) : 18

      const results = await Promise.all(
        accounts.map(async (acct) => {
          try {
            const data = balanceOfCalldata(acct.address)
            const hex = await ethCall(rpcUrl, addr, data)
            const raw = decodeUint(hex)
            return {
              idx: acct.idx,
              address: acct.address,
              label: acct.label,
              raw,
              formatted: formatUnits(raw, decimals),
              hasBalance: raw > 0n,
            }
          } catch {
            return { idx: acct.idx, address: acct.address, label: acct.label, raw: 0n, formatted: '0', hasBalance: false }
          }
        })
      )
      setDiscovered(results)
      // Also update tokenInfo balances if already loaded
      if (tokenInfo) {
        const bals = results.map(r => ({ address: r.address, balance: r.raw.toString(), formatted: r.formatted }))
        setTokenInfo(prev => prev ? { ...prev, balances: bals } : prev)
      }
    } catch (e: any) {
      setDiscoverError(e?.message || 'Failed to discover balances')
    }
    setDiscovering(false)
  }, [tokenAddress, rpcUrl, tokenInfo])

  const loadToken = useCallback(async () => {
    const addr = tokenAddress.trim()
    if (!addr || !addr.startsWith('0x')) { setError('Enter a valid contract address'); return }
    setLoading(true)
    setError('')
    setTokenInfo(null)

    try {
      // Verify contract exists first
      const codeR = await fetch(rpcUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getCode', params: [addr, 'latest'] }),
      })
      const codeD = await codeR.json()
      if (!codeD.result || codeD.result === '0x') {
        setError('No contract at this address — it may have been redeployed. Check the Deployed panel for the latest address.')
        setLoading(false)
        return
      }

      const [nameHex, symbolHex, decimalsHex, supplyHex] = await Promise.all(
        ERC20_ABI_CALLS.map(c => ethCall(rpcUrl, addr, c.sig))
      )

      const name = nameHex ? decodeString(nameHex) : '?'
      const symbol = symbolHex ? decodeString(symbolHex) : '?'
      const decimals = decimalsHex ? Number(decodeUint(decimalsHex)) : 18
      const totalSupplyRaw = supplyHex ? decodeUint(supplyHex) : 0n
      const totalSupply = supplyHex ? formatUnits(totalSupplyRaw, decimals) : '?'

      // ── Detect max supply ────────────────────────────────────────────────
      let maxSupplyRaw: bigint | null = null
      let maxSupply: string | null = null
      for (const { sig } of MAX_SUPPLY_SIGS) {
        const result = await trySig(rpcUrl, addr, sig)
        if (result) {
          try {
            maxSupplyRaw = BigInt(result)
            if (maxSupplyRaw > 0n) {
              maxSupply = formatUnits(maxSupplyRaw, decimals)
              break
            }
          } catch {}
        }
      }

      // ── Detect mint / burn / owner ───────────────────────────────────────
      // 0x40c10f19 = mint(address,uint256)
      // 0x42966c68 = burn(uint256)
      // 0x8da5cb5b = owner()
      const [mintR, burnR, ownerR] = await Promise.all([
        trySig(rpcUrl, addr, '0x40c10f19' + '0'.repeat(128)), // will revert but won't be null if fn exists
        trySig(rpcUrl, addr, '0x42966c68' + '0'.repeat(64)),
        trySig(rpcUrl, addr, '0x8da5cb5b'),
      ])
      // A simpler approach: check via eth_call with zero args — if it returns
      // a non-null hex (even an error), the function selector exists
      const hasMint = !!(await (async () => {
        try {
          const r = await fetch(rpcUrl, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 99, method: 'eth_call',
              params: [{ to: addr, data: '0x40c10f19' + '0'.repeat(128) }, 'latest'] }),
          })
          const d = await r.json()
          // If it returns an execution revert (not "function not found"), function exists
          return d.error?.message?.includes('revert') || d.error?.message?.includes('execution') || d.result
        } catch { return false }
      })())
      const hasOwner = !!ownerR

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

      setTokenInfo({
        address: addr, name, symbol, decimals,
        totalSupply, totalSupplyRaw,
        maxSupply, maxSupplyRaw,
        mintable: hasMint,
        burnable: true, // burn(uint256) is common
        hasOwner,
        balances,
      })
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

  // Auto-detect ERC-20 contracts from deployed
  const erc20Contracts = deployedContracts.filter(c => {
    const fnNames = c.abi.map(i => i.name)
    return fnNames.includes('transfer') && fnNames.includes('balanceOf') && fnNames.includes('totalSupply')
  })

  // Auto-select first ERC-20 if nothing selected and contracts available
  const autoSelectContract = useCallback((c: typeof erc20Contracts[0]) => {
    setTokenAddress(c.address)
  }, [])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card">
        <Coins className="w-4 h-4 text-yellow-400"/>
        <span className="text-sm font-semibold">ERC-20 Token Reader</span>
        <span className="text-[10px] bg-yellow-500/10 text-yellow-400 px-1.5 py-0.5 rounded">Read balances & metadata</span>
      </div>

      {/* ── Auto-detect banner ── */}
      {erc20Contracts.length > 0 && !tokenAddress && (
        <div className="border-b border-yellow-500/15 bg-yellow-500/5 px-4 py-2.5 flex-shrink-0">
          <p className="text-[9px] text-yellow-400/60 uppercase tracking-widest font-semibold mb-1.5 flex items-center gap-1">
            <Sparkles className="w-3 h-3"/> Detected ERC-20 Contracts
          </p>
          <div className="flex flex-wrap gap-1.5">
            {erc20Contracts.map(c => (
              <button key={c.id}
                onClick={() => autoSelectContract(c)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-yellow-500/25 bg-yellow-500/10 hover:bg-yellow-500/20 hover:border-yellow-500/40 transition-all text-[10px]">
                <span className="font-semibold text-yellow-300">{c.name}</span>
                {c.version && c.version > 1 && (
                  <span className="text-[8px] bg-yellow-500/20 text-yellow-400 px-1 rounded-full">v{c.version}</span>
                )}
                <span className="font-mono text-yellow-400/40">{c.address.slice(0, 6)}…</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Config */}
        <div className="w-72 flex-shrink-0 border-r border-border flex flex-col bg-card/50 overflow-y-auto">
          <div className="p-3 border-b border-border space-y-2">
            <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Token Address</Label>
            <div className="flex gap-1">
              <Input value={tokenAddress} onChange={e => setTokenAddress(e.target.value)}
                placeholder="0x..." className="h-7 text-xs font-mono flex-1"/>
              {tokenAddress && (
                <button onClick={() => { setTokenAddress(''); setTokenInfo(null); setDiscovered([]); setError('') }}
                  className="px-1.5 rounded border border-border text-muted-foreground/40 hover:text-foreground hover:border-muted-foreground/40 transition-colors">
                  ✕
                </button>
              )}
            </div>

            {/* Quick-switch deployed contracts when address already selected */}
            {erc20Contracts.length > 0 && tokenAddress && (
              <div>
                <p className="text-[9px] text-muted-foreground/30 mb-1 flex items-center gap-1"><Users className="w-2.5 h-2.5"/>Switch contract:</p>
                <div className="space-y-1">
                  {erc20Contracts.map(c => (
                    <button key={c.id} onClick={() => { setTokenAddress(c.address); setTokenInfo(null); setDiscovered([]) }}
                      className={cn('w-full text-left px-2 py-1.5 rounded border text-[10px] transition-all flex items-center gap-2',
                        tokenAddress === c.address
                          ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300'
                          : 'border-border hover:border-yellow-500/20 hover:bg-yellow-500/5 text-foreground/70')}>
                      <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', tokenAddress === c.address ? 'bg-yellow-400' : 'bg-muted-foreground/20')}/>
                      <span className="font-medium flex-1">{c.name}</span>
                      {c.version && c.version > 1 && (
                        <span className="text-[8px] bg-yellow-500/15 text-yellow-400/70 px-1 rounded-full">v{c.version}</span>
                      )}
                      <span className="font-mono text-muted-foreground/30">{c.address.slice(0, 7)}…</span>
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

          <div className="p-3 space-y-2">
            <Button onClick={loadToken} disabled={loading || !tokenAddress.trim()}
              className="w-full bg-yellow-600 hover:bg-yellow-500 gap-2">
              {loading ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Search className="w-4 h-4"/>}
              {loading ? 'Reading…' : 'Read Token'}
            </Button>
            <Button onClick={discoverBalances} disabled={discovering || !tokenAddress.trim()}
              variant="outline"
              className="w-full gap-2 border-violet-500/30 text-violet-400 hover:bg-violet-500/10 hover:border-violet-500/50">
              {discovering
                ? <RefreshCw className="w-3.5 h-3.5 animate-spin"/>
                : <Sparkles className="w-3.5 h-3.5"/>}
              {discovering ? 'Discovering…' : 'Discover All Balances'}
            </Button>
            {discoverError && (
              <p className="text-[10px] text-rose-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 flex-shrink-0"/> {discoverError}
              </p>
            )}
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

                  {/* ── Supply Policy Card ── */}
                  <div className={cn(
                    'mt-4 rounded-lg border p-3 flex items-start gap-3',
                    tokenInfo.maxSupply
                      ? 'bg-emerald-500/5 border-emerald-500/20'
                      : 'bg-amber-500/5 border-amber-500/20'
                  )}>
                    <div className={cn('flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
                      tokenInfo.maxSupply ? 'bg-emerald-500/15' : 'bg-amber-500/15')}>
                      {tokenInfo.maxSupply
                        ? <Lock className="w-4 h-4 text-emerald-400" />
                        : <TrendingUp className="w-4 h-4 text-amber-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={cn('text-xs font-semibold mb-0.5',
                        tokenInfo.maxSupply ? 'text-emerald-400' : 'text-amber-400')}>
                        {tokenInfo.maxSupply ? '🔒 Capped Supply' : '♾️ Uncapped / Inflationary'}
                      </div>
                      {tokenInfo.maxSupply ? (
                        <div className="space-y-0.5">
                          <div className="text-[10px] text-muted-foreground/60">
                            Max supply: <span className="font-mono text-foreground/80">{tokenInfo.maxSupply} {tokenInfo.symbol}</span>
                          </div>
                          {tokenInfo.maxSupplyRaw !== null && tokenInfo.totalSupplyRaw !== null && (
                            <>
                              <div className="text-[10px] text-muted-foreground/60">
                                Remaining mintable: <span className="font-mono text-emerald-300/80">
                                  {formatUnits(tokenInfo.maxSupplyRaw - tokenInfo.totalSupplyRaw, tokenInfo.decimals)} {tokenInfo.symbol}
                                </span>
                              </div>
                              <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-emerald-500/60 transition-all"
                                  style={{ width: `${Math.min(100, Number(tokenInfo.totalSupplyRaw * 100n / tokenInfo.maxSupplyRaw))}%` }}
                                />
                              </div>
                              <div className="text-[9px] text-muted-foreground/40 mt-0.5">
                                {Number(tokenInfo.totalSupplyRaw * 100n / tokenInfo.maxSupplyRaw)}% of max supply minted
                              </div>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="text-[10px] text-muted-foreground/60 space-y-0.5">
                          <p>No <code className="font-mono text-[9px] bg-muted px-1 rounded">cap()</code>, <code className="font-mono text-[9px] bg-muted px-1 rounded">maxSupply()</code>, or <code className="font-mono text-[9px] bg-muted px-1 rounded">MAX_SUPPLY()</code> found.</p>
                          {tokenInfo.mintable && (
                            <p className="text-amber-400/70">⚠️ Contract has a <code className="font-mono text-[9px]">mint()</code> function — supply can grow without bound.</p>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex-shrink-0 flex flex-col gap-1 text-[9px] text-muted-foreground/40 text-right">
                      {tokenInfo.mintable && <span className="text-violet-400/70">✓ mintable</span>}
                      {tokenInfo.burnable && <span className="text-orange-400/70">✓ burnable</span>}
                      {tokenInfo.hasOwner && <span className="text-sky-400/70">✓ Ownable</span>}
                    </div>
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

                {/* ── Hardhat Account Balance Discovery ── */}
                {discovered.length > 0 && (() => {
                  const withBalance = discovered.filter(d => d.hasBalance)
                  const shown = showAllDiscovered ? discovered : (withBalance.length > 0 ? withBalance : discovered.slice(0, 5))
                  const totalHolders = withBalance.length
                  const totalBalance = discovered.reduce((a, d) => a + d.raw, 0n)
                  return (
                    <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 overflow-hidden">
                      <div className="px-4 py-3 border-b border-violet-500/15 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-3.5 h-3.5 text-violet-400"/>
                          <h3 className="text-xs font-semibold text-violet-300">Account Balance Discovery</h3>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-muted-foreground/50">
                            <span className="text-violet-300 font-semibold">{totalHolders}</span>/{discovered.length} holders
                          </span>
                          <button
                            onClick={() => setShowAllDiscovered(v => !v)}
                            className="flex items-center gap-1 text-[10px] text-violet-400/70 hover:text-violet-400 transition-colors">
                            {showAllDiscovered ? <><ChevronUp className="w-3 h-3"/>Hide zero</> : <><ChevronDown className="w-3 h-3"/>Show all</>}
                          </button>
                        </div>
                      </div>
                      <div className="divide-y divide-violet-500/10">
                        {shown.map((d) => (
                          <div key={d.address} className={cn(
                            'flex items-center gap-3 px-4 py-2.5 transition-colors',
                            d.hasBalance ? 'bg-violet-500/5 hover:bg-violet-500/10' : 'opacity-40'
                          )}>
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-violet-500/30 to-purple-500/20 border border-violet-500/20 flex items-center justify-center">
                              <span className="text-[8px] font-mono font-bold text-violet-300">{d.idx}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[10px] font-semibold text-foreground/80">{d.label}</div>
                              <code className="text-[9px] font-mono text-muted-foreground/40 truncate block">{d.address.slice(0, 14)}…{d.address.slice(-6)}</code>
                            </div>
                            <div className="flex-shrink-0 text-right">
                              <div className={cn('text-xs font-mono font-semibold', d.hasBalance ? 'text-violet-300' : 'text-muted-foreground/30')}>
                                {d.formatted}
                              </div>
                              <div className="text-[9px] text-muted-foreground/40">{tokenInfo?.symbol ?? ''}</div>
                            </div>
                            {d.hasBalance && totalBalance > 0n && (
                              <div className="flex-shrink-0 w-12">
                                <div className="h-1 rounded-full bg-violet-500/10 overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-violet-500/60"
                                    style={{ width: `${Number(d.raw * 100n / totalBalance)}%` }}
                                  />
                                </div>
                                <div className="text-[8px] text-muted-foreground/30 text-right mt-0.5">
                                  {Number(d.raw * 100n / totalBalance)}%
                                </div>
                              </div>
                            )}
                            <button
                              onClick={() => { navigator.clipboard.writeText(d.address); setCopied(`disc-${d.address}`) }}
                              className="flex-shrink-0 text-muted-foreground/20 hover:text-muted-foreground transition-colors">
                              {copied === `disc-${d.address}` ? <Check className="w-3 h-3 text-emerald-400"/> : <Copy className="w-3 h-3"/>}
                            </button>
                          </div>
                        ))}
                      </div>
                      {!showAllDiscovered && withBalance.length === 0 && (
                        <div className="px-4 py-3 text-center text-[10px] text-muted-foreground/30">
                          No accounts hold this token yet
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* Balances (manual watch addresses) */}
                {tokenInfo.balances.length > 0 && (
                  <div className="rounded-lg border border-border bg-card overflow-hidden">
                    <div className="px-4 py-3 border-b border-border bg-card/50">
                      <h3 className="text-xs font-semibold">Watch Address Balances</h3>
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
