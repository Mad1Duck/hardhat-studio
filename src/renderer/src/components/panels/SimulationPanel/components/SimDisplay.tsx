import { RefObject } from 'react';
import { DeployedContract } from '../../../../types';
import { SimEvent, SimUser, PoolState } from '../../../modules/Simulation/types';
import { cn } from '../../../../lib/utils';
import { Activity, Wifi, Users, RefreshCw } from 'lucide-react';
import { FlaskConical } from 'lucide-react';
import { ScrollArea } from '../../../ui/primitives';
import { EVENT_COLOR } from '../config/eventColors';

//  Pool State Bar
interface PoolStateBarProps {
  pool: PoolState;
}

export function PoolStateBar({ pool }: PoolStateBarProps) {
  const stats = [
    {
      label: 'Deposited',
      value: `${pool.totalDeposited.toFixed(0)} ETH`,
      color: 'text-emerald-400',
    },
    { label: 'Borrowed', value: `$${pool.totalBorrowed.toFixed(0)}`, color: 'text-amber-400' },
    {
      label: 'Utilization',
      value: `${Math.min(100, pool.utilizationRate).toFixed(1)}%`,
      color: 'text-sky-400',
    },
    { label: 'Price', value: `$${pool.collateralPrice.toFixed(0)}`, color: 'text-orange-400' },
    {
      label: 'Supply',
      value:
        pool.tokenTotalSupply >= 1e9
          ? `${(pool.tokenTotalSupply / 1e9).toFixed(2)}B`
          : pool.tokenTotalSupply.toLocaleString(),
      color: 'text-violet-400',
    },
    {
      label: 'Pool A/B',
      value: `${(pool.reserveA / 1000).toFixed(0)}k/${(pool.reserveB / 1000).toFixed(0)}k`,
      color: 'text-cyan-400',
    },
  ];

  return (
    <div className="grid flex-shrink-0 grid-cols-6 gap-px border-b bg-border border-border">
      {stats.map(({ label, value, color }) => (
        <div key={label} className="bg-card px-2 py-1.5">
          <div className="text-[8px] text-muted-foreground/40 uppercase tracking-widest">
            {label}
          </div>
          <div className={cn('text-xs font-mono font-semibold mt-0.5', color)}>{value}</div>
        </div>
      ))}
    </div>
  );
}

//  Event Log ─
interface EventLogProps {
  events: SimEvent[];
  running: boolean;
  deployedContracts: DeployedContract[];
  eventsEndRef: RefObject<HTMLDivElement>;
}

export function EventLog({ events, running, deployedContracts, eventsEndRef }: EventLogProps) {
  const errCount = events.filter((e) => e.type === 'error' || !e.success).length;
  const realTxCount = events.filter((e) => e.realTx).length;

  return (
    <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-card/50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-violet-400" />
          <span className="text-xs font-semibold">Simulation Log</span>
          <span className="text-[9px] text-muted-foreground/40">{events.length} events</span>
          {realTxCount > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
              <Wifi className="w-2.5 h-2.5" /> {realTxCount} on-chain
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {events.filter((e) => e.success && e.type !== 'error').length > 0 && (
            <span className="text-[9px] text-emerald-400 font-mono">
              ✓ {events.filter((e) => e.success && e.type !== 'error').length}
            </span>
          )}
          {errCount > 0 && <span className="text-[9px] text-rose-400 font-mono">✗ {errCount}</span>}
          {running && (
            <div className="flex items-center gap-1 text-[10px] text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Running
            </div>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1 overflow-y-auto">
        <div className="p-2 space-y-px font-mono">
          {events.length === 0 && (
            <div className="py-16 text-center text-muted-foreground/20">
              <FlaskConical className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Select a module and click Run</p>
              <p className="text-[10px] mt-1 text-muted-foreground/30">
                {deployedContracts.length > 0
                  ? `${deployedContracts.length} contract${deployedContracts.length > 1 ? 's' : ''} connected — real txs enabled`
                  : 'No deployed contracts — running in simulation mode'}
              </p>
            </div>
          )}

          {events.map((ev) => {
            const color = EVENT_COLOR[ev.type] || 'text-muted-foreground/60';
            const isLiquidate = ev.type === 'liquidate';
            const isError = ev.type === 'error' || (!ev.success && ev.type !== 'info');
            return (
              <div
                key={ev.id}
                className={cn(
                  'flex items-start gap-2 px-2 py-1 rounded text-[10.5px] leading-relaxed',
                  isLiquidate && 'bg-rose-500/8 border-l-2 border-rose-500/40',
                  isError && !isLiquidate && 'bg-rose-500/5',
                  ev.type === 'success' && 'bg-emerald-500/5',
                  ev.type === 'warn' && 'bg-amber-500/5',
                  ev.type === 'info' && 'opacity-60',
                )}>
                <div
                  className={cn('flex-shrink-0 w-1.5 h-1.5 rounded-full mt-1.5', {
                    'bg-emerald-400': ev.success && ev.type !== 'info' && ev.type !== 'warn',
                    'bg-rose-400': !ev.success || isError,
                    'bg-amber-400': ev.type === 'warn',
                    'bg-muted-foreground/20': ev.type === 'info',
                  })}
                />
                <div className="flex-1 min-w-0">
                  <span className={cn('font-semibold mr-1.5', color)}>[{ev.actor}]</span>
                  <span className="text-foreground/80">{ev.message}</span>
                  {ev.value !== undefined &&
                    ev.type !== 'info' &&
                    ev.type !== 'error' &&
                    ev.type !== 'warn' &&
                    ev.type !== 'success' && (
                      <span className="text-muted-foreground/30 ml-1 text-[9px]">
                        {typeof ev.value === 'number'
                          ? ev.value.toLocaleString(undefined, { maximumFractionDigits: 4 })
                          : ev.value}
                      </span>
                    )}
                  {ev.txHash && (
                    <span className="ml-1.5 text-[9px] text-blue-400/60 font-mono">
                      {ev.txHash.slice(0, 12)}…
                    </span>
                  )}
                  {ev.realTx && (
                    <span className="ml-1 text-[8px] text-emerald-400/60 border border-emerald-500/20 px-1 rounded">
                      on-chain
                    </span>
                  )}
                </div>
                <span className="text-[8px] text-muted-foreground/25 flex-shrink-0 mt-0.5">
                  {new Date(ev.timestamp).toLocaleTimeString([], {
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
              </div>
            );
          })}
          <div ref={eventsEndRef} />
        </div>
      </ScrollArea>
    </div>
  );
}

//  User State Panel
interface UserStatePanelProps {
  users: SimUser[];
  enrichedContracts: DeployedContract[];
  running: boolean;
  onSyncBalances: (users: SimUser[]) => void;
}

export function UserStatePanel({
  users,
  enrichedContracts,
  running,
  onSyncBalances,
}: UserStatePanelProps) {
  return (
    <div className="flex flex-col flex-shrink-0 overflow-hidden border-l w-52 border-border">
      <div className="px-3 py-1.5 border-b border-border bg-card/50 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Users className="w-3 h-3 text-muted-foreground/50" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
            User State
          </span>
          {enrichedContracts.length > 0 && (
            <span className="text-[8px] px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              live
            </span>
          )}
        </div>
        <button
          onClick={() => onSyncBalances(users)}
          disabled={running || enrichedContracts.length === 0}
          title="Sync balances from chain"
          className="transition-colors text-muted-foreground/30 hover:text-emerald-400 disabled:opacity-20">
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>

      <ScrollArea className="flex-1 overflow-y-auto">
        <div className="p-2 space-y-1.5">
          {users.map((u) => (
            <div
              key={u.id}
              className={cn(
                'rounded-lg border p-2 text-[10px] font-mono transition-colors',
                u.healthFactor < 1.0 && u.borrowedAmount > 0
                  ? 'border-rose-500/40 bg-rose-500/5'
                  : u.healthFactor < 1.2 && u.borrowedAmount > 0
                    ? 'border-amber-500/30 bg-amber-500/5'
                    : 'border-border/50 bg-card/50',
              )}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-foreground/90 text-[11px]">{u.label}</span>
                {u.borrowedAmount > 0 && (
                  <span
                    className={cn(
                      'text-[8px] px-1 py-0.5 rounded font-mono',
                      u.healthFactor < 1.0
                        ? 'bg-rose-500/20 text-rose-400'
                        : u.healthFactor < 1.2
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-emerald-500/15 text-emerald-400',
                    )}>
                    HF {u.healthFactor > 100 ? '∞' : u.healthFactor.toFixed(2)}
                  </span>
                )}
              </div>
              <div className="space-y-0.5 text-muted-foreground/60">
                <div className="flex items-center justify-between">
                  <span className="text-amber-400/70">Ξ ETH</span>
                  <span
                    className={cn(
                      'font-mono',
                      u.balanceETH !== 10000 ? 'text-amber-300' : 'text-muted-foreground/40',
                    )}>
                    {u.balanceETH.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                  </span>
                </div>
                {u.balanceToken > 0 && (
                  <div className="flex items-center justify-between">
                    <span>🪙 Token</span>
                    <span className="text-violet-300">
                      {u.balanceToken.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                {u.balanceNFT.length > 0 && (
                  <div className="flex items-center justify-between">
                    <span>🖼️ NFTs</span>
                    <span className="text-foreground/70">
                      {u.balanceNFT.length}
                      <span className="text-muted-foreground/40 ml-1 text-[8px]">
                        #{u.balanceNFT.slice(0, 3).join(',')}
                      </span>
                    </span>
                  </div>
                )}
                {u.balanceCollateral > 0 && (
                  <div className="flex items-center justify-between">
                    <span>💎 Collateral</span>
                    <span className="text-sky-300">{u.balanceCollateral.toFixed(2)}</span>
                  </div>
                )}
                {u.borrowedAmount > 0 && (
                  <div className="flex items-center justify-between">
                    <span>💸 Debt</span>
                    <span className="text-rose-400/80">${u.borrowedAmount.toFixed(0)}</span>
                  </div>
                )}
                {u.lpTokens > 0 && (
                  <div className="flex items-center justify-between">
                    <span>🔄 LP</span>
                    <span className="text-cyan-400/80">{u.lpTokens.toFixed(2)}</span>
                  </div>
                )}
                {u.votingPower > 0 && (
                  <div className="flex items-center justify-between">
                    <span>🗳️ Votes</span>
                    <span className="text-indigo-400/80">
                      {u.votingPower >= 1000
                        ? `${(u.votingPower / 1000).toFixed(1)}k`
                        : u.votingPower.toFixed(0)}
                    </span>
                  </div>
                )}
                {u.stakedAmount > 0 && (
                  <div className="flex items-center justify-between">
                    <span>🔒 Staked</span>
                    <span className="text-violet-400/80">{u.stakedAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="text-muted-foreground/25 truncate mt-1 text-[8px]">
                  {u.address.slice(0, 10)}…{u.address.slice(-4)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Connected contracts */}
      <div className="p-2 border-t border-border">
        <p className="text-[9px] text-muted-foreground/40 uppercase tracking-widest font-mono mb-1.5">
          Contracts ({enrichedContracts.length})
        </p>
        {enrichedContracts.length === 0 ? (
          <p className="text-[9px] text-muted-foreground/25 text-center py-1">
            Deploy contracts first
          </p>
        ) : (
          <div className="space-y-1">
            {enrichedContracts.map((dc) => (
              <div key={dc.id} className="flex items-center gap-1.5 text-[9px]">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                <span className="font-semibold truncate text-foreground/70">{dc.name}</span>
                <span className="flex-shrink-0 ml-auto font-mono text-muted-foreground/30">
                  {dc.address.slice(0, 7)}…
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
