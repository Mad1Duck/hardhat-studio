const _decimalsCache = new Map<string, number>();

export async function getTokenDecimals(
  rpcUrl: string,
  contractAddress: string,
  abi: any[],
): Promise<number> {
  const key = contractAddress.toLowerCase();
  if (_decimalsCache.has(key)) return _decimalsCache.get(key)!;
  try {
    const hasDecimals = abi.some((i: any) => i.type === 'function' && i.name === 'decimals');
    if (!hasDecimals) return 18;
    const { ethers } = await import('ethers');
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const c = new ethers.Contract(contractAddress, abi, provider);
    const dec = Number(await c.decimals());
    _decimalsCache.set(key, dec);
    return dec;
  } catch {
    return 18;
  }
}

export function clearDecimalsCache() {
  _decimalsCache.clear();
}
