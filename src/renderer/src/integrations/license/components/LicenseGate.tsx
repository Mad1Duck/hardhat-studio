//
//  LicenseGate — renders children if plan ok, else shows upgrade prompt
//
import { useState, ReactNode } from 'react';
import { Droplets } from 'lucide-react';
import { useLicense, Feature, PLAN_META } from '@/integrations/license';
import { Button } from '../../../components/ui/button';
import { cn } from '@/lib/utils';
import { PlanIcon } from './ui/Primitives';
import { LicenseModal } from './LicenseModal';

export function LicenseGate({
  feature,
  children,
  compact = false,
}: {
  feature: Feature;
  children: ReactNode;
  compact?: boolean;
}) {
  const { can, currentPlan, planFor } = useLicense();
  const [showModal, setShowModal] = useState(false);

  if (can(feature)) return <>{children}</>;

  const required = planFor(feature);
  const meta = PLAN_META[required];

  return (
    <>
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-5 text-center select-none',
          compact ? 'p-6' : 'flex-1 p-12',
        )}>
        <div className="relative flex items-center justify-center w-20 h-20">
          <div
            className={cn(
              'absolute inset-0 rounded-full animate-ping opacity-20',
              required === 'pro' ? 'bg-violet-500' : 'bg-blue-500',
            )}
            style={{ animationDuration: '2.5s' }}
          />
          <div
            className={cn(
              'absolute inset-3 rounded-full border animate-pulse',
              required === 'pro'
                ? 'bg-violet-500/10 border-violet-500/25'
                : 'bg-blue-500/10 border-blue-500/25',
            )}
            style={{ animationDuration: '2s' }}
          />
          <PlanIcon plan={required} className="relative w-8 h-8" />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-center gap-1.5">
            <PlanIcon plan={required} className="w-3.5 h-3.5" />
            <p className={cn('text-sm font-semibold', meta.color)}>{meta.label} Feature</p>
          </div>
          <p className="text-xs text-muted-foreground max-w-[210px] leading-relaxed">
            {required === 'pro'
              ? `Upgrade ke Pro (stream ≥ $${PLAN_META.pro.price}/bln) untuk akses fitur ini.`
              : `Upgrade ke Basic (stream ≥ $${PLAN_META.basic.price}/bln) untuk akses fitur ini.`}
          </p>
          <p className="text-[10px] text-muted-foreground/50">
            Plan kamu sekarang:{' '}
            <span className={cn('font-semibold', PLAN_META[currentPlan].color)}>
              {PLAN_META[currentPlan].label}
            </span>
          </p>
        </div>

        <Button
          size="sm"
          className={cn(
            'gap-2 text-white border-0 shadow-lg transition-all hover:-translate-y-px',
            required === 'pro'
              ? 'bg-violet-600 hover:bg-violet-500 shadow-violet-500/25'
              : 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/25',
          )}
          onClick={() => setShowModal(true)}>
          <Droplets className="w-3.5 h-3.5" />
          Upgrade ke {meta.label}
        </Button>
      </div>

      {showModal && <LicenseModal onClose={() => setShowModal(false)} />}
    </>
  );
}
