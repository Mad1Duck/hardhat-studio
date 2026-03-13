import type { Step } from '../types';
import type { DeployedContract, HardhatAccount } from '../../../../types';

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

export interface StepResult {
  ok: boolean;
  message: string;
  txHash?: string;
  gasUsed?: string;
}

export async function runStep(
  step: Step,
  deployed: DeployedContract[],
  rpcUrl: string,
  hhAccounts: HardhatAccount[],
): Promise<StepResult> {
  const ethers = await import('ethers');
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const pk = step.fromPrivateKey || hhAccounts[0]?.privateKey;
  const signer = pk ? new ethers.Wallet(pk, provider) : null;

  //  Chain helpers 
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
    await rpcCall(rpcUrl, 'evm_revert', [step.message || '0x1']);
    return { ok: true, message: `⏪ Reverted to snapshot ${step.message || '0x1'}` };
  }

  if (step.action === 'impersonate') {
    await rpcCall(rpcUrl, 'hardhat_impersonateAccount', [step.impersonateAddr]);
    return { ok: true, message: `🎭 Impersonating ${step.impersonateAddr}` };
  }

  if (step.action === 'set_balance') {
    const wei = ethers.parseEther(step.balanceEth || '10').toString(16);
    await rpcCall(rpcUrl, 'hardhat_setBalance', [step.balanceAddr, `0x${wei}`]);
    return { ok: true, message: `💰 Set ${step.balanceAddr.slice(0, 10)}… = ${step.balanceEth} ETH` };
  }

  if (step.action === 'log') {
    return { ok: true, message: `📝 ${step.message || '(empty)'}` };
  }

  //  Contract lookup 
  const findContract = (addr: string, name: string) =>
    deployed.find(
      (c) => (addr && c.address.toLowerCase() === addr.toLowerCase()) || (name && c.name === name),
    );

  //  Call / Send 
  if (step.action === 'call' || step.action === 'send') {
    const dc = findContract(step.contractAddress, step.contractName);
    if (!dc) return { ok: false, message: `Contract not found: ${step.contractName || step.contractAddress}` };

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

      const instance = new ethers.Contract(dc.address, dc.abi, isRead ? provider : signer ?? provider);
      const fn = instance[step.functionName] as (...a: unknown[]) => Promise<unknown>;
      if (!fn) return { ok: false, message: `${step.functionName} not found on ABI` };

      const overrides: Record<string, unknown> = {};
      if (!isRead && step.value && step.value !== '0') overrides.value = ethers.parseEther(step.value);
      const callArgs = Object.keys(overrides).length ? [...parsedArgs, overrides] : parsedArgs;
      const result = await fn(...callArgs);

      if (isRead) {
        const str = typeof result === 'bigint'
          ? result.toString()
          : JSON.stringify(result, (_, v) => (typeof v === 'bigint' ? v.toString() : v));
        return { ok: true, message: `→ ${str}` };
      } else {
        const receipt = await (result as { wait: () => Promise<{ hash: string; gasUsed: bigint; }>; }).wait();
        return { ok: true, message: `✓ ${step.functionName}()`, txHash: receipt.hash, gasUsed: receipt.gasUsed?.toString() };
      }
    } catch (e: any) {
      return { ok: false, message: e.reason || e.shortMessage || e.message || String(e) };
    }
  }

  //  Assert 
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
      const op = step.assertOperator || 'eq';

      let passed = false;
      if (op === 'eq') passed = actualStr === expected || actualStr.toLowerCase() === expected.toLowerCase();
      else if (op === 'includes') passed = actualStr.includes(expected);
      else {
        const an = Number(actualStr), en = Number(expected);
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

  //  Assert Revert 
  if (step.action === 'assert_revert') {
    const dc = findContract(step.assertContract, step.assertContract);
    if (!dc) return { ok: false, message: `Contract not found: ${step.assertContract}` };
    try {
      const instance = new ethers.Contract(dc.address, dc.abi, signer ?? provider);
      const fn = instance[step.functionName] as (...a: unknown[]) => Promise<unknown>;
      const args = step.args.trim() ? step.args.split(',').map((a) => a.trim()) : [];
      await fn(...args);
      return { ok: false, message: `Expected revert but call succeeded` };
    } catch (e: any) {
      const msg = e.reason || e.shortMessage || e.message || '';
      if (!step.expectedRevertMsg || msg.includes(step.expectedRevertMsg)) {
        return { ok: true, message: `💥 Correctly reverted: ${msg.slice(0, 80)}` };
      }
      return { ok: false, message: `Wrong revert: expected "${step.expectedRevertMsg}", got "${msg}"` };
    }
  }

  //  Custom Script 
  if (step.action === 'custom_script') {
    const logs: string[] = [];
    const fakeConsole = {
      log: (...a: unknown[]) => logs.push(a.map(String).join(' ')),
      error: (...a: unknown[]) => logs.push('ERR: ' + a.map(String).join(' ')),
      warn: (...a: unknown[]) => logs.push('WARN: ' + a.map(String).join(' ')),
    };
    const contracts: Record<string, unknown> = {};
    deployed.forEach((dc) => {
      contracts[dc.name] = new (ethers as any).Contract(dc.address, dc.abi, signer ?? provider);
    });
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function('ethers', 'provider', 'signer', 'accounts', 'contracts', 'console',
        `return (async()=>{ ${step.script} })()`);
      await fn(ethers, provider, signer, hhAccounts, contracts, fakeConsole);
      return { ok: true, message: logs.length ? logs.join('\n') : '✓ Script done' };
    } catch (e: any) {
      return { ok: false, message: `Script error: ${e.message}` };
    }
  }

  return { ok: false, message: 'Unknown action' };
}
