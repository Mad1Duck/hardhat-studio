/**
 * UpdateChecker — shows update banner + install button
 * Works via electron-updater IPC from main process
 */
import { useState, useEffect } from 'react';
import { Download, RefreshCw, CheckCircle, X, ArrowUp } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

type UpdateState =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'available'; version: string; releaseNotes?: string }
  | { phase: 'downloading'; percent: number }
  | { phase: 'ready'; version: string }
  | { phase: 'up_to_date' }
  | { phase: 'error'; message: string };

export function UpdateChecker({ compact = false }: { compact?: boolean }) {
  const [update, setUpdate] = useState<UpdateState>({ phase: 'idle' });
  const [visible, setVisible] = useState(true);

  // Listen for update events from main process
  useEffect(() => {
    const unsubs: Array<() => void> = [];

    if (window.api?.onUpdateStatus) {
      const unsub = window.api.onUpdateStatus((event) => {
        switch (event.type) {
          case 'checking':
            setUpdate({ phase: 'checking' });
            setVisible(true);
            break;
          case 'available':
            setUpdate({
              phase: 'available',
              version: event?.version ?? '',
              releaseNotes: event?.releaseNotes,
            });
            setVisible(true);
            break;
          case 'not-available':
            setUpdate({ phase: 'up_to_date' });
            // Auto-hide "up to date" after 3s
            setTimeout(() => setUpdate({ phase: 'idle' }), 3000);
            break;
          case 'download-progress':
            setUpdate({ phase: 'downloading', percent: event?.percent ?? 0 });
            break;
          case 'downloaded':
            setUpdate({ phase: 'ready', version: event?.version ?? '' });
            setVisible(true);
            break;
          case 'error':
            setUpdate({ phase: 'error', message: event?.message ?? '' });
            break;
        }
      });
      unsubs.push(unsub);
    }

    return () => unsubs.forEach((fn) => fn());
  }, []);

  const checkNow = () => window.api?.checkForUpdate?.();
  const downloadUpdate = () => window.api?.downloadUpdate?.();
  const installNow = () => window.api?.installUpdate?.();

  if (!visible || update.phase === 'idle') {
    if (compact) {
      return (
        <button
          onClick={checkNow}
          className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          title="Check for updates">
          <RefreshCw className="w-3 h-3" />
          Check for updates
        </button>
      );
    }
    return null;
  }

  // Compact inline mode (for sidebar footer)
  if (compact) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] transition-all',
          update.phase === 'ready' && 'bg-orange-500/15 border-orange-500/30 text-orange-400',
          update.phase === 'available' && 'bg-blue-500/10 border-blue-500/20 text-blue-400',
          update.phase === 'downloading' && 'bg-accent border-border text-muted-foreground',
          update.phase === 'checking' && 'bg-accent border-border text-muted-foreground',
          update.phase === 'up_to_date' &&
            'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
          update.phase === 'error' && 'bg-red-500/10 border-red-500/20 text-red-400',
        )}>
        {update.phase === 'checking' && (
          <>
            <RefreshCw className="w-3 h-3 animate-spin" /> Checking…
          </>
        )}
        {update.phase === 'up_to_date' && (
          <>
            <CheckCircle className="w-3 h-3" /> Up to date
          </>
        )}
        {update.phase === 'available' && (
          <>
            <ArrowUp className="w-3 h-3" />
            <span className="flex-1">v{update.version} available</span>
            <button onClick={downloadUpdate} className="font-medium underline">
              Download
            </button>
          </>
        )}
        {update.phase === 'downloading' && (
          <>
            <Download className="w-3 h-3 animate-bounce" />
            <span className="flex-1">Downloading… {Math.round(update.percent)}%</span>
          </>
        )}
        {update.phase === 'ready' && (
          <>
            <Download className="w-3 h-3" />
            <span className="flex-1">Ready to install</span>
            <button onClick={installNow} className="font-medium underline">
              Restart
            </button>
          </>
        )}
        {update.phase === 'error' && (
          <>
            <X className="w-3 h-3" /> Update failed
          </>
        )}
      </div>
    );
  }

  // Full banner mode
  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-2 border-b text-xs',
        update.phase === 'ready' && 'bg-orange-500/10 border-orange-500/20 text-orange-300',
        update.phase === 'available' && 'bg-blue-500/10 border-blue-500/20 text-blue-300',
        (update.phase === 'downloading' || update.phase === 'checking') &&
          'bg-accent border-border text-muted-foreground',
        update.phase === 'up_to_date' && 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
        update.phase === 'error' && 'bg-red-500/10 border-red-500/20 text-red-300',
      )}>
      {update.phase === 'checking' && (
        <>
          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Checking for updates…
        </>
      )}

      {update.phase === 'up_to_date' && (
        <>
          <CheckCircle className="w-3.5 h-3.5" /> Hardhat Studio is up to date
        </>
      )}

      {update.phase === 'available' && (
        <>
          <ArrowUp className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="flex-1">
            Version <strong>v{update.version}</strong> is available
            {update.releaseNotes && (
              <span className="ml-2 text-muted-foreground">
                — {update.releaseNotes.slice(0, 60)}
              </span>
            )}
          </span>
          <Button
            size="sm"
            className="h-6 px-2 text-xs text-white bg-blue-500 border-0 hover:bg-blue-400"
            onClick={downloadUpdate}>
            <Download className="w-3 h-3 mr-1" /> Download
          </Button>
        </>
      )}

      {update.phase === 'downloading' && (
        <>
          <Download className="w-3.5 h-3.5 animate-bounce flex-shrink-0" />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span>Downloading update…</span>
              <span>{Math.round(update.percent)}%</span>
            </div>
            <div className="w-full h-1 overflow-hidden rounded-full bg-border">
              <div
                className="h-full transition-all duration-300 bg-orange-500 rounded-full"
                style={{ width: `${update.percent}%` }}
              />
            </div>
          </div>
        </>
      )}

      {update.phase === 'ready' && (
        <>
          <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="flex-1">
            <strong>v{update.version}</strong> downloaded — restart to install
          </span>
          <Button
            size="sm"
            className="h-6 px-2 text-xs text-white bg-orange-500 border-0 hover:bg-orange-400"
            onClick={installNow}>
            Restart & Install
          </Button>
        </>
      )}

      {update.phase === 'error' && (
        <>
          <X className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="flex-1">Update error: {update.message}</span>
          <button
            onClick={checkNow}
            className="text-xs underline text-muted-foreground hover:text-foreground">
            Retry
          </button>
        </>
      )}

      <button
        onClick={() => setVisible(false)}
        className="ml-2 transition-colors text-muted-foreground/50 hover:text-muted-foreground">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
