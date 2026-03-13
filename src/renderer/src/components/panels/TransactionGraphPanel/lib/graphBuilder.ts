import { TxRecord, DeployedContract } from '../../../../types';
import { RpcBlock, NodeData, EdgeData } from '../types';
import { NODE_TYPE_STYLE } from '../config/nodeStyles';
import { hex, shortAddr } from '../lib/rpcUtils';

interface BuildGraphOptions {
  blocks: RpcBlock[];
  txHistory: TxRecord[];
  deployedContracts: DeployedContract[];
  filterAddr: string;
  showOnlyKnown: boolean;
}

export function buildGraphData({ blocks, txHistory, deployedContracts, filterAddr, showOnlyKnown }: BuildGraphOptions) {
  const contractAddrs = new Set(deployedContracts.map((c) => c.address.toLowerCase()));

  type NM = { type: NodeData['nodeType']; txCount: number; contractName?: string; };
  const nodeMap = new Map<string, NM>();

  const allTxs = blocks.flatMap((b) => (b.transactions || []).map((tx) => ({ tx, block: b })));
  const filtered = allTxs
    .filter(({ tx }) => {
      if (filterAddr) {
        const f = filterAddr.toLowerCase();
        return tx.from?.toLowerCase() === f || tx.to?.toLowerCase() === f;
      }
      if (showOnlyKnown) {
        return (
          contractAddrs.has(tx.from?.toLowerCase()) ||
          contractAddrs.has(tx.to?.toLowerCase() || '')
        );
      }
      return true;
    })
    .slice(0, 100);

  const ensure = (addr: string) => {
    const key = addr.toLowerCase();
    if (nodeMap.has(key)) { nodeMap.get(key)!.txCount++; return; }
    const isMiner = blocks.some((b) => b.miner?.toLowerCase() === key);
    const isContract = contractAddrs.has(key);
    const type: NodeData['nodeType'] = isMiner ? 'miner' : isContract ? 'contract' : 'wallet';
    nodeMap.set(key, {
      type,
      txCount: 1,
      contractName: deployedContracts.find((c) => c.address.toLowerCase() === key)?.name,
    });
  };

  filtered.forEach(({ tx }) => {
    if (tx.from) ensure(tx.from);
    ensure(tx.to || `deploy_${tx.hash.slice(0, 8)}`);
  });

  // Layout: concentric circles by type
  const groups: Record<string, string[]> = { miner: [], contract: [], wallet: [], external: [] };
  nodeMap.forEach((v, k) => groups[v.type].push(k));

  const positions = new Map<string, { x: number; y: number; }>();
  const place = (keys: string[], r: number, cx = 500, cy = 320) => {
    keys.forEach((k, i) => {
      const a = (i / Math.max(keys.length, 1)) * Math.PI * 2 - Math.PI / 2;
      const ring = r + Math.floor(i / 10) * 120;
      positions.set(k, { x: cx + Math.cos(a) * ring, y: cy + Math.sin(a) * ring });
    });
  };
  place(groups.miner, 70);
  place(groups.contract, 200);
  place(groups.wallet, 350);
  place(groups.external, 480);

  const nodes = [...nodeMap.entries()].map(([key, nd]) => ({
    id: key,
    type: 'address',
    position: positions.get(key) || { x: 400, y: 300 },
    data: {
      address: key,
      label: shortAddr(key),
      nodeType: nd.type,
      txCount: nd.txCount,
      contractName: nd.contractName,
    } as NodeData,
    style: { background: 'transparent', border: 'none', padding: 0 },
  }));

  const edges = filtered.map(({ tx }) => {
    const local = txHistory.find((t) => t.hash === tx.hash);
    return {
      id: tx.hash,
      source: tx.from?.toLowerCase() || '',
      target: (tx.to || `deploy_${tx.hash.slice(0, 8)}`).toLowerCase(),
      type: 'tx',
      data: {
        txHash: tx.hash,
        value: tx.value || '0',
        input: tx.input || '0x',
        status: (local?.status === 'success' ? 'success' : local?.status === 'failed' ? 'failed' : 'unknown') as EdgeData['status'],
        blockNumber: hex(tx.blockNumber),
        gasPrice: tx.gasPrice || '0',
        nonce: hex(tx.nonce),
        functionSig: tx.input?.length >= 10 ? tx.input.slice(0, 10) : undefined,
        localName: local ? `${local.contractName}.${local.functionName}()` : undefined,
      } as EdgeData,
    };
  });

  return { nodes, edges };
}
