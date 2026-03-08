import { useState, useCallback, useEffect, useRef } from 'react';
import {
  ContractAbi,
  AbiItem,
  AbiInput,
  DeployedContract,
  TxRecord,
  HardhatAccount,
  ScriptFile,
  ProjectInfo,
} from '../../types';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Input, Label, ScrollArea } from '../ui/primitives';
import { Badge } from '../ui/primitives';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  Loader2,
  Zap,
  CheckCircle2,
  XCircle,
  Hash,
  Fuel,
  Send,
  Eye,
  Rocket,
  Users,
  RefreshCw,
  Copy,
  Layers,
  FileCode,
  ChevronDown,
  Play,
  Square,
  Bookmark,
  BookmarkCheck,
} from 'lucide-react';

interface FnState {
  inputs: Record<string, string>;
  result: unknown;
  error: string;
  loading: boolean;
}
type EthersLib = typeof import('ethers');

// ─── Stdout parser ────────────────────────────────────────────────────────────
// Supports both `hardhat run` scripts AND `hardhat ignition deploy` output

interface ParsedDeploy {
  contractName: string;
  address: string;
  line: string;
}

function parseDeployOutput(line: string): ParsedDeploy | null {
  const addr40 = /0x[0-9a-fA-F]{40}/;

  // ── Hardhat Ignition format ──────────────────────────────────────────────────
  // "MyModule#MyContract - 0x5FbDB2315678afecb367f032d93F642f64180aa3"
  const ignitionLine = /^\s*([\w]+#[\w]+)\s+-\s+(0x[0-9a-fA-F]{40})\s*$/;
  const ignMatch = ignitionLine.exec(line);
  if (ignMatch) {
    // "MyModule#MyContract" → take part after #
    const fullName = ignMatch[1];
    const contractName = fullName.includes('#') ? fullName.split('#')[1] : fullName;
    return { contractName, address: ignMatch[2], line: line.trim() };
  }

  // ── Ignition "Executed" line (extract contract name for later address match) ─
  // "  Executed MyModule#MyContract"
  const execMatch = /Executed\s+[\w]+#([\w]+)/.exec(line);
  if (execMatch) return null; // just a status line, no address yet

  // ── hardhat-deploy format ────────────────────────────────────────────────────
  // "deploying "MyContract" (tx: 0x...) ...: deployed at 0x... with N gas"
  const hdeploy = /deploying\s+["\'']?([\w]+)["\'']?.*deployed at (0x[0-9a-fA-F]{40})/i;
  const hdMatch = hdeploy.exec(line);
  if (hdMatch) return { contractName: hdMatch[1], address: hdMatch[2], line: line.trim() };

  // ── Generic patterns ─────────────────────────────────────────────────────────
  // Must contain an address
  const addrMatch = addr40.exec(line);
  if (!addrMatch) return null;
  const address = addrMatch[0];

  // Skip tx hashes (they are 32 bytes = 66 chars, addresses are 20 bytes = 42 chars)
  // But also skip lines that are clearly just tx hashes
  if (
    /tx(?:Hash)?\s*[:\-=]\s*0x[0-9a-fA-F]{64}/i.test(line) &&
    !addr40.test(line.replace(/0x[0-9a-fA-F]{64}/g, ''))
  ) {
    return null;
  }

  // Try to get contract name from same line
  let contractName = 'Contract';

  const patterns: RegExp[] = [
    /deployed\s+(?:to|at)\s*[:\-]?\s*0x[0-9a-fA-F]{40}/i, // check line has this
    /contract\s+address/i,
  ];

  // "ContractName deployed to 0x..."  or  "ContractName: 0x..."
  const nameBeforeAddr = /([A-Z][A-Za-z0-9_]+)\s+(?:deployed|contract|address|->|=>|:|-)/i;
  const nameAfterDeployed = /(?:deployed|deploying|deploy)\s+["\'']?([A-Z][A-Za-z0-9_]+)/i;
  const nameColon = /([A-Z][A-Za-z0-9_]{2,})\s*:\s*0x[0-9a-fA-F]{40}/i;

  for (const re of [nameColon, nameBeforeAddr, nameAfterDeployed]) {
    const m = re.exec(line);
    if (m && m[1] && !['Error', 'Warning', 'Info', 'Block', 'Hash', 'Tx', 'Gas'].includes(m[1])) {
      contractName = m[1];
      break;
    }
  }

  return { contractName, address, line: line.trim() };
}

interface Props {
  abis: ContractAbi[];
  selectedAbi: ContractAbi | null;
  onSelectAbi: (a: ContractAbi) => void;
  onDeployed: (c: DeployedContract) => void;
  onTxRecorded: (tx: TxRecord) => void;
  defaultRpcUrl?: string;
  defaultPrivateKey?: string;
  deployedContracts?: DeployedContract[];
  projectPath?: string | null;
  projectInfo?: ProjectInfo | null;
}

export default function ContractInteract({
  abis,
  selectedAbi,
  onSelectAbi,
  onDeployed,
  onTxRecorded,
  defaultRpcUrl = 'http://127.0.0.1:8545',
  defaultPrivateKey = '',
  deployedContracts = [],
  projectPath,
  projectInfo,
}: Props) {
  const [rpcUrl, setRpcUrl] = useState(defaultRpcUrl);
  const [address, setAddress] = useState('');
  const [gasEstimates, setGasEstimates] = useState<Map<string, string>>(new Map());
  const [estimating, setEstimating] = useState<string | null>(null);
  // Auto-detect deployed address when selected ABI changes
  useEffect(() => {
    if (!selectedAbi) return;
    const match = deployedContracts.find(
      (c) => c.name === selectedAbi.contractName || c.name === selectedAbi.name,
    );
    if (match && match.address && !address) {
      setAddress(match.address);
    }
  }, [selectedAbi?.contractName]);
  const [privateKey, setPrivateKey] = useState(defaultPrivateKey);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connError, setConnError] = useState('');
  const [networkInfo, setNetworkInfo] = useState<{
    name: string;
    chainId: number;
    blockNumber: number;
  } | null>(null);
  const [ethers, setEthers] = useState<EthersLib | null>(null);
  const [contract, setContract] = useState<unknown>(null);
  const [fnStates, setFnStates] = useState<Map<string, FnState>>(new Map());
  const [msgValue, setMsgValue] = useState('0');
  const [gasLimit, setGasLimit] = useState('');
  const [activeSection, setActiveSection] = useState<'read' | 'write' | 'deploy'>('read');
  const [deployLoading, setDeployLoading] = useState(false);
  const [deployResult, setDeployResult] = useState<{ address: string; tx: string } | null>(null);
  const [deployError, setDeployError] = useState('');
  const [deployInputs, setDeployInputs] = useState<Record<string, string>>({});
  const [hardhatAccounts, setHardhatAccounts] = useState<HardhatAccount[]>([]);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [accountBalance, setAccountBalance] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // ─── Bookmarks ────────────────────────────────────────────────────────────────
  const [bookmarkedFns, setBookmarkedFns] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('interact_bookmarks') || '[]'));
    } catch {
      return new Set();
    }
  });
  const [showOnlyBookmarked, setShowOnlyBookmarked] = useState(false);

  const toggleBookmark = (fnName: string) => {
    setBookmarkedFns((prev) => {
      const next = new Set(prev);
      if (next.has(fnName)) next.delete(fnName);
      else next.add(fnName);
      try {
        localStorage.setItem('interact_bookmarks', JSON.stringify([...next]));
      } catch {}
      return next;
    });
  };

  // ─── Hardhat Script Runner ────────────────────────────────────────────────
  const [showScriptRunner, setShowScriptRunner] = useState(false);
  const [extraScriptPaths, setExtraScriptPaths] = useState<string[]>([]);
  const [scripts, setScripts] = useState<ScriptFile[]>([]);
  const [deployMode, setDeployMode] = useState<'run' | 'ignition'>('run');
  const [selectedScript, setSelectedScript] = useState<ScriptFile | null>(null);
  const [deployNetwork, setDeployNetwork] = useState('localhost');
  const [scriptRunning, setScriptRunning] = useState(false);
  const [scriptLogs, setScriptLogs] = useState<string[]>([]);
  const [scriptResults, setScriptResults] = useState<ParsedDeploy[]>([]);
  const [scriptError, setScriptError] = useState('');
  const scriptRunId = useRef<string>(`deploy-run-${Date.now()}`);
  const unsubOutput = useRef<(() => void) | null>(null);
  const unsubStatus = useRef<(() => void) | null>(null);

  const fns = selectedAbi?.abi.filter((i) => i.type === 'function') || [];
  const reads = fns.filter((f) => f.stateMutability === 'view' || f.stateMutability === 'pure');
  const writes = fns.filter((f) => f.stateMutability !== 'view' && f.stateMutability !== 'pure');
  const ctor = selectedAbi?.abi.find((i) => i.type === 'constructor');
  const canDeploy = !!(selectedAbi?.bytecode && selectedAbi.bytecode !== '0x');

  useEffect(() => {
    if (defaultPrivateKey) setPrivateKey(defaultPrivateKey);
  }, [defaultPrivateKey]);

  useEffect(() => {
    window.api
      .getHardhatAccounts(rpcUrl)
      .then(setHardhatAccounts)
      .catch(() => {});
  }, [rpcUrl]);

  const loadEthers = async () => {
    if (ethers) return ethers;
    const e = await import('ethers');
    setEthers(e);
    return e;
  };

  const fetchBalance = async (addr: string, e: EthersLib, prov: unknown) => {
    try {
      const bal = await (prov as { getBalance: (a: string) => Promise<bigint> }).getBalance(addr);
      setAccountBalance(parseFloat(e.formatEther(bal)).toFixed(4) + ' ETH');
    } catch {}
  };

  // ─── Load scripts when runner opens ────────────────────────────────────────
  const addScriptPath = async () => {
    const path = await (window as any).api.selectFolder();
    console.log(path, '=====path=====');

    if (path) {
      setExtraScriptPaths((prev) => [...prev, path]);
    }
  };

  const loadScripts = useCallback(async () => {
    if (!projectPath) return;

    try {
      const [scriptFiles, ignitionFiles] = await Promise.all([
        (window as any).api.scanScripts(projectPath).catch(() => []),
        (window as any).api.scanScripts(projectPath, 'ignition/modules').catch(() => []),
      ]);

      const extraFiles: ScriptFile[] = [];

      for (const p of extraScriptPaths) {
        const ext = await (window as any).api.scanScripts(p, 'ignition/modules').catch(() => []);
        extraFiles.push(...(ext || []));
      }

      const allFiles: ScriptFile[] = [
        ...(scriptFiles || []),
        ...(ignitionFiles || []),
        ...extraFiles,
      ];

      setScripts(allFiles);

      const deployScript =
        allFiles.find((s) => s.relativePath.includes('ignition')) ||
        allFiles.find((s) => /deploy/i.test(s.name) && !s.name.includes('test')) ||
        allFiles[0] ||
        null;

      setSelectedScript(deployScript);
    } catch (err) {
      console.error(err);
    }
  }, [projectPath, extraScriptPaths]);

  useEffect(() => {
    if (showScriptRunner) loadScripts();
  }, [showScriptRunner, loadScripts]);

  // ─── Run deploy script ────────────────────────────────────────────────────
  const runDeployScript = useCallback(async () => {
    if (!projectPath || !selectedScript) return;
    const pm = projectInfo?.isBun
      ? 'bunx'
      : projectInfo?.packageManager === 'yarn'
        ? 'yarn'
        : projectInfo?.packageManager === 'pnpm'
          ? 'pnpm exec'
          : 'npx';
    const normalizedPath = selectedScript.path.replace(/\\/g, '/');

    const isIgnition = normalizedPath.includes('ignition/modules');
    const cmd = isIgnition
      ? `${pm} hardhat ignition deploy ${selectedScript.relativePath} --network ${deployNetwork} --reset`
      : `${pm} hardhat run ${selectedScript.relativePath} --network ${deployNetwork}`;
    const runId = `deploy-run-${Date.now()}`;
    scriptRunId.current = runId;

    setScriptRunning(true);
    setScriptLogs([`$ ${cmd}`, '']);
    setScriptResults([]);
    setScriptError('');

    if (unsubOutput.current) unsubOutput.current();
    if (unsubStatus.current) unsubStatus.current();

    const parsedThisRun: ParsedDeploy[] = [];

    unsubOutput.current = (window as any).api.onProcessOutput(
      ({ id, type, data }: { id: string; type: string; data: string }) => {
        if (id !== runId) return;
        const lines = data.split('\n').filter((l: string) => l.trim());
        setScriptLogs((prev) => [...prev, ...lines]);

        for (const line of lines) {
          const parsed = parseDeployOutput(line);
          if (parsed) {
            parsedThisRun.push(parsed);
            setScriptResults((prev) => {
              if (prev.find((p) => p.address === parsed.address)) return prev;
              return [...prev, parsed];
            });
            const matchedAbi = abis.find(
              (a) =>
                a.contractName.toLowerCase() === parsed.contractName.toLowerCase() ||
                a.name.toLowerCase() === parsed.contractName.toLowerCase(),
            );
            const deployed: DeployedContract = {
              id: crypto.randomUUID(),
              name: parsed.contractName,
              address: parsed.address,
              network: deployNetwork,
              rpcUrl,
              abi: matchedAbi?.abi || [],
              deployedAt: Date.now(),
            };
            onDeployed(deployed);
          }
        }
      },
    );

    unsubStatus.current = (window as any).api.onProcessStatus(
      ({
        id,
        status,
        code,
        error,
      }: {
        id: string;
        status: string;
        code?: number;
        error?: string;
      }) => {
        if (id !== runId) return;
        if (status === 'stopped') {
          setScriptRunning(false);
          if (code !== 0) setScriptError(`Process exited with code ${code}`);
          setScriptLogs((prev) => [...prev, ``, `■ Finished (code ${code ?? 0})`]);
        } else if (status === 'error') {
          setScriptRunning(false);
          setScriptError(error || 'Unknown error');
        }
      },
    );

    await (window as any).api.runCommand({ id: runId, command: cmd, cwd: projectPath });
  }, [projectPath, selectedScript, deployNetwork, projectInfo, abis, rpcUrl, onDeployed]);

  const stopScript = useCallback(async () => {
    if (scriptRunId.current) {
      await (window as any).api.stopCommand(scriptRunId.current);
    }
    setScriptRunning(false);
  }, []);

  useEffect(() => {
    return () => {
      if (unsubOutput.current) unsubOutput.current();
      if (unsubStatus.current) unsubStatus.current();
    };
  }, []);
  const connect = async () => {
    if (!selectedAbi || !address.trim()) return;
    setConnecting(true);
    setConnError('');
    setConnected(false);
    try {
      const e = await loadEthers();
      const prov = new e.JsonRpcProvider(rpcUrl);
      const net = await prov.getNetwork();
      const blockNum = await prov.getBlockNumber();
      setNetworkInfo({ name: net.name, chainId: Number(net.chainId), blockNumber: blockNum });

      let sig: unknown = prov;
      if (privateKey.trim()) {
        const pk = privateKey.trim().startsWith('0x')
          ? privateKey.trim()
          : `0x${privateKey.trim()}`;
        sig = new e.Wallet(pk, prov);
        await fetchBalance((sig as { address: string }).address, e, prov);
      } else {
        try {
          const accs = await prov.send('eth_accounts', []);
          if (accs.length > 0) {
            sig = await prov.getSigner(accs[0]);
            await fetchBalance(accs[0], e, prov);
          }
        } catch {}
      }

      const trimmedAddress = address.trim();
      if (!e.isAddress(trimmedAddress)) {
        throw new Error(`Invalid contract address: ${trimmedAddress}`);
      }

      const code = await prov.getCode(trimmedAddress);
      if (code === '0x' || code === '0x0') {
        throw new Error(`No contract deployed at ${trimmedAddress} on this network`);
      }

      const ct = new e.Contract(trimmedAddress, selectedAbi.abi as never, sig as never);
      setContract(ct);
      setConnected(true);
    } catch (err: unknown) {
      const msg = (err as Error).message?.split('\n')[0] || String(err);
      setConnError(msg);
    } finally {
      setConnecting(false);
    }
  };

  const getFnKey = (item: AbiItem) =>
    `${item.name}-${(item.inputs || []).map((i) => i.type).join(',')}`;
  const getFnState = (key: string): FnState =>
    fnStates.get(key) || { inputs: {}, result: undefined, error: '', loading: false };

  const updateFn = (key: string, updates: Partial<FnState>) =>
    setFnStates((prev) => {
      const n = new Map(prev);
      n.set(key, { ...getFnState(key), ...updates });
      return n;
    });

  const parseArg = (inp: AbiInput, val: string, e: EthersLib): unknown => {
    const v = val.trim();

    if (!v) {
      if (inp.type.includes('int')) return BigInt(0);
      if (inp.type === 'bool') return false;
      if (inp.type === 'bytes32') return e.ZeroHash;
      if (inp.type.startsWith('bytes')) return '0x';
      if (inp.type.endsWith('[]') || inp.type === 'tuple') return [];
      if (inp.type === 'address')
        throw new Error(`Missing required argument: ${inp.name} (address)`);
      return v;
    }

    if (inp.type.includes('uint') || inp.type.includes('int')) {
      try {
        return BigInt(v);
      } catch {
        throw new Error(`Invalid integer for ${inp.name}: "${v}"`);
      }
    }
    if (inp.type === 'bool') return v === 'true' || v === '1' || v.toLowerCase() === 'true';
    if (inp.type === 'address') {
      if (!e.isAddress(v)) throw new Error(`Invalid address for ${inp.name}: "${v}"`);
      return v;
    }
    if (inp.type === 'bytes32') {
      try {
        if (v.startsWith('0x') && v.length === 66) return v;
        return e.encodeBytes32String(v);
      } catch {
        return v;
      }
    }
    if (inp.type.startsWith('bytes')) {
      if (!v.startsWith('0x')) return '0x' + Buffer.from(v).toString('hex');
      return v;
    }
    if (inp.type.endsWith(']') || inp.type === 'tuple') {
      try {
        return JSON.parse(v);
      } catch {
        throw new Error(`Invalid JSON for ${inp.name}: "${v}"`);
      }
    }
    return v;
  };

  const formatResult = (v: unknown): string => {
    if (v === null || v === undefined) return 'null';
    if (typeof v === 'bigint') return v.toString();
    if (Array.isArray(v)) return `[${v.map(formatResult).join(', ')}]`;
    if (typeof v === 'object') {
      try {
        return JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? x.toString() : x), 2);
      } catch {
        return String(v);
      }
    }
    return String(v);
  };

  const callFn = useCallback(
    async (item: AbiItem) => {
      if (!contract || !ethers) return;
      const key = getFnKey(item);
      const state = getFnState(key);
      updateFn(key, { loading: true, result: undefined, error: '' });
      const txId = crypto.randomUUID();
      const args = (item.inputs || []).map((inp) =>
        parseArg(inp, state.inputs[inp.name] || '', ethers),
      );
      try {
        const fn = (contract as Record<string, unknown>)[item.name!] as (
          ...a: unknown[]
        ) => Promise<unknown>;
        if (!fn) throw new Error(`Function ${item.name} not found on contract`);

        if (item.stateMutability === 'view' || item.stateMutability === 'pure') {
          const result = await fn(...args);
          updateFn(key, { loading: false, result: formatResult(result) });
          onTxRecorded({
            id: txId,
            hash: '',
            contractName: selectedAbi?.contractName || '',
            functionName: item.name || '',
            args,
            status: 'success',
            timestamp: Date.now(),
          });
        } else {
          const overrides: Record<string, unknown> = {};
          if (msgValue && msgValue !== '0') overrides.value = ethers.parseEther(msgValue);
          if (gasLimit) overrides.gasLimit = BigInt(gasLimit);
          const allArgs = Object.keys(overrides).length ? [...args, overrides] : args;
          const tx = await fn(...allArgs);
          const receipt = await (
            tx as { wait: () => Promise<{ gasUsed: bigint; blockNumber: number }> }
          ).wait();
          const hash = (tx as { hash: string }).hash || '';
          updateFn(key, {
            loading: false,
            result: `✓ Tx: ${hash}\nBlock: ${receipt?.blockNumber}\nGas: ${receipt?.gasUsed?.toString()}`,
          });
          onTxRecorded({
            id: txId,
            hash,
            contractName: selectedAbi?.contractName || '',
            functionName: item.name || '',
            args,
            status: 'success',
            gasUsed: receipt?.gasUsed?.toString(),
            blockNumber: receipt?.blockNumber,
            timestamp: Date.now(),
          });
        }
      } catch (err: unknown) {
        const e = err as any;
        let msg = '';

        if (e?.code === 'CALL_EXCEPTION') {
          if (e.reason) {
            msg = `Revert: ${e.reason}`;
          } else if (e.data && ethers) {
            try {
              const iface = new ethers.Interface(selectedAbi?.abi as never);
              const decoded = iface.parseError(e.data);
              msg = decoded
                ? `CustomError: ${decoded.name}(${decoded.args?.join(', ')})`
                : `Revert: ${e.data}`;
            } catch {
              msg = `Revert (no reason): ${e.data}`;
            }
          } else if (e.data === null || e.data === '0x') {
            msg = `CALL_EXCEPTION: No revert data — check the contract address is correct and the function inputs are valid`;
          } else {
            msg = `Call failed: ${e.shortMessage || e.message?.split('\n')[0]}`;
          }
        } else if (e?.code === 'INVALID_ARGUMENT') {
          msg = `Invalid argument: ${e.argument} = ${JSON.stringify(e.value)} — ${e.shortMessage}`;
        } else {
          msg = e?.shortMessage || e?.message?.split('\n')[0] || String(e);
        }

        updateFn(key, { loading: false, error: msg });
        onTxRecorded({
          id: txId,
          hash: '',
          contractName: selectedAbi?.contractName || '',
          functionName: item.name || '',
          args,
          status: 'failed',
          error: msg,
          timestamp: Date.now(),
        });
      }
    },
    [contract, ethers, msgValue, gasLimit, selectedAbi],
  );

  const estimateGas = useCallback(
    async (item: AbiItem) => {
      if (!contract || !ethers) return;
      const key = getFnKey(item);
      const state = getFnState(key);
      setEstimating(key);

      try {
        const args = (item.inputs || []).map((inp) => {
          const v = (state.inputs[inp.name] || '').trim();
          if (v) {
            try {
              return parseArg(inp, v, ethers);
            } catch {
              /* fall through to placeholder */
            }
          }
          if (inp.type === 'address') return '0x0000000000000000000000000000000000000001';
          if (inp.type.includes('uint') || inp.type.includes('int')) return BigInt(1);
          if (inp.type === 'bool') return false;
          if (inp.type === 'bytes32') return ethers.ZeroHash;
          if (inp.type.startsWith('bytes')) return '0x00';
          if (inp.type === 'string') return '';
          if (inp.type.endsWith('[]')) return [];
          return '0x';
        });

        const fn = (contract as any)[item.name!];
        if (!fn) throw new Error(`Function not found: ${item.name}`);

        const overrides: Record<string, unknown> = {};
        if (msgValue && msgValue !== '0') overrides.value = ethers.parseEther(msgValue);

        const allArgs = Object.keys(overrides).length ? [...args, overrides] : args;
        const estimated: bigint = await fn.estimateGas(...allArgs);
        const withBuffer = (estimated * BigInt(120)) / BigInt(100);

        setGasEstimates((prev) => {
          const n = new Map(prev);
          n.set(
            key,
            `~${estimated.toLocaleString()} (${withBuffer.toLocaleString()} w/ +20% buffer)`,
          );
          return n;
        });
      } catch (err: any) {
        const e = err as any;
        let msg = '';
        if (e?.code === 'CALL_EXCEPTION') {
          msg = e.reason
            ? `Revert: ${e.reason}`
            : e.data && e.data !== '0x'
              ? (() => {
                  try {
                    const i = new ethers.Interface(selectedAbi?.abi as never);
                    const d = i.parseError(e.data);
                    return d ? `${d.name}(${d.args?.join(', ')})` : `Revert: ${e.data}`;
                  } catch {
                    return `Revert: ${e.data}`;
                  }
                })()
              : 'No revert reason — tx will likely fail';
        } else {
          msg = e?.shortMessage || e?.message?.split('\n')[0] || String(e);
        }
        setGasEstimates((prev) => {
          const n = new Map(prev);
          n.set(key, `⚠ ${msg}`);
          return n;
        });
      } finally {
        setEstimating(null);
      }
    },
    [contract, ethers, msgValue, selectedAbi],
  );

  const deploy = async () => {
    if (!selectedAbi || !ethers) return;
    setDeployLoading(true);
    setDeployError('');
    setDeployResult(null);
    try {
      const e = ethers;
      const prov = new e.JsonRpcProvider(rpcUrl);
      let sig: unknown;
      if (privateKey.trim()) {
        const pk = privateKey.trim().startsWith('0x')
          ? privateKey.trim()
          : `0x${privateKey.trim()}`;
        sig = new e.Wallet(pk, prov);
      } else {
        const accs = await prov.send('eth_accounts', []);
        sig = await prov.getSigner(accs[0]);
      }
      const factory = new e.ContractFactory(
        selectedAbi.abi as never,
        selectedAbi.bytecode!,
        sig as never,
      );
      const args = (ctor?.inputs || []).map((inp) =>
        parseArg(inp, deployInputs[inp.name] || '', e),
      );
      const ct = await factory.deploy(...args);
      await ct.waitForDeployment();
      const addr = await ct.getAddress();
      const txHash = ct.deploymentTransaction()?.hash || '';
      setDeployResult({ address: addr, tx: txHash });
      onDeployed({
        id: crypto.randomUUID(),
        name: selectedAbi.contractName,
        address: addr,
        network: networkInfo?.name || 'localhost',
        rpcUrl,
        abi: selectedAbi.abi,
        deployedAt: Date.now(),
        txHash,
        constructorArgs: deployInputs,
        chainId: networkInfo?.chainId,
      });
    } catch (err: unknown) {
      setDeployError((err as Error).message?.split('\n')[0] || String(err));
    } finally {
      setDeployLoading(false);
    }
  };

  const copyResult = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(key);
    setTimeout(() => setCopyFeedback(null), 1500);
  };

  return (
    <div className="flex h-full overflow-hidden bg-background">
      {/* Config sidebar */}
      <div className="flex-shrink-0 w-64 overflow-y-auto border-r border-border bg-card">
        <div className="px-4 py-3 border-b border-border">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3">
            Contract Setup
          </p>

          <div className="space-y-3">
            <div>
              <Label className="mb-1.5 block">ABI</Label>
              <Select
                value={selectedAbi?.path || ''}
                onValueChange={(v) => {
                  const a = abis.find((x) => x.path === v);
                  if (a) {
                    onSelectAbi(a);
                    setConnected(false);
                    setContract(null);
                  }
                }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select ABI…" />
                </SelectTrigger>
                <SelectContent>
                  {abis.map((a) => (
                    <SelectItem key={a.path} value={a.path}>
                      {a.contractName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-1.5 block">RPC URL</Label>
              <Input
                value={rpcUrl}
                onChange={(e) => setRpcUrl(e.target.value)}
                placeholder="http://127.0.0.1:8545"
              />
            </div>

            <div>
              <Label className="mb-1.5 block">Contract Address</Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="0x…"
                className="font-mono text-xs"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label>Signer Account</Label>
                <button
                  className="text-[10px] text-sky-400 hover:text-sky-300 flex items-center gap-1"
                  onClick={() => setShowAccountPicker(!showAccountPicker)}>
                  <Users className="w-2.5 h-2.5" /> Auto-detect
                </button>
              </div>

              {showAccountPicker && hardhatAccounts.length > 0 && (
                <div className="mb-2 overflow-y-auto border rounded border-border bg-background max-h-32">
                  {hardhatAccounts.slice(0, 5).map((acc, i) => (
                    <button
                      key={acc.address}
                      className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-accent/50 text-left"
                      onClick={() => {
                        setPrivateKey(acc.privateKey);
                        setShowAccountPicker(false);
                      }}>
                      <span className="text-[10px] font-mono text-muted-foreground/50 w-4">
                        {i}
                      </span>
                      <span className="text-[10px] font-mono text-foreground/70 truncate">
                        {acc.address.slice(0, 14)}…
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <Input
                type="password"
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                placeholder="0x… or leave empty"
                className="font-mono text-xs"
              />
            </div>
          </div>
        </div>

        {/* Network info */}
        {connected && networkInfo && (
          <div className="px-4 py-2 border-b bg-emerald-500/5 border-emerald-500/10">
            <div className="flex items-center gap-2 text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
              <span className="font-mono text-emerald-400">{networkInfo.name || 'unknown'}</span>
              <span className="ml-auto text-muted-foreground/50">#{networkInfo.blockNumber}</span>
            </div>
            <div className="text-[10px] font-mono text-muted-foreground/40 mt-0.5">
              chainId: {networkInfo.chainId}
            </div>
            {accountBalance && (
              <div className="text-[10px] font-mono text-amber-400/70 mt-0.5">{accountBalance}</div>
            )}
          </div>
        )}

        {connError && (
          <div className="mx-3 mt-2 px-3 py-2 rounded-md bg-rose-500/10 border border-rose-500/20 text-[11px] font-mono text-rose-400 break-all">
            {connError}
          </div>
        )}

        <div className="px-4 py-3">
          {connected ? (
            <div className="space-y-2">
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={() => {
                  setConnected(false);
                  setContract(null);
                  setNetworkInfo(null);
                  setAccountBalance(null);
                }}>
                Disconnect
              </Button>
              <Button variant="outline" size="sm" className="w-full gap-1" onClick={connect}>
                <RefreshCw className="w-3 h-3" /> Reconnect
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              className="w-full gap-1"
              onClick={connect}
              disabled={!selectedAbi || !address || connecting}>
              {connecting ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Zap className="w-3 h-3" />
              )}
              {connecting ? 'Connecting…' : 'Connect'}
            </Button>
          )}
        </div>

        {/* Tx options */}
        {connected && writes.length > 0 && (
          <div className="px-4 pt-3 pb-3 space-y-2 border-t border-border">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              Tx Options
            </p>
            <div>
              <Label className="block mb-1">Value (ETH)</Label>
              <Input
                value={msgValue}
                onChange={(e) => setMsgValue(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <Label className="block mb-1">Gas Limit</Label>
              <Input
                value={gasLimit}
                onChange={(e) => setGasLimit(e.target.value)}
                placeholder="auto"
              />
            </div>
          </div>
        )}
      </div>

      {/* Functions panel */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* ── Hardhat Script Runner Banner ── */}
        <div className="flex items-center flex-shrink-0 gap-3 px-4 py-2 border-b border-border bg-emerald-500/5">
          <FileCode className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
          <span className="text-[11px] text-emerald-400/80 flex-1">Deploy via Hardhat scripts</span>
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[10px] gap-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
            onClick={() => setShowScriptRunner((p) => !p)}>
            <ChevronDown
              className={cn('w-2.5 h-2.5 transition-transform', showScriptRunner && 'rotate-180')}
            />
            {showScriptRunner ? 'Hide' : 'Run Script'}
          </Button>
        </div>

        {/* ── Script Runner Panel ── */}
        {showScriptRunner && (
          <div className="flex-shrink-0 border-b border-border bg-card/90">
            {/* Config row */}
            <div className="flex items-end gap-2 px-4 pt-3 pb-2">
              {/* Script selector */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-[10px]">Script</Label>
                  <button
                    onClick={addScriptPath}
                    className="text-[10px] text-sky-400 hover:text-sky-300 flex items-center gap-0.5">
                    + folder
                  </button>
                </div>
                <div className="flex gap-1">
                  <select
                    value={selectedScript?.path || ''}
                    onChange={(e) =>
                      setSelectedScript(scripts.find((s) => s.path === e.target.value) || null)
                    }
                    className="flex-1 px-2 text-xs truncate border rounded outline-none h-7 bg-background border-border">
                    <option value="">Select script…</option>
                    {scripts.length === 0 && <option disabled>No scripts found in /scripts</option>}
                    {scripts.map((s) => (
                      <option key={s.path} value={s.path}>
                        {s.relativePath}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="flex-shrink-0 p-0 h-7 w-7"
                    onClick={loadScripts}
                    title="Refresh scripts">
                    <RefreshCw className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              {/* Network selector */}
              <div className="flex-shrink-0 w-36">
                <Label className="text-[10px] mb-1 block">Network</Label>
                <select
                  value={deployNetwork}
                  onChange={(e) => setDeployNetwork(e.target.value)}
                  className="w-full px-2 text-xs border rounded outline-none h-7 bg-background border-border">
                  {['localhost', 'hardhat', ...Object.keys(projectInfo?.networks || {})]
                    .filter((v, i, a) => a.indexOf(v) === i)
                    .map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                </select>
              </div>

              {/* Run/Stop button */}
              {scriptRunning ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-shrink-0 gap-1 text-xs h-7 border-rose-500/40 text-rose-400 hover:bg-rose-500/10"
                  onClick={stopScript}>
                  <Square className="w-3 h-3" /> Stop
                </Button>
              ) : (
                <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                  <Button
                    size="sm"
                    className="w-full gap-1 text-xs h-7 bg-emerald-600 hover:bg-emerald-500"
                    onClick={runDeployScript}
                    disabled={!selectedScript || !projectPath}>
                    <Play className="w-3 h-3" />
                    {selectedScript?.relativePath.includes('ignition') ? 'Ignition' : 'Run'}
                  </Button>
                  <span className="text-[9px] text-muted-foreground/30 font-mono">
                    {selectedScript?.relativePath.includes('ignition')
                      ? 'ignition deploy'
                      : 'hardhat run'}
                  </span>
                </div>
              )}
            </div>

            {/* Detected addresses */}
            {scriptResults.length > 0 && (
              <div className="px-4 pb-2 space-y-1">
                <p className="text-[10px] font-semibold text-emerald-400/70 uppercase tracking-widest">
                  Detected deployments
                </p>
                {scriptResults.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-1.5">
                    <CheckCircle2 className="flex-shrink-0 w-3 h-3 text-emerald-400" />
                    <span className="text-[11px] font-semibold text-emerald-300">
                      {r.contractName}
                    </span>
                    <code className="text-[10px] font-mono text-muted-foreground/60 flex-1 truncate">
                      {r.address}
                    </code>
                    <span className="text-[9px] text-emerald-400/50">auto-registered ✓</span>
                  </div>
                ))}
              </div>
            )}

            {/* Script error */}
            {scriptError && (
              <div className="px-4 pb-2">
                <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 rounded px-2 py-1.5 text-[11px] text-rose-400">
                  <XCircle className="flex-shrink-0 w-3 h-3" />
                  {scriptError}
                </div>
              </div>
            )}

            {/* Live log */}
            {scriptLogs.length > 0 && (
              <div className="mx-4 mb-3 rounded border border-border bg-[#0d1117] overflow-hidden">
                <div className="flex items-center justify-between px-2 py-1 border-b border-border/50">
                  <span className="text-[9px] font-mono text-muted-foreground/30 uppercase">
                    stdout
                  </span>
                  {scriptRunning && (
                    <span className="flex items-center gap-1 text-[9px] text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                      running
                    </span>
                  )}
                </div>
                <div className="p-2 overflow-y-auto max-h-32">
                  {scriptLogs.slice(-80).map((line, i) => (
                    <div
                      key={i}
                      className={cn(
                        'text-[10px] font-mono leading-relaxed whitespace-pre-wrap',
                        line.startsWith('$')
                          ? 'text-amber-300/70'
                          : line.includes('Error') || line.includes('error')
                            ? 'text-rose-400/80'
                            : /0x[0-9a-fA-F]{40}/.test(line)
                              ? 'text-emerald-300'
                              : 'text-muted-foreground/60',
                      )}>
                      {line || ' '}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No scripts hint */}
            {!scriptRunning && scripts.length === 0 && (
              <div className="px-4 pb-3 text-[10px] text-muted-foreground/40 flex items-center gap-1.5">
                <FileCode className="w-3 h-3" />
                No scripts found in <code className="font-mono">/scripts</code> folder. Create one
                in the Scripts panel.
              </div>
            )}
          </div>
        )}
        {!selectedAbi ? (
          <div className="flex items-center justify-center flex-1 text-muted-foreground/30">
            <div className="text-center">
              <Zap className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Select an ABI and connect to call functions</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center flex-shrink-0 h-10 gap-1 px-4 border-b border-border bg-card">
              {[
                {
                  id: 'read' as const,
                  icon: Eye,
                  label: `Read (${reads.length})`,
                  color: 'text-sky-400',
                },
                {
                  id: 'write' as const,
                  icon: Send,
                  label: `Write (${writes.length})`,
                  color: 'text-amber-400',
                },
                ...(canDeploy
                  ? [
                      {
                        id: 'deploy' as const,
                        icon: Rocket,
                        label: 'Deploy',
                        color: 'text-emerald-400',
                      },
                    ]
                  : []),
              ].map(({ id, icon: Icon, label, color }) => (
                <button
                  key={id}
                  onClick={() => setActiveSection(id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 h-full text-xs font-medium border-b-2 transition-all',
                    activeSection === id
                      ? `${color} border-current`
                      : 'text-muted-foreground/60 border-transparent hover:text-muted-foreground',
                  )}>
                  <Icon className="w-3 h-3" />
                  {label}
                </button>
              ))}

              {!connected && (
                <span className="ml-auto text-[10px] font-mono text-amber-400/60 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400/60" />
                  Connect to call functions
                </span>
              )}
              {bookmarkedFns.size > 0 && (
                <button
                  onClick={() => setShowOnlyBookmarked((p) => !p)}
                  className={cn(
                    'ml-auto flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border transition-colors',
                    showOnlyBookmarked
                      ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                      : 'border-border text-muted-foreground/40 hover:border-muted-foreground/30',
                  )}>
                  <Bookmark className="w-2.5 h-2.5" />
                  {bookmarkedFns.size} bookmarked
                </button>
              )}
            </div>

            <ScrollArea className="flex-1 overflow-y-auto">
              <div className="p-4 space-y-2">
                {activeSection === 'deploy' && canDeploy && (
                  <div className="overflow-hidden border rounded-lg border-border bg-card">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card">
                      <span className="font-mono text-sm font-semibold text-foreground">
                        constructor
                      </span>
                      <Badge variant="write">constructor</Badge>
                    </div>
                    <div className="px-4 pt-3 pb-2 space-y-2">
                      {(ctor?.inputs || []).map((inp) => (
                        <div key={inp.name}>
                          <Label className="block mb-1">
                            {inp.name}{' '}
                            <span className="font-normal normal-case text-sky-400/70">
                              ({inp.type})
                            </span>
                          </Label>
                          <Input
                            value={deployInputs[inp.name] || ''}
                            onChange={(e) =>
                              setDeployInputs((p) => ({ ...p, [inp.name]: e.target.value }))
                            }
                            placeholder={inp.type}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="px-4 pb-3">
                      <Button
                        variant="success"
                        size="sm"
                        className="gap-1.5"
                        onClick={deploy}
                        disabled={deployLoading || !ethers}>
                        {deployLoading ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Rocket className="w-3 h-3" />
                        )}
                        {deployLoading ? 'Deploying…' : 'Deploy Contract'}
                      </Button>
                      {deployResult && (
                        <div className="p-3 mt-3 space-y-1 border rounded-md bg-emerald-500/10 border-emerald-500/20">
                          <div className="flex items-center gap-2 text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                            <span className="font-mono break-all text-emerald-400">
                              {deployResult.address}
                            </span>
                            <button
                              onClick={() => copyResult(deployResult.address, 'deploy-addr')}
                              className="text-muted-foreground/40 hover:text-muted-foreground">
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="text-[10px] font-mono text-muted-foreground/50">
                            tx: {deployResult.tx.slice(0, 24)}…
                          </div>
                        </div>
                      )}
                      {deployError && (
                        <p className="mt-2 text-[11px] font-mono text-rose-400 break-all">
                          {deployError}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {(activeSection === 'read' ? reads : activeSection === 'write' ? writes : [])
                  .filter((fn) => !showOnlyBookmarked || (fn.name && bookmarkedFns.has(fn.name)))
                  .map((fn) => {
                    const key = getFnKey(fn);
                    const state = getFnState(key);
                    return (
                      <div
                        key={key}
                        className="overflow-hidden transition-colors border rounded-lg border-border bg-card hover:border-border/80">
                        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => fn.name && toggleBookmark(fn.name)}
                              className="flex-shrink-0 transition-colors text-muted-foreground/20 hover:text-amber-400">
                              {fn.name && bookmarkedFns.has(fn.name) ? (
                                <BookmarkCheck className="w-3 h-3 text-amber-400" />
                              ) : (
                                <Bookmark className="w-3 h-3" />
                              )}
                            </button>
                            <span className="font-mono text-[13px] font-semibold text-foreground">
                              {fn.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {/* Gas estimate button — only for write functions */}
                            {activeSection === 'write' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1 text-[10px] text-amber-400/70 hover:text-amber-400 h-7 px-2"
                                onClick={() => estimateGas(fn)}
                                disabled={!connected || estimating === key}>
                                {estimating === key ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Fuel className="w-3 h-3" />
                                )}
                                Est. Gas
                              </Button>
                            )}

                            {/* Gas estimate result */}
                            {gasEstimates.get(key) && (
                              <div
                                className={cn(
                                  'text-[10px] font-mono px-2.5 py-1.5 rounded-md border flex items-center gap-1.5',
                                  gasEstimates.get(key)!.startsWith('Estimate failed')
                                    ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                                    : 'bg-amber-500/10 border-amber-500/20 text-amber-400',
                                )}>
                                <Fuel className="flex-shrink-0 w-3 h-3" />
                                {gasEstimates.get(key)}
                              </div>
                            )}
                            {fn.stateMutability === 'view' && <Badge variant="view">view</Badge>}
                            {fn.stateMutability === 'pure' && <Badge variant="pure">pure</Badge>}
                            {fn.stateMutability === 'payable' && (
                              <Badge variant="payable">payable</Badge>
                            )}
                            {fn.stateMutability === 'nonpayable' && (
                              <Badge variant="write">write</Badge>
                            )}
                          </div>
                        </div>

                        <div
                          className={cn(
                            'px-4 py-2.5 space-y-2',
                            (fn.inputs?.length ?? 0) === 0 && 'py-1.5',
                          )}>
                          {(fn.inputs || []).map((inp) => (
                            <div key={inp.name} className="flex items-center gap-3">
                              <div className="flex-shrink-0 w-28">
                                <span className="text-[11px] font-mono text-sky-400">
                                  {inp.type}
                                </span>
                                {inp.name && (
                                  <span className="text-[11px] font-mono text-foreground/60 ml-1">
                                    {inp.name}
                                  </span>
                                )}
                              </div>
                              <Input
                                className="flex-1 h-7 text-[11px]"
                                value={state.inputs[inp.name] || ''}
                                onChange={(e) =>
                                  updateFn(key, {
                                    inputs: { ...state.inputs, [inp.name]: e.target.value },
                                  })
                                }
                                placeholder={inp.type === 'bytes32' ? '0x… or string' : inp.type}
                              />
                            </div>
                          ))}

                          <div className="flex items-start gap-3 pt-0.5">
                            <Button
                              variant={activeSection === 'read' ? 'outline' : 'default'}
                              size="sm"
                              className="gap-1.5 flex-shrink-0"
                              onClick={() => callFn(fn)}
                              disabled={!connected || state.loading}>
                              {state.loading ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : activeSection === 'read' ? (
                                <Eye className="w-3 h-3" />
                              ) : (
                                <Send className="w-3 h-3" />
                              )}
                              {state.loading
                                ? 'Calling…'
                                : activeSection === 'read'
                                  ? 'Call'
                                  : 'Send'}
                            </Button>

                            {state.error && (
                              <div className="flex-1 flex items-start gap-2 p-2.5 rounded-md bg-rose-500/10 border border-rose-500/20">
                                <XCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
                                <span className="text-[11px] font-mono text-rose-400 break-all">
                                  {state.error}
                                </span>
                              </div>
                            )}

                            {state.result !== undefined && !state.error && (
                              <div className="flex-1 p-2.5 rounded-md bg-emerald-500/10 border border-emerald-500/15 group relative">
                                <button
                                  className="absolute transition-opacity opacity-0 top-2 right-2 group-hover:opacity-100 text-muted-foreground/40 hover:text-muted-foreground"
                                  onClick={() => copyResult(String(state.result), key)}>
                                  {copyFeedback === key ? (
                                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                                <pre className="text-[11px] font-mono text-emerald-300 whitespace-pre-wrap break-all leading-relaxed">
                                  {String(state.result)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </ScrollArea>
          </>
        )}
      </div>
    </div>
  );
}
