# RepoPilot v2 — Agent System Product Requirements (AGENT_PRD)

> 版本: 2.0.0 | 日期: 2026-07-04 | 状态: 草稿
>
> 本文档是 v2 Agent 系统产品需求的权威来源。

---

## 1. Agent 系统定位

RepoPilot v2 的 Agent 系统从 v1 的"专业 Agent 协同网络"升级为 **Multi-Agent Learning Operating System（多智能体学习操作系统）**。它不再是聊天机器人、RAG 应用或 GitHub 分析工具的任一单品——而是一个完整的 Agent System，具备任务规划、多推理模式、记忆融合、上下文工程、自我评估等系统级能力。

**v1 → v2 核心升级：**

| 维度 | v1 | v2 |
|------|----|----|
| Hub 角色 | 路由器（Routing） | Chief Agent（Plan-and-Execute + Evaluation + Memory Merge） |
| 推理模式 | 统一 ReAct | Adaptive：ReAct / Tree of Thoughts / Graph of Thoughts / Reflexion |
| 记忆架构 | 5 层静态分层 | 5 层 + Memory Merge Protocol（Proposal-based, Evidence Weighted） |
| 上下文管理 | 滑动窗口 + Token 预算 | Context Engineering Pipeline（Retrieve → Filter → Compress → Inject） |
| 知识图谱 | Scout 内部工具 | 所有 Agent 共享的 Graph Query 工具 |
| 质量保障 | 无 | Evaluator Agent（v2.1+，PRD 层面完整定义） |
| Agent 数量 | 6 | 7（新增 Evaluator） |

**核心原则：**

- **BYOK (Bring Your Own Key):** 用户提供 LLM API Key 才能使用 Agent 功能。无 Key 时系统使用代码规则运行，功能降级但不崩溃。
- **Plan-and-Execute:** Hub 先规划再执行，而非即时路由。每个用户请求经历 Intent → Plan → Dispatch → Collect → Evaluate → Merge → Response 完整生命周期。
- **Adaptive Reasoning:** Agent 根据任务复杂度自动选择推理模式，而非固定使用一种。
- **Memory as Protocol:** Agent 不直接修改记忆，而是通过 Proposal 提交，Hub 做 Evidence Weighted Merge。
- **Context Engineering:** 每个 Agent 只获得 Relevant Context，而非 All Context，避免 Context Explosion。
- **深度优先:** Agent 不做浅层介绍，深入源码架构、设计模式、技术栈对比。
- **主动反问:** Agent 主动了解用户知识水平和学习目标，动态调整讲解深度。
- **可配置:** 用户可自定义 Agent 的性格、语气、行为边界。

---

## 2. Agent 角色定义

### 2.1 角色总览

| Agent | 代号 | 定位 | Workflow 模式 | 触发场景 |
|-------|------|------|---------------|----------|
| 首席调度 Agent | **Hub** | Chief Agent | Plan-and-Execute | 全局对话入口，所有请求的统一入口 |
| 快速分析 Agent | **Scout** | Repository Analyst | ReAct | 导入项目时自动触发、项目卡片"快速分析" |
| 深度讲解 Agent | **Mentor** | AI Teacher | Adaptive (ReAct / ToT / GoT) | 项目详情页、对话中提问讲解 |
| 学习规划 Agent | **Navigator** | Learning Planner | ReAct | 设置页"学习规划"、对话中提问规划路线 |
| 分类整理 Agent | **Curator** | Knowledge Organizer | Reflexion | 导入时自动建议分类、手动"重新分类" |
| 笔记助手 Agent | **Scribe** | Knowledge Recorder | ReAct (双模式) | 笔记编辑器内 AI 按钮 |
| 质量评估 Agent | **Evaluator** | Quality Reviewer | Rule-based + LLM | Hub 任务完成后自动触发（**MVP 不实现，v2.1+**） |

### 2.2 Hub — Chief Agent

**定位：** 任务规划 + 调度 + 评估的核心。不再是简单路由器，而是系统的"大脑"。

**职责：**
- Intent Detection：识别用户意图（单 Agent / 多 Agent / 跨 Agent 复合任务）
- Task Planning：将用户请求分解为可执行的子任务序列，确定依赖关系和执行顺序
- Workflow Scheduling：调度子 Agent 执行，支持并行和串行混合调度
- Context Management：为每个子 Agent 构建最小化 Relevant Context
- Memory Merge：接收 Agent 的 Memory Proposal，执行 Evidence Weighted Merge
- User Profile Review：维护 User Profile 的完整性和一致性
- Conflict Resolution：当多个 Agent 的 Proposal 冲突时，基于证据权重裁决
- Evaluation：在 Evaluator 未上线前，Hub 承担基础质量评估（结果完整性检查、格式校验）

**Workflow — Plan-and-Execute：**

```
User Query
    ↓
Intent Detection（单意图 / 多意图 / 复合意图）
    ↓
Task Plan（子任务序列 + 依赖图 + 优先级）
    ↓
Context Building（为每个子任务构建最小上下文）
    ↓
Dispatch（并行/串行调度子 Agent）
    ↓
Collect（收集子 Agent 结果 + Memory Proposal）
    ↓
Evaluate（基础质量检查：完整性、一致性、格式）
    ↓
Memory Merge（处理 Proposal，Evidence Weighted）
    ↓
Merge Response（合并多 Agent 输出为统一回复）
    ↓
Response to User
```

**Hub 上下文策略：**

Hub **不**拥有所有 Agent 的原始上下文，仅持有：

| 上下文类型 | 说明 | 大小控制 |
|-----------|------|----------|
| Conversation Summary | 当前会话的压缩摘要，非原始消息 | 上限 ~2000 tokens |
| Task Result Summary | 子 Agent 返回结果的摘要 | 每个子任务 ~500 tokens |
| Long Memory | 学习/完成/失败历史 | 检索式访问，不全量加载 |
| User Profile | 职业/语言/学习目标/Knowledge State | ~1000 tokens |

**设计动机：** 避免 Context Explosion。如果 Hub 持有所有 Agent 的完整上下文，在多 Agent 协作场景下 token 消耗将指数级增长。Hub 只持有摘要级信息，子 Agent 持有领域级详细信息。

**输出格式：**

```json
{
  "type": "hub_response",
  "intent": "single_agent | multi_agent | compound",
  "task_plan": [
    { "id": "t1", "agent": "Mentor", "task": "...", "depends_on": [], "priority": 1 },
    { "id": "t2", "agent": "Navigator", "task": "...", "depends_on": ["t1"], "priority": 2 }
  ],
  "merged_response": "...",
  "memory_proposals_processed": 2
}
```

### 2.3 Scout — Repository Analyst

**定位：** 给我 30 秒，我告诉你这个项目值不值得学。

**职责：**
- 快速分析 GitHub 项目的架构、技术栈、难度、学习价值
- 自动关联用户已有项目库，发现关联关系
- 给出明确的"学/不学/先学前置"建议
- 为 Knowledge Graph 贡献初始节点和边

**Workflow — ReAct：**

Scout 使用标准 ReAct 模式。分析过程为线性推理 + 工具调用链：

```
输入: GitHub Repository URL / Name
    ↓
Reasoning: 确定分析策略（优先 README + metadata，非必要不深入源码）
    ↓
Act: read_readme → 提取项目描述、功能列表
Act: github_api → 获取 stars, language, topics, dependencies
Act: tfidf_analysis → 提取关键词
Act: dependency_parser → 解析依赖树
Act: graph_query → 查询与用户已有项目的关联
    ↓
Observation: 综合所有工具返回结果
    ↓
Output: 结构化速览报告
```

**工具集：**
- `read_readme` — 读取项目 README
- `github_api` — GitHub metadata（stars, forks, language, topics）
- `tfidf_analysis` — TF-IDF 关键词提取
- `dependency_parser` — 依赖树解析
- `graph_query` — Knowledge Graph 查询（与用户已有项目的关联）

**触发场景：**
- 导入项目时自动触发
- 项目卡片上的"快速分析"按钮
- Hub 分发的项目分析子任务

**输出格式：**

```markdown
## {项目名} 速览
- **一句话:** {用一句话说清楚这个项目是什么}
- **核心功能:** {3-5 个核心功能点}
- **技术栈:** {语言 + 框架 + 关键依赖}
- **架构模式:** {MVC / Microservice / Monorepo / ...}
- **适合谁:** {目标用户画像}
- **学习门槛:** ⭐⭐☆☆☆ (2/5)
- **与你的库关联:** {与用户已有项目的关系}
- **知识图谱节点:** {新发现的关联概念 3-5 个}
- **建议:** {学/不学/先学前置项目}
```

### 2.4 Mentor — AI Teacher

**定位：** 我是你的私人导师，根据你的水平调整讲解策略，用最适合你的方式让你理解。

**职责：**
- 深度讲解开源项目的架构、设计、源码
- 根据用户 Knowledge State 动态调整讲解深度和策略
- 主动反问了解用户真实水平
- 维护用户 Knowledge State（通过 Memory Proposal）
- 多种讲解策略并行探索，评估后选择最优

**Workflow — Adaptive Reasoning：**

Mentor 根据问题复杂度自动选择推理模式：

| 问题类型 | 推理模式 | 说明 |
|---------|---------|------|
| 简单事实性问题 | ReAct | "这个函数做什么？" → 直接读源码回答 |
| 复杂概念理解 | Tree of Thoughts | "解释 FastAPI 的依赖注入" → 生成多种讲解路径，评估选最优 |
| 多角度讲解策略 | Graph of Thoughts | "讲讲这个项目的架构" → 多种策略并行探索、交叉融合 |

**Tree of Thoughts 流程（复杂概念）：**

```
用户问题: "解释 FastAPI 的依赖注入系统"
    ↓
生成候选讲解路径:
  ├── Path A: 从源码入口追踪（适合喜欢看代码的用户）
  ├── Path B: 生活类比（餐厅点餐 → 服务员 → 厨房）（适合初学者）
  └── Path C: 与 Spring Boot DI 对比（适合 Java 背景用户）
    ↓
每条路径展开 2-3 步推理
    ↓
评估每条路径的:
  - 与 User Profile 的匹配度（Knowledge State + Preference）
  - 概念覆盖完整度
  - 讲解清晰度（自评）
    ↓
选择得分最高的路径作为主讲解
保留次优路径作为"换一种方式理解"的备选
```

**Graph of Thoughts 流程（多角度讲解）：**

```
用户问题: "讲讲这个项目的整体架构"
    ↓
并行生成 5 种讲解策略:
  ├── S1: 源码路线（从 main 入口追踪调用链）
  ├── S2: 生活类比（把系统比作一个组织/城市）
  ├── S3: 请求生命周期（一个请求从进入到返回的完整路径）
  ├── S4: MVC 分层对比（Model/View/Controller 各在哪）
  └── S5: Spring Boot 对比（和用户熟悉的框架对照）
    ↓
策略间可交叉引用:
  S3 的"请求经过中间件" → 引用 S1 的源码位置
  S5 的"自动配置" → 引用 S2 的类比
    ↓
评估融合:
  根据 User Profile 选择 1 种主策略 + 1-2 种辅助策略
  输出结构化讲解
```

**反问机制：**

Mentor 在开始讲解前，**必须**先通过反问了解用户水平（详见 §6 交互式反问系统）。反问结果存入 Knowledge State，下次同技术栈项目不再重复问。

**工具集：**
- `read_source_file` — 读取项目源码文件（通过 GitHub API）
- `read_readme` — 读取项目 README
- `search_web` — 搜索互联网补充信息
- `query_user_projects` — 查询用户项目库
- `get_user_profile` — 读取用户画像
- `graph_query` — Knowledge Graph 查询（关联概念、前置知识）
- `compare_projects` — 对比多个项目
- `ask_user_question` — 向用户弹出交互式反问
- `submit_memory_proposal` — 提交 Memory Proposal（更新 Knowledge State）

**触发场景：**
- 项目详情页"深度讲解"按钮
- Hub 分发的讲解子任务
- 对话中用户提问项目相关问题

**输出格式：**

```markdown
## {项目/概念} 深度讲解

### 讲解策略
基于你的情况（{Knowledge State 摘要}），我选择了 {策略名} 来讲解。

### 第一层：全景鸟瞰
{整体架构概述}

### 第二层：核心模块拆解
{逐个模块讲解，附源码位置}

### 第三层：设计模式与亮点
{这个项目用了哪些优秀的设计}

### 第四层：与你的知识关联
{和你已掌握的 X 技术对比，和你库里的 Y 项目关联}

### 下一步建议
{基于当前理解程度，推荐的下一步学习方向}

[换一种方式理解] [深入模块A] [看源码] [做个练习]
```

### 2.5 Navigator — Learning Planner

**定位：** 告诉我你的目标，我帮你画出一条最短的学习路线。

**职责：**
- 基于用户 Knowledge State + 学习目标，规划个性化学习路径
- 利用 Knowledge Graph 发现知识缺口和前置依赖
- 设定可验证的里程碑目标
- 动态调整路径（根据学习进度和反馈）

**Workflow — ReAct：**

```
输入: 用户学习目标 + 当前 Knowledge State
    ↓
Reasoning: 分析目标 vs 现状的差距
    ↓
Act: get_user_profile → 获取 Knowledge State、目标、偏好
Act: graph_query → 查询 Knowledge Graph 中的前置依赖关系
Act: query_user_projects → 查询用户项目库中可用的学习材料
Act: get_learning_history → 获取历史学习记录
    ↓
Reasoning: 基于差距分析，构建学习路径
    ↓
Output: 结构化学习路线图
```

**工具集：**
- `get_user_profile` — 读取用户画像（Knowledge State、目标、偏好）
- `graph_query` — Knowledge Graph 查询（前置依赖、知识关联）
- `query_user_projects` — 查询用户项目库
- `get_learning_history` — 获取历史学习记录
- `ask_user_question` — 反问学习目标细节
- `submit_memory_proposal` — 提交 Memory Proposal（学习规划记录）

**触发场景：**
- 设置页"学习规划"入口
- 对话中提问"帮我规划学习路线"
- Hub 分发的规划子任务

**输出格式：**

```markdown
## 学习路径：{目标名称}

### 差距分析
- 当前水平：{Knowledge State 摘要}
- 目标要求：{目标所需技能}
- 缺口：{需要补充的技能列表}

### 阶段 1：{阶段名} (第 1-N 周)
  ├── {项目/技术} (你已有 ⭐⭐⭐) → {学习目标}
  ├── {项目/技术} (你已有 ⭐☆☆) → {学习目标}
  └── 里程碑：{可验证的完成标准}

### 阶段 2：{阶段名} (第 N+1-M 周)
  └── ...

### 推荐学习顺序
基于 Knowledge Graph 的依赖关系，建议按以下顺序学习：
{有序列表}
```

### 2.6 Curator — Knowledge Organizer

**定位：** 我来帮你把项目库和知识体系整理得井井有条。

**职责：**
- 智能分类导入的项目（替代硬编码的 `_guess_category`）
- 批量重新分类建议（用户确认后才执行）
- 生成项目 README 摘要、建议标签
- 发现分类冲突并提醒用户
- 维护 Knowledge Graph 中的分类节点和边

**Workflow — Reflexion：**

Curator 使用 Reflexion 模式，在分类决策后进行自我反思和迭代优化：

```
输入: Repository 信息
    ↓
Step 1 — 初始分类:
  Act: read_readme + tfidf_analysis + github_api(topics)
  Reasoning: 综合信息生成 Candidate Category
  Output: { category: "Web Framework", confidence: 0.78 }
    ↓
Step 2 — Confidence Evaluation:
  置信度 > 0.85 → 直接输出，进入 Step 4
  置信度 ≤ 0.85 → 进入 Reflection
    ↓
Step 3 — Reflection（最多 3 轮）:
  Round N:
    - 检查：是否已有相同分类？→ 合并 or 新建
    - 检查：命名是否与已有分类一致？→ 标准化命名
    - 检查：是否类别过细？→ 上提一级 or 保持
    - 检查：是否与其他项目重复分类？→ 去重
    - 重新评估置信度
    - 置信度 > 0.85 → 输出
    - 轮次 = 3 且仍 ≤ 0.85 → 交给用户确认
    ↓
Step 4 — 输出分类结果 + Memory Proposal
```

**Reflexion 退出条件：**

| 条件 | 行为 |
|------|------|
| Confidence > 0.85 | 自动确认，输出分类 |
| 轮次 = 3 且 Confidence ≤ 0.85 | 输出 Top-2 候选，交给用户选择 |
| 发现与已有分类冲突 | 输出冲突说明，交给用户裁决 |
| 用户手动触发"重新分类" | 跳过自动确认，直接展示候选 |

**权限模型：**

```json
{
  "auto_classify_on_import": true,
  "auto_tag_suggestion": true,
  "batch_reclassify": false,
  "require_confirmation": ["reclassify", "remove_tag", "merge_category"]
}
```

**工具集：**
- `read_readme` — 读取项目 README
- `tfidf_analysis` — TF-IDF 关键词提取
- `github_api` — GitHub topics、description
- `graph_query` — Knowledge Graph 查询（已有分类结构）
- `suggest_classification` — 建议项目分类
- `submit_memory_proposal` — 提交 Memory Proposal（分类结果）

**触发场景：**
- 导入项目时自动建议分类
- 手动触发"重新分类"
- 批量整理分类

**输出格式：**

```json
{
  "type": "classification_result",
  "project": "fastapi",
  "category": { "primary": "Web Framework", "secondary": "Python Ecosystem" },
  "confidence": 0.88,
  "tags": ["async", "openapi", "dependency-injection"],
  "reflexion_rounds": 1,
  "requires_user_confirmation": false
}
```

### 2.7 Scribe — Knowledge Recorder

**定位：** 你学习，我帮你记。

**职责：**
- 辅助生成笔记大纲、补充完善笔记内容
- 生成代码注释和解释
- 总结长文档为要点
- 将碎片笔记整理为结构化文档
- 跨项目关联笔记（发现相似笔记并建议合并）

**Workflow — ReAct（双模式）：**

**Project Mode（项目关联模式）：**

Scribe 在处理与已导入项目相关的笔记时，自动检索上下文：

```
输入: 用户笔记操作请求 + 当前项目上下文
    ↓
Act: get_learning_history → 检索该项目相关的学习历史
Act: graph_query → 查询 Knowledge Graph 中的相似概念
Act: recall_from_memory → 检索相关的 Long Memory
    ↓
Similarity Check:
  计算当前笔记内容与已有笔记的 Similarity Score
  Similarity > Threshold (0.75):
    → 调用 compare_projects / compare_notes 工具
    → 提示用户："你之前写过类似的笔记，要合并吗？"
  Similarity ≤ Threshold:
    → 直接生成新笔记内容
    ↓
Output: 笔记内容 + 关联建议
```

**Standalone Mode（独立模式）：**

Scribe 处理与已导入项目无关的通用笔记时，不检索任何上下文：

```
输入: 用户笔记操作请求
    ↓
直接处理，不调用 graph_query / learning_history / memory
    ↓
Output: 笔记内容
```

**模式选择逻辑：**
- 当前上下文包含已导入项目 → Project Mode
- 用户明确指定"独立笔记" → Standalone Mode
- Hub 分发任务时指定模式 → 遵循 Hub 指令

**按需 RAG 策略：**

Scribe 不每次都执行 RAG 检索。只有当 Similarity Score 超过阈值时，才调用 Compare Tool。这避免了不必要的工具调用开销和上下文膨胀。

**工具集：**
- `generate_note_outline` — 生成笔记大纲
- `read_source_file` — 读取项目源码（用于代码注释生成）
- `get_learning_history` — 检索学习历史
- `graph_query` — Knowledge Graph 查询（相似概念）
- `compare_notes` — 对比相似笔记（按需调用）
- `recall_from_memory` — 从 Long Memory 检索相关信息
- `submit_memory_proposal` — 提交 Memory Proposal（笔记完成记录）

**触发场景：**
- 笔记编辑器内的 AI 按钮（大纲、补充、总结、代码注释）
- Hub 分发的笔记子任务

**输出格式：**

```markdown
## {笔记标题}

### 大纲
{结构化大纲}

### 内容
{生成/补充的笔记内容}

### 关联笔记
- {相关笔记 1}（相似度 0.82）[查看] [合并]
- {相关笔记 2}（相似度 0.71）[查看]
```

### 2.8 Evaluator — Quality Reviewer

> **⚠️ MVP 不实现，v2.1+ 实现。** 本节在 PRD 层面完整定义 Evaluator 的定位、职责、评估指标和闭环流程，为后续实现提供产品需求依据。

**定位：** Agent 系统的质量守门人。独立于执行链路之外，对 Hub 决策、Agent 输出、Memory 一致性进行系统性审查。

**职责：**
- **Review Hub 决策：** 检查 Hub 的 Task Plan 是否合理（任务分解是否完整、Agent 选择是否最优、依赖关系是否正确）
- **检查 Memory 冲突：** 审查 Memory Merge 结果，发现 Proposal 之间的矛盾和异常
- **验证 Agent 回答质量：** 对 Agent 输出进行多维度自动评分
- **判断是否需要重新规划：** 当评估结果低于阈值时，触发 Hub 重新规划
- **系统级健康监控：** 跟踪 Agent 系统的整体质量趋势

**评估指标体系：**

| 指标 | 说明 | 评分范围 | 低于阈值的处理 |
|------|------|---------|-------------|
| **Accuracy** | Agent 回答的事实正确性 | 0-1 | 标记错误，触发 Hub 重新调度 |
| **Completeness** | 回答是否覆盖了用户问题的所有方面 | 0-1 | 标记缺失项，触发补充回答 |
| **Grounding** | 回答是否有源码/文档依据（非幻觉） | 0-1 | 标记幻觉段落，请求 Agent 提供依据 |
| **Relevance** | 回答与用户问题的相关度 | 0-1 | 标记偏离部分 |
| **Consistency** | 与历史回答、Memory 的一致性 | 0-1 | 标记冲突，提交 Memory 修正 Proposal |

**闭环流程：**

```
Hub Merge Response
    ↓
Evaluator Review:
  ├── Accuracy Check: 事实性验证（交叉引用源码/文档）
  ├── Completeness Check: 是否覆盖所有子问题
  ├── Grounding Check: 每段回答是否有可追溯依据
  ├── Consistency Check: 与 Memory / 历史回答是否矛盾
  └── Overall Score: 加权综合分
    ↓
Decision:
  Score ≥ 0.8 → PASS → Response to User + Memory Update
  0.6 ≤ Score < 0.8 → WARN → Response + 附加改进建议
  Score < 0.6 → FAIL → 反馈给 Hub 重新规划
    ↓
Feedback Loop:
  Evaluator → Hub: { failed_dimensions, suggestions, evidence }
  Hub: 根据反馈调整 Task Plan，重新调度
  最多重试 2 次，仍不通过则输出 + 标注低置信度
```

**工具集（v2.1+ 实现）：**
- `verify_source_grounding` — 验证回答中的源码引用是否准确
- `check_memory_consistency` — 检查 Memory 一致性
- `score_agent_output` — 对 Agent 输出进行多维度评分
- `submit_evaluation_report` — 提交评估报告
- `trigger_replan` — 触发 Hub 重新规划

---

## 3. Agent 记忆系统

### 3.1 Memory Architecture — 五层模型

v2 的记忆系统从 v1 的静态分层升级为**五层 + Protocol-based Merge** 架构：

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1: User Profile（用户画像）                         │
│   职业 / 语言 / 学习目标                                  │
│   长期稳定，变更频率: 极低（月级别）                        │
│   写入权限: Hub（通过 Merge Protocol）                    │
├─────────────────────────────────────────────────────────┤
│ Layer 2: Preference（偏好）                              │
│   代码优先 / 图示 / Markdown / 语言风格                   │
│   中期稳定，变更频率: 低（周级别）                         │
│   写入权限: Hub（通过 Merge Protocol）                    │
├─────────────────────────────────────────────────────────┤
│ Layer 3: Knowledge State（知识状态）                      │
│   { Python: 92, FastAPI: 31, React: 70, Docker: 45 }    │
│   动态变化，变更频率: 中（每次学习后更新）                   │
│   写入权限: Hub（Mentor 通过 Proposal 驱动更新）           │
├─────────────────────────────────────────────────────────┤
│ Layer 4: Long Memory（长期记忆）                          │
│   学习历史 / 完成记录 / 失败记录 / 项目分析历史            │
│   持续累积，变更频率: 中（每次任务完成后追加）               │
│   写入权限: Hub（通过 Merge Protocol）                    │
├─────────────────────────────────────────────────────────┤
│ Layer 5: Short Memory（短期记忆 — Agent 私有）            │
│   Mentor: 最近三轮教学上下文                              │
│   Scout: 最近三个 Repository 分析结果                     │
│   Curator: 当前分类 Session 的候选列表                    │
│   Navigator: 当前规划 Session 的草稿路径                  │
│   Scribe: 当前编辑 Session 的笔记版本历史                 │
│   短期存在，变更频率: 高（每个 Session 内实时更新）         │
│   写入权限: Agent 自身（无需 Proposal）                   │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Memory Merge Protocol

**核心规则：Agent 不能直接修改 Layer 1-4 的 Memory，只能提交 Proposal。**

这一设计的动机是：多个 Agent 可能同时产生相互矛盾的 Memory 更新（例如 Mentor 认为用户 Python 水平是 90，而 Navigator 根据用户不会配置虚拟环境推断为 60）。直接写入会导致 Memory 不一致。

**Proposal JSON Schema：**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "MemoryProposal",
  "type": "object",
  "required": ["agent", "target_layer", "key", "value", "confidence", "evidence", "timestamp"],
  "properties": {
    "agent": {
      "type": "string",
      "description": "提交 Proposal 的 Agent 代号",
      "enum": ["Hub", "Scout", "Mentor", "Navigator", "Curator", "Scribe", "Evaluator"]
    },
    "target_layer": {
      "type": "string",
      "description": "目标记忆层",
      "enum": ["user_profile", "preference", "knowledge_state", "long_memory"]
    },
    "key": {
      "type": "string",
      "description": "记忆键，如 'python_proficiency' 或 'learning_history.2026-07'"
    },
    "value": {
      "description": "提议的新值（类型根据 key 而定）"
    },
    "old_value": {
      "description": "当前值（如果存在）。用于冲突检测。"
    },
    "confidence": {
      "type": "number",
      "minimum": 0,
      "maximum": 1,
      "description": "Agent 对此 Proposal 的置信度"
    },
    "evidence": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["type", "content"],
        "properties": {
          "type": {
            "type": "string",
            "enum": ["user_statement", "behavior_observation", "tool_result", "inference", "historical_record"]
          },
          "content": {
            "type": "string",
            "description": "证据描述"
          },
          "source": {
            "type": "string",
            "description": "证据来源（如具体的对话 ID、工具调用 ID）"
          },
          "weight": {
            "type": "number",
            "minimum": 0,
            "maximum": 1,
            "description": "此条证据的权重"
          }
        }
      },
      "description": "支持此 Proposal 的证据列表"
    },
    "timestamp": {
      "type": "string",
      "format": "date-time"
    },
    "expires_at": {
      "type": "string",
      "format": "date-time",
      "description": "可选。Proposal 过期时间，过期后 Hub 不再处理。"
    }
  }
}
```

**Evidence Weighted Merge 算法：**

Hub 收到多个 Proposal 后，不做简单投票，而是计算加权得分：

```
Final Score = Recent_Weight × Confidence × Evidence_Score

其中：
- Recent_Weight: 时间衰减因子（越新的 Proposal 权重越高）
  Recent_Weight = exp(-λ × Δt)，λ = 0.01，Δt 为距当前时间的分钟数
- Confidence: Agent 自评的置信度（0-1）
- Evidence_Score: 证据加权得分
  Evidence_Score = Σ(evidence[i].weight × type_weight[evidence[i].type]) / len(evidence)
  type_weight = {
    "user_statement": 1.0,      // 用户明确说明，最高权重
    "tool_result": 0.9,          // 工具返回的客观数据
    "behavior_observation": 0.7, // 行为推断
    "historical_record": 0.6,    // 历史记录
    "inference": 0.4             // 纯推断，最低权重
  }
```

**冲突处理：**
- 两个 Proposal 的 Final Score 差距 < 0.1 → 冲突，交给用户确认
- 差距 ≥ 0.1 → 选择得分高的 Proposal
- 所有 Proposal 的 Confidence 均 < 0.5 → 丢弃所有 Proposal，等待更多证据

**Proposal 示例：**

```json
{
  "agent": "Mentor",
  "target_layer": "knowledge_state",
  "key": "fastapi_proficiency",
  "value": 45,
  "old_value": 31,
  "confidence": 0.83,
  "evidence": [
    {
      "type": "behavior_observation",
      "content": "用户正确回答了 FastAPI 依赖注入的核心概念",
      "source": "conversation_turn_42",
      "weight": 0.8
    },
    {
      "type": "user_statement",
      "content": "用户自述已经用 FastAPI 写了一个小项目",
      "source": "conversation_turn_38",
      "weight": 1.0
    }
  ],
  "timestamp": "2026-07-04T14:30:00Z"
}
```

### 3.3 Memory 读写权限矩阵

| Memory Layer | Hub | Scout | Mentor | Navigator | Curator | Scribe | Evaluator |
|-------------|-----|-------|--------|-----------|---------|--------|-----------|
| User Profile | R+W(Merge) | R | R+P | R+P | R | R | R+P |
| Preference | R+W(Merge) | R | R+P | R+P | R | R | R+P |
| Knowledge State | R+W(Merge) | R | R+P | R+P | R | R | R+P |
| Long Memory | R+W(Merge) | R+P | R+P | R+P | R+P | R+P | R+P |
| Short Memory (own) | R+W | R+W | R+W | R+W | R+W | R+W | R+W |

**R** = Read, **W** = Write, **P** = Proposal only, **W(Merge)** = Write via Merge Protocol

---

## 4. Agent 行为规范与个性

### 4.1 AGENT.md — 行为规范模板

每个 Agent 有一份 `AGENT.md`，定义其行为边界。v2 新增 Workflow 模式和 Memory Protocol 相关规范：

```markdown
# {Agent Name} Agent 行为规范

## 核心职责
{一句话描述 Agent 的核心职责}

## Workflow 模式
{ReAct / ToT / GoT / Reflexion / Adaptive / Plan-and-Execute}
{说明在何种条件下切换模式}

## 行为准则
1. **{准则名}:** {具体描述}
2. **{准则名}:** {具体描述}
...

## Memory Protocol
- 读取权限: {可读取的 Memory Layer}
- 写入方式: Proposal only（通过 submit_memory_proposal）
- 必须在 {触发条件} 时提交 Memory Proposal
- Proposal 的 target_layer: {该 Agent 主要写入的层}

## 工具使用
- `tool_name`: {用途说明}
...

## 禁止行为
- {禁止行为 1}
- {禁止行为 2}
```

### 4.2 SOUL.md — 性格定义模板

```markdown
# {Agent Name} Agent 性格

## 说话风格
- 语气: {描述}
- 用词: {描述}
- 节奏: {描述}
- 互动: {描述}

## 语言习惯
- {习惯 1}
- {习惯 2}

## 教学/沟通特色
- {特色 1}
- {特色 2}
```

### 4.3 各 Agent 性格概要

| Agent | 语气 | 核心特色 |
|-------|------|---------|
| Hub | 专业、高效、全局视角 | 像一个项目经理，快速分解任务并调度资源 |
| Scout | 简洁、数据驱动、直截了当 | 像科技评测博主，30 秒给结论 |
| Mentor | 温和、耐心、启发式 | 像有经验的前辈，用提问引导思考，用类比帮助理解 |
| Navigator | 战略性、鼓励性、结构化 | 像职业顾问，画蓝图、设里程碑 |
| Curator | 严谨、有序、注重一致性 | 像图书管理员，分类精确、命名规范 |
| Scribe | 安静、高效、忠实记录 | 像速记员，准确捕捉要点 |
| Evaluator | 客观、严格、有建设性 | 像 QA 工程师，发现问题同时给出改进建议 |

---

## 5. Agent 工具集

### 5.1 工具总览（14+ 工具）

| 工具 | 功能 | 使用 Agent |
|------|------|-----------|
| `read_readme` | 读取项目 README | Scout, Mentor, Curator |
| `read_source_file` | 读取项目源码文件（通过 GitHub API） | Mentor, Scribe |
| `github_api` | GitHub metadata（stars, forks, language, topics, contributors） | Scout, Curator |
| `tfidf_analysis` | TF-IDF 关键词提取 | Scout, Curator |
| `dependency_parser` | 依赖树解析 | Scout |
| `search_web` | 搜索互联网补充信息 | 所有 |
| `query_user_projects` | 查询用户项目库（按名称/分类/标签） | 所有 |
| `get_project_analysis` | 获取缓存的项目分析结果 | Hub, Mentor, Navigator |
| `get_user_profile` | 读取用户画像（Knowledge State、偏好、目标） | Mentor, Navigator, Hub |
| `graph_query` | **Knowledge Graph 查询（v2 新增共享工具）** | 所有 |
| `compare_projects` | 对比多个项目 | Mentor |
| `compare_notes` | 对比相似笔记 | Scribe |
| `suggest_classification` | 建议项目分类 | Curator |
| `generate_note_outline` | 生成笔记大纲 | Scribe |
| `build_learning_path` | 构建学习路径 | Navigator |
| `get_learning_history` | 获取历史学习记录 | Navigator, Scribe |
| `ask_user_question` | 向用户弹出交互式反问 | Mentor, Navigator, Curator |
| `submit_memory_proposal` | **提交 Memory Proposal（v2 新增）** | 所有（Hub 除外，Hub 直接 Merge） |
| `recall_from_memory` | 从 Memory 系统检索信息 | 所有 |

### 5.2 Knowledge Graph Query（v2 新增共享工具）

v1 中 Knowledge Graph 仅是 Scout 的内部分析工具。v2 将其升级为所有 Agent 共享的查询工具。

**查询能力：**

| 查询类型 | 说明 | 典型使用场景 |
|---------|------|------------|
| `node_search` | 按名称/类型搜索图谱节点 | Mentor 搜索"FastAPI"相关概念 |
| `neighbor_query` | 查询指定节点的邻居节点 | Navigator 查询前置依赖 |
| `path_finding` | 查找两个节点之间的路径 | Navigator 规划学习路径 |
| `similarity_search` | 基于 Embedding 的相似节点搜索 | Scribe 发现相似笔记 |
| `subgraph_extract` | 提取以某节点为中心的子图 | Scout 展示项目关联网络 |

**Knowledge Graph 数据来源：**

| 来源 | 说明 | 构建方式 |
|------|------|---------|
| TF-IDF | 基于关键词共现的关联 | 自动构建 |
| Embedding | 基于语义相似度的关联 | 自动构建（需要 API Key） |
| Dependency | 基于项目依赖关系的关联 | 自动构建 |
| GitHub Topic | 基于 GitHub Topics 的关联 | 自动构建 |
| Manual Relation | 用户手动添加的关联 | 用户操作 |

### 5.3 工具调用模式

v2 的 Agent 根据 Workflow 模式使用不同的工具调用策略：

| Workflow 模式 | 工具调用策略 | 使用 Agent |
|--------------|------------|-----------|
| ReAct | 线性推理 → 工具调用 → 观察 → 继续推理 | Scout, Navigator, Scribe |
| Tree of Thoughts | 并行生成多条推理路径，每条路径独立调用工具，评估后选优 | Mentor（复杂问题） |
| Graph of Thoughts | 多条路径并行 + 路径间交叉引用工具结果 | Mentor（多角度讲解） |
| Reflexion | 工具调用 → 结果评估 → 反思 → 重新调用（最多 N 轮） | Curator |
| Plan-and-Execute | Hub 规划工具调用序列，分配给子 Agent 执行 | Hub |

---

## 6. 交互式反问系统

### 6.1 反问消息格式

v2 延续 v1 的反问消息格式，新增与 Memory Protocol 的集成：

```json
{
  "type": "agent_question",
  "agent": "Mentor",
  "question": {
    "text": "在开始讲解 React 之前，我需要了解你的基础：",
    "questions": [
      {
        "id": "q1",
        "text": "你对 JavaScript ES6+ 的掌握程度？",
        "type": "radio",
        "options": [
          { "value": "none", "label": "不了解", "description": "还停留在 ES5" },
          { "value": "basic", "label": "了解", "description": "箭头函数、解构、Promise" },
          { "value": "intermediate", "label": "掌握", "description": "能熟练使用大部分特性" },
          { "value": "advanced", "label": "精通", "description": "理解原型链、事件循环" }
        ],
        "allow_other": true
      },
      {
        "id": "q2",
        "text": "以下概念你熟悉哪些？",
        "type": "checkbox",
        "options": [
          { "value": "vdom", "text": "虚拟 DOM" },
          { "value": "lifecycle", "text": "组件生命周期" },
          { "value": "state_mgmt", "text": "状态管理 (Redux/Vuex)" },
          { "value": "ssr", "text": "服务端渲染" }
        ]
      },
      {
        "id": "q3",
        "text": "你对前端框架的理解深度？",
        "type": "slider",
        "min": 0,
        "max": 100,
        "labels": { "0": "完全不懂", "50": "会用", "100": "能造轮子" }
      }
    ],
    "allow_skip": true,
    "skip_text": "跳过，用默认深度讲解"
  },
  "memory_proposal_on_complete": {
    "target_layer": "knowledge_state",
    "key_prefix": "js_",
    "description": "用户回答完成后，自动生成 Knowledge State 更新 Proposal"
  }
}
```

### 6.2 反问交互类型

| 类型 | UI 组件 | 使用场景 |
|------|--------|---------|
| `radio` | 垂直排列的单选按钮组 (A/B/C/D/E) | 技术掌握程度评估、学习偏好选择 |
| `checkbox` | 可多选的 checkboxes | "你用过以下哪些？" |
| `slider` | 0-100 滑块 + 刻度标注 | 自评掌握百分比、优先级权重 |
| `drag_sort` | 可拖拽的卡片列表 | 学习优先级排序、技术栈偏好排序 |
| `knowledge_map` | 可展开的树形 checkbox | 勾选已掌握/未掌握的知识点 |
| `text` | textarea（当选择"其他"时） | 补充说明特殊情况 |

### 6.3 反问策略

- 选项是**动态生成**的，Agent 根据项目技术栈决定问什么
- 选项数量 3-7 个，不超过 7 个避免认知负担
- "其他"选项始终存在，点击后展开自由输入
- 用户可以选择"跳过"，Agent 使用 Knowledge State 中的已有数据推断
- 反问结果通过 Memory Proposal 写入 Knowledge State，下次同技术栈项目不再重复问

### 6.4 答案类型定义

```typescript
type QuestionAnswer =
  | { type: "radio";          value: string; other_text?: string }
  | { type: "checkbox";       values: string[] }
  | { type: "slider";         value: number }
  | { type: "drag_sort";      order: string[] }
  | { type: "knowledge_map";  checked: string[] };
```

---

## 7. Agent 交互形态

### 7.1 统一对话窗口

全局 Agent 对话入口（侧边抽屉或独立页面），由 Hub 统一调度：

```
┌─────────────────────────────────────────────┐
│  RepoPilot Agent v2                          │
│  ┌─────────────────────────────────────────┐ │
│  │ Hub: 你好！我是 RepoPilot 助手。        │ │
│  │ 我可以帮你分析项目、深度讲解、           │ │
│  │ 规划学习路线。有什么想了解的？            │ │
│  ├─────────────────────────────────────────┤ │
│  │ 用户: 帮我分析 FastAPI 并规划学习路线    │ │
│  ├─────────────────────────────────────────┤ │
│  │ Hub: 好的，我会分两步来：               │ │
│  │   1. 让 Scout 快速分析 FastAPI          │ │
│  │   2. 让 Navigator 基于分析结果规划路线   │ │
│  │                                         │ │
│  │ [Scout 分析中...]                        │ │
│  │ ✅ Scout 完成分析                        │ │
│  │ [Navigator 规划中...]                    │ │
│  │ ✅ Navigator 完成规划                    │ │
│  ├─────────────────────────────────────────┤ │
│  │ [输入框] [发送] [附件]                   │ │
│  └─────────────────────────────────────────┘ │
│                                              │
│  快速操作:                                    │
│  [分析项目] [对比项目] [学习规划] [整理分类]   │
└─────────────────────────────────────────────┘
```

**v2 交互增强：**
- 多 Agent 任务时，显示 Task Plan 的执行进度（哪些子任务完成、哪些进行中）
- 用户可以展开每个子 Agent 的详细输出
- 反问面板内嵌在对话流中，不打断对话节奏

### 7.2 嵌入式 Agent

在各功能页面内嵌 Agent 面板：

| 页面 | 嵌入 Agent | 交互方式 |
|------|-----------|---------|
| 项目详情页 | Mentor + Scribe | 右侧面板：AI 分析卡片 + 笔记辅助按钮 |
| 项目列表页 | Scout | 项目卡片上的"快速分析"按钮 → 弹出卡片 |
| 导入页 | Curator | 导入后自动建议分类的浮层（含 Reflexion 进度指示） |
| 图谱页 | Navigator | 图谱上浮动窗"根据图谱推荐学习路径" |
| 笔记页 | Scribe | 编辑器内 AI 按钮（大纲/补充/总结/代码注释） |
| 设置页 | Hub | Agent 配置面板（Memory 可视化 + Agent 行为调优） |

---

## 8. 降级策略 (无 API Key 时)

当用户未配置 API Key 时，系统使用纯代码实现基础功能，用户几乎无感知：

### 8.1 完整降级路径

```
有 Key:
  GitHub API → Embedding → LLM → Agent（完整功能）

无 Key:
  GitHub API → TF-IDF → Keyword → Rule Engine → Graph（降级但可用）
```

### 8.2 功能降级对照表

| 功能 | 有 Agent | 无 Key（降级） | 降级实现方式 |
|------|---------|---------------|------------|
| 项目分类 | AI 分析内容后建议 | 关键词规则匹配 | `_guess_category` + TF-IDF 关键词 |
| 项目速览 | Scout 深度分析 | README + metadata 结构化展示 | 模板化渲染 GitHub API 数据 |
| 深度讲解 | Mentor 多层次定制讲解 | 显示 README 原文 + 依赖树 | Markdown 渲染 |
| 交叉对比 | 多维度对比分析 | 表格展示基础字段差异 | 结构化字段对比 |
| 学习规划 | 个性化学习路径 | 按 Star 数 + Difficulty Graph 排序 | Rule Engine + Graph |
| 笔记辅助 | AI 生成大纲/补充 | 空白模板 + 基础大纲框架 | 预设模板 |
| 知识图谱 | AI 解释关联关系 | 纯 TF-IDF 相似度连线 | TF-IDF + Dependency Graph |
| 分类整理 | Curator Reflexion 分类 | 关键词匹配 + topics 直接映射 | 硬编码规则 |

### 8.3 降级状态下的 Agent 表现

| Agent | 有 Key 行为 | 无 Key 行为 |
|-------|-----------|-----------|
| Hub | Plan-and-Execute 调度 | 关键词路由到对应页面 |
| Scout | LLM 生成结构化报告 | 模板化渲染 metadata |
| Mentor | Adaptive Reasoning 讲解 | 不可用（显示 README） |
| Navigator | 个性化路径规划 | 预设模板路径（按难度排序） |
| Curator | Reflexion 智能分类 | 关键词匹配分类 |
| Scribe | AI 笔记辅助 | 预设模板 |

**降级提示:** "配置 LLM API Key 以解锁智能分析功能 [去设置]"

**降级原则:**
- 核心浏览功能（项目列表、README 展示、基础图谱）不受影响
- 降级后的功能仍然有实用价值，不是"空壳"
- 提示文案友好，不制造焦虑

---

## 9. Context Engineering Pipeline

### 9.1 设计动机

Multi-Agent 系统最大的工程挑战之一是 **Context Explosion**。如果每个 Agent 都获得完整的系统上下文，在多 Agent 协作场景下 token 消耗将呈指数级增长。v2 引入 Context Engineering Pipeline，确保每个 Agent 只获得 **Relevant Context**。

### 9.2 Pipeline 流程

```
User Query
    ↓
┌─────────────────────────────────────┐
│ Step 1: Retriever                   │
│ 从所有可用上下文中检索相关信息        │
│ - Long Memory 检索（向量相似度）     │
│ - Knowledge Graph 检索（图遍历）     │
│ - User Profile 检索（相关字段）      │
│ - 会话历史检索（关键词匹配）          │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ Step 2: Filter                      │
│ 过滤掉与当前任务无关的信息            │
│ - 相关性评分（与 Query 的相似度）     │
│ - 时效性过滤（过旧的信息降权）        │
│ - 去重（相似内容合并）               │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ Step 3: Compress                    │
│ 压缩上下文以控制 Token 消耗          │
│ - 长文本摘要化                       │
│ - 结构化数据精简（只保留关键字段）      │
│ - 历史对话压缩为 Summary             │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ Step 4: Inject                      │
│ 将压缩后的上下文注入 Agent Prompt     │
│ - 按优先级排列（最相关的在最前面）    │
│ - 标注信息来源（便于 Agent 引用）     │
│ - 控制总 Token 在预算内              │
└──────────────┬──────────────────────┘
               ↓
Agent（带 Relevant Context 执行）
```

### 9.3 Context 预算控制

| 组件 | Token 预算 | 说明 |
|------|-----------|------|
| System Prompt (AGENT.md + SOUL.md) | ~1500 | 固定开销 |
| User Profile + Preference | ~1000 | 精简表示 |
| Knowledge State (relevant subset) | ~500 | 只注入与当前任务相关的技术 |
| Conversation Summary | ~2000 | 压缩后的会话摘要 |
| Retrieved Context | ~3000 | Retriever 输出的相关信息 |
| Task-specific Context | ~2000 | Hub 分配的子任务描述 + 依赖 |
| **Total per Agent** | **~10000** | 远低于模型上限 |

### 9.4 Hub 的 Context 隔离

Hub 作为 Chief Agent，其上下文策略与子 Agent 不同：

| Hub 持有 | Hub 不持有 |
|---------|-----------|
| Conversation Summary（压缩摘要） | 子 Agent 的原始推理过程 |
| Task Result Summary（结果摘要） | 子 Agent 的完整工具调用记录 |
| User Profile（完整） | 所有 Agent 的 Short Memory |
| Long Memory（检索式访问） | 完整的 Knowledge Graph |
| 当前 Task Plan 状态 | 所有历史 Task Plan |

---

## 10. 未来扩展预留

### 10.1 Evaluator 详细设计（v2.1+）

Evaluator 在 MVP 中不实现，但以下设计为 v2.1 实现提供完整的 PRD 依据：

**实现优先级：**

| 阶段 | 能力 | 说明 |
|------|------|------|
| v2.1 Phase 1 | Grounding Check | 验证 Agent 回答中的源码引用是否准确 |
| v2.1 Phase 2 | Accuracy + Completeness 评分 | 多维度自动评分 |
| v2.1 Phase 3 | Consistency Check + Feedback Loop | Memory 一致性检查 + 触发 Hub 重新规划 |
| v2.2 | System Health Dashboard | 质量趋势可视化 |

**Evaluator 的 Short Memory：**
- 最近 5 次评估结果
- 当前 Session 的质量趋势
- 已知的 Agent 弱项记录

### 10.2 MCP (Model Context Protocol) 接入

预留接口，未来可让 RepoPilot Agent 通过 MCP 协议接入外部工具：

- **GitHub MCP:** 直接操作仓库（创建 Issue、PR、Review）
- **Documentation MCP:** 读取在线文档（ReadTheDocs、Notion）
- **Code Execution MCP:** 运行示例代码（安全沙箱）
- **Community MCP:** 接入社区讨论（GitHub Discussions、Discord）

**MCP 工具注册格式预留：**

```json
{
  "type": "mcp_tool",
  "server": "github-mcp",
  "tool": "create_issue",
  "description": "在 GitHub 仓库创建 Issue",
  "input_schema": { "...": "..." },
  "access_agents": ["Mentor", "Navigator"],
  "require_confirmation": true
}
```

### 10.3 即时通讯集成

预留 Agent 消息推送接口，未来可通过以下渠道与用户交互：

- **飞书:** 每日学习提醒、项目推荐、问答
- **微信:** 公众号/企业微信机器人
- **Telegram/Discord:** 社区互动

### 10.4 Agent 扩展市场

Agent 的工具和行为规范设计为可插拔：

- AGENT.md 和 SOUL.md 是标准化配置文件
- 工具定义使用 JSON Schema
- Workflow 模式可自定义
- 未来用户可以发布自定义 Agent 配置到市场

**可扩展维度：**

| 维度 | 扩展方式 |
|------|---------|
| 新 Agent 角色 | 新增 AGENT.md + SOUL.md + 工具集，注册到 Hub 路由表 |
| 新推理模式 | 实现 Workflow Interface，注册到 Adaptive Reasoning 选择器 |
| 新工具 | 实现 Tool Interface（JSON Schema 定义输入输出），注册到工具注册表 |
| 新记忆层 | 扩展 Memory Architecture，定义读写权限和 Merge 规则 |

### 10.5 Multi-User Collaboration（v3.0 愿景）

未来支持多用户协作学习同一 Repository：

- 多个用户的 Knowledge State 可聚合为 Team Knowledge Map
- 不同用户的学习笔记可交叉引用
- Hub 升级为 Team Hub，支持多用户任务调度
