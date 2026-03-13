import { DeployedContract } from '../../../../types';
import { SimModule, SimUser } from '../../../modules/Simulation/types';
import { ContractCompatibility } from '../types';
import { cn } from '../../../../lib/utils';
import { Play, Square, Trash2 } from 'lucide-react';
import { Button } from '../../../ui/button';
import { Input, Label, ScrollArea } from '../../../ui/primitives';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../ui/select';
import { ContractNotice } from './ContractNotice';
import { ContractSelector } from './ContractSelector';

interface Props {
  activeModule: SimModule;
  enrichedContracts: DeployedContract[];
  selectedSimContract: DeployedContract | null;
  selectedContractId: string;
  paramValues: Record<string, Record<string, string>>;
  users: SimUser[];
  running: boolean;
  canRun: boolean;
  missingOnSelected: string[];
  getCompatibility: (dc: DeployedContract) => ContractCompatibility;
  onSetParam: (moduleId: string, paramId: string, value: string) => void;
  onSetModuleContract: (moduleId: string, contractId: string) => void;
  onRun: () => void;
  onStop: () => void;
  onClear: () => void;
}

export function ParamsPanel({
  activeModule,
  enrichedContracts,
  selectedSimContract,
  selectedContractId,
  paramValues,
  users,
  running,
  canRun,
  missingOnSelected,
  getCompatibility,
  onSetParam,
  onSetModuleContract,
  onRun,
  onStop,
  onClear,
}: Props) {
  return (
    <div className="flex flex-col flex-shrink-0 overflow-hidden border-r w-60 border-border bg-card/30">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border bg-card/50">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-lg">{activeModule.icon}</span>
          <div>
            <div className="text-xs font-semibold">{activeModule.label}</div>
            <div className="text-[9px] text-muted-foreground/50">{activeModule.category}</div>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground/60 mt-1.5">{activeModule.longDesc}</p>
      </div>

      <ScrollArea className="flex-1 overflow-y-auto">
        <div className="p-3 space-y-2.5">
          {/* Contract selector */}
          <ContractSelector
            enrichedContracts={enrichedContracts}
            activeModule={activeModule}
            selectedContractId={selectedContractId}
            selectedSimContract={selectedSimContract}
            running={running}
            getCompatibility={getCompatibility}
            onSelect={onSetModuleContract}
          />

          {/* Contract status */}
          <ContractNotice module={activeModule} deployedContracts={enrichedContracts} />

          {/* Required ABI */}
          {activeModule.requiredMethods.length > 0 && (
            <div>
              <p className="text-[9px] text-muted-foreground/40 uppercase tracking-widest font-mono mb-1">
                Required ABI
              </p>
              <div className="flex flex-wrap gap-1">
                {activeModule.requiredMethods.map((m) => (
                  <span
                    key={m}
                    className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground/60">
                    {m}()
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Parameters */}
          <div className="pt-2 border-t border-border/50">
            <p className="text-[9px] text-muted-foreground/40 uppercase tracking-widest font-mono mb-2">
              Parameters
            </p>
            {activeModule.params.map((param) => (
              <div key={param.id} className="mb-2">
                <Label className="text-[10px] mb-1 block flex items-center gap-1">
                  {param.label}
                  {param.hint && (
                    <span className="font-normal text-muted-foreground/30">{param.hint}</span>
                  )}
                </Label>
                {param.type === 'select' ? (
                  <Select
                    value={paramValues[activeModule.id]?.[param.id] ?? param.default}
                    onValueChange={(v: any) => onSetParam(activeModule.id, param.id, v)}>
                    <SelectTrigger className="h-7 text-[10px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {param.options?.map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={paramValues[activeModule.id]?.[param.id] ?? param.default}
                    onChange={(e) => onSetParam(activeModule.id, param.id, e.target.value)}
                    className="h-7 text-[10px]"
                    type={param.type === 'number' ? 'number' : 'text'}
                    min={param.min}
                    max={param.max}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Users */}
          <div className="pt-2 border-t border-border/50">
            <p className="text-[9px] text-muted-foreground/40 uppercase tracking-widest font-mono mb-1.5">
              Users ({users.length})
            </p>
            <div className="space-y-1">
              {users.slice(0, 3).map((u, i) => (
                <div
                  key={u.id}
                  className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground/60">
                  <span className="w-3">{i + 1}.</span>
                  <span className="text-foreground/70">{u.label}</span>
                  <span className="ml-auto truncate">{u.address.slice(0, 8)}…</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Run / Stop */}
      <div className="p-3 border-t border-border space-y-1.5">
        {running ? (
          <Button
            variant="destructive"
            size="sm"
            className="w-full gap-1.5 h-8 text-xs"
            onClick={onStop}>
            <Square className="w-3 h-3" /> Stop
          </Button>
        ) : (
          <div className="space-y-1">
            <Button
              size="sm"
              disabled={!canRun}
              className={cn(
                'w-full gap-1.5 h-8 text-xs transition-all',
                canRun
                  ? 'bg-violet-600 hover:bg-violet-500'
                  : 'bg-muted cursor-not-allowed opacity-60 border border-rose-500/30',
              )}
              onClick={onRun}>
              <Play className="w-3 h-3" />
              Run {activeModule.label}
              {selectedSimContract && canRun && (
                <span className="ml-1 opacity-70 text-[9px] truncate max-w-[60px]">
                  · {selectedSimContract.name}
                </span>
              )}
            </Button>

            {!canRun && missingOnSelected.length > 0 && (
              <div className="rounded border border-rose-500/30 bg-rose-500/5 px-2 py-1.5 space-y-1">
                <p className="text-[9px] text-rose-400 font-semibold flex items-center gap-1">
                  ⛔ Cannot run — missing:
                </p>
                <div className="flex flex-wrap gap-0.5">
                  {missingOnSelected.map((m) => (
                    <span
                      key={m}
                      className="text-[8px] font-mono px-1 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/25 line-through">
                      {m}()
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          className="w-full text-[10px] gap-1 h-7"
          onClick={onClear}>
          <Trash2 className="w-3 h-3" /> Clear
        </Button>
      </div>
    </div>
  );
}
