import type { GraphData } from '@/api/types';
import { MOCK_PROJECTS } from './projects';

export const MOCK_GRAPH: GraphData = {
  nodes: MOCK_PROJECTS.map((p) => ({
    id: p.id,
    name: p.name,
    language: p.language,
    stars: p.stars,
    category_id: p.category_id,
    progress: p.progress,
  })),
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
