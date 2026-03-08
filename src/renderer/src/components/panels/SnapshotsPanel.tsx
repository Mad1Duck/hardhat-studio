import { useState, useEffect, useCallback } from 'react'
import { ChainSnapshot } from '../../types'
import { cn } from '../../lib/utils'
import {
  Camera, RotateCcw, Sword, Clock, CheckCircle2, XCircle,
  Trash2, GitFork, Activity, AlertTriangle, RefreshCw, Layers
} from 'lucide-react'
import { Button } from '../ui/button'
import { Input, Label } from '../ui/primitives'

const api = (window as any).api

interface Props {
  rpcUrl: string
  projectPath: string | null
}

export default function SnapshotsPanel({ rpcUrl, projectPath }: Props) {
  const [snapshots, setSnapshots] = useState<ChainSnapshot[]>([])
  const [label, setLabel] = useState('')
  const [blockNumber, setBlockNumber] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<{ msg: string; ok: boolean } | null>(null)
  const [mineCount, setMineCount] = useState('1')
  const [forkUrl, setForkUrl] = useState('https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY')
  const [forkBlock, setForkBlock] = useState('')

  const flash = (msg: string, ok = true) => {
    setStatus({ msg, ok })
    setTimeout(() => setStatus(null), 3000)
  }

  const refreshBlock = useCallback(async () => {
    const bn = await api.ethBlockNumber(rpcUrl)
    setBlockNumber(bn)
  }, [rpcUrl])

  useEffect(() => {
    refreshBlock()
    const t = setInterval(refreshBlock, 3000)
    return () => clearInterval(t)
  }, [refreshBlock])

  // Persist snapshots per project
  const storageKey = `snapshots:${projectPath || 'default'}`
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) setSnapshots(JSON.parse(saved))
    } catch {}
  }, [storageKey])

  const saveSnapshots = (list: ChainSnapshot[]) => {
    setSnapshots(list)
    try { localStorage.setItem(storageKey, JSON.stringify(list)) } catch {}
  }

  const takeSnapshot = async () => {
    setLoading(true)
    try {
      const result = await api.evmSnapshot(rpcUrl)
      if (!result.success) { flash(`Failed: ${result.error}`, false); return }
      const snap: ChainSnapshot = {
        id: crypto.randomUUID(),
        snapshotId: result.snapshotId,
        label: label.trim() || `Snapshot at block #${blockNumber}`,
        blockNumber,
        createdAt: Date.now(),
        rpcUrl,
      }
      saveSnapshots([snap, ...snapshots])
      setLabel('')
      flash(`✅ Snapshot saved: ${snap.label}`)
    } catch (e) { flash(`Error: ${e}`, false) }
    setLoading(false)
  }

  const revert = async (snap: ChainSnapshot) => {
    setLoading(true)
    try {
      const result = await api.evmRevert(rpcUrl, snap.snapshotId)
      if (!result.success) { flash(`Revert failed: ${result.error}`, false); return }
      flash(`↩ Reverted to "${snap.label}"`)
      // Remove this snapshot and all after it (snapshots are consumed on revert in Hardhat)
      const idx = snapshots.indexOf(snap)
      saveSnapshots(snapshots.slice(idx + 1))
      await refreshBlock()
    } catch (e) { flash(`Error: ${e}`, false) }
    setLoading(false)
  }

  const mine = async () => {
    const count = parseInt(mineCount) || 1
    setLoading(true)
    try {
      for (let i = 0; i < count; i++) await api.evmMine(rpcUrl)
      await refreshBlock()
      flash(`⛏ Mined ${count} block${count > 1 ? 's' : ''}`)
    } catch (e) { flash(`Error: ${e}`, false) }
    setLoading(false)
  }

  const deleteSnapshot = (id: string) => {
    saveSnapshots(snapshots.filter(s => s.id !== id))
  }

  const forkCommand = forkBlock
    ? `HARDHAT_FORK_URL="${forkUrl}" HARDHAT_FORK_BLOCK=${forkBlock} npx hardhat node`
    : `HARDHAT_FORK_URL="${forkUrl}" npx hardhat node`

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: Controls */}
      <div className="flex flex-col flex-shrink-0 overflow-hidden border-r w-72 border-border bg-card">
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-sky-400" />
            <span className="text-sm font-semibold">Chain Control</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Activity className="w-3 h-3 text-emerald-400" />
            <span className="text-[10px] font-mono text-muted-foreground/60">Block #{blockNumber.toLocaleString()}</span>
            <button onClick={refreshBlock} className="ml-auto text-muted-foreground/40 hover:text-muted-foreground">
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="flex-1 p-4 space-y-5 overflow-y-auto">
          {/* Snapshot */}
          <div>
            <p className="text-[9px] text-muted-foreground/50 uppercase tracking-widest mb-2">📸 Take Snapshot</p>
            <Label className="block mb-1 text-xs">Label (optional)</Label>
            <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Before deposit test" className="mb-2 text-xs h-7" />
            <Button className="w-full h-8 gap-2 text-xs bg-sky-600 hover:bg-sky-500" onClick={takeSnapshot} disabled={loading}>
              <Camera className="w-3.5 h-3.5" /> Take Snapshot
            </Button>
            <p className="text-[9px] text-muted-foreground/40 mt-1.5 leading-relaxed">
              Saves current EVM state. Revert anytime to this exact block.
            </p>
          </div>

          {/* Mine blocks */}
          <div>
            <p className="text-[9px] text-muted-foreground/50 uppercase tracking-widest mb-2">⛏ Mine Blocks</p>
            <div className="flex gap-2">
              <Input value={mineCount} onChange={e => setMineCount(e.target.value)} className="w-20 text-xs h-7" type="number" min="1" max="1000" />
              <Button variant="outline" className="flex-1 gap-1.5 h-7 text-xs" onClick={mine} disabled={loading}>
                <Sword className="w-3 h-3" /> Mine {mineCount} block{parseInt(mineCount) > 1 ? 's' : ''}
              </Button>
            </div>
            <p className="text-[9px] text-muted-foreground/40 mt-1.5">
              Useful for testing time-dependent logic (block.number, block.timestamp).
            </p>
          </div>

          {/* Fork */}
          <div>
            <p className="text-[9px] text-muted-foreground/50 uppercase tracking-widest mb-2">🔀 Fork Network</p>
            <Label className="block mb-1 text-xs">Fork RPC URL</Label>
            <Input value={forkUrl} onChange={e => setForkUrl(e.target.value)} className="mb-2 font-mono text-xs h-7" />
            <Label className="block mb-1 text-xs">Block Number (optional)</Label>
            <Input value={forkBlock} onChange={e => setForkBlock(e.target.value)} placeholder="latest" className="mb-2 text-xs h-7" />
            <div className="p-2 border rounded bg-muted/30 border-border">
              <p className="text-[9px] text-muted-foreground/40 mb-1 uppercase tracking-widest">Run in terminal:</p>
              <code className="text-[10px] text-amber-300/80 font-mono break-all leading-relaxed">{forkCommand}</code>
            </div>
            <p className="text-[9px] text-muted-foreground/40 mt-1.5 leading-relaxed">
              Fork is configured via hardhat.config.ts networks.hardhat.forking. Restart node after config change.
            </p>
          </div>
        </div>

        {/* Status bar */}
        {status && (
          <div className={cn('mx-3 mb-3 px-3 py-2 rounded text-xs flex items-center gap-2',
            status.ok ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-300 border border-rose-500/30')}>
            {status.ok ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" /> : <XCircle className="w-3.5 h-3.5 flex-shrink-0" />}
            {status.msg}
          </div>
        )}
      </div>

      {/* Right: Snapshots list */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex items-center justify-between flex-shrink-0 px-4 py-3 border-b border-border bg-card/50">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-sky-400" />
            <span className="text-sm font-semibold">Saved Snapshots</span>
            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{snapshots.length}</span>
          </div>
          {snapshots.length > 0 && (
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground/50 h-7" onClick={() => saveSnapshots([])}>
              Clear all
            </Button>
          )}
        </div>

        <div className="flex-1 p-4 overflow-y-auto">
          {snapshots.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground/30">
              <Camera className="w-12 h-12 opacity-20" />
              <p className="text-sm">No snapshots yet</p>
              <p className="text-xs text-center opacity-60">Take a snapshot before running tests or deploying<br/>to quickly revert to a known state</p>
            </div>
          ) : (
            <div className="space-y-2">
              {snapshots.map((snap, i) => (
                <div key={snap.id} className="p-3 transition-all border rounded-lg border-border bg-card hover:border-sky-500/30">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {i === 0 && <span className="text-[9px] bg-sky-500/20 text-sky-400 px-1.5 py-0.5 rounded border border-sky-500/30">latest</span>}
                        <span className="text-xs font-semibold truncate">{snap.label}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground/50 font-mono">
                        <span className="flex items-center gap-1"><Layers className="w-2.5 h-2.5" /> Block #{snap.blockNumber}</span>
                        <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{new Date(snap.createdAt).toLocaleTimeString()}</span>
                        <span className="truncate opacity-60">id: {snap.snapshotId}</span>
                      </div>
                    </div>
                    <div className="flex items-center flex-shrink-0 gap-1">
                      <Button size="sm" variant="outline" className="gap-1 text-xs h-7 border-sky-500/30 text-sky-400 hover:bg-sky-500/10"
                        onClick={() => revert(snap)} disabled={loading}>
                        <RotateCcw className="w-3 h-3" /> Revert
                      </Button>
                      <Button size="sm" variant="ghost" className="p-0 h-7 w-7 text-muted-foreground/40 hover:text-rose-400"
                        onClick={() => deleteSnapshot(snap.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  {i < snapshots.length - 1 && (
                    <div className="pt-2 mt-2 border-t border-border/50">
                      <div className="flex items-center gap-1 text-[9px] text-amber-400/60">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        Reverting will invalidate all snapshots taken after this one
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
