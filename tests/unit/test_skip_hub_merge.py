"""Hub 单专家直出 / 多专家汇总"""
from backend.agents.hub import format_dispatch_announce, should_skip_hub_merge


def test_skip_merge_single_expert_any_length():
    assert should_skip_hub_merge([("scout", "短")]) is True
    assert should_skip_hub_merge([("scout", "x" * 300)]) is True


def test_keep_merge_for_multi_experts():
    body = "x" * 300
    assert should_skip_hub_merge([("scout", body), ("mentor", body)]) is False


def test_skip_merge_empty():
    assert should_skip_hub_merge([]) is False


def test_format_dispatch_announce():
    text = format_dispatch_announce(
        {
            "target_agent": "mentor",
            "task": "讲解 Codex 源码架构",
            "reason": "用户要深度讲解",
        }
    )
    assert "Mentor" in text
    assert "深度讲解" in text
    assert "Codex" in text
