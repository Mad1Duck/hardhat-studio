import '@xyflow/react/dist/style.css';
import { AlertCircle, X } from 'lucide-react';
import { TransactionGraphPanelProps, NodeData, EdgeData } from './types';
import { useTransactionGraph } from './hooks/useTransactionGraph';
import { GraphToolbar } from './components/GraphToolbar';
import { GraphView } from './components/GraphView';
import { ListView, BlocksView } from './components/DataViews';
import { DetailPanel } from './components/DetailPanel';

export default function TransactionGraphPanel({ txHistory, rpcUrl, deployedContracts }: TransactionGraphPanelProps) {
  const g = useTransactionGraph({ txHistory, rpcUrl, deployedContracts });

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <GraphToolbar
        latestBlockNum={g.latestBlockNum}
        nodeCount={g.rfNodes.length}
        edgeCount={g.rfEdges.length}
        blockRange={g.blockRange}
        blockInput={g.blockInput}
        autoRefresh={g.autoRefresh}
        loading={g.loading}
        view={g.view}
        filterAddr={g.filterAddr}
        showOnlyKnown={g.showOnlyKnown}
        searchInput={g.searchInput}
        onBlockRangeClick={(n) => { g.setBlockRange(n); g.setBlockInput(String(n)); }}
        onBlockInputChange={g.setBlockInput}
        onBlockInputCommit={g.commitBlockInput}
        onToggleAutoRefresh={() => g.setAutoRefresh((p) => !p)}
        onRefresh={g.loadFromRpc}
        onViewChange={g.setView}
        onSearchChange={g.setSearchInput}
        onSearchSubmit={g.handleSearch}
        onClearFilter={() => g.setFilterAddr('')}
        onToggleKnownOnly={() => g.setShowOnlyKnown((p) => !p)}
      />

      {g.error && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-red-500/10 border-b border-red-500/20 text-xs text-red-400 flex-shrink-0">
          <AlertCircle className="w-3 h-3" />
          {g.error}
          <button className="ml-auto" onClick={() => g.setError('')}><X className="w-3 h-3" /></button>
        </div>
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {g.view === 'graph' && (
          <GraphView
            rfNodes={g.rfNodes}
            rfEdges={g.rfEdges}
            onNodesChange={g.onNodesChange}
            onEdgesChange={g.onEdgesChange}
            loading={g.loading}
            onNodeClick={(node) => {
              g.setDetailAddr((node.data as NodeData).address);
            }}
            onEdgeClick={(edge) => {
              g.openTxDetail((edge.data as EdgeData).txHash);
            }}
            onPaneClick={g.clearDetail}
          />
        )}

        {g.view === 'list' && (
          <ListView
            allTxs={g.allTxs}
            blockCount={g.loadedBlocks.length}
            filterAddr={g.filterAddr}
            txHistory={txHistory}
            onTxClick={(hash) => { g.openTxDetail(hash); g.setView('graph'); }}
          />
        )}

        {g.view === 'blocks' && (
          <BlocksView
            blocks={g.loadedBlocks}
            onViewBlock={(block) => { g.buildGraph([block]); g.setView('graph'); }}
            onTxClick={(hash) => { g.openTxDetail(hash); g.setView('graph'); }}
          />
        )}

        <DetailPanel
          detailAddr={g.detailAddr}
          detailTxHash={g.detailTxHash}
          txDetail={g.txDetail}
          loadingTx={g.loadingTx}
          rfNodes={g.rfNodes}
          rfEdges={g.rfEdges}
          txHistory={txHistory}
          onClose={g.clearDetail}
          onTxClick={g.openTxDetail}
          onFilterAddr={g.setFilterAddr}
        />
      </div>
    </div>
  );
}
