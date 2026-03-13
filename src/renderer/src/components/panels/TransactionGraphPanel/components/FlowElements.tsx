import {
  Handle,
  Position,
  getBezierPath,
  BaseEdge,
  EdgeLabelRenderer,
  type NodeProps,
  type EdgeProps,
} from '@xyflow/react';
import { NodeData as NodeDataFlow, EdgeData } from '../types';
import { NODE_TYPE_STYLE } from '../config/nodeStyles';
import { hex } from '../lib/rpcUtils';

//  Address Node
export function AddressNode({ data, selected }: NodeProps) {
  const nd = data as unknown as NodeDataFlow;
  const s = NODE_TYPE_STYLE[nd.nodeType] || NODE_TYPE_STYLE.wallet;
  const size = Math.min(44 + nd.txCount * 4, 72);

  return (
    <div
      style={{
        background: '#161b22f0',
        border: `2px solid ${s.border}`,
        boxShadow: selected ? `0 0 0 3px ${s.border}55, 0 0 24px ${s.glow}` : `0 0 10px ${s.glow}`,
        borderRadius: '50%',
        width: size,
        height: size,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        position: 'relative',
        transition: 'box-shadow 0.15s, border-color 0.15s',
        userSelect: 'none',
      }}>
      <Handle
        type="target"
        position={Position.Top}
        style={{ opacity: 0, width: 0, height: 0, minWidth: 0, minHeight: 0 }}
      />

      <span style={{ fontSize: Math.min(14 + nd.txCount, 22), lineHeight: 1, color: s.border }}>
        {s.icon}
      </span>

      {nd.txCount > 1 && (
        <span
          style={{
            position: 'absolute',
            top: -7,
            right: -7,
            background: s.border,
            color: '#000',
            fontSize: 9,
            fontWeight: 700,
            borderRadius: '50%',
            width: 17,
            height: 17,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          {Math.min(nd.txCount, 99)}
        </span>
      )}

      <div
        style={{
          position: 'absolute',
          top: '100%',
          marginTop: 7,
          whiteSpace: 'nowrap',
          fontSize: 9,
          color: '#94a3b8',
          fontFamily: 'monospace',
          pointerEvents: 'none',
          textAlign: 'center',
        }}>
        {nd.contractName || nd.label}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ opacity: 0, width: 0, height: 0, minWidth: 0, minHeight: 0 }}
      />
    </div>
  );
}

//  Transaction Edge
export function TxEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  data,
}: EdgeProps) {
  const ed = data as unknown as EdgeData;
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const color =
    ed.status === 'success' ? '#22c55e' : ed.status === 'failed' ? '#f43f5e' : '#475569';
  const ethVal = hex(ed.value) / 1e18;
  const label = ed.functionSig
    ? ed.functionSig.slice(0, 10)
    : ethVal > 0
      ? `${ethVal.toFixed(3)}Ξ`
      : '';

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        interactionWidth={14}
        style={{
          stroke: selected ? '#f59e0b' : color,
          strokeWidth: selected ? 2.5 : 1.5,
          strokeDasharray: ed.status === 'failed' ? '5,3' : undefined,
          opacity: selected ? 1 : 0.65,
          cursor: 'pointer',
          transition: 'stroke 0.1s',
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: selected ? 'all' : 'none',
          }}
          className="nodrag nopan">
          {selected ? (
            <div
              style={{
                background: '#161b22',
                border: '1px solid #f59e0b55',
                borderRadius: 6,
                padding: '3px 8px',
                fontSize: 10,
                color: '#f59e0b',
                fontFamily: 'monospace',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
              }}>
              {ed.localName || label || ed.txHash.slice(0, 12) + '…'}
            </div>
          ) : label ? (
            <div
              style={{
                background: '#161b22cc',
                borderRadius: 4,
                padding: '1px 5px',
                fontSize: 9,
                color,
                fontFamily: 'monospace',
              }}>
              {label}
            </div>
          ) : null}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const NODE_TYPES = { address: AddressNode };
export const EDGE_TYPES = { tx: TxEdge };
