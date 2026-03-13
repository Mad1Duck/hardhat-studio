import { useState, useCallback, useRef, useEffect } from 'react';
import { ContractAbi, DeployedContract, TxRecord } from '../../../../types';
import {
  SimUser,
  SimEvent,
  PoolState,
  SimContext,
  makeUser,
  defaultPool,
} from '../../../modules/Simulation/types';
import { ALL_MODULES } from '../../../modules/Simulation/SimulationModule';
import {
  enrichContracts,
  getContractCompatibility,
  callDeployedContract,
  checkContractSupport,
} from '../lib/contractUtils';
import { getTokenDecimals } from '../lib/tokenUtils';

interface UseSimulationOptions {
  abis: ContractAbi[];
  deployedContracts: DeployedContract[];
  rpcUrl: string;
  onTxRecorded: (tx: TxRecord) => void;
}

export function useSimulation({ abis, deployedContracts, rpcUrl, onTxRecorded }: UseSimulationOptions) {
  const [activeModuleId, setActiveModuleId] = useState('token');
  const [events, setEvents] = useState<SimEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [paramValues, setParamValues] = useState<Record<string, Record<string, string>>>({});
  const [users, setUsers] = useState<SimUser[]>([
    makeUser(0, 'Alice'), makeUser(1, 'Bob'), makeUser(2, 'Charlie'), makeUser(3, 'Dave'),
  ]);
  const [pool, setPool] = useState<PoolState>(defaultPool());
  const [contractSelections, setContractSelections] = useState<Record<string, string>>({});

  const stopRef = useRef(false);
  const eventsEndRef = useRef<HTMLDivElement>(null);
  const usersRef = useRef<SimUser[]>(users);
  const poolRef = useRef<PoolState>(pool);

  useEffect(() => { usersRef.current = users; }, [users]);
  useEffect(() => { poolRef.current = pool; }, [pool]);

  // Init param defaults
  useEffect(() => {
    const init: Record<string, Record<string, string>> = {};
    ALL_MODULES.forEach((m) => {
      init[m.id] = {};
      m.params.forEach((p) => { init[m.id][p.id] = p.default; });
    });
    setParamValues(init);
  }, []);

  const enrichedContracts = enrichContracts(deployedContracts, abis);
  const activeModule = ALL_MODULES.find((m) => m.id === activeModuleId)!;

  const autoPickedContract = (() => {
    if (enrichedContracts.length === 0) return null;
    return (
      enrichedContracts.find((dc) => getContractCompatibility(dc, activeModule?.requiredMethods ?? []) === 'full') ??
      enrichedContracts.find((dc) => getContractCompatibility(dc, activeModule?.requiredMethods ?? []) === 'partial') ??
      null
    );
  })();

  const selectedContractId = contractSelections[activeModuleId] ?? '';
  const selectedSimContract = selectedContractId
    ? (enrichedContracts.find((c) => c.id === selectedContractId) ?? null)
    : autoPickedContract;

  const missingOnSelected: string[] = (() => {
    if (!selectedSimContract || !activeModule) return [];
    const abiFns = new Set(
      selectedSimContract.abi.filter((i: any) => i.type === 'function').map((i: any) => i.name as string),
    );
    return activeModule.requiredMethods.filter((m) => !abiFns.has(m));
  })();

  const canRun =
    !activeModule ||
    activeModule.requiredMethods.length === 0 ||
    enrichedContracts.length === 0 ||
    missingOnSelected.length === 0;

  const addEvent = useCallback((ev: Omit<SimEvent, 'id' | 'timestamp'>) => {
    const entry: SimEvent = { ...ev, id: crypto.randomUUID(), timestamp: Date.now() };
    setEvents((prev) => [...prev.slice(-800), entry]);
    setTimeout(() => eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, []);

  const syncOnChainBalances = useCallback(async (currentUsers: SimUser[]) => {
    if (!deployedContracts.length) return;
    try {
      const { ethers } = await import('ethers');
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const erc20 = enrichedContracts.find((dc) =>
        dc.abi.some((i: any) => i.type === 'function' && i.name === 'balanceOf'),
      );
      const tokenContract = selectedSimContract ?? erc20 ?? null;

      await Promise.all(
        currentUsers.map(async (u, idx) => {
          try {
            const ethBal = await provider.getBalance(u.address);
            setUsers((prev) => prev.map((x, j) => j === idx ? { ...x, balanceETH: parseFloat(ethers.formatEther(ethBal)) } : x));
          } catch { }

          if (tokenContract) {
            try {
              const contract = new ethers.Contract(tokenContract.address, tokenContract.abi, provider);
              const raw = await contract.balanceOf(u.address);
              const decimals = await getTokenDecimals(rpcUrl, tokenContract.address, tokenContract.abi);
              setUsers((prev) => prev.map((x, j) => j === idx ? { ...x, balanceToken: parseFloat(ethers.formatUnits(raw, decimals)) } : x));
            } catch { }
          }
        }),
      );
    } catch { }
  }, [rpcUrl, deployedContracts, selectedSimContract, enrichedContracts]);

  const buildContext = useCallback((): SimContext => {
    const setUsersWrapped: typeof setUsers = (updater) => {
      setUsers((prev) => {
        const next = typeof updater === 'function' ? (updater as any)(prev) : updater;
        usersRef.current = next;
        return next;
      });
    };
    const setPoolWrapped: typeof setPool = (updater) => {
      setPool((prev) => {
        const next = typeof updater === 'function' ? (updater as any)(prev) : updater;
        poolRef.current = next;
        return next;
      });
    };
    return {
      get users() { return usersRef.current; },
      get pool() { return poolRef.current; },
      rpcUrl,
      deployedContracts,
      log: (type, actor, msg, value, success = true, realTx = false) =>
        addEvent({ type, actor, message: msg, value, success, realTx }),
      stop: () => stopRef.current,
      setPool: setPoolWrapped,
      setUsers: setUsersWrapped,
      onTxRecorded,
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      callContract: (name, fn, args, pk, rawAmounts?) =>
        callDeployedContract(enrichedContracts, rpcUrl, name, fn, args, pk, rawAmounts, selectedSimContract?.address),
      getContractDecimals: async (_contractName: string) => {
        const dc = selectedSimContract ?? enrichedContracts.find((c) => c.abi.some((i: any) => i.type === 'function' && i.name === 'decimals'));
        if (!dc) return 18;
        return getTokenDecimals(rpcUrl, dc.address, dc.abi);
      },
      checkSupport: (required) => checkContractSupport(deployedContracts, required),
    };
  }, [rpcUrl, deployedContracts, addEvent, onTxRecorded, enrichedContracts, selectedSimContract]);

  const runSim = async () => {
    if (!activeModule || running || !canRun) return;
    stopRef.current = false;
    setRunning(true);
    setEvents([]);
    setPool(defaultPool());
    const freshUsers = [makeUser(0, 'Alice'), makeUser(1, 'Bob'), makeUser(2, 'Charlie'), makeUser(3, 'Dave')];
    setUsers(freshUsers);
    usersRef.current = freshUsers;
    poolRef.current = defaultPool();

    try {
      await activeModule.run(buildContext(), paramValues[activeModule.id] || {});
      if (deployedContracts.length > 0) await syncOnChainBalances(usersRef.current);
    } catch (e: any) {
      addEvent({ type: 'error', actor: 'System', message: `Simulation error: ${e.message}`, success: false });
    }
    setRunning(false);
  };

  const stop = () => { stopRef.current = true; setRunning(false); };

  const setParam = (moduleId: string, paramId: string, value: string) =>
    setParamValues((prev) => ({ ...prev, [moduleId]: { ...prev[moduleId], [paramId]: value } }));

  const setModuleContract = (moduleId: string, contractId: string) =>
    setContractSelections((prev) => ({ ...prev, [moduleId]: contractId }));

  return {
    // State
    activeModuleId, setActiveModuleId,
    activeModule,
    events, setEvents,
    running,
    paramValues, setParam,
    users, pool,
    contractSelections, setModuleContract,
    enrichedContracts,
    selectedSimContract,
    selectedContractId,
    missingOnSelected,
    canRun,
    eventsEndRef,
    // Actions
    runSim, stop,
    syncOnChainBalances,
    getContractCompatibility: (dc: DeployedContract) =>
      getContractCompatibility(dc, activeModule?.requiredMethods ?? []),
  };
}
