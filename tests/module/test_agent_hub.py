"""Agent Hub 模块测试"""
from backend.agents.hub import route_message


async def test_hub_route_message():
    reply = await route_message("hello", session_id="s1")
    assert "hello" in reply
