// 
//  CONTRACT UTILS — ABI encoding helpers + on-chain stream verification
// 

import { SABLIER_FLOW_CONTRACTS } from '../config/chainConfig';
import { RECIPIENT_ADDRESS } from '../config/planConfig';

//  Function selectors (keccak256 first 4 bytes) 
const SEL_PAUSE = '0xf7888aec'; // pause(uint256)
const SEL_RESTART = '0x5bcb2fc6'; // restart(uint256,uint128)
const SEL_OWNER_OF = '0x6352211e'; // ownerOf(uint256)  — ERC-721

//  Low-level helpers 

function encodeUint256(n: number | bigint): string {
  return BigInt(n).toString(16).padStart(64, '0');
}

/** ABI-encode a pause(streamId) call. */
export function encodePause(numericId: number): string {
  return SEL_PAUSE + encodeUint256(numericId);
}

/** ABI-encode a restart(streamId, ratePerSecond) call. */
export function encodeRestart(numericId: number, ratePerSecond: string): string {
  return SEL_RESTART + encodeUint256(numericId) + encodeUint256(BigInt(ratePerSecond));
}

//  On-chain verification 

/**
 * verifyStreamOnChain — calls ownerOf(streamId) on the Sablier Flow contract
 * to confirm the stream NFT is held by RECIPIENT_ADDRESS.
 *
 * Used as a secondary check after subgraph lookup to prevent spoofed data.
 */
export async function verifyStreamOnChain(
  streamNumericId: number,
  chainId: number,
): Promise<{ ok: boolean; onchainRecipient: string; error?: string; }> {
  const eth = typeof window !== 'undefined' ? (window as any).ethereum : null;
  if (!eth) return { ok: false, onchainRecipient: '', error: 'No ethereum provider' };

  const contractAddr = SABLIER_FLOW_CONTRACTS[chainId];
  if (!contractAddr) {
    return { ok: false, onchainRecipient: '', error: `No contract for chainId ${chainId}` };
  }

  try {
    const calldata = SEL_OWNER_OF + encodeUint256(streamNumericId);
    const result: string = await eth.request({
      method: 'eth_call',
      params: [{ to: contractAddr, data: calldata }, 'latest'],
    });
    const onchainRecipient = '0x' + result.slice(-40);
    const ok = onchainRecipient.toLowerCase() === RECIPIENT_ADDRESS.toLowerCase();
    return { ok, onchainRecipient };
  } catch (err: any) {
    return { ok: false, onchainRecipient: '', error: err.message ?? String(err) };
  }
}

//  Parse numeric stream ID from alias 

/**
 * parseStreamNumericId — extract trailing numeric ID from aliases like
 * "FL3-11155111-163" → 163  or  "0xabc...def-163" → 163.
 */
export function parseStreamNumericId(
  stream: { streamAlias: string; streamId: string; },
): number | null {
  const aliasMatch = stream.streamAlias.match(/-(\d+)$/);
  if (aliasMatch) return parseInt(aliasMatch[1], 10);
  const idMatch = stream.streamId.match(/-(\d+)$/);
  if (idMatch) return parseInt(idMatch[1], 10);
  return null;
}
