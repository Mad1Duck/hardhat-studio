import { TxRecord } from '../../../../types';
import { NodeData, EdgeData, TxDetailState } from '../types';
import { NODE_TYPE_STYLE } from '../config/nodeStyles';
import { hex, shortAddr } from '../lib/rpcUtils';
import { cn } from '../../../../lib/utils';
import { Info, X, Copy, Filter, RefreshCw } from 'lucide-react';
import { Button } from '../../../ui/button';

interface Props {
  detailAddr: string | null;
  detailTxHash: string | null;
  txDetail: TxDetailState | null;
  loadingTx: boolean;
  rfNodes: any[];
  rfEdges: any[];
  txHistory: TxRecord[];
  onClose: () => void;
  onTxClick: (hash: string) => void;
  onFilterAddr: (addr: string) => void;
}

export function DetailPanel({
  detailAddr,
  detailTxHash,
  txDetail,
  loadingTx,
  rfNodes,
  rfEdges,
  txHistory,
  onClose,
  onTxClick,
  onFilterAddr,
}: Props) {
  if (!detailAddr && !detailTxHash && !loadingTx) return null;

  return (
    <div className="flex flex-col flex-shrink-0 overflow-hidden border-l w-72 border-border bg-card/60">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0 px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-sky-400" />
          <span className="text-xs font-semibold">
            {detailAddr ? 'Address Detail' : 'Transaction Detail'}
          </span>
        </div>
        <button onClick={onClose}>
          <X className="w-3.5 h-3.5 text-muted-foreground/40 hover:text-muted-foreground" />
        </button>
      </div>

      <div className="flex-1 p-3 space-y-3 overflow-y-auto text-xs">
        {/*  Address detail  */}
        {detailAddr &&
          (() => {
            const nd = (rfNodes.find((n: any) => n.id === detailAddr) as any)?.data as
              | NodeData
              | undefined;
            const s = NODE_TYPE_STYLE[nd?.nodeType || 'wallet'];
            const myEdges = rfEdges.filter(
              (e: any) => e.source === detailAddr || e.target === detailAddr,
            );

            return (
              <>
                <div className="flex items-center gap-3">
                  <div
                    className="flex items-center justify-center flex-shrink-0 w-10 h-10 text-xl rounded-full"
                    style={{
                      background: '#161b22f0',
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
                            onClick={() => onTxClick(ed.txHash)}
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
                  onClick={() => onFilterAddr(detailAddr)}>
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
                      {tx.input.length > 74 && <span className="text-muted-foreground/30">…</span>}
                    </p>
                  </div>
                )}

                {receipt?.logs && receipt.logs.length > 0 && (
                  <div className="p-3 border rounded-lg bg-purple-500/10 border-purple-500/20">
                    <p className="text-[10px] text-purple-400 font-semibold mb-2">
                      ⚡ {receipt.logs.length} event{receipt.logs.length !== 1 ? 's' : ''} emitted
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
                    <p className="text-[10px] text-emerald-400 font-semibold mb-1">Parameters</p>
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
  );
}
