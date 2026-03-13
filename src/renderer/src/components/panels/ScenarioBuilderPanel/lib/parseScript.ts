import type { Step } from '../types';

function blankStep(overrides: Partial<Step>): Step {
  return {
    id: crypto.randomUUID(),
    action: 'log',
    description: '',
    contractAddress: '',
    contractName: '',
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
    ...overrides,
  };
}

/**
 * Best-effort parser that converts a Hardhat .ts / .js script into
 * ScenarioBuilder steps. Recognises the most common patterns.
 */
export function parseScriptToSteps(text: string): Step[] {
  const steps: Step[] = [];
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();

    const contractAtMatch = raw.match(/getContractAt\(['"](.+?)['"]\s*,\s*['"](.+?)['"]\)/);
    if (contractAtMatch) {
      const contractName = contractAtMatch[1];
      const contractAddress = contractAtMatch[2];
      const nextLine = (lines[i + 1] || '').trim();
      const callMatch = nextLine.match(/await\s+\w+\.(\w+)\(([^)]*)\)/);
      const fnName = callMatch?.[1] || '';
      const args = callMatch?.[2]?.replace(/['"]/g, '').trim() || '';
      const isRead = nextLine.includes('const r_');
      steps.push(blankStep({ action: isRead ? 'call' : 'send', description: `${isRead ? 'Call' : 'Send'} ${fnName}`, contractName, contractAddress, functionName: fnName, args }));
      i++;
      continue;
    }

    // evm_mine
    if (raw.includes("'evm_mine'") || raw.includes('"evm_mine"')) {
      const blocksMatch = raw.match(/new Array\((\d+)\)/);
      steps.push(blankStep({ action: 'wait', description: 'Mine Blocks', blocks: blocksMatch?.[1] || '1' }));
      continue;
    }

    // setTimeout
    if (raw.includes('setTimeout')) {
      const msMatch = raw.match(/setTimeout\(r,\s*(\d+)\)/);
      steps.push(blankStep({ action: 'timeout', description: 'Wait Timeout', timeoutMs: msMatch?.[1] || '1000' }));
      continue;
    }

    // console.log
    if (raw.startsWith('console.log(')) {
      const msgMatch = raw.match(/console\.log\(['"](.+?)['"]\)/);
      steps.push(blankStep({ action: 'log', description: 'Log Message', message: msgMatch?.[1] || '' }));
      continue;
    }

    // evm_snapshot
    if (raw.includes("'evm_snapshot'") || raw.includes('"evm_snapshot"')) {
      steps.push(blankStep({ action: 'snapshot', description: 'Snapshot' }));
      continue;
    }

    // hardhat_impersonateAccount
    if (raw.includes('hardhat_impersonateAccount')) {
      const addrMatch = raw.match(/\['(.+?)'/);
      steps.push(blankStep({ action: 'impersonate', description: 'Impersonate', impersonateAddr: addrMatch?.[1] || '' }));
      continue;
    }
  }

  return steps;
}
