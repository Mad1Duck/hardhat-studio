import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ForkJoinData } from '../types';
import { GROUP_COLORS } from '../config/groups';

export const ForkJoinNode = memo(({ data }: NodeProps) => {
  const d = data as ForkJoinData;
  const pgColor = GROUP_COLORS[d.groupId] || GROUP_COLORS['A'];
  const borderColor = d.anyError
    ? '#f43f5e'
    : d.allOk
      ? '#10b981'
      : d.anyRunning
        ? '#f59e0b'
        : pgColor.border;
  const size = 28;

  return (
    <div
      style={{
        width: size,
        height: size,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <div
        style={{
          width: size,
          height: size,
          background: '#161b22',
          border: `2px solid ${borderColor}`,
          borderRadius: 4,
          transform: 'rotate(45deg)',
          position: 'absolute',
          boxShadow: d.anyRunning ? `0 0 12px ${borderColor}66` : `0 0 6px ${borderColor}33`,
          transition: 'all 0.3s',
        }}
      />
      <span
        style={{
          position: 'relative',
          zIndex: 1,
          fontSize: 8,
          fontWeight: 800,
          color: borderColor,
          letterSpacing: '0.05em',
          userSelect: 'none',
          fontFamily: "'JetBrains Mono', monospace",
        }}>
        {d.kind === 'fork' ? '⑆' : '⑇'}
      </span>
      <div
        style={{
          position: 'absolute',
          [d.kind === 'fork' ? 'bottom' : 'top']: -18,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 7,
          fontWeight: 700,
          color: pgColor.color,
          whiteSpace: 'nowrap',
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: '0.06em',
          opacity: 0.8,
        }}>
        {d.kind === 'fork' ? 'FORK' : 'JOIN'} {d.groupId}
      </div>
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: borderColor,
          width: 6,
          height: 6,
          border: '2px solid #080d14',
          top: -4,
          opacity: 0,
        }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: borderColor,
          width: 6,
          height: 6,
          border: '2px solid #080d14',
          bottom: -4,
          opacity: 0,
        }}
      />
    </div>
  );
});
ForkJoinNode.displayName = 'ForkJoinNode';
