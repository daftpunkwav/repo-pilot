# RepoPilot v1.0 — MVP 实施规格

> 版本: 1.0.0 | 日期: 2026-07-03 | 路径更新: 2026-07-05 | 状态: 审核通过 - daftpunkwav（**本文档部分具体声明已随代码迭代过期，正在与代码对齐**）
> 权威来源: `v1/PRD/PRD.md` (产品需求) · `v1/SPEC/TECHNICAL_SPEC.md` (技术规格)
> 本文档定义 **v1.0 单版本发布** 的实施范围。所有设计细节以 PRD 和 SPEC 为准，本文档仅标注裁剪决策和扩展预留。
>
> ⚠️ **代码实际状态：** 根 `package.json` 与 `apps/web/package.json` 版本为 **v2.0.0**；`services/api/backend/` 与 `apps/web/src/` 已实现 v1.0 大部分核心功能，但部分数据模型、端点、缓存策略与本文档原规划不一致。下文已用标注说明差异。
>
> **仓库布局：** Monorepo。文中 `backend/`、`frontend/` 对照 [`docs/architecture/PATH_MAPPING.md`](../../architecture/PATH_MAPPING.md)。UI Mock 阶段以 `docs/design/v1/frontend/` 为准。

---

## 1. v1.0 定位

v1.0 是 RepoPilot 的**首个完整交付版本**，采用单版本发布策略（不再细分 v0.1~v0.6 子版本，详见 PRD §7.1）。

**v1.0 交付目标：** 让用户能够导入 GitHub Star 项目、手动管理项目库、使用关键词规则分类、查看项目关系图谱、撰写 Markdown 笔记，并通过 **7 个 Agent**（Hub + Scout / Mentor / Navigator / Curator / Scribe / Atlas）实现深度学习、对比、规划、分类、笔记辅助、图谱解读等高级能力。

**v1.0 的成功标准：** 一个开发者可以在 10 分钟内完成"注册 → 绑定 GitHub → 导入 Star → 浏览图谱 → 为某个项目写笔记 → 用 Scout 快速概览某个项目"的完整流程；配置 LLM API Key 后可与 Agent 对话。

---

## 2. 功能范围清单

### 2.1 纳入 MVP 的功能

| 模块 | 功能 | PRD 章节 | 实现深度 |
|------|------|----------|---------|
| **用户系统** | 注册/登录 (用户名+密码) | §3.1 P0 | 完整实现，JWT 认证，access_token 15min + refresh_token 7d |
| **用户系统** | 修改密码 | §3.1 P0 | 完整实现，旧密码验证 |
| **用户系统** | 保持登录 | §3.1 P0 | refresh_token 自动续期 |
| **用户系统** | 绑定 GitHub | §3.1 P0 | 仅手动绑定 (填写 GitHub 用户名 + Personal Access Token)，不做 OAuth |
| **项目管理** | 手动添加项目 | §3.2 P0 | 完整实现 CRUD |
| **项目管理** | 编辑/删除项目 | §3.2 P0 | 完整实现 |
| **项目管理** | GitHub Star 批量导入 | §3.2 P0 | 完整实现，调用 GitHub API 拉取 Star 列表 |
| **项目管理** | 项目搜索 | §3.2 P0 | 按名称模糊搜索 |
| **项目管理** | 筛选/排序 | §3.2 P0 | 按分类、语言、Star 数、学习进度筛选 |
| **分类系统** | 预设分类 | §3.5 P0 | 实际内置 **5 个**预设分类：`前端、后端、AI/ML、DevOps、其他`；更细粒度分类尚未实现 |
| **分类系统** | 自定义分类 | §3.5 P0 | 用户可增/删/改分类 |
| **分类系统** | 多标签 | §3.5 P0 | 项目可打多个标签，标签可增/删 |
| **分类系统** | 关键词规则分类 | §3.3.7 降级 | 基于项目 `language` 的降级规则匹配（导入时按语言归入预设分类）；Curator Agent 可进一步提供分类建议 |
| **笔记系统** | Markdown 笔记 | §3.4 P0 | 每个项目支持创建多篇笔记 |
| **笔记系统** | MD 实时预览 | §3.4 P0 | 使用 react-markdown + remark-gfm，支持代码高亮 |
| **可视化** | 项目关系图谱 | §3.6 P0 | 基于 TF-IDF 相似度的力导向图，支持缩放/拖拽/节点点击 |
| **设置** | 主题切换 | §3.1 P1 | 深色/浅色/跟随系统 |
| **设置** | 字体缩放 | §3.1 P1 | font_scale 0.8–1.5 |
| **设置** | LLM 配置 (BYOK) | SPEC §5.2 | 配置 UI 完整，含 `test_connection()`，v1.0 阶段 `complete()` 已可用（v0.x 预留，v1.0 启用） |
| **Agent 系统** | Hub 路由 | §3.3 P0 | 统一对话入口，意图分类，多 Agent 派发 |
| **Agent 系统** | Scout 快速分析 | §3.3 P0 | 30s 给出项目速览（README + GitHub metadata） |
| **Agent 系统** | Mentor 深度讲解 | §3.3 P0 | 反问机制 + 多层讲解（全景/模块/设计模式/知识关联） |
| **Agent 系统** | Navigator 学习规划 | §3.3 P0 | 基于用户画像 + 项目库生成学习路径 |
| **Agent 系统** | Curator 智能分类 | §3.3 P0 | 关键词规则降级 → v1.0 升级为 LLM 建议分类 |
| **Agent 系统** | Scribe 笔记助手 | §3.3 P0 | 笔记大纲生成、补充、总结 |
| **Agent 系统** | Atlas 图谱向导 | §3.3 P0 | 解读知识图谱节点关系、建议探索路径 |
| **Agent 系统** | 反问面板 | SPEC §8 P0 | 单选/多选/滑动/拖拽/知识地图 5 种反问类型 |
| **Agent 系统** | 流式输出 (SSE) | §3.3 P0 | 全部 Agent 使用 SSE 流式输出 |
| **Agent 系统** | 记忆系统 | §3.3 P0 | UserProfile（技术掌握/学习偏好/目标）+ 会话历史压缩 |

### 2.2 不纳入 v1.0 的功能（推迟到 v1.1+）

> **注:** 由于 v1.0 是单版本完整发布，**所有 P0/P1 功能都在 v1.0 范围内**。本节仅列出推迟到 v1.1+ 的 P2/未来扩展功能。

| 模块 | 功能 | PRD 章节 | 推迟理由 | 计划版本 |
|------|------|----------|---------|---------|
| 用户系统 | 文件上传头像 | §3.1 P1 | v1.0 仅支持 URL 头像（GitHub 头像 URL），文件上传需配合存储/安全策略 | v1.1 |
| 用户系统 | OAuth GitHub 绑定 | §3.1 P0 | OAuth 流程复杂，v1.0 使用 PAT 手动绑定（已在 v1.0 范围） | v1.1 |
| 项目管理 | JSON 导入/导出 | §3.2 P1 | 批量数据迁移，非核心使用流程；**`GET /export` 尚未实现** | v1.1 |
| 项目管理 | 列表/卡片双视图 | §3.2 P1 | v1.0 只实现列表视图 | v1.1 |
| 笔记系统 | 笔记搜索 | §3.4 P1 | v1.0 暂用 LIKE 搜索，v1.1 升级全文搜索 | v1.1 |
| 笔记系统 | 笔记导出 | §3.4 P2 | 导出为 PDF/Markdown | v1.1 |
| 可视化 | 分类统计图 | §3.6 P1 | StatsPage 路由预留 | v1.2 |
| 可视化 | 学习进度看板 | §3.6 P2 | 时间线视图 | v1.2 |
| 可视化 | 时间线 | §3.6 P2 | 项目导入和学习的时间线视图 | v1.2 |
| Agent 高级 | 多 Agent 并行协作 | AGENT_PRD §2.2 | v1.0 同时一个 Agent 对话，后台可并行预分析 | v1.3 |
| Agent 高级 | 主动学习用户画像 | AGENT_PRD §3.2 | v1.0 被动收集，v1.3 主动学习 | v1.3 |
| 生态 | Web 端独立部署 | §4.3 | v1.0 仅桌面端 | v1.4 |
| 生态 | 移动端适配 | §4.3 | v1.0 仅桌面端，最小宽度 900px | v1.4 |
| 生态 | Skill/插件市场 | §6.3 | 用户自定义 Agent 配置市场 | v1.4 |
| 生态 | MCP 集成 | §6.1 | GitHub MCP、文档 MCP、代码执行 MCP | v1.4 |
| 生态 | 即时通讯集成 | §6.2 | 飞书/微信/Telegram/Discord 推送 | v1.4+ |

---

## 3. 数据模型实施范围

**权威定义：** SPEC §2。所有表的字段、类型、约束以 SPEC 为准。

### 3.1 v1.0 建表清单

> **与代码实际的对齐说明：** 以下列出的是当前代码中真实存在的模型/表。原 SPEC 中规划的独立 `user_github_accounts`、`user_settings`、`graph_cache` 表目前并未独立建表，相关数据以 JSON 字段或运行时计算方式存在。

| 表名 | 建表 | v1.0 写入 | 说明 |
|------|------|---------|------|
| `users` | ✅ | ✅ | 完整实现；GitHub 账号信息 (`github_accounts`) 和用户设置 (`settings_json`) 以 JSON 字段存储 |
| `refresh_tokens` | ✅ | ✅ | 完整实现（SPEC §10.1），存 JWT refresh_token 的 SHA256 哈希，7 天过期，注销/改密时清空 |
| `projects` | ✅ | ✅ | 完整实现；`note` 字段仍保留在模型中，但当前 UI 使用独立 `notes` 表管理笔记 |
| `tags` | ✅ | ✅ | 完整实现（独立 CRUD 端点见 §4.1 Tags 节） |
| `project_tags` | ✅ | ✅ | 完整实现 |
| `categories` | ✅ | ✅ | 完整实现，含 5 个预设分类种子（见附录 B） |
| `notes` | ✅ | ✅ | 完整实现 |
| `user_profiles` | ✅ | ✅ | 完整实现并写入（v1.0 启用记忆系统） |
| `agent_sessions` | ✅ | ✅ | 完整实现，7 个 Agent 共用 sessions 表 |
| `agent_messages` | ✅ | ✅ | 完整实现，SSE 流式消息持久化 |
| `project_analyses` | ✅ | ✅ | 完整实现，Scout/Mentor 分析结果缓存 |
| `user_github_accounts` | ⬜ | ⬜ | **尚未独立建表**；当前 GitHub 账号以 `users.github_accounts` JSON 字段存储（v1.1+ 可按 SPEC 拆出） |
| `user_settings` | ⬜ | ⬜ | **尚未独立建表**；当前设置以 `users.settings_json` JSON 字段存储（v1.1+ 可按 SPEC 拆出） |
| `graph_cache` | ⬜ | ⬜ | **尚未建表**；当前图谱由 `graph_service.py` 实时计算，无持久化缓存 |

### 3.2 user_settings 表 LLM 字段

> **当前实现：** 独立的 `user_settings` 表尚未创建，以下字段实际存储在 `users.settings_json` JSON 字段中。

SPEC §2.2 UserSetting 表已定义 `llm_provider`、`llm_model`、`llm_api_base`、`encrypted_api_key` 四个字段。MVP 实现约束：

- `encrypted_api_key` 的加密密钥从 OS 密钥链获取 (Windows Credential Manager / macOS Keychain)，不可用时退化为 PBKDF2(machine_id + user_salt)。实现见 SPEC §5.2 SecureKeyStore。
- Settings UI 提供 BYOK 配置面板，用户可填写 provider/model/api_key/api_base 并测试连通性。

### 3.3 user_github_accounts 表（独立表，决策 N-S-04）

> **当前实现：** 独立的 `user_github_accounts` 表尚未创建，GitHub PAT 仍加密存储在 `users.github_accounts` JSON 字段中。

GitHub PAT 不再存储在 `users.github_accounts` JSON 字段，而是独立的 `user_github_accounts` 表。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK | 账号 ID |
| user_id | UUID | FK → users, NOT NULL | 所属用户 |
| username | VARCHAR(64) | NOT NULL | GitHub 用户名 |
| encrypted_pat | BLOB | NOT NULL | Fernet 加密后的 PAT |
| added_at | TIMESTAMP | DEFAULT NOW | 添加时间 |
| last_used_at | TIMESTAMP | NULLABLE | 最后使用时间 |

**v1.0 阶段：** 限制每个用户最多绑定 1 个 GitHub 账号（v1.1+ 扩展为多账号）。

**删除 `users.github_accounts` JSON 字段。**

---

## 4. API 端点实施范围

**权威定义：** SPEC §3。统一前缀 `/api/v1/`，统一响应格式 `{ "data": ..., "meta": {...} }`。

### 4.1 v1.0 实现的端点

#### Auth (`/api/v1/auth`)

| 方法 | 路径 | 说明 | 验收标准 |
|------|------|------|---------|
| POST | /register | 注册 | 返回 JWT，**用户名 3-32 字符**、**密码 ≥ 8 字符且同时包含字母和数字**（N-S-05） |
| POST | /login | 登录 | 返回 access_token + refresh_token，速率限制 5 次/分钟/IP（N-S-03） |
| POST | /refresh | 刷新 Token | 接收 refresh_token，返回新 access_token，速率限制 30 次/分钟/user |
| POST | /logout | 注销 | 删除当前用户所有 refresh_token（S-02 / N-S-02 补全） |
| GET | /me | 获取当前用户 | 返回用户信息 (不含密码) |
| PUT | /me | 更新用户信息 | MVP 阶段仅支持更新 `avatar_url`（URL 格式校验），文件上传推迟到 v1.1（N-S-01） |
| PUT | /password | 修改密码 | 验证旧密码 → 设置新密码 → **删除该用户所有 refresh_token 使其失效**（N-S-02） |

#### GitHub (`/api/v1/github`)

| 方法 | 路径 | 说明 | 验收标准 |
|------|------|------|---------|
| GET | /stars | 获取当前用户 Star 列表 | 使用绑定账号的 PAT 调用 GitHub API，支持分页 |
| GET | /stars/{username} | 获取指定用户 Star 列表 | URL 参数，公开 API（无需 PAT） |
| GET | /accounts | 列出已绑定的 GitHub 账号 | 返回当前用户的所有绑定记录（决策 D-16） |
| POST | /accounts | 绑定 GitHub (PAT) | 加密存储 PAT，验证连通性（v1.0 限 1 个账号） |
| DELETE | /accounts/{id} | 解绑 GitHub | 删除绑定记录 |

#### Projects (`/api/v1/projects`)

| 方法 | 路径 | 说明 | 验收标准 |
|------|------|------|---------|
| GET | / | 项目列表 | 支持 search（匹配 name + description）、category、language、progress、tag、sort_by、sort_order、page、page_size 参数 |
| POST | / | 添加项目 | 校验 URL 格式（**必须 https://github.com/{owner}/{repo}**，N-S-06），UNIQUE(user_id, url) 约束 |
| POST | /import | 批量导入 | 接收 GitHub repo 列表，**单次最多 500 条**（D-18 统一），返回成功/失败计数（响应结构见下） |
| GET | /{id} | 项目详情 | 含分类、标签、笔记列表；README 通过 `GET /{id}/readme` 按需从 GitHub 拉取，不在 `projects` 表中持久化 |
| PUT | /{id} | 更新项目 | 支持部分更新 name、description、category_id、tags（**不可更新** id、user_id、url、created_at、updated_at） |
| DELETE | /{id} | 删除项目 | 级联删除 notes、project_tags、project_analyses |
| PUT | /{id}/progress | 更新进度 | 枚举值: none / learning / learned / mastered，**默认值 'none'**（D-19） |
| GET | /stats | 项目统计 | 返回分类分布、语言分布、进度分布的聚合数据 |
| GET | /export | 导出所有项目 (JSON) | **尚未实现**（v1.1+ 规划） |
| GET | /{project_id}/notes | 获取项目笔记 | **实际路径为 `/api/v1/notes/projects/{project_id}/notes`**，按 updated_at 降序 |
| POST | /{project_id}/notes | 创建笔记 | **实际路径为 `/api/v1/notes/projects/{project_id}/notes`**；标题必填，content 默认空 |

**`POST /import` 响应结构（D-26 补全）：**

```json
{
  "data": {
    "succeeded": [{"id": "uuid", "name": "owner/repo", "url": "https://github.com/owner/repo"}],
    "failed": [{"url": "https://github.com/owner/repo", "reason": "DUPLICATE_URL"}],
    "summary": {"total": 100, "succeeded": 95, "failed": 5}
  },
  "meta": {}
}
```

#### Categories (`/api/v1/categories`)

| 方法 | 路径 | 说明 | 验收标准 |
|------|------|------|---------|
| GET | / | 获取所有分类 | 合并预设 + 用户自定义，预设分类 `is_preset=true` |
| POST | / | 添加自定义分类 | UNIQUE(user_id, name) 约束 |
| PUT | /{id} | 更新分类 | 仅自定义分类可修改 |
| DELETE | /{id} | 删除分类 | 仅自定义分类可删除；删除时将关联项目的 category_id 置为 NULL |

#### Tags (`/api/v1/tags`) — 新增（决策 D-15）

| 方法 | 路径 | 说明 | 验收标准 |
|------|------|------|---------|
| GET | /tags | 列出当前用户所有标签 | 含每个标签关联的项目数 |
| POST | /tags | 新建标签 | UNIQUE(user_id, name) 约束，name 1-64 字符 |
| DELETE | /tags/{id} | 删除标签 | 级联删除 project_tags 关联 |
| PUT | /projects/{id}/tags | 设置项目标签（多对多） | 接收 `{"tag_ids": ["uuid1", "uuid2"]}` 全量替换 |

#### Notes (`/api/v1/notes`)

> **路径归属说明（决策 R-22）：** 项目作用域的笔记端点（`GET/POST /projects/{project_id}/notes`）已移至上方 **Projects** 节，避免完整路径 `/api/v1/notes/projects/{project_id}/notes` 中出现双重 `notes` 的歧义。本节仅保留对笔记实体的直接操作。

| 方法 | 路径 | 说明 | 验收标准 |
|------|------|------|---------|
| GET | /{id} | 笔记详情 | 含完整 Markdown content（**修正路径冲突 N-04**：原 `/notes/notes/{id}` 修正为 `/{id}`） |
| PUT | /{id} | 更新笔记 | 支持部分更新 title / content |
| DELETE | /{id} | 删除笔记 | 物理删除 |
| GET | /search | 跨项目搜索笔记 | **尚未实现**（v1.1+ 规划全文搜索） |

#### Graph (`/api/v1/graph`)

| 方法 | 路径 | 说明 | 验收标准 |
|------|------|------|---------|
| GET | / | 图谱数据 | 返回 nodes (项目) + edges (TF-IDF 相似度 > 阈值)，支持 `min_similarity`（默认 0.1）和 `max_edges`（默认 500，N-P-01）参数 |

#### Settings (`/api/v1/settings`)

| 方法 | 路径 | 说明 | 验收标准 |
|------|------|------|---------|
| GET | / | 获取用户设置 | 含主题、缩放、LLM 配置 (api_key 脱敏为 `sk-****xxxx`) |
| PUT | / | 更新设置 | 支持部分更新 |
| POST | /test-llm | 测试 LLM 连通性 | 发送最小请求验证 Key 有效（速率限制 5 次/分钟/user） |

> **路径说明（N-05 补全）：** v1.0 阶段 LLM 测试端点为 `/api/v1/settings/test-llm`。SPEC §3.2 同时定义了 `/api/v1/agent/config/test`（v1.0 完整版启用）。两路径在 v1.0 都可用，settings/test-llm 作为简化的"仅测试连接"端点，agent/config/test 作为完整的 Agent 配置测试端点。

#### Agent (`/api/v1/agent`)

v1.0 范围内已实现以下端点；带 **×** 的端点在原规划中列出，但当前代码尚未实现：

| 方法 | 路径 | 说明 | 状态 |
|------|------|------|------|
| POST | /chat | 发送消息，SSE 流式响应 | ✅ 已实现（`POST /sessions/{id}/chat` 为推荐入口） |
| POST | /question | 提交反问答案，恢复对话 (SSE) | ✅ 已实现 |
| POST | /analyze/{project_id} | 分析指定项目（Scout / Mentor 入口） | ✅ 已实现 |
| POST | /compare | 对比多个项目（Mentor） | **× 尚未实现** |
| POST | /classify | 为项目建议分类（Curator） | ✅ 已实现 |
| POST | /recommend | 推荐相关开源项目（Navigator） | **× 尚未实现** |
| POST | /note/generate | 为项目生成笔记大纲（Scribe） | ✅ 已实现 |
| POST | /import-assist | 导入助手（Curator） | ✅ 已实现 |
| POST | /graph-guide | 图谱向导（Atlas） | ✅ 已实现 |
| POST | /trending-scout | GitHub Trending 速览（Scout） | ✅ 已实现 |
| GET | /context-window | 获取当前会话上下文窗口统计 | ✅ 已实现 |
| GET | /sessions | 会话列表 | ✅ 已实现 |
| POST | /sessions | 创建会话 | ✅ 已实现 |
| GET | /sessions/{id} | 会话详情 + 消息历史 | ✅ 已实现 |
| PATCH | /sessions/{id} | 更新会话（重命名 / 绑定项目 / 切换活跃 Agent） | ✅ 已实现 |
| DELETE | /sessions/{id} | 删除会话 | ✅ 已实现 |
| POST | /sessions/{id}/archive | 归档会话 | **× 尚未实现** |
| GET | /config | 获取 Agent 全局配置 | **× 尚未实现** |
| PUT | /config | 更新 Agent 全局配置 | **× 尚未实现** |
| POST | /config/test | 测试 LLM 连通性 | **× 尚未实现**（LLM 测试使用 `/api/v1/settings/test-llm`） |
| GET | /permissions | 获取 Agent 权限配置 | ✅ 已实现 |
| PATCH | /permissions | 更新 Agent 权限配置 | ✅ 已实现 |
| GET | /profiles | 获取所有 Agent 定义 | ✅ 已实现 |
| GET | /profiles/{agent_id} | 获取单个 Agent 完整配置 | **× 尚未实现** |
| PUT | /profiles/{agent_id}/soul | 更新 Agent 性格 (SOUL.md) | **× 尚未实现** |
| PUT | /profiles/{agent_id}/agent | 更新 Agent 行为规范 (AGENT.md) | **× 尚未实现** |
| GET | /user-profile | 获取当前用户画像 | **× 尚未实现**（用户画像使用 `/api/v1/user/profile`） |
| PUT | /user-profile | 更新用户画像 | **× 尚未实现**（用户画像使用 `PATCH /api/v1/user/profile`） |

### 4.2 501 占位与未实现端点

v1.0 原计划是单版本完整发布，但实际开发中部分端点尚未实现（见 §4.1 中 **×** 标记）。这些端点目前不存在或返回 501/404，计划在 v1.1+ 补全。

---

## 5. 前端页面实施范围

**权威定义：** SPEC §12。主题系统、组件规范以 SPEC 为准。

### 5.1 MVP 实现的页面

> **前端 Mock 分步开发文档：** `docs/design/v1/process/README.md`（2026-07-05 更新：总览与项目库分离，新增笔记页与个人资料页）

| 路由 | 页面 | 实现要求 |
|------|------|---------|
| /login | LoginPage | 用户名+密码表单，表单校验，错误提示，登录成功跳转 |
| /register | RegisterPage | 注册表单，密码强度提示（≥ 8 字符 + 字母数字），注册成功自动登录 |
| / | OverviewPage | **总览页**：产品简介、库统计、学习进度分布、最近活动、GitHub 热门项目（Mock）、快捷入口（导入/项目库/图谱/Agent） |
| /projects | ProjectsPage | **项目库**：表格视图（v1.0 不做卡片双视图，见 §2.2），搜索栏，筛选 (分类/语言/进度/标签)，分页；**导入：① GitHub Star 抽屉（已绑定 GitHub 时）② URL 批量粘贴 Modal**（D-14）；无独立导入路由 |
| /projects/:id | ProjectDetailPage | 项目基础信息卡片，README 查看器（通过 `/api/v1/projects/{id}/readme` 按需拉取，详见 §8.4），笔记面板 (列表+编辑器+预览)，学习进度选择器，**Scout 快速分析按钮** |
| /graph | GraphPage | D3.js 力导向图，节点可点击跳转详情，支持缩放/拖拽/搜索高亮 |
| /notes | NotesPage | 跨项目笔记列表 + 搜索（v1.0 客户端过滤）+ 编辑/预览 |
| /settings | SettingsPage | **应用设置**：主题、字体缩放 (0.8–1.5)、GitHub 绑定、LLM BYOK、数据导出 |
| /profile | ProfilePage | **个人资料**（Topbar 入口）：头像 URL、用户 ID（只读）、改密、账号信息展示 |
| /agent | AgentPage | Agent 对话页面（v1.0 已实现核心版，含反问面板、SSE 流式渲染、7 个 Agent 切换），见 AGENT_SPEC §8 |

### 5.2 v1.0 不实现的页面（推迟到 v1.1+）

| 路由 | 页面 | 计划版本 |
|------|------|---------|
| /stats | StatsPage (统计看板) | v1.2 |
| /timeline | TimelinePage (时间线) | v1.2 |
| /agent/marketplace | SkillMarketplace (插件市场) | v1.4 |

### 5.3 布局结构

```
┌──────────────────────────────────────────────────┐
│ Sidebar (固定 240px)                               │
│  Logo + 项目名                                     │
│  ────────────                                     │
│  总览         (/)                                 │
│  项目库       (/projects)                          │
│  Agent Chat   (/agent)                            │
│  图谱         (/graph)                            │
│  笔记         (/notes)                            │
│  设置         (/settings)                         │
│  ────────────                                     │
│  [Stats]     (灰色禁用态，tooltip: "v1.2 推出")       │
├──────────────────────────────────────────────────┤
│ Main Content Area                                │
│  ┌─ Topbar ──────────────────────────────────┐   │
│  │ 面包屑 / 用户头像+下拉 (个人资料/设置/登出)   │   │
│  └────────────────────────────────────────────┘   │
│  ┌─ Page Content ────────────────────────────┐   │
│  │                                           │   │
│  │ (根据路由渲染对应页面)                         │   │
│  │                                           │   │
│  └────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────┘
```

---

## 6. 工程规范

### 6.1 代码规范

| 层面 | 规范 | 工具 |
|------|------|------|
| 后端 Python | PEP 8 + type hints，所有函数需 docstring | Ruff (lint + format) |
| 前端 TypeScript | strict 模式，禁止 any，Props 用 interface | ESLint + Prettier |
| API 文档 | FastAPI 自动 OpenAPI，每个端点需 summary + description | FastAPI 内置 |
| Git | Conventional Commits (feat/fix/docs/refactor/test/chore) | commitlint |
| 注释语言 | 中文 (遵循项目 AGENTS.md 约定) | — |

### 6.2 测试规范

| 类型 | 覆盖范围 | 最低覆盖率 | 框架 |
|------|---------|-----------|------|
| 单元测试 | Service 层核心逻辑 | 70% | pytest + pytest-asyncio |
| 单元测试 | 前端工具函数 + Store | 60% | Vitest |
| 集成测试 | API 端点 (含数据库) | 所有 MVP 端点 | pytest + httpx TestClient |
| E2E 测试 | 核心用户流程 (注册→导入→图谱→笔记→Agent 对话) | 5 条 happy path | Playwright |

### 6.3 数据库迁移

> **当前实现：** Alembic 已列在依赖中，但尚未启用。当前使用 SQLAlchemy `metadata.create_all()` + `services/api/backend/migrations/schema_sync.py` 进行列补齐，无 `alembic/versions/` 迁移文件。

使用 Alembic 管理 Schema 迁移。MVP 为初始迁移 (migration `001_initial`)，包含所有 §3.1 中"建表"的表。Agent 相关表（agent_sessions / agent_messages / project_analyses / user_profiles）在 v1.0 完整写入（§3.1 已标记 ✅），初始迁移必须包含全部表结构。

### 6.4 配置管理

后端配置使用 pydantic-settings，支持环境变量和 `.env` 文件：

```python
class Settings(BaseSettings):
    # 应用
    app_name: str = "RepoPilot"
    debug: bool = False
    api_prefix: str = "/api/v1"

    # 数据库
    database_url: str = "sqlite+aiosqlite:///./repopilot.db"

    # JWT
    jwt_secret_key: str  # 必填，从环境变量读取（决策 S-02 补全：≥ 32 字节 / 256-bit，启动时校验 len ≥ 32）

    @field_validator("jwt_secret_key")
    @classmethod
    def validate_jwt_secret(cls, v: str) -> str:
        """强制 JWT 密钥长度 ≥ 32 字节（决策 S-02 补全）"""
        if len(v) < 32:
            raise ValueError("jwt_secret_key 必须 ≥ 32 字节（256-bit），请设置更强的密钥")
        return v
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # GitHub
    github_api_timeout: int = 10  # 秒

    # LLM 全局默认值（v1.0 完整启用，BYOK 用户配置优先，此为用户未配置时的回退值）
    llm_default_provider: str = "openai"
    llm_default_model: str = "gpt-4o"

    # 文件存储
    storage_dir: str = "./data"

    class Config:
        env_file = ".env"
```

### 6.5 错误处理规范

后端统一异常处理，所有错误返回一致的 JSON 结构：

```python
# 业务异常 — 预期内的错误
class AppException(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400, details: list | None = None):
        ...

# 预定义错误码
ERROR_CODES = {
    "AUTH_INVALID_CREDENTIALS": "用户名或密码错误",
    "AUTH_TOKEN_EXPIRED": "Token 已过期",
    "AUTH_TOKEN_INVALID": "Token 无效",
    "AUTH_WEAK_PASSWORD": "密码必须至少 8 字符且同时包含字母和数字",
    "AUTH_USERNAME_LENGTH": "用户名长度必须在 3-32 字符之间",
    "PROJECT_NOT_FOUND": "项目不存在",
    "PROJECT_DUPLICATE_URL": "该项目 URL 已存在",
    "PROJECT_INVALID_URL": "URL 格式无效，必须为 https://github.com/{owner}/{repo}",
    "CATEGORY_NOT_FOUND": "分类不存在",
    "CATEGORY_NAME_EXISTS": "分类名称已存在",
    "CATEGORY_PRESET_READONLY": "预设分类不可修改",
    "TAG_NOT_FOUND": "标签不存在",
    "TAG_NAME_EXISTS": "标签名称已存在",
    "NOTE_NOT_FOUND": "笔记不存在",
    "GITHUB_API_ERROR": "GitHub API 调用失败",
    "GITHUB_NOT_BOUND": "未绑定 GitHub 账号",
    "GITHUB_RATE_LIMIT": "GitHub API 速率限制，请稍后重试",
    "LLM_NOT_CONFIGURED": "未配置 LLM API Key",
    "LLM_CONNECTION_FAILED": "LLM API 连接失败",
    "RATE_LIMIT_EXCEEDED": "请求过于频繁，请稍后重试",
    "VALIDATION_ERROR": "输入校验失败",
    "INTERNAL_ERROR": "服务暂时不可用，请稍后重试",
}
```

**响应格式（N-S-08 补全）：**

- 成功响应：`{ "data": {...}, "meta": {...} }`
- 错误响应：`{ "error": { "code": "ERROR_CODE", "message": "用户友好消息", "details": [...] } }`
- **后端捕获所有第三方 API 异常**（GitHub、LLM 等），记录完整堆栈到日志，但**响应只返回友好错误消息**，不暴露堆栈、时间戳、路径、内部状态
- 内部错误（如数据库连接失败）返回通用消息 "服务暂时不可用，请稍后重试"
- `details` 字段用于表单校验场景（如 Pydantic 校验失败的字段列表），不包含敏感信息

**日志脱敏（N-S-09 补全）：**

所有日志输出必须经过 `LogSanitizer` 中间件，禁止记录完整的：

- API Key（OpenAI `sk-...`、Anthropic `ant-...` 等）
- GitHub PAT（`ghp_...`、`github_pat_...` 等）
- 密码、JWT Token、refresh_token
- 用户邮箱（脱敏为 `u***@example.com`）

脱敏规则：保留前 4 + 后 4 字符，中间用 `****` 替代。

### 6.6 前端状态管理规范

| Store | 职责 | MVP 实现 |
|-------|------|---------|
| `authStore` | 用户认证状态、Token 管理 | ✅ 完整实现 |
| `projectStore` | 项目列表、筛选、CRUD 操作 | ✅ 完整实现 |
| `uiStore` | 主题、侧边栏状态、全局 UI 状态 | ✅ 完整实现 |
| `agentStore` | Agent 对话状态 (SPEC §12.4) | ✅ 完整实现（与 §7.2、§10 一致） |

---

## 7. 扩展预留清单（v1.0 → v1.4+）

> **与代码实际的对齐说明：** AgentRegistry、ToolRegistry、MemoryService、ReActEngine、HubService、SSE 流式输出、反问交互等核心模块已在 `services/api/backend/` 实现，但实现形态与 SPEC 中的目录/工具命名存在差异（如 Agent 配置集中在 `registry.py`，工具清单见 `tools/builtin.py`）。NotificationService / MCPToolAdapter 抽象接口尚未实现。

### 7.1 v1.0 必须实现的接口（v1.0 范围，非预留）

| 接口 | 实现要求 | 验证方式 |
|------|---------|---------|
| **LLMProvider** | 完整实现 `complete()` 和 `test_connection()`，v1.0 启用 LiteLLM（决策 D-11：v1.0 完整实现含 `complete()`） | 单元测试覆盖 `complete()` 的 mock 调用，集成测试覆盖 `test_connection()` |
| **AgentRegistry** | `AgentDefinition` 与 `AgentRegistry` 已在 `services/api/backend/agents/registry.py` 实现，注册 **7 个 Agent**（含 Atlas）。SPEC 中按子目录 + AGENT.md/SOUL.md/system_prompt.j2/config.yaml 组织的文件结构尚未落地 | AgentRegistry 单元测试覆盖 7 个 Agent 加载 |
| **ToolRegistry** | `ToolDefinition` 与 `ToolRegistry` 已在 `services/api/backend/tools/registry.py` 实现。当前 `tools/builtin.py` 注册了 **15 个内置工具**，名称与 §7.4 的工具清单不完全一致（如 `fetch_github_repo`、`fetch_readme`、`select_import_repos` 等） | 单元测试覆盖注册和执行 |
| **CapabilityDetector** | SPEC §5.3 中的独立 `CapabilityDetector` 尚未实现；当前 `has_llm` 能力判断由 `backend/llm/config.py` 中的 `build_llm_config_from_user()` 完成 | 单元/集成测试覆盖有/无 Key 两种场景 |
| **MemoryService** | 完整实现 `get_user_profile()`、`save_session()`、`recall()` 等 | 集成测试覆盖用户画像读写 |
| **ReActEngine** | 完整实现 AGENT_SPEC §4.1 的 ReAct 执行循环（§4.4 为无 Function Calling 降级模式） | 单元测试覆盖单步推理 + 工具调用 |
| **HubService** | 完整实现 Hub 路由 + IntentClassifier | 集成测试覆盖意图分类 |
| **SSE 流式输出** | 完整实现 Agent 对话 SSE 端点 | E2E 测试覆盖流式渲染 |
| **反问交互** | 完整实现 5 种反问类型（radio/checkbox/slider/drag_sort/knowledge_map） | E2E 测试覆盖反问提交流程 |
| **NotificationService 抽象接口** | 定义抽象基类（v1.0 不实现具体适配器，推迟到 v1.4） | 类型检查通过 |
| **MCPToolAdapter 抽象接口** | 定义抽象基类（v1.0 不实现具体 MCP 服务器连接，推迟到 v1.4） | 类型检查通过 |

### 7.2 v1.0 前端必须实现的接口

| 预留项 | 具体要求 | 验证方式 |
|--------|---------|---------|
| **Agent 类型定义** | 在 `src/types/agent.ts` 中完整定义 AgentQuestion、QuestionItem、QuestionAnswer 等所有 TypeScript 接口（**含判别字段 `type`，决策 T-01**） | TypeScript 编译通过 |
| **agentStore** | 完整实现 SPEC §12.4 的 `AgentState` interface 和所有 actions | TypeScript 编译通过 |
| **AgentPage 完整实现** | 含 ChatPanel、MessageBubble、QuestionRenderer（5 种反问组件）、SSE 流处理 | E2E 测试覆盖完整对话流程 |
| **LLM 配置面板** | Settings 页面中完整实现 LLM 配置表单 (provider/model/key/base/test) | E2E 测试覆盖配置保存流程 |

### 7.3 v1.1+ 推迟实现（非 v1.0 范围）

| 接口 | 推迟原因 | 计划版本 |
|------|---------|---------|
| NotificationService 具体实现（飞书/微信/Telegram/Discord 适配器） | 推送服务需要外部账号配置 | v1.4+ |
| MCPToolAdapter 具体实现（GitHub MCP、文档 MCP、代码执行 MCP） | MCP 生态尚未成熟 | v1.4+ |
| Skill/插件市场 | 需要审核、签名、版本管理等复杂机制 | v1.4 |
| 移动端适配 | v1.0 仅桌面端 | v1.4 |
| Web 端独立部署 | 桌面壳架构改动大 | v1.4 |

### 7.4 工具注册清单（v1.0 规划清单）

> **当前实现：** 实际注册的工具见 `services/api/backend/tools/builtin.py`，共 15 个，命名与权限白名单与本表存在差异（例如 `read_readme` 实际为 `fetch_readme`，`search_web` 尚未实现等）。本表保留为规划参考。

| 工具名 | 用途 | 允许 Agent |
|--------|------|-----------|
| `read_readme` | 读取项目 README | Scout, Mentor |
| `read_source_file` | 读取 GitHub 仓库文件 | Mentor |
| `search_web` | 搜索互联网 | 所有 |
| `query_user_projects` | 查询用户项目库 | Scout, Mentor, Navigator, Curator, Scribe, Hub（**Scribe 已添加，决策 N-10**） |
| `get_project_analysis` | 获取缓存分析结果 | Hub, Mentor |
| `get_user_profile` | 读取用户画像（技术水平、偏好、目标） | Mentor, Navigator |
| `update_user_profile` | 更新用户画像 | Mentor, Navigator |
| `suggest_classification` | 建议分类 | Curator |
| `generate_note_outline` | 生成笔记大纲 | Scribe |
| `compare_projects` | 对比项目 | Mentor |
| `build_learning_path` | 构建学习路径 | Navigator |
| `ask_user_question` | 反问交互 | Mentor, Navigator |
| `save_to_memory` | 存储记忆 | 所有 |
| `recall_from_memory` | 检索记忆 | 所有 |

---

## 8. 关键工程约束

### 8.1 分类规则的降级设计

MVP 的分类降级规则当前按项目 `language` 映射到 5 个预设分类（见 `services/api/backend/services/project_service.py`）。这是 Curator Agent 的降级方案 (PRD §3.3.7)。实现时必须保证：

1. 规则定义为声明式数据结构 (字典/列表)，不是硬编码的 if-else，方便后续替换为 AI 分类
2. 规则匹配函数签名与未来 Curator Agent 的分类接口一致：`async def classify(project: Project) -> ClassifyResult`
3. `ClassifyResult` 包含 `category` (分类名)、`confidence` (置信度 0-1)、`tags` (建议标签列表)、`source` ("rule" / "ai")
4. **当前实现仅按 `language` 匹配，未使用 `topics` 与 `name` 关键词；更复杂的规则引擎尚未实现**

```python
# 示例 — 规则定义格式
CLASSIFY_RULES = {
    "Web 前端": {
        "keywords": ["react", "vue", "angular", "svelte", "next", "nuxt", "tailwind", "css", "html", "webpack", "vite"],
        "languages": ["JavaScript", "TypeScript", "CSS", "HTML"],
    },
    "Web 后端": {
        "keywords": ["fastapi", "flask", "django", "express", "spring", "gin", "rest", "api", "graphql"],
        "languages": ["Python", "Java", "Go", "Rust", "C#"],
    },
    # ... 更多分类
}
```

### 8.2 图谱 TF-IDF 计算

图谱相似度基于项目 description + language + tags 的 TF-IDF 向量余弦相似度，并叠加语言、分类、名称 token 重叠等多信号。实现要求：

1. 使用 scikit-learn 的 `TfidfVectorizer`，不引入额外 NLP 依赖
2. 相似度计算封装在 `GraphService` 中，函数签名：`def compute_graph(projects, min_similarity=0.1) -> GraphData`
3. `GraphData` 结构：`{ "nodes": [...], "edges": [...] }`，与 SPEC §3.2 Graph API 响应格式一致
4. **当前实现为实时计算，无 `graph_cache` 持久化缓存；缓存策略尚未实现**

### 8.3 GitHub API 调用

> **当前实现：** PAT 仍加密存储在 `users.github_accounts` JSON 字段中，独立表 `user_github_accounts` 尚未实现。

1. 所有 GitHub API 调用封装在 `GitHubService` 中，不直接在路由层调用 httpx
2. 统一错误处理：网络超时、401 (Token 无效)、403 (速率限制)、404 都要有明确的错误码和用户提示
3. Star 列表拉取支持分页 (GitHub API 默认每页 30 条)，批量导入时自动翻页
4. **PAT 存储规划：使用独立表 `user_github_accounts`（决策 N-S-04），加密方案与 `encrypted_api_key` 一致（Fernet）；当前尚未独立建表**

### 8.4 项目 README 渲染策略（决策 D-13）

| 方案 | 描述 | 选择 |
|------|------|-----|
| (a) 实时调 GitHub API | 每次打开详情页都调用 | ✅ 当前实现 |
| (b) 导入时预存 README 全文 | 存到 `projects.readme` 字段（决策 D-13） | ⬜ 尚未实现 |
| (c) 缓存策略 | 首次拉取后缓存，TTL 1 小时异步刷新（决策 C-07 补全） | ⬜ 尚未实现 |

> **当前实现：** `projects` 表未设 `readme` 字段。项目详情页通过 `GET /api/v1/projects/{id}/readme` 按需调用 GitHub API 拉取 README，不持久化到数据库。

**原规划方案 (b) + (c)（尚未实现）：**

- `projects` 表新增字段：
  - `readme TEXT NULLABLE` — README Markdown 全文
  - `readme_fetched_at TIMESTAMP NULLABLE` — 最后抓取时间
- 导入项目时：调用 GitHub API 拉 README → 存到 `projects.readme` → 记录 `readme_fetched_at`
- 用户访问详情页时：检查 `readme_fetched_at`，超过 1 小时则后台异步刷新（不阻塞页面渲染）（决策 C-07 补全：与 TECHNICAL_SPEC §11.3 缓存策略表一致）
- 渲染时：使用 `react-markdown + remark-gfm`，支持代码高亮、表格、图片

### 8.5 Project 字段默认值（决策 D-19）

| 字段 | 默认值 | 说明 |
|------|--------|------|
| `progress` | `'none'` | 学习进度，枚举: none / learning / learned / mastered |
| `stars` | `0` | Star 数 |
| `imported_at` | `NOW()` | 导入时间 |
| `created_at` | `NOW()` | 创建时间 |
| `updated_at` | `AUTO UPDATE` | 更新时间 |

**进度切换 UI：** 在 ProjectDetailPage 的"学习进度选择器"中点击循环 `none → learning → learned → mastered → none`。

### 8.6 预设分类种子数据注入（决策 D-17）

- **注入时机：** 当前由 `services/api/backend/services/seed_service.py` 在应用启动时注入；原规划的 Alembic data migration `002_preset_categories` 尚未实现
- **`user_id`：** `NULL`（所有用户共享预设分类）
- **`is_preset`：** `true`
- **升级时：** 幂等检查（`SELECT COUNT(*) FROM categories WHERE is_preset=true`，> 0 则跳过）
- **数据：** 见附录 B 完整列表

### 8.7 前端主题系统

1. CSS 变量定义以 SPEC §12.2 为准，不新增变量
2. 所有组件通过 `var(--xxx)` 引用颜色，禁止硬编码色值
3. 主题切换通过 `document.documentElement.setAttribute('data-theme', theme)` 实现
4. 浅色主题在 MVP 中必须可用，不能只有深色主题

---

## 9. 验收标准

### 9.1 功能验收 (必须全部通过)

| 编号 | 场景 | 验收条件 |
|------|------|---------|
| AC-01 | 注册 | 输入合法用户名（3-32 字符）+ 密码（**≥ 8 字符 + 同时包含字母和数字**）→ 注册成功 → 自动登录 → 跳转 Dashboard |
| AC-02 | 登录 | 输入已注册的用户名+密码 → 登录成功 → 获取 JWT → 跳转 Dashboard |
| AC-03 | Token 刷新 | access_token 过期 → 前端自动用 refresh_token 获取新 token → 用户无感知 |
| AC-04 | 手动添加项目 | 填写 name + URL（必须 https://github.com/{owner}/{repo} 格式）+ 选择分类 → 项目出现在列表中 |
| AC-05 | 重复 URL 检测 | 添加已存在的 URL → 返回错误提示 "该项目 URL 已存在" |
| AC-06 | 绑定 GitHub | 填写 GitHub 用户名 + PAT → 验证连通 → **检查 X-OAuth-Scopes 响应头，拒绝超出 read:user + repo 范围的 PAT**（决策 S-03） → 绑定成功（v1.0 限 1 个账号） |
| AC-07 | Star 导入 | 绑定 GitHub 后 → 拉取 Star 列表 → 一键批量导入（单次 ≤ 500 条）→ 项目出现在列表中 |
| AC-08 | 自动分类 | 导入项目后 → 系统根据 `language` 降级规则自动分配分类；**标签自动分配尚未实现** |
| AC-09 | 搜索筛选 | 输入关键词搜索（匹配 name + description）→ 结果正确；选择分类/语言/进度/标签筛选 → 结果正确 |
| AC-10 | 项目详情 | 点击项目 → 查看基本信息 + GitHub README 渲染（通过 `/api/v1/projects/{id}/readme` 实时拉取） |
| AC-11 | 笔记 CRUD | 创建笔记 → 编辑 Markdown → 实时预览 → 删除笔记 |
| AC-12 | 图谱展示 | 打开图谱页 → 节点渲染 → 相似项目有连线 → 可缩放拖拽 → 点击节点跳转详情 |
| AC-13 | 设置保存 | 切换主题 → 立即生效；调整字体缩放 → 立即生效；配置 LLM → 测试连通 |
| AC-14 | 无 Key 完整可用 | 不配置 LLM Key → 所有非 AI 功能正常可用 → Agent 相关入口显示友好提示 |
| AC-15 | 修改密码使 token 失效 | 修改密码 → 旧 refresh_token 全部失效 → 用户需重新登录（N-S-02） |
| AC-16 | Tag CRUD | 新建标签 → 关联到项目 → 删除标签（级联清理 project_tags） |
| AC-17 | Agent Scout 分析 | 项目详情页点击 "Scout 快速分析" → 30s 内给出 Markdown 速览 |
| AC-18 | Agent Mentor 反问 | 触发 Mentor → 弹出反问面板（radio/checkbox/slider/drag_sort/knowledge_map）→ 提交答案 → 收到定制化讲解 |
| AC-19 | Agent SSE 流式 | 发送消息给 Agent → SSE 实时流式渲染（text_delta 事件）→ 工具调用可见（tool_call 事件） |
| AC-20 | 用户画像持久化 | 触发反问 → 答案存入 UserProfile → 下次同技术栈项目不再重复问 |

### 9.2 性能验收

| 指标 | 目标 | 测试方法 |
|------|------|---------|
| 页面首屏加载 | < 2s (生产构建) | Lighthouse Performance ≥ 80 |
| API 响应 (CRUD) | < 500ms (P95) | 100 次请求取 P95 |
| 图谱渲染 (100 节点) | < 2s | 手动计时 |
| Star 导入 (100 个项目) | < 10s | 手动计时 |
| TF-IDF 计算 (200 个项目) | < 3s | 单元测试计时 |

### 9.3 工程质量验收

| 检查项 | 标准 | 工具 |
|--------|------|------|
| 后端 lint | 0 errors, 0 warnings | `ruff check` |
| 前端 lint | 0 errors, 0 warnings | `eslint --max-warnings 0` |
| TypeScript | 编译通过，无 any | `tsc --noEmit` |
| 后端单测覆盖率 | **Service 层 ≥ 70%**（决策 N-08：核心安全模块 100%，业务模块 70%） | `pytest --cov` |
| 前端单测覆盖率 | 工具函数 + Store ≥ 60% | `vitest --coverage` |
| 集成测试 | 所有 v1.0 端点有测试 | `pytest` |
| E2E 测试 | 5 条核心流程通过（注册→导入→图谱→笔记→Agent 对话） | `playwright test` |
| OpenAPI 文档 | 所有端点有 description | 访问 /docs 人工检查 |

### 9.4 安全验收

| 检查项 | 标准 |
|--------|------|
| JWT 密钥强度 | **jwt_secret_key ≥ 32 字节（256-bit）**，应用启动时校验（决策 S-02） |
| 密码强度 | **≥ 8 字符 + 同时包含字母和数字**（决策 N-S-05） |
| 密码存储 | 数据库中无明文密码，bcrypt cost ≥ 12 |
| JWT 过期 | access_token 15 分钟过期后请求返回 401 |
| 修改密码失效 | 修改密码后该用户所有 refresh_token 失效（决策 N-S-02） |
| 速率限制 | 通用 60 次/分钟/user，Auth 端点 5 次/分钟/IP，Agent 端点 20 次/分钟/user（决策 N-S-03） |
| API Key 存储 | 数据库中无明文 Key，encrypted_api_key 为 BLOB |
| API Key 脱敏 | GET /settings 返回的 Key 格式为 `sk-****xxxx` (仅显示末 4 位) |
| PAT 存储 | 独立表 `user_github_accounts`，Fernet 加密（决策 N-S-04） |
| URL 校验 | 添加项目时 URL 必须为 `https://github.com/{owner}/{repo}` 格式（owner/repo 为 1-100 字符字母数字、点、连字符、下划线），防 SSRF（决策 N-S-06） |
| 未认证访问 | 所有需认证端点，无 Token 返回 401 |
| SQL 注入 | 使用 ORM 参数化查询，无字符串拼接 SQL |
| XSS | React 自动转义 + 不直接使用 dangerouslySetInnerHTML |
| **日志脱敏** | **所有日志输出经过 LogSanitizer 中间件，禁止记录完整 API Key、PAT、密码、JWT Token、refresh_token、邮箱（决策 N-S-09）** |
| 错误响应 | 第三方 API 异常只返回友好消息，不暴露堆栈/路径/时间戳（决策 N-S-08） |
| 跨用户隔离 | 所有资源端点强制注入 `current_user`，WHERE 子句自动添加 `user_id` 过滤；不接受客户端传来的 `user_id` 参数（决策 N-S-11） |
| JSON 字段大小限制 | user_profiles 各 JSON 字段 max 64KB、extensions max 100 keys、key 长度 ≤ 128 字符（决策 T-10 补全） |
| Prompt 注入 | `sanitize_user_input` 检测并标记可疑注入内容；System Prompt 与用户消息用 `===END SYSTEM INSTRUCTIONS===` 分隔（决策 N-S-12, N-S-13） |
| 文件路径校验 | v1.0 暂不涉及文件系统存储（笔记/头像均用 DB 或 URL），推迟到 v1.1+（决策 N-S-07） |

---

## 10. 开发顺序

> **当前状态：** 以下顺序是 v1.0 发布前的建议开发计划。实际开发已跨越这些阶段，实现形态与规划存在差异（如 Agent 配置未按子目录组织、未启用 Alembic、未建 `graph_cache` 表等）。本节保留为历史规划参考。

v1.0 单版本完整发布的建议开发顺序（不含时间预估）。每个顺序对应一次 PR/迭代：

| 顺序 | 模块 | 内容 | 验收 |
|------|------|------|------|
| 1 | 骨架 | 后端 FastAPI 脚手架 + 数据库（SQLite WAL）+ Alembic 迁移（建全部表含 refresh_tokens / user_github_accounts / graph_cache）+ Auth 模块（JWT + bcrypt + 速率限制）+ **测试基础设施（conftest.py + AsyncSession fixture + mock LLMProvider + mock GitHubService，决策 T-05 补全）**；前端 Vite + React + 路由 + 布局 + 主题系统 + LogSanitizer | AC-01, AC-02, AC-03, AC-15 通过；前后端联通；**pytest 和 vitest 可运行** |
| 2 | 项目核心 | Project CRUD（移除 note 字段，新增 readme/readme_fetched_at）+ Category CRUD + **Tag CRUD 端点** + 分类规则引擎 + 预设分类种子数据；前端 Dashboard（含 GitHub 同步按钮）+ 项目列表 + 筛选 + 项目详情 | AC-04, AC-05, AC-08, AC-09, AC-10, AC-16 通过 |
| 3 | GitHub 集成 | GitHubService + `user_github_accounts` 表 + Star 拉取 + 批量导入（≤ 500 条/次）+ PAT 加密存储；前端绑定 GitHub UI + 导入流程 | AC-06, AC-07 通过 |
| 4 | 笔记 + 图谱 | Note CRUD（修正路径冲突 N-04）+ Markdown 预览（react-markdown + remark-gfm）；GraphService (TF-IDF, sparse 矩阵, **graph_cache 表** N-P-01) + D3.js 图谱组件 | AC-11, AC-12 通过 |
| 5 | 设置 + LLM | Settings 完整 (主题/缩放/LLM BYOK 配置)；LLMProvider（LiteLLM，完整实现 `complete()` 和 `test_connection()`，决策 D-11） | AC-13 通过 |
| 6 | Agent 核心 | AgentRegistry + ToolRegistry + ReActEngine + HubService + IntentClassifier + **7 个 Agent**（scout/mentor/navigator/curator/scribe/hub/atlas）；SPEC 中按子目录 + 配置文件组织的形态尚未落地 | Agent 单元测试通过 |
| 7 | Agent API + SSE | 全部 `/agent/*` 端点实现（含反问、对比、分类、推荐、笔记生成）；SSE 流式输出（N-P-12 反压）；PromptGuard 注入检测（N-S-12） + System Prompt 分隔符（N-S-13） | AC-19 通过 |
| 8 | Agent 前端 | AgentPage + ChatPanel + MessageBubble + QuestionRenderer（5 种反问组件）+ SSE Hook；agentStore 完整实现 | AC-18, AC-19 通过 |
| 9 | 记忆系统 | MemoryService + UserProfile CRUD + UserProfileStore + ProjectMemoryStore + SessionStore + HistoryCompressor（N-P-11 不用 NLP 库） | AC-20 通过 |
| 10 | Scout 集成 | ProjectAnalysis 缓存（N-P-02 缓存键策略） + GraphCache（N-P-01） + Agent 路由（scout 分析） | AC-17 通过 |
| 11 | 质量 | 测试补全（Service ≥ 70%）+ lint 清零 + E2E（5 条 happy path） + 性能调优（N-P-04 WAL 模式确认、N-P-05 get_current_user 缓存、N-P-06 selectinload、N-P-08 D3 懒加载、N-P-09 虚拟滚动） + 文档完善 | §9 全部验收标准通过 |

---

## 附录 A: 版本标识

应用启动时在后端日志和前端 About 区域显示：

```
RepoPilot v1.0.0
Based on v1 PRD / SPEC / MVP_SCOPE
```

## 附录 B: 预设分类种子数据

> **当前实现：** 实际注入的分类为 5 个，与 SPEC 中更细粒度的 12 个分类不同。

```python
PRESET_CATEGORIES = [
    {"name": "前端", "icon": "🎨", "color": "#3b82f6"},
    {"name": "后端", "icon": "⚙️", "color": "#10b981"},
    {"name": "AI/ML", "icon": "🤖", "color": "#8b5cf6"},
    {"name": "DevOps", "icon": "🔧", "color": "#f59e0b"},
    {"name": "其他", "icon": "📦", "color": "#6b7280"},
]
```

更细粒度的分类（如数据科学、移动开发、游戏开发、安全、工具/库、学习资源等）尚未实现。
```
