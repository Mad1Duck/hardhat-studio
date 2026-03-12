//
//  LicenseBadge — sidebar footer badge + hover tooltip
//
import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Crown, Star, Zap, Wallet, Shield, Activity, TrendingUp, RefreshCw } from 'lucide-react';
import {
  useLicense,
  PLAN_META,
  PLAN_MIN_DEPOSIT,
  RECIPIENT_ADDRESS,
  Plan,
  Status,
  ActiveStream,
} from '@/integrations/license';
import { cn } from '@/lib/utils';
import { useTokenPrice } from '../hooks/useTokenPrice';
import { PLAN_ACCENT, fmt } from '../config/constants';
import { LicenseModal } from './LicenseModal';
import { useEffect } from 'react';

//  StreamInfoTooltip (portal, bypasses sidebar overflow:hidden)
function StreamInfoTooltip({
  style,
  status,
  currentPlan,
  activeStream,
  walletAddress,
  chainName,
  chainId,
  isDev,
  onPause,
  onResume,
  streamActionPending,
}: {
  style: React.CSSProperties;
  status: Status;
  currentPlan: Plan;
  activeStream?: ActiveStream;
  walletAddress?: string;
  chainName?: string;
  chainId?: number;
  isDev: boolean;
  onPause: () => Promise<void>;
  onResume: () => Promise<void>;
  streamActionPending: boolean;
}) {
  const [localAction, setLocalAction] = useState<'pause' | 'resume' | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const { price: tokenPrice, loading: priceLoading } = useTokenPrice(activeStream?.tokenSymbol);
  const [now, setNow] = useState(() => Date.now() / 1000);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() / 1000), 1000);
    return () => clearInterval(id);
  }, []);

  const accent = PLAN_ACCENT[currentPlan];

  let ratePerSec = 0,
    ratePerMin = 0,
    ratePerHour = 0,
    ratePerDay = 0,
    ratePerMonth = 0;
  let totalStreamedTokens = 0,
    usdPerDay: number | null = null,
    usdPerMonth: number | null = null,
    usdTotal: number | null = null;

  if (activeStream) {
    const dec = activeStream.tokenDecimals;
    ratePerSec = Number(activeStream.ratePerSecond) / 10 ** dec;
    ratePerMin = ratePerSec * 60;
    ratePerHour = ratePerSec * 3600;
    ratePerDay = ratePerSec * 86400;
    ratePerMonth = ratePerSec * 86400 * 30;
    const withdrawn = Number(activeStream.withdrawnAmount) / 10 ** dec;
    totalStreamedTokens =
      withdrawn + ratePerSec * Math.max(0, now - activeStream.lastAdjustmentTime);
    if (tokenPrice != null) {
      usdPerDay = ratePerDay * tokenPrice;
      usdPerMonth = ratePerMonth * tokenPrice;
      usdTotal = totalStreamedTokens * tokenPrice;
    }
  }

  const fmtUsd = fmt.usdNum;
  const fmtTok = fmt.token;

  return (
    <div
      data-tooltip-root
      style={{
        ...style,
        background: 'hsl(var(--card, 222 47% 11%))',
        border: `1px solid ${accent.border}`,
        borderRadius: 14,
        overflow: 'hidden',
        fontFamily: 'inherit',
        boxShadow: '0 20px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04)',
      }}>
      <div
        style={{
          height: 2,
          background: `linear-gradient(90deg, transparent, ${accent.gradient}, transparent)`,
        }}
      />

      {/* Header */}
      <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 4,
          }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: accent.color,
                boxShadow: `0 0 6px ${accent.color}`,
              }}
            />
            <span style={{ fontSize: 10, fontWeight: 700, color: accent.color }}>
              {isDev ? 'Dev Mode' : `${PLAN_META[currentPlan].label} Plan`}
            </span>
          </div>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>
            {chainName ?? `Chain ${chainId}`}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>
            {walletAddress ? fmt.addr(walletAddress) : '—'}
          </span>
          {activeStream && (
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>
              {activeStream.tokenSymbol}
              {tokenPrice != null && (
                <span style={{ color: '#6ee7b7', marginLeft: 4 }}>
                  @ ${tokenPrice.toLocaleString('en-US', { maximumFractionDigits: 4 })}
                </span>
              )}
              {priceLoading && (
                <span style={{ color: 'rgba(255,255,255,0.2)', marginLeft: 4 }}>…</span>
              )}
            </span>
          )}
        </div>
      </div>

      {activeStream ? (
        <>
          {/* Rate rows */}
          <div style={{ padding: '8px 12px 6px' }}>
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: 'rgba(255,255,255,0.3)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 6,
              }}>
              ⚡ Rate Transfer
            </div>
            {[
              {
                label: 'Per second',
                tok: ratePerSec,
                usd: tokenPrice != null ? ratePerSec * tokenPrice : null,
              },
              {
                label: 'Per minute',
                tok: ratePerMin,
                usd: tokenPrice != null ? ratePerMin * tokenPrice : null,
              },
              {
                label: 'Per hour',
                tok: ratePerHour,
                usd: tokenPrice != null ? ratePerHour * tokenPrice : null,
              },
              {
                label: 'Per day',
                tok: ratePerDay,
                usd: usdPerDay,
              },
              {
                label: 'Per month',
                tok: ratePerMonth,
                usd: usdPerMonth,
              },
            ].map(({ label, tok, usd }) => (
              <div
                key={label}
                style={{ display: 'flex', alignItems: 'center', padding: '2px 0', gap: 4 }}>
                <span
                  style={{
                    fontSize: 9,
                    color: 'rgba(255,255,255,0.35)',
                    width: 58,
                    flexShrink: 0,
                  }}>
                  {label}
                </span>
                <span
                  style={{
                    fontSize: 9,
                    fontFamily: 'monospace',
                    color: 'rgba(255,255,255,0.65)',
                    flex: 1,
                    textAlign: 'right',
                  }}>
                  {fmtTok(tok, activeStream.tokenSymbol)}
                </span>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    color: usd != null ? '#6ee7b7' : 'rgba(255,255,255,0.2)',
                    width: 62,
                    textAlign: 'right',
                    fontFamily: 'monospace',
                  }}>
                  {usd != null ? fmtUsd(usd) : '—'}
                </span>
              </div>
            ))}
          </div>

          <div style={{ margin: '0 12px', height: 1, background: 'rgba(255,255,255,0.06)' }} />

          {/* Total streamed */}
          <div style={{ padding: '8px 12px 10px' }}>
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: 'rgba(255,255,255,0.3)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 6,
              }}>
              📈 TOTAL SENT (Live)
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                marginBottom: 6,
              }}>
              <div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: 'white',
                    fontFamily: 'monospace',
                  }}>
                  {fmtTok(totalStreamedTokens, activeStream.tokenSymbol)}
                </div>
                {usdTotal != null && (
                  <div style={{ fontSize: 11, fontWeight: 600, color: accent.color, marginTop: 1 }}>
                    ≈ {fmtUsd(usdTotal)}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)' }}>ke</div>
                <div
                  style={{ fontSize: 8, fontFamily: 'monospace', color: 'rgba(255,255,255,0.3)' }}>
                  {fmt.addr(RECIPIENT_ADDRESS)}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div
                style={{
                  flex: 1,
                  height: 3,
                  borderRadius: 99,
                  background: 'rgba(255,255,255,0.08)',
                  overflow: 'hidden',
                }}>
                <div
                  style={{
                    height: '100%',
                    borderRadius: 99,
                    background: `linear-gradient(90deg, ${accent.color}, ${accent.gradient})`,
                    width: '100%',
                    opacity: 0.7,
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: 8,
                  color: activeStream?.paused ? '#f59e0b' : '#6ee7b7',
                  flexShrink: 0,
                }}>
                {activeStream?.paused ? '⏸ paused' : '● streaming…'}
              </span>
            </div>

            {/* Pause/Resume */}
            <div style={{ marginTop: 8, display: 'flex', gap: 6, pointerEvents: 'all' }}>
              {activeStream?.paused ? (
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    setLocalAction('resume');
                    setLocalError(null);
                    try {
                      await onResume();
                    } catch (err: any) {
                      setLocalError(err.message);
                    } finally {
                      setLocalAction(null);
                    }
                  }}
                  disabled={!!localAction || streamActionPending}
                  style={{
                    flex: 1,
                    padding: '5px 10px',
                    borderRadius: 7,
                    border: '1px solid rgba(110,231,183,0.35)',
                    background: 'rgba(110,231,183,0.1)',
                    color: '#6ee7b7',
                    fontSize: 9,
                    fontWeight: 700,
                    cursor: 'pointer',
                    opacity: !!localAction || streamActionPending ? 0.5 : 1,
                  }}>
                  {localAction === 'resume' ? '↻ Resuming…' : '▶ Resume Stream'}
                </button>
              ) : (
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    setLocalAction('pause');
                    setLocalError(null);
                    try {
                      await onPause();
                    } catch (err: any) {
                      setLocalError(err.message);
                    } finally {
                      setLocalAction(null);
                    }
                  }}
                  disabled={!!localAction || streamActionPending}
                  style={{
                    flex: 1,
                    padding: '5px 10px',
                    borderRadius: 7,
                    border: '1px solid rgba(245,158,11,0.35)',
                    background: 'rgba(245,158,11,0.08)',
                    color: '#f59e0b',
                    fontSize: 9,
                    fontWeight: 700,
                    cursor: 'pointer',
                    opacity: !!localAction || streamActionPending ? 0.5 : 1,
                  }}>
                  {localAction === 'pause' ? '↻ Pausing…' : '⏸ Pause Stream'}
                </button>
              )}
            </div>
            {localError && (
              <div
                style={{
                  marginTop: 4,
                  fontSize: 8,
                  color: '#f87171',
                  wordBreak: 'break-all',
                  padding: '4px 6px',
                  borderRadius: 5,
                  background: 'rgba(248,113,113,0.1)',
                }}>
                ⚠ {localError}
              </div>
            )}
          </div>

          {/* Threshold row */}
          <div
            style={{
              margin: '0 12px 10px',
              padding: '6px 10px',
              borderRadius: 8,
              background: accent.bg,
              border: `1px solid ${accent.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>
              {PLAN_META[currentPlan].label} threshold
            </span>
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: accent.color,
                fontFamily: 'monospace',
              }}>
              ≥ ${PLAN_MIN_DEPOSIT[currentPlan === 'pro' ? 'pro' : 'basic']}/month
            </span>
            {usdPerMonth != null && (
              <span
                style={{ fontSize: 9, fontWeight: 700, color: '#6ee7b7', fontFamily: 'monospace' }}>
                ↑ {fmtUsd(usdPerMonth)}/month ✓
              </span>
            )}
          </div>
        </>
      ) : (
        <div style={{ padding: 12 }}>
          <div
            style={{
              padding: 10,
              borderRadius: 8,
              background: accent.bg,
              border: `1px solid ${accent.border}`,
              marginBottom: 8,
            }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: accent.color, marginBottom: 4 }}>
              {isDev ? '🛡️ Dev Mode — All feature unlocked' : '🧪 Testnet bypass activate'}
            </div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
              Stream check is skipped for production, create Sablier stream to recipient address.
            </div>
          </div>
          <div
            style={{
              fontSize: 9,
              color: 'rgba(255,255,255,0.3)',
              fontFamily: 'monospace',
              wordBreak: 'break-all',
            }}>
            Recipient: {RECIPIENT_ADDRESS}
          </div>
        </div>
      )}
    </div>
  );
}

//  LicenseBadge
export function LicenseBadge({ onClick }: { onClick?: () => void }) {
  const {
    status,
    currentPlan,
    activeStream,
    walletAddress,
    chainName,
    chainId,
    isDev,
    pauseStream,
    resumeStream,
    streamActionPending,
  } = useLicense();
  const [showModal, setShowModal] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const badgeRef = useRef<HTMLDivElement>(null);

  const hasPaidPlan = status === 'basic' || status === 'pro' || isDev || status === 'dev';

  const updatePos = () => {
    if (!badgeRef.current) return;
    const rect = badgeRef.current.getBoundingClientRect();
    const W = 292;
    setTooltipStyle({
      position: 'fixed',
      bottom: window.innerHeight - rect.top + 10,
      left: Math.max(8, rect.left - W + rect.width),
      width: W,
      zIndex: 99999,
    });
  };

  const cfg =
    isDev || status === 'dev'
      ? {
          icon: <Shield className="w-3 h-3" />,
          text: 'Dev Mode',
          cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        }
      : status === 'pro'
        ? {
            icon: <Crown className="w-3 h-3" />,
            text: 'Pro Active',
            cls: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
          }
        : status === 'basic'
          ? {
              icon: <Star className="w-3 h-3" />,
              text: 'Basic Active',
              cls: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
            }
          : status === 'loading'
            ? {
                icon: <Activity className="w-3 h-3 animate-pulse" />,
                text: 'Checking…',
                cls: 'text-muted-foreground bg-muted/30 border-border/40',
              }
            : status === 'no_wallet'
              ? {
                  icon: <Wallet className="w-3 h-3" />,
                  text: 'Connect Wallet',
                  cls: 'text-muted-foreground bg-muted/30 border-border/40 hover:border-violet-500/40 hover:text-violet-400',
                }
              : {
                  icon: <Zap className="w-3 h-3" />,
                  text: 'Free · Upgrade →',
                  cls: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
                };

  const showTooltip = hovered && hasPaidPlan && !!walletAddress;

  return (
    <div
      ref={badgeRef}
      onMouseEnter={() => {
        updatePos();
        setHovered(true);
      }}
      onMouseLeave={(e) => {
        const rel = e.relatedTarget as HTMLElement | null;
        if (rel?.closest?.('[data-tooltip-root]')) return;
        setHovered(false);
      }}>
      {showTooltip &&
        createPortal(
          <StreamInfoTooltip
            style={tooltipStyle}
            status={status}
            currentPlan={currentPlan}
            activeStream={activeStream}
            walletAddress={walletAddress}
            chainName={chainName}
            chainId={chainId}
            isDev={isDev}
            onPause={pauseStream}
            onResume={resumeStream}
            streamActionPending={streamActionPending}
          />,
          document.body,
        )}
      <button
        onClick={() => {
          onClick?.();
          setShowModal(true);
        }}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-medium transition-all w-full',
          cfg.cls,
          hasPaidPlan && 'hover:brightness-110',
        )}>
        {cfg.icon}
        <span className="flex-1 text-left">{cfg.text}</span>
        {hasPaidPlan && <TrendingUp className="w-2.5 h-2.5 opacity-40" />}
      </button>
      {showModal && <LicenseModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
