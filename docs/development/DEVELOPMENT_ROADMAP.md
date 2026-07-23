# RepoPilot v1.0 — 开发路线图 (Development Roadmap)

> 版本: 1.0.0 | 日期: 2026-07-03 | 路径更新: 2026-07-05 | 状态: 草案
>
> ⚠️ **与代码实际进度脱节的说明：** 本文档是 v1.0 发布前的计划草案，列出了预期的 Phase、任务清单与估算工时。实际开发已大幅推进（`apps/web`、`services/api` 及 Agent 运行时均已实现），但本文档中的任务清单未随代码更新，各 Phase 复选框仍为未勾选状态。如需了解当前实现，请参考 `docs/architecture/REPO_LAYOUT.md` 和代码本身。
>
> 权威来源: `v1/PRD/PRD.md` (产品需求) · `v1/SPEC/TECHNICAL_SPEC.md` (技术规格) · `v1/MVP/MVP_SCOPE.md` (实施范围)
>
> **仓库布局：** Monorepo。下文任务清单中的 `backend/`、`frontend/` 路径见 [`docs/architecture/PATH_MAPPING.md`](../architecture/PATH_MAPPING.md)（API → `services/api/backend/`，正式 Web → `apps/web/`，**当前 Mock UI → `docs/design/v1/frontend/`**）。
>
> **本文档定位:** v1.0 单版本完整发布的开发路线图，**取代已删除的 `DEVELOPMENT_STEPS.md`**。本文档与 MVP_SCOPE §10 的开发顺序保持一致，**MVP_SCOPE §10 是 v1.0 详细开发步骤，本文档提供更高的视角**（含风险评估、依赖关系、参考资源）。

---

## 1. 路线图总览

### 1.1 v1.0 发布阶段

| 阶段 | 名称 | 内容 | 估算工时 | 依赖 |
|------|------|------|---------|------|
| Phase 0 | 项目初始化 | 仓库结构 + 工具链 + CI 骨架 | 2 天 | - |
| Phase 1 | 骨架 | 后端 FastAPI + Auth + DB；前端 Vite + React + 主题 | 5-7 天 | Phase 0 |
| Phase 2 | 项目核心 | Project/Category/Tag CRUD + 规则引擎 + Dashboard | 7-10 天 | Phase 1 |
| Phase 3 | GitHub 集成 | GitHubService + Star 拉取 + 批量导入 + PAT 加密 | 4-5 天 | Phase 2 |
| Phase 4 | 笔记 + 图谱 | Note CRUD + Markdown 预览 + GraphService (TF-IDF) | 5-7 天 | Phase 2 |
| Phase 5 | 设置 + LLM | Settings + BYOK 配置 + LLMProvider + LogSanitizer | 3-4 天 | Phase 1 |
| Phase 6 | Agent 核心 | AgentRegistry + ToolRegistry + ReActEngine + HubService | 7-10 天 | Phase 5 |
| Phase 7 | Agent API + SSE | 全部 /agent/* 端点 + SSE 流式 + PromptGuard | 5-7 天 | Phase 6 |
| Phase 8 | Agent 前端 | AgentPage + 5 种反问组件 + SSE Hook | 5-7 天 | Phase 7 |
| Phase 9 | 记忆系统 | MemoryService + UserProfile + HistoryCompressor | 3-5 天 | Phase 6 |
| Phase 10 | Scout 集成 | ProjectAnalysis 缓存 + GraphCache + Agent 路由 | 3-4 天 | Phase 6, Phase 4 |
| Phase 11 | 质量 | 测试补全 + lint + E2E + 性能调优 | 5-7 天 | Phase 1-10 |

**总工时估算:** 55-75 天（1 人全职）

### 1.2 关键里程碑

| 里程碑 | 达成条件 | 验收 |
|--------|---------|------|
| **M1: 骨架完成** | Phase 0-1 完成 | 前后端联通，AC-01/02/03 通过 |
| **M2: 核心功能可用** | Phase 2-4 完成 | 不含 LLM 的完整业务闭环，AC-04~12/16 通过 |
| **M3: Agent 可用** | Phase 5-10 完成 | 6 个 Agent 全部工作，AC-17~20 通过 |
| **M4: v1.0 发布候选** | Phase 11 完成 | 所有 🔴 严重问题修复，性能达标，PRD §7.3 质量门禁全部通过 |

---

## 2. 关键决策点（来自审查报告）

以下决策已在 PRD §7 / MVP_SCOPE 中确认，本文档作为参考：

| 决策 | 选择 | 审查报告编号 |
|------|------|------------|
| 版本策略 | v1.0 单版本完整发布 | N-01 |
| 测试覆盖率 | Service 层 ≥ 70%（核心 100%） | N-08 |
| 密码策略 | ≥ 8 字符 + 同时包含字母和数字 | N-S-05 |
| Project.note 字段 | **移除**（用 Note 表替代） | D-12 |
| LLMProvider 实现深度 | **完整实现** `complete()` 和 `test_connection()`（v1.0 启用） | D-11 |
| Scribe 工具 | 允许 `query_user_projects` | N-10 |
| Tag 端点 | **独立 CRUD** | D-15 |
| README 链接 | 修正 README.md 路径 | N-13 |
| GitHub PAT 存储 | **独立表 `user_github_accounts`** | N-S-04 |

---

## 3. 各 Phase 详细任务清单

### Phase 0: 项目初始化 (2 天)

**目标：** 建立项目骨架，开发工具链就绪

**任务清单：**
- [ ] 验证 `services/api/` 的 Python 入口和依赖配置
- [ ] 验证 `docs/design/v1/frontend/`（Mock）与 `apps/web/`（正式位）的 Vite/TS 配置
- [ ] 配置 Alembic 数据库迁移工具
- [ ] 配置 ESLint / Ruff / Prettier / commitlint
- [ ] 建立 CI 流程（GitHub Actions：lint + test）
- [ ] 配置 pre-commit hooks

**关键文件：**
- `pyproject.toml` + `services/api/pyproject.toml` (API 依赖)
- `docs/design/v1/frontend/package.json` (Mock 前端依赖)
- `apps/web/package.json` (正式 Web 脚手架)
- `services/api/backend/migrations/` (数据库迁移)
- `.github/workflows/ci.yml` (CI 配置)
- `.pre-commit-config.yaml` (pre-commit 配置)

**风险：** 工具链不兼容 → 解决：先用最少工具链跑通，再扩展

---

### Phase 1: 骨架 (5-7 天)

**目标：** 前后端联通，Auth + JWT 完整可用

**后端任务：**
- [ ] FastAPI app 入口 + 路由注册
- [ ] SQLAlchemy 2.0 异步 ORM 配置
- [ ] **SQLite WAL 模式** 启用（N-P-04）
- [ ] **Alembic 初始迁移：建全部 v1.0 表**（users / refresh_tokens / user_github_accounts / projects / tags / project_tags / categories / notes / user_settings / user_profiles / agent_sessions / agent_messages / project_analyses / graph_cache）
- [ ] bcrypt 密码哈希 (cost ≥ 12)
- [ ] JWT access_token (15min) + refresh_token (7d)
- [ ] **refresh_tokens 表 SHA256 哈希存储**（不存明文）
- [ ] **速率限制：Auth 端点 5 次/分钟/IP，全局 60 次/分钟/user**（N-S-03）
- [ ] **LogSanitizer 中间件**（N-S-09）
- [ ] 全局异常处理器（不暴露堆栈/路径，N-S-08）
- [ ] CORS 配置（仅本地前端）

**前端任务：**
- [ ] Vite + React 18 + TypeScript strict
- [ ] React Router 6 路由配置
- [ ] Tailwind CSS + CSS Variables 主题系统
- [ ] Zustand stores: authStore, uiStore
- [ ] LoginPage / RegisterPage
- [ ] 基础布局: Sidebar + Topbar + Main

**验收标准：** AC-01, AC-02, AC-03, AC-15 通过；前后端联通

**关键文件：**
- `backend/main.py`, `backend/database.py`, `backend/core/security.py`
- `backend/core/middleware.py` (LogSanitizer, 速率限制)
- `backend/api/auth.py`, `backend/api/deps.py`
- `backend/migrations/versions/001_initial.py`
- `frontend/src/main.tsx`, `frontend/src/App.tsx`
- `frontend/src/router.tsx`
- `frontend/src/store/authStore.ts`

**风险：**
- JWT 密钥管理不当 → 解决：从环境变量 `JWT_SECRET_KEY` 读取，启动时校验
- 异步 SQLAlchemy 复杂 → 解决：参考 SQLAlchemy 2.0 异步文档

---

### Phase 2: 项目核心 (7-10 天)

**目标：** Project/Category/Tag CRUD + 规则引擎 + Dashboard 完整可用

**后端任务：**
- [ ] Project CRUD（含 **readme** 字段、**移除 note** D-12）
- [ ] Category CRUD（预设分类种子数据，Alembic `002_preset_categories`）
- [ ] **Tag CRUD 端点**（D-15）
- [ ] **PUT /projects/{id}/tags** 端点
- [ ] **POST /import 批量导入（≤ 500 条/次，D-18）**
- [ ] 关键词规则引擎（Curator 降级方案）
- [ ] **URL 校验：必须 `https://github.com/{owner}/{repo}`**（N-S-06）
- [ ] **N+1 防护：selectinload**（N-P-06）
- [ ] **get_current_user 缓存到 request.state**（N-P-05）

**前端任务：**
- [ ] DashboardPage 项目列表（虚拟滚动 N-P-09）
- [ ] ProjectDetailPage（README 渲染、笔记入口、Scout 按钮占位）
- [ ] 筛选面板（分类/语言/进度/标签）
- [ ] **GitHub 同步入口**（D-14）
- [ ] AddProjectModal / EditProjectModal
- [ ] Tag 标签云组件
- [ ] Category 列表管理

**验收标准：** AC-04, AC-05, AC-08, AC-09, AC-10, AC-16 通过

**关键文件：**
- `backend/services/project_service.py`
- `backend/services/category_service.py`
- `backend/services/tag_service.py`
- `backend/services/classification_service.py` (规则引擎)
- `backend/api/projects.py`, `backend/api/categories.py`, `backend/api/tags.py`
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/pages/ProjectDetailPage.tsx`
- `frontend/src/components/project/`
- `frontend/src/components/category/`

---

### Phase 3: GitHub 集成 (4-5 天)

**目标：** 用户绑定 GitHub PAT，Star 批量导入

**后端任务：**
- [ ] **user_github_accounts 表 CRUD**（N-S-04，替代原 users.github_accounts JSON）
- [ ] GitHubService：调用 GitHub API
- [ ] GET /stars / GET /stars/{username}
- [ ] GET /accounts（决策 D-16）
- [ ] POST /accounts / DELETE /accounts/{id}
- [ ] POST /projects/import（≤ 500 条/次）
- [ ] **PAT 加密存储（Fernet）**
- [ ] 速率限制：10 次/小时/user（N-S-03）
- [ ] 错误处理：401/403/404 友好提示

**前端任务：**
- [ ] SettingsPage：GitHub 账号绑定 UI
- [ ] DashboardPage：GitHub 同步按钮 + 进度提示
- [ ] 批量导入 Modal

**验收标准：** AC-06, AC-07 通过

**关键文件：**
- `backend/services/github_service.py`
- `backend/api/github.py`
- `backend/models/user_github_account.py` (新模型)

**风险：**
- GitHub API 速率限制（5000/h 需 PAT，60/h 匿名） → 解决：强制 PAT
- PAT 加密密钥管理 → 解决：OS 密钥链 + Fernet

---

### Phase 4: 笔记 + 图谱 (5-7 天)

**目标：** Markdown 笔记 + 项目关系图谱

**后端任务：**
- [ ] Note CRUD（**修正路径 /notes/notes/{id} → /{id}**，N-04）
- [ ] GET /search 全文搜索（v1.0 LIKE，v1.1 升级）
- [ ] GraphService：TF-IDF 计算
- [ ] **graph_cache 表**（N-P-01，缓存键 SHA256）
- [ ] **sparse 矩阵 + max_features=5000**（N-P-07）
- [ ] GET /graph 支持 min_similarity 和 max_edges 参数

**前端任务：**
- [ ] 笔记编辑器（react-markdown + remark-gfm）
- [ ] 实时预览（split view）
- [ ] GraphPage：D3.js force simulation
- [ ] **D3.js 懒加载**（N-P-08，React.lazy + Suspense）

**验收标准：** AC-11, AC-12 通过

**关键文件：**
- `backend/services/note_service.py`
- `backend/services/graph_service.py`
- `backend/api/notes.py`, `backend/api/graph.py`
- `frontend/src/components/note/`
- `frontend/src/pages/GraphPage.tsx`
- `frontend/src/components/graph/`

---

### Phase 5: 设置 + LLM (3-4 天)

**目标：** Settings 完整可用，LLM BYOK 配置

**后端任务：**
- [ ] UserSetting CRUD
- [ ] **LLMConfig.from_user_settings 工厂方法**（S-06）
- [ ] **LLMProvider 完整实现 complete() 和 test_connection()**（D-11）
- [ ] SecureKeyStore（OS 密钥链 / PBKDF2 fallback）
- [ ] POST /test-llm + POST /agent/config/test
- [ ] **LLMConfig Literal 类型限定**（S-06）

**前端任务：**
- [ ] SettingsPage 完整（主题/缩放/GitHub 账号管理/LLM 配置）
- [ ] LLM 配置面板（provider/model/api_key/api_base/test）

**验收标准：** AC-13 通过

**关键文件：**
- `backend/services/llm_provider.py`
- `backend/core/security.py` (SecureKeyStore)
- `backend/api/settings.py`

---

### Phase 6: Agent 核心 (7-10 天)

**目标：** Agent 框架完整，6 个 Agent 注册就绪

**后端任务：**
- [ ] AgentDefinition + AgentRegistry
- [ ] ToolDefinition + ToolRegistry
- [ ] **注册全部 14 个工具**（query_user_projects, read_readme, read_source_file, search_web, get_project_analysis, get_user_profile, update_user_profile, suggest_classification, generate_note_outline, compare_projects, build_learning_path, ask_user_question, save_to_memory, recall_from_memory）
- [ ] **query_user_projects 允许 Scribe**（N-10）
- [ ] ReActEngine 执行循环
- [ ] HubService + IntentClassifier
- [ ] **SubIntent dataclass**（T-03）
- [ ] CapabilityDetector
- [ ] 6 个 Agent 配置文件（AGENT.md + SOUL.md + system_prompt.j2 + config.yaml）

**验收标准：** Agent 单元测试通过

**关键文件：**
- `backend/agents/` 目录结构（scout/mentor/navigator/curator/scribe/hub）
- `backend/services/agent_service.py`
- `backend/services/hub_service.py`
- `backend/services/react_engine.py`
- `backend/tools/registry.py`
- `backend/tools/project_tools.py`, `backend/tools/web_tools.py`, `backend/tools/memory_tools.py`, `backend/tools/question_tools.py`

---

### Phase 7: Agent API + SSE (5-7 天)

**目标：** 全部 /agent/* 端点 + SSE 流式

**后端任务：**
- [ ] **SSE 流式输出 + asyncio.Queue 反压**（N-P-12）
- [ ] **StreamEventType 集中枚举**（T-04）
- [ ] 全部 /agent/* 端点实现
- [ ] POST /chat, /question, /analyze/{id}, /compare, /classify, /recommend, /note/generate
- [ ] /agent/sessions CRUD
- [ ] /agent/config + /agent/permissions（**N-06 补全**）
- [ ] /agent/profiles + /agent/profiles/{id}/{soul,agent}
- [ ] /agent/user-profile
- [ ] **PromptGuard 完整实现**（N-S-12）
- [ ] **System Prompt 分隔符**（N-S-13）

**验收标准：** AC-19 通过

**关键文件：**
- `backend/api/agent.py`
- `backend/core/events.py` (StreamEventType)

---

### Phase 8: Agent 前端 (5-7 天)

**目标：** AgentPage 完整，反问交互工作

**前端任务：**
- [ ] AgentPage 路由 + 布局
- [ ] ChatPanel + MessageBubble
- [ ] SSE Hook（useSSE）
- [ ] **agentStore 完整实现**（接口已定义）
- [ ] QuestionRenderer：5 种反问组件
  - QuestionRadio
  - QuestionCheckbox
  - QuestionSlider
  - QuestionDragSort
  - QuestionKnowledgeMap
- [ ] **QuestionAnswer 判别字段 type**（T-01）
- [ ] ToolCall 可视化（折叠面板）
- [ ] Agent 切换 UI（Hub/Scout/Mentor/Navigator/Curator/Scribe）

**验收标准：** AC-18, AC-19 通过

**关键文件：**
- `frontend/src/pages/AgentPage.tsx`
- `frontend/src/components/agent/`
- `frontend/src/hooks/useSSE.ts`
- `frontend/src/store/agentStore.ts`
- `frontend/src/types/agent.ts` (含判别字段)

---

### Phase 9: 记忆系统 (3-5 天)

**目标：** UserProfile 持久化，会话历史压缩

**后端任务：**
- [ ] MemoryService 完整实现
- [ ] **UserProfile Pydantic 模型补全**（S-04：参数化泛型 + extensions 字段）
- [ ] **TechProficiencyEntry / LearningPreferences / Goal / AgentPreferences 子模型**
- [ ] **HistoryCompressor 不用 NLP 库**（N-P-11）
- [ ] UserProfileStore / ProjectMemoryStore / SessionStore

**验收标准：** AC-20 通过

**关键文件：**
- `backend/services/memory_service.py`
- `backend/services/history_compressor.py`
- `backend/models/user_profile.py`

---

### Phase 10: Scout 集成 (3-4 天)

**目标：** Scout 快速分析工作，缓存策略生效

**后端任务：**
- [ ] ProjectAnalysis 缓存（N-P-02 缓存键策略）
- [ ] GraphCache 集成到 graph_service
- [ ] Agent 路由：Scout 分析入口
- [ ] GraphCache 失效机制（项目 update_at 变化）

**前端任务：**
- [ ] ProjectDetailPage Scout 按钮 → SSE 流式渲染

**验收标准：** AC-17 通过

**关键文件：**
- `backend/services/project_analysis_service.py`

---

### Phase 11: 质量 (5-7 天)

**目标：** 所有质量门禁通过

**任务清单：**
- [ ] **后端 Service 层测试覆盖率 ≥ 70%**（N-08）
- [ ] 前后端 lint 0 errors 0 warnings
- [ ] TypeScript 编译通过，无 any
- [ ] 集成测试覆盖所有 v1.0 端点
- [ ] **E2E 5 条 happy path 通过**（注册→导入→图谱→笔记→Agent 对话）
- [ ] **性能调优**：
  - N-P-04 SQLite WAL 确认
  - N-P-05 get_current_user 缓存确认
  - N-P-06 selectinload 确认
  - N-P-08 D3.js 懒加载确认
  - N-P-09 虚拟滚动确认
- [ ] 文档完善（API 文档、CHANGELOG）

**验收标准：** PRD §7.3 全部质量门禁通过

---

## 4. 风险登记

| 风险 | 等级 | 缓解措施 |
|------|------|---------|
| LLM API 速率限制 | 中 | 客户端指数退避 + 服务端缓存 |
| SQLite 并发写入 | 低 | WAL 模式 + busy_timeout=5000 |
| TF-IDF 大数据集内存 | 中 | sparse 矩阵 + max_features 限制 |
| SSE 浏览器兼容性 | 低 | EventSource polyfill（如必要） |
| Agent 推理耗时 | 中 | 流式 + 客户端可中断 + 进度反馈 |
| Token 成本 | 中 | 缓存 + 估算 + 精确计数（>80% 阈值时） |

---

## 5. 依赖关系图

```
Phase 0 (项目初始化)
    │
    ▼
Phase 1 (骨架)
    │
    ├──► Phase 2 (项目核心) ──► Phase 3 (GitHub)
    │           │
    │           ├──► Phase 4 (笔记+图谱)
    │           │
    │           └──► Phase 10 (Scout 集成)
    │
    ├──► Phase 5 (设置+LLM) ──► Phase 6 (Agent 核心)
    │                                 │
    │                                 ├──► Phase 7 (Agent API+SSE)
    │                                 │           │
    │                                 │           ▼
    │                                 │      Phase 8 (Agent 前端)
    │                                 │
    │                                 └──► Phase 9 (记忆系统)
    │
    └──► Phase 11 (质量) — 依赖 Phase 1-10
```

**关键路径：** Phase 0 → 1 → 2 → 4 → 10 → 11（最小可工作产品）
**完整路径：** 全部 12 个 Phase

---

## 6. 后续版本 (v1.1+)

| 版本 | 计划功能 | 预计工时 |
|------|---------|---------|
| v1.1 | 文件上传头像、OAuth GitHub、JSON 导入导出、双视图、笔记搜索升级、笔记导出 | 15-20 天 |
| v1.2 | 分类统计图、学习进度看板、时间线（StatsPage / TimelinePage） | 10-15 天 |
| v1.3 | Agent 协作（多 Agent 并行）、用户画像主动学习 | 20-30 天 |
| v1.4 | Web 端独立部署、移动端适配、Skill 市场、MCP 集成、IM 推送 | 30-45 天 |

---

## 7. 与其他文档的关系

| 文档 | 关系 |
|------|------|
| `PRD.md` | 本文档的上游，定义"做什么" |
| `TECHNICAL_SPEC.md` | 本文档的上游，定义"怎么做"的技术约束 |
| `MVP_SCOPE.md §10` | **本文档的展开**，更详细的 v1.0 开发步骤 |
| `DEVELOPMENT_PROCESS.md` | 本文档的补充，定义开发流程规范（PR 流程、commit 规范） |
| `RepoPilot-v1-文档审查报告-2026-07-03-v2.md` | 本文档修复了其中识别的所有 🔴 严重问题 |

---

*路线图结束。所有 Phase 编号可在开发过程中直接引用（如 "完成 Phase 1" 或 "在 Phase 3 修复"）。*
