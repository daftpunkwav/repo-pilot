import { useEffect, useState } from "react";
import { useAuthStore } from "../store/authStore";
import { fetchGraph } from "../api/graph";

export default function GraphPage() {
  const user = useAuthStore((s) => s.user);
  const [graph, setGraph] = useState<{ nodes: Array<{ id: string; name: string; language?: string; category?: string }>; edges: Array<{ source: string; target: string }> }>({ nodes: [], edges: [] });

  useEffect(() => {
    if (!user) return;
    fetchGraph().then((res) => {
      const data = res as { data: { nodes: Array<{ id: string; name: string; language?: string; category?: string }>; edges: Array<{ source: string; target: string }> } };
      setGraph(data.data);
    });
  }, [user]);

  return (
    <div className="min-h-screen">
      <header className="px-6 py-4 border-b border-border">
        <h1 className="text-lg font-semibold">知识图谱</h1>
      </header>
      <main className="p-6">
        <p className="text-muted">图谱节点数：{graph.nodes.length}，边数：{graph.edges.length}</p>
      </main>
    </div>
  );
}
