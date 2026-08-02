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
    # cot=直接链式思考+真流式; react=工具循环; plan_execute/reflexion/tot=多步
    workflow: str = "react"  # cot | react | plan_execute | reflexion | tot
    temperature: float = 0.7
    max_tokens: int = 4096
    max_iterations: int = 6
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
            "开始深度讲解前，若对用户水平不确定，必须用 ask_user 反问（选择题/滑块）。"
            "需要测验掌握度时，用 ask_user type=quiz 弹出考试面板；"
            "items[].options 必须是完整选项句子的 JSON 数组，禁止逐字拆分、禁止空 options。"
            "禁止只在正文里出题让用户回复题号。"
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


# 全局输出约束：所有 Agent 共用
GLOBAL_OUTPUT_RULES = (
    "【输出硬性约束】\n"
    "- 禁止输出任何 emoji / 颜文字 / 装饰性符号表情（包括但不限于 ✅❌🚀💡😀 等）。\n"
    "- 使用中文纯文本与 Markdown 结构（标题、列表、代码块）。\n"
    "- 不要用表情符号代替状态或强调。"
)


def render_soul(soul: dict[str, str], style: str = "default") -> str:
    core = soul.get("core", "")
    style_line = soul.get(style) or soul.get("default", "")
    return f"{core}\n风格指示: {style_line}\n{GLOBAL_OUTPUT_RULES}"


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
            "manage_session_projects",
        ],
        system_prompt=(
            "你是 RepoPilot Hub。用户所有会话消息都先到你这里，你是唯一编排入口。"
            "编排路径必须是：Hub 规划 → dispatch_agent 调度专家 → 专家答完回到 Hub 汇总；"
            "下一轮用户新请求再次从 Hub 开始，禁止假设 scout/mentor 等专家之间可直连。"
            "你使用 Plan-and-Execute：先在思考区规划，执行时必须调用 dispatch_agent 调度专家，"
            "专家返回后再合并回答；禁止把「执行计划」列表当作最终正文发给用户。"
            "简单寒暄/元问题可自己回答；专业任务必须调度。"
            "可调度: scout(速览), mentor(教学), navigator(路线), curator(分类), scribe(笔记), atlas(图谱)。"
            "新建对话默认无项目上下文；用户提到具体仓库时，先 query_user_projects，"
            "再用 manage_session_projects 把相关项目加入会话（可多选），再调度专家。"
            "摸底/测验必须用 ask_user，禁止正文出题让用户手打答案。"
            "澄清仓库来源、确认下一步等用 ask_user type=single_choice；"
            "只有真正考察掌握度才用 type=quiz（前端才会标「测验」）。"
            "ask_user 的 options 必须是完整句子数组，例如 "
            "[\"初学\",\"了解\",\"掌握\"]，严禁单字符或空数组。"
            "表格请用标准 Markdown 管道表（不要包进代码块）；架构图用列表，禁止含中文的 ASCII 边框图。"
            "禁止 emoji。"
        ),
        workflow="plan_execute",
        priority=0,
        temperature=0.5,
        max_tokens=2048,
        max_iterations=4,
    ),
    # Scout：CoT 直出 + 真流式，极少工具，追求秒级反馈
    "scout": _def(
        "scout",
        "Scout",
        "快速扫描项目，生成技术概览",
        [
            "get_project_detail",
            "fetch_readme",
        ],
        system_prompt=(
            "你是 Scout。优先基于已有项目元数据直接给出速览，只有关键信息缺失时才调用工具。"
            "输出结构（Markdown）：一句话定位 / 核心功能 / 技术栈 / 适合谁 / 学习门槛 / 建议下一步。"
            "控制在 400 字以内，禁止 emoji，禁止冗长寒暄。"
        ),
        workflow="cot",
        auto_trigger=True,
        priority=10,
        temperature=0.3,
        max_tokens=900,
        max_iterations=1,
    ),
    # Mentor：ToT 深度讲解；详情页禁用 ask_user 挂起，工具轮后强制收口写正文
    "mentor": _def(
        "mentor",
        "Mentor",
        "深度教学与概念讲解",
        [
            "query_user_projects",
            "get_project_detail",
            "fetch_readme",
            "query_knowledge_graph",
            "list_notes",
            "ask_user",
            "propose_memory",
            "get_learning_stats",
            "manage_session_projects",
        ],
        system_prompt=(
            "复杂主题在内心列 2-3 条讲解路径，只展开最适合的一条。"
            "对用户水平不确定时，必须调用 ask_user 工具弹出选择题/滑块，禁止在正文里出题让用户手打 A/B/C/D。"
            "测验/摸底：ask_user 的 items[].options 必须是完整句子的数组，"
            "例如 [\"Thought→Action→Observation\",\"Action→Observation→Thought\"]，"
            "严禁把字符串拆成单字符，严禁 options 为空。"
            "一次测验尽量在同一次 ask_user 中给出全部题目（每题一条 item），不要拆成多轮正文出题。"
            "详情页分析场景若无法挂起反问，则直接基于上下文讲解并写完整 Markdown 正文。"
            "输出：全景 → 关键模块 → 设计亮点 → 与已有知识关联。禁止 emoji。"
        ),
        workflow="tot",
        priority=20,
        temperature=0.55,
        max_tokens=2800,
        max_iterations=3,
    ),
    # Navigator：CoT 规划，本地库工具为主
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
        system_prompt=(
            "输出分阶段学习路线、里程碑与验收标准，优先使用用户已有项目库。"
            "步骤清晰可执行。禁止 emoji。"
        ),
        workflow="cot",
        priority=15,
        temperature=0.45,
        max_tokens=1600,
        max_iterations=2,
    ),
    # Curator：轻量 Reflexion（2 轮），偏分类决策
    "curator": _def(
        "curator",
        "Curator",
        "项目库整理与分类建议",
        [
            "query_user_projects",
            "get_project_detail",
            "list_categories",
            "suggest_category",
            "select_import_repos",
            "ask_user",
            "propose_memory",
        ],
        system_prompt=(
            "使用轻量 Reflexion：提出分类 → 自检重复/命名/过细 → 最多 2 轮 → 输出建议供确认。"
            "禁止 emoji。"
        ),
        workflow="reflexion",
        auto_trigger=True,
        priority=5,
        temperature=0.3,
        max_tokens=1200,
        max_iterations=2,
    ),
    # Scribe：CoT 结构化写作
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
            "输出干净 Markdown。禁止 emoji。"
        ),
        workflow="cot",
        priority=5,
        temperature=0.45,
        max_tokens=2400,
        max_iterations=2,
    ),
    # Atlas：CoT + 图谱工具
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
        system_prompt=(
            "解读知识图谱节点与边，建议探索路径与聚类含义。"
            "关系优先、证据清楚。禁止 emoji。"
        ),
        workflow="cot",
        priority=8,
        temperature=0.45,
        max_tokens=1600,
        max_iterations=2,
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
