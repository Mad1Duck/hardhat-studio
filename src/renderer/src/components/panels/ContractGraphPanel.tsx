/**
 * ContractGraphPanel — React Flow + Mermaid edition
 * bun add @xyflow/react mermaid
 */
import { useState, useEffect, useCallback, useRef, memo } from 'react';
import {
  ReactFlow,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  Panel,
  type NodeProps,
  type Node as NodeFlow,
  type EdgeProps,
  getBezierPath,
  BaseEdge,
  EdgeLabelRenderer,
  MarkerType,
  Edge,
  NodeChange,
  EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import mermaid from 'mermaid';
import { ContractAbi, SourceFile } from '../../types';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { FlowControls } from '../ui/FlowControls';
import {
  Network,
  RefreshCw,
  Eye,
  EyeOff,
  Copy,
  Check,
  AlertCircle,
  Code2,
  GitBranch,
  Shield,
  ChevronDown,
  ChevronRight,
  Layers,
  Zap,
  X,
} from 'lucide-react';

interface Props {
  abis: ContractAbi[];
  sourceFiles: SourceFile[];
  projectPath: string;
}

type NodeType = 'contract' | 'interface' | 'library' | 'abstract';
type ViewMode = 'graph' | 'mermaid' | 'access';

interface AccessRole {
  contract: string;
  modifier: string;
  functions: string[];
}

type ContractNodeData = {
  label: string;
  nodeType: NodeType;
  functions: string[];
  events: string[];
  errors: string[];
  parents: string[];
  showFunctions: boolean;
};

//  Color tokens 
const TYPE = {
  contract: { bg: '#0d1624', border: '#3b82f6', accent: '#60a5fa', badge: '#1e3a5f', icon: '◈' },
  interface: { bg: '#130d24', border: '#8b5cf6', accent: '#a78bfa', badge: '#3b1f6e', icon: '◇' },
  library: { bg: '#0d1f14', border: '#22c55e', accent: '#4ade80', badge: '#14532d', icon: '⬡' },
  abstract: { bg: '#1f1a0d', border: '#f59e0b', accent: '#fbbf24', badge: '#78350f', icon: '◉' },
} as const;

//  Mermaid init 
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  themeVariables: {
    darkMode: true,
    background: '#161b22',
    primaryColor: '#1e3a5f',
    primaryTextColor: '#93c5fd',
    primaryBorderColor: '#3b82f6',
    lineColor: '#f97316',
    secondaryColor: '#1f1a0d',
    tertiaryColor: '#130d24',
    fontSize: '13px',
  },
});

//  Custom Contract Node 
const ContractNode = memo(({ data, selected }: NodeProps) => {
  const d = data as ContractNodeData;
  const t = TYPE[d.nodeType];
  const [expanded, setExpanded] = useState(true);
  const visibleFns = d.showFunctions && expanded ? d.functions.slice(0, 6) : [];
  const more = d.functions.length - 6;

  return (
    <div
      style={{
        background: `#161b22f0`,
        border: `1.5px solid ${selected ? t.accent : t.border}`,
        boxShadow: selected
          ? `0 0 0 2px ${t.border}66, 0 8px 32px ${t.border}33`
          : `0 0 16px ${t.border}22`,
        borderRadius: 10,
        minWidth: 200,
        transition: 'box-shadow 0.2s, border-color 0.2s',
        cursor: 'pointer',
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      }}>
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: t.border, width: 8, height: 8, border: '2px solid #0a0f1a' }}
      />

      {/* Header */}
      <div
        style={{
          padding: '8px 10px 6px',
          borderBottom: `1px solid ${t.border}33`,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: t.accent,
            background: `#161b22f0`,
            padding: '1px 6px',
            borderRadius: 3,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>
          {t.icon} {d.nodeType}
        </span>
        {d.showFunctions && d.functions.length > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((p) => !p);
            }}
            style={{ marginLeft: 'auto', color: t.accent, opacity: 0.6, lineHeight: 1 }}
            className="nodrag">
            {expanded ? (
              <ChevronDown style={{ width: 11, height: 11 }} />
            ) : (
              <ChevronRight style={{ width: 11, height: 11 }} />
            )}
          </button>
        )}
      </div>

      {/* Contract name */}
      <div style={{ padding: '7px 10px 5px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.01em' }}>
          {d.label}
        </div>
        {d.parents.length > 0 && (
          <div style={{ fontSize: 9, color: '#f97316', marginTop: 2, opacity: 0.8 }}>
            is {d.parents.join(', ')}
          </div>
        )}
      </div>

      {/* Stats bar */}
      <div
        style={{
          padding: '3px 10px 6px',
          display: 'flex',
          gap: 8,
          fontSize: 9,
          color: '#64748b',
        }}>
        <span title="functions">⚙ {d.functions.length}</span>
        <span title="events">⚡ {d.events.length}</span>
        <span title="errors">⚠ {d.errors.length}</span>
      </div>

      {/* Function list */}
      {visibleFns.length > 0 && (
        <div
          style={{
            borderTop: `1px solid ${t.border}22`,
            padding: '4px 10px 6px',
          }}>
          {visibleFns.map((fn, i) => (
            <div
              key={i}
              style={{
                fontSize: 10,
                color: t.accent,
                opacity: 0.75,
                paddingBottom: 2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
              <span style={{ color: '#64748b' }}>fn </span>
              {fn}()
            </div>
          ))}
          {more > 0 && (
            <div style={{ fontSize: 9, color: '#475569', paddingTop: 1 }}>+{more} more</div>
          )}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        style={{ background: t.border, width: 8, height: 8, border: '2px solid #0a0f1a' }}
      />
    </div>
  );
});
ContractNode.displayName = 'ContractNode';

//  Custom Inheritance Edge 
function InheritEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
}: EdgeProps) {
  const [path, lx, ly] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        interactionWidth={10}
        style={{
          stroke: selected ? '#fbbf24' : '#f97316',
          strokeWidth: selected ? 2 : 1.5,
          strokeDasharray: '6,3',
          opacity: selected ? 1 : 0.55,
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%,-50%) translate(${lx}px,${ly}px)`,
            pointerEvents: 'none',
          }}>
          {selected && (
            <span
              style={{
                background: '#161b22',
                border: '1px solid #f9741644',
                borderRadius: 4,
                padding: '1px 6px',
                fontSize: 9,
                color: '#f97316',
                fontFamily: 'monospace',
              }}>
              inherits
            </span>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

const NODE_TYPES = { contract: ContractNode };
const EDGE_TYPES = { inherit: InheritEdge };

//  Main Component 
export default function ContractGraphPanel({ abis, sourceFiles, projectPath }: Props) {
  const [rfNodes, setRfNodes] = useState<NodeFlow[]>([]);
  const [rfEdges, setRfEdges] = useState<Edge[]>([]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setRfNodes((nds) => applyNodeChanges(changes, nds)),
    [],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setRfEdges((eds) => applyEdgeChanges(changes, eds)),
    [],
  );
  const [view, setView] = useState<ViewMode>('graph');
  const [showFunctions, setShowFunctions] = useState(true);
  const [mermaidCode, setMermaidCode] = useState('');
  const [mermaidSvg, setMermaidSvg] = useState('');
  const [mermaidError, setMermaidError] = useState('');
  const [accessRoles, setAccessRoles] = useState<AccessRole[]>([]);
  const [nodeCount, setNodeCount] = useState(0);
  const [edgeCount, setEdgeCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [selectedNode, setSelectedNode] = useState<ContractNodeData | null>(null);
  const mermaidRef = useRef<HTMLDivElement>(null);

  //  Build graph data 
  const buildGraph = useCallback(async () => {
    if (!abis.length) return;
    const sourceMap: Record<string, string> = {};
    await Promise.all(
      sourceFiles
        .filter((f) => f.name.endsWith('.sol'))
        .map(async (sf) => {
          try {
            const c = await window.api.readFile(sf.path);
            if (c) sourceMap[sf.name.replace('.sol', '')] = c;
          } catch {}
        }),
    );

    // Depth calc for layout
    const depthMap: Record<string, number> = {};
    const getDepth = (name: string, vis = new Set<string>()): number => {
      if (depthMap[name] !== undefined) return depthMap[name];
      if (vis.has(name)) return 0;
      vis.add(name);
      const src =
        Object.values(sourceMap).find(
          (s) =>
            s.includes(`contract ${name}`) ||
            s.includes(`interface ${name}`) ||
            s.includes(`library ${name}`),
        ) || '';
      const m = src.match(
        new RegExp(
          `(?:contract|interface|abstract contract)\\s+${name}[^{]*is\\s+([\\w,\\s]+)\\s*\\{`,
        ),
      );
      const parents = (m?.[1] || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const d = parents.length ? Math.max(...parents.map((p) => getDepth(p, vis))) + 1 : 0;
      depthMap[name] = d;
      return d;
    };
    abis.forEach((a) => getDepth(a.contractName));

    const byDepth: Record<number, string[]> = {};
    abis.forEach((a) => {
      const d = depthMap[a.contractName] || 0;
      if (!byDepth[d]) byDepth[d] = [];
      byDepth[d].push(a.contractName);
    });
    const maxDepth = Math.max(...Object.keys(byDepth).map(Number), 0);

    const roleMap: Record<string, AccessRole> = {};
    const mermaidLines = ['classDiagram'];

    const newNodes = abis.map((abi) => {
      const depth = depthMap[abi.contractName] || 0;
      const col = byDepth[depth];
      const colIdx = col.indexOf(abi.contractName);
      const src =
        Object.values(sourceMap).find(
          (s) =>
            s.includes(`contract ${abi.contractName}`) ||
            s.includes(`interface ${abi.contractName}`) ||
            s.includes(`library ${abi.contractName}`),
        ) || '';

      let nodeType: NodeType = 'contract';
      if (new RegExp(`interface\\s+${abi.contractName}`).test(src)) nodeType = 'interface';
      else if (new RegExp(`library\\s+${abi.contractName}`).test(src)) nodeType = 'library';
      else if (new RegExp(`abstract contract\\s+${abi.contractName}`).test(src))
        nodeType = 'abstract';

      const functions = abi.abi
        .filter((i) => i.type === 'function')
        .map((i) => i.name || '')
        .filter(Boolean);
      const events = abi.abi
        .filter((i) => i.type === 'event')
        .map((i) => i.name || '')
        .filter(Boolean);
      const errors = abi.abi
        .filter((i) => i.type === 'error')
        .map((i) => i.name || '')
        .filter(Boolean);
      const iMatch = src.match(
        new RegExp(
          `(?:contract|interface|abstract contract)\\s+${abi.contractName}[^{]*is\\s+([\\w,\\s]+)\\s*\\{`,
        ),
      );
      const parents = (iMatch?.[1] || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      // Access roles
      const modRe = /modifier\s+(\w+)/g;
      let mMatch;
      while ((mMatch = modRe.exec(src)) !== null) {
        const mod = mMatch[1];
        if (/only|auth|admin|role/i.test(mod)) {
          const key = `${abi.contractName}:${mod}`;
          if (!roleMap[key])
            roleMap[key] = { contract: abi.contractName, modifier: mod, functions: [] };
          functions
            .filter((fn) => src.includes(`function ${fn}`) && src.includes(mod))
            .forEach((fn) => {
              if (!roleMap[key].functions.includes(fn)) roleMap[key].functions.push(fn);
            });
        }
      }

      // Mermaid
      mermaidLines.push(`  class ${abi.contractName} {`);
      if (nodeType !== 'contract') mermaidLines.push(`    <<${nodeType}>>`);
      functions.slice(0, 8).forEach((f) => mermaidLines.push(`    +${f}()`));
      events.slice(0, 3).forEach((e) => mermaidLines.push(`    ${e} event`));
      mermaidLines.push('  }');
      parents.forEach((p) => {
        if (abis.find((a) => a.contractName === p))
          mermaidLines.push(`  ${p} <|-- ${abi.contractName}`);
      });

      // Layout: columns by depth
      const xBase = Object.keys(sourceMap).length
        ? (maxDepth - depth) * 280 + 40
        : (abis.indexOf(abi) % 4) * 280 + 40;
      const yBase = colIdx * 220 + 40;

      return {
        id: abi.contractName,
        type: 'contract',
        position: { x: xBase, y: yBase },
        data: {
          label: abi.contractName,
          nodeType,
          functions,
          events,
          errors,
          parents,
          showFunctions,
        } as ContractNodeData,
        style: { background: 'transparent', border: 'none', padding: 0 },
      };
    });

    const newEdges = abis.flatMap((abi) => {
      const src =
        Object.values(sourceMap).find((s) => s.includes(`contract ${abi.contractName}`)) || '';
      const iMatch = src.match(
        new RegExp(
          `(?:contract|interface|abstract contract)\\s+${abi.contractName}[^{]*is\\s+([\\w,\\s]+)\\s*\\{`,
        ),
      );
      const parents = (iMatch?.[1] || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      return parents
        .filter((p) => abis.find((a) => a.contractName === p))
        .map((p) => ({
          id: `${abi.contractName}->${p}`,
          source: abi.contractName,
          target: p,
          type: 'inherit',
          markerEnd: { type: MarkerType.Arrow, color: '#f97316' },
        }));
    });

    setRfNodes(newNodes as any);
    setRfEdges(newEdges as any);
    setNodeCount(newNodes.length);
    setEdgeCount(newEdges.length);
    setAccessRoles(Object.values(roleMap));
    setMermaidCode(mermaidLines.join('\n'));
  }, [abis, sourceFiles, showFunctions]);

  useEffect(() => {
    buildGraph();
  }, [abis, sourceFiles]);

  // Re-update showFunctions in node data without full rebuild
  useEffect(() => {
    setRfNodes((prev) =>
      prev.map((n: any) => ({
        ...n,
        data: { ...n.data, showFunctions },
      })),
    );
  }, [showFunctions]);

  //  Render Mermaid 
  useEffect(() => {
    if (view !== 'mermaid' || !mermaidCode) return;
    const render = async () => {
      try {
        setMermaidError('');
        const id = `mermaid-${Date.now()}`;
        const { svg } = await mermaid.render(id, mermaidCode);
        setMermaidSvg(svg);
      } catch (e: any) {
        setMermaidError(e.message || 'Render failed');
        setMermaidSvg('');
      }
    };
    render();
  }, [view, mermaidCode]);

  const copyMermaid = () => {
    navigator.clipboard.writeText(mermaidCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  //  RENDER 
  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/*  Toolbar  */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card flex-shrink-0">
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-semibold">Contract Graph</span>
          <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
            {nodeCount} contracts
          </span>
          <span className="text-[10px] bg-orange-500/10 text-orange-400 px-1.5 py-0.5 rounded">
            {edgeCount} inheritance
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* View tabs */}
          <div className="flex overflow-hidden border rounded-lg bg-muted border-border">
            {(
              [
                { v: 'graph', label: '⬡ Graph' },
                { v: 'mermaid', label: '🧜 Mermaid' },
                { v: 'access', label: '🔐 Access' },
              ] as const
            ).map(({ v, label }) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  'px-3 py-1 text-[10px] font-medium transition-colors',
                  view === v
                    ? 'bg-blue-600 text-white'
                    : 'text-muted-foreground hover:text-foreground',
                )}>
                {label}
              </button>
            ))}
          </div>

          {view === 'graph' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFunctions((p) => !p)}
              className="h-7 px-2 text-[10px] gap-1">
              {showFunctions ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              {showFunctions ? 'Hide fns' : 'Show fns'}
            </Button>
          )}

          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={buildGraph}>
            <RefreshCw className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/*  Legend bar (graph only)  */}
      {view === 'graph' && (
        <div className="flex items-center gap-4 px-4 py-1.5 border-b border-border bg-card/40 flex-shrink-0 text-[10px]">
          {(Object.entries(TYPE) as [NodeType, (typeof TYPE)[NodeType]][]).map(([t, s]) => (
            <span key={t} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-sm"
                style={{ background: s.border, opacity: 0.9 }}
              />
              <span className="capitalize text-muted-foreground">{t}</span>
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="w-5 border-t border-orange-400 border-dashed opacity-70" />
            <span className="text-muted-foreground">inherits</span>
          </span>
          <span className="ml-auto text-muted-foreground/30">Click node • Drag • Scroll zoom</span>
        </div>
      )}

      {/*  Main content  */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* GRAPH VIEW — React Flow */}
        {view === 'graph' && (
          <div className="flex-1 min-w-0 min-h-0">
            <ReactFlow
              nodes={rfNodes}
              edges={rfEdges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={NODE_TYPES}
              edgeTypes={EDGE_TYPES}
              fitView
              fitViewOptions={{ padding: 0.25 }}
              minZoom={0.1}
              maxZoom={3}
              proOptions={{ hideAttribution: true }}
              style={{ background: '#0d1117' }}
              onNodeClick={(_, node: any) => setSelectedNode(node.data as ContractNodeData)}
              onPaneClick={() => setSelectedNode(null)}>
              <Background color="#21262d" gap={32} size={1} />
              <FlowControls position="bottom-left" />
              <MiniMap
                nodeColor={(n) => TYPE[(n.data as ContractNodeData).nodeType]?.border || '#3b82f6'}
                maskColor="rgba(0,0,0,0.8)"
                style={{
                  background: '#161b22',
                  border: '1px solid #21262d',
                  borderRadius: 8,
                }}
              />

              {rfNodes.length === 0 && (
                <Panel position="top-center">
                  <div className="flex flex-col items-center gap-2 mt-24 text-muted-foreground/25">
                    <Network className="w-14 h-14 opacity-20" />
                    <p className="text-sm">No contracts loaded</p>
                    <p className="text-xs opacity-60">Compile your project to see the graph</p>
                  </div>
                </Panel>
              )}
            </ReactFlow>
          </div>
        )}

        {/* Node detail side panel */}
        {view === 'graph' && selectedNode && (
          <div className="flex flex-col flex-shrink-0 w-64 overflow-hidden border-l border-border bg-card/60">
            <div className="flex items-center justify-between flex-shrink-0 px-3 py-2 border-b border-border">
              <div className="flex items-center gap-2">
                <span style={{ color: TYPE[selectedNode.nodeType].accent, fontSize: 14 }}>
                  {TYPE[selectedNode.nodeType].icon}
                </span>
                <span className="text-xs font-semibold">{selectedNode.label}</span>
              </div>
              <button onClick={() => setSelectedNode(null)}>
                <X className="w-3.5 h-3.5 text-muted-foreground/40 hover:text-muted-foreground" />
              </button>
            </div>
            <div className="flex-1 p-3 space-y-3 overflow-y-auto text-xs">
              <div className="flex items-center gap-2">
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: TYPE[selectedNode.nodeType].accent,
                    background: `#161b22f0`,
                    padding: '2px 8px',
                    borderRadius: 4,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    fontFamily: 'monospace',
                  }}>
                  {selectedNode.nodeType}
                </span>
                <span className="text-[10px] text-muted-foreground ml-auto">
                  {selectedNode.functions.length} fn · {selectedNode.events.length} ev ·{' '}
                  {selectedNode.errors.length} err
                </span>
              </div>

              {selectedNode.parents.length > 0 && (
                <div>
                  <p className="text-[10px] text-muted-foreground/50 mb-1">Inherits from</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedNode.parents.map((p) => (
                      <span
                        key={p}
                        className="text-[10px] bg-orange-500/10 text-orange-400 px-1.5 py-0.5 rounded font-mono">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedNode.functions.length > 0 && (
                <div>
                  <p className="text-[10px] text-muted-foreground/50 mb-1">
                    Functions ({selectedNode.functions.length})
                  </p>
                  <div className="space-y-0.5 max-h-40 overflow-y-auto">
                    {selectedNode.functions.map((fn, i) => (
                      <div
                        key={i}
                        className="text-[10px] font-mono px-2 py-0.5 rounded hover:bg-muted/20"
                        style={{ color: TYPE[selectedNode.nodeType].accent, opacity: 0.8 }}>
                        {fn}()
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedNode.events.length > 0 && (
                <div>
                  <p className="text-[10px] text-muted-foreground/50 mb-1">
                    Events ({selectedNode.events.length})
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {selectedNode.events.map((ev, i) => (
                      <span
                        key={i}
                        className="text-[10px] bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded font-mono">
                        ⚡ {ev}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedNode.errors.length > 0 && (
                <div>
                  <p className="text-[10px] text-muted-foreground/50 mb-1">
                    Custom Errors ({selectedNode.errors.length})
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {selectedNode.errors.map((er, i) => (
                      <span
                        key={i}
                        className="text-[10px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded font-mono">
                        ⚠ {er}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MERMAID VIEW */}
        {view === 'mermaid' && (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex items-center justify-between flex-shrink-0 px-4 py-2 border-b border-border bg-card/50">
              <div>
                <p className="text-sm font-semibold">Mermaid Class Diagram</p>
                <p className="text-[10px] text-muted-foreground">
                  Live render · copy code · paste into mermaid.live
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs h-7"
                  onClick={copyMermaid}>
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-green-400" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" /> Copy Code
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs h-7"
                  onClick={() => window.open('https://mermaid.live', '_blank')}>
                  <Code2 className="w-3 h-3" /> mermaid.live ↗
                </Button>
              </div>
            </div>

            <div className="flex flex-1 min-h-0 overflow-hidden">
              {/* Rendered diagram */}
              <div className="flex-1 overflow-auto bg-[#080d16] flex flex-col">
                <div className="flex-1 p-4">
                  {mermaidError && (
                    <div className="flex items-center gap-2 p-3 mb-4 text-xs text-red-400 border rounded-lg bg-red-500/10 border-red-500/20">
                      <AlertCircle className="flex-shrink-0 w-4 h-4" />
                      <div>
                        <p className="font-semibold">Render error</p>
                        <p className="opacity-70">{mermaidError}</p>
                      </div>
                    </div>
                  )}
                  {mermaidSvg ? (
                    <div className="rounded-xl border border-border/50 overflow-auto bg-[#0d1117] p-4">
                      <div
                        ref={mermaidRef}
                        dangerouslySetInnerHTML={{ __html: mermaidSvg }}
                        style={{ minWidth: '100%' }}
                      />
                    </div>
                  ) : !mermaidError ? (
                    <div className="flex items-center justify-center h-40 text-muted-foreground/30">
                      <RefreshCw className="w-5 h-5 mr-2 animate-spin" /> Rendering…
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Raw code panel */}
              <div className="w-72 flex-shrink-0 border-l border-border flex flex-col overflow-hidden bg-[#080d16]">
                <div className="flex-shrink-0 px-3 py-2 border-b border-border">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Mermaid Source
                  </p>
                </div>
                <pre className="flex-1 overflow-auto text-[11px] font-mono text-emerald-400/80 p-4 leading-relaxed whitespace-pre">
                  {mermaidCode || '— No contracts loaded —'}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* ACCESS CONTROL VIEW */}
        {view === 'access' && (
          <div className="flex-1 w-full min-h-0 overflow-y-auto">
            <div className="max-w-full p-5 space-y-8">
              {/* Access roles */}
              <section className="">
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-semibold">Access Control Modifiers</h3>
                  <span className="text-[10px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded">
                    {accessRoles.length} detected
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mb-3">
                  Detected <code className="text-amber-400">only*</code> /{' '}
                  <code className="text-amber-400">auth</code> /{' '}
                  <code className="text-amber-400">admin</code> patterns from Solidity source
                </p>
                {accessRoles.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center border h-28 border-border rounded-xl bg-card/40">
                    <AlertCircle className="w-6 h-6 mb-2 text-muted-foreground/20" />
                    <p className="text-xs text-muted-foreground">
                      No access control modifiers detected
                    </p>
                    <p className="text-[10px] text-muted-foreground/40">
                      Source files are required for this analysis
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {accessRoles.map((role, i) => (
                      <div key={i} className="p-4 border bg-card border-border rounded-xl">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-2 h-2 rounded-full bg-amber-400" />
                          <span className="font-mono text-xs font-semibold">{role.contract}</span>
                          <span className="text-[10px] bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded font-mono border border-amber-500/20">
                            {role.modifier}
                          </span>
                        </div>
                        {role.functions.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {role.functions.map((fn, j) => (
                              <span
                                key={j}
                                className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded font-mono border border-blue-500/15">
                                {fn}()
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[10px] text-muted-foreground/40">
                            No functions matched (modifier defined but not linked)
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Contract inventory */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Layers className="w-4 h-4 text-blue-400" />
                  <h3 className="text-sm font-semibold">Contract Inventory</h3>
                  <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded">
                    {rfNodes.length} total
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {(rfNodes as any[]).map((node) => {
                    const nd = node.data as ContractNodeData;
                    const t = TYPE[nd.nodeType];
                    return (
                      <div
                        key={node.id}
                        className="p-4 transition-colors border cursor-pointer bg-card border-border rounded-xl hover:border-blue-500/40"
                        onClick={() => {
                          setView('graph');
                          setSelectedNode(nd);
                        }}>
                        <div className="flex items-center gap-2 mb-2">
                          <span style={{ color: t.accent, fontSize: 14 }}>{t.icon}</span>
                          <span className="font-mono text-xs font-semibold">{nd.label}</span>
                          <span
                            className="text-[9px] capitalize ml-auto"
                            style={{ color: t.accent, opacity: 0.7 }}>
                            {nd.nodeType}
                          </span>
                        </div>
                        {nd.parents.length > 0 && (
                          <p className="text-[10px] text-orange-400 mb-2 opacity-80">
                            extends {nd.parents.join(', ')}
                          </p>
                        )}
                        <div className="flex gap-3 text-[10px] text-muted-foreground/50 mb-2">
                          <span>⚙ {nd.functions.length} fn</span>
                          <span>⚡ {nd.events.length} ev</span>
                          <span>⚠ {nd.errors.length} err</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {nd.functions.slice(0, 4).map((fn, j) => (
                            <span
                              key={j}
                              className="text-[9px] px-1 py-0.5 rounded font-mono"
                              style={{ background: `#161b22f0`, color: t.accent }}>
                              {fn}
                            </span>
                          ))}
                          {nd.functions.length > 4 && (
                            <span className="text-[9px] text-muted-foreground/40">
                              +{nd.functions.length - 4}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Inheritance summary */}
              {rfEdges.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <GitBranch className="w-4 h-4 text-orange-400" />
                    <h3 className="text-sm font-semibold">Inheritance Chains</h3>
                  </div>
                  <div className="space-y-2">
                    {(rfEdges as any[]).map((edge, i) => {
                      const src = (rfNodes as any[]).find((n) => n.id === edge.source)
                        ?.data as ContractNodeData;
                      const tgt = (rfNodes as any[]).find((n) => n.id === edge.target)
                        ?.data as ContractNodeData;
                      if (!src || !tgt) return null;
                      return (
                        <div
                          key={i}
                          className="flex items-center gap-3 text-xs font-mono bg-card border border-border rounded-lg px-4 py-2.5">
                          <span style={{ color: TYPE[src.nodeType].accent }}>{src.label}</span>
                          <span className="text-orange-400 opacity-50">inherits▶</span>
                          <span style={{ color: TYPE[tgt.nodeType].accent }}>{tgt.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
