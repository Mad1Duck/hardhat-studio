import { useState, useCallback } from 'react';
import {
  applyNodeChanges,
  applyEdgeChanges,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type Node,
  type Edge,
} from '@xyflow/react';
import type { Scenario, CustomEdge } from '../types';
import { buildFlow } from '../lib/buildFlow';
import { computeLayout } from '../lib/computeLayout';

export function useFlowGraph(
  active: Scenario | null,
  selectedStepId: string | null,
  onSelect: (id: string) => void,
  updateScenario: (s: Scenario) => void,
  activeRef: React.MutableRefObject<Scenario | null>,
) {
  const [rfNodes, setRfNodes] = useState<Node[]>([]);
  const [rfEdges, setRfEdges] = useState<Edge[]>([]);

  // Rebuild graph whenever steps/edges/positions/selection change
  const rebuild = useCallback(() => {
    if (!active) { setRfNodes([]); setRfEdges([]); return; }
    const savedPos  = active.nodePositions;
    const positions = savedPos
      ? new Map(Object.entries(savedPos))
      : computeLayout(active.steps, active.customEdges ?? []);
    const { nodes, edges } = buildFlow(
      active.steps, null, selectedStepId, onSelect,
      active.customEdges || [], positions,
    );
    setRfNodes(nodes);
    setRfEdges(edges);
  }, [active, selectedStepId, onSelect]);

  // Call rebuild when deps change — caller does this via useEffect
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setRfNodes((n) => {
      const updated  = applyNodeChanges(changes, n);
      const hasDrag  = changes.some((c) => c.type === 'position' && !(c as any).dragging);
      if (hasDrag && activeRef.current) {
        const posMap: Record<string, { x: number; y: number }> = {};
        updated.forEach((node) => { posMap[node.id] = { x: node.position.x, y: node.position.y }; });
        updateScenario({ ...activeRef.current, nodePositions: posMap });
      }
      return updated;
    });
  }, [activeRef, updateScenario]);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setRfEdges((e) => applyEdgeChanges(changes, e));
    const removed = changes
      .filter((c) => c.type === 'remove')
      .map((c) => (c as any).id as string)
      .filter((id) => id.startsWith('custom-'));
    if (removed.length > 0 && activeRef.current) {
      const cur     = activeRef.current;
      const updated = { ...cur, customEdges: (cur.customEdges || []).filter((ce) => !removed.includes(ce.id)) };
      updateScenario(updated);
    }
  }, [activeRef, updateScenario]);

  const onConnect = useCallback((connection: Connection) => {
    const cur = activeRef.current;
    if (!cur || !connection.source || !connection.target) return;
    const newEdge: CustomEdge = {
      id: `custom-${connection.source}-${connection.target}-${Date.now()}`,
      source: connection.source,
      target: connection.target,
    };
    updateScenario({ ...cur, customEdges: [...(cur.customEdges || []), newEdge] });
  }, [activeRef, updateScenario]);

  return { rfNodes, rfEdges, setRfNodes, onNodesChange, onEdgesChange, onConnect, rebuild };
}
