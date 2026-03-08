import { useState, useEffect, useRef, useCallback } from 'react'
import { Terminal, Trash2, Download, Play } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { LogEntry } from '../../types'

interface Props {
  projectPath: string
  allLogs: (LogEntry & { commandId: string; commandLabel: string })[]
  onExportLogs: (content: string, filename: string) => void
  onRunCommand: (cmd: string) => void
}

export default function TerminalPanel({ projectPath, allLogs, onExportLogs, onRunCommand }: Props) {
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [localOutput, setLocalOutput] = useState<{id: string; text: string; type: 'cmd' | 'out' | 'err' | 'sys'}[]>([
    { id: '0', text: '╔══════════════════════════════════════════════╗', type: 'sys' },
    { id: '1', text: '║    Hardhat Studio Terminal  v4.0             ║', type: 'sys' },
    { id: '2', text: '╚══════════════════════════════════════════════╝', type: 'sys' },
    { id: '3', text: `Project: ${projectPath}`, type: 'sys' },
    { id: '4', text: 'Type commands below. Use ↑/↓ for history.', type: 'sys' },
    { id: '5', text: '', type: 'sys' },
  ])
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const termId = useRef(`term-${Date.now()}`)

  // Mirror process output to terminal
  useEffect(() => {
    const recentLogs = allLogs.slice(-100)
    recentLogs.forEach(l => {
      setLocalOutput(prev => {
        if (prev.some(p => p.id === l.id)) return prev
        return [...prev, { id: l.id, text: l.data.trimEnd(), type: l.type === 'stderr' ? 'err' : 'out' }]
      })
    })
  }, [allLogs])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [localOutput])

  const handleSubmit = useCallback(async () => {
    const cmd = input.trim()
    if (!cmd) return
    const newId = crypto.randomUUID()
    setLocalOutput(prev => [...prev, { id: newId, text: `$ ${cmd}`, type: 'cmd' }])
    setHistory(prev => [cmd, ...prev.slice(0, 99)])
    setHistoryIndex(-1)
    setInput('')

    // Check for built-in commands
    if (cmd === 'clear') { setLocalOutput([]); return }
    if (cmd === 'pwd') { setLocalOutput(prev => [...prev, { id: crypto.randomUUID(), text: projectPath, type: 'out' }]); return }
    if (cmd === 'help') {
      setLocalOutput(prev => [...prev,
        { id: crypto.randomUUID(), text: 'Available: clear, pwd, help, ls, cat <file>', type: 'out' },
        { id: crypto.randomUUID(), text: 'All other commands run via node command panel.', type: 'out' },
      ])
      return
    }

    // Run via IPC
    try {
      const id = termId.current
      onRunCommand(cmd)
      setLocalOutput(prev => [...prev, { id: crypto.randomUUID(), text: `Running: ${cmd}`, type: 'sys' }])
    } catch (e) {
      setLocalOutput(prev => [...prev, { id: crypto.randomUUID(), text: `Error: ${String(e)}`, type: 'err' }])
    }
  }, [input, projectPath, onRunCommand])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { handleSubmit(); return }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const idx = Math.min(historyIndex + 1, history.length - 1)
      setHistoryIndex(idx)
      setInput(history[idx] || '')
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const idx = Math.max(historyIndex - 1, -1)
      setHistoryIndex(idx)
      setInput(idx === -1 ? '' : history[idx])
    }
  }

  const exportLogs = () => {
    const content = localOutput.map(l => l.text).join('\n')
    onExportLogs(content, `terminal-${Date.now()}.log`)
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0d14] font-mono" onClick={() => inputRef.current?.focus()}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-semibold text-foreground">Terminal</span>
          <span className="text-xs text-muted-foreground/60 font-mono">{projectPath.split('/').pop()}</span>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1" onClick={exportLogs}>
            <Download className="w-3 h-3" /> Export
          </Button>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1" onClick={() => setLocalOutput([])}>
            <Trash2 className="w-3 h-3" /> Clear
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-0.5 text-[12px] leading-relaxed">
        {localOutput.map(line => (
          <div key={line.id} className={cn(
            'whitespace-pre-wrap break-all',
            line.type === 'cmd' && 'text-cyan-300',
            line.type === 'out' && 'text-gray-300',
            line.type === 'err' && 'text-rose-400',
            line.type === 'sys' && 'text-emerald-500/80',
          )}>
            {line.text || '\u00A0'}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border px-4 py-2 flex items-center gap-2 bg-card/50">
        <span className="text-emerald-400 text-sm">$</span>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent text-sm text-foreground outline-none font-mono placeholder:text-muted-foreground/30"
          placeholder="Enter command..."
          autoFocus
          spellCheck={false}
        />
        <Button size="sm" variant="ghost" className="h-6 px-2" onClick={handleSubmit} disabled={!input.trim()}>
          <Play className="w-3 h-3 text-emerald-400" />
        </Button>
      </div>
    </div>
  )
}
