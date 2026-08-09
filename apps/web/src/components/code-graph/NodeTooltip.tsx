import { Html } from '@react-three/drei';
import type { GraphNode } from './types';
import { colorForLabel, colorForStatus } from './colors';

interface NodeTooltipProps {
  node: GraphNode;
}

function lineRange(node: GraphNode): string | null {
  if (!node.start_line) return null;
  if (node.end_line && node.end_line !== node.start_line) {
    return `L${node.start_line}–${node.end_line}`;
  }
  return `L${node.start_line}`;
}

/** 悬停信息卡片（L0 项目 / L1 符号共用） */
export function NodeTooltip({ node }: NodeTooltipProps) {
  const isProject = node.kind === 'Project' || node.label === 'Project';
  const lines = lineRange(node);

  return (
    <Html
      position={[node.x, node.y + Math.max(node.size, 2) * 1.1, node.z]}
      center
      distanceFactor={520}
      style={{ pointerEvents: 'none', zIndex: 30 }}
      zIndexRange={[100, 0]}
    >
      <div className="code-graph-tooltip">
        <div className="code-graph-tooltip__row">
          <span
            className="code-graph-tooltip__dot"
            style={{ backgroundColor: node.color || colorForLabel(node.label) }}
          />
          <span className="code-graph-tooltip__name">
            {node.name}
          </span>
          <span className="code-graph-tooltip__kind">
            {isProject ? 'Project' : node.kind || node.label}
          </span>
        </div>
        {isProject && node.file_path && (
          <p className="code-graph-tooltip__path">{node.file_path}</p>
        )}
        {!isProject && node.file_path && (
          <p className="code-graph-tooltip__path">
            {node.file_path}
            {lines ? ` · ${lines}` : ''}
          </p>
        )}
        {node.status && node.status !== 'structural' && node.status !== 'normal' && (
          <div className="code-graph-tooltip__row">
            <span
              className="code-graph-tooltip__dot"
              style={{ backgroundColor: colorForStatus(node.status) }}
            />
            <span>{node.status}</span>
          </div>
        )}
        {typeof node.in_calls === 'number' && node.in_calls > 0 && (
          <p className="code-graph-tooltip__meta">关联度 {node.in_calls}</p>
        )}
        <p className="code-graph-tooltip__hint">
          {isProject ? '单击选中 · 双击进入代码图谱' : '单击查看详情'}
        </p>
      </div>
    </Html>
  );
}
