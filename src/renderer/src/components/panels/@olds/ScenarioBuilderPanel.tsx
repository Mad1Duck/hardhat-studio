/**
 * ScenarioBuilderPanel — React Flow edition
 * bun add @xyflow/react @monaco-editor/react
 */
import { useState, useCallback, useEffect, useRef, memo } from 'react';
import {
  ReactFlow,
  Background,
  MiniMap,
  Panel,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  useReactFlow,
  ReactFlowProvider,
  type NodeProps,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type Node,
  type Edge,
  MarkerType,
  ConnectionLineType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import Editor, { useMonaco } from '@monaco-editor/react';
import { ContractAbi, DeployedContract, HardhatAccount, TxRecord } from '../../../types';
import { cn } from '../../../lib/utils';
import { FlowControls } from '../../ui/FlowControls';
import {
  ListOrdered,
  Plus,
  Trash2,
  Play,
  Download,
  Upload,
  RefreshCw,
  Terminal,
  X,
  ChevronDown,
  CheckCircle2,
  XCircle,
  Copy,
  Zap,
  User,
  Eye,
  Timer,
  FileCode,
  ArrowRight,
  Hash,
  Fuel,
  RotateCcw,
  GitBranch,
  Package,
  Merge,
  LayoutDashboard,
  Sparkles,
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Input, Label, ScrollArea } from '../../ui/primitives';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';

//  Types
type ActionType =
  | 'call'
  | 'send'
  | 'wait'
  | 'timeout'
  | 'snapshot'
  | 'revert'
  | 'assert'
  | 'assert_revert'
  | 'log'
  | 'impersonate'
  | 'set_balance'
  | 'custom_script';

type StepStatus = 'idle' | 'running' | 'ok' | 'error' | 'skipped';

interface Step {
  id: string;
  action: ActionType;
  description: string;
  contractAddress: string;
  contractName: string;
  functionName: string;
  args: string;
  value: string;
  fromPrivateKey: string;
  blocks: string;
  timeoutMs: string;
  message: string;
  assertContract: string;
  assertFn: string;
  assertArgs: string;
  assertExpected: string;
  assertOperator: 'eq' | 'gt' | 'lt' | 'gte' | 'lte' | 'includes';
  expectedRevertMsg: string;
  impersonateAddr: string;
  balanceAddr: string;
  balanceEth: string;
  script: string;
  parallelGroup?: string | null;
  status?: StepStatus;
  log?: string;
  txHash?: string;
  gasUsed?: string;
  duration?: number;
}

interface CustomEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

interface Scenario {
  id: string;
  name: string;
  steps: Step[];
  customEdges: CustomEdge[];
  createdAt: number;
  nodePositions?: Record<string, { x: number; y: number }>;
}

interface RunLog {
  stepId: string;
  status: StepStatus;
  message: string;
  txHash?: string;
  gasUsed?: string;
  duration?: number;
  timestamp: number;
}

interface Props {
  abis: ContractAbi[];
  deployedContracts: DeployedContract[];
  rpcUrl: string;
  onTxRecorded: (tx: TxRecord) => void;
}

//  Parallel group palette
const GROUP_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  A: { color: '#f472b6', bg: '#1f0015', border: '#ec4899' },
  B: { color: '#38bdf8', bg: '#0c1a2e', border: '#0ea5e9' },
  C: { color: '#34d399', bg: '#0a1f16', border: '#10b981' },
  D: { color: '#fbbf24', bg: '#1a1200', border: '#f59e0b' },
  E: { color: '#c084fc', bg: '#150a24', border: '#a855f7' },
};
const GROUP_IDS = Object.keys(GROUP_COLORS);

//  Action metadata
const ACTIONS: {
  id: ActionType;
  icon: string;
  label: string;
  color: string;
  bg: string;
  border: string;
  group: string;
  desc: string;
}[] = [
  {
    id: 'call',
    icon: '⚡',
    label: 'Call (read)',
    color: '#38bdf8',
    bg: '#0c1a2e',
    border: '#0ea5e9',
    group: 'contract',
    desc: 'Read data from contract (view/pure)',
  },
  {
    id: 'send',
    icon: '📤',
    label: 'Send Tx',
    color: '#34d399',
    bg: '#0a1f16',
    border: '#10b981',
    group: 'contract',
    desc: 'Write transaction to contract',
  },
  {
    id: 'assert',
    icon: '✅',
    label: 'Assert Equal',
    color: '#4ade80',
    bg: '#0a1a0a',
    border: '#22c55e',
    group: 'test',
    desc: 'Assert a return value equals expected',
  },
  {
    id: 'assert_revert',
    icon: '💥',
    label: 'Assert Revert',
    color: '#fb923c',
    bg: '#1f0e00',
    border: '#f97316',
    group: 'test',
    desc: 'Assert a tx reverts with message',
  },
  {
    id: 'wait',
    icon: '⛏️',
    label: 'Mine Blocks',
    color: '#fbbf24',
    bg: '#1a1200',
    border: '#f59e0b',
    group: 'chain',
    desc: 'Mine N blocks on local chain',
  },
  {
    id: 'timeout',
    icon: '⏱️',
    label: 'Sleep',
    color: '#c084fc',
    bg: '#150a24',
    border: '#a855f7',
    group: 'chain',
    desc: 'Pause execution for N milliseconds',
  },
  {
    id: 'snapshot',
    icon: '📸',
    label: 'Snapshot',
    color: '#22d3ee',
    bg: '#001a1f',
    border: '#06b6d4',
    group: 'chain',
    desc: 'Save EVM state snapshot ID',
  },
  {
    id: 'revert',
    icon: '⏪',
    label: 'Revert Snap',
    color: '#f472b6',
    bg: '#1f0015',
    border: '#ec4899',
    group: 'chain',
    desc: 'Revert EVM to a snapshot ID',
  },
  {
    id: 'impersonate',
    icon: '🎭',
    label: 'Impersonate',
    color: '#818cf8',
    bg: '#0d0f24',
    border: '#6366f1',
    group: 'chain',
    desc: 'Impersonate an address (Hardhat only)',
  },
  {
    id: 'set_balance',
    icon: '💰',
    label: 'Set Balance',
    color: '#fde68a',
    bg: '#1a1400',
    border: '#fcd34d',
    group: 'chain',
    desc: 'Set ETH balance for an address',
  },
  {
    id: 'log',
    icon: '📝',
    label: 'Log',
    color: '#94a3b8',
    bg: '#0f1520',
    border: '#334155',
    group: 'util',
    desc: 'Print a message to the run log',
  },
  {
    id: 'custom_script',
    icon: '🧩',
    label: 'Custom Script',
    color: '#f472b6',
    bg: '#1f0d18',
    border: '#ec4899',
    group: 'util',
    desc: 'Run arbitrary JS with ethers + contracts',
  },
];

const ACTION_GROUPS = ['contract', 'test', 'chain', 'util'];
const GROUP_LABELS: Record<string, string> = {
  contract: '📄 Contract',
  test: '🧪 Test',
  chain: '⛓ Chain',
  util: '🔧 Util',
};

function makeStep(action: ActionType): Step {
  const meta = ACTIONS.find((a) => a.id === action);
  return {
    id: crypto.randomUUID(),
    action,
    description: meta?.label || action,
    contractAddress: '',
    contractName: '',
    functionName: '',
    args: '',
    value: '0',
    fromPrivateKey: '',
    blocks: '1',
    timeoutMs: '0',
    message: '',
    assertContract: '',
    assertFn: '',
    assertArgs: '',
    assertExpected: '',
    assertOperator: 'eq',
    expectedRevertMsg: '',
    impersonateAddr: '',
    balanceAddr: '',
    balanceEth: '10',
    script:
      action === 'custom_script'
        ? `// Available: ethers, provider, signer, accounts, contracts, console\nconst bal = await provider.getBalance(accounts[0].address)\nconsole.log('Balance:', ethers.formatEther(bal), 'ETH')`
        : '',
    parallelGroup: null,
    status: 'idle',
  };
}

//  Package detection
function detectImports(code: string): string[] {
  const pkgs = new Set<string>();
  const esImport = /import\s+(?:.*?\s+from\s+)?['"]([^'"./][^'"]*)['"]/g;
  const cjsRequire = /require\s*\(\s*['"]([^'"./][^'"]*)['"]\s*\)/g;
  let m;
  while ((m = esImport.exec(code)) !== null) pkgs.add(m[1].split('/')[0]);
  while ((m = cjsRequire.exec(code)) !== null) pkgs.add(m[1].split('/')[0]);
  return [...pkgs];
}

//  RPC helper
async function rpcCall(url: string, method: string, params: unknown[] = []) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return d.result;
}

//  Run a single step
async function runStep(
  step: Step,
  deployed: DeployedContract[],
  rpcUrl: string,
  hhAccounts: HardhatAccount[],
): Promise<{ ok: boolean; message: string; txHash?: string; gasUsed?: string }> {
  const ethers = await import('ethers');
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const pk = step.fromPrivateKey || hhAccounts[0]?.privateKey;
  const signer = pk ? new ethers.Wallet(pk, provider) : null;

  if (step.action === 'timeout') {
    const ms = Math.max(0, parseInt(step.timeoutMs) || 0);
    if (ms > 0) await new Promise((r) => setTimeout(r, ms));
    return { ok: true, message: `⏱ Slept ${ms}ms` };
  }
  if (step.action === 'wait') {
    const n = Math.max(1, parseInt(step.blocks) || 1);
    for (let i = 0; i < n; i++) await rpcCall(rpcUrl, 'evm_mine');
    return { ok: true, message: `⛏ Mined ${n} block${n > 1 ? 's' : ''}` };
  }
  if (step.action === 'snapshot') {
    const id = await rpcCall(rpcUrl, 'evm_snapshot');
    return { ok: true, message: `📸 Snapshot saved: ${id}` };
  }
  if (step.action === 'revert') {
    const id = step.message || '0x1';
    await rpcCall(rpcUrl, 'evm_revert', [id]);
    return { ok: true, message: `⏪ Reverted to snapshot ${id}` };
  }
  if (step.action === 'impersonate') {
    await rpcCall(rpcUrl, 'hardhat_impersonateAccount', [step.impersonateAddr]);
    return { ok: true, message: `🎭 Impersonating ${step.impersonateAddr}` };
  }
  if (step.action === 'set_balance') {
    const wei = ethers.parseEther(step.balanceEth || '10').toString(16);
    await rpcCall(rpcUrl, 'hardhat_setBalance', [step.balanceAddr, `0x${wei}`]);
    return {
      ok: true,
      message: `💰 Set ${step.balanceAddr.slice(0, 10)}… = ${step.balanceEth} ETH`,
    };
  }
  if (step.action === 'log') return { ok: true, message: `📝 ${step.message || '(empty)'}` };

  const findContract = (addr: string, name: string) =>
    deployed.find(
      (c) => (addr && c.address.toLowerCase() === addr.toLowerCase()) || (name && c.name === name),
    );

  if (step.action === 'call' || step.action === 'send') {
    const dc = findContract(step.contractAddress, step.contractName);
    if (!dc)
      return {
        ok: false,
        message: `Contract not found: ${step.contractName || step.contractAddress}`,
      };
    const fnDef = dc.abi.find((i) => i.name === step.functionName && i.type === 'function');
    if (!fnDef) return { ok: false, message: `Function not found: ${step.functionName}` };
    const isRead = fnDef.stateMutability === 'view' || fnDef.stateMutability === 'pure';
    try {
      const parsedArgs = step.args.trim()
        ? step.args.split(',').map((a) => {
            const t = a.trim();
            if (t === 'true') return true;
            if (t === 'false') return false;
            if (/^-?\d+$/.test(t)) return BigInt(t);
            return t;
          })
        : [];
      const instance = new ethers.Contract(
        dc.address,
        dc.abi,
        isRead ? provider : signer || provider,
      );
      const fn = instance[step.functionName] as (...a: unknown[]) => Promise<unknown>;
      if (!fn) return { ok: false, message: `${step.functionName} not found on ABI` };
      const overrides: Record<string, unknown> = {};
      if (!isRead && step.value && step.value !== '0')
        overrides.value = ethers.parseEther(step.value);
      const callArgs = Object.keys(overrides).length ? [...parsedArgs, overrides] : parsedArgs;
      const result = await fn(...callArgs);
      if (isRead) {
        const str =
          typeof result === 'bigint'
            ? result.toString()
            : JSON.stringify(result, (_, v) => (typeof v === 'bigint' ? v.toString() : v));
        return { ok: true, message: `→ ${str}` };
      } else {
        const receipt = await (
          result as { wait: () => Promise<{ hash: string; gasUsed: bigint }> }
        ).wait();
        return {
          ok: true,
          message: `✓ ${step.functionName}()`,
          txHash: receipt.hash,
          gasUsed: receipt.gasUsed?.toString(),
        };
      }
    } catch (e: any) {
      return { ok: false, message: e.reason || e.shortMessage || e.message || String(e) };
    }
  }

  if (step.action === 'assert') {
    const dc = findContract(step.assertContract, step.assertContract);
    if (!dc) return { ok: false, message: `Assert contract not found: ${step.assertContract}` };
    try {
      const instance = new ethers.Contract(dc.address, dc.abi, provider);
      const fnRef = instance[step.assertFn] as (...a: unknown[]) => Promise<unknown>;
      if (!fnRef) return { ok: false, message: `Function ${step.assertFn} not on ABI` };
      const args = step.assertArgs ? step.assertArgs.split(',').map((a) => a.trim()) : [];
      const actual = await fnRef(...args);
      const actualStr = typeof actual === 'bigint' ? actual.toString() : String(actual);
      const expected = step.assertExpected;
      let passed = false;
      const op = step.assertOperator || 'eq';
      if (op === 'eq')
        passed = actualStr === expected || actualStr.toLowerCase() === expected.toLowerCase();
      else if (op === 'includes') passed = actualStr.includes(expected);
      else {
        const an = Number(actualStr),
          en = Number(expected);
        if (op === 'gt') passed = an > en;
        else if (op === 'lt') passed = an < en;
        else if (op === 'gte') passed = an >= en;
        else if (op === 'lte') passed = an <= en;
      }
      return {
        ok: passed,
        message: passed
          ? `✅ ${step.assertFn}() ${op} ${expected} → ${actualStr}`
          : `❌ Expected ${step.assertFn}() ${op} "${expected}", got "${actualStr}"`,
      };
    } catch (e: any) {
      return { ok: false, message: `Assert error: ${e.message}` };
    }
  }

  if (step.action === 'assert_revert') {
    const dc = findContract(step.assertContract, step.assertContract);
    if (!dc) return { ok: false, message: `Contract not found: ${step.assertContract}` };
    try {
      const instance = new ethers.Contract(dc.address, dc.abi, signer || provider);
      const fn = instance[step.functionName] as (...a: unknown[]) => Promise<unknown>;
      const args = step.args.trim() ? step.args.split(',').map((a) => a.trim()) : [];
      await fn(...args);
      return { ok: false, message: `Expected revert but call succeeded` };
    } catch (e: any) {
      const msg = e.reason || e.shortMessage || e.message || '';
      if (!step.expectedRevertMsg || msg.includes(step.expectedRevertMsg)) {
        return { ok: true, message: `💥 Correctly reverted: ${msg.slice(0, 80)}` };
      }
      return {
        ok: false,
        message: `Wrong revert: expected "${step.expectedRevertMsg}", got "${msg}"`,
      };
    }
  }

  if (step.action === 'custom_script') {
    const logs: string[] = [];
    const fakeConsole = {
      log: (...a: unknown[]) => logs.push(a.map(String).join(' ')),
      error: (...a: unknown[]) => logs.push('ERR: ' + a.map(String).join(' ')),
      warn: (...a: unknown[]) => logs.push('WARN: ' + a.map(String).join(' ')),
    };
    const contracts: Record<string, unknown> = {};
    deployed.forEach((dc) => {
      contracts[dc.name] = new (ethers as any).Contract(dc.address, dc.abi, signer || provider);
    });
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function(
        'ethers',
        'provider',
        'signer',
        'accounts',
        'contracts',
        'console',
        `return (async()=>{ ${step.script} })()`,
      );
      await fn(ethers, provider, signer, hhAccounts, contracts, fakeConsole);
      return { ok: true, message: logs.length ? logs.join('\n') : '✓ Script done' };
    } catch (e: any) {
      return { ok: false, message: `Script error: ${e.message}` };
    }
  }

  return { ok: false, message: 'Unknown action' };
}

//  Parallel batch builder
function buildBatches(steps: Step[]): Step[][] {
  const batches: Step[][] = [];
  const seen = new Set<string>();
  let i = 0;
  while (i < steps.length) {
    const step = steps[i];
    const pg = step.parallelGroup;
    if (pg && !seen.has(pg)) {
      const group = steps.filter((s) => s.parallelGroup === pg);
      group.forEach((s) => seen.add(s.id));
      seen.add(pg);
      batches.push(group);
      while (i < steps.length && steps[i].parallelGroup === pg) i++;
    } else if (seen.has(step.id)) {
      i++;
    } else {
      batches.push([step]);
      i++;
    }
  }
  return batches;
}

//  Auto-layout: DAG topological layout (respects custom edges)
const NODE_WIDTH = 240;
const NODE_HEIGHT = 160;
const NODE_GAP_X = 80;
const NODE_GAP_Y = 70;
const FORK_SIZE = 28;
const FORK_GAP_Y = 55;

/**
 * Builds a full node-id list (including fork/join synthetics) and returns
 * their positions using a Sugiyama-style layer assignment:
 *
 * 1. Build adjacency from BOTH auto-edges (fork→step, step→join) AND
 *    custom (user-drawn) edges.
 * 2. Assign each node a layer via longest-path from roots (Kahn's algo).
 * 3. Within each layer, sort nodes left-to-right and spread horizontally.
 * 4. Nodes with no connections at all fall back to the step-array order.
 */
function computeLayout(
  steps: Step[],
  customEdges: CustomEdge[] = [],
): Map<string, { x: number; y: number }> {
  const batches = buildBatches(steps);

  //  1. Collect all node IDs (step + fork/join diamonds)
  const allNodeIds: string[] = [];
  const batchOfNode = new Map<string, Step[]>(); // nodeId → its batch

  batches.forEach((batch, bi) => {
    const isParallel = batch.length > 1 && !!batch[0].parallelGroup;
    const pgId = isParallel ? batch[0].parallelGroup! : null;

    if (isParallel && pgId) {
      const forkId = `fork-${pgId}-${bi}`;
      const joinId = `join-${pgId}-${bi}`;
      allNodeIds.push(forkId);
      batch.forEach((s) => {
        allNodeIds.push(s.id);
        batchOfNode.set(s.id, batch);
      });
      allNodeIds.push(joinId);
      batchOfNode.set(forkId, batch);
      batchOfNode.set(joinId, batch);
    } else {
      allNodeIds.push(batch[0].id);
      batchOfNode.set(batch[0].id, batch);
    }
  });

  const nodeSet = new Set(allNodeIds);

  //  2. Build adjacency list from auto-edges + custom edges
  // Auto-edges: fork→step and step→join (from parallel groups)
  const adjOut = new Map<string, Set<string>>(); // src → targets
  const adjIn = new Map<string, Set<string>>(); // tgt → sources
  const ensure = (id: string) => {
    if (!adjOut.has(id)) adjOut.set(id, new Set());
    if (!adjIn.has(id)) adjIn.set(id, new Set());
  };
  allNodeIds.forEach(ensure);

  const addEdge = (src: string, tgt: string) => {
    if (!nodeSet.has(src) || !nodeSet.has(tgt)) return;
    adjOut.get(src)!.add(tgt);
    adjIn.get(tgt)!.add(src);
  };

  // Auto: fork→step, step→join
  batches.forEach((batch, bi) => {
    const isParallel = batch.length > 1 && !!batch[0].parallelGroup;
    const pgId = isParallel ? batch[0].parallelGroup! : null;
    if (isParallel && pgId) {
      const forkId = `fork-${pgId}-${bi}`;
      const joinId = `join-${pgId}-${bi}`;
      batch.forEach((s) => {
        addEdge(forkId, s.id);
        addEdge(s.id, joinId);
      });
    }
  });

  // Custom (user-drawn) edges
  customEdges.forEach((ce) => addEdge(ce.source, ce.target));

  //  3. Topological sort → layer assignment (longest-path / critical-path)
  // Layer = max distance from any root (Kahn's BFS with longest-path variant)
  const layer = new Map<string, number>();
  const inDeg = new Map<string, number>();
  allNodeIds.forEach((id) => inDeg.set(id, adjIn.get(id)!.size));

  const queue: string[] = allNodeIds.filter((id) => inDeg.get(id) === 0);
  queue.forEach((id) => layer.set(id, 0));

  while (queue.length) {
    const cur = queue.shift()!;
    const curLayer = layer.get(cur) ?? 0;
    adjOut.get(cur)!.forEach((tgt) => {
      const proposed = curLayer + 1;
      if ((layer.get(tgt) ?? -1) < proposed) layer.set(tgt, proposed);
      const deg = (inDeg.get(tgt) ?? 1) - 1;
      inDeg.set(tgt, deg);
      if (deg === 0) queue.push(tgt);
    });
  }

  // Nodes with no edges at all → assign layer by their order in allNodeIds
  // (sequential fallback so they still appear top-to-bottom)
  let fallbackLayer = 0;
  allNodeIds.forEach((id) => {
    if (!layer.has(id)) {
      layer.set(id, fallbackLayer);
      fallbackLayer++;
    }
  });

  //  4. Bucket nodes by layer
  const layerBuckets = new Map<number, string[]>();
  allNodeIds.forEach((id) => {
    const l = layer.get(id) ?? 0;
    if (!layerBuckets.has(l)) layerBuckets.set(l, []);
    layerBuckets.get(l)!.push(id);
  });

  const sortedLayers = Array.from(layerBuckets.keys()).sort((a, b) => a - b);

  //  5. Assign X positions within each layer
  // Fork/join diamonds are always centered; step nodes spread horizontally.
  const positions = new Map<string, { x: number; y: number }>();
  let y = 60;

  sortedLayers.forEach((layerIdx) => {
    const ids = layerBuckets.get(layerIdx)!;

    // Separate diamonds from step nodes for width calc
    const stepIds = ids.filter((id) => !id.startsWith('fork-') && !id.startsWith('join-'));
    const diagIds = ids.filter((id) => id.startsWith('fork-') || id.startsWith('join-'));

    // Compute row height: diamonds are short, step nodes are tall
    const rowH = stepIds.length > 0 ? NODE_HEIGHT : FORK_SIZE;

    if (stepIds.length > 0) {
      // Spread step nodes horizontally, centered at x=0
      const totalW = stepIds.length * NODE_WIDTH + (stepIds.length - 1) * NODE_GAP_X;
      const startX = -totalW / 2 + NODE_WIDTH / 2;
      stepIds.forEach((id, si) => {
        positions.set(id, { x: startX + si * (NODE_WIDTH + NODE_GAP_X), y });
      });
    }

    // Diamonds always at center x
    diagIds.forEach((id) => {
      positions.set(id, { x: -FORK_SIZE / 2, y: y + (stepIds.length > 0 ? 0 : 0) });
    });

    // Gap between layers: diamond rows get less space
    y += rowH + (stepIds.length > 0 ? NODE_GAP_Y : FORK_GAP_Y);
  });

  return positions;
}

//  React Flow node
type StepNodeData = {
  step: Step;
  index: number;
  isActive: boolean;
  isSelected: boolean;
  onSelect: (id: string) => void;
};

const StepNode = memo(({ data, selected }: NodeProps) => {
  const d = data as StepNodeData;
  const { step, index, isActive } = d;
  const meta = ACTIONS.find((a) => a.id === step.action)!;
  const status = step.status || 'idle';
  const pgColor = step.parallelGroup ? GROUP_COLORS[step.parallelGroup] : null;

  const statusRing = {
    running: '#f59e0b',
    ok: '#10b981',
    error: '#f43f5e',
    skipped: '#64748b',
    idle: pgColor?.border || meta.border,
  }[status];

  const glowStyle =
    status === 'running'
      ? `0 0 0 2px ${statusRing}55, 0 0 20px ${statusRing}44`
      : selected
        ? `0 0 0 2px ${meta.border}88`
        : `0 0 8px ${meta.border}22`;

  return (
    <div
      onClick={() => d.onSelect(step.id)}
      style={{
        background: `#161b22f0`,
        border: `1.5px solid ${statusRing}`,
        boxShadow: glowStyle,
        borderRadius: 10,
        minWidth: 200,
        maxWidth: 240,
        cursor: 'pointer',
        transition: 'box-shadow 0.25s, border-color 0.25s',
        fontFamily: "'JetBrains Mono', monospace",
        animation: status === 'running' ? 'pulse 1.5s infinite' : undefined,
        outline: pgColor ? `2px solid ${pgColor.border}44` : undefined,
        outlineOffset: 3,
      }}>
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: pgColor?.border || meta.border,
          width: 10,
          height: 10,
          border: `2px solid #080d14`,
          top: -6,
          opacity: 1,
          cursor: 'crosshair',
          transition: 'transform 0.15s, box-shadow 0.15s',
          boxShadow: `0 0 0 3px ${pgColor?.border || meta.border}33`,
        }}
      />

      {step.parallelGroup && (
        <div
          style={{
            position: 'absolute',
            top: -10,
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: 8,
            fontWeight: 700,
            color: pgColor!.color,
            background: `#161b22f0`,
            border: `1px solid ${pgColor!.border}66`,
            borderRadius: 4,
            padding: '1px 6px',
            letterSpacing: '0.08em',
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            whiteSpace: 'nowrap',
          }}>
          <GitBranch style={{ width: 7, height: 7 }} /> GROUP {step.parallelGroup}
        </div>
      )}

      <div
        style={{
          padding: '7px 10px 5px',
          borderBottom: `1px solid ${meta.border}22`,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
        <span style={{ fontSize: 14 }}>{meta.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: meta.color,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}>
            {meta.label}
          </div>
          <div
            style={{
              fontSize: 11,
              color: '#94a3b8',
              marginTop: 1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
            {step.description}
          </div>
        </div>
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: `${statusRing}22`,
            border: `1.5px solid ${statusRing}55`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 9,
            fontWeight: 700,
            color: meta.color,
            flexShrink: 0,
          }}>
          {index + 1}
        </div>
      </div>

      <div style={{ padding: '6px 10px 8px', fontSize: 10, color: '#64748b' }}>
        {(step.action === 'call' || step.action === 'send') && (
          <>
            {step.contractName && (
              <div style={{ color: '#7dd3fc', marginBottom: 2 }}>📄 {step.contractName}</div>
            )}
            {step.functionName && (
              <div style={{ color: meta.color, opacity: 0.8 }}>
                ƒ {step.functionName}({step.args || ''})
              </div>
            )}
          </>
        )}
        {step.action === 'wait' && (
          <div style={{ color: '#fbbf24' }}>
            ⛏ {step.blocks} block{step.blocks !== '1' ? 's' : ''}
          </div>
        )}
        {step.action === 'timeout' && <div style={{ color: '#c084fc' }}>⏱ {step.timeoutMs}ms</div>}
        {step.action === 'assert' && step.assertFn && (
          <div style={{ color: '#4ade80' }}>
            {step.assertFn}() {step.assertOperator} {step.assertExpected}
          </div>
        )}
        {step.action === 'log' && step.message && (
          <div style={{ color: '#94a3b8', fontStyle: 'italic' }}>"{step.message}"</div>
        )}
        {step.action === 'custom_script' && (
          <div style={{ color: '#f472b6', opacity: 0.6 }}>JS script</div>
        )}

        {step.log && (
          <div
            style={{
              marginTop: 6,
              padding: '4px 6px',
              borderRadius: 4,
              background:
                status === 'ok' ? '#10b98115' : status === 'error' ? '#f43f5e15' : '#f59e0b15',
              color: status === 'ok' ? '#34d399' : status === 'error' ? '#f87171' : '#fbbf24',
              fontSize: 9,
              wordBreak: 'break-all',
              lineHeight: 1.4,
            }}>
            {step.log.slice(0, 80)}
            {step.log.length > 80 ? '…' : ''}
          </div>
        )}

        {(step.gasUsed || step.duration) && (
          <div style={{ marginTop: 4, display: 'flex', gap: 8, fontSize: 9, color: '#475569' }}>
            {step.gasUsed && <span>⛽ {parseInt(step.gasUsed).toLocaleString()} gas</span>}
            {step.duration && <span>⏱ {step.duration}ms</span>}
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: pgColor?.border || meta.border,
          width: 10,
          height: 10,
          border: `2px solid #080d14`,
          bottom: -6,
          opacity: 1,
          cursor: 'crosshair',
          transition: 'transform 0.15s, box-shadow 0.15s',
          boxShadow: `0 0 0 3px ${pgColor?.border || meta.border}33`,
        }}
      />
    </div>
  );
});
StepNode.displayName = 'StepNode';

//  Fork / Join diamond nodes
type ForkJoinData = {
  kind: 'fork' | 'join';
  groupId: string;
  allOk: boolean;
  anyRunning: boolean;
  anyError: boolean;
};

const ForkJoinNode = memo(({ data }: NodeProps) => {
  const d = data as ForkJoinData;
  const pgColor = GROUP_COLORS[d.groupId] || GROUP_COLORS['A'];
  const borderColor = d.anyError
    ? '#f43f5e'
    : d.allOk
      ? '#10b981'
      : d.anyRunning
        ? '#f59e0b'
        : pgColor.border;
  const size = 28;

  return (
    <div
      style={{
        width: size,
        height: size,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <div
        style={{
          width: size,
          height: size,
          background: d.anyError
            ? '#161b22'
            : d.allOk
              ? '#161b22'
              : d.anyRunning
                ? '#161b22'
                : `#161b22f0`,
          border: `2px solid ${borderColor}`,
          borderRadius: 4,
          transform: 'rotate(45deg)',
          position: 'absolute',
          boxShadow: d.anyRunning ? `0 0 12px ${borderColor}66` : `0 0 6px ${borderColor}33`,
          transition: 'all 0.3s',
        }}
      />
      <span
        style={{
          position: 'relative',
          zIndex: 1,
          fontSize: 8,
          fontWeight: 800,
          color: borderColor,
          letterSpacing: '0.05em',
          userSelect: 'none',
          fontFamily: "'JetBrains Mono', monospace",
        }}>
        {d.kind === 'fork' ? '⑆' : '⑇'}
      </span>
      <div
        style={{
          position: 'absolute',
          [d.kind === 'fork' ? 'bottom' : 'top']: -18,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 7,
          fontWeight: 700,
          color: pgColor.color,
          whiteSpace: 'nowrap',
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: '0.06em',
          opacity: 0.8,
        }}>
        {d.kind === 'fork' ? 'FORK' : 'JOIN'} {d.groupId}
      </div>
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: borderColor,
          width: 6,
          height: 6,
          border: `2px solid #080d14`,
          top: -4,
          opacity: 0,
        }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: borderColor,
          width: 6,
          height: 6,
          border: `2px solid #080d14`,
          bottom: -4,
          opacity: 0,
        }}
      />
    </div>
  );
});
ForkJoinNode.displayName = 'ForkJoinNode';

const NODE_TYPES = { step: StepNode, forkjoin: ForkJoinNode };

//  Build React Flow graph
function buildFlow(
  steps: Step[],
  activeStepId: string | null,
  selectedId: string | null,
  onSelect: (id: string) => void,
  customEdges: CustomEdge[] = [],
  layoutPositions?: Map<string, { x: number; y: number }>,
) {
  const batches = buildBatches(steps);
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Use provided layout or compute fresh (DAG-aware: respects custom edges)
  const positions = layoutPositions || computeLayout(steps, customEdges);

  batches.forEach((batch, bi) => {
    const isParallel = batch.length > 1 && !!batch[0].parallelGroup;
    const pgId = isParallel ? batch[0].parallelGroup! : null;
    const pgColor = pgId ? GROUP_COLORS[pgId] : null;

    const allOk = batch.every((s) => s.status === 'ok');
    const anyRunning = batch.some((s) => s.status === 'running');
    const anyError = batch.some((s) => s.status === 'error');

    if (isParallel && pgId) {
      const forkId = `fork-${pgId}-${bi}`;
      const joinId = `join-${pgId}-${bi}`;

      const forkPos = positions.get(forkId) || { x: -14, y: 40 };
      nodes.push({
        id: forkId,
        type: 'forkjoin',
        position: forkPos,
        data: { kind: 'fork', groupId: pgId, allOk, anyRunning, anyError } as ForkJoinData,
        style: { background: 'transparent', border: 'none', padding: 0 },
        selectable: false,
        draggable: false,
      });

      batch.forEach((step, si) => {
        const pos = positions.get(step.id) || { x: si * (NODE_WIDTH + NODE_GAP_X), y: 100 };
        nodes.push({
          id: step.id,
          type: 'step',
          position: pos,
          data: {
            step,
            index: steps.indexOf(step),
            isActive: step.id === activeStepId,
            isSelected: step.id === selectedId,
            onSelect,
          },
          style: { background: 'transparent', border: 'none', padding: 0 },
        });

        edges.push({
          id: `e-${forkId}-${step.id}`,
          source: forkId,
          target: step.id,
          type: 'smoothstep',
          markerEnd: { type: MarkerType.ArrowClosed, color: pgColor?.border || '#334155' },
          style: {
            stroke: pgColor ? `${pgColor.border}88` : '#33415566',
            strokeWidth: 1.5,
            strokeDasharray: step.status === 'idle' ? '5,4' : undefined,
          },
          animated: step.status === 'running',
        });
      });

      const joinPos = positions.get(joinId) || { x: -14, y: 300 };
      nodes.push({
        id: joinId,
        type: 'forkjoin',
        position: joinPos,
        data: { kind: 'join', groupId: pgId, allOk, anyRunning, anyError } as ForkJoinData,
        style: { background: 'transparent', border: 'none', padding: 0 },
        selectable: false,
        draggable: false,
      });

      batch.forEach((step) => {
        edges.push({
          id: `e-${step.id}-${joinId}`,
          source: step.id,
          target: joinId,
          type: 'smoothstep',
          markerEnd: { type: MarkerType.ArrowClosed, color: pgColor?.border || '#334155' },
          style: {
            stroke:
              step.status === 'ok'
                ? pgColor
                  ? `${pgColor.border}88`
                  : '#10b98155'
                : pgColor
                  ? `${pgColor.border}44`
                  : '#33415566',
            strokeWidth: step.status === 'ok' ? 2 : 1.5,
            strokeDasharray: step.status === 'idle' ? '5,4' : undefined,
          },
          animated: anyRunning && step.status !== 'ok',
        });
      });
    } else {
      const step = batch[0];
      const pos = positions.get(step.id) || { x: -NODE_WIDTH / 2, y: 40 };
      nodes.push({
        id: step.id,
        type: 'step',
        position: pos,
        data: {
          step,
          index: steps.indexOf(step),
          isActive: step.id === activeStepId,
          isSelected: step.id === selectedId,
          onSelect,
        },
        style: { background: 'transparent', border: 'none', padding: 0 },
      });
    }
  });

  // Custom edges (visual-only / flow arrows)
  const autoEdgeIds = new Set(edges.map((e) => e.id));
  customEdges.forEach((ce) => {
    if (autoEdgeIds.has(ce.id)) return;
    edges.push({
      id: ce.id,
      source: ce.source,
      target: ce.target,
      type: 'smoothstep',
      label: ce.label || undefined,
      labelStyle: { fontSize: 9, fill: '#94a3b8', fontFamily: "'JetBrains Mono', monospace" },
      labelBgStyle: { fill: '#0d1117', fillOpacity: 0.9 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
      style: { stroke: '#6366f1', strokeWidth: 2, strokeDasharray: '6,3' },
    });
  });

  return { nodes, edges };
}

//  Monaco Custom Script Editor
const ETHERS_TYPES = `
declare const ethers: typeof import('ethers');
declare const provider: import('ethers').JsonRpcProvider;
declare const signer: import('ethers').Wallet | null;
declare const accounts: Array<{ address: string; privateKey: string }>;
declare const contracts: Record<string, import('ethers').Contract>;
declare const console: {
  log: (...args: any[]) => void;
  error: (...args: any[]) => void;
  warn: (...args: any[]) => void;
};
`;

function MonacoScriptEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const monaco = useMonaco();
  const [detectedPkgs, setDetectedPkgs] = useState<string[]>([]);

  useEffect(() => {
    if (!monaco) return;
    // monaco.typescript may be undefined if the TS worker hasn't registered yet;
    // use the languages API which is always available after monaco is ready.
    try {
      const ts = (monaco as any).languages?.typescript;
      if (!ts) return;
      const defaults = ts.typescriptDefaults;
      defaults.addExtraLib(ETHERS_TYPES, 'file:///env.d.ts');
      defaults.setCompilerOptions({
        target: ts.ScriptTarget?.ES2020 ?? 99,
        allowNonTsExtensions: true,
        moduleResolution: ts.ModuleResolutionKind?.NodeJs ?? 2,
        allowSyntheticDefaultImports: true,
      });
      defaults.setDiagnosticsOptions({ noSemanticValidation: false, noSyntaxValidation: false });
    } catch {
      // TS worker not ready yet — will retry on next monaco instance
    }
  }, [monaco]);

  useEffect(() => {
    setDetectedPkgs(detectImports(value));
  }, [value]);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <Label className="text-[10px] flex items-center gap-1">
          <FileCode className="w-3 h-3 text-pink-400" /> Script
          <span className="ml-1 font-normal text-muted-foreground/30">TypeScript · ethers v6</span>
        </Label>
      </div>
      {detectedPkgs.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 p-2 mb-2 border rounded-lg bg-amber-500/10 border-amber-500/20">
          <Package className="flex-shrink-0 w-3 h-3 text-amber-400" />
          <span className="text-[9px] text-amber-400/80 mr-1">Detected imports:</span>
          {detectedPkgs.map((pkg) => (
            <span
              key={pkg}
              className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/20">
              {pkg}
            </span>
          ))}
          <span className="text-[9px] text-amber-400/40 ml-auto">⚠ ensure bundled</span>
        </div>
      )}
      <div className="overflow-hidden border rounded-lg border-border/50 focus-within:border-pink-500/40">
        <Editor
          height="220px"
          defaultLanguage="typescript"
          theme="vs-dark"
          value={value}
          onChange={(v) => onChange(v || '')}
          options={{
            minimap: { enabled: false },
            fontSize: 11,
            lineNumbers: 'on',
            wordWrap: 'on',
            scrollBeyondLastLine: false,
            tabSize: 2,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontLigatures: true,
            renderLineHighlight: 'gutter',
            padding: { top: 8, bottom: 8 },
            scrollbar: { verticalScrollbarSize: 4 },
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            suggest: { showKeywords: true },
          }}
        />
      </div>
      <p className="text-[9px] text-muted-foreground/25 mt-1">
        vars: <span className="text-pink-400/50">ethers</span> ·{' '}
        <span className="text-pink-400/50">provider</span> ·{' '}
        <span className="text-pink-400/50">signer</span> ·{' '}
        <span className="text-pink-400/50">accounts</span> ·{' '}
        <span className="text-pink-400/50">contracts</span> ·{' '}
        <span className="text-pink-400/50">console</span>
      </p>
    </div>
  );
}

//  Inner canvas component (needs ReactFlow context)
function CanvasInner({
  rfNodes,
  rfEdges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  showAddMenu,
  setShowAddMenu,
  addStep,
  active,
}: {
  rfNodes: Node[];
  rfEdges: Edge[];
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  showAddMenu: boolean;
  setShowAddMenu: (v: boolean | ((p: boolean) => boolean)) => void;
  addStep: (a: ActionType) => void;
  active: Scenario;
}) {
  const { fitView, setNodes } = useReactFlow();

  // Auto-beautify: recompute DAG layout (respects flow arrows) then fit view
  const handleBeautify = useCallback(() => {
    const positions = computeLayout(active.steps, active.customEdges || []);
    setNodes((nodes) =>
      nodes.map((n) => {
        const pos = positions.get(n.id);
        if (pos) return { ...n, position: pos };
        return n;
      }),
    );
    setTimeout(() => fitView({ padding: 0.3, duration: 400 }), 50);
  }, [active.steps, active.customEdges, fitView, setNodes]);

  return (
    <ReactFlow
      nodes={rfNodes}
      edges={rfEdges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      nodeTypes={NODE_TYPES}
      fitView
      fitViewOptions={{ padding: 0.3 }}
      minZoom={0.2}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
      deleteKeyCode={['Backspace', 'Delete']}
      connectionLineStyle={{ stroke: '#6366f1', strokeWidth: 2, strokeDasharray: '6,3' }}
      connectionLineType={ConnectionLineType.SmoothStep}
      style={{ background: '#0d1117' }}>
      <Background color="#21262d" gap={24} size={1} />
      <FlowControls position="bottom-left" />
      <MiniMap
        nodeColor={(n) => {
          const step = (n.data as StepNodeData)?.step;
          if (!step) return '#334155';
          if (step.parallelGroup) return GROUP_COLORS[step.parallelGroup]?.border || '#334155';
          const meta = ACTIONS.find((a) => a.id === step.action);
          return meta?.border || '#334155';
        }}
        maskColor="rgba(0,0,0,0.85)"
        style={{
          background: '#161b22',
          border: '1px solid #21262d',
          borderRadius: 8,
        }}
      />

      {/*  Beautify button (top-right of canvas)  */}
      <Panel position="top-right">
        <button
          onClick={handleBeautify}
          title="Auto-layout: rearrange nodes to remove overlaps"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-indigo-600 bg-indigo-900/60 text-[10px] text-muted-foreground/60 hover:text-indigo-200 hover:border-indigo-500/40 hover:bg-indigo-900/40 transition-all shadow-lg backdrop-blur-sm font-mono">
          <Sparkles className="w-3 h-3 text-indigo-400" />
          Auto-layout
        </button>
      </Panel>

      <Panel position="bottom-center">
        <div className="relative">
          <Button
            size="sm"
            className="h-8 gap-1.5 bg-primary hover:bg-primary/80 text-foreground/70 hover:text-foreground shadow-lg"
            onClick={() => setShowAddMenu((p) => !p)}>
            <Plus className="w-3.5 h-3.5 " />
            Add Step
            <ChevronDown
              className={cn('w-3 h-3 transition-transform', showAddMenu && 'rotate-180')}
            />
          </Button>

          {showAddMenu && (
            <div className="absolute z-50 overflow-hidden -translate-x-1/2 shadow-2xl bottom-10 left-1/2 w-80 dark:bg-[#151b23] rounded-xl">
              <div className="px-3 py-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Add Step
                </p>
              </div>
              {ACTION_GROUPS.map((group) => (
                <div key={group}>
                  <div className="px-3 py-1.5 text-[9px] text-muted-foreground/40 uppercase tracking-widest font-mono">
                    {GROUP_LABELS[group]}
                  </div>
                  <div className="grid grid-cols-2 gap-px p-1">
                    {ACTIONS.filter((a) => a.group === group).map((a) => (
                      <button
                        key={a.id}
                        onClick={() => addStep(a.id)}
                        className="flex items-start gap-2 p-2.5 rounded-lg hover:bg-muted/10 text-left transition-colors group">
                        <span className="flex-shrink-0 text-base">{a.icon}</span>
                        <div>
                          <div className="text-[11px] font-medium" style={{ color: a.color }}>
                            {a.label}
                          </div>
                          <div className="text-[9px] text-muted-foreground/40 mt-0.5 leading-tight">
                            {a.desc}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Panel>

      {active.steps.length === 0 && (
        <Panel position="top-center">
          <div className="flex flex-col items-center gap-2 mt-24 text-muted-foreground/20">
            <Zap className="w-12 h-12 opacity-15" />
            <p className="text-sm">Click "Add Step" to build your scenario</p>
          </div>
        </Panel>
      )}
    </ReactFlow>
  );
}

//  Main component
export default function ScenarioBuilderPanel({
  abis,
  deployedContracts,
  rpcUrl,
  onTxRecorded,
}: Props) {
  const [scenarios, setScenarios] = useState<Scenario[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('hhs_scenarios') || '[]');
    } catch {
      return [];
    }
  });
  const [active, setActive] = useState<Scenario | null>(null);
  const [runLogs, setRunLogs] = useState<RunLog[]>([]);
  const [running, setRunning] = useState(false);
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const [activeStepIds, setActiveStepIds] = useState<Set<string>>(new Set());
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [hhAccounts, setHHAccounts] = useState<HardhatAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [view, setView] = useState<'canvas' | 'list'>('canvas');
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [rightTab, setRightTab] = useState<'log' | 'connections'>('log');
  const [newConnSrc, setNewConnSrc] = useState('');
  const [newConnTgt, setNewConnTgt] = useState('');
  const [stepConnTarget, setStepConnTarget] = useState('');

  const [rfNodes, setRfNodes] = useState<Node[]>([]);
  const [rfEdges, setRfEdges] = useState<Edge[]>([]);

  const activeRef = useRef<Scenario | null>(null);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setRfNodes((n) => {
      const updated = applyNodeChanges(changes, n);
      // Persist positions on drag end
      const hasDrag = changes.some((c) => c.type === 'position' && !(c as any).dragging);
      if (hasDrag && activeRef.current) {
        const posMap: Record<string, { x: number; y: number }> = {};
        updated.forEach((node) => {
          posMap[node.id] = { x: node.position.x, y: node.position.y };
        });
        const cur = activeRef.current;
        const withPos = { ...cur, nodePositions: posMap };
        setActive(withPos);
        setScenarios((s) => {
          const next = s.map((x) => (x.id === withPos.id ? withPos : x));
          try {
            localStorage.setItem('hhs_scenarios', JSON.stringify(next));
          } catch {}
          return next;
        });
      }
      return updated;
    });
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setRfEdges((e) => applyEdgeChanges(changes, e));
    const removed = changes
      .filter((c) => c.type === 'remove')
      .map((c) => (c as any).id as string)
      .filter((id) => id.startsWith('custom-'));
    if (removed.length > 0 && activeRef.current) {
      const cur = activeRef.current;
      const updated = {
        ...cur,
        customEdges: (cur.customEdges || []).filter((ce) => !removed.includes(ce.id)),
      };
      setActive(updated);
      setScenarios((s) => {
        const next = s.map((x) => (x.id === updated.id ? updated : x));
        try {
          localStorage.setItem('hhs_scenarios', JSON.stringify(next));
        } catch {}
        return next;
      });
    }
  }, []);

  const onConnect = useCallback((connection: Connection) => {
    const cur = activeRef.current;
    if (!cur || !connection.source || !connection.target) return;
    const newEdge: CustomEdge = {
      id: `custom-${connection.source}-${connection.target}-${Date.now()}`,
      source: connection.source,
      target: connection.target,
    };
    const updated: Scenario = { ...cur, customEdges: [...(cur.customEdges || []), newEdge] };
    setActive(updated);
    setScenarios((s) => {
      const next = s.map((x) => (x.id === updated.id ? updated : x));
      try {
        localStorage.setItem('hhs_scenarios', JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  useEffect(() => {
    setStepConnTarget('');
  }, [selectedStepId]);

  useEffect(() => {
    // Use saved positions if available, otherwise compute layout
    const savedPos = active?.nodePositions;
    const positions = savedPos
      ? new Map(Object.entries(savedPos))
      : computeLayout(active?.steps ?? [], active?.customEdges ?? []);
    const { nodes, edges } = buildFlow(
      active?.steps ?? [],
      null,
      selectedStepId,
      (id) => setSelectedStepId((prev) => (prev === id ? null : id)),
      active?.customEdges || [],
      positions,
    );
    setRfNodes(nodes);
    setRfEdges(edges);
  }, [active?.steps, active?.customEdges, active?.nodePositions, activeStepIds, selectedStepId]);

  const persist = (list: Scenario[]) => {
    setScenarios(list);
    try {
      localStorage.setItem('hhs_scenarios', JSON.stringify(list));
    } catch {}
  };

  const create = () => {
    if (!newName.trim()) return;
    const s: Scenario = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      steps: [],
      customEdges: [],
      createdAt: Date.now(),
    };
    persist([...scenarios, s]);
    setActive(s);
    setNewName('');
  };

  const update = useCallback((s: Scenario) => {
    setActive(s);
    setScenarios((prev) => {
      const updated = prev.map((x) => (x.id === s.id ? s : x));
      try {
        localStorage.setItem('hhs_scenarios', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  const addStep = (a: ActionType) => {
    if (!active) return;
    update({ ...active, steps: [...active.steps, makeStep(a)] });
    setShowAddMenu(false);
  };

  const removeStep = (id: string) => {
    if (!active) return;
    update({ ...active, steps: active.steps.filter((s) => s.id !== id) });
    if (selectedStepId === id) setSelectedStepId(null);
  };

  const patchStep = useCallback(
    (id: string, patch: Partial<Step>) => {
      if (!active) return;
      update({ ...active, steps: active.steps.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
    },
    [active, update],
  );

  const patchStepStatus = (
    id: string,
    status: StepStatus,
    log?: string,
    txHash?: string,
    gasUsed?: string,
    duration?: number,
  ) => {
    setActive((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        steps: prev.steps.map((s) =>
          s.id === id ? { ...s, status, log, txHash, gasUsed, duration } : s,
        ),
      };
    });
  };

  const loadAccounts = async () => {
    setLoadingAccounts(true);
    try {
      const a = await window.api.getHardhatAccounts(rpcUrl);
      setHHAccounts(a || []);
    } catch {}
    setLoadingAccounts(false);
  };

  const getFns = (addr: string, name: string, kind?: 'read' | 'write') => {
    const dc = deployedContracts.find(
      (c) => (addr && c.address.toLowerCase() === addr.toLowerCase()) || (name && c.name === name),
    );
    if (!dc) return [];
    return dc.abi
      .filter((i) => {
        if (i.type !== 'function') return false;
        if (kind === 'read') return i.stateMutability === 'view' || i.stateMutability === 'pure';
        if (kind === 'write') return i.stateMutability !== 'view' && i.stateMutability !== 'pure';
        return true;
      })
      .map((i) => ({
        name: i.name || '',
        inputs: (i.inputs || []).map((x: any) => x.type).join(','),
      }));
  };

  const usedGroups = Array.from(
    new Set((active?.steps || []).map((s) => s.parallelGroup).filter(Boolean) as string[]),
  );

  const assignParallelGroup = (stepId: string, groupId: string | null) =>
    patchStep(stepId, { parallelGroup: groupId });

  const createNewGroup = (stepId: string) => {
    const available = GROUP_IDS.filter((g) => !usedGroups.includes(g));
    if (available.length === 0) return;
    assignParallelGroup(stepId, available[0]);
  };

  const runScenario = async () => {
    if (!active || running) return;
    if (!hhAccounts.length) await loadAccounts();

    const resetSteps = active.steps.map((s) => ({
      ...s,
      status: 'idle' as StepStatus,
      log: undefined,
      txHash: undefined,
      gasUsed: undefined,
    }));
    const resetScenario = { ...active, steps: resetSteps };
    setActive(resetScenario);
    setRunLogs([]);
    setRunning(true);
    setActiveStepIds(new Set());

    const batches = buildBatches(resetScenario.steps);

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

      let batchFailed = false;
      for (const { step, res, duration } of results) {
        const status: StepStatus = res.ok ? 'ok' : 'error';
        patchStepStatus(step.id, status, res.message, res.txHash, res.gasUsed, duration);
        setRunLogs((prev) => [
          ...prev,
          {
            stepId: step.id,
            status,
            message: res.message,
            txHash: res.txHash,
            gasUsed: res.gasUsed,
            duration,
            timestamp: Date.now(),
          },
        ]);

        if (res.txHash && step.action === 'send') {
          const dc = deployedContracts.find(
            (c) => c.name === step.contractName || c.address === step.contractAddress,
          );
          onTxRecorded({
            id: crypto.randomUUID(),
            hash: res.txHash,
            contractName: dc?.name || step.contractName,
            functionName: step.functionName,
            args: step.args ? step.args.split(',') : [],
            status: 'success',
            gasUsed: res.gasUsed,
            timestamp: Date.now(),
          });
        }
        if (!res.ok) batchFailed = true;
      }

      await Promise.all(
        batch.map((step) => {
          if (step.timeoutMs && parseInt(step.timeoutMs) > 0 && step.action !== 'timeout') {
            return new Promise((r) => setTimeout(r, parseInt(step.timeoutMs)));
          }
          return Promise.resolve();
        }),
      );

      if (batchFailed) break;
    }

    setActiveStepIds(new Set());
    setRunning(false);
  };

  const resetRun = () => {
    if (!active || running) return;
    update({
      ...active,
      steps: active.steps.map((s) => ({
        ...s,
        status: 'idle',
        log: undefined,
        txHash: undefined,
        gasUsed: undefined,
      })),
    });
    setRunLogs([]);
  };

  //  Parse .ts or .js file into steps (shared parser)
  const parseScriptToSteps = (text: string): Step[] => {
    const steps: Step[] = [];
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i].trim();

      // getContractAt + function call pattern
      const contractAtMatch = raw.match(/getContractAt\(['"](.+?)['"]\s*,\s*['"](.+?)['"]\)/);
      if (contractAtMatch) {
        const contractName = contractAtMatch[1];
        const contractAddress = contractAtMatch[2];
        // look ahead for the call line
        const nextLine = (lines[i + 1] || '').trim();
        const callMatch = nextLine.match(/await\s+\w+\.(\w+)\(([^)]*)\)/);
        const fnName = callMatch?.[1] || '';
        const args = callMatch?.[2]?.replace(/['"]/g, '').trim() || '';
        const isRead = nextLine.includes('const r_');
        steps.push({
          id: crypto.randomUUID(),
          action: isRead ? 'call' : 'send',
          description: `${isRead ? 'Call' : 'Send'} ${fnName}`,
          contractName,
          contractAddress,
          functionName: fnName,
          args,
          value: '0',
          fromPrivateKey: '',
          blocks: '1',
          timeoutMs: '1000',
          message: '',
          assertContract: '',
          assertFn: '',
          assertArgs: '',
          assertExpected: '',
          assertOperator: 'eq',
          expectedRevertMsg: '',
          impersonateAddr: '',
          balanceAddr: '',
          balanceEth: '0',
          script: '',
        });
        i++; // skip next line
        continue;
      }

      // evm_mine
      if (raw.includes("'evm_mine'") || raw.includes('"evm_mine"')) {
        const blocksMatch = raw.match(/new Array\((\d+)\)/);
        steps.push({
          id: crypto.randomUUID(),
          action: 'wait',
          description: 'Mine Blocks',
          contractName: '',
          contractAddress: '',
          functionName: '',
          args: '',
          value: '0',
          fromPrivateKey: '',
          blocks: blocksMatch?.[1] || '1',
          timeoutMs: '1000',
          message: '',
          assertContract: '',
          assertFn: '',
          assertArgs: '',
          assertExpected: '',
          assertOperator: 'eq',
          expectedRevertMsg: '',
          impersonateAddr: '',
          balanceAddr: '',
          balanceEth: '0',
          script: '',
        });
        continue;
      }

      // setTimeout
      if (raw.includes('setTimeout')) {
        const msMatch = raw.match(/setTimeout\(r,\s*(\d+)\)/);
        steps.push({
          id: crypto.randomUUID(),
          action: 'timeout',
          description: 'Wait Timeout',
          contractName: '',
          contractAddress: '',
          functionName: '',
          args: '',
          value: '0',
          fromPrivateKey: '',
          blocks: '1',
          timeoutMs: msMatch?.[1] || '1000',
          message: '',
          assertContract: '',
          assertFn: '',
          assertArgs: '',
          assertExpected: '',
          assertOperator: 'eq',
          expectedRevertMsg: '',
          impersonateAddr: '',
          balanceAddr: '',
          balanceEth: '0',
          script: '',
        });
        continue;
      }

      // console.log
      if (raw.startsWith('console.log(')) {
        const msgMatch = raw.match(/console\.log\(['"](.+?)['"]\)/);
        steps.push({
          id: crypto.randomUUID(),
          action: 'log',
          description: 'Log Message',
          contractName: '',
          contractAddress: '',
          functionName: '',
          args: '',
          value: '0',
          fromPrivateKey: '',
          blocks: '1',
          timeoutMs: '1000',
          message: msgMatch?.[1] || '',
          assertContract: '',
          assertFn: '',
          assertArgs: '',
          assertExpected: '',
          assertOperator: 'eq',
          expectedRevertMsg: '',
          impersonateAddr: '',
          balanceAddr: '',
          balanceEth: '0',
          script: '',
        });
        continue;
      }

      // evm_snapshot
      if (raw.includes("'evm_snapshot'") || raw.includes('"evm_snapshot"')) {
        steps.push({
          id: crypto.randomUUID(),
          action: 'snapshot',
          description: 'Snapshot',
          contractName: '',
          contractAddress: '',
          functionName: '',
          args: '',
          value: '0',
          fromPrivateKey: '',
          blocks: '1',
          timeoutMs: '1000',
          message: '',
          assertContract: '',
          assertFn: '',
          assertArgs: '',
          assertExpected: '',
          assertOperator: 'eq',
          expectedRevertMsg: '',
          impersonateAddr: '',
          balanceAddr: '',
          balanceEth: '0',
          script: '',
        });
        continue;
      }

      // impersonateAccount
      if (raw.includes('hardhat_impersonateAccount')) {
        const addrMatch = raw.match(/\['(.+?)'/);
        steps.push({
          id: crypto.randomUUID(),
          action: 'impersonate',
          description: 'Impersonate',
          contractName: '',
          contractAddress: '',
          functionName: '',
          args: '',
          value: '0',
          fromPrivateKey: '',
          blocks: '1',
          timeoutMs: '1000',
          message: '',
          assertContract: '',
          assertFn: '',
          assertArgs: '',
          assertExpected: '',
          assertOperator: 'eq',
          expectedRevertMsg: '',
          impersonateAddr: addrMatch?.[1] || '',
          balanceAddr: '',
          balanceEth: '0',
          script: '',
        });
        continue;
      }
    }
    return steps;
  };

  //  Import .ts file
  const importTs = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.ts';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      const steps = parseScriptToSteps(text);
      if (steps.length === 0) {
        alert('No recognizable steps found in .ts file');
        return;
      }
      const scenarioName = file.name.replace(/\.test\.ts$|\.ts$/, '').replace(/-/g, ' ');
      const newScenario: Scenario = {
        id: crypto.randomUUID(),
        name: scenarioName,
        steps,
        customEdges: [],
        createdAt: Date.now(),
      };
      const updated = [...scenarios, newScenario];
      persist(updated);
      setActive(newScenario);
    };
    input.click();
  };

  //  Import .js file
  const importJs = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.js';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      const steps = parseScriptToSteps(text);
      if (steps.length === 0) {
        alert('No recognizable steps found in .js file');
        return;
      }
      const scenarioName = file.name.replace(/\.script\.js$|\.js$/, '').replace(/-/g, ' ');
      const newScenario: Scenario = {
        id: crypto.randomUUID(),
        name: scenarioName,
        steps,
        customEdges: [],
        createdAt: Date.now(),
      };
      const updated = [...scenarios, newScenario];
      persist(updated);
      setActive(newScenario);
    };
    input.click();
  };

  //  Export JSON (full scenario including positions & edges)
  const exportJson = () => {
    if (!active) return;
    // Capture current node positions from rfNodes
    const posMap: Record<string, { x: number; y: number }> = {};
    rfNodes.forEach((node) => {
      posMap[node.id] = { x: node.position.x, y: node.position.y };
    });
    const exportData: Scenario = { ...active, nodePositions: posMap };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `${active.name.replace(/\s+/g, '-')}.scenario.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importScenario = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const list: Scenario[] = Array.isArray(data) ? data : [data];
        const imported = list.map((s) => ({
          ...s,
          id: crypto.randomUUID(),
          createdAt: Date.now(),
          // Ensure all fields are preserved
          steps: s.steps || [],
          customEdges: s.customEdges || [],
          nodePositions: s.nodePositions || undefined,
        }));
        const updated = [...scenarios, ...imported];
        persist(updated);
        if (imported.length === 1) setActive(imported[0]);
      } catch {
        alert('Invalid scenario JSON');
      }
    };
    input.click();
  };

  const selectedStep = active?.steps.find((s) => s.id === selectedStepId) || null;
  const selectedMeta = selectedStep ? ACTIONS.find((a) => a.id === selectedStep.action) : null;
  const okCount = runLogs.filter((l) => l.status === 'ok').length;
  const failCount = runLogs.filter((l) => l.status === 'error').length;
  const totalMs = runLogs.reduce((a, l) => a + (l.duration || 0), 0);

  return (
    <div className="flex h-full overflow-hidden bg-background">
      {/*  Sidebar  */}
      <div className="flex flex-col flex-shrink-0 border-r w-52 border-border bg-card">
        <div className="px-3 py-2.5 border-b border-border">
          <div className="flex items-center gap-2 mb-2">
            <ListOrdered className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-semibold">Scenarios</span>
            <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded ml-auto font-mono">
              {scenarios.length}
            </span>
          </div>
          <div className="flex gap-1">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Scenario name…"
              className="flex-1 text-xs h-7"
              onKeyDown={(e) => e.key === 'Enter' && create()}
            />
            <Button
              size="icon"
              className="flex-shrink-0 w-7 h-7 bg-emerald-600 hover:bg-emerald-500"
              onClick={create}
              disabled={!newName.trim()}>
              <Plus className="w-3 h-3" />
            </Button>
          </div>
        </div>

        <div className="px-3 py-1.5 border-b border-border">
          <button
            onClick={loadAccounts}
            className="flex items-center gap-1.5 text-[10px] w-full text-muted-foreground/50 hover:text-muted-foreground transition-colors">
            <User className="w-3 h-3" />
            {hhAccounts.length > 0
              ? `${hhAccounts.length} accounts loaded`
              : 'Load Hardhat accounts'}
            <RefreshCw className={cn('w-2.5 h-2.5 ml-auto', loadingAccounts && 'animate-spin')} />
          </button>
        </div>

        <div className="flex-1 py-1 overflow-y-auto">
          {scenarios.length === 0 && (
            <div className="text-center text-[10px] text-muted-foreground/25 py-8">
              No scenarios yet
            </div>
          )}
          {scenarios.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setActive(s);
                setRunLogs([]);
                setSelectedStepId(null);
              }}
              className={cn(
                'w-full text-left px-3 py-2 transition-all group flex items-start justify-between border-b border-border/20',
                active?.id === s.id
                  ? 'bg-blue-500/10 border-l-2 border-l-blue-500'
                  : 'hover:bg-muted/30',
              )}>
              <div className="min-w-0">
                <div className="text-xs font-medium truncate">{s.name}</div>
                <div className="text-[9px] text-muted-foreground/40 font-mono mt-0.5">
                  {s.steps.length} steps
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  persist(scenarios.filter((x) => x.id !== s.id));
                  if (active?.id === s.id) setActive(null);
                }}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground/20 hover:text-rose-400 p-0.5 mt-0.5 transition-opacity">
                <Trash2 className="w-3 h-3" />
              </button>
            </button>
          ))}
        </div>

        <div className="px-3 py-2 space-y-1 border-t border-border">
          <button
            onClick={importScenario}
            className="w-full flex items-center gap-1.5 text-[10px] text-muted-foreground/40 hover:text-muted-foreground transition-colors">
            <Upload className="w-3 h-3" /> Import JSON
          </button>
        </div>
      </div>

      {/*  Main area  */}
      {!active ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-4 text-muted-foreground/25">
          <ListOrdered className="w-14 h-14 opacity-15" />
          <p className="text-sm">Select or create a scenario</p>
          {deployedContracts.length === 0 && (
            <p className="max-w-xs px-4 py-2 text-xs text-center border rounded-lg text-amber-400/50 bg-amber-500/10 border-amber-500/20">
              ⚠ No deployed contracts yet — deploy first to use Call/Send steps
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-1 min-w-0 overflow-hidden">
          {/*  Canvas + toolbar  */}
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center flex-shrink-0 gap-2 px-3 py-2 border-b border-border bg-card/50">
              <span className="text-sm font-semibold text-foreground/90">{active.name}</span>
              <span className="text-[10px] text-muted-foreground/40 font-mono">
                {active.steps.length} steps
              </span>

              {usedGroups.length > 0 && (
                <div className="flex items-center gap-1 ml-1">
                  <GitBranch className="w-3 h-3 text-muted-foreground/30" />
                  {usedGroups.map((g) => {
                    const c = GROUP_COLORS[g];
                    return (
                      <span
                        key={g}
                        style={{ color: c.color, background: `#161b22f0`, borderColor: c.border }}
                        className="text-[9px] px-1.5 py-0.5 rounded border font-mono">
                        {g}
                      </span>
                    );
                  })}
                </div>
              )}

              {runLogs.length > 0 && (
                <div className="flex items-center gap-2 ml-1">
                  {okCount > 0 && (
                    <span className="text-[9px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded font-mono">
                      ✓ {okCount}
                    </span>
                  )}
                  {failCount > 0 && (
                    <span className="text-[9px] text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded font-mono">
                      ✗ {failCount}
                    </span>
                  )}
                  {totalMs > 0 && (
                    <span className="text-[9px] text-muted-foreground/30 font-mono">
                      {totalMs}ms
                    </span>
                  )}
                </div>
              )}

              <div className="ml-auto flex items-center gap-1.5">
                <div className="flex overflow-hidden border rounded-lg bg-muted border-border">
                  {(['canvas', 'list'] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setView(v)}
                      className={cn(
                        'px-2.5 py-1 text-[10px] font-medium transition-colors',
                        view === v
                          ? 'bg-blue-600 text-white'
                          : 'text-muted-foreground hover:text-foreground',
                      )}>
                      {v === 'canvas' ? '⬡ Flow' : '≡ List'}
                    </button>
                  ))}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px] gap-1"
                  onClick={resetRun}
                  disabled={running || runLogs.length === 0}>
                  <RotateCcw className="w-3 h-3" /> Reset
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px] gap-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                  onClick={exportJson}
                  disabled={!active.steps.length}>
                  <Download className="w-3 h-3" /> .json
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px] gap-1 border-sky-500/30 text-sky-400 hover:bg-sky-500/10"
                  onClick={importScenario}>
                  <Upload className="w-3 h-3" /> Import
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-[10px] gap-1.5 bg-emerald-600 hover:bg-emerald-500"
                  onClick={runScenario}
                  disabled={running || !active.steps.length}>
                  {running ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" /> Running…
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3" /> Run
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/*  CANVAS VIEW  */}
            {view === 'canvas' && (
              <div className="relative flex-1 min-h-0">
                <ReactFlowProvider>
                  <CanvasInner
                    rfNodes={rfNodes}
                    rfEdges={rfEdges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    showAddMenu={showAddMenu}
                    setShowAddMenu={setShowAddMenu}
                    addStep={addStep}
                    active={active}
                  />
                </ReactFlowProvider>
              </div>
            )}

            {/*  LIST VIEW  */}
            {view === 'list' && (
              <ScrollArea className="flex-1 overflow-y-auto">
                <div className="p-3 space-y-1.5">
                  {active.steps.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground/25">
                      <Zap className="w-8 h-8 opacity-20" />
                      <p className="text-xs">No steps yet</p>
                    </div>
                  ) : (
                    active.steps.map((step, i) => {
                      const meta = ACTIONS.find((a) => a.id === step.action)!;
                      const isSelected = selectedStepId === step.id;
                      const status = step.status || 'idle';
                      const pgColor = step.parallelGroup ? GROUP_COLORS[step.parallelGroup] : null;
                      return (
                        <div
                          key={step.id}
                          onClick={() => setSelectedStepId(isSelected ? null : step.id)}
                          className={cn(
                            'rounded-lg border cursor-pointer transition-all',
                            status === 'ok'
                              ? 'border-emerald-500/30 bg-emerald-500/5'
                              : status === 'error'
                                ? 'border-rose-500/30 bg-rose-500/5'
                                : status === 'running'
                                  ? 'border-amber-500/40 bg-amber-500/5 animate-pulse'
                                  : isSelected
                                    ? 'border-blue-500/40 bg-blue-500/5'
                                    : 'border-border/50 hover:border-border',
                          )}
                          style={
                            pgColor ? { borderLeftColor: pgColor.border, borderLeftWidth: 3 } : {}
                          }>
                          <div className="flex items-center gap-2.5 px-3 py-2">
                            <span className="text-[10px] text-muted-foreground/30 font-mono w-4">
                              {i + 1}
                            </span>
                            <span className="flex-shrink-0 text-sm">{meta.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-medium" style={{ color: meta.color }}>
                                  {meta.label}
                                </span>
                                {step.parallelGroup && (
                                  <span
                                    className="text-[9px] font-mono px-1 py-0.5 rounded"
                                    style={{
                                      color: pgColor!.color,
                                      background: `#161b22f0`,
                                      borderColor: pgColor!.border,
                                      border: '1px solid',
                                    }}>
                                    ⑆ {step.parallelGroup}
                                  </span>
                                )}
                                <span className="text-xs truncate text-muted-foreground/50">
                                  {step.description}
                                </span>
                              </div>
                              {step.log && (
                                <div
                                  className={cn(
                                    'text-[10px] font-mono mt-0.5 truncate',
                                    status === 'ok'
                                      ? 'text-emerald-400'
                                      : status === 'error'
                                        ? 'text-rose-400'
                                        : 'text-amber-400',
                                  )}>
                                  {step.log}
                                </div>
                              )}
                            </div>
                            {status !== 'idle' && (
                              <div className="flex-shrink-0">
                                {status === 'ok' && (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                )}
                                {status === 'error' && (
                                  <XCircle className="w-4 h-4 text-rose-400" />
                                )}
                                {status === 'running' && (
                                  <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />
                                )}
                              </div>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeStep(step.id);
                              }}
                              className="flex-shrink-0 text-muted-foreground/20 hover:text-rose-400 p-0.5 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            )}
          </div>

          {/*  Right panel  */}
          <div className="flex flex-col flex-shrink-0 overflow-hidden border-l w-72 border-border bg-card/30">
            {selectedStep && selectedMeta ? (
              <div className="flex flex-col h-full overflow-hidden">
                <div
                  className="flex items-center flex-shrink-0 gap-2 px-3 py-2 border-b border-border"
                  style={{ background: `#161b22f0` }}>
                  <span className="text-base">{selectedMeta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold" style={{ color: selectedMeta.color }}>
                      {selectedMeta.label}
                    </div>
                    <div className="text-[9px] text-muted-foreground/40">{selectedMeta.desc}</div>
                  </div>
                  <button
                    onClick={() => setSelectedStepId(null)}
                    className="text-muted-foreground/30 hover:text-foreground">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <ScrollArea className="flex-1 overflow-y-auto">
                  <div className="p-3 space-y-3">
                    {/* Label */}
                    <div>
                      <Label className="text-[10px] mb-1 block">Label</Label>
                      <Input
                        value={selectedStep.description}
                        onChange={(e) =>
                          patchStep(selectedStep.id, { description: e.target.value })
                        }
                        className="text-xs h-7"
                      />
                    </div>

                    {/*  Parallel Group — controls runtime execution  */}
                    <div>
                      <Label className="text-[10px] mb-1.5 flex items-center gap-1.5 block">
                        <GitBranch className="w-3 h-3 text-indigo-400" />
                        Parallel Group
                        <span className="ml-auto font-normal text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400/80 border border-emerald-500/20">
                          ⚡ controls execution
                        </span>
                      </Label>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          onClick={() => assignParallelGroup(selectedStep.id, null)}
                          className={cn(
                            'text-[10px] px-2 py-1 rounded-md border transition-all font-mono',
                            !selectedStep.parallelGroup
                              ? 'bg-muted border-muted-foreground/30 text-foreground'
                              : 'border-border/30 text-muted-foreground/40 hover:text-muted-foreground hover:border-border',
                          )}>
                          None
                        </button>
                        {usedGroups.map((g) => {
                          const c = GROUP_COLORS[g];
                          const isActive = selectedStep.parallelGroup === g;
                          return (
                            <button
                              key={g}
                              onClick={() =>
                                assignParallelGroup(selectedStep.id, isActive ? null : g)
                              }
                              style={{
                                color: c.color,
                                background: isActive ? `#161b22f0` : 'transparent',
                                borderColor: isActive ? c.border : `${c.border}44`,
                              }}
                              className="text-[10px] px-2 py-1 rounded-md border transition-all font-mono hover:opacity-90">
                              {isActive ? '✓ ' : ''}
                              {g}
                            </button>
                          );
                        })}
                        {GROUP_IDS.filter((g) => !usedGroups.includes(g)).length > 0 && (
                          <button
                            onClick={() => createNewGroup(selectedStep.id)}
                            className="text-[10px] px-2 py-1 rounded-md border border-dashed border-border/30 text-muted-foreground/30 hover:text-muted-foreground hover:border-border transition-all font-mono flex items-center gap-1">
                            <Plus className="w-2.5 h-2.5" /> New
                          </button>
                        )}
                      </div>
                      {selectedStep.parallelGroup && (
                        <div className="mt-1.5 text-[9px] text-muted-foreground/40 flex items-center gap-1">
                          <Merge className="w-3 h-3" />
                          {
                            active.steps.filter(
                              (s) =>
                                s.parallelGroup === selectedStep.parallelGroup &&
                                s.id !== selectedStep.id,
                            ).length
                          }{' '}
                          other step(s) run in parallel
                        </div>
                      )}
                    </div>

                    {/*  Flow Arrows — visual only  */}
                    <div>
                      <Label className="text-[10px] mb-1.5 flex items-center gap-1.5 block">
                        <ArrowRight className="w-3 h-3 text-indigo-400" />
                        Flow Arrows
                        <span className="ml-auto font-normal text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400/70 border border-indigo-500/20">
                          👁 visual only
                        </span>
                      </Label>

                      {/* Visual-only disclaimer */}
                      <div className="flex items-start gap-1.5 px-2 py-1.5 mb-2 rounded-lg bg-indigo-500/5 border border-indigo-500/15">
                        <Eye className="w-3 h-3 text-indigo-400/50 flex-shrink-0 mt-0.5" />
                        <p className="text-[9px] text-indigo-300/50 leading-relaxed">
                          Arrows here are decorative and{' '}
                          <span className="font-semibold text-indigo-300/70">
                            don't affect execution order
                          </span>
                          . Use Parallel Group above to control what runs concurrently.
                        </p>
                      </div>

                      {(() => {
                        const edges = active.customEdges || [];
                        const outgoing = edges.filter((e) => e.source === selectedStep.id);
                        const incoming = edges.filter((e) => e.target === selectedStep.id);
                        const all = [
                          ...outgoing.map((e) => ({ ...e, dir: 'out' as const })),
                          ...incoming.map((e) => ({ ...e, dir: 'in' as const })),
                        ];
                        if (all.length === 0)
                          return (
                            <p className="text-[9px] text-muted-foreground/25 mb-2">
                              No flow arrows yet
                            </p>
                          );
                        return (
                          <div className="mb-2 space-y-1">
                            {all.map((e) => {
                              const otherId = e.dir === 'out' ? e.target : e.source;
                              const other = active.steps.find((s) => s.id === otherId);
                              const otherMeta = other
                                ? ACTIONS.find((a) => a.id === other.action)
                                : null;
                              return (
                                <div
                                  key={e.id}
                                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-indigo-500/5 border border-indigo-500/15 group">
                                  <span className="text-[9px] text-muted-foreground/30 font-mono flex-shrink-0">
                                    {e.dir === 'out' ? '→' : '←'}
                                  </span>
                                  <span
                                    className="flex-1 text-[10px] font-mono truncate"
                                    style={{ color: otherMeta?.color || '#94a3b8' }}>
                                    {otherMeta?.icon} {other?.description || otherId.slice(0, 10)}
                                  </span>
                                  <button
                                    onClick={() => {
                                      const cur = activeRef.current;
                                      if (!cur) return;
                                      update({
                                        ...cur,
                                        customEdges: cur.customEdges.filter((x) => x.id !== e.id),
                                      });
                                    }}
                                    className="flex-shrink-0 transition-all opacity-0 group-hover:opacity-100 text-muted-foreground/20 hover:text-rose-400">
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}

                      <div className="flex items-center gap-1.5">
                        <Select value={stepConnTarget} onValueChange={setStepConnTarget}>
                          <SelectTrigger className="flex-1 text-[10px] h-7">
                            <SelectValue placeholder="Connect to…" />
                          </SelectTrigger>
                          <SelectContent>
                            {active.steps
                              .filter((s) => s.id !== selectedStep.id)
                              .map((s) => {
                                const m = ACTIONS.find((a) => a.id === s.action)!;
                                return (
                                  <SelectItem key={s.id} value={s.id}>
                                    {m.icon} {s.description}
                                  </SelectItem>
                                );
                              })}
                          </SelectContent>
                        </Select>
                        <button
                          disabled={!stepConnTarget}
                          onClick={() => {
                            const cur = activeRef.current;
                            if (!cur || !stepConnTarget) return;
                            const already = (cur.customEdges || []).some(
                              (e) => e.source === selectedStep.id && e.target === stepConnTarget,
                            );
                            if (already) return;
                            const newEdge: CustomEdge = {
                              id: `custom-${selectedStep.id}-${stepConnTarget}-${Date.now()}`,
                              source: selectedStep.id,
                              target: stepConnTarget,
                            };
                            update({ ...cur, customEdges: [...(cur.customEdges || []), newEdge] });
                            setStepConnTarget('');
                          }}
                          className="flex-shrink-0 flex items-center gap-1 text-[10px] px-2 py-1 h-7 rounded-md border border-indigo-500/30 text-indigo-400 bg-indigo-500/5 hover:bg-indigo-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Post-step delay */}
                    <div>
                      <Label className="text-[10px] mb-1 block flex items-center gap-1">
                        <Timer className="w-3 h-3 text-purple-400" /> Delay after step (ms)
                      </Label>
                      <Input
                        value={selectedStep.timeoutMs}
                        onChange={(e) => patchStep(selectedStep.id, { timeoutMs: e.target.value })}
                        className="text-xs h-7 w-28"
                        type="number"
                        min="0"
                        step="100"
                        placeholder="0"
                      />
                      <p className="text-[9px] text-muted-foreground/30 mt-0.5">0 = no delay</p>
                    </div>

                    {/* Contract picker */}
                    {(selectedStep.action === 'call' ||
                      selectedStep.action === 'send' ||
                      selectedStep.action === 'assert_revert') && (
                      <>
                        <div>
                          <Label className="text-[10px] mb-1 block">Contract</Label>
                          <Select
                            value={selectedStep.contractAddress}
                            onValueChange={(v) => {
                              const dc = deployedContracts.find((c) => c.address === v);
                              patchStep(selectedStep.id, {
                                contractAddress: v,
                                contractName: dc?.name || '',
                                functionName: '',
                              });
                            }}>
                            <SelectTrigger className="text-xs h-7">
                              <SelectValue placeholder="Select contract…" />
                            </SelectTrigger>
                            <SelectContent>
                              {deployedContracts.length === 0 ? (
                                <SelectItem value="__none" disabled>
                                  No deployed contracts
                                </SelectItem>
                              ) : (
                                deployedContracts.map((c) => (
                                  <SelectItem key={c.id} value={c.address}>
                                    {c.name}{' '}
                                    <span className="text-muted-foreground/50 font-mono text-[9px]">
                                      ({c.address.slice(0, 8)}…)
                                    </span>
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-[10px] mb-1 block">Function</Label>
                          <Select
                            value={selectedStep.functionName}
                            onValueChange={(v) => patchStep(selectedStep.id, { functionName: v })}>
                            <SelectTrigger className="text-xs h-7">
                              <SelectValue placeholder="Select function…" />
                            </SelectTrigger>
                            <SelectContent>
                              {(selectedStep.action === 'call'
                                ? getFns(
                                    selectedStep.contractAddress,
                                    selectedStep.contractName,
                                    'read',
                                  )
                                : getFns(
                                    selectedStep.contractAddress,
                                    selectedStep.contractName,
                                    'write',
                                  )
                              ).map((fn) => (
                                <SelectItem key={fn.name} value={fn.name}>
                                  {fn.name}({fn.inputs})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-[10px] mb-1 block">
                            Args <span className="text-muted-foreground/40">(comma-separated)</span>
                          </Label>
                          <Input
                            value={selectedStep.args}
                            onChange={(e) => patchStep(selectedStep.id, { args: e.target.value })}
                            className="font-mono text-xs h-7"
                            placeholder="arg1, arg2…"
                          />
                        </div>
                        {selectedStep.action === 'send' && (
                          <div>
                            <Label className="text-[10px] mb-1 block">Value (ETH)</Label>
                            <Input
                              value={selectedStep.value}
                              onChange={(e) =>
                                patchStep(selectedStep.id, { value: e.target.value })
                              }
                              className="text-xs h-7 w-28"
                              type="number"
                              min="0"
                              step="0.001"
                            />
                          </div>
                        )}
                      </>
                    )}

                    {/* Signer */}
                    {selectedStep.action === 'send' && (
                      <div>
                        <Label className="text-[10px] mb-1 block">Signer</Label>
                        <Select
                          value={selectedStep.fromPrivateKey || '__default'}
                          onValueChange={(v) =>
                            patchStep(selectedStep.id, {
                              fromPrivateKey: v === '__default' ? '' : v,
                            })
                          }>
                          <SelectTrigger className="text-xs h-7">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__default">accounts[0] (default)</SelectItem>
                            {hhAccounts.map((acc, ai) => (
                              <SelectItem key={acc.address} value={acc.privateKey}>
                                [{ai}] {acc.address.slice(0, 14)}…
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Assert */}
                    {selectedStep.action === 'assert' && (
                      <>
                        <div>
                          <Label className="text-[10px] mb-1 block">Contract</Label>
                          <Select
                            value={selectedStep.assertContract}
                            onValueChange={(v) =>
                              patchStep(selectedStep.id, { assertContract: v, assertFn: '' })
                            }>
                            <SelectTrigger className="text-xs h-7">
                              <SelectValue placeholder="Select contract…" />
                            </SelectTrigger>
                            <SelectContent>
                              {deployedContracts.map((c) => (
                                <SelectItem key={c.id} value={c.address}>
                                  {c.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-[10px] mb-1 block">Function</Label>
                          <Select
                            value={selectedStep.assertFn}
                            onValueChange={(v) => patchStep(selectedStep.id, { assertFn: v })}>
                            <SelectTrigger className="text-xs h-7">
                              <SelectValue placeholder="Read function…" />
                            </SelectTrigger>
                            <SelectContent>
                              {getFns(selectedStep.assertContract, '', 'read').map((fn) => (
                                <SelectItem key={fn.name} value={fn.name}>
                                  {fn.name}()
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-[10px] mb-1 block">Operator</Label>
                          <Select
                            value={selectedStep.assertOperator}
                            onValueChange={(v) =>
                              patchStep(selectedStep.id, { assertOperator: v as any })
                            }>
                            <SelectTrigger className="text-xs h-7">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[
                                { v: 'eq', l: '= equal' },
                                { v: 'gt', l: '> greater than' },
                                { v: 'lt', l: '< less than' },
                                { v: 'gte', l: '≥ gte' },
                                { v: 'lte', l: '≤ lte' },
                                { v: 'includes', l: '⊃ includes' },
                              ].map((op) => (
                                <SelectItem key={op.v} value={op.v}>
                                  {op.l}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-[10px] mb-1 block">Expected value</Label>
                          <Input
                            value={selectedStep.assertExpected}
                            onChange={(e) =>
                              patchStep(selectedStep.id, { assertExpected: e.target.value })
                            }
                            className="font-mono text-xs h-7"
                            placeholder="42, true, 0x…"
                          />
                        </div>
                      </>
                    )}

                    {/* Assert Revert */}
                    {selectedStep.action === 'assert_revert' && (
                      <div>
                        <Label className="text-[10px] mb-1 block">
                          Expected revert message{' '}
                          <span className="text-muted-foreground/40">(optional)</span>
                        </Label>
                        <Input
                          value={selectedStep.expectedRevertMsg}
                          onChange={(e) =>
                            patchStep(selectedStep.id, { expectedRevertMsg: e.target.value })
                          }
                          className="font-mono text-xs h-7"
                          placeholder="Ownable: not owner"
                        />
                      </div>
                    )}

                    {/* Mine blocks */}
                    {selectedStep.action === 'wait' && (
                      <div>
                        <Label className="text-[10px] mb-1 block">Blocks to mine</Label>
                        <Input
                          value={selectedStep.blocks}
                          onChange={(e) => patchStep(selectedStep.id, { blocks: e.target.value })}
                          className="w-24 text-xs h-7"
                          type="number"
                          min="1"
                        />
                      </div>
                    )}

                    {/* Sleep */}
                    {selectedStep.action === 'timeout' && (
                      <div>
                        <Label className="text-[10px] mb-1 block">Sleep duration (ms)</Label>
                        <Input
                          value={selectedStep.timeoutMs}
                          onChange={(e) =>
                            patchStep(selectedStep.id, { timeoutMs: e.target.value })
                          }
                          className="w-32 text-xs h-7"
                          type="number"
                          min="0"
                          step="100"
                        />
                      </div>
                    )}

                    {/* Revert snapshot */}
                    {selectedStep.action === 'revert' && (
                      <div>
                        <Label className="text-[10px] mb-1 block">Snapshot ID</Label>
                        <Input
                          value={selectedStep.message}
                          onChange={(e) => patchStep(selectedStep.id, { message: e.target.value })}
                          className="font-mono text-xs h-7"
                          placeholder="0x1"
                        />
                      </div>
                    )}

                    {/* Impersonate */}
                    {selectedStep.action === 'impersonate' && (
                      <div>
                        <Label className="text-[10px] mb-1 block">Address to impersonate</Label>
                        <Input
                          value={selectedStep.impersonateAddr}
                          onChange={(e) =>
                            patchStep(selectedStep.id, { impersonateAddr: e.target.value })
                          }
                          className="font-mono text-xs h-7"
                          placeholder="0x…"
                        />
                      </div>
                    )}

                    {/* Set balance */}
                    {selectedStep.action === 'set_balance' && (
                      <>
                        <div>
                          <Label className="text-[10px] mb-1 block">Address</Label>
                          <Input
                            value={selectedStep.balanceAddr}
                            onChange={(e) =>
                              patchStep(selectedStep.id, { balanceAddr: e.target.value })
                            }
                            className="font-mono text-xs h-7"
                            placeholder="0x…"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] mb-1 block">Balance (ETH)</Label>
                          <Input
                            value={selectedStep.balanceEth}
                            onChange={(e) =>
                              patchStep(selectedStep.id, { balanceEth: e.target.value })
                            }
                            className="w-24 text-xs h-7"
                            type="number"
                            min="0"
                          />
                        </div>
                      </>
                    )}

                    {/* Log */}
                    {selectedStep.action === 'log' && (
                      <div>
                        <Label className="text-[10px] mb-1 block">Message</Label>
                        <Input
                          value={selectedStep.message}
                          onChange={(e) => patchStep(selectedStep.id, { message: e.target.value })}
                          className="text-xs h-7"
                          placeholder="Log message…"
                        />
                      </div>
                    )}

                    {/* Custom script */}
                    {selectedStep.action === 'custom_script' && (
                      <MonacoScriptEditor
                        value={selectedStep.script}
                        onChange={(v) => patchStep(selectedStep.id, { script: v })}
                      />
                    )}

                    {/* Step result */}
                    {selectedStep.log && (
                      <div
                        className={cn(
                          'rounded-lg border p-2.5 text-[10px] font-mono leading-relaxed break-all',
                          selectedStep.status === 'ok'
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            : 'bg-rose-500/10 border-rose-500/20 text-rose-400',
                        )}>
                        {selectedStep.log}
                        {selectedStep.txHash && (
                          <div className="flex items-center gap-1 mt-1.5 text-blue-400/60">
                            <Hash className="w-3 h-3" />
                            <span className="truncate">{selectedStep.txHash}</span>
                            <button
                              onClick={() => navigator.clipboard.writeText(selectedStep.txHash!)}
                              className="flex-shrink-0 ml-auto hover:text-blue-400">
                              <Copy className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        )}
                        {selectedStep.gasUsed && (
                          <div className="flex items-center gap-1 mt-0.5 text-amber-400/60">
                            <Fuel className="w-3 h-3" />
                            {parseInt(selectedStep.gasUsed).toLocaleString()} gas
                          </div>
                        )}
                      </div>
                    )}

                    {/* Delete step */}
                    <button
                      onClick={() => removeStep(selectedStep.id)}
                      className="w-full flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground/30 hover:text-rose-400 transition-colors py-1.5 rounded border border-transparent hover:border-rose-500/20 hover:bg-rose-500/5">
                      <Trash2 className="w-3 h-3" /> Remove this step
                    </button>
                  </div>
                </ScrollArea>
              </div>
            ) : (
              /*  Flow Arrows / Run Log tabs  */
              <div className="flex flex-col h-full overflow-hidden">
                {/* Tab header */}
                <div className="flex flex-shrink-0 border-b border-border">
                  {(['connections', 'log'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setRightTab(tab)}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-[10px] font-medium transition-colors',
                        rightTab === tab
                          ? 'border-b-2 border-indigo-400 text-indigo-400'
                          : 'text-muted-foreground/40 hover:text-muted-foreground',
                      )}>
                      {tab === 'connections' ? (
                        <>
                          <ArrowRight className="w-3 h-3" />
                          Flow Arrows
                        </>
                      ) : (
                        <>
                          <Terminal className="w-3 h-3 text-emerald-400" />
                          Run Log
                        </>
                      )}
                      {tab === 'log' && runLogs.length > 0 && (
                        <span
                          className={cn(
                            'text-[8px] px-1 py-0.5 rounded font-mono',
                            failCount > 0
                              ? 'bg-rose-500/10 text-rose-400'
                              : running
                                ? 'bg-amber-500/10 text-amber-400'
                                : 'bg-emerald-500/10 text-emerald-400',
                          )}>
                          {running ? '●' : failCount > 0 ? '✗' : '✓'}
                        </span>
                      )}
                      {tab === 'connections' && (active?.customEdges?.length || 0) > 0 && (
                        <span className="text-[8px] px-1 py-0.5 rounded font-mono bg-indigo-500/10 text-indigo-400/60">
                          {active!.customEdges.length} visual
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/*  FLOW ARROWS TAB  */}
                {rightTab === 'connections' && (
                  <div className="flex flex-col flex-1 overflow-hidden">
                    {/* Visual-only banner */}
                    <div className="flex items-start gap-2 px-3 py-2 border-b bg-indigo-500/5 border-indigo-500/15">
                      <Eye className="w-3 h-3 text-indigo-400/60 flex-shrink-0 mt-0.5" />
                      <p className="text-[9px] text-indigo-300/50 leading-relaxed">
                        <span className="font-semibold text-indigo-300/70">Visual only</span> —
                        arrows here are decorative and do not affect execution order. Use{' '}
                        <span className="font-semibold text-indigo-300/70">Parallel Group</span> in
                        step settings to control concurrent execution.
                      </p>
                    </div>

                    <div className="p-3 space-y-2 border-b border-border">
                      <p className="text-[9px] text-muted-foreground/40 uppercase tracking-widest font-mono">
                        Add flow arrow
                      </p>
                      <div className="flex items-center gap-1.5">
                        <Select value={newConnSrc} onValueChange={setNewConnSrc}>
                          <SelectTrigger className="flex-1 text-[10px] h-7">
                            <SelectValue placeholder="From…" />
                          </SelectTrigger>
                          <SelectContent>
                            {active?.steps.map((s) => {
                              const meta = ACTIONS.find((a) => a.id === s.action)!;
                              return (
                                <SelectItem key={s.id} value={s.id}>
                                  {meta.icon} {s.description}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        <ArrowRight className="flex-shrink-0 w-3 h-3 text-muted-foreground/30" />
                        <Select value={newConnTgt} onValueChange={setNewConnTgt}>
                          <SelectTrigger className="flex-1 text-[10px] h-7">
                            <SelectValue placeholder="To…" />
                          </SelectTrigger>
                          <SelectContent>
                            {active?.steps
                              .filter((s) => s.id !== newConnSrc)
                              .map((s) => {
                                const meta = ACTIONS.find((a) => a.id === s.action)!;
                                return (
                                  <SelectItem key={s.id} value={s.id}>
                                    {meta.icon} {s.description}
                                  </SelectItem>
                                );
                              })}
                          </SelectContent>
                        </Select>
                      </div>
                      <button
                        disabled={!newConnSrc || !newConnTgt}
                        onClick={() => {
                          const cur = activeRef.current;
                          if (!cur || !newConnSrc || !newConnTgt) return;
                          const newEdge: CustomEdge = {
                            id: `custom-${newConnSrc}-${newConnTgt}-${Date.now()}`,
                            source: newConnSrc,
                            target: newConnTgt,
                          };
                          const updated = {
                            ...cur,
                            customEdges: [...(cur.customEdges || []), newEdge],
                          };
                          update(updated);
                          setNewConnSrc('');
                          setNewConnTgt('');
                        }}
                        className="w-full flex items-center justify-center gap-1.5 text-[10px] py-1.5 rounded-lg border border-indigo-500/30 text-indigo-400 bg-indigo-500/5 hover:bg-indigo-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                        <Plus className="w-3 h-3" /> Add Arrow
                      </button>
                      <p className="text-[9px] text-muted-foreground/25 text-center">
                        or drag from a node handle on the canvas · visual only
                      </p>
                    </div>

                    <ScrollArea className="flex-1 overflow-y-auto">
                      <div className="p-2 space-y-1">
                        {!active?.customEdges?.length ? (
                          <p className="text-center text-[10px] text-muted-foreground/25 py-8">
                            No flow arrows yet
                          </p>
                        ) : (
                          (active?.customEdges || []).map((ce) => {
                            const srcStep = active?.steps.find((s) => s.id === ce.source);
                            const tgtStep = active?.steps.find((s) => s.id === ce.target);
                            const srcMeta = srcStep
                              ? ACTIONS.find((a) => a.id === srcStep.action)
                              : null;
                            const tgtMeta = tgtStep
                              ? ACTIONS.find((a) => a.id === tgtStep.action)
                              : null;
                            return (
                              <div
                                key={ce.id}
                                className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-indigo-500/5 border border-indigo-500/15 group">
                                <div className="flex-1 min-w-0 text-[10px] font-mono">
                                  <span style={{ color: srcMeta?.color || '#94a3b8' }}>
                                    {srcMeta?.icon} {srcStep?.description || ce.source.slice(0, 8)}
                                  </span>
                                  <span className="mx-1 text-muted-foreground/30">→</span>
                                  <span style={{ color: tgtMeta?.color || '#94a3b8' }}>
                                    {tgtMeta?.icon} {tgtStep?.description || ce.target.slice(0, 8)}
                                  </span>
                                </div>
                                <button
                                  onClick={() => {
                                    const cur = activeRef.current;
                                    if (!cur) return;
                                    update({
                                      ...cur,
                                      customEdges: cur.customEdges.filter((x) => x.id !== ce.id),
                                    });
                                  }}
                                  className="transition-all opacity-0 group-hover:opacity-100 text-muted-foreground/20 hover:text-rose-400">
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {/*  RUN LOG TAB  */}
                {rightTab === 'log' && (
                  <ScrollArea className="flex-1 overflow-y-auto">
                    <div className="p-2 space-y-0.5">
                      {runLogs.length === 0 ? (
                        <p className="text-center text-[10px] text-muted-foreground/25 py-10">
                          {active.steps.length > 0 ? 'Click Run to execute' : 'Add steps first'}
                        </p>
                      ) : (
                        runLogs.map((log, i) => {
                          const step = active.steps.find((s) => s.id === log.stepId);
                          const meta = step ? ACTIONS.find((a) => a.id === step.action) : null;
                          const pgColor = step?.parallelGroup
                            ? GROUP_COLORS[step.parallelGroup]
                            : null;
                          return (
                            <div
                              key={`log-${i}`}
                              className={cn(
                                'rounded-lg px-2.5 py-2 text-[10px] break-all cursor-pointer transition-colors',
                                log.status === 'ok'
                                  ? 'bg-emerald-500/8 text-emerald-400 hover:bg-emerald-500/12'
                                  : log.status === 'error'
                                    ? 'bg-rose-500/8 text-rose-400 hover:bg-rose-500/12'
                                    : log.status === 'running'
                                      ? 'bg-amber-500/8 text-amber-400'
                                      : 'text-muted-foreground',
                              )}
                              style={pgColor ? { borderLeft: `2px solid ${pgColor.border}55` } : {}}
                              onClick={() => step && setSelectedStepId(step.id)}>
                              <div className="flex items-start gap-1.5">
                                {log.status === 'ok' && (
                                  <CheckCircle2 className="w-3 h-3 flex-shrink-0 mt-0.5" />
                                )}
                                {log.status === 'error' && (
                                  <XCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                                )}
                                {log.status === 'running' && (
                                  <RefreshCw className="w-3 h-3 flex-shrink-0 mt-0.5 animate-spin" />
                                )}
                                <div className="flex-1 min-w-0">
                                  {meta && (
                                    <span className="text-[9px] font-mono opacity-50 mr-1">
                                      {meta.icon} {step?.description}
                                      {step?.parallelGroup && (
                                        <span style={{ color: pgColor?.color }} className="ml-1">
                                          ⑆{step.parallelGroup}
                                        </span>
                                      )}
                                    </span>
                                  )}
                                  <div className="font-mono leading-relaxed">{log.message}</div>
                                  {log.duration && (
                                    <div className="text-[9px] opacity-40 mt-0.5">
                                      {log.duration}ms
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
