import { useState, useEffect, useCallback } from 'react'
import { GitBranch, GitCommit, GitStatus } from '../../types'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { Input, Label, ScrollArea } from '../ui/primitives'
import {
  GitBranch as GitBranchIcon, GitCommit as GitCommitIcon, RefreshCw,
  Plus, Upload, Download, File, Check, X, Eye, ChevronRight, Tag
} from 'lucide-react'

interface Props { projectPath: string }

export default function GitPanel({ projectPath }: Props) {
  const [status, setStatus] = useState<GitStatus | null>(null)
  const [branches, setBranches] = useState<GitBranch[]>([])
  const [commits, setCommits] = useState<GitCommit[]>([])
  const [diff, setDiff] = useState('')
  const [diffFile, setDiffFile] = useState('')
  const [loading, setLoading] = useState(false)
  const [commitMsg, setCommitMsg] = useState('')
  const [pushOnCommit, setPushOnCommit] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')
  const [activeSection, setActiveSection] = useState<'status' | 'branches' | 'history' | 'diff'>('status')
  const [committing, setCommitting] = useState(false)
  const [commitResult, setCommitResult] = useState<{success: boolean; error?: string} | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [s, b, c] = await Promise.all([
        window.api.gitStatus(projectPath),
        window.api.gitBranches(projectPath),
        window.api.gitLog(projectPath),
      ])
      setStatus(s)
      setBranches(b || [])
      setCommits(c || [])
    } finally {
      setLoading(false)
    }
  }, [projectPath])

  useEffect(() => { refresh() }, [refresh])

  const handleDiff = async (file?: string) => {
    setDiffFile(file || '')
    const d = await window.api.gitDiff(projectPath, file)
    setDiff(d)
    setActiveSection('diff')
  }

  const handleCommit = async () => {
    if (!commitMsg.trim()) return
    setCommitting(true); setCommitResult(null)
    const r = await window.api.gitCommit(projectPath, commitMsg, pushOnCommit)
    setCommitResult(r)
    if (r.success) { setCommitMsg(''); refresh() }
    setCommitting(false)
  }

  const handleCheckout = async (branch: string) => {
    await window.api.gitCheckout(projectPath, branch, false)
    refresh()
  }

  const handleNewBranch = async () => {
    if (!newBranchName.trim()) return
    await window.api.gitCheckout(projectPath, newBranchName, true)
    setNewBranchName('')
    refresh()
  }

  const handlePull = async () => {
    setLoading(true)
    await window.api.gitPull(projectPath)
    refresh()
  }

  if (!status) return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground/40">
      <div className="text-center">
        <GitBranchIcon className="w-10 h-10 mx-auto mb-3 opacity-20" />
        <p className="text-sm">{loading ? 'Loading git info…' : 'Not a git repository or git not found'}</p>
      </div>
    </div>
  )

  const totalChanges = status.staged.length + status.unstaged.length + status.untracked.length

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel */}
      <div className="w-64 flex-shrink-0 border-r border-border bg-card flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Git</p>
            <button onClick={refresh} className="text-muted-foreground/40 hover:text-muted-foreground transition-colors">
              <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <GitBranchIcon className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-sm font-semibold text-foreground">{status.branch}</span>
          </div>
          {status.remoteUrl && (
            <p className="text-[10px] font-mono text-muted-foreground/40 mt-1 truncate">{status.remoteUrl}</p>
          )}
          <div className="flex gap-2 mt-2 text-[10px] font-mono">
            {status.ahead > 0 && <span className="text-emerald-400">↑{status.ahead}</span>}
            {status.behind > 0 && <span className="text-amber-400">↓{status.behind}</span>}
            {totalChanges > 0 && <span className="text-sky-400">{totalChanges} changes</span>}
          </div>
        </div>

        <nav className="py-1 border-b border-border">
          {[
            { id: 'status' as const, icon: File, label: 'Changes', badge: totalChanges },
            { id: 'branches' as const, icon: GitBranchIcon, label: 'Branches', badge: branches.length },
            { id: 'history' as const, icon: GitCommitIcon, label: 'History', badge: commits.length },
            { id: 'diff' as const, icon: Eye, label: 'Diff' },
          ].map(({ id, icon: Icon, label, badge }) => (
            <button key={id} onClick={() => setActiveSection(id)}
              className={cn('flex items-center gap-2 w-full px-4 py-1.5 text-xs transition-all',
                activeSection === id ? 'text-foreground bg-accent' : 'text-muted-foreground hover:bg-accent/50')}>
              <Icon className="w-3.5 h-3.5" />
              <span className="flex-1 text-left">{label}</span>
              {badge ? <span className="text-[10px] font-mono px-1.5 rounded-full bg-orange-500/10 text-orange-400">{badge}</span> : null}
            </button>
          ))}
        </nav>

        {/* Commit form */}
        <div className="p-3 border-t border-border mt-auto space-y-2">
          <Label className="text-[10px] uppercase tracking-widest text-muted-foreground/60">Commit</Label>
          <textarea
            value={commitMsg}
            onChange={e => setCommitMsg(e.target.value)}
            placeholder="Commit message…"
            className="w-full h-16 text-xs bg-background border border-border rounded px-2 py-1.5 text-foreground placeholder:text-muted-foreground/30 resize-none outline-none focus:border-orange-500/50"
          />
          <div className="flex items-center gap-2">
            <input type="checkbox" id="push-check" checked={pushOnCommit} onChange={e => setPushOnCommit(e.target.checked)} className="w-3 h-3" />
            <label htmlFor="push-check" className="text-[11px] text-muted-foreground cursor-pointer">Push after commit</label>
          </div>
          <div className="flex gap-1">
            <Button size="sm" className="flex-1 h-7 text-xs" onClick={handleCommit} disabled={!commitMsg.trim() || committing}>
              {committing ? 'Committing…' : pushOnCommit ? 'Commit & Push' : 'Commit'}
            </Button>
            <Button size="sm" variant="outline" className="h-7 px-2" onClick={handlePull} disabled={loading}>
              <Download className="w-3 h-3" />
            </Button>
          </div>
          {commitResult && (
            <div className={cn('text-[11px] font-mono p-2 rounded',
              commitResult.success ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400')}>
              {commitResult.success ? '✓ Committed!' : commitResult.error}
            </div>
          )}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="p-4">
            {activeSection === 'status' && (
              <div className="space-y-4">
                {status.staged.length > 0 && (
                  <div>
                    <h3 className="text-[11px] font-semibold uppercase tracking-widest text-emerald-400/80 mb-2">Staged ({status.staged.length})</h3>
                    {status.staged.map(f => (
                      <div key={f} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-accent/50 group">
                        <Check className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                        <span className="text-xs font-mono text-foreground/80 flex-1">{f}</span>
                        <button onClick={() => handleDiff(f)} className="opacity-0 group-hover:opacity-100 text-[10px] text-sky-400 hover:text-sky-300">diff</button>
                      </div>
                    ))}
                  </div>
                )}
                {status.unstaged.length > 0 && (
                  <div>
                    <h3 className="text-[11px] font-semibold uppercase tracking-widest text-amber-400/80 mb-2">Modified ({status.unstaged.length})</h3>
                    {status.unstaged.map(f => (
                      <div key={f} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-accent/50 group">
                        <File className="w-3 h-3 text-amber-400 flex-shrink-0" />
                        <span className="text-xs font-mono text-foreground/80 flex-1">{f}</span>
                        <button onClick={() => handleDiff(f)} className="opacity-0 group-hover:opacity-100 text-[10px] text-sky-400">diff</button>
                      </div>
                    ))}
                  </div>
                )}
                {status.untracked.length > 0 && (
                  <div>
                    <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-2">Untracked ({status.untracked.length})</h3>
                    {status.untracked.map(f => (
                      <div key={f} className="flex items-center gap-2 py-1 px-2 rounded">
                        <Plus className="w-3 h-3 text-muted-foreground/40 flex-shrink-0" />
                        <span className="text-xs font-mono text-muted-foreground/60">{f}</span>
                      </div>
                    ))}
                  </div>
                )}
                {totalChanges === 0 && (
                  <div className="text-center py-8 text-muted-foreground/30">
                    <Check className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-sm">Working tree clean</p>
                  </div>
                )}
              </div>
            )}

            {activeSection === 'branches' && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input value={newBranchName} onChange={e => setNewBranchName(e.target.value)} placeholder="New branch name…" className="flex-1 h-7 text-xs" />
                  <Button size="sm" className="h-7 px-3 text-xs" onClick={handleNewBranch} disabled={!newBranchName.trim()}>
                    <Plus className="w-3 h-3 mr-1" /> Create
                  </Button>
                </div>
                <div className="space-y-1">
                  {branches.filter(b => !b.name.startsWith('remotes/')).map(b => (
                    <div key={b.name} className={cn('flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-all',
                      b.current ? 'bg-orange-500/10 border border-orange-500/20' : 'hover:bg-accent/50')}>
                      <GitBranchIcon className={cn('w-3.5 h-3.5', b.current ? 'text-orange-400' : 'text-muted-foreground/60')} />
                      <span className={cn('text-xs font-mono flex-1', b.current ? 'text-orange-300 font-semibold' : 'text-foreground/70')}>{b.name}</span>
                      {b.current && <span className="text-[10px] text-orange-400/60 font-mono">current</span>}
                      {!b.current && (
                        <button onClick={() => handleCheckout(b.name)} className="text-[10px] text-sky-400 hover:text-sky-300">checkout</button>
                      )}
                    </div>
                  ))}
                </div>
                {branches.filter(b => b.name.startsWith('remotes/')).length > 0 && (
                  <div>
                    <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-2">Remote</h3>
                    {branches.filter(b => b.name.startsWith('remotes/')).map(b => (
                      <div key={b.name} className="flex items-center gap-2 px-3 py-1.5">
                        <Tag className="w-3 h-3 text-muted-foreground/40" />
                        <span className="text-xs font-mono text-muted-foreground/60">{b.name.replace('remotes/origin/', '')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeSection === 'history' && (
              <div className="space-y-1">
                {commits.map(c => (
                  <div key={c.hash} className="flex items-start gap-3 px-3 py-2.5 rounded-md hover:bg-accent/50 group cursor-default">
                    <div className="w-6 h-6 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <GitCommitIcon className="w-3 h-3 text-orange-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground/90 leading-relaxed">{c.message}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-mono text-orange-400/70">{c.shortHash}</span>
                        <span className="text-[10px] text-muted-foreground/40">{c.author}</span>
                        <span className="text-[10px] text-muted-foreground/30">{c.date}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeSection === 'diff' && (
              <div>
                {diffFile && <p className="text-xs font-mono text-sky-400 mb-3">{diffFile}</p>}
                <Button size="sm" variant="outline" className="mb-3 h-7 text-xs" onClick={() => handleDiff()}>
                  <Eye className="w-3 h-3 mr-1" /> Full Diff
                </Button>
                {diff ? (
                  <pre className="text-[11px] font-mono whitespace-pre-wrap leading-relaxed">
                    {diff.split('\n').map((line, i) => (
                      <span key={`row-${i}`} className={cn('block',
                        line.startsWith('+') && !line.startsWith('+++') ? 'text-emerald-400 bg-emerald-500/5' : '',
                        line.startsWith('-') && !line.startsWith('---') ? 'text-rose-400 bg-rose-500/5' : '',
                        line.startsWith('@@') ? 'text-sky-400/70' : '',
                        !line.startsWith('+') && !line.startsWith('-') && !line.startsWith('@@') ? 'text-muted-foreground/60' : ''
                      )}>{line || '\u00A0'}</span>
                    ))}
                  </pre>
                ) : (
                  <p className="text-muted-foreground/40 text-sm">Select a file to diff or click Full Diff</p>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
