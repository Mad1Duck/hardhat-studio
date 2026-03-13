import { MarkerType, type Node, type Edge } from '@xyflow/react';
import type { Step, CustomEdge, StepNodeData, ForkJoinData } from '../types';
import { GROUP_COLORS } from '../config/groups';
import { buildBatches } from '../lib/buildBatches';
import { computeLayout, NODE_WIDTH, NODE_HEIGHT, NODE_GAP_X } from '../lib/computeLayout';

export function buildFlow(
  steps: Step[],
  activeStepId: string | null,
  selectedId: string | null,
  onSelect: (id: string) => void,
  customEdges: CustomEdge[] = [],
  layoutPositions?: Map<string, { x: number; y: number; }>,
): { nodes: Node[]; edges: Edge[]; } {
  const batches = buildBatches(steps);
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const positions = layoutPositions ?? computeLayout(steps, customEdges);

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
      const forkPos = positions.get(forkId) ?? { x: -14, y: 40 };

      nodes.push({
        id: forkId, type: 'forkjoin',
        position: forkPos,
        data: { kind: 'fork', groupId: pgId, allOk, anyRunning, anyError } satisfies ForkJoinData,
        style: { background: 'transparent', border: 'none', padding: 0 },
        selectable: false, draggable: false,
      });

      batch.forEach((step, si) => {
        const pos = positions.get(step.id) ?? { x: si * (NODE_WIDTH + NODE_GAP_X), y: 100 };
        nodes.push({
          id: step.id, type: 'step', position: pos,
          data: { step, index: steps.indexOf(step), isActive: step.id === activeStepId, isSelected: step.id === selectedId, onSelect } satisfies StepNodeData,
          style: { background: 'transparent', border: 'none', padding: 0 },
        });
        edges.push({
          id: `e-${forkId}-${step.id}`, source: forkId, target: step.id,
          type: 'smoothstep',
          markerEnd: { type: MarkerType.ArrowClosed, color: pgColor?.border ?? '#334155' },
          style: { stroke: pgColor ? `${pgColor.border}88` : '#33415566', strokeWidth: 1.5, strokeDasharray: step.status === 'idle' ? '5,4' : undefined },
          animated: step.status === 'running',
        });
      });

      const joinPos = positions.get(joinId) ?? { x: -14, y: 300 };
      nodes.push({
        id: joinId, type: 'forkjoin', position: joinPos,
        data: { kind: 'join', groupId: pgId, allOk, anyRunning, anyError } satisfies ForkJoinData,
        style: { background: 'transparent', border: 'none', padding: 0 },
        selectable: false, draggable: false,
      });

      batch.forEach((step) => {
        edges.push({
          id: `e-${step.id}-${joinId}`, source: step.id, target: joinId,
          type: 'smoothstep',
          markerEnd: { type: MarkerType.ArrowClosed, color: pgColor?.border ?? '#334155' },
          style: {
            stroke: step.status === 'ok'
              ? (pgColor ? `${pgColor.border}88` : '#10b98155')
              : (pgColor ? `${pgColor.border}44` : '#33415566'),
            strokeWidth: step.status === 'ok' ? 2 : 1.5,
            strokeDasharray: step.status === 'idle' ? '5,4' : undefined,
          },
          animated: anyRunning && step.status !== 'ok',
        });
      });
    } else {
      const step = batch[0];
      const pos = positions.get(step.id) ?? { x: -NODE_WIDTH / 2, y: 40 };
      nodes.push({
        id: step.id, type: 'step', position: pos,
        data: { step, index: steps.indexOf(step), isActive: step.id === activeStepId, isSelected: step.id === selectedId, onSelect } satisfies StepNodeData,
        style: { background: 'transparent', border: 'none', padding: 0 },
      });
    }
  });

  // Custom (user-drawn) edges
  const autoIds = new Set(edges.map((e) => e.id));
  customEdges.forEach((ce) => {
    if (autoIds.has(ce.id)) return;
    edges.push({
      id: ce.id, source: ce.source, target: ce.target,
      type: 'smoothstep',
      label: ce.label ?? undefined,
      labelStyle: { fontSize: 9, fill: '#94a3b8', fontFamily: "'JetBrains Mono', monospace" },
      labelBgStyle: { fill: '#0d1117', fillOpacity: 0.9 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
      style: { stroke: '#6366f1', strokeWidth: 2, strokeDasharray: '6,3' },
    });
  });

  return { nodes, edges };
}
