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
  ProjectReadme,
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
} from './types';

/**
 * IApiClient — Mock 和 Real 实现的统一接口契约
 */
export interface IApiClient {
  register(params: { username: string; password: string }): Promise<ApiResponse<LoginResponse>>;
  login(params: { username: string; password: string }): Promise<ApiResponse<LoginResponse>>;
  logout(): Promise<ApiResponse<{ success: boolean }>>;
  refresh(): Promise<ApiResponse<{ access_token: string; refresh_token?: string }>>;
  me(): Promise<ApiResponse<User>>;
  updateProfile(data: Partial<User>): Promise<ApiResponse<User>>;
  changePassword(params: {
    old_password: string;
    new_password: string;
  }): Promise<ApiResponse<{ success: boolean }>>;

  listGithubAccounts(): Promise<ApiResponse<GitHubAccount[]>>;
  bindGithub(params: { username: string; pat: string }): Promise<ApiResponse<GitHubAccount>>;
  unbindGithub(id: string): Promise<ApiResponse<{ success: boolean }>>;
  listStars(params?: {
    username?: string;
    refresh?: boolean;
  }): Promise<ApiResponse<StarsListResult>>;
  importProjects(
    repos: Array<{ owner: string; repo: string; url: string }>
  ): Promise<ApiResponse<ImportResult>>;

  listProjects(params?: ProjectListParams): Promise<ApiResponse<PaginatedList<Project>>>;
  getProject(id: string): Promise<ApiResponse<Project>>;
  getProjectReadme(id: string): Promise<ApiResponse<ProjectReadme>>;
  createProject(data: CreateProjectInput): Promise<ApiResponse<Project>>;
  updateProject(id: string, data: Partial<Project>): Promise<ApiResponse<Project>>;
  deleteProject(id: string): Promise<ApiResponse<{ success: boolean }>>;
  updateProgress(
    id: string,
    progress: Project['progress']
  ): Promise<ApiResponse<{ id: string; progress: string }>>;
  getProjectStats(): Promise<ApiResponse<ProjectStats>>;
  exportProjects(): Promise<ApiResponse<Project[]>>;

  listCategories(): Promise<ApiResponse<Category[]>>;
  createCategory(data: { name: string }): Promise<ApiResponse<Category>>;
  updateCategory(id: string, data: { name: string }): Promise<ApiResponse<Category>>;
  deleteCategory(id: string): Promise<ApiResponse<{ success: boolean }>>;
  listTags(): Promise<ApiResponse<Tag[]>>;
  createTag(data: { name: string }): Promise<ApiResponse<Tag>>;
  deleteTag(id: string): Promise<ApiResponse<{ success: boolean }>>;
  setProjectTags(
    projectId: string,
    tagIds: string[]
  ): Promise<ApiResponse<{ project_id: string; tag_ids: string[] }>>;

  listNotes(projectId: string): Promise<ApiResponse<Note[]>>;
  listAllNotes(): Promise<ApiResponse<Note[]>>;
  getNote(id: string): Promise<ApiResponse<Note>>;
  createNote(
    projectId: string,
    data: { title: string; content: string }
  ): Promise<ApiResponse<Note>>;
  updateNote(id: string, data: Partial<Note>): Promise<ApiResponse<Note>>;
  deleteNote(id: string): Promise<ApiResponse<{ success: boolean }>>;

  getGraph(params?: {
    min_similarity?: number;
    max_edges?: number;
  }): Promise<ApiResponse<GraphData>>;

  getSettings(): Promise<ApiResponse<Settings>>;
  updateSettings(data: Partial<Settings>): Promise<ApiResponse<Settings>>;
  saveLlmApiKey(apiKey: string): Promise<ApiResponse<{ masked: string }>>;
  testLLM(params?: {
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
  >;

  listTrending(params?: {
    period?: TrendingPeriod;
    language?: string;
  }): Promise<ApiResponse<TrendingRepo[]>>;
  /** Scout 总览 trending 悬停介绍（SSE · 未来对接 LLM） */
  streamTrendingScoutIntro(
    params: TrendingScoutIntroParams,
    signal?: AbortSignal
  ): AsyncGenerator<SSEEvent>;
  listActivities(): Promise<ApiResponse<ActivityItem[]>>;
  listRecommendedProjects(params?: {
    limit?: number;
  }): Promise<ApiResponse<RecommendedProject[]>>;
  listOverviewRecentNotes(params?: {
    limit?: number;
  }): Promise<ApiResponse<OverviewRecentNote[]>>;

  listAgentSessions(): Promise<ApiResponse<AgentSession[]>>;
  getAgentSession(
    id: string
  ): Promise<ApiResponse<AgentSession & { messages: AgentMessage[] }>>;
  createAgentSession(): Promise<ApiResponse<AgentSession>>;
  deleteAgentSession(id: string): Promise<ApiResponse<{ success: boolean }>>;
  updateAgentSession(
    id: string,
    data: { title?: string; project_id?: string | null }
  ): Promise<ApiResponse<AgentSession>>;
  getAgentProfiles(): Promise<ApiResponse<AgentProfile[]>>;
  getUserProfile(): Promise<ApiResponse<UserProfile>>;
  updateUserProfile(data: Partial<UserProfile>): Promise<ApiResponse<UserProfile>>;
  getPermissions(): Promise<ApiResponse<AgentPermissions>>;

  chatAgent(sessionId: string, message: string, signal?: AbortSignal): AsyncGenerator<SSEEvent>;
  answerQuestion(
    sessionId: string,
    questionId: string,
    answers: QuestionAnswer[],
    signal?: AbortSignal,
    skipped?: boolean
  ): AsyncGenerator<SSEEvent>;
  analyzeProject(projectId: string, agent?: AgentId, signal?: AbortSignal): AsyncGenerator<SSEEvent>;
  /** Scribe 生成笔记大纲/草稿（SSE） */
  generateNote(
    projectId: string,
    params?: { mode?: 'project' | 'standalone'; topic?: string },
    signal?: AbortSignal
  ): AsyncGenerator<SSEEvent>;

  /** 当前会话的上下文窗口用量 */
  getContextWindow(sessionId?: string | null): Promise<ApiResponse<ContextWindowStats>>;

  /** GitHub 仓库搜索（导入弹窗） */
  searchGithubRepos(query: string): Promise<ApiResponse<StarRepo[]>>;

  /** 导入助手对话（SSE） */
  importAssistChat(
    message: string,
    context: ImportAssistContext,
    signal?: AbortSignal
  ): AsyncGenerator<SSEEvent>;

  /** 图谱向导对话（SSE，专用 Atlas Agent） */
  graphGuideChat(
    message: string,
    context?: { selected_node_id?: string | null },
    signal?: AbortSignal
  ): AsyncGenerator<SSEEvent>;

  /**
   * Mock-only dev hook. Default implementation returns null; MockApiClient
   * overrides to return the applied overview scenario round (1/2/3).
   * Application code MUST treat this as opaque and use
   * `getAppliedOverviewRoundIfMock(client)` instead of calling directly.
   */
  getAppliedOverviewRound?(): number | null;

  /**
   * Mock-only dev hook. Default implementation is a no-op; MockApiClient
   * overrides to swap the in-memory overview dataset for E2E / dev URL
   * (`?mock_round=`). Application code MUST go through
   * `applyOverviewScenarioIfMock()`.
   */
  applyOverviewScenario?(round: number): void;
}

/**
 * Mock-only: apply an overview scenario if the active client supports it.
 * Safe to call on any IApiClient; returns true when the action was applied.
 */
export function applyOverviewScenarioIfMock(
  client: IApiClient,
  round: number
): boolean {
  const fn = (client as { applyOverviewScenario?: (r: number) => void })
    .applyOverviewScenario;
  if (typeof fn !== 'function') return false;
  fn.call(client, round);
  return true;
}

async function createApiClient(): Promise<IApiClient> {
  const useMock = import.meta.env.VITE_USE_MOCK !== 'false';
  if (useMock) {
    const { MockApiClient } = await import('./mock');
    return new MockApiClient();
  }
  const { RealApiClient } = await import('./real');
  return new RealApiClient();
}

let apiClientPromise: Promise<IApiClient> | null = null;
let apiClient: IApiClient | null = null;

export function getApiClient(): Promise<IApiClient> {
  if (!apiClientPromise) {
    apiClientPromise = createApiClient();
  }
  return apiClientPromise;
}

export async function initApiClient(): Promise<IApiClient> {
  apiClient = await getApiClient();
  return apiClient;
}

export function getApi(): IApiClient {
  if (!apiClient) {
    throw new Error('ApiClient not initialized. Call initApiClient() in main.tsx first.');
  }
  return apiClient;
}

/**
 * Mock-only: read the currently applied overview round.
 * Returns null when the active client is not a mock implementation.
 * Use this instead of `instanceof MockApiClient` checks in app code so the
 * boundary stays clean and tree-shakable when VITE_USE_MOCK=false.
 */
export function getAppliedOverviewRoundIfMock(client: IApiClient): number | null {
  const maybe = (client as { getAppliedOverviewRound?: () => number | null })
    .getAppliedOverviewRound;
  return typeof maybe === 'function' ? maybe.call(client) : null;
}
