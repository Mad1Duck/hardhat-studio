import { ipcMain } from 'electron';

//  Shared JSON-RPC helper 
async function rpc<T>(
  url: string,
  method: string,
  params: unknown[] = [],
  id = 1,
): Promise<{ result?: T; error?: { message: string; }; }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });
  return res.json() as Promise<{ result?: T; error?: { message: string; }; }>;
}

//  Hardhat default accounts (20 accounts, test mnemonic) 
const DEFAULT_ACCOUNTS = [
  { address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' },
  { address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', privateKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' },
  { address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', privateKey: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a' },
  { address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906', privateKey: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6' },
  { address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', privateKey: '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926b' },
  { address: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc', privateKey: '0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba' },
  { address: '0x976EA74026E726554dB657fA54763abd0C3a0aa9', privateKey: '0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564' },
  { address: '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955', privateKey: '0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356' },
  { address: '0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f', privateKey: '0xdbda1821b80551c9d65939329250132c444b4a15823c01d4b8a5e64d03c5a8a5' },
  { address: '0xa0Ee7A142d267C1f36714E4a8F75612F20a79720', privateKey: '0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6' },
  { address: '0xBcd4042DE499D14e55001CcbB24a551F3b954096', privateKey: '0xf214f2b2cd398c806f84e317254e0f0b801d0643303237d97a22a48e01628897' },
  { address: '0x71bE63f3384f5fb98995898A86B02Fb2426c5788', privateKey: '0x701b615bbdfb9de65240bc28bd21bbc0d996645a3dd57e7b12bc2bdf6f192c82' },
  { address: '0xFABB0ac9d68B0B445fB7357272Ff202C5651694a', privateKey: '0xa267530f49f8280200edf313ee7af6b827f2a8bce2897751d06a843f644967b1' },
  { address: '0x1CBd3b2770909D4e10f157cABC84C7264073C9Ec', privateKey: '0x47c99abed3324a2707c28affff1267e45918ec8c3f20b8aa892e8b065d2942dd' },
  { address: '0xdF3e18d64BC6A983f673Ab319CCaE4f1a57C7097', privateKey: '0xc526ee95bf44d8fc405a158bb884d9d1238d99f0612e9f33d006bb0789009aaa' },
  { address: '0xcd3B766CCDd6AE721141F452C550Ca635964ce71', privateKey: '0x8166f546bab6da521a8369cab06c5d2b9e46670292d85ca9517fb0706b19e7b' },
  { address: '0x2546BcD3c84621e976D8185a91A922aE77ECEc30', privateKey: '0xea6c44ac03bff858b476bba28179e2f12f3a5cb5e89fa64dd57ce40de0e4c8a' },
  { address: '0xbDA5747bFD65F08deb54cb465eB87D40e51B197E', privateKey: '0x689af8efa8c651a91ad287602527f3af2fe9f6501a7ac4b061667b5a93e037fd' },
  { address: '0xdD2FD4581271e230360230F9337D5c0430Bf44C0', privateKey: '0xde9be857da6a0e9c9f7a5c2f8c22a0d5f8a2bbb60b87f6bebc02fb17f9ca0d2' },
  { address: '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199', privateKey: '0xdf57089febbacf7ba0bc227dafbffa9fc08a93fdc68e1e42411a14efcf23656e' },
] as const;

//  ERC-20 ABI selectors 
const ERC20 = {
  balanceOf: '0x70a08231',
  symbol: '0x95d89b41',
  decimals: '0x313ce567',
  name: '0x06fdde03',
} as const;

function decodeAbiString(hex: string): string {
  if (!hex || hex === '0x') return '';
  try {
    const clean = hex.slice(2);
    const offset = parseInt(clean.slice(0, 64), 16) * 2;
    const len = parseInt(clean.slice(64, 128), 16) * 2;
    return Buffer.from(clean.slice(128, 128 + len), 'hex').toString('utf8').replace(/\0/g, '');
  } catch { return ''; }
}

//  EIP-1967 proxy slots 
const PROXY_SLOTS = {
  implementation: '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc',
  admin: '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103',
  beacon: '0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50',
} as const;

//  IPC Handlers 
export function registerEvmHandlers(): void {

  //  Chain state 
  ipcMain.handle('evm-snapshot', async (_, rpcUrl: string) => {
    try {
      const data = await rpc<string>(rpcUrl, 'evm_snapshot');
      if (data.error) return { success: false, error: data.error.message };
      return { success: true, snapshotId: data.result };
    } catch (e) { return { success: false, error: String(e) }; }
  });

  ipcMain.handle('evm-revert', async (
    _,
    { rpcUrl, snapshotId }: { rpcUrl: string; snapshotId: string; },
  ) => {
    try {
      const data = await rpc<boolean>(rpcUrl, 'evm_revert', [snapshotId]);
      if (data.error) return { success: false, error: data.error.message };
      return { success: true, result: data.result };
    } catch (e) { return { success: false, error: String(e) }; }
  });

  ipcMain.handle('evm-mine', async (_, rpcUrl: string) => {
    try {
      const data = await rpc<string>(rpcUrl, 'evm_mine');
      return { success: !data.error };
    } catch (e) { return { success: false, error: String(e) }; }
  });

  ipcMain.handle('eth-block-number', async (_, rpcUrl: string) => {
    try {
      const data = await rpc<string>(rpcUrl, 'eth_blockNumber');
      return data.result ? parseInt(data.result, 16) : 0;
    } catch { return 0; }
  });

  //  Hardhat accounts 
  ipcMain.handle('get-hardhat-accounts', async (_, rpcUrl: string) => {
    try {
      const data = await rpc<string[]>(rpcUrl, 'eth_accounts');
      if (data.result?.length) {
        const knownMap = new Map(DEFAULT_ACCOUNTS.map(a => [a.address.toLowerCase(), a]));
        return data.result.map((addr, i) => ({
          ...(knownMap.get(addr.toLowerCase()) ?? { address: addr, privateKey: '' }),
          index: i,
          balance: '0',
        }));
      }
    } catch { /* node offline — fall through */ }

    return DEFAULT_ACCOUNTS.map((a, i) => ({ ...a, index: i, balance: '0' }));
  });

  //  ERC-20 token balances 
  ipcMain.handle('get-token-balances', async (
    _,
    { rpcUrl, address, tokenAddresses }: {
      rpcUrl: string;
      address: string;
      tokenAddresses: string[];
    },
  ) => {
    const padAddr = address.slice(2).padStart(64, '0');

    return Promise.all(tokenAddresses.map(async (tokenAddr) => {
      try {
        const call = (selector: string, id: number) =>
          rpc<string>(rpcUrl, 'eth_call', [{ to: tokenAddr, data: selector + (selector === ERC20.balanceOf ? padAddr : '') }, 'latest'], id);

        const [balData, symData, decData, nameData] = await Promise.all([
          call(ERC20.balanceOf, 1),
          call(ERC20.symbol, 2),
          call(ERC20.decimals, 3),
          call(ERC20.name, 4),
        ]);

        const balance = balData.result && balData.result !== '0x'
          ? BigInt(balData.result).toString() : '0';
        const decimals = decData.result && decData.result !== '0x'
          ? parseInt(decData.result, 16) : 18;

        return {
          address: tokenAddr,
          name: decodeAbiString(nameData.result ?? ''),
          symbol: decodeAbiString(symData.result ?? ''),
          decimals,
          balance,
          balanceFormatted: decimals > 0
            ? (Number(balance) / 10 ** decimals).toFixed(4)
            : balance,
        };
      } catch { return null; }
    })).then(r => r.filter(Boolean));
  });

  //  Proxy inspector 
  ipcMain.handle('inspect-proxy', async (
    _,
    { rpcUrl, address }: { rpcUrl: string; address: string; },
  ) => {
    const getSlot = async (slot: string) => {
      try {
        const data = await rpc<string>(rpcUrl, 'eth_getStorageAt', [address, slot, 'latest']);
        return data.result ?? '0x' + '0'.repeat(64);
      } catch { return '0x' + '0'.repeat(64); }
    };

    const toAddr = (s: string) => '0x' + s.slice(-40);
    const isZero = (a: string) => a === '0x' + '0'.repeat(40);

    const [implSlot, adminSlot, beaconSlot] = await Promise.all([
      getSlot(PROXY_SLOTS.implementation),
      getSlot(PROXY_SLOTS.admin),
      getSlot(PROXY_SLOTS.beacon),
    ]);

    const impl = toAddr(implSlot);
    const admin = toAddr(adminSlot);
    const beacon = toAddr(beaconSlot);

    let type = 'unknown';
    if (!isZero(impl) && !isZero(admin)) type = 'transparent';
    else if (!isZero(impl) && isZero(admin)) type = 'uups';
    else if (!isZero(beacon)) type = 'beacon';

    const codeData = await rpc<string>(rpcUrl, 'eth_getCode', [address, 'latest']);
    const code = codeData.result ?? '0x';
    if (code.includes('363d3d37')) type = 'minimal';

    return {
      type,
      proxyAddress: address,
      implementationAddress: isZero(impl) ? null : impl,
      adminAddress: isZero(admin) ? null : admin,
      beaconAddress: isZero(beacon) ? null : beacon,
      slots: [
        { slot: PROXY_SLOTS.implementation, value: implSlot, label: 'Implementation' },
        { slot: PROXY_SLOTS.admin, value: adminSlot, label: 'Admin' },
        { slot: PROXY_SLOTS.beacon, value: beaconSlot, label: 'Beacon' },
      ],
      bytecodeSize: (code.length - 2) / 2,
      isProxy: type !== 'unknown' && code.length > 2,
    };
  });
}
