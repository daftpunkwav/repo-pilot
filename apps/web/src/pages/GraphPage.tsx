import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGraph } from '@/hooks/useGraph';
import { useGraphStore } from '@/stores/graphStore';
import { useUIStore } from '@/stores/uiStore';
import { ForceGraph } from '@/components/graph/ForceGraph';
import { GraphControls, getSimilarNodes } from '@/components/graph/GraphControls';
import { GraphGuidePanel } from '@/components/graph/GraphGuidePanel';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';
import { formatNumber, REPO_AVATAR_GRADIENTS, splitRepoName } from '@/utils/format';
import { categoryLabel } from '@/utils/labels';
import type { GraphNode } from '@/api/types';

export function GraphPage() {
  const { data, isLoading } = useGraph();
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 500 });
  const [agentCollapsed, setAgentCollapsed] = useState(false);
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const selectNode = useGraphStore((s) => s.selectNode);
  const highlightNode = useGraphStore((s) => s.highlightNode);
  const searchQuery = useGraphStore((s) => s.searchQuery);
  const categoryFilter = useGraphStore((s) => s.categoryFilter);
  const zoomLevel = useGraphStore((s) => s.zoomLevel);
  const addToast = useUIStore((s) => s.addToast);
  const navigate = useNavigate();

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ width: el.clientWidth, height: Math.max(480, el.clientHeight) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [agentCollapsed]);

  const filteredData = useMemo(() => {
    if (!data) return { nodes: [], edges: [] };
    let nodes = data.nodes;
    if (categoryFilter) {
      nodes = nodes.filter((n) => n.category_id === categoryFilter);
    }
    const ids = new Set(nodes.map((n) => n.id));
    const edges = data.edges.filter((e) => ids.has(e.source) && ids.has(e.target));
    return { nodes, edges };
  }, [data, categoryFilter]);

  useEffect(() => {
    if (!searchQuery || !data) {
      highlightNode(null);
      return;
    }
    const q = searchQuery.toLowerCase();
    const match = data.nodes.find((n) => n.name.toLowerCase().includes(q));
    highlightNode(match?.id ?? null);
  }, [searchQuery, data, highlightNode]);

  const selectedNode: GraphNode | undefined = filteredData.nodes.find(
    (n) => n.id === selectedNodeId
  );

  const similarNodes = selectedNode ? getSimilarNodes(data, selectedNode.id) : [];

  if (isLoading) return <LoadingSpinner fullScreen />;

  if ((data?.nodes.length ?? 0) < 2) {
    return (
      <div className="graph-page-shell">
        <div className="graph-content">
          <EmptyState title="图谱节点不足" description="请至少导入 2 个项目以生成知识图谱" />
        </div>
      </div>
    );
  }

  return (
    <div className={`graph-page-shell ${agentCollapsed ? 'graph-page-shell--collapsed' : ''}`}>
      <div className="graph-content">
        <div className="graph-stage" ref={containerRef}>
          <GraphControls nodeCount={filteredData.nodes.length} edgeCount={filteredData.edges.length} />

          <ForceGraph
            data={filteredData}
            width={size.width}
            height={size.height}
            onNodeClick={(n) => selectNode(n.id)}
            onNodeDoubleClick={(n) => navigate(`/projects/${n.id}`)}
          />

          {selectedNode && (
            <div className="node-detail">
              <div className="node-detail-head">
                <div className="node-avatar" style={{ background: REPO_AVATAR_GRADIENTS[0] }}>
                  {(splitRepoName(selectedNode.name).repo[0] ?? 'P').toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="node-meta-name">{selectedNode.name}</div>
                  <div className="node-meta-cat">{categoryLabel(selectedNode.category_id)}</div>
                </div>
                <button type="button" className="node-detail-close" title="关闭" onClick={() => selectNode(null)}>
                  ×
                </button>
              </div>
              <div className="node-detail-section">
                <div className="detail-label">基本信息</div>
                <div className="detail-row">
                  <span className="muted">Stars</span>
                  <strong>{formatNumber(selectedNode.stars)}</strong>
                </div>
              </div>
              {similarNodes.length > 0 && (
                <div className="node-detail-section">
                  <div className="detail-label">相似项目</div>
                  <div className="similar-list">
                    {similarNodes.map(({ node, similarity }) => (
                      <button
                        key={node.id}
                        type="button"
                        className="similar-item"
                        onClick={() => selectNode(node.id)}
                      >
                        <span className="similar-name">{node.name}</span>
                        <span className="similar-score">{similarity.toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="detail-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-block"
                  onClick={() => navigate(`/projects/${selectedNode.id}`)}
                >
                  查看详情
                </button>
              </div>
            </div>
          )}

          <div className="graph-hint">
            <div>
              <kbd>滚轮</kbd> 缩放 · <kbd>拖拽</kbd> 移动 · <kbd>点击</kbd> 详情 · <kbd>双击</kbd> 跳转
            </div>
          </div>

          <div className="minimap">
            <div className="minimap-head">
              <span>缩略</span>
              <span className="stat-mono">1:8</span>
            </div>
            <svg viewBox="0 0 140 88" preserveAspectRatio="xMidYMid meet">
              <rect className="minimap-frame" x="32" y="20" width="64" height="48" />
            </svg>
          </div>

          <div className="graph-statusbar">
            <div>
              <span className="stat-row">
                <span className="stat-dot" />
                <span className="stat-mono">{filteredData.nodes.length} 节点 / {filteredData.edges.length} 连线</span>
              </span>
              <span className="stat-row">
                <span className="muted">缩放</span>
                <span className="stat-mono">{Math.round(zoomLevel * 100)}%</span>
              </span>
            </div>
            <div className="export-actions">
              <button type="button" className="export-btn" onClick={() => addToast({ type: 'info', message: '导出（演示）' })}>
                导出
              </button>
            </div>
          </div>
        </div>
      </div>

      <GraphGuidePanel
        collapsed={agentCollapsed}
        onToggleCollapse={() => setAgentCollapsed((v) => !v)}
        selectedNodeId={selectedNodeId}
      />
    </div>
  );
}
