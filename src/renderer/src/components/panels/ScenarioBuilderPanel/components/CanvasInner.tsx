import { useCallback } from 'react';
import {
  ReactFlow,
  Background,
  MiniMap,
  Panel,
  useReactFlow,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type Node,
  type Edge,
  ConnectionLineType,
} from '@xyflow/react';
import { Plus, ChevronDown, Zap, Sparkles } from 'lucide-react';
import { cn } from '../../../../lib/utils';
import { Button } from '../../../ui/button';
import { FlowControls } from '../../../ui/FlowControls';
import { StepNode } from './StepNode';
import { ForkJoinNode } from './ForkJoinNode';
import type { Scenario, ActionType, StepNodeData } from '../types';
import { ACTIONS, ACTION_GROUPS, GROUP_LABELS } from '../config/actions';
import { GROUP_COLORS } from '../config/groups';
import { computeLayout } from '../lib/computeLayout';

const NODE_TYPES = { step: StepNode, forkjoin: ForkJoinNode };

interface Props {
  rfNodes: Node[];
  rfEdges: Edge[];
  onNodesChange: (c: NodeChange[]) => void;
  onEdgesChange: (c: EdgeChange[]) => void;
  onConnect: (c: Connection) => void;
  showAddMenu: boolean;
  setShowAddMenu: (v: boolean | ((p: boolean) => boolean)) => void;
  addStep: (a: ActionType) => void;
  active: Scenario;
  setRfNodes: React.Dispatch<React.SetStateAction<Node[]>>;
}

export function CanvasInner({
  rfNodes,
  rfEdges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  showAddMenu,
  setShowAddMenu,
  addStep,
  active,
  setRfNodes,
}: Props) {
  const { fitView, setNodes } = useReactFlow();

  const handleBeautify = useCallback(() => {
    const positions = computeLayout(active.steps, active.customEdges || []);
    setNodes((nodes) =>
      nodes.map((n) => {
        const pos = positions.get(n.id);
        return pos ? { ...n, position: pos } : n;
      }),
    );
    setTimeout(() => fitView({ padding: 0.3, duration: 400 }), 50);
  }, [active.steps, active.customEdges, fitView, setNodes]);

  return (
    <ReactFlow
      nodes={rfNodes}
      edges={rfEdges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      nodeTypes={NODE_TYPES}
      fitView
      fitViewOptions={{ padding: 0.3 }}
      minZoom={0.2}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
      deleteKeyCode={['Backspace', 'Delete']}
      connectionLineStyle={{ stroke: '#6366f1', strokeWidth: 2, strokeDasharray: '6,3' }}
      connectionLineType={ConnectionLineType.SmoothStep}
      style={{ background: '#0d1117' }}>
      <Background color="#21262d" gap={24} size={1} />
      <FlowControls position="bottom-left" />
      <MiniMap
        nodeColor={(n) => {
          const step = (n.data as StepNodeData)?.step;
          if (!step) return '#334155';
          if (step.parallelGroup) return GROUP_COLORS[step.parallelGroup]?.border || '#334155';
          return ACTIONS.find((a) => a.id === step.action)?.border || '#334155';
        }}
        maskColor="rgba(0,0,0,0.85)"
        style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 8 }}
      />

      <Panel position="top-right">
        <button
          onClick={handleBeautify}
          title="Auto-layout"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-indigo-600 bg-indigo-900/60 text-[10px] text-muted-foreground/60 hover:text-indigo-200 hover:border-indigo-500/40 hover:bg-indigo-900/40 transition-all shadow-lg backdrop-blur-sm font-mono">
          <Sparkles className="w-3 h-3 text-indigo-400" /> Auto-layout
        </button>
      </Panel>

      <Panel position="bottom-center">
        <div className="relative">
          <Button
            size="sm"
            className="h-8 gap-1.5 bg-primary hover:bg-primary/80 text-foreground/70 hover:text-foreground shadow-lg"
            onClick={() => setShowAddMenu((p) => !p)}>
            <Plus className="w-3.5 h-3.5" /> Add Step
            <ChevronDown
              className={cn('w-3 h-3 transition-transform', showAddMenu && 'rotate-180')}
            />
          </Button>

          {showAddMenu && (
            <div className="absolute z-50 overflow-hidden -translate-x-1/2 shadow-2xl bottom-10 left-1/2 w-80 dark:bg-[#151b23] rounded-xl">
              <div className="px-3 py-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Add Step
                </p>
              </div>
              {ACTION_GROUPS.map((group) => (
                <div key={group}>
                  <div className="px-3 py-1.5 text-[9px] text-muted-foreground/40 uppercase tracking-widest font-mono">
                    {GROUP_LABELS[group]}
                  </div>
                  <div className="grid grid-cols-2 gap-px p-1">
                    {ACTIONS.filter((a) => a.group === group).map((a) => (
                      <button
                        key={a.id}
                        onClick={() => addStep(a.id)}
                        className="flex items-start gap-2 p-2.5 rounded-lg hover:bg-muted/10 text-left transition-colors">
                        <span className="flex-shrink-0 text-base">{a.icon}</span>
                        <div>
                          <div className="text-[11px] font-medium" style={{ color: a.color }}>
                            {a.label}
                          </div>
                          <div className="text-[9px] text-muted-foreground/40 mt-0.5 leading-tight">
                            {a.desc}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Panel>

      {active.steps.length === 0 && (
        <Panel position="top-center">
          <div className="flex flex-col items-center gap-2 mt-24 text-muted-foreground/20">
            <Zap className="w-12 h-12 opacity-15" />
            <p className="text-sm">Click "Add Step" to build your scenario</p>
          </div>
        </Panel>
      )}
    </ReactFlow>
  );
}
