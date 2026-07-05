# RepoPilot v2 — Agent System Specification

> 版本: 2.0.0 | 日期: 2026-07-04 | 路径更新: 2026-07-05 | 状态: 草稿
>
> 本文档是 v2 Agent 系统的技术规格权威来源。基于 v1 Agent 系统迭代。
>
> **引用约定:** 凡注明"沿用 v1 §X"的章节，其实现细节以 v1 AGENT_SPEC 对应章节为权威来源，本文档仅记录 v2 差异。
>
> **路径说明：** `backend/agents/` 对照 v1，见 [`docs/architecture/PATH_MAPPING.md`](../../../architecture/PATH_MAPPING.md)。
>
> **依赖文档:**
> - `AGENT_PRD.md` (v2 Agent 产品需求)
> - `TECHNICAL_SPEC.md` (v2 总体架构)
> - `v1/SPEC/AGENT_SPEC.md` (v1 Agent 规格基线)

---

## 目录

- [§1 Agent 系统架构](#1-agent-系统架构)
- [§2 Agent 角色注册](#2-agent-角色注册)
- [§3 Hub Plan-and-Execute Engine](#3-hub-plan-and-execute-engine)
- [§4 LLM Provider 层](#4-llm-provider-层)
- [§5 工具系统（19 个工具）](#5-工具系统19-个工具)
- [§6 Memory System](#6-memory-system)
- [§7 Context Engineering](#7-context-engineering)
- [§8 反问系统](#8-反问系统)
- [§9 API 端点](#9-api-端点)
- [§10 降级策略](#10-降级策略)
- [§11 安全设计](#11-安全设计)
- [§12 性能设计](#12-性能设计)
- [§13 TBD 管理](#13-tbd-管理)
- [§14 扩展性预留](#14-扩展性预留)

---

## §1 Agent 系统架构

### §1.1 Agent Layer 在四层架构中的定位

RepoPilot v2 采用四层架构。Agent Layer 是系统的核心智能层，位于 Presentation Layer 与 Knowledge Layer 之间，承担所有推理、规划、调度和协作职责。

```
┌──────────────────────────────────────────────────────────────────────┐
│                   Presentation Layer                                  │
│                   React + Vite + TypeScript + Zustand + D3.js v7      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │Dashboard  │ │GraphPage │ │AgentChat │ │Settings  │ │MemoryPanel│  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│                          │ fetch / EventSource (SSE)                  │
├──────────────────────────┼───────────────────────────────────────────┤
│                   Agent Layer  ◄── 本文档范围                         │
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
│  └────────────┘ └──────────────┘ └────────────┘ └────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

**Agent Layer 职责边界：**

| 职责 | 归属 | 说明 |
|------|------|------|
| 意图识别 | Agent Layer (Hub) | IntentDetector 规则 + LLM 双策略 |
| 任务规划 | Agent Layer (Hub) | TaskPlanner SubTask 分解 |
| Agent 调度 | Agent Layer (Hub) | AgentDispatcher 并行/串行 |
| 推理执行 | Agent Layer (各 Agent) | ReAct / ToT / GoT / Reflexion |
| 工具调用 | Agent Layer (各 Agent) | 通过 ToolRegistry 调用 Knowledge Layer 服务 |
| Memory 读写 | Agent Layer → Knowledge Layer | Proposal-based 写，直接读 |
| Context 构建 | Agent Layer (ContextEngine) | Retriever → Filter → Compress |
| 知识图谱查询 | Agent Layer → Knowledge Layer | 通过 query_knowledge_graph 工具 |

### §1.2 Hub 为中心的星型拓扑

v2 沿用 v1 的星型拓扑设计，Hub 作为中心节点，所有 Agent 间不直接通信。

```
                        ┌──────────────┐
                        │     User     │
                        └──────┬───────┘
                               │ SSE
                        ┌──────▼───────┐
                 ┌──────┤     Hub      ├──────┐
                 │      │ (Chief Agent)│      │
                 │      └──────┬───────┘      │
                 │             │              │
          ┌──────▼──────┐ ┌────▼─────┐ ┌─────▼──────┐
          │   Scout     │ │  Mentor  │ │ Navigator  │
          │  (ReAct)    │ │(Adaptive)│ │  (ReAct)   │
          └──────┬──────┘ └────┬─────┘ └─────┬──────┘
                 │             │              │
          ┌──────▼──────┐ ┌────▼─────┐
          │  Curator    │ │  Scribe  │
          │(Reflexion)  │ │ (ReAct)  │
          └─────────────┘ └──────────┘

          ┌─────────────┐
          │ Evaluator   │  (v2.1+, 独立于执行链路)
          └─────────────┘
```

**通信规则：**

1. **Agent → Hub:** 通过 `TaskResult` 返回结果 + `MemoryProposal` 提交记忆提案
2. **Hub → Agent:** 通过 `SubTask` 下发指令 + `AgentContext` 注入上下文
3. **Agent ↛ Agent:** 禁止直接调用（[TBD-04] 沿用 v1 决策）
4. **Evaluator → Hub:** v2.1+ 通过 `EvaluatorResult` 反馈质量评估

### §1.3 Agent 间通信协议

v2 新增两个核心 dataclass 用于 Agent 间通信：

```python
from dataclasses import dataclass, field
from typing import Any, Literal
from datetime import datetime


@dataclass
class SubTask:
    """Hub 下发给子 Agent 的子任务"""
    task_id: str                                    # 任务 ID（对应 TaskPlan.steps[].step_id）
    agent_id: str                                   # 目标 Agent
    instruction: str                                # 任务指令
    context: "AgentContext" = None                  # 为该任务构建的最小上下文
    depends_on: list[str] = field(default_factory=list)  # 依赖的任务 ID
    priority: int = 50                              # 优先级 0-100
    timeout_s: int = 60                             # 超时秒数
    metadata: dict = field(default_factory=dict)    # 附加元数据（如 plan_id, session_id）


@dataclass
class TaskResult:
    """子 Agent 返回给 Hub 的执行结果"""
    task_id: str                                    # 对应 SubTask.task_id
    agent_id: str                                   # 执行 Agent
    status: Literal["success", "partial", "failed", "timeout"] = "success"
    output: Any = None                              # 主输出（文本/结构化数据）
    output_summary: str = ""                        # Hub 可见的摘要（≤500 tokens）
    memory_proposals: list["MemoryProposal"] = field(default_factory=list)  # 附带提案
    tool_calls: list[dict] = field(default_factory=list)  # 工具调用记录
    token_usage: dict = field(default_factory=dict) # {prompt: int, completion: int}
    duration_ms: int = 0                            # 执行耗时
    error: str | None = None                        # 失败原因
    followup_suggestions: list[str] = field(default_factory=list)  # 后续建议
```

**协议流程：**

```
Hub                          Agent (e.g. Mentor)
 │                               │
 │──── SubTask ─────────────────►│
 │     (task_id, instruction,    │
 │      context, depends_on)     │
 │                               │
 │                               │──── 执行 ReAct/ToT/GoT/Reflexion
 │                               │     调用工具、生成回答
 │                               │     产生 MemoryProposal
 │                               │
 │◄─── TaskResult ───────────────│
 │     (output, summary,         │
 │      proposals, token_usage)  │
 │                               │
```

---

## §2 Agent 角色注册

### §2.1 AgentDefinition

沿用 v1 §2.1 的 `AgentDefinition` dataclass，v2 新增 `workflow` 字段和 Evaluator 注册项：

```python
from dataclasses import dataclass, field
from typing import Literal


@dataclass
class AgentDefinition:
    """Agent 注册定义（v2 扩展：新增 workflow 字段）"""
    id: str                          # 唯一标识: "scout", "mentor", ...
    name: str                        # 显示名称: "快速分析 Agent"
    description: str                 # 一句话描述
    tools: list[str]                 # 可用工具 ID 列表
    capabilities: list[str]          # 能力声明 (如 ["tools", "streaming", "vision"])
    workflow: Literal["react", "plan_execute", "adaptive", "reflexion", "dual_mode"]
    model_override: str | None = None  # 模型覆盖 (None = 使用用户配置)
    temperature: float = 0.7         # 生成温度
    max_tokens: int = 4096           # 最大输出 token
    streaming: bool = True           # 是否启用流式输出
    auto_trigger: bool = False       # 是否自动触发（如 Scout 导入时）
    priority: int = 50               # 多 Agent 竞争时的优先级 (0-100)
    agent_md_path: str = ""          # AGENT.md 文件路径
    soul_md_path: str = ""           # SOUL.md 文件路径
    system_prompt_template: str = "" # Jinja2 模板路径
    config: dict = field(default_factory=dict)  # config.yaml 内容
```

### §2.2 七个 Agent 注册信息

| 字段 | **Hub** | **Scout** | **Mentor** | **Navigator** | **Curator** | **Scribe** | **Evaluator** |
|------|---------|-----------|------------|---------------|-------------|------------|---------------|
| id | `hub` | `scout` | `mentor` | `navigator` | `curator` | `scribe` | `evaluator` |
| name | 首席调度 Agent | 快速分析 Agent | 深度讲解 Agent | 学习规划 Agent | 分类整理 Agent | 笔记助手 Agent | 质量评估 Agent |
| description | Chief Agent, Plan-and-Execute 核心 | 30 秒快速分析项目 | 根据用户水平自适应教学 | 规划个性化学习路线 | 智能分类和知识整理 | 辅助笔记生成和整理 | Agent 系统质量守门人 |
| workflow | `plan_execute` | `react` | `adaptive` | `react` | `reflexion` | `dual_mode` | `react` |
| tools (数量) | 3 | 6 | 10 | 7 | 6 | 7 | 5 |
| capabilities | `["tools","streaming"]` | `["tools","streaming"]` | `["tools","streaming","vision"]` | `["tools","streaming"]` | `["tools","streaming"]` | `["tools","streaming"]` | `["tools","streaming"]` |
| auto_trigger | False | True | False | False | True | False | False |
| priority | 100 | 10 | 20 | 15 | 5 | 5 | 90 |
| temperature | 0.3 | 0.5 | 0.7 | 0.5 | 0.4 | 0.6 | 0.2 |
| max_tokens | 8192 | 4096 | 8192 | 4096 | 4096 | 4096 | 4096 |
| model_override | None | None | None | None | None | None | None |

> **⚠️ Evaluator 标注:** Evaluator Agent 在 v2.0 完成注册和接口定义，但**不参与运行时调度**。v2.1+ 激活后由 Hub 在任务完成后自动触发。

### §2.3 AgentRegistry

沿用 v1 §2.1 的 `AgentRegistry`，v2 新增 workflow 引擎选择逻辑：

```python
class AgentRegistry:
    """Agent 注册表 — 管理所有可用 Agent（v2 扩展）"""

    def __init__(self, agents_dir: "Path"):
        self._agents: dict[str, AgentDefinition] = {}
        self._load_agents(agents_dir)

    def get(self, agent_id: str) -> AgentDefinition:
        """获取 Agent 定义，不存在则抛出 AgentNotFoundError"""
        agent = self._agents.get(agent_id)
        if not agent:
            raise AppException("AGENT_NOT_FOUND", f"Agent {agent_id} 不存在")
        return agent

    def list_all(self) -> list[AgentDefinition]:
        return list(self._agents.values())

    def get_workflow_engine(self, agent_id: str) -> str:
        """根据 Agent 定义返回所需的推理引擎类型

        Returns:
            "react" | "tot" | "got" | "reflexion" | "plan_execute" | "dual_mode"
        """
        agent = self.get(agent_id)
        return agent.workflow

    def get_system_prompt(self, agent_id: str, context: dict) -> str:
        """渲染 Agent 的 System Prompt（注入上下文变量）"""
        # TODO: 加载 agent_md + soul_md → 渲染 Jinja2 模板
        ...
```

---

## §3 Hub Plan-and-Execute Engine

### §3.1 HubService 完整伪代码

v2 的 HubService 从 v1 的路由器升级为 Plan-and-Execute 引擎。核心流水线为 6 阶段：

```python
from typing import AsyncGenerator
import asyncio
import logging

logger = logging.getLogger(__name__)


class HubService:
    """v2 Hub Chief Agent — Plan-and-Execute 核心引擎

    流水线: Intent → Plan → Dispatch → Collect → Evaluate → Merge → Response
    """

    def __init__(
        self,
        registry: "AgentRegistry",
        intent_detector: "IntentDetector",
        planner: "TaskPlanner",
        dispatcher: "AgentDispatcher",
        evaluator: "ResultEvaluator",
        memory_merger: "MemoryMergeService",
        context_engine: "ContextEngine",
    ):
        self.registry = registry
        self.intent_detector = intent_detector
        self.planner = planner
        self.dispatcher = dispatcher
        self.evaluator = evaluator
        self.memory_merger = memory_merger
        self.context_engine = context_engine

    async def receive_message(
        self, user_id: str, session_id: str, message: str,
        context: dict | None = None,
    ) -> AsyncGenerator["StreamEvent", None]:
        """处理用户消息 — Plan-and-Execute 完整流水线"""

        session = await self._get_or_create_session(session_id, user_id)

        # 检查是否有 pending question（沿用 v1 F5-45：状态排斥）
        if session.status == "pending_question":
            raise AppException("QUESTION_PENDING", "请先回答当前反问")

        # ─── Step 1: Intent Detection ───
        intent = await self.intent_detector.classify(message, context)
        yield StreamEvent(type=StreamEventType.THINKING, data={
            "stage": "intent_detection",
            "result": {"agent_id": intent.agent_id, "confidence": intent.confidence,
                       "is_multi": intent.is_multi}
        })

        # ─── Step 2: Task Planning ───
        plan = await self.planner.create_plan(message, intent, context)
        yield StreamEvent(type=StreamEventType.PLAN_UPDATE, data={
            "plan_id": plan.plan_id,
            "steps": [{"step_id": s.step_id, "agent_id": s.agent_id,
                       "instruction": s.instruction[:80], "depends_on": s.depends_on}
                      for s in plan.steps],
            "status": "planned"
        })

        # ─── Step 3: Dispatch ───
        results: list[TaskResult] = []
        async for event in self.dispatcher.execute_plan(plan, context):
            if isinstance(event, StreamEvent):
                yield event  # 透传子 Agent 的流式事件
            elif isinstance(event, TaskResult):
                results.append(event)

        # ─── Step 4: Collect & Evaluate ───
        merged = self.evaluator.evaluate_and_merge(results, plan)
        yield StreamEvent(type=StreamEventType.TEXT_DELTA, data={
            "content": merged.response
        })

        # ─── Step 5: Memory Merge ───
        all_proposals = []
        for r in results:
            all_proposals.extend(r.memory_proposals)
        if all_proposals:
            merge_results = await self.memory_merger.process_proposals(session_id)
            for mr in merge_results:
                yield StreamEvent(type=StreamEventType.MEMORY_PROPOSAL, data={
                    "proposal_id": mr.proposal_id,
                    "status": mr.status,
                    "key": mr.key,
                })

        # ─── Step 6: Response ───
        yield StreamEvent(type=StreamEventType.DONE, data={
            "plan_id": plan.plan_id,
            "agents_used": [r.agent_id for r in results],
            "total_tokens": sum(r.token_usage.get("total", 0) for r in results),
            "memory_proposals_processed": len(all_proposals),
        })
```

### §3.2 IntentDetector — 规则 + LLM 双策略

v2 IntentDetector 在 v1 IntentClassifier 基础上重构，增加对 Plan-and-Execute 的支持。

```python
from dataclasses import dataclass, field
from typing import Literal
import re


@dataclass
class SubIntent:
    """子意图"""
    agent_id: str
    message: str
    reason: str
    estimated_complexity: Literal["simple", "moderate", "complex"] = "simple"


@dataclass
class IntentResult:
    """意图分类结果（v2 扩展：新增 complexity 和 plan_hint）"""
    agent_id: Literal["hub", "scout", "mentor", "navigator", "curator", "scribe", "evaluator"]
    confidence: float
    is_multi: bool = False
    sub_intents: list[SubIntent] = field(default_factory=list)
    complexity: Literal["simple", "moderate", "complex"] = "simple"
    plan_hint: str = ""  # 给 TaskPlanner 的提示


class IntentDetector:
    """意图检测器 — 规则 + LLM 双策略（v2 重构）"""

    # ─── 快速规则层（零延迟）───
    FAST_RULES: list[tuple[re.Pattern, str]] = [
        (re.compile(r"分析|速览|快速看看|项目概览"), "scout"),
        (re.compile(r"讲解|解释|教|为什么|怎么理解|深入"), "mentor"),
        (re.compile(r"规划|路线|学习路径|怎么学|学习计划"), "navigator"),
        (re.compile(r"分类|整理|标签|归类|归档"), "curator"),
        (re.compile(r"笔记|总结|摘要|记录|大纲"), "scribe"),
    ]

    COMPLEXITY_KEYWORDS = {
        "complex": re.compile(r"全面|完整|系统|深度|对比.*并|分析.*然后|整体架构"),
        "moderate": re.compile(r"讲解|解释|分析|规划"),
    }

    MULTI_KEYWORDS = ["并且", "同时", "另外", "还有", "以及", "并帮我", "再帮我", "然后"]

    def __init__(self, llm: "LLMProvider"):
        self.llm = llm

    async def classify(self, message: str, context: dict | None) -> IntentResult:
        """三步意图分类（v2 扩展：新增复杂度评估）"""
        # Step 1: 快速规则匹配
        for pattern, agent_id in self.FAST_RULES:
            if pattern.search(message):
                complexity = self._estimate_complexity(message)
                return IntentResult(
                    agent_id=agent_id, confidence=0.9,
                    complexity=complexity
                )

        # Step 2: 多意图检测
        if any(kw in message for kw in self.MULTI_KEYWORDS):
            multi = await self._detect_multi_intent(message)
            if multi:
                return IntentResult(
                    agent_id="hub", confidence=0.85, is_multi=True,
                    sub_intents=multi, complexity="complex"
                )

        # Step 3: LLM 分类（兜底）
        return await self._llm_classify(message, context)

    def _estimate_complexity(self, message: str) -> str:
        for level, pattern in self.COMPLEXITY_KEYWORDS.items():
            if pattern.search(message):
                return level
        return "simple"

    async def _detect_multi_intent(self, message: str) -> list[SubIntent] | None:
        """LLM 多意图分解"""
        prompt = f"""分析以下用户消息是否包含多个独立意图。
可用 Agent: scout(快速分析), mentor(深度讲解), navigator(学习规划), curator(分类), scribe(笔记)
用户消息: {message}
返回 JSON: {{"is_multi": true/false, "sub_intents": [{{"agent_id": "...", "message": "...", "reason": "...", "estimated_complexity": "simple|moderate|complex"}}]}}
"""
        result = await self.llm.complete([
            Message(role="user", content=prompt)
        ])
        parsed = json.loads(result.text)
        if not parsed.get("is_multi"):
            return None
        return [SubIntent(**item) for item in parsed["sub_intents"]]

    async def _llm_classify(self, message: str, context) -> IntentResult:
        prompt = f"""判断以下用户消息应该由哪个 Agent 处理，以及任务复杂度。
可用 Agent: scout(快速分析), mentor(深度讲解), navigator(学习规划),
curator(分类), scribe(笔记), hub(通用对话)
用户消息: {message}
返回 JSON: {{"agent_id": "...", "confidence": 0.0-1.0, "complexity": "simple|moderate|complex", "plan_hint": "..."}}
"""
        result = await self.llm.complete([
            Message(role="user", content=prompt)
        ])
        parsed = json.loads(result.text)
        return IntentResult(
            agent_id=parsed.get("agent_id", "hub"),
            confidence=parsed.get("confidence", 0.5),
            complexity=parsed.get("complexity", "simple"),
            plan_hint=parsed.get("plan_hint", ""),
        )
```

### §3.3 TaskPlanner — SubTask 分解

```python
from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal
from uuid import uuid4


@dataclass
class TaskStep:
    """任务步骤"""
    step_id: str                     # 步骤 ID
    agent_id: str                    # 执行 Agent
    instruction: str                 # 指令描述
    depends_on: list[str] = field(default_factory=list)  # 依赖的步骤 ID
    status: Literal["pending", "running", "completed", "failed"] = "pending"
    result: "TaskResult | None" = None


@dataclass
class TaskPlan:
    """任务计划 — Hub Plan-and-Execute 核心数据结构"""
    plan_id: str = field(default_factory=lambda: str(uuid4()))
    user_query: str = ""
    intent: "IntentResult | None" = None
    steps: list[TaskStep] = field(default_factory=list)
    current_step: int = 0
    created_at: datetime = field(default_factory=datetime.utcnow)

    @property
    def is_complete(self) -> bool:
        return all(s.status in ("completed", "failed") for s in self.steps)

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


class TaskPlanner:
    """任务规划器 — 将用户请求分解为可执行的 SubTask 序列

    策略:
    - simple: 单步骤，直接派发
    - moderate: 1-2 步骤，可能包含上下文依赖
    - complex: 多步骤，可能包含并行/串行混合调度
    """

    def __init__(self, registry: "AgentRegistry", llm: "LLMProvider"):
        self.registry = registry
        self.llm = llm

    async def create_plan(
        self, message: str, intent: "IntentResult", context: dict | None
    ) -> TaskPlan:
        """根据意图复杂度创建任务计划"""
        plan = TaskPlan(user_query=message, intent=intent)

        if intent.is_multi:
            # 多意图：为每个子意图创建步骤
            plan.steps = self._plan_multi_intent(intent)
        elif intent.complexity == "simple":
            # 简单任务：单步骤
            plan.steps = [TaskStep(
                step_id="s1",
                agent_id=intent.agent_id,
                instruction=message,
            )]
        elif intent.complexity == "moderate":
            # 中等任务：可能包含隐式前置步骤
            plan.steps = await self._plan_moderate(message, intent, context)
        else:
            # 复杂任务：LLM 辅助分解
            plan.steps = await self._plan_complex(message, intent, context)

        return plan

    def _plan_multi_intent(self, intent: "IntentResult") -> list[TaskStep]:
        """多意图规划 — 确定依赖关系和执行顺序"""
        steps = []
        prev_id = None
        for i, sub in enumerate(intent.sub_intents):
            step_id = f"s{i+1}"
            depends = [prev_id] if prev_id and self._has_dependency(sub, intent.sub_intents[i-1]) else []
            steps.append(TaskStep(
                step_id=step_id,
                agent_id=sub.agent_id,
                instruction=sub.message,
                depends_on=depends,
            ))
            prev_id = step_id
        return steps

    def _has_dependency(self, current: SubIntent, previous: SubIntent) -> bool:
        """判断两个子意图间是否存在数据依赖"""
        # Scout 的输出通常是其他 Agent 的前置输入
        DEPENDENCY_RULES = {
            ("scout", "mentor"): True,
            ("scout", "navigator"): True,
            ("scout", "curator"): True,
            ("mentor", "scribe"): True,
        }
        return DEPENDENCY_RULES.get((previous.agent_id, current.agent_id), False)

    async def _plan_moderate(self, message, intent, context) -> list[TaskStep]:
        """中等复杂度规划"""
        # 默认：单步骤 + 可选的后处理步骤
        steps = [TaskStep(
            step_id="s1", agent_id=intent.agent_id, instruction=message,
        )]
        # Mentor 复杂讲解后追加 Scribe 笔记步骤
        if intent.agent_id == "mentor" and intent.plan_hint and "note" in intent.plan_hint:
            steps.append(TaskStep(
                step_id="s2", agent_id="scribe",
                instruction="基于 Mentor 讲解生成笔记大纲",
                depends_on=["s1"],
            ))
        return steps

    async def _plan_complex(self, message, intent, context) -> list[TaskStep]:
        """复杂任务 LLM 辅助分解"""
        prompt = f"""将以下复杂任务分解为子任务步骤。
可用 Agent: scout(快速分析), mentor(深度讲解), navigator(学习规划), curator(分类), scribe(笔记)
用户请求: {message}
意图提示: {intent.plan_hint}
返回 JSON: {{"steps": [{{"agent_id": "...", "instruction": "...", "depends_on": []}}]}}
"""
        result = await self.llm.complete([Message(role="user", content=prompt)])
        parsed = json.loads(result.text)
        return [
            TaskStep(step_id=f"s{i+1}", **step)
            for i, step in enumerate(parsed.get("steps", []))
        ]
```

### §3.4 AgentDispatcher — 并行/串行调度

```python
import asyncio
from typing import AsyncGenerator


class AgentDispatcher:
    """Agent 调度器 — 支持并行和串行混合调度

    调度策略:
    - 无依赖的步骤并行执行 (asyncio.gather)
    - 有依赖的步骤等待前置完成后执行
    - 每个步骤独立超时控制
    """

    def __init__(self, registry: "AgentRegistry", context_engine: "ContextEngine",
                 engine_factory: "EngineFactory"):
        self.registry = registry
        self.context_engine = context_engine
        self.engine_factory = engine_factory

    async def execute_plan(
        self, plan: "TaskPlan", context: dict | None
    ) -> AsyncGenerator["StreamEvent | TaskResult", None]:
        """执行任务计划 — 支持并行/串行混合调度"""

        while not plan.is_complete:
            next_steps = plan.get_next_steps()
            if not next_steps:
                break  # 所有步骤要么完成要么失败

            if len(next_steps) == 1:
                # 单步骤：直接执行
                step = next_steps[0]
                step.status = "running"
                yield StreamEvent(type=StreamEventType.PLAN_UPDATE, data={
                    "step_id": step.step_id, "status": "running"
                })

                result = await self._execute_step(step, context)
                step.status = "completed" if result.status == "success" else "failed"
                step.result = result
                yield result

            else:
                # 多步骤并行：asyncio.gather
                for step in next_steps:
                    step.status = "running"

                yield StreamEvent(type=StreamEventType.PLAN_UPDATE, data={
                    "parallel_steps": [s.step_id for s in next_steps],
                    "status": "running"
                })

                tasks = [self._execute_step(step, context) for step in next_steps]
                results = await asyncio.gather(*tasks, return_exceptions=True)

                for step, result in zip(next_steps, results):
                    if isinstance(result, Exception):
                        step.status = "failed"
                        step.result = TaskResult(
                            task_id=step.step_id, agent_id=step.agent_id,
                            status="failed", error=str(result)
                        )
                    else:
                        step.status = "completed" if result.status == "success" else "failed"
                        step.result = result
                    yield step.result

    async def _execute_step(self, step: "TaskStep", context: dict | None) -> "TaskResult":
        """执行单个步骤"""
        agent_def = self.registry.get(step.agent_id)

        # 为该步骤构建最小上下文
        agent_context = await self.context_engine.build_context(
            query=step.instruction,
            agent_id=step.agent_id,
            session=context,
        )

        sub_task = SubTask(
            task_id=step.step_id,
            agent_id=step.agent_id,
            instruction=step.instruction,
            context=agent_context,
            depends_on=step.depends_on,
        )

        # 根据 Agent workflow 选择推理引擎
        engine = self.engine_factory.get_engine(agent_def.workflow)

        try:
            result = await asyncio.wait_for(
                engine.execute(sub_task),
                timeout=sub_task.timeout_s,
            )
            return result
        except asyncio.TimeoutError:
            return TaskResult(
                task_id=step.step_id, agent_id=step.agent_id,
                status="timeout", error=f"执行超时 ({sub_task.timeout_s}s)"
            )
        except Exception as e:
            return TaskResult(
                task_id=step.step_id, agent_id=step.agent_id,
                status="failed", error=str(e)
            )
```

### §3.5 ResultCollector + Evaluator

```python
from dataclasses import dataclass, field


@dataclass
class MergedResponse:
    """合并后的响应"""
    response: str                           # 合并后的文本
    agent_outputs: list[dict] = field(default_factory=list)  # 各 Agent 原始输出
    memory_proposals_count: int = 0
    total_tokens: int = 0
    quality_score: float | None = None      # v2.1+ Evaluator 评分


class ResultEvaluator:
    """结果收集与评估器

    v2.0: 基础质量检查（完整性、格式、一致性）
    v2.1+: 由 Evaluator Agent 替代，执行多维度自动评分
    """

    def evaluate_and_merge(
        self, results: list["TaskResult"], plan: "TaskPlan"
    ) -> MergedResponse:
        """收集所有结果，基础质量检查，合并为统一响应"""
        outputs = []
        all_text = []
        total_tokens = 0
        proposals_count = 0

        for r in results:
            # 基础质量检查
            if r.status == "failed":
                all_text.append(f"[{r.agent_id} 执行失败: {r.error}]")
            elif r.status == "timeout":
                all_text.append(f"[{r.agent_id} 执行超时]")
            else:
                all_text.append(r.output_summary or str(r.output))

            outputs.append({
                "agent_id": r.agent_id,
                "status": r.status,
                "summary": r.output_summary,
            })
            total_tokens += r.token_usage.get("total", 0)
            proposals_count += len(r.memory_proposals)

        merged_text = "\n\n".join(all_text) if len(all_text) > 1 else (all_text[0] if all_text else "")

        return MergedResponse(
            response=merged_text,
            agent_outputs=outputs,
            memory_proposals_count=proposals_count,
            total_tokens=total_tokens,
        )
```

---

## §4 LLM Provider 层

### §4.1 沿用 v1 基础

> 以下组件沿用 v1 §3 定义，实现不变：
> - `LLMProvider` 类 — LiteLLM 封装层
> - `LLMConfig(BaseModel)` — Pydantic 配置模型 + `@field_validator` SSRF 防护
> - `PRESET_CONFIGS` — 四套预设配置（OpenAI / Anthropic / DeepSeek / Custom）
> - `CapabilityDetector` — 能力检测器（has_llm / supports_tools / supports_streaming / supports_vision）
> - `SecureKeyStore` — Fernet 加密密钥管理
> - BYOK 降级检测流程

### §4.2 v2 新增: MultiModelRouter

v2 新增多模型路由器，根据 Agent 和任务复杂度路由到不同层级的模型。

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
        self.providers = providers
        self.routes = routes
        self._route_map = self._build_route_map()

    def _build_route_map(self) -> dict[tuple[str, str], ModelRoute]:
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
            return self.providers["standard"]

        tier_key = route.preferred_tier.value
        provider = self.providers.get(tier_key)
        if provider is None:
            fallback_key = route.fallback_tier.value
            provider = self.providers.get(fallback_key)
        return provider or self.providers["standard"]

    async def complete(self, agent_id: str, task_type: str,
                       messages: list, **kwargs):
        """路由并调用对应模型"""
        provider = self.get_provider(agent_id, task_type)
        return await provider.complete(messages, **kwargs)
```

**默认路由配置：**

| Agent | 任务类型 | 模型层级 | 说明 |
|-------|---------|---------|------|
| hub | intent_detection | FAST | 意图分类用快速模型 |
| hub | task_planning | STANDARD | 任务规划用标准模型 |
| scout | default | FAST | 快速分析 |
| mentor | simple_qa | STANDARD | 简单问答 |
| mentor | complex_concept | REASONING | ToT 深度讲解 |
| mentor | multi_strategy | REASONING | GoT 多策略对比 |
| navigator | default | STANDARD | 学习路径规划 |
| curator | default | FAST | 分类反思 |
| scribe | default | STANDARD | 笔记生成 |
| evaluator | default | REASONING | 质量评估（v2.1+） |

---

## §5 工具系统（19 个工具）

### §5.1 工具基础设施

沿用 v1 §4 的 `@tool` 装饰器、`ToolRegistry`、`ToolDefinition` 基础设施。定义方式不变：

```python
def tool(name: str, description: str, parameters: dict,
         allowed_agents: list[str], timeout_ms: int = 30000):
    """@tool 装饰器 — 注册工具到 ToolRegistry（沿用 v1）"""
    def decorator(func):
        ToolRegistry.register(ToolDefinition(
            name=name, description=description, parameters=parameters,
            handler=func, allowed_agents=allowed_agents, timeout_ms=timeout_ms,
        ))
        return func
    return decorator
```

### §5.2 工具总览（19 个）

| # | 工具名 | 来源 | allowed_agents | 说明 |
|---|--------|------|----------------|------|
| 1 | `query_user_projects` | v1 保留 | scout, mentor, navigator, curator, scribe, hub | 查询用户项目库 |
| 2 | `read_readme` | v1 保留 | scout, mentor | 读取项目 README |
| 3 | `read_source_file` | v1 保留 | mentor | 读取源码文件（分页） |
| 4 | `search_web` | v1 保留 | scout, mentor, navigator, curator, scribe | 搜索互联网 |
| 5 | `get_project_analysis` | v1 保留 | mentor | 获取缓存分析结果 |
| 6 | `compare_projects` | v1 保留 | mentor | 多项目对比 |
| 7 | `update_user_profile` | v1 保留 | mentor, navigator | 更新用户画像 |
| 8 | `ask_user_question` | v1 保留 | mentor, navigator, hub, curator, scribe | 交互式反问 |
| 9 | `save_to_memory` | v1 保留 | scout, mentor, navigator, curator, scribe | 存储到记忆系统 |
| 10 | `recall_from_memory` | v1 保留 | scout, mentor, navigator, curator, scribe, hub | 从记忆系统检索 |
| 11 | `suggest_classification` | v1 保留 | curator | 建议项目分类 |
| 12 | `generate_note_outline` | v1 保留 | scribe | 生成笔记大纲 |
| 13 | `build_learning_path` | v1 保留 | navigator | 构建学习路径 |
| 14 | `get_user_profile` | v1 保留 | mentor, navigator | 读取用户画像 |
| **15** | **`query_knowledge_graph`** | **v2 新增** | **全部 7 个 Agent** | **查询项目知识图谱** |
| **16** | **`propose_memory_update`** | **v2 新增** | **scout, mentor, navigator, curator, scribe** | **提交 Memory 更新提案** |
| **17** | **`evaluate_response`** | **v2 预留** | **evaluator** | **评估 Agent 输出质量（v2.1+）** |
| 18 | `github_api` | v1 保留 | scout | GitHub metadata |
| 19 | `tfidf_analysis` | v1 保留 | scout, curator | TF-IDF 关键词提取 |

### §5.3 v2 新增工具完整定义

#### 15. query_knowledge_graph

```python
@tool(name="query_knowledge_graph",
      description="查询项目知识图谱，支持多种边类型和查询模式",
      parameters={
          "type": "object",
          "properties": {
              "query_type": {
                  "type": "string",
                  "enum": ["similar_projects", "dependencies", "tech_stack",
                           "learning_path", "custom"],
                  "description": "查询模式: similar_projects(相似项目), dependencies(依赖关系), tech_stack(技术栈关联), learning_path(学习路径), custom(自定义)"
              },
              "project_id": {
                  "type": "string",
                  "description": "中心项目 ID"
              },
              "max_depth": {
                  "type": "integer",
                  "default": 2,
                  "description": "查询深度（从中心项目出发的跳数）"
              },
              "edge_types": {
                  "type": "array",
                  "items": {
                      "type": "string",
                      "enum": ["tfidf", "embedding", "dependency", "topic", "manual"]
                  },
                  "default": ["tfidf", "embedding", "dependency"],
                  "description": "筛选的边类型"
              },
              "limit": {
                  "type": "integer",
                  "default": 10,
                  "description": "返回结果数量上限"
              }
          },
          "required": ["query_type", "project_id"]
      },
      allowed_agents=["scout", "mentor", "navigator", "curator", "scribe", "hub", "evaluator"],
      timeout_ms=5000)
async def query_knowledge_graph(
    query_type: str,
    project_id: str,
    max_depth: int = 2,
    edge_types: list[str] | None = None,
    limit: int = 10,
    context=None, **kwargs
):
    """查询项目知识图谱

    支持的查询模式:
    - similar_projects: 查找相似项目（基于 TF-IDF / Embedding 边）
    - dependencies: 查找依赖关系（基于 dependency 边）
    - tech_stack: 查找技术栈关联（基于 topic 边）
    - learning_path: 查找学习路径建议（综合所有边类型）
    - custom: 自定义查询（传入 edge_types + max_depth）
    """
    if edge_types is None:
        edge_types = ["tfidf", "embedding", "dependency"]

    graph_service = context.graph_service
    results = await graph_service.query(
        user_id=context.user_id,
        project_id=project_id,
        query_type=query_type,
        max_depth=max_depth,
        edge_types=edge_types,
        limit=limit,
    )
    return {
        "nodes": results.nodes,
        "edges": results.edges,
        "query_type": query_type,
        "project_id": project_id,
        "total_nodes": len(results.nodes),
        "total_edges": len(results.edges),
    }
```

#### 16. propose_memory_update

```python
@tool(name="propose_memory_update",
      description="提交 Memory 更新提案，由 Hub 进行 Evidence Weighted Merge",
      parameters={
          "type": "object",
          "properties": {
              "target_layer": {
                  "type": "string",
                  "enum": ["preference", "knowledge_state", "long_memory"],
                  "description": "目标记忆层"
              },
              "key": {
                  "type": "string",
                  "description": "Memory 键名，如 'python_proficiency'"
              },
              "value": {
                  "description": "提议的新值（类型根据 key 和 target_layer 而定）"
              },
              "confidence": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 1,
                  "description": "Agent 对此提案的置信度 (0-1)"
              },
              "evidence": {
                  "type": "array",
                  "items": {"type": "string"},
                  "description": "支持此提案的证据列表"
              }
          },
          "required": ["target_layer", "key", "value", "confidence", "evidence"]
      },
      allowed_agents=["scout", "mentor", "navigator", "curator", "scribe"],
      timeout_ms=3000)
async def propose_memory_update(
    target_layer: str,
    key: str,
    value,
    confidence: float,
    evidence: list[str],
    context=None, **kwargs
):
    """提交 Memory 更新提案

    Agent 不能直接修改 Layer 1-4 的 Memory，只能通过此工具提交 Proposal。
    Hub 在任务完成后统一处理所有 Proposal，执行 Evidence Weighted Merge。

    使用场景:
    - Mentor: 根据教学交互更新 Knowledge State
    - Scout: 根据项目分析更新 Long Memory
    - Navigator: 根据学习进度更新 Knowledge State
    - Curator: 根据分类结果更新 Long Memory
    - Scribe: 根据笔记活动更新 Long Memory
    """
    from datetime import datetime

    proposal = MemoryProposal(
        agent_id=context.agent_id,
        target_layer=target_layer,
        key=key,
        value=value,
        confidence=confidence,
        evidence=evidence,
        session_id=context.session_id,
        timestamp=datetime.now(),
    )

    # 校验提案合法性
    if not proposal.validate():
        return {"status": "rejected", "reason": "validation_failed"}

    await context.memory_service.submit_proposal(proposal)
    return {
        "status": "proposal_submitted",
        "proposal_id": proposal.id,
        "target_layer": target_layer,
        "key": key,
    }
```

#### 17. evaluate_response（v2.1+ 预留）

```python
@tool(name="evaluate_response",
      description="[v2.1+ 预留] 评估 Agent 输出质量，多维度自动评分",
      parameters={
          "type": "object",
          "properties": {
              "agent_id": {
                  "type": "string",
                  "description": "被评估的 Agent ID"
              },
              "response_text": {
                  "type": "string",
                  "description": "Agent 的输出文本"
              },
              "original_query": {
                  "type": "string",
                  "description": "用户原始查询"
              },
              "evaluation_dimensions": {
                  "type": "array",
                  "items": {
                      "type": "string",
                      "enum": ["accuracy", "completeness", "grounding",
                               "relevance", "consistency"]
                  },
                  "default": ["accuracy", "completeness", "grounding"]
              }
          },
          "required": ["agent_id", "response_text", "original_query"]
      },
      allowed_agents=["evaluator"],
      timeout_ms=10000)
async def evaluate_response(
    agent_id: str,
    response_text: str,
    original_query: str,
    evaluation_dimensions: list[str] | None = None,
    context=None, **kwargs
):
    """评估 Agent 输出质量（v2.1+ 实现）

    评估维度:
    - accuracy: 事实正确性
    - completeness: 覆盖完整性
    - grounding: 事实依据（非幻觉）
    - relevance: 与查询的相关度
    - consistency: 与历史/Memory 的一致性

    评分阈值:
    - >= 0.8: PASS
    - 0.6-0.8: WARN（附改进建议）
    - < 0.6: FAIL（触发 Hub 重新规划）
    """
    # TODO: v2.1+ 实现
    return {
        "status": "not_implemented",
        "message": "Evaluator Agent 将在 v2.1+ 激活",
        "agent_id": agent_id,
    }
```

### §5.4 v1 保留工具简述

> 以下 14 个工具的完整 `@tool` 定义（含参数 schema、handler 伪代码、异常处理）以 v1 AGENT_SPEC §4.3 为权威来源。此处仅列出关键参数和变更说明。

#### 1. query_user_projects (v1 §4.3.1)

- **allowed_agents:** `["scout","mentor","navigator","curator","scribe","hub"]`
- **关键参数:** `query`, `category`, `language`, `tag`, `progress`, `limit`
- **v2 变更:** 无

#### 2. read_readme (v1 §4.3.2)

- **allowed_agents:** `["scout","mentor"]`
- **关键参数:** `project_id`
- **v2 变更:** 无

#### 3. read_source_file (v1 §4.3.3)

- **allowed_agents:** `["mentor"]`
- **关键参数:** `repo`, `path`, `ref`, `start_line`, `end_line`
- **v2 变更:** 无。沿用 T-02 分页修复 + F5-17 路径遍历校验

#### 4. search_web (v1 §4.3.4)

- **allowed_agents:** `["scout","mentor","navigator","curator","scribe"]`
- **关键参数:** `query`, `max_results`
- **v2 变更:** 无。沿用 C-01/S-04 SSRF 防护

#### 5. get_project_analysis (v1 §4.3.5)

- **allowed_agents:** `["mentor"]`
- **关键参数:** `project_id`, `analysis_type`
- **v2 变更:** 无

#### 6. compare_projects (v1 §4.3.6)

- **allowed_agents:** `["mentor"]`
- **关键参数:** `project_ids`, `dimensions`
- **v2 变更:** 无

#### 7. update_user_profile (v1 §4.3.7)

- **allowed_agents:** `["mentor","navigator"]`
- **关键参数:** `tech_proficiency`, `learning_preferences`, `goals`, `extensions`
- **v2 变更:** v2 建议通过 `propose_memory_update` 替代直接修改，但保留此工具向后兼容

#### 8. ask_user_question (v1 §4.3.8)

- **allowed_agents:** `["mentor","navigator","hub","curator","scribe"]`
- **关键参数:** `intro`, `questions`, `allow_skip`, `skip_text`
- **v2 变更:** 新增 Plan Progress 集成（见 §8.2）

#### 9. save_to_memory (v1 §4.3.9)

- **allowed_agents:** `["scout","mentor","navigator","curator","scribe"]`
- **关键参数:** `content`, `category`, `project_id`, `tags`
- **v2 变更:** v2 建议通过 `propose_memory_update` 替代直接写入，但保留此工具向后兼容

#### 10. recall_from_memory (v1 §4.3.10)

- **allowed_agents:** `["scout","mentor","navigator","curator","scribe","hub"]`
- **关键参数:** `query`, `category`, `project_id`, `limit`
- **v2 变更:** 新增对 5 层 Memory 架构的查询支持

#### 11. suggest_classification (v1 §4.3.11)

- **allowed_agents:** `["curator"]`
- **关键参数:** `project_id`
- **v2 变更:** 无

#### 12. generate_note_outline (v1 §4.3.12)

- **allowed_agents:** `["scribe"]`
- **关键参数:** `project_id`, `depth`, `language`
- **v2 变更:** 无

#### 13. build_learning_path (v1 §4.3.13)

- **allowed_agents:** `["navigator"]`
- **关键参数:** `goal`, `timeframe`, `include_project_ids`
- **v2 变更:** 新增 Knowledge Graph 集成（Navigator 可同时调用 `query_knowledge_graph`）

#### 14. get_user_profile (v1 §4.3.14)

- **allowed_agents:** `["mentor","navigator"]`
- **关键参数:** `sections`
- **v2 变更:** 新增 `knowledge_state` section 读取

#### 15-16. github_api + tfidf_analysis

- **github_api:** `allowed_agents=["scout"]` — GitHub metadata 获取
- **tfidf_analysis:** `allowed_agents=["scout","curator"]` — TF-IDF 关键词提取
- **v2 变更:** 无。完整定义见 v1 AGENT_SPEC

---

## §6 Memory System

### §6.1 五层 Memory 架构

v2 Memory 系统从 v1 的静态分层升级为**五层 + Proposal-based Merge Protocol**架构。

```python
from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal, Any


# ─── Layer 1: User Profile ───
@dataclass
class UserProfileMemory:
    """用户画像层 — 长期稳定，变更频率极低（月级别）"""
    user_id: str
    profession: str = ""                    # 职业
    language: str = "zh-CN"                 # 首选语言
    learning_goals: list[str] = field(default_factory=list)  # 学习目标
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)


# ─── Layer 2: Preference ───
@dataclass
class PreferenceMemory:
    """偏好层 — 中期稳定，变更频率低（周级别）"""
    user_id: str
    style: Literal["hands_on", "theoretical", "visual"] = "hands_on"
    depth_first: bool = True
    code_examples: bool = True
    comparisons: bool = True
    verbosity: str = "balanced"
    code_comment_language: str = "zh-CN"
    updated_at: datetime = field(default_factory=datetime.utcnow)


# ─── Layer 3: Knowledge State ───
@dataclass
class KnowledgeStateEntry:
    """知识状态条目 — 动态变化，每次学习后更新"""
    user_id: str
    domain: str                             # 如 "python", "fastapi", "react"
    proficiency: int                        # 掌握度 0-100
    evidence_count: int = 0                 # 评估证据次数
    last_assessed_at: datetime = field(default_factory=datetime.utcnow)
    source_agent: str = "mentor"            # 维护该记录的 Agent


# ─── Layer 4: Long Memory ───
@dataclass
class LongMemoryEntry:
    """长期记忆条目 — 持续累积"""
    id: str
    user_id: str
    agent_id: str                           # 产生该记录的 Agent
    content: str                            # 记忆内容
    category: Literal["insight", "fact", "preference", "goal", "note"] = "fact"
    project_id: str | None = None
    tags: list[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.utcnow)


# ─── Layer 5: Short Memory ───
@dataclass
class ShortMemoryEntry:
    """短期记忆 — Agent 私有，无需 Proposal"""
    agent_id: str
    session_id: str
    data: dict = field(default_factory=dict)
    """
    Agent 私有短期记忆格式:
    - Mentor: {"recent_teaching": [...], "current_topic": "..."}
    - Scout: {"recent_repos": [...], "last_analysis": {...}}
    - Curator: {"candidates": [...], "reflexion_rounds": 0}
    - Navigator: {"draft_path": {...}, "current_goal": "..."}
    - Scribe: {"note_versions": [...], "editing_session": "..."}
    """
    updated_at: datetime = field(default_factory=datetime.utcnow)
```

### §6.2 Memory Proposal & Commit

```python
@dataclass
class MemoryProposal:
    """记忆提案 — Agent 向 Hub 提交的记忆修改请求"""
    id: str = field(default_factory=lambda: str(uuid4()))
    agent_id: str                                                    # 提交 Agent
    target_layer: Literal["preference", "knowledge_state", "long_memory"]
    key: str                                                         # 记忆键
    value: Any                                                       # 记忆值
    confidence: float                                                # 置信度 0.0-1.0
    evidence: list[str] = field(default_factory=list)                # 证据列表
    session_id: str | None = None
    timestamp: datetime = field(default_factory=datetime.utcnow)

    def validate(self) -> bool:
        """校验提案合法性"""
        if not 0.0 <= self.confidence <= 1.0:
            return False
        if not self.key or len(self.key) > 256:
            return False
        if self.target_layer == "knowledge_state" and not isinstance(self.value, (int, float)):
            return False  # knowledge_state 的 value 必须是数值
        return True


@dataclass
class MemoryCommit:
    """记忆提交 — Hub 合并后的最终记录"""
    id: str = field(default_factory=lambda: str(uuid4()))
    proposal_id: str                  # 对应提案 ID
    merged_by: str = "hub"            # 合并执行者
    merge_strategy: Literal["evidence_weighted", "latest_wins", "manual"] = "evidence_weighted"
    score: float                      # 综合评分
    previous_value: Any = None        # 合并前旧值
    committed_value: Any = None       # 合并后最终值
    committed_at: datetime = field(default_factory=datetime.utcnow)
```

### §6.3 MemoryMergeService

```python
import math


class MemoryMergeService:
    """Memory 合并服务 — Evidence Weighted Merge

    核心原则:
    - Agent 不能直接修改 Layer 1-4 的 Memory
    - 所有修改通过 Proposal 提交
    - Hub 根据 Evidence Weighted 算法决定合并

    评分公式:
        score = recent_weight × confidence × evidence_score
    其中:
        recent_weight = exp(-λ × Δt)  (指数衰减, λ=0.01, Δt=分钟)
        evidence_score = min(1.0, len(evidence) / 3.0)  (归一化, 3条证据饱和)
    """

    DECAY_LAMBDA = 0.01  # 指数衰减系数
    EVIDENCE_SATURATION = 3.0  # 证据数量饱和阈值
    CONFLICT_THRESHOLD = 0.1  # 冲突判定阈值
    MIN_CONFIDENCE = 0.5  # 最低置信度阈值

    def __init__(self, db: "DatabaseService"):
        self.db = db

    async def process_proposals(self, session_id: str) -> list[dict]:
        """处理一个会话中所有待处理的 Proposal"""
        proposals = await self.db.get_pending_proposals(session_id)
        results = []

        for proposal in proposals:
            result = await self._process_single_proposal(proposal)
            results.append(result)

        return results

    async def _process_single_proposal(self, proposal: MemoryProposal) -> dict:
        """处理单个 Proposal"""
        score = self._calculate_score(proposal)

        # 检查是否存在同 key 的已有 Commit
        existing = await self.db.get_latest_commit(proposal.key)

        if existing and existing.score > score:
            # 已有 Commit 得分更高，拒绝此 Proposal
            await self.db.reject_proposal(proposal.id)
            return {
                "proposal_id": proposal.id,
                "key": proposal.key,
                "status": "rejected",
                "reason": "existing_commit_higher_score",
                "existing_score": existing.score,
                "new_score": score,
            }

        # 检查冲突：同一 key 的多个 Proposal 得分差距 < CONFLICT_THRESHOLD
        competing = await self.db.get_competing_proposals(proposal.key)
        if competing:
            for other in competing:
                other_score = self._calculate_score(other)
                if abs(score - other_score) < self.CONFLICT_THRESHOLD:
                    # 冲突：标记待用户确认
                    await self.db.mark_conflict(proposal.id, other.id)
                    return {
                        "proposal_id": proposal.id,
                        "key": proposal.key,
                        "status": "conflict",
                        "conflicting_proposal_id": other.id,
                    }

        # 所有 Proposal 置信度均低于阈值 → 丢弃
        if proposal.confidence < self.MIN_CONFIDENCE:
            await self.db.reject_proposal(proposal.id)
            return {
                "proposal_id": proposal.id,
                "key": proposal.key,
                "status": "rejected",
                "reason": "confidence_below_threshold",
            }

        # 通过：提交 Commit
        commit = MemoryCommit(
            proposal_id=proposal.id,
            merged_by="hub",
            merge_strategy="evidence_weighted",
            score=score,
            previous_value=existing.committed_value if existing else None,
            committed_value=proposal.value,
        )
        await self.db.commit_memory(proposal, commit)
        return {
            "proposal_id": proposal.id,
            "key": proposal.key,
            "status": "merged",
            "score": score,
        }

    def _calculate_score(self, proposal: MemoryProposal) -> float:
        """计算 Proposal 综合评分

        Formula:
            recent_weight = exp(-λ × Δt)
            evidence_score = min(1.0, len(evidence) / 3.0)
            score = recent_weight × confidence × evidence_score
        """
        delta_minutes = (datetime.utcnow() - proposal.timestamp).total_seconds() / 60.0
        recent_weight = math.exp(-self.DECAY_LAMBDA * delta_minutes)
        evidence_score = min(1.0, len(proposal.evidence) / self.EVIDENCE_SATURATION)
        return recent_weight * proposal.confidence * evidence_score
```

### §6.4 Memory CRUD 接口

```python
class MemoryService:
    """Memory 系统统一 CRUD 接口"""

    def __init__(self, db: "DatabaseService", merger: "MemoryMergeService"):
        self.db = db
        self.merger = merger

    # ─── Read 操作（直接读取，无需 Proposal）───

    async def get_user_profile(self, user_id: str) -> UserProfileMemory | None:
        return await self.db.get_user_profile(user_id)

    async def get_preference(self, user_id: str) -> PreferenceMemory | None:
        return await self.db.get_preference(user_id)

    async def get_knowledge_states(self, user_id: str) -> list[KnowledgeStateEntry]:
        return await self.db.get_knowledge_states(user_id)

    async def get_knowledge_state(self, user_id: str, domain: str) -> KnowledgeStateEntry | None:
        return await self.db.get_knowledge_state(user_id, domain)

    async def recall_long_memory(self, user_id: str, query: str,
                                  category: str | None = None,
                                  limit: int = 10) -> list[LongMemoryEntry]:
        return await self.db.recall_memories(user_id, query, category, limit)

    async def get_short_memory(self, agent_id: str, session_id: str) -> ShortMemoryEntry | None:
        return await self.db.get_short_memory(agent_id, session_id)

    # ─── Write 操作（通过 Proposal）───

    async def submit_proposal(self, proposal: MemoryProposal) -> str:
        """提交 Memory Proposal（Agent 调用）"""
        if not proposal.validate():
            raise AppException("INVALID_PROPOSAL", "Proposal 校验失败")
        return await self.db.save_proposal(proposal)

    # ─── Agent 私有 Short Memory（直接写入，无需 Proposal）───

    async def update_short_memory(self, agent_id: str, session_id: str,
                                   data: dict) -> None:
        await self.db.upsert_short_memory(agent_id, session_id, data)

    # ─── 手动覆盖（用户通过 UI 操作）───

    async def manual_override_knowledge_state(
        self, user_id: str, domain: str, proficiency: int
    ) -> MemoryCommit:
        """用户手动覆盖知识状态（latest_wins 策略）"""
        proposal = MemoryProposal(
            agent_id="user",
            target_layer="knowledge_state",
            key=domain,
            value=proficiency,
            confidence=1.0,
            evidence=["user_manual_override"],
        )
        commit = MemoryCommit(
            proposal_id=proposal.id,
            merged_by="user",
            merge_strategy="latest_wins",
            score=1.0,
            committed_value=proficiency,
        )
        await self.db.commit_memory(proposal, commit)
        return commit
```

### §6.5 Memory 读写权限矩阵

| Memory Layer | Hub | Scout | Mentor | Navigator | Curator | Scribe | Evaluator |
|-------------|-----|-------|--------|-----------|---------|--------|-----------|
| User Profile | R+W(Merge) | R | R+P | R+P | R | R | R+P |
| Preference | R+W(Merge) | R | R+P | R+P | R | R | R+P |
| Knowledge State | R+W(Merge) | R | R+P | R+P | R | R | R+P |
| Long Memory | R+W(Merge) | R+P | R+P | R+P | R+P | R+P | R+P |
| Short Memory (own) | R+W | R+W | R+W | R+W | R+W | R+W | R+W |

**R** = Read, **W** = Write via Merge Protocol, **P** = Proposal only

---

## §7 Context Engineering

### §7.1 AgentContext 数据模型

```python
from dataclasses import dataclass, field


@dataclass
class AgentContext:
    """Agent 上下文 — ContextEngine 的输出，Agent 执行时接收的完整上下文

    设计原则:
    - 每个 Agent 只获得 Relevant Context，而非 All Context
    - 总 token 控制在 token_budget 以内
    - 避免 Context Explosion
    """
    query: str                                        # 用户原始查询
    user_profile_summary: dict = field(default_factory=dict)  # 用户画像摘要
    relevant_memories: list[dict] = field(default_factory=list)  # 相关记忆条目
    task_context: dict = field(default_factory=dict)  # 任务相关上下文
    project_context: dict | None = None               # 当前项目上下文
    knowledge_graph_hints: list[dict] = field(default_factory=list)  # 图谱提示
    token_budget: int = 8000                           # Token 预算上限
    tokens_used: int = 0                               # 已用 Token 数

    @property
    def tokens_remaining(self) -> int:
        return max(0, self.token_budget - self.tokens_used)
```

### §7.2 ContextEngine Pipeline

```python
class ContextEngine:
    """上下文引擎 — Retriever → Filter → Compressor 三阶段 Pipeline

    设计目标:
    - 从海量数据中抽取与当前任务最相关的上下文
    - 压缩到 token_budget 以内
    - 保持上下文的信息密度
    """

    def __init__(self, retriever: "ContextRetriever",
                 filter: "RelevanceFilter",
                 compressor: "ContextCompressor"):
        self.retriever = retriever
        self.filter = filter
        self.compressor = compressor

    async def build_context(
        self, query: str, agent_id: str, session: dict | None,
        token_budget: int = 8000
    ) -> AgentContext:
        """构建 Agent 上下文 — 三阶段 Pipeline"""

        # Stage 1: Retrieve — 全量检索相关数据
        raw = await self.retriever.fetch_all(query, session)
        # raw 包含: user_profile, memories, project_data, graph_hints,
        #           conversation_history, knowledge_states

        # Stage 2: Filter — 按相关性过滤
        filtered = self.filter.by_relevance(raw, agent_id, top_k=20)
        # 过滤策略:
        # - 按 agent_id 筛选该 Agent 有权访问的数据
        # - 按 query 相似度排序
        # - 截断到 top_k 条

        # Stage 3: Compress — 压缩到 token_budget 以内
        compressed = await self.compressor.summarize(
            filtered, max_tokens=token_budget
        )
        # 压缩策略:
        # - 长文本截断/摘要
        # - 重复信息去重
        # - 低相关性内容丢弃

        return AgentContext(
            query=query,
            user_profile_summary=compressed.user_profile,
            relevant_memories=compressed.memories,
            task_context=compressed.task_context,
            project_context=compressed.project_context,
            knowledge_graph_hints=compressed.graph_hints,
            token_budget=token_budget,
            tokens_used=compressed.total_tokens,
        )


class ContextRetriever:
    """上下文检索器 — 从各数据源全量检索"""

    async def fetch_all(self, query: str, session: dict | None) -> dict:
        """全量检索（并行）"""
        tasks = {
            "user_profile": self._fetch_user_profile(session),
            "memories": self._fetch_memories(query, session),
            "project_data": self._fetch_project_data(session),
            "graph_hints": self._fetch_graph_hints(session),
            "conversation_history": self._fetch_conversation(session),
            "knowledge_states": self._fetch_knowledge_states(session),
        }
        results = await asyncio.gather(*tasks.values())
        return dict(zip(tasks.keys(), results))

    # ... 各 _fetch_* 方法实现


class RelevanceFilter:
    """相关性过滤器 — 按 Agent 权限和相关度筛选"""

    def by_relevance(self, raw: dict, agent_id: str, top_k: int = 20) -> dict:
        """按相关性过滤

        过滤规则:
        1. 按 Agent 权限过滤（Memory 读写权限矩阵）
        2. 按 query 文本相似度排序
        3. 截断到 top_k
        """
        # TODO: 按实现规范编码
        ...


class ContextCompressor:
    """上下文压缩器 — 控制 token 预算"""

    async def summarize(self, filtered: dict, max_tokens: int = 8000) -> "CompressedContext":
        """压缩上下文

        压缩策略:
        1. 用户画像: 保留关键字段，~500 tokens
        2. 记忆条目: 按相关性排序，保留 top-5，每条 ~200 tokens
        3. 项目数据: README 截断前 1000 字符
        4. 对话历史: 保留最近 5 轮，每轮 ~200 tokens
        5. 图谱提示: 保留 top-3 关联，每条 ~100 tokens
        """
        # TODO: 按实现规范编码
        ...
```

### §7.3 HubContext（Hub 专用精简上下文）

```python
@dataclass
class HubContext:
    """Hub 上下文 — Hub Chief Agent 的精简上下文

    设计目的: 避免 Context Explosion
    Hub 仅持有摘要级信息，子 Agent 持有领域级详细信息
    """
    conversation_summary: str = ""            # 对话历史摘要（~2000 tokens）
    task_result_summary: str = ""             # 最近任务结果摘要（每任务 ~500 tokens）
    long_memory: list[dict] = field(default_factory=list)  # 检索式访问
    user_profile: dict = field(default_factory=dict)       # 用户画像（~1000 tokens）
    active_agents: list[str] = field(default_factory=list)
    task_plan: "TaskPlan | None" = None
```

---

## §8 反问系统

### §8.1 沿用 v1 AgentQuestion Interface

反问系统沿用 v1 §6 的完整设计，核心接口不变：

```python
@dataclass
class AgentQuestion:
    """反问面板数据结构（沿用 v1 §6）"""
    intro: dict                               # {type: "markdown", content: "..."}
    questions: list[dict]                      # 问题列表
    allow_skip: bool = True
    skip_text: str = "跳过"
    actions: dict = field(default_factory=lambda: {
        "submit": {"text": "提交", "style": "primary"},
        "skip": {"text": "跳过", "style": "ghost"},
    })
```

**5 种问题类型：** radio, checkbox, slider, drag_sort, knowledge_map — 完整定义见 v1 AGENT_SPEC §6。

**反问触发条件：**

| Agent | 触发场景 | 示例 |
|-------|---------|------|
| Mentor | 讲解前了解用户水平 | "你对 FastAPI 的熟悉程度？" |
| Navigator | 规划前明确目标 | "你的学习目标是什么？" |
| Curator | 分类不确定时 | "这个项目更适合归入哪一类？" |
| Hub | 意图不明确时 | "你想让我做什么？" |
| Scribe | 笔记模式选择 | "要关联当前项目吗？" |

### §8.2 v2 Plan Progress 集成

v2 新增反问与 Plan-and-Execute 流水线的集成机制：

```python
class PlanProgressIntegration:
    """反问系统与 Plan-and-Execute 的集成

    当 Agent 在 ReAct 循环中触发反问时:
    1. Hub 暂停当前 TaskStep 的执行
    2. 向前端发送 plan_update 事件（status: "waiting_question"）
    3. 前端弹出反问面板
    4. 用户回答后，通过 POST /agent/question 提交
    5. Hub 恢复 TaskStep 执行，将答案注入 Agent 上下文
    """

    async def pause_for_question(
        self, plan: "TaskPlan", step: "TaskStep",
        question: AgentQuestion
    ) -> dict:
        """暂停计划等待反问"""
        step.status = "pending"  # 回退为 pending，等待恢复
        return {
            "plan_id": plan.plan_id,
            "step_id": step.step_id,
            "status": "waiting_question",
            "question": question,
        }

    async def resume_after_question(
        self, plan: "TaskPlan", step: "TaskStep",
        answer: dict
    ) -> None:
        """反问回答后恢复执行"""
        step.status = "pending"  # 重新标记为待执行
        # 将答案注入该步骤的上下文
        step.instruction += f"\n[用户反问回答]: {json.dumps(answer, ensure_ascii=False)}"
```

**SSE 事件流（反问场景）：**

```
event: plan_update
data: {"step_id": "s1", "status": "waiting_question"}

event: question
data: {"intro": {...}, "questions": [...]}

// 用户回答后...

event: plan_update
data: {"step_id": "s1", "status": "running"}

event: text_delta
data: {"content": "基于你的回答..."}
```

---

## §9 API 端点

### §9.1 v1 保留端点

> 以下端点沿用 v1 §8 定义，路径和行为不变：
> - `/api/v1/agent/chat` — 对话入口（内部升级为 Hub Plan-and-Execute）
> - `/api/v1/agent/question` — 反问回答提交
> - `/api/v1/agent/analyze/:id` — 直接分析
> - `/api/v1/agent/compare` — 多项目对比
> - `/api/v1/agent/classify` — 分类建议
> - `/api/v1/agent/recommend` — 项目推荐
> - `/api/v1/agent/note/generate` — 笔记生成
> - `/api/v1/agent/sessions` — 会话管理

### §9.2 v2 新增端点

```
/api/v2/
├── agent/                              (v2 升级)
│   ├── POST /chat                      (沿用 v1，内部走 Hub Plan-and-Execute)
│   ├── POST /question                  (沿用 v1，新增 Plan Progress 集成)
│   ├── GET  /plan/{session_id}         (v2 新增: 获取当前 TaskPlan)
│   └── GET  /plan/{session_id}/steps   (v2 新增: 获取步骤执行状态)
├── knowledge-graph/                    (v2 新增)
│   ├── GET  /                          (图谱全量数据，含多类型边)
│   ├── GET  /query                     (Graph Query API)
│   ├── POST /edges                     (手动添加边)
│   └── DELETE /edges/{id}              (删除边)
├── memory/                             (v2 新增)
│   ├── GET  /proposals                 (获取记忆提案列表)
│   ├── GET  /proposals/{id}            (获取提案详情)
│   ├── GET  /commits                   (获取记忆提交历史)
│   ├── GET  /knowledge-states          (获取知识状态)
│   └── PUT  /knowledge-states/{domain} (手动覆盖知识状态)
└── evaluator/                          (v2.1+ 预留)
    ├── GET  /reviews                   (获取评估记录)
    └── GET  /reviews/{session_id}      (获取会话评估详情)
```

### §9.3 新增端点详细规格

#### GET /api/v2/agent/plan/{session_id}

**Response 200:**
```json
{
  "plan_id": "uuid",
  "user_query": "分析这个项目并规划学习路线",
  "status": "running",
  "steps": [
    {
      "step_id": "s1",
      "agent_id": "scout",
      "instruction": "分析 fastapi 项目",
      "depends_on": [],
      "status": "completed"
    },
    {
      "step_id": "s2",
      "agent_id": "navigator",
      "instruction": "基于分析结果规划学习路线",
      "depends_on": ["s1"],
      "status": "running"
    }
  ],
  "created_at": "2026-07-04T14:30:00Z"
}
```

#### GET /api/v2/knowledge-graph/query

**Query Parameters:**

| 参数 | 类型 | 说明 |
|------|------|------|
| `edge_type` | string | 边类型筛选（逗号分隔） |
| `min_weight` | float | 最小权重 |
| `project_id` | string | 中心项目 ID |
| `depth` | integer | 查询深度 |
| `limit` | integer | 返回边数上限 |

**Response 200:**
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
      {"id": "uuid", "name": "fastapi", "language": "Python", "category": "后端框架"}
    ]
  },
  "meta": {"total_edges": 42, "total_nodes": 15}
}
```

#### GET /api/v2/memory/proposals

**Query Parameters:** `status` (pending/merged/rejected), `page`, `page_size`

**Response 200:**
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
  "meta": {"page": 1, "page_size": 20, "total": 5}
}
```

#### GET /api/v2/memory/commits

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "proposal_id": "uuid",
      "merged_by": "hub",
      "merge_strategy": "evidence_weighted",
      "score": 0.72,
      "previous_value": 31,
      "committed_value": 45,
      "committed_at": "2026-07-04T10:31:00Z"
    }
  ],
  "meta": {"page": 1, "total": 12}
}
```

### §9.4 SSE 流式事件类型（v2 扩展）

沿用 v1 的 8 种事件类型，v2 新增 2 种：

```python
class StreamEventType(Enum):
    """SSE 流式事件类型（v2 扩展：在 v1 基础上新增 2 种，共 10 种）"""
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

**v2 新增事件示例：**

```
event: plan_update
data: {"step_id": "s1", "agent_id": "scout", "status": "running", "instruction": "分析项目架构"}

event: memory_proposal
data: {"agent_id": "mentor", "target_layer": "knowledge_state", "key": "react", "confidence": 0.82}
```

---

## §10 降级策略

### §10.1 无 LLM Key 降级

沿用 v1 §10 降级策略，v2 新增以下降级行为：

| 功能模块 | 有 Key（完整模式） | 无 Key（降级模式） |
|---------|------------------|------------------|
| Hub Intent Detection | LLM 分类 + 规则 | 纯规则匹配 |
| Task Planning | LLM 辅助分解 | 固定模板（单步骤） |
| Scout 分析 | LLM 生成速览报告 | TF-IDF + 关键词规则 |
| Mentor 讲解 | Adaptive (ReAct/ToT/GoT) | 仅 README + 源码片段 |
| Navigator 规划 | LLM 生成学习路径 | 基于 Knowledge Graph 的固定路径 |
| Curator 分类 | Reflexion + LLM | GitHub topics + 关键词规则 |
| Scribe 笔记 | LLM 生成大纲 | 模板化大纲 |
| Memory Merge | Evidence Weighted | latest_wins 策略 |
| Context Compressor | LLM 摘要 | 截断策略 |

### §10.2 Hub Plan-and-Execute 降级

当 LLM 不可用时，Hub 退化为简单路由器：

```python
class FallbackHubService:
    """无 LLM 降级 Hub — 纯规则路由"""

    async def receive_message(self, user_id, session_id, message, context):
        # 纯规则意图匹配
        agent_id = self._rule_based_classify(message)
        # 固定单步骤计划
        plan = TaskPlan(steps=[TaskStep(step_id="s1", agent_id=agent_id, instruction=message)])
        # 直接派发
        result = await self.dispatcher.execute_step(plan.steps[0], context)
        yield StreamEvent(type=StreamEventType.TEXT_DELTA, data={"content": result.output})
        yield StreamEvent(type=StreamEventType.DONE, data={"fallback": True})
```

### §10.3 Multi-Model Router 降级

当目标层级模型不可用时，按以下优先级降级：

```
REASONING → STANDARD → FAST → 本地规则（无 LLM）
```

---

## §11 安全设计

### §11.1 沿用 v1 安全机制

> 以下安全机制沿用 v1 §10，实现不变：
> - JWT 鉴权 + Refresh Token 轮转
> - Fernet 加密 API Key (PBKDF2 密钥派生)
> - SSRF 防护（api_base URL 校验 + BLOCKED_NETWORKS）
> - 路径遍历校验（read_source_file 的 path/ref 参数）
> - 搜索词 URL scheme 过滤（search_web）
> - PromptGuard 输入消毒
> - Tool 权限校验（allowed_agents 白名单）

### §11.2 v2 新增安全约束

| 安全项 | 说明 | 实现 |
|--------|------|------|
| Memory Proposal 权限 | Agent 只能对 allowed 层提交 Proposal | `propose_memory_update` 的 `target_layer` 枚举限制 |
| Memory 写保护 | Agent 不能直接修改 Memory | 只能通过 Proposal → Hub Merge |
| Evaluator 隔离 | Evaluator 不参与执行链路 | 独立 Agent，仅 Hub 可触发 |
| Context 隔离 | Agent 只获得 Relevant Context | ContextEngine 按权限过滤 |
| Tool 调用审计 | 所有工具调用记录到 agent_messages | `tool_call_id` 关联追踪 |
| Proposal 冲突检测 | 防止恶意低置信度提案 | `MIN_CONFIDENCE = 0.5` 阈值 |

---

## §12 性能设计

### §12.1 并发模型

沿用 v1 §11 的 asyncio 单线程事件循环模型，v2 新增：

| 层级 | 并发方式 | 说明 |
|------|---------|------|
| Hub Plan-and-Execute | `asyncio.gather` | 并行步骤同时执行 |
| AgentDispatcher | `asyncio.wait_for` | 每步骤独立超时 |
| ContextEngine | `asyncio.gather` | Retriever 多源并行检索 |
| MemoryMergeService | 串行 | Proposal 逐个处理（避免并发冲突） |

### §12.2 性能指标目标

| 指标 | 目标值 | 说明 |
|------|--------|------|
| Intent Detection | < 500ms | 规则匹配 < 10ms, LLM 分类 < 500ms |
| Task Planning | < 1000ms | 简单任务 < 100ms, 复杂任务 < 1000ms |
| 单 Agent 执行 | < 30s | 含工具调用 |
| Context Building | < 2000ms | 三阶段 Pipeline |
| Memory Merge | < 500ms | 每 Proposal |
| SSE 首 Token 延迟 | < 2000ms | 从请求到首 text_delta |
| 并行步骤执行 | < max(单步骤) | 不超过最慢的单步骤 |

### §12.3 Token 预算控制

| 组件 | Token 上限 | 策略 |
|------|-----------|------|
| HubContext | ~4000 | Conversation Summary 2000 + UserProfile 1000 + TaskResult 1000 |
| AgentContext | ~8000 | ContextEngine 三阶段压缩 |
| 单次 LLM 调用 | max_tokens per Agent | 见 §2.2 注册信息 |
| 对话历史 | 最近 5 轮 | 超出部分压缩为摘要 |

---

## §13 TBD 管理

| TBD 编号 | 描述 | 来源 | 状态 |
|---------|------|------|------|
| TBD-04 | Agent 协作模式：当前为星型拓扑，是否支持 Agent 间直接调用 | v1 沿用 | 暂不变更 |
| TBD-10 | Evaluator Agent 激活时机：v2.1+ 的具体触发条件和评分阈值调优 | v2 新增 | 待 v2.1 规划 |
| TBD-11 | Multi-Model Router 模型映射：用户 BYOK 配置如何映射到 ModelTier | v2 新增 | 待实现阶段确定 |
| TBD-12 | Context Compressor LLM 摘要 vs 截断策略的动态切换阈值 | v2 新增 | 待性能测试 |
| TBD-13 | Memory Proposal 批量处理：是否支持同一 Agent 的多 Proposal 合并提交 | v2 新增 | 待 UX 设计 |
| TBD-14 | Knowledge Graph 边权重自动更新频率：TF-IDF / Embedding 边的衰减策略 | v2 新增 | 待 v2.1 规划 |
| TBD-15 | Reflexion 最大轮次的动态调整：是否根据项目复杂度调整 Curator 的 3 轮上限 | v2 新增 | 待用户测试反馈 |

---

## §14 扩展性预留

### §14.1 Agent 扩展接口

新增 Agent 只需：

1. 在 `backend/agents/{new_agent}/` 创建 `AGENT.md` + `SOUL.md` + `config.yaml`
2. 在 `AgentRegistry` 注册 `AgentDefinition`
3. 在 `ToolRegistry` 为相关工具添加 `allowed_agents`
4. 在 `LLMRouter` 添加路由配置

无需修改 Hub、Dispatcher、MemoryMergeService 等核心组件。

### §14.2 Evaluator Agent 激活清单（v2.1+）

当 Evaluator 激活时，需要：

1. 将 `evaluator` Agent 注册状态从 `disabled` 改为 `enabled`
2. 在 Hub 的 `receive_message` 流水线末尾添加 Evaluator 调用步骤
3. 启用 `evaluator_reviews` 表的数据写入
4. 配置 Evaluator 的 `evaluate_response` 工具实现
5. 设置评估阈值（accuracy >= 0.8, completeness >= 0.7, grounding >= 0.8）
6. 配置 FAIL → 重新规划的重试上限（建议 2 次）

### §14.3 Workflow 引擎扩展

当前支持 5 种 workflow 模式：

| 模式 | 使用 Agent | 扩展方式 |
|------|-----------|---------|
| `react` | Scout, Navigator | 沿用 v1 ReActEngine |
| `plan_execute` | Hub | HubService 内部实现 |
| `adaptive` | Mentor | 根据 complexity 选择 react/tot/got |
| `reflexion` | Curator | ReflexionEngine（最多 3 轮） |
| `dual_mode` | Scribe | Project Mode / Standalone Mode 切换 |

未来可扩展：
- `debate`: 多 Agent 辩论模式
- `chain_of_agents`: Agent 链式传递模式
- `supervisor`: 监督学习模式

### §14.4 推理引擎注册表

```python
class EngineFactory:
    """推理引擎工厂 — 根据 workflow 类型返回对应引擎"""

    _engines = {
        "react": ReActEngine,
        "plan_execute": PlanExecuteEngine,
        "adaptive": AdaptiveEngine,
        "reflexion": ReflexionEngine,
        "dual_mode": DualModeEngine,
    }

    @classmethod
    def get_engine(cls, workflow: str) -> "BaseEngine":
        engine_cls = cls._engines.get(workflow)
        if not engine_cls:
            raise AppException("ENGINE_NOT_FOUND", f"推理引擎 {workflow} 不存在")
        return engine_cls()

    @classmethod
    def register_engine(cls, workflow: str, engine_cls: type) -> None:
        """注册新的推理引擎"""
        cls._engines[workflow] = engine_cls
```

---

*文档结束。本文档由 v1 AGENT_SPEC 迭代而来，所有 v2 新增/变更内容以本文档为权威来源。*
