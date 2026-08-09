import type { GraphData } from '@/api/types';
import { MOCK_PROJECTS } from './projects';

/** 按 category 粗分社区，并给 mock 节点补 foundation / hubness */
function enrichNodes(): GraphData['nodes'] {
  const byCat = new Map<string, string[]>();
  for (const p of MOCK_PROJECTS) {
    const cid = p.category_id || 'misc';
    if (!byCat.has(cid)) byCat.set(cid, []);
    byCat.get(cid)!.push(p.id);
  }
  const sizes = new Map<string, number>();
  for (const [cid, ids] of byCat) sizes.set(cid, ids.length);

  return MOCK_PROJECTS.map((p) => {
    const clusterId = p.category_id || p.id;
    const desc = (p.description || '').toLowerCase();
    const name = p.name.toLowerCase();
    const isFoundation =
      /framework|engine|database|postgres|docker|typescript|runtime|core/.test(
        `${name} ${desc}`,
      );
    const isApp = /demo|game|shop|starter|template|app/.test(`${name} ${desc}`);
    const foundation = Math.min(
      1,
      (isFoundation ? 0.72 : 0.38) +
        (isApp ? -0.22 : 0) +
        Math.min(0.2, Math.log1p(p.stars) / 40),
    );
    const hubness = Math.min(
      1,
      0.25 + Math.min(0.55, Math.log1p(p.stars) / 28) + (isFoundation ? 0.15 : 0),
    );
    return {
      id: p.id,
      name: p.name,
      language: p.language,
      stars: p.stars,
      category_id: p.category_id,
      progress: p.progress,
      description: p.description,
      foundation_score: Math.round(foundation * 1000) / 1000,
      hubness: Math.round(hubness * 1000) / 1000,
      cluster_id: clusterId,
      cluster_size: sizes.get(clusterId) || 1,
    };
  });
}

export const MOCK_GRAPH: GraphData = {
  nodes: enrichNodes(),
  edges: [
    { source: 'p_react', target: 'p_vue', similarity: 0.92 },
    { source: 'p_react', target: 'p_next', similarity: 0.88 },
    { source: 'p_react', target: 'p_d3', similarity: 0.78 },
    { source: 'p_react', target: 'p_typescript', similarity: 0.72 },
    { source: 'p_vue', target: 'p_next', similarity: 0.85 },
    { source: 'p_vue', target: 'p_tailwind', similarity: 0.74 },
    { source: 'p_fastapi', target: 'p_flask', similarity: 0.95 },
    { source: 'p_fastapi', target: 'p_requests', similarity: 0.82 },
    { source: 'p_fastapi', target: 'p_postgres', similarity: 0.68 },
    { source: 'p_flask', target: 'p_requests', similarity: 0.88 },
    { source: 'p_docker', target: 'p_postgres', similarity: 0.71 },
    { source: 'p_langchain', target: 'p_d3', similarity: 0.65 },
    { source: 'p_langchain', target: 'p_requests', similarity: 0.62 },
    { source: 'p_next', target: 'p_docker', similarity: 0.58 },
    { source: 'p_vite', target: 'p_vue', similarity: 0.76 },
    { source: 'p_supabase', target: 'p_postgres', similarity: 0.81 },
    { source: 'p_rust', target: 'p_docker', similarity: 0.55 },
    { source: 'p_typescript', target: 'p_vite', similarity: 0.83 },
    { source: 'p_tailwind', target: 'p_next', similarity: 0.7 },
    { source: 'p_react', target: 'p_vite', similarity: 0.67 },
  ],
};
