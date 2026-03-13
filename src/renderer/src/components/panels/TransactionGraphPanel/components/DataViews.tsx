import { TxRecord } from '../../../types';
import { RpcBlock, RpcTx } from '../types';
import { Layers, ArrowRight } from 'lucide-react';
import { hex, shortAddr, timeAgo } from '../lib/rpcUtils';

//  List View 
interface ListViewProps {
  allTxs: RpcTx[];
  blockCount: number;
  filterAddr: string;
  txHistory: TxRecord[];
  onTxClick: (hash: string) => void;
}

export function ListView({ allTxs, blockCount, filterAddr, txHistory, onTxClick }: ListViewProps) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="p-4 space-y-1.5">
        <p className="mb-3 text-xs text-muted-foreground">
          {allTxs.length} txns · {blockCount} block{blockCount !== 1 ? 's' : ''}
          {filterAddr && ` · filter: ${shortAddr(filterAddr)}`}
        </p>

        {allTxs.length === 0 ? (
          <div className="py-10 text-sm text-center text-muted-foreground/30">No transactions</div>
        ) : (
          allTxs.map((tx) => {
            const local = txHistory.find((t) => t.hash === tx.hash);
            return (
              <button
                key={tx.hash}
                onClick={() => onTxClick(tx.hash)}
                className="w-full p-3 text-left transition-all border rounded-lg border-border bg-card hover:border-sky-500/30">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="font-mono text-xs truncate text-sky-400/80">{tx.hash.slice(0, 22)}…</span>
                  <span className="text-[10px] text-muted-foreground/40 flex-shrink-0">#{hex(tx.blockNumber).toLocaleString()}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[10px] text-muted-foreground/60 font-mono">
                  <span className="truncate">{shortAddr(tx.from)}</span>
                  <span className="text-center truncate">→ {tx.to ? shortAddr(tx.to) : '📄 deploy'}</span>
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
  );
}

//  Blocks View 
interface BlocksViewProps {
  blocks: RpcBlock[];
  onViewBlock: (block: RpcBlock) => void;
  onTxClick: (hash: string) => void;
}

export function BlocksView({ blocks, onViewBlock, onTxClick }: BlocksViewProps) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="p-4 space-y-3">
        {blocks.length === 0 && (
          <div className="py-10 text-sm text-center text-muted-foreground/30">No blocks loaded</div>
        )}
        {blocks.map((block) => (
          <div key={block.hash} className="p-4 border rounded-lg border-border bg-card">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-sky-400" />
                <span className="text-sm font-semibold text-sky-400">#{hex(block.number).toLocaleString()}</span>
                <span className="text-[10px] text-muted-foreground">{timeAgo(hex(block.timestamp))}</span>
              </div>
              <button onClick={() => onViewBlock(block)} className="text-[10px] text-sky-400 hover:underline">
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
                <p className="font-semibold">{Math.round((hex(block.gasUsed) / Math.max(hex(block.gasLimit), 1)) * 100)}%</p>
              </div>
              <div>
                <p className="text-muted-foreground/50 mb-0.5">Base Fee</p>
                <p className="font-mono font-semibold">
                  {block.baseFeePerGas ? `${(hex(block.baseFeePerGas) / 1e9).toFixed(1)}g` : 'N/A'}
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
                  onClick={() => onTxClick(tx.hash)}
                  className="w-full text-left flex items-center gap-2 text-[10px] font-mono text-muted-foreground/50 hover:text-sky-400 transition-colors truncate">
                  <ArrowRight className="w-2.5 h-2.5 flex-shrink-0" />
                  {tx.hash.slice(0, 16)}… {shortAddr(tx.from)} → {tx.to ? shortAddr(tx.to) : '📄'}
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
  );
}
