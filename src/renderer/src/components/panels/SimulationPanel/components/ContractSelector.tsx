import { DeployedContract } from '../../../../types';
import { SimModule } from '../../../modules/Simulation/types';
import { cn } from '../../../../lib/utils';
import { ContractCompatibility } from '../types';

interface Props {
  enrichedContracts: DeployedContract[];
  activeModule: SimModule;
  selectedContractId: string;
  selectedSimContract: DeployedContract | null;
  running: boolean;
  getCompatibility: (dc: DeployedContract) => ContractCompatibility;
  onSelect: (moduleId: string, contractId: string) => void;
}

function CompatBadge({ compat }: { compat: ContractCompatibility }) {
  if (compat === 'full')
    return (
      <span className="text-[7px] px-1 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 flex-shrink-0">
        ✓ compatible
      </span>
    );
  if (compat === 'partial')
    return (
      <span className="text-[7px] px-1 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25 flex-shrink-0">
        ⚠ partial
      </span>
    );
  return (
    <span className="text-[7px] px-1 py-0.5 rounded-full bg-rose-500/10 text-rose-400/70 border border-rose-500/20 flex-shrink-0">
      ✗ none
    </span>
  );
}

export function ContractSelector({
  enrichedContracts,
  activeModule,
  selectedContractId,
  selectedSimContract,
  running,
  getCompatibility,
  onSelect,
}: Props) {
  if (enrichedContracts.length === 0) return null;

  const fullCount = enrichedContracts.filter((dc) => getCompatibility(dc) === 'full').length;

  return (
    <div className="overflow-hidden border rounded-lg border-violet-500/25 bg-violet-500/5">
      <div className="flex items-center justify-between px-2.5 py-1.5 bg-violet-500/10 border-b border-violet-500/15">
        <span className="text-[9px] font-semibold text-violet-300 uppercase tracking-widest">
          🎯 Select Contract
        </span>
        <span className="text-[8px] text-violet-400/50">{fullCount} compatible</span>
      </div>

      <div className="p-1.5 space-y-1">
        {enrichedContracts.map((c) => {
          const compat = getCompatibility(c);
          const isActive =
            selectedContractId === c.id ||
            (!selectedContractId && selectedSimContract?.id === c.id);
          const abiFns = c.abi
            .filter((i: any) => i.type === 'function')
            .map((i: any) => i.name as string);
          const matched = activeModule.requiredMethods.filter((m) => abiFns.includes(m));
          const missing = activeModule.requiredMethods.filter((m) => !abiFns.includes(m));

          return (
            <button
              key={c.id}
              disabled={running}
              onClick={() => onSelect(activeModule.id, isActive && selectedContractId ? '' : c.id)}
              className={cn(
                'w-full text-left px-2.5 py-2 rounded border text-[10px] transition-all',
                isActive
                  ? 'border-violet-500/50 bg-violet-500/20 text-violet-100'
                  : 'border-border/50 hover:border-violet-500/30 hover:bg-violet-500/5 text-foreground/70',
                running && 'opacity-40 cursor-not-allowed',
              )}>
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    'w-3 h-3 rounded-full border-2 flex-shrink-0 flex items-center justify-center',
                    isActive ? 'border-violet-400 bg-violet-400' : 'border-muted-foreground/30',
                  )}>
                  {isActive && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <span className="flex-1 font-semibold truncate">{c.name}</span>
                {activeModule.requiredMethods.length > 0 && <CompatBadge compat={compat} />}
                <span className="font-mono text-muted-foreground/30 text-[8px] flex-shrink-0">
                  {c.address.slice(0, 7)}…
                </span>
              </div>

              {activeModule.requiredMethods.length > 0 &&
                (matched.length > 0 || missing.length > 0) && (
                  <div className="flex flex-wrap gap-0.5 mt-1.5 pl-5">
                    {matched.slice(0, 6).map((m) => (
                      <span
                        key={m}
                        className="text-[7px] px-1 py-0.5 rounded bg-emerald-500/15 text-emerald-400/80 font-mono">
                        {m}()
                      </span>
                    ))}
                    {missing.slice(0, 4).map((m) => (
                      <span
                        key={m}
                        className="text-[7px] px-1 py-0.5 rounded bg-rose-500/10 text-rose-400/60 font-mono line-through">
                        {m}()
                      </span>
                    ))}
                  </div>
                )}

              {isActive && compat === 'none' && activeModule.requiredMethods.length > 0 && (
                <div className="mt-1.5 pl-5 text-[8px] text-amber-400/70 flex items-center gap-1">
                  ⚠ No required methods — will run in mock mode
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="px-2.5 py-1.5 border-t border-violet-500/10 text-[8px] text-violet-400/50 flex items-center gap-1">
        {selectedSimContract ? (
          <>
            ✓ <span className="font-semibold text-violet-300">{selectedSimContract.name}</span> will
            be used
          </>
        ) : (
          <>Auto-selecting first compatible contract</>
        )}
      </div>
    </div>
  );
}
