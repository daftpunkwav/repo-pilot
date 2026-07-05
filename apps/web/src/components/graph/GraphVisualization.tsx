import { useMemo } from "react";
import { fetchGraph } from "../../api/graph";

export function GraphVisualization() {
  const nodes = useMemo(() => [], []);
  const edges = useMemo(() => [], []]);
  return (
    <div className="border border-border rounded-lg bg-surface p-4">
      <div className="text-sm text-muted">图谱可视化占位，后续接入 D3.js / React Flow。</div>
    </div>
  );
}