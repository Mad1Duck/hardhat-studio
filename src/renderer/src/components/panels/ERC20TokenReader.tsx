import { useState, useCallback, useEffect, useMemo } from 'react';
import { DeployedContract, TxRecord } from '../../types';
import { Button } from '../ui/button';
import { Input, Label, ScrollArea } from '../ui/primitives';
import { cn } from '../../lib/utils';
import {
  Coins,
  RefreshCw,
  Copy,
  Check,
  Search,
  AlertCircle,
  Lock,
  TrendingUp,
  Sparkles,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  ArrowRightLeft,
  Flame,
  Plus,
  Minus as MinusIcon,
  Activity,
  Clock,
  Hash,
  ExternalLink,
  ChevronRight,
  Wallet,
  BarChart3,
  Users,
} from 'lucide-react';

interface Props {
  rpcUrl: string;
  deployedContracts: DeployedContract[];
  txHistory?: TxRecord[];
}

interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  totalSupplyRaw: bigint;
  maxSupply: string | null;
  maxSupplyRaw: bigint | null;
  mintable: boolean;
  burnable: boolean;
  hasOwner: boolean;
  balances: { address: string; label?: string; balance: string; formatted: string }[];
  isNative?: boolean;
}

interface ChainTxEvent {
  hash: string;
  blockNumber: number;
  from: string;
  to: string | null;
  value: string;
  functionSig: string; // 0x4-byte selector or 'transfer' / 'deploy'
  label: string; // human-readable
  status: 'success' | 'failed';
  gasUsed: number;
  timestamp?: number;
  args?: string; // decoded args summary
}

//  Known ERC-20 event/function selectors 
const FN_LABELS: Record<string, string> = {
  '0xa9059cbb': 'transfer',
  '0x23b872dd': 'transferFrom',
  '0x095ea7b3': 'approve',
  '0x40c10f19': 'mint',
  '0x42966c68': 'burn',
  '0x79cc6790': 'burnFrom',
  '0x70a08231': 'balanceOf',
  '0xdd62ed3e': 'allowance',
  '0x18160ddd': 'totalSupply',
  '0x06fdde03': 'name',
  '0x313ce567': 'decimals',
};

const ERC20_ABI_CALLS = [
  { fn: 'name', sig: '0x06fdde03' },
  { fn: 'symbol', sig: '0x95d89b41' },
  { fn: 'decimals', sig: '0x313ce567' },
  { fn: 'totalSupply', sig: '0x18160ddd' },
];

const MAX_SUPPLY_SIGS = [
  { fn: 'cap()', sig: '0x355274ea' },
  { fn: 'maxSupply()', sig: '0xd5abeb01' },
  { fn: 'MAX_SUPPLY()', sig: '0x32cb6b0c' },
  { fn: 'totalCap()', sig: '0x1a79fc30' },
  { fn: 'hardCap()', sig: '0xbef7a2f0' },
];

const HH_ACCOUNTS = [
  { idx: 0, address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', label: 'Account 0' },
  { idx: 1, address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', label: 'Account 1' },
  { idx: 2, address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', label: 'Account 2' },
  { idx: 3, address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906', label: 'Account 3' },
  { idx: 4, address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', label: 'Account 4' },
  { idx: 5, address: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc', label: 'Account 5' },
  { idx: 6, address: '0x976EA74026E726554dB657fA54763abd0C3a0aa9', label: 'Account 6' },
  { idx: 7, address: '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955', label: 'Account 7' },
  { idx: 8, address: '0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f', label: 'Account 8' },
  { idx: 9, address: '0xa0Ee7A142d267C1f36714E4a8F75612F20a79720', label: 'Account 9' },
];

//  RPC helpers 
async function rpcCall(url: string, method: string, params: any[] = []): Promise<any> {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return d.result;
}

async function ethCall(rpcUrl: string, to: string, data: string): Promise<string | null> {
  try {
    const result = await rpcCall(rpcUrl, 'eth_call', [{ to, data }, 'latest']);
    return result && result !== '0x' ? result : null;
  } catch {
    return null;
  }
}

async function fetchLiveAccounts(rpcUrl: string) {
  try {
    const result = await rpcCall(rpcUrl, 'eth_accounts');
    if (Array.isArray(result) && result.length > 0)
      return result.map((addr: string, i: number) => ({
        idx: i,
        address: addr,
        label: `Account ${i}`,
      }));
  } catch {}
  return HH_ACCOUNTS;
}

//  Decode helpers 
function decodeString(hex: string): string {
  try {
    if (!hex || hex === '0x') return '';
    const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
    if (clean.length < 128) {
      // Try short ABI-encoded string (bytes32)
      let result = '';
      for (let i = 0; i < Math.min(clean.length, 64); i += 2) {
        const code = parseInt(clean.slice(i, i + 2), 16);
        if (code > 0 && code < 128) result += String.fromCharCode(code);
      }
      return result;
    }
    const lenHex = clean.slice(64, 128);
    const len = parseInt(lenHex, 16);
    const strHex = clean.slice(128, 128 + len * 2);
    let result = '';
    for (let i = 0; i < strHex.length; i += 2) {
      const code = parseInt(strHex.slice(i, i + 2), 16);
      if (code > 0) result += String.fromCharCode(code);
    }
    return result;
  } catch {
    return '';
  }
}

function decodeUint(hex: string): bigint {
  try {
    if (!hex || hex === '0x') return 0n;
    return BigInt(hex);
  } catch {
    return 0n;
  }
}

function formatUnits(value: bigint, decimals: number): string {
  if (value === 0n) return '0';
  const divisor = 10n ** BigInt(decimals);
  const whole = value / divisor;
  const frac = value % divisor;
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '').slice(0, 6);
  return fracStr ? `${whole}.${fracStr}` : whole.toString();
}

function formatEth(wei: bigint): string {
  return formatUnits(wei, 18);
}

function balanceOfCalldata(address: string): string {
  return '0x70a08231' + address.replace('0x', '').toLowerCase().padStart(64, '0');
}

function shortAddr(addr: string): string {
  return addr ? `${addr.slice(0, 8)}…${addr.slice(-6)}` : '—';
}

//  Detect ERC-20 contracts 
function isERC20(c: DeployedContract): boolean {
  const fns = new Set(c.abi.map((i) => i.name));
  return fns.has('transfer') && fns.has('balanceOf') && fns.has('totalSupply');
}

//  Fetch last N txs touching a contract from chain 
async function fetchContractTxs(
  rpcUrl: string,
  contractAddress: string,
  count = 10,
): Promise<ChainTxEvent[]> {
  try {
    const latest = await rpcCall(rpcUrl, 'eth_blockNumber');
    const latestNum = parseInt(latest, 16);
    const results: ChainTxEvent[] = [];
    // Scan last 200 blocks
    const toScan = Math.min(200, latestNum + 1);
    for (let n = latestNum; n >= latestNum - toScan && results.length < count; n--) {
      try {
        const block = await rpcCall(rpcUrl, 'eth_getBlockByNumber', [`0x${n.toString(16)}`, true]);
        if (!block) continue;
        const blockTs = parseInt(block.timestamp, 16);
        for (const tx of block.transactions || []) {
          if (typeof tx !== 'object') continue;
          if ((tx.to || '').toLowerCase() !== contractAddress.toLowerCase()) continue;
          let status: 'success' | 'failed' = 'success';
          let gasUsed = 0;
          try {
            const receipt = await rpcCall(rpcUrl, 'eth_getTransactionReceipt', [tx.hash]);
            if (receipt) {
              status = parseInt(receipt.status, 16) === 1 ? 'success' : 'failed';
              gasUsed = parseInt(receipt.gasUsed || '0', 16);
            }
          } catch {}
          const input = tx.input || tx.data || '';
          const sig = input.length >= 10 ? input.slice(0, 10) : '';
          const label = FN_LABELS[sig] || (input === '0x' ? 'ETH transfer' : sig || 'call');
          results.push({
            hash: tx.hash,
            blockNumber: n,
            from: tx.from || '',
            to: tx.to,
            value: tx.value || '0x0',
            functionSig: sig,
            label,
            status,
            gasUsed,
            timestamp: blockTs,
          });
          if (results.length >= count) break;
        }
      } catch {}
    }
    return results;
  } catch {
    return [];
  }
}

//  Fetch ETH balances 
async function fetchEthBalance(rpcUrl: string, address: string): Promise<bigint> {
  try {
    const result = await rpcCall(rpcUrl, 'eth_getBalance', [address, 'latest']);
    return result ? BigInt(result) : 0n;
  } catch {
    return 0n;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Contract Selector Item
// ════════════════════════════════════════════════════════════════════════════
function ContractSelectorItem({
  contract,
  isSelected,
  onToggle,
  compat,
}: {
  contract: DeployedContract | 'native';
  isSelected: boolean;
  onToggle: () => void;
  compat: 'full' | 'partial' | 'none';
}) {
  const isNative = contract === 'native';
  const name = isNative ? 'ETH (Native)' : contract.name;
  const addr = isNative ? '' : contract.address;

  const compatBadge = {
    full: {
      label: '✓ ERC-20',
      cls: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25',
    },
    partial: {
      label: '⚠ partial',
      cls: 'bg-amber-500/15 text-amber-400 border border-amber-500/25',
    },
    none: {
      label: '✗ non-ERC20',
      cls: 'bg-rose-500/10 text-rose-400/70 border border-rose-500/15',
    },
  }[compat];

  return (
    <button
      onClick={onToggle}
      className={cn(
        'w-full text-left px-3 py-2.5 rounded-lg border transition-all flex items-start gap-2.5',
        isSelected
          ? 'border-yellow-500/50 bg-yellow-500/10 shadow-[inset_0_0_0_1px_rgba(234,179,8,0.2)]'
          : 'border-border/60 hover:border-yellow-500/25 hover:bg-yellow-500/5 bg-card/30',
      )}>
      <div
        className={cn(
          'flex-shrink-0 mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-all',
          isSelected
            ? 'bg-yellow-500 border-yellow-500'
            : 'border-muted-foreground/30 bg-transparent',
        )}>
        {isSelected && <Check className="w-2.5 h-2.5 text-black" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {isNative ? (
            <span className="text-[11px] font-semibold text-yellow-200 flex items-center gap-1">
              <span className="text-base leading-none">⟠</span> ETH (Native)
            </span>
          ) : (
            <span className="text-[11px] font-semibold text-foreground/90 truncate max-w-[90px]">
              {name}
            </span>
          )}
          <span
            className={cn(
              'text-[8px] px-1.5 py-0.5 rounded-full font-medium leading-none',
              compatBadge.cls,
            )}>
            {compatBadge.label}
          </span>
        </div>
        {addr && (
          <span className="text-[9px] font-mono text-muted-foreground/35 block mt-0.5">
            {addr.slice(0, 10)}…{addr.slice(-6)}
          </span>
        )}
        {!isNative && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {(contract as DeployedContract).abi
              .filter(
                (i) =>
                  i.type === 'function' &&
                  [
                    'transfer',
                    'transferFrom',
                    'approve',
                    'mint',
                    'burn',
                    'balanceOf',
                    'totalSupply',
                  ].includes(i.name || ''),
              )
              .slice(0, 6)
              .map((i) => (
                <span
                  key={i.name}
                  className={cn(
                    'text-[8px] font-mono px-1 py-0.5 rounded border',
                    ['transfer', 'transferFrom', 'approve', 'balanceOf', 'totalSupply'].includes(
                      i.name || '',
                    )
                      ? 'text-emerald-400/80 border-emerald-500/20 bg-emerald-500/8'
                      : 'text-sky-400/70 border-sky-500/20 bg-sky-500/8',
                  )}>
                  {i.name}()
                </span>
              ))}
          </div>
        )}
      </div>
    </button>
  );
}

//  Tx Event Row 
function TxEventRow({ tx, symbol }: { tx: ChainTxEvent; symbol: string }) {
  const fnColor: Record<string, string> = {
    transfer: 'text-sky-400',
    transferFrom: 'text-sky-400',
    mint: 'text-emerald-400',
    burn: 'text-rose-400',
    burnFrom: 'text-rose-400',
    approve: 'text-violet-400',
  };
  const color = fnColor[tx.label] ?? 'text-muted-foreground/60';
  const icon =
    tx.label === 'mint' ? (
      <Plus className="w-3 h-3 text-emerald-400" />
    ) : tx.label === 'burn' || tx.label === 'burnFrom' ? (
      <Flame className="w-3 h-3 text-rose-400" />
    ) : tx.label === 'transfer' || tx.label === 'transferFrom' ? (
      <ArrowRightLeft className="w-3 h-3 text-sky-400" />
    ) : tx.label === 'approve' ? (
      <CheckSquare className="w-3 h-3 text-violet-400" />
    ) : (
      <Activity className="w-3 h-3 text-muted-foreground/40" />
    );

  return (
    <div className="flex items-center gap-2 px-3 py-2.5 hover:bg-muted/15 transition-colors">
      {/* Status dot */}
      <div
        className={cn(
          'flex-shrink-0 w-1.5 h-1.5 rounded-full',
          tx.status === 'success' ? 'bg-emerald-400 shadow-[0_0_4px_#10b981]' : 'bg-rose-400',
        )}
      />

      {/* Icon */}
      <div className="flex items-center justify-center flex-shrink-0 w-6 h-6 rounded-md bg-muted/30">
        {icon}
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={cn('text-[11px] font-mono font-semibold', color)}>{tx.label}()</span>
          <span className="text-[9px] text-muted-foreground/30 font-mono">#{tx.blockNumber}</span>
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-[9px] font-mono text-muted-foreground/35">
            {shortAddr(tx.from)}
          </span>
          {tx.to && tx.to.toLowerCase() !== tx.from?.toLowerCase() && (
            <>
              <ChevronRight className="w-2.5 h-2.5 text-muted-foreground/20 flex-shrink-0" />
              <span className="text-[9px] font-mono text-muted-foreground/25">
                {shortAddr(tx.to)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Right side */}
      <div className="flex-shrink-0 text-right">
        {tx.gasUsed > 0 && (
          <div className="text-[9px] font-mono text-amber-400/50">
            {(tx.gasUsed / 1000).toFixed(1)}k gas
          </div>
        )}
        {tx.timestamp && (
          <div className="text-[9px] font-mono text-muted-foreground/25">
            {new Date(tx.timestamp * 1000).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </div>
        )}
        <div className="font-mono text-[9px] text-muted-foreground/20">{tx.hash.slice(0, 8)}…</div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Main Component
// ════════════════════════════════════════════════════════════════════════════
export default function ERC20TokenReader({ rpcUrl, deployedContracts, txHistory = [] }: Props) {
  //  Multi-select state 
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [nativeSelected, setNativeSelected] = useState(false);
  const [customAddress, setCustomAddress] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  //  Token data 
  const [tokenData, setTokenData] = useState<Record<string, TokenInfo>>({}); // keyed by address
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});

  //  Chain tx events 
  const [chainTxEvents, setChainTxEvents] = useState<Record<string, ChainTxEvent[]>>({}); // keyed by address
  const [loadingTxs, setLoadingTxs] = useState<Set<string>>(new Set());

  //  Discover balances 
  interface DiscoveredBalance {
    idx: number;
    address: string;
    label: string;
    raw: bigint;
    formatted: string;
  }
  const [discovered, setDiscovered] = useState<Record<string, DiscoveredBalance[]>>({});
  const [discovering, setDiscovering] = useState(false);
  const [showDiscovered, setShowDiscovered] = useState<Record<string, boolean>>({});

  //  Native ETH balances 
  const [nativeBalances, setNativeBalances] = useState<DiscoveredBalance[]>([]);
  const [loadingNative, setLoadingNative] = useState(false);

  //  Active tab in results 
  const [activeAddr, setActiveAddr] = useState<string>('native');

  const [copied, setCopied] = useState<string | null>(null);
  const [selectorSearch, setSelectorSearch] = useState('');

  const copy = (key: string, val: string) => {
    navigator.clipboard.writeText(val);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  //  Classify contracts 
  const erc20Contracts = useMemo(() => deployedContracts.filter(isERC20), [deployedContracts]);
  const partialContracts = useMemo(
    () =>
      deployedContracts.filter((c) => {
        if (isERC20(c)) return false;
        const fns = new Set(c.abi.map((i) => i.name));
        return fns.has('balanceOf') || fns.has('transfer') || fns.has('totalSupply');
      }),
    [deployedContracts],
  );
  const otherContracts = useMemo(
    () => deployedContracts.filter((c) => !isERC20(c) && !partialContracts.includes(c)),
    [deployedContracts, partialContracts],
  );

  // Compat map
  const compatMap = useMemo(() => {
    const m: Record<string, 'full' | 'partial' | 'none'> = {};
    deployedContracts.forEach((c) => {
      m[c.id] = isERC20(c) ? 'full' : partialContracts.includes(c) ? 'partial' : 'none';
    });
    return m;
  }, [deployedContracts, partialContracts]);

  //  Active items (ordered) 
  const activeItems: Array<{ type: 'native' } | { type: 'contract'; contract: DeployedContract }> =
    useMemo(() => {
      const items: Array<{ type: 'native' } | { type: 'contract'; contract: DeployedContract }> =
        [];
      if (nativeSelected) items.push({ type: 'native' });
      deployedContracts.forEach((c) => {
        if (selectedIds.has(c.id)) items.push({ type: 'contract', contract: c });
      });
      return items;
    }, [nativeSelected, selectedIds, deployedContracts]);

  // Auto-set activeAddr when selection changes
  useEffect(() => {
    if (activeItems.length > 0) {
      const first = activeItems[0];
      setActiveAddr(first.type === 'native' ? 'native' : first.contract.address);
    }
  }, [activeItems]);

  //  Load token info 
  const loadToken = useCallback(
    async (contract: DeployedContract) => {
      const addr = contract.address;
      setLoadingIds((prev) => new Set([...prev, contract.id]));
      setErrors((prev) => {
        const n = { ...prev };
        delete n[addr];
        return n;
      });

      try {
        const code = await rpcCall(rpcUrl, 'eth_getCode', [addr, 'latest']);
        if (!code || code === '0x') {
          setErrors((prev) => ({ ...prev, [addr]: 'No contract at this address' }));
          setLoadingIds((prev) => {
            const n = new Set(prev);
            n.delete(contract.id);
            return n;
          });
          return;
        }

        const [nameHex, symbolHex, decimalsHex, supplyHex] = await Promise.all(
          ERC20_ABI_CALLS.map((c) => ethCall(rpcUrl, addr, c.sig)),
        );

        const name = nameHex ? decodeString(nameHex) : contract.name;
        const symbol = symbolHex
          ? decodeString(symbolHex)
          : contract.name.slice(0, 4).toUpperCase();
        const decimals = decimalsHex ? Number(decodeUint(decimalsHex)) : 18;
        const totalSupplyRaw = supplyHex ? decodeUint(supplyHex) : 0n;
        const totalSupply = formatUnits(totalSupplyRaw, decimals);

        let maxSupplyRaw: bigint | null = null;
        let maxSupply: string | null = null;
        for (const { sig } of MAX_SUPPLY_SIGS) {
          const result = await ethCall(rpcUrl, addr, sig);
          if (result) {
            try {
              const v = BigInt(result);
              if (v > 0n) {
                maxSupplyRaw = v;
                maxSupply = formatUnits(v, decimals);
                break;
              }
            } catch {}
          }
        }

        // mint / owner detection
        const hasMint = await (async () => {
          try {
            const r = await fetch(rpcUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0',
                id: 99,
                method: 'eth_call',
                params: [{ to: addr, data: '0x40c10f19' + '0'.repeat(128) }, 'latest'],
              }),
            });
            const d = await r.json();
            return !!(
              d.error?.message?.includes('revert') ||
              d.error?.message?.includes('execution') ||
              d.result
            );
          } catch {
            return false;
          }
        })();
        const ownerHex = await ethCall(rpcUrl, addr, '0x8da5cb5b');

        setTokenData((prev) => ({
          ...prev,
          [addr]: {
            address: addr,
            name,
            symbol: symbol || name.slice(0, 6).toUpperCase(),
            decimals,
            totalSupply,
            totalSupplyRaw,
            maxSupply,
            maxSupplyRaw,
            mintable: hasMint,
            burnable: true,
            hasOwner: !!ownerHex,
            balances: [],
          },
        }));
      } catch (err: any) {
        setErrors((prev) => ({ ...prev, [addr]: err?.message || 'Failed to read token' }));
      }

      setLoadingIds((prev) => {
        const n = new Set(prev);
        n.delete(contract.id);
        return n;
      });
    },
    [rpcUrl],
  );

  //  Fetch chain tx events 
  const fetchTxEvents = useCallback(
    async (contract: DeployedContract) => {
      const addr = contract.address;
      setLoadingTxs((prev) => new Set([...prev, addr]));
      const events = await fetchContractTxs(rpcUrl, addr, 10);
      setChainTxEvents((prev) => ({ ...prev, [addr]: events }));
      setLoadingTxs((prev) => {
        const n = new Set(prev);
        n.delete(addr);
        return n;
      });
    },
    [rpcUrl],
  );

  //  Load native ETH balances 
  const loadNativeBalances = useCallback(async () => {
    setLoadingNative(true);
    const accounts = await fetchLiveAccounts(rpcUrl);
    const results = await Promise.all(
      accounts.map(async (a) => {
        const raw = await fetchEthBalance(rpcUrl, a.address);
        return { idx: a.idx, address: a.address, label: a.label, raw, formatted: formatEth(raw) };
      }),
    );
    setNativeBalances(results);
    setLoadingNative(false);
  }, [rpcUrl]);

  //  Discover all balances for a token 
  const discoverAllBalances = useCallback(async () => {
    const contracts = deployedContracts.filter((c) => selectedIds.has(c.id));
    if (contracts.length === 0) return;
    setDiscovering(true);
    const accounts = await fetchLiveAccounts(rpcUrl);

    for (const contract of contracts) {
      const addr = contract.address;
      const decimals = tokenData[addr]?.decimals ?? 18;
      const results = await Promise.all(
        accounts.map(async (a) => {
          try {
            const hex = await ethCall(rpcUrl, addr, balanceOfCalldata(a.address));
            const raw = hex ? decodeUint(hex) : 0n;
            return {
              idx: a.idx,
              address: a.address,
              label: a.label,
              raw,
              formatted: formatUnits(raw, decimals),
            };
          } catch {
            return { idx: a.idx, address: a.address, label: a.label, raw: 0n, formatted: '0' };
          }
        }),
      );
      setDiscovered((prev) => ({ ...prev, [addr]: results }));
    }
    setDiscovering(false);
  }, [rpcUrl, selectedIds, deployedContracts, tokenData]);

  //  Effect: when contract selected, auto-load its data 
  useEffect(() => {
    for (const item of activeItems) {
      if (item.type === 'native') {
        if (nativeBalances.length === 0 && !loadingNative) loadNativeBalances();
      } else {
        const c = item.contract;
        if (!tokenData[c.address] && !loadingIds.has(c.id)) {
          loadToken(c);
          fetchTxEvents(c);
        }
      }
    }
  }, [activeItems]);

  //  Merge app txHistory with chain tx events 
  function getMergedTxs(addr: string): ChainTxEvent[] {
    const chain = chainTxEvents[addr] || [];
    const appTxs = txHistory
      .filter((t) => (t.to || '').toLowerCase() === addr.toLowerCase())
      .slice(0, 10)
      .map((t) => ({
        hash: t.hash || '',
        blockNumber: t.blockNumber || 0,
        from: t.from || '',
        to: t.to || addr,
        value: '0x0',
        functionSig: '',
        label: t.functionName || 'call',
        status: t.status === 'failed' ? ('failed' as const) : ('success' as const),
        gasUsed: t.gasUsed ? parseInt(t.gasUsed) : 0,
        timestamp: Math.floor(t.timestamp / 1000),
      }));

    // Merge, deduplicate by hash
    const seen = new Set<string>();
    const merged: ChainTxEvent[] = [];
    for (const tx of [...appTxs, ...chain]) {
      const key = tx.hash || `${tx.blockNumber}-${tx.from}-${tx.label}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(tx);
      }
    }
    return merged.slice(0, 10);
  }

  //  No contracts empty state 
  const allContracts = [...erc20Contracts, ...partialContracts, ...otherContracts];

  //  Active token tab data 
  const activeContract =
    activeAddr !== 'native' ? deployedContracts.find((c) => c.address === activeAddr) : null;
  const activeToken = activeAddr !== 'native' ? tokenData[activeAddr] : null;
  const activeTxs = activeAddr !== 'native' ? getMergedTxs(activeAddr) : [];
  const activeDiscovered = activeAddr !== 'native' ? discovered[activeAddr] : nativeBalances;

  // ════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/*  Header  */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-card/80 flex-shrink-0">
        <Coins className="w-4 h-4 text-yellow-400" />
        <span className="text-sm font-semibold">ERC-20 Token Reader</span>
        <span className="text-[10px] bg-yellow-500/10 text-yellow-400 px-1.5 py-0.5 rounded">
          Read balances & metadata
        </span>
        {selectedIds.size + (nativeSelected ? 1 : 0) > 0 && (
          <span className="text-[9px] font-mono text-muted-foreground/40 ml-1">
            {selectedIds.size + (nativeSelected ? 1 : 0)} selected
          </span>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ════════ LEFT: Contract Selector ════════ */}
        <div className="flex flex-col flex-shrink-0 w-64 overflow-hidden border-r border-border bg-card/30">
          <div className="flex-shrink-0 px-3 py-2 border-b border-border/50 bg-muted/20">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                Select Contracts
              </span>
              <div className="flex items-center gap-1.5">
                {erc20Contracts.length > 0 && (
                  <span className="text-[9px] text-muted-foreground/30 font-mono">
                    {erc20Contracts.length} ERC-20
                  </span>
                )}
                {erc20Contracts.length > 1 && (
                  <button
                    onClick={() => {
                      const allSelected = erc20Contracts.every((c) => selectedIds.has(c.id));
                      if (allSelected) {
                        setSelectedIds(new Set());
                      } else {
                        setSelectedIds(new Set(erc20Contracts.map((c) => c.id)));
                        erc20Contracts.forEach((c) => {
                          if (!tokenData[c.address] && !loadingIds.has(c.id)) {
                            loadToken(c);
                            fetchTxEvents(c);
                          }
                        });
                      }
                    }}
                    className="text-[8px] px-1.5 py-0.5 rounded border border-yellow-500/30 text-yellow-400/70 hover:text-yellow-400 hover:bg-yellow-500/10 transition-colors font-mono">
                    {erc20Contracts.every((c) => selectedIds.has(c.id)) ? 'None' : 'All'}
                  </button>
                )}
              </div>
            </div>
            {/* Auto-detect summary bar */}
            {erc20Contracts.length > 0 && (
              <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                {erc20Contracts.map((c) => {
                  const isSelected = selectedIds.has(c.id);
                  const info = tokenData[c.address];
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        setSelectedIds((prev) => {
                          const n = new Set(prev);
                          if (n.has(c.id)) n.delete(c.id);
                          else {
                            n.add(c.id);
                            if (!tokenData[c.address] && !loadingIds.has(c.id)) {
                              loadToken(c);
                              fetchTxEvents(c);
                            }
                          }
                          return n;
                        });
                      }}
                      title={c.address}
                      className={cn(
                        'text-[8px] font-mono px-1.5 py-0.5 rounded-full border transition-all leading-none',
                        isSelected
                          ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300'
                          : 'bg-muted/30 border-border/40 text-muted-foreground/40 hover:border-yellow-500/30 hover:text-yellow-400/60',
                      )}>
                      {info?.symbol || c.name.slice(0, 6)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <ScrollArea className="flex-1 overflow-y-auto">
            <div className="p-2 space-y-1.5">
              {/* Search filter */}
              {allContracts.length > 3 && (
                <div className="relative mb-1">
                  <Search className="absolute w-3 h-3 -translate-y-1/2 left-2 top-1/2 text-muted-foreground/30" />
                  <input
                    value={selectorSearch}
                    onChange={(e) => setSelectorSearch(e.target.value)}
                    placeholder="Filter contracts…"
                    className="w-full h-7 pl-6 pr-2 text-[10px] font-mono bg-muted/20 border border-border/40 rounded-md outline-none focus:border-yellow-500/40 text-foreground/70 placeholder:text-muted-foreground/25"
                  />
                  {selectorSearch && (
                    <button
                      onClick={() => setSelectorSearch('')}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground/30 hover:text-muted-foreground/60">
                      ✕
                    </button>
                  )}
                </div>
              )}
              {/* Native ETH */}
              <ContractSelectorItem
                contract="native"
                isSelected={nativeSelected}
                compat="full"
                onToggle={() => {
                  setNativeSelected((p) => !p);
                  if (!nativeSelected && nativeBalances.length === 0) loadNativeBalances();
                }}
              />

              {/* ERC-20 contracts */}
              {erc20Contracts.length > 0 && (
                <div>
                  <div className="px-1 py-1 text-[8px] uppercase tracking-widest text-muted-foreground/30 font-mono">
                    ERC-20 Compatible ({erc20Contracts.length})
                  </div>
                  {erc20Contracts
                    .filter((c) =>
                      selectorSearch
                        ? c.name.toLowerCase().includes(selectorSearch.toLowerCase()) ||
                          c.address.toLowerCase().includes(selectorSearch.toLowerCase()) ||
                          (tokenData[c.address]?.symbol || '')
                            .toLowerCase()
                            .includes(selectorSearch.toLowerCase())
                        : true,
                    )
                    .map((c) => (
                      <ContractSelectorItem
                        key={c.id}
                        contract={c}
                        isSelected={selectedIds.has(c.id)}
                        compat={compatMap[c.id]}
                        onToggle={() => {
                          setSelectedIds((prev) => {
                            const n = new Set(prev);
                            if (n.has(c.id)) n.delete(c.id);
                            else n.add(c.id);
                            return n;
                          });
                        }}
                      />
                    ))}
                </div>
              )}

              {/* Partial */}
              {partialContracts.length > 0 && (
                <div>
                  <div className="px-1 py-1 text-[8px] uppercase tracking-widest text-muted-foreground/30 font-mono">
                    Partial ({partialContracts.length})
                  </div>
                  {partialContracts
                    .filter((c) =>
                      selectorSearch
                        ? c.name.toLowerCase().includes(selectorSearch.toLowerCase()) ||
                          c.address.toLowerCase().includes(selectorSearch.toLowerCase())
                        : true,
                    )
                    .map((c) => (
                      <ContractSelectorItem
                        key={c.id}
                        contract={c}
                        isSelected={selectedIds.has(c.id)}
                        compat="partial"
                        onToggle={() => {
                          setSelectedIds((prev) => {
                            const n = new Set(prev);
                            n.has(c.id) ? n.delete(c.id) : n.add(c.id);
                            return n;
                          });
                        }}
                      />
                    ))}
                </div>
              )}

              {/* Custom address */}
              <div>
                <button
                  onClick={() => setShowCustom((p) => !p)}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-[9px] text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors">
                  <Plus className="w-3 h-3" /> Custom address
                </button>
                {showCustom && (
                  <div className="flex gap-1 px-1 pb-1">
                    <Input
                      value={customAddress}
                      onChange={(e) => setCustomAddress(e.target.value)}
                      placeholder="0x..."
                      className="h-7 text-[10px] font-mono flex-1"
                    />
                    <button
                      onClick={() => {
                        if (customAddress.startsWith('0x') && customAddress.length === 42) {
                          const fakeContract: DeployedContract = {
                            id: customAddress,
                            name: shortAddr(customAddress),
                            address: customAddress,
                            abi: [],
                            deployedAt: Date.now(),
                            network: '',
                            rpcUrl: '',
                          };
                          loadToken(fakeContract);
                          fetchTxEvents(fakeContract);
                          setSelectedIds((prev) => new Set([...prev, customAddress]));
                          setCustomAddress('');
                          setShowCustom(false);
                        }
                      }}
                      className="h-7 px-2 rounded border border-border text-[10px] text-yellow-400 hover:bg-yellow-500/10 transition-colors">
                      Add
                    </button>
                  </div>
                )}
              </div>

              {allContracts.length === 0 && (
                <div className="text-center py-8 text-[11px] text-muted-foreground/25">
                  <Coins className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  No contracts deployed yet
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Bottom actions */}
          <div className="p-2 border-t border-border/40 space-y-1.5 flex-shrink-0">
            <Button
              onClick={discoverAllBalances}
              disabled={discovering || selectedIds.size === 0}
              variant="outline"
              className="w-full h-8 text-[10px] gap-1.5 border-violet-500/30 text-violet-400 hover:bg-violet-500/10">
              {discovering ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3" />
              )}
              {discovering ? 'Scanning…' : 'Discover All Balances'}
            </Button>
          </div>
        </div>

        {/* ════════ RIGHT: Results ════════ */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Tab bar (one tab per selected) */}
          {activeItems.length > 0 && (
            <div className="flex items-center flex-shrink-0 gap-px px-2 pt-2 overflow-x-auto border-b border-border/50 bg-card/20">
              {nativeSelected && (
                <button
                  onClick={() => setActiveAddr('native')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-[10px] font-medium transition-all border-b-2 whitespace-nowrap',
                    activeAddr === 'native'
                      ? 'border-yellow-500 text-yellow-300 bg-yellow-500/8'
                      : 'border-transparent text-muted-foreground/50 hover:text-muted-foreground',
                  )}>
                  <span className="text-sm leading-none">⟠</span> ETH
                  {loadingNative && <RefreshCw className="w-2.5 h-2.5 animate-spin" />}
                </button>
              )}
              {deployedContracts
                .filter((c) => selectedIds.has(c.id))
                .map((c) => {
                  const info = tokenData[c.address];
                  const isLoading = loadingIds.has(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => setActiveAddr(c.address)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-[10px] font-medium transition-all border-b-2 whitespace-nowrap',
                        activeAddr === c.address
                          ? 'border-yellow-500 text-yellow-300 bg-yellow-500/8'
                          : 'border-transparent text-muted-foreground/50 hover:text-muted-foreground',
                      )}>
                      {info?.symbol || c.name}
                      {isLoading && <RefreshCw className="w-2.5 h-2.5 animate-spin" />}
                    </button>
                  );
                })}
            </div>
          )}

          <ScrollArea className="flex-1 overflow-y-auto">
            <div className="max-w-2xl p-5 space-y-5">
              {/* Empty state */}
              {activeItems.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground/30">
                  <Coins className="w-14 h-14 opacity-15" />
                  <p className="text-sm font-medium">Select a token to inspect</p>
                  <div className="text-[11px] space-y-1.5 text-center">
                    <p>✓ Select multiple ERC-20 contracts</p>
                    <p>✓ View total supply, decimals, supply cap</p>
                    <p>✓ Discover all account balances</p>
                    <p>✓ See last 10 on-chain transactions</p>
                  </div>
                </div>
              )}

              {/*  Native ETH tab  */}
              {activeAddr === 'native' && nativeSelected && (
                <>
                  <div className="p-5 border rounded-xl border-yellow-500/25 bg-yellow-500/5">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="flex items-center justify-center w-10 h-10 text-2xl border rounded-xl bg-yellow-500/15 border-yellow-500/25">
                        ⟠
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-yellow-200">ETH</h2>
                        <p className="text-[11px] text-muted-foreground/50">
                          Native Hardhat Token · 18 decimals
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <InfoBox label="Network" value="Hardhat Local" />
                      <InfoBox label="Decimals" value="18" />
                    </div>
                  </div>

                  {/* ETH Balances */}
                  <section>
                    <SectionHeader icon={Wallet} label="Account ETH Balances" />
                    {loadingNative ? (
                      <LoadingCard />
                    ) : nativeBalances.length > 0 ? (
                      <div className="overflow-hidden border border-border/60 bg-card rounded-xl">
                        {nativeBalances.map((b, i) => (
                          <div
                            key={b.address}
                            className={cn(
                              'flex items-center gap-3 px-3 py-2.5 hover:bg-muted/15 transition-colors',
                              i !== 0 && 'border-t border-border/25',
                            )}>
                            <div className="flex items-center justify-center flex-shrink-0 w-6 h-6 border rounded-full bg-gradient-to-br from-yellow-500/20 to-amber-500/15 border-yellow-500/20">
                              <span className="text-[8px] font-mono font-bold text-yellow-300">
                                {b.idx}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[10px] font-medium text-foreground/80">
                                {b.label}
                              </div>
                              <code className="text-[9px] font-mono text-muted-foreground/35">
                                {shortAddr(b.address)}
                              </code>
                            </div>
                            <div className="text-right">
                              <div
                                className={cn(
                                  'text-xs font-mono font-semibold',
                                  b.raw > 0n ? 'text-yellow-300' : 'text-muted-foreground/30',
                                )}>
                                {parseFloat(b.formatted).toFixed(4)}
                              </div>
                              <div className="text-[9px] text-muted-foreground/40">ETH</div>
                            </div>
                            <button onClick={() => copy(`eth-${b.address}`, b.address)}>
                              {copied === `eth-${b.address}` ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3 text-muted-foreground/20 hover:text-muted-foreground" />
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <button
                        onClick={loadNativeBalances}
                        className="w-full py-6 text-[11px] text-muted-foreground/30 hover:text-muted-foreground/50 transition-colors">
                        Click to load ETH balances
                      </button>
                    )}
                  </section>
                </>
              )}

              {/*  ERC-20 Token tab  */}
              {activeAddr !== 'native' && activeContract && (
                <>
                  {errors[activeAddr] && (
                    <div className="flex items-center gap-2 p-3 text-xs border bg-rose-500/10 border-rose-500/20 rounded-xl text-rose-400">
                      <AlertCircle className="flex-shrink-0 w-4 h-4" />
                      {errors[activeAddr]}
                    </div>
                  )}

                  {loadingIds.has(activeContract.id) && <LoadingCard label="Reading token data…" />}

                  {activeToken && (
                    <>
                      {/*  Token Info Card  */}
                      <div className="p-5 border rounded-xl border-yellow-500/20 bg-yellow-500/5">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-10 h-10 border rounded-xl bg-yellow-500/15 border-yellow-500/20">
                              <Coins className="w-5 h-5 text-yellow-400" />
                            </div>
                            <div>
                              <h2 className="font-mono text-xl font-bold">{activeToken.symbol}</h2>
                              <p className="text-[11px] text-muted-foreground/50">
                                {activeToken.name}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[9px] text-muted-foreground/40 mb-0.5">
                              Decimals
                            </div>
                            <div className="font-mono text-2xl font-bold text-yellow-400">
                              {activeToken.decimals}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <InfoBox
                            label="Contract Address"
                            value={shortAddr(activeToken.address)}
                            onCopy={() => copy('addr', activeToken.address)}
                            copied={copied === 'addr'}
                            mono
                          />
                          <InfoBox
                            label="Total Supply"
                            value={`${activeToken.totalSupply} ${activeToken.symbol}`}
                            mono
                          />
                        </div>

                        {/* Supply policy */}
                        <div
                          className={cn(
                            'rounded-lg border p-3 flex items-start gap-3',
                            activeToken.maxSupply
                              ? 'bg-emerald-500/5 border-emerald-500/20'
                              : 'bg-amber-500/5 border-amber-500/15',
                          )}>
                          <div
                            className={cn(
                              'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                              activeToken.maxSupply ? 'bg-emerald-500/15' : 'bg-amber-500/15',
                            )}>
                            {activeToken.maxSupply ? (
                              <Lock className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <TrendingUp className="w-4 h-4 text-amber-400" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div
                              className={cn(
                                'text-xs font-semibold mb-0.5',
                                activeToken.maxSupply ? 'text-emerald-400' : 'text-amber-400',
                              )}>
                              {activeToken.maxSupply
                                ? '🔒 Capped Supply'
                                : '♾️ Uncapped / Inflationary'}
                            </div>
                            {activeToken.maxSupply ? (
                              <div className="space-y-1">
                                <p className="text-[10px] text-muted-foreground/60">
                                  Max:{' '}
                                  <span className="font-mono text-foreground/80">
                                    {activeToken.maxSupply} {activeToken.symbol}
                                  </span>
                                </p>
                                {activeToken && (
                                  <>
                                    <p className="text-[10px] text-muted-foreground/50">
                                      Remaining:{' '}
                                      <span className="font-mono text-emerald-300/80">
                                        {formatUnits(
                                          (activeToken?.maxSupplyRaw ?? 0n) -
                                            (activeToken?.totalSupplyRaw ?? 0n),
                                          activeToken.decimals,
                                        )}{' '}
                                        {activeToken.symbol}
                                      </span>
                                    </p>
                                    <div className="h-1.5 rounded-full bg-border/30 overflow-hidden mt-1">
                                      <div
                                        className="h-full rounded-full bg-emerald-500/60"
                                        style={{
                                          width: `${Math.min(
                                            100,
                                            Number(
                                              ((activeToken?.totalSupplyRaw ?? 0n) * 100n) /
                                                (activeToken?.maxSupplyRaw ?? 1n),
                                            ),
                                          )}%`,
                                        }}
                                      />
                                    </div>
                                    <p className="text-[9px] text-muted-foreground/35">
                                      {Number(
                                        ((activeToken?.totalSupplyRaw ?? 0n) * 100n) /
                                          (activeToken?.maxSupplyRaw ?? 1n),
                                      )}
                                      % minted
                                    </p>
                                  </>
                                )}
                              </div>
                            ) : (
                              <p className="text-[10px] text-muted-foreground/50">
                                No cap found. Supply can grow without bound.
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col gap-1 text-[9px] text-right flex-shrink-0">
                            {activeToken.mintable && (
                              <span className="text-violet-400/70">✓ mintable</span>
                            )}
                            {activeToken.burnable && (
                              <span className="text-orange-400/70">✓ burnable</span>
                            )}
                            {activeToken.hasOwner && (
                              <span className="text-sky-400/70">✓ Ownable</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/*  ERC-20 Checklist  */}
                      <div className="p-4 border rounded-xl border-border/60 bg-card">
                        <SectionHeader icon={Hash} label="ERC-20 Interface" />
                        <div className="grid grid-cols-3 gap-1.5">
                          {[
                            'transfer',
                            'transferFrom',
                            'approve',
                            'allowance',
                            'balanceOf',
                            'totalSupply',
                            'name',
                            'symbol',
                            'decimals',
                          ].map((fn) => {
                            const hasFn = activeContract.abi.some((i) => i.name === fn);
                            return (
                              <div
                                key={fn}
                                className={cn(
                                  'flex items-center gap-1.5 text-[10px] px-2 py-1.5 rounded-lg border',
                                  hasFn
                                    ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400/80'
                                    : 'border-border/30 text-muted-foreground/25',
                                )}>
                                <div
                                  className={cn(
                                    'w-1.5 h-1.5 rounded-full flex-shrink-0',
                                    hasFn ? 'bg-emerald-400' : 'bg-muted-foreground/20',
                                  )}
                                />
                                <code className="font-mono">{fn}()</code>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/*  Recent Transactions  */}
                      <div className="overflow-hidden border rounded-xl border-border/60 bg-card">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-muted/10">
                          <div className="flex items-center gap-2">
                            <Activity className="w-3.5 h-3.5 text-sky-400" />
                            <h3 className="text-xs font-semibold">Recent Transactions</h3>
                            <span className="text-[9px] text-muted-foreground/35 font-mono">
                              last 10
                            </span>
                          </div>
                          <button
                            onClick={() => fetchTxEvents(activeContract)}
                            disabled={loadingTxs.has(activeAddr)}
                            className="flex items-center gap-1 text-[10px] text-muted-foreground/40 hover:text-muted-foreground transition-colors">
                            <RefreshCw
                              className={cn(
                                'w-3 h-3',
                                loadingTxs.has(activeAddr) && 'animate-spin',
                              )}
                            />
                            Refresh
                          </button>
                        </div>

                        {/* Legend */}
                        <div className="px-3 py-1.5 border-b border-border/25 flex items-center gap-3 bg-muted/5">
                          {[
                            {
                              label: 'mint',
                              color: 'text-emerald-400',
                              icon: <Plus className="w-2.5 h-2.5" />,
                            },
                            {
                              label: 'transfer',
                              color: 'text-sky-400',
                              icon: <ArrowRightLeft className="w-2.5 h-2.5" />,
                            },
                            {
                              label: 'burn',
                              color: 'text-rose-400',
                              icon: <Flame className="w-2.5 h-2.5" />,
                            },
                            {
                              label: 'approve',
                              color: 'text-violet-400',
                              icon: <CheckSquare className="w-2.5 h-2.5" />,
                            },
                          ].map(({ label, color, icon }) => (
                            <div
                              key={label}
                              className={cn('flex items-center gap-1 text-[8px] font-mono', color)}>
                              {icon} {label}
                            </div>
                          ))}
                        </div>

                        {loadingTxs.has(activeAddr) ? (
                          <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground/30">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Scanning blocks…
                          </div>
                        ) : activeTxs.length > 0 ? (
                          <div className="divide-y divide-border/20">
                            {activeTxs.map((tx, i) => (
                              <TxEventRow
                                key={`${tx.hash}-${i}`}
                                tx={tx}
                                symbol={activeToken.symbol}
                              />
                            ))}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center gap-2 py-10">
                            <Clock className="w-8 h-8 text-muted-foreground/15" />
                            <p className="text-[11px] text-muted-foreground/30">
                              No transactions found for this contract
                            </p>
                            <p className="text-[10px] text-muted-foreground/20">
                              Interact with the contract to see activity here
                            </p>
                          </div>
                        )}
                      </div>

                      {/*  Discovered Balances  */}
                      {activeDiscovered && activeDiscovered.length > 0 && (
                        <div className="overflow-hidden border rounded-xl border-violet-500/20 bg-violet-500/5">
                          <div className="flex items-center justify-between px-4 py-3 border-b border-violet-500/15">
                            <div className="flex items-center gap-2">
                              <Users className="w-3.5 h-3.5 text-violet-400" />
                              <h3 className="text-xs font-semibold text-violet-300">
                                Account Balance Discovery
                              </h3>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground/40 font-mono">
                                <span className="font-semibold text-violet-300">
                                  {
                                    (activeDiscovered as DiscoveredBalance[]).filter(
                                      (d) => d.raw > 0n,
                                    ).length
                                  }
                                </span>
                                /{activeDiscovered.length} holders
                              </span>
                              <button
                                onClick={() =>
                                  setShowDiscovered((prev) => ({
                                    ...prev,
                                    [activeAddr]: !prev[activeAddr],
                                  }))
                                }
                                className="text-[10px] text-violet-400/60 hover:text-violet-400 flex items-center gap-1 transition-colors">
                                {showDiscovered[activeAddr] ? (
                                  <ChevronUp className="w-3 h-3" />
                                ) : (
                                  <ChevronDown className="w-3 h-3" />
                                )}
                                {showDiscovered[activeAddr] ? 'Hide zero' : 'Show all'}
                              </button>
                            </div>
                          </div>
                          <div className="divide-y divide-violet-500/10">
                            {(activeDiscovered as DiscoveredBalance[])
                              .filter((d) => showDiscovered[activeAddr] || d.raw > 0n)
                              .map((d) => {
                                const total = (activeDiscovered as DiscoveredBalance[]).reduce(
                                  (a, x) => a + x.raw,
                                  0n,
                                );
                                return (
                                  <div
                                    key={d.address}
                                    className={cn(
                                      'flex items-center gap-3 px-4 py-2.5 transition-colors',
                                      d.raw > 0n ? 'hover:bg-violet-500/8' : 'opacity-35',
                                    )}>
                                    <div className="flex items-center justify-center flex-shrink-0 w-6 h-6 border rounded-full bg-gradient-to-br from-violet-500/30 to-purple-500/20 border-violet-500/20">
                                      <span className="text-[8px] font-mono font-bold text-violet-300">
                                        {d.idx}
                                      </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="text-[10px] font-medium text-foreground/80">
                                        {d.label}
                                      </div>
                                      <code className="text-[9px] font-mono text-muted-foreground/35">
                                        {shortAddr(d.address)}
                                      </code>
                                    </div>
                                    <div className="flex-shrink-0 text-right">
                                      <div
                                        className={cn(
                                          'text-xs font-mono font-semibold',
                                          d.raw > 0n
                                            ? 'text-violet-300'
                                            : 'text-muted-foreground/25',
                                        )}>
                                        {d.formatted}
                                      </div>
                                      <div className="text-[9px] text-muted-foreground/35">
                                        {activeToken.symbol}
                                      </div>
                                    </div>
                                    {d.raw > 0n && total > 0n && (
                                      <div className="flex-shrink-0 w-12">
                                        <div className="h-1 overflow-hidden rounded-full bg-violet-500/10">
                                          <div
                                            className="h-full rounded-full bg-violet-500/60"
                                            style={{ width: `${Number((d.raw * 100n) / total)}%` }}
                                          />
                                        </div>
                                        <div className="text-[8px] text-muted-foreground/25 text-right mt-0.5">
                                          {Number((d.raw * 100n) / total)}%
                                        </div>
                                      </div>
                                    )}
                                    <button onClick={() => copy(`bal-${d.address}`, d.address)}>
                                      {copied === `bal-${d.address}` ? (
                                        <Check className="w-3 h-3 text-emerald-400" />
                                      ) : (
                                        <Copy className="w-3 h-3 text-muted-foreground/20 hover:text-muted-foreground" />
                                      )}
                                    </button>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}

//  Helper sub-components 
function SectionHeader({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-3">
      <Icon className="w-3.5 h-3.5 text-muted-foreground/40" />
      <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
        {label}
      </h3>
    </div>
  );
}

function InfoBox({
  label,
  value,
  onCopy,
  copied,
  mono,
}: {
  label: string;
  value: string;
  onCopy?: () => void;
  copied?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg bg-background/50 border border-border/40 p-2.5">
      <div className="text-[9px] text-muted-foreground/40 mb-1">{label}</div>
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            'text-xs flex-1 min-w-0 truncate',
            mono ? 'font-mono text-emerald-300/70' : 'text-foreground/80',
          )}>
          {value}
        </span>
        {onCopy && (
          <button onClick={onCopy}>
            {copied ? (
              <Check className="w-3 h-3 text-emerald-400" />
            ) : (
              <Copy className="w-3 h-3 text-muted-foreground/25 hover:text-muted-foreground" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function LoadingCard({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-xs text-muted-foreground/30">
      <RefreshCw className="w-4 h-4 animate-spin" /> {label}
    </div>
  );
}
