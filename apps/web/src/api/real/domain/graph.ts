/**
 * Graph 域 — 项目知识图谱 + GitHub 仓库搜索(导入助手)
 */
import type { ApiResponse, GraphData, StarRepo } from '@/api/types';
import type { HttpCtx } from './http-ctx';

export class GraphApi {
  constructor(private readonly ctx: HttpCtx) {}

  async getGraph(params?: { min_similarity?: number; max_edges?: number }): Promise<ApiResponse<GraphData>> {
    return this.ctx.apiRequest<GraphData>('/graph/', {}, {
      min_similarity: params?.min_similarity,
      max_edges: params?.max_edges,
    });
  }

  async searchGithubRepos(query: string): Promise<ApiResponse<StarRepo[]>> {
    return this.ctx.apiRequest<StarRepo[]>('/github/search', {}, { q: query });
  }
}
