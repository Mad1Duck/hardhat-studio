import { GitFork, Search, Filter, X, Play, Pause, RefreshCw } from 'lucide-react';
import { Button } from '../../../ui/button';
import { cn } from '../../../../lib/utils';
import { ViewMode } from '../types';

interface Props {
  latestBlockNum: number | null;
  nodeCount: number;
  edgeCount: number;
  blockRange: number;
  blockInput: string;
  autoRefresh: boolean;
  loading: boolean;
  view: ViewMode;
  filterAddr: string;
  showOnlyKnown: boolean;
  searchInput: string;
  onBlockRangeClick: (n: number) => void;
  onBlockInputChange: (v: string) => void;
  onBlockInputCommit: () => void;
  onToggleAutoRefresh: () => void;
  onRefresh: () => void;
  onViewChange: (v: ViewMode) => void;
  onSearchChange: (v: string) => void;
  onSearchSubmit: () => void;
  onClearFilter: () => void;
  onToggleKnownOnly: () => void;
}

export function GraphToolbar({
  latestBlockNum,
  nodeCount,
  edgeCount,
  blockRange,
  blockInput,
  autoRefresh,
  loading,
  view,
  filterAddr,
  showOnlyKnown,
  searchInput,
  onBlockRangeClick,
  onBlockInputChange,
  onBlockInputCommit,
  onToggleAutoRefresh,
  onRefresh,
  onViewChange,
  onSearchChange,
  onSearchSubmit,
  onClearFilter,
  onToggleKnownOnly,
}: Props) {
  return (
    <div className="flex flex-wrap items-center flex-shrink-0 gap-2 px-3 py-2 border-b border-border">
      <GitFork className="flex-shrink-0 w-4 h-4 text-sky-400" />
      <span className="text-sm font-semibold">Transaction Graph</span>
      {latestBlockNum !== null && (
        <span className="text-[10px] bg-sky-500/10 text-sky-400 px-1.5 py-0.5 rounded">
          Block #{latestBlockNum.toLocaleString()}
        </span>
      )}
      <span className="text-[10px] text-muted-foreground">
        {nodeCount} nodes · {edgeCount} edges
      </span>

      <div className="ml-auto flex items-center gap-1.5 flex-wrap">
        {/* Search */}
        <div className="relative">
          <Search className="absolute w-3 h-3 -translate-y-1/2 left-2 top-1/2 text-muted-foreground/40" />
          <input
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearchSubmit()}
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
              onClick={() => onBlockRangeClick(n)}
              className={cn(
                'px-2 py-0.5 text-[10px] rounded transition-colors',
                blockRange === n
                  ? 'bg-sky-600 text-white'
                  : 'bg-muted text-muted-foreground hover:text-foreground',
              )}>
              {n}
            </button>
          ))}
          <input
            value={blockInput}
            onChange={(e) => onBlockInputChange(e.target.value)}
            onBlur={onBlockInputCommit}
            onKeyDown={(e) => e.key === 'Enter' && onBlockInputCommit()}
            className="w-12 h-6 text-[10px] text-center bg-muted/30 border border-border rounded outline-none focus:border-sky-500/40 font-mono"
            placeholder="N"
          />
        </div>

        {filterAddr && (
          <div className="flex items-center gap-1 text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20">
            <Filter className="w-2.5 h-2.5" />
            {filterAddr.slice(0, 6)}…{filterAddr.slice(-4)}
            <button onClick={onClearFilter}>
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        )}

        <button
          onClick={onToggleKnownOnly}
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
              onClick={() => onViewChange(v)}
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
          onClick={onToggleAutoRefresh}>
          {autoRefresh ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          {autoRefresh ? 'Live' : 'Auto'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="p-0 h-7 w-7"
          onClick={onRefresh}
          disabled={loading}>
          <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
        </Button>
      </div>
    </div>
  );
}
