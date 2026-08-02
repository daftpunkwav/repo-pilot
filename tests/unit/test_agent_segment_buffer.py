"""按 Agent 分段缓冲落库辅助逻辑"""
import pytest

from backend.services.agent_service import _AgentSegmentBuffer


@pytest.mark.asyncio
async def test_segment_buffer_switch_flushes(monkeypatch):
    flushed: list[tuple[str, str]] = []

    async def fake_append(db, session, *, role, content, agent_id=None, **kw):
        flushed.append((agent_id or "?", content))
        return None

    monkeypatch.setattr(
        "backend.services.agent_service.append_message",
        fake_append,
    )

    buf = _AgentSegmentBuffer(agent_id="hub")
    buf.append_delta("hub 前言")
    await buf.switch_agent(None, type("S", (), {"active_agent": "hub"})(), "mentor")
    buf.append_delta("mentor 正文")
    await buf.flush(None, type("S", (), {"active_agent": "mentor"})())

    assert flushed == [("hub", "hub 前言"), ("mentor", "mentor 正文")]
