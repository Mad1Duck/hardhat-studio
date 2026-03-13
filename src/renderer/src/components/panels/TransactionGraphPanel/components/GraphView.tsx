import {
  ReactFlow,
  Background,
  MiniMap,
  Panel,
  type OnNodesChange,
  type OnEdgesChange,
} from '@xyflow/react';
import { GitFork, RefreshCw } from 'lucide-react';
import { NodeData as NodeDataFlow } from '../types';
import { NODE_TYPE_STYLE } from '../config/nodeStyles';
import { NODE_TYPES, EDGE_TYPES } from './FlowElements';
import { FlowControls } from '../../../ui/FlowControls';

interface Props {
  rfNodes: any[];
  rfEdges: any[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  loading: boolean;
  onNodeClick: (node: any) => void;
  onEdgeClick: (edge: any) => void;
  onPaneClick: () => void;
}

export function GraphView({
  rfNodes,
  rfEdges,
  onNodesChange,
  onEdgesChange,
  loading,
  onNodeClick,
  onEdgeClick,
  onPaneClick,
}: Props) {
  return (
    <div className="flex-1 min-w-0 min-h-0">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.1}
        maxZoom={3}
        proOptions={{ hideAttribution: true }}
        style={{ background: '#0d1117' }}
        onNodeClick={(_, node) => onNodeClick(node)}
        onEdgeClick={(_, edge) => onEdgeClick(edge)}
        onPaneClick={onPaneClick}>
        <Background color="#21262d" gap={32} size={1} />
        <FlowControls position="bottom-left" />
        <MiniMap
          nodeColor={(n) =>
            NODE_TYPE_STYLE[(n.data as unknown as NodeDataFlow).nodeType]?.border || '#475569'
          }
          maskColor="rgba(0,0,0,0.75)"
          style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 8 }}
        />

        {/* Legend */}
        <Panel position="top-left">
          <div className="bg-card/90 backdrop-blur rounded-lg px-3 py-2 space-y-1 text-[10px]">
            {Object.entries(NODE_TYPE_STYLE).map(([type, s]) => (
              <div key={type} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.border }} />
                <span className="capitalize text-muted-foreground">{type}</span>
              </div>
            ))}
            <div className="border-t border-border mt-1 pt-1 space-y-0.5">
              {[
                { label: 'success', color: '#22c55e', dashed: false },
                { label: 'failed', color: '#f43f5e', dashed: true },
                { label: 'unknown', color: '#475569', dashed: false },
              ].map(({ label, color, dashed }) => (
                <div key={label} className="flex items-center gap-2">
                  <div
                    className="w-5"
                    style={{ borderTop: `1px ${dashed ? 'dashed' : 'solid'} ${color}` }}
                  />
                  <span className="text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        {rfNodes.length === 0 && !loading && (
          <Panel position="top-center">
            <div className="flex flex-col items-center gap-2 mt-20 text-muted-foreground/25">
              <GitFork className="w-14 h-14 opacity-20" />
              <p className="text-sm">No transactions in range</p>
              <p className="text-xs">Increase block range or connect an active node</p>
            </div>
          </Panel>
        )}
        {loading && rfNodes.length === 0 && (
          <Panel position="top-center">
            <div className="mt-40">
              <RefreshCw className="w-8 h-8 animate-spin text-sky-400" />
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}
