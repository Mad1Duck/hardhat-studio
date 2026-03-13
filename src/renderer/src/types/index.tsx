import { useAppState } from './hooks/useAppState';
import { useCollabCallbacks } from './hooks/useCollabCallbacks';
import { useNodeManager } from './hooks/useNodeManager';
import { Sidebar } from './components/Sidebar';
import { TabRenderer } from './components/TabRenderer';
import { CollabPanelWrapper } from './components/CollabPanelWrapper';

export default function App() {
  const state = useAppState();

  const collab = useCollabCallbacks({
    setCollabMode: state.setCollabMode,
    setDeployedContracts: state.setDeployedContracts,
    setAbis: state.setAbis,
    setRpcUrl: state.setRpcUrl,
    setTxHistory: state.setTxHistory,
  });

  const node = useNodeManager({
    projectPath: state.projectPath,
    rpcUrl: state.rpcUrl,
    setIsNodeRunning: state.setIsNodeRunning,
    setRpcUrl: state.setRpcUrl,
  });

  // ── Guest mode: no project loaded, show collab panel fullscreen ─────────────
  if (!state.projectPath && state.collabMode === 'guest') {
    return (
      <div className="flex h-screen overflow-hidden bg-background">
        <CollabPanelWrapper
          projectName=""
          deployedContracts={state.deployedContracts}
          abis={state.abis}
          rpcUrl={state.rpcUrl}
          txHistory={state.txHistory}
          isNodeRunning={state.isNodeRunning}
          onGuestJoin={collab.handleGuestJoin}
          onHostStart={collab.handleHostStart}
          onReceiveContracts={collab.handleReceiveContracts}
          onReceiveAbis={collab.handleReceiveAbis}
          onReceiveRpcUrl={collab.handleReceiveRpcUrl}
          onReceiveTxHistory={collab.handleReceiveTxHistory}
          onRunCollabNode={node.handleRunCollabNode}
          onEndCollabNode={node.handleEndCollabNode}
        />
      </div>
    );
  }

  // ── No project loaded, no collab: show project picker / landing ─────────────
  if (!state.projectPath) {
    return (
      <div className="flex h-screen overflow-hidden bg-background">
        {/* ProjectPicker or landing — use the collab panel to let users join */}
        <CollabPanelWrapper
          projectName=""
          deployedContracts={[]}
          abis={[]}
          rpcUrl={state.rpcUrl}
          txHistory={[]}
          isNodeRunning={false}
          onGuestJoin={collab.handleGuestJoin}
          onHostStart={collab.handleHostStart}
          onReceiveContracts={collab.handleReceiveContracts}
          onReceiveAbis={collab.handleReceiveAbis}
          onReceiveRpcUrl={collab.handleReceiveRpcUrl}
          onReceiveTxHistory={collab.handleReceiveTxHistory}
          onRunCollabNode={node.handleRunCollabNode}
          onEndCollabNode={node.handleEndCollabNode}
        />
      </div>
    );
  }

  // ── Main app layout ─────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        activeTab={state.activeTab}
        projectPath={state.projectPath}
        onTabChange={state.setActiveTab}
      />

      <main className="flex flex-1 min-w-0 overflow-hidden">
        {/* Collab panel — always mounted when host, hidden via CSS when not active tab */}
        {state.activeTab === 'collab' && (
          <CollabPanelWrapper
            projectName={state.projectInfo?.name ?? ''}
            deployedContracts={state.deployedContracts}
            abis={state.abis}
            rpcUrl={state.rpcUrl}
            txHistory={state.txHistory}
            isNodeRunning={state.isNodeRunning}
            onGuestJoin={collab.handleGuestJoin}
            onHostStart={collab.handleHostStart}
            onReceiveContracts={collab.handleReceiveContracts}
            onReceiveAbis={collab.handleReceiveAbis}
            onReceiveRpcUrl={collab.handleReceiveRpcUrl}
            onReceiveTxHistory={collab.handleReceiveTxHistory}
            onRunCollabNode={node.handleRunCollabNode}
            onEndCollabNode={node.handleEndCollabNode}
          />
        )}

        {state.activeTab !== 'collab' && (
          <TabRenderer
            activeTab={state.activeTab}
            projectPath={state.projectPath}
            projectInfo={state.projectInfo}
            deployedContracts={state.deployedContracts}
            abis={state.abis}
            rpcUrl={state.rpcUrl}
            txHistory={state.txHistory}
            selectedAbi={state.selectedAbi}
            onRemoveContract={state.removeDeployedContract}
            onInteractContract={(c) => state.openContractInteract(c, state.setActiveTab)}
            onContractDeployed={(c) =>
              state.setDeployedContracts((prev) => [...prev, c])
            }
            onAbiLoaded={(abi) =>
              state.setAbis((prev) => {
                const exists = prev.some((a) => a.path === abi.path);
                return exists ? prev.map((a) => (a.path === abi.path ? abi : a)) : [...prev, abi];
              })
            }
            onTxRecorded={state.recordTx}
            onRpcUrlChange={state.setRpcUrl}
            onSelectAbi={state.setSelectedAbi}
          />
        )}
      </main>
    </div>
  );
}
