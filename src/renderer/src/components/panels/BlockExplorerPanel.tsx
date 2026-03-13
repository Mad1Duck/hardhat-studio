import { useState, useEffect } from 'react';
import { DeployedContract } from '../../types';
import { Button } from '../ui/button';
import { Input } from '../ui/primitives';
import { cn } from '../../lib/utils';
import {
  Search,
  Blocks,
  ArrowRight,
  RefreshCw,
  Copy,
  Clock,
  Zap,
  AlertCircle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface Props {
  rpcUrl: string;
  deployedContracts: DeployedContract[];
}

async function rpc(url: string, method: string, params: unknown[] = []) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return d.result;
}

function hex(n: string | undefined) {
  return n ? parseInt(n, 16) : 0;
}
function shortAddr(addr: string) {
  return addr ? addr.slice(0, 6) + '...' + addr.slice(-4) : '';
}
function formatGas(gas: string) {
  return hex(gas).toLocaleString();
}
function timeAgo(ts: number) {
  const s = Math.floor(Date.now() / 1000 - ts);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

interface BlockInfo {
  number: string;
  hash: string;
  timestamp: string;
  miner: string;
  transactions: string[];
  gasUsed: string;
  gasLimit: string;
  baseFeePerGas?: string;
  size: string;
  parentHash: string;
}

interface TxInfo {
  hash: string;
  from: string;
  to: string | null;
  value: string;
  gas: string;
  gasPrice: string;
  nonce: string;
  blockNumber: string;
  input: string;
  transactionIndex: string;
}

interface TxReceipt {
  status: string;
  gasUsed: string;
  contractAddress?: string;
  logs: { address: string; topics: string[]; data: string }[];
  effectiveGasPrice?: string;
}

export default function BlockExplorerPanel({ rpcUrl, deployedContracts }: Props) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [latestBlock, setLatestBlock] = useState<BlockInfo | null>(null);
  const [recentBlocks, setRecentBlocks] = useState<BlockInfo[]>([]);
  const [selectedBlock, setSelectedBlock] = useState<BlockInfo | null>(null);
  const [selectedTx, setSelectedTx] = useState<{ tx: TxInfo; receipt: TxReceipt | null } | null>(
    null,
  );
  const [view, setView] = useState<'blocks' | 'tx' | 'block-detail'>('blocks');
  const [blockTxs, setBlockTxs] = useState<TxInfo[]>([]);
  const [expandedLogs, setExpandedLogs] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [error, setError] = useState('');

  const loadLatest = async () => {
    setError('');
    try {
      const block = (await rpc(rpcUrl, 'eth_getBlockByNumber', ['latest', false])) as BlockInfo;
      setLatestBlock(block);
      // Load last 10 blocks
      const latest = hex(block.number);
      const blocks = await Promise.all(
        Array.from({ length: Math.min(10, latest + 1) }, (_, i) =>
          rpc(rpcUrl, 'eth_getBlockByNumber', ['0x' + (latest - i).toString(16), false]),
        ),
      );
      setRecentBlocks(blocks.filter(Boolean) as BlockInfo[]);
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => {
    loadLatest();
  }, [rpcUrl]);
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(loadLatest, 3000);
    return () => clearInterval(id);
  }, [autoRefresh, rpcUrl]);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    try {
      const q = query.trim();
      if (q.length === 66) {
        // TX hash
        const tx = (await rpc(rpcUrl, 'eth_getTransactionByHash', [q])) as TxInfo;
        if (!tx) throw new Error('Transaction not found');
        const receipt = (await rpc(rpcUrl, 'eth_getTransactionReceipt', [q])) as TxReceipt;
        setSelectedTx({ tx, receipt });
        setView('tx');
      } else if (q.startsWith('0x') && q.length === 66) {
        // block hash
        const block = (await rpc(rpcUrl, 'eth_getBlockByHash', [q, false])) as BlockInfo;
        setSelectedBlock(block);
        setView('block-detail');
      } else {
        // block number
        const num = parseInt(q);
        if (!isNaN(num)) {
          const block = (await rpc(rpcUrl, 'eth_getBlockByNumber', [
            '0x' + num.toString(16),
            false,
          ])) as BlockInfo;
          if (!block) throw new Error('Block not found');
          setSelectedBlock(block);
          setView('block-detail');
        }
      }
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  const openBlock = async (block: BlockInfo) => {
    setLoading(true);
    setSelectedBlock(block);
    if (block.transactions.length > 0) {
      const txs = await Promise.all(
        block.transactions
          .slice(0, 20)
          .map((h) => rpc(rpcUrl, 'eth_getTransactionByHash', [h]).catch(() => null)),
      );
      setBlockTxs(txs.filter(Boolean) as TxInfo[]);
    } else setBlockTxs([]);
    setView('block-detail');
    setLoading(false);
  };

  const openTx = async (hash: string) => {
    setLoading(true);
    try {
      const tx = (await rpc(rpcUrl, 'eth_getTransactionByHash', [hash])) as TxInfo;
      const receipt = (await rpc(rpcUrl, 'eth_getTransactionReceipt', [hash]).catch(
        () => null,
      )) as TxReceipt | null;
      setSelectedTx({ tx, receipt });
      setView('tx');
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  const copyText = (text: string) => navigator.clipboard.writeText(text);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card flex-shrink-0">
        <div className="flex items-center gap-2">
          <Blocks className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-semibold">Block Explorer</span>
          {latestBlock && (
            <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
              Block #{hex(latestBlock.number).toLocaleString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute w-3 h-3 -translate-y-1/2 left-2 top-1/2 text-muted-foreground/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && search()}
              placeholder="Block #, tx hash 0x..."
              className="w-64 pr-3 text-xs border rounded outline-none pl-7 h-7 bg-muted/20 border-border text-foreground/80 focus:border-blue-500/40"
            />
          </div>
          <Button size="sm" className="text-xs h-7" onClick={search} disabled={loading}>
            {loading ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <Search className="w-3 h-3" />
            )}
          </Button>
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            size="sm"
            className="text-xs h-7"
            onClick={() => setAutoRefresh((p) => !p)}>
            <RefreshCw className={cn('w-3 h-3 mr-1', autoRefresh && 'animate-spin')} />
            {autoRefresh ? 'Live' : 'Auto'}
          </Button>
          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={loadLatest}>
            <RefreshCw className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-2 text-xs text-red-400 border-b bg-red-500/10 border-red-500/20">
          <AlertCircle className="w-3 h-3" /> {error}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel - recent blocks */}
        <div className="flex flex-col flex-shrink-0 border-r w-72 border-border bg-card/50">
          <div className="px-3 py-2 border-b border-border">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
              Recent Blocks
            </p>
          </div>
          <div className="flex-1 overflow-auto">
            {recentBlocks.map((block) => (
              <div
                key={block.hash}
                onClick={() => openBlock(block)}
                className={cn(
                  'px-3 py-2.5 border-b border-border cursor-pointer hover:bg-muted/20 transition-colors',
                  selectedBlock?.hash === block.hash &&
                    'bg-blue-600/10 border-l-2 border-l-blue-500',
                )}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-blue-400">
                    #{hex(block.number).toLocaleString()}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {timeAgo(hex(block.timestamp))}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span>{block.transactions.length} txs</span>
                  <span>Gas {Math.round((hex(block.gasUsed) / hex(block.gasLimit)) * 100)}%</span>
                  {block.baseFeePerGas && (
                    <span>{Math.round(hex(block.baseFeePerGas) / 1e9)} gwei</span>
                  )}
                </div>
                <p className="text-[10px] font-mono text-muted-foreground/40 truncate mt-0.5">
                  {block.hash.slice(0, 20)}...
                </p>
              </div>
            ))}
            {recentBlocks.length === 0 && !error && (
              <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
                Connecting to node...
              </div>
            )}
          </div>
        </div>

        {/* Right: detail panel */}
        <div className="flex-1 p-4 overflow-auto">
          {view === 'blocks' && latestBlock && (
            <div>
              <h3 className="mb-4 text-sm font-semibold">Latest Block Summary</h3>
              <div className="grid grid-cols-3 gap-3 mb-6">
                {[
                  { label: 'Block Number', value: hex(latestBlock.number).toLocaleString() },
                  { label: 'Transactions', value: latestBlock.transactions.length.toString() },
                  {
                    label: 'Gas Used',
                    value: `${Math.round((hex(latestBlock.gasUsed) / hex(latestBlock.gasLimit)) * 100)}%`,
                  },
                  { label: 'Gas Limit', value: hex(latestBlock.gasLimit).toLocaleString() },
                  {
                    label: 'Base Fee',
                    value: latestBlock.baseFeePerGas
                      ? `${Math.round(hex(latestBlock.baseFeePerGas) / 1e9)} gwei`
                      : 'N/A',
                  },
                  {
                    label: 'Time',
                    value: new Date(hex(latestBlock.timestamp) * 1000).toLocaleTimeString(),
                  },
                ].map((item) => (
                  <div key={item.label} className="p-3 border rounded-lg bg-card border-border">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                      {item.label}
                    </p>
                    <p className="text-sm font-semibold text-foreground">{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="p-3 border rounded-lg bg-card border-border">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
                  Block Hash
                </p>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-xs break-all text-foreground/80">
                    {latestBlock.hash}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="flex-shrink-0 w-5 h-5"
                    onClick={() => copyText(latestBlock.hash)}>
                    <Copy className="w-2.5 h-2.5" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {view === 'block-detail' && selectedBlock && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <button
                  onClick={() => setView('blocks')}
                  className="text-xs text-blue-400 hover:underline">
                  Blocks
                </button>
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs font-semibold">
                  Block #{hex(selectedBlock.number).toLocaleString()}
                </span>
              </div>

              {/* Block info grid */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                {[
                  { label: 'Block Number', value: hex(selectedBlock.number).toLocaleString() },
                  { label: 'Transactions', value: selectedBlock.transactions.length.toString() },
                  {
                    label: 'Timestamp',
                    value: new Date(hex(selectedBlock.timestamp) * 1000).toLocaleString(),
                  },
                  {
                    label: 'Gas Used / Limit',
                    value: `${formatGas(selectedBlock.gasUsed)} / ${formatGas(selectedBlock.gasLimit)}`,
                  },
                  {
                    label: 'Base Fee',
                    value: selectedBlock.baseFeePerGas
                      ? `${Math.round(hex(selectedBlock.baseFeePerGas) / 1e9)} gwei`
                      : 'N/A',
                  },
                  {
                    label: 'Miner',
                    value: shortAddr(selectedBlock.miner),
                    full: selectedBlock.miner,
                  },
                ].map((item) => (
                  <div key={item.label} className="p-3 border rounded-lg bg-card border-border">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                      {item.label}
                    </p>
                    <div className="flex items-center gap-1">
                      <p className="font-mono text-xs text-foreground/80">{item.value}</p>
                      {item.full && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-4 h-4"
                          onClick={() => copyText(item.full!)}>
                          <Copy className="w-2.5 h-2.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Hash */}
              <div className="p-3 mb-6 border rounded-lg bg-card border-border">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  Hash
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-[11px] font-mono text-foreground/70 break-all">
                    {selectedBlock.hash}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="flex-shrink-0 w-5 h-5"
                    onClick={() => copyText(selectedBlock.hash)}>
                    <Copy className="w-2.5 h-2.5" />
                  </Button>
                </div>
              </div>

              {/* Transactions */}
              {selectedBlock.transactions.length > 0 && (
                <div>
                  <h4 className="mb-2 text-xs font-semibold text-foreground">
                    Transactions ({selectedBlock.transactions.length})
                  </h4>
                  <div className="space-y-1">
                    {(blockTxs.length > 0
                      ? blockTxs
                      : selectedBlock.transactions.slice(0, 20).map((h) => ({ hash: h }) as TxInfo)
                    ).map((tx, i) => (
                      <div
                        key={tx.hash || i}
                        onClick={() => tx.from && openTx(tx.hash)}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted/20 cursor-pointer text-xs',
                          !tx.from && 'opacity-50 cursor-default',
                        )}>
                        <span className="w-6 text-center text-muted-foreground/50">
                          {tx.transactionIndex !== undefined ? hex(tx.transactionIndex) : i}
                        </span>
                        <span className="flex-1 font-mono truncate text-blue-400/80">
                          {tx.hash}
                        </span>
                        {tx.from && (
                          <>
                            <span className="font-mono text-muted-foreground">
                              {shortAddr(tx.from)}
                            </span>
                            <ArrowRight className="w-3 h-3 text-muted-foreground/30" />
                            <span className="font-mono text-muted-foreground">
                              {tx.to ? shortAddr(tx.to) : '📄 deploy'}
                            </span>
                            <span className="text-muted-foreground">
                              {(hex(tx.value) / 1e18).toFixed(4)} ETH
                            </span>
                          </>
                        )}
                      </div>
                    ))}
                    {selectedBlock.transactions.length > 20 && (
                      <p className="text-[10px] text-muted-foreground text-center py-2">
                        +{selectedBlock.transactions.length - 20} more transactions
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {view === 'tx' && selectedTx && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <button
                  onClick={() => setView('blocks')}
                  className="text-xs text-blue-400 hover:underline">
                  Blocks
                </button>
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs font-semibold">Transaction</span>
              </div>

              {/* Status badge */}
              <div
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold mb-4',
                  selectedTx.receipt?.status === '0x1'
                    ? 'bg-green-500/10 text-green-400'
                    : 'bg-red-500/10 text-red-400',
                )}>
                <div
                  className={cn(
                    'w-2 h-2 rounded-full',
                    selectedTx.receipt?.status === '0x1' ? 'bg-green-400' : 'bg-red-400',
                  )}
                />
                {selectedTx.receipt?.status === '0x1'
                  ? 'Success'
                  : selectedTx.receipt
                    ? 'Failed'
                    : 'Pending'}
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: 'From', value: selectedTx.tx.from, mono: true },
                  { label: 'To', value: selectedTx.tx.to || '(contract creation)', mono: true },
                  {
                    label: 'Value',
                    value: `${(hex(selectedTx.tx.value) / 1e18).toFixed(6)} ETH`,
                    mono: false,
                  },
                  {
                    label: 'Block',
                    value: selectedTx.tx.blockNumber
                      ? `#${hex(selectedTx.tx.blockNumber).toLocaleString()}`
                      : 'Pending',
                    mono: false,
                  },
                  {
                    label: 'Gas Used',
                    value: selectedTx.receipt ? formatGas(selectedTx.receipt.gasUsed) : '-',
                    mono: false,
                  },
                  { label: 'Nonce', value: hex(selectedTx.tx.nonce).toString(), mono: false },
                ].map((item) => (
                  <div key={item.label} className="p-3 border rounded-lg bg-card border-border">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                      {item.label}
                    </p>
                    <div className="flex items-center gap-1">
                      <p
                        className={cn(
                          'text-xs break-all',
                          item.mono
                            ? 'font-mono text-foreground/70'
                            : 'font-semibold text-foreground',
                        )}>
                        {item.value}
                      </p>
                      {item.mono && item.value.startsWith('0x') && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="flex-shrink-0 w-4 h-4"
                          onClick={() => copyText(item.value)}>
                          <Copy className="w-2.5 h-2.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Tx hash */}
              <div className="p-3 mb-4 border rounded-lg bg-card border-border">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  Transaction Hash
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-[11px] font-mono text-foreground/70 break-all">
                    {selectedTx.tx.hash}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="flex-shrink-0 w-5 h-5"
                    onClick={() => copyText(selectedTx.tx.hash)}>
                    <Copy className="w-2.5 h-2.5" />
                  </Button>
                </div>
              </div>

              {/* Input data */}
              {selectedTx.tx.input && selectedTx.tx.input !== '0x' && (
                <div className="p-3 mb-4 border rounded-lg bg-card border-border">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
                    Input Data
                  </p>
                  <p className="text-[10px] font-mono text-foreground/50 break-all">
                    <span className="text-blue-400">{selectedTx.tx.input.slice(0, 10)}</span>
                    {selectedTx.tx.input.slice(10)}
                  </p>
                  <p className="text-[9px] text-muted-foreground/40 mt-1">
                    Function selector: {selectedTx.tx.input.slice(0, 10)}
                  </p>
                </div>
              )}

              {/* Logs */}
              {selectedTx.receipt?.logs && selectedTx.receipt.logs.length > 0 && (
                <div className="p-3 border rounded-lg bg-card border-border">
                  <button
                    className="flex items-center w-full gap-2 text-left"
                    onClick={() => setExpandedLogs((p) => !p)}>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      Logs ({selectedTx.receipt!.logs.length})
                    </p>
                    {expandedLogs ? (
                      <ChevronDown className="w-3 h-3 ml-auto text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-3 h-3 ml-auto text-muted-foreground" />
                    )}
                  </button>
                  {expandedLogs && (
                    <div className="mt-2 space-y-2">
                      {selectedTx.receipt!.logs.map((log, i) => (
                        <div key={`row-${i}`} className="p-2 rounded bg-muted/20">
                          <p className="text-[10px] font-mono text-muted-foreground">
                            Address: {log.address}
                          </p>
                          {log.topics.map((t, j) => (
                            <p
                              key={j}
                              className="text-[9px] font-mono text-muted-foreground/60 truncate">
                              topic[{j}]: {t}
                            </p>
                          ))}
                          {log.data !== '0x' && (
                            <p className="text-[9px] font-mono text-muted-foreground/40 truncate">
                              data: {log.data}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
