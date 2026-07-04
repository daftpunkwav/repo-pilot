import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useShallow } from 'zustand/react/shallow';
import { getApi } from '@/api/client';
import type { CreateProjectInput, Project, ProjectProgress } from '@/api/types';
import { useProjectStore } from '@/stores/projectStore';

/** 从 store 派生查询参数；必须用 useShallow，避免每次返回新对象触发无限重渲染 */
function useProjectListParams() {
  return useProjectStore(
    useShallow((s) => ({
      search: s.search || undefined,
      category_id: s.categoryId ?? undefined,
      language: s.language ?? undefined,
      progress: s.progress ?? undefined,
      tag_id: s.tagId ?? undefined,
      sort_by: s.sortBy,
      sort_order: s.sortOrder,
      page: s.page,
      page_size: s.pageSize,
    }))
  );
}

export function useProjects() {
  const params = useProjectListParams();
  return useQuery({
    queryKey: ['projects', params],
    queryFn: async () => {
      const api = getApi();
      const res = await api.listProjects(params);
      return res.data;
    },
  });
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      if (!id) throw new Error('missing id');
      const api = getApi();
      const res = await api.getProject(id);
      return res.data;
    },
    enabled: Boolean(id),
  });
}

export function useProjectStats() {
  return useQuery({
    queryKey: ['projectStats'],
    queryFn: async () => {
      const api = getApi();
      const res = await api.getProjectStats();
      return res.data;
    },
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const api = getApi();
      const res = await api.listCategories();
      return res.data;
    },
  });
}

export function useTags() {
  return useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      const api = getApi();
      const res = await api.listTags();
      return res.data;
    },
  });
}

export function useTrending(period: 'daily' | 'weekly' | 'monthly', language?: string) {
  return useQuery({
    queryKey: ['trending', period, language],
    queryFn: async () => {
      const api = getApi();
      const res = await api.listTrending({ period, language });
      return res.data;
    },
  });
}

export function useActivities() {
  return useQuery({
    queryKey: ['activities'],
    queryFn: async () => {
      const api = getApi();
      const res = await api.listActivities();
      return res.data;
    },
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateProjectInput) => {
      const api = getApi();
      const res = await api.createProject(data);
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['projects'] });
      void qc.invalidateQueries({ queryKey: ['projectStats'] });
    },
  });
}

export function useImportProjects() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (repos: Array<{ owner: string; repo: string; url: string }>) => {
      const api = getApi();
      const res = await api.importProjects(repos);
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['projects'] });
      void qc.invalidateQueries({ queryKey: ['projectStats'] });
    },
  });
}

export function useUpdateProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, progress }: { id: string; progress: ProjectProgress }) => {
      const api = getApi();
      await api.updateProgress(id, progress);
    },
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: ['projects'] });
      void qc.invalidateQueries({ queryKey: ['project', vars.id] });
      void qc.invalidateQueries({ queryKey: ['projectStats'] });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const api = getApi();
      await api.deleteProject(id);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['projects'] });
      void qc.invalidateQueries({ queryKey: ['projectStats'] });
    },
  });
}

export function useGithubStars() {
  return useQuery({
    queryKey: ['githubStars'],
    queryFn: async () => {
      const api = getApi();
      const res = await api.listStars();
      return res.data;
    },
  });
}

export function useGithubAccounts() {
  return useQuery({
    queryKey: ['githubAccounts'],
    queryFn: async () => {
      const api = getApi();
      const res = await api.listGithubAccounts();
      return res.data;
    },
  });
}

export function useSetProjectTags() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, tagIds }: { projectId: string; tagIds: string[] }) => {
      const api = getApi();
      await api.setProjectTags(projectId, tagIds);
    },
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: ['project', vars.projectId] });
      void qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export type { Project };
