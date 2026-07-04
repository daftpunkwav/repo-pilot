import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGraph } from '@/hooks/useGraph';
import { useCategories } from '@/hooks/useProjects';
import { useGraphStore } from '@/stores/graphStore';
import { ForceGraph } from '@/components/graph/ForceGraph';
import { GraphControls } from '@/components/graph/GraphControls';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';
import { ProgressBadge } from '@/components/project/ProgressBadge';
import type { GraphNode } from '@/api/types';

export function GraphPage() {
  const { data, isLoading } = useGraph();
  const { data: categories = [] } = useCategories();
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 500 });
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const selectNode = useGraphStore((s) => s.selectNode);
  const highlightNode = useGraphStore((s) => s.highlightNode);
  const searchQuery = useGraphStore((s) => s.searchQuery);
  const categoryFilter = useGraphStore((s) => s.categoryFilter);
  const navigate = useNavigate();

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ width: el.clientWidth, height: Math.max(500, el.clientHeight) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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

  if (isLoading) return <LoadingSpinner label="正在计算图谱…" />;

  if ((data?.nodes.length ?? 0) < 2) {
    return (
      <EmptyState
        title="图谱节点不足"
        description="请至少导入 2 个项目以生成知识图谱"
      />
    );
  }

  return (
    <div className="page graph-page">
      <GraphControls categories={categories} nodeCount={filteredData.nodes.length} />
      <div className="graph-layout" ref={containerRef}>
        <ForceGraph
          data={filteredData}
          width={size.width - (selectedNode ? 320 : 0)}
          height={size.height}
          onNodeClick={(n) => selectNode(n.id)}
          onNodeDoubleClick={(n) => navigate(`/projects/${n.id}`)}
        />
        {selectedNode && (
          <aside className="graph-detail glass">
            <h3 className="font-mono">{selectedNode.name}</h3>
            <p>{selectedNode.language}</p>
            <p>★ {selectedNode.stars.toLocaleString()}</p>
            {selectedNode.progress && <ProgressBadge progress={selectedNode.progress} />}
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate(`/projects/${selectedNode.id}`)}
            >
              项目详情
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => selectNode(null)}>
              关闭
            </button>
          </aside>
        )}
      </div>
    </div>
  );
}
