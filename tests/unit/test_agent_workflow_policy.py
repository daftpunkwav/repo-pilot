"""Agent 工作流策略：速度档位与 CoT 流式路径"""
from backend.agents.react import ReActEngine
from backend.agents.registry import AGENT_DEFINITIONS, GLOBAL_OUTPUT_RULES, render_soul


def test_scout_is_cot_fast_lane():
    scout = AGENT_DEFINITIONS["scout"]
    assert scout.workflow == "cot"
    assert scout.max_iterations == 1
    assert scout.max_tokens <= 1024
    # 工具应极少，避免 ReAct 多轮
    assert len(scout.tools) <= 3


def test_mentor_tot_bounded_iterations():
    mentor = AGENT_DEFINITIONS["mentor"]
    assert mentor.workflow == "tot"
    assert mentor.max_iterations <= 3


def test_no_emoji_rule_in_soul():
    text = render_soul(AGENT_DEFINITIONS["scout"].soul, "default")
    assert "emoji" in text.lower() or "表情" in text
    assert "禁止" in GLOBAL_OUTPUT_RULES


def test_prefer_token_stream_for_cot():
    engine = ReActEngine()
    scout = AGENT_DEFINITIONS["scout"]
    assert engine._prefer_token_stream(scout, tools=[]) is True
    # 有工具的 react 默认不走入口真流式（工具轮非流式）
    hub = AGENT_DEFINITIONS["hub"]
    assert engine._prefer_token_stream(hub, tools=[{"type": "function"}]) is False


def test_effective_max_iter_uses_agent_def():
    engine = ReActEngine(max_iterations=8)
    scout = AGENT_DEFINITIONS["scout"]
    assert engine._effective_max_iter(scout) == 1
