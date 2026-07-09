import { useQuery } from '@tanstack/react-query';
import { getApi } from '@/api/client';
import { useGraphStore } from '@/stores/graphStore';

export function useGraph() {
  const minSimilarity = useGraphStore((s) => s.minSimilarity);
  const maxEdges = useGraphStore((s) => s.maxEdges);

  return useQuery({
    queryKey: ['graph', minSimilarity, maxEdges],
    queryFn: async () => {
      const api = getApi();
      const res = await api.getGraph({ min_similarity: minSimilarity, max_edges: maxEdges });
      return res.data;
    },
  });
}
