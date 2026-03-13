import { useState, useCallback, useRef } from 'react';
import type { Scenario, Step, StepStatus, RunLog, ActionType } from '../types';
import type { DeployedContract, HardhatAccount, TxRecord } from '../../../../types';
import { makeStep } from '../lib/makeStep';
import { buildBatches } from '../lib/buildBatches';
import { runStep } from '../lib/runStep';

const STORAGE_KEY = 'hhs_scenarios';

function loadFromStorage(): Scenario[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

function saveToStorage(list: Scenario[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { }
}

export function useScenario(
  deployedContracts: DeployedContract[],
  rpcUrl: string,
  onTxRecorded: (tx: TxRecord) => void,
) {
  const [scenarios, setScenarios] = useState<Scenario[]>(loadFromStorage);
  const [active, setActive] = useState<Scenario | null>(null);
  const [runLogs, setRunLogs] = useState<RunLog[]>([]);
  const [running, setRunning] = useState(false);
  const [activeStepIds, setActiveStepIds] = useState<Set<string>>(new Set());

  const activeRef = useRef<Scenario | null>(null);
  activeRef.current = active;

  //  Persist 
  const persist = useCallback((list: Scenario[]) => {
    setScenarios(list);
    saveToStorage(list);
  }, []);

  //  CRUD 
  const createScenario = useCallback((name: string) => {
    const s: Scenario = {
      id: crypto.randomUUID(), name: name.trim(),
      steps: [], customEdges: [], createdAt: Date.now(),
    };
    persist([...scenarios, s]);
    setActive(s);
    return s;
  }, [scenarios, persist]);

  const deleteScenario = useCallback((id: string) => {
    persist(scenarios.filter((s) => s.id !== id));
    if (activeRef.current?.id === id) setActive(null);
  }, [scenarios, persist]);

  const updateScenario = useCallback((s: Scenario) => {
    setActive(s);
    setScenarios((prev) => {
      const next = prev.map((x) => (x.id === s.id ? s : x));
      saveToStorage(next);
      return next;
    });
  }, []);

  //  Step helpers 
  const addStep = useCallback((action: ActionType) => {
    const cur = activeRef.current;
    if (!cur) return;
    updateScenario({ ...cur, steps: [...cur.steps, makeStep(action)] });
  }, [updateScenario]);

  const removeStep = useCallback((id: string) => {
    const cur = activeRef.current;
    if (!cur) return;
    updateScenario({ ...cur, steps: cur.steps.filter((s) => s.id !== id) });
  }, [updateScenario]);

  const patchStep = useCallback((id: string, patch: Partial<Step>) => {
    const cur = activeRef.current;
    if (!cur) return;
    updateScenario({ ...cur, steps: cur.steps.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  }, [updateScenario]);

  const patchStepStatus = useCallback((
    id: string, status: StepStatus,
    log?: string, txHash?: string, gasUsed?: string, duration?: number,
  ) => {
    setActive((prev) => {
      if (!prev) return prev;
      return { ...prev, steps: prev.steps.map((s) => s.id === id ? { ...s, status, log, txHash, gasUsed, duration } : s) };
    });
  }, []);

  //  Run 
  const runScenario = useCallback(async (hhAccounts: HardhatAccount[]) => {
    const cur = activeRef.current;
    if (!cur || running) return;

    const resetSteps = cur.steps.map((s) => ({ ...s, status: 'idle' as StepStatus, log: undefined, txHash: undefined, gasUsed: undefined }));
    const reset = { ...cur, steps: resetSteps };
    setActive(reset);
    setRunLogs([]);
    setRunning(true);
    setActiveStepIds(new Set());

    const batches = buildBatches(resetSteps);

    for (const batch of batches) {
      setActiveStepIds(new Set(batch.map((s) => s.id)));
      batch.forEach((s) => patchStepStatus(s.id, 'running'));

      const results = await Promise.all(
        batch.map(async (step) => {
          const t0 = Date.now();
          const res = await runStep(step, deployedContracts, rpcUrl, hhAccounts);
          return { step, res, duration: Date.now() - t0 };
        }),
      );

      let failed = false;
      for (const { step, res, duration } of results) {
        const status: StepStatus = res.ok ? 'ok' : 'error';
        patchStepStatus(step.id, status, res.message, res.txHash, res.gasUsed, duration);
        setRunLogs((prev) => [...prev, { stepId: step.id, status, message: res.message, txHash: res.txHash, gasUsed: res.gasUsed, duration, timestamp: Date.now() }]);

        if (res.txHash && step.action === 'send') {
          const dc = deployedContracts.find((c) => c.name === step.contractName || c.address === step.contractAddress);
          onTxRecorded({ id: crypto.randomUUID(), hash: res.txHash, contractName: dc?.name || step.contractName, functionName: step.functionName, args: step.args ? step.args.split(',') : [], status: 'success', gasUsed: res.gasUsed, timestamp: Date.now() });
        }
        if (!res.ok) failed = true;
      }

      await Promise.all(batch.map((step) => {
        if (step.timeoutMs && parseInt(step.timeoutMs) > 0 && step.action !== 'timeout')
          return new Promise((r) => setTimeout(r, parseInt(step.timeoutMs)));
        return Promise.resolve();
      }));

      if (failed) break;
    }

    setActiveStepIds(new Set());
    setRunning(false);
  }, [running, deployedContracts, rpcUrl, onTxRecorded, patchStepStatus]);

  const resetRun = useCallback(() => {
    const cur = activeRef.current;
    if (!cur || running) return;
    updateScenario({ ...cur, steps: cur.steps.map((s) => ({ ...s, status: 'idle', log: undefined, txHash: undefined, gasUsed: undefined })) });
    setRunLogs([]);
  }, [running, updateScenario]);

  return {
    scenarios,
    active, setActive,
    runLogs, running, activeStepIds,
    activeRef,
    createScenario, deleteScenario, updateScenario,
    addStep, removeStep, patchStep,
    runScenario, resetRun,
  };
}
