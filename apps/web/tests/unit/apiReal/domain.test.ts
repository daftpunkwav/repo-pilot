/**
 * api/real 拆分后回归测试 — 验证 §4.2.17
 *   1. RealApiClient 仍是 IApiClient 的合法实现(类型层 + 实例化层)
 *   2. 7 个子域字段类型正确
 *   3. 委托方法能正确转发到 domain 子类(fetch mocked)
 *
 * 注:RealApiClient 的 65 个委托方法与 this.{auth,projects,...} 的方法
 * 不是同一 function 引用(委托被以方法简写定义在自身,会生成新的 method),
 * 但行为完全等价 — 这里用 spy 验证调用真实穿越。
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IApiClient } from '@/api/client';
import { RealApiClient } from '@/api/real';
import type { AgentApi } from '@/api/real/domain/agent';
import type { AuthApi } from '@/api/real/domain/auth';
import type { GraphApi } from '@/api/real/domain/graph';
import type { NotesApi } from '@/api/real/domain/notes';
import type { OverviewApi } from '@/api/real/domain/overview';
import type { ProjectsApi } from '@/api/real/domain/projects';
import type { SettingsApi } from '@/api/real/domain/settings';

function okJson<T>(body: T): Response {
  return new Response(JSON.stringify({ data: body, meta: { ts: 1 } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('RealApiClient domain split (§4.2.17)', () => {
  it('implements IApiClient', () => {
    // 类型层:这行编译通过 = implements 完整,否则 TS 报错
    const client: IApiClient = new RealApiClient();
    expect(client).toBeInstanceOf(RealApiClient);
  });

  it('exposes seven domain sub-clients with concrete types', () => {
    const client = new RealApiClient();
    const _auth: AuthApi = client.auth;
    const _projects: ProjectsApi = client.projects;
    const _notes: NotesApi = client.notes;
    const _graph: GraphApi = client.graph;
    const _settings: SettingsApi = client.settings;
    const _overview: OverviewApi = client.overview;
    const _agent: AgentApi = client.agent;
    expect(_auth).toBe(client.auth);
    expect(_projects).toBe(client.projects);
    expect(_notes).toBe(client.notes);
    expect(_graph).toBe(client.graph);
    expect(_settings).toBe(client.settings);
    expect(_overview).toBe(client.overview);
    expect(_agent).toBe(client.agent);
  });

  it('exposes all 65 IApiClient methods as functions', () => {
    const client = new RealApiClient();
    const methodNames: (keyof IApiClient)[] = [
      'register', 'login', 'logout', 'refresh', 'me', 'updateProfile', 'changePassword',
      'listGithubAccounts', 'bindGithub', 'unbindGithub', 'listStars',
      'importProjects', 'listProjects', 'getProject', 'getProjectReadme',
      'createProject', 'updateProject', 'deleteProject', 'updateProgress',
      'getProjectStats', 'exportProjects',
      'listCategories', 'createCategory', 'updateCategory', 'deleteCategory',
      'listTags', 'createTag', 'deleteTag', 'setProjectTags',
      'listNotes', 'listAllNotes', 'getNote', 'createNote', 'updateNote', 'deleteNote',
      'getGraph', 'searchGithubRepos',
      'getSettings', 'updateSettings', 'saveLlmApiKey', 'testLLM',
      'listTrending', 'streamTrendingScoutIntro', 'listActivities',
      'listRecommendedProjects', 'listOverviewRecentNotes',
      'listAgentSessions', 'getAgentSession', 'createAgentSession',
      'deleteAgentSession', 'updateAgentSession', 'getAgentProfiles',
      'chatAgent', 'answerQuestion', 'analyzeProject', 'generateNote',
      'getContextWindow', 'importAssistChat', 'graphGuideChat',
      'getUserProfile', 'updateUserProfile', 'clearUserMemory',
      'acceptMemoryProposal', 'rejectMemoryProposal', 'getPermissions',
    ];
    expect(methodNames.length).toBe(65);
    for (const name of methodNames) {
      const fn = (client as unknown as Record<string, unknown>)[name as string];
      expect(typeof fn).toBe('function');
    }
  });

  it('委托 login 路径正确(请求到 /auth/login + POST + body)', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(okJson({ access_token: 't', token_type: 'bearer' })));
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    try {
      const client = new RealApiClient();
      await client.login({ username: 'alice', password: 'pw' });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/auth/login');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual({ username: 'alice', password: 'pw' });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('委托对底层 Api 子类的相同方法穿透调用(spy 验证)', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(okJson({ access_token: 't', token_type: 'bearer' })));
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    try {
      const client = new RealApiClient();
      const spy = vi.spyOn(client.auth, 'login');
      await client.login({ username: 'a', password: 'b' });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith({ username: 'a', password: 'b' });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('委托 listProjects 路径与查询参数正确', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(okJson({ items: [], total: 0, page: 1, page_size: 10 })));
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    try {
      const client = new RealApiClient();
      await client.listProjects({ search: 'demo', language: 'TypeScript' });
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/projects/');
      expect(url).toContain('search=demo');
      expect(url).toContain('language=TypeScript');
      // GET 请求时 fetch 默认 method 为 undefined,不显式设置
      expect(init.method === undefined || (init.method as string).toUpperCase() === 'GET').toBe(true);
      expect(init.body).toBeUndefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('委托 getAgentSession 走 AgentApi 且自动透传 fetch', async () => {
    const detailData = {
      id: 7,
      agent: 'hub',
      title: 'demo',
      project_id: null,
      project_ids: [],
      source: 'chat',
      messages: [],
    };
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(okJson(detailData)));
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    try {
      const client = new RealApiClient();
      const res = await client.getAgentSession('7');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).toContain('/agent/sessions/7');
      // 内部已对 id 做 Number → String 规整
      expect(typeof res.data.id).toBe('string');
      expect(res.data.id).toBe('7');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
});
