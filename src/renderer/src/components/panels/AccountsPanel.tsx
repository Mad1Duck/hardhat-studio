import { useState, useEffect, useCallback, useRef } from 'react';
import { HardhatAccount } from '../../types';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/primitives';
import {
  Copy,
  RefreshCw,
  Eye,
  EyeOff,
  Wallet,
  Coins,
  ChevronRight,
  Plus,
  Search,
  X,
  Layers,
  TrendingUp,
  AlertCircle,
  Loader2,
  ExternalLink,
  ChevronDown,
  Sparkles,
  Package,
} from 'lucide-react';
import { cn } from '../../lib/utils';

//  ERC-20 minimal ABI 
const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
];

//  Types 
interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply?: string;
  /** per-account balances: address → formatted balance */
  balances: Record<string, string>;
  /** raw bigint strings */
  rawBalances: Record<string, string>;
  error?: string;
}

interface Props {
  rpcUrl: string;
  onSelectAccount: (privateKey: string) => void;
}

//  RPC call helper 
async function rpcCall(url: string, method: string, params: unknown[]) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return d.result;
}

//  eth_call helper 
function encodeSelector(sig: string) {
  // tiny keccak-256 via a known selector list, or use a real encoder
  // We'll use eth_call with raw calldata via ABI encoding
  // For common ERC20 functions we hardcode selectors
  const selectors: Record<string, string> = {
    'name()': '0x06fdde03',
    'symbol()': '0x95d89b41',
    'decimals()': '0x313ce567',
    'totalSupply()': '0x18160ddd',
    'balanceOf(address)': '0x70a08231',
  };
  return selectors[sig] ?? null;
}

function encodeAddress(addr: string) {
  return addr.toLowerCase().replace('0x', '').padStart(64, '0');
}

function decodeUint(hex: string): bigint {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  return h ? BigInt('0x' + h) : 0n;
}

function decodeString(hex: string): string {
  try {
    const h = hex.startsWith('0x') ? hex.slice(2) : hex;
    if (!h || h === '') return '';

    // Try ABI-encoded dynamic string (offset + length + data)
    if (h.length >= 128) {
      try {
        const offset = parseInt(h.slice(0, 64), 16);
        // Sanity check: offset should be 32 for a simple string return
        if (offset <= 64) {
          const length = parseInt(h.slice(64, 128), 16);
          if (length > 0 && length < 1024) {
            const strHex = h.slice(128, 128 + length * 2);
            let result = '';
            for (let i = 0; i < strHex.length; i += 2) {
              const code = parseInt(strHex.slice(i, i + 2), 16);
              if (code > 0 && code < 128) result += String.fromCharCode(code);
            }
            if (result.length > 0) return result;
          }
        }
      } catch {}
    }

    // Fallback: try bytes32 encoding (right-padded ASCII, 64 hex chars)
    if (h.length === 64) {
      let result = '';
      for (let i = 0; i < 64; i += 2) {
        const code = parseInt(h.slice(i, i + 2), 16);
        if (code === 0) break;
        if (code > 0 && code < 128) result += String.fromCharCode(code);
      }
      return result;
    }

    return '';
  } catch {
    return '';
  }
}

function decodeUint8(hex: string): number {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  return h ? parseInt(h.slice(-2), 16) : 18;
}

async function ethCall(rpcUrl: string, to: string, calldata: string): Promise<string> {
  return rpcCall(rpcUrl, 'eth_call', [{ to, data: calldata }, 'latest']);
}

async function fetchTokenInfo(
  rpcUrl: string,
  tokenAddress: string,
  accounts: string[],
): Promise<TokenInfo> {
  const addr = tokenAddress.trim();
  const info: TokenInfo = {
    address: addr,
    name: '',
    symbol: '',
    decimals: 18,
    balances: {},
    rawBalances: {},
  };
  try {
    // First verify the address has contract code, before making ERC-20 calls
    const codeResult = await rpcCall(rpcUrl, 'eth_getCode', [addr, 'latest']);
    if (!codeResult || codeResult === '0x' || codeResult === '0x0') {
      info.error = 'No contract at this address — it may have been redeployed to a new address';
      info.name = 'Stale address';
      return info;
    }

    const safeEthCall = async (calldata: string): Promise<string> => {
      try { return await ethCall(rpcUrl, addr, calldata); } catch { return '0x'; }
    };

    const [nameHex, symbolHex, decimalsHex, supplyHex] = await Promise.all([
      safeEthCall(encodeSelector('name()')!),
      safeEthCall(encodeSelector('symbol()')!),
      safeEthCall(encodeSelector('decimals()')!),
      safeEthCall(encodeSelector('totalSupply()')!),
    ]);

    // Validate: if all return '0x', it's not an ERC-20
    if (nameHex === '0x' && symbolHex === '0x' && supplyHex === '0x') {
      info.error = 'Contract exists but does not implement ERC-20 interface';
      info.name = 'Not ERC-20';
      return info;
    }

    info.name = decodeString(nameHex) || 'Unknown';
    info.symbol = decodeString(symbolHex) || '???';
    info.decimals = decodeUint8(decimalsHex) || 18;
    const supply = decodeUint(supplyHex);
    info.totalSupply = formatUnits(supply, info.decimals);

    // Fetch balanceOf for each account in parallel
    await Promise.all(
      accounts.map(async (acct) => {
        try {
          const data = encodeSelector('balanceOf(address)')! + encodeAddress(acct);
          const hex = await safeEthCall(data);
          const raw = decodeUint(hex);
          info.rawBalances[acct] = raw.toString();
          info.balances[acct] = formatUnits(raw, info.decimals);
        } catch {
          info.balances[acct] = '0';
          info.rawBalances[acct] = '0';
        }
      }),
    );
  } catch (e: any) {
    const msg = e.message || '';
    if (msg.toLowerCase().includes('internal')) {
      info.error = 'RPC error — contract may be at a different address after redeployment';
    } else {
      info.error = msg || 'Not a valid ERC-20';
    }
    info.name = 'Error';
  }
  return info;
}

function formatUnits(value: bigint, decimals: number): string {
  if (value === 0n) return '0';
  const d = BigInt(10) ** BigInt(decimals);
  const whole = value / d;
  const frac = value % d;
  if (frac === 0n) return whole.toLocaleString();
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '').slice(0, 6);
  return `${whole.toLocaleString()}.${fracStr}`;
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

//  Deployed-contract token auto-discovery 
// We try to detect if a deployed contract is ERC-20 by calling symbol()
async function tryDecodeERC20(rpcUrl: string, address: string): Promise<string | null> {
  try {
    const hex = await ethCall(rpcUrl, address, encodeSelector('symbol()')!);
    const sym = decodeString(hex);
    return sym || null;
  } catch {
    return null;
  }
}

//  Main component 
export default function AccountsPanel({ rpcUrl, onSelectAccount }: Props) {
  const [accounts, setAccounts] = useState<HardhatAccount[]>([]);
  const [balances, setBalances] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  // Token state
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [tokenInput, setTokenInput] = useState('');
  const [loadingToken, setLoadingToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [showTokenPanel, setShowTokenPanel] = useState(true);
  const [autoDiscovering, setAutoDiscovering] = useState(false);
  const [discoveredAddrs, setDiscoveredAddrs] = useState<string[]>([]);
  // Persisted token addresses
  const [savedTokenAddrs, setSavedTokenAddrs] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('accounts_tokens') || '[]');
    } catch {
      return [];
    }
  });

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const accs = await window.api.getHardhatAccounts(rpcUrl);
      setAccounts(accs);
      const bals: Record<string, string> = {};
      await Promise.all(
        accs.map(async (acc) => {
          try {
            const result = await rpcCall(rpcUrl, 'eth_getBalance', [acc.address, 'latest']);
            const wei = BigInt(result);
            bals[acc.address] = (Number(wei) / 1e18).toFixed(4);
          } catch {}
        }),
      );
      setBalances(bals);
      return accs;
    } finally {
      setLoading(false);
    }
  }, [rpcUrl]);

  // Reload token balances when accounts change
  const refreshTokenBalances = useCallback(
    async (accs: HardhatAccount[], addrs: string[]) => {
      if (!accs.length || !addrs.length) return;
      const addresses = accs.map((a) => a.address);
      const updated = await Promise.all(
        addrs.map((addr) => fetchTokenInfo(rpcUrl, addr, addresses)),
      );
      setTokens(updated);
    },
    [rpcUrl],
  );

  // Initial load
  useEffect(() => {
    fetchAccounts().then((accs) => {
      if (savedTokenAddrs.length > 0 && accs) {
        refreshTokenBalances(accs, savedTokenAddrs);
      }
    });
  }, [fetchAccounts]);

  // Auto-discover ERC-20 from deployed contracts stored in localStorage
  const autoDiscover = useCallback(
    async (accs: HardhatAccount[]) => {
      setAutoDiscovering(true);
      try {
        const stored = JSON.parse(localStorage.getItem('deployedContracts') || '[]') as Array<{
          address: string;
          name: string;
        }>;
        const candidates = stored.map((c) => c.address).filter(Boolean);
        const found: string[] = [];
        await Promise.all(
          candidates.map(async (addr) => {
            const sym = await tryDecodeERC20(rpcUrl, addr);
            if (sym) found.push(addr);
          }),
        );
        const newAddrs = found.filter((a) => !savedTokenAddrs.includes(a));
        if (newAddrs.length > 0) {
          setDiscoveredAddrs(newAddrs);
        }
      } catch {}
      setAutoDiscovering(false);
    },
    [rpcUrl, savedTokenAddrs],
  );

  const addToken = useCallback(
    async (addrRaw?: string) => {
      const addr = (addrRaw ?? tokenInput).trim();
      if (!addr) return;
      if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) {
        setTokenError('Invalid address format');
        return;
      }
      if (
        savedTokenAddrs.includes(addr.toLowerCase()) ||
        tokens.some((t) => t.address.toLowerCase() === addr.toLowerCase())
      ) {
        setTokenError('Token already added');
        return;
      }
      setTokenError(null);
      setLoadingToken(addr);
      const addresses = accounts.map((a) => a.address);
      const info = await fetchTokenInfo(rpcUrl, addr, addresses);
      setLoadingToken(null);
      if (info.error) {
        setTokenError(info.error);
        return;
      }
      const newAddrs = [...savedTokenAddrs, addr.toLowerCase()];
      setSavedTokenAddrs(newAddrs);
      try {
        localStorage.setItem('accounts_tokens', JSON.stringify(newAddrs));
      } catch {}
      setTokens((prev) => [...prev, info]);
      setTokenInput('');
      setDiscoveredAddrs((prev) => prev.filter((a) => a.toLowerCase() !== addr.toLowerCase()));
    },
    [tokenInput, savedTokenAddrs, tokens, accounts, rpcUrl],
  );

  const removeToken = useCallback(
    (addr: string) => {
      const newAddrs = savedTokenAddrs.filter((a) => a.toLowerCase() !== addr.toLowerCase());
      setSavedTokenAddrs(newAddrs);
      try {
        localStorage.setItem('accounts_tokens', JSON.stringify(newAddrs));
      } catch {}
      setTokens((prev) => prev.filter((t) => t.address.toLowerCase() !== addr.toLowerCase()));
    },
    [savedTokenAddrs],
  );

  const handleRefresh = useCallback(async () => {
    const accs = await fetchAccounts();
    if (accs && savedTokenAddrs.length > 0) refreshTokenBalances(accs, savedTokenAddrs);
  }, [fetchAccounts, refreshTokenBalances, savedTokenAddrs]);

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  const totalEth = Object.values(balances).reduce((a, b) => a + parseFloat(b || '0'), 0);

  // Token holdings for a specific account
  const accountTokens = (addr: string) =>
    tokens.filter((t) => parseFloat(t.balances[addr] || '0') > 0);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/*  Header  */}
      <div className="flex items-center justify-between flex-shrink-0 px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-orange-400" />
          <span className="text-sm font-semibold">Accounts</span>
          <span className="text-[10px] font-mono text-muted-foreground/40">{rpcUrl}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="gap-1 text-xs h-7"
            onClick={() => autoDiscover(accounts)}
            disabled={autoDiscovering}>
            {autoDiscovering ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3 text-violet-400" />
            )}
            Discover
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1 text-xs h-7"
            onClick={handleRefresh}
            disabled={loading}>
            <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/*  Summary bar  */}
      <div className="grid flex-shrink-0 grid-cols-4 gap-px border-b bg-border border-border">
        {[
          { label: 'Accounts', value: accounts.length.toString(), color: 'text-foreground' },
          { label: 'Total ETH', value: totalEth.toFixed(2), color: 'text-amber-400' },
          { label: 'Tokens tracked', value: tokens.length.toString(), color: 'text-violet-400' },
          {
            label: 'Network',
            value:
              rpcUrl.includes('localhost') || rpcUrl.includes('127.0.0.1') ? 'Local' : 'Remote',
            color: 'text-emerald-400',
          },
        ].map(({ label, value, color }) => (
          <div key={label} className="px-3 py-2.5 bg-card">
            <div className="text-[9px] text-muted-foreground/50 uppercase tracking-widest">
              {label}
            </div>
            <div className={cn('text-base font-mono font-semibold mt-0.5', color)}>{value}</div>
          </div>
        ))}
      </div>

      {/*  Auto-discovered banner  */}
      {discoveredAddrs.length > 0 && (
        <div className="flex items-start gap-2 px-4 py-2.5 bg-violet-500/10 border-b border-violet-500/20 flex-shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-violet-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-violet-300 font-medium mb-1">
              {discoveredAddrs.length} ERC-20 contract{discoveredAddrs.length > 1 ? 's' : ''}{' '}
              detected in your deployed contracts
            </p>
            <div className="flex flex-wrap gap-1.5">
              {discoveredAddrs.map((addr) => (
                <button
                  key={addr}
                  onClick={() => addToken(addr)}
                  disabled={!!loadingToken}
                  className="flex items-center gap-1 text-[9px] font-mono px-2 py-1 rounded bg-violet-500/15 text-violet-300 border border-violet-500/30 hover:bg-violet-500/25 transition-colors disabled:opacity-50">
                  <Plus className="w-2.5 h-2.5" />
                  {shortAddr(addr)}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => setDiscoveredAddrs([])}
            className="flex-shrink-0 text-muted-foreground/30 hover:text-muted-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex flex-1 min-w-0 overflow-hidden">
        {/*  Account list  */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <ScrollArea className="flex-1 overflow-y-auto">
            <div className="p-3 space-y-1.5">
              {accounts.length === 0 && !loading && (
                <div className="py-12 text-sm text-center text-muted-foreground/30">
                  <Wallet className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  No accounts found — is Hardhat node running?
                </div>
              )}
              {accounts.map((acc, i) => {
                const isExpanded = expandedIdx === i;
                const heldTokens = accountTokens(acc.address);
                const ethBal = balances[acc.address] || acc.balance || '…';

                return (
                  <div
                    key={acc.address}
                    className={cn(
                      'rounded-lg border transition-all overflow-hidden',
                      isExpanded
                        ? 'border-orange-500/40 bg-orange-500/5'
                        : 'border-border bg-card hover:border-border/80',
                    )}>
                    {/* Account row */}
                    <div
                      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
                      onClick={() => setExpandedIdx(isExpanded ? null : i)}>
                      {/* Index badge */}
                      <div className="flex items-center justify-center flex-shrink-0 border rounded-full w-7 h-7 bg-gradient-to-br from-orange-500/20 to-amber-500/10 border-orange-500/20">
                        <span className="text-[10px] font-mono text-orange-400">{i}</span>
                      </div>

                      {/* Address + balances */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-[11px] text-foreground/90">
                            {acc.address.slice(0, 18)}…{acc.address.slice(-6)}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copy(acc.address, `addr-${i}`);
                            }}
                            className="transition-colors text-muted-foreground/30 hover:text-muted-foreground">
                            <Copy className="w-3 h-3" />
                          </button>
                          {copied === `addr-${i}` && (
                            <span className="text-[9px] text-emerald-400">Copied!</span>
                          )}
                        </div>

                        {/* Balance row */}
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          <div className="flex items-center gap-1">
                            <Coins className="w-3 h-3 text-amber-400/70" />
                            <span className="text-[11px] font-mono text-amber-400">
                              {ethBal} ETH
                            </span>
                          </div>
                          {/* Token badges (top 3 with balance) */}
                          {heldTokens.slice(0, 3).map((t) => (
                            <div key={t.address} className="flex items-center gap-1">
                              <span className="text-[10px] font-mono text-violet-400/80">
                                {t.balances[acc.address]} {t.symbol}
                              </span>
                            </div>
                          ))}
                          {heldTokens.length > 3 && (
                            <span className="text-[9px] text-muted-foreground/40">
                              +{heldTokens.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {tokens.length > 0 && heldTokens.length > 0 && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20 font-mono">
                            {heldTokens.length}🪙
                          </span>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-[10px]"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectAccount(acc.privateKey);
                          }}>
                          Use
                        </Button>
                        <ChevronRight
                          className={cn(
                            'w-3.5 h-3.5 text-muted-foreground/40 transition-transform',
                            isExpanded && 'rotate-90',
                          )}
                        />
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="border-t border-border/50 px-3 pb-3 pt-2.5 space-y-3">
                        {/* Full address + private key */}
                        <div className="grid grid-cols-1 gap-2">
                          <div>
                            <div className="text-[9px] text-muted-foreground/50 uppercase tracking-widest mb-1">
                              Full Address
                            </div>
                            <div className="flex items-center gap-2 bg-muted/30 rounded px-2 py-1.5">
                              <code className="flex-1 text-[10px] font-mono text-foreground/80 break-all">
                                {acc.address}
                              </code>
                              <button
                                onClick={() => copy(acc.address, `fulladdr-${i}`)}
                                className="flex-shrink-0 text-muted-foreground/40 hover:text-muted-foreground">
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[9px] text-muted-foreground/50 uppercase tracking-widest">
                                Private Key
                              </span>
                              <button
                                onClick={() => setShowKeys((p) => ({ ...p, [i]: !p[i] }))}
                                className="text-muted-foreground/30 hover:text-muted-foreground">
                                {showKeys[i] ? (
                                  <EyeOff className="w-3 h-3" />
                                ) : (
                                  <Eye className="w-3 h-3" />
                                )}
                              </button>
                              {showKeys[i] && copied !== `pk-${i}` && (
                                <button
                                  onClick={() => copy(acc.privateKey, `pk-${i}`)}
                                  className="ml-auto text-muted-foreground/30 hover:text-muted-foreground">
                                  <Copy className="w-3 h-3" />
                                </button>
                              )}
                              {copied === `pk-${i}` && (
                                <span className="text-[9px] text-emerald-400 ml-auto">Copied!</span>
                              )}
                            </div>
                            <div className="bg-muted/30 rounded px-2 py-1.5">
                              <code className="text-[10px] font-mono text-rose-400/70 break-all">
                                {showKeys[i] ? acc.privateKey : '•'.repeat(64)}
                              </code>
                            </div>
                          </div>
                        </div>

                        {/* Token holdings for this account */}
                        {tokens.length > 0 && (
                          <div>
                            <div className="text-[9px] text-muted-foreground/50 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                              <Package className="w-3 h-3" />
                              Token Holdings ({tokens.length} tracked)
                            </div>
                            <div className="space-y-1">
                              {tokens.map((t) => {
                                const bal = t.balances[acc.address] || '0';
                                const hasBalance = parseFloat(bal) > 0;
                                return (
                                  <div
                                    key={t.address}
                                    className={cn(
                                      'flex items-center gap-2 px-2 py-1.5 rounded border text-[10px]',
                                      hasBalance
                                        ? 'bg-violet-500/5 border-violet-500/20'
                                        : 'bg-muted/20 border-border/40 opacity-50',
                                    )}>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-semibold text-foreground/80">
                                          {t.symbol}
                                        </span>
                                        <span className="text-muted-foreground/40">{t.name}</span>
                                      </div>
                                      <div className="text-muted-foreground/40 font-mono text-[9px]">
                                        {shortAddr(t.address)}
                                      </div>
                                    </div>
                                    <div className="flex-shrink-0 text-right">
                                      <div
                                        className={cn(
                                          'font-mono font-semibold',
                                          hasBalance
                                            ? 'text-violet-300'
                                            : 'text-muted-foreground/30',
                                        )}>
                                        {bal}
                                      </div>
                                      <div className="text-[9px] text-muted-foreground/30">
                                        {t.symbol}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {tokens.length === 0 && (
                          <div className="text-[9px] text-muted-foreground/30 text-center py-1">
                            Add tokens in the panel → to track holdings
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/*  Token panel (right side)  */}
        <div
          className={cn(
            'border-l border-border flex flex-col overflow-hidden transition-all flex-shrink-0',
            showTokenPanel ? 'w-64' : 'w-8',
          )}>
          {/* Collapse toggle */}
          <button
            onClick={() => setShowTokenPanel((p) => !p)}
            className="flex items-center justify-center flex-shrink-0 w-full px-2 py-2 transition-colors border-b border-border bg-card/50 hover:bg-muted/30">
            {showTokenPanel ? (
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60 w-full">
                <Layers className="flex-shrink-0 w-3 h-3 text-violet-400" />
                <span className="font-semibold">Tokens</span>
                <span className="ml-auto text-muted-foreground/30">{tokens.length}</span>
                <ChevronRight className="w-3 h-3 rotate-180 text-muted-foreground/30" />
              </div>
            ) : (
              <ChevronRight className="w-3 h-3 text-muted-foreground/30" />
            )}
          </button>

          {showTokenPanel && (
            <>
              {/* Add token input */}
              <div className="px-3 py-2.5 border-b border-border bg-card/30 flex-shrink-0 space-y-2">
                <div className="flex gap-1.5">
                  <input
                    value={tokenInput}
                    onChange={(e) => {
                      setTokenInput(e.target.value);
                      setTokenError(null);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && addToken()}
                    placeholder="0x token address…"
                    className="flex-1 bg-muted border border-border rounded text-[10px] px-2 py-1 focus:outline-none focus:border-violet-500/50 text-foreground placeholder:text-muted-foreground/30 font-mono"
                  />
                  <button
                    onClick={() => addToken()}
                    disabled={!tokenInput.trim() || !!loadingToken}
                    className="flex items-center justify-center flex-shrink-0 transition-colors border rounded w-7 h-7 border-violet-500/30 bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 disabled:opacity-30">
                    {loadingToken ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Plus className="w-3 h-3" />
                    )}
                  </button>
                </div>
                {tokenError && (
                  <div className="flex items-center gap-1 text-[9px] text-rose-400">
                    <AlertCircle className="flex-shrink-0 w-3 h-3" />
                    {tokenError}
                  </div>
                )}
                <p className="text-[9px] text-muted-foreground/30">
                  Any ERC-20 on {rpcUrl.includes('localhost') ? 'localhost' : 'this network'}
                </p>
              </div>

              {/* Token list */}
              <ScrollArea className="flex-1 overflow-y-auto">
                <div className="p-2 space-y-1.5">
                  {tokens.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground/25 text-[10px]">
                      <Package className="w-8 h-8 mx-auto mb-2 opacity-20" />
                      No tokens added yet.
                      <br />
                      Paste an ERC-20 address above or click{' '}
                      <span className="text-violet-400">Discover</span> to auto-find from deployed
                      contracts.
                    </div>
                  )}
                  {tokens.map((t) => (
                    <div
                      key={t.address}
                      className={cn(
                        'rounded-lg border p-2.5 text-[10px]',
                        t.error ? 'border-rose-500/30 bg-rose-500/5' : 'border-border bg-card',
                      )}>
                      {/* Token header */}
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className="flex items-center justify-center flex-shrink-0 w-5 h-5 border rounded-full bg-gradient-to-br from-violet-500/30 to-pink-500/20 border-violet-500/30">
                            <span className="text-[7px] font-bold text-violet-300">
                              {t.symbol.slice(0, 2)}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-foreground/90 text-[11px]">
                              {t.symbol}
                            </div>
                            <div className="truncate text-muted-foreground/50">{t.name}</div>
                          </div>
                        </div>
                        <button
                          onClick={() => removeToken(t.address)}
                          className="flex-shrink-0 transition-colors text-muted-foreground/20 hover:text-rose-400">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Contract address */}
                      <div className="flex items-center gap-1 mb-2">
                        <code className="text-[9px] font-mono text-muted-foreground/40">
                          {shortAddr(t.address)}
                        </code>
                        <button
                          onClick={() => copy(t.address, `tok-${t.address}`)}
                          className="text-muted-foreground/20 hover:text-muted-foreground">
                          <Copy className="w-2.5 h-2.5" />
                        </button>
                        {copied === `tok-${t.address}` && (
                          <span className="text-[9px] text-emerald-400">Copied!</span>
                        )}
                      </div>

                      {/* Meta */}
                      <div className="flex items-center gap-3 text-[9px] text-muted-foreground/40 mb-2">
                        <span>Dec: {t.decimals}</span>
                        {t.totalSupply && <span>Supply: {t.totalSupply}</span>}
                      </div>

                      {/* Per-account balances */}
                      {t.error ? (
                        <div className="space-y-1.5">
                          <div className="text-[9px] text-rose-400/70 flex items-start gap-1">
                            <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                            <span>{t.error}</span>
                          </div>
                          <button
                            onClick={() => removeToken(t.address)}
                            className="text-[8px] px-2 py-0.5 rounded bg-rose-500/15 text-rose-400/70 border border-rose-500/20 hover:bg-rose-500/25 transition-colors w-full">
                            Remove stale token
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          <div className="text-[9px] text-muted-foreground/40 mb-1 uppercase tracking-widest">
                            Balances
                          </div>
                          {accounts.map((acc, i) => {
                            const bal = t.balances[acc.address] || '0';
                            const hasBalance = parseFloat(bal) > 0;
                            return (
                              <div key={acc.address} className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[9px] text-muted-foreground/40 font-mono w-4">
                                    {i}
                                  </span>
                                  <span className="text-[9px] text-muted-foreground/50 font-mono">
                                    {acc.address.slice(0, 8)}…
                                  </span>
                                </div>
                                <span
                                  className={cn(
                                    'font-mono text-[10px] font-medium',
                                    hasBalance ? 'text-violet-300' : 'text-muted-foreground/25',
                                  )}>
                                  {bal}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Refresh balances button */}
              {tokens.length > 0 && (
                <div className="flex-shrink-0 p-2 border-t border-border">
                  <button
                    onClick={() => refreshTokenBalances(accounts, savedTokenAddrs)}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-1.5 text-[10px] py-1.5 rounded border border-border text-muted-foreground/50 hover:text-muted-foreground hover:border-border/80 transition-colors">
                    <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
                    Refresh token balances
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
