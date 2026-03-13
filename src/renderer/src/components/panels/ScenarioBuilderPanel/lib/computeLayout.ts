import type { Step, CustomEdge } from '../types';
import { buildBatches } from './buildBatches';

export const NODE_WIDTH = 240;
export const NODE_HEIGHT = 160;
export const NODE_GAP_X = 80;
export const NODE_GAP_Y = 70;
export const FORK_SIZE = 28;
export const FORK_GAP_Y = 55;

/**
 * Returns a Map<nodeId, {x, y}> for every node including fork/join diamonds.
 */
export function computeLayout(
  steps: Step[],
  customEdges: CustomEdge[] = [],
): Map<string, { x: number; y: number; }> {
  const batches = buildBatches(steps);

  //  1. Collect all node IDs 
  const allNodeIds: string[] = [];

  batches.forEach((batch, bi) => {
    const isParallel = batch.length > 1 && !!batch[0].parallelGroup;
    const pgId = isParallel ? batch[0].parallelGroup! : null;

    if (isParallel && pgId) {
      allNodeIds.push(`fork-${pgId}-${bi}`);
      batch.forEach((s) => allNodeIds.push(s.id));
      allNodeIds.push(`join-${pgId}-${bi}`);
    } else {
      allNodeIds.push(batch[0].id);
    }
  });

  const nodeSet = new Set(allNodeIds);

  //  2. Build adjacency 
  const adjOut = new Map<string, Set<string>>();
  const adjIn = new Map<string, Set<string>>();
  allNodeIds.forEach((id) => {
    adjOut.set(id, new Set());
    adjIn.set(id, new Set());
  });

  const addEdge = (src: string, tgt: string) => {
    if (!nodeSet.has(src) || !nodeSet.has(tgt)) return;
    adjOut.get(src)!.add(tgt);
    adjIn.get(tgt)!.add(src);
  };

  // Auto edges: fork→steps, steps→join
  batches.forEach((batch, bi) => {
    const isParallel = batch.length > 1 && !!batch[0].parallelGroup;
    const pgId = isParallel ? batch[0].parallelGroup! : null;
    if (isParallel && pgId) {
      const forkId = `fork-${pgId}-${bi}`;
      const joinId = `join-${pgId}-${bi}`;
      batch.forEach((s) => { addEdge(forkId, s.id); addEdge(s.id, joinId); });
    }
  });

  // Custom (user-drawn) edges
  customEdges.forEach((ce) => addEdge(ce.source, ce.target));

  //  3. Longest-path layer assignment (Kahn's BFS variant) 
  const layer = new Map<string, number>();
  const inDeg = new Map<string, number>();
  allNodeIds.forEach((id) => inDeg.set(id, adjIn.get(id)!.size));

  const queue = allNodeIds.filter((id) => inDeg.get(id) === 0);
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

  // Fallback: unconnected nodes get sequential layers
  let fallback = 0;
  allNodeIds.forEach((id) => {
    if (!layer.has(id)) { layer.set(id, fallback); fallback++; }
  });

  //  4. Bucket by layer 
  const buckets = new Map<number, string[]>();
  allNodeIds.forEach((id) => {
    const l = layer.get(id) ?? 0;
    if (!buckets.has(l)) buckets.set(l, []);
    buckets.get(l)!.push(id);
  });

  const sortedLayers = Array.from(buckets.keys()).sort((a, b) => a - b);

  //  5. Assign positions 
  const positions = new Map<string, { x: number; y: number; }>();
  let y = 60;

  sortedLayers.forEach((li) => {
    const ids = buckets.get(li)!;
    const stepIds = ids.filter((id) => !id.startsWith('fork-') && !id.startsWith('join-'));
    const diagIds = ids.filter((id) => id.startsWith('fork-') || id.startsWith('join-'));
    const rowH = stepIds.length > 0 ? NODE_HEIGHT : FORK_SIZE;

    if (stepIds.length > 0) {
      const totalW = stepIds.length * NODE_WIDTH + (stepIds.length - 1) * NODE_GAP_X;
      const startX = -totalW / 2 + NODE_WIDTH / 2;
      stepIds.forEach((id, si) => {
        positions.set(id, { x: startX + si * (NODE_WIDTH + NODE_GAP_X), y });
      });
    }

    diagIds.forEach((id) => positions.set(id, { x: -FORK_SIZE / 2, y }));

    y += rowH + (stepIds.length > 0 ? NODE_GAP_Y : FORK_GAP_Y);
  });

  return positions;
}
