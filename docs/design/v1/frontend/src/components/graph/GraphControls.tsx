import type { GraphData, GraphNode } from '@/api/types';
import { useGraphStore } from '@/stores/graphStore';

interface GraphControlsProps {
  nodeCount: number;
  edgeCount: number;
}

const LEGEND = [
  { color: '#007aff', label: 'Web 前端' },
  { color: '#30d158', label: 'Web 后端' },
  { color: '#ff3b30', label: 'AI / ML' },
  { color: '#ff9f0a', label: '数据科学' },
  { color: '#5e5ce6', label: 'DevOps' },
  { color: '#6e6e73', label: '工具 / 库' },
];

export function GraphControls({ nodeCount, edgeCount }: GraphControlsProps) {
  const searchQuery = useGraphStore((s) => s.searchQuery);
  const setSearchQuery = useGraphStore((s) => s.setSearchQuery);
  const zoomLevel = useGraphStore((s) => s.zoomLevel);
  const minSimilarity = useGraphStore((s) => s.minSimilarity);

  return (
    <div className="graph-toolbar">
      <div className="graph-title">
        <h1>项目关系图谱</h1>
        <p>基于 TF-IDF 相似度的项目网络 · 自动收敛中</p>
      </div>
      <div className="graph-controls">
        <label className="graph-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            placeholder="搜索项目名（owner/repo）"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </label>
        <div className="zoom-group" role="group" aria-label="缩放控件">
          <button type="button" className="zoom-btn" title="缩小">
            −
          </button>
          <span className="zoom-label">{Math.round(zoomLevel * 100)}%</span>
          <button type="button" className="zoom-btn" title="放大">
            +
          </button>
        </div>
        <div className="layout-switch" role="group" aria-label="布局切换">
          <button type="button" className="active">
            力导向
          </button>
          <button type="button">树状</button>
          <button type="button">径向</button>
        </div>
      </div>
      <div className="graph-legend">
        {LEGEND.map((l) => (
          <span key={l.label} className="legend-item">
            <span className="legend-dot" style={{ background: l.color }} />
            {l.label}
          </span>
        ))}
        <span className="legend-badge">
          <strong>{nodeCount}</strong>&nbsp;节点&nbsp;/&nbsp;<strong>{edgeCount}</strong>&nbsp;连线
        </span>
        <span className="legend-badge" style={{ marginLeft: 4 }}>
          阈值 ≥ {minSimilarity.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

export function getSimilarNodes(
  data: GraphData | undefined,
  nodeId: string,
  limit = 3
): { node: GraphNode; similarity: number }[] {
  if (!data) return [];
  const nodeById = new Map(data.nodes.map((n) => [n.id, n]));
  const related = data.edges
    .filter((e) => e.source === nodeId || e.target === nodeId)
    .map((e) => ({
      id: e.source === nodeId ? e.target : e.source,
      similarity: e.similarity,
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return related
    .map((r) => {
      const node = nodeById.get(r.id);
      return node ? { node, similarity: r.similarity } : null;
    })
    .filter((x): x is { node: GraphNode; similarity: number } => x !== null);
}
