# RepoPilot v2 — Product Requirements Document (PRD)

> 版本: 2.0.0 | 日期: 2026-07-04 | 状态: 草稿
>
> **发布策略:** v2.0 基于 v1.0 迭代，引入 Multi-Agent Architecture 升级。MVP_SCOPE.md 的范围即 v2.0 全部交付内容。

---

## 1. 产品愿景

RepoPilot v2 是一个 **Multi-Agent Driven GitHub Learning Operating System（多智能体驱动的 GitHub 学习操作系统）**。

相比 v1 的"AI 驱动的开源项目学习平台"定位，v2 完成了一次架构层面的跃迁：从单一路由式 Agent 系统升级为具备 **自主规划、记忆合并、上下文工程、知识图谱推理** 能力的多智能体操作系统。

**v2 核心升级点:**

| 维度 | v1 | v2 |
| --- | --- | --- |
| 系统定位 | AI 驱动的开源项目学习平台 | Multi-Agent Driven GitHub Learning OS |
| Agent 数量 | 6 Agent (Scout/Mentor/Navigator/Curator/Scribe/Hub) | 7 Agent (+Evaluator，MVP 不含实现) |
| 架构层次 | 前后端 + Agent 平铺 | 四层架构：Presentation → Agent → Knowledge → Infrastructure |
| Hub 角色 | 简单路由器（Routing） | Chief Agent（Plan-and-Execute Workflow） |
| 记忆系统 | UserProfile + 会话历史压缩 | 五层 Memory Architecture + Memory Merge Protocol |
| 上下文管理 | 直接传递 | Context Engineering Pipeline（Retriever → Filter → Compress → Agent） |
| 推理模式 | 基础 ReAct | ReAct / Tree of Thoughts / Graph of Thoughts / Reflexion |
| 知识图谱 | 展示用（TF-IDF 力导向图） | 所有 Agent 共享的查询工具（Graph Query） |
| 降级策略 | 无 LLM 时功能受限 | 完整的 Fallback Mode（无 Key 下仍可分析、分类、图谱浏览） |

**核心差异化:** RepoPilot 不是 GitHub Copilot，不是 RAG 聊天机器人，不是单纯的 GitHub 分析工具。它是一个完整的 Agent System——每一个 Repository 都值得拥有一个 AI Mentor。

**一句话定位:** Every Repository deserves an AI Mentor.

---

## 2. 目标用户

| 用户画像 | 特征 | 痛点 | 需求 |
| --- | --- | --- | --- |
| Beginner（技术学习者） | 刚开始阅读开源项目，大量 Star 但缺乏系统学习 | 不知道从哪里开始，收藏容易学习难 | 引导式学习、项目拆解、进度追踪 |
| Intermediate（全栈开发者） | 已能看懂代码，关注前后端多个领域 | 需要快速理解架构，项目间缺乏联系 | 架构拆解、交叉对比、适用场景分析 |
| Advanced（开源爱好者） | 深度参与开源社区，阅读大型仓库 | 需要维护自己的知识库，技术选型困难 | 知识图谱、横向对比、技术演进分析 |
| Teacher（技术教育者） | 制作教学材料，组织学习路线 | 缺乏项目全景视图，教学素材准备耗时 | 图谱总览、学习路线导出、分类统计、Agent 辅助备课 |

> **v2 新增:** Teacher 角色在 v1 中仅作为预留提及，v2 正式纳入目标用户。Navigator Agent 的"学习路线导出"和 Curator Agent 的"分类统计"功能为 Teacher 角色提供直接支持。

---

## 3. 功能模块

### 3.1 四层架构总览

v2 采用四层分层架构，每层职责清晰、接口标准化：

```
┌──────────────────────────────────────────────────────┐
│  Presentation Layer（表现层）                          │
│  Web UI / Desktop (pywebview) / Chat Interface       │
├──────────────────────────────────────────────────────┤
│  Agent Layer（智能体层）                               │
│  Hub (Chief) + 6 Specialized Agents                  │
│  Plan-and-Execute / ReAct / ToT / GoT / Reflexion   │
├──────────────────────────────────────────────────────┤
│  Knowledge Layer（知识层）                             │
│  Memory Architecture / Knowledge Graph /             │
│  Context Engineering Pipeline / Vector Store          │
├──────────────────────────────────────────────────────┤
│  Infrastructure Layer（基础设施层）                     │
│  GitHub API / LLM Provider / DB / TF-IDF / Embedding │
└──────────────────────────────────────────────────────┘
```

### 3.2 用户系统 (User System)

| 功能 | 优先级 | 描述 | v1→v2 变更 |
| --- | --- | --- | --- |
| 注册/登录 | P0 | 用户名+密码注册，JWT Token 认证 | 继承 v1 |
| 修改密码 | P0 | 旧密码验证 + 新密码设置 | 继承 v1 |
| 绑定 GitHub | P0 | 手动绑定 GitHub 账号（用户名 + PAT），用于 Star 同步；OAuth 推迟到后续版本 | 继承 v1 |
| 用户头像 | P1 | 上传头像或使用 GitHub 头像 | 继承 v1 |
| 记住密码/保持登录 | P0 | 可选的持久化登录状态 | 继承 v1 |
| 用户设置 | P1 | 主题、字体、缩放等个性化配置 | 继承 v1 |
| **User Profile 管理** | **P0** | **五层 User Profile 可视化编辑：职业、语言、学习目标、技术栈、偏好设置** | **v2 新增** |

### 3.3 项目管理 (Project Management)

| 功能 | 优先级 | 描述 | v1→v2 变更 |
| --- | --- | --- | --- |
| GitHub Star 批量导入 | P0 | 拉取 GitHub Star 列表，一键批量导入 | 继承 v1 |
| 手动添加项目 | P0 | 填写名称、URL、分类、标签、描述等 | 继承 v1 |
| 编辑/删除项目 | P0 | CRUD 操作 | 继承 v1 |
| JSON 导入/导出 | P1 | 批量数据迁移 | 继承 v1 |
| 项目搜索 | P0 | 按名称、分类、标签、语言搜索 | 继承 v1 |
| 筛选/排序 | P0 | 按分类、语言、Star 数、学习进度筛选 | 继承 v1 |
| 列表/卡片双视图 | P1 | 切换项目展示模式 | 继承 v1 |

### 3.4 AI Agent 系统 (核心差异化)

#### 3.4.1 系统定位

RepoPilot v2 的 Agent 系统是由 **7 个专业 Agent** 协同工作的开源项目学习专家网络。v2 中 Hub 从简单路由器升级为 **Chief Agent**，采用 **Plan-and-Execute Workflow** 统筹全局；新增 Evaluator Agent 定义（MVP 不含实现）。系统遵循五大核心原则：**BYOK（Bring Your Own Key）、深度优先、主动反问、有记忆、可配置**。

> Agent 系统的完整设计（核心原则详述、角色行为、Memory Architecture 详细设计、Memory Merge Protocol、Context Engineering Pipeline、工具集、交互协议、降级策略、个性定义）请参阅 **[AGENT_PRD.md](./AGENT_PRD.md)**。

#### 3.4.2 Agent 角色总览

| Agent | 代号 | 定位 | 核心 Workflow | 触发场景 |
| --- | --- | --- | --- | --- |
| 对话管家 | **Hub** | Chief Agent — 规划、调度、记忆合并 | Plan-and-Execute | 全局对话入口 |
| 快速分析 Agent | **Scout** | Repository Analyst — 30s 快速分析 | ReAct | 导入项目、"快速分析"按钮 |
| 深度讲解 Agent | **Mentor** | AI Teacher — 定制化教学 | Adaptive (ReAct / ToT / GoT) | 项目详情页、对话提问 |
| 学习规划 Agent | **Navigator** | Learning Planner — 规划学习路线 | ReAct | 学习规划页、对话提问 |
| 分类文档 Agent | **Curator** | Knowledge Organizer — 智能分类 | Reflexion | 导入建议分类、手动重新分类 |
| 笔记助手 Agent | **Scribe** | Knowledge Recorder — 辅助笔记 | ReAct | 笔记编辑器 AI 按钮 |
| 评估 Agent | **Evaluator** | Quality Reviewer — 质量审查 | Reflexion | **MVP 不含实现，仅 PRD 定义** |

#### 3.4.3 Hub 作为 Chief Agent

v2 中 Hub 不再是简单的路由器，而是整个 Agent 系统的 **Chief Agent**。它负责：

- **Intent Detection** — 识别用户意图
- **Task Planning** — 将用户请求拆解为可执行的 Task Plan
- **Workflow Scheduling** — 调度 Specialized Agents 执行任务
- **Context Management** — 管理全局上下文，避免 Context Explosion
- **Memory Merge** — 通过 Memory Merge Protocol 合并各 Agent 的记忆提案
- **User Profile Review** — 维护和更新 User Profile
- **Conflict Resolution** — 解决 Agent 间的信息冲突
- **Evaluation** — 评估任务执行结果

**Plan-and-Execute Workflow:**

```
User Intent
    ↓
Task Plan（Hub 规划）
    ↓
Dispatch（分发给 Specialized Agents）
    ↓
Collect（收集结果）
    ↓
Evaluate（评估质量）
    ↓
Merge（Memory Merge）
    ↓
Response
```

**Hub 的记忆边界:** Hub 只持有 Conversation Summary + Task Result Summary + Long Memory + User Profile，不持有所有 Agent 的完整 Context，以避免 Context Explosion。

#### 3.4.4 Evaluator Agent（v2 定义，MVP 不含实现）

Evaluator 是 v2 新增的第 7 个 Agent，定位为 **Quality Reviewer**。它的完整设计纳入 PRD 定义，但 MVP 开发范围不包含实现。

**职责:**

- Review Hub 的决策质量
- 检查 Memory 冲突与一致性
- 验证 Agent 回答质量（Accuracy、Completeness、Grounding）
- 判断是否需要重新规划（Re-plan Trigger）
- 对 Agent 输出进行自动评分

**闭环 Workflow:**

```
User
  ↓
Hub（Plan）
  ↓
Specialized Agents（Execute）
  ↓
Hub（Merge）
  ↓
Evaluator（Review）  ← v2 新增环节
  ↓
Memory Update
  ↓
Response
```

**Workflow:** Reflexion — Evaluator 对自身评估结果进行反思迭代，确保评分稳定性。

> **实现状态:** 定义完成，MVP 不含。Evaluator 的接口规范和评分维度将在 AGENT_PRD 中详细定义，后续版本（v2.1+）实现。

### 3.5 Memory Architecture（v2 新增）

v2 引入五层 Memory Architecture，替代 v1 简单的"UserProfile + 会话历史"模式：

| 层级 | 名称 | 内容 | 更新频率 | 维护者 |
| --- | --- | --- | --- | --- |
| L1 | User Profile | 职业、语言、学习目标 | 长期稳定，手动/低频自动 | Hub |
| L2 | Preference | 代码优先/图示偏好、输出格式（Markdown/纯文本） | 中期，随交互学习 | Hub + Mentor |
| L3 | Knowledge State | 各技术掌握度评分（如 Python: 92, FastAPI: 31, React: 70） | 频繁，每次学习后更新 | Mentor 为主 |
| L4 | Long Memory | 学习历史、完成项目、失败记录、里程碑 | 持久化，按事件追加 | Hub + 各 Agent Proposal |
| L5 | Short Memory | Agent 私有短期上下文（如 Mentor 最近三轮教学、Scout 最近三个 Repository） | 易失，滑动窗口 | 各 Agent 自维护 |

#### 3.5.1 Memory Merge Protocol

v2 核心机制：任何 Agent **不能直接修改** 共享记忆，只能通过 Proposal 机制提交变更，由 Hub 执行 Evidence Weighted Merge。

**Protocol 流程:**

```
Agent 生成 Proposal
    ↓
附带 Evidence（证据链）
    ↓
计算 Confidence（置信度 0~1）
    ↓
Hub 审核（Evidence Weighted Merge）
    ↓
Commit 到 Memory Store
```

**Proposal 格式示例:**

```json
{
  "agent": "Mentor",
  "target": "KnowledgeState.FastAPI",
  "value": 45,
  "previous": 31,
  "confidence": 0.83,
  "evidence": [
    "用户正确回答了 FastAPI 依赖注入相关问题",
    "用户能描述 async/await 在 FastAPI 中的用法"
  ],
  "timestamp": "2026-07-04T10:30:00Z"
}
```

**Merge 策略:** 非投票制，而是 `Recent Weight × Confidence × Evidence Score` 加权计算。多 Agent 对同一字段提交冲突 Proposal 时，Hub 根据加权分决定采纳或要求补充 Evidence。

### 3.6 Context Engineering Pipeline（v2 新增）

v2 引入 Context Engineering Pipeline，确保每个 Agent 收到的是 **Relevant Context** 而非 **All Context**，避免 Token 爆炸。

**Pipeline 流程:**

```
User Query
    ↓
Retriever（检索相关 Memory / Graph / History）
    ↓
Filter（过滤无关和低置信度信息）
    ↓
Compress（压缩和摘要化）
    ↓
Agent（接收精炼上下文）
```

| 功能 | 优先级 | 描述 |
| --- | --- | --- |
| Context Retriever | P0 | 从 Memory Store / Knowledge Graph / Conversation History 检索相关上下文 |
| Context Filter | P0 | 按相关性评分过滤，去除低置信度和无关信息 |
| Context Compressor | P1 | 对长文本执行摘要压缩，控制 Token 预算（目标 < 8k tokens per Agent turn） |
| Context Budget Manager | P1 | 动态分配各 Agent 的 Context Token 预算，Hub 全局调度 |

### 3.7 Knowledge Graph 系统（v2 升级）

v1 的图谱仅用于前端展示（TF-IDF 力导向图）。v2 将 Knowledge Graph 升级为 **所有 Agent 共享的查询工具**：

| 功能 | 优先级 | 描述 | v1→v2 变更 |
| --- | --- | --- | --- |
| 图谱可视化 | P0 | 力导向图，交互式缩放/拖拽/搜索 | 继承 v1，增强渲染 |
| **Graph Query API** | **P0** | **所有 Agent 可通过标准 API 查询图谱节点和边** | **v2 新增** |
| **多源图谱构建** | **P0** | **图谱来源：TF-IDF / Embedding / Dependency / GitHub Topic / Manual Relation** | **v2 新增** |
| **图谱推理** | **P1** | **基于图结构进行关联推荐（如 "与 FastAPI 相关的项目"）** | **v2 新增** |
| 分类统计图 | P1 | 饼图/柱状图展示分类、语言、进度分布 | 继承 v1 |
| 学习进度看板 | P2 | 追踪各分类的学习完成度 | 继承 v1 |
| 时间线 | P2 | 项目导入和学习的时间线视图 | 继承 v1 |

### 3.8 推理模式系统（v2 新增）

v2 为不同 Agent 配置最适合其任务的推理模式：

| 推理模式 | 描述 | 使用 Agent | 优先级 |
| --- | --- | --- | --- |
| ReAct | 标准 Think-Act-Observe 循环 | Scout / Navigator / Scribe / Hub | P0 |
| Tree of Thoughts (ToT) | 多分支探索，评估后选最优路径 | Mentor（复杂概念讲解） | P0 |
| Graph of Thoughts (GoT) | 多方案并行生成 + 交叉评估 | Mentor（多讲解方案对比） | P1 |
| Reflexion | 自我反思迭代，最多 N 轮 | Curator（分类优化）/ Evaluator（质量审查） | P0 |

### 3.9 降级模式 (Fallback Mode)（v2 新增）

v2 引入完整的降级策略，确保无 API Key 时系统仍具备核心功能：

| 模式 | 条件 | 可用能力 | 优先级 |
| --- | --- | --- | --- |
| Full Mode | 有 API Key + LLM 可用 | 全部 Agent 功能、Memory Merge、Context Engineering | P0 |
| **Degraded Mode** | **无 API Key 或 LLM 不可用** | **GitHub API 分析、TF-IDF 分类、关键词匹配、Rule Engine、Graph 浏览** | **P0** |
| Offline Mode | 无网络 | 本地缓存数据浏览、已有笔记查看 | P2 |

**Degraded Mode 能力链:**

```
GitHub API → TF-IDF → Keyword → Rule Engine → Graph
```

用户在 Degraded Mode 下几乎无感知降级，Agent 相关功能显示友好提示引导配置 Key。

### 3.10 笔记系统 (Note System)

| 功能 | 优先级 | 描述 | v1→v2 变更 |
| --- | --- | --- | --- |
| Markdown 笔记 | P0 | 每个项目支持创建多篇 Markdown 笔记 | 继承 v1 |
| MD 预览 | P0 | 实时预览，支持代码高亮、表格、图片 | 继承 v1 |
| AI 辅助笔记 | P1 | Scribe Agent 根据项目内容帮助生成笔记大纲或内容 | 继承 v1 |
| **Project Mode** | **P1** | **Scribe 自动检索学习 History、Graph Similarity、Memory，与当前笔记关联** | **v2 新增** |
| **Standalone Mode** | **P1** | **Scribe 完全独立模式，仅在 Similarity > Threshold 时调用 Compare Tool（按需 RAG）** | **v2 新增** |
| 笔记搜索 | P1 | 跨项目全文搜索笔记内容 | 继承 v1 |
| 笔记导出 | P2 | 导出为 PDF/Markdown | 继承 v1 |

### 3.11 分类系统 (Classification System)

| 功能 | 优先级 | 描述 | v1→v2 变更 |
| --- | --- | --- | --- |
| 预设分类 | P0 | 内置常用分类（前端、后端、AI、DevOps 等） | 继承 v1 |
| 自定义分类 | P0 | 用户可添加/删除/重命名分类 | 继承 v1 |
| 多标签 | P0 | 项目可打多个标签 | 继承 v1 |
| Agent 建议分类 | P1 | 导入时 Curator Agent 自动建议分类（v2 使用 Reflexion Workflow） | v1 继承，v2 增强 |
| 批量重分类 | P2 | Curator Agent 辅助批量调整项目分类 | 继承 v1 |

---

## 4. 非功能需求

### 4.1 性能

| 指标 | v1 标准 | v2 标准 | 说明 |
| --- | --- | --- | --- |
| 页面首屏加载 | < 2s | < 1.5s | v2 四层架构优化前端 Bundle |
| API 响应 | < 500ms | < 400ms | 不含 Agent 调用 |
| Agent 流式首 token | < 3s | < 2.5s | Scout 快速分析 < 4s |
| 图谱渲染 (500 节点) | < 2s | < 1.5s | v2 Knowledge Layer 预计算 |
| Context 组装 | < 200ms | < 150ms | Context Engineering Pipeline |
| Memory Merge 延迟 | — | < 500ms | v2 新增，单次 Merge 操作 |
| Graph Query 响应 | — | < 300ms | v2 新增，单次查询 |
| Agent 反问面板渲染 | < 500ms | < 400ms | 继承 v1 并优化 |

### 4.2 安全

| 措施 | 优先级 | 描述 | v1→v2 变更 |
| --- | --- | --- | --- |
| JWT Token 认证 | P0 | Token 过期 + Refresh Token 机制 | 继承 v1 |
| 密码 bcrypt 哈希 | P0 | 安全存储 | 继承 v1 |
| HTTPS 传输加密 | P0 | 部署时强制 | 继承 v1 |
| CSRF/XSS 防护 | P0 | 标准 Web 安全 | 继承 v1 |
| API 速率限制 | P0 | Agent 端点额外限流 | 继承 v1 |
| SQL 注入防护 | P0 | 输入校验 + ORM 参数化 | 继承 v1 |
| API Key 加密存储 | P0 | 不明文、不暴露给前端 | 继承 v1 |
| Prompt 注入防护 | P0 | 输入过滤 + 输出校验 | 继承 v1 |
| **Agent 权限隔离** | **P0** | **工具权限分级，Agent 不能越权调用其他 Agent 的工具** | **v2 增强** |
| **Memory 写入审计** | **P0** | **所有 Memory 变更通过 Proposal 机制，留审计日志** | **v2 新增** |
| **Context 隔离** | **P0** | **Agent 间 Context 不直接共享，通过 Hub 中转** | **v2 新增** |

### 4.3 兼容性

- 桌面端: Windows 10+, macOS 12+（pywebview/Electron）
- Web 端: Chrome 90+, Firefox 90+, Safari 15+, Edge 90+
- 响应式布局: 最小宽度 900px

### 4.4 可维护性

- 四层架构分层清晰，层间接口标准化
- **代码覆盖率:** Service 层 ≥ 75%（核心安全模块 100%，Agent 模块 80%，业务模块 75%）
- 完善的 API 文档（OpenAPI 3.0）
- 统一的代码规范（ESLint / Ruff / Prettier）
- Agent 配置标准化（AGENT.md / SOUL.md / config.yaml），支持导入导出
- **v2 新增:** Knowledge Layer 接口标准化，Agent 可通过统一 Tool Schema 访问 Knowledge Graph 和 Memory Store

---

## 5. 用户故事 (核心场景)

### US-01: 新用户入门 — 导入与自动分析

> 作为一名开发者，我注册 RepoPilot 后绑定 GitHub 账号，一键导入 200+ Star 项目。Scout Agent 自动对每个项目执行快速分析（ReAct Workflow），Curator Agent 通过 Reflexion Workflow 自动建议分类并弹出确认面板。我看到一个基于 TF-IDF + Embedding 多源构建的知识图谱，发现我的 React 和 Vue 项目之间有很多相似的技术模式。Hub Agent 在后台执行首次 Memory Merge，将 Scout 和 Curator 的分析结果写入 Long Memory。

### US-02: 深度学习 — Mentor 定制化教学

> 我想学 Next.js，打开项目详情页。Mentor Agent 通过 Context Engineering Pipeline 获取我的 Knowledge State（React: 85, Node.js: 72），弹出反问面板确认我的 Server Components 理解程度。然后 Mentor 采用 Tree of Thoughts 模式，从"源码路线"和"生活类比"两个分支并行探索，评估后选择最适合我水平的讲解路径。Mentor 对比了我已有的 React 和 Express 项目经验，生成定制化讲解。学习结束后，Mentor 提交 Proposal 更新我的 Knowledge State（Next.js: 25 → 48）。

### US-03: 交叉学习 — 多 Agent 协作

> 我问 Agent "对比我库里的 Flask 和 FastAPI"。Hub（Chief Agent）执行 Plan-and-Execute：先 Dispatch 给 Scout 获取两个项目的结构对比数据，再 Dispatch 给 Mentor 进行教学式对比。Mentor 从路由设计、中间件机制、异步支持、性能基准四个维度对比，并结合 Knowledge Graph 中两个项目的关联节点给出深度分析。Hub 收集两个 Agent 的结果后执行 Merge，生成统一回复。

### US-04: 学习规划 — Navigator + Knowledge Graph

> 我告诉 Navigator "我想在 3 个月内成为全栈开发者"。Navigator 查询 Knowledge Graph 获取我所有项目的技术关联图，结合 Knowledge State（JS 精通、Python 入门），规划了一条从 React 深入 → FastAPI 入门 → 全栈融合的 10 周学习路径。每个阶段都有明确的里程碑和推荐项目。Navigator 同时查询 Long Memory 获取我过去的学习速度数据，动态调整每周任务量。

### US-05: 记忆合并 — Memory Merge Protocol

> 在一次学习会话中，Mentor 认为我已经掌握了 Docker 基础（Confidence: 0.83），但 Navigator 根据我的学习历史认为我还不够熟练（Confidence: 0.65）。两个 Agent 对 `KnowledgeState.Docker` 提交了冲突的 Proposal。Hub 执行 Evidence Weighted Merge：Mentor 的 Evidence 包含"用户正确回答了 Docker Compose 多容器编排问题"等具体证据，Navigator 的 Evidence 是"用户上次 Docker 项目只完成了 60%"。Hub 根据 `Recent Weight × Confidence × Evidence Score` 计算后采纳 Mentor 的评估，但在 Knowledge State 中标注了"待进一步验证"。

### US-06: 知识图谱查询 — Graph Query

> 在图谱中我看到 D3.js 和 Three.js 之间有一条连线。我点击后，系统通过 Graph Query API 展示两者的关联路径：D3.js → SVG → WebGL → Three.js。Navigator Agent 解释了两者的不同定位（2D 数据可视化 vs 3D 渲染），并基于 Graph 推理推荐了 PixiJS 作为两者之间的过渡项目。

### US-07: 无 Key 降级使用 — Fallback Mode

> 我没有配置 API Key，但系统自动切换到 Degraded Mode。我仍然可以通过 GitHub API 导入 Star 项目、使用 TF-IDF + 关键词规则自动分类、查看基于 Dependency 和 GitHub Topic 构建的知识图谱、手动管理项目和笔记。Agent 对话功能显示友好的引导提示，告知我配置 Key 后可解锁 Scout 快速分析、Mentor 定制教学等全部 AI 功能。Degraded Mode 下，Curator 使用 Rule Engine 替代 LLM 进行分类建议，准确率约 70%。

### US-08: Teacher 角色 — 教学材料生成

> 作为一名技术培训师，我需要为团队准备一份 FastAPI 入门教程。我使用 Navigator 生成了一条针对"有 Python 基础的后端开发者"的学习路线，然后用 Scribe Agent 的 Project Mode 自动检索团队已学习的相关项目，生成包含对比分析和代码示例的笔记大纲。Curator 帮我整理了项目中涉及的技术分类，我导出为 Markdown 分发给团队。

### US-09: 上下文工程 — Context Engineering 效果

> 我导入了一个包含 500+ 文件的大型项目（如 Kubernetes 源码）。当我问 Mentor "解释 K8s 的调度器"时，Context Engineering Pipeline 自动工作：Retriever 从 Knowledge Graph 检索调度器相关节点（20+ 个），Filter 去除不相关的节点（保留 5 个核心节点），Compressor 将相关源码片段压缩为结构化摘要（控制在 6k tokens 内）。Mentor 收到的上下文精准且紧凑，避免了 300k Token 的 Context Explosion。

### US-10: Reflexion 分类优化

> 我手动触发了 Curator 的"重新分类"功能。Curator 使用 Reflexion Workflow 对我的 200+ 项目进行分类：第一轮生成候选分类 → 自我评估发现"Web Framework"和"Backend Framework"重叠 → 第二轮合并并重新命名 → 第三轮检查粒度是否合适。经过最多 3 轮反思迭代，Curator 输出最终分类方案。对于仍然不确定的分类（Confidence < 0.7），Curator 标记为"待确认"并弹窗让我手动决定。

### US-11: Scribe 按需 RAG

> 学习 React Hooks 时，我在项目笔记里记录自己的理解。Scribe Agent 判断当前笔记与已有 React 笔记的 Similarity > Threshold，自动调用 Compare Tool 对比新旧内容，帮我补充了几个容易踩坑的点和最佳实践。而当我为一个全新的 Rust 项目写笔记时，Similarity 低于 Threshold，Scribe 直接进入 Standalone Mode 独立辅助，不做多余的 RAG 检索。

---

## 6. Agent 系统概览

> **说明:** 本节为简明概览，Agent 的完整设计（Memory Architecture 详细实现、Context Engineering Pipeline 技术细节、Tool Schema、Prompt Template、降级策略、个性定义）请参阅 **[AGENT_PRD.md](./AGENT_PRD.md)**。

### 6.1 Hub — Chief Agent

| 维度 | 说明 |
| --- | --- |
| 定位 | Chief Agent — 全局规划与调度中枢 |
| Workflow | Plan-and-Execute |
| 核心职责 | Intent Detection / Task Planning / Dispatch / Memory Merge / User Profile Review / Conflict Resolution |
| 记忆范围 | Conversation Summary + Task Result Summary + Long Memory + User Profile（不持有所有 Agent Context） |
| 设计原则 | 避免 Context Explosion，Hub 做信息聚合而非信息堆积 |

### 6.2 Scout — Repository Analyst

| 维度 | 说明 |
| --- | --- |
| 定位 | 快速分析师，30s 出结果 |
| Workflow | ReAct |
| Tools | GitHub API / TF-IDF / Dependency Parser / README Parser / Graph Search |
| 输出 | Architecture / Tech Stack / Difficulty / Learning Suggestion |

### 6.3 Mentor — AI Teacher

| 维度 | 说明 |
| --- | --- |
| 定位 | 深度讲解，定制化教学 |
| Workflow | Adaptive — 简单问题用 ReAct，复杂概念用 ToT，多方案对比用 GoT |
| 核心能力 | 结合 Knowledge State 定制讲解、跨项目对比分析、多路径探索后择优 |
| 教学示例 | 讲解 FastAPI 时：源码路线 / 生活类比 / 请求生命周期 / MVC 对比 / Spring Boot 对比，评估后选最优 |

### 6.4 Navigator — Learning Planner

| 维度 | 说明 |
| --- | --- |
| 定位 | 学习路线规划师 |
| Workflow | ReAct |
| Tools | Knowledge Graph / Difficulty Graph / Learning History |
| 输出 | Learning Roadmap（含阶段里程碑、推荐项目、预计时长） |

### 6.5 Curator — Knowledge Organizer

| 维度 | 说明 |
| --- | --- |
| 定位 | 智能分类与知识整理 |
| Workflow | Reflexion（最多 3 轮反思迭代，否则交给用户确认） |
| 反思维度 | 是否已有相同分类 / 命名一致性 / 重复检测 / 粒度评估 |
| 输出 | 分类建议（含 Confidence 评分） |

### 6.6 Scribe — Knowledge Recorder

| 维度 | 说明 |
| --- | --- |
| 定位 | 辅助笔记，按需 RAG |
| Workflow | ReAct |
| 两种模式 | Project Mode（自动检索关联）/ Standalone Mode（独立工作） |
| RAG 策略 | 仅 Similarity > Threshold 时调用 Compare Tool，否则直接写（按需 RAG） |

### 6.7 Evaluator — Quality Reviewer（v2 定义，MVP 不含实现）

| 维度 | 说明 |
| --- | --- |
| 定位 | 质量审查与评分 |
| Workflow | Reflexion |
| 核心职责 | Review Hub 决策 / 检查 Memory 冲突 / 验证 Agent 回答质量 / 自动评分（Accuracy、Completeness、Grounding） |
| 闭环角色 | 在 Hub Merge 之后、Response 之前执行 Review，可触发 Re-plan |
| 实现状态 | **PRD 定义完成，MVP 不含实现，计划 v2.1+ 交付** |

---

## 7. 发布计划 (Release Plan)

### 7.1 版本策略

RepoPilot v2 采用 **v2.0 单版本完整发布** 策略。MVP_SCOPE.md 的范围即 v2.0 全部交付内容。

**v2.0 交付范围核心:**

- 完整的四层架构搭建
- Hub 升级为 Chief Agent（Plan-and-Execute）
- 五层 Memory Architecture 实现
- Memory Merge Protocol 实现
- Context Engineering Pipeline 实现
- Knowledge Graph 从展示升级为共享查询工具
- 多推理模式（ReAct / ToT / GoT / Reflexion）
- Fallback Mode 完整降级策略
- 6 Agent 全部实现（Evaluator 不含）
- v1 全部用户系统、项目管理、笔记系统、分类系统功能继承

**理由:**

- v2.0 是一次架构级升级，需要整体交付而非碎片化拆分
- Evaluator Agent 虽然完成设计，但作为独立模块不阻塞主流程
- MVP_SCOPE.md 精确裁剪了 P0/P1/P2 范围

### 7.2 v2.0 交付范围一览

| 模块 | v2.0 内容 | 优先级 | 依赖 |
| --- | --- | --- | --- |
| 用户系统 | 注册/登录、JWT 认证、GitHub PAT 绑定、User Profile 管理 | P0 | — |
| 项目管理 | GitHub Star 导入、CRUD、搜索/筛选/排序 | P0 | 用户系统 |
| 分类系统 | 预设分类、自定义分类、多标签、Curator Reflexion 分类 | P0 | 项目管理 |
| 笔记系统 | Markdown 笔记、MD 预览、Scribe AI 辅助（Project/Standalone Mode） | P0 | 项目管理 |
| 四层架构 | Presentation / Agent / Knowledge / Infrastructure 分层搭建 | P0 | — |
| Hub Chief Agent | Plan-and-Execute Workflow、Intent Detection、Task Planning、Memory Merge | P0 | Agent Layer |
| Scout Agent | ReAct Workflow、GitHub API / TF-IDF / Dependency Parser 工具集 | P0 | Infrastructure Layer |
| Mentor Agent | Adaptive Workflow（ReAct / ToT / GoT）、Knowledge State 驱动教学 | P0 | Knowledge Layer |
| Navigator Agent | ReAct Workflow、Knowledge Graph + Learning History 路线规划 | P0 | Knowledge Layer |
| Curator Agent | Reflexion Workflow（最多 3 轮）、Confidence 评分分类 | P0 | Knowledge Layer |
| Scribe Agent | ReAct Workflow、Project/Standalone 双模式、按需 RAG | P0 | Knowledge Layer |
| Memory Architecture | 五层记忆（User Profile → Preference → Knowledge State → Long → Short） | P0 | Knowledge Layer |
| Memory Merge Protocol | Proposal → Evidence → Confidence → Hub Merge → Commit | P0 | Memory Architecture |
| Context Engineering | Retriever → Filter → Compress → Agent Pipeline | P0 | Knowledge Layer |
| Knowledge Graph | 多源构建（TF-IDF / Embedding / Dependency / Topic）+ Graph Query API | P0 | Infrastructure Layer |
| Fallback Mode | 无 Key 降级：GitHub API → TF-IDF → Keyword → Rule Engine → Graph | P0 | Infrastructure Layer |
| 图谱可视化 | 力导向图 + 缩放/拖拽/搜索 + Graph Query 联动 | P0 | Knowledge Graph |
| 推理模式引擎 | ReAct / ToT / GoT / Reflexion 可配置推理框架 | P0 | Agent Layer |
| Agent 交互 | 反问面板（单选/多选/滑动/拖拽/知识地图）、SSE 流式输出 | P0 | Presentation Layer |
| 安全增强 | Agent 权限隔离、Memory 写入审计、Context 隔离 | P0 | — |
| Evaluator Agent | 接口规范定义、评分维度定义 | P2 | 仅设计，不含实现 |
| 扩展预留 | MCP 工具适配器、NotificationService 抽象、Skill/插件接口 | P1 | — |

### 7.3 后续版本路线（v2.0 之后）

| 版本 | 主题 | 范围 |
| --- | --- | --- |
| v2.1 | Evaluator 实现 | Evaluator Agent 完整实现、自动评分、Re-plan Trigger、闭环质量保障 |
| v2.2 | 用户体验增强 | OAuth GitHub 绑定、JSON 导入导出、列表/卡片双视图、笔记搜索/导出 |
| v2.3 | 数据可视化扩展 | 分类统计图、学习进度看板、时间线、图谱高级交互 |
| v2.4 | 生态与多端 | Web 端独立部署、移动端适配、Skill/插件市场、MCP 集成 |
| v3.0 | 协作与社区 | 多用户知识图谱共享、团队学习空间、Teacher Dashboard |

### 7.4 质量门禁 (v2.0 发布前必须全部通过)

- 后端 Service 层单测覆盖率 ≥ 75%（核心模块 100%，Agent 模块 80%，业务模块 75%）
- 前后端 lint 0 errors、0 warnings
- TypeScript 编译通过，禁止使用 `any`
- 集成测试覆盖所有 MVP 端点
- E2E 测试覆盖 7 条 happy path：
  1. 注册 → 导入 → 图谱 → 笔记 → Agent 对话（继承 v1）
  2. Memory Merge 冲突解决
  3. Context Engineering Pipeline 端到端
  4. Knowledge Graph Query 多 Agent 调用
  5. Fallback Mode 完整降级
  6. Reflexion Workflow 分类优化
  7. Plan-and-Execute 多 Agent 协作
- 所有 🔴 严重审查问题修复
- 性能指标全部达标（首屏 < 1.5s、API P95 < 400ms、图谱 500 节点 < 1.5s、Memory Merge < 500ms、Graph Query < 300ms）
- Memory Merge Protocol 一致性测试通过（100 次随机 Proposal 冲突场景无数据损坏）

---

## 8. 待定设计点 (TBD)

以下设计需要在开发过程中进一步确认。所有 TBD 编号全局统一管理，与 v1 TBD 编号连续：

| 编号 | 设计点 | 选项 | 当前倾向 | 关联文档 |
| --- | --- | --- | --- | --- |
| TBD-01 | Agent 的"形象" | 纯文字 / 简单头像 / Live2D 动画角色 | 简单头像（每个 Agent 一个图标） | AGENT_PRD |
| TBD-02 | Agent 语气风格 | 固定一种 / 多种可选模板 | 多种可选（学术/极客/幽默/极简） | AGENT_PRD |
| TBD-03 | 反问频率 | 每次都问 / 仅新领域问 / 用户可关闭 | 仅新领域问 + 可关闭 | AGENT_PRD |
| TBD-04 | Agent 之间协作 | Hub 统一路由 / Agent 间可直接调用 | Hub 统一路由（v2 Chief Agent 模式更可控） | AGENT_PRD |
| TBD-05 | 记忆持久化 | 全部本地 / 部分云端 | 全部本地（隐私优先） | AGENT_PRD |
| TBD-06 | 分析缓存 | 缓存多久 / 何时刷新 | 缓存 7 天，项目更新时刷新 | AGENT_SPEC |
| TBD-07 | 多 LLM 支持 | 仅支持一种 / 不同 Agent 可用不同模型 | 全局一个模型，但预留切换接口 | AGENT_SPEC |
| TBD-08 | Agent 对话并发 | 同时只能一个 Agent / 可多 Agent 并行 | 同时一个（对话窗口），后台可并行预分析 | AGENT_SPEC |
| TBD-09 | 流式输出 | 所有 Agent 都流式 / 仅长文本流式 | 全部流式（体验一致） | AGENT_SPEC |
| TBD-10 | 反问数据存储 | 存本地 / 存数据库 | 存数据库（跨设备同步） | AGENT_SPEC |
| **TBD-11** | **Memory Merge 冲突阈值** | **Confidence 差值多少算冲突** | **差值 > 0.2 视为冲突，需 Hub 仲裁** | **AGENT_PRD** |
| **TBD-12** | **Context Token 预算** | **每个 Agent 单次最大 Token 数** | **8k tokens，Hub 可动态调整** | **AGENT_PRD** |
| **TBD-13** | **Knowledge Graph 存储** | **Neo4j / NetworkX 内存图 / SQLite + Adjacency** | **NetworkX 内存图（MVP），预留 Neo4j 迁移接口** | **AGENT_SPEC** |
| **TBD-14** | **Reflexion 最大轮数** | **Curator 和 Evaluator 的最大反思轮数** | **3 轮，超过交用户确认** | **AGENT_PRD** |
| **TBD-15** | **Evaluator 评分维度** | **哪些指标纳入自动评分** | **Accuracy + Completeness + Grounding 三维评分** | **AGENT_PRD** |
| **TBD-16** | **Graph Query 语言** | **Cypher / Gremlin / 自定义 DSL** | **自定义简化 DSL（MVP），预留 Cypher 适配** | **AGENT_SPEC** |
| **TBD-17** | **Fallback Mode 分类准确率** | **Degraded Mode 下 Rule Engine 分类的最低可接受准确率** | **≥ 65%（基于 v1 关键词规则基线）** | **AGENT_SPEC** |
| **TBD-18** | **Memory Proposal 批量** | **单次 Merge 最多处理多少个 Proposal** | **10 个，超过排队下一轮** | **AGENT_PRD** |
