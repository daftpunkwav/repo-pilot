---
type: Agent 系统模块
title: Agent 系统模块
description: 多 Agent AI 系统，包含 Hub 编排、7 个专业化 Agent、记忆管理和工具执行
tags: [agent, ai, llm, multi-agent, hub]
openwiki:
  roles: [architecture, domain]
  source_paths: [services/agent/agent_core/]
  symbols: [Hub, ReActEngine, AgentDefinition, MemoryService]
---

# Agent 系统模块

## 概述

Agent 系统是 RepoPilot 的 AI 大脑，采用**多 Agent 架构**，由中央 Hub 编排 7 个专业化 Agent。权威实现位于 `services/agent/agent_core/`，而 `services/api/backend/{agents,llm,tools,memory}` 作为兼容层（shim）存在。

## 架构

<!-- openwiki: mermaid parse failed and this diagram was converted to a text fence so it does not break rendering. Fix the diagram source and restore the mermaid fence. Parser error: Heuristic: an unescaped angle bracket inside a label breaks rendering; rephrase the label. -->
```text
flowchart TB
    subgraph Client
        UI["Web UI"]
    end
    
    subgraph AgentSystem["Agent System"]
        Hub["Hub Agent<br/>Orchestrator"]
        
        subgraph Experts["Expert Agents"]
            Scout["Scout<br/>Quick Analysis"]
            Mentor["Mentor<br/>Teaching"]
            Navigator["Navigator<br/>Learning Path"]
            Curator["Curator<br/>Organization"]
            Scribe["Scribe<br/>Note Taking"]
            Atlas["Atlas<br/>Knowledge Graph"]
        end
        
        subgraph Core["Core Components"]
            LLM["LLM Provider<br/>(LiteLLM)"]
            Memory["Memory Service"]
            Tools["Tool Registry<br/>(24 tools)"]
        end
    end
    
    subgraph Data
        DB[(Database)]
        GitHub["GitHub API"]
    end
    
    UI -->|SSE| Hub
    Hub -->|Dispatch| Experts
    Experts -->|Call| Tools
    Tools -->|Query| DB
    Tools -->|Fetch| GitHub
    Experts -->|Use| LLM
    Experts -->|Access| Memory
    Hub -->|Plan & Execute| Hub
```

## 目录结构

```
services/agent/agent_core/
├── agents/                # Agent implementations
│   ├── hub.py            # Hub orchestrator
│   ├── react.py          # ReAct engine
│   ├── registry.py       # Agent registry & definitions
│   ├── intent.py         # Intent classification
│   ├── question.py       # Question handling
│   ├── think_stream.py   # Streaming thoughts
│   ├── stream_events.py  # SSE event types
│   └── types.py          # Type definitions
├── llm/                   # LLM integration
│   ├── provider.py       # LiteLLM provider
│   └── config.py         # LLM configuration
├── memory/                # Memory management
│   ├── service.py        # Memory service
│   └── context.py        # Context builder
└── tools/                 # Tool implementations
    ├── builtin.py        # 24 built-in tools
    └── registry.py       # Tool registry
```

## 7 个 Agent

| Agent | ID | 角色 | 工作流 | 关键工具 |
|-------|-----|------|----------|-----------|
| **Hub** | `hub` | 首席调度器 | Plan-and-Execute（规划并执行） | dispatch_agent, ask_user, manage_session_projects, query_user_projects, query_knowledge_graph, get_learning_stats, propose_memory |
| **Scout** | `scout` | 快速分析 | ReAct | get_project_detail, fetch_github_repo, fetch_readme |
| **Mentor** | `mentor` | AI 导师 | ReAct（ToT 预热已移除） | ask_user（反问/测验）, fetch_readme, query_knowledge_graph, list_notes, propose_memory, update_project_progress |
| **Navigator** | `navigator` | 学习规划师 | ReAct | query_user_projects, query_knowledge_graph, get_learning_stats, list_notes, update_project_progress |
| **Curator** | `curator` | 知识组织者 | Reflexion（反思，最多 2 轮） | set_project_category, set_project_tags, ensure_category, ensure_tags, update_project_progress, select_import_repos, import_github_repos |
| **Scribe** | `scribe` | 笔记记录者 | ReAct | create_note, update_note, draft_note_outline, list_notes, fetch_readme |
| **Atlas** | `atlas` | 图谱向导 | ReAct | query_knowledge_graph, query_user_projects, get_project_detail, get_learning_stats |

> 各 Agent 的权威工具白名单见 `services/agent/agent_core/agents/registry.py` 的 `AGENT_DEFINITIONS`；`dispatch_agent` 运行时以注册表为准校验目标 Agent。

## Hub Agent

Hub 是中央编排器，负责处理用户意图、规划任务并分派给专家 Agent。

### 核心职责

1. **意图分类**：确定用户想要什么
2. **任务规划**：将复杂任务分解为多个步骤
3. **Agent 分派**：路由到合适的专家 Agent
4. **结果聚合**：合并各专家的输出
5. **记忆管理**：协调记忆更新

### 分派策略

| 场景 | 策略 |
|----------|----------|
| 只需要单个专家 | 直接分派 |
| 存在顺序依赖 | 串行分派 |
| 任务相互独立 | 并行分派 |
| 学习/教学 | 串行（阶段占用式） |

### 示例流程

```
用户："帮我学习 React"
Hub：分类意图 → "learning_request"
Hub：分派 Navigator → 创建学习路径
Navigator：查询用户项目 → 分析当前技能
Navigator：推荐 React 学习路径
Hub：聚合结果并呈现给用户
```

## ReAct 引擎

ReAct（推理 + 行动）引擎为大多数专家 Agent 提供动力：

```python
class ReActEngine:
    async def run(self, messages: Messages, tools: list[str]) -> EngineResult:
        for iteration in range(max_iterations):
            # 1. Think: LLM generates reasoning
            thought = await self.llm.think(messages)
            
            # 2. Act: Decide on tool call or answer
            action = await self.llm.act(messages, available_tools)
            
            # 3. Observe: Execute tool and get result
            if action.is_tool_call:
                result = await self.tools.execute(action.tool, action.params)
                messages.append_observation(result)
            else:
                return EngineResult(answer=action.content)
```

## 记忆系统

### 短期记忆

- 每个会话的上下文窗口
- 最近的对话历史
- 当前任务状态

### 长期记忆

- 用户画像（技术栈、偏好、目标）
- 学习历史
- 项目交互记录

### 记忆操作

```python
# Propose memory updates
propose_memory(kind="profile_tech", content="User knows Python")

# Query relevant memories
query_memories(query="user's React experience")
```

## 工具系统

### 24 个内置工具

工具通过 `@tool(...)` 装饰器在 `services/agent/agent_core/tools/builtin.py` 中于模块导入时注册到 `ToolRegistry`（`tools/registry.py`）。完整参数与逐 Agent 授权见 [智能体工具参考](../agents/tools.md)。

#### 项目查询
- `query_user_projects` - 搜索用户的项目库
- `get_project_detail` - 获取特定项目信息

#### GitHub 工具
- `fetch_github_repo` - 获取仓库元数据
- `fetch_readme` - 获取 README 内容

#### 图谱工具
- `query_knowledge_graph` - 查询用户项目知识图谱（相似项目、关联边）

#### 组织工具（分类/标签/进度）
- `list_categories` / `suggest_category` / `ensure_category` / `set_project_category`
- `list_tags` / `ensure_tags` / `set_project_tags`
- `update_project_progress` - 更新学习进度

#### 笔记工具
- `list_notes` / `draft_note_outline` / `create_note` / `update_note`

#### 导入工具
- `select_import_repos` - 勾选待导入仓库（不落库）
- `import_github_repos` - 真正批量导入项目库

#### 交互与会话工具
- `ask_user` - 结构化反问/测验（由 ReAct 引擎拦截）
- `manage_session_projects` - 管理会话绑定的项目上下文
- `propose_memory` - 提交记忆/画像更新提案（需用户确认）
- `get_learning_stats` - 学习统计

#### 调度工具
- `dispatch_agent` - Hub 专用，委派任务给专家 Agent

写库工具（`create_note`、`update_note`、`ensure_category`、`set_project_category`、`ensure_tags`、`set_project_tags`、`update_project_progress`、`import_github_repos`）受 `required_permission`（`allow_note_write` / `allow_project_write`）门控，执行前由 `ToolRegistry.execute` 检查用户授权。

#### 交互工具
- `ask_user` - 向用户提出澄清性问题
- `dispatch_agent` - 委派给其他 Agent

### 工具注册

```python
from agent_core.tools.registry import tool

@tool(
    name="my_tool",
    description="Tool description",
    parameters={...},
    allowed_agents=["hub", "scout"],
    timeout_ms=10000
)
async def my_tool(context, param1: str, param2: int):
    return {"result": "success"}
```

## LLM 提供者

### LiteLLM 集成

```python
# Supports multiple providers via unified interface
from agent_core.llm.provider import LLMProvider

provider = LLMProvider()
response = await provider.complete(
    messages=messages,
    model="gpt-4",
    temperature=0.7,
    stream=True
)
```

### 支持的提供者

- OpenAI（GPT-4、GPT-3.5）
- Anthropic（Claude）
- Azure OpenAI
- 本地模型（通过 LiteLLM）

### BYOK（自带密钥）

用户在设置中提供自己的 API 密钥：
- OpenAI API 密钥
- Anthropic API 密钥
- Azure 凭据

## Agent 运行时

### 默认模式（同进程部署）

```
services/api (port 19878)
    └── forwards to agent_core
```

### 独立模式

```
services/agent/agent_runtime (port 19877)
    └── can run independently
```

### 配置

```bash
# In API service
AGENT_BASE_URL="http://127.0.0.1:19877"  # Enable standalone mode
```

## Agent 灵魂（Souls）

每个 Agent 都有可配置的"灵魂"，用于定义其个性：

```python
SOULS = {
    "scout": {
        "core": "You are Scout - repository quick analysis expert...",
        "default": "Concise, high information density.",
        "gentle": "Friendly, encouraging exploration.",
        "strict": "Clearly mark pitfalls and non-recommendations.",
        "sarcastic": "Use humor to point out hype.",
        "casual": "Like casually recommending in a tech group.",
    }
}
```

用户可以在设置中选择说话风格。