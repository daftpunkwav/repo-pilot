"""Hub 评估轮：可再调度、去重与上限"""
import pytest

from backend.agents.hub import (
    MAX_HUB_DISPATCH_ROUNDS,
    HubService,
    _dispatch_fingerprint,
    apply_evaluate_mode,
    apply_merge_mode,
)
from backend.agents.registry import AGENT_DEFINITIONS


def test_apply_evaluate_mode_keeps_dispatch_only():
    hub = AGENT_DEFINITIONS["hub"]
    evaluated = apply_evaluate_mode(hub)
    assert evaluated.workflow == "react"
    assert evaluated.tools == ["dispatch_agent", "ask_user"]
    assert evaluated.max_iterations == 2
    assert evaluated.max_tokens <= 3200
    assert "评估" in (evaluated.system_prompt or "")
    assert "禁止编造" in (evaluated.system_prompt or "")
    # 原定义不被就地修改
    assert hub.workflow == "plan_execute"
    assert "query_user_projects" in hub.tools


def test_evaluate_and_merge_modes_are_distinct():
    hub = AGENT_DEFINITIONS["hub"]
    evaluated = apply_evaluate_mode(hub)
    merged = apply_merge_mode(hub)
    assert "dispatch_agent" in evaluated.tools
    assert merged.tools == []
    assert merged.workflow == "direct"


def test_dispatch_fingerprint_dedupes_similar_tasks():
    a = {"target_agent": "Mentor", "task": "解释  Godot  场景树"}
    b = {"target_agent": "mentor", "task": "解释 Godot 场景树"}
    c = {"target_agent": "scout", "task": "解释 Godot 场景树"}
    assert _dispatch_fingerprint(a) == _dispatch_fingerprint(b)
    assert _dispatch_fingerprint(a) != _dispatch_fingerprint(c)


def test_evaluate_prompt_includes_summaries():
    prompt = HubService._evaluate_prompt(
        ["[mentor] 已讲场景树"], "Godot 依赖关系", 0
    )
    assert "评估任务" in prompt
    assert "[mentor] 已讲场景树" in prompt
    assert "Godot 依赖关系" in prompt
    assert "dispatch_agent" in prompt


def test_max_hub_dispatch_rounds_is_bounded():
    assert MAX_HUB_DISPATCH_ROUNDS == 2


@pytest.mark.asyncio
async def test_dispatch_evaluate_loop_hub_passthrough_skips_rewrite(monkeypatch):
    """单专家 Hub 舞台直出后，不再评估重写、不切回 Hub。"""
    from backend.agents.react import EngineResult

    service = HubService.__new__(HubService)
    service.registry = type(
        "R", (), {"has": staticmethod(lambda aid: True)}
    )()
    memory_calls: list = []

    class Mem:
        async def append_short_memory(self, *args, **kwargs):
            memory_calls.append(True)

    service.memory = Mem()
    eval_calls = {"n": 0}

    async def fake_handle_dispatches(**kwargs):
        bag = kwargs.get("result_bag")
        if bag is not None:
            bag["summaries"] = ["[mentor] 长文"]
            bag["expert_results"] = [("mentor", "长文")]
            bag["direct_streamed"] = True
            bag["hub_passthrough"] = True
            bag["had_question"] = False
        if False:
            yield ""
        return
        yield  # pragma: no cover

    async def fake_run_agent(**kwargs):
        if kwargs.get("evaluate_mode"):
            eval_calls["n"] += 1
        yield EngineResult(text="不应走到", dispatches=[])

    monkeypatch.setattr(service, "_handle_dispatches", fake_handle_dispatches)
    monkeypatch.setattr(service, "_run_agent", fake_run_agent)

    chunks: list[str] = []
    async for chunk in service._dispatch_evaluate_loop(
        dispatches=[
            {
                "target_agent": "mentor",
                "task": "讲 Godot",
                "reason": "教学",
            }
        ],
        user=type("U", (), {"id": "u1"})(),
        session_id="s1",
        original_message="想学 Godot",
        llm=None,
        llm_config=None,
        raw_settings={},
        permissions={},
        project_id=None,
        history=[],
        hub_preamble="",
    ):
        chunks.append(chunk)

    joined = "".join(chunks)
    assert eval_calls["n"] == 0
    assert "评估专家结果" not in joined
    assert "skip_merge" in joined or "event: done" in joined
    assert memory_calls

    service.registry = type(
        "R",
        (),
        {
            "has": staticmethod(lambda aid: aid in {"mentor", "scout", "atlas"}),
        },
    )()
    memory_calls: list[dict] = []

    class Mem:
        async def append_short_memory(self, *args, **kwargs):
            memory_calls.append({"args": args, "kwargs": kwargs})

    service.memory = Mem()

    # 专家批次：只填充 bag，不 finalize
    async def fake_handle_dispatches(**kwargs):
        bag = kwargs.get("result_bag")
        dispatches = kwargs["dispatches"]
        if bag is not None:
            summaries = []
            results = []
            for d in dispatches:
                t = d["target_agent"]
                summaries.append(f"[{t}] ok")
                results.append((t, "ok"))
            bag["summaries"] = summaries
            bag["expert_results"] = results
            bag["direct_streamed"] = (
                len(dispatches) == 1 and not kwargs.get("force_subagent")
            )
            bag["had_question"] = False
        if False:  # 保持 async generator
            yield ""
        return
        yield  # pragma: no cover

    eval_calls = {"n": 0}
    merge_calls = {"n": 0}

    async def fake_run_agent(**kwargs):
        if kwargs.get("evaluate_mode"):
            eval_calls["n"] += 1
            n = eval_calls["n"]
            if n == 1:
                # 第一批后：再调 atlas
                yield EngineResult(
                    text="",
                    dispatches=[
                        {
                            "target_agent": "atlas",
                            "task": "补依赖图",
                            "reason": "缺口",
                        }
                    ],
                )
            elif n < MAX_HUB_DISPATCH_ROUNDS:
                # 继续尝试再调度（测上限）
                yield EngineResult(
                    text="",
                    dispatches=[
                        {
                            "target_agent": "scout",
                            "task": f"再扫一轮 {n}",
                            "reason": "仍不足",
                        }
                    ],
                )
            else:
                yield EngineResult(text="", dispatches=[])
            return
        if kwargs.get("merge_mode"):
            merge_calls["n"] += 1
            yield "event: text_delta\ndata: {\"content\":\"合并答复\"}\n\n"
            yield EngineResult(text="合并答复", dispatches=[])
            return
        yield EngineResult(text="专家", dispatches=[])

    monkeypatch.setattr(service, "_handle_dispatches", fake_handle_dispatches)
    monkeypatch.setattr(service, "_run_agent", fake_run_agent)

    chunks: list[str] = []
    async for chunk in service._dispatch_evaluate_loop(
        dispatches=[
            {"target_agent": "mentor", "task": "教场景树", "reason": "学习"}
        ],
        user=type("U", (), {"id": "u1"})(),
        session_id="s1",
        original_message="学 Godot",
        llm=None,
        llm_config=None,
        raw_settings={},
        permissions={},
        project_id=None,
        history=[],
        hub_preamble="",
    ):
        chunks.append(chunk)

    assert eval_calls["n"] >= 2
    assert merge_calls["n"] == 1
    joined = "".join(chunks)
    assert "调度轮次上限" in joined or merge_calls["n"] == 1
