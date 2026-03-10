//
//  SHARED PRIMITIVES — small reusable UI atoms
//
import { useRef, useEffect, useState, ReactNode } from 'react';
import {
  Crown,
  Star,
  Zap,
  CheckCircle,
  Clock,
  Terminal,
  ChevronDown,
  ChevronUp,
  Trash2,
} from 'lucide-react';
import { useLicense, Plan } from '@/integrations/license';
import { LOG_STYLE } from '../../config/constants';
import { cn } from '@/lib/utils';

//  PlanIcon
export function PlanIcon({ plan, className }: { plan: Plan; className?: string }) {
  if (plan === 'pro') return <Crown className={cn('text-violet-400', className)} />;
  if (plan === 'basic') return <Star className={cn('text-blue-400', className)} />;
  return <Zap className={cn('text-muted-foreground', className)} />;
}

//  StepCard
export function StepCard({
  step,
  done,
  dimmed,
  title,
  subtitle,
  right,
}: {
  step: number;
  done: boolean;
  dimmed: boolean;
  title: string;
  subtitle: string;
  right: ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl border transition-all',
        done
          ? 'bg-emerald-500/5 border-emerald-500/20'
          : dimmed
            ? 'bg-muted/10 border-border/20 opacity-40'
            : 'bg-muted/25 border-border/50',
      )}>
      <div
        className={cn(
          'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border',
          done
            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
            : 'bg-muted/50 border-border/50 text-muted-foreground',
        )}>
        {done ? <CheckCircle className="w-3.5 h-3.5" /> : step}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate text-foreground">{title}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>
      </div>
      <div className="flex-shrink-0">{right}</div>
    </div>
  );
}

//  StreamProgressBar
export function StreamProgressBar({
  stream,
  plan,
}: {
  stream: { startTime: number; endTime: number };
  plan: Plan;
}) {
  const now = Date.now() / 1000;
  const pct = Math.max(
    0,
    Math.min(((now - stream.startTime) / (stream.endTime - stream.startTime)) * 100, 100),
  );
  const daysLeft = Math.max(0, Math.ceil((stream.endTime - now) / 86400));

  return (
    <div className="space-y-1.5">
      <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full',
            plan === 'pro'
              ? 'bg-gradient-to-r from-violet-500 to-violet-400'
              : 'bg-gradient-to-r from-blue-500 to-blue-400',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{pct.toFixed(1)}% streamed</span>
        <span className="flex items-center gap-1">
          <Clock className="w-2.5 h-2.5" />
          {daysLeft}d remaining
        </span>
      </div>
    </div>
  );
}

//  DebugLogPanel
export function DebugLogPanel() {
  const { logs, clearLogs } = useLicense();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | keyof typeof LOG_STYLE>('all');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, open]);

  const filtered = filter === 'all' ? logs : logs.filter((l) => l.level === filter);
  const errorCount = logs.filter((l) => l.level === 'error').length;
  const warnCount = logs.filter((l) => l.level === 'warn').length;
  const fmtTime = (ts: number) =>
    new Date(ts).toLocaleTimeString('en-GB', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

  return (
    <div className="overflow-hidden border border-border/40 rounded-xl">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center w-full gap-2 px-3 py-2 text-left transition-colors bg-muted/20 hover:bg-muted/30">
        <Terminal className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <span className="text-[10px] font-mono font-semibold text-muted-foreground flex-1">
          Debug Logs
        </span>
        <div className="flex items-center gap-1">
          {logs.length > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground font-mono">
              {logs.length}
            </span>
          )}
          {errorCount > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-mono">
              {errorCount} ERR
            </span>
          )}
          {warnCount > 0 && !errorCount && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono">
              {warnCount} WARN
            </span>
          )}
        </div>
        {open ? (
          <ChevronUp className="w-3 h-3 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="bg-black/60">
          <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border/30 flex-wrap">
            {(['all', 'info', 'success', 'warn', 'error', 'debug'] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setFilter(lvl)}
                className={cn(
                  'text-[9px] font-mono px-1.5 py-0.5 rounded transition-colors',
                  filter === lvl
                    ? 'bg-violet-600/60 text-white'
                    : 'text-muted-foreground hover:text-foreground',
                )}>
                {lvl.toUpperCase()}
              </button>
            ))}
            <div className="flex-1" />
            <button
              onClick={clearLogs}
              className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-red-400 transition-colors">
              <Trash2 className="w-2.5 h-2.5" /> Clear
            </button>
          </div>

          <div className="overflow-y-auto max-h-48 font-mono text-[10px] leading-relaxed px-1 py-1">
            {filtered.length === 0 ? (
              <p className="text-center py-4 text-muted-foreground/40 text-[10px]">
                {logs.length === 0 ? 'No logs yet — click Refresh' : 'No logs match filter'}
              </p>
            ) : (
              filtered.map((entry) => {
                const s = LOG_STYLE[entry.level];
                return (
                  <div key={entry.id} className="flex gap-1.5 py-0.5 px-1 hover:bg-white/5 rounded">
                    <span className={cn('mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0', s.dot)} />
                    <span className="text-muted-foreground/40 flex-shrink-0 w-[52px]">
                      {fmtTime(entry.ts)}
                    </span>
                    <span className={cn('flex-shrink-0 w-8', s.text)}>{s.label}</span>
                    <span className="flex-1 break-all text-foreground/80">{entry.msg}</span>
                    {entry.data !== undefined && (
                      <span
                        className="text-muted-foreground/40 truncate max-w-[100px] hidden sm:block"
                        title={JSON.stringify(entry.data, null, 2)}>
                        {JSON.stringify(entry.data).slice(0, 40)}…
                      </span>
                    )}
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>
        </div>
      )}
    </div>
  );
}
