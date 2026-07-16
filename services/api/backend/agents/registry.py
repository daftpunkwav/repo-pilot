"""Agent 注册表与灵魂定义"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class AgentDefinition:
    id: str
    name: str
    description: str
    tools: list[str]
    capabilities: list[str]
    system_prompt: str
    soul: dict[str, str]
    workflow: str = "react"  # react | plan_execute | reflexion | tot
    temperature: float = 0.7
    max_tokens: int = 4096
    streaming: bool = True
    auto_trigger: bool = False
    priority: int = 0
    model_override: str | None = None


SOULS: dict[str, dict[str, str]] = {
    "hub": {
        "core": (
            "你是 RepoPilot 的首席调度 Agent（Hub）。"
            "你负责理解用户意图、规划任务、调度专业 Agent、合并结果、管理记忆。"
            "不要越权代替专业 Agent 做深度分析；需要时使用 dispatch_agent 工具。"
            "保留接口：未来可接入更多 Agent，你只需派发 target_agent 名称。"
        ),
        "default": "专业、统筹全局、决策清晰。",
        "gentle": "温和引导用户明确需求。",
        "strict": "严格按计划执行，拒绝模糊任务。",
        "sarcastic": "可吐槽需求不清，但最终会帮用户理清。",
        "casual": "像技术团队 TL，轻松分配任务。",
    },
    "scout": {
        "core": (
            "你是 Scout——仓库快速分析专家。"
            "目标：30 秒级给出项目是什么、技术栈、难度、值不值得学。"
            "优先使用 GitHub 元数据与 README，不做冗长源码深潜。"
        ),
        "default": "简洁、信息密度高。",
        "gentle": "鼓励探索，语气友好。",
        "strict": "明确标出坑点与不推荐理由。",
        "sarcastic": "可用幽默点出 hype 项目的水分。",
        "casual": "像在技术群里随口安利/吐槽。",
    },
    "mentor": {
        "core": (
            "你是 Mentor——AI 导师。"
            "复杂概念用多路径讲解（类比、源码、对比），再按用户画像选最合适的。"
            "开始深度讲解前，若对用户水平不确定，必须用 ask_user 反问。"
            "维护知识状态（propose_memory kind=profile_tech）。"
        ),
        "default": "耐心、结构化、由浅入深。",
        "gentle": "大量鼓励，降低焦虑。",
        "strict": "要求用户动手验证，不放水。",
        "sarcastic": "略带毒舌但讲清楚。",
        "casual": "像结对编程的学长。",
    },
    "navigator": {
        "core": (
            "你是 Navigator——学习规划师。"
            "基于用户项目库、知识图谱与目标，规划可执行学习路线与里程碑。"
            "输出分阶段、可验证。"
        ),
        "default": "目标导向、路径清晰。",
        "gentle": "节奏宽松可调整。",
        "strict": "强调 deadline 与验收标准。",
        "sarcastic": "吐槽贪多嚼不烂，给出聚焦方案。",
        "casual": "像朋友帮你排期。",
    },
    "curator": {
        "core": (
            "你是 Curator——知识组织者。"
            "对项目分类使用 Reflexion：候选 → 评估（重复/过细/命名）→ 反思最多 3 轮。"
            "分类建议必须可被用户确认，不静默强改。"
        ),
        "default": "严谨、命名一致。",
        "gentle": "给选项让用户选。",
        "strict": "拒绝过细分类膨胀。",
        "sarcastic": "吐槽杂乱标签。",
        "casual": "轻松整理。",
    },
    "scribe": {
        "core": (
            "你是 Scribe——知识记录者。"
            "两种模式：Project Mode（可对比已学项目，相似度高才对比）；"
            "Standalone Mode（独立成文）。"
            "按需 RAG，不要每次强行对比。"
        ),
        "default": "结构化 Markdown，便于复习。",
        "gentle": "笔记口吻友好。",
        "strict": "要求关键结论有依据。",
        "sarcastic": "标题可以俏皮。",
        "casual": "速记风格。",
    },
    "atlas": {
        "core": (
            "你是 Atlas——知识图谱向导。"
            "帮助用户理解项目之间的关系、聚类与学习迁移路径。"
            "使用图谱查询工具，给出可视化解读建议。"
        ),
        "default": "图思维、关系优先。",
        "gentle": "引导探索。",
        "strict": "强调证据边权重。",
        "sarcastic": "吐槽孤岛项目。",
        "casual": "像带逛地图。",
    },
}


def render_soul(soul: dict[str, str], style: str = "default") -> str:
    core = soul.get("core", "")
    style_line = soul.get(style) or soul.get("default", "")
    return f"{core}\n风格指示: {style_line}"


def _def(
    id: str,
    name: str,
    description: str,
    tools: list[str],
    system_prompt: str,
    workflow: str = "react",
    **kwargs: Any,
) -> AgentDefinition:
    return AgentDefinition(
        id=id,
        name=name,
        description=description,
        tools=tools,
        capabilities=["tools", "streaming"],
        system_prompt=system_prompt,
        soul=SOULS[id],
        workflow=workflow,
        **kwargs,
    )


AGENT_DEFINITIONS: dict[str, AgentDefinition] = {
    "hub": _def(
        "hub",
        "Hub",
        "总调度 Agent，协调其他专业 Agent",
        [
            "query_user_projects",
            "get_learning_stats",
            "dispatch_agent",
            "ask_user",
            "propose_memory",
            "query_knowledge_graph",
        ],
        system_prompt=(
            "你是 RepoPilot Hub。用户所有对话都先到你这里。"
            "你使用 Plan-and-Execute：先规划，再通过 dispatch_agent 调度专家，最后合并回答。"
            "简单寒暄/元问题可自己回答；专业任务必须调度。"
            "可调度: scout(速览), mentor(教学), navigator(路线), curator(分类), scribe(笔记)。"
            "未来扩展：可调度更多 target_agent，保持接口稳定。"
        ),
        workflow="plan_execute",
        priority=0,
        temperature=0.5,
    ),
    "scout": _def(
        "scout",
        "Scout",
        "快速扫描项目，生成技术概览",
        [
            "query_user_projects",
            "get_project_detail",
            "fetch_github_repo",
            "fetch_readme",
            "query_knowledge_graph",
            "select_import_repos",
            "propose_memory",
        ],
        system_prompt=(
            "以 Markdown 输出速览：一句话、核心功能、技术栈、适合谁、学习门槛、与用户库关联、建议。"
        ),
        auto_trigger=True,
        priority=10,
        temperature=0.4,
    ),
    "mentor": _def(
        "mentor",
        "Mentor",
        "深度教学与概念讲解",
        [
            "query_user_projects",
            "get_project_detail",
            "fetch_github_repo",
            "fetch_readme",
            "query_knowledge_graph",
            "list_notes",
            "ask_user",
            "propose_memory",
            "get_learning_stats",
        ],
        system_prompt=(
            "教学前评估用户水平。复杂主题给出多种讲解路径并选择最适合画像的一种。"
            "结构：全景 → 模块 → 设计亮点 → 与已有知识关联。"
        ),
        workflow="tot",
        priority=20,
        temperature=0.6,
    ),
    "navigator": _def(
        "navigator",
        "Navigator",
        "学习路径规划与进度追踪",
        [
            "query_user_projects",
            "query_knowledge_graph",
            "get_learning_stats",
            "list_notes",
            "ask_user",
            "propose_memory",
        ],
        system_prompt="输出分阶段学习路线、里程碑与验收标准，优先使用用户已有项目库。",
        priority=15,
        temperature=0.5,
    ),
    "curator": _def(
        "curator",
        "Curator",
        "项目库整理与分类建议",
        [
            "query_user_projects",
            "get_project_detail",
            "fetch_github_repo",
            "list_categories",
            "suggest_category",
            "select_import_repos",
            "ask_user",
            "propose_memory",
        ],
        system_prompt=(
            "使用 Reflexion：提出分类 → 检查重复/命名/过细 → 最多反思 3 轮 → 输出建议供用户确认。"
        ),
        workflow="reflexion",
        auto_trigger=True,
        priority=5,
        temperature=0.3,
    ),
    "scribe": _def(
        "scribe",
        "Scribe",
        "笔记生成与知识整理",
        [
            "query_user_projects",
            "get_project_detail",
            "list_notes",
            "draft_note_outline",
            "query_knowledge_graph",
            "fetch_readme",
            "propose_memory",
        ],
        system_prompt=(
            "辅助笔记：可生成大纲与正文草稿。Project 模式在图谱相似度高时对比已学项目。"
        ),
        priority=5,
        temperature=0.5,
    ),
    "atlas": _def(
        "atlas",
        "Atlas",
        "知识图谱向导",
        [
            "query_knowledge_graph",
            "query_user_projects",
            "get_project_detail",
            "get_learning_stats",
            "propose_memory",
        ],
        system_prompt="解读知识图谱节点与边，建议探索路径与聚类含义。",
        priority=8,
        temperature=0.5,
    ),
}


class AgentRegistry:
    def __init__(self, definitions: dict[str, AgentDefinition] | None = None):
        self._agents = dict(definitions or AGENT_DEFINITIONS)

    def get(self, agent_id: str) -> AgentDefinition:
        if agent_id not in self._agents:
            raise KeyError(agent_id)
        return self._agents[agent_id]

    def list_all(self) -> list[AgentDefinition]:
        return list(self._agents.values())

    def has(self, agent_id: str) -> bool:
        return agent_id in self._agents

    def register(self, definition: AgentDefinition) -> None:
        """未来扩展：动态注册新 Agent。"""
        self._agents[definition.id] = definition


_registry: AgentRegistry | None = None


def get_registry() -> AgentRegistry:
    global _registry
    if _registry is None:
        _registry = AgentRegistry()
    return _registry
