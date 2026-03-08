import { useState, useCallback } from 'react'
import { SecurityFinding } from '../../types'
import { Button } from '../ui/button'
import { Input, Label, ScrollArea } from '../ui/primitives'
import { Shield, ShieldAlert, AlertTriangle, Info, Zap, RefreshCw, ChevronDown, ChevronRight, Settings, X } from 'lucide-react'
import { cn } from '../../lib/utils'

interface Props { projectPath: string }

const SEVERITY_CONFIG = {
  critical: { icon: ShieldAlert, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30', label: 'CRITICAL' },
  high: { icon: ShieldAlert, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', label: 'HIGH' },
  medium: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', label: 'MEDIUM' },
  low: { icon: Info, color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/30', label: 'LOW' },
  info: { icon: Info, color: 'text-muted-foreground', bg: 'bg-secondary', border: 'border-border', label: 'INFO' },
}

interface AnalysisSettings {
  checkReentrancy: boolean
  checkOverflow: boolean
  checkAccessControl: boolean
  checkUncheckedCalls: boolean
  checkSelfDestruct: boolean
  checkTxOrigin: boolean
  checkDelegateCall: boolean
  checkRandomness: boolean
  checkTimestamp: boolean
  minSeverity: 'info' | 'low' | 'medium' | 'high' | 'critical'
  maxFindings: number
  ignorePatterns: string
}

const DEFAULT_SETTINGS: AnalysisSettings = {
  checkReentrancy: true,
  checkOverflow: true,
  checkAccessControl: true,
  checkUncheckedCalls: true,
  checkSelfDestruct: true,
  checkTxOrigin: true,
  checkDelegateCall: true,
  checkRandomness: true,
  checkTimestamp: true,
  minSeverity: 'info',
  maxFindings: 100,
  ignorePatterns: '',
}

export default function SecurityPanel({ projectPath }: Props) {
  const [findings, setFindings] = useState<SecurityFinding[]>([])
  const [loading, setLoading] = useState(false)
  const [analyzed, setAnalyzed] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [filter, setFilter] = useState<string>('all')
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState<AnalysisSettings>(() => {
    try { return JSON.parse(localStorage.getItem('security_settings') || JSON.stringify(DEFAULT_SETTINGS)) }
    catch { return DEFAULT_SETTINGS }
  })

  const saveSettings = (s: AnalysisSettings) => {
    setSettings(s)
    try { localStorage.setItem('security_settings', JSON.stringify(s)) } catch {}
  }

  const setSetting = <K extends keyof AnalysisSettings>(key: K, val: AnalysisSettings[K]) => {
    saveSettings({ ...settings, [key]: val })
  }

  const analyze = useCallback(async () => {
    setLoading(true)
    try {
      const results = await window.api.analyzeSecurity(projectPath)
      // Apply settings filters
      const severityOrder = ['info','low','medium','high','critical']
      const minIdx = severityOrder.indexOf(settings.minSeverity)
      const ignoreList = settings.ignorePatterns.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
      const filtered = results
        .filter(f => severityOrder.indexOf(f.severity) >= minIdx)
        .filter(f => {
          if (!settings.checkReentrancy && f.title.toLowerCase().includes('reentr')) return false
          if (!settings.checkOverflow && (f.title.toLowerCase().includes('overflow') || f.title.toLowerCase().includes('underflow'))) return false
          if (!settings.checkAccessControl && f.title.toLowerCase().includes('access')) return false
          if (!settings.checkUncheckedCalls && f.title.toLowerCase().includes('unchecked')) return false
          if (!settings.checkSelfDestruct && f.title.toLowerCase().includes('selfdestruct')) return false
          if (!settings.checkTxOrigin && f.title.toLowerCase().includes('tx.origin')) return false
          if (!settings.checkDelegateCall && f.title.toLowerCase().includes('delegatecall')) return false
          if (!settings.checkRandomness && f.title.toLowerCase().includes('random')) return false
          if (!settings.checkTimestamp && f.title.toLowerCase().includes('timestamp')) return false
          if (ignoreList.some(p => f.title.toLowerCase().includes(p) || f.description.toLowerCase().includes(p))) return false
          return true
        })
        .slice(0, settings.maxFindings)
      setFindings(filtered)
      setAnalyzed(true)
    } catch {}
    setLoading(false)
  }, [projectPath, settings])

  const filtered = filter === 'all' ? findings : findings.filter(f => f.severity === filter)

  const counts = {
    critical: findings.filter(f => f.severity === 'critical').length,
    high: findings.filter(f => f.severity === 'high').length,
    medium: findings.filter(f => f.severity === 'medium').length,
    low: findings.filter(f => f.severity === 'low').length,
    info: findings.filter(f => f.severity === 'info').length,
  }

  const CHECK_ITEMS: Array<{ key: keyof AnalysisSettings; label: string }> = [
    { key: 'checkReentrancy', label: 'Reentrancy' },
    { key: 'checkOverflow', label: 'Overflow/Underflow' },
    { key: 'checkAccessControl', label: 'Access Control' },
    { key: 'checkUncheckedCalls', label: 'Unchecked Calls' },
    { key: 'checkSelfDestruct', label: 'Self Destruct' },
    { key: 'checkTxOrigin', label: 'tx.origin usage' },
    { key: 'checkDelegateCall', label: 'Delegatecall' },
    { key: 'checkRandomness', label: 'Weak Randomness' },
    { key: 'checkTimestamp', label: 'Timestamp Dep.' },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-rose-400"/>
          <span className="text-sm font-semibold">Security Analysis</span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
            onClick={() => setShowSettings(p => !p)}>
            <Settings className="w-3 h-3"/> Settings
          </Button>
          <Button size="sm" className="h-7 text-xs gap-1.5 bg-rose-600 hover:bg-rose-500"
            onClick={analyze} disabled={loading}>
            {loading ? <RefreshCw className="w-3 h-3 animate-spin"/> : <Zap className="w-3 h-3"/>}
            {loading ? 'Analyzing…' : 'Run Analysis'}
          </Button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="border-b border-border bg-card/50 px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold">Analysis Settings</span>
            <button onClick={() => setShowSettings(false)}><X className="w-3.5 h-3.5 text-muted-foreground/40 hover:text-muted-foreground"/></button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {CHECK_ITEMS.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={settings[key] as boolean}
                  onChange={e => setSetting(key, e.target.checked)}
                  className="rounded w-3 h-3"/>
                <span className="text-[11px] text-muted-foreground/70">{label}</span>
              </label>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-[10px] mb-1 block">Min Severity</Label>
              <select value={settings.minSeverity}
                onChange={e => setSetting('minSeverity', e.target.value as AnalysisSettings['minSeverity'])}
                className="w-full h-6 text-xs bg-background border border-border rounded px-2 outline-none">
                {['info','low','medium','high','critical'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-[10px] mb-1 block">Max Findings</Label>
              <Input value={settings.maxFindings} onChange={e => setSetting('maxFindings', parseInt(e.target.value)||100)}
                className="h-6 text-xs" type="number" min={1} max={500}/>
            </div>
            <div>
              <Label className="text-[10px] mb-1 block">Ignore (keywords, comma-sep)</Label>
              <Input value={settings.ignorePatterns} onChange={e => setSetting('ignorePatterns', e.target.value)}
                placeholder="e.g. test,mock" className="h-6 text-xs"/>
            </div>
          </div>
          <button onClick={() => saveSettings(DEFAULT_SETTINGS)}
            className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground">Reset to defaults</button>
        </div>
      )}

      {analyzed && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card/30 flex-wrap">
          {(['all', 'critical', 'high', 'medium', 'low', 'info'] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={cn('text-[10px] px-2 py-0.5 rounded border transition-colors capitalize',
                filter === s ? 'border-foreground/30 bg-accent text-foreground' : 'border-border text-muted-foreground/50 hover:border-muted-foreground/30')}>
              {s}{s !== 'all' && <span className="ml-1 font-mono">{counts[s] ?? 0}</span>}
            </button>
          ))}
          <span className="ml-auto text-[10px] text-muted-foreground/40">{filtered.length} findings</span>
        </div>
      )}

      <ScrollArea className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-2">
          {!analyzed ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground/30">
              <Shield className="w-12 h-12 opacity-20"/>
              <p className="text-sm">Click "Run Analysis" to scan your contracts</p>
              <div className="text-[11px] space-y-1 text-center text-muted-foreground/20">
                <p>Checks reentrancy, overflow, access control, unchecked calls,</p>
                <p>self-destruct, tx.origin, delegatecall, weak randomness, and more</p>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Shield className="w-10 h-10 text-emerald-400/40"/>
              <p className="text-sm text-emerald-400">No findings for selected filter</p>
            </div>
          ) : filtered.map((f, i) => {
            const cfg = SEVERITY_CONFIG[f.severity]
            const Icon = cfg.icon
            return (
              <div key={i} className={cn('rounded-lg border p-3', cfg.bg, cfg.border)}>
                <button className="w-full text-left flex items-start gap-2.5"
                  onClick={() => setExpanded(expanded === i ? null : i)}>
                  <Icon className={cn('w-3.5 h-3.5 mt-0.5 flex-shrink-0', cfg.color)}/>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn('text-[10px] font-bold', cfg.color)}>{cfg.label}</span>
                      <span className="text-xs font-semibold">{f.title}</span>
                      {f.function && <span className="text-[10px] font-mono text-muted-foreground/50">{f.function}</span>}
                    </div>
                    <p className="text-[11px] text-muted-foreground/70 mt-0.5 leading-relaxed">{f.description}</p>
                  </div>
                  {expanded === i ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/30 flex-shrink-0 mt-0.5"/> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 flex-shrink-0 mt-0.5"/>}
                </button>
                {expanded === i && (
                  <div className="mt-2 pl-6 space-y-1.5">
                    {f.line && <p className="text-[10px] text-muted-foreground/50">Line: {f.line}</p>}
                    <div className="rounded bg-muted/20 border border-border/50 p-2">
                      <p className="text-[10px] font-semibold text-muted-foreground/60 mb-0.5">Recommendation</p>
                      <p className="text-[11px] text-foreground/80 leading-relaxed">{f.recommendation}</p>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}
