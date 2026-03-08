import { useState } from 'react'
import { cn } from '../../lib/utils'
import { NavTab } from '../../types'
import { Pin, X } from 'lucide-react'
import { PINNABLE } from './PinnedPanel'

interface Props {
  pinnedTab: NavTab | null
  activeTab: NavTab
  onPin: (tab: NavTab | null) => void
}

export default function PinFloatingButton({ pinnedTab, activeTab, onPin }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="fixed right-4 bottom-6 z-50 flex flex-col items-end gap-2">
      {/* Popup menu */}
      {open && (
        <div className="bg-card border border-border rounded-xl shadow-2xl p-2 w-56 mb-1 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <p className="text-[9px] text-muted-foreground/40 uppercase tracking-widest px-2 py-1 mb-1">Pin a panel alongside</p>
          <div className="space-y-0.5">
            {PINNABLE.map(({ tab, label, icon: Icon, color }) => (
              <button
                key={tab}
                onClick={() => { onPin(pinnedTab === tab ? null : tab); setOpen(false) }}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-all text-left',
                  pinnedTab === tab
                    ? 'bg-blue-500/20 text-blue-300'
                    : 'hover:bg-accent/60 text-muted-foreground/80 hover:text-foreground'
                )}>
                <Icon className={cn('w-3.5 h-3.5', color)} />
                <span className="font-medium">{label}</span>
                {pinnedTab === tab && <Pin className="w-2.5 h-2.5 ml-auto text-blue-400"/>}
              </button>
            ))}
          </div>
          {pinnedTab && (
            <button onClick={() => { onPin(null); setOpen(false) }}
              className="w-full mt-1 flex items-center gap-2 px-2 py-1.5 rounded text-xs text-rose-400 hover:bg-rose-500/10 border-t border-border transition-all">
              <X className="w-3 h-3"/> Unpin panel
            </button>
          )}
        </div>
      )}

      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'w-11 h-11 rounded-full shadow-xl flex items-center justify-center transition-all',
          'border border-border/50',
          pinnedTab
            ? 'bg-blue-600 hover:bg-blue-500 text-white'
            : 'bg-card hover:bg-accent text-muted-foreground hover:text-foreground'
        )}
        title={pinnedTab ? 'Pinned panel active' : 'Pin a panel'}>
        {open
          ? <X className="w-4 h-4"/>
          : <Pin className={cn('w-4 h-4', pinnedTab ? 'text-white' : 'text-muted-foreground')}/>
        }
      </button>
    </div>
  )
}
