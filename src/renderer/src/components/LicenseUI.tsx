/**
 * License UI components:
 * - <LicenseGate feature="..."> — wraps any panel to show upgrade prompt
 * - <LicenseModal>             — activation / status modal
 * - <LicenseBadge>             — small badge shown in sidebar footer
 */
import { useState, ReactNode } from 'react'
import { Lock, Zap, CheckCircle, X, ExternalLink, Key, AlertCircle, Shield } from 'lucide-react'
import { useLicense, Feature, FEATURE_TIERS } from '../context/LicenseContext'
import { Button } from './ui/button'
import { cn } from '../lib/utils'

// ─── Feature Gate ─────────────────────────────────────────────────────────────
export function LicenseGate({
  feature,
  children,
  compact = false,
}: {
  feature: Feature
  children: ReactNode
  compact?: boolean
}) {
  const { can } = useLicense()
  const [showModal, setShowModal] = useState(false)

  if (can(feature)) return <>{children}</>

  return (
    <>
      <div className={cn(
        'flex flex-col items-center justify-center gap-4 text-center select-none',
        compact ? 'p-6' : 'flex-1 p-12',
      )}>
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20">
          <Lock className="w-7 h-7 text-orange-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Pro Feature</p>
          <p className="mt-1 text-xs text-muted-foreground max-w-[220px]">
            Activate your license to unlock this and all other Pro features.
          </p>
        </div>
        <Button
          size="sm"
          className="gap-2 bg-orange-500 hover:bg-orange-400 text-white border-0"
          onClick={() => setShowModal(true)}
        >
          <Zap className="w-3.5 h-3.5" />
          Activate License
        </Button>
      </div>

      {showModal && <LicenseModal onClose={() => setShowModal(false)} />}
    </>
  )
}

// ─── License Modal ────────────────────────────────────────────────────────────
export function LicenseModal({ onClose }: { onClose: () => void }) {
  const { status, licenseKey, email, expiresAt, isDev, activate, deactivate } = useLicense()
  const [key, setKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleActivate = async () => {
    setError(null)
    setLoading(true)
    const result = await activate(key)
    setLoading(false)
    if (result.success) {
      setSuccess(true)
      setTimeout(onClose, 1500)
    } else {
      setError(result.error ?? 'Activation failed')
    }
  }

  const isUnlocked = status === 'unlocked' || status === 'dev'

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md mx-4 bg-card border border-border rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-orange-500/15 border border-orange-500/25">
            {isUnlocked ? <CheckCircle className="w-4 h-4 text-orange-400" /> : <Key className="w-4 h-4 text-orange-400" />}
          </div>
          <div>
            <h2 className="text-sm font-semibold">
              {isUnlocked ? 'License Active' : 'Activate Pro'}
            </h2>
            <p className="text-[10px] text-muted-foreground">Hardhat Studio Pro</p>
          </div>
          <button onClick={onClose} className="ml-auto text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Dev mode */}
          {isDev && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
              <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Dev Mode Active</p>
                <p className="text-emerald-400/70 mt-0.5">All features unlocked via VITE_DEV_UNLOCK=true</p>
              </div>
            </div>
          )}

          {/* Already unlocked */}
          {status === 'unlocked' && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold mb-2">
                  <CheckCircle className="w-3.5 h-3.5" /> License Valid
                </div>
                {email && <p className="text-muted-foreground">Email: <span className="text-foreground">{email}</span></p>}
                {expiresAt && <p className="text-muted-foreground mt-1">Expires: <span className="text-foreground">{new Date(expiresAt).toLocaleDateString()}</span></p>}
                {licenseKey && <p className="text-muted-foreground mt-1 font-mono">{licenseKey.slice(0, 8)}••••••••{licenseKey.slice(-4)}</p>}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => { deactivate(); onClose() }}
              >
                Deactivate License
              </Button>
            </div>
          )}

          {/* Locked — show activation form */}
          {status === 'locked' && !success && (
            <>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  License Key
                </label>
                <input
                  type="text"
                  value={key}
                  onChange={e => setKey(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleActivate()}
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  className="w-full px-3 py-2 text-sm font-mono bg-background border border-border rounded-lg outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 placeholder:text-muted-foreground/40"
                  autoFocus
                />
                {error && (
                  <div className="flex items-center gap-1.5 text-xs text-red-400">
                    <AlertCircle className="w-3 h-3" /> {error}
                  </div>
                )}
              </div>

              <Button
                className="w-full gap-2 bg-orange-500 hover:bg-orange-400 text-white border-0"
                onClick={handleActivate}
                disabled={loading || !key.trim()}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Validating…
                  </span>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" /> Activate
                  </>
                )}
              </Button>

              <div className="pt-1 text-center">
                <p className="text-xs text-muted-foreground">Don't have a license?</p>
                <button
                  onClick={() => window.api?.openExternal?.('https://hardhatstudio.lemonsqueezy.com')}
                  className="mt-1 inline-flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300 transition-colors"
                >
                  Get Pro — $9/month <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </>
          )}

          {/* Success state */}
          {success && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/25">
                <CheckCircle className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-400">Activated!</p>
                <p className="text-xs text-muted-foreground mt-1">All Pro features are now unlocked.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Sidebar Badge ────────────────────────────────────────────────────────────
export function LicenseBadge({ onClick }: { onClick: () => void }) {
  const { status, isDev } = useLicense()

  if (status === 'loading') return null

  if (isDev || status === 'dev') {
    return (
      <button
        onClick={onClick}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 font-mono hover:bg-emerald-500/15 transition-colors w-full"
      >
        <Shield className="w-3 h-3" />
        DEV MODE — All Unlocked
      </button>
    )
  }

  if (status === 'unlocked') {
    return (
      <button
        onClick={onClick}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-[10px] text-orange-400 hover:bg-orange-500/15 transition-colors w-full"
      >
        <CheckCircle className="w-3 h-3" />
        <span className="flex-1 text-left">Pro Active</span>
        <span className="text-orange-400/50">Manage</span>
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border text-[10px] text-muted-foreground hover:border-orange-500/40 hover:text-orange-400 transition-colors w-full"
    >
      <Lock className="w-3 h-3" />
      <span className="flex-1 text-left">Free Plan</span>
      <span className="text-orange-400 font-medium">Upgrade →</span>
    </button>
  )
}
