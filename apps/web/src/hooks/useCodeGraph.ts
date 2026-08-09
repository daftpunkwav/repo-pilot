import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getApi } from '@/api/client';
import type { GraphIndexStatus } from '@/components/code-graph/types';
import { toRenderGraph } from '@/components/code-graph/types';

export function useIndexStatus(projectId: string | undefined) {
  return useQuery({
    queryKey: ['graph-index-status', projectId],
    enabled: Boolean(projectId),
    refetchInterval: (q) => {
      const s = q.state.data?.data?.status;
      if (s && ['QUEUED', 'CLONING', 'INDEXING'].includes(s)) return 2000;
      return false;
    },
    queryFn: async () => {
      const api = getApi();
      return api.getCodeGraphStatus(projectId!);
    },
  });
}

export function useCodeGraph(
  projectId: string | undefined,
  opts: { maxNodes: number; enabled: boolean },
) {
  return useQuery({
    queryKey: ['code-graph', projectId, opts.maxNodes],
    enabled: Boolean(projectId) && opts.enabled,
    queryFn: async () => {
      const api = getApi();
      const res = await api.getCodeGraph(projectId!, { max_nodes: opts.maxNodes });
      return { ...res, render: toRenderGraph(res.data as never) };
    },
  });
}

export function useTriggerIndex(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (mode: 'fast' | 'moderate' | 'full' = 'moderate') => {
      const api = getApi();
      return api.triggerCodeGraphIndex(projectId!, { mode });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['graph-index-status', projectId] });
    },
  });
}

export function useRefreshIndex(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (mode: 'fast' | 'moderate' | 'full' = 'moderate') => {
      const api = getApi();
      return api.refreshCodeGraphIndex(projectId!, { mode });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['graph-index-status', projectId] });
    },
  });
}

export type { GraphIndexStatus };
