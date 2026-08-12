"""图谱适配层与流水线纯函数测试。"""
from __future__ import annotations

import asyncio
import os
import subprocess
from pathlib import Path

import pytest
from api_backend.services.index_data_adapter import adapt_layout
from graph_engine_runtime.index_pipeline import (
    _git_shallow_clone,
    engine_project_name,
    parse_github_owner_repo,
)


def test_parse_github_owner_repo():
    assert parse_github_owner_repo("https://github.com/foo/bar") == ("foo", "bar")
    assert parse_github_owner_repo("https://github.com/foo/bar.git") == ("foo", "bar")
    assert parse_github_owner_repo("git@github.com:acme/demo.git") == ("acme", "demo")


def test_engine_project_name():
    name = engine_project_name("Foo Org", "my repo!")
    assert name.startswith("rp-")
    assert " " not in name


def test_adapt_layout_maps_nodes_and_edges():
    raw = {
        "nodes": [
            {
                "id": 1,
                "x": 10,
                "y": 20,
                "z": 30,
                "label": "Function",
                "name": "hello",
                "file_path": "a.py",
                "qualified_name": "mod.hello",
                "size": 2,
                "color": "#00ff00",
                "status": "normal",
                "in_calls": 3,
            }
        ],
        "edges": [{"source": 1, "target": 1, "type": "CALLS"}],
        "total_nodes": 100,
    }
    data = adapt_layout(raw)
    assert data.stats.node_count == 1
    assert data.stats.total_nodes == 100
    assert data.nodes[0].kind == "Function"
    assert data.nodes[0].qualified_name == "mod.hello"
    assert data.edges[0].relation == "CALLS"
    assert data.edges[0].source == "1"


def test_parse_invalid_url_raises():
    with pytest.raises(ValueError):
        parse_github_owner_repo("https://example.com/not-github")


def test_git_shallow_clone_token_not_in_cmdline_and_helper_works(
    monkeypatch, tmp_path: Path
):
    """SEC-003 回归：token 只经 env 注入，绝不进入命令行；内联 credential helper
    语法在本机 git（Windows 含 Git for Windows 默认 manager helper）下可用。

    用 monkeypatch 拦截 _run_cmd 记录命令；helper 语法用 `git credential fill`
    离线验证（不联网，免 PAT/私有仓依赖）。
    """
    dest = tmp_path / "repo"
    url = "https://github.com/octocat/Hello-World"
    captured: dict = {}

    async def _fake_run_cmd(cmd, *, check=True, env=None):
        captured["cmd"] = cmd
        captured["env"] = env
        raise AssertionError("测试不应真正执行 git clone")

    monkeypatch.setattr("graph_engine_runtime.index_pipeline._run_cmd", _fake_run_cmd)

    with pytest.raises(AssertionError):
        asyncio.run(_git_shallow_clone(url, dest, token="ghp_TEST_TOKEN"))

    cmd = captured["cmd"]
    assert cmd, "应已构造 clone 命令"
    joined = " ".join(cmd)
    assert "ghp_TEST_TOKEN" not in joined, "token 不得进入命令行参数"

    # -c 是累加语义：必须先在注入内联 helper 前清空系统级 helper
    # （Git for Windows 默认 credential.helper=manager，不清空会先问 manager
    #  导致非交互 clone 挂起）
    helper_entry = [c for c in cmd if c.startswith("credential.helper=!f()")]
    assert len(helper_entry) == 1, "应注入唯一的内联 credential helper"
    idx = cmd.index(helper_entry[0])
    assert cmd.index("credential.helper=") < idx, "注入前必须先清空既有 helper"

    # helper 语法离线可用性验证（git credential fill 不联网）
    helper = helper_entry[0].removeprefix("credential.helper=")
    payload = "protocol=https\nhost=github.com\n\n"
    got = subprocess.run(
        [
            "git",
            "-c",
            "credential.helper=",
            "-c",
            f"credential.helper={helper}",
            "credential",
            "fill",
        ],
        input=payload,
        capture_output=True,
        text=True,
        timeout=30,
        env={**os.environ, "RP_GRAPH_GIT_TOKEN": "ghp_TEST_TOKEN"},
    )
    assert got.returncode == 0, f"credential fill 失败: {got.stderr}"
    assert "username=x-access-token" in got.stdout
    assert "password=ghp_TEST_TOKEN" in got.stdout


def test_git_shallow_clone_anonymous_no_helper(monkeypatch, tmp_path: Path):
    """匿名 clone（无 token）不进 credential helper 分支。"""
    dest = tmp_path / "repo"
    captured: dict = {}

    async def _fake_run_cmd(cmd, *, check=True, env=None):
        captured["cmd"] = cmd
        raise AssertionError("测试不应真正执行 git clone")

    monkeypatch.setattr("graph_engine_runtime.index_pipeline._run_cmd", _fake_run_cmd)

    with pytest.raises(AssertionError):
        asyncio.run(_git_shallow_clone("https://github.com/octocat/Hello-World", dest))

    assert "credential.helper" not in " ".join(captured["cmd"])
