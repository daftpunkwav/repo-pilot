import type { IApiClient } from '@/api/client';
import type {
  ActivityItem,
  AgentId,
  AgentMessage,
  AgentPermissions,
  AgentProfile,
  AgentSession,
  ApiResponse,
  Category,
  ContextWindowStats,
  CreateProjectInput,
  GitHubAccount,
  GraphData,
  ImportAssistContext,
  ImportResult,
  LoginResponse,
  Note,
  OverviewRecentNote,
  PaginatedList,
  Project,
  ProjectListParams,
  ProjectStats,
  QuestionAnswer,
  RecommendedProject,
  Settings,
  SSEEvent,
  StarRepo,
  StarsListResult,
  Tag,
  TrendingPeriod,
  TrendingRepo,
  TrendingScoutIntroParams,
  User,
  UserProfile,
} from '@/api/types';
import { parseSSEStream } from '@/utils/sse-parser';
import { apiRequest, apiSSE, REFRESH_KEY, TOKEN_KEY } from './http';

function storeTokens(access: string, refresh: string) {
  localStorage.setItem(TOKEN_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export class RealApiClient implements IApiClient {
  async register(params: {
    username: string;
    password: string;
  }): Promise<ApiResponse<LoginResponse>> {
    const res = await apiRequest<LoginResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    storeTokens(res.data.access_token, res.data.refresh_token);
    return res;
  }

  async login(params: {
    username: string;
    password: string;
  }): Promise<ApiResponse<LoginResponse>> {
    const res = await apiRequest<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    storeTokens(res.data.access_token, res.data.refresh_token);
    return res;
  }

  async logout(): Promise<ApiResponse<{ success: boolean }>> {
    const refresh = localStorage.getItem(REFRESH_KEY);
    try {
      await apiRequest('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refresh }),
      });
    } finally {
      clearTokens();
    }
    return { data: { success: true }, meta: { ts: Date.now() } };
  }

  async refresh(): Promise<ApiResponse<{ access_token: string }>> {
    const refresh = localStorage.getItem(REFRESH_KEY);
    const res = await apiRequest<{ access_token: string }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refresh }),
    });
    localStorage.setItem(TOKEN_KEY, res.data.access_token);
    return res;
  }

  async me(): Promise<ApiResponse<User>> {
    return apiRequest<User>('/auth/me');
  }

  async updateProfile(data: Partial<User>): Promise<ApiResponse<User>> {
    return apiRequest<User>('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async changePassword(params: {
    old_password: string;
    new_password: string;
  }): Promise<ApiResponse<{ success: boolean }>> {
    await apiRequest('/auth/password', {
      method: 'PUT',
      body: JSON.stringify(params),
    });
    return { data: { success: true }, meta: { ts: Date.now() } };
  }

  async listGithubAccounts(): Promise<ApiResponse<GitHubAccount[]>> {
    return apiRequest<GitHubAccount[]>('/github/accounts');
  }

  async bindGithub(params: {
    username: string;
    pat: string;
  }): Promise<ApiResponse<GitHubAccount>> {
    return apiRequest<GitHubAccount>('/github/bindaccount', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async unbindGithub(id: string): Promise<ApiResponse<{ success: boolean }>> {
    return apiRequest(`/github/accounts/${id}`, { method: 'DELETE' });
  }

  async listStars(params?: {
    username?: string;
    refresh?: boolean;
  }): Promise<ApiResponse<StarsListResult>> {
    return apiRequest<StarsListResult>('/github/stars', {}, {
      username: params?.username,
      refresh: params?.refresh ? 'true' : undefined,
    });
  }

  async importProjects(
    repos: Array<{ owner: string; repo: string; url: string }>
  ): Promise<ApiResponse<ImportResult>> {
    return apiRequest<ImportResult>('/projects/import', {
      method: 'POST',
      body: JSON.stringify({ repos }),
    });
  }

  async listProjects(
    params?: ProjectListParams
  ): Promise<ApiResponse<PaginatedList<Project>>> {
    return apiRequest<PaginatedList<Project>>('/projects/', {}, {
      search: params?.search,
      language: params?.language,
      category_id: params?.category_id,
      tag_id: params?.tag_id,
      sort_by: params?.sort_by,
      progress: params?.progress,
      page: params?.page,
      page_size: params?.page_size,
    });
  }

  async getProject(id: string): Promise<ApiResponse<Project>> {
    return apiRequest<Project>(`/projects/${id}`);
  }

  async createProject(data: CreateProjectInput): Promise<ApiResponse<Project>> {
    return apiRequest<Project>('/projects/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProject(
    id: string,
    data: Partial<Project>
  ): Promise<ApiResponse<Project>> {
    return apiRequest<Project>(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteProject(id: string): Promise<ApiResponse<{ success: boolean }>> {
    return apiRequest(`/projects/${id}`, { method: 'DELETE' });
  }

  async updateProgress(
    id: string,
    progress: Project['progress']
  ): Promise<ApiResponse<{ id: string; progress: string }>> {
    return apiRequest(`/projects/${id}/progress`, { method: 'PUT' }, { progress });
  }

  async getProjectStats(): Promise<ApiResponse<ProjectStats>> {
    return apiRequest<ProjectStats>('/projects/stats');
  }

  async exportProjects(): Promise<ApiResponse<Project[]>> {
    const all: Project[] = [];
    let page = 1;
    const page_size = 100;
    while (true) {
      const res = await this.listProjects({ page, page_size });
      all.push(...res.data.items);
      if (all.length >= res.data.total) break;
      page += 1;
    }
    return { data: all, meta: { ts: Date.now(), total: all.length } };
  }

  async listCategories(): Promise<ApiResponse<Category[]>> {
    return apiRequest<Category[]>('/categories/');
  }

  async createCategory(data: { name: string }): Promise<ApiResponse<Category>> {
    return apiRequest<Category>('/categories/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCategory(
    id: string,
    data: { name: string }
  ): Promise<ApiResponse<Category>> {
    return apiRequest<Category>(`/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCategory(id: string): Promise<ApiResponse<{ success: boolean }>> {
    return apiRequest(`/categories/${id}`, { method: 'DELETE' });
  }

  async listTags(): Promise<ApiResponse<Tag[]>> {
    return apiRequest<Tag[]>('/tags/');
  }

  async createTag(data: { name: string }): Promise<ApiResponse<Tag>> {
    return apiRequest<Tag>('/tags/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteTag(id: string): Promise<ApiResponse<{ success: boolean }>> {
    return apiRequest(`/tags/${id}`, { method: 'DELETE' });
  }

  async setProjectTags(
    projectId: string,
    tagIds: string[]
  ): Promise<ApiResponse<{ project_id: string; tag_ids: string[] }>> {
    const res = await apiRequest<{ project_id: string; tag_ids: string[] }>(
      `/tags/projects/${projectId}`,
      {
        method: 'PUT',
        body: JSON.stringify({ tag_ids: tagIds }),
      }
    );
    return {
      data: {
        project_id: String(res.data.project_id),
        tag_ids: res.data.tag_ids.map(String),
      },
      meta: res.meta,
    };
  }

  async listNotes(projectId: string): Promise<ApiResponse<Note[]>> {
    return apiRequest<Note[]>(`/notes/projects/${projectId}/notes`);
  }

  async listAllNotes(): Promise<ApiResponse<Note[]>> {
    return apiRequest<Note[]>('/notes/');
  }

  async getNote(id: string): Promise<ApiResponse<Note>> {
    return apiRequest<Note>(`/notes/${id}`);
  }

  async createNote(
    projectId: string,
    data: { title: string; content: string }
  ): Promise<ApiResponse<Note>> {
    return apiRequest<Note>(`/notes/projects/${projectId}/notes`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateNote(id: string, data: Partial<Note>): Promise<ApiResponse<Note>> {
    return apiRequest<Note>(`/notes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteNote(id: string): Promise<ApiResponse<{ success: boolean }>> {
    return apiRequest(`/notes/${id}`, { method: 'DELETE' });
  }

  async getGraph(params?: {
    min_similarity?: number;
    max_edges?: number;
  }): Promise<ApiResponse<GraphData>> {
    return apiRequest<GraphData>('/graph/', {}, {
      min_similarity: params?.min_similarity,
      max_edges: params?.max_edges,
    });
  }

  async getSettings(): Promise<ApiResponse<Settings>> {
    return apiRequest<Settings>('/settings/');
  }

  async updateSettings(data: Partial<Settings>): Promise<ApiResponse<Settings>> {
    return apiRequest<Settings>('/settings/', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async saveLlmApiKey(apiKey: string): Promise<ApiResponse<{ masked: string }>> {
    return apiRequest<{ masked: string }>('/settings/api-key', {
      method: 'POST',
      body: JSON.stringify({ api_key: apiKey }),
    });
  }

  async testLLM(params?: {
    model?: string;
  }): Promise<
    ApiResponse<{
      success: boolean;
      latency_ms: number;
      model: string;
      reply?: string;
      error?: string;
      litellm_model?: string;
    }>
  > {
    return apiRequest('/settings/test-llm', {
      method: 'POST',
      body: JSON.stringify({ model: params?.model }),
    });
  }

  async listTrending(params?: {
    period?: TrendingPeriod;
    language?: string;
  }): Promise<ApiResponse<TrendingRepo[]>> {
    return apiRequest<TrendingRepo[]>('/overview/trending', {}, {
      period: params?.period,
      language: params?.language,
    });
  }

  async *streamTrendingScoutIntro(
    params: TrendingScoutIntroParams,
    signal?: AbortSignal
  ): AsyncGenerator<SSEEvent> {
    const res = await apiSSE('/agent/trending-scout', params as unknown as Record<string, unknown>, signal);
    if (!res.body) return;
    const reader = res.body.getReader();
    yield* parseSSEStream(reader, signal);
  }

  async listActivities(): Promise<ApiResponse<ActivityItem[]>> {
    return apiRequest<ActivityItem[]>('/overview/activities');
  }

  async listRecommendedProjects(params?: {
    limit?: number;
  }): Promise<ApiResponse<RecommendedProject[]>> {
    return apiRequest<RecommendedProject[]>('/overview/recommended', {}, {
      limit: params?.limit,
    });
  }

  async listOverviewRecentNotes(params?: {
    limit?: number;
  }): Promise<ApiResponse<OverviewRecentNote[]>> {
    return apiRequest<OverviewRecentNote[]>('/overview/recent-notes', {}, {
      limit: params?.limit,
    });
  }

  async listAgentSessions(): Promise<ApiResponse<AgentSession[]>> {
    const res = await apiRequest<AgentSession[]>('/agent/sessions');
    return {
      data: res.data.map((s) => ({
        ...s,
        id: String(s.id),
        agent: s.agent as AgentId,
      })),
      meta: res.meta,
    };
  }

  async getAgentSession(
    id: string
  ): Promise<ApiResponse<AgentSession & { messages: AgentMessage[] }>> {
    const res = await apiRequest<AgentSession & { messages: AgentMessage[] }>(
      `/agent/sessions/${id}`
    );
    return {
      data: {
        ...res.data,
        id: String(res.data.id),
        agent: res.data.agent as AgentId,
        messages: res.data.messages.map((m) => ({
          ...m,
          id: String(m.id),
          session_id: String(m.session_id),
          agent: m.agent as AgentId,
          content: m.content ?? '',
        })),
      },
      meta: res.meta,
    };
  }

  async createAgentSession(): Promise<ApiResponse<AgentSession>> {
    const res = await apiRequest<AgentSession>('/agent/sessions', { method: 'POST' });
    return {
      data: { ...res.data, id: String(res.data.id), agent: res.data.agent as AgentId },
      meta: res.meta,
    };
  }

  async deleteAgentSession(id: string): Promise<ApiResponse<{ success: boolean }>> {
    return apiRequest(`/agent/sessions/${id}`, { method: 'DELETE' });
  }

  async updateAgentSession(
    id: string,
    data: { title?: string; project_id?: string | null }
  ): Promise<ApiResponse<AgentSession>> {
    const res = await apiRequest<AgentSession>(`/agent/sessions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return {
      data: {
        ...res.data,
        id: String(res.data.id),
        agent: res.data.agent as AgentId,
        project_id: res.data.project_id ? String(res.data.project_id) : null,
      },
      meta: res.meta,
    };
  }

  async getAgentProfiles(): Promise<ApiResponse<AgentProfile[]>> {
    const res = await apiRequest<AgentProfile[]>('/agent/profiles');
    return {
      data: res.data.map((p) => ({ ...p, id: p.id as AgentId })),
      meta: res.meta,
    };
  }

  async getUserProfile(): Promise<ApiResponse<UserProfile>> {
    return apiRequest<UserProfile>('/user/profile');
  }

  async updateUserProfile(
    data: Partial<UserProfile>
  ): Promise<ApiResponse<UserProfile>> {
    return apiRequest<UserProfile>('/user/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async getPermissions(): Promise<ApiResponse<AgentPermissions>> {
    return apiRequest<AgentPermissions>('/agent/permissions');
  }

  async *chatAgent(
    sessionId: string,
    message: string,
    signal?: AbortSignal
  ): AsyncGenerator<SSEEvent> {
    const res = await apiSSE(`/agent/sessions/${sessionId}/chat`, { message }, signal);
    if (!res.body) return;
    const reader = res.body.getReader();
    yield* parseSSEStream(reader, signal);
  }

  async *answerQuestion(
    sessionId: string,
    questionId: string,
    answers: QuestionAnswer[],
    signal?: AbortSignal,
    skipped = false
  ): AsyncGenerator<SSEEvent> {
    const res = await apiSSE(
      '/agent/question',
      {
        session_id: sessionId,
        question_id: questionId,
        answers,
        skipped,
      },
      signal
    );
    if (!res.body) return;
    const reader = res.body.getReader();
    yield* parseSSEStream(reader, signal);
  }

  async *analyzeProject(
    projectId: string,
    agent?: AgentId,
    signal?: AbortSignal
  ): AsyncGenerator<SSEEvent> {
    const depth = agent === 'mentor' ? 'deep' : 'quick';
    const res = await apiSSE(
      `/agent/analyze/${projectId}`,
      { depth, force_refresh: false },
      signal
    );
    if (!res.body) return;
    const reader = res.body.getReader();
    yield* parseSSEStream(reader, signal);
  }

  async *generateNote(
    projectId: string,
    params?: { mode?: 'project' | 'standalone'; topic?: string },
    signal?: AbortSignal
  ): AsyncGenerator<SSEEvent> {
    const res = await apiSSE(
      '/agent/note/generate',
      {
        project_id: projectId,
        mode: params?.mode ?? 'project',
        topic: params?.topic,
      },
      signal
    );
    if (!res.body) return;
    const reader = res.body.getReader();
    yield* parseSSEStream(reader, signal);
  }

  async getContextWindow(
    sessionId?: string | null
  ): Promise<ApiResponse<ContextWindowStats>> {
    return apiRequest<ContextWindowStats>('/agent/context-window', {}, {
      session_id: sessionId ?? undefined,
    });
  }

  async searchGithubRepos(query: string): Promise<ApiResponse<StarRepo[]>> {
    return apiRequest<StarRepo[]>('/github/search', {}, { q: query });
  }

  async *importAssistChat(
    message: string,
    context: ImportAssistContext,
    signal?: AbortSignal
  ): AsyncGenerator<SSEEvent> {
    const res = await apiSSE(
      '/agent/import-assist',
      { message, context },
      signal
    );
    if (!res.body) return;
    const reader = res.body.getReader();
    yield* parseSSEStream(reader, signal);
  }

  async *graphGuideChat(
    message: string,
    context?: { selected_node_id?: string | null },
    signal?: AbortSignal
  ): AsyncGenerator<SSEEvent> {
    const res = await apiSSE(
      '/agent/graph-guide',
      {
        message,
        selected_node_id: context?.selected_node_id ?? null,
      },
      signal
    );
    if (!res.body) return;
    const reader = res.body.getReader();
    yield* parseSSEStream(reader, signal);
  }
}
