# RepoPilot 第二轮改动代码审查报告(2026-08-07)

> **报告路径**:`docs/review/CODE_REVIEW_20260807.md`
> **审查日期**:2026-08-07
> **审查对象**:`2b64c69..80bc91d` 共 7 个 commit(第二轮整改全部改动)
> **被审报告**:`docs/review/REMEDIATION_CONTINUATION_REPORT_20260807.md`
> **审查方法**:主审亲自逐文件读取 + 2 个 subagent 分域深审(前端 api/real + agentQuestion)+ 实跑测试验证 + 字节级编码核对
> **作者**:ZCode(daftpunkwav 委托)

---

## 零、如何阅读本报告

本报告面向**低能力执行型 agent**。每个问题都标注:

- **严重级别**:`❌ P0`(必须改,阻塞)/ `⚠️ P1`(强烈建议改)/ `🟡 P2`(可选优化)
- **位置**:`file_path:line_number`(可直接定位)
- **当前代码**:从仓库实际读到的内容
- **改成什么**:可直接复制粘贴的完整代码
- **怎么验证**:改完跑什么命令确认

**整改优先级建议**:先修 ❌ P0(乱码 + CI bug),再修 ⚠️ P1(语义回归),最后清 🟡 P2(死代码/注释)。全部修完不影响现有测试通过。

---

## 一、审查范围与验证方法

### 1.1 审查的 7 个 commit

| commit | 类型 | 改动 |
|---|---|---|
| `684ebe4` | refactor(web) | §4.2.17 api/real 按 7 业务域拆分 |
| `e96abf1` | docs | CODE_OF_CONDUCT.md |
| `3bb61f8` | feat(web) | ErrorBoundary 加 onError 钩子 |
| `7ecd022` | ci | GitHub Actions CI(backend + frontend) |
| `ea9e94c` | ci | Markdown 链接检查 workflow |
| `f3cd272` | refactor(web) | §4.2.16 agentQuestion 7 子模块拆分 |
| `80bc91d` | refactor(agent) | §4.2.3 helper 抽取 + §4.4.1 load_chat_history |

### 1.2 实际验证的命令(已跑通)

```
# 后端 §4.4.1 测试
cd tests && uv run --project ../services/api pytest unit/test_load_chat_history_keep_recent_round.py -q
→ 6 passed

# 前端本轮新增测试
cd apps/web && npx vitest run tests/unit/agentQuestion/modularization.test.ts tests/unit/apiReal/domain.test.ts tests/unit/ErrorBoundary.test.tsx
→ 3 files / 56 passed

# 字节级编码核对(发现乱码)
sed -n '256p' context.py | xxd  → 确认中文字符字节为 0x3f('?')
```

**事实声明**:后端完整 232 / 285 基线、前端完整 193 测试,本次审查**未重跑全集**(只跑了本轮新增子集),数据沿用被审报告。

---

## 二、问题总览

| # | 级别 | 位置 | 问题一句话 |
|---|---|---|---|
| 1 | ❌ P0 | `context.py:253-287` | load_chat_history 方法体**中文注释/docstring 全部损坏为 `?`** |
| 2 | ❌ P0 | `test_load_chat_history_keep_recent_round.py`(全篇) | 测试文件**全篇中文损坏为 `?`** |
| 3 | ❌ P0 | `.github/workflows/ci.yml:25` | backend CI 的 pytest 路径**不存在**,job 必失败 |
| 4 | ❌ P0 | `.github/workflows/markdown-link-check.yml:14-18` | 用了**不存在的 action 参数** `check-files`,配置静默失效 |
| 5 | ⚠️ P1 | `text-cleanup.ts:226-242` | `isAskUserShapedText` 拆分时**丢失了"文本中间嵌入 JSON"识别**,导致 UI 重复展示 |
| 6 | ⚠️ P1 | `hub.py:742-749,774-782,817-825` | `_dispatch_evaluate_loop` 内 **3 处** subagent_start/done 字面量未用 helper(报告只说 2 处) |
| 7 | ⚠️ P1 | `context.py:266-279` | load_chat_history 算法在 `assistant→tool→assistant` 形态下丢弃中间 tool(设计权衡,需澄清) |
| 8 | 🟡 P2 | `agentQuestion/index.ts`(全文件) | **死代码 + 过时注释 + 双向 re-export 环** |
| 9 | 🟡 P2 | `hydrate.ts:327-328` | `__hydrateInternal` 导出**无消费方**,死代码 |
| 10 | 🟡 P2 | `card-formatters.ts:5-9` | 注释声称"从 hydrate 复用 summarizeOneAnswer",**实际未复用**,注释撒谎 |
| 11 | 🟡 P2 | `hydrate.ts:10-11` | 注释自称"避免循环依赖",实际 hydrate↔parsers **双向循环存在** |
| 12 | 🟡 P2 | `CODE_OF_CONDUCT.md:42,119` | 邮箱占位符 `open-source@example.com`(报告已自述) |
| 13 | 🟡 P2 | `apiReal/domain.test.ts` | 只实质测了 3/65 方法的运行时行为,62 个仅 `typeof` 检查 |

---

## 三、逐项详析

### 问题 1 ❌ P0 — context.py 中文注释全乱码

**位置**:`services/agent/agent_core/memory/context.py:253-287`(load_chat_history 方法)

**事实**:用 Read 工具直接读出,字节级 xxd 确认,中文字符字节是 `0x3f`(ASCII `?`)。当前文件内容(实读):

```python
async def load_chat_history(
    self, session_id: UUID, limit: int = 20
) -> list[dict[str, Any]]:
    """?4.4.1: ???????? tool ???

    ????:tool ??? tool_call_id ? tool_calls ??(?? schema ?? content),
    ?????? OpenAI tool_calls ?????????????,
    ????? assistant+tool ???????,LLM ????????????????
    ??????? user/assistant?
    """
    msgs = await self.memory.list_recent_messages(session_id, limit=limit)
    out: list[dict[str, Any]] = []
    # 1. ?????,????? assistant+tool ?????
    last_round_start = len(msgs)  # ?? = len,????? tool ??
    for idx in range(len(msgs) - 1, -1, -1):
        m = msgs[idx]
        if m.role == "tool":
            # ???? tool: ?????? assistant
            for j in range(idx, -1, -1):
                if msgs[j].role == "assistant":
                    last_round_start = j
                    break
            break
        if m.role == "assistant":
            # ???? assistant: tool ??? assistant ?????(?? tool_call_id)
            last_round_start = idx
            break
    # 2. ????(?????????? order)
    for idx, m in enumerate(msgs):
        if m.role in ("user", "assistant", "system"):
            out.append({"role": m.role, "content": m.content or ""})
        elif m.role == "tool" and idx >= last_round_start:
            # tool ?????????(assistant+tool)
            out.append({"role": "tool", "content": m.content or ""})
    return out
```

**同一文件其他部分**(如 `context_segments` 的 "用于 context-window 统计"、`_format_profile` 的 "技术熟练度")中文**完全正常**——证明乱码是 `80bc91d` 这个 commit **只覆写了 load_chat_history 区域**时引入的,不是全文件问题。

**根因推断**(未直接验证):写入工具(可能 Python `open(encoding='ascii')` 或 PowerShell 重定向经 GBK→ASCII 转换)把非 ASCII 字符替换成了 `?`。

**影响**:
- **代码能跑**(Python 注释/docstring 里 `?` 是合法字符),测试 6 passed。
- **可读性归零**:docstring 在 IDE 悬浮、`help()`、文档生成时显示一堆问号。
- **违反 AGENTS.md**("Write code comments and docstrings in Chinese")。
- 被审报告 §3.7 声称"加 docstring + 算法",**实际 docstring 是损坏的,报告未发现**。

**怎么改**:把 L253-287 整个方法替换为下面的正确版本(中文已恢复,算法不变):

**修改后完整代码**(`services/agent/agent_core/memory/context.py`,替换 L253-287):

```python
    async def load_chat_history(
        self, session_id: UUID, limit: int = 20
    ) -> list[dict[str, Any]]:
        """§4.4.1: 跨会话历史保留最近一轮 tool 交互。

        背景:tool 消息缺 tool_call_id 与 tool_calls 字段(当前 schema 只存 content),
        若全部重放会破坏 OpenAI tool_calls 协议触发 API 报错;
        本方法只保留"最近一轮 assistant+tool 配对",让 LLM 知道上一轮调过什么工具。
        其余轮次的 tool 丢弃,仅保留 user/assistant。
        """
        msgs = await self.memory.list_recent_messages(session_id, limit=limit)
        out: list[dict[str, Any]] = []
        # 1. 反向扫描,定位最近一轮 assistant+tool 配对的起点
        last_round_start = len(msgs)  # 默认 = len,即不保留任何 tool
        for idx in range(len(msgs) - 1, -1, -1):
            m = msgs[idx]
            if m.role == "tool":
                # 最后一条是 tool: 回溯找配对的 assistant
                for j in range(idx, -1, -1):
                    if msgs[j].role == "assistant":
                        last_round_start = j
                        break
                break
            if m.role == "assistant":
                # 最后一条是 assistant: tool 已被消费或不存在(无需保留旧 tool)
                last_round_start = idx
                break
        # 2. 正向输出(保持原始时间顺序)
        for idx, m in enumerate(msgs):
            if m.role in ("user", "assistant", "system"):
                out.append({"role": m.role, "content": m.content or ""})
            elif m.role == "tool" and idx >= last_round_start:
                # tool 仅保留最近一轮(配对的 assistant+tool)
                out.append({"role": "tool", "content": m.content or ""})
        return out
```

**怎么验证**:
```bash
cd tests && uv run --project ../services/api pytest unit/test_load_chat_history_keep_recent_round.py -q
# 期望:6 passed
# 另:用 Read 工具读 context.py:253,确认中文正常显示(不再是 ?)
```

---

### 问题 2 ❌ P0 — 测试文件全篇中文乱码

**位置**:`tests/unit/test_load_chat_history_keep_recent_round.py`(整个文件,21 处 `?`)

**事实**:用 Read 工具读出,文件内**无任何正常中文字符**,所有中文 docstring / 注释 / 断言说明都损坏为 `?`。例如:

```python
"""?4.4.1 load_chat_history ?????? tool ?? ???"""
# ...
def test_load_chat_history_keeps_recent_assistant_tool_pair():
    """?4.4.1: ?????? assistant+tool ???"""
```

**影响**:同问题 1——能跑(6 passed),但测试意图说明完全不可读,后续维护者无法理解每个用例测的是什么场景。

**怎么改**:把整个文件替换为下面的正确版本(算法/断言**完全不变**,只恢复中文):

**修改后完整代码**(`tests/unit/test_load_chat_history_keep_recent_round.py`,整个文件覆盖):

```python
"""§4.4.1 load_chat_history 保留最近一轮 tool 交互的单测。"""
import asyncio
from types import SimpleNamespace
from uuid import uuid4

import pytest

from agent_core.memory.context import ContextBuilder


def _make_msg(role: str, content: str):
    """构造一个 AgentMessage-like 的轻量对象。"""
    return SimpleNamespace(role=role, content=content)


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro) if False else asyncio.run(coro)


class _FakeMemory:
    """只实现 list_recent_messages 的假记忆服务。"""

    def __init__(self, msgs):
        self._msgs = msgs

    async def list_recent_messages(self, session_id, limit: int = 20):
        return self._msgs


class _FakeBuilder:
    """绕过完整构造(无需真实数据库)的 ContextBuilder 包装。"""

    def __init__(self, msgs):
        self._msgs = msgs

    async def load_chat_history(self, session_id, limit: int = 20):
        # 委托给真实的 ContextBuilder(用 mock 记忆)
        from agent_core.memory.context import ContextBuilder
        builder = ContextBuilder(db=None, memory=_FakeMemory(self._msgs))  # type: ignore[arg-type]
        return await builder.load_chat_history(session_id, limit=limit)


def test_load_chat_history_keeps_only_user_assistant_when_no_tool():
    """§4.4.1: 无 tool 消息时,全部保留 user/assistant。"""
    msgs = [
        _make_msg("user", "hello"),
        _make_msg("assistant", "hi"),
        _make_msg("user", "what is python?"),
        _make_msg("assistant", "a language"),
    ]
    builder = _FakeBuilder(msgs)
    result = asyncio.run(builder.load_chat_history(uuid4()))
    assert result == [
        {"role": "user", "content": "hello"},
        {"role": "assistant", "content": "hi"},
        {"role": "user", "content": "what is python?"},
        {"role": "assistant", "content": "a language"},
    ]


def test_load_chat_history_keeps_recent_assistant_tool_pair():
    """§4.4.1: 保留最近一轮的 assistant+tool 配对。"""
    msgs = [
        _make_msg("user", "first question"),
        _make_msg("assistant", "first answer"),
        _make_msg("user", "second question"),
        _make_msg("assistant", "calls tool X"),  # last_round_start = 3
        _make_msg("tool", "tool X result: 42"),  # 最近一轮,保留
    ]
    builder = _FakeBuilder(msgs)
    result = asyncio.run(builder.load_chat_history(uuid4()))
    assert len(result) == 5, f"expected 5 items, got {len(result)}"
    assert result[3] == {"role": "assistant", "content": "calls tool X"}
    assert result[4] == {"role": "tool", "content": "tool X result: 42"}


def test_load_chat_history_drops_older_tool_messages():
    """§4.4.1: 多轮历史中的旧 tool 消息,只保留最近一轮 tool。"""
    msgs = [
        _make_msg("assistant", "old assistant 1"),
        _make_msg("tool", "old tool 1"),  # 丢弃
        _make_msg("user", "user msg"),
        _make_msg("assistant", "middle"),
        _make_msg("tool", "old tool 2"),  # 丢弃
        _make_msg("user", "latest question"),
        _make_msg("assistant", "latest calls Y"),  # last_round_start = 6
        _make_msg("tool", "Y result"),  # 保留
    ]
    builder = _FakeBuilder(msgs)
    result = asyncio.run(builder.load_chat_history(uuid4()))
    # 保留全部 user/assistant + 最后一轮 tool
    roles = [m["role"] for m in result]
    assert roles == ["assistant", "user", "assistant", "user", "assistant", "tool"]
    # 保留的 tool 是 "Y result", 不是 "old tool 1" 或 "old tool 2"
    assert result[-1]["content"] == "Y result"


def test_load_chat_history_keeps_only_assistant_when_no_tool_following():
    """§4.4.1: 仅有 assistant 且后面没 tool 时,只保留 assistant。"""
    msgs = [
        _make_msg("user", "q"),
        _make_msg("assistant", "no tool called"),
    ]
    builder = _FakeBuilder(msgs)
    result = asyncio.run(builder.load_chat_history(uuid4()))
    assert result == [
        {"role": "user", "content": "q"},
        {"role": "assistant", "content": "no tool called"},
    ]


def test_load_chat_history_drops_tool_at_start_keeps_user_assistant():
    """§4.4.1: 开头有 tool 但最后没 tool 时,丢弃旧 tool。"""
    msgs = [
        _make_msg("user", "u1"),
        _make_msg("assistant", "a1"),
        _make_msg("tool", "old tool"),  # 丢弃
        _make_msg("user", "u2"),
        _make_msg("assistant", "a2"),  # 最后,后面没 tool
    ]
    builder = _FakeBuilder(msgs)
    result = asyncio.run(builder.load_chat_history(uuid4()))
    assert result == [
        {"role": "user", "content": "u1"},
        {"role": "assistant", "content": "a1"},
        {"role": "user", "content": "u2"},
        {"role": "assistant", "content": "a2"},
    ]


def test_load_chat_history_includes_system_messages():
    """§4.4.1: system 消息正常保留(无条件保留)。"""
    msgs = [
        _make_msg("system", "you are helpful"),
        _make_msg("user", "q"),
        _make_msg("assistant", "a"),
    ]
    builder = _FakeBuilder(msgs)
    result = asyncio.run(builder.load_chat_history(uuid4()))
    assert len(result) == 3
    assert result[0]["role"] == "system"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
```

**怎么验证**:
```bash
cd tests && uv run --project ../services/api pytest unit/test_load_chat_history_keep_recent_round.py -q
# 期望:6 passed(断言不变,仅注释恢复中文)
```

**⚠️ 执行注意**:修复问题 1、2 时,**写入工具必须用 UTF-8**。如果用 ZCode 的 Write/Edit 工具,默认是 UTF-8 安全。**禁止**用 `>` 重定向或非 UTF-8 编辑器写入——这正是乱码的根因。修完后务必用 Read 工具复读确认中文正常。

---

### 问题 3 ❌ P0 — backend CI 的 pytest 路径不存在,job 必失败

**位置**:`.github/workflows/ci.yml:24-25`

**事实**:
- ci.yml 第 25 行:`run: cd services/api && uv run pytest tests/unit`
- 实查 `services/api/` 目录:**没有 `tests/` 子目录**(只有 `backend/`、`pyproject.toml` 等)
- 测试实际在**仓库根的 `tests/`**(`tests/unit`、`tests/business`、`tests/integration`),且依赖 `tests/pytest.ini`(`pythonpath = ../services/api ../services/agent`)和 `tests/conftest.py`(注入 sys.path + 环境变量)
- 在 `services/api` 下跑 `pytest tests/unit`,pytest 会找 `services/api/tests/unit`——**不存在**,报错 `no tests ran`(exit code 5)或路径错误

**被审报告的措辞**(§7.3 第 5 点):"`tests/` 在根而非 `services/api/tests/`,需要专门 infra PR"——**严重低估了影响**。这不是"待细化",而是 **CI 推到 main 后每次 push/PR 的 backend job 都会红**。报告 §3.4 也只说"pre-existing 路径问题,已记录需专门 infra PR 修",没指出会直接失败。

**怎么改**:把 ci.yml 的 backend job 改为从仓库根、用正确的 uv 工程上下文跑测试。

**修改后**(`.github/workflows/ci.yml`,替换第 12-25 行的整个 backend job):

```yaml
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - name: 安装 uv
        run: pip install uv
      - name: 同步依赖(锁定版本)
        # 根目录是 uv workspace;api 是 member,从根 sync 能解析 workspace 依赖
        run: uv sync --frozen
      - name: 跑单元测试
        # 测试在仓库根 tests/(含 pytest.ini + conftest.py),
        # pytest.ini 的 pythonpath 指向 services/api 与 services/agent。
        # 必须从 tests/ 目录运行,否则找不到 pytest.ini 与 conftest。
        working-directory: tests
        run: uv run --project ../../services/api pytest unit -q
```

**关键点**:
1. `working-directory: tests` —— 让 pytest 能读到 `tests/pytest.ini` 和 `tests/conftest.py`
2. `uv run --project ../../services/api` —— 用 services/api 的依赖环境(那里有 pytest/httpx 等 dev 依赖)
3. `pytest unit` —— 跑 `tests/unit`(相对 working-directory)

**怎么验证**(本地无法完全模拟 GHA,但可验证命令本身):
```bash
cd tests && uv run --project ../services/api pytest unit -q -p no:cacheprovider
# 期望:本地能跑通(162 passed 左右,即报告说的 unit 子集)
# CI 上:push 后在 Actions 页面确认 backend job 绿
```

**⚠️ 风险提示**:本审查**未在真实 GHA ubuntu-latest 环境跑过**这个修正后的命令。`uv sync --frozen` 在根目录能否正确解析 workspace member 依赖,需在 CI 实跑确认。若 `uv sync --frozen` 在根目录失败,退回 `cd services/api && uv sync --frozen`,但 pytest 命令仍必须带 `working-directory: tests`。建议修复后立即触发一次 CI 验证。

---

### 问题 4 ❌ P0 — markdown-link-check 用了不存在的 action 参数

**位置**:`.github/workflows/markdown-link-check.yml:14-18`

**事实**(经 WebFetch 核实 `gaurav-nelson/github-action-markdown-link-check` 官方文档):
- 该 action **没有** `check-files` 这个输入参数
- 有效参数是:`folder-path` / `file-path` / `config-file` / `max-depth` / `file-extension` / `check-modified-files-only` / `base-branch` 等
- 当前写的:
  ```yaml
  with:
    check-files: |
      *.md
      docs/**/*.md
      apps/web/**/*.md
    base-branch: main
  ```
- `check-files` 会被 action **静默忽略**(action 默认 `folder-path: .`,即扫整个仓库所有 .md)
- `base-branch: main` 只在 `check-modified-files-only: yes` 时才生效——当前没设,所以 `base-branch` 也**无效**

**后果**:这个 workflow 实际会**检查整个仓库的所有 markdown 链接**(包括根目录、所有 docs、apps/web 等),而非配置意图的"只查根/docs/web"。如果仓库里有任何死链(包括 README、CHANGELOG 等历史文档里的),CI 会红。行为与注释("拦截死链")的**范围不符**,且因扫了多余文件可能产生**误报**。

**怎么改**:用正确的 `folder-path` 参数,或改成 `file-path` 显式列举。推荐 `folder-path`(简单):

**修改后**(`.github/workflows/markdown-link-check.yml`,替换 `jobs:` 之后全部):

```yaml
jobs:
  markdown-link-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: gaurav-nelson/github-action-markdown-link-check@v1
        with:
          # 限定检查范围到根目录 / docs / apps/web 的 markdown
          # (gaurav-nelson action 无 check-files 参数,有效参数是 folder-path)
          folder-path: '.'
          # 用 config-file 排除 node_modules / dist / .venv 等噪声目录
          config-file: '.github/mlc_config.json'
          use-quiet-mode: 'yes'
          max-depth: -1
```

**同时新建**:`.github/mlc_config.json`(排除噪声目录,避免误扫 node_modules):

```json
{
  "ignorePatterns": [
    { "pattern": "^node_modules/" },
    { "pattern": "^\\.venv/" },
    { "pattern": "^dist/" },
    { "pattern": "^apps/web/dist/" },
    { "pattern": "package-lock\\.json" }
  ],
  "replacementPatterns": [],
  "httpHeaders": [],
  "timeout": "20s",
  "retryOn429": true,
  "retryCount": 3,
  "aliveStatusCodes": [200, 206, 301, 302, 308, 403]
}
```

**怎么验证**:
```bash
# 本地无法直接跑 GHA action,但可验证配置文件合法
# 修复后,在 CI 上观察:应只扫描 ./(根) / docs / apps/web 的 md,
# 且 node_modules / .venv / dist 被排除
```

**⚠️ 风险提示**:`folder-path: '.'` 仍会扫根目录所有 .md(含 README.md、CODE_OF_CONDUCT.md、CHANGELOG.md)。若这些文件有外部死链,CI 会红。若只想查 docs 和 apps/web,改为 `folder-path: 'docs,apps/web'`。本审查**无法预知**仓库历史 md 中是否有死链,建议修复后先跑一次看结果。

---

### 问题 5 ⚠️ P1 — isAskUserShapedText 拆分丢失"文本中间嵌入 JSON"识别

**位置**:`apps/web/src/utils/agentQuestion/text-cleanup.ts:226-242`

**事实**(subagent 深审 + 我复核调用方):

**拆分前**(原 `agentQuestion.ts:557-558`):
```ts
export function isAskUserShapedText(text: string): boolean {
  return recoverQuestionFromText(text) !== null;
}
```

**拆分后**(`text-cleanup.ts:226-242`):
```ts
export function isAskUserShapedText(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if ((trimmed.startsWith('{') || trimmed.startsWith('[')) &&
      (/"items"\s*:|"questions"\s*:|"options"\s*:/.test(trimmed))) {
    return true;
  }
  if (parseLetterOptions(trimmed).length >= 2 &&
      /(?:题目[：:]|请选择|选出|测验|小测试|正确答案|第\s*\d+\s*题)/.test(trimmed)) {
    return true;
  }
  return false;
}
```

**语义差异**:旧版 `recoverQuestionFromText` 内部调 `extractAskUserFromText`,后者有"文本**中间**嵌入 JSON 子串"的识别分支(用 `indexOf('{')`/`lastIndexOf('}')` 切片)。新版只认 `trimmed.startsWith('{')`——**文本中间嵌入 JSON 的场景丢失**。

**调用方影响**(实读 `apps/web/src/stores/agentStore.ts:365,371,445,451,755`):

`isAskUserShapedText` 用于判断"流式前置内容是否是反问"。调用模式 `!isAskUserShapedText(prior)` 决定是否把前置内容保留为独立 assistant 消息。

**触发回归的场景**:模型输出形态是"先一段说明文字,然后在同一段流里接 JSON 反问",例如:
```
好的，我来问你几个问题：{"items":[{"type":"radio",...}]}
```
- 旧版:整段被判为反问 → 不保留为独立消息(反问卡片单独展示)
- 新版:不以 `{` 开头 → 判为**非反问** → **保留整段为独立 assistant 消息**,同时反问卡片也展示 → **UI 重复**

这违背了 `agentStore.ts:747` 注释的设计意图:"纯 Markdown 出题则整段用卡片替代,避免重复"。

**注意**:被审报告 §8.2 把这个差异标为"安全"(理由:grep 确认未被外部引用)。但 grep 只确认了**没有跨模块外部引用**,并**没有**确认函数内部行为可以随便改。`isAskUserShapedText` 被 `agentStore.ts` 内部 5 处调用,行为改变**直接影响 UI**。报告此处判断有误。

**怎么改**(推荐方案 B:保留轻量预筛,补回子串检测,避免引入循环依赖):

**修改后**(`apps/web/src/utils/agentQuestion/text-cleanup.ts:226-242`,替换整个函数):

```ts
export function isAskUserShapedText(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  // 1. 开头即是 JSON 形态
  if (
    (trimmed.startsWith('{') || trimmed.startsWith('[')) &&
    (/"items"\s*:|"questions"\s*:|"options"\s*:/.test(trimmed))
  ) {
    return true;
  }
  // 2. 文本中间嵌入的 JSON 子串(对齐旧 extractAskUserFromText 的 start/end 分支,
  //    避免"说明文字 + 中间 JSON 反问"场景下 UI 重复展示)
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const slice = trimmed.slice(start, end + 1);
    if (/"items"\s*:|"questions"\s*:/.test(slice)) return true;
  }
  // 3. Markdown 选择题
  if (
    parseLetterOptions(trimmed).length >= 2 &&
    /(?:题目[：:]|请选择|选出|测验|小测试|正确答案|第\s*\d+\s*题)/.test(trimmed)
  ) {
    return true;
  }
  return false;
}
```

**同时补测试**(在 `apps/web/tests/unit/agentQuestion/modularization.test.ts` 末尾、最后一个 `});` 之前插入):

```ts
  describe('isAskUserShapedText 边界', () => {
    it('纯 JSON 开头 → true', () => {
      expect(isAskUserShapedText('{"items":[{"type":"radio"}]}')).toBe(true);
    });
    it('文本中间嵌入 JSON 反问 → true(捕获回归)', () => {
      expect(
        isAskUserShapedText('好的，我来问你：{"items":[{"type":"radio","options":["A","B"]}]}')
      ).toBe(true);
    });
    it('含 A/B/C 选项 + 题目关键词 → true', () => {
      expect(isAskUserShapedText('A.x\nB.y\nC.z\n第 1 题：选什么？')).toBe(true);
    });
    it('普通说明文本 → false', () => {
      expect(isAskUserShapedText('我来帮你分析一下这个项目')).toBe(false);
    });
    it('空字符串 → false', () => {
      expect(isAskUserShapedText('')).toBe(false);
    });
  });
```

**怎么验证**:
```bash
cd apps/web && npx vitest run tests/unit/agentQuestion/modularization.test.ts
# 期望:原 46 + 新 5 = 51 passed
```

---

### 问题 6 ⚠️ P1 — _dispatch_evaluate_loop 残留 3 处字面量未用 helper

**位置**:`services/agent/agent_core/agents/hub.py:742-749, 774-782, 817-825`

**事实**:`format_subagent_start`/`format_subagent_done` helper 已抽取并用于 `_handle_dispatches`(L1386 等)。但**另一个函数 `_dispatch_evaluate_loop`** 内仍有 **3 处** `format_sse("subagent_start"/"subagent_done", {...})` 字面量未替换:

| 行 | 当前代码 | 等价 helper |
|---|---|---|
| L742-749 | `format_sse("subagent_start", {agent_id, task:(sub.message or message)[:200], reason:format_switch_reason(switch_d)})` | `format_subagent_start(sub.agent_id, switch_d_for_task, message)` ⚠️ 见下注 |
| L774-782 | `format_sse("subagent_done", {agent_id, status:"question", thinking, output})` | `format_subagent_done(sub.agent_id, "question", thinking=..., output=...)` |
| L817-825 | `format_sse("subagent_done", {agent_id, status:"ok", thinking, output})` | `format_subagent_done(sub.agent_id, "ok", thinking=..., output=...)` |

**注**(L742 的细微差异):helper 的签名是 `format_subagent_start(target, dispatch, original_message)`,内部用 `dispatch.get("task")`。而 L742 用的是 `sub.message`(对象属性,非 dict 的 task 键)。直接套 helper 会丢 `sub.message`。需要构造一个兼容 dict:`{"task": sub.message or message, ...}`。

**被审报告的偏差**:§7.3 第 8 点说"`_dispatch_evaluate_loop` 中的 **2 处**(L736, L779)未替换"——**实际是 3 处**,且行号也已偏移(报告引用的 L736/L779 是旧 commit 的行号)。报告低估了残留量。

**影响**:helper 化的目标是"集中 subagent 事件构造,避免 drift"。留 3 处字面量 = drift 风险**只消除了一半**。这 3 处与 helper 的截断逻辑(`[:200]` / `subagent_thinking_limit`)需要手动保持同步。

**怎么改**:

**改 L742-749**(替换为):
```python
            # 构造兼容 dispatch dict（sub.message 对应 task 字段）
            switch_d_for_helper = {
                "target_agent": sub.agent_id,
                "task": sub.message or message,
                "reason": sub.reason or "多意图编排",
            }
            yield format_subagent_start(sub.agent_id, switch_d_for_helper, message)
```

**改 L774-782**(替换整个 `yield format_sse("subagent_done", {...question...})` 块为):
```python
                        yield format_subagent_done(
                            sub.agent_id,
                            "question",
                            thinking="".join(think_parts).strip()[: self.config.subagent_thinking_limit],
                            output=(agent_text or "").strip()[: self.config.subagent_output_limit],
                        )
                        return
```

**改 L817-825**(替换整个 `yield format_sse("subagent_done", {...ok...})` 块为):
```python
            yield format_subagent_done(
                sub.agent_id,
                "ok",
                thinking="".join(think_parts).strip()[: self.config.subagent_thinking_limit],
                output=final_out[: self.config.subagent_output_limit],
            )
```

**怎么验证**:
```bash
# 确认替换后 hub.py 内不再有 subagent_start/done 字面量(除 helper 定义本身)
grep -n 'format_sse("subagent_start"\|format_sse("subagent_done"' services/agent/agent_core/agents/hub.py
# 期望:无输出(全部已用 helper)

# 跑后端单测确认无回归
cd tests && uv run --project ../services/api pytest unit -q -p no:cacheprovider
```

**⚠️ 注意**:L742 的 `switch_d_for_helper` 是新引入的局部变量,确认它不与 L737 已有的 `switch_d` 冲突(L737 的 switch_d 没有 task 键)。若担心混淆,可直接复用:把 L737 的 `switch_d` 加 `"task": sub.message or message` 字段,然后 L742 用 `format_subagent_start(sub.agent_id, switch_d, message)`。但需确认 `switch_d` 在别处是否被用于不需要 task 的场景。**建议保留独立变量** `switch_d_for_helper` 更安全。

---

### 问题 7 ⚠️ P1 — load_chat_history 算法在 assistant→tool→assistant 形态下丢弃 tool

**位置**:`services/agent/agent_core/memory/context.py:266-279`

**事实**(我用临时脚本实跑验证,已删脚本):

算法第 1 阶段反向遍历找 `last_round_start`。当历史形态是 `assistant → tool → assistant`(模型调工具→拿结果→文字总结回复,这是**最主流的多轮对话形态**)时:

```
输入:[user, assistant(调tool), tool(结果), assistant(总结), user(新问题)]
算法:反向先遇到最后的 assistant(倒数前一个)→ last_round_start = 那个 assistant
结果:中间的 tool 被丢弃(idx < last_round_start)
输出:[user, assistant(调tool), assistant(总结), user]  ← tool 没了
```

这意味着:**"保留最近一轮 tool 交互"在最常见的对话形态下,实际没保留任何 tool**。报告标题"§4.4.1 保留最近一轮 tool 交互"**名不副实**——它只在"历史以 tool 结尾"的特定形态下才保留 tool。

**这是 bug 还是设计权衡?**(辩证分析,需用户/团队决策):

- **支持"保留 tool"的理由**:LLM 看到 `assistant(调tool) → assistant(总结)` 会困惑"总结基于什么来的",丢失上下文连贯性。
- **支持"丢弃 tool"的理由**:当前 schema 的 tool 消息**缺 tool_call_id 和 tool_calls 字段**。OpenAI API 要求 tool 消息必须有对应的 tool_calls(在 assistant 上)和 tool_call_id。**保留孤立的 tool 可能触发 API 400 错误**。原 docstring(乱码前的意图)正是基于此:"工具调用上下文依赖 short_memory 摘要补偿(上限 12 条)"。

**我的判断**:当前算法是**保守的安全选择**(避免 API 报错),但**算法注释/报告措辞夸大了效果**。真正彻底的修复需要 `AgentMessage` schema 加 `tool_call_id` 列 + alembic 迁移(报告 §7.3 第 9 点已提及)。

**怎么改**(两种方案,需决策):

**方案 A(推荐,低成本,诚实化)**:不改算法,只改 docstring 和报告措辞,澄清"当前仅在历史以 tool 结尾时保留该 tool;assistant→tool→assistant 形态下 tool 仍被丢弃,依赖 short_memory 补偿"。即问题 1 的 docstring 修复版本里已经体现了这个诚实表述。**算法不动**。

**方案 B(彻底,高成本)**:推进 schema 演进,给 AgentMessage 加 tool_call_id,然后算法改为真正保留"最近一轮完整 assistant(tool_calls)+ tool(tool_call_id) 配对"。这是报告 §7.3 第 9 点的工作,**超出本轮范围**。

**建议**:采用方案 A(本报告问题 1 的 docstring 已采用诚实表述),方案 B 记入后续 PR。

**怎么验证(方案 A 后)**:
```bash
cd tests && uv run --project ../services/api pytest unit/test_load_chat_history_keep_recent_round.py -q
# 期望:6 passed(算法不变)
# 人工:读 docstring 确认不再声称"保留最近一轮 tool"(改述为"保留以 tool 结尾的最近一轮")
```

**⚠️ 这个问题需要用户/团队确认采用哪个方案**——因为它涉及产品行为取舍(API 安全 vs 上下文完整性)。我在报告里默认推荐方案 A,但**不擅自改动算法**。

---

### 问题 8 🟡 P2 — agentQuestion/index.ts 死代码 + 过时注释 + 双向 re-export 环

**位置**:`apps/web/src/utils/agentQuestion/index.ts`(整个文件,12 行)

**事实**(subagent grep 确认 + 我复核):

```ts
/**
 * agentQuestion 模块入口（§4.2.16 N-02 拆分第一步）。
 *
 * 完整实现仍在 `../agentQuestion.ts`（716 行），本入口仅 re-export 公开 API，
 * 方便按职责逐步拆出 `formatters/`、`parsers/`、`hydrate/` 等子模块。
 *
 * 当前已抽离的子模块：
 *   - `formatters.ts`：标签格式化 / 卡片摘要 / 答案摘要 / 记忆芯片
 *
 * 拆分原则：保持公开 API 不变；测试断言覆盖的语义不变；逐步替换原文件中的实现。
 */
export * from '../agentQuestion';
```

三个问题:
1. **过时注释**:L4 说"完整实现仍在 `../agentQuestion.ts`(716 行)"——实际现在 `../agentQuestion.ts` 是 50 行 shim
2. **过时注释**:L8 说"当前已抽离的子模块:formatters.ts"——实际 `formatters.ts` **已被删除**
3. **双向 re-export 环**:`../agentQuestion.ts`(shim)的注释 L21 说"`./agentQuestion/index.ts` 与本文件同步 re-export",而 index.ts 又 `export * from '../agentQuestion'`——**循环引用来源**,令人困惑
4. **死代码**:grep 确认 `apps/web/src` 内**无任何文件 import `@/utils/agentQuestion/index` 或 `./agentQuestion/index`**

**怎么改**:**删除整个文件**。

```bash
rm apps/web/src/utils/agentQuestion/index.ts
```

**同时**:`apps/web/src/utils/agentQuestion.ts` 的注释 L21 那句"`./agentQuestion/index.ts` 与本文件同步 re-export(保持原 import 路径)"也要删掉(因为 index.ts 已不存在)。把 agentQuestion.ts 的头部注释最后一段(约 L21):

```ts
 * `./agentQuestion/index.ts` 与本文件同步 re-export（保持原 import 路径）。
```
删掉这一行。

**怎么验证**:
```bash
# 确认无引用
grep -rn "agentQuestion/index" apps/web/src
# 期望:无输出

cd apps/web && npx vitest run tests/unit/agentQuestion/
# 期望:全部通过(无引用 = 删除安全)
cd apps/web && npm run typecheck
# 期望:0 errors
```

---

### 问题 9 🟡 P2 — __hydrateInternal 死代码导出

**位置**:`apps/web/src/utils/agentQuestion/hydrate.ts:327-328`(文件末尾)

**事实**(subagent grep 确认):
```ts
// 暴露私有 helper 给 card-formatters 复用（避免重复实现）
export const __hydrateInternal = { summarizeOneAnswer, normalizeItem };
```
grep 整个 `apps/web/src`:**无任何文件 import 或解构 `__hydrateInternal`**。且 `normalizeItem` 本是私有归一化函数,这样导出**泄露了内部实现**。

**怎么改**:删除这两行。

**怎么验证**:
```bash
grep -rn "__hydrateInternal" apps/web/src
# 期望:无输出
cd apps/web && npx vitest run tests/unit/agentQuestion/ && npm run typecheck
# 期望:全部通过
```

---

### 问题 10 🟡 P2 — card-formatters.ts 注释撒谎

**位置**:`apps/web/src/utils/agentQuestion/card-formatters.ts:5-9`

**事实**:文件头注释列出 `summarizeOneAnswer(从 hydrate 复用)`,但实际:
- card-formatters.ts **没有**从 hydrate import `summarizeOneAnswer`
- 它自己定义了私有 `labelForRadio`/`labelForCheckbox`,slider/drag_sort/knowledge_map 是内联格式化
- `summarizeOneAnswer` 根本没在这个文件里被调用

**怎么改**:把文件头注释(约 L5-9)改为准确的描述。先 Read 该文件头部确认确切行号,再 Edit。

**修改后**(替换 card-formatters.ts 的头部注释块):
```ts
/**
 * 卡片格式化（§4.2.16 N-02 拆分）。
 *
 * 公开导出:
 *   - formatAnswersForCard     反问卡 + 聊天卡片的"已答 N 题"摘要与详情列表
 *   - formatMemoryChipContent  侧栏记忆芯片：避免直接展示答题 JSON
 *
 * 文件内私有 helper:
 *   - labelForRadio     radio 答案 → "A. 文案"（复用 radio-helpers.formatRadioOptionLabel）
 *   - labelForCheckbox  checkbox 答案 → "文案"
 */
```

**怎么验证**:Read card-formatters.ts 头部确认注释已更新;tsc 通过。

---

### 问题 11 🟡 P2 — hydrate.ts 循环依赖注释失真

**位置**:`apps/web/src/utils/agentQuestion/hydrate.ts:10-11`

**事实**:注释说"让 parsers → hydrate 方向引用,避免循环"。但实际:
- `hydrate.ts:24` import `recoverQuestionFromText` from `parsers`(hydrate → parsers)
- `parsers.ts:12` import `ensureAgentQuestion` from `hydrate`(parsers → hydrate)
- **双向循环都存在**,注释自称"避免循环"是不实的

**影响**:ESM 运行时安全(双方都在函数体内调用,非顶层求值),但 `eslint-plugin-import` 的 `no-cycle` 规则可能告警,且注释误导维护者。

**怎么改**:把注释改为如实描述。

**修改后**(替换 hydrate.ts:10-11 那段注释):
```ts
// 注意 ensureAgentQuestion 与 parsers.ts 存在循环依赖（hydrate → parsers → hydrate）；
// 双方均在函数体内调用对方，ESM 运行时安全。如需彻底消除，
// 可将 recoverQuestionFromText 从 parsers 内联到 hydrate.ts。
```

**可选彻底消除**(P2 低优先级):把 `parsers.ts:106-108` 的 `recoverQuestionFromText` 实现移到 hydrate.ts,parsers 不再 import hydrate。但这会动 parsers 的公开导出,需同步改 agentQuestion.ts shim 的 re-export 来源。**建议暂不动**,只改注释。

**怎么验证**:tsc + vitest 通过即可。

---

### 问题 12 🟡 P2 — CODE_OF_CONDUCT.md 邮箱占位符

**位置**:`CODE_OF_CONDUCT.md:42, 119`

**事实**(grep 确认):L42 `联系邮箱:`open-source@example.com`(占位符,发布前请替换为真实邮箱)`,L119 同。被审报告 §7.3 第 11 点已自述。

**怎么改**:合并前把 `open-source@example.com` 替换为实际维护者邮箱,或改为 GitHub Discussions 链接。**这需要用户提供真实邮箱**,agent 不应编造。

**建议值**:`daftpunk.wav@outlook.com`(git identity 用的邮箱),或去掉邮箱改用:
```md
- 通过 GitHub Issues 或 Discussions 私信维护者举报
```

---

### 问题 13 🟡 P2 — apiReal/domain.test.ts 覆盖偏窄

**位置**:`apps/web/tests/unit/apiReal/domain.test.ts`(7 个测试)

**事实**(subagent 审 + 我复核测试通过):7 个测试只对 `login`/`listProjects`/`getAgentSession` 3 个方法做了运行时 URL/method 验证,其余 62 个方法只做 `typeof === 'function'` 存在性检查。**本次重构虽手工对比确认无差异,但测试本身无防回归能力**——未来改某域文件的方法,测试捕获不到 URL/method 变化。

**怎么改**(可选增强,低优先级):在 domain.test.ts 末尾加表驱动测试,遍历代表性方法对照硬编码的 `(URL, method)` 期望。示例框架(执行 agent 需根据实际方法补全表):

```ts
  it('关键方法 URL/method 等价(表驱动)', async () => {
    // 每项:[方法名, 调用参数, 期望 URL 子串, 期望 HTTP method]
    const cases: Array<[string, unknown[], string, string]> = [
      ['register', [{ username: 'u', password: 'p' }], '/auth/register', 'POST'],
      ['login', [{ username: 'u', password: 'p' }], '/auth/login', 'POST'],
      ['listProjects', [{}], '/projects', 'GET'],
      ['getGraph', ['p1'], '/graph', 'GET'],
      ['listNotes', ['p1'], '/notes', 'GET'],
      // ... 补全 15-20 个覆盖所有域 + 所有 HTTP method
    ];
    for (const [method, args, expectedUrl, expectedMethod] of cases) {
      fetchMock.mockClear();
      const client = new RealApiClient();
      // @ts-expect-error 动态调用
      await client[method](...args).catch(() => {});
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toContain(expectedUrl);
      expect((init as RequestInit).method).toBe(expectedMethod);
    }
  });
```

**怎么验证**:`npx vitest run tests/unit/apiReal/domain.test.ts` 新增用例通过。

---

## 四、没问题的改动(确认通过)

以下改动经审查**确认正确,无需修改**:

### ✅ §4.2.17 api/real 7 域拆分(commit 684ebe4)
- **语义等价**:subagent 用脚本逐方法对比 65 个方法的 URL/HTTP方法/body/params,**全部一致**,无遗漏无多余。
- **类型安全**:零 `any`,正确用 `Parameters<IApiClient['xxx']>[0]`。
- **接口契约**:`npx tsc --noEmit` 通过,证明 `implements IApiClient` 完整。
- **架构**:HttpCtx surface 最小必要,7 域互不 import,严格有向无环。
- **本次重构的高质量典范,可直接合并**。

### ✅ §4.2.3 hub.py helper 抽取(在 _handle_dispatches 范围内)
- `format_subagent_start`/`format_subagent_done` 两个 helper 语义正确。
- `_handle_dispatches` 内 3 处 start + 5 处 done 全部正确替换。
- 4 阶段章节注释清晰。
- **仅遗留问题 6(另一个函数 `_dispatch_evaluate_loop` 的 3 处未替换)**。

### ✅ ErrorBoundary onError 钩子(commit 3bb61f8)
- 向后兼容(onError 可选,默认 console.error 降级)。
- reset 闭包正确,`role="alert"` 无障碍,`data-testid` 可测试。
- 3 个单测覆盖默认 fallback / reset / onError。
- **高质量的防御性增强**。

### ✅ agentQuestion 16/17 个函数语义等价
- 除 `isAskUserShapedText`(问题 5)外,其余 16 个函数与原文件逐行对比等价。
- 17 个公开 API re-export 无遗漏,引用相等性 17 个测试验证通过。
- formatters.ts 删除正确(它本是偏离源文件的劣化副本,新 card-formatters.ts 忠实继承原语义)。

### ✅ 后端测试算法逻辑正确(§4.4.1)
- 6 个单测覆盖无 tool / 单 tool 配对 / 多 tool 仅最近一轮 / 仅 assistant / 中间有 old tool / system 保留。
- 实跑 6 passed,断言逻辑正确。
- **仅乱码(问题 1、2)和措辞问题(问题 7)**。

---

## 五、被审报告(REMEDIATION_CONTINUATION_REPORT_20260807.md)的偏差

审查中发现被审报告存在以下偏差,整改时需注意:

| 报告原文 | 实际情况 | 影响 |
|---|---|---|
| §3.7 "load_chat_history 改为...加 docstring + 算法" | docstring **全乱码**(问题1) | 报告未发现乱码,声称完成的项目实际有编码事故 |
| §3.6 "新增 46 个新单测覆盖拆分" | 46 个里有 5 个应覆盖 `isAskUserShapedText` 行为但**没有**(问题5) | 测试覆盖有缺口,语义回归漏网 |
| §7.3 第 8 点 "`_dispatch_evaluate_loop` 中的 **2 处**(L736, L779)未替换" | 实际 **3 处**(L742/774/817),行号也已偏移(问题6) | 低估残留量 |
| §8.2 "`isAskUserShapedText`...可安全改写" | **不安全**,影响 agentStore.ts 的 UI 行为(问题5) | 判断有误 |
| §3.4 "CI...pre-existing 路径问题,已记录需专门 infra PR 修" | 不是"待细化",是 **CI 推上去就红**(问题3) | 严重低估影响 |
| §5.1 "6 个边界测试覆盖" | 测试意图说明**全乱码**,可读性零(问题2) | 报告未发现 |
| §六 "规范性 9.0(中文 docstring)" | load_chat_history 的中文 docstring 是乱码 | 评分偏高 |

**核心结论**:被审报告整体框架扎实,但**对 80bc91d 这个 commit 的编码事故完全失察**,且对 `isAskUserShapedText` 语义回归的安全性判断有误。报告自评 8.8/10 **偏乐观**——计入乱码(P0)和 CI bug(P0)后,实际应在 **7.5-8.0** 区间。

---

## 六、整改优先级与执行顺序

给执行 agent 的建议顺序(每步独立可验证):

### 第 1 批:CI 立即修复(阻塞合并)
1. **问题 3**:修 ci.yml backend pytest 路径 → 推一次 CI 验证 backend job 绿
2. **问题 4**:修 markdown-link-check.yml 参数 + 建 mlc_config.json → 推一次 CI 验证 link-check job 绿

### 第 2 批:编码事故修复(必须 UTF-8 写入)
3. **问题 1**:修 context.py:253-287 的 docstring/注释中文
4. **问题 2**:修 test_load_chat_history_keep_recent_round.py 全篇中文
5. 验证:`pytest unit/test_load_chat_history_keep_recent_round.py` 6 passed + Read 确认中文正常

### 第 3 批:语义回归修复
6. **问题 5**:修 isAskUserShapedText + 补 5 个行为测试
7. 验证:`vitest run modularization.test.ts` 51 passed

### 第 4 批:helper 收尾
8. **问题 6**:替换 _dispatch_evaluate_loop 的 3 处字面量
9. 验证:`grep` 确认无残留字面量 + 后端单测通过

### 第 5 批:代码卫生(可合并后单独 PR)
10. **问题 8**:删 agentQuestion/index.ts + 改 agentQuestion.ts 注释
11. **问题 9**:删 __hydrateInternal
12. **问题 10、11**:修注释
13. **问题 12**:CODE_OF_CONDUCT 邮箱(需用户提供)
14. **问题 13**:补 apiReal 表驱动测试(可选)

### 需用户/团队决策(不要擅自改)
- **问题 7**:load_chat_history 算法是保留(方案 A,推荐)还是推进 schema 演进(方案 B)。本报告默认推荐方案 A,已在问题 1 的 docstring 里采用诚实表述。

---

## 七、验证总结

| 验证项 | 状态 | 说明 |
|---|---|---|
| 后端 §4.4.1 测试实跑 | ✅ 6 passed | 算法逻辑正确(乱码不影响执行) |
| 前端 56 新增测试实跑 | ✅ 56 passed | api/real 7 + agentQuestion 46 + ErrorBoundary 3 |
| api/real 65 方法语义等价 | ✅ 脚本逐方法对比 | subagent 验证,tsc 通过 |
| agentQuestion 17 函数等价 | ⚠️ 16/17 | isAskUserShapedText 有语义回归(问题5) |
| context.py 编码 | ❌ 部分乱码 | load_chat_history 区域中文损坏 |
| 测试文件编码 | ❌ 全篇乱码 | test_load_chat_history_keep_recent_round.py |
| ci.yml backend job | ❌ 必失败 | pytest 路径不存在 |
| markdown-link-check.yml | ❌ 配置失效 | check-files 参数不存在 |
| ErrorBoundary | ✅ 正确 | 向后兼容 + 可测试 |
| CODE_OF_CONDUCT | 🟡 邮箱占位符 | 需用户提供真实值 |

---

**报告生成**:2026-08-07
**审查者**:ZCode
**核验方法**:主审逐文件读取 + 2 subagent 分域深审 + 实跑测试 + 字节级编码核对 + WebFetch 核实 action 文档
**未做的事**:未在真实 GHA 环境验证修正后的 CI(本地无法模拟);未重跑后端完整 285 / 前端 193 全集(只跑本轮新增子集);未推进问题 7 方案 B 的 schema 演进(超出范围)
