import { ContractAbi, DeployedContract } from '../../../../types';
import { ContractSupport } from '../../../modules/Simulation/types';
import { CallContractResult } from '../types';
import { TOKEN_AMOUNT_FNS, TOKEN_AMOUNT_ARGS } from '../config/eventColors';
import { getTokenDecimals } from './tokenUtils';
import { rpcCall } from './rpcUtils';

export function checkContractSupport(
  deployedContracts: DeployedContract[],
  requiredMethods: string[],
  abis?: ContractAbi[],
): ContractSupport {
  if (requiredMethods.length === 0) return { supported: true, missing: [], suggestions: [] };
  const allMethods = new Set<string>();
  deployedContracts.forEach((dc) => {
    const abiToUse =
      dc.abi.length > 0
        ? dc.abi
        : (abis?.find(
          (a) =>
            a.contractName.toLowerCase() === dc.name.toLowerCase() ||
            a.name.toLowerCase() === dc.name.toLowerCase(),
        )?.abi ?? []);
    abiToUse.forEach((item: any) => {
      if (item.type === 'function') allMethods.add(item.name);
    });
  });
  const missing = requiredMethods.filter((m) => !allMethods.has(m));
  return { supported: missing.length === 0, missing, suggestions: [] };
}

export function scoreContractMatch(name: string, contractName: string): number {
  let score = 0;
  const n = name.toLowerCase();
  const q = contractName.toLowerCase();
  if (n === q) score += 100;
  else if (n.includes(q) || q.includes(n)) score += 50;
  if (n.includes('sim') || n.includes('test') || n.includes('demo')) score += 10;
  return score;
}

export function enrichContracts(
  deployedContracts: DeployedContract[],
  abis: ContractAbi[],
): DeployedContract[] {
  return deployedContracts.map((dc) => {
    if (dc.abi && dc.abi.length > 0) return dc;
    const match = abis.find(
      (a) =>
        a.contractName.toLowerCase() === dc.name.toLowerCase() ||
        a.name.toLowerCase() === dc.name.toLowerCase(),
    );
    return match ? { ...dc, abi: match.abi as any } : dc;
  });
}

export function getContractCompatibility(
  dc: DeployedContract,
  requiredMethods: string[],
): 'full' | 'partial' | 'none' {
  if (requiredMethods.length === 0) return 'full';
  const abiFns = new Set(
    dc.abi.filter((i: any) => i.type === 'function').map((i: any) => i.name as string),
  );
  const matched = requiredMethods.filter((r) => abiFns.has(r));
  if (matched.length === requiredMethods.length) return 'full';
  if (matched.length > 0) return 'partial';
  return 'none';
}

export async function callDeployedContract(
  deployedContracts: DeployedContract[],
  rpcUrl: string,
  contractName: string,
  fn: string,
  args: any[],
  signerPk?: string,
  rawAmounts = false,
  forcedAddress?: string,
): Promise<CallContractResult> {
  if (contractName === 'Hardhat') {
    try {
      const result = await rpcCall(rpcUrl, fn, args);
      return { ok: true, result };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }

  let dc: DeployedContract | undefined;

  if (forcedAddress) {
    dc = deployedContracts.find((c) => c.address.toLowerCase() === forcedAddress.toLowerCase());
    if (!dc) return { ok: false, error: `Selected contract at ${forcedAddress} not found` };
  } else {
    const candidates = deployedContracts.filter(
      (c) =>
        c.name === contractName ||
        c.name.toLowerCase().includes(contractName.toLowerCase()) ||
        contractName.toLowerCase().includes(c.name.toLowerCase()) ||
        c.abi.some((item: any) => item.type === 'function' && item.name === fn),
    );
    if (candidates.length === 0) {
      return { ok: false, error: `No deployed contract found with function "${fn}()"` };
    }
    const scored = candidates.map((c) => ({ c, score: scoreContractMatch(c.name, contractName) }));
    scored.sort((a, b) => b.score - a.score);
    dc = scored[0].c;
  }

  const fnDef = dc.abi.find((i: any) => i.name === fn && i.type === 'function');
  if (!fnDef) return { ok: false, error: `Function "${fn}" not in ABI of ${dc.name}` };

  try {
    const { ethers } = await import('ethers');
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const isRead = fnDef.stateMutability === 'view' || fnDef.stateMutability === 'pure';
    const signer = signerPk ? new ethers.Wallet(signerPk, provider) : null;
    const contract = new ethers.Contract(dc.address, dc.abi, isRead ? provider : signer || provider);

    let decimals = 18;
    const needsScale = !rawAmounts && TOKEN_AMOUNT_FNS.has(fn);
    if (needsScale) decimals = await getTokenDecimals(rpcUrl, dc.address, dc.abi);
    const scaleIndices = needsScale ? (TOKEN_AMOUNT_ARGS[fn] ?? []) : [];

    const parsedArgs = args.map((a, idx) => {
      if (
        scaleIndices.includes(idx) &&
        (typeof a === 'number' || (typeof a === 'string' && /^[\d.]+$/.test(a)))
      ) {
        const human = typeof a === 'string' ? parseFloat(a) : a;
        const [whole, frac = ''] = human.toFixed(decimals).split('.');
        return BigInt(whole + frac.padEnd(decimals, '0').slice(0, decimals));
      }
      if (typeof a === 'string' && /^\d+$/.test(a)) return BigInt(a);
      if (typeof a === 'number') return BigInt(Math.floor(a));
      return a;
    });

    const result = await contract[fn](...parsedArgs);
    if (isRead) {
      return { ok: true, result: typeof result === 'bigint' ? result.toString() : result, resolvedContract: dc.name, decimals };
    } else {
      const receipt = await (result as any).wait();
      return { ok: true, txHash: receipt.hash, gasUsed: receipt.gasUsed?.toString(), resolvedContract: dc.name, decimals };
    }
  } catch (e: any) {
    return { ok: false, error: e.reason || e.shortMessage || e.message };
  }
}
