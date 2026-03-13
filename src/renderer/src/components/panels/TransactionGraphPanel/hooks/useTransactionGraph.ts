import { useState, useEffect, useCallback } from 'react';
import { useNodesState, useEdgesState } from '@xyflow/react';
import { TxRecord, DeployedContract } from '../../../../types';
import { RpcBlock, RpcTx, RpcReceipt, TxDetailState, ViewMode } from '../types';
import { rpc, hex } from '../lib/rpcUtils';
import { buildGraphData } from '../lib/graphBuilder';

interface Options {
  txHistory: TxRecord[];
  rpcUrl: string;
  deployedContracts: DeployedContract[];
}

export function useTransactionGraph({ txHistory, rpcUrl, deployedContracts }: Options) {
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
  const [view, setView] = useState<ViewMode>('graph');

  const [filterAddr, setFilterAddr] = useState('');
  const [showOnlyKnown, setShowOnlyKnown] = useState(false);
  const [searchInput, setSearchInput] = useState('');

  const [detailAddr, setDetailAddr] = useState<string | null>(null);
  const [detailTxHash, setDetailTxHash] = useState<string | null>(null);
  const [txDetail, setTxDetail] = useState<TxDetailState | null>(null);

  //  Build graph from loaded blocks 
  const buildGraph = useCallback((blocks: RpcBlock[]) => {
    const { nodes, edges } = buildGraphData({ blocks, txHistory, deployedContracts, filterAddr, showOnlyKnown });
    setRfNodes(nodes as any);
    setRfEdges(edges as any);
  }, [txHistory, deployedContracts, filterAddr, showOnlyKnown]);

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
            rpc(rpcUrl, 'eth_getBlockByNumber', ['0x' + (latestNum - i).toString(16), true]).catch(() => null),
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

  //  Fetch tx detail 
  const fetchTxDetail = useCallback(async (hash: string) => {
    setLoadingTx(true);
    setTxDetail(null);
    try {
      const [tx, receipt] = await Promise.all([
        rpc(rpcUrl, 'eth_getTransactionByHash', [hash]),
        rpc(rpcUrl, 'eth_getTransactionReceipt', [hash]).catch(() => null),
      ]);
      if (tx) setTxDetail({ tx: tx as RpcTx, receipt: receipt as RpcReceipt | null });
    } catch { }
    setLoadingTx(false);
  }, [rpcUrl]);

  const openTxDetail = useCallback((hash: string) => {
    setDetailTxHash(hash);
    setDetailAddr(null);
    setTxDetail(null);
    fetchTxDetail(hash);
  }, [fetchTxDetail]);

  const clearDetail = useCallback(() => {
    setDetailAddr(null);
    setDetailTxHash(null);
    setTxDetail(null);
  }, []);

  //  Search 
  const handleSearch = useCallback(async () => {
    const q = searchInput.trim();
    if (!q) return;
    if (q.startsWith('0x') && q.length === 42) { setFilterAddr(q); return; }
    if (q.startsWith('0x') && q.length === 66) { openTxDetail(q); return; }
    const num = parseInt(q);
    if (!isNaN(num)) {
      const block = await rpc(rpcUrl, 'eth_getBlockByNumber', ['0x' + num.toString(16), true]).catch(() => null);
      if (block) { setLoadedBlocks([block]); buildGraph([block]); }
    }
  }, [searchInput, rpcUrl, openTxDetail, buildGraph]);

  const commitBlockInput = useCallback(() => {
    const n = parseInt(blockInput);
    if (!isNaN(n) && n >= 1 && n <= 500) setBlockRange(n);
  }, [blockInput]);

  //  Effects 
  useEffect(() => { loadFromRpc(); }, [rpcUrl, blockRange]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(loadFromRpc, 4000);
    return () => clearInterval(id);
  }, [autoRefresh, loadFromRpc]);

  useEffect(() => {
    if (loadedBlocks.length > 0) buildGraph(loadedBlocks);
  }, [filterAddr, showOnlyKnown]);

  const allTxs = loadedBlocks.flatMap((b) => b.transactions || []);

  return {
    // Flow state
    rfNodes, rfEdges, onNodesChange, onEdgesChange,
    // Block state
    loadedBlocks, latestBlockNum, blockRange, setBlockRange, blockInput, setBlockInput, commitBlockInput,
    allTxs,
    // UI state
    loading, loadingTx, error, setError,
    autoRefresh, setAutoRefresh,
    view, setView,
    // Filters
    filterAddr, setFilterAddr,
    showOnlyKnown, setShowOnlyKnown,
    searchInput, setSearchInput,
    // Detail
    detailAddr, setDetailAddr,
    detailTxHash,
    txDetail,
    // Actions
    loadFromRpc, openTxDetail, clearDetail, handleSearch, buildGraph,
  };
}
