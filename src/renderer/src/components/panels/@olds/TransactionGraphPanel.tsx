/**
 * TransactionGraphPanel — React Flow edition
 * bun add @xyflow/react  (or: npm install @xyflow/react)
 */
import { useState, useEffect, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  getBezierPath,
  BaseEdge,
  EdgeLabelRenderer,
  Panel,
  type NodeProps,
  type EdgeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { TxRecord, DeployedContract } from '../../types';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { FlowControls } from '../ui/FlowControls';
import {
  GitFork,
  RefreshCw,
  Info,
  Layers,
  ArrowRight,
  Search,
  AlertCircle,
  Copy,
  Play,
  Pause,
  Filter,
  X,
  Blocks,
} from 'lucide-react';

interface Props {
  txHistory: TxRecord[];
  rpcUrl: string;
  deployedContracts: DeployedContract[];
}

//  RPC 
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
function hex(n: string | null | undefined) {
  return n ? parseInt(n, 16) : 0;
}
function shortAddr(a: string) {
  return a ? a.slice(0, 6) + '…' + a.slice(-4) : '?';
}
function timeAgo(ts: number) {
  const s = Math.floor(Date.now() / 1000 - ts);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

//  Types 
interface RpcBlock {
  number: string;
  hash: string;
  timestamp: string;
  miner: string;
  transactions: RpcTx[];
  gasUsed: string;
  gasLimit: string;
  baseFeePerGas?: string;
  parentHash: string;
}
interface RpcTx {
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
interface RpcReceipt {
  status: string;
  gasUsed: string;
  contractAddress?: string;
  logs: { address: string; topics: string[]; data: string }[];
}

type NodeData = {
  address: string;
  label: string;
  nodeType: 'wallet' | 'contract' | 'miner' | 'external';
  txCount: number;
  contractName?: string;
};
type EdgeData = {
  txHash: string;
  value: string;
  input: string;
  status: 'success' | 'failed' | 'unknown';
  blockNumber: number;
  gasPrice: string;
  nonce: number;
  functionSig?: string;
  localName?: string;
};

const TYPE_STYLE: Record<string, { bg: string; border: string; glow: string; icon: string }> = {
  wallet: { bg: '#1c1404', border: '#f59e0b', glow: '#f59e0b40', icon: '◉' },
  contract: { bg: '#030e1f', border: '#3b82f6', glow: '#3b82f640', icon: '⬡' },
  miner: { bg: '#031a0f', border: '#10b981', glow: '#10b98140', icon: '⛏' },
  external: { bg: '#130b1f', border: '#8b5cf6', glow: '#8b5cf640', icon: '◈' },
};

//  Custom Node 
function AddressNode({ data, selected }: NodeProps) {
  const nd = data as NodeData;
  const s = TYPE_STYLE[nd.nodeType] || TYPE_STYLE.wallet;
  const size = Math.min(44 + nd.txCount * 4, 72);
  return (
    <div
      style={{
        background: `#161b22f0`,
        border: `2px solid ${selected ? s.border : s.border}`,
        boxShadow: selected ? `0 0 0 3px ${s.border}55, 0 0 24px ${s.glow}` : `0 0 10px ${s.glow}`,
        borderRadius: '50%',
        width: size,
        height: size,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        position: 'relative',
        transition: 'box-shadow 0.15s, border-color 0.15s',
        userSelect: 'none',
      }}>
      <Handle
        type="target"
        position={Position.Top}
        style={{ opacity: 0, width: 0, height: 0, minWidth: 0, minHeight: 0 }}
      />
      <span style={{ fontSize: Math.min(14 + nd.txCount, 22), lineHeight: 1, color: s.border }}>
        {s.icon}
      </span>
      {nd.txCount > 1 && (
        <span
          style={{
            position: 'absolute',
            top: -7,
            right: -7,
            background: s.border,
            color: '#000',
            fontSize: 9,
            fontWeight: 700,
            borderRadius: '50%',
            width: 17,
            height: 17,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          {Math.min(nd.txCount, 99)}
        </span>
      )}
      <div
        style={{
          position: 'absolute',
          top: '100%',
          marginTop: 7,
          whiteSpace: 'nowrap',
          fontSize: 9,
          color: '#94a3b8',
          fontFamily: 'monospace',
          pointerEvents: 'none',
          textAlign: 'center',
        }}>
        {nd.contractName || nd.label}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ opacity: 0, width: 0, height: 0, minWidth: 0, minHeight: 0 }}
      />
    </div>
  );
}

//  Custom Edge 
function TxEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  data,
}: EdgeProps) {
  const ed = data as EdgeData;
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  const color =
    ed.status === 'success' ? '#22c55e' : ed.status === 'failed' ? '#f43f5e' : '#475569';
  const ethVal = hex(ed.value) / 1e18;
  const label = ed.functionSig
    ? ed.functionSig.slice(0, 10)
    : ethVal > 0
      ? `${ethVal.toFixed(3)}Ξ`
      : '';

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        interactionWidth={14}
        style={{
          stroke: selected ? '#f59e0b' : color,
          strokeWidth: selected ? 2.5 : 1.5,
          strokeDasharray: ed.status === 'failed' ? '5,3' : undefined,
          opacity: selected ? 1 : 0.65,
          cursor: 'pointer',
          transition: 'stroke 0.1s',
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: selected ? 'all' : 'none',
          }}
          className="nodrag nopan">
          {selected ? (
            <div
              style={{
                background: '#161b22',
                border: '1px solid #f59e0b55',
                borderRadius: 6,
                padding: '3px 8px',
                fontSize: 10,
                color: '#f59e0b',
                fontFamily: 'monospace',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
              }}>
              {ed.localName || label || ed.txHash.slice(0, 12) + '…'}
            </div>
          ) : label ? (
            <div
              style={{
                background: '#161b22cc',
                borderRadius: 4,
                padding: '1px 5px',
                fontSize: 9,
                color: color,
                fontFamily: 'monospace',
              }}>
              {label}
            </div>
          ) : null}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

const NODE_TYPES = { address: AddressNode };
const EDGE_TYPES = { tx: TxEdge };

//  Main 
export default function TransactionGraphPanel({ txHistory, rpcUrl, deployedContracts }: Props) {
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState([]);

  const [loadedBlocks, setLoadedBlocks] = useState<RpcBlock[]>([]);
  const [latestBlockNum, setLatestBlockNum] = useState<number | null>(null);
  const [blockRange, setBlockRange] = useState(5);
  const [blockInput, setBlockInput] = useState('5');

  const [loading, setLoading] = useState(false);
  const [loadingTx, setLoadingTx] = useState(false);
  const [error, setError] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [view, setView] = useState<'graph' | 'list' | 'blocks'>('graph');

  const [filterAddr, setFilterAddr] = useState('');
  const [showOnlyKnown, setShowOnlyKnown] = useState(false);
  const [searchInput, setSearchInput] = useState('');

  // Detail state
  const [detailAddr, setDetailAddr] = useState<string | null>(null);
  const [detailTxHash, setDetailTxHash] = useState<string | null>(null);
  const [txDetail, setTxDetail] = useState<{ tx: RpcTx; receipt: RpcReceipt | null } | null>(null);

  const contractAddrs = new Set(deployedContracts.map((c) => c.address.toLowerCase()));

  //  Build React Flow graph from blocks 
  const buildGraph = useCallback(
    (blocks: RpcBlock[]) => {
      type NM = { type: NodeData['nodeType']; txCount: number; contractName?: string };
      const nodeMap = new Map<string, NM>();

      const allTxs = blocks.flatMap((b) => (b.transactions || []).map((tx) => ({ tx, block: b })));
      const filtered = allTxs
        .filter(({ tx }) => {
          if (filterAddr) {
            const f = filterAddr.toLowerCase();
            return tx.from?.toLowerCase() === f || tx.to?.toLowerCase() === f;
          }
          if (showOnlyKnown) {
            return (
              contractAddrs.has(tx.from?.toLowerCase()) ||
              contractAddrs.has(tx.to?.toLowerCase() || '')
            );
          }
          return true;
        })
        .slice(0, 100);

      const ensure = (addr: string) => {
        const key = addr.toLowerCase();
        if (nodeMap.has(key)) {
          nodeMap.get(key)!.txCount++;
          return;
        }
        const isMiner = blocks.some((b) => b.miner?.toLowerCase() === key);
        const isContract = contractAddrs.has(key);
        const type: NodeData['nodeType'] = isMiner ? 'miner' : isContract ? 'contract' : 'wallet';
        nodeMap.set(key, {
          type,
          txCount: 1,
          contractName: deployedContracts.find((c) => c.address.toLowerCase() === key)?.name,
        });
      };

      filtered.forEach(({ tx }) => {
        if (tx.from) ensure(tx.from);
        ensure(tx.to || `deploy_${tx.hash.slice(0, 8)}`);
      });

      // Layout: group by type in concentric circles
      const groups: Record<string, string[]> = {
        miner: [],
        contract: [],
        wallet: [],
        external: [],
      };
      nodeMap.forEach((v, k) => groups[v.type].push(k));
      const positions = new Map<string, { x: number; y: number }>();
      const place = (keys: string[], r: number, cx = 500, cy = 320) => {
        keys.forEach((k, i) => {
          const a = (i / Math.max(keys.length, 1)) * Math.PI * 2 - Math.PI / 2;
          const ring = r + Math.floor(i / 10) * 120;
          positions.set(k, { x: cx + Math.cos(a) * ring, y: cy + Math.sin(a) * ring });
        });
      };
      place(groups.miner, 70);
      place(groups.contract, 200);
      place(groups.wallet, 350);
      place(groups.external, 480);

      const newNodes = [...nodeMap.entries()].map(([key, nd]) => ({
        id: key,
        type: 'address',
        position: positions.get(key) || { x: 400, y: 300 },
        data: {
          address: key,
          label: shortAddr(key),
          nodeType: nd.type,
          txCount: nd.txCount,
          contractName: nd.contractName,
        } as NodeData,
        style: { background: 'transparent', border: 'none', padding: 0 },
      }));

      const newEdges = filtered.map(({ tx }) => {
        const local = txHistory.find((t) => t.hash === tx.hash);
        return {
          id: tx.hash,
          source: tx.from?.toLowerCase() || '',
          target: (tx.to || `deploy_${tx.hash.slice(0, 8)}`).toLowerCase(),
          type: 'tx',
          data: {
            txHash: tx.hash,
            value: tx.value || '0',
            input: tx.input || '0x',
            status: (local?.status === 'success'
              ? 'success'
              : local?.status === 'failed'
                ? 'failed'
                : 'unknown') as EdgeData['status'],
            blockNumber: hex(tx.blockNumber),
            gasPrice: tx.gasPrice || '0',
            nonce: hex(tx.nonce),
            functionSig: tx.input?.length >= 10 ? tx.input.slice(0, 10) : undefined,
            localName: local ? `${local.contractName}.${local.functionName}()` : undefined,
          } as EdgeData,
        };
      });

      setRfNodes(newNodes as any);
      setRfEdges(newEdges as any);
    },
    [txHistory, deployedContracts, filterAddr, showOnlyKnown],
  );

  //  Load from RPC 
  const loadFromRpc = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const latest = (await rpc(rpcUrl, 'eth_getBlockByNumber', ['latest', true])) as RpcBlock;
      if (!latest) throw new Error('No response from node');
      const latestNum = hex(latest.number);
      setLatestBlockNum(latestNum);
      const count = Math.min(blockRange, latestNum + 1);
      const blocks = (
        await Promise.all(
          Array.from({ length: count }, (_, i) =>
            rpc(rpcUrl, 'eth_getBlockByNumber', ['0x' + (latestNum - i).toString(16), true]).catch(
              () => null,
            ),
          ),
        )
      ).filter(Boolean) as RpcBlock[];
      setLoadedBlocks(blocks);
      buildGraph(blocks);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }, [rpcUrl, blockRange, buildGraph]);

  useEffect(() => {
    loadFromRpc();
  }, [rpcUrl, blockRange]);
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(loadFromRpc, 4000);
    return () => clearInterval(id);
  }, [autoRefresh, loadFromRpc]);
  useEffect(() => {
    if (loadedBlocks.length > 0) buildGraph(loadedBlocks);
  }, [filterAddr, showOnlyKnown]);

  //  Fetch tx detail 
  const fetchTxDetail = useCallback(
    async (hash: string) => {
      setLoadingTx(true);
      setTxDetail(null);
      try {
        const [tx, receipt] = await Promise.all([
          rpc(rpcUrl, 'eth_getTransactionByHash', [hash]),
          rpc(rpcUrl, 'eth_getTransactionReceipt', [hash]).catch(() => null),
        ]);
        if (tx) setTxDetail({ tx, receipt });
      } catch {}
      setLoadingTx(false);
    },
    [rpcUrl],
  );

  const openTxDetail = (hash: string) => {
    setDetailTxHash(hash);
    setDetailAddr(null);
    fetchTxDetail(hash);
  };

  //  Search 
  const handleSearch = async () => {
    const q = searchInput.trim();
    if (!q) return;
    if (q.startsWith('0x') && q.length === 42) {
      setFilterAddr(q);
      return;
    }
    if (q.startsWith('0x') && q.length === 66) {
      openTxDetail(q);
      return;
    }
    const num = parseInt(q);
    if (!isNaN(num)) {
      const block = await rpc(rpcUrl, 'eth_getBlockByNumber', [
        '0x' + num.toString(16),
        true,
      ]).catch(() => null);
      if (block) {
        setLoadedBlocks([block]);
        buildGraph([block]);
      }
    }
  };

  const commitBlockInput = () => {
    const n = parseInt(blockInput);
    if (!isNaN(n) && n >= 1 && n <= 500) {
      setBlockRange(n);
    }
  };

  const allTxs = loadedBlocks.flatMap((b) => b.transactions || []);

  //  RENDER 
  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/*  Toolbar  */}
      <div className="flex flex-wrap items-center flex-shrink-0 gap-2 px-3 py-2 border-b border-border ">
        <GitFork className="flex-shrink-0 w-4 h-4 text-sky-400" />
        <span className="text-sm font-semibold">Transaction Graph</span>
        {latestBlockNum !== null && (
          <span className="text-[10px] bg-sky-500/10 text-sky-400 px-1.5 py-0.5 rounded">
            Block #{latestBlockNum.toLocaleString()}
          </span>
        )}
        <span className="text-[10px] text-muted-foreground">
          {rfNodes.length} nodes · {rfEdges.length} edges
        </span>

        <div className="ml-auto flex items-center gap-1.5 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search className="absolute w-3 h-3 -translate-y-1/2 left-2 top-1/2 text-muted-foreground/40" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="addr / tx / block #"
              className="w-40 pr-2 font-mono text-xs border rounded outline-none pl-7 h-7 bg-muted/20 border-border text-foreground/80 focus:border-sky-500/40"
            />
          </div>

          {/* Block range */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground">Blocks:</span>
            {[1, 5, 10, 20].map((n) => (
              <button
                key={n}
                onClick={() => {
                  setBlockRange(n);
                  setBlockInput(String(n));
                }}
                className={cn(
                  'px-2 py-0.5 text-[10px] rounded transition-colors',
                  blockRange === n
                    ? 'bg-sky-600 text-white'
                    : 'bg-muted text-muted-foreground hover:text-foreground',
                )}>
                {n}
              </button>
            ))}
            {/* Manual input */}
            <input
              value={blockInput}
              onChange={(e) => setBlockInput(e.target.value)}
              onBlur={commitBlockInput}
              onKeyDown={(e) => e.key === 'Enter' && commitBlockInput()}
              className="w-12 h-6 text-[10px] text-center bg-muted/30 border border-border rounded outline-none focus:border-sky-500/40 font-mono"
              placeholder="N"
            />
          </div>

          {filterAddr && (
            <div className="flex items-center gap-1 text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20">
              <Filter className="w-2.5 h-2.5" />
              {shortAddr(filterAddr)}
              <button onClick={() => setFilterAddr('')}>
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          )}

          <button
            onClick={() => setShowOnlyKnown((p) => !p)}
            className={cn(
              'text-[10px] px-2 py-0.5 rounded border transition-colors',
              showOnlyKnown
                ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                : 'border-border text-muted-foreground hover:text-foreground',
            )}>
            Known only
          </button>

          {/* View tabs */}
          <div className="flex overflow-hidden border rounded border-border">
            {(['graph', 'list', 'blocks'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  'px-2.5 py-1 text-[10px] capitalize transition-all',
                  view === v
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground/50 hover:bg-accent/40',
                )}>
                {v}
              </button>
            ))}
          </div>

          <Button
            size="sm"
            variant={autoRefresh ? 'default' : 'outline'}
            className="gap-1 px-2 text-xs h-7"
            onClick={() => setAutoRefresh((p) => !p)}>
            {autoRefresh ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {autoRefresh ? 'Live' : 'Auto'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="p-0 h-7 w-7"
            onClick={loadFromRpc}
            disabled={loading}>
            <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-red-500/10 border-b border-red-500/20 text-xs text-red-400 flex-shrink-0">
          <AlertCircle className="w-3 h-3" />
          {error}
          <button className="ml-auto" onClick={() => setError('')}>
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/*  Body  */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* GRAPH VIEW */}
        {view === 'graph' && (
          <div className="flex-1 min-w-0 min-h-0">
            <ReactFlow
              nodes={rfNodes}
              edges={rfEdges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={NODE_TYPES}
              edgeTypes={EDGE_TYPES}
              fitView
              fitViewOptions={{ padding: 0.3 }}
              minZoom={0.1}
              maxZoom={3}
              proOptions={{ hideAttribution: true }}
              style={{ background: '#0d1117' }}
              onNodeClick={(_, node: any) => {
                const nd = node.data as NodeData;
                setDetailAddr(nd.address);
                setDetailTxHash(null);
                setTxDetail(null);
              }}
              onEdgeClick={(_, edge: any) => {
                const ed = edge.data as EdgeData;
                openTxDetail(ed.txHash);
              }}
              onPaneClick={() => {
                setDetailAddr(null);
                setDetailTxHash(null);
                setTxDetail(null);
              }}>
              <Background color="#21262d" gap={32} size={1} />
              <FlowControls position="bottom-left" />
              <MiniMap
                nodeColor={(n) => TYPE_STYLE[(n.data as NodeData).nodeType]?.border || '#475569'}
                maskColor="rgba(0,0,0,0.75)"
                style={{
                  background: '#161b22',
                  border: '1px solid #21262d',
                  borderRadius: 8,
                }}
              />

              {/* Legend */}
              <Panel position="top-left">
                <div className="bg-card/90 dark:bg-emerald-500/10 backdrop-blur rounded-lg px-3 py-2 space-y-1 text-[10px]">
                  {Object.entries(TYPE_STYLE).map(([type, s]) => (
                    <div key={type} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.border }} />
                      <span className="capitalize text-muted-foreground">{type}</span>
                    </div>
                  ))}
                  <div className="border-t border-border mt-1 pt-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-px bg-green-500" />
                      <span className="text-muted-foreground">success</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 border-t border-red-400 border-dashed" />
                      <span className="text-muted-foreground">failed</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-px bg-slate-500" />
                      <span className="text-muted-foreground">unknown</span>
                    </div>
                  </div>
                </div>
              </Panel>

              {rfNodes.length === 0 && !loading && (
                <Panel position="top-center">
                  <div className="flex flex-col items-center gap-2 mt-20 text-muted-foreground/25">
                    <GitFork className="w-14 h-14 opacity-20" />
                    <p className="text-sm">No transactions in range</p>
                    <p className="text-xs">Increase block range or connect an active node</p>
                  </div>
                </Panel>
              )}
              {loading && rfNodes.length === 0 && (
                <Panel position="top-center">
                  <div className="mt-40">
                    <RefreshCw className="w-8 h-8 animate-spin text-sky-400" />
                  </div>
                </Panel>
              )}
            </ReactFlow>
          </div>
        )}

        {/* LIST VIEW */}
        {view === 'list' && (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="p-4 space-y-1.5">
              <p className="mb-3 text-xs text-muted-foreground">
                {allTxs.length} txns · {loadedBlocks.length} block
                {loadedBlocks.length !== 1 ? 's' : ''}
                {filterAddr && ` · filter: ${shortAddr(filterAddr)}`}
              </p>
              {allTxs.length === 0 ? (
                <div className="py-10 text-sm text-center text-muted-foreground/30">
                  No transactions
                </div>
              ) : (
                allTxs.map((tx) => {
                  const local = txHistory.find((t) => t.hash === tx.hash);
                  return (
                    <button
                      key={tx.hash}
                      onClick={() => {
                        openTxDetail(tx.hash);
                        setView('graph');
                      }}
                      className="w-full p-3 text-left transition-all border rounded-lg border-border bg-card hover:border-sky-500/30">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="font-mono text-xs truncate text-sky-400/80">
                          {tx.hash.slice(0, 22)}…
                        </span>
                        <span className="text-[10px] text-muted-foreground/40 flex-shrink-0">
                          #{hex(tx.blockNumber).toLocaleString()}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[10px] text-muted-foreground/60 font-mono">
                        <span className="truncate">{shortAddr(tx.from)}</span>
                        <span className="text-center truncate">
                          → {tx.to ? shortAddr(tx.to) : '📄 deploy'}
                        </span>
                        <span className="text-right">{(hex(tx.value) / 1e18).toFixed(4)}Ξ</span>
                      </div>
                      {local && (
                        <p className="mt-1 text-[10px] text-emerald-400/60 font-mono">
                          {local.contractName}.{local.functionName}()
                        </p>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* BLOCKS VIEW */}
        {view === 'blocks' && (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="p-4 space-y-3">
              {loadedBlocks.length === 0 && (
                <div className="py-10 text-sm text-center text-muted-foreground/30">
                  No blocks loaded
                </div>
              )}
              {loadedBlocks.map((block) => (
                <div key={block.hash} className="p-4 border rounded-lg border-border bg-card">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-sky-400" />
                      <span className="text-sm font-semibold text-sky-400">
                        #{hex(block.number).toLocaleString()}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {timeAgo(hex(block.timestamp))}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        buildGraph([block]);
                        setView('graph');
                      }}
                      className="text-[10px] text-sky-400 hover:underline">
                      View in graph →
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-3 mb-3 text-[11px]">
                    <div>
                      <p className="text-muted-foreground/50 mb-0.5">Txns</p>
                      <p className="font-semibold">{block.transactions.length}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground/50 mb-0.5">Gas</p>
                      <p className="font-semibold">
                        {Math.round((hex(block.gasUsed) / Math.max(hex(block.gasLimit), 1)) * 100)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground/50 mb-0.5">Base Fee</p>
                      <p className="font-mono font-semibold">
                        {block.baseFeePerGas
                          ? `${(hex(block.baseFeePerGas) / 1e9).toFixed(1)}g`
                          : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground/50 mb-0.5">Miner</p>
                      <p className="font-mono text-emerald-400/70">{shortAddr(block.miner)}</p>
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    {block.transactions.slice(0, 4).map((tx) => (
                      <button
                        key={tx.hash}
                        onClick={() => {
                          openTxDetail(tx.hash);
                          setView('graph');
                        }}
                        className="w-full text-left flex items-center gap-2 text-[10px] font-mono text-muted-foreground/50 hover:text-sky-400 transition-colors truncate">
                        <ArrowRight className="w-2.5 h-2.5 flex-shrink-0" />
                        {tx.hash.slice(0, 16)}… {shortAddr(tx.from)} →{' '}
                        {tx.to ? shortAddr(tx.to) : '📄'}
                      </button>
                    ))}
                    {block.transactions.length > 4 && (
                      <p className="text-[10px] text-muted-foreground/30 pl-4">
                        +{block.transactions.length - 4} more
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/*  Detail panel  */}
        {(detailAddr || detailTxHash || loadingTx) && (
          <div className="flex flex-col flex-shrink-0 overflow-hidden border-l w-72 border-border bg-card/60">
            <div className="flex items-center justify-between flex-shrink-0 px-3 py-2 border-b border-border">
              <div className="flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-sky-400" />
                <span className="text-xs font-semibold">
                  {detailAddr ? 'Address Detail' : 'Transaction Detail'}
                </span>
              </div>
              <button
                onClick={() => {
                  setDetailAddr(null);
                  setDetailTxHash(null);
                  setTxDetail(null);
                }}>
                <X className="w-3.5 h-3.5 text-muted-foreground/40 hover:text-muted-foreground" />
              </button>
            </div>

            <div className="flex-1 p-3 space-y-3 overflow-y-auto text-xs">
              {/*  Address  */}
              {detailAddr &&
                (() => {
                  const nd = (rfNodes.find((n: any) => n.id === detailAddr) as any)?.data as
                    | NodeData
                    | undefined;
                  const s = TYPE_STYLE[nd?.nodeType || 'wallet'];
                  const myEdges = rfEdges.filter(
                    (e: any) => e.source === detailAddr || e.target === detailAddr,
                  );
                  return (
                    <>
                      <div className="flex items-center gap-3">
                        <div
                          className="flex items-center justify-center flex-shrink-0 w-10 h-10 text-xl rounded-full"
                          style={{
                            background: `#161b22f0`,
                            border: `2px solid ${s.border}`,
                            boxShadow: `0 0 10px ${s.glow}`,
                          }}>
                          {s.icon}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold capitalize" style={{ color: s.border }}>
                            {nd?.nodeType || 'unknown'}
                          </p>
                          {nd?.contractName && (
                            <p className="text-[10px] text-muted-foreground truncate">
                              {nd.contractName}
                            </p>
                          )}
                          <p className="text-[10px] text-muted-foreground">
                            {nd?.txCount || 0} transaction{(nd?.txCount || 0) !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>

                      <div>
                        <p className="text-[10px] text-muted-foreground/50 mb-1">Full Address</p>
                        <div className="flex items-start gap-1">
                          <p className="text-[10px] font-mono text-foreground/70 break-all flex-1">
                            {detailAddr}
                          </p>
                          <button
                            onClick={() => navigator.clipboard.writeText(detailAddr)}
                            className="flex-shrink-0 mt-0.5">
                            <Copy className="w-3 h-3 text-muted-foreground/40 hover:text-muted-foreground" />
                          </button>
                        </div>
                      </div>

                      {myEdges.length > 0 && (
                        <div>
                          <p className="text-[10px] text-muted-foreground/50 mb-1">
                            Transactions ({myEdges.length})
                          </p>
                          <div className="space-y-0.5">
                            {myEdges.slice(0, 12).map((e: any) => {
                              const ed = e.data as EdgeData;
                              return (
                                <button
                                  key={e.id}
                                  onClick={() => openTxDetail(ed.txHash)}
                                  className="w-full flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground/60 hover:text-sky-400 transition-colors rounded px-2 py-1 hover:bg-muted/20">
                                  <span
                                    className={cn(
                                      'w-1.5 h-1.5 rounded-full flex-shrink-0',
                                      ed.status === 'success'
                                        ? 'bg-emerald-400'
                                        : ed.status === 'failed'
                                          ? 'bg-red-400'
                                          : 'bg-slate-500',
                                    )}
                                  />
                                  <span className="flex-1 truncate">{ed.txHash.slice(0, 14)}…</span>
                                  <span
                                    className={
                                      e.source === detailAddr ? 'text-amber-400' : 'text-blue-400'
                                    }>
                                    {e.source === detailAddr ? '↑ out' : '↓ in'}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-1 text-xs h-7"
                        onClick={() => setFilterAddr(detailAddr)}>
                        <Filter className="w-3 h-3" /> Filter graph to this address
                      </Button>
                    </>
                  );
                })()}

              {/*  Tx loading  */}
              {loadingTx && (
                <div className="flex items-center justify-center py-10">
                  <RefreshCw className="w-6 h-6 animate-spin text-sky-400" />
                </div>
              )}

              {/*  Tx detail  */}
              {!loadingTx &&
                detailTxHash &&
                txDetail &&
                (() => {
                  const { tx, receipt } = txDetail;
                  const local = txHistory.find((t) => t.hash === tx.hash);
                  const ok = receipt?.status === '0x1';
                  return (
                    <>
                      <div
                        className={cn(
                          'rounded-lg px-3 py-2 font-semibold flex items-center gap-2',
                          ok
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : receipt
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
                        )}>
                        <span
                          className={cn(
                            'w-2 h-2 rounded-full flex-shrink-0',
                            ok ? 'bg-emerald-400' : receipt ? 'bg-rose-400' : 'bg-amber-400',
                          )}
                        />
                        {ok ? 'Success' : receipt ? 'Reverted' : 'Pending'}
                        {local && (
                          <span className="ml-auto text-[9px] font-mono truncate opacity-80">
                            {local.contractName}.{local.functionName}()
                          </span>
                        )}
                      </div>

                      {[
                        { k: 'Hash', v: tx.hash },
                        { k: 'From', v: tx.from },
                        { k: 'To', v: tx.to || '(contract creation)' },
                        { k: 'Block', v: `#${hex(tx.blockNumber).toLocaleString()}` },
                        { k: 'Value', v: `${(hex(tx.value) / 1e18).toFixed(6)} ETH` },
                        { k: 'Gas Used', v: receipt ? hex(receipt.gasUsed).toLocaleString() : '—' },
                        { k: 'Gas Price', v: `${(hex(tx.gasPrice) / 1e9).toFixed(2)} gwei` },
                        { k: 'Nonce', v: String(hex(tx.nonce)) },
                      ].map(({ k, v }) => (
                        <div key={k}>
                          <p className="text-[10px] text-muted-foreground/40 mb-0.5">{k}</p>
                          <div className="flex items-center gap-1">
                            <p className="text-[10px] font-mono text-emerald-300/70 break-all flex-1">
                              {v.length > 34 ? v.slice(0, 16) + '…' + v.slice(-6) : v}
                            </p>
                            {v.startsWith('0x') && (
                              <button onClick={() => navigator.clipboard.writeText(v)}>
                                <Copy className="w-2.5 h-2.5 text-muted-foreground/30 hover:text-muted-foreground flex-shrink-0" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}

                      {tx.input && tx.input !== '0x' && (
                        <div>
                          <p className="text-[10px] text-muted-foreground/40 mb-0.5">Input Data</p>
                          <p className="text-[10px] font-mono text-foreground/50 break-all">
                            <span className="text-blue-400">{tx.input.slice(0, 10)}</span>
                            {tx.input.slice(10, 74)}
                            {tx.input.length > 74 && (
                              <span className="text-muted-foreground/30">…</span>
                            )}
                          </p>
                        </div>
                      )}

                      {receipt?.logs && receipt.logs.length > 0 && (
                        <div className="p-3 border rounded-lg bg-purple-500/10 border-purple-500/20">
                          <p className="text-[10px] text-purple-400 font-semibold mb-2">
                            ⚡ {receipt.logs.length} event{receipt.logs.length !== 1 ? 's' : ''}{' '}
                            emitted
                          </p>
                          {receipt.logs.map((log, i) => (
                            <div key={i} className="mb-1">
                              <p className="text-[9px] font-mono text-muted-foreground/50">
                                {shortAddr(log.address)}
                              </p>
                              <p className="text-[9px] font-mono text-purple-400/50 truncate">
                                {log.topics[0]?.slice(0, 20)}…
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      {local?.args && local.args.length > 0 && (
                        <div className="p-3 border rounded-lg bg-emerald-500/10 border-emerald-500/20">
                          <p className="text-[10px] text-emerald-400 font-semibold mb-1">
                            Parameters
                          </p>
                          {local.args.map((a, i) => (
                            <p key={i} className="text-[9px] font-mono text-muted-foreground/50">
                              [{i}] {String(a).slice(0, 42)}
                            </p>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
