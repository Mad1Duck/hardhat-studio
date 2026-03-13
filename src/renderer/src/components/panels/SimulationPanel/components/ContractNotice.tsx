import { useState } from 'react';
import { DeployedContract } from '../../../../types';
import { SimModule } from '../../../modules/Simulation/types';
import { cn } from '../../../../lib/utils';
import { ChevronDown, CheckCircle2, WifiOff, Wifi, Package } from 'lucide-react';
import { checkContractSupport } from '../lib/contractUtils';

interface Props {
  module: SimModule;
  deployedContracts: DeployedContract[];
}

export function ContractNotice({ module, deployedContracts }: Props) {
  const support = checkContractSupport(deployedContracts, module.requiredMethods);
  const [expanded, setExpanded] = useState(false);

  if (module.requiredMethods.length === 0) return null;

  if (support.supported) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
        <CheckCircle2 className="flex-shrink-0 w-3 h-3 text-emerald-400" />
        <span className="text-[10px] text-emerald-400">
          Contract connected — real transactions enabled
        </span>
        <Wifi className="w-3 h-3 ml-auto text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="overflow-hidden border rounded-lg border-amber-500/30 bg-amber-500/5">
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left">
        <WifiOff className="flex-shrink-0 w-3 h-3 text-amber-400" />
        <div className="flex-1 min-w-0">
          <span className="text-[10px] text-amber-400 font-medium">Running in simulation mode</span>
          <span className="text-[9px] text-amber-400/60 ml-1">
            ({support.missing.length} method{support.missing.length > 1 ? 's' : ''} missing)
          </span>
        </div>
        <ChevronDown
          className={cn('w-3 h-3 text-amber-400/60 transition-transform', expanded && 'rotate-180')}
        />
      </button>

      {expanded && (
        <div className="px-2.5 pb-2.5 space-y-2 border-t border-amber-500/20 pt-2">
          <div>
            <p className="text-[9px] text-amber-400/80 font-mono mb-1">Missing methods:</p>
            <div className="flex flex-wrap gap-1">
              {support.missing.map((m) => (
                <span
                  key={m}
                  className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  {m}()
                </span>
              ))}
            </div>
          </div>

          {module.suggestedContracts.length > 0 && (
            <div>
              <p className="text-[9px] text-amber-400/80 font-mono mb-1 flex items-center gap-1">
                <Package className="w-3 h-3" /> Deploy a compatible contract:
              </p>
              {module.suggestedContracts.map((sc, i) => (
                <div
                  key={i}
                  className="p-2 space-y-1 border rounded border-amber-500/15 bg-amber-500/5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-amber-300">{sc.interface}</span>
                    <span className="text-[9px] text-amber-400/50 font-mono">{sc.package}</span>
                  </div>
                  <code className="block text-[9px] text-amber-200/60 font-mono bg-black/20 px-1.5 py-0.5 rounded">
                    {sc.import}
                  </code>
                  <details className="text-[9px]">
                    <summary className="cursor-pointer select-none text-amber-400/60 hover:text-amber-400">
                      Show contract template
                    </summary>
                    <pre className="mt-1.5 text-[8.5px] text-amber-200/50 font-mono bg-black/30 p-2 rounded overflow-x-auto leading-relaxed whitespace-pre-wrap">
                      {sc.snippet}
                    </pre>
                  </details>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
