import { SimulationPanelProps } from './types';
import { useSimulation } from './hooks/useSimulation';
import { ModuleSidebar } from './components/ModuleSidebar';
import { ParamsPanel } from './components/ParamsPanel';
import { PoolStateBar, EventLog, UserStatePanel } from './components/SimDisplay';

export default function SimulationPanel({
  abis,
  deployedContracts,
  rpcUrl,
  onTxRecorded,
}: SimulationPanelProps) {
  const sim = useSimulation({ abis, deployedContracts, rpcUrl, onTxRecorded });

  return (
    <div className="flex h-full overflow-hidden bg-background">
      {/* Module list */}
      <ModuleSidebar activeModuleId={sim.activeModuleId} onSelect={sim.setActiveModuleId} />

      {/* Params + run */}
      <ParamsPanel
        activeModule={sim.activeModule}
        enrichedContracts={sim.enrichedContracts}
        selectedSimContract={sim.selectedSimContract}
        selectedContractId={sim.selectedContractId}
        paramValues={sim.paramValues}
        users={sim.users}
        running={sim.running}
        canRun={sim.canRun}
        missingOnSelected={sim.missingOnSelected}
        getCompatibility={sim.getContractCompatibility}
        onSetParam={sim.setParam}
        onSetModuleContract={sim.setModuleContract}
        onRun={sim.runSim}
        onStop={sim.stop}
        onClear={() => sim.setEvents([])}
      />

      {/* Main display */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <PoolStateBar pool={sim.pool} />

        <div className="flex flex-1 min-w-0 overflow-hidden">
          <EventLog
            events={sim.events}
            running={sim.running}
            deployedContracts={deployedContracts}
            eventsEndRef={sim.eventsEndRef}
          />
          <UserStatePanel
            users={sim.users}
            enrichedContracts={sim.enrichedContracts}
            running={sim.running}
            onSyncBalances={sim.syncOnChainBalances}
          />
        </div>
      </div>
    </div>
  );
}
