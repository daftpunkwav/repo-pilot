"""Hub 汇总模式：禁止再调度、专家摘要截断"""
from backend.agents.hub import HubService, _clip_expert_text, apply_merge_mode
from backend.agents.registry import AGENT_DEFINITIONS


def test_clip_expert_text_short():
    assert _clip_expert_text("hello") == "hello"


def test_clip_expert_text_long():
    raw = "x" * 13000
    out = _clip_expert_text(raw, limit=100)
    assert out.endswith("…(已截断)")
    assert len(out) == 100 + len("\n…(已截断)")


def test_merge_prompt_forbids_redispatch():
    prompt = HubService._merge_prompt(["[mentor] 路径内容"], "想学 langchain")
    assert "禁止再调度" in prompt
    assert "dispatch_agent" in prompt
    assert "想学 langchain" in prompt
    assert "[mentor] 路径内容" in prompt


def test_apply_merge_mode_disables_plan_execute_and_tools():
    hub = AGENT_DEFINITIONS["hub"]
    assert hub.workflow == "plan_execute"
    assert "dispatch_agent" in hub.tools
    merged = apply_merge_mode(hub)
    assert merged.workflow == "cot"
    assert merged.tools == []
    assert merged.max_iterations == 1
    assert "禁止" in (merged.system_prompt or "")
    # 原定义不被就地修改
    assert hub.workflow == "plan_execute"
    assert "dispatch_agent" in hub.tools
