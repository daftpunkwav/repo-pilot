import { create } from 'zustand';
import type { ProjectListParams, ProjectProgress } from '@/api/types';

interface ProjectFilterState {
  search: string;
  categoryId: string | null;
  language: string | null;
  progress: ProjectProgress | null;
  tagId: string | null;
  sortBy: NonNullable<ProjectListParams['sort_by']>;
  sortOrder: NonNullable<ProjectListParams['sort_order']>;
  page: number;
  pageSize: number;
  setSearch: (search: string) => void;
  setCategoryId: (id: string | null) => void;
  setLanguage: (lang: string | null) => void;
  setProgress: (progress: ProjectProgress | null) => void;
  setTagId: (id: string | null) => void;
  setSortBy: (sort: NonNullable<ProjectListParams['sort_by']>) => void;
  setSortOrder: (order: NonNullable<ProjectListParams['sort_order']>) => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  resetFilters: () => void;
  toApiParams: () => ProjectListParams;
}

export const useProjectStore = create<ProjectFilterState>((set, get) => ({
  search: '',
  categoryId: null,
  language: null,
  progress: null,
  tagId: null,
  sortBy: 'imported_at',
  sortOrder: 'desc',
  page: 1,
  pageSize: 20,

  setSearch: (search) => set({ search, page: 1 }),
  setCategoryId: (categoryId) => set({ categoryId, page: 1 }),
  setLanguage: (language) => set({ language, page: 1 }),
  setProgress: (progress) => set({ progress, page: 1 }),
  setTagId: (tagId) => set({ tagId, page: 1 }),
  setSortBy: (sortBy) => set({ sortBy }),
  setSortOrder: (sortOrder) => set({ sortOrder }),
  setPage: (page) => set({ page }),
  setPageSize: (pageSize) => set({ pageSize, page: 1 }),

  resetFilters: () =>
    set({
      search: '',
      categoryId: null,
      language: null,
      progress: null,
      tagId: null,
      sortBy: 'imported_at',
      sortOrder: 'desc',
      page: 1,
    }),

  toApiParams: () => {
    const state = get();
    return {
      search: state.search || undefined,
      category_id: state.categoryId ?? undefined,
      language: state.language ?? undefined,
      progress: state.progress ?? undefined,
      tag_id: state.tagId ?? undefined,
      sort_by: state.sortBy,
      sort_order: state.sortOrder,
      page: state.page,
      page_size: state.pageSize,
    };
  },
}));
