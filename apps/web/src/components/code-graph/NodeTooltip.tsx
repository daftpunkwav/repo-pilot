import { Html } from '@react-three/drei';
import type { GraphNode } from './types';
import { colorForLabel, colorForStatus } from './colors';

interface NodeTooltipProps {
  node: GraphNode;
}

function lineRange(node: GraphNode): string | null {
  if (!node.start_line) return null;
  if (node.end_line && node.end_line !== node.start_line) {
    return `L${node.start_line}-${node.end_line}`;
  }
  return `L${node.start_line}`;
}

export function NodeTooltip({ node }: NodeTooltipProps) {
  return (
    <Html
      position={[node.x, node.y + node.size * 0.7, node.z]}
      center
      style={{ pointerEvents: 'none' }}
    >
      <div className="code-graph-tooltip">
        <div className="code-graph-tooltip__row">
          <span
            className="code-graph-tooltip__dot"
            style={{ backgroundColor: colorForLabel(node.label) }}
          />
          <span className="code-graph-tooltip__name">{node.name}</span>
          <span className="code-graph-tooltip__kind">{node.label}</span>
        </div>
        {node.file_path && (
          <p className="code-graph-tooltip__path">
            {node.file_path}
            {lineRange(node) ? ` � ${lineRange(node)}` : ''}
          </p>
        )}
        {node.status && node.status !== 'structural' && (
          <div className="code-graph-tooltip__row">
            <span
              className="code-graph-tooltip__dot"
              style={{ backgroundColor: colorForStatus(node.status) }}
            />
            <span>{node.status}</span>
            {node.in_calls !== undefined && (
              <span>
                � {node.in_calls} caller{node.in_calls === 1 ? '' : 's'}
              </span>
            )}
          </div>
        )}
        <p className="code-graph-tooltip__hint">click for details</p>
      </div>
    </Html>
  );
}
