# RepoPilot v2 — Technical Specification

> 版本: 2.0.0 | 日期: 2026-07-04 | 状态: 草稿
>
> 本文档是 v2 系统架构和技术实现的权威来源。基于 v1.0 技术基础迭代，沿用 v1 的安全/认证/加密方案，新增 Memory/Context/Knowledge 层设计。
>
> **引用约定:** 凡注明"沿用 v1 §X"的章节，其实现细节以 v1 Technical Spec 对应章节为权威来源，本文档仅记录 v2 差异。

---

## 1. 系统架构总览

### 1.1 四层架构

```
┌──────────────────────────────────────────────────────────────────────┐
│                   Presentation Layer                                  │
│                   React + Vite + TypeScript + Zustand + D3.js v7      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │Dashboard  │ │GraphPage │ │AgentChat │ │Settings  │ │MemoryPanel│  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│                          │ fetch / EventSource (SSE)                  │
├──────────────────────────┼───────────────────────────────────────────┤
│                   Agent Layer                                         │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │                    Hub Chief Agent                            │    │
│  │    Intent → Plan → Dispatch → Collect → Evaluate → Merge     │    │
│  └──────┬─────────┬─────────┬─────────┬─────────┬─────────┬────┘    │
│         ▼         ▼         ▼         ▼         ▼         ▼         │
│  ┌──────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐          │
│  │ Scout    │ │Mentor  │ │Navigat.│ │Curator │ │ Scribe │          │
│  │ ReAct    │ │Adaptive│ │ ReAct  │ │Reflexio│ │ ReAct  │          │
│  └──────────┘ └────────┘ └────────┘ └────────┘ └────────┘          │
│         ┌──────────┐                                                │
│         │Evaluator │  (v2.1+ 接口预留)                               │
│         └──────────┘                                                │
├──────────────────────────────────────────────────────────────────────┤
│                   Knowledge Layer                                     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐    │
│  │Knowledge Graph│ │Memory System │ │     Context Engine        │    │
│  │+ graph_edges  │ │5-Layer Arch  │ │Retriever→Filter→Compress │    │
│  │+ GraphQuery   │ │+ Merge Proto.│ │     → AgentContext       │    │
│  └──────────────┘ └──────────────┘ └──────────────────────────┘    │
├──────────────────────────────────────────────────────────────────────┤
│                   Infrastructure Layer                                │
│  ┌────────────┐ ┌──────────────┐ ┌────────────┐ ┌──────────────┐   │
│  │ FastAPI    │ │SQLAlchemy 2.0│ │  LiteLLM   │ │  Fernet +    │   │
│  │ + SSE      │ │+ aiosqlite   │ │ + Multi-   │ │  PBKDF2      │   │
│  │            │ │              │ │  Model Rt. │ │              │   │
│  └────────────┘ └──────────────┘ └────────────┘ └──────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

### 1.2 技术栈选型

> 沿用 v1 §1.2 全部技术栈，v2 新增/变更如下：

| 层次 | 技术 | 版本要求 | 变更类型 | 说明 |
| --- | --- | --- | --- | --- |
| Agent 编排 | Hub Plan-and-Execute | — | **v2 新增** | 7 阶段流水线：Intent→Plan→Dispatch→Collect→Evaluate→Merge→Response |
| 推理引擎 | ReAct / ToT / GoT / Reflexion | — | **v2 新增** | 多推理模式，按 Agent 职责选用 |
| Context Engine | ContextEngine Pipeline | — | **v2 新增** | Retriever → Filter → Compressor 三阶段 |
| Memory 层 | 5-Layer Memory Architecture | — | **v2 新增** | User Profile / Preference / Knowledge State / Long / Short |
| Knowledge Graph | graph_edges + Graph Query API | — | **v2 新增** | 多来源边类型 + 共享查询接口 |
| LLM 路由 | Multi-Model Router | — | **v2 新增** | 按 Agent / 任务类型路由到不同模型 |
| Evaluator | Evaluator Agent Interface | — | **v2 预留** | v2.1+ 实现，接口已定义 |

### 1.3 模块依赖关系（v2 更新）

```
Router → Service → Data
         │
         ├── AuthService → DatabaseService, SecureKeyStore        (沿用 v1)
         ├── ProjectService → DatabaseService, GitHubClient       (沿用 v1)
         ├── HubService → PlanExecuteEngine, MemoryMergeService   (v2 升级)
         ├── PlanExecuteEngine → IntentClassifier, AgentDispatcher, EvaluatorClient
         ├── AgentDispatcher → ReActEngine, ToTEngine, GoTEngine, ReflexionEngine
         ├── MemoryMergeService → MemoryProposalStore, MemoryCommitStore
         ├── ContextEngine → Retriever, RelevanceFilter, Compressor
         ├── KnowledgeGraphService → GraphEdgeStore, TFIDFEngine, EmbeddingEngine
         ├── LLMRouter → LLMProvider[], CapabilityDetector          (v2 新增)
         └── GraphQueryService → GraphEdgeStore, KnowledgeGraphService
```

---

## 2. 数据模型

### 2.1 ER 关系概览（v2 新增标注）

```
[v1 保留]
User 1──1 UserSetting
User 1──N Project
User 1──N Category / Tag
User 1──1 UserGitHubAccount
User 1──1 UserProfile
Project N──N Tag (via project_tags)
Project 1──N Note / ProjectAnalysis
User 1──N AgentSession
AgentSession 1──N AgentMessage

[v2 新增]
User 1──N KnowledgeState          (Mentor 维护的知识状态)
User 1──N MemoryProposal          (Agent 提交的记忆提案)
MemoryProposal 1──1 MemoryCommit  (Hub 合并后的提交记录)
Project 1──N GraphEdge            (知识图谱边关系)
AgentSession 1──N EvaluatorReview (v2.1+ 评估记录)
```

### 2.2 v1 保留表

> 以下表定义沿用 v1 §2.2，字段与约束不变：
> `users`, `user_settings`, `projects`, `categories`, `tags`, `project_tags`,
> `notes`, `agent_sessions`, `agent_messages`, `project_analyses`, `graph_cache`,
> `user_github_accounts`, `refresh_tokens`, `user_profiles`

### 2.3 v2 新增表

#### knowledge_states（知识状态层）

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| id | UUID | PK | 记录唯一 ID |
| user_id | UUID | FK → users, NOT NULL | 所属用户 |
| domain | VARCHAR(128) | NOT NULL | 知识领域（如 "python", "fastapi", "react"） |
| proficiency | INTEGER | NOT NULL, CHECK 0-100 | 掌握度评分 |
| evidence_count | INTEGER | DEFAULT 0 | 评估证据次数 |
| last_assessed_at | TIMESTAMP | NOT NULL | 最近评估时间 |
| source_agent | VARCHAR(32) | DEFAULT 'mentor' | 维护该记录的 Agent |
| created_at | TIMESTAMP | DEFAULT NOW | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT NOW | 更新时间 |

**约束:** `UNIQUE(user_id, domain)` — 同一用户同一领域仅一条记录

**索引:** `idx_knowledge_states_user ON knowledge_states(user_id, proficiency DESC)`

#### memory_proposals（记忆提案表）

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| id | UUID | PK | 提案唯一 ID |
| user_id | UUID | FK → users, NOT NULL | 所属用户 |
| agent_id | VARCHAR(32) | NOT NULL | 提交提案的 Agent |
| target_layer | VARCHAR(32) | NOT NULL | 目标层: "preference" / "knowledge_state" / "long_memory" |
| key | VARCHAR(256) | NOT NULL | 记忆键（如 "docker_proficiency"） |
| value | JSON | NOT NULL | 记忆值 |
| confidence | FLOAT | NOT NULL, CHECK 0.0-1.0 | Agent 自评置信度 |
| evidence | JSON | DEFAULT '[]' | 证据列表（字符串数组） |
| status | VARCHAR(16) | DEFAULT 'pending' | pending / merged / rejected |
| session_id | UUID | FK → agent_sessions, NULLABLE | 产生该提案的会话 |
| created_at | TIMESTAMP | DEFAULT NOW | 提交时间 |

**索引:** `idx_memory_proposals_user_status ON memory_proposals(user_id, status)`

#### memory_commits（记忆提交表）

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| id | UUID | PK | 提交唯一 ID |
| proposal_id | UUID | FK → memory_proposals, NOT NULL | 对应提案 |
| user_id | UUID | FK → users, NOT NULL | 所属用户 |
| merged_by | VARCHAR(32) | DEFAULT 'hub' | 合并执行者 |
| merge_strategy | VARCHAR(64) | NOT NULL | 合并策略（如 "evidence_weighted"） |
| score | FLOAT | NOT NULL | 综合评分: Recent Weight × Confidence × Evidence Score |
| previous_value | JSON | NULLABLE | 合并前的旧值（用于审计） |
| committed_value | JSON | NOT NULL | 合并后的最终值 |
| committed_at | TIMESTAMP | DEFAULT NOW | 提交时间 |

**索引:** `idx_memory_commits_user ON memory_commits(user_id, committed_at DESC)`

#### graph_edges（知识图谱边表）

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| id | UUID | PK | 边唯一 ID |
| user_id | UUID | FK → users, NOT NULL | 所属用户 |
| source_project_id | UUID | FK → projects, NOT NULL | 源项目 |
| target_project_id | UUID | FK → projects, NOT NULL | 目标项目 |
| edge_type | VARCHAR(32) | NOT NULL | 边类型（见下方枚举） |
| weight | FLOAT | NOT NULL, DEFAULT 0.0 | 边权重 |
| metadata | JSON | DEFAULT '{}' | 附加元数据 |
| created_at | TIMESTAMP | DEFAULT NOW | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT NOW | 更新时间 |

**edge_type 枚举:**

| 值 | 来源 | 说明 |
| --- | --- | --- |
| `tfidf` | Scout TF-IDF 分析 | 基于文本相似度 |
| `embedding` | Embedding 模型 | 语义向量余弦相似度 |
| `dependency` | Dependency Parser | 依赖/引用关系 |
| `topic` | GitHub Topics | 共同 Topic 标签 |
| `manual` | 用户手动关联 | 用户显式建立 |

**约束:** `UNIQUE(user_id, source_project_id, target_project_id, edge_type)` — 同类边不重复

**索引:** `idx_graph_edges_user ON graph_edges(user_id, edge_type, weight DESC)`

#### evaluator_reviews（评估记录表，v2.1+）

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| id | UUID | PK | 记录唯一 ID |
| session_id | UUID | FK → agent_sessions, NOT NULL | 关联会话 |
| agent_id | VARCHAR(32) | NOT NULL | 被评估的 Agent |
| accuracy_score | FLOAT | NULLABLE, CHECK 0.0-1.0 | 准确性评分 |
| completeness_score | FLOAT | NULLABLE, CHECK 0.0-1.0 | 完整性评分 |
| grounding_score | FLOAT | NULLABLE, CHECK 0.0-1.0 | 事实依据评分 |
| overall_score | FLOAT | NULLABLE, CHECK 0.0-1.0 | 综合评分 |
| feedback | TEXT | NULLABLE | 评估反馈文本 |
| created_at | TIMESTAMP | DEFAULT NOW | 评估时间 |

> **v2.1+ 预留:** 该表在 v2.0 创建但暂不写入数据，Evaluator Agent 在 v2.1+ 激活后开始填充。

### 2.4 数据保留策略（v2 更新）

| 表 | 保留策略 | 清理方式 |
| --- | --- | --- |
| `agent_messages` | 每会话保留最近 1000 条 | 沿用 v1 |
| `project_analyses` | `expires_at` 到期清理 | 沿用 v1 |
| `graph_cache` | `expires_at` 到期清理 | 沿用 v1 |
| `memory_proposals` | merged/rejected 状态 30 天后归档 | CleanupService 定时清理 |
| `memory_commits` | 永久保留（审计用途） | 不自动清理 |
| `evaluator_reviews` | 保留 90 天 | CleanupService 定时清理 |

---

## 3. 核心类型定义

### 3.1 v1 保留类型

> 以下类型沿用 v1 §3 定义，字段不变：
> `Message`, `StreamEventType`, `LLMChunk`, `ToolResult`, `StreamCollector`,
> `ExecutionContext`, `Session`, `ProjectContext`, `ConversationContext`,
> `SubIntent`, `IntentResult`, `AgentDefinition`, `ToolDefinition`

### 3.2 v2 新增类型

#### MemoryProposal

```python
from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal, Any


@dataclass
class MemoryProposal:
    """记忆提案 — Agent 向 Hub 提交的记忆修改请求"""
    agent_id: str                                                    # 提交 Agent
    target_layer: Literal["preference", "knowledge_state", "long_memory"]  # 目标层
    key: str                                                         # 记忆键
    value: Any                                                       # 记忆值
    confidence: float                                                # 置信度 0.0-1.0
    evidence: list[str] = field(default_factory=list)                # 证据列表
    session_id: str | None = None                                    # 关联会话
    timestamp: datetime = field(default_factory=datetime.utcnow)     # 提交时间

    def validate(self) -> bool:
        """校验提案合法性"""
        if not 0.0 <= self.confidence <= 1.0:
            return False
        if not self.key or len(self.key) > 256:
            return False
        if self.target_layer == "knowledge_state" and not isinstance(self.value, (int, float)):
            return False  # knowledge_state 的 value 必须是数值（掌握度）
        return True
```

#### MemoryCommit

```python
@dataclass
class MemoryCommit:
    """记忆提交 — Hub 合并后的最终记录"""
    proposal_id: str                  # 对应提案 ID
    merged_by: str                    # 合并执行者，通常为 "hub"
    merge_strategy: str               # 合并策略: "evidence_weighted"
    score: float                      # 综合评分: Recent Weight × Confidence × Evidence Score
    previous_value: Any = None        # 合并前旧值
    committed_value: Any = None       # 合并后最终值
    committed_at: datetime = field(default_factory=datetime.utcnow)

    @staticmethod
    def compute_score(confidence: float, evidence_count: int,
                      hours_since_last: float) -> float:
        """计算综合评分

        Formula:
            recent_weight = min(1.0, hours_since_last / 24)  # 24h 线性增长到 1.0
            evidence_score = min(1.0, evidence_count / 3)     # 3 条证据饱和
            score = recent_weight * confidence * evidence_score
        """
        recent_weight = min(1.0, hours_since_last / 24.0)
        evidence_score = min(1.0, evidence_count / 3.0)
        return recent_weight * confidence * evidence_score
```

#### AgentContext

```python
@dataclass
class AgentContext:
    """Agent 上下文 — ContextEngine 的输出，Agent 执行时接收的完整上下文"""
    query: str                                        # 用户原始查询
    relevant: str                                     # 压缩后的相关上下文
    memory_snapshot: dict = field(default_factory=dict)  # 记忆快照（按层聚合）
    user_profile: dict = field(default_factory=dict)     # 用户画像摘要
    project_context: "ProjectContext | None" = None      # 当前项目上下文
    token_budget: int = 8000                             # Token 预算上限
    tokens_used: int = 0                                 # 已用 Token 数

    @property
    def tokens_remaining(self) -> int:
        return max(0, self.token_budget - self.tokens_used)
```

#### HubContext（Hub 专用上下文）

```python
@dataclass
class HubContext:
    """Hub 上下文 — Hub Chief Agent 的精简上下文（不含所有 Agent 的 Context）

    设计目的：避免 Context Explosion，Hub 仅持有摘要级信息
    """
    conversation_summary: str = ""            # 对话历史摘要
    task_result_summary: str = ""             # 最近任务结果摘要
    long_memory: list[dict] = field(default_factory=list)  # 长期记忆条目
    user_profile: dict = field(default_factory=dict)       # 用户画像
    active_agents: list[str] = field(default_factory=list) # 当前活跃的 Agent ID
    task_plan: "TaskPlan | None" = None                    # 当前任务计划
```

#### TaskPlan（Hub Plan-and-Execute 计划）

```python
@dataclass
class TaskStep:
    """任务步骤"""
    step_id: str                     # 步骤 ID
    agent_id: str                    # 执行 Agent
    instruction: str                 # 指令描述
    depends_on: list[str] = field(default_factory=list)  # 依赖的步骤 ID
    status: Literal["pending", "running", "completed", "failed"] = "pending"
    result: Any = None               # 执行结果


@dataclass
class TaskPlan:
    """任务计划 — Hub Plan-and-Execute 的核心数据结构"""
    plan_id: str                                  # 计划 ID
    user_query: str                               # 用户原始查询
    intent: "IntentResult" = None                 # 意图分类结果
    steps: list[TaskStep] = field(default_factory=list)  # 步骤列表
    current_step: int = 0                         # 当前执行步骤索引
    created_at: datetime = field(default_factory=datetime.utcnow)

    @property
    def is_complete(self) -> bool:
        return all(s.status == "completed" for s in self.steps)

    @property
    def has_failure(self) -> bool:
        return any(s.status == "failed" for s in self.steps)

    def get_next_steps(self) -> list[TaskStep]:
        """获取所有依赖已满足的待执行步骤（支持并行调度）"""
        completed_ids = {s.step_id for s in self.steps if s.status == "completed"}
        return [
            s for s in self.steps
            if s.status == "pending"
            and all(dep in completed_ids for dep in s.depends_on)
        ]
```

#### ToTNode / GoTNode（推理树/图节点）

```python
@dataclass
class ToTNode:
    """Tree of Thoughts 节点 — Mentor 复杂概念分解使用"""
    node_id: str                             # 节点 ID
    thought: str                             # 思考内容
    depth: int = 0                           # 树深度
    score: float = 0.0                       # 评估分数
    children: list["ToTNode"] = field(default_factory=list)
    parent_id: str | None = None             # 父节点 ID
    is_terminal: bool = False                # 是否为叶节点（最终答案）


@dataclass
class GoTNode:
    """Graph of Thoughts 节点 — Mentor 多策略对比使用"""
    node_id: str                             # 节点 ID
    thought: str                             # 思考内容
    strategy: str = ""                       # 策略名称（如 "源码路线", "生活类比"）
    score: float = 0.0                       # 评估分数
    connections: list[str] = field(default_factory=list)  # 关联节点 ID（支持合并/聚合）
    metadata: dict = field(default_factory=dict)


@dataclass
class ReflexionRound:
    """Reflexion 反思轮次 — Curator 分类反思使用"""
    round_number: int                        # 轮次编号（1-3）
    trajectory: str                          # 当前操作轨迹描述
    evaluation: str                          # 评估结果
    reflection: str                          # 反思总结
    confidence: float = 0.0                  # 分类置信度
    should_retry: bool = False               # 是否需要重新尝试
```

#### GraphEdge 类型

```python
@dataclass
class GraphEdge:
    """知识图谱边"""
    source_project_id: str
    target_project_id: str
    edge_type: Literal["tfidf", "embedding", "dependency", "topic", "manual"]
    weight: float = 0.0
    metadata: dict = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)
```

#### EvaluatorResult（v2.1+ 预留）

```python
@dataclass
class EvaluatorResult:
    """评估结果 — Evaluator Agent 的输出（v2.1+ 实现）"""
    agent_id: str                            # 被评估 Agent
    accuracy_score: float = 0.0              # 准确性 0.0-1.0
    completeness_score: float = 0.0          # 完整性 0.0-1.0
    grounding_score: float = 0.0             # 事实依据 0.0-1.0
    overall_score: float = 0.0               # 综合评分
    feedback: str = ""                       # 评估反馈
    should_replan: bool = False              # 是否建议重新规划

    @property
    def passed(self) -> bool:
        return self.overall_score >= 0.6
```

#### 类型使用映射

| 类型 | 首次使用位置 | 说明 |
| --- | --- | --- |
| `MemoryProposal` | §7.2 | Agent 提交的记忆修改请求 |
| `MemoryCommit` | §7.2 | Hub 合并后的记忆提交 |
| `AgentContext` | §8.1 | ContextEngine 的输出 |
| `HubContext` | §6.3 | Hub Plan-and-Execute 上下文 |
| `TaskPlan` / `TaskStep` | §6.3 | Hub 任务计划 |
| `ToTNode` | §6.4 | Tree of Thoughts 推理节点 |
| `GoTNode` | §6.5 | Graph of Thoughts 推理节点 |
| `ReflexionRound` | §6.6 | Reflexion 反思轮次 |
| `GraphEdge` | §9.1 | 知识图谱边 |
| `EvaluatorResult` | §14.1 | Evaluator 评估结果 |

---

## 4. API 设计

### 4.1 v1 端点保留

> 以下端点沿用 v1 §4.1 定义，路径和行为不变：
> `/api/v1/auth/*`, `/api/v1/github/*`, `/api/v1/projects/*`, `/api/v1/categories/*`,
> `/api/v1/tags/*`, `/api/v1/notes/*`, `/api/v1/settings/*`
>
> v1 Agent 端点 `/api/v1/agent/*` 保留并扩展（见 §4.2）。

### 4.2 v2 新增端点

```
/api/v2/
├── agent/                          (v2 升级)
│   ├── POST /chat                  (沿用 v1，内部走 Hub Plan-and-Execute)
│   ├── POST /question              (沿用 v1)
│   ├── GET  /plan/{session_id}     (v2 新增: 获取当前 TaskPlan)
│   └── GET  /plan/{session_id}/steps  (v2 新增: 获取步骤执行状态)
├── knowledge-graph/                (v2 新增)
│   ├── GET  /                      (图谱全量数据，含多类型边)
│   ├── GET  /query                 (Graph Query API — 按边类型/权重查询)
│   ├── POST /edges                 (手动添加边)
│   └── DELETE /edges/{id}          (删除边)
├── memory/                         (v2 新增)
│   ├── GET  /proposals             (获取用户的记忆提案列表)
│   ├── GET  /proposals/{id}        (获取提案详情)
│   ├── GET  /commits               (获取用户的记忆提交历史)
│   ├── GET  /knowledge-states      (获取用户的知识状态)
│   └── PUT  /knowledge-states/{domain}  (手动覆盖知识状态)
└── evaluator/                      (v2.1+ 预留)
    ├── GET  /reviews               (获取评估记录)
    └── GET  /reviews/{session_id}  (获取会话评估详情)
```

### 4.3 Graph Query API 详细设计

```
GET /api/v2/knowledge-graph/query
    ?edge_type=tfidf,dependency       # 边类型筛选（逗号分隔）
    &min_weight=0.3                   # 最小权重
    &project_id=xxx                   # 以某项目为中心查询
    &depth=2                          # 查询深度（从 project_id 出发）
    &limit=100                        # 返回边数上限
```

**响应格式:**

```json
{
  "data": {
    "edges": [
      {
        "id": "uuid",
        "source_project_id": "uuid",
        "target_project_id": "uuid",
        "edge_type": "tfidf",
        "weight": 0.85,
        "metadata": {}
      }
    ],
    "nodes": [
      {
        "id": "uuid",
        "name": "fastapi",
        "language": "Python",
        "category": "后端框架"
      }
    ]
  },
  "meta": { "total_edges": 42, "total_nodes": 15 }
}
```

### 4.4 Memory Proposal API 详细设计

```
GET /api/v2/memory/proposals?status=pending&page=1&page_size=20
```

**响应格式:**

```json
{
  "data": [
    {
      "id": "uuid",
      "agent_id": "mentor",
      "target_layer": "knowledge_state",
      "key": "python_proficiency",
      "value": 85,
      "confidence": 0.88,
      "evidence": ["correctly explained decorators", "used async/await"],
      "status": "pending",
      "created_at": "2026-07-04T10:30:00Z"
    }
  ],
  "meta": { "page": 1, "page_size": 20, "total": 5 }
}
```

### 4.5 SSE 流式协议（v2 新增事件类型）

> 沿用 v1 §4.2 的 8 种事件类型，v2 新增：

```
event: plan_update
data: {"step_id": "s1", "agent_id": "scout", "status": "running", "instruction": "分析项目架构"}

event: memory_proposal
data: {"agent_id": "mentor", "target_layer": "knowledge_state", "key": "react", "confidence": 0.82}
```

```python
class StreamEventType(Enum):
    """SSE 流式事件类型（v2 扩展：在 v1 基础上新增 2 种）"""
    # v1 保留（8 种）
    TEXT_DELTA = "text_delta"
    TOOL_CALL = "tool_call"
    TOOL_RESULT = "tool_result"
    QUESTION = "question"
    DONE = "done"
    ERROR = "error"
    AGENT_SWITCH = "agent_switch"
    THINKING = "thinking"
    # v2 新增（2 种）
    PLAN_UPDATE = "plan_update"               # Hub 任务计划更新
    MEMORY_PROPOSAL = "memory_proposal"       # Agent 提交记忆提案
```

---

## 5. LLM Provider 层

### 5.1 v1 基础保留

> LLMProvider 核心类、SecureKeyStore、Fernet 加密、PBKDF2 降级、LLMConfig、
> SSRF 防护校验 均沿用 v1 §5，实现不变。

### 5.2 v2 新增: Multi-Model Router

```python
from dataclasses import dataclass
from enum import Enum


class ModelTier(Enum):
    """模型分级"""
    FAST = "fast"           # 快速推理（意图分类、简单任务）
    STANDARD = "standard"   # 标准推理（ReAct 循环）
    REASONING = "reasoning" # 深度推理（ToT/GoT/Reflexion）


@dataclass
class ModelRoute:
    """模型路由规则"""
    agent_id: str                            # 目标 Agent
    task_type: str = "default"               # 任务类型
    preferred_tier: ModelTier = ModelTier.STANDARD
    fallback_tier: ModelTier = ModelTier.FAST  # 降级目标


class LLMRouter:
    """多模型路由器 — 根据 Agent 和任务类型路由到不同模型

    设计目标:
    - 简单任务（Intent 分类）用 Fast 模型降低成本
    - 复杂推理（ToT/GoT）用 Reasoning 模型提升质量
    - 支持用户 BYOK 配置覆盖默认路由
    """

    def __init__(self, providers: dict[str, "LLMProvider"],
                 routes: list[ModelRoute]):
        self.providers = providers          # {"fast": provider1, "standard": provider2, ...}
        self.routes = routes
        self._route_map = self._build_route_map()

    def _build_route_map(self) -> dict[tuple[str, str], ModelRoute]:
        """构建路由查找表"""
        route_map = {}
        for route in self.routes:
            route_map[(route.agent_id, route.task_type)] = route
        return route_map

    def get_provider(self, agent_id: str,
                     task_type: str = "default") -> "LLMProvider":
        """获取目标 Agent + 任务类型对应的 LLMProvider"""
        route = self._route_map.get((agent_id, task_type))
        if not route:
            route = self._route_map.get((agent_id, "default"))
        if not route:
            # 默认使用 standard 模型
            return self.providers["standard"]

        tier_key = route.preferred_tier.value
        provider = self.providers.get(tier_key)
        if provider is None:
            # 降级到 fallback
            fallback_key = route.fallback_tier.value
            provider = self.providers.get(fallback_key)
        return provider or self.providers["standard"]

    async def complete(self, agent_id: str, task_type: str,
                       messages: list["Message"], **kwargs):
        """路由并调用对应模型"""
        provider = self.get_provider(agent_id, task_type)
        return await provider.complete(messages, **kwargs)
```

**默认路由配置:**

| Agent | 任务类型 | 模型层级 | 说明 |
| --- | --- | --- | --- |
| hub | intent_detection | FAST | 意图分类用快速模型 |
| hub | task_planning | STANDARD | 任务规划用标准模型 |
| scout | default | FAST | 快速分析 |
| mentor | simple_qa | STANDARD | 简单问答 |
| mentor | complex_concept | REASONING | ToT 深度讲解 |
| mentor | multi_strategy | REASONING | GoT 多策略对比 |
| navigator | default | STANDARD | 学习路线规划 |
| curator | classification | STANDARD | 分类反思 |
| scribe | default | STANDARD | 笔记生成 |

### 5.3 CapabilityDetector 降级（v1 保留 + v2 扩展）

> 沿用 v1 的 BYOK + CapabilityDetector 降级策略。v2 扩展：
> - 检测模型是否支持 Function Calling（ReAct 必需）
> - 检测模型是否支持 Structured Output（ToT/GoT 节点解析）
> - 不支持 Structured Output 的模型自动降级为 ReAct + 文本解析

---

## 6. Agent Execution Engines

### 6.1 v1 ReAct Engine（保留）

> ReAct Engine 核心循环沿用 v1 §6.1 实现。
> 使用场景：Scout（默认）、Navigator、Scribe、Mentor（简单问答）。
> ToolRegistry + @tool 装饰器沿用 v1 §6.2。

### 6.2 v2 新增: Hub Plan-and-Execute Engine

```python
class PlanExecuteEngine:
    """Hub Plan-and-Execute 引擎 — v2 核心编排引擎

    7 阶段流水线:
    1. Intent Detection  — 识别用户意图（复用 v1 IntentClassifier）
    2. Task Planning     — 分解为多个 TaskStep
    3. Agent Dispatch    — 并行/串行调度 Agent
    4. Result Collection — 收集各 Agent 执行结果
    5. Evaluation        — 评估结果质量（v2.1+ Evaluator，v2.0 Hub 自评）
    6. Memory Merge      — 合并 Agent 提交的 MemoryProposal
    7. Response          — 组装最终响应
    """

    def __init__(self, intent_classifier: "IntentClassifier",
                 agent_dispatcher: "AgentDispatcher",
                 memory_merge_service: "MemoryMergeService",
                 llm_router: "LLMRouter"):
        self.intent_classifier = intent_classifier
        self.agent_dispatcher = agent_dispatcher
        self.memory_merge = memory_merge_service
        self.llm_router = llm_router

    async def execute(self, session: "Session", message: str,
                      hub_context: "HubContext"):
        """主流程 — 流式输出 SSE 事件"""

        # ── Stage 1: Intent Detection ──
        intent = await self.intent_classifier.classify(
            message, hub_context.conversation_summary
        )

        # ── Stage 2: Task Planning ──
        plan = await self._create_plan(message, intent, hub_context)
        yield {"event": "plan_update", "data": {
            "plan_id": plan.plan_id,
            "steps": [{"step_id": s.step_id, "agent_id": s.agent_id,
                        "instruction": s.instruction} for s in plan.steps]
        }}

        # ── Stage 3 & 4: Dispatch + Collect ──
        while not plan.is_complete and not plan.has_failure:
            next_steps = plan.get_next_steps()
            if not next_steps:
                break

            # 并行调度无依赖的步骤
            results = await self.agent_dispatcher.dispatch_parallel(
                next_steps, session, hub_context
            )

            for step, result in zip(next_steps, results):
                step.status = "completed" if result.success else "failed"
                step.result = result
                yield {"event": "plan_update", "data": {
                    "step_id": step.step_id,
                    "status": step.status,
                }}

        # ── Stage 5: Evaluation（v2.0 Hub 自评，v2.1+ 委托 Evaluator）──
        evaluation = await self._evaluate_results(plan)

        # ── Stage 6: Memory Merge ──
        proposals = self._collect_proposals(plan)
        if proposals:
            commits = await self.memory_merge.merge(proposals, session.user_id)
            for commit in commits:
                yield {"event": "memory_proposal", "data": {
                    "proposal_id": commit.proposal_id,
                    "merge_strategy": commit.merge_strategy,
                    "score": commit.score,
                }}

        # ── Stage 7: Response ──
        response = await self._compose_response(plan, evaluation, hub_context)
        yield {"event": "text_delta", "data": {"content": response}}
        yield {"event": "done", "data": {"usage": self._total_usage(plan)}}

    async def _create_plan(self, message: str, intent: "IntentResult",
                           hub_context: "HubContext") -> "TaskPlan":
        """Stage 2: 使用 LLM 生成任务计划"""
        planning_prompt = TASK_PLANNING_PROMPT.format(
            user_message=message,
            intent=intent.agent_id,
            user_profile=hub_context.user_profile,
            conversation_summary=hub_context.conversation_summary,
        )
        response = await self.llm_router.complete(
            "hub", "task_planning",
            [Message(role="user", content=planning_prompt)],
        )
        # 解析 LLM 返回的 JSON 计划为 TaskPlan
        ...

    async def _evaluate_results(self, plan: "TaskPlan") -> dict:
        """Stage 5: v2.0 Hub 自评（v2.1+ 委托 Evaluator Agent）"""
        # v2.0: 简单规则检查
        failed = [s for s in plan.steps if s.status == "failed"]
        return {
            "all_completed": plan.is_complete,
            "failed_steps": len(failed),
            "should_replan": len(failed) > len(plan.steps) / 2,
        }

    def _collect_proposals(self, plan: "TaskPlan") -> list["MemoryProposal"]:
        """从所有已完成步骤中收集 MemoryProposal"""
        proposals = []
        for step in plan.steps:
            if step.status == "completed" and step.result:
                if hasattr(step.result, "memory_proposals"):
                    proposals.extend(step.result.memory_proposals)
        return proposals
```

### 6.3 AgentDispatcher

```python
@dataclass
class DispatchResult:
    """调度结果"""
    step_id: str
    agent_id: str
    success: bool
    result: Any = None
    error: str | None = None
    memory_proposals: list["MemoryProposal"] = field(default_factory=list)


class AgentDispatcher:
    """Agent 调度器 — 管理 Agent 执行和结果收集"""

    def __init__(self, engines: dict[str, Any],
                 context_engine: "ContextEngine"):
        self.engines = engines              # {"react": ReActEngine, "tot": ToTEngine, ...}
        self.context_engine = context_engine

    async def dispatch_parallel(self, steps: list["TaskStep"],
                                 session: "Session",
                                 hub_context: "HubContext") -> list[DispatchResult]:
        """并行调度多个独立步骤"""
        import asyncio
        tasks = [
            self._dispatch_single(step, session, hub_context)
            for step in steps
        ]
        return await asyncio.gather(*tasks, return_exceptions=False)

    async def _dispatch_single(self, step: "TaskStep",
                                session: "Session",
                                hub_context: "HubContext") -> DispatchResult:
        """调度单个步骤到对应 Agent 的执行引擎"""
        # 1. 通过 ContextEngine 构建 Agent 专属上下文
        agent_context = await self.context_engine.build_context(
            step.instruction, step.agent_id, session
        )

        # 2. 选择执行引擎（由 Agent 配置决定）
        engine = self._select_engine(step.agent_id, step.instruction)

        # 3. 执行
        try:
            result = await engine.run(session, agent_context)
            return DispatchResult(
                step_id=step.step_id,
                agent_id=step.agent_id,
                success=True,
                result=result,
                memory_proposals=result.get("memory_proposals", []),
            )
        except Exception as e:
            return DispatchResult(
                step_id=step.step_id,
                agent_id=step.agent_id,
                success=False,
                error=str(e),
            )

    def _select_engine(self, agent_id: str, instruction: str) -> Any:
        """根据 Agent 类型和指令复杂度选择执行引擎"""
        # Mentor + 复杂概念 → ToT
        # Mentor + 多策略对比 → GoT
        # Curator + 分类 → Reflexion
        # 其他 → ReAct
        ...
```

### 6.4 Tree of Thoughts Engine（Mentor 复杂概念）

```python
class ToTEngine:
    """Tree of Thoughts 引擎 — 用于 Mentor 复杂概念的多路径探索

    流程:
    1. Generate — LLM 生成多个思考分支
    2. Evaluate — 对每个分支评分
    3. Select   — 选择最高分分支继续展开
    4. Repeat   — 重复直到达到深度上限或找到满意答案

    适用场景: Mentor 讲解复杂概念（如 "解释 FastAPI 的请求生命周期"）
    """

    MAX_DEPTH = 3
    BRANCH_FACTOR = 3

    async def run(self, session: "Session",
                  context: "AgentContext") -> dict:
        """ToT 主流程"""
        root = ToTNode(node_id="root", thought=context.query, depth=0)
        candidates = [root]

        for depth in range(self.MAX_DEPTH):
            next_candidates = []
            for node in candidates:
                # Generate: 生成分支
                children = await self._generate_branches(node, context)
                # Evaluate: 评分
                for child in children:
                    child.score = await self._evaluate(child, context)
                    child.depth = depth + 1
                    child.parent_id = node.node_id
                node.children = children
                next_candidates.extend(children)

            # Select: 保留 top-K
            next_candidates.sort(key=lambda n: n.score, reverse=True)
            candidates = next_candidates[:self.BRANCH_FACTOR]

            # 如果最高分已超过阈值，提前终止
            if candidates[0].score >= 0.9:
                candidates[0].is_terminal = True
                break

        # 返回最佳路径
        best = candidates[0]
        return {
            "answer": best.thought,
            "tree": self._serialize_tree(root),
            "score": best.score,
        }

    async def _generate_branches(self, node: ToTNode,
                                  context: "AgentContext") -> list[ToTNode]:
        """使用 LLM 生成思考分支"""
        prompt = TOT_GENERATE_PROMPT.format(
            current_thought=node.thought,
            depth=node.depth,
            user_query=context.query,
            user_profile=context.user_profile,
        )
        # 调用 LLM 并解析返回的 JSON 分支
        ...

    async def _evaluate(self, node: ToTNode,
                        context: "AgentContext") -> float:
        """使用 LLM 评估节点质量"""
        prompt = TOT_EVALUATE_PROMPT.format(
            thought=node.thought,
            user_query=context.query,
            user_profile=context.user_profile,
        )
        # 调用 LLM 返回 0-1 评分
        ...
```

### 6.5 Graph of Thoughts Engine（Mentor 多策略对比）

```python
class GoTEngine:
    """Graph of Thoughts 引擎 — 用于 Mentor 多策略对比

    与 ToT 的区别:
    - ToT: 树结构，每个节点独立探索，选最优路径
    - GoT: 图结构，节点之间可以合并/聚合，支持多策略并行比较

    适用场景: Mentor 为用户提供多种讲解方式（源码路线 vs 生活类比 vs 对比分析）
    """

    async def run(self, session: "Session",
                  context: "AgentContext") -> dict:
        """GoT 主流程"""
        # 1. 并行生成多种策略
        strategies = await self._generate_strategies(context)

        nodes = []
        for i, strategy in enumerate(strategies):
            node = GoTNode(
                node_id=f"s{i}",
                thought=strategy["content"],
                strategy=strategy["name"],
            )
            nodes.append(node)

        # 2. 评估每种策略
        for node in nodes:
            node.score = await self._evaluate_strategy(node, context)

        # 3. 合并高分策略的优点（Graph 操作）
        if len(nodes) >= 2:
            merged = await self._merge_top_strategies(nodes, context)
            nodes.append(merged)

        # 4. 选择最佳
        best = max(nodes, key=lambda n: n.score)
        return {
            "answer": best.thought,
            "strategy": best.strategy,
            "all_strategies": [
                {"name": n.strategy, "score": n.score} for n in nodes
            ],
        }

    async def _generate_strategies(self, context: "AgentContext") -> list[dict]:
        """生成多种讲解策略"""
        prompt = GOT_STRATEGY_PROMPT.format(
            query=context.query,
            user_profile=context.user_profile,
        )
        # 返回 [{"name": "源码路线", "content": "..."}, ...]
        ...

    async def _merge_top_strategies(self, nodes: list[GoTNode],
                                     context: "AgentContext") -> GoTNode:
        """合并 top-2 策略的优点"""
        top2 = sorted(nodes, key=lambda n: n.score, reverse=True)[:2]
        prompt = GOT_MERGE_PROMPT.format(
            strategy_a=top2[0].thought,
            strategy_b=top2[1].thought,
            user_query=context.query,
        )
        merged_thought = await self.llm.complete(...)
        return GoTNode(
            node_id="merged",
            thought=merged_thought,
            strategy="merged",
            connections=[top2[0].node_id, top2[1].node_id],
        )
```

### 6.6 Reflexion Engine（Curator 分类反思）

```python
class ReflexionEngine:
    """Reflexion 引擎 — 用于 Curator 分类反思

    流程:
    1. Execute   — 执行分类操作
    2. Evaluate  — 评估分类质量（是否重复？是否过细？是否命名一致？）
    3. Reflect   — 基于评估生成反思
    4. Retry     — 如果质量不达标，基于反思重新执行（最多 3 轮）

    重要约束（来自 IDEA.md）:
    - 最多 3 轮反思，否则交给用户确认
    - 必须检查: 是否已有相同分类？命名一致？重复？过细？
    """

    MAX_ROUNDS = 3

    async def run(self, session: "Session",
                  context: "AgentContext") -> dict:
        """Reflexion 主流程"""
        rounds: list[ReflexionRound] = []

        for round_num in range(1, self.MAX_ROUNDS + 1):
            # 1. Execute: 执行分类
            trajectory = await self._execute_classification(context, rounds)

            # 2. Evaluate: 质量评估
            evaluation = await self._evaluate_classification(trajectory, context)

            # 3. Reflect: 生成反思
            reflection = await self._reflect(trajectory, evaluation, context)

            current_round = ReflexionRound(
                round_number=round_num,
                trajectory=trajectory,
                evaluation=evaluation,
                reflection=reflection,
                confidence=evaluation.get("confidence", 0.0),
                should_retry=not evaluation.get("acceptable", False),
            )
            rounds.append(current_round)

            # 质量达标，终止反思
            if not current_round.should_retry:
                break

        # 如果 3 轮后仍未达标，标记需要用户确认
        needs_user_confirm = rounds[-1].should_retry if rounds else False

        return {
            "classification": rounds[-1].trajectory if rounds else "",
            "rounds": rounds,
            "total_rounds": len(rounds),
            "needs_user_confirm": needs_user_confirm,
            "confidence": rounds[-1].confidence if rounds else 0.0,
        }

    async def _execute_classification(self, context: "AgentContext",
                                       previous_rounds: list[ReflexionRound]) -> str:
        """执行分类操作（如果有之前的反思，注入到 prompt）"""
        reflection_context = ""
        if previous_rounds:
            last = previous_rounds[-1]
            reflection_context = (
                f"上一轮反思: {last.reflection}\n"
                f"上一轮评估: {last.evaluation}"
            )
        prompt = REFLEXION_EXECUTE_PROMPT.format(
            query=context.query,
            reflection_context=reflection_context,
        )
        # 调用 LLM 执行分类
        ...

    async def _evaluate_classification(self, trajectory: str,
                                        context: "AgentContext") -> dict:
        """评估分类质量 — 4 项检查"""
        prompt = REFLEXION_EVALUATE_PROMPT.format(
            trajectory=trajectory,
            existing_categories=context.memory_snapshot.get("categories", []),
        )
        # 返回 {"acceptable": bool, "confidence": float,
        #        "duplicate": bool, "naming_consistent": bool, "too_fine": bool}
        ...

    async def _reflect(self, trajectory: str, evaluation: dict,
                       context: "AgentContext") -> str:
        """基于评估结果生成反思"""
        prompt = REFLEXION_REFLECT_PROMPT.format(
            trajectory=trajectory,
            evaluation=evaluation,
        )
        # 返回反思文本
        ...
```

---

## 7. Memory System

### 7.1 五层记忆架构

```
┌─────────────────────────────────────────────┐
│  Layer 1: User Profile（稳定层）              │
│  职业、语言、学习目标                           │
│  更新频率: 极低（用户主动修改或长期积累）          │
├─────────────────────────────────────────────┤
│  Layer 2: Preference（偏好层）                │
│  代码优先/图示/Markdown、学习节奏               │
│  更新频率: 低（通过 Memory Proposal 缓慢调整）   │
├─────────────────────────────────────────────┤
│  Layer 3: Knowledge State（知识状态层）        │
│  各技术栈掌握度 (Python: 92, FastAPI: 31)     │
│  更新频率: 中（Mentor 每次教学后提交 Proposal）  │
│  维护者: Mentor Agent                        │
├─────────────────────────────────────────────┤
│  Layer 4: Long Memory（历史层）               │
│  学习过什么、完成什么、失败什么                   │
│  更新频率: 中（每次会话结束时归档）               │
├─────────────────────────────────────────────┤
│  Layer 5: Short Memory（Agent 私有工作记忆）   │
│  Mentor: 最近 3 轮教学                         │
│  Scout: 最近 3 个 Repository                  │
│  更新频率: 高（实时，会话内）                     │
│  生命周期: 会话结束即丢弃                        │
└─────────────────────────────────────────────┘
```

### 7.2 Memory Merge Protocol

```python
class MemoryMergeService:
    """记忆合并服务 — Evidence Weighted Merge

    核心原则: Agent 不能直接修改记忆，只能通过 Proposal 提交。
    Hub 负责合并，使用 Evidence Weighted 策略而非简单投票。
    """

    async def merge(self, proposals: list[MemoryProposal],
                    user_id: str) -> list[MemoryCommit]:
        """合并一组 MemoryProposal

        流程:
        1. 按 (target_layer, key) 分组
        2. 对每组内的 proposals 计算 score
        3. 选择 score 最高的 proposal 作为 winner
        4. 创建 MemoryCommit 并持久化
        """
        commits = []

        # 按 key 分组
        groups = self._group_by_key(proposals)

        for (layer, key), group in groups.items():
            # 获取当前值
            current_value = await self._get_current_value(user_id, layer, key)

            # 计算每个 proposal 的 score
            scored = []
            for p in group:
                hours_since = self._hours_since_last_update(user_id, layer, key)
                score = MemoryCommit.compute_score(
                    confidence=p.confidence,
                    evidence_count=len(p.evidence),
                    hours_since_last=hours_since,
                )
                scored.append((p, score))

            # 选择最高分
            scored.sort(key=lambda x: x[1], reverse=True)
            winner, winner_score = scored[0]

            # 创建 MemoryCommit
            commit = MemoryCommit(
                proposal_id=winner.agent_id + ":" + winner.key,  # 实际使用 UUID
                merged_by="hub",
                merge_strategy="evidence_weighted",
                score=winner_score,
                previous_value=current_value,
                committed_value=winner.value,
            )

            # 持久化 commit 并更新目标层
            await self._persist_commit(commit, user_id)
            await self._update_target_layer(user_id, layer, key, winner.value)

            # 更新 proposal 状态
            await self._mark_proposal_merged(winner)

            commits.append(commit)

        return commits

    def _group_by_key(self, proposals: list[MemoryProposal]
                       ) -> dict[tuple[str, str], list[MemoryProposal]]:
        """按 (target_layer, key) 分组"""
        groups: dict[tuple[str, str], list[MemoryProposal]] = {}
        for p in proposals:
            k = (p.target_layer, p.key)
            groups.setdefault(k, []).append(p)
        return groups

    async def _get_current_value(self, user_id: str, layer: str,
                                  key: str) -> Any:
        """从目标层获取当前值"""
        if layer == "preference":
            profile = await self.profile_service.get_profile(user_id)
            return profile.learning_preferences.get(key)
        elif layer == "knowledge_state":
            return await self.db.get_knowledge_state(user_id, key)
        elif layer == "long_memory":
            return await self.db.get_long_memory_entry(user_id, key)
        return None

    async def _persist_commit(self, commit: MemoryCommit,
                               user_id: str) -> None:
        """持久化 MemoryCommit 到 memory_commits 表"""
        ...

    async def _update_target_layer(self, user_id: str, layer: str,
                                    key: str, value: Any) -> None:
        """更新目标层的值"""
        ...

    async def _mark_proposal_merged(self, proposal: MemoryProposal) -> None:
        """标记 proposal 状态为 merged"""
        ...
```

### 7.3 Memory CRUD 接口

```python
class MemoryCRUDService:
    """记忆 CRUD 服务 — 提供记忆层的读写接口"""

    # ── Knowledge State ──

    async def get_knowledge_states(self, user_id: str) -> list[dict]:
        """获取用户所有知识状态"""
        ...

    async def get_knowledge_state(self, user_id: str,
                                   domain: str) -> dict | None:
        """获取指定领域的知识状态"""
        ...

    async def update_knowledge_state(self, user_id: str, domain: str,
                                      proficiency: int) -> None:
        """手动更新知识状态（用户覆盖）"""
        ...

    # ── Memory Proposal ──

    async def create_proposal(self, user_id: str,
                               proposal: MemoryProposal) -> str:
        """创建记忆提案，返回 proposal_id"""
        ...

    async def get_proposals(self, user_id: str, status: str = "pending",
                             page: int = 1, page_size: int = 20) -> list[dict]:
        """分页查询记忆提案"""
        ...

    # ── Memory Commit ──

    async def get_commits(self, user_id: str, page: int = 1,
                           page_size: int = 20) -> list[dict]:
        """分页查询记忆提交历史"""
        ...
```

### 7.4 Short Memory（Agent 私有工作记忆）

> Short Memory 不持久化到数据库，仅存储在 Agent 执行期间的内存中。
> 每个 Agent 的 Short Memory 策略不同：

| Agent | Short Memory 内容 | 容量限制 |
| --- | --- | --- |
| Mentor | 最近 3 轮教学对话 | 3 轮 |
| Scout | 最近 3 个分析过的 Repository | 3 个 |
| Navigator | 当前学习路线 + 最近 5 条历史 | 5 条 |
| Curator | 当前分类任务 + 已有分类列表 | 当前 + 全量 |
| Scribe | 当前笔记 + 相关笔记摘要 | 当前 + 3 条 |

---

## 8. Context Engineering

### 8.1 ContextEngine Pipeline

```python
class ContextEngine:
    """上下文引擎 — v2 核心组件

    Pipeline: Query → Retriever → Filter → Compressor → AgentContext
    目标: 为每个 Agent 构建精简、相关的上下文，避免 Context Explosion
    """

    def __init__(self, retriever: "Retriever",
                 relevance_filter: "RelevanceFilter",
                 compressor: "ContextCompressor"):
        self.retriever = retriever
        self.filter = relevance_filter
        self.compressor = compressor

    async def build_context(self, query: str, agent_id: str,
                            session: "Session") -> AgentContext:
        """构建 Agent 上下文 — 三阶段 Pipeline"""

        # Stage 1: 检索相关上下文
        raw = await self.retriever.fetch(query, session)

        # Stage 2: 按 Agent 角色过滤（不同 Agent 需要不同类型的上下文）
        filtered = self.filter.relevance(raw, agent_id)

        # Stage 3: 压缩到 Token 预算内
        budget = self._get_token_budget(agent_id)
        compressed = self.compressor.summarize(filtered, budget)

        return AgentContext(
            query=query,
            relevant=compressed,
            memory_snapshot=await self._get_memory_snapshot(session.user_id, agent_id),
            user_profile=await self._get_user_profile_summary(session.user_id),
            project_context=await self._get_project_context(session),
            token_budget=budget,
            tokens_used=self._count_tokens(compressed),
        )

    def _get_token_budget(self, agent_id: str) -> int:
        """各 Agent 的 Token 预算"""
        budgets = {
            "hub": 4000,       # Hub 使用精简上下文
            "scout": 6000,     # Scout 需要项目信息
            "mentor": 8000,    # Mentor 需要最多上下文
            "navigator": 6000,
            "curator": 6000,
            "scribe": 6000,
        }
        return budgets.get(agent_id, 6000)
```

### 8.2 Retriever

```python
class Retriever:
    """上下文检索器 — 从多个来源获取原始上下文"""

    async def fetch(self, query: str,
                    session: "Session") -> dict:
        """检索相关上下文

        来源:
        1. 会话历史（最近 N 条消息）
        2. 用户画像 + 知识状态
        3. 知识图谱相关节点
        4. 项目分析缓存
        5. 相关笔记
        """
        return {
            "history": await self._fetch_history(session),
            "profile": await self._fetch_profile(session.user_id),
            "knowledge": await self._fetch_knowledge(session.user_id, query),
            "graph": await self._fetch_graph_neighbors(session, query),
            "analyses": await self._fetch_analyses(session),
            "notes": await self._fetch_related_notes(session, query),
        }
```

### 8.3 RelevanceFilter

```python
class RelevanceFilter:
    """相关性过滤器 — 按 Agent 角色过滤上下文

    不同 Agent 关注不同类型的信息:
    - Scout: 项目结构、依赖关系、README
    - Mentor: 源码、用户知识状态、历史对话
    - Navigator: 学习历史、知识图谱、难度分布
    - Curator: 现有分类、标签、项目元数据
    - Scribe: 相关笔记、Graph Similarity
    """

    AGENT_FOCUS = {
        "scout": ["project", "graph", "analyses"],
        "mentor": ["history", "knowledge", "profile"],
        "navigator": ["knowledge", "graph", "history"],
        "curator": ["project", "notes"],
        "scribe": ["notes", "graph", "history"],
    }

    def relevance(self, raw: dict, agent_id: str) -> dict:
        """按 Agent 角色过滤，仅保留相关信息"""
        focus_keys = self.AGENT_FOCUS.get(agent_id, list(raw.keys()))
        return {k: v for k, v in raw.items() if k in focus_keys}
```

### 8.4 ContextCompressor

```python
class ContextCompressor:
    """上下文压缩器 — 将上下文压缩到 Token 预算内

    策略:
    1. 截断: 长文本按相关性排序后截断
    2. 摘要: 使用 LLM 或规则生成摘要
    3. 优先级: system prompt > 用户画像 > 项目上下文 > 历史 > 图谱
    """

    def summarize(self, filtered: dict, token_budget: int) -> str:
        """压缩上下文"""
        parts = []
        budget_remaining = token_budget

        # 优先级 1: 用户画像摘要（~200 tokens）
        if "profile" in filtered:
            profile_summary = self._summarize_profile(filtered["profile"])
            tokens = self._count_tokens(profile_summary)
            if tokens <= budget_remaining:
                parts.append(f"[User Profile] {profile_summary}")
                budget_remaining -= tokens

        # 优先级 2: 知识状态（~300 tokens）
        if "knowledge" in filtered:
            knowledge_summary = self._summarize_knowledge(filtered["knowledge"])
            tokens = self._count_tokens(knowledge_summary)
            if tokens <= budget_remaining:
                parts.append(f"[Knowledge State] {knowledge_summary}")
                budget_remaining -= tokens

        # 优先级 3: 项目上下文（~500 tokens）
        if "project" in filtered:
            project_summary = self._summarize_project(filtered["project"])
            tokens = self._count_tokens(project_summary)
            if tokens <= budget_remaining:
                parts.append(f"[Project] {project_summary}")
                budget_remaining -= tokens

        # 优先级 4: 对话历史（剩余预算）
        if "history" in filtered:
            history_summary = self._compress_history(
                filtered["history"], budget_remaining
            )
            parts.append(f"[History] {history_summary}")

        return "\n\n".join(parts)
```

### 8.5 Token Budget Management

| Agent | 总预算 | System Prompt | 用户画像 | 项目上下文 | 历史 | 其他 |
| --- | --- | --- | --- | --- | --- | --- |
| Hub | 4000 | 800 | 400 | — | 800 | 2000 (Plan) |
| Scout | 6000 | 1000 | 200 | 2000 | 800 | 2000 |
| Mentor | 8000 | 1200 | 600 | 1500 | 2000 | 2700 |
| Navigator | 6000 | 1000 | 400 | 1000 | 1600 | 2000 |
| Curator | 6000 | 1000 | 200 | 1500 | 1300 | 2000 |
| Scribe | 6000 | 1000 | 300 | 1500 | 1200 | 2000 |

---

## 9. Knowledge Graph

### 9.1 多图来源与边类型

> v1 仅支持 TF-IDF 单一来源的相似度图。v2 升级为多来源、多类型边。

| 边类型 | 生成方式 | 触发时机 | 权重计算 |
| --- | --- | --- | --- |
| `tfidf` | TF-IDF + 余弦相似度 | Scout 分析项目后 | `cosine_sim(doc_a, doc_b)` |
| `embedding` | Embedding 模型 + 余弦相似度 | 项目导入后（v2.1+） | `cosine_sim(emb_a, emb_b)` |
| `dependency` | Dependency Parser 解析 | Scout 分析依赖时 | `1.0`（有/无） |
| `topic` | GitHub Topics 交集 | 项目导入时 | `len(common_topics) / max_topics` |
| `manual` | 用户手动关联 | 用户操作 | `1.0` |

### 9.2 Graph Query API

```python
class GraphQueryService:
    """知识图谱查询服务 — 供所有 Agent 使用"""

    async def query(self, user_id: str,
                    edge_types: list[str] | None = None,
                    project_id: str | None = None,
                    min_weight: float = 0.0,
                    depth: int = 1,
                    limit: int = 100) -> dict:
        """查询知识图谱

        Args:
            user_id: 用户 ID
            edge_types: 边类型过滤（None 表示全部）
            project_id: 以某项目为中心查询（None 表示全局）
            min_weight: 最小权重过滤
            depth: 从中心项目出发的查询深度
            limit: 返回边数上限

        Returns:
            {"nodes": [...], "edges": [...]}
        """
        edges = await self.store.query_edges(
            user_id=user_id,
            edge_types=edge_types,
            min_weight=min_weight,
            limit=limit,
        )

        if project_id:
            edges = self._filter_by_project_and_depth(
                edges, project_id, depth
            )

        # 从边中提取节点
        node_ids = set()
        for e in edges:
            node_ids.add(e.source_project_id)
            node_ids.add(e.target_project_id)
        nodes = await self.store.get_projects_by_ids(list(node_ids))

        return {"nodes": nodes, "edges": edges}

    def _filter_by_project_and_depth(self, edges: list,
                                      project_id: str,
                                      depth: int) -> list:
        """BFS 从 project_id 出发，保留 depth 层内的边"""
        visited = {project_id}
        result = []
        frontier = {project_id}

        for _ in range(depth):
            next_frontier = set()
            for edge in edges:
                if edge.source_project_id in frontier:
                    result.append(edge)
                    next_frontier.add(edge.target_project_id)
                elif edge.target_project_id in frontier:
                    result.append(edge)
                    next_frontier.add(edge.source_project_id)
            visited.update(next_frontier)
            frontier = next_frontier - visited

        return result
```

### 9.3 共享访问层

所有 Agent 通过 `GraphQueryService` 访问知识图谱，不直接操作 `graph_edges` 表。

| Agent | 查询用途 |
| --- | --- |
| Scout | 查找与当前项目相似的已分析项目 |
| Mentor | 获取项目间关系辅助讲解 |
| Navigator | 构建学习路线（基于图谱拓扑） |
| Scribe | 查找相关笔记（通过图谱关联） |
| Curator | 了解项目间关系辅助分类 |

### 9.4 Embedding 向量存储（v2.1+ 预留）

> v2.0 使用 `graph_edges` 表存储预计算的边权重。
> v2.1+ 计划引入向量数据库（如 ChromaDB/Qdrant）存储 Embedding 向量，
> 支持实时相似度查询。

```python
class VectorStoreAdapter:
    """向量存储适配器（v2.1+ 预留接口）"""

    async def upsert(self, project_id: str,
                     embedding: list[float]) -> None:
        """插入/更新向量"""
        ...

    async def search(self, query_embedding: list[float],
                     top_k: int = 10) -> list[dict]:
        """相似度搜索"""
        ...
```

---

## 10. 反问系统

> 反问系统沿用 v1 §8 设计，包括：
> - AgentQuestion TypeScript Interface（5 种问题类型）
> - UI 组件规范（radio / checkbox / slider / drag_sort / knowledge_map）
> - 交互规则（3-7 选项、"其他"展开、跳过默认中等）
> - 反问恢复流程（B-05: 4 步恢复）
>
> **v2 变更点:**
> - v2 的反问在 Hub Plan-and-Execute 流程中触发时，会暂停当前 TaskStep 并等待用户回答后恢复执行
> - 反问结果除存入 UserProfile 外，还会通过 MemoryProposal 写入 Preference 层

---

## 11. 安全设计

> 安全设计沿用 v1 §10 全部方案，包括：
> - JWT 认证 + Token 轮换（S-04）
> - CORS 配置（F5-44）
> - PromptGuard（S-05: block/mark 模式）
> - Fernet 加密 + PBKDF2 降级（S-03）
> - SSRF 防护（T-01）
> - 路径遍历校验（F5-17）
> - 速率限制（附录 A）
>
> **v2 新增安全考量:**
> - Memory Proposal 防篡改：Agent 只能提交自己 `agent_id` 的 Proposal，不可伪造
> - Knowledge State 写入校验：`proficiency` 值必须在 0-100 范围内
> - Context Engine 注入防护：Retriever 获取的外部数据需经 PromptGuard.sanitize_tool_output() 处理

---

## 12. 性能设计

### 12.1 延迟目标（v2 更新）

| 操作 | 目标延迟 | v1 基线 | v2 要求 | 说明 |
| --- | --- | --- | --- | --- |
| API 响应（不含 Agent） | < 500ms | < 500ms | 不变 | 沿用 v1 |
| Agent 首 token | < 3s | < 3s | 不变 | Hub 编排开销需 < 200ms |
| Scout 快速分析 | < 5s | < 5s | 不变 | 沿用 v1 |
| 图谱渲染 (500 节点) | < 2s | < 2s | 不变 | 沿用 v1 |
| 反问面板渲染 | < 500ms | < 500ms | 不变 | 沿用 v1 |
| **Memory Merge** | **< 500ms** | — | **v2 新增** | Proposal 分组 + Score 计算 + 持久化 |
| **Context Build** | **< 2s** | — | **v2 新增** | Retriever + Filter + Compressor 全流程 |
| **Hub Plan-and-Execute** | **< 8s（首响应）** | — | **v2 新增** | Intent + Plan + 首个 Agent Dispatch |
| **ToT 完整执行** | **< 15s** | — | **v2 新增** | 3 层 × 3 分支，含 LLM 评估 |
| **Reflexion 单轮** | **< 5s** | — | **v2 新增** | Execute + Evaluate + Reflect |

### 12.2 缓存策略（v2 新增条目）

| 缓存项 | TTL | 刷新条件 | 说明 |
| --- | --- | --- | --- |
| Knowledge State 快照 | 实时 | 每次 Memory Commit | 写入即更新 |
| Memory Proposal 列表 | 5 分钟 | 新 Proposal 提交 | 减少轮询开销 |
| Graph Edge 查询结果 | 10 分钟 | 新 Edge 写入 | 图谱查询缓存 |
| Context Build 结果 | 会话内 | 新消息到达 | 同一会话内缓存 |

> v1 缓存条目（项目 README、GitHub Stars、ProjectAnalysis、GraphCache、User 画像）沿用 v1 §11.2。

---

## 13. 前端设计

### 13.1 技术栈

> 沿用 v1 §12.1 全部技术栈。v2 新增页面：

| 页面 | 路由 | 说明 |
| --- | --- | --- |
| MemoryPanel | `/memory` | 知识状态可视化 + 记忆提案/提交历史 |
| PlanProgress | 嵌入 AgentChat | Hub TaskPlan 步骤进度展示 |

### 13.2 v2 新增组件

```typescript
// src/components/Memory/KnowledgeRadar.tsx
interface KnowledgeState {
  domain: string;
  proficiency: number;  // 0-100
  lastAssessedAt: string;
  sourceAgent: string;
}

// src/components/Agent/PlanProgress.tsx
interface TaskPlanView {
  planId: string;
  steps: Array<{
    stepId: string;
    agentId: string;
    instruction: string;
    status: "pending" | "running" | "completed" | "failed";
  }>;
}

// src/components/Memory/MemoryTimeline.tsx
interface MemoryTimelineEntry {
  type: "proposal" | "commit";
  agentId: string;
  targetLayer: string;
  key: string;
  confidence?: number;
  score?: number;
  timestamp: string;
}
```

### 13.3 CSS 变量 / 主题 / D3.js

> 沿用 v1 §12.2 - §12.4，不变。

---

## 14. 扩展性预留

### 14.1 Evaluator Agent 接口（v2.1+）

```python
from abc import ABC, abstractmethod


class EvaluatorInterface(ABC):
    """Evaluator Agent 接口 — v2.0 定义，v2.1+ 实现

    职责:
    - Review Hub 决策质量
    - 检查 Memory 冲突
    - 验证 Agent 回答质量
    - 判断是否需要重新规划
    - 对 Agent 输出进行自动评分（Accuracy / Completeness / Grounding）
    """

    @abstractmethod
    async def evaluate(self, session: "Session",
                       agent_output: dict,
                       hub_context: "HubContext") -> "EvaluatorResult":
        """评估 Agent 输出质量"""
        ...

    @abstractmethod
    async def check_memory_conflict(self,
                                     proposals: list["MemoryProposal"],
                                     user_id: str) -> list[dict]:
        """检查 Memory Proposal 之间是否存在冲突"""
        ...

    @abstractmethod
    async def should_replan(self, plan: "TaskPlan",
                             results: list["DispatchResult"]) -> bool:
        """判断是否需要重新规划"""
        ...


class StubEvaluator(EvaluatorInterface):
    """v2.0 占位实现 — 所有评估返回通过"""

    async def evaluate(self, session, agent_output, hub_context):
        return EvaluatorResult(
            agent_id="stub",
            overall_score=1.0,
            feedback="v2.0 stub: 评估功能将在 v2.1 实现",
        )

    async def check_memory_conflict(self, proposals, user_id):
        return []  # v2.0 不检查冲突

    async def should_replan(self, plan, results):
        failed = sum(1 for r in results if not r.success)
        return failed > len(results) / 2  # 超过半数失败则重规划
```

### 14.2 MCP 工具适配器（沿用 v1 §13.1）

> MCPToolAdapter 接口沿用 v1 §13.1 预留设计，计划在 v2.2+ 实现。

### 14.3 向量数据库（v2.1+）

> v2.0 使用 `graph_edges` 表 + 预计算权重。
> v2.1+ 引入向量数据库后，`embedding` 类型边将改为实时查询。

```python
class VectorStoreConfig:
    """向量数据库配置（v2.1+）"""
    provider: str = "chromadb"        # "chromadb" | "qdrant" | "pinecone"
    collection_name: str = "repo_embeddings"
    embedding_model: str = "text-embedding-3-small"
    dimension: int = 1536
    distance_metric: str = "cosine"
```

### 14.4 通知服务 / Skill 加载器（沿用 v1 §13.2 - §13.3）

> NotificationService 和 SkillLoader 接口沿用 v1 预留设计，不变。

---

## 附录 A: Agent 执行引擎分配表

| Agent | 默认引擎 | 条件切换 | 说明 |
| --- | --- | --- | --- |
| Hub | Plan-and-Execute | — | Hub 始终使用 Plan-and-Execute |
| Scout | ReAct | — | Scout 始终使用 ReAct |
| Mentor | ReAct | 复杂概念 → ToT; 多策略对比 → GoT | 由 AgentDispatcher 根据指令复杂度判断 |
| Navigator | ReAct | — | Navigator 始终使用 ReAct |
| Curator | Reflexion | — | Curator 分类任务始终使用 Reflexion |
| Scribe | ReAct | — | Scribe 始终使用 ReAct |

## 附录 B: 速率限制表

> 沿用 v1 附录 A 速率限制表，v2 新增：

| 端点 | 限制 | 说明 |
| --- | --- | --- |
| `GET /knowledge-graph/query` | 30 次/分钟/user | 图谱查询 |
| `GET /memory/proposals` | 20 次/分钟/user | 提案查询 |
| `GET /memory/knowledge-states` | 20 次/分钟/user | 知识状态查询 |
| `PUT /memory/knowledge-states/{domain}` | 10 次/分钟/user | 手动覆盖知识状态 |
