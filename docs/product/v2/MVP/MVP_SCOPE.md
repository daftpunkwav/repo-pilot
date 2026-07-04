# RepoPilot v2 — MVP Implementation Scope

> 版本: 2.0.0 | 日期: 2026-07-04 | 状态: 草稿
>
> 权威来源: `v2/PRD/PRD.md` (产品需求) · `v2/SPEC/TECHNICAL_SPEC.md` (技术规格)
>
> 本文档定义 v2.0 的实现范围、开发顺序和验收标准。基于 v1.0 迭代升级。

---

## 1. 版本策略

v2.0 采用**单版本完整发布**策略，基于 v1.0 全量迭代。MVP_SCOPE.md 的范围即 v2.0 全部交付内容。

**v2.0 交付目标:** 在 v1.0 完整功能基础上，将系统从"AI 驱动的开源项目学习平台"升级为 **Multi-Agent Driven GitHub Learning OS**——具备自主规划、记忆合并、上下文工程、知识图谱推理能力的多智能体操作系统。

**v2.0 的成功标准:** 用户完成 v1 全流程后，额外体验 Hub Plan-and-Execute 多 Agent 协作 → Memory Merge 自动合并知识状态 → Context Engineering 精准上下文 → Knowledge Graph Query 跨 Agent 查询，且无 Key 下仍可使用完整 Degraded Mode。

### 1.1 v1 → v2 变更摘要

| 维度 | v1 实现 | v2 升级 |
| --- | --- | --- |
| 系统架构 | 前后端 + Agent 平铺 | 四层架构: Presentation → Agent → Knowledge → Infrastructure |
| Hub 角色 | 简单路由器 (Routing + IntentClassifier) | Chief Agent (Plan-and-Execute Workflow) |
| 记忆系统 | UserProfile + 会话历史压缩 | 五层 Memory Architecture + Memory Merge Protocol |
| 上下文管理 | 直接传递 full context | Context Engineering Pipeline (Retriever → Filter → Compress) |
| 推理模式 | 基础 ReAct | ReAct / ToT / Reflexion (GoT 预留) |
| 知识图谱 | 展示用 TF-IDF 力导向图 | 所有 Agent 共享查询工具 (Graph Query API) |
| Agent 数量 | 6 (Scout/Mentor/Navigator/Curator/Scribe/Hub) | 6 实现 + 1 预留 (Evaluator 仅建表和接口) |
| 降级策略 | 无 LLM 时功能受限 | 完整 Fallback Mode (GitHub API → TF-IDF → Keyword → Rule Engine → Graph) |
| 工具数量 | 14 个 | 14 保留 + 3 新增 + 2 预留 = 19 个 |

---

## 2. 功能范围清单

### 2.1 v2.0 IN (包含)

| 模块 | 功能 | PRD 章节 | 实现深度 |
| --- | --- | --- | --- |
| **用户系统 (v1 继承)** | 注册/登录、JWT 认证、修改密码、保持登录 | §3.2 P0 | 完整继承 v1，无变更 |
| **用户系统 (v1 继承)** | 绑定 GitHub (PAT 手动绑定) | §3.2 P0 | 完整继承 v1 |
| **User Profile 管理** | 五层 User Profile 可视化编辑 (职业/语言/学习目标/技术栈/偏好) | §3.2 P0 | v2 新增，MemoryPanel 页面实现 |
| **项目管理 (v1 继承)** | 手动添加/编辑/删除、Star 批量导入、搜索/筛选/排序 | §3.3 P0 | 完整继承 v1 |
| **分类系统 (v1 继承)** | 预设分类、自定义分类、多标签、关键词规则分类 | §3.11 P0 | 完整继承 v1，Curator 升级为 Reflexion |
| **笔记系统 (v1 继承)** | Markdown 笔记、MD 实时预览 | §3.10 P0 | 完整继承 v1 |
| **图谱可视化 (v1 继承)** | 力导向图、缩放/拖拽/搜索 | §3.7 P0 | 继承 v1，增强多类型边渲染 |
| **设置 (v1 继承)** | 主题切换、字体缩放、LLM BYOK 配置 | §3.2 P1 | 完整继承 v1 |
| **Hub Plan-and-Execute** | Chief Agent 7 阶段流水线: Intent → Plan → Dispatch → Collect → Evaluate → Merge → Response | §3.4.3 P0 | v2 核心升级，替代 v1 简单路由 |
| **Memory Architecture** | 五层记忆: User Profile / Preference / Knowledge State / Long Memory / Short Memory | §3.5 P0 | v2 新增，完整实现 5 层 |
| **Memory Merge Protocol** | Proposal → Evidence → Confidence → Hub Evidence Weighted Merge → Commit | §3.5.1 P0 | v2 核心机制，含冲突仲裁 |
| **Context Engineering Pipeline** | Retriever → Filter → Compress → AgentContext | §3.6 P0 | v2 新增，Token Budget 管理 |
| **Knowledge Graph 升级** | 多源构建 (TF-IDF/Dependency/Topic/Manual) + Graph Query API | §3.7 P0 | v2 核心升级，`query_knowledge_graph` 工具 |
| **Mentor ToT** | Tree of Thoughts 基础实现 (MAX_DEPTH=3, BRANCH_FACTOR=3) | §3.8 P0 | v2 新增，复杂概念讲解 |
| **Curator Reflexion** | Reflexion 反思迭代 (最多 3 轮，否则交用户确认) | §3.8 P0 | v2 新增，4 项质量检查 |
| **Scribe 双模式** | Project Mode (自动检索关联) + Standalone Mode (按需 RAG) | §3.10 P1 | v2 新增 |
| **propose_memory_update** | Agent 通过工具提交 Memory Proposal | §3.5.1 P0 | v2 新增工具 |
| **query_knowledge_graph** | 所有 Agent 共享图谱查询 | §3.7 P0 | v2 新增工具 |
| **get_knowledge_state** | 读取用户知识状态 (Mentor/Navigator) | §3.5 P0 | v2 新增工具 |
| **Fallback Mode** | 无 Key 完整降级: GitHub API → TF-IDF → Keyword → Rule Engine → Graph | §3.9 P0 | v2 新增，用户无感知 |
| **Agent 反问面板** | 5 种反问类型 + SSE 流式输出 | SPEC §10 P0 | 继承 v1，Hub Plan 中暂停/恢复 |
| **Agent 权限隔离** | 工具权限分级，Agent 不能越权调用其他 Agent 的工具 | §4.2 P0 | v2 增强 |
| **Memory 写入审计** | 所有 Memory 变更通过 Proposal 机制，留审计日志 | §4.2 P0 | v2 新增 |
| **SSE 新增事件** | `plan_update` + `memory_proposal` 两种事件类型 | SPEC §4.5 | v2 新增 |

### 2.2 v2.0 OUT (不包含，推迟到 v2.1+)

| 模块 | 功能 | 推迟理由 | 计划版本 |
| --- | --- | --- | --- |
| Evaluator Agent | 完整实现 (仅预留接口 `EvaluatorInterface` + `StubEvaluator` + `evaluator_reviews` 表) | 独立模块，不阻塞主流程 | v2.1 |
| Graph of Thoughts | Mentor 高级多策略对比 (GoT Engine) | 复杂度高，ToT 已满足 MVP 需求 | v2.1 |
| 向量数据库集成 | ChromaDB/Qdrant Embedding 向量存储 | `graph_edges` 表 + 预计算权重已满足 MVP | v2.1 |
| MCP 协议支持 | GitHub MCP / 文档 MCP / 代码执行 MCP | MCP 生态尚未成熟 | v2.4 |
| OAuth GitHub 绑定 | OAuth 授权流程 | v2.0 使用 PAT 手动绑定，功能完整 | v2.2 |
| Multi-Model Router | 完整多模型路由 (按 Agent/任务路由到不同模型) | v2.0 仅实现接口框架，统一使用单模型 | v2.1 |
| 移动端适配 | 响应式布局 < 900px | v2.0 仅桌面端 | v2.4 |
| 分类统计图 | 饼图/柱状图 | StatsPage 路由预留 | v2.3 |
| 学习进度看板 | 时间线视图 | 数据可视化扩展 | v2.3 |
| 笔记导出 | PDF/Markdown 导出 | v2.0 仅 DB 存储 | v2.2 |
| 文件上传头像 | 头像文件存储 | v2.0 使用 URL 头像 | v2.2 |
| Skill/插件市场 | 自定义 Agent 配置市场 | 需要审核/签名/版本管理 | v2.4 |
| 即时通讯集成 | 飞书/微信/Telegram/Discord | 需要外部账号配置 | v2.4+ |

---

## 3. 数据模型变更

**权威定义:** v2 TECHNICAL_SPEC §2。所有新增表的字段、类型、约束以 SPEC 为准。

### 3.1 v1 保留表 (不变)

| 表名 | 状态 | 说明 |
| --- | --- | --- |
| `users` | 不变 | 完整继承 |
| `refresh_tokens` | 不变 | 完整继承 |
| `user_github_accounts` | 不变 | 完整继承 |
| `projects` | 不变 | 含 `readme` / `readme_fetched_at` 字段 |
| `tags` | 不变 | 完整继承 |
| `project_tags` | 不变 | 完整继承 |
| `categories` | 不变 | 含预设数据种子 |
| `notes` | 不变 | 完整继承 |
| `user_settings` | 不变 | 含 LLM 配置字段 |
| `user_profiles` | 不变 | 完整继承 |
| `agent_sessions` | 不变 | 6 个 Agent 共用 |
| `agent_messages` | 不变 | SSE 流式消息持久化 |
| `project_analyses` | 不变 | Scout/Mentor 分析缓存 |
| `graph_cache` | 不变 | 图谱增量缓存 |

### 3.2 v2 新增表

| 表名 | 建表 | v2.0 写入 | 说明 |
| --- | --- | --- | --- |
| `knowledge_states` | YES | YES | 知识状态层 (L3)，`UNIQUE(user_id, domain)`，Mentor 主要维护 |
| `memory_proposals` | YES | YES | Agent 提交的记忆提案，含 confidence + evidence，状态: pending/merged/rejected |
| `memory_commits` | YES | YES | Hub 合并后的提交记录，永久保留 (审计用途) |
| `graph_edges` | YES | YES | 知识图谱多类型边 (tfidf/embedding/dependency/topic/manual) |
| `evaluator_reviews` | YES | NO | v2.1+ 预留，建表但不写入数据 |

### 3.3 Alembic 迁移

v2.0 迁移文件: `003_v2_memory_knowledge`，包含所有新增表。v1 初始迁移 (`001_initial`) 和预设分类迁移 (`002_preset_categories`) 保持不变。

---

## 4. API 端点清单

**统一前缀:** v1 端点保持 `/api/v1/`，v2 新增端点使用 `/api/v2/`。统一响应格式 `{ "data": ..., "meta": {...} }`。

### 4.1 v1 保留端点 (不变)

以下端点完整继承 v1，路径和行为不变:

- `/api/v1/auth/*` — 注册/登录/刷新/注销/me/password (7 个端点)
- `/api/v1/github/*` — Star 列表/账号绑定管理 (5 个端点)
- `/api/v1/projects/*` — CRUD/导入/导出/进度/统计/笔记 (11 个端点)
- `/api/v1/categories/*` — CRUD (4 个端点)
- `/api/v1/tags/*` — CRUD + 项目标签设置 (4 个端点)
- `/api/v1/notes/*` — CRUD + 搜索 (4 个端点)
- `/api/v1/graph/` — 图谱数据 (1 个端点)
- `/api/v1/settings/*` — 获取/更新/测试 LLM (3 个端点)
- `/api/v1/agent/*` — 对话/反问/分析/对比/分类/推荐/笔记生成/会话管理/配置/权限/画像 (22 个端点)

### 4.2 v2 新增端点

#### Agent Plan (`/api/v2/agent`)

| 方法 | 路径 | 说明 | 验收标准 |
| --- | --- | --- | --- |
| POST | /chat | 发送消息，内部走 Hub Plan-and-Execute (升级 v1) | JWT 必填，SSE 含 `plan_update` + `memory_proposal` 事件 |
| POST | /question | 提交反问答案，恢复 Plan 执行 (升级 v1) | JWT 必填，暂停的 TaskStep 恢复执行 |
| GET | /plan/{session_id} | 获取当前 TaskPlan | 返回 plan_id + steps 列表 + 各步骤状态 |
| GET | /plan/{session_id}/steps | 获取步骤执行状态详情 | 返回各 step 的 agent_id/status/result 摘要 |

#### Knowledge Graph (`/api/v2/knowledge-graph`)

| 方法 | 路径 | 说明 | 验收标准 |
| --- | --- | --- | --- |
| GET | / | 图谱全量数据 (含多类型边) | 返回 nodes + edges，按 edge_type 分组 |
| GET | /query | Graph Query API | 支持 `edge_type`/`min_weight`/`project_id`/`depth`/`limit` 参数 |
| POST | /edges | 手动添加边 | 校验 source/target 项目归属当前用户 |
| DELETE | /edges/{id} | 删除边 | 仅允许删除 `edge_type=manual` 的边 |

#### Memory (`/api/v2/memory`)

| 方法 | 路径 | 说明 | 验收标准 |
| --- | --- | --- | --- |
| GET | /proposals | 获取用户的记忆提案列表 | 支持 `status`/`page`/`page_size` 参数 |
| GET | /proposals/{id} | 获取提案详情 | 含 agent_id/target_layer/key/value/confidence/evidence |
| GET | /commits | 获取用户的记忆提交历史 | 分页，按 committed_at 降序 |
| GET | /knowledge-states | 获取用户的知识状态 | 返回所有 domain + proficiency 列表 |
| PUT | /knowledge-states/{domain} | 手动覆盖知识状态 | proficiency 0-100 校验，绕过 Proposal 机制 |

#### Evaluator (`/api/v2/evaluator`) -- v2.1+ 预留

| 方法 | 路径 | 说明 | 验收标准 |
| --- | --- | --- | --- |
| GET | /reviews | 获取评估记录 | v2.0 返回空列表 `[]` |
| GET | /reviews/{session_id} | 获取会话评估详情 | v2.0 返回 404 |

---

## 5. 工具注册清单

v2.0 共 19 个工具: 14 保留 + 3 新增 + 2 预留。

### 5.1 v1 保留工具 (14 个)

| # | 工具名 | 用途 | 允许 Agent |
| --- | --- | --- | --- |
| 1 | `read_readme` | 读取项目 README | Scout, Mentor |
| 2 | `read_source_file` | 读取 GitHub 仓库文件 | Mentor |
| 3 | `search_web` | 搜索互联网 | 所有 |
| 4 | `query_user_projects` | 查询用户项目库 | Scout, Mentor, Navigator, Curator, Scribe, Hub |
| 5 | `get_project_analysis` | 获取缓存分析结果 | Hub, Mentor |
| 6 | `get_user_profile` | 读取用户画像 | Mentor, Navigator |
| 7 | `update_user_profile` | 更新用户画像 | Mentor, Navigator |
| 8 | `suggest_classification` | 建议分类 | Curator |
| 9 | `generate_note_outline` | 生成笔记大纲 | Scribe |
| 10 | `compare_projects` | 对比项目 | Mentor |
| 11 | `build_learning_path` | 构建学习路径 | Navigator |
| 12 | `ask_user_question` | 反问交互 | Mentor, Navigator |
| 13 | `save_to_memory` | 存储记忆 (Short Memory) | 所有 |
| 14 | `recall_from_memory` | 检索记忆 | 所有 |

### 5.2 v2 新增工具 (3 个)

| # | 工具名 | 用途 | 允许 Agent |
| --- | --- | --- | --- |
| 15 | `query_knowledge_graph` | 查询知识图谱 (边类型/权重/深度) | Scout, Mentor, Navigator, Curator, Scribe |
| 16 | `propose_memory_update` | 提交 Memory Proposal (含 target_layer/key/value/confidence/evidence) | Mentor, Navigator, Scout, Curator, Scribe |
| 17 | `get_knowledge_state` | 读取用户知识状态 (domain → proficiency) | Mentor, Navigator |

### 5.3 v2 预留工具 (2 个)

| # | 工具名 | 用途 | 状态 |
| --- | --- | --- | --- |
| 18 | `evaluate_agent_output` | Evaluator 评估 Agent 输出 | v2.1+ 实现，v2.0 注册但返回 stub |
| 19 | `check_memory_conflict` | Evaluator 检查 Memory 冲突 | v2.1+ 实现，v2.0 注册但返回 stub |

---

## 6. 配置管理

v2.0 Settings 类在 v1 基础上新增以下字段:

```python
class Settings(BaseSettings):
    # ── v1 保留 (不变) ──
    app_name: str = "RepoPilot"
    debug: bool = False
    api_prefix: str = "/api/v1"
    database_url: str = "sqlite+aiosqlite:///./repopilot.db"
    jwt_secret_key: str            # >= 32 bytes
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    github_api_timeout: int = 10
    llm_default_provider: str = "openai"
    llm_default_model: str = "gpt-4o"
    storage_dir: str = "./data"

    # ── v2 新增 ──
    # Context Engineering
    context_default_token_budget: int = 8000       # Agent 默认 Token 预算
    context_hub_token_budget: int = 4000           # Hub Token 预算
    context_compression_strategy: str = "priority"  # "priority" | "truncate" | "llm_summary"

    # Memory Merge
    memory_merge_conflict_threshold: float = 0.2   # Confidence 差值 > 此值视为冲突 (TBD-11)
    memory_proposal_batch_limit: int = 10          # 单次 Merge 最多处理 Proposal 数 (TBD-18)
    memory_proposal_archive_days: int = 30         # merged/rejected 归档天数

    # Knowledge Graph
    graph_default_min_weight: float = 0.1          # 默认最小边权重
    graph_query_default_limit: int = 100           # Graph Query 默认返回上限
    graph_edge_types: str = "tfidf,dependency,topic,manual"  # v2.0 启用的边类型

    # Plan-and-Execute
    hub_max_plan_steps: int = 5                    # 单次 Plan 最大步骤数
    hub_plan_timeout_seconds: int = 30             # Plan 执行超时

    # Reasoning Engines
    tot_max_depth: int = 3                         # ToT 最大深度
    tot_branch_factor: int = 3                     # ToT 分支因子
    reflexion_max_rounds: int = 3                  # Reflexion 最大轮数 (TBD-14)

    # Fallback Mode
    fallback_classify_min_accuracy: float = 0.65   # Rule Engine 最低可接受准确率 (TBD-17)

    class Config:
        env_file = ".env"
```

---

## 7. Agent 系统变更

### 7.1 Agent v1 → v2 变更对照表

| Agent | v1 实现 | v2 变更 | 引擎变更 |
| --- | --- | --- | --- |
| **Hub** | 简单路由器 (IntentClassifier + 路由表) | **Chief Agent**: Plan-and-Execute Workflow, Memory Merge, Conflict Resolution | 新增 PlanExecuteEngine |
| **Scout** | ReAct 快速分析 | 新增 `query_knowledge_graph` 工具，分析结果写入 `graph_edges` (多类型边) | ReAct (不变) |
| **Mentor** | ReAct + 反问 | 新增 ToT (复杂概念)、`propose_memory_update` 更新 Knowledge State、Context Engineering 精准上下文 | ReAct + **ToT (v2 新增)** |
| **Navigator** | ReAct 学习规划 | 新增 `query_knowledge_graph` + `get_knowledge_state` 工具，结合图谱拓扑规划路线 | ReAct (不变) |
| **Curator** | 关键词规则 → LLM 建议 | **Reflexion Workflow** (最多 3 轮): 执行 → 评估 (重复/命名/粒度/一致性) → 反思 → 重试 | **ReflexionEngine (v2 新增)** |
| **Scribe** | ReAct 笔记助手 | **双模式**: Project Mode (自动检索 History/Graph/Memory) + Standalone Mode (按需 RAG, Similarity > Threshold 才调用 Compare) | ReAct (不变) |
| **Evaluator** | 不存在 | **v2.0 仅预留**: `EvaluatorInterface` 抽象类 + `StubEvaluator` 占位 + `evaluator_reviews` 表建表 | 不实现 |

### 7.2 Hub Plan-and-Execute 流程

```
User Message
    |
    v
[Stage 1] Intent Detection (复用 v1 IntentClassifier)
    |
    v
[Stage 2] Task Planning (LLM 生成 TaskPlan, 含多个 TaskStep)
    |  --> SSE: plan_update
    v
[Stage 3-4] Dispatch + Collect (AgentDispatcher 并行/串行调度)
    |  --> SSE: plan_update (per step)
    v
[Stage 5] Evaluation (v2.0 Hub 自评, v2.1+ 委托 Evaluator)
    |
    v
[Stage 6] Memory Merge (收集 Proposals, Evidence Weighted Merge)
    |  --> SSE: memory_proposal
    v
[Stage 7] Response (组装最终响应)
    |  --> SSE: text_delta + done
```

---

## 8. 前端变更

### 8.1 v2 新增页面/组件

| 路由/组件 | 类型 | 说明 |
| --- | --- | --- |
| `/memory` | 页面 (MemoryPanel) | 知识状态雷达图 + 记忆提案/提交历史时间线 |
| AgentChat 内嵌 | 组件 (PlanProgress) | Hub TaskPlan 步骤进度条 (pending/running/completed/failed) |
| MemoryPanel 内 | 组件 (KnowledgeRadar) | 各技术 domain proficiency 雷达图可视化 |
| MemoryPanel 内 | 组件 (MemoryTimeline) | Proposal/Commit 时间线，含 agent_id/confidence/score |
| GraphPage | 升级 | 多类型边 (tfidf/dependency/topic/manual) 分色渲染，边类型筛选器 |
| AgentPage | 升级 | SSE 新增 `plan_update` / `memory_proposal` 事件渲染 |

### 8.2 v2 新增前端 Store

| Store | 职责 | 说明 |
| --- | --- | --- |
| `memoryStore` | 知识状态 + 提案 + 提交历史 | 调用 `/api/v2/memory/*` |
| `planStore` | 当前 TaskPlan 状态 | 监听 SSE `plan_update` 事件 |

### 8.3 v1 保留页面 (不变)

`LoginPage`, `RegisterPage`, `DashboardPage`, `ProjectDetailPage`, `GraphPage`, `SettingsPage`, `AgentPage` -- 全部继承 v1，部分升级 (见 8.1)。

---

## 9. 安全验收

### 9.1 v1 保留 (全部继承)

JWT 密钥强度 >= 32 bytes、密码强度 >= 8 字符含字母数字、bcrypt cost >= 12、JWT 15min 过期、修改密码失效 refresh_token、速率限制、API Key Fernet 加密存储 + 脱敏展示、PAT 独立表加密存储、URL 格式校验防 SSRF、未认证 401、ORM 参数化查询、React XSS 防护、日志脱敏 LogSanitizer、错误响应友好消息、跨用户隔离 user_id 注入、JSON 字段大小限制、Prompt 注入 PromptGuard。

### 9.2 v2 新增

| 检查项 | 标准 |
| --- | --- |
| **Proposal 防篡改** | Agent 只能提交自己 `agent_id` 的 Proposal，`POST /memory/proposals` 强制校验 `agent_id` 与当前执行 Agent 一致，不可伪造 |
| **Knowledge State 写入校验** | `proficiency` 值必须在 0-100 范围内，`PUT /knowledge-states/{domain}` 和 Proposal 均校验 |
| **Context 注入防护** | Retriever 获取的外部数据 (GitHub README / 图谱元数据 / 笔记内容) 需经 `PromptGuard.sanitize_tool_output()` 处理后再注入 AgentContext |
| **Agent 权限隔离** | ToolRegistry 执行前校验当前 Agent 是否有权调用目标工具，越权调用返回 `PERMISSION_DENIED` 错误码 |
| **Memory Merge 审计** | 每次 Merge 操作写入 `memory_commits` 表，含 `previous_value` + `committed_value` + `score`，不可删除 |
| **Plan 执行超时** | Hub Plan-and-Execute 设置 `hub_plan_timeout_seconds` (默认 30s)，超时自动终止并返回已完成步骤结果 |

---

## 10. 开发顺序

v2.0 共 12 步开发计划。每步对应一次 PR/迭代。

### Step 1: 四层架构骨架

| 项目 | 内容 |
| --- | --- |
| **输入** | v1 完整代码库 |
| **输出** | 后端目录重构为四层 (`presentation/` / `agent/` / `knowledge/` / `infrastructure/`)；Alembic 迁移 `003_v2_memory_knowledge` (建 5 个新表)；v1 全部功能回归通过 |
| **验收** | v1 全部 AC-01 ~ AC-20 回归通过；新表建表成功；`ruff check` 0 errors |
| **依赖** | 无 |

### Step 2: Knowledge Layer -- Memory Architecture 基础

| 项目 | 内容 |
| --- | --- |
| **输入** | `knowledge_states` / `memory_proposals` / `memory_commits` 表 |
| **输出** | `MemoryCRUDService` (get/create/update knowledge_states, proposals, commits)；`MemoryProposal` + `MemoryCommit` 数据类；五层 Memory Store 接口定义 |
| **验收** | AC-21 (Knowledge State CRUD)；AC-22 (Proposal 创建/查询)；单元测试覆盖 MemoryCRUDService |
| **依赖** | Step 1 |

### Step 3: Knowledge Layer -- Memory Merge Protocol

| 项目 | 内容 |
| --- | --- |
| **输入** | MemoryCRUDService |
| **输出** | `MemoryMergeService` (Evidence Weighted Merge)；`MemoryCommit.compute_score()` 实现；冲突检测与仲裁逻辑 |
| **验收** | AC-23 (Merge 单 Proposal)；AC-24 (Merge 冲突 Proposal)；AC-25 (Score 计算正确性)；100 次随机冲突场景无数据损坏 |
| **依赖** | Step 2 |

### Step 4: Knowledge Layer -- Context Engineering Pipeline

| 项目 | 内容 |
| --- | --- |
| **输入** | v1 MemoryService + Knowledge Graph 数据 |
| **输出** | `ContextEngine` (Retriever + RelevanceFilter + ContextCompressor)；`AgentContext` 数据类；Token Budget 管理 (各 Agent 预算表) |
| **验收** | AC-26 (Context Build < 2s)；Agent 收到 relevant context 而非 all context；单元测试覆盖三阶段 Pipeline |
| **依赖** | Step 1 |

### Step 5: Knowledge Layer -- Knowledge Graph 升级

| 项目 | 内容 |
| --- | --- |
| **输入** | v1 GraphService (TF-IDF) + `graph_edges` 表 |
| **输出** | `KnowledgeGraphService` (多源边构建: tfidf/dependency/topic/manual)；`GraphQueryService` (BFS 深度查询 + 边类型/权重过滤)；`/api/v2/knowledge-graph/*` 端点 |
| **验收** | AC-27 (Graph Query 多类型边)；AC-28 (BFS 深度查询正确性)；`GET /knowledge-graph/query` 响应 < 300ms |
| **依赖** | Step 1 |

### Step 6: Agent Layer -- Hub Plan-and-Execute

| 项目 | 内容 |
| --- | --- |
| **输入** | v1 HubService + IntentClassifier |
| **输出** | `PlanExecuteEngine` (7 阶段流水线)；`TaskPlan` / `TaskStep` 数据类；`AgentDispatcher` (并行/串行调度)；`HubContext` 数据类 |
| **验收** | AC-29 (Plan-and-Execute 单 Agent 任务)；AC-30 (Plan-and-Execute 多 Agent 协作)；`plan_update` SSE 事件正确推送 |
| **依赖** | Step 2, Step 4 |

### Step 7: Agent Layer -- Reasoning Engines (ToT + Reflexion)

| 项目 | 内容 |
| --- | --- |
| **输入** | v1 ReActEngine |
| **输出** | `ToTEngine` (MAX_DEPTH=3, BRANCH_FACTOR=3, Generate/Evaluate/Select)；`ReflexionEngine` (MAX_ROUNDS=3, Execute/Evaluate/Reflect)；`ToTNode` / `ReflexionRound` 数据类 |
| **验收** | AC-31 (ToT 多分支探索)；AC-32 (Reflexion 3 轮迭代)；AC-33 (Reflexion 3 轮未达标交用户确认) |
| **依赖** | Step 6 |

### Step 8: Agent Layer -- Agent 升级 + 新工具

| 项目 | 内容 |
| --- | --- |
| **输入** | v1 六个 Agent 配置 + ToolRegistry |
| **输出** | 注册 3 个新工具 (`query_knowledge_graph` / `propose_memory_update` / `get_knowledge_state`)；Mentor 配置更新 (ToT 切换条件)；Curator 配置更新 (Reflexion)；Scribe 配置更新 (双模式)；Hub 配置更新 (Plan-and-Execute)；2 个预留工具 stub |
| **验收** | AC-34 (propose_memory_update 写入 Proposal)；AC-35 (query_knowledge_graph 返回正确结果)；ToolRegistry 19 个工具注册成功 |
| **依赖** | Step 5, Step 7 |

### Step 9: Agent Layer -- Fallback Mode + Evaluator 预留

| 项目 | 内容 |
| --- | --- |
| **输入** | v1 CapabilityDetector |
| **输出** | Fallback Mode 完整降级链 (GitHub API → TF-IDF → Keyword → Rule Engine → Graph)；`StubEvaluator` 占位实现；`EvaluatorInterface` 抽象类；Degraded Mode 下 Agent 入口友好提示 |
| **验收** | AC-36 (无 Key Degraded Mode 全流程)；AC-14 回归通过；Rule Engine 分类准确率 >= 65% |
| **依赖** | Step 5, Step 8 |

### Step 10: Presentation Layer -- 前端新增

| 项目 | 内容 |
| --- | --- |
| **输入** | v2 新增 API 端点 |
| **输出** | MemoryPanel 页面 (KnowledgeRadar + MemoryTimeline)；PlanProgress 组件 (嵌入 AgentChat)；GraphPage 多类型边渲染 + 边类型筛选器；memoryStore + planStore；SSE `plan_update` / `memory_proposal` 事件处理 |
| **验收** | AC-37 (MemoryPanel 知识状态可视化)；AC-38 (PlanProgress 实时进度)；AC-39 (GraphPage 多类型边分色)；TypeScript `tsc --noEmit` 通过 |
| **依赖** | Step 5, Step 6 |

### Step 11: 集成测试 + E2E

| 项目 | 内容 |
| --- | --- |
| **输入** | v2 全部端点 + 前端页面 |
| **输出** | 集成测试覆盖所有 v2 新增端点；E2E 7 条 happy path；Memory Merge 一致性测试 (100 次随机冲突)；Context Pipeline 端到端测试 |
| **验收** | 7 条 E2E 全部通过 (见 13.1)；所有 v2 端点有集成测试；Service 层覆盖率 >= 75% |
| **依赖** | Step 1 ~ Step 10 |

### Step 12: 质量门禁 + 发布

| 项目 | 内容 |
| --- | --- |
| **输入** | v2 全部代码 |
| **验收** | 后端 lint 0 errors/warnings；前端 lint 0 errors/warnings；TypeScript 无 any；后端 Service 层 >= 75% (核心 100% / Agent 80% / 业务 75%)；前端 Store >= 60%；OpenAPI 文档完整；性能指标全部达标 (见 12)；安全验收全部通过 (见 9) |
| **依赖** | Step 11 |

---

## 11. 验收标准

### 11.1 v1 保留验收 (AC-01 ~ AC-20)

AC-01 ~ AC-20 全部继承 v1 (见 v1 MVP_SCOPE §9.1)，无变更。

### 11.2 v2 新增验收 (AC-21 ~ AC-42)

| 编号 | 场景 | 输入条件 | 预期输出 |
| --- | --- | --- | --- |
| AC-21 | Knowledge State CRUD | 调用 `GET /api/v2/memory/knowledge-states` | 返回用户所有 domain + proficiency 列表，按 proficiency DESC 排序 |
| AC-22 | Proposal 创建 | Mentor 调用 `propose_memory_update` 工具，提交 `{target_layer: "knowledge_state", key: "python", value: 85, confidence: 0.88, evidence: ["correctly explained decorators"]}` | `memory_proposals` 表新增一条记录，status=pending |
| AC-23 | Merge 单 Proposal | Hub 收集到 1 个 pending Proposal (confidence=0.88, evidence_count=1) | `memory_commits` 新增记录，score = recent_weight * 0.88 * min(1.0, 1/3)，目标层值更新 |
| AC-24 | Merge 冲突 Proposal | Mentor 提交 `docker=75 (conf=0.83, evidence=3)` + Navigator 提交 `docker=50 (conf=0.65, evidence=1)` | Hub 计算两者 score，采纳高分方 (Mentor)，memory_commits 记录 previous_value 和 committed_value |
| AC-25 | Score 计算公式 | confidence=0.8, evidence_count=3, hours_since_last=12 | score = min(1.0, 12/24) * 0.8 * min(1.0, 3/3) = 0.5 * 0.8 * 1.0 = 0.4 |
| AC-26 | Context Build 延迟 | 用户发送消息，Context Engine 构建 Agent 上下文 | Retriever + Filter + Compressor 全流程 < 2s |
| AC-27 | Graph Query 多类型边 | `GET /knowledge-graph/query?edge_type=tfidf,dependency&min_weight=0.3` | 返回仅含 tfidf 和 dependency 类型、weight >= 0.3 的边和对应节点 |
| AC-28 | BFS 深度查询 | `GET /knowledge-graph/query?project_id=xxx&depth=2` | 返回从 project_id 出发 2 层 BFS 可达的所有边和节点 |
| AC-29 | Plan-and-Execute 单 Agent | 用户: "快速分析 fastapi 项目" | Hub 生成 1-step Plan (agent=scout)，Dispatch 后返回分析结果，SSE 推送 plan_update 事件 |
| AC-30 | Plan-and-Execute 多 Agent | 用户: "对比我库里的 Flask 和 FastAPI" | Hub 生成 2-step Plan (step1: scout 获取结构数据, step2: mentor 教学对比)，顺序执行，SSE 推送各步骤状态 |
| AC-31 | ToT 多分支探索 | Mentor 收到复杂概念问题 "解释 K8s 调度器" | ToT 生成 >= 2 个分支，每个分支评分，选择最高分路径输出，总耗时 < 15s |
| AC-32 | Reflexion 3 轮迭代 | Curator 对 200+ 项目执行重新分类 | 第 1 轮生成候选分类 → 评估发现问题 → 第 2 轮修正 → 评估通过，总轮数 <= 3 |
| AC-33 | Reflexion 超时交用户 | Curator 3 轮 Reflexion 后 confidence 仍 < 0.7 | 返回 `needs_user_confirm=true`，前端弹窗让用户手动确认 |
| AC-34 | propose_memory_update | Mentor 调用工具提交 Proposal | `memory_proposals` 表写入，`POST /agent/chat` SSE 推送 `memory_proposal` 事件 |
| AC-35 | query_knowledge_graph | Navigator 调用工具查询图谱 | 返回 nodes + edges 结构，支持 edge_type 和 min_weight 过滤 |
| AC-36 | Degraded Mode 全流程 | 不配置 LLM Key | 导入项目成功 + TF-IDF 自动分类 + 图谱浏览 + 手动管理全部正常；Agent 对话入口显示 "配置 API Key 解锁 AI 功能" 提示 |
| AC-37 | MemoryPanel 可视化 | 打开 `/memory` 页面 | 知识状态雷达图渲染 + 提案/提交历史时间线展示 |
| AC-38 | PlanProgress 实时进度 | Hub 执行多步 Plan | AgentChat 内嵌 PlanProgress 组件实时更新各步骤状态 (pending → running → completed) |
| AC-39 | GraphPage 多类型边 | 打开图谱页 | tfidf/dependency/topic/manual 边分色渲染，边类型筛选器可用 |
| AC-40 | Scribe Project Mode | Scribe 在 Project Mode 下为 React 项目生成笔记 | 自动检索已有 React 相关笔记和 Graph 关联项目，Similarity > Threshold 时调用 Compare Tool |
| AC-41 | Scribe Standalone Mode | Scribe 在 Standalone Mode 下为全新 Rust 项目写笔记 | Similarity < Threshold，直接独立辅助，不调用 RAG 检索 |
| AC-42 | Proposal 防篡改 | Agent A 尝试提交 `agent_id=Agent_B` 的 Proposal | 返回 `PERMISSION_DENIED` 错误，Proposal 未写入 |

---

## 12. 性能验收

| 指标 | v1 基线 | v2 目标 | 测试方法 |
| --- | --- | --- | --- |
| 页面首屏加载 | < 2s | < 1.5s | Lighthouse Performance >= 80 |
| API 响应 (CRUD, P95) | < 500ms | < 400ms | 100 次请求取 P95 |
| 图谱渲染 (500 节点) | < 2s (100 节点) | < 1.5s (500 节点) | 手动计时 |
| Star 导入 (100 个项目) | < 10s | < 10s | 手动计时 |
| TF-IDF 计算 (200 个项目) | < 3s | < 3s | 单元测试计时 |
| **Memory Merge (单次)** | -- | **< 500ms** | Proposal 分组 + Score 计算 + 持久化，单元测试计时 |
| **Context Build (全流程)** | -- | **< 2s** | Retriever + Filter + Compressor，集成测试计时 |
| **Hub Plan 首响应** | -- | **< 8s** | Intent + Plan + 首个 Agent Dispatch，E2E 计时 |
| **ToT 完整执行** | -- | **< 15s** | 3 层 x 3 分支含 LLM 评估，集成测试计时 |
| **Reflexion 单轮** | -- | **< 5s** | Execute + Evaluate + Reflect，集成测试计时 |
| **Graph Query 响应** | -- | **< 300ms** | 单次查询 (100 条边)，集成测试计时 |
| Agent 首 token | < 3s | < 2.5s | Hub 编排开销需 < 200ms |

---

## 13. 质量门禁

### 13.1 E2E 测试清单

v2.0 发布前必须全部通过 7 条 E2E happy path:

| # | 场景 | 步骤 | 预期结果 |
| --- | --- | --- | --- |
| E2E-01 | 注册 → 导入 → 图谱 → 笔记 → Agent 对话 (继承 v1) | 注册 → 绑定 GitHub → Star 导入 → 查看图谱 → 创建笔记 → Scout 分析 | 全流程 < 5 分钟，无报错 |
| E2E-02 | Memory Merge 冲突解决 | Mentor + Navigator 对同一 domain 提交冲突 Proposal → Hub Merge | 高分 Proposal 被采纳，memory_commits 记录审计信息 |
| E2E-03 | Context Engineering Pipeline 端到端 | 发送复杂问题 → Retriever 检索 → Filter 过滤 → Compressor 压缩 → Agent 收到精炼上下文 | Agent 响应质量优于 v1 (人工评审)；Context Build < 2s |
| E2E-04 | Knowledge Graph Query 多 Agent 调用 | Scout + Navigator + Mentor 分别调用 `query_knowledge_graph` | 各 Agent 获取到符合其角色的图谱子集 |
| E2E-05 | Fallback Mode 完整降级 | 清除 LLM 配置 → 导入项目 → 自动分类 → 图谱浏览 → Agent 入口提示 | 所有非 AI 功能正常；分类准确率 >= 65%；友好提示展示 |
| E2E-06 | Reflexion Workflow 分类优化 | 触发 Curator 重新分类 200+ 项目 | Reflexion <= 3 轮；最终分类无重复/命名一致；confidence >= 0.7 |
| E2E-07 | Plan-and-Execute 多 Agent 协作 | 用户请求 "对比 Flask 和 FastAPI" | Hub 生成多步 Plan → Scout 获取数据 → Mentor 对比讲解 → Memory Merge → 统一响应 < 8s |

### 13.2 工程质量验收

| 检查项 | v1 标准 | v2 标准 | 工具 |
| --- | --- | --- | --- |
| 后端 lint | 0 errors, 0 warnings | 0 errors, 0 warnings | `ruff check` |
| 前端 lint | 0 errors, 0 warnings | 0 errors, 0 warnings | `eslint --max-warnings 0` |
| TypeScript | 编译通过，无 any | 编译通过，无 any | `tsc --noEmit` |
| 后端单测覆盖率 | Service >= 70% | **Service >= 75% (核心 100%, Agent 80%, 业务 75%)** | `pytest --cov` |
| 前端单测覆盖率 | 工具函数 + Store >= 60% | 工具函数 + Store >= 60% | `vitest --coverage` |
| 集成测试 | 所有 v1 端点 | 所有 v1 + v2 端点 | `pytest` |
| E2E 测试 | 5 条 happy path | **7 条 happy path** | `playwright test` |
| OpenAPI 文档 | 所有端点有 description | 所有 v1 + v2 端点有 description | 访问 /docs |
| Memory Merge 一致性 | -- | **100 次随机 Proposal 冲突场景无数据损坏** | 自定义压力测试脚本 |

---

## 附录 A: 版本标识

应用启动时在后端日志和前端 About 区域显示:

```
RepoPilot v2.0.0
Based on v2 PRD / SPEC / MVP_SCOPE
Multi-Agent Driven GitHub Learning OS
```

## 附录 B: 错误码扩展 (v2 新增)

```python
ERROR_CODES_V2 = {
    # Memory
    "MEMORY_PROPOSAL_INVALID": "记忆提案格式无效",
    "MEMORY_PROPOSAL_FORBIDDEN": "Agent 无权提交该类型记忆提案",
    "MEMORY_MERGE_FAILED": "记忆合并失败",
    "KNOWLEDGE_STATE_OUT_OF_RANGE": "知识掌握度必须在 0-100 范围内",
    # Knowledge Graph
    "GRAPH_EDGE_NOT_FOUND": "图谱边不存在",
    "GRAPH_EDGE_IMMUTABLE": "仅允许删除 manual 类型的边",
    "GRAPH_QUERY_TIMEOUT": "图谱查询超时",
    # Plan
    "PLAN_NOT_FOUND": "任务计划不存在",
    "PLAN_EXECUTION_TIMEOUT": "任务计划执行超时",
    "PLAN_STEP_FAILED": "任务步骤执行失败",
    # Agent Permission
    "AGENT_TOOL_PERMISSION_DENIED": "Agent 无权调用该工具",
    # Context
    "CONTEXT_BUILD_FAILED": "上下文构建失败",
    "CONTEXT_BUDGET_EXCEEDED": "上下文超出 Token 预算",
    # Evaluator (v2.1+)
    "EVALUATOR_NOT_AVAILABLE": "评估功能将在 v2.1 版本推出",
}
```

## 附录 C: 预设分类种子数据 (继承 v1)

```python
PRESET_CATEGORIES = [
    {"name": "Web 前端", "icon": "layout", "color": "#61dafb"},
    {"name": "Web 后端", "icon": "server", "color": "#68a063"},
    {"name": "AI / 机器学习", "icon": "brain", "color": "#ff6f61"},
    {"name": "数据科学", "icon": "bar-chart", "color": "#f7df1e"},
    {"name": "DevOps / 运维", "icon": "cloud", "color": "#ff9900"},
    {"name": "移动开发", "icon": "smartphone", "color": "#3ddc84"},
    {"name": "桌面应用", "icon": "monitor", "color": "#0078d4"},
    {"name": "游戏开发", "icon": "gamepad", "color": "#e60012"},
    {"name": "安全", "icon": "shield", "color": "#ff4081"},
    {"name": "工具 / 库", "icon": "wrench", "color": "#9e9e9e"},
    {"name": "学习资源", "icon": "book", "color": "#8bc34a"},
    {"name": "其他", "icon": "folder", "color": "#607d8b"},
]
```
