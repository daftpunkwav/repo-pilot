# RepoPilot v1.0 Agent 系统规格书

> 版本: 1.0.0 | 日期: 2026-07-04 | 状态: 审核通过 - daftpunkwav
> 本文档是 Agent 系统的**唯一权威来源**。所有 Agent 相关的代码定义、工具规格、记忆系统、反问系统、行为规范以本文档为准。
> TECHNICAL_SPEC.md §4-§9 仅提供架构概览，完整实现细节以本文档为准。
> 依赖文档: AGENT_PRD.md (产品需求), TECHNICAL_SPEC.md (总体架构), MVP_SCOPE.md (实施范围)

---

## 目录

- [1. Agent 系统架构](#1-agent-系统架构)
- [2. Agent 角色注册](#2-agent-角色注册)
- [3. LLM Provider 层](#3-llm-provider-层)
- [4. 工具系统](#4-工具系统)
- [5. 记忆系统](#5-记忆系统)
- [6. 反问系统](#6-反问系统)
- [7. Agent 行为规范](#7-agent-行为规范)
- [8. API 端点设计](#8-api-端点设计)
- [9. 扩展性预留](#9-扩展性预留)
- [10. 安全设计](#10-安全设计)
- [11. 性能设计](#11-性能设计)
- [12. TBD 管理](#12-tbd-管理)

---

## 1. Agent 系统架构

### §1.1 架构图

```
┌────────────────────────────────────────────────────────────────┐
│                        前端 (React + TypeScript)                │
│  ┌──────────────┐  ┌─────────────────┐  ┌───────────────────┐  │
│  │ ChatPanel    │  │ QuestionRenderer│  │ AgentConfigPanel  │  │
│  │ (对话 UI)    │  │ (反问组件)      │  │ (Agent 配置)      │  │
│  └──────┬───────┘  └────────┬────────┘  └────────┬──────────┘  │
│         │ SSE               │ JSON               │ REST        │
└─────────┼──────────────────┼────────────────────┼──────────────┘
          │                  │                    │
┌─────────▼──────────────────▼────────────────────▼──────────────┐
│                     API Gateway (FastAPI)                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   Agent Router                            │  │
│  │  POST /agent/chat       → Hub 调度（SSE）                │  │
│  │  POST /agent/question   → 反问回答提交（SSE）            │  │
│  │  POST /agent/analyze/:id→ Scout/Mentor 直接调用           │  │
│  │  POST /agent/compare    → 多项目对比（Mentor）            │  │
│  │  POST /agent/classify   → 分类建议（Curator）             │  │
│  │  POST /agent/recommend  → 推荐项目（Navigator）           │  │
│  │  POST /agent/note/generate → 笔记大纲（Scribe）           │  │
│  │  GET  /agent/sessions   → 会话管理                        │  │
│  └──────────────────────┬───────────────────────────────────┘  │
└──────────────────────────┼─────────────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────────────┐
│                     Service Layer                                │
│  ┌───────────┐  ┌────────────┐  ┌────────────┐  ┌───────────┐  │
│  │ Hub       │  │ ReAct      │  │ Memory     │  │ Question  │  │
│  │ Service   │  │ Engine     │  │ Service    │  │ Service   │  │
│  │ (路由调度)│  │ (推理执行) │  │ (记忆管理) │  │ (反问管理)│  │
│  └─────┬─────┘  └─────┬──────┘  └─────┬──────┘  └─────┬─────┘  │
│        │              │               │               │        │
│  ┌─────▼──────────────▼───────────────▼───────────────▼──────┐  │
│  │                  LLM Provider (LiteLLM)                    │  │
│  │  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │  │
│  │  │ OpenAI  │  │ Anthropic│  │ DeepSeek │  │ Custom   │   │  │
│  │  └─────────┘  └──────────┘  └──────────┘  └──────────┘   │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────────────┐
│                     Data Layer                                   │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ SQLite   │  │ File Storage │  │ In-Memory Cache          │  │
│  │ (WAL)    │  │ (AGENT.md等) │  │ (会话上下文 / 工作记忆)  │  │
│  └──────────┘  └──────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### §1.2 模块依赖图

```
AgentRouter
  └── HubService
        ├── IntentClassifier
        │     └── LLMProvider (for classification)
        ├── AgentRegistry
        │     ├── AgentDefinition (×6)
        │     │     ├── AGENT.md
        │     │     ├── SOUL.md
        │     │     ├── system_prompt.j2
        │     │     └── config.yaml
        │     └── CapabilityDetector
        │           └── LLMConfig
        ├── ReActEngine
        │     ├── LLMProvider
        │     │     └── LiteLLM
        │     ├── ToolRegistry
        │     │     └── ToolDefinition (×14)
        │     ├── StreamCollector
        │     └── PromptGuard
        ├── MemoryService
        │     ├── UserProfileStore
        │     ├── SessionStore
        │     ├── ProjectMemoryStore
        │     └── HistoryCompressor
        └── NotificationService (v1.4+ 预留)
```

### §1.3 并发模型

Agent 系统采用 **asyncio 单线程事件循环** 模型：

| 层级            | 并发方式                     | 说明                        |
| ------------- | ------------------------ | ------------------------- |
| API Router    | async def 端点             | FastAPI 原生异步              |
| HubService    | asyncio.gather           | 多 Agent 并行分析（v1.0 同时一个对话） |
| ReActEngine   | async for stream         | LLM 流式输出 + 工具串行执行         |
| ToolRegistry  | asyncio.wait_for         | 工具超时控制                    |
| MemoryService | async SQLite (aiosqlite) | WAL 模式支持并发读               |

**SSE 连接生命周期：**

- 要求 FastAPI >= 0.100.0 / Starlette >= 0.20.0
- 使用 `request.is_disconnected()` 检测客户端断开
- 断开时调用 `asyncio.Task.cancel()` 清理资源
- SSE 连接最大超时：5 分钟

**请求生命周期：**

```
1. 用户发送消息
   │
2. FastAPI 接收 → JWT 鉴权 → 注入 current_user
   │
3. HubService.receive_message(user_id, session_id, message)
   │
4. 意图识别 (IntentClassifier)
   │  ├── 快速规则匹配 (关键词/正则)
   │  └── LLM 意图分类 (模糊场景)
   │
5. Agent 路由
   │  ├── 单 Agent 任务 → 直接派发
   │  └── 跨 Agent 任务 → Hub 编排多个 Agent
   │
6. 上下文组装 (MemoryService)
   │  ├── 加载系统记忆 (AGENT.md + SOUL.md)
   │  ├── 加载用户画像
   │  ├── 加载项目记忆 (如果关联项目)
   │  ├── 加载会话历史 (含压缩策略)
   │  └── 组装 System Prompt
   │
7. ReAct 执行循环 (ReActEngine)
   │  ├── LLM 推理 → 决定下一步行动
   │  ├── 工具调用 → 执行 → 结果回注
   │  ├── 反问检测 → 暂停等待用户回答
   │  └── 生成最终回答
   │
8. 流式输出 (SSE)
   │  ├── token 级流式推送到前端
   │  └── 特殊事件: agent_question / tool_call / agent_switch
   │
9. 后处理
   │  ├── 更新会话记忆
   │  ├── 提取用户画像更新
   │  └── 缓存项目分析结果
```

---

## 2. Agent 角色注册

### §2.1 AgentRegistry + AgentDefinition

```python
from dataclasses import dataclass, field
from typing import Literal
from pathlib import Path

@dataclass
class AgentDefinition:
    """Agent 注册定义（M1 修复：capabilities 紧跟 tools 之后）"""
    id: str                          # 唯一标识: "scout", "mentor", ...
    name: str                        # 显示名称: "快速分析 Agent"
    description: str                 # 一句话描述
    tools: list[str]                 # 可用工具 ID 列表
    capabilities: list[str]          # C-12/F5-10 修复：能力声明 (如 ["tools", "streaming", "vision"])
    model_override: str | None = None  # 模型覆盖 (None = 使用用户配置)
    temperature: float = 0.7         # 生成温度
    max_tokens: int = 4096           # 最大输出 token
    streaming: bool = True           # 是否启用流式输出
    auto_trigger: bool = False       # 是否自动触发（如 Scout 导入时）
    priority: int = 0                # 多 Agent 竞争时的优先级
    agent_md_path: str = ""          # AGENT.md 文件路径
    soul_md_path: str = ""           # SOUL.md 文件路径
    system_prompt_template: str = "" # Jinja2 模板路径
    config: dict = field(default_factory=dict)  # config.yaml 内容


class AgentRegistry:
    """Agent 注册表 — 管理所有可用 Agent"""

    def __init__(self, agents_dir: Path):
        self._agents: dict[str, AgentDefinition] = {}
        self._load_agents(agents_dir)

    def _load_agents(self, agents_dir: Path) -> None:
        """从 backend/agents/ 目录扫描并加载所有 Agent 配置

        目录结构:
        backend/agents/
          ├── scout/
          │   ├── AGENT.md / SOUL.md / system_prompt.j2 / config.yaml
          ├── mentor/
          ├── navigator/
          ├── curator/
          ├── scribe/
          └── hub/
        """
        # TODO: 按伪代码实现 — 扫描目录，解析 config.yaml，加载 AgentDefinition
        ...

    def get(self, agent_id: str) -> AgentDefinition:
        """获取 Agent 定义，不存在则抛出 AgentNotFoundError"""
        agent = self._agents.get(agent_id)
        if not agent:
            raise AppException("AGENT_NOT_FOUND", f"Agent {agent_id} 不存在")
        return agent

    def list_all(self) -> list[AgentDefinition]:
        """列出所有已注册 Agent"""
        return list(self._agents.values())

    def get_system_prompt(self, agent_id: str, context: dict) -> str:
        """渲染 Agent 的 System Prompt（注入上下文变量）"""
        # TODO: 加载 agent_md + soul_md → 渲染 Jinja2 模板
        ...
```

**六个 Agent 注册信息：**

| Agent ID  | 名称         | 工具数 | capabilities                       | auto_trigger | priority |
| --------- | ---------- | --- | ---------------------------------- | ------------ | -------- |
| scout     | 快速分析 Agent | 5   | `["tools", "streaming"]`           | True         | 10       |
| mentor    | 深度讲解 Agent | 11  | `["tools", "streaming", "vision"]` | False        | 20       |
| navigator | 学习规划 Agent | 7   | `["tools", "streaming"]`           | False        | 15       |
| curator   | 分类文档 Agent | 6   | `["tools", "streaming"]`           | True         | 5        |
| scribe    | 笔记助手 Agent | 6   | `["tools", "streaming"]`           | False        | 5        |
| hub       | 对话管家       | 3   | `["tools", "streaming"]`           | False        | 0        |

### §2.2 HubService 路由

HubService 是 Agent 系统的**统一入口**，负责接收用户消息、意图分类、路由到合适的 Agent、管理多 Agent 编排。

```python
class HubService:
    """对话管家 — 消息路由和多 Agent 编排"""

    def __init__(self, registry: AgentRegistry, classifier: "IntentClassifier",
                 react_engine: "ReActEngine", memory_service: "MemoryService"):
        self.registry = registry
        self.classifier = classifier
        self.react_engine = react_engine
        self.memory_service = memory_service

    async def receive_message(self, user_id: str, session_id: str,
                              message: str, project_id: str | None = None,
                              ) -> AsyncGenerator[StreamEvent, None]:
        """处理用户消息，返回流式事件生成器"""
        session = await self.memory_service.get_or_create_session(session_id, user_id)

        # 检查是否有 pending question（F5-45：状态排斥）
        if session.status == "pending_question":
            raise AppException("QUESTION_PENDING", "请先回答当前反问")

        # 意图分类
        context = ConversationContext(
            session_id=session_id,
            recent_messages=session.recent_messages[-5:],
            current_project=session.current_project,
            user_profile=await self.memory_service.get_user_profile(user_id),
            active_agent=session.active_agent,
        )
        intent = await self.classifier.classify(message, context)

        if intent.is_multi:
            async for event in self._orchestrate_multi(user_id, session, intent, context):
                yield event
        else:
            agent = self.registry.get(intent.agent_id)
            async for event in self._execute_agent(agent, user_id, session, message, context):
                yield event

    async def _execute_agent(self, agent, user_id, session, message, context):
        """单 Agent 执行"""
        ...

    async def _orchestrate_multi(self, user_id, session, intent, context):
        """多 Agent 编排 — 按顺序执行子意图"""
        results = []
        for sub in intent.sub_intents:
            yield StreamEvent(type=StreamEventType.AGENT_SWITCH, data={
                "agent_id": sub.agent_id, "reason": sub.reason,
            })
            agent = self.registry.get(sub.agent_id)
            if results:
                summary = self._summarize_results(results)
                context.recent_messages.append(
                    Message(role="system", content=f"[前序 Agent 摘要] {summary}")
                )
            agent_result = []
            async for event in self._execute_agent(agent, user_id, session, sub.message, context):
                yield event
                if event.type == StreamEventType.TEXT_DELTA:
                    agent_result.append(event.data.get("content", ""))
            results.append({"agent": sub.agent_id, "output": "".join(agent_result)})
```

#### §2.2.1 IntentClassifier

```python
from dataclasses import dataclass, field
from typing import Literal
import re

@dataclass
class SubIntent:
    """子意图（C-09/F5-07 修复）"""
    agent_id: str
    message: str
    reason: str

@dataclass
class IntentResult:
    """意图分类结果（C-09/F5-07 修复）"""
    agent_id: Literal["hub", "scout", "mentor", "navigator", "curator", "scribe"]
    confidence: float
    is_multi: bool
    sub_intents: list[SubIntent] = field(default_factory=list)


class IntentClassifier:
    """意图分类器"""

    FAST_RULES: list[tuple[re.Pattern, str]] = [
        (re.compile(r"分析|讲解|介绍|看看|讲讲"), "mentor"),
        (re.compile(r"规划|路线|学习路径|怎么学"), "navigator"),
        (re.compile(r"分类|整理|标签|归类"), "curator"),
        (re.compile(r"笔记|总结|摘要|记录"), "scribe"),
        (re.compile(r"对比|比较|区别|差异|vs"), "scout"),
    ]

    INTENT_PROMPT = """判断以下用户消息应该由哪个 Agent 处理。
可用 Agent: scout(快速分析), mentor(深度讲解), navigator(学习规划),
curator(分类), scribe(笔记), hub(通用对话)
用户消息: {message}
返回 JSON: {{"agent_id": "...", "confidence": 0.0-1.0}}
"""

    def __init__(self, llm: "LLMProvider"):
        self.llm = llm

    async def classify(self, message: str, context: "ConversationContext") -> IntentResult:
        """三步意图分类"""
        # 第一步: 快速规则匹配
        for pattern, agent_id in self.FAST_RULES:
            if pattern.search(message):
                return IntentResult(agent_id=agent_id, confidence=0.9)

        # 第二步: 检测多意图
        multi = await self._detect_multi_intent(message)
        if multi:
            return IntentResult(agent_id="hub", confidence=0.85, is_multi=True, sub_intents=multi)

        # 第三步: LLM 分类
        return await self._llm_classify(message, context)

    async def _detect_multi_intent(self, message: str) -> list[SubIntent] | None:
        """检测多意图（B-04 补全：双策略）"""
        MULTI_KEYWORDS = ["并且", "同时", "另外", "还有", "以及", "并帮我", "再帮我"]
        if not any(kw in message for kw in MULTI_KEYWORDS):
            return None
        MULTI_INTENT_PROMPT = """分析以下用户消息是否包含多个独立意图。
可用 Agent: scout, mentor, navigator, curator, scribe
用户消息: {message}
返回 JSON: {{"is_multi": true/false, "sub_intents": [{{"agent_id": "...", "message": "...", "reason": "..."}}]}}
"""
        result = await self.llm.complete([
            Message(role="user", content=MULTI_INTENT_PROMPT.format(message=message))
        ])
        parsed = json.loads(result.text)
        if not parsed.get("is_multi"):
            return None
        return [SubIntent(**item) for item in parsed["sub_intents"]]

    async def _llm_classify(self, message: str, context) -> IntentResult:
        result = await self.llm.complete([
            Message(role="user", content=self.INTENT_PROMPT.format(message=message))
        ])
        parsed = json.loads(result.text)
        return IntentResult(agent_id=parsed.get("agent_id", "hub"),
                          confidence=parsed.get("confidence", 0.5))
```

#### §2.2.2 多 Agent 编排

当 IntentClassifier 返回 `is_multi=True` 时，HubService 按顺序执行各子意图，前序 Agent 的输出摘要注入后一个 Agent 的上下文。

**路由策略表：**

| 场景                     | 路由行为                          |
| ---------------------- | ----------------------------- |
| 明确意图 (如 "分析 React")    | 直接派发到对应 Agent                 |
| 模糊意图 (如 "帮帮我")         | Hub 自己回答，引导用户明确需求             |
| 多意图 (如 "分析并规划路线")      | Hub 编排：Scout → Navigator 顺序执行 |
| Agent 执行中发现需要另一个 Agent | 当前 Agent 完成，Hub 追加调度下一个       |
| 置信度 < 0.5              | Hub 反问用户意图                    |

> **[TBD-04] Agent 协作模式:** 当前设计为 Hub 统一路由（星型拓扑），不允许 Agent 之间直接调用。

##### §2.2.2.1 StreamEventType

```python
from enum import Enum
from dataclasses import dataclass

class StreamEventType(Enum):
    """SSE 事件类型（与 TECHNICAL_SPEC §3.5 权威定义对齐，8 种）"""
    TEXT_DELTA = "text_delta"
    TOOL_CALL = "tool_call"
    TOOL_RESULT = "tool_result"
    QUESTION = "question"
    DONE = "done"
    ERROR = "error"
    AGENT_SWITCH = "agent_switch"
    THINKING = "thinking"

@dataclass
class StreamEvent:
    type: StreamEventType
    data: dict
```

---

## 3. LLM Provider 层

### §3.1 LLMProvider 类

```python
from typing import AsyncIterator

class LLMProvider:
    """LLM 调用统一层 — 封装 LiteLLM 调用"""

    def __init__(self, config: "LLMConfig | None"):
        self.config = config

    async def complete(self, messages: list, tools: list[dict] | None = None,
                       temperature: float = 0.7, max_tokens: int = 4096,
                       stream: bool = True) -> AsyncIterator:
        """调用 LLM 生成回复（流式）"""
        if not self.config:
            raise AppException("LLM_NOT_CONFIGURED", "未配置 LLM API Key")
        try:
            import litellm  # 模块级守卫（决策 T-09）
        except ImportError:
            raise AppException("LLM_NOT_CONFIGURED", "litellm 未安装")
        # TODO: 按实现规范编码 — 调用 litellm.acompletion()
        ...

    async def test_connection(self) -> bool:
        """测试 LLM 连通性"""
        if not self.config:
            return False
        try:
            async for _ in self.complete(
                messages=[Message(role="user", content="ping")],
                max_tokens=5, stream=False):
                pass
            return True
        except Exception:
            return False
```

### §3.2 LLMConfig(BaseModel)

```python
from pydantic import BaseModel, field_validator
from typing import Literal

class LLMConfig(BaseModel):
    """LLM 配置模型（H3 修复：@field_validator 已挂载）"""
    provider: Literal["openai", "anthropic", "deepseek", "custom"]
    model: str
    api_key: str
    api_base: str | None = None
    max_context_tokens: int = 128000
    max_output_tokens: int = 4096

    @field_validator("api_base")
    @classmethod
    def validate_api_base(cls, v: str | None) -> str | None:
        """SSRF 防护（H3 修复）：完整 BLOCKED_NETWORKS 校验见 TECHNICAL_SPEC §5.2"""
        if v is None:
            return v
        from urllib.parse import urlparse
        parsed = urlparse(v)
        if parsed.scheme not in ("http", "https"):
            raise ValueError(f"api_base 仅允许 http/https，收到: {parsed.scheme}")
        return v


PRESET_CONFIGS = {
    "openai": LLMConfig(provider="openai", model="gpt-4o", api_key="",
                        api_base=None, max_context_tokens=128000, max_output_tokens=4096),
    "anthropic": LLMConfig(provider="anthropic", model="claude-sonnet-4-20250514",
                           api_key="", api_base=None, max_context_tokens=200000, max_output_tokens=8192),
    "deepseek": LLMConfig(provider="deepseek", model="deepseek-chat",
                          api_key="", api_base=None, max_context_tokens=64000, max_output_tokens=4096),
    "custom": LLMConfig(provider="custom", model="", api_key="",
                        api_base=None,  # C-05 修复：空字符串改为 None
                        max_context_tokens=8000, max_output_tokens=2048),
}
```

### §3.3 CapabilityDetector

```python
class CapabilityDetector:
    """能力检测器"""

    def __init__(self, config: LLMConfig | None):
        self.config = config

    @property
    def has_llm(self) -> bool:
        """F5-19 修复：config is not None and bool(api_key)"""
        return self.config is not None and bool(self.config.api_key)

    @property
    def supports_tools(self) -> bool:
        if not self.has_llm:
            return False
        NO_TOOL_MODELS = ["gpt-3.5-turbo-0301", "text-davinci-003"]
        return self.config.model not in NO_TOOL_MODELS

    @property
    def supports_streaming(self) -> bool:
        return self.has_llm

    @property
    def supports_vision(self) -> bool:
        if not self.has_llm:
            return False
        return any(m in self.config.model for m in ["gpt-4o", "gpt-4-vision-preview", "claude-3"])
```

**BYOK 降级检测流程：**

1. 从 `user_settings` 表读取 `encrypted_api_key`
2. NULL → `config = None` → `has_llm = False` → 降级提示
3. 非 NULL → Fernet 解密 → 构建 `LLMConfig` → `has_llm = True`

---

## 4. 工具系统

### §4.1 ReAct Engine

ReAct (Reasoning + Acting) 模式是 Agent 的核心执行循环。

```python
import asyncio, json, logging
logger = logging.getLogger(__name__)

class ReActEngine:
    MAX_ITERATIONS = 10

    async def run(self, session, messages: list, context) -> AsyncIterator[StreamEvent]:
        """执行 ReAct 循环"""
        iteration = 0
        while iteration < self.MAX_ITERATIONS:
            iteration += 1

            collector = StreamCollector()
            tools_openai = [
                t.to_openai_format()
                for t in context.tool_registry.get_tools_for_agent(context.agent_id)
            ] if context.capability_detector.supports_tools else None

            async for chunk in context.llm_provider.complete(
                messages=messages, tools=tools_openai,
                temperature=context.agent_def.temperature,
                max_tokens=context.agent_def.max_tokens,
            ):
                if chunk.type == "text":
                    collector.append_text(chunk.text)
                    yield StreamEvent(type=StreamEventType.TEXT_DELTA, data={"content": chunk.text})
                elif chunk.type == "tool_call":
                    collector.add_tool_call(chunk.tool_call)
                    yield StreamEvent(type=StreamEventType.TOOL_CALL, data=chunk.tool_call)
                elif chunk.type == "done":
                    collector.set_usage(chunk.usage)

            if not collector.has_tool_calls:
                break

            for tc in collector.tool_calls:
                tool_name = tc["function"]["name"]
                tool_args = json.loads(tc["function"]["arguments"])
                yield StreamEvent(type=StreamEventType.TOOL_CALL, data={
                    "name": tool_name, "status": "running", "args": tool_args
                })
                try:
                    result = await asyncio.wait_for(
                        context.tool_registry.execute(tool_name, tool_args, context),
                        timeout=context.tool_registry.get_timeout(tool_name) / 1000,
                    )
                    messages.append(Message(role="tool", content=result.to_string(), tool_call_id=tc["id"]))
                    yield StreamEvent(type=StreamEventType.TOOL_RESULT, data={
                        "name": tool_name, "status": "success", "preview": result.preview(),
                    })
                except asyncio.TimeoutError:
                    messages.append(Message(role="tool", content=f"[工具超时] {tool_name}", tool_call_id=tc["id"]))
                    yield StreamEvent(type=StreamEventType.TOOL_RESULT, data={"name": tool_name, "status": "timeout"})
                except Exception as e:
                    logger.error(f"Tool {tool_name} failed: {e}")
                    messages.append(Message(role="tool", content=f"[工具错误] {tool_name}: {e}", tool_call_id=tc["id"]))
                    yield StreamEvent(type=StreamEventType.TOOL_RESULT, data={"name": tool_name, "status": "error", "error": str(e)})

            if self._check_question_pending(messages):
                session.status = "pending_question"
                yield StreamEvent(type=StreamEventType.QUESTION, data=self._extract_question(messages))
                return

        yield StreamEvent(type=StreamEventType.DONE, data={"iterations": iteration})
```

**F5-30 修复 — 工具失败/异常分支说明：**

| 场景   | 行为                         | 用户可见            |
| ---- | -------------------------- | --------------- |
| 工具成功 | 结果注入 messages，继续循环         | tool_result SSE |
| 工具超时 | 超时消息注入，Agent 可重试或跳过        | "工具超时"          |
| 工具异常 | 错误消息注入，Agent 透明说明          | "工具出错"          |
| 反问请求 | 状态 → pending_question，退出循环 | 反问面板弹出          |
| 最大迭代 | 强制结束                       | 正常结束            |

### §4.2 ToolRegistry + ToolDefinition

```python
from dataclasses import dataclass, field
from typing import Callable

@dataclass  # F5-47 修复
class ToolDefinition:
    name: str
    description: str
    parameters: dict
    handler: Callable
    allowed_agents: list[str] = field(default_factory=list)
    timeout_ms: int = 30000
    requires_confirmation: bool = False

    def to_openai_format(self) -> dict:
        """T-02 补全"""
        return {"type": "function", "function": {
            "name": self.name, "description": self.description, "parameters": self.parameters,
        }}

class ToolRegistry:
    _tools: dict[str, ToolDefinition] = {}

    @classmethod
    def register(cls, d: ToolDefinition) -> None:
        cls._tools[d.name] = d

    @classmethod
    def get_tools_for_agent(cls, agent_id: str) -> list[ToolDefinition]:
        return [t for t in cls._tools.values() if agent_id in t.allowed_agents]

    @classmethod
    def get_timeout(cls, name: str) -> int:
        t = cls._tools.get(name)
        return t.timeout_ms if t else 30000

    @classmethod
    async def execute(cls, name: str, args: dict, context) -> "ToolResult":
        tool = cls._tools.get(name)
        if not tool:
            raise AppException("TOOL_NOT_FOUND", f"工具 {name} 不存在")
        if context.agent_id not in tool.allowed_agents:
            raise AppException("TOOL_NOT_ALLOWED", f"Agent {context.agent_id} 无权使用 {name}")
        return await tool.handler(**args, context=context)

# @tool 装饰器（B-03 补全）
def tool(name: str, description: str, parameters: dict,
         allowed_agents: list[str], timeout_ms: int = 30000):
    def decorator(func):
        ToolRegistry.register(ToolDefinition(
            name=name, description=description, parameters=parameters,
            handler=func, allowed_agents=allowed_agents, timeout_ms=timeout_ms,
        ))
        return func
    return decorator
```

### §4.3 14 个工具的完整 @tool 定义（C-04 修复）

#### 1. query_user_projects

```python
@tool(name="query_user_projects",
      description="查询用户项目库。支持按名称、分类、标签、语言、学习进度筛选。",
      parameters={"type": "object", "properties": {
          "query": {"type": "string", "description": "搜索关键词"},
          "category": {"type": "string"}, "language": {"type": "string"},
          "tag": {"type": "string"},
          "progress": {"type": "string", "enum": ["none","learning","learned","mastered"]},
          "limit": {"type": "integer", "default": 20},
      }, "required": []},
      allowed_agents=["scout","mentor","navigator","curator","scribe","hub"], timeout_ms=10000)
async def query_user_projects(query="", category="", language="", tag="", progress="", limit=20, context=None, **kw):
    projects = await context.db.query_projects(user_id=context.user_id, query=query, category=category,
        language=language, tag=tag, progress=progress, limit=limit)
    return {"count": len(projects), "projects": [
        {"id": p.id, "name": p.name, "url": p.url, "language": p.language,
         "stars": p.stars, "category": p.category_name, "progress": p.progress} for p in projects]}
```

#### 2. read_readme

```python
@tool(name="read_readme", description="读取项目的 README 内容。",
      parameters={"type": "object", "properties": {"project_id": {"type": "string"}}, "required": ["project_id"]},
      allowed_agents=["scout","mentor"], timeout_ms=10000)
async def read_readme(project_id, context=None, **kw):
    project = await context.db.get_project(project_id, context.user_id)
    if not project: return {"error": "项目不存在"}
    return {"project_name": project.name, "readme": project.readme or "（未获取）",
            "readme_fetched_at": str(project.readme_fetched_at) if project.readme_fetched_at else None}
```

#### 3. read_source_file（T-02 修复：start_line/end_line 分页）

```python
@tool(name="read_source_file",
      description="读取 GitHub 仓库中的源码文件。支持按行范围分页读取。",
      parameters={"type": "object", "properties": {
          "repo": {"type": "string", "description": "owner/repo"},
          "path": {"type": "string"}, "ref": {"type": "string", "default": "main"},
          "start_line": {"type": "integer", "default": 1},
          "end_line": {"type": "integer", "default": 200},
      }, "required": ["repo", "path"]},
      allowed_agents=["mentor"], timeout_ms=15000)
async def read_source_file(repo, path, ref="main", start_line=1, end_line=200, context=None, **kw):
    """T-02 修复：start_line/end_line 分页；F5-17 修复：路径遍历校验"""
    import re as _re
    if not _re.match(r"^[a-zA-Z0-9._-]+/[a-zA-Z0-9._-]+$", repo):
        return {"error": "仓库名格式无效"}
    if ".." in path or path.startswith("/"):
        return {"error": "路径不允许包含 .. 或以 / 开头"}
    if any(c in ref for c in "?&#"):
        return {"error": "ref 不允许包含特殊字符"}
    data = await context.github.get_file_content(repo, path, ref)
    if not data: return {"error": "文件不存在"}
    import base64
    content = base64.b64decode(data["content"]).decode("utf-8", errors="replace")
    lines = content.split("\n")
    s, e = max(1, start_line) - 1, min(len(lines), end_line)
    return {"path": path, "ref": ref, "content": "\n".join(lines[s:e]),
            "total_lines": len(lines), "shown_lines": f"{s+1}-{e}", "truncated": len(lines) > e}
```

#### 4. search_web（C-01/S-04 修复：接口契约 + SSRF 防护）

```python
@tool(name="search_web",
      description="搜索互联网。v1.0 使用 DuckDuckGo Instant Answer API。",
      parameters={"type": "object", "properties": {
          "query": {"type": "string", "description": "搜索词（禁止含 URL scheme）"},
          "max_results": {"type": "integer", "default": 5},
      }, "required": ["query"]},
      allowed_agents=["scout","mentor","navigator","curator","scribe","hub"], timeout_ms=15000)
async def search_web(query, max_results=5, context=None, **kw):
    """接口契约：
    | 约束 | 说明 |
    |------|------|
    | 搜索 API | DuckDuckGo Instant Answer（duckduckgo-search 库） |
    | SSRF 防护 | 搜索词禁止 http://, https://, ://（S-04） |
    | URL 校验 | 返回 URL 需经 BLOCKED_NETWORKS 校验（引用 TECHNICAL_SPEC §5.2） |
    | 截断 | 每条 ≤500 字符，总 ≤4000 字符 |
    | 消毒 | 经 PromptGuard.sanitize_user_input() |
    """
    import re as _re
    if _re.search(r"https?://|://", query):
        return {"error": "搜索词不允许包含 URL"}
    # TODO: 按伪代码实现 — duckduckgo-search
    ...
```

#### 5. get_project_analysis

```python
@tool(name="get_project_analysis", description="获取缓存的项目分析结果。",
      parameters={"type": "object", "properties": {
          "project_id": {"type": "string"}, "analysis_type": {"type": "string", "enum": ["scout","mentor"]},
      }, "required": ["project_id"]},
      allowed_agents=["hub","mentor"], timeout_ms=10000)
async def get_project_analysis(project_id, analysis_type="scout", context=None, **kw):
    a = await context.db.get_latest_analysis(project_id, analysis_type)
    if not a: return {"status": "no_analysis"}
    if a.is_expired: return {"status": "expired"}
    return {"status": "ok", "analysis": a.content, "analyzed_at": str(a.created_at), "expires_at": str(a.expires_at)}
```

#### 6. compare_projects

```python
@tool(name="compare_projects", description="对比多个项目的技术栈、功能、架构等维度。",
      parameters={"type": "object", "properties": {
          "project_ids": {"type": "array", "items": {"type": "string"}},
          "dimensions": {"type": "array", "items": {"type": "string", "enum": ["tech_stack","features","architecture","community","learning_curve"]}, "default": ["tech_stack","features"]},
      }, "required": ["project_ids"]},
      allowed_agents=["mentor"], timeout_ms=30000)
async def compare_projects(project_ids, dimensions=None, context=None, **kw):
    if not dimensions: dimensions = ["tech_stack", "features"]
    projects = [p for pid in project_ids[:5] if (p := await context.db.get_project(pid, context.user_id))]
    if len(projects) < 2: return {"error": "至少需要 2 个有效项目"}
    return {"projects": [{"id": p.id, "name": p.name} for p in projects], "dimensions": dimensions,
            "data": {p.id: {"language": p.language, "stars": p.stars, "description": p.description, "category": p.category_name} for p in projects}}
```

#### 7. update_user_profile

```python
@tool(name="update_user_profile", description="更新用户画像信息。",
      parameters={"type": "object", "properties": {
          "tech_proficiency": {"type": "object"}, "learning_preferences": {"type": "object"},
          "goals": {"type": "array"}, "extensions": {"type": "object"},
      }, "required": []},
      allowed_agents=["mentor","navigator"], timeout_ms=10000)
async def update_user_profile(tech_proficiency=None, learning_preferences=None, goals=None, extensions=None, context=None, **kw):
    profile = await context.db.get_user_profile(context.user_id)
    if not profile:
        from uuid import uuid4; profile = UserProfile(user_id=uuid4())
    if tech_proficiency: profile.tech_proficiency.update(tech_proficiency)
    if learning_preferences:
        for k, v in learning_preferences.items():
            if hasattr(profile.learning_preferences, k): setattr(profile.learning_preferences, k, v)
    if goals is not None: profile.goals = goals
    if extensions:
        for k, v in extensions.items():
            if k.startswith("ext_") and len(k) <= 128: profile.extensions[k] = v
    from datetime import datetime
    profile.updated_at = datetime.utcnow().isoformat()
    await context.db.save_user_profile(profile)
    return {"status": "updated", "updated_at": profile.updated_at}
```

#### 8. ask_user_question（C-01/C-02 修复）

```python
@tool(name="ask_user_question",
      description="向用户弹出交互式反问面板。5 种类型。",
      parameters={"type": "object", "properties": {
          "intro": {"type": "object", "properties": {"type": {"type": "string", "enum": ["markdown"]}, "content": {"type": "string"}}, "required": ["type","content"]},
          "questions": {"type": "array", "items": {"type": "object", "properties": {
              "id": {"type": "string"}, "text": {"type": "string"},
              "type": {"type": "string", "enum": ["radio","checkbox","slider","drag_sort","knowledge_map"]},
              "options": {"type": "array"}, "allow_other": {"type": "boolean"},
          }, "required": ["id","text","type"]}},
          "allow_skip": {"type": "boolean", "default": True}, "skip_text": {"type": "string", "default": "跳过"},
      }, "required": ["intro","questions"]},
      allowed_agents=["mentor","navigator","hub","curator","scribe"], timeout_ms=300000)
async def ask_user_question(intro, questions, allow_skip=True, skip_text="跳过", context=None, **kw):
    """C-01: intro 结构化对象；C-02: submit.style 5 选项"""
    return {"type": "agent_question", "question": {
        "intro": intro, "questions": questions, "allow_skip": allow_skip, "skip_text": skip_text,
        "actions": {
            "submit": {"text": "提交", "style": "primary"},  # primary|secondary|ghost|danger|link
            "skip": {"text": skip_text, "style": "ghost"},
        }}}
```

#### 9. save_to_memory

```python
@tool(name="save_to_memory", description="将信息存储到记忆系统。",
      parameters={"type": "object", "properties": {
          "content": {"type": "string"}, "category": {"type": "string", "enum": ["insight","fact","preference","goal","note"]},
          "project_id": {"type": "string"}, "tags": {"type": "array", "items": {"type": "string"}},
      }, "required": ["content","category"]},
      allowed_agents=["scout","mentor","navigator","curator","scribe","hub"], timeout_ms=10000)
async def save_to_memory(content, category, project_id=None, tags=None, context=None, **kw):
    from datetime import datetime
    await context.db.save_memory_item({"user_id": context.user_id, "agent_id": context.agent_id,
        "session_id": context.session_id, "content": content, "category": category,
        "project_id": project_id, "tags": tags or [], "created_at": datetime.utcnow().isoformat()})
    return {"status": "saved"}
```

#### 10. recall_from_memory

```python
@tool(name="recall_from_memory", description="从记忆系统中检索信息。",
      parameters={"type": "object", "properties": {
          "query": {"type": "string"}, "category": {"type": "string", "enum": ["insight","fact","preference","goal","note"]},
          "project_id": {"type": "string"}, "limit": {"type": "integer", "default": 10},
      }, "required": ["query"]},
      allowed_agents=["scout","mentor","navigator","curator","scribe","hub"], timeout_ms=10000)
async def recall_from_memory(query, category=None, project_id=None, limit=10, context=None, **kw):
    items = await context.db.recall_memories(user_id=context.user_id, query=query, category=category, project_id=project_id, limit=limit)
    return {"count": len(items), "items": [{"id": i["id"], "content": i["content"], "category": i["category"], "created_at": i["created_at"]} for i in items]}
```

#### 11. suggest_classification（F5-08 修复）

```python
@tool(name="suggest_classification", description="为项目建议分类和标签。",
      parameters={"type": "object", "properties": {"project_id": {"type": "string"}}, "required": ["project_id"]},
      allowed_agents=["curator"], timeout_ms=20000)
async def suggest_classification(project_id, context=None, **kw):
    """F5-08 修复：补充缺失工具定义"""
    project = await context.db.get_project(project_id, context.user_id)
    if not project: return {"error": "项目不存在"}
    info = {"name": project.name, "description": project.description, "language": project.language,
            "topics": project.topics, "readme_summary": (project.readme or "")[:2000]}
    # TODO: 调用 LLM 或降级为关键词规则匹配
    return {"project_id": project_id, "project_info": info, "suggested_category": None, "suggested_tags": [], "confidence": 0.0, "source": "ai"}
```

#### 12. generate_note_outline（F5-08 修复）

```python
@tool(name="generate_note_outline", description="为项目生成学习笔记大纲。",
      parameters={"type": "object", "properties": {
          "project_id": {"type": "string"}, "depth": {"type": "string", "enum": ["overview","detailed","comprehensive"], "default": "detailed"},
          "language": {"type": "string", "default": "zh-CN"},
      }, "required": ["project_id"]},
      allowed_agents=["scribe"], timeout_ms=30000)
async def generate_note_outline(project_id, depth="detailed", language="zh-CN", context=None, **kw):
    """F5-08 修复：补充缺失工具定义"""
    project = await context.db.get_project(project_id, context.user_id)
    if not project: return {"error": "项目不存在"}
    # TODO: 调用 LLM 生成结构化大纲
    return {"project_id": project_id, "project_name": project.name, "depth": depth, "outline": None}
```

#### 13. build_learning_path（F5-08 修复）

```python
@tool(name="build_learning_path", description="基于用户画像和项目库构建学习路径。",
      parameters={"type": "object", "properties": {
          "goal": {"type": "string"}, "timeframe": {"type": "string"},
          "include_project_ids": {"type": "array", "items": {"type": "string"}},
      }, "required": ["goal"]},
      allowed_agents=["navigator"], timeout_ms=30000)
async def build_learning_path(goal, timeframe="", include_project_ids=None, context=None, **kw):
    """F5-08 修复：补充缺失工具定义"""
    profile = await context.db.get_user_profile(context.user_id)
    if include_project_ids:
        projects = [p for pid in include_project_ids if (p := await context.db.get_project(pid, context.user_id))]
    else:
        projects = await context.db.query_projects(user_id=context.user_id, limit=50)
    ctx = {"user_profile": {"tech_proficiency": profile.tech_proficiency if profile else {},
            "learning_preferences": profile.learning_preferences.__dict__ if profile else {},
            "goals": profile.goals if profile else []},
           "available_projects": [{"name": p.name, "language": p.language, "progress": p.progress} for p in projects],
           "goal": goal, "timeframe": timeframe}
    # TODO: 调用 LLM 生成学习路径
    return {"goal": goal, "timeframe": timeframe, "context": ctx, "path": None}
```

#### 14. get_user_profile

```python
@tool(name="get_user_profile", description="读取用户画像信息。",
      parameters={"type": "object", "properties": {
          "sections": {"type": "array", "items": {"type": "string", "enum": ["tech_proficiency","learning_preferences","goals","history_summary","extensions"]}},
      }, "required": []},
      allowed_agents=["mentor","navigator"], timeout_ms=10000)
async def get_user_profile(sections=None, context=None, **kw):
    profile = await context.db.get_user_profile(context.user_id)
    if not profile: return {"status": "no_profile", "message": "用户画像尚未建立"}
    result = {"status": "ok"}
    for s in (sections or ["tech_proficiency","learning_preferences","goals","history_summary","extensions"]):
        if s == "tech_proficiency": result[s] = profile.tech_proficiency
        elif s == "learning_preferences": result[s] = profile.learning_preferences.__dict__
        elif s == "goals": result[s] = profile.goals
        elif s == "history_summary": result[s] = profile.history_summary
        elif s == "extensions": result[s] = profile.extensions
    return result
```

---

## 5. 记忆系统

### §5.1 记忆层级

```
┌─────────────────────────────────────┐
│ 系统记忆 (AGENT.md / SOUL.md / j2)  │
├─────────────────────────────────────┤
│ 用户画像 (UserProfile)              │
├─────────────────────────────────────┤
│ 项目记忆 (project_analyses)         │
├─────────────────────────────────────┤
│ 会话记忆 (sessions + messages)      │
├─────────────────────────────────────┤
│ 短期记忆 (ReAct 消息列表)           │
└─────────────────────────────────────┘
```

### §5.2 数据库表

```sql
CREATE TABLE agent_sessions (
    id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id),
    agent_id VARCHAR(32) NOT NULL, title VARCHAR(256) DEFAULT '新对话',
    status VARCHAR(32) DEFAULT 'active',  -- active/pending_question/archived
    current_project_id UUID NULLABLE REFERENCES projects(id),
    metadata JSON DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_agent_sessions_user ON agent_sessions(user_id, updated_at DESC);

CREATE TABLE agent_messages (
    id UUID PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
    role VARCHAR(32) NOT NULL,  -- system/user/assistant/tool
    content TEXT NOT NULL, agent_id VARCHAR(32),
    tool_call_id VARCHAR(128) NULLABLE,
    metadata JSON DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- C-07 修复：补充索引
CREATE INDEX idx_messages_session ON agent_messages(session_id, created_at);

CREATE TABLE project_analyses (
    id UUID PRIMARY KEY, project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    analysis_type VARCHAR(32) NOT NULL, content TEXT NOT NULL,
    token_usage JSON DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL
);
CREATE INDEX idx_analyses_project ON project_analyses(project_id, analysis_type, created_at DESC);

CREATE TABLE user_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id),
    tech_proficiency JSON DEFAULT '{}',
    learning_preferences JSON DEFAULT '{}',
    goals JSON DEFAULT '[]', history_summary TEXT DEFAULT '',
    agent_preferences JSON DEFAULT '{}',
    extensions JSON DEFAULT '{}',  -- ≤64KB / ≤100 keys / ext_ 前缀
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**数据保留策略（S-06 修复）：**

| 表                | 策略              | 清理方式           |
| ---------------- | --------------- | -------------- |
| agent_messages   | 每会话最近 1000 条    | CleanupService |
| project_analyses | expires_at 到期清理 | CleanupService |
| graph_cache      | expires_at 到期清理 | CleanupService |

### §5.3 UserProfile + AgentPreferences + LearningPreferences

```python
from dataclasses import dataclass, field
from typing import Literal
from uuid import UUID

@dataclass
class LearningPreferences:
    """F5-21 修复：style Literal 枚举"""
    style: Literal["hands_on", "theoretical", "visual"] = "hands_on"
    depth_first: bool = True
    code_examples: bool = True
    comparisons: bool = True
    verbosity: str = "balanced"
    language: str = "zh-CN"
    code_comment_language: str = "zh-CN"

@dataclass
class AgentPreferences:
    """C-03 修复：4 个字段"""
    verbosity: str = "balanced"
    use_emoji: bool = True
    auto_ask_questions: bool = True
    max_questions: int = 3

@dataclass
class UserProfile:
    """C-08 修复：user_id: UUID + updated_at"""
    user_id: UUID
    tech_proficiency: dict = field(default_factory=dict)
    learning_preferences: LearningPreferences = field(default_factory=LearningPreferences)
    goals: list[dict] = field(default_factory=list)
    history_summary: str = ""
    agent_preferences: AgentPreferences = field(default_factory=AgentPreferences)
    extensions: dict = field(default_factory=dict)
    updated_at: str = ""
```

### §5.4 记忆压缩算法

```python
class HistoryCompressor:
    MAX_MESSAGES = 20
    TOKEN_BUDGET_RATIO = 0.8

    async def compress(self, messages, max_tokens):
        if len(messages) <= self.MAX_MESSAGES: return messages
        recent = messages[-self.MAX_MESSAGES:]
        old = messages[:-self.MAX_MESSAGES]
        summary = await self._summarize(old)
        return [Message(role="system", content=f"[历史摘要] {summary}")] + recent

    async def _summarize(self, messages):
        points = []
        for msg in messages:
            if msg.role == "user":
                entities = self._extract_entities(msg.content)
                if entities: points.append(f"用户提到了: {', '.join(entities)}")
            elif msg.role == "assistant":
                points.append(f"Agent 回复了关于 {msg.content[:100]}...")
        return "\n".join(points)

    def _extract_entities(self, text):
        # TODO: 正则 + 关键词词典
        ...
```

---

## 6. 反问系统

### §6.1 AgentQuestion 格式（C-01/C-02 修复）

```typescript
interface AgentQuestion {
  type: "agent_question";
  question: {
    intro: { type: "markdown"; content: string };  // C-01 修复：结构化对象
    questions: QuestionItem[];
    allow_skip: boolean;
    skip_text: string;
    actions: {
      submit: {
        text: string;
        style: "primary" | "secondary" | "ghost" | "danger" | "link";  // C-02 修复：5 选项
      };
      skip?: { text: string; style: "ghost" };
    };
  };
}

interface QuestionItem {
  id: string; text: string;
  type: "radio" | "checkbox" | "slider" | "drag_sort" | "knowledge_map";
  options?: { value: string; label?: string; text?: string; description?: string }[];
  allow_other?: boolean;
  min?: number; max?: number; labels?: Record<string, string>;  // slider
  tree?: { id: string; label: string; children?: any[] }[];  // knowledge_map
}

type QuestionAnswer =
  | { type: "radio"; value: string; other_text?: string }
  | { type: "checkbox"; values: string[] }
  | { type: "slider"; value: number }
  | { type: "drag_sort"; order: string[] }
  | { type: "knowledge_map"; checked: string[] };
```

**字段命名约定（决策 A-03）：** radio/drag_sort 用 `label`，checkbox 用 `text`，slider 用 `labels` 映射表。

### §6.2 UI 渲染规范

| type          | UI 组件            | 说明                  |
| ------------- | ---------------- | ------------------- |
| radio         | 垂直 radio buttons | label + description |
| checkbox      | 可多选 checkboxes   | 快速浏览                |
| slider        | 滑动条 + 刻度         | 显示当前值               |
| drag_sort     | 可拖拽卡片            | 调整优先级               |
| knowledge_map | 树形 checkbox      | 知识点勾选               |

### §6.3 反问频率控制

| 参数                | 默认值  | 说明         |
| ----------------- | ---- | ---------- |
| max_questions     | 3    | 单次对话最大反问次数 |
| cooldown_messages | 5    | 两次反问间最少消息数 |
| skip_uses_default | true | 跳过后用默认级别   |

反问结果存入 `user_profiles.tech_proficiency`，下次同技术栈不再重复。

**TBD-10 反问数据存储（F5-58 修复）：** v1.0 = SQLite + JSON（`agent_messages.metadata`），v1.1+ 评估独立表。

---

## 7. Agent 行为规范

### §7.1 AGENT.md 模板

```markdown
# Mentor Agent 行为规范

## 核心职责
你是 RepoPilot 的深度讲解 Agent，负责帮助用户深入理解开源项目。

## 行为准则
1. 先了解再讲解：讲解前必须通过反问了解用户水平
2. 适配深度：根据用户回答动态调整讲解深度
3. 关联已知：把新知识和用户已掌握的技术关联起来
4. 给出建议：每次讲解结束给出下一步学习建议
5. 不假装知道：不确定时明确说"我不确定"

## 禁止行为
- 不编造源码内容
- 不给出未经证实的性能数据
- 不替用户做决策
```

### §7.2 SOUL.md 模板

```markdown
# Mentor Agent 性格

## 说话风格
- 温和、耐心、像有经验的前辈
- 避免过度学术化，用类比帮助理解
- 先给结论再展开

## 待确定
> T-10 修复：详见 PRD.md §7.4 TBD-01（形象）/ TBD-02（语气风格）
```

### §7.3 System Prompt Jinja2 模板

```jinja2
你是 RepoPilot 的 {{ agent.name }}。
{{ agent_md_content }}
{{ soul_md_content }}

## 当前用户画像
{% if user_profile %}
- 技术水平: {{ user_profile.tech_proficiency | summarize }}
- 学习偏好: {{ user_profile.learning_preferences.style }}
{% else %}
- 用户画像尚未建立
{% endif %}

## 可用工具
{% for tool in available_tools %}
- `{{ tool.name }}`: {{ tool.description }}
{% endfor %}

===END SYSTEM INSTRUCTIONS===
```

**Prompt 组装步骤（C-10 修复）：**

1. 读取 AGENT.md + SOUL.md
2. 渲染 Jinja2（注入 user_profile + project + tools）
3. 添加 `===END SYSTEM INSTRUCTIONS===` 分隔符（N-S-13）
4. PromptGuard 消毒用户消息
5. 组装 messages 列表

### §7.4 Agent config.yaml 示例

```yaml
# backend/agents/mentor/config.yaml
agent:
  id: mentor
  name: 深度讲解 Agent
  model_override: null
  temperature: 0.7
  max_tokens: 4096
  streaming: true
  auto_trigger: false
  priority: 20
  capabilities: [tools, streaming, vision]
  tools: [read_readme, read_source_file, search_web, query_user_projects,
          get_project_analysis, compare_projects, update_user_profile,
          ask_user_question, save_to_memory, recall_from_memory]
  question_strategy: {max_questions: 3, cooldown_messages: 5, skip_uses_default: true}
```

---

## 8. API 端点设计

### §8.1 Agent 对话端点

| 方法   | 路径                          | 说明                | 认证  | 速率限制        |
| ---- | --------------------------- | ----------------- | --- | ----------- |
| POST | /agent/chat                 | 发送消息，SSE 流式响应     | JWT | 20/min/user |
| POST | /agent/question             | 提交反问答案，恢复对话 (SSE) | JWT | 20/min/user |
| POST | /agent/analyze/{project_id} | 分析指定项目            | JWT | 10/min/user |

**POST /agent/chat：** `{"session_id": "uuid", "message": "...", "agent_id": null}`
**SSE 事件：** text_delta → tool_call → tool_result → done
**POST /agent/question：** `{"session_id": "uuid", "answers": [{"type": "radio", "question_id": "q1", "value": "..."}]}`

### §8.2 便捷端点（F5-27 修复）

| 方法   | 路径                   | 说明     | Agent     | 速率限制        |
| ---- | -------------------- | ------ | --------- | ----------- |
| POST | /agent/classify      | 建议分类   | Curator   | 10/min/user |
| POST | /agent/recommend     | 推荐项目   | Navigator | 10/min/user |
| POST | /agent/compare       | 对比项目   | Mentor    | 10/min/user |
| POST | /agent/note/generate | 生成笔记大纲 | Scribe    | 10/min/user |

响应格式：JSON（非 SSE）`{"data": {...}, "meta": {"agent_id": "xxx", "processing_time_ms": 1234}}`

### §8.3 Agent 配置端点

| 方法             | 路径                                  | 说明          |
| -------------- | ----------------------------------- | ----------- |
| GET/PUT/DELETE | /agent/sessions[/{id}]              | 会话 CRUD     |
| POST           | /agent/sessions/{id}/archive        | 归档          |
| GET/PUT        | /agent/config                       | 全局配置        |
| POST           | /agent/config/test                  | 测试 LLM 连通   |
| GET/PUT        | /agent/permissions                  | 权限配置        |
| GET            | /agent/profiles                     | 所有 Agent 定义 |
| GET/PUT        | /agent/profiles/{id}[/soul\|/agent] | Agent 配置    |
| GET/PUT        | /agent/user-profile                 | 用户画像        |

---

## 9. 扩展性预留

### §9.1 MCP 接入（v1.4+）

```python
from abc import ABC, abstractmethod
class MCPToolAdapter(ABC):
    @abstractmethod
    async def connect(self, server_url: str) -> bool: ...
    @abstractmethod
    async def list_tools(self) -> list[dict]: ...
    @abstractmethod
    async def execute_tool(self, name: str, args: dict) -> dict: ...
```

### §9.2 NotificationMessage @dataclass（M2 修复）

```python
from dataclasses import dataclass, field
from datetime import datetime

@dataclass
class NotificationMessage:
    """M2 修复：补充缺失类型定义（v1.4+ 即时通讯集成）"""
    type: str       # info/warning/success/question
    title: str
    body: str
    data: dict = field(default_factory=dict)
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    read: bool = False
```

### §9.3 Skill/插件市场

AGENT.md + SOUL.md 标准化配置 + JSON Schema 工具定义，未来用户可发布自定义 Agent。

### §9.4 Agent config.yaml 示例

参见 §7.4。每个 Agent 目录：AGENT.md / SOUL.md / system_prompt.j2 / config.yaml。

---

## 10. 安全设计

### §10.1 PromptGuard（S-05 修复：block/mark 模式）

```python
import re
import logging

logger = logging.getLogger(__name__)


class PromptGuard:
    """Prompt 注入防护（与 TECHNICAL_SPEC §10.3 对齐）

    mode 属性说明:
    - 当前为类变量（所有实例共享同一模式）
    - v1.1+ 计划改为实例属性，支持按用户/按会话配置
    """
    mode: str = "block"  # block（默认拦截）/ mark（MVP 降级标记）

    INJECTION_PATTERNS = [
        r"ignore\s+(all\s+)?previous\s+instructions",
        r"you\s+are\s+now\s+",
        r"new\s+instructions?\s*:",
        r"forget\s+everything",
        r"system\s*prompt\s*:",
        r"<\|im_start\|>",          # ChatML 注入
        r"\[INST\]",                # Llama 注入
        r"##\s*System\s*:",         # Markdown 注入
    ]

    @classmethod
    def sanitize_user_input(cls, text: str) -> str:
        """检测并处理 Prompt 注入尝试

        block 模式（默认）: 检测到注入时直接拦截
        mark 模式（MVP 降级）: 检测到注入时标记内容，仍传递给 LLM
        """
        for pattern in cls.INJECTION_PATTERNS:
            if re.search(pattern, text, re.IGNORECASE):
                logger.warning(f"PromptGuard: 检测到注入尝试 - 模式: {pattern}")
                if cls.mode == "block":
                    raise AppException("INJECTION_DETECTED", "检测到可疑内容，已拦截")
                return f"[INJECTION_FLAGGED] {text}"
        return text

    @classmethod
    def sanitize_tool_output(cls, text: str) -> str:
        """对工具返回内容进行消毒（委托给 sanitize_user_input）"""
        return cls.sanitize_user_input(text)
```

### §10.2 安全措施汇总

| 措施               | 位置                                        |
| ---------------- | ----------------------------------------- |
| SSRF 防护          | LLMConfig §3.2 / TECHNICAL_SPEC §5.2      |
| 路径遍历防护           | read_source_file §4.3                     |
| API Key 加密       | Fernet / TECHNICAL_SPEC §5.2              |
| JWT 认证           | HS256 + 15min + 7d / TECHNICAL_SPEC §10.1 |
| 速率限制             | 分端点 / TECHNICAL_SPEC §10.2                |
| 日志脱敏             | LogSanitizer / MVP_SCOPE §6.5             |
| 跨用户隔离            | user_id 强制过滤 / MVP_SCOPE §9.4             |
| System Prompt 分隔 | `===END SYSTEM INSTRUCTIONS===` / §7.3    |

---

## 11. 性能设计

### §11.1 延迟目标

| 操作             | 目标                    |
| -------------- | --------------------- |
| Scout 快速分析     | < 30s                 |
| Mentor 首 token | < 3s                  |
| 工具执行           | < 10s（search_web 15s） |
| 意图分类           | < 2s                  |
| 记忆检索           | < 500ms               |

### §11.2 缓存策略表（F5-48 修复）

| 缓存项               | TTL       | 存储               | 失效条件       | 说明        |
| ----------------- | --------- | ---------------- | ---------- | --------- |
| **GitHub README** | **1 小时**  | projects.readme  | 超 TTL 异步刷新 | **F5-48** |
| **GitHub Stars**  | **30 分钟** | 内存               | 手动刷新       | **F5-48** |
| 项目分析              | 24h       | project_analyses | expires_at |           |
| 图谱数据              | 变更失效      | graph_cache      | 项目增删改      | TF-IDF 增量 |
| Agent 定义          | 启动时       | 内存               | 配置变更       |           |
| 工具定义              | 启动时       | 内存               | 代码变更       |           |
| 用户画像              | 实时        | user_profiles    | 实时更新       |           |

### §11.3 性能优化

| 策略           | 说明                   |
| ------------ | -------------------- |
| SSE 流式       | 逐 token 推送           |
| 工具超时         | asyncio.wait_for     |
| 历史压缩         | >20 条自动压缩            |
| 图谱增量         | 仅重算变更项目              |
| SQLite WAL   | 并发读                  |
| selectinload | 避免 N+1               |
| SSE 序列化      | 统一 json.dumps（F5-44） |

---

## 12. TBD 管理

> TBD 编号全局统一管理。产品需求层权威定义见 **PRD.md §7.4**。

| 编号     | 内容             | 状态      | 版本   |
| ------ | -------------- | ------- | ---- |
| TBD-01 | Agent 形象设计     | 待定      | v1.0 |
| TBD-02 | Agent 语气风格精调   | 待定      | v1.0 |
| TBD-03 | 多 Agent 并行协作协议 | 待定      | v1.3 |
| TBD-04 | Agent 市场/插件生态  | 待定      | v1.4 |
| TBD-05 | MCP 集成规范       | 待定      | v1.4 |
| TBD-06 | 即时通讯推送适配器      | 待定      | v1.4 |
| TBD-07 | 移动端 Agent交互    | 待定      | v1.4 |
| TBD-08 | 主动学习用户画像       | 待定      | v1.3 |
| TBD-09 | 记忆压缩算法优化       | 待定      | v1.1 |
| TBD-10 | 反问数据存储         | **已决策** | v1.0 |

**TBD-10 决策（F5-58 修复）：** v1.0 = SQLite + JSON（`agent_messages.metadata`），v1.1+ 评估独立表或 Redis。
