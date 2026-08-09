import { useMemo, useState } from 'react';
import type { CodeGraphNode, CodeGraphEdge } from './types';
import { colorForLabel } from './colors';

interface Connection {
  node: CodeGraphNode;
  edgeType: string;
  direction: 'inbound' | 'outbound';
}

interface Props {
  node: CodeGraphNode | null;
  allNodes: CodeGraphNode[];
  allEdges: CodeGraphEdge[];
  projectId: string;
  onClose: () => void;
  onNavigate: (node: CodeGraphNode) => void;
  collapsed?: boolean;
  onCollapsedChange?: (v: boolean) => void;
}

/** 边类型展示名（对齐 CBM：calls / defines / similar to …） */
const EDGE_LABEL: Record<string, string> = {
  CALLS: 'calls',
  IMPORTS: 'imports',
  DEFINES: 'defines',
  DEFINES_METHOD: 'defines method',
  CONTAINS: 'contains',
  CONTAINS_FILE: 'contains file',
  CONTAINS_FOLDER: 'contains folder',
  CONTAINS_PACKAGE: 'contains package',
  HANDLES: 'handles',
  IMPLEMENTS: 'implements',
  INHERITS: 'inherits',
  USAGE: 'usage',
  USES: 'usage',
  HTTP_CALLS: 'http calls',
  ASYNC_CALLS: 'async calls',
  DATA_FLOWS: 'data flows',
  WRITES: 'writes',
  RAISES: 'raises',
  DECORATES: 'decorates',
  SIMILAR_TO: 'similar to',
  SEMANTICALLY_RELATED: 'semantically related',
  FILE_CHANGES_WITH: 'file changes with',
  HAS_BRANCH: 'has branch',
  MEMBER_OF: 'member of',
  TESTS_FILE: 'tests file',
  RELATED: 'related',
};

function formatEdgeType(raw: string): string {
  const key = raw.toUpperCase().replace(/\s+/g, '_');
  if (EDGE_LABEL[key]) return EDGE_LABEL[key];
  return raw.replace(/_/g, ' ').toLowerCase();
}

/** 语义分组标题：导入/依赖/定义/调用 */
function semanticTitle(type: string, dir: 'in' | 'out'): string | null {
  const t = type.toUpperCase();
  if (t.includes('IMPORT')) return dir === 'out' ? '它导入了' : '谁导入了它';
  if (t.includes('DEPEND') || t === 'USES' || t === 'USAGE')
    return dir === 'out' ? '它依赖了' : '谁依赖了它';
  if (t.includes('DEFINE')) return dir === 'out' ? '它定义了' : '谁定义了它';
  if (t === 'CALLS' || t.includes('CALL'))
    return dir === 'out' ? '它调用了' : '谁调用了它（callers）';
  if (t.includes('CONTAIN')) return dir === 'out' ? '它包含' : '包含于';
  if (t.includes('SIMILAR') || t.includes('SEMANTIC')) return '相似关系';
  return null;
}

/** 右侧详情 —— 对齐 CBM：按边类型分组；可收起 */
export function NodeDetailPanel({
  node,
  allNodes,
  allEdges,
  onClose,
  onNavigate,
  collapsed = false,
  onCollapsedChange,
}: Props) {
  const [localCollapsed, setLocalCollapsed] = useState(false);
  const isCollapsed = onCollapsedChange ? collapsed : localCollapsed;
  const setCollapsed = onCollapsedChange ?? setLocalCollapsed;

  const connections = useMemo(() => {
    if (!node) return [] as Connection[];
    const nodeMap = new Map(allNodes.map((n) => [n.id, n]));
    const conns: Connection[] = [];
    for (const edge of allEdges) {
      if (edge.source === node.id) {
        const t = nodeMap.get(edge.target);
        if (t) {
          conns.push({
            node: t,
            edgeType: edge.type || edge.relation || 'RELATED',
            direction: 'outbound',
          });
        }
      }
      if (edge.target === node.id) {
        const s = nodeMap.get(edge.source);
        if (s) {
          conns.push({
            node: s,
            edgeType: edge.type || edge.relation || 'RELATED',
            direction: 'inbound',
          });
        }
      }
    }
    return conns;
  }, [node, allNodes, allEdges]);

  if (!node) return null;

  const outbound = connections.filter((c) => c.direction === 'outbound');
  const inbound = connections.filter((c) => c.direction === 'inbound');

  const groupByType = (conns: Connection[]) => {
    const g = new Map<string, Connection[]>();
    for (const c of conns) {
      g.set(c.edgeType, [...(g.get(c.edgeType) ?? []), c]);
    }
    return [...g.entries()].sort((a, b) => b[1].length - a[1].length);
  };

  const definedKinds = useMemo(() => {
    const defs = outbound.filter((c) =>
      /DEFINE|CONTAIN/i.test(c.edgeType),
    );
    const byKind = new Map<string, number>();
    for (const d of defs) {
      const k = d.node.kind || d.node.label || 'Unknown';
      byKind.set(k, (byKind.get(k) || 0) + 1);
    }
    return [...byKind.entries()];
  }, [outbound]);

  return (
    <aside
      className={`code-graph-detail glass-card glass-card--overview-inner${isCollapsed ? ' is-collapsed' : ''}`}
    >
      <header>
        <div>
          <div className="code-graph-detail__title-row">
            <span
              className="code-graph-detail__dot"
              style={{ background: node.color || colorForLabel(node.kind || node.label) }}
            />
            <h2 title={node.qualified_name || node.name}>{node.name}</h2>
          </div>
          <span className="kind">{node.kind || node.label}</span>
        </div>
        <div className="code-graph-detail__head-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setCollapsed(!isCollapsed)}
            aria-label={isCollapsed ? '展开' : '收起'}
            title={isCollapsed ? '展开' : '收起'}
          >
            {isCollapsed ? '▾' : '▴'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
      </header>

      {!isCollapsed && (
        <>
          {node.file_path && (
            <p className="code-graph-detail__path mono">
              {node.file_path}
              {node.start_line
                ? ` :${node.start_line}${
                    node.end_line && node.end_line !== node.start_line
                      ? `–${node.end_line}`
                      : ''
                  }`
                : ''}
            </p>
          )}

          <div className="code-graph-detail__stats">
            <span>
              Out <strong>{outbound.length}</strong>
            </span>
            <span>
              In <strong>{inbound.length}</strong>
            </span>
            <span>
              Total <strong>{connections.length}</strong>
            </span>
          </div>

          {definedKinds.length > 0 && (
            <section className="code-graph-detail__conn">
              <h3>定义摘要</h3>
              <ul className="code-graph-detail__chips">
                {definedKinds.map(([k, c]) => (
                  <li key={k}>
                    <span
                      className="code-graph-detail__dot"
                      style={{ background: colorForLabel(k) }}
                    />
                    {k} · {c}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {outbound.length > 0 && (
            <section className="code-graph-detail__conn">
              <h3>References（出边）</h3>
              {groupByType(outbound).map(([type, list]) => (
                <div key={`out-${type}`} className="code-graph-detail__group">
                  <div className="code-graph-detail__group-label">
                    {semanticTitle(type, 'out') || formatEdgeType(type)} · {list.length}
                  </div>
                  <ul>
                    {list.slice(0, 40).map((c) => (
                      <li key={`o-${c.node.id}-${c.edgeType}`}>
                        <button type="button" onClick={() => onNavigate(c.node)}>
                          <span
                            className="code-graph-detail__dot"
                            style={{
                              background:
                                c.node.color || colorForLabel(c.node.kind || c.node.label),
                            }}
                          />
                          <span className="name">{c.node.name}</span>
                          <span className="lbl">{c.node.kind || c.node.label}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          )}

          {inbound.length > 0 && (
            <section className="code-graph-detail__conn">
              <h3>Referenced by（入边）</h3>
              {groupByType(inbound).map(([type, list]) => (
                <div key={`in-${type}`} className="code-graph-detail__group">
                  <div className="code-graph-detail__group-label">
                    {semanticTitle(type, 'in') || formatEdgeType(type)} · {list.length}
                  </div>
                  <ul>
                    {list.slice(0, 40).map((c) => (
                      <li key={`i-${c.node.id}-${c.edgeType}`}>
                        <button type="button" onClick={() => onNavigate(c.node)}>
                          <span
                            className="code-graph-detail__dot"
                            style={{
                              background:
                                c.node.color || colorForLabel(c.node.kind || c.node.label),
                            }}
                          />
                          <span className="name">{c.node.name}</span>
                          <span className="lbl">{c.node.kind || c.node.label}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          )}

          {connections.length === 0 && (
            <p className="code-graph-detail__empty">当前加载的子图中无入/出边</p>
          )}
        </>
      )}
    </aside>
  );
}
