# RepoPilot 前端 API 交接契约（v1）

本文档描述 `docs/design/v1/frontend` 与后端对接的接口约定。前端通过 `IApiClient`（`src/api/client.ts`）统一访问，Mock 与真实实现须保持相同签名与响应结构。

## 通用约定

- **认证**：除 `login` / `register` 外均需 `Authorization: Bearer <access_token>`
- **响应包装**：`{ data: T, meta: { ts, page?, page_size?, total? } }`
- **错误**：`{ error: { code, message, details? } }`
- **SSE**：`event` + `data` JSON，类型见 `SSEEventType`

## 核心模块

| 模块 | 主要方法 | 说明 |
|------|----------|------|
| Auth | `login`, `register`, `me`, `logout` | 会话与用户信息 |
| Projects | `listProjects`, `getProject`, `importProjects`, `updateProgress` | 项目库 CRUD 与进度 |
| Notes | `listNotes`, `listAllNotes`, `createNote`, `updateNote` | 笔记 |
| Graph | `getGraph` | 节点 + 边（相似度） |
| Agent | `listAgentSessions`, `chatAgent`, `answerQuestion` | 多 Agent 对话 |
| Profile | `getUserProfile`, `updateUserProfile` | 用户画像与记忆 |
| Settings | `getSettings`, `updateSettings`, `testLLM` | 外观与 LLM |

## 新增 / 扩展接口（本次 UI 依赖）

### 1. 上下文窗口统计

```
GET /api/agent/context-window?session_id={id}
→ ContextWindowStats
```

```ts
interface ContextWindowStats {
  session_id: string | null;
  model: string;
  context_limit: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  segments: Array<{
    label: string;
    tokens: number;
    kind: 'system' | 'skill' | 'memory' | 'tools' | 'messages' | 'other';
  }>;
}
```

**用途**：Agent 页右侧栏底部展示 token 用量与窗口组成（系统提示词、Skills、记忆等）。

### 2. 用户记忆条目（Agent 维护）

`UserProfile` 扩展字段：

```ts
interface MemoryItem {
  id: string;
  category: 'summary' | 'goal' | 'tech' | 'preference';
  content: string;
  created_at: string;
  updated_at?: string;
}

interface UserProfile {
  // ...existing
  memory_items?: MemoryItem[];
  goals: Goal[];
}
```

- **读**：`GET /api/user/profile`
- **写**：`PATCH /api/user/profile`（前端可增删 `memory_items` / `goals`；长期由 Agent 工具自动维护）
- **掌握程度**：来自 `Project.progress`（`none` | `learning` | `learned` | `mastered`），Agent 根据对话/笔记调用 `updateProgress` 更新

### 3. GitHub 仓库搜索（导入弹窗）

```
GET /api/github/search?q={query}
→ StarRepo[]
```

与 `listStars` 结构一致，含 `already_imported` 标记。

### 4. 导入助手对话（SSE）

```
POST /api/import/assist
Body: { message: string, context: ImportAssistContext }
→ SSE stream (text_delta, done)
```

```ts
interface ImportAssistContext {
  mode: 'stars' | 'urls' | 'search';
  available_repo_keys?: string[];
  selected_repo_keys?: string[];
}
```

**用途**：GitHub 同步 / 导入项目弹窗右侧 Agent，根据自然语言推荐仓库（前端左侧勾选后调用 `importProjects`）。

### 5. 图谱向导 Atlas（SSE）

```
POST /api/graph/guide
Body: { message: string, selected_node_id?: string }
→ SSE stream
```

**用途**：图谱页右侧专用单 Agent（Atlas），解读节点关系与相似度。与主 Agent 会话隔离。

### 6. 批量 URL 导入

```
POST /api/projects/import
Body: { repos: [{ owner, repo, url }] }
```

前端粘贴多行 URL 时，**后端负责解析行数、去重、校验**；响应 `ImportResult.summary` 人类可读摘要。

### 7. 总览页（Overview）

| 方法 | 建议 REST | 说明 |
|------|-----------|------|
| `getProjectStats()` | `GET /api/projects/stats` | 进度/分类/语言聚合 |
| `getUserProfile()` | `GET /api/user/profile` | `history_summary` 由 Mentor Agent 定时/事件生成（Markdown 纯文本） |
| `listActivities()` | `GET /api/overview/activities` | 用户事件流，按 `created_at` 降序 |
| `listRecommendedProjects({ limit })` | `GET /api/overview/recommendations?limit=5` | Agent 推荐；**刷新策略由后端控制**（cron/事件），响应含 `meta.generated_at` |
| `listOverviewRecentNotes({ limit })` | `GET /api/overview/recent-notes?limit=4` | 最近笔记 + `project_name` |
| `listTrending({ period, language? })` | `GET /api/overview/trending?period=weekly` | GitHub 热门代理 |
| `streamTrendingScoutIntro(params)` | `POST /api/overview/trending/scout-intro` SSE | Scout 悬停介绍；需 per-user 限流 |

```ts
interface RecommendedProject {
  id: string;
  project_id: string;
  name: string;
  reason: string;           // Agent 生成
  recommended_by: AgentId;
  // 后端扩展建议：
  generated_at?: string;
}

interface TrendingScoutIntroParams {
  owner: string;
  repo: string;
  period?: 'daily' | 'weekly' | 'monthly';
}
```

**缓存策略（前端）**：用户 mutation（import / note / progress）后 invalidate 总览 query；**推荐列表不由用户手动刷新**，后端重算后前端 refetch 即可。

## 页面与接口映射

| 页面 | 关键接口 |
|------|----------|
| 总览 | `getProjectStats`, `getUserProfile`, `listActivities`, `listRecommendedProjects`, `listOverviewRecentNotes`, `listTrending`, `streamTrendingScoutIntro` |
| 设置 | `getSettings`, `updateSettings`, `bindGithub` |
| Agent Chat | `chatAgent`, `getContextWindow`, `getUserProfile`, `updateUserProfile` |
| 图谱 | `getGraph`, `graphGuideChat` |
| 项目库 · 同步 | `listStars`, `importProjects`, `importAssistChat` |
| 项目库 · 导入 | `searchGithubRepos`, `importProjects`, `importAssistChat` |

## Mock 开关

- 开发默认：`VITE_USE_MOCK=true`
- 生产对接：实现 `IApiClient` 的 HTTP 版本并设置 `VITE_USE_MOCK=false`

## 安全说明

- API Key 仅通过 `updateSettings` 提交，前端只展示 `llm_api_key_masked`
- PAT / Token 不得写入 localStorage 明文（Mock 仅演示）
- 所有写操作应幂等或有明确错误码（如 `ALREADY_EXISTS`）
