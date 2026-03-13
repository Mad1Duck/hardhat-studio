import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { GitBranch } from 'lucide-react';
import type { StepNodeData } from '../types';
import { ACTIONS } from '../config/actions';
import { GROUP_COLORS } from '../config/groups';

export const StepNode = memo(({ data, selected }: NodeProps) => {
  const d = data as StepNodeData;
  const { step, index } = d;
  const meta = ACTIONS.find((a) => a.id === step.action)!;
  const status = step.status || 'idle';
  const pgColor = step.parallelGroup ? GROUP_COLORS[step.parallelGroup] : null;

  const statusRing = (
    {
      running: '#f59e0b',
      ok: '#10b981',
      error: '#f43f5e',
      skipped: '#64748b',
      idle: pgColor?.border || meta.border,
    } as Record<string, string>
  )[status];

  const glowStyle =
    status === 'running'
      ? `0 0 0 2px ${statusRing}55, 0 0 20px ${statusRing}44`
      : selected
        ? `0 0 0 2px ${meta.border}88`
        : `0 0 8px ${meta.border}22`;

  return (
    <div
      onClick={() => d.onSelect(step.id)}
      style={{
        background: '#161b22f0',
        border: `1.5px solid ${statusRing}`,
        boxShadow: glowStyle,
        borderRadius: 10,
        minWidth: 200,
        maxWidth: 240,
        cursor: 'pointer',
        transition: 'box-shadow 0.25s, border-color 0.25s',
        fontFamily: "'JetBrains Mono', monospace",
        animation: status === 'running' ? 'pulse 1.5s infinite' : undefined,
        outline: pgColor ? `2px solid ${pgColor.border}44` : undefined,
        outlineOffset: 3,
      }}>
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: pgColor?.border || meta.border,
          width: 10,
          height: 10,
          border: '2px solid #080d14',
          top: -6,
          opacity: 1,
          cursor: 'crosshair',
          boxShadow: `0 0 0 3px ${pgColor?.border || meta.border}33`,
        }}
      />

      {step.parallelGroup && (
        <div
          style={{
            position: 'absolute',
            top: -10,
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: 8,
            fontWeight: 700,
            color: pgColor!.color,
            background: '#161b22f0',
            border: `1px solid ${pgColor!.border}66`,
            borderRadius: 4,
            padding: '1px 6px',
            letterSpacing: '0.08em',
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            whiteSpace: 'nowrap',
          }}>
          <GitBranch style={{ width: 7, height: 7 }} /> GROUP {step.parallelGroup}
        </div>
      )}

      {/* Header */}
      <div
        style={{
          padding: '7px 10px 5px',
          borderBottom: `1px solid ${meta.border}22`,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
        <span style={{ fontSize: 14 }}>{meta.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: meta.color,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}>
            {meta.label}
          </div>
          <div
            style={{
              fontSize: 11,
              color: '#94a3b8',
              marginTop: 1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
            {step.description}
          </div>
        </div>
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: `${statusRing}22`,
            border: `1.5px solid ${statusRing}55`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 9,
            fontWeight: 700,
            color: meta.color,
            flexShrink: 0,
          }}>
          {index + 1}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '6px 10px 8px', fontSize: 10, color: '#64748b' }}>
        {(step.action === 'call' || step.action === 'send') && (
          <>
            {step.contractName && (
              <div style={{ color: '#7dd3fc', marginBottom: 2 }}>📄 {step.contractName}</div>
            )}
            {step.functionName && (
              <div style={{ color: meta.color, opacity: 0.8 }}>
                ƒ {step.functionName}({step.args || ''})
              </div>
            )}
          </>
        )}
        {step.action === 'wait' && (
          <div style={{ color: '#fbbf24' }}>
            ⛏ {step.blocks} block{step.blocks !== '1' ? 's' : ''}
          </div>
        )}
        {step.action === 'timeout' && <div style={{ color: '#c084fc' }}>⏱ {step.timeoutMs}ms</div>}
        {step.action === 'assert' && step.assertFn && (
          <div style={{ color: '#4ade80' }}>
            {step.assertFn}() {step.assertOperator} {step.assertExpected}
          </div>
        )}
        {step.action === 'log' && step.message && (
          <div style={{ color: '#94a3b8', fontStyle: 'italic' }}>"{step.message}"</div>
        )}
        {step.action === 'custom_script' && (
          <div style={{ color: '#f472b6', opacity: 0.6 }}>JS script</div>
        )}

        {step.log && (
          <div
            style={{
              marginTop: 6,
              padding: '4px 6px',
              borderRadius: 4,
              background:
                status === 'ok' ? '#10b98115' : status === 'error' ? '#f43f5e15' : '#f59e0b15',
              color: status === 'ok' ? '#34d399' : status === 'error' ? '#f87171' : '#fbbf24',
              fontSize: 9,
              wordBreak: 'break-all',
              lineHeight: 1.4,
            }}>
            {step.log.slice(0, 80)}
            {step.log.length > 80 ? '…' : ''}
          </div>
        )}

        {(step.gasUsed || step.duration) && (
          <div style={{ marginTop: 4, display: 'flex', gap: 8, fontSize: 9, color: '#475569' }}>
            {step.gasUsed && <span>⛽ {parseInt(step.gasUsed).toLocaleString()} gas</span>}
            {step.duration && <span>⏱ {step.duration}ms</span>}
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: pgColor?.border || meta.border,
          width: 10,
          height: 10,
          border: '2px solid #080d14',
          bottom: -6,
          opacity: 1,
          cursor: 'crosshair',
          boxShadow: `0 0 0 3px ${pgColor?.border || meta.border}33`,
        }}
      />
    </div>
  );
});
StepNode.displayName = 'StepNode';
