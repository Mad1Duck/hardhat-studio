import type { Step, ActionType } from '../types';
import { ACTIONS } from '../config/actions';

export function makeStep(action: ActionType): Step {
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
