import type {
  ActivityItem,
  AgentId,
  AgentMessage,
  AgentPermissions,
  AgentProfile,
  AgentSession,
  ApiError,
  ApiResponse,
  Category,
  CreateProjectInput,
  GitHubAccount,
  GraphData,
  ImportResult,
  LoginResponse,
  Note,
  OverviewRecentNote,
  PaginatedList,
  Project,
  ProjectListParams,
  ProjectProgress,
  ProjectStats,
  ContextWindowStats,
  ImportAssistContext,
  QuestionAnswer,
  RecommendedProject,
  Settings,
  SSEEvent,
  StarRepo,
  Tag,
  TrendingPeriod,
  TrendingRepo,
  TrendingScoutIntroParams,
  User,
  UserProfile,
} from '@/api/types';
import type { IApiClient } from '@/api/client';
import { MOCK_ACTIVITIES } from './data/activities';
import { buildMockRecommendedProjects } from './data/recommendations';
import {
  getOverviewScenario,
  persistOverviewMockRound,
  readOverviewMockRound,
  type OverviewMockRound,
} from './data/overviewScenarios';
import { MOCK_CATEGORIES } from './data/categories';
import { MOCK_GRAPH } from './data/graph';
import { MOCK_NOTES } from './data/notes';
import {
  MOCK_PROJECTS,
  MOCK_UNIMPORTED_STARS,
} from './data/projects';
import {
  MOCK_AGENT_MESSAGES,
  MOCK_AGENT_PROFILES,
  MOCK_AGENT_SESSIONS,
} from './data/sessions';
import { DEFAULT_SETTINGS } from './data/settings';
import { DEFAULT_USER_PROFILE } from './data/profile';
import { MOCK_TAGS } from './data/tags';
import { getTrendingRepos } from './data/trending';
import { findMockUser, MOCK_USERS } from './data/users';
import {
  mockAfterQuestionAnswer,
  mockProjectAnalysis,
  mockTrendingScoutIntro,
  selectChatScenario,
} from './sse';

const MIN_DELAY = 200;
const MAX_DELAY = 500;
const TOKEN_KEY = 'rp_token';
const REFRESH_KEY = 'rp_refresh';

function delay(ms?: number): Promise<void> {
  const duration = ms ?? MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY);
  return new Promise((resolve) => setTimeout(resolve, duration));
}

function wrapResponse<T>(
  data: T,
  meta?: Partial<ApiResponse<T>['meta']>
): ApiResponse<T> {
  return { data, meta: { ts: Date.now(), ...meta } };
}

function throwError(code: string, message: string): never {
  const err: ApiError = { error: { code, message } };
  throw err;
}

function requireAuth(): void {
  if (!localStorage.getItem(TOKEN_KEY)) {
    throwError('UNAUTHORIZED', '请先登录');
  }
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export class MockApiClient implements IApiClient {
  private projects: Project[] = clone(MOCK_PROJECTS);
  private notes: Note[] = clone(MOCK_NOTES);
  private categories: Category[] = clone(MOCK_CATEGORIES);
  private tags: Tag[] = clone(MOCK_TAGS);
  private sessions: AgentSession[] = clone(MOCK_AGENT_SESSIONS);
  private messages: Record<string, AgentMessage[]> = clone(MOCK_AGENT_MESSAGES);
  private settings: Settings = clone(DEFAULT_SETTINGS);
  private userProfile: UserProfile = clone(DEFAULT_USER_PROFILE);
  private githubAccounts: GitHubAccount[] = [
    {
      id: 'gh_001',
      username: 'zhang-jie',
      avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
      bound_at: '2026-05-12T10:00:00Z',
    },
  ];
  private currentUser: User | null = null;
  private activities: ActivityItem[] = clone(MOCK_ACTIVITIES);
  private scenarioRecommendations: RecommendedProject[] | null = null;
  private scenarioTrendingWeekly: TrendingRepo[] | null = null;
  private appliedOverviewRound: OverviewMockRound | null = null;

  constructor() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      const main = MOCK_USERS[0];
      if (main) this.currentUser = { ...main.user };
    }
    // 不在构造时应用 scenario：由 main.tsx / OverviewMockRoundSync 在 URL 同步后统一加载
  }

  getAppliedOverviewRound(): OverviewMockRound | null {
    return this.appliedOverviewRound;
  }

  /** 模拟后端切换总览数据快照（开发 / E2E / ?mock_round=） */
  applyOverviewScenario(round: OverviewMockRound) {
    persistOverviewMockRound(round);
    this.appliedOverviewRound = round;
    const snapshot = getOverviewScenario(round);
    this.projects = clone(snapshot.projects);
    this.notes = clone(snapshot.notes);
    this.activities = clone(snapshot.activities);
    this.userProfile = {
      ...clone(DEFAULT_USER_PROFILE),
      history_summary: snapshot.historySummary,
    };
    this.scenarioRecommendations = clone(snapshot.recommendations);
    this.scenarioTrendingWeekly = clone(snapshot.trendingWeekly);
  }

  /** 模拟后端 Activity Feed：新活动插入列表头部 */
  private prependActivity(entry: Omit<ActivityItem, 'id' | 'created_at'>) {
    this.activities.unshift({
      ...entry,
      id: newId('act'),
      created_at: new Date().toISOString(),
    });
    if (this.activities.length > 50) {
      this.activities.length = 50;
    }
  }

  // ─── Auth ─────────────────────────────────────────────

  async register(params: {
    username: string;
    password: string;
  }): Promise<ApiResponse<LoginResponse>> {
    await delay();
    if (findMockUser(params.username)) {
      throwError('USERNAME_EXISTS', '用户名已存在');
    }
    const user: User = {
      id: newId('usr'),
      username: params.username,
      github_bound: false,
      created_at: new Date().toISOString(),
    };
    MOCK_USERS.push({ user, password: params.password });
    return this.issueTokens(user);
  }

  async login(params: {
    username: string;
    password: string;
  }): Promise<ApiResponse<LoginResponse>> {
    await delay();
    const record = findMockUser(params.username);
    if (!record || record.password !== params.password) {
      throwError('AUTH_FAILED', '用户名或密码错误');
    }
    return this.issueTokens(record.user);
  }

  private async issueTokens(user: User): Promise<ApiResponse<LoginResponse>> {
    const access = `mock_token_${Date.now()}`;
    const refresh = `mock_refresh_${Date.now()}`;
    localStorage.setItem(TOKEN_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
    this.currentUser = { ...user };
    this.applyOverviewScenario(readOverviewMockRound());
    return wrapResponse({ access_token: access, refresh_token: refresh, user });
  }

  async logout(): Promise<ApiResponse<{ success: boolean }>> {
    await delay(100);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    this.currentUser = null;
    return wrapResponse({ success: true });
  }

  async refresh(): Promise<ApiResponse<{ access_token: string }>> {
    await delay(100);
    const refresh = localStorage.getItem(REFRESH_KEY);
    if (!refresh) throwError('AUTH_FAILED', 'Refresh token 无效');
    const access = `mock_token_${Date.now()}`;
    localStorage.setItem(TOKEN_KEY, access);
    return wrapResponse({ access_token: access });
  }

  async me(): Promise<ApiResponse<User>> {
    await delay(100);
    requireAuth();
    if (!this.currentUser) throwError('UNAUTHORIZED', '未登录');
    return wrapResponse(this.currentUser);
  }

  async updateProfile(data: Partial<User>): Promise<ApiResponse<User>> {
    await delay();
    requireAuth();
    if (!this.currentUser) throwError('UNAUTHORIZED', '未登录');
    this.currentUser = { ...this.currentUser, ...data };
    const idx = MOCK_USERS.findIndex((u) => u.user.id === this.currentUser?.id);
    if (idx >= 0 && MOCK_USERS[idx]) {
      MOCK_USERS[idx].user = { ...this.currentUser };
    }
    return wrapResponse(this.currentUser);
  }

  async changePassword(params: {
    old_password: string;
    new_password: string;
  }): Promise<ApiResponse<{ success: boolean }>> {
    await delay();
    requireAuth();
    if (!this.currentUser) throwError('UNAUTHORIZED', '未登录');
    const record = MOCK_USERS.find((u) => u.user.id === this.currentUser?.id);
    if (!record || record.password !== params.old_password) {
      throwError('AUTH_FAILED', '旧密码不正确');
    }
    record.password = params.new_password;
    await this.logout();
    return wrapResponse({ success: true });
  }

  // ─── GitHub ───────────────────────────────────────────

  async listGithubAccounts(): Promise<ApiResponse<GitHubAccount[]>> {
    await delay();
    requireAuth();
    return wrapResponse([...this.githubAccounts]);
  }

  async bindGithub(params: {
    username: string;
    pat: string;
  }): Promise<ApiResponse<GitHubAccount>> {
    await delay();
    requireAuth();
    void params.pat;
    const account: GitHubAccount = {
      id: newId('gh'),
      username: params.username,
      bound_at: new Date().toISOString(),
    };
    this.githubAccounts.push(account);
    if (this.currentUser) {
      this.currentUser.github_bound = true;
      this.currentUser.github_login = params.username;
    }
    return wrapResponse(account);
  }

  async unbindGithub(id: string): Promise<ApiResponse<{ success: boolean }>> {
    await delay();
    requireAuth();
    this.githubAccounts = this.githubAccounts.filter((a) => a.id !== id);
    if (this.githubAccounts.length === 0 && this.currentUser) {
      this.currentUser.github_bound = false;
      this.currentUser.github_login = undefined;
    }
    return wrapResponse({ success: true });
  }

  async listStars(): Promise<ApiResponse<StarRepo[]>> {
    await delay();
    requireAuth();
    const importedNames = new Set(this.projects.map((p) => p.name));
    const fromProjects: StarRepo[] = this.projects.slice(0, 5).map((p) => {
      const [owner = '', repo = ''] = p.name.split('/');
      return {
        owner,
        repo,
        url: p.url,
        description: p.description,
        language: p.language,
        stars: p.stars,
        already_imported: true,
      };
    });
    const unimported: StarRepo[] = MOCK_UNIMPORTED_STARS.map((s) => ({
      ...s,
      already_imported: importedNames.has(`${s.owner}/${s.repo}`),
    }));
    return wrapResponse([...fromProjects, ...unimported]);
  }

  async importProjects(
    repos: Array<{ owner: string; repo: string; url: string }>
  ): Promise<ApiResponse<ImportResult>> {
    await delay(400);
    requireAuth();
    let succeeded = 0;
    let failed = 0;
    const errors: Array<{ repo: string; reason: string }> = [];
    let lastImportedId: string | undefined;

    for (const r of repos) {
      const name = `${r.owner}/${r.repo}`;
      if (this.projects.some((p) => p.url === r.url || p.name === name)) {
        failed += 1;
        errors.push({ repo: name, reason: '已存在' });
        continue;
      }
      const project: Project = {
        id: newId('p'),
        name,
        url: r.url,
        stars: Math.floor(Math.random() * 50000) + 1000,
        progress: 'none',
        tags: [],
        source: 'github',
        imported_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.projects.push(project);
      lastImportedId = project.id;
      succeeded += 1;
    }

    const summary = `成功导入 ${succeeded} 个，失败 ${failed} 个`;
    if (succeeded > 0) {
      const lastImported = lastImportedId
        ? this.projects.find((p) => p.id === lastImportedId)
        : undefined;
      this.prependActivity({
        type: 'import',
        title:
          succeeded === 1 && lastImported
            ? `导入 ${lastImported.name}`
            : `批量导入 ${succeeded} 个项目`,
        description: summary,
        project_id: succeeded === 1 ? lastImportedId : undefined,
      });
    }
    return wrapResponse({ succeeded, failed, summary, errors });
  }

  // ─── Projects ─────────────────────────────────────────

  async listProjects(
    params?: ProjectListParams
  ): Promise<ApiResponse<PaginatedList<Project>>> {
    await delay();
    requireAuth();
    let items = [...this.projects];
    const search = params?.search?.toLowerCase();
    if (search) {
      items = items.filter(
        (p) =>
          p.name.toLowerCase().includes(search) ||
          (p.description?.toLowerCase().includes(search) ?? false)
      );
    }
    if (params?.category_id) {
      items = items.filter((p) => p.category_id === params.category_id);
    }
    if (params?.language) {
      items = items.filter((p) => p.language === params.language);
    }
    if (params?.progress) {
      items = items.filter((p) => p.progress === params.progress);
    }
    if (params?.tag_id) {
      items = items.filter((p) => p.tags.includes(params.tag_id ?? ''));
    }

    const sortBy = params?.sort_by ?? 'imported_at';
    const sortOrder = params?.sort_order ?? 'desc';
    items.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortBy === 'stars') cmp = a.stars - b.stars;
      else if (sortBy === 'updated_at') {
        cmp =
          new Date(a.updated_at ?? a.imported_at).getTime() -
          new Date(b.updated_at ?? b.imported_at).getTime();
      } else {
        cmp = new Date(a.imported_at).getTime() - new Date(b.imported_at).getTime();
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });

    const page = params?.page ?? 1;
    const pageSize = params?.page_size ?? 20;
    const start = (page - 1) * pageSize;
    const slice = items.slice(start, start + pageSize);

    return wrapResponse(
      { items: slice, total: items.length, page, page_size: pageSize },
      { page, page_size: pageSize, total: items.length }
    );
  }

  async getProject(id: string): Promise<ApiResponse<Project>> {
    await delay();
    requireAuth();
    const project = this.projects.find((p) => p.id === id);
    if (!project) throwError('NOT_FOUND', '项目不存在');
    return wrapResponse(project);
  }

  async createProject(data: CreateProjectInput): Promise<ApiResponse<Project>> {
    await delay();
    requireAuth();
    if (this.projects.some((p) => p.url === data.url)) {
      throwError('DUPLICATE_URL', '该 URL 已存在');
    }
    const project: Project = {
      id: newId('p'),
      name: data.name,
      url: data.url,
      description: data.description,
      category_id: data.category_id,
      progress: 'none',
      tags: data.tags ?? [],
      source: 'manual',
      stars: 0,
      imported_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.projects.push(project);
    return wrapResponse(project);
  }

  async updateProject(
    id: string,
    data: Partial<Project>
  ): Promise<ApiResponse<Project>> {
    await delay();
    requireAuth();
    const idx = this.projects.findIndex((p) => p.id === id);
    if (idx < 0) throwError('NOT_FOUND', '项目不存在');
    const existing = this.projects[idx];
    if (!existing) throwError('NOT_FOUND', '项目不存在');
    const updated: Project = {
      ...existing,
      ...data,
      id: existing.id,
      updated_at: new Date().toISOString(),
    };
    this.projects[idx] = updated;
    return wrapResponse(updated);
  }

  async deleteProject(id: string): Promise<ApiResponse<{ success: boolean }>> {
    await delay();
    requireAuth();
    const idx = this.projects.findIndex((p) => p.id === id);
    if (idx < 0) throwError('NOT_FOUND', '项目不存在');
    this.projects.splice(idx, 1);
    this.notes = this.notes.filter((n) => n.project_id !== id);
    return wrapResponse({ success: true });
  }

  async updateProgress(
    id: string,
    progress: ProjectProgress
  ): Promise<ApiResponse<{ id: string; progress: string }>> {
    await delay();
    requireAuth();
    const project = this.projects.find((p) => p.id === id);
    if (!project) throwError('NOT_FOUND', '项目不存在');
    project.progress = progress;
    project.updated_at = new Date().toISOString();
    const progressLabel: Record<ProjectProgress, string> = {
      none: '待开始',
      learning: '学习中',
      learned: '已学习',
      mastered: '已掌握',
    };
    this.prependActivity({
      type: 'progress',
      title: `${project.name.split('/')[1] ?? project.name} 标记为${progressLabel[progress]}`,
      description: `${project.name} 学习进度更新`,
      project_id: id,
    });
    return wrapResponse({ id, progress });
  }

  async getProjectStats(): Promise<ApiResponse<ProjectStats>> {
    await delay();
    requireAuth();
    const by_progress: Record<ProjectProgress, number> = {
      none: 0,
      learning: 0,
      learned: 0,
      mastered: 0,
    };
    const by_category: Record<string, number> = {};
    const by_language: Record<string, number> = {};

    for (const p of this.projects) {
      by_progress[p.progress] += 1;
      if (p.category_id) {
        by_category[p.category_id] = (by_category[p.category_id] ?? 0) + 1;
      }
      if (p.language) {
        by_language[p.language] = (by_language[p.language] ?? 0) + 1;
      }
    }

    return wrapResponse({
      total: this.projects.length,
      by_progress,
      by_category,
      by_language,
    });
  }

  async exportProjects(): Promise<ApiResponse<Project[]>> {
    await delay(300);
    requireAuth();
    return wrapResponse([...this.projects]);
  }

  // ─── Categories & Tags ────────────────────────────────

  async listCategories(): Promise<ApiResponse<Category[]>> {
    await delay();
    requireAuth();
    return wrapResponse([...this.categories]);
  }

  async createCategory(data: { name: string }): Promise<ApiResponse<Category>> {
    await delay();
    requireAuth();
    const cat: Category = {
      id: newId('cat'),
      name: data.name,
      is_preset: false,
    };
    this.categories.push(cat);
    return wrapResponse(cat);
  }

  async updateCategory(
    id: string,
    data: { name: string }
  ): Promise<ApiResponse<Category>> {
    await delay();
    requireAuth();
    const cat = this.categories.find((c) => c.id === id);
    if (!cat) throwError('NOT_FOUND', '分类不存在');
    cat.name = data.name;
    return wrapResponse(cat);
  }

  async deleteCategory(id: string): Promise<ApiResponse<{ success: boolean }>> {
    await delay();
    requireAuth();
    const cat = this.categories.find((c) => c.id === id);
    if (!cat) throwError('NOT_FOUND', '分类不存在');
    if (cat.is_preset) throwError('FORBIDDEN', '预设分类不可删除');
    this.categories = this.categories.filter((c) => c.id !== id);
    return wrapResponse({ success: true });
  }

  async listTags(): Promise<ApiResponse<Tag[]>> {
    await delay();
    requireAuth();
    return wrapResponse([...this.tags]);
  }

  async createTag(data: { name: string }): Promise<ApiResponse<Tag>> {
    await delay();
    requireAuth();
    const tag: Tag = { id: newId('tag'), name: data.name, count: 0 };
    this.tags.push(tag);
    return wrapResponse(tag);
  }

  async deleteTag(id: string): Promise<ApiResponse<{ success: boolean }>> {
    await delay();
    requireAuth();
    this.tags = this.tags.filter((t) => t.id !== id);
    for (const p of this.projects) {
      p.tags = p.tags.filter((tid) => tid !== id);
    }
    return wrapResponse({ success: true });
  }

  async setProjectTags(
    projectId: string,
    tagIds: string[]
  ): Promise<ApiResponse<{ project_id: string; tag_ids: string[] }>> {
    await delay();
    requireAuth();
    const project = this.projects.find((p) => p.id === projectId);
    if (!project) throwError('NOT_FOUND', '项目不存在');
    project.tags = [...tagIds];
    project.updated_at = new Date().toISOString();
    return wrapResponse({ project_id: projectId, tag_ids: tagIds });
  }

  // ─── Notes ────────────────────────────────────────────

  async listNotes(projectId: string): Promise<ApiResponse<Note[]>> {
    await delay();
    requireAuth();
    return wrapResponse(this.notes.filter((n) => n.project_id === projectId));
  }

  async listAllNotes(): Promise<ApiResponse<Note[]>> {
    await delay();
    requireAuth();
    return wrapResponse([...this.notes]);
  }

  async getNote(id: string): Promise<ApiResponse<Note>> {
    await delay();
    requireAuth();
    const note = this.notes.find((n) => n.id === id);
    if (!note) throwError('NOT_FOUND', '笔记不存在');
    return wrapResponse(note);
  }

  async createNote(
    projectId: string,
    data: { title: string; content: string }
  ): Promise<ApiResponse<Note>> {
    await delay();
    requireAuth();
    const now = new Date().toISOString();
    const note: Note = {
      id: newId('n'),
      project_id: projectId,
      title: data.title,
      content: data.content,
      created_at: now,
      updated_at: now,
    };
    this.notes.push(note);
    const project = this.projects.find((p) => p.id === projectId);
    this.prependActivity({
      type: 'note',
      title: `创建笔记「${data.title}」`,
      description: project?.name ?? '项目笔记',
      project_id: projectId,
    });
    return wrapResponse(note);
  }

  async updateNote(
    id: string,
    data: Partial<Note>
  ): Promise<ApiResponse<Note>> {
    await delay();
    requireAuth();
    const idx = this.notes.findIndex((n) => n.id === id);
    if (idx < 0) throwError('NOT_FOUND', '笔记不存在');
    const existing = this.notes[idx];
    if (!existing) throwError('NOT_FOUND', '笔记不存在');
    const updated: Note = {
      ...existing,
      ...data,
      id: existing.id,
      updated_at: new Date().toISOString(),
    };
    this.notes[idx] = updated;
    const project = this.projects.find((p) => p.id === updated.project_id);
    this.prependActivity({
      type: 'note',
      title: `更新笔记「${updated.title}」`,
      description: project?.name ?? '项目笔记',
      project_id: updated.project_id,
    });
    return wrapResponse(updated);
  }

  async deleteNote(id: string): Promise<ApiResponse<{ success: boolean }>> {
    await delay();
    requireAuth();
    this.notes = this.notes.filter((n) => n.id !== id);
    return wrapResponse({ success: true });
  }

  // ─── Graph ────────────────────────────────────────────

  async getGraph(params?: {
    min_similarity?: number;
    max_edges?: number;
  }): Promise<ApiResponse<GraphData>> {
    await delay(300);
    requireAuth();
    const minSim = params?.min_similarity ?? 0.1;
    const maxEdges = params?.max_edges ?? 500;
    const nodeIds = new Set(this.projects.map((p) => p.id));
    const nodes = MOCK_GRAPH.nodes.filter((n) => nodeIds.has(n.id));
    let edges = MOCK_GRAPH.edges.filter(
      (e) =>
        nodeIds.has(e.source) &&
        nodeIds.has(e.target) &&
        e.similarity >= minSim
    );
    edges = edges.slice(0, maxEdges);
    return wrapResponse({ nodes, edges });
  }

  // ─── Settings ─────────────────────────────────────────

  async getSettings(): Promise<ApiResponse<Settings>> {
    await delay();
    requireAuth();
    return wrapResponse({ ...this.settings });
  }

  async updateSettings(data: Partial<Settings>): Promise<ApiResponse<Settings>> {
    await delay();
    requireAuth();
    this.settings = { ...this.settings, ...data };
    return wrapResponse({ ...this.settings });
  }

  async testLLM(): Promise<
    ApiResponse<{ success: boolean; latency_ms: number; model: string }>
  > {
    await delay(800);
    requireAuth();
    const latency = 350 + Math.floor(Math.random() * 200);
    this.settings.llm_last_test = new Date().toISOString();
    this.settings.llm_latency_ms = latency;
    this.settings.llm_configured = true;
    return wrapResponse({
      success: true,
      latency_ms: latency,
      model: this.settings.llm_model,
    });
  }

  // ─── Overview 扩展 ────────────────────────────────────

  async listTrending(params?: {
    period?: TrendingPeriod;
    language?: string;
  }): Promise<ApiResponse<TrendingRepo[]>> {
    await delay();
    requireAuth();
    const repos = getTrendingRepos(params?.period ?? 'daily', params?.language);
    if (params?.period === 'weekly' && this.scenarioTrendingWeekly) {
      return wrapResponse([...this.scenarioTrendingWeekly]);
    }
    return wrapResponse(repos);
  }

  async *streamTrendingScoutIntro(
    params: TrendingScoutIntroParams,
  ): AsyncGenerator<SSEEvent> {
    requireAuth();
    const period = params.period ?? 'weekly';
    const repos = getTrendingRepos(period);
    const repo: TrendingRepo =
      repos.find((r) => r.owner === params.owner && r.repo === params.repo) ?? {
        owner: params.owner,
        repo: params.repo,
        url: `https://github.com/${params.owner}/${params.repo}`,
        stars: 0,
      };
    yield* mockTrendingScoutIntro(repo, period);
  }

  async listActivities(): Promise<ApiResponse<ActivityItem[]>> {
    await delay();
    requireAuth();
    return wrapResponse([...this.activities]);
  }

  async listRecommendedProjects(params?: {
    limit?: number;
  }): Promise<ApiResponse<RecommendedProject[]>> {
    await delay();
    requireAuth();
    const limit = params?.limit ?? 5;
    if (this.scenarioRecommendations) {
      return wrapResponse(this.scenarioRecommendations.slice(0, limit));
    }
    return wrapResponse(buildMockRecommendedProjects(this.projects, limit));
  }

  async listOverviewRecentNotes(params?: {
    limit?: number;
  }): Promise<ApiResponse<OverviewRecentNote[]>> {
    await delay();
    requireAuth();
    const limit = params?.limit ?? 4;
    const projectNameById = new Map(this.projects.map((p) => [p.id, p.name]));
    const items: OverviewRecentNote[] = [...this.notes]
      .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))
      .slice(0, limit)
      .map((n) => ({
        id: n.id,
        project_id: n.project_id,
        project_name: projectNameById.get(n.project_id) ?? n.project_id,
        title: n.title,
        updated_at: n.updated_at,
      }));
    return wrapResponse(items);
  }

  // ─── Agent ────────────────────────────────────────────

  async listAgentSessions(): Promise<ApiResponse<AgentSession[]>> {
    await delay();
    requireAuth();
    return wrapResponse([...this.sessions]);
  }

  async getAgentSession(
    id: string
  ): Promise<ApiResponse<AgentSession & { messages: AgentMessage[] }>> {
    await delay();
    requireAuth();
    const session = this.sessions.find((s) => s.id === id);
    if (!session) throwError('NOT_FOUND', '会话不存在');
    const msgs = this.messages[id] ?? [];
    return wrapResponse({ ...session, messages: [...msgs] });
  }

  async createAgentSession(): Promise<ApiResponse<AgentSession>> {
    await delay();
    requireAuth();
    const session: AgentSession = {
      id: newId('sess'),
      title: '新对话',
      agent: 'hub',
      updated_at: new Date().toISOString(),
      unread: false,
    };
    this.sessions.unshift(session);
    this.messages[session.id] = [];
    return wrapResponse(session);
  }

  async deleteAgentSession(id: string): Promise<ApiResponse<{ success: boolean }>> {
    await delay();
    requireAuth();
    this.sessions = this.sessions.filter((s) => s.id !== id);
    delete this.messages[id];
    return wrapResponse({ success: true });
  }

  async getAgentProfiles(): Promise<ApiResponse<AgentProfile[]>> {
    await delay();
    requireAuth();
    return wrapResponse([...MOCK_AGENT_PROFILES]);
  }

  async getUserProfile(): Promise<ApiResponse<UserProfile>> {
    await delay();
    requireAuth();
    return wrapResponse(clone(this.userProfile));
  }

  async updateUserProfile(
    data: Partial<UserProfile>
  ): Promise<ApiResponse<UserProfile>> {
    await delay();
    requireAuth();
    this.userProfile = { ...this.userProfile, ...data };
    if (data.memory_items) {
      this.userProfile.memory_items = data.memory_items;
    }
    if (data.goals) {
      this.userProfile.goals = data.goals;
    }
    return wrapResponse(clone(this.userProfile));
  }

  async getPermissions(): Promise<ApiResponse<AgentPermissions>> {
    await delay();
    requireAuth();
    return wrapResponse({
      allow_web_search: true,
      allow_github_api: true,
      allow_file_write: false,
      max_iterations: 10,
      max_tokens_per_turn: 4096,
    });
  }

  async *chatAgent(sessionId: string, message: string): AsyncGenerator<SSEEvent> {
    requireAuth();
    const session = this.sessions.find((s) => s.id === sessionId);
    if (!session) {
      yield { event: 'error', data: { code: 'NOT_FOUND', message: '会话不存在' } };
      return;
    }

    const userMsg: AgentMessage = {
      id: newId('msg'),
      session_id: sessionId,
      agent: session.agent,
      role: 'user',
      content: message,
      created_at: new Date().toISOString(),
    };
    const msgs = this.messages[sessionId] ?? [];
    msgs.push(userMsg);
    this.messages[sessionId] = msgs;
    session.updated_at = new Date().toISOString();
    if (session.title === '新对话') {
      session.title = message.slice(0, 30);
    }

    const scenario = selectChatScenario(message);
    yield* scenario();
  }

  async *answerQuestion(
    _sessionId: string,
    _questionId: string,
    _answers: QuestionAnswer[]
  ): AsyncGenerator<SSEEvent> {
    requireAuth();
    yield* mockAfterQuestionAnswer();
  }

  async *analyzeProject(
    projectId: string,
    agent?: AgentId
  ): AsyncGenerator<SSEEvent> {
    requireAuth();
    const project = this.projects.find((p) => p.id === projectId);
    const name = project?.name ?? projectId;
    yield* mockProjectAnalysis(name, agent ?? 'scout');
  }

  async getContextWindow(
    sessionId?: string | null
  ): Promise<ApiResponse<ContextWindowStats>> {
    await delay(100);
    requireAuth();
    const msgs = sessionId ? (this.messages[sessionId] ?? []) : [];
    const msgTokens = msgs.reduce((n, m) => n + (m.content?.length ?? 0) / 4, 0);
    return wrapResponse({
      session_id: sessionId ?? null,
      model: this.settings.llm_model,
      context_limit: 128000,
      input_tokens: Math.round(2400 + msgTokens),
      output_tokens: Math.round(1800 + msgTokens * 0.3),
      total_tokens: Math.round(4200 + msgTokens * 1.3),
      segments: [
        { label: '系统提示词', tokens: 820, kind: 'system' },
        { label: 'Agent Skills', tokens: 640, kind: 'skill' },
        { label: '记忆摘要', tokens: 380, kind: 'memory' },
        { label: '工具定义', tokens: 290, kind: 'tools' },
        { label: '对话消息', tokens: Math.round(1270 + msgTokens), kind: 'messages' },
      ],
    });
  }

  async searchGithubRepos(query: string): Promise<ApiResponse<StarRepo[]>> {
    await delay(300);
    requireAuth();
    const q = query.toLowerCase().trim();
    const pool: StarRepo[] = [
      ...MOCK_UNIMPORTED_STARS.map((s) => ({ ...s, already_imported: false })),
      ...this.projects.map((p) => {
        const [owner, repo] = p.name.split('/');
        return {
          owner: owner ?? 'unknown',
          repo: repo ?? p.name,
          url: p.url,
          description: p.description,
          language: p.language,
          stars: p.stars,
          already_imported: true,
        };
      }),
    ];
    const filtered = q
      ? pool.filter(
          (s) =>
            `${s.owner}/${s.repo}`.toLowerCase().includes(q) ||
            (s.description?.toLowerCase().includes(q) ?? false)
        )
      : pool.slice(0, 12);
    return wrapResponse(filtered.slice(0, 20));
  }

  async *importAssistChat(
    message: string,
    context: ImportAssistContext
  ): AsyncGenerator<SSEEvent> {
    requireAuth();
    const lower = message.toLowerCase();
    const keys = context.available_repo_keys ?? [];
    const picks = keys.filter((k) => {
      if (lower.includes('python') || lower.includes('后端')) {
        return /flask|fastapi|django|python/i.test(k);
      }
      if (lower.includes('react') || lower.includes('前端')) {
        return /react|vue|vite|next/i.test(k);
      }
      if (lower.includes('ai') || lower.includes('机器学习')) {
        return /langchain|pytorch|transformers|openai/i.test(k);
      }
      return false;
    });
    const reply =
      picks.length > 0
        ? `根据你的描述，我建议导入：\n\n${picks.map((p) => `- **${p}**`).join('\n')}\n\n你可以在左侧勾选后确认导入。`
        : `我理解你想导入与「${message}」相关的项目。请尝试描述技术栈或场景（如「Python Web」「React 生态」），我会从列表中推荐匹配项。`;
    for (const ch of reply) {
      yield { event: 'text_delta', data: { content: ch } };
      await delay(8);
    }
    yield {
      event: 'done',
      data: { usage: { tokens: reply.length }, iterations: 1 },
    };
  }

  async *graphGuideChat(
    message: string,
    context?: { selected_node_id?: string | null }
  ): AsyncGenerator<SSEEvent> {
    requireAuth();
    const nodeId = context?.selected_node_id;
    const project = nodeId ? this.projects.find((p) => p.id === nodeId) : undefined;
    const reply = project
      ? `**${project.name}** 在图谱中与相邻节点通过 TF-IDF 相似度连接。双击节点可跳转详情；当前相似边表示技术栈或 README 文本接近。\n\n你问：${message}`
      : `我是 **Atlas · 图谱向导**，专门解读项目关系网络。\n\n- 节点颜色 = 分类\n- 边粗细 ≈ 相似度\n- 点击节点查看详情\n\n你问：${message}`;
    for (const ch of reply) {
      yield { event: 'text_delta', data: { content: ch } };
      await delay(6);
    }
    yield {
      event: 'done',
      data: { usage: { tokens: reply.length }, iterations: 1 },
    };
  }
}
