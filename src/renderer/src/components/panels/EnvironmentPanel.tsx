import { useState, useEffect, useCallback } from 'react'
import { EnvEntry } from '../../types'
import { Button } from '../ui/button'
import { Input, Label, ScrollArea } from '../ui/primitives'
import { Settings, Eye, EyeOff, Plus, Trash2, Save, RefreshCw } from 'lucide-react'
import { cn } from '../../lib/utils'

interface Props { projectPath: string }

export default function EnvironmentPanel({ projectPath }: Props) {
  const [entries, setEntries] = useState<EnvEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const raw = await window.api.readEnv(projectPath)
      setEntries((raw || []).map((e: {key: string; value: string}) => ({
        ...e, masked: e.key.toLowerCase().includes('key') || e.key.toLowerCase().includes('secret') || e.key.toLowerCase().includes('private')
      })))
    } finally { setLoading(false) }
  }, [projectPath])

  useEffect(() => { load() }, [load])

  const save = async () => {
    await window.api.writeEnv(projectPath, entries.map(e => ({ key: e.key, value: e.value })))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const add = () => setEntries(prev => [...prev, { key: '', value: '', masked: false }])
  const remove = (i: number) => setEntries(prev => prev.filter((_, j) => j !== i))
  const update = (i: number, field: keyof EnvEntry, value: string | boolean) =>
    setEntries(prev => prev.map((e, j) => j === i ? { ...e, [field]: value } : e))

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-semibold">Environment Manager</span>
          <span className="text-xs text-muted-foreground/50 font-mono">.env</span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={load} disabled={loading}>
            <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} /> Reload
          </Button>
          <Button size="sm" className="h-7 text-xs gap-1" onClick={save}>
            <Save className="w-3 h-3" /> {saved ? 'Saved!' : 'Save'}
          </Button>
        </div>
      </div>

      <div className="px-4 py-2 border-b border-border bg-card/50 flex items-center justify-between">
        <p className="text-xs text-muted-foreground/60">{entries.length} variables</p>
        <Button size="sm" variant="outline" className="h-6 text-xs gap-1" onClick={add}>
          <Plus className="w-3 h-3" /> Add Variable
        </Button>
      </div>

      <ScrollArea className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-2">
          {entries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground/30">
              <Settings className="w-8 h-8 mx-auto mb-2" />
              <p>No .env file found or empty</p>
              <Button className="mt-3" size="sm" onClick={add}><Plus className="w-3 h-3 mr-1" /> Add First Variable</Button>
            </div>
          ) : entries.map((entry, i) => (
            <div key={`row-${i}`} className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-card">
              <div className="flex-1 grid grid-cols-2 gap-2">
                <Input
                  value={entry.key}
                  onChange={e => update(i, 'key', e.target.value)}
                  placeholder="VARIABLE_NAME"
                  className="h-7 text-xs font-mono text-sky-400"
                />
                <div className="relative">
                  <Input
                    type={entry.masked ? 'password' : 'text'}
                    value={entry.value}
                    onChange={e => update(i, 'value', e.target.value)}
                    placeholder="value"
                    className={cn('h-7 text-xs font-mono pr-7', entry.masked && 'text-rose-400/70')}
                  />
                  <button
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground"
                    onClick={() => update(i, 'masked', !entry.masked)}
                  >
                    {entry.masked ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </button>
                </div>
              </div>
              <button onClick={() => remove(i)} className="text-muted-foreground/30 hover:text-rose-400 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="px-4 py-3 border-t border-border bg-card/50">
        <p className="text-[10px] text-muted-foreground/40">
          ⚠ Values marked with 🔒 are auto-masked. Never commit .env to git.
          Variables prefixed KEY, SECRET, PRIVATE are masked by default.
        </p>
      </div>
    </div>
  )
}
