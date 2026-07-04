import type { Category } from '@/api/types';
import { useGraphStore } from '@/stores/graphStore';

interface GraphControlsProps {
  categories: Category[];
  nodeCount: number;
}

export function GraphControls({ categories, nodeCount }: GraphControlsProps) {
  const searchQuery = useGraphStore((s) => s.searchQuery);
  const setSearchQuery = useGraphStore((s) => s.setSearchQuery);
  const minSimilarity = useGraphStore((s) => s.minSimilarity);
  const setMinSimilarity = useGraphStore((s) => s.setMinSimilarity);
  const maxEdges = useGraphStore((s) => s.maxEdges);
  const setMaxEdges = useGraphStore((s) => s.setMaxEdges);
  const categoryFilter = useGraphStore((s) => s.categoryFilter);
  const setCategoryFilter = useGraphStore((s) => s.setCategoryFilter);
  const resetView = useGraphStore((s) => s.resetView);

  return (
    <div className="graph-controls glass">
      <input
        className="input"
        type="search"
        placeholder="搜索节点…"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
      <label className="graph-controls__slider">
        最小相似度 {minSimilarity.toFixed(2)}
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={minSimilarity}
          onChange={(e) => setMinSimilarity(Number(e.target.value))}
        />
      </label>
      <label className="graph-controls__slider">
        最大边数 {maxEdges}
        <input
          type="range"
          min={10}
          max={500}
          step={10}
          value={maxEdges}
          onChange={(e) => setMaxEdges(Number(e.target.value))}
        />
      </label>
      <select
        className="input"
        value={categoryFilter ?? ''}
        onChange={(e) => setCategoryFilter(e.target.value || null)}
      >
        <option value="">全部分类</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <button type="button" className="btn btn-ghost" onClick={resetView}>
        重置视图
      </button>
      {nodeCount > 1000 && (
        <span className="graph-controls__warn">节点过多，建议提高最小相似度</span>
      )}
    </div>
  );
}
