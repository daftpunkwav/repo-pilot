import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useGraph } from '@/hooks/useGraph';
import { useGraphStore } from '@/stores/graphStore';
import type { GraphViewMode } from '@/stores/graphStore';
import { useUIStore } from '@/stores/uiStore';
import { UniverseGraphView } from '@/components/graph/UniverseGraphView';
import { GraphControls, getSimilarNodes } from '@/components/graph/GraphControls';
import { GraphGuidePanel } from '@/components/graph/GraphGuidePanel';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';
import { formatNumber, REPO_AVATAR_GRADIENTS, splitRepoName } from '@/utils/format';
import { categoryLabel } from '@/utils/labels';
import { getApi } from '@/api/client';
import type { GraphEdge, GraphNode } from '@/api/types';

/** 展示形态（与顶部「布局算法」正交：布局仅在宇宙图模式下生效） */
const VIEW_MODES: { id: GraphViewMode; label: string }[] = [
  { id: 'force', label: '宇宙图' },
  { id: 'cluster', label: '分类聚合' },
  { id: 'list', label: '列表' },
];

const EDGE_TYPE_OPTIONS = [
  [null, '全部'],
  ['similarity', '相似'],
  ['cross_http', '跨服务 HTTP'],
  ['cross_async', '异步调用'],
] as const;

export function GraphPage() {
  const { data, isLoading, isError, error, refetch } = useGraph();
  const crossQ = useQuery({
    queryKey: ['graph-cross-edges'],
    queryFn: () => getApi().getCrossEdges(),
    staleTime: 60_000,
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const [agentCollapsed, setAgentCollapsed] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchSelected, setBatchSelected] = useState<Set<string>>(new Set());
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const selectNode = useGraphStore((s) => s.selectNode);
  const highlightNode = useGraphStore((s) => s.highlightNode);
  const searchQuery = useGraphStore((s) => s.searchQuery);
  const categoryFilter = useGraphStore((s) => s.categoryFilter);
  const edgeTypeFilter = useGraphStore((s) => s.edgeTypeFilter);
  const setEdgeTypeFilter = useGraphStore((s) => s.setEdgeTypeFilter);
  const viewModeRaw = useGraphStore((s) => s.viewMode);
  /** 已废弃的 edges 与宇宙图同构，归一以免控件语义冲突 */
  const viewMode: GraphViewMode = viewModeRaw === 'edges' ? 'force' : viewModeRaw;
  const setViewMode = useGraphStore((s) => s.setViewMode);
  const leftPanelCollapsed = useGraphStore((s) => s.leftPanelCollapsed);
  const setLeftPanelCollapsed = useGraphStore((s) => s.setLeftPanelCollapsed);
  const showUniverseChrome = viewMode === 'force';
  const detailCollapsed = useGraphStore((s) => s.detailCollapsed);
  const setDetailCollapsed = useGraphStore((s) => s.setDetailCollapsed);
  const zoomLevel = useGraphStore((s) => s.zoomLevel);
  const addToast = useUIStore((s) => s.addToast);
  const navigate = useNavigate();

  const batchIndex = useMutation({
    mutationFn: (ids: string[]) => getApi().batchIndexCodeGraph(ids, 'moderate'),
    onSuccess: (res) => {
      const { queued, failed } = res.data;
      addToast({
        type: failed.length === 0 ? 'success' : 'warning',
        message: `已入队 ${queued.length} 个项目${failed.length ? `，${failed.length} 个失败` : ''}`,
      });
      setBatchOpen(false);
      setBatchSelected(new Set());
    },
    onError: () => addToast({ type: 'error', message: '批量索引请求失败' }),
  });

  useEffect(() => {
    if (!isError) return;
    const message = error instanceof Error ? error.message : '加载图谱失败';
    addToast({ type: 'error', message });
  }, [isError, error, addToast]);

  const mergedData = useMemo(() => {
    if (!data) return { nodes: [] as GraphNode[], edges: [] as GraphEdge[] };
    const cross = (crossQ.data?.data?.edges || []) as unknown as GraphEdge[];
    const edges: GraphEdge[] = [
      ...data.edges.map((e) => ({ ...e, edge_type: e.edge_type || 'similarity' })),
      ...cross.map((e) => ({
        ...e,
        similarity: e.similarity ?? 1,
        edge_type: e.edge_type || e.relation || 'cross_http',
      })),
    ];
    return { nodes: data.nodes, edges };
  }, [data, crossQ.data]);

  const filteredData = useMemo(() => {
    let nodes = mergedData.nodes;
    if (categoryFilter) {
      nodes = nodes.filter((n) => n.category_id === categoryFilter);
    }
    const ids = new Set(nodes.map((n) => n.id));
    let edges = mergedData.edges.filter((e) => ids.has(e.source) && ids.has(e.target));
    if (edgeTypeFilter) {
      edges = edges.filter((e) => (e.edge_type || 'similarity') === edgeTypeFilter);
    }
    return { nodes, edges };
  }, [mergedData, categoryFilter, edgeTypeFilter]);

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
    (n) => n.id === selectedNodeId,
  );

  const similarNodes = selectedNode ? getSimilarNodes(data, selectedNode.id) : [];

  if (isLoading) return <LoadingSpinner fullScreen />;

  if (isError) {
    return (
      <div className="graph-page-shell">
        <div className="graph-content">
          <EmptyState
            title="无法加载图谱"
            description="请检查后端服务后重试"
            action={
              <button type="button" className="btn btn--secondary" onClick={() => void refetch()}>
                导出
              </button>
            }
          />
        </div>
      </div>
    );
  }

  if ((data?.nodes.length ?? 0) < 2) {
    return (
      <div className="graph-page-shell">
        <div className="graph-content">
          <EmptyState title="节点不足" description="至少需要 2 个项目才能生成关系图谱" />
        </div>
      </div>
    );
  }

  return (
    <div className={`graph-page-shell ${agentCollapsed ? 'graph-page-shell--collapsed' : ''}`}>
      <div className="graph-content">
        <div className="graph-stage" ref={containerRef}>
          <GraphControls
            showLayout={showUniverseChrome}
            viewModes={VIEW_MODES}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />

          {/* 筛选抽屉：仅边类型（展示形态在顶栏，避免双套控件） */}
          <aside
            className={`graph-left-panel glass-card${leftPanelCollapsed ? ' is-collapsed' : ''}`}
          >
            <button
              type="button"
              className="graph-left-panel__toggle"
              title={leftPanelCollapsed ? '展开边筛选' : '折叠边筛选'}
              onClick={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
            >
              {leftPanelCollapsed ? '⟩' : '⟨'}
            </button>
            {!leftPanelCollapsed && (
              <div className="graph-left-panel__body">
                <h3>边类型</h3>
                <div className="graph-left-panel__modes">
                  {EDGE_TYPE_OPTIONS.map(([optId, label]) => (
                    <button
                      key={String(optId)}
                      type="button"
                      className={edgeTypeFilter === optId ? 'is-active' : ''}
                      onClick={() => setEdgeTypeFilter(optId)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="graph-left-panel__hint">
                  {showUniverseChrome
                    ? '顶栏切换「宇宙图 / 分类 / 列表」；「布局」仅影响三维摆放。拖拽旋转 · 滚轮缩放 · 双击进入代码图谱。'
                    : '边类型筛选对列表与分类聚合同样生效。切回「宇宙图」可查看三维关系。'}
                </p>
              </div>
            )}
          </aside>

          {/* 批量索引面板触发按钮 */}
          <button
            type="button"
            className={`graph-batch-btn${batchOpen ? ' is-active' : ''}`}
            onClick={() => setBatchOpen((v) => !v)}
          >
            批量索引
          </button>

          {batchOpen && (
            <div className="graph-batch-panel glass-card">
              <div className="graph-batch-panel__head">
                <span>选择项目批量建索引</span>
                <button type="button" className="graph-batch-panel__close" onClick={() => setBatchOpen(false)}>✕</button>
              </div>
              <div className="graph-batch-panel__list">
                {filteredData.nodes.map((n) => (
                  <label key={n.id} className="graph-batch-item">
                    <input
                      type="checkbox"
                      checked={batchSelected.has(n.id)}
                      onChange={(e) => {
                        const next = new Set(batchSelected);
                        if (e.target.checked) next.add(n.id); else next.delete(n.id);
                        setBatchSelected(next);
                      }}
                    />
                    <span>{n.name}</span>
                  </label>
                ))}
              </div>
              <div className="graph-batch-panel__footer">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={batchSelected.size === 0 || batchIndex.isPending}
                  onClick={() => batchIndex.mutate([...batchSelected])}
                >
                  {batchIndex.isPending ? '提交中…' : `索引选中 (${batchSelected.size})`}
                </button>
                <button type="button" className="btn btn-sm" onClick={() => setBatchSelected(new Set(filteredData.nodes.map((n) => n.id)))}>
                  全选
                </button>
                <button type="button" className="btn btn-sm" onClick={() => setBatchSelected(new Set())}>
                  清空
                </button>
              </div>
            </div>
          )}

          {/* 主视图区域 */}
          {viewMode === 'force' && (
          <UniverseGraphView
            data={filteredData}
            onNodeClick={(n) => selectNode(n.id)}
            onNodeDoubleClick={(n) => navigate(`/graph/projects/${n.id}`)}
          />
          )}

          {viewMode === 'cluster' && (
            <div className="graph-cluster-view">
              {(() => {
                const byCategory = new Map<string | null, GraphNode[]>();
                for (const n of filteredData.nodes) {
                  const key = n.category_id ?? null;
                  if (!byCategory.has(key)) byCategory.set(key, []);
                  byCategory.get(key)!.push(n);
                }
                return [...byCategory.entries()].map(([catId, nodes], gi) => (
                  <div key={catId ?? 'uncategorized'} className="graph-cluster-group">
                    <div className="graph-cluster-group__label">{categoryLabel(catId)}</div>
                    <div className="graph-cluster-group__nodes">
                      {nodes.map((n, ni) => (
                        <button
                          key={n.id}
                          type="button"
                          className={`graph-cluster-node${selectedNodeId === n.id ? ' is-selected' : ''}`}
                          style={{ background: REPO_AVATAR_GRADIENTS[(gi * 7 + ni) % REPO_AVATAR_GRADIENTS.length] }}
                          onClick={() => selectNode(n.id)}
                          onDoubleClick={() => navigate(`/graph/projects/${n.id}`)}
                          title={n.name}
                        >
                          {(splitRepoName(n.name).repo[0] ?? 'P').toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}

          {viewMode === 'list' && (
            <div className="graph-list-view">
              {filteredData.nodes.map((n) => {
                const similar = getSimilarNodes(data, n.id).slice(0, 3);
                return (
                  <button
                    key={n.id}
                    type="button"
                    className={`graph-list-item${selectedNodeId === n.id ? ' is-selected' : ''}`}
                    onClick={() => selectNode(n.id)}
                    onDoubleClick={() => navigate(`/graph/projects/${n.id}`)}
                  >
                    <div
                      className="graph-list-avatar"
                      style={{ background: REPO_AVATAR_GRADIENTS[filteredData.nodes.indexOf(n) % REPO_AVATAR_GRADIENTS.length] }}
                    >
                      {(splitRepoName(n.name).repo[0] ?? 'P').toUpperCase()}
                    </div>
                    <div className="graph-list-body">
                      <div className="graph-list-name">{n.name}</div>
                      <div className="graph-list-meta">
                        <span>{categoryLabel(n.category_id)}</span>
                        <span>·</span>
                        <span>{formatNumber(n.stars)} ★</span>
                        {similar.length > 0 && (
                          <>
                            <span>·</span>
                            <span className="graph-list-similar">
                              相似：{similar.map((s) => splitRepoName(s.node.name).repo).join('、')}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="graph-list-action" onClick={(e) => { e.stopPropagation(); navigate(`/graph/projects/${n.id}`); }}>
                      代码图谱 →
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {selectedNode && (
            <div className={`node-detail${detailCollapsed ? ' is-collapsed' : ''}`}>
              <div className="node-detail-head">
                <div className="node-avatar" style={{ background: REPO_AVATAR_GRADIENTS[0] }}>
                  {(splitRepoName(selectedNode.name).repo[0] ?? 'P').toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="node-meta-name">{selectedNode.name}</div>
                  <div className="node-meta-cat">{categoryLabel(selectedNode.category_id)}</div>
                </div>
                <button
                  type="button"
                  className="node-detail-collapse"
                  title={detailCollapsed ? '展开详情' : '折叠详情'}
                  onClick={() => setDetailCollapsed(!detailCollapsed)}
                >
                  {detailCollapsed ? '▾' : '▴'}
                </button>
                <button
                  type="button"
                  className="node-detail-close"
                  title="关闭"
                  onClick={() => selectNode(null)}
                >
                  ✕
                </button>
              </div>
              {!detailCollapsed && (
                <>
              <div className="node-detail-section">
                <div className="detail-label">概览</div>
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
                  onClick={() => navigate(`/graph/projects/${selectedNode.id}`)}
                >
                  打开代码图谱
                </button>
                <button
                  type="button"
                  className="btn btn--secondary btn-block"
                  onClick={() => navigate(`/projects/${selectedNode.id}`)}
                >
                  项目详情
                </button>
              </div>
                </>
              )}
            </div>
          )}

          {showUniverseChrome && (
            <div className="graph-hint">
              <div>拖拽旋转 · 滚轮缩放 · 单击选中 · 双击进入代码图谱</div>
            </div>
          )}

          {/* 假鸟瞰无真实投影，常驻只会遮挡；在有真实 minimap 前不渲染 */}
          {false && showUniverseChrome && (
            <div className="minimap" aria-hidden="true">
              <div className="minimap-head">
                <span>鸟瞰</span>
                <span className="stat-mono">示意</span>
              </div>
              <svg viewBox="0 0 140 88" preserveAspectRatio="xMidYMid meet">
                <rect className="minimap-frame" x="32" y="20" width="64" height="48" />
              </svg>
            </div>
          )}

          <div className="graph-statusbar">
            <div>
              <span className="stat-row">
                <span className="stat-dot" />
                <span className="stat-mono">
                  {filteredData.nodes.length} 节点 / {filteredData.edges.length} 连线
                </span>
              </span>
              <span className="stat-row">
                <span className="muted">缩放</span>
                <span className="stat-mono">{Math.round(zoomLevel * 100)}%</span>
              </span>
            </div>
            <div className="export-actions">
              <button
                type="button"
                className="export-btn"
                onClick={() => addToast({ type: 'info', message: '导出功能即将上线' })}
              >
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
