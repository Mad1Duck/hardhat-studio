import { useState, useRef, useEffect, useCallback } from 'react'
import { CommandConfig, ProcessState, LogEntry } from '../../types'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { Input } from '../ui/primitives'
import { Play, Square, Trash2, PenLine, Lock, ChevronDown, Clock, AlertCircle } from 'lucide-react'

// Strip ANSI escape codes but keep some semantic meaning
function parseAnsi(text: string): string {
  return text.replace(/\x1B\[[0-9;]*[mGKH]/g, '')
    .replace(/\x1B\[[0-9;]*[A-Z]/g, '')
}

function classifyLine(line: string, type: string): string {
  const l = line.toLowerCase()
  if (type === 'system') return 'text-muted-foreground/60 italic'
  if (l.includes('error') || l.includes('✗') || l.includes('failed') || type === 'stderr') return 'text-rose-400'
  if (l.includes('warn')) return 'text-amber-400'
  if (l.includes('✓') || l.includes('success') || l.includes('compiled') || l.includes('deployed') || l.includes('started')) return 'text-emerald-400'
  if (line.startsWith('$')) return 'text-orange-400 font-semibold'
  if (l.includes('account') || l.includes('private key') || l.includes('balance')) return 'text-sky-400/90'
  if (l.match(/0x[a-fA-F0-9]{40}/)) return 'text-sky-300'
  return 'text-foreground/75'
}

interface Props {
  commands: CommandConfig[]
  processStates: Map<string, ProcessState>
  activeCommandId: string
  onRun: (id: string) => void
  onStop: (id: string) => void
  onClear: (id: string) => void
  onUpdateCommand: (id: string, updates: Partial<CommandConfig>) => void
  onCommandSelect: (id: string) => void
}

export default function CommandPanel({
  commands, processStates, activeCommandId,
  onRun, onStop, onClear, onUpdateCommand, onCommandSelect
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const [filterText, setFilterText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<HTMLDivElement>(null)

  const activeCmd = commands.find(c => c.id === activeCommandId)
  const state = processStates.get(activeCommandId) || { status: 'idle', logs: [] }
  const running = state.status === 'running'

  const filteredLogs = filterText
    ? state.logs.filter(l => l.data.toLowerCase().includes(filterText.toLowerCase()))
    : state.logs

  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [state.logs, autoScroll])

  const handleScroll = useCallback(() => {
    if (!termRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = termRef.current
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 60)
  }, [])

  const startEdit = (cmd: CommandConfig) => {
    if (running) return
    setEditingId(cmd.id)
    setEditValue(cmd.command)
  }

  const commitEdit = () => {
    if (editingId) {
      onUpdateCommand(editingId, { command: editValue })
      setEditingId(null)
    }
  }

  // Stats
  const errorCount = state.logs.filter(l => l.level === 'error').length
  const runtime = state.startedAt ? Math.floor((Date.now() - state.startedAt) / 1000) : 0

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Tab bar */}
      <div className="flex items-end gap-px px-2 h-10 bg-card border-b border-border overflow-x-auto flex-shrink-0">
        {commands.map(cmd => {
          const s = processStates.get(cmd.id)
          const isRun = s?.status === 'running'
          const isErr = s?.status === 'error'
          const isActive = cmd.id === activeCommandId
          return (
            <button
              key={cmd.id}
              onClick={() => onCommandSelect(cmd.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 h-8 text-xs font-medium whitespace-nowrap rounded-t transition-all border-b-2 relative',
                isActive
                  ? 'text-foreground bg-background border-orange-500'
                  : 'text-muted-foreground hover:text-foreground border-transparent hover:bg-accent/40'
              )}
            >
              {isRun && <span className="w-1.5 h-1.5 rounded-full animate-pulse-glow flex-shrink-0" style={{ background: cmd.color }} />}
              {isErr && <AlertCircle className="w-3 h-3 text-rose-400 flex-shrink-0" />}
              <span>{cmd.label}</span>
            </button>
          )
        })}
      </div>

      {/* Command config bar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-card border-b border-border flex-shrink-0">
        <span className="w-2 h-2 rounded-full flex-shrink-0 ring-1 ring-border/50" style={{ background: activeCmd?.color }} />

        {editingId === activeCommandId ? (
          <Input
            autoFocus
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingId(null) }}
            className="flex-1 h-7"
            placeholder="Enter command…"
          />
        ) : (
          <div
            className={cn(
              'flex-1 flex items-center gap-2 px-3 h-7 rounded-md border border-border font-mono text-xs',
              !running && 'cursor-pointer hover:border-border/70 hover:bg-accent/30 transition-colors',
              !activeCmd?.command && 'text-muted-foreground/50'
            )}
            onClick={() => !running && activeCmd && startEdit(activeCmd)}
          >
            <span className="text-orange-400 font-bold">$</span>
            <span className="flex-1 truncate text-foreground/80">
              {activeCmd?.command || 'Click to set command…'}
            </span>
            {!running && <PenLine className="w-3 h-3 text-muted-foreground/40 opacity-0 hover:opacity-100" />}
            {running && <Lock className="w-3 h-3 text-muted-foreground/40" />}
          </div>
        )}

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {running ? (
            <Button variant="destructive" size="sm" onClick={() => onStop(activeCommandId)} className="gap-1">
              <Square className="w-3 h-3" />Stop
            </Button>
          ) : (
            <Button
              size="sm"
              className="gap-1 font-bold"
              style={{ background: activeCmd?.color, color: '#000' }}
              onClick={() => onRun(activeCommandId)}
              disabled={!activeCmd?.command}
            >
              <Play className="w-3 h-3" />Run
            </Button>
          )}
          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => onClear(activeCommandId)}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-3 px-4 py-1.5 border-b border-border/50 bg-card/50 flex-shrink-0">
        <Input
          placeholder="Filter output…"
          value={filterText}
          onChange={e => setFilterText(e.target.value)}
          className="h-6 text-[11px] bg-transparent border-0 px-0 focus-visible:ring-0 font-mono w-48"
        />
        {filterText && (
          <span className="text-[10px] text-muted-foreground font-mono">
            {filteredLogs.length} / {state.logs.length} lines
          </span>
        )}
        <div className="ml-auto flex items-center gap-3 text-[10px] font-mono text-muted-foreground/50">
          {errorCount > 0 && <span className="text-rose-400">{errorCount} errors</span>}
          {running && state.startedAt && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{runtime}s</span>}
        </div>
      </div>

      {/* Terminal output */}
      <div
        ref={termRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-auto px-4 py-2 font-mono text-[11.5px] leading-[1.6]"
        style={{ background: 'hsl(222 24% 5%)' }}
      >
        {filteredLogs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div className="text-4xl opacity-10" style={{ color: activeCmd?.color }}>
              {activeCommandId === 'node' ? '⬡' : activeCommandId === 'compile' ? '◈' : '◆'}
            </div>
            <div className="text-sm font-semibold text-muted-foreground/50">{activeCmd?.label || 'Terminal'}</div>
            <div className="text-xs text-muted-foreground/30">{activeCmd?.description}</div>
            {activeCmd?.command && (
              <div className="mt-2 px-3 py-1.5 rounded bg-card border border-border text-muted-foreground/50 text-[11px]">
                $ {activeCmd.command}
              </div>
            )}
          </div>
        )}
        {filteredLogs.map(entry => {
          const lines = parseAnsi(entry.data).split('\n').filter(Boolean)
          return lines.map((line, i) => (
            <div key={`${entry.id}-${i}`} className={cn('whitespace-pre-wrap break-all', classifyLine(line, entry.type))}>
              {line}
            </div>
          ))
        })}
        <div ref={bottomRef} />
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-1 border-t border-border bg-card text-[10px] font-mono flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className={cn('flex items-center gap-1.5',
            running ? 'text-emerald-400' : state.status === 'error' ? 'text-rose-400' : 'text-muted-foreground/50'
          )}>
            <span className={cn('w-1.5 h-1.5 rounded-full', running ? 'status-running' : state.status === 'error' ? 'status-error' : 'status-idle')} />
            {running ? 'Running' : state.status === 'error' ? `Error: ${state.error?.slice(0, 40)}` : state.exitCode !== undefined ? `Exited (${state.exitCode})` : 'Idle'}
          </span>
        </div>
        <div className="flex items-center gap-3 text-muted-foreground/40">
          <span>{state.logs.length} lines</span>
          <button
            className={cn('flex items-center gap-1 transition-colors', autoScroll ? 'text-orange-400/70' : 'text-muted-foreground/40 hover:text-muted-foreground/70')}
            onClick={() => setAutoScroll(v => !v)}
          >
            <ChevronDown className="w-3 h-3" />auto-scroll
          </button>
        </div>
      </div>
    </div>
  )
}
