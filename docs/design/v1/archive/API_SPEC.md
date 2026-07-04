# RepoPilot 前端 · API 接口规范

> 版本: 1.0.0 · 2026-07-04 · 状态: 与后端对齐用
> 权威来源: `docs/product/v1/SPEC/TECHNICAL_SPEC.md §3` · `docs/product/v1/MVP/MVP_SCOPE.md §4.1`
> 本文档是前端 `api-mock.js` 与后端 FastAPI 实现的**对接契约**

---

## 1. 通用规范

### 1.1 Base URL
- 开发: `http://localhost:19876/api/v1`
- 生产: `http://127.0.0.1:19876/api/v1`（pywebview 桌面端）

### 1.2 认证
- 除登录/注册外，所有端点需要 JWT Token
- Header: `Authorization: Bearer <access_token>`
- 401 自动刷新 refresh_token（前端 ApiClient 拦截器处理）

### 1.3 统一响应格式（成功）
```json
{ "data": { ... }, "meta": { "ts": 1720123456789 } }
```

### 1.4 统一响应格式（错误）
```json
{
  "error": {
    "code": "PROJECT_NOT_FOUND",
    "message": "用户友好消息",
    "details": []
  }
}
```

### 1.5 速率限制
| 端点类型 | 限制 |
|---------|------|
| 通用 | 60 次/分钟/user |
| Auth（登录/注册）| 5 次/分钟/IP |
| Agent | 20 次/分钟/user |
| LLM 测试 | 5 次/分钟/user |

### 1.6 字段命名
- 时间字段: ISO 8601 字符串（`2026-07-04T14:23:00Z`）
- 枚举值小写：`progress` 字段值 `none` / `learning` / `learned` / `mastered`

---

## 2. 端点清单（v1.0 全部实现）

### 2.1 Auth · `/api/v1/auth`

| 方法 | 路径 | 说明 | 限流 |
|------|------|------|------|
| POST | `/register` | 注册 | 5/min/IP |
| POST | `/login` | 登录 | 5/min/IP |
| POST | `/refresh` | 刷新 token | 30/min/user |
| POST | `/logout` | 注销（清空 refresh_token） | - |
| GET  | `/me` | 当前用户信息 | - |
| PUT  | `/me` | 更新用户（仅 avatar_url） | - |
| PUT  | `/password` | 修改密码（清空所有 refresh_token） | - |

**Request - register**
```json
{
  "username": "zhang.jie",
  "password": "demo1234"
}
```

**Response**
```json
{
  "data": {
    "access_token": "eyJhbGc...",
    "refresh_token": "rt_...",
    "user": { "id": "uuid", "username": "zhang.jie" }
  }
}
```

### 2.2 GitHub · `/api/v1/github`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | `/accounts` | 列出绑定的 GitHub 账号 |
| POST | `/accounts` | 绑定 GitHub（PAT 加密存储） |
| DELETE | `/accounts/{id}` | 解绑 |
| GET  | `/stars` | 拉取当前用户 Star 列表（需 PAT） |
| GET  | `/stars/{username}` | 拉取指定用户公开 Star |

### 2.3 Projects · `/api/v1/projects`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | `/` | 列表（支持 search, category, language, progress, tag, sort_by, page, page_size） |
| GET  | `/{id}` | 详情（含 README, 标签, 笔记列表摘要） |
| POST | `/` | 创建（URL 必须 `https://github.com/{owner}/{repo}`） |
| POST | `/import` | 批量导入（单次 ≤ 500） |
| PUT  | `/{id}` | 更新（id/user_id/url/created_at 不可改） |
| DELETE | `/{id}` | 删除（级联 notes, tags, analyses） |
| PUT  | `/{id}/progress` | 更新学习进度 |
| GET  | `/stats` | 统计（按 progress / category / language 聚合） |
| GET  | `/export` | 导出全部（JSON） |

**Progress 枚举**：`none` · `learning` · `learned` · `mastered`

### 2.4 Categories · `/api/v1/categories`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | `/` | 列出（合并预设 + 自定义） |
| POST | `/` | 新建（`is_preset: false`） |
| PUT  | `/{id}` | 更新（仅自定义可改） |
| DELETE | `/{id}` | 删除（项目 category_id 置 NULL） |

### 2.5 Tags · `/api/v1/tags`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | `/tags` | 列出（含关联项目数） |
| POST | `/tags` | 新建（1-64 字符） |
| DELETE | `/tags/{id}` | 删除（级联 project_tags） |
| PUT  | `/projects/{id}/tags` | 设置项目标签（多对多全量替换） |

### 2.6 Notes · `/api/v1/notes`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | `/projects/{project_id}/notes` | 项目笔记列表（按 updated_at 降序） |
| POST | `/projects/{project_id}/notes` | 创建笔记 |
| GET  | `/{id}` | 笔记详情 |
| PUT  | `/{id}` | 更新笔记 |
| DELETE | `/{id}` | 删除笔记 |
| GET  | `/search` | 跨项目搜索（v1.0 LIKE，v1.1 全文搜索） |

**Response shape**
```json
{
  "data": {
    "id": "n_xxx",
    "project_id": "p_xxx",
    "title": "React Hooks 深度理解",
    "content": "# React Hooks\n\n...",
    "created_at": "2026-06-15T14:30:00Z",
    "updated_at": "2026-07-01T10:20:00Z"
  }
}
```

### 2.7 Graph · `/api/v1/graph`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | `/` | 图谱数据（nodes + edges） |

**Query**: `min_similarity`（默认 0.1） · `max_edges`（默认 500）

**Response**
```json
{
  "data": {
    "nodes": [
      { "id": "p_xxx", "name": "facebook/react", "language": "JavaScript", "stars": 220000, "category_id": "cat_xxx" }
    ],
    "edges": [
      { "source": "p_xxx", "target": "p_yyy", "similarity": 0.92 }
    ]
  }
}
```

### 2.8 Settings · `/api/v1/settings`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | `/` | 获取（api_key 脱敏为 `sk-****xxxx`） |
| PUT  | `/` | 更新（部分字段） |
| POST | `/test-llm` | 测试 LLM 连通性（5/min/user） |

### 2.9 Agent · `/api/v1/agent`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/chat` | 发送消息（SSE 流式响应）|
| POST | `/question` | 提交反问答案（SSE）|
| POST | `/analyze/{project_id}` | 分析项目（Scout / Mentor）|
| POST | `/compare` | 对比项目（Mentor）|
| POST | `/classify` | 建议分类（Curator）|
| POST | `/recommend` | 推荐项目（Navigator）|
| POST | `/note/generate` | 生成笔记大纲（Scribe）|
| GET  | `/sessions` | 会话列表 |
| GET  | `/sessions/{id}` | 会话详情 + 历史 |
| PUT  | `/sessions/{id}` | 更新（重命名）|
| DELETE | `/sessions/{id}` | 删除会话 |
| POST | `/sessions/{id}/archive` | 归档 |
| GET  | `/config` | Agent 全局配置 |
| PUT  | `/config` | 更新配置 |
| POST | `/config/test` | 测试 LLM（5/min/user）|
| GET  | `/permissions` | Agent 权限配置 |
| PUT  | `/permissions` | 更新权限 |
| GET  | `/profiles` | 所有 Agent 定义 |
| GET  | `/profiles/{agent_id}` | 单个 Agent 完整配置 |
| PUT  | `/profiles/{agent_id}/soul` | 更新 SOUL.md |
| PUT  | `/profiles/{agent_id}/agent` | 更新 AGENT.md |
| GET  | `/user-profile` | 当前用户画像 |
| PUT  | `/user-profile` | 更新用户画像 |

**SSE Event Types**
```
event: text_delta
data: { "delta": "..." }

event: tool_call
data: { "name": "query_user_projects", "args": {...}, "result": "..." }

event: agent_question
data: { "question_id": "q_001", "questions": [...] }

event: done
data: {}
```

---

## 3. 前端 ApiClient 实现位置

前端所有 API 调用封装在 `assets/api-mock.js`，对应类 `ApiClient`。

**核心方法清单**（后端需一一实现同名方法）：

```javascript
class ApiClient {
  // Auth
  register({ username, password })
  login({ username, password })
  logout()
  refresh()
  me()
  updateProfile(data)
  changePassword({ old_password, new_password })

  // GitHub
  listGithubAccounts()
  bindGithub({ username, pat })
  unbindGithub(id)
  listStars(username?)
  importProjects(repos)

  // Projects
  listProjects(params)
  getProject(id)
  createProject(data)
  updateProject(id, data)
  deleteProject(id)
  updateProgress(id, progress)
  getProjectStats()
  exportProjects()

  // Categories
  listCategories()
  createCategory(data)
  updateCategory(id, data)
  deleteCategory(id)

  // Tags
  listTags()
  createTag(data)
  deleteTag(id)
  setProjectTags(projectId, tagIds)

  // Notes
  listNotes(projectId)
  listAllNotes()
  getNote(id)
  createNote(projectId, data)
  updateNote(id, data)
  deleteNote(id)

  // Graph
  getGraph(params)

  // Settings
  getSettings()
  updateSettings(data)
  testLLM()

  // Agent
  listAgentSessions()
  getAgentSession(id)
  createAgentSession()
  deleteAgentSession(id)
  getAgentProfiles()
  getUserProfile()
  updateUserProfile(data)
  getPermissions()
  analyze(projectId, agent)  // 返回 AsyncGenerator<SSEEvent>
}
```

**前端切换为真实后端**：将 `assets/api-mock.js` 替换为 `assets/api-client.js`，使用 `fetch` 实现同名方法（保持路径 + payload 与 mock 一致即可）。

---

## 4. 数据模型（核心字段）

### 4.1 User
```typescript
interface User {
  id: string;             // UUID
  username: string;       // 3-32 字符
  email?: string;
  avatar_url?: string;
  github_login?: string;
  github_bound: boolean;
  created_at: string;     // ISO 8601
}
```

### 4.2 Project
```typescript
interface Project {
  id: string;
  name: string;           // "facebook/react"
  url: string;            // 必须 https://github.com/{owner}/{repo}
  description?: string;
  language?: string;
  stars: number;
  category_id?: string;
  progress: 'none' | 'learning' | 'learned' | 'mastered';
  tags: string[];         // tag_id[]
  source: 'github' | 'manual';
  imported_at: string;
  readme?: string;        // Markdown 全文
  readme_fetched_at?: string;
}
```

### 4.3 Note
```typescript
interface Note {
  id: string;
  project_id: string;
  title: string;
  content: string;        // Markdown
  created_at: string;
  updated_at: string;
}
```

### 4.4 AgentMessage（SSE 流）
```typescript
interface AgentMessage {
  id: string;
  session_id: string;
  agent: 'hub' | 'scout' | 'mentor' | 'navigator' | 'curator' | 'scribe';
  role: 'user' | 'assistant' | 'tool' | 'system';
  content?: string;
  tool_call?: { name: string; args: any; result?: any };
  question?: AgentQuestion;
  created_at: string;
}

interface AgentQuestion {
  question_id: string;
  questions: QuestionItem[];
  allow_skip: boolean;
}

type QuestionItem =
  | { id: string; text: string; type: 'radio'; options: { value: string; label: string; description?: string }[]; allow_other?: boolean }
  | { id: string; text: string; type: 'checkbox'; options: { value: string; text: string }[] }
  | { id: string; text: string; type: 'slider'; min: number; max: number; labels?: Record<string, string> }
  | { id: string; text: string; type: 'drag_sort'; items: string[] }
  | { id: string; text: string; type: 'knowledge_map'; tree: KnowledgeNode[] };
```

### 4.5 QuestionAnswer（前端提交）
```typescript
type QuestionAnswer =
  | { type: 'radio'; value: string; other_text?: string }
  | { type: 'checkbox'; values: string[] }
  | { type: 'slider'; value: number }
  | { type: 'drag_sort'; order: string[] }
  | { type: 'knowledge_map'; checked: string[] };
```

---

## 5. 前端 Mock → 后端切换流程

### 5.1 当前状态
- `assets/api-mock.js` 提供全部 mock 数据
- 前端通过 `window.ApiClient` 调用
- **无需修改任何业务代码**即可对接真实后端

### 5.2 对接步骤
1. 后端按本文档 §2 + §3 实现所有端点
2. 创建 `assets/api-client.js`：

```javascript
class ApiClient {
  constructor() {
    this.baseURL = 'http://localhost:19876/api/v1';
    this.token = localStorage.getItem('rp_token');
  }

  async _fetch(path, options = {}) {
    const res = await fetch(this.baseURL + path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        ...options.headers
      }
    });
    const json = await res.json();
    if (!res.ok) throw json.error;
    return json;
  }

  async login({ username, password }) {
    const r = await this._fetch('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    this.token = r.data.access_token;
    localStorage.setItem('rp_token', this.token);
    localStorage.setItem('rp_refresh', r.data.refresh_token);
    return r;
  }
  // ... 其余方法实现，路径与 §3 一致
}
```

3. 在 `app.html` 中将 `<script src="assets/api-mock.js"></script>` 改为 `<script src="assets/api-client.js"></script>`
4. 完成。前端业务代码（Vue 组件、路由、状态）无需任何修改

---

## 6. 验证清单

后端实现完成后，按以下清单验证：

- [ ] 所有 §2 端点都已实现
- [ ] 响应格式符合 §1.3 / §1.4
- [ ] 401 时自动 refresh
- [ ] CORS 允许 `http://localhost:*` 和 `http://127.0.0.1:*`
- [ ] 项目 URL 严格校验为 `https://github.com/{owner}/{repo}`
- [ ] 密码强度校验（≥ 8 字符 + 字母数字）
- [ ] 修改密码清空所有 refresh_token
- [ ] SSE 流式输出符合 §2.9 event types
- [ ] 反问 5 种类型全部支持
- [ ] 速率限制按 §1.5 实现
- [ ] API Key 脱敏返回
- [ ] 错误码覆盖 `docs/product/v1/MVP/MVP_SCOPE.md §6.5` ERROR_CODES