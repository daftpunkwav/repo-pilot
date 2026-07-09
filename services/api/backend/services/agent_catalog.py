"""Agent 目录常量 —— 与前端 agentCatalog 对齐"""
from backend.schemas.agent import AgentProfileOut

AGENT_PROFILES: list[AgentProfileOut] = [
    AgentProfileOut(
        id="hub",
        name="Hub",
        description="总调度 Agent，协调其他专业 Agent",
        avatar_emoji="🎯",
        capabilities=["路由", "任务分解", "多 Agent 协调"],
    ),
    AgentProfileOut(
        id="scout",
        name="Scout",
        description="快速扫描项目，生成技术概览",
        avatar_emoji="🔭",
        capabilities=["README 分析", "技术栈识别", "依赖图谱"],
    ),
    AgentProfileOut(
        id="mentor",
        name="Mentor",
        description="深度教学与概念讲解",
        avatar_emoji="📚",
        capabilities=["概念讲解", "对比分析", "练习题"],
    ),
    AgentProfileOut(
        id="navigator",
        name="Navigator",
        description="学习路径规划与进度追踪",
        avatar_emoji="🧭",
        capabilities=["路径规划", "里程碑", "进度建议"],
    ),
    AgentProfileOut(
        id="curator",
        name="Curator",
        description="项目库整理与分类建议",
        avatar_emoji="🗂️",
        capabilities=["分类", "标签", "去重"],
    ),
    AgentProfileOut(
        id="scribe",
        name="Scribe",
        description="笔记生成与知识整理",
        avatar_emoji="✍️",
        capabilities=["笔记生成", "知识整理", "摘要"],
    ),
]
