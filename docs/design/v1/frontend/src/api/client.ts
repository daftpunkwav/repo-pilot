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
  PaginatedList,
  Project,
  ProjectListParams,
  ProjectStats,
  QuestionAnswer,
  Settings,
  SSEEvent,
  StarRepo,
  Tag,
  TrendingPeriod,
  TrendingRepo,
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
  refresh(): Promise<ApiResponse<{ access_token: string }>>;
  me(): Promise<ApiResponse<User>>;
  updateProfile(data: Partial<User>): Promise<ApiResponse<User>>;
  changePassword(params: {
    old_password: string;
    new_password: string;
  }): Promise<ApiResponse<{ success: boolean }>>;

  listGithubAccounts(): Promise<ApiResponse<GitHubAccount[]>>;
  bindGithub(params: { username: string; pat: string }): Promise<ApiResponse<GitHubAccount>>;
  unbindGithub(id: string): Promise<ApiResponse<{ success: boolean }>>;
  listStars(username?: string): Promise<ApiResponse<StarRepo[]>>;
  importProjects(
    repos: Array<{ owner: string; repo: string; url: string }>
  ): Promise<ApiResponse<ImportResult>>;

  listProjects(params?: ProjectListParams): Promise<ApiResponse<PaginatedList<Project>>>;
  getProject(id: string): Promise<ApiResponse<Project>>;
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
  testLLM(): Promise<ApiResponse<{ success: boolean; latency_ms: number; model: string }>>;

  listTrending(params?: {
    period?: TrendingPeriod;
    language?: string;
  }): Promise<ApiResponse<TrendingRepo[]>>;
  listActivities(): Promise<ApiResponse<ActivityItem[]>>;

  listAgentSessions(): Promise<ApiResponse<AgentSession[]>>;
  getAgentSession(
    id: string
  ): Promise<ApiResponse<AgentSession & { messages: AgentMessage[] }>>;
  createAgentSession(): Promise<ApiResponse<AgentSession>>;
  deleteAgentSession(id: string): Promise<ApiResponse<{ success: boolean }>>;
  getAgentProfiles(): Promise<ApiResponse<AgentProfile[]>>;
  getUserProfile(): Promise<ApiResponse<UserProfile>>;
  updateUserProfile(data: Partial<UserProfile>): Promise<ApiResponse<UserProfile>>;
  getPermissions(): Promise<ApiResponse<AgentPermissions>>;

  chatAgent(sessionId: string, message: string): AsyncGenerator<SSEEvent>;
  answerQuestion(
    sessionId: string,
    questionId: string,
    answers: QuestionAnswer[]
  ): AsyncGenerator<SSEEvent>;
  analyzeProject(projectId: string, agent?: AgentId): AsyncGenerator<SSEEvent>;

  /** 当前会话的上下文窗口用量 */
  getContextWindow(sessionId?: string | null): Promise<ApiResponse<ContextWindowStats>>;

  /** GitHub 仓库搜索（导入弹窗） */
  searchGithubRepos(query: string): Promise<ApiResponse<StarRepo[]>>;

  /** 导入助手对话（SSE） */
  importAssistChat(
    message: string,
    context: ImportAssistContext
  ): AsyncGenerator<SSEEvent>;

  /** 图谱向导对话（SSE，专用 Atlas Agent） */
  graphGuideChat(
    message: string,
    context?: { selected_node_id?: string | null }
  ): AsyncGenerator<SSEEvent>;
}

async function createApiClient(): Promise<IApiClient> {
  const useMock = import.meta.env.VITE_USE_MOCK !== 'false';
  if (useMock) {
    const { MockApiClient } = await import('./mock');
    return new MockApiClient();
  }
  throw new Error('Real API client not implemented. Set VITE_USE_MOCK=true.');
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
