import React, { useState, useEffect } from 'react';
import { DeployedContract } from '../../types';
import { cn } from '../../lib/utils';
import {
  Plus,
  Trash2,
  RefreshCw,
  Copy,
  ExternalLink,
  AlertCircle,
  Settings,
  X,
  Search,
  Sparkles,
  Zap,
  Grid3X3,
} from 'lucide-react';

// ─── IPFS ─────────────────────────────────────────────────────────────────────
const GATEWAYS = [
  { label: 'ipfs.io', url: 'https://ipfs.io/ipfs/' },
  { label: 'Cloudflare', url: 'https://cloudflare-ipfs.com/ipfs/' },
  { label: 'dweb.link', url: 'https://dweb.link/ipfs/' },
  { label: 'w3s.link', url: 'https://w3s.link/ipfs/' },
  { label: 'nftstorage.link', url: 'https://nftstorage.link/ipfs/' },
  { label: 'Pinata', url: 'https://gateway.pinata.cloud/ipfs/' },
];

const CUSTOM_GW_KEY = 'nft_custom_gw_list';

function resolveIPFS(uri: string, gw: string): string {
  if (!uri) return '';
  if (uri.startsWith('ipfs://')) return gw + uri.slice(7);
  if (uri.startsWith('/ipfs/')) return gw + uri.slice(6);
  if (/^Qm[1-9A-HJ-NP-Za-km-z]{44}/.test(uri)) return gw + uri;
  if (/^ba[a-z2-7]{56,}/.test(uri)) return gw + uri;
  if (uri.startsWith('data:') || uri.startsWith('http')) return uri;
  return uri;
}

const isIPFS = (uri: string) =>
  uri.startsWith('ipfs://') ||
  uri.startsWith('/ipfs/') ||
  /^Qm[1-9A-HJ-NP-Za-km-z]{44}/.test(uri) ||
  /^ba[a-z2-7]{56,}/.test(uri);

// ─── RPC helpers ──────────────────────────────────────────────────────────────
async function rpc(url: string, method: string, params: unknown[]) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const d = (await r.json()) as { result?: string; error?: { message: string } };
  if (d.error) throw new Error(d.error.message);
  return d.result as string;
}

function decStr(hex: string): string {
  if (!hex || hex === '0x') return '';
  try {
    const d = hex.slice(2);
    const off = parseInt(d.slice(0, 64), 16) * 2;
    const len = parseInt(d.slice(off, off + 64), 16) * 2;
    return Buffer.from(d.slice(off + 64, off + 64 + len), 'hex')
      .toString('utf8')
      .replace(/\0/g, '');
  } catch {
    return '';
  }
}

const decAddr = (hex: string) => (hex && hex !== '0x' ? '0x' + hex.slice(-40) : '');

// ─── Types ────────────────────────────────────────────────────────────────────
interface NFTToken {
  id: string;
  contractAddress: string;
  contractName: string;
  tokenId: string;
  owner?: string;
  tokenURI?: string;
  metadata?: {
    name?: string;
    description?: string;
    image?: string;
    attributes?: { trait_type: string; value: string }[];
  };
  error?: string;
  loading?: boolean;
  standard?: string;
}

interface AutoDetectResult {
  address: string;
  name: string;
  symbol: string;
  standard: string;
  totalSupply?: number;
  tokenIds: string[];
}

interface Props {
  rpcUrl: string;
  deployedContracts: DeployedContract[];
}

// ─── Fetch single NFT ─────────────────────────────────────────────────────────
async function fetchNFT(
  rpcUrl: string,
  addr: string,
  tokenId: string,
  gw: string,
): Promise<Partial<NFTToken>> {
  const a = addr.toLowerCase();
  const pad = parseInt(tokenId).toString(16).padStart(64, '0');
  try {
    const ownerHex = await rpc(rpcUrl, 'eth_call', [{ to: a, data: '0x6352211e' + pad }, 'latest']);
    const owner = decAddr(ownerHex);

    let tokenURI = '';
    try {
      tokenURI = decStr(
        await rpc(rpcUrl, 'eth_call', [{ to: a, data: '0xc87b56dd' + pad }, 'latest']),
      );
    } catch {}

    let contractName = '';
    try {
      contractName = decStr(
        await rpc(rpcUrl, 'eth_call', [{ to: a, data: '0x06fdde03' }, 'latest']),
      );
    } catch {}

    let metadata: NFTToken['metadata'];
    if (tokenURI) {
      const resolved = resolveIPFS(tokenURI, gw);
      try {
        if (resolved.startsWith('data:application/json')) {
          metadata = JSON.parse(atob(resolved.split(',')[1]));
        } else if (resolved.startsWith('data:')) {
          metadata = { image: resolved };
        } else if (resolved.startsWith('http')) {
          try {
            const res = await fetch(resolved, { signal: AbortSignal.timeout(8000) });
            if (res.ok) metadata = await res.json();
          } catch (corsErr) {
            try {
              const proxied = `https://corsproxy.io/?${encodeURIComponent(resolved)}`;
              const res2 = await fetch(proxied, { signal: AbortSignal.timeout(8000) });
              if (res2.ok) metadata = await res2.json();
            } catch {}
          }
        }
      } catch {}
    }
    return { owner, tokenURI, metadata, contractName };
  } catch (e: any) {
    return { error: e.message };
  }
}

// ─── Auto-detect ──────────────────────────────────────────────────────────────
async function autoDetect(rpcUrl: string, addr: string): Promise<AutoDetectResult | null> {
  const a = addr.toLowerCase();
  try {
    let name = '',
      symbol = '';
    try {
      name = decStr(await rpc(rpcUrl, 'eth_call', [{ to: a, data: '0x06fdde03' }, 'latest']));
    } catch {}
    try {
      symbol = decStr(await rpc(rpcUrl, 'eth_call', [{ to: a, data: '0x95d89b41' }, 'latest']));
    } catch {}
    if (!name && !symbol) {
      let isNFT = false;
      for (const testId of [0, 1, 2]) {
        try {
          const pad = testId.toString(16).padStart(64, '0');
          const ownerHex = await rpc(rpcUrl, 'eth_call', [
            { to: a, data: '0x6352211e' + pad },
            'latest',
          ]);
          const owner = decAddr(ownerHex);
          if (owner && owner !== '0x0000000000000000000000000000000000000000') {
            isNFT = true;
            break;
          }
        } catch {}
      }
      if (!isNFT) return null;
      name = addr.slice(0, 8) + '...';
    }

    let standard = 'ERC-721';
    try {
      const r = await rpc(rpcUrl, 'eth_call', [
        { to: a, data: '0x01ffc9a7d9b67a26' + '0'.repeat(56) },
        'latest',
      ]);
      if (r && r !== '0x' && BigInt(r) === 1n) standard = 'ERC-1155';
    } catch {}

    let totalSupply: number | undefined;
    try {
      const h = await rpc(rpcUrl, 'eth_call', [{ to: a, data: '0x18160ddd' }, 'latest']);
      if (h && h !== '0x') totalSupply = Number(BigInt(h));
    } catch {}

    const count = Math.min(totalSupply || 10, 12);
    const tokenIds: string[] = [];
    for (let i = 0; i < count + 5 && tokenIds.length < 12; i++) {
      try {
        const pad = i.toString(16).padStart(64, '0');
        const owner = await rpc(rpcUrl, 'eth_call', [
          { to: a, data: '0x6352211e' + pad },
          'latest',
        ]);
        if (
          owner &&
          owner !== '0x' &&
          decAddr(owner) !== '0x0000000000000000000000000000000000000000'
        ) {
          tokenIds.push(String(i));
        }
      } catch {}
    }

    return {
      address: addr,
      name: name || addr.slice(0, 8),
      symbol,
      standard,
      totalSupply,
      tokenIds,
    };
  } catch {
    return null;
  }
}

// ─── Scan progress ────────────────────────────────────────────────────────────
interface ScanProgress {
  phase: 'idle' | 'info' | 'scanning' | 'done' | 'error';
  contractName: string;
  symbol: string;
  standard: string;
  totalSupply?: number;
  scanned: number;
  found: number;
  tokenIds: string[];
  errorMsg?: string;
}

async function deepScan(
  rpcUrl: string,
  addr: string,
  onProgress: (p: ScanProgress) => void,
  maxTokens = 50,
): Promise<AutoDetectResult | null> {
  const a = addr.toLowerCase();
  onProgress({
    phase: 'info',
    contractName: '',
    symbol: '',
    standard: 'ERC-721',
    scanned: 0,
    found: 0,
    tokenIds: [],
  });

  let name = '',
    symbol = '',
    standard = 'ERC-721';
  try {
    name = decStr(await rpc(rpcUrl, 'eth_call', [{ to: a, data: '0x06fdde03' }, 'latest']));
  } catch {}
  try {
    symbol = decStr(await rpc(rpcUrl, 'eth_call', [{ to: a, data: '0x95d89b41' }, 'latest']));
  } catch {}

  if (!name && !symbol) {
    let isNFT = false;
    for (const testId of [0, 1, 2]) {
      try {
        const pad = testId.toString(16).padStart(64, '0');
        const ownerHex = await rpc(rpcUrl, 'eth_call', [
          { to: a, data: '0x6352211e' + pad },
          'latest',
        ]);
        const owner = decAddr(ownerHex);
        if (owner && owner !== '0x0000000000000000000000000000000000000000') {
          isNFT = true;
          break;
        }
      } catch {}
    }
    if (!isNFT) {
      onProgress({
        phase: 'error',
        contractName: '',
        symbol: '',
        standard,
        scanned: 0,
        found: 0,
        tokenIds: [],
        errorMsg: 'Could not verify as NFT contract — no name/symbol and ownerOf() failed',
      });
      return null;
    }
    name = a.slice(0, 8) + '…';
  }

  try {
    const r = await rpc(rpcUrl, 'eth_call', [
      { to: a, data: '0x01ffc9a7d9b67a26' + '0'.repeat(56) },
      'latest',
    ]);
    if (r && r !== '0x' && BigInt(r) === 1n) standard = 'ERC-1155';
  } catch {}

  let totalSupply: number | undefined;
  try {
    const h = await rpc(rpcUrl, 'eth_call', [{ to: a, data: '0x18160ddd' }, 'latest']);
    if (h && h !== '0x') totalSupply = Number(BigInt(h));
  } catch {}

  onProgress({
    phase: 'scanning',
    contractName: name,
    symbol,
    standard,
    totalSupply,
    scanned: 0,
    found: 0,
    tokenIds: [],
  });

  const limit = Math.min(totalSupply ?? maxTokens, maxTokens);
  const tokenIds: string[] = [];
  const ZERO_ADDR = '0x0000000000000000000000000000000000000000';

  for (let i = 0; i <= limit + 10 && tokenIds.length < maxTokens; i++) {
    try {
      const pad = i.toString(16).padStart(64, '0');
      const owner = await rpc(rpcUrl, 'eth_call', [{ to: a, data: '0x6352211e' + pad }, 'latest']);
      if (owner && owner !== '0x' && decAddr(owner) !== ZERO_ADDR) {
        tokenIds.push(String(i));
      }
    } catch {}
    if (i % 5 === 0) {
      onProgress({
        phase: 'scanning',
        contractName: name,
        symbol,
        standard,
        totalSupply,
        scanned: i,
        found: tokenIds.length,
        tokenIds: [...tokenIds],
      });
    }
  }

  onProgress({
    phase: 'done',
    contractName: name,
    symbol,
    standard,
    totalSupply,
    scanned: limit,
    found: tokenIds.length,
    tokenIds,
  });
  if (tokenIds.length === 0) return null;
  return { address: addr, name: name || addr.slice(0, 8), symbol, standard, totalSupply, tokenIds };
}

// ─── Add / Scan form ──────────────────────────────────────────────────────────
function AddForm({
  rpcUrl,
  onClose,
  onImport,
}: {
  rpcUrl: string;
  onClose: () => void;
  onImport: (r: AutoDetectResult) => void;
}) {
  const [tab, setTab] = useState<'scan' | 'manual'>('scan');
  const [addr, setAddr] = useState('');
  const [tokenId, setTokenId] = useState('');
  const [scanAddr, setScanAddr] = useState('');
  const [maxTokens, setMaxTokens] = useState(20);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [result, setResult] = useState<AutoDetectResult | null>(null);
  const abortRef = React.useRef(false);

  const startScan = async () => {
    if (!scanAddr) return;
    abortRef.current = false;
    setResult(null);
    const r = await deepScan(
      rpcUrl,
      scanAddr,
      (p) => {
        if (!abortRef.current) setProgress(p);
      },
      maxTokens,
    );
    if (!abortRef.current) setResult(r);
  };

  const cancelScan = () => {
    abortRef.current = true;
    setProgress(null);
  };

  return (
    <div className="px-4 py-3 border-b border-white/5 bg-[#13131f] flex-shrink-0">
      {/* Tabs */}
      <div className="flex gap-1 mb-3">
        {(['scan', 'manual'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-3 py-1 text-xs rounded-lg transition-all capitalize',
              tab === t ? 'bg-violet-500/20 text-violet-300' : 'text-white/30 hover:text-white/60',
            )}>
            {t === 'scan' ? '✦ Auto Scan' : 'Manual'}
          </button>
        ))}
      </div>

      {tab === 'scan' ? (
        <div className="space-y-2.5">
          <div className="flex gap-2">
            <input
              value={scanAddr}
              onChange={(e) => setScanAddr(e.target.value)}
              placeholder="Contract address (0x…)"
              className="flex-1 h-8 px-3 text-xs font-mono bg-white/[0.03] border border-white/5 rounded-xl text-white/80 placeholder:text-white/20 outline-none focus:border-violet-500/50 transition-all"
              onKeyDown={(e) => e.key === 'Enter' && startScan()}
            />
            <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/5 rounded-xl px-2">
              <span className="text-[9px] text-white/25">max</span>
              <input
                type="number"
                value={maxTokens}
                min={5}
                max={200}
                onChange={(e) => setMaxTokens(parseInt(e.target.value) || 20)}
                className="w-10 text-xs text-center bg-transparent outline-none text-white/60"
              />
            </div>
            {progress?.phase === 'scanning' ? (
              <button
                onClick={cancelScan}
                className="flex items-center gap-1.5 px-3 h-8 text-xs bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 rounded-xl transition-all">
                <X className="w-3 h-3" /> Stop
              </button>
            ) : (
              <button
                onClick={startScan}
                disabled={!scanAddr}
                className="flex items-center gap-1.5 px-4 h-8 text-xs bg-violet-600 hover:bg-violet-500 text-white rounded-xl disabled:opacity-30 transition-all">
                <Zap className="w-3.5 h-3.5" /> Scan
              </button>
            )}
          </div>

          {progress && progress.phase !== 'idle' && (
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 space-y-2">
              {progress.phase === 'error' ? (
                <div className="flex items-center gap-2 text-xs text-rose-400">
                  <AlertCircle className="w-3.5 h-3.5" /> {progress.errorMsg}
                </div>
              ) : (
                <>
                  {progress.contractName && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{progress.contractName}</span>
                      {progress.symbol && (
                        <span className="text-xs text-violet-400">{progress.symbol}</span>
                      )}
                      <span className="text-[9px] bg-violet-500/20 text-violet-300 px-1.5 py-0.5 rounded-full border border-violet-500/20">
                        {progress.standard}
                      </span>
                      {progress.totalSupply !== undefined && (
                        <span className="text-[9px] text-white/25 ml-auto">
                          supply: {progress.totalSupply.toLocaleString()}
                        </span>
                      )}
                    </div>
                  )}

                  {progress.phase === 'scanning' && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-white/30">
                        <span className="flex items-center gap-1.5">
                          <RefreshCw className="w-2.5 h-2.5 animate-spin text-violet-400" />
                          Scanning token IDs…
                        </span>
                        <span>
                          <span className="font-semibold text-violet-300">{progress.found}</span>{' '}
                          found
                          {progress.totalSupply !== undefined && (
                            <span className="ml-1">
                              ({progress.scanned}/{Math.min(progress.totalSupply, maxTokens)})
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-white/5">
                        <div
                          className="h-full transition-all duration-300 rounded-full bg-gradient-to-r from-violet-600 to-violet-400"
                          style={{
                            width: progress.totalSupply
                              ? `${(progress.scanned / Math.min(progress.totalSupply, maxTokens)) * 100}%`
                              : '100%',
                            animation: !progress.totalSupply ? 'pulse 1.5s infinite' : undefined,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {progress.tokenIds.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {progress.tokenIds.slice(0, 16).map((tid) => (
                        <span
                          key={tid}
                          className="text-[9px] bg-violet-500/15 text-violet-300/80 px-1.5 py-0.5 rounded-lg font-mono border border-violet-500/10">
                          #{tid}
                        </span>
                      ))}
                      {progress.tokenIds.length > 16 && (
                        <span className="text-[9px] text-white/20">
                          +{progress.tokenIds.length - 16} more
                        </span>
                      )}
                    </div>
                  )}

                  {progress.phase === 'done' && result && (
                    <button
                      onClick={() => {
                        onImport(result);
                        onClose();
                      }}
                      className="w-full h-8 text-xs font-medium text-white transition-all bg-violet-600 hover:bg-violet-500 rounded-xl">
                      Import {result.tokenIds.length} NFT{result.tokenIds.length !== 1 ? 's' : ''} →
                    </button>
                  )}
                  {progress.phase === 'done' && !result && (
                    <p className="py-1 text-xs text-center text-white/30">
                      No tokens found at this address
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            value={addr}
            onChange={(e) => setAddr(e.target.value)}
            placeholder="Contract address (0x…)"
            className="flex-1 h-7 px-3 text-xs font-mono bg-white/[0.03] border border-white/5 rounded-xl text-white/70 placeholder:text-white/20 outline-none focus:border-violet-500/40"
          />
          <input
            value={tokenId}
            onChange={(e) => setTokenId(e.target.value)}
            placeholder="Token ID"
            className="w-24 h-7 px-3 text-xs bg-white/[0.03] border border-white/5 rounded-xl text-white/70 placeholder:text-white/20 outline-none focus:border-violet-500/40"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && addr && tokenId) {
                onImport({
                  address: addr,
                  name: '',
                  symbol: '',
                  standard: 'ERC-721',
                  tokenIds: [tokenId],
                });
                onClose();
              }
            }}
          />
          <button
            disabled={!addr || !tokenId}
            onClick={() => {
              onImport({
                address: addr,
                name: '',
                symbol: '',
                standard: 'ERC-721',
                tokenIds: [tokenId],
              });
              onClose();
            }}
            className="px-3 text-xs text-white transition-all h-7 bg-violet-600 hover:bg-violet-500 rounded-xl disabled:opacity-30">
            Add
          </button>
        </div>
      )}
    </div>
  );
}

// ─── NFT Card ─────────────────────────────────────────────────────────────────
function NFTCard({
  token,
  gw,
  onClick,
  onRemove,
}: {
  token: NFTToken;
  gw: string;
  onClick: () => void;
  onRemove: (e: React.MouseEvent) => void;
}) {
  const img = token.metadata?.image ? resolveIPFS(token.metadata.image, gw) : null;
  const name = token.metadata?.name || `#${token.tokenId}`;

  return (
    <div
      onClick={onClick}
      className="group relative rounded-2xl overflow-hidden cursor-pointer bg-[#1a1a2e] border border-white/5 hover:border-violet-500/40 transition-all duration-200 hover:scale-[1.02] hover:shadow-xl hover:shadow-violet-900/20">
      <div className="aspect-square bg-gradient-to-br from-[#1a1a2e] to-[#16213e] relative overflow-hidden">
        {token.loading ? (
          <div className="flex items-center justify-center w-full h-full">
            <div className="border-2 rounded-full w-7 h-7 border-violet-500/30 border-t-violet-400 animate-spin" />
          </div>
        ) : img ? (
          <img
            src={img}
            alt={name}
            className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center w-full h-full gap-1">
            <span className="font-mono text-2xl font-black text-white/5">#{token.tokenId}</span>
            {token.error && <AlertCircle className="w-4 h-4 text-rose-400/40" />}
          </div>
        )}
        <div className="absolute inset-0 transition-opacity opacity-0 bg-gradient-to-t from-black/50 to-transparent group-hover:opacity-100" />
        <button
          onClick={onRemove}
          className="absolute flex items-center justify-center w-6 h-6 transition-all rounded-full opacity-0 top-2 right-2 bg-black/60 group-hover:opacity-100 hover:bg-rose-500/80 text-white/60 hover:text-white">
          <X className="w-3 h-3" />
        </button>
        {token.tokenURI && isIPFS(token.tokenURI) && (
          <div className="absolute top-2 left-2 text-[8px] bg-violet-500/70 text-white px-1.5 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-all font-medium">
            IPFS
          </div>
        )}
      </div>
      <div className="p-2.5">
        <div className="text-xs font-semibold truncate text-white/85">{name}</div>
        <div className="text-[10px] text-white/25 font-mono truncate mt-0.5">
          {token.contractName || token.contractAddress.slice(0, 10) + '…'}
        </div>
      </div>
    </div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function NFTDetail({
  token,
  gw,
  onClose,
  onRefresh,
  onRemove,
}: {
  token: NFTToken;
  gw: string;
  onClose: () => void;
  onRefresh: () => void;
  onRemove: () => void;
}) {
  const img = token.metadata?.image ? resolveIPFS(token.metadata.image, gw) : null;
  const name = token.metadata?.name || `Token #${token.tokenId}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
      onClick={onClose}>
      <div
        className="relative bg-[#13131f] border border-white/10 rounded-3xl overflow-hidden shadow-2xl w-[500px] max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 z-10 w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all">
          <X className="w-3.5 h-3.5" />
        </button>

        <div className="relative bg-gradient-to-br from-[#1a1a3e] to-[#0d0d1f] flex-shrink-0 h-60">
          {img ? (
            <img src={img} alt={name} className="object-contain w-full h-full" />
          ) : (
            <div className="flex items-center justify-center w-full h-full">
              <span className="font-mono text-5xl font-black text-white/5">#{token.tokenId}</span>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#13131f]" />
        </div>

        <div className="flex-1 px-5 pt-2 pb-5 space-y-4 overflow-y-auto">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-bold leading-tight text-white">{name}</h2>
              {token.contractName && (
                <p className="text-xs text-violet-400 mt-0.5">{token.contractName}</p>
              )}
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={onRefresh}
                disabled={token.loading}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all disabled:opacity-30">
                <RefreshCw className={cn('w-3.5 h-3.5', token.loading && 'animate-spin')} />
              </button>
              <button
                onClick={onRemove}
                className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-all">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {token.error && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {token.error}
            </div>
          )}

          <div className="space-y-1.5">
            {(
              [
                { label: 'Token ID', val: `#${token.tokenId}`, mono: false, copy: false },
                { label: 'Contract', val: token.contractAddress, mono: true, copy: true },
                { label: 'Owner', val: token.owner, mono: true, copy: true },
              ] as const
            ).map(({ label, val, mono, copy }) =>
              val ? (
                <div
                  key={label}
                  className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.03] border border-white/5">
                  <span className="text-[10px] text-white/25 uppercase tracking-widest w-16 flex-shrink-0">
                    {label}
                  </span>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={cn(
                        'text-xs text-white/65 truncate max-w-[260px]',
                        mono ? 'font-mono' : '',
                      )}>
                      {val}
                    </span>
                    {copy && (
                      <button
                        onClick={() => navigator.clipboard.writeText(val as string)}
                        className="flex-shrink-0 transition-all text-white/20 hover:text-white/50">
                        <Copy className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ) : null,
            )}
          </div>

          {token.tokenURI && (
            <div className="px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-white/25 uppercase tracking-widest">
                  Token URI
                </span>
                <div className="flex items-center gap-1.5">
                  {isIPFS(token.tokenURI) && (
                    <span className="text-[8px] bg-violet-500/20 text-violet-400 px-1.5 py-0.5 rounded-full border border-violet-500/20 font-medium">
                      IPFS
                    </span>
                  )}
                  <button
                    onClick={() =>
                      (window as any).api.openExternal(resolveIPFS(token.tokenURI!, gw))
                    }
                    className="transition-all text-white/20 hover:text-white/50">
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <p className="text-[10px] font-mono text-white/35 break-all leading-relaxed">
                {token.tokenURI}
              </p>
            </div>
          )}

          {token.metadata?.description && (
            <p className="text-xs leading-relaxed text-white/45">{token.metadata.description}</p>
          )}

          {token.metadata?.attributes && token.metadata.attributes.length > 0 && (
            <div>
              <p className="text-[10px] text-white/25 uppercase tracking-widest mb-2">Properties</p>
              <div className="grid grid-cols-3 gap-1.5">
                {token.metadata.attributes.map((a, i) => (
                  <div
                    key={i}
                    className="p-2 text-center border rounded-xl border-violet-500/15 bg-violet-500/5">
                    <p className="text-[9px] text-violet-400/80 uppercase tracking-wider truncate">
                      {a.trait_type}
                    </p>
                    <p className="text-xs font-semibold text-white/75 mt-0.5 truncate">{a.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function NFTViewerPanel({ rpcUrl, deployedContracts }: Props) {
  const [tokens, setTokens] = useState<NFTToken[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('nft_tokens2') || '[]');
    } catch {
      return [];
    }
  });
  const [selected, setSelected] = useState<NFTToken | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [search, setSearch] = useState('');

  // ── Gateway state ──────────────────────────────────────────────────────────
  const [gateway, setGatewayState] = useState(
    () => localStorage.getItem('nft_gw2') || 'https://ipfs.io/ipfs/',
  );
  const [gwStatus, setGwStatus] = useState<'ok' | 'error' | 'checking' | null>(null);

  // ── Custom gateway state ───────────────────────────────────────────────────
  const [customGwName, setCustomGwName] = useState('');
  const [customGwUrl, setCustomGwUrl] = useState('');
  const [savedCustomGws, setSavedCustomGws] = useState<{ label: string; url: string }[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(CUSTOM_GW_KEY) || '[]');
    } catch {
      return [];
    }
  });

  // ── Auto-detect banners ────────────────────────────────────────────────────
  const [banners, setBanners] = useState<AutoDetectResult[]>([]);

  // ── Persist custom gateways ────────────────────────────────────────────────
  const persistCustomGws = (list: { label: string; url: string }[]) => {
    setSavedCustomGws(list);
    try {
      localStorage.setItem(CUSTOM_GW_KEY, JSON.stringify(list));
    } catch {}
  };

  const setGw = (url: string) => {
    const g = url.endsWith('/') ? url : url + '/';
    setGatewayState(g);
    localStorage.setItem('nft_gw2', g);
  };

  const addCustomGw = () => {
    if (!customGwUrl.trim()) return;
    const url = customGwUrl.trim().endsWith('/') ? customGwUrl.trim() : customGwUrl.trim() + '/';
    let label = customGwName.trim();
    if (!label) {
      try {
        label = new URL(url).hostname;
      } catch {
        label = url.slice(0, 20) + '…';
      }
    }
    const next = [...savedCustomGws.filter((g) => g.url !== url), { label, url }];
    persistCustomGws(next);
    setGw(url);
    setCustomGwName('');
    setCustomGwUrl('');
  };

  const removeCustomGw = (url: string) => {
    persistCustomGws(savedCustomGws.filter((g) => g.url !== url));
    if (gateway === url) setGw(GATEWAYS[0].url);
  };

  const testGw = (g: string) => {
    setGwStatus('checking');
    const img = new Image();
    const timer = setTimeout(() => {
      img.src = '';
      setGwStatus('error');
    }, 6000);
    img.onload = () => {
      clearTimeout(timer);
      setGwStatus('ok');
    };
    img.onerror = () => {
      clearTimeout(timer);
      fetch(g + 'QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn', {
        method: 'HEAD',
        mode: 'no-cors',
        signal: AbortSignal.timeout(5000),
      })
        .then(() => setGwStatus('ok'))
        .catch(() => setGwStatus('error'));
    };
    img.src = g + 'QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn/readme';
  };

  useEffect(() => {
    testGw(gateway);
  }, [gateway]);

  const persist = (list: NFTToken[]) => {
    setTokens(list);
    try {
      localStorage.setItem('nft_tokens2', JSON.stringify(list));
    } catch {}
  };

  // Auto-detect deployed NFTs on mount
  useEffect(() => {
    const nfts = deployedContracts.filter(
      (c) => c.abi.some((i) => i.name === 'ownerOf') || c.abi.some((i) => i.name === 'tokenURI'),
    );
    nfts.forEach(async (c) => {
      const result = await autoDetect(rpcUrl, c.address);
      if (result && result.tokenIds.length > 0) {
        setBanners((prev) =>
          prev.find((b) => b.address === c.address) ? prev : [...prev, result],
        );
      }
    });
  }, [deployedContracts, rpcUrl]);

  const importDetected = async (result: AutoDetectResult) => {
    setBanners((prev) => prev.filter((b) => b.address !== result.address));
    for (const tid of result.tokenIds) {
      const id = `${result.address.toLowerCase()}_${tid}`;
      if (tokens.find((t) => t.id === id)) continue;
      const stub: NFTToken = {
        id,
        contractAddress: result.address,
        contractName: result.name || '',
        tokenId: tid,
        standard: result.standard,
        loading: true,
      };
      setTokens((prev) => {
        const l = [stub, ...prev];
        persist(l);
        return l;
      });
    }
    for (const tid of result.tokenIds) {
      const id = `${result.address.toLowerCase()}_${tid}`;
      const info = await fetchNFT(rpcUrl, result.address, tid, gateway);
      setTokens((prev) => {
        const l = prev.map((t) => (t.id === id ? { ...t, ...info, loading: false } : t));
        persist(l);
        return l;
      });
    }
  };

  const refreshToken = async (token: NFTToken) => {
    setTokens((prev) => {
      const l = prev.map((t) => (t.id === token.id ? { ...t, loading: true } : t));
      persist(l);
      return l;
    });
    const info = await fetchNFT(rpcUrl, token.contractAddress, token.tokenId, gateway);
    setTokens((prev) => {
      const l = prev.map((t) => (t.id === token.id ? { ...t, ...info, loading: false } : t));
      persist(l);
      return l;
    });
    setSelected((prev) => (prev?.id === token.id ? { ...prev, ...info, loading: false } : prev));
  };

  const removeToken = (id: string) => {
    persist(tokens.filter((t) => t.id !== id));
    if (selected?.id === id) setSelected(null);
  };

  const filtered = tokens.filter(
    (t) =>
      !search ||
      (t.metadata?.name || '').toLowerCase().includes(search.toLowerCase()) ||
      t.tokenId.includes(search) ||
      t.contractName.toLowerCase().includes(search.toLowerCase()),
  );

  const groups = filtered.reduce(
    (acc, t) => {
      const key = t.contractAddress.toLowerCase();
      if (!acc[key])
        acc[key] = { name: t.contractName || t.contractAddress.slice(0, 10) + '…', items: [] };
      acc[key].items.push(t);
      return acc;
    },
    {} as Record<string, { name: string; items: NFTToken[] }>,
  );

  // All gateways (preset + custom saved)
  const allGateways = [
    ...GATEWAYS,
    ...savedCustomGws.filter((cg) => !GATEWAYS.find((pg) => pg.url === cg.url)),
  ];

  return (
    <div className="flex flex-col h-full bg-[#0f0f1a] overflow-hidden">
      {/* ── Top bar ── */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-white/5 flex-shrink-0 bg-[#13131f]">
        <Grid3X3 className="flex-shrink-0 w-4 h-4 text-violet-400" />
        <span className="text-sm font-semibold text-white/90">NFTs</span>
        <span className="text-[10px] bg-white/5 text-white/30 px-1.5 py-0.5 rounded-full">
          {tokens.length}
        </span>
        <div className="relative flex-1 max-w-52">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/20" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="w-full pr-3 text-xs border outline-none pl-7 h-7 bg-white/5 border-white/5 rounded-xl text-white/70 placeholder:text-white/20 focus:border-violet-500/40"
          />
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => {
              setShowSettings((v) => !v);
              setShowAdd(false);
            }}
            className={cn(
              'p-1.5 rounded-lg transition-all',
              showSettings
                ? 'bg-violet-500/20 text-violet-300'
                : 'bg-white/5 hover:bg-white/10 text-white/30 hover:text-white/70',
            )}>
            <Settings className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              setShowAdd((v) => !v);
              setShowSettings(false);
            }}
            className="flex items-center gap-1.5 h-7 px-3 text-xs bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition-all">
            <Plus className="w-3 h-3" /> Add NFT
          </button>
        </div>
      </div>

      {/* ── Settings ── */}
      {showSettings && (
        <div className="px-4 py-3 border-b border-white/5 bg-[#13131f] flex-shrink-0 space-y-3">
          <p className="text-[9px] text-white/25 uppercase tracking-widest">IPFS Gateway</p>

          {/* Preset + saved custom gateways */}
          <div className="flex flex-wrap gap-1.5 items-center">
            {allGateways.map((g) => {
              const isCustom = !GATEWAYS.find((pg) => pg.url === g.url);
              return (
                <div key={g.url} className="relative group/gw">
                  <button
                    onClick={() => setGw(g.url)}
                    className={cn(
                      'text-[10px] px-2.5 py-1 rounded-xl border transition-all',
                      isCustom ? 'pr-5' : '',
                      gateway === g.url
                        ? 'border-violet-500/50 bg-violet-500/15 text-violet-300'
                        : 'border-white/5 bg-white/[0.03] text-white/35 hover:border-white/15 hover:text-white/55',
                    )}>
                    {g.label}
                  </button>
                  {/* Tombol hapus hanya untuk custom gateway */}
                  {isCustom && (
                    <button
                      onClick={() => removeCustomGw(g.url)}
                      title="Hapus gateway ini"
                      className="absolute transition-all -translate-y-1/2 opacity-0 right-1 top-1/2 group-hover/gw:opacity-100 text-white/30 hover:text-rose-400">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              );
            })}

            {/* Status badge */}
            <span
              className={cn(
                'text-[9px] px-2 py-1 rounded-xl border',
                gwStatus === 'ok'
                  ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                  : gwStatus === 'error'
                    ? 'border-rose-500/30 text-rose-400 bg-rose-500/10'
                    : gwStatus === 'checking'
                      ? 'border-amber-500/30 text-amber-400 bg-amber-500/10'
                      : 'border-white/5 text-white/20',
              )}>
              {gwStatus === 'ok'
                ? '● online'
                : gwStatus === 'error'
                  ? '● offline'
                  : gwStatus === 'checking'
                    ? '● …'
                    : '● ?'}
            </span>
          </div>

          {/* Tambah custom gateway baru */}
          <div className="space-y-1.5">
            <p className="text-[9px] text-white/20 uppercase tracking-widest">
              Tambah Custom Gateway
            </p>
            <div className="flex gap-1.5">
              <input
                value={customGwName}
                onChange={(e) => setCustomGwName(e.target.value)}
                placeholder="Nama (mis. Pinata Ku)"
                className="w-32 h-7 px-2.5 text-[10px] bg-white/[0.03] border border-white/5 rounded-xl text-white/60 placeholder:text-white/15 outline-none focus:border-violet-500/30"
              />
              <input
                value={customGwUrl}
                onChange={(e) => setCustomGwUrl(e.target.value)}
                placeholder="https://gateway.pinata.cloud/ipfs/"
                className="flex-1 h-7 px-2.5 text-[10px] font-mono bg-white/[0.03] border border-white/5 rounded-xl text-white/60 placeholder:text-white/15 outline-none focus:border-violet-500/30"
                onKeyDown={(e) => e.key === 'Enter' && addCustomGw()}
              />
              <button
                disabled={!customGwUrl.trim()}
                onClick={addCustomGw}
                className="px-3 h-7 text-[10px] bg-violet-600/70 hover:bg-violet-600 text-white rounded-xl disabled:opacity-30 transition-all">
                Simpan
              </button>
            </div>
            <p className="text-[9px] text-white/15 leading-relaxed">
              Gateway kustom tersimpan ke localStorage & ikut ter-export saat kamu klik{' '}
              <span className="text-white/30">Save Workspace</span>.
            </p>
          </div>
        </div>
      )}

      {/* ── Add / Scan form ── */}
      {showAdd && (
        <AddForm rpcUrl={rpcUrl} onClose={() => setShowAdd(false)} onImport={importDetected} />
      )}

      {/* ── Auto-detect banners ── */}
      {banners.map((r) => (
        <div
          key={r.address}
          className="flex items-center gap-3 px-4 py-2.5 border-b border-violet-500/20 bg-violet-500/[0.07] flex-shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-xs text-white/75">
              <span className="font-semibold text-white">{r.name}</span>
              {r.symbol && <span className="ml-1 text-violet-400">{r.symbol}</span>}
            </span>
            <span className="text-[10px] text-white/30 ml-2">
              {r.tokenIds.length} token{r.tokenIds.length !== 1 ? 's' : ''} detected · {r.standard}
            </span>
          </div>
          <button
            onClick={() => importDetected(r)}
            className="px-2.5 h-6 text-[10px] bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-all flex-shrink-0">
            Import
          </button>
          <button
            onClick={() => setBanners((prev) => prev.filter((b) => b.address !== r.address))}
            className="transition-all text-white/20 hover:text-white/50">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

      {/* ── Grid ── */}
      <div className="flex-1 px-4 py-4 overflow-y-auto">
        {tokens.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center select-none">
            <div className="flex items-center justify-center w-20 h-20 border rounded-3xl bg-violet-500/10 border-violet-500/20">
              <Grid3X3 className="w-9 h-9 text-violet-400/40" />
            </div>
            <div>
              <p className="text-sm font-medium text-white/40">No NFTs yet</p>
              <p className="mt-1 text-xs leading-relaxed text-white/20">
                Add a contract + token ID, or auto-detect
                <br />
                from your deployed contracts
              </p>
            </div>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2 text-xs text-white transition-all bg-violet-600 hover:bg-violet-500 rounded-xl">
              <Plus className="w-3.5 h-3.5" /> Add your first NFT
            </button>
          </div>
        ) : Object.keys(groups).length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-white/25">
            No results for "{search}"
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groups).map(([addr, group]) => (
              <div key={addr}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-shrink-0 w-4 h-4 rounded-full bg-gradient-to-br from-violet-500 to-purple-700" />
                  <span className="text-xs font-semibold text-white/60">{group.name}</span>
                  <span className="text-[9px] text-white/20 bg-white/5 px-1.5 py-0.5 rounded-full">
                    {group.items.length}
                  </span>
                  <div className="flex-1 h-px bg-white/5" />
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {group.items.map((token) => (
                    <NFTCard
                      key={token.id}
                      token={token}
                      gw={gateway}
                      onClick={() => setSelected(token)}
                      onRemove={(e) => {
                        e.stopPropagation();
                        removeToken(token.id);
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Detail modal ── */}
      {selected && (
        <NFTDetail
          token={selected}
          gw={gateway}
          onClose={() => setSelected(null)}
          onRefresh={() => refreshToken(selected)}
          onRemove={() => {
            removeToken(selected.id);
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}
