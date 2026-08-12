# Voyager 审查问题整改执行报告

> **生成日期**：2026-08-06
> **基准 commit**：`f3efb48`（分支 main）
> **依据审查文档**：`docs/review/AGENT_CODE_REVIEW.md`（基线 `5ff949c`，含 2026-08-05 复核）+ `docs/review/full-review-20260804.md`（v2.0 全量）
> **核实方式**：6 个只读子代理逐条对照【当前代码】亲验，区分 已修 / 部分修 / 未修 / 论断过时或不存在
> **目的**：供执行者（含能力薄弱者）按图施工，每条含精确定位、现状证据、可直接复制的目标改法、验证方法与风险。

---

## 0. 如何使用本报告

1. **先读 §1 状态定义**，理解"已修/部分修/未修"含义。
2. **按 §4 优先级顺序施工**：P0 → P1 → P2 → P3。每项独立可执行，但部分项有前置依赖（项内"依赖"字段标注）。
3. **每项模板**：优先级 / 状态 / 定位 / 现状证据 / 为什么改 / 目标改法（含代码）/ 验证 / 风险 / 依赖。
4. **改完一项**跑 §6 对应验证，全绿再进下一项。
5. **§3 是已修项**，无需再动，仅供核对。
6. **代码示例**可直接复制粘贴，但需替换其中的中文注释以匹配项目风格（项目用中文注释）。
7. **不要扩大改动范围**：每条只改它指出的地方，不顺手重构相邻代码（遵循 AGENTS.md"最小必要改动"）。

---

## 1. 核实方法与状态定义

| 状态 | 含义 |
|------|------|
| ✅ 已修 | 当前代码已落实该审查意见的完整目标，无需再动。 |
| 🟡 部分修 | 已落实一部分，但仍有残留问题需要补完。**本报告重点对象。** |
| ❌ 未修 | 当前代码与审查基线一致，问题仍在，需完整修复。**本报告重点对象。** |
| ⚪ 过时/不存在 | 审查论断的前提已不成立（如文件已删、版本已发布），无需处理，仅记录以免重复核实。 |

> **重要**：审查报告（尤其 AGENT_CODE_REVIEW.md 末尾的"已解决状态"自标注）部分自评"已解决"，但本次亲验发现其中若干项实际仍为"部分修"。**以本报告的亲验结论为准。**

---

## 2. 全局状态汇总表

共核实 **62** 个论断点。

### 2.1 已修（✅）— 28 项，无需再动

| 区域 | 项 | 一句话证据 |
|------|----|-----------|
| 限流 | 1.2 SSE 限流 + 消息长度 | `schemas/agent.py:18` max_length=8000；`routes/api/agent.py` 9 个 handler 全挂 `@limiter.limit("20/minute", key_func=_agent_rate_key)` |
| 限流 | 1.2 answers 收窄 | `schemas/agent.py:34` `dict[str, Any] \| list[dict[str, Any]]` |
| 安全 | complete_json 日志 | `provider.py:281` `logger.warning` |
| 安全 | intent 异常处理 | `intent.py:107` 捕获具体异常 + warning |
| 安全 | propose_memory 白名单 | `service.py:19` `ALLOWED_PREF_KEYS`；`hub.py:515` 提取结构化值 |
| 安全 | dispatch_task 清洗 | `builtin.py:759` `MAX_TASK_LEN=4000` + 截断 + warning |
| 安全 | _dispatch_fingerprint 全文hash | `hub.py:284` sha1 全文 |
| 安全 | SECRET_KEY 启动校验 | `main.py:39` >=32 字节 |
| 安全 | CSRF 中间件 | `main.py:102` CsrfMiddleware 双提交令牌 |
| 安全 | .env.local 未入仓 | `.gitignore:34` 命中；`git ls-files` 空 |
| 质量 | 类型注解 apply_*_mode | `hub.py:195/234/287` 全有 |
| 质量 | Message/Messages 类型 | `types.py:9-18` |
| 质量 | _run_agent 注解 | `hub.py:1607-1625` 全参注解 |
| 质量 | question.py 拆分 | `question.py` 319行，模块级 |
| 质量 | SSE 切片 helper | `react.py:47` `_emit_text_deltas` step=24 |
| 质量 | Workflow 枚举 | `types.py:21-29`；`_workflow_hint` 查表 `react.py:1173` |
| 质量 | AgentEngineConfig | `types.py:32-47` 定义+注入使用 |
| 质量 | format_sse 单源 | `stream_events.py:87` 唯一定义 |
| 质量 | think_stream helper | `think_stream.py:21` `_is_partial_marker` |
| 质量 | 多意图切分 | `intent.py:113` `_rule_multi` + `_split_segments` |
| 质量 | route_message 删除 | hub.py 无 route_message；test_agent_hub.py 不存在 |
| 质量 | DispatchRoundOutcome | `hub.py:262-271` dataclass |
| 质量 | _load_user_bundle(handle_chat/direct) | `hub.py:315` 统一 helper，两入口同源 |
| 质量 | react.run() 拆分 | `react.py:403-514` 纯分派，委托 6 个子方法 |
| 质量 | _dispatch_evaluate_loop bag→dataclass | `hub.py:893` |
| 质量 | 关键路径单测 | tests/unit 下 run/handle_chat/handle_dispatches 单测存在 |
| 仓库 | .playwright-mcp 已忽略 | `.gitignore:47` |
| 仓库 | archive/dist、build、exe、pyc | 从未入仓，工作区不存在 |
| 文档 | DOC-06/07/08/09 | 测试命令已指向 apps/web；.playwright-mcp 已清；changes/build 已删；v1/frontend 制品已清 |

### 2.2 部分修（🟡）— 16 项

| 编号 | 项 | 残留问题 |
|------|----|---------|
| 1.1 | _handle_dispatches 三分支 | 已抽 `_dispatch_one`，但 direct/must_serial/并行仍各自重复 subagent_start/done/question 拦截 |
| 3.3 | is_plan_announcement | 已提模块级+had_tool_calls，但魔数 1200/800/280 仍内联 |
| 4.2 | Agent 元数据 | _AGENT_DISPLAY_NAMES 等已派生，但 SOULS/AGENT_DEFINITIONS 仍两个大字典；AGENT_IDS/AGENT_PROFILES 仍硬编码 |
| 4.3 | intent 规则 | FAST_RULES 已派生，但 MULTI_KEYWORDS 仍硬编码 |
| 5.1 | 魔数收敛 | AgentEngineConfig 已用，但 280/320/2048/4096/3200 等仍内联 |
| 5.3 | except pass | intent 已修；hub.py:110-111 仍无日志 except |
| 5.4 | 配置加载 | handle_chat/direct 同源；import_assist 仍走 config-only |
| 6.1 | load_chat_history | 仍丢 tool 消息（已加注释，行为未变，可接受） |
| 7.3 | registry 单例 | 模块级实例达成单例；register() 无锁 |
| S-03 | _safe_github_name | 加白名单正则，无 URL 编码二次校验 |
| S-04 | 工具错误区分 | SSE 区分 status；LLM 回灌不区分 |
| T-09 | sse-parser 测试 | 测试不宽松；源码连 console.warn 都无 |
| T-01 | graph_similarity 测试 | 32行2测试，薄覆盖未扩充 |
| DOC-10 | superpowers 定位 | 仅 plans/1文件，无 README |
| DEP-02 | 依赖重叠 | 8项重合版本一致，未收敛到共享约束 |

### 2.3 未修（❌）— 18 项（本报告主体）

见 §4。

### 2.4 过时/不存在（⚪）— 9 项，无需处理

| 项 | 说明 |
|----|------|
| H-01~04 | archive/dist/* 全树从未入仓，工作区不存在（PII 实际在 archive/data/，见 H-05） |
| H-08 | .pyc 从未入仓 |
| H-15/16 | .zcode/ 不在磁盘/历史；plans 不并存 |
| DEP-03 | eslint v10 已发布，"v10未发布"论断过时 |
| DEP-04 | Vitest4/Vite7/jsdom29 均已发布 |
| DOC-08 | changes/build 已删 |

---

## 3. 已确认修复项（✅ 无需再动）

以下 28 项经亲验已完整落实。**不要重复修改这些地方。** 详细证据见 §2.1。若复核中发现某项实际未修，以代码为准并回报。

---

## 4. 待修复项（按优先级）

> 每项独立成节。P0 必须先做（尤其 §4.1.4 git 历史 PII）。代码示例可复制，注意中文注释。

---

### 4.1 P0 — 立即修复（本周）

---

#### 4.1.1 【S-05】`_session_stream_cancel` 多 worker 下失效

- **状态**：❌ 未修
- **定位**：`services/api/backend/services/agent_service.py:32-49`
- **现状证据**：
```python
# agent_service.py:32
_session_stream_cancel: dict[UUID, asyncio.Event] = {}
```
仍是进程内存 dict。多进程/多 worker（uvicorn `--workers >1`）下，各 worker 持本地 dict，"新会话流抢占旧流"的语义失效——用户在 worker A 建的流，无法被发往 worker B 的请求取消。
- **为什么要改**：生产部署若多 worker，取消/抢占功能形同虚设，可能导致同一会话并发多流、数据错乱。
- **目标改法**：
  改用 Redis 共享存储。若项目未引入 Redis，退而求其次用 DB 表标记（但 Redis 更合适）。

  步骤：
  1. 在 `services/api/backend/core/` 新增 `stream_cancel.py`：
  ```python
  # services/api/backend/core/stream_cancel.py
  """会话流取消信号：跨 worker 共享。"""
  from __future__ import annotations
  import uuid
  from typing import Optional
  from backend.core.redis import get_redis  # 若已有 redis 客户端；无则见下"无Redis退路"

  _CANCEL_KEY = "agent:stream:cancel:{session_id}"
  _TTL = 3600  # 1 小时，过期自动清理

  async def signal_cancel(session_id: uuid.UUID) -> None:
      r = await get_redis()
      await r.set(_CANCEL_KEY.format(session_id=session_id), "1", ex=_TTL)

  async def is_cancelled(session_id: uuid.UUID) -> bool:
      r = await get_redis()
      return bool(await r.exists(_CANCEL_KEY.format(session_id=session_id)))

  async def clear_cancel(session_id: uuid.UUID) -> None:
      r = await get_redis()
      await r.delete(_CANCEL_KEY.format(session_id=session_id))
  ```
  2. `agent_service.py` 中把 `_begin_session_stream` / `_end_session_stream` / 流循环里的取消检查改为调用上述函数（把内存 Event 的 set/wait 替换为 Redis 轮询或 pub/sub）。
  3. 流循环每 N 个 chunk 检查一次 `is_cancelled(session_id)`，命中则 break。

  **无 Redis 退路**（若确认单 worker 部署且短期不引 Redis）：至少在 `agent_service.py:32` 上方加注释明确"仅支持单 worker，多 worker 部署需改 Redis"，并在部署文档标注。但这不解决根本问题，不推荐。
- **验证**：
  - 单测：fake redis（`fakeredis` 库）测 signal/is_cancelled/clear。
  - 手动：起两个 worker（`uvicorn ... --workers 2`），在 worker A 建流，从 worker B 发取消请求，确认流终止。
- **风险**：引入 Redis 依赖需更新 `pyproject.toml` 与部署配置。若改动流循环结构，需跑现有 agent SSE 单测。
- **依赖**：无。

---

#### 4.1.2 【S-06】`agent_proxy` `read=None` 永远等待

- **状态**：❌ 未修
- **定位**：`services/api/backend/services/agent_proxy.py:42`
- **现状证据**：
```python
# agent_proxy.py:42
timeout = httpx.Timeout(connect=10.0, read=None, write=30.0, pool=10.0)
```
`read=None` 表示读响应永不超时。agent_proxy 透传上游 SSE，若上游 hang 住，本服务连接永久挂起，累积耗尽连接池。
- **为什么要改**：上游故障会拖垮本服务，资源泄漏。
- **目标改法**：
  SSE 透传确实需要较长读超时（流式有间隔），但不能无限。设一个合理上限：
  ```python
  # agent_proxy.py:42
  # SSE 流式允许较长间隔，但不能无限等待；120s 无任何数据视为上游故障
  timeout = httpx.Timeout(connect=10.0, read=120.0, write=30.0, pool=10.0)
  ```
- **验证**：手动构造一个上游 SSE 故意 hang 的场景（如 mock 上游收请求后不回数据），确认 120s 后 httpx 抛 `ReadTimeout`，本服务返回 504 而非永久挂起。
- **风险**：若上游正常流式间隔可能超过 120s（极不可能），会被误断。120s 对 LLM SSE 足够。
- **依赖**：无。

---

#### 4.1.3 【S-01】Mock 客户端把 token 写入 localStorage

- **状态**：❌ 未修
- **定位**：`apps/web/src/api/mock/index.ts:73,94,203,204,212,226,227`
- **现状证据**：
```typescript
// mock/index.ts:73
const TOKEN_KEY = 'rp_token';
// :203-204
localStorage.setItem(TOKEN_KEY, access);
localStorage.setItem(REFRESH_KEY, refresh);
```
mock 实现把 token 落 localStorage，与 real 走 httpOnly cookie 的安全设计不一致。
- **为什么要改**：mock 主要用于开发/测试/e2e，token 落 localStorage 在 XSS 下可被读取。虽非生产路径，但与 real 行为不一致会掩盖 real 侧的安全设计，且 e2e 在 mock 下跑不出真实 cookie 行为。
- **目标改法**：
  让 mock 也用内存 + 模拟 cookie（不真正写 localStorage）。最小改动：把 token 存内存变量，`getItem`/`setItem` 改为操作内存 Map。

  ```typescript
  // mock/index.ts 顶部，替换 TOKEN_KEY/REFRESH_KEY 的 localStorage 用法
  // 用内存存储模拟，与 real 的 httpOnly cookie 设计对齐，避免 XSS 可读
  const _memStore = new Map<string, string>();
  const TOKEN_KEY = 'rp_token';
  const REFRESH_KEY = 'rp_refresh';

  function memGet(key: string): string | null {
    return _memStore.get(key) ?? null;
  }
  function memSet(key: string, val: string): void {
    _memStore.set(key, val);
  }
  function memDel(key: string): void {
    _memStore.delete(key);
  }
  ```
  然后把所有 `localStorage.getItem(TOKEN_KEY)` → `memGet(TOKEN_KEY)`，`setItem` → `memSet`，`removeItem` → `memDel`。具体替换点：`:94,203,204,212,226,227` 及其他 `localStorage.*` 调用（grep `localStorage` 全文替换）。
- **验证**：`npm run test:web`（前端单测，含 mock 客户端测试）；e2e `npm run test:e2e` 确认登录/刷新流程在 mock 下仍工作。
- **风险**：mock 行为变化可能影响依赖 localStorage 持久化的 e2e（如刷新页面后仍登录）。e2e 用例若依赖跨页持久化，需调整为每次重新登录，或保留一个"仅测试用"的持久化开关。**改前先 grep e2e 是否依赖 localStorage 跨页保活。**
- **依赖**：无。

---

#### 4.1.4 【H-05 / S-12】git 历史中 `archive/data/stash_users.json` 仍含真实 PII ★最高优先级

- **状态**：🟡 部分修（工作区已脱敏为 `[redacted]`，但 **git 历史未清洗**，仍可检出真实邮箱 + 密码哈希 + 盐值）
- **定位**：
  - 工作区文件：`archive/data/stash_users.json`（当前已脱敏）
  - 历史污染 commit：`d73f4ad`（首次入库，含真实 PII）、`d6152c9`（覆盖式脱敏，未 rewrite）
- **现状证据**：
  `git show d6152c9^:archive/data/stash_users.json` 可检出：
  - 真实邮箱 `<REDACTED-EMAIL>`
  - `password_hash`（64 位十六进制，SHA256）
  - `salt`（32 位）
  仅做了"替换为 [redacted]"的覆盖提交，**未执行 history rewrite**。若仓库曾推送到公开远端，凭据视为已泄漏。
- **为什么要改**：密码哈希 + 盐值 + 邮箱在 git 历史中永久可见，离线字典攻击可还原弱密码。这是本报告**最严重**的单点风险。
- **目标改法**（两步，缺一不可）：

  **第一步：轮换凭据（立即）**
  - 修改 `<REDACTED-EMAIL>` 账号密码（若该邮箱在其他服务复用密码，全部改）。
  - 若 `stash_users.json` 中的 token 曾用于生产，吊销所有相关 token。

  **第二步：清洗 git 历史**
  使用 `git filter-repo`（比 `filter-branch` 安全快）移除该文件的所有历史版本。

  ```bash
  # 0. 先备份仓库（git filter-repo 会重写历史，不可逆）
  git clone --mirror <repo> voyager-backup.git

  # 1. 安装 git-filter-repo
  pip install git-filter-repo

  # 2. 在镜像仓库中移除污染文件的全部历史
  cd voyager-backup.git
  git filter-repo --path archive/data/stash_users.json --invert-paths

  # 3. （可选）同时移除其他含 PII 的历史文件，如 archive/data/stash_settings.json 若含敏感
  #    git filter-repo --path archive/data/stash_settings.json --invert-paths

  # 4. 强制推送重写后的历史到所有远端
  git push --force --mirror origin

  # 5. 通知所有协作者：必须重新 clone，旧 clone 作废
  ```
- **验证**：
  ```bash
  git log --all -S "<REDACTED-EMAIL>" --oneline   # 应无 PII 数据文件命中
  git log --all -- archive/data/stash_users.json           # 历史应被移除
  ```
  注意：`git log -S` 可能仍命中**文档**（如审查报告本身引用了该邮箱作为证据，见 `docs/review/full-review-20260804.md:68`）。文档里的引用不属凭据泄漏，但为彻底，可考虑把文档中的真实邮箱也替换为 `[redacted]`。
- **风险**：
  - **历史重写是不可逆的破坏性操作**，会改变所有 commit hash，所有协作者必须重新 clone。执行前务必与所有协作者沟通。
  - 若仓库已推送公开（GitHub 等），即使重写历史，已有 fork/clone 仍含 PII，凭据视为永久泄漏——**轮换密码是唯一有效补救**，历史清洗只是减少未来暴露。
  - filter-repo 后 CI/部署若依赖固定 commit hash 需更新。
- **依赖**：无。**应最先做。**

---

#### 4.1.5 【H-10 / H-11 / H-13】`.gitignore` 缺 `.claude/`、`.pytest_cache/`、`*.pkg`

- **状态**：❌ 未修
- **定位**：根 `.gitignore`
- **现状证据**：
  - `grep claude .gitignore` 无命中；`git check-ignore .claude` 未匹配（仅 `.git/info/exclude` 本地覆盖 worktrees 子目录，不共享）。
  - `grep pytest .gitignore` 无命中；磁盘存在 `services/api/.pytest_cache/` 与 `tests/.pytest_cache/`。
  - `grep "\.pkg" .gitignore archive/.gitignore` 无命中。
- **为什么要改**：`.claude/` 含本地工具配置可能误提交；`.pytest_cache/` 已有实物残留；`*.pkg`（PyInstaller 旁产物）未覆盖。
- **目标改法**：
  在根 `.gitignore` 末尾追加（找一处合适位置，如工具/缓存段）：
  ```gitignore
  # 工具缓存与本地配置
  .claude/
  .pytest_cache/
  *.pkg
  ```
  然后清理已跟踪的残留（若 `.pytest_cache` 曾被跟踪）：
  ```bash
  git rm -r --cached services/api/.pytest_cache tests/.pytest_cache 2>/dev/null || true
  ```
  注意：`.git/info/exclude` 里的 `.claude/worktrees/` 可保留（本地专用）或删除（根 .gitignore 已覆盖）。
- **验证**：
  ```bash
  git check-ignore -v .claude/         # 应命中根 .gitignore
  git check-ignore -v .pytest_cache/   # 应命中
  git check-ignore -v archive/foo.pkg  # 应命中
  git status                            # 确认 .pytest_cache 不再显示为未跟踪/已跟踪
  ```
- **风险**：低。若有人故意想跟踪 `.claude/` 下某文件，需用 `!` 例外，但一般不需要。
- **依赖**：无。

---

#### 4.1.6 【H-14】`.claude/worktrees/modest-wright-8e5f37/` 空目录残骸

- **状态**：❌ 未修
- **定位**：`.claude/worktrees/modest-wright-8e5f37/`
- **现状证据**：空目录仍存在（mtime 2026-07-09），`git worktree list` 不含它，是残骸。
- **为什么要改**：无用残骸，且 `git add .` 可能误纳。
- **目标改法**：
  ```bash
  rm -rf .claude/worktrees/modest-wright-8e5f37
  # 若 .claude/worktrees/ 下无其他内容，一并删
  rmdir .claude/worktrees 2>/dev/null || true
  ```
  配合 §4.1.5 把 `.claude/` 加入 .gitignore 后，未来不会再产生跟踪问题。
- **验证**：`ls .claude/worktrees 2>/dev/null` 无输出或目录不存在。
- **风险**：无（确认非活跃 worktree）。
- **依赖**：建议在 §4.1.5 之后做。

---

#### 4.1.7 【H-09】`archive/README-archive.md` 缺隐私声明

- **状态**：❌ 未修
- **定位**：`archive/README-archive.md`
- **现状证据**：全文仅"归档说明/目录说明/可借鉴逻辑/已废弃"四节，无任何隐私/PII 声明，未提示 `archive/data/stash_users.json` 历史曾含真实凭据。
- **为什么要改**：归档区有 PII 历史，README 须警示后来者。
- **目标改法**：在 `archive/README-archive.md` 顶部加一节：
  ```markdown
  ## ⚠️ 隐私与安全声明

  - `archive/data/stash_users.json` 历史版本曾含**真实用户邮箱、密码 SHA256 哈希与盐值**。
    虽当前工作区已脱敏为 `[redacted]`，但 git 历史中仍可检出（见 `docs/review/REMEDIATION_PLAN_20260806.md` §4.1.4）。
  - **禁止**将本目录任何文件推送到公开仓库。
  - 若需复用 `archive/data/` 下数据，必须先确认不含 PII。
  - `archive/data/stash_data.json`（206 项目画像）不含凭据 PII，但仍属用户行为数据，勿公开。
  ```
- **验证**：读取该文件确认声明存在。
- **风险**：无。
- **依赖**：无。

---

#### 4.1.8 【D-01 / S-21】Alembic 迁移 FK 列无 B-tree 索引（7 表 11 列）

- **状态**：❌ 未修
- **定位**：`services/api/backend/migrations/alembic/versions/6096bed38e20_initial_schema.py`
- **现状证据**：整条迁移 `create_index` 仅 2 处（`ix_users_username`、`ix_refresh_tokens_*`），以下 FK 列无索引：
  ```
  categories.user_id
  tags.user_id
  projects.user_id
  projects.category_id
  agent_sessions.user_id
  agent_sessions.project_id
  notes.user_id
  notes.project_id
  agent_messages.session_id
  project_analyses.project_id
  ```
  模型层（如 `models/project.py:42` `user_id`）同样无 `index=True`。
- **为什么要改**：生产数据量增长后，按 user_id/project_id/session_id 查询与 JOIN 会全表扫描，性能恶化。
- **目标改法**：
  新建一个迁移文件补索引（**不要改已发布的初始迁移**，用新迁移叠加）。

  ```bash
  # 在 services/api 下生成迁移（项目用 alembic）
  cd services/api
  # 手动创建迁移文件，命名按现有 revision 链
  ```

  创建 `services/api/backend/migrations/alembic/versions/<new_rev>_add_fk_indexes.py`：
  ```python
  """add btree indexes on fk columns

  Revision ID: <生成新id>
  Revises: 6096bed38e20
  Create Date: 2026-08-06
  """
  from alembic import op

  revision = "<new_rev>"
  down_revision = "6096bed38e20"
  branch_labels = None
  depends_on = None

  # 需补索引的 (表, 列) 清单
  _INDEXES = [
      ("categories", "user_id"),
      ("tags", "user_id"),
      ("projects", "user_id"),
      ("projects", "category_id"),
      ("agent_sessions", "user_id"),
      ("agent_sessions", "project_id"),
      ("notes", "user_id"),
      ("notes", "project_id"),
      ("agent_messages", "session_id"),
      ("project_analyses", "project_id"),
  ]

  def upgrade() -> None:
      for table, col in _INDEXES:
          op.create_index(
              f"ix_{table}_{col}", table, [col], unique=False
          )

  def downgrade() -> None:
      for table, col in reversed(_INDEXES):
          op.drop_index(f"ix_{table}_{col}", table_name=table)
  ```
  同时在模型层对应 Mapped 列加 `index=True`（保持迁移与模型一致），如 `models/project.py` 的 `user_id`、`category_id` 等。
- **验证**：
  ```bash
  cd services/api
  alembic upgrade head
  # 用 sqlite cli 或 DB 工具确认索引存在：
  # sqlite3 data/voyager.db ".indexes" 应含 ix_categories_user_id 等
  # 跑迁移往返测试（见 §4.1.8 验证 + §4.2.x downgrade 测试）
  ```
- **风险**：对已有数据的库建索引会锁表（SQLite 影响小，PostgreSQL 大表需 `CONCURRENTLY`）。若目标库是 PG，改用 `op.execute("CREATE INDEX CONCURRENTLY ...")` 但 alembic batch 模式下需注意。本项目当前 SQLite 为主，风险低。
- **依赖**：无。但建议与 §4.2.x（downgrade 测试）一起做。

---

#### 4.1.9 【D-05 / S-22】`projects.url` 无 `UNIQUE(user_id, url)` 约束

- **状态**：❌ 未修
- **定位**：`6096bed38e20_initial_schema.py:86`（url 列）、`:97-99`（表约束）；模型 `models/project.py:45`
- **现状证据**：`projects` 表 `url` 列无 unique，表级无 `UniqueConstraint(user_id, url)`，仅靠应用层去重。
- **为什么要改**：并发导入时应用层去重有竞态，可能插入重复 (user_id, url)。
- **目标改法**：
  在 §4.1.8 的新迁移文件中追加：
  ```python
  def upgrade() -> None:
      # ... 上面 _INDEXES 的 create_index ...
      op.create_index(
          "uq_projects_user_url", "projects", ["user_id", "url"], unique=True
      )

  def downgrade() -> None:
      op.drop_index("uq_projects_user_url", table_name="projects")
      # ... drop _INDEXES ...
  ```
  模型层 `models/project.py` 加 `__table_args__ = (UniqueConstraint("user_id", "url", name="uq_projects_user_url"),)`。
  **注意**：建唯一索引前需先清理已有重复数据（若有）：
  ```sql
  -- 先查重复
  SELECT user_id, url, COUNT(*) FROM projects GROUP BY user_id, url HAVING COUNT(*) > 1;
  -- 有重复则手动合并/删除后再建索引
  ```
- **验证**：迁移后尝试插入重复 (user_id, url)，应被数据库拒绝（IntegrityError）。
- **风险**：若库中已存在重复数据，建唯一索引会失败。**必须先查重并清理**。
- **依赖**：与 §4.1.8 同一迁移文件。

---

#### 4.1.10 【N-01】`agentStore.ts` `processSSEStream` 巨型函数（568 行）

- **状态**：❌ 未修
- **定位**：`apps/web/src/stores/agentStore.ts:336-904`（函数约 568 行，9 个 case 的 switch）
- **现状证据**：`processSSEStream` 单方法处理 text_delta / thinking / question / tool_call / tool_result / select_repos / agent_switch / subagent_start / subagent_thinking 等 9 类事件，全内联，圈复杂度 30+。
- **为什么要改**：难维护、难测试、改一个 case 易牵连其他。
- **目标改法**：
  按 SSE 事件类型抽独立处理器，`processSSEStream` 只做事件分派。

  1. 新建 `apps/web/src/stores/agentStore/handlers/` 目录（或在 agentStore 同目录建 `sseHandlers.ts`）。
  2. 每类事件一个纯函数，签名统一：
  ```typescript
  // apps/web/src/stores/sseHandlers.ts
  import type { AgentState } from './agentStoreTypes';

  export interface SseCtx {
    state: AgentState;
    // 需要的 setter / 副作用入口
  }

  // 每个处理器接收解析后的事件 data 与 ctx，返回是否终止流
  export type SseHandler = (data: any, ctx: SseCtx) => void | Promise<void>;

  export const handleTextDelta: SseHandler = (data, ctx) => {
    // 从 agentStore.ts:388 原 case 'text_delta' 的逻辑迁入
  };
  export const handleThinking: SseHandler = (data, ctx) => {
    // 原 case 'thinking'
  };
  // ... 其余 7 个
  ```
  3. `processSSEStream` 改为查表分派：
  ```typescript
  // agentStore.ts processSSEStream 简化后
  const HANDLERS: Record<string, SseHandler> = {
    text_delta: handleTextDelta,
    thinking: handleThinking,
    question: handleQuestion,
    tool_call: handleToolCall,
    tool_result: handleToolResult,
    select_repos: handleSelectRepos,
    agent_switch: handleAgentSwitch,
    subagent_start: handleSubagentStart,
    subagent_thinking: handleSubagentThinking,
  };

  for await (const event of stream) {
    const handler = HANDLERS[event.event];
    if (handler) await handler(event.data, ctx);
    else if (event.event === 'done') { /* 收尾 */ break; }
  }
  ```
  4. 每个 handler 独立可单测。
- **验证**：`npm run test:web`；新增每个 handler 的单测；e2e `npm run test:e2e` 确认 SSE 行为不变。
- **风险**：**高**。这是前端核心链路，拆分易引入回归。**必须先有 SSE 解析单测兜底**（项目已有 `sse-parser.test.ts`/`agentSSEStream.test.ts`/`streamRenderer.test.ts`，确认覆盖后再拆）。拆分时保持每个 case 的副作用与原逻辑逐行等价。
- **依赖**：建议先补 §4.3.x 前端测试质量（至少把宽松断言 T-10 改掉），再拆。

---

#### 4.1.11 【T-01 / T-02】后端测试覆盖严重薄弱

- **状态**：🟡 部分修（Agent 核心单测已补；`tests/function/` 与 `tests/business/` 仍薄弱）
- **定位**：
  - `tests/function/test_graph_similarity.py`（32 行，2 测试，仅覆盖满分/零分两端）
  - `tests/business/`（仅 7 测试，11 个 service 零业务测试）
- **现状证据**：`graph_service` 有 6 个函数（`_tokenize`/`_tf`/`_cosine`/`_doc_vector`/`build_graph`/`_similarity_detailed`）未覆盖；`agent_service`/`agent_proxy`/`profile_service`/`settings_service`/`github_accounts` 等无业务测试。
- **为什么要改**：业务层是核心，无测试则重构即高风险。
- **目标改法**：
  1. `test_graph_similarity.py` 扩充：覆盖中间梯度相似度、空输入、单文档、多语言混合、`_cosine` 边界（零向量）、`build_graph` 邻居数。
  2. `tests/business/` 逐 service 补：每个 service 至少覆盖 happy path + 1 个异常分支。优先 `agent_service`（流管理）、`profile_service`（记忆合并）、`settings_service`（配置读写）。
  3. 用 fake DB session（项目已有 `db_session` fixture，见 `tests/business/test_project_service.py`）。
- **验证**：`pytest tests/business tests/function -q`；覆盖率工具 `pytest --cov=backend.services` 看提升。
- **风险**：低（纯加测试）。注意测试不要依赖真实 LLM/网络，用 fake。
- **依赖**：无。

---

#### 4.1.12 【DOC-01 / DOC-02 / DOC-03】v1/v2/代码三方描述冲突

- **状态**：❌ 未修
- **定位**：
  - `docs/development/PROGRESS_REPORT.md:3`（日期 2026-08-04，落后最新 commit）
  - `docs/product/v1/PRD/PRD.md:15`（"由六个专业 Agent 组成"，代码实际 7 个）
  - `docs/product/v2/PRD/PRD.md:22`（"7 Agent (+Evaluator)"，代码无 Evaluator，Atlas 已实现）
  - `docs/product/v2/MVP/MVP_SCOPE.md:31`（"6 实现 + 1 预留"，Atlas 实际已实现）
  - `docs/product/v2/PRD/AGENT_PRD.md:25`
- **现状证据**：代码实际 7 个 Agent（hub/scout/mentor/navigator/curator/scribe/atlas，全实现，无 evaluator）；工具 24 个（v2 文档称 19，v1 称 14）。
- **为什么要改**：文档与代码严重脱节，误导开发与评估。
- **目标改法**：
  1. **建立对照矩阵**：在 `docs/` 新建 `AGENT_TOOL_MATRIX.md`，列出代码实际 Agent（7 个，附 id/职责/实现状态）与工具（24 个，附 name/用途）。所有文档以此为准。
  2. **修正各文档**：
     - `PROGRESS_REPORT.md:3` 日期更新为最新 commit 日期，补最新 commit hash。
     - `v1/PRD/PRD.md:15` 把"六个"改为"七个（代码实际注册数；v1 规划为六，后续新增 Atlas）"，或保留正文+强化旁注。
     - `v2/PRD/PRD.md:22` 改为"7 Agent（hub/scout/mentor/navigator/curator/scribe/atlas，均已实现）"，删除"(+Evaluator)"。
     - `v2/MVP/MVP_SCOPE.md:31` 改为"7 实现"，删除"1 预留"。
     - `v2/PRD/AGENT_PRD.md:25` 按 7 个已实现 Agent 重写。
     - 工具数 14/19 统一改为 24（附清单）。
- **验证**：grep 文档中"六个/七个/14/19"等数字，确认与代码一致；`AGENT_TOOL_MATRIX.md` 与 registry.py/builtin.py 逐项核对。
- **风险**：低。注意 v1 是历史规划，正文可保留规划原貌+旁注，但矩阵须以代码为准。
- **依赖**：无。

---

#### 4.1.13 【DOC-04】缺失 LICENSE / CHANGELOG / CONTRIBUTING / SECURITY

- **状态**：❌ 未修
- **定位**：根目录
- **现状证据**：四类标准治理文件全部缺失。
- **为什么要改**：开源/协作必备。
- **目标改法**：
  1. `LICENSE`：根据项目意图选择（若开源，MIT 或 Apache-2.0；询问维护者）。若不开源，写专有许可声明。
  2. `CHANGELOG.md`：按 Keep a Changelog 格式，记录 v1→v2 主要变更（可从 git log 提炼）。
  3. `CONTRIBUTING.md`：开发流程（已在 `docs/development/guides/DEVELOPMENT_PROCESS.md`，根目录建链接或拷贝要点）。
  4. `SECURITY.md`：安全漏洞报告流程 + 联系方式 + PII 处理声明（呼应 §4.1.4）。
- **验证**：四文件存在且内容非空。
- **风险**：低。LICENSE 选择涉及法律，**需确认维护者意图**（见 §5 待澄清问题）。
- **依赖**：无。

---

### 4.2 P1 — 本迭代（约 1 个月）

---

#### 4.2.1 【C-01 / C-02】`agent_core ↔ backend` 循环依赖（17 处反向 import + sys.path hack）

- **状态**：❌ 未修
- **定位**：
  - 17 处 `from backend.*` 在 `services/agent/agent_core/`：`memory/context.py:14,76,108`、`memory/service.py:13,14`、`agents/react.py:17`、`agents/hub.py:27,29`、`llm/config.py:11,115,144`、`llm/provider.py:87`、`tools/builtin.py:9,24,222,266,1358`
  - `services/agent/agent_runtime/main.py:25` `sys.path.insert(0, s)` 把 services/api 注入 sys.path
- **现状证据**：agent_core 反向依赖 backend 的 models/services/core/ports/schemas。运行时靠 sys.path hack 才能导入。
- **为什么要改**：双向耦合使两个服务无法独立构建/测试/部署，是架构最大单点问题。
- **目标改法**（中期，工作量大）：
  把共享逻辑下沉到 `packages/py-shared`，让 agent_core 与 backend 都依赖它，消除反向 import。

  分步：
  1. **识别共享层**：`backend.models.*`（User/Project/AgentSession 等数据契约）、`backend.core.security`（加解密）、`backend.core.url_safety`、`backend.ports.*`（工具端口适配）、`backend.schemas.project`（ImportRepoItem 等契约）、`backend.services.github_client`/`agent_service` 的部分纯函数。
  2. **下沉到 `packages/py-shared`**：把这些契约/纯函数迁入，重命名命名空间（如 `py_shared.models`）。
  3. **更新 `pyproject.toml`**：把 `packages/py-shared` 加入 uv workspace（见 §4.2.x DEP-06），api 与 agent 都 `depends-on` 它。
  4. **改 17 处 import**：`from backend.models.user import User` → `from py_shared.models.user import User`。
  5. **删除 sys.path hack**：`agent_runtime/main.py:22-25` 的 `sys.path.insert` 移除。
  6. **删除 backend/agents shim**：`services/api/backend/agents/*`（10行 shim）随循环依赖消除可删（确认无外部 import 后）。
- **验证**：
  - `pytest tests -q` 全绿。
  - `cd services/agent && python -c "import agent_core.agents.hub"` 不需 services/api 在 sys.path。
  - `cd services/api && python -c "import backend.main"` 仍工作。
- **风险**：**高，工作量大**。是架构级重构，可能触及上百文件。建议拆成多个小 PR 逐步迁（先迁一个模块，跑测试，再迁下一个）。**必须有完整测试覆盖后再动**（§4.1.11 先补测）。
- **依赖**：§4.1.11（测试）、§4.2.x DEP-06（workspace 收纳 py-shared）。

---

#### 4.2.2 【E-01 / 4.2 / R-02】Agent 列表 5 处真源 + SOULS/AGENT_DEFINITIONS 分离

- **状态**：🟡 部分修
- **定位**：
  - 已派生：`hub.py:44-46,84,87-89`（_SERIAL_DISPATCH_AGENTS/_AGENT_DISPLAY_NAMES/_AGENT_ROLE_HINTS 从 registry 派生）
  - 仍硬编码：
    - `services/api/backend/services/settings_service.py:12` `AGENT_IDS = ("hub","scout","mentor","navigator","curator","scribe","atlas")`
    - `services/api/backend/services/agent_catalog.py:4-54` `AGENT_PROFILES` 硬编码 7 个
    - `registry.py:41-135` `SOULS` 与 `:176-412` `AGENT_DEFINITIONS` 两个独立大字典
- **现状证据**：新增 Agent 仍需改 settings_service + agent_catalog + registry（SOULS + AGENT_DEFINITIONS）多处。
- **为什么要改**：真源分散，加 Agent 易遗漏。
- **目标改法**：
  1. **合并 SOULS 进 AGENT_DEFINITIONS**：把 SOULS 的风格字段并入 `AgentDefinition`（新增 `soul: SoulSpec` 字段或展开为 `system_prompt`/`style` 等字段），删除独立 `SOULS` 字典，`_def` 不再 `soul=SOULS[id]`。
  2. **AGENT_IDS 派生**：`settings_service.py:12` 改为：
     ```python
     from backend.agents.registry import get_registry
     AGENT_IDS = tuple(d.id for d in get_registry().list_all())
     ```
     注意循环依赖（§4.2.1），若未解耦，用延迟导入或缓存。
  3. **AGENT_PROFILES 派生**：`agent_catalog.py` 从 registry 派生（AgentDefinition 补 `description`/`icon` 等展示字段），或保留 agent_catalog 但 id 列表从 registry 取。
  4. **AgentDefinition 扩字段**：把 display_name/role_hint/serial/intent_patterns/description/icon/soul 全收敛进去（部分已有）。
- **验证**：临时在 registry 加一个假 Agent 定义，确认 settings_service/agent_catalog 自动识别，无需改它们。`pytest tests -q`。
- **风险**：中。SOULS 合并触及 registry 大字典，注意 system_prompt 内嵌反引号/特殊字符的字符串处理。settings_service 派生需注意循环依赖。
- **依赖**：§4.2.1（循环依赖）若未解，AGENT_IDS 派生需用延迟导入规避。

---

#### 4.2.3 【1.1】`_handle_dispatches` 三分支仍重复

- **状态**：🟡 部分修
- **定位**：`services/agent/agent_core/agents/hub.py:1199-1590`（约 391 行）
- **现状证据**：已抽 `_dispatch_one`（`hub.py:1258-1330`）和 `_dispatch_silent`（`:1504-1525`），但 direct（`:1332-1436`）、must_serial（`:1439-1500`）、并行（`:1501-1569`）三分支仍各自重复 `subagent_start`/`subagent_done`/question 拦截/`result_bag.had_question` 写回。
- **为什么要改**：重复逻辑，改一处易漏另两处。
- **目标改法**：
  把三分支的公共逻辑（发 subagent_start → 执行 → 取 text/question → 发 subagent_done → append results/summaries → question 时拦截）收敛进 `_dispatch_one`，让它返回一个结构化结果（如 `DispatchOutcome`：agent_id/text/question/summaries/expert_results/had_question），三分支退化为对 `_dispatch_one` 的调用编排：
  - direct：调用 1 次
  - must_serial：串行调用 N 次（顺序传上文）
  - 并行：`asyncio.gather` 调用 N 次

  ```python
  @dataclass
  class DispatchOutcome:
      agent_id: str
      text: str = ""
      question: dict | None = None
      summary: str = ""
      had_question: bool = False

  async def _dispatch_one(self, *, d, user, session_id, ..., stream_to_subagent: bool) -> DispatchOutcome:
      """执行单个专家调度，统一处理 subagent_start/done 与 question 拦截。"""
      # 发 subagent_start
      # async for item in self._run_agent(...): 取 text/question，按 stream_to_subagent 转 SSE
      # 发 subagent_done
      # 返回 DispatchOutcome
  ```
  `_handle_dispatches` 主体：
  ```python
  if len(dispatches) == 1 and not must_serial:
      outcomes = [await self._dispatch_one(d=dispatches[0], ..., stream_to_subagent=True)]
  elif must_serial:
      outcomes = []
      for d in dispatches:
          o = await self._dispatch_one(d=d, ..., stream_to_subagent=True)
          outcomes.append(o)
          if o.had_question: break  # 串行遇反问中止
  else:  # 并行
      outcomes = await asyncio.gather(*[self._dispatch_one(d=d, ..., stream_to_subagent=False) for d in dispatches])
  # 统一汇总 outcomes -> result_bag
  ```
- **验证**：`tests/unit/test_hub_handle_dispatches.py`（已存在）全绿；新增三分支编排的单测（fake `_dispatch_one` 返回固定 outcome，断言 direct/serial/parallel 的调用次数与顺序）。
- **风险**：**高**。是 Agent 调度核心，改错会导致专家调用异常。**必须先有 §1.3 单测兜底**（已存在 test_hub_handle_dispatches.py，确认覆盖后再动）。保持每个分支的副作用（SSE 事件顺序、result_bag 标志位）与原逻辑逐行等价。
- **依赖**：确认 `tests/unit/test_hub_handle_dispatches.py` 覆盖充分。

---

#### 4.2.4 【S-04】工具错误 ReAct 引擎未区分失败与成功（LLM 回灌）

- **状态**：🟡 部分修（SSE 已区分 status，LLM 回灌未区分）
- **定位**：
  - `services/agent/agent_core/tools/registry.py:88-114`（execute 对所有失败返回 `{"error": ...}`）
  - `services/agent/agent_core/agents/react.py:1036-1056`（SSE 区分 status，但 `:1048-1056` 回灌 LLM 时不区分）
- **现状证据**：
  ```python
  # react.py:1036-1041 SSE 区分
  "status": "success" if not (isinstance(tool_result, dict) and tool_result.get("error")) else "error"
  # :1048-1056 回灌 LLM 不区分
  messages.append({"role": "tool", "tool_call_id": tc_id, "content": json.dumps(tool_result, ...)})
  ```
  回灌给 LLM 的 tool 消息体是原始 tool_result，无 ok/failed 标记；引擎不因工具失败终止循环或减迭代。
- **为什么要改**：LLM 无法区分工具失败与成功，可能基于错误结果继续推理；失败的工具调用不扣减迭代预算。
- **目标改法**：
  1. 回灌时给 LLM 明确的失败标记：
  ```python
  # react.py 回灌处
  is_error = isinstance(tool_result, dict) and bool(tool_result.get("error"))
  tool_content = tool_result
  if is_error:
      # 给 LLM 明确的失败信号，便于它决定重试或换路
      tool_content = {"ok": False, "error": tool_result.get("error"), "tool": name}
  else:
      tool_content = {"ok": True, "data": tool_result}
  messages.append({"role": "tool", "tool_call_id": tc_id, "content": json.dumps(tool_content, ensure_ascii=False)[:self.config.tool_result_truncate]})
  ```
  2. （可选）连续 N 次工具失败时提前终止循环，避免空耗 LLM。
- **验证**：单测：fake 工具返回 `{"error":...}`，断言回灌 LLM 的 content 含 `ok:False`，SSE status 为 error。
- **风险**：中。改变 LLM 看到的 tool 消息结构，可能影响模型行为（需回归测试 Agent 链路）。`tool_content` 结构变化需确认前端 tool_result 展示不依赖原结构（前端用的是 SSE 的 tool_result 事件，非回灌消息，应不受影响，但需确认）。
- **依赖**：无。

---

#### 4.2.5 【S-03】`_safe_github_name` 无 URL 编码后二次校验

- **状态**：🟡 部分修
- **定位**：`services/agent/agent_core/tools/builtin.py:29-39`
- **现状证据**：已加 `_GITHUB_NAME_RE = ^[A-Za-z0-9._-]{1,100}$` 白名单 + 拦 `/`、`\`、`..`，但未做 URL 编码后二次校验。
- **为什么要改**：审查建议的"URL 编码后二次校验"可防编码绕过。当前白名单已较强，实际风险低，但补二次校验更稳。
- **目标改法**（低优先，可选）：
  ```python
  def _safe_github_name(value: str) -> str | None:
      s = (value or "").strip().removesuffix(".git")
      if not s or "/" in s or "\\" in s or ".." in s:
          return None
      if not _GITHUB_NAME_RE.fullmatch(s):
          return None
      # 二次校验：URL 编码后再解码应与原值一致，防编码绕过
      from urllib.parse import quote, unquote
      if unquote(quote(s, safe="")) != s:
          return None
      return s
  ```
- **验证**：单测覆盖含 `%2e%2e`、`%2f` 等编码攻击。
- **风险**：低。当前白名单已挡住主要 case，此为加固。
- **依赖**：无。

---

#### 4.2.6 【3.5】模块级 `ensure_tools_loaded()` 副作用

- **状态**：❌ 未修
- **定位**：
  - `hub.py:35` 模块级 `ensure_tools_loaded()`
  - `tools/__init__.py:5` 模块级 `ensure_tools_loaded()`
  - `services/api/backend/services/agent_service.py:29` 模块级 `ensure_tools_loaded()`
  - `builtin.py:1407-1409` `ensure_tools_loaded` 仍是 `return None`（靠 import 副作用注册）
  - `main.py:37-45` lifespan 未显式注册工具
- **现状证据**：工具注册靠 import 副作用，模块级调用 `ensure_tools_loaded()`（实际空函数）触发 builtin 全量加载。
- **为什么要改**：隐式注册导致测试时必须先 import builtin 才能触发，且导入即全量加载增加启动开销。
- **目标改法**：
  1. `builtin.py` 提供显式 `register_all_tools() -> None`（把当前靠 `@tool` 装饰器副作用注册的逻辑改为可显式调用；若装饰器已是注册到 global_registry，则 `register_all_tools` 只需 `import backend.tools.builtin  # noqa: F401` 触发装饰器，但封装为函数）。
  2. 删除 `hub.py:35`、`tools/__init__.py:5`、`agent_service.py:29` 的模块级 `ensure_tools_loaded()`。
  3. `main.py` lifespan 中显式调用：
  ```python
  # main.py lifespan
  from backend.tools.builtin import register_all_tools
  register_all_tools()
  ```
  4. 测试 conftest 中也显式调用一次。
- **验证**：`pytest tests -q`；确认 `global_registry` 在 lifespan 后非空；单测中不 import hub 也能通过显式调用注册。
- **风险**：中。改动导入时序，可能影响依赖工具注册的代码。需确认所有工具使用点都在 lifespan 之后（运行时）或测试已显式注册。
- **依赖**：无。

---

#### 4.2.7 【3.3 / 5.1】魔数收敛（is_plan_announcement 1200/800/280 + 其他内联魔数）

- **状态**：🟡 部分修
- **定位**：
  - `react.py:1267,1269,1275`（is_plan_announcement 的 1200/800/280）
  - `react.py:369`（`plan_cap = min(280, plan_cap)`）
  - `hub.py:204,243,297`（apply_* 内 320/2048/4096/3200）
- **现状证据**：AgentEngineConfig 已定义并使用大部分魔数，但这些仍内联。
- **为什么要改**：阈值散落，调整需全文搜索。
- **目标改法**：
  1. `types.py` `AgentEngineConfig` 补字段：
  ```python
  plan_announcement_len_short: int = 280
  plan_announcement_len_mid: int = 800
  plan_announcement_len_long: int = 1200
  plan_cap_min: int = 280  # react.py:369 的 280
  # apply_* 内的 320/2048/4096/3200 按语义命名
  ```
  2. `is_plan_announcement` 改用 `self.config.plan_announcement_len_*`（注意它是模块级函数，需把 config 作参数传入，或改为接受阈值参数）。
  3. apply_* 内魔数改为 `self.config.*`。
- **验证**：`pytest tests -q`；grep 确认这些魔数不再内联。
- **风险**：低。注意 is_plan_announcement 是模块级函数，改签名需同步调用处（`react.py:729`）。
- **依赖**：无。

---

#### 4.2.8 【4.3】`MULTI_KEYWORDS` 仍硬编码

- **状态**：🟡 部分修
- **定位**：`services/agent/agent_core/agents/intent.py:55`
- **现状证据**：`MULTI_KEYWORDS = ["并且","同时","另外","还有","以及","并帮我","再帮我","然后"]` 硬编码，未从注册表派生。
- **为什么要改**：多意图关键词与 Agent 解耦不彻底。
- **目标改法**：
  MULTI_KEYWORDS 本质是"句子连接词"，与具体 Agent 无关，从注册表派生意义不大。更合理的做法是把它作为 config 或常量集中管理。建议：
  ```python
  # intent.py 顶部
  # 多意图连接词（与具体 Agent 无关，属中文语法层）
  MULTI_KEYWORDS: tuple[str, ...] = ("并且", "同时", "另外", "还有", "以及", "并帮我", "再帮我", "然后")
  ```
  改为 tuple 不可变即可。若审查期望"从注册表派生"，则需 AgentDefinition 加 `multi_intent_triggers` 字段——但语义不通，不推荐。**本项可低优先处理，或判定为"设计如此"关闭。**
- **验证**：`pytest tests -q`。
- **风险**：低。
- **依赖**：无。

---

#### 4.2.9 【5.3】`hub.py:110-111` 无日志 except

- **状态**：🟡 部分修
- **定位**：`services/agent/agent_core/agents/hub.py:110-111`
- **现状证据**：
  ```python
  # hub.py:110-111
  except Exception:
      return chunk
  ```
  `_prefix_expert_thinking_sse` 内异常静默降级。
- **为什么要改**：署名失败时无日志，难排查。
- **目标改法**：
  ```python
  except Exception:
      logger.warning("prefix expert thinking sse failed, fallback to raw chunk", exc_info=True)
      return chunk
  ```
- **验证**：构造异常场景（如 expert_id 非法），确认日志输出。
- **风险**：低。
- **依赖**：无。

---

#### 4.2.10 【7.3】`registry.register()` 无并发保护

- **状态**：🟡 部分修
- **定位**：`services/agent/agent_core/agents/registry.py:455-457`
- **现状证据**：`get_registry()` 已模块级实例化（单例达成），但 `register()` 仅 `self._agents[id] = def`，无锁。
- **为什么要改**：若运行时动态注册（如插件），并发写可能竞态。当前无动态注册场景，风险低。
- **目标改法**：
  若确认无运行时动态注册，加注释说明"仅启动期调用，无需锁"即可。若需支持动态注册：
  ```python
  import threading
  class AgentRegistry:
      def __init__(self):
          self._agents: dict[str, AgentDefinition] = {}
          self._lock = threading.Lock()
      def register(self, definition: AgentDefinition) -> None:
          with self._lock:
              self._agents[definition.id] = definition
  ```
- **验证**：单测：多线程并发 register 不同 id，确认无丢失。
- **风险**：低。当前静态注册，加锁开销可忽略。
- **依赖**：无。

---

#### 4.2.11 【5.4】`import_assist` 走 config-only，与 Hub 不同源

- **状态**：🟡 部分修
- **定位**：`services/api/backend/services/agent_service.py:1105,1187`（`stream_import_assist` 用 `build_llm_config_from_user` 自建 provider，不取 key_status/permissions）
- **现状证据**：handle_chat/handle_direct_agent 已同源（`_load_user_bundle`），但 import_assist 另走。
- **为什么要改**：配置加载不一致，import_assist 可能漏装权限/密钥状态。
- **目标改法**：
  若 import_assist 不需 permissions（纯 LLM 生成，不调工具），可接受 config-only，但加注释说明。若需工具，则改用 `_load_user_bundle`。评估 import_assist 是否调工具：
  - 若调工具：改用 bundle，加载 permissions。
  - 若不调：加注释"import_assist 纯生成，不需 permissions，故用 config-only"。
- **验证**：确认 import_assist 行为不变。
- **风险**：低。
- **依赖**：无。

---

#### 4.2.12 【DEP-01】`python-jose` 未迁 `pyjwt`

- **状态**：❌ 未修
- **定位**：`services/api/pyproject.toml:15`、`services/api/backend/core/security.py:13`
- **现状证据**：仍用 `python-jose[cryptography]>=3.3.0`，`from jose import JWTError, jwt`。无 pyjwt。
- **为什么要改**：python-jose 多年未更新且有 CVE，pyjwt 维护活跃。
- **目标改法**：
  1. `pyproject.toml` 把 `python-jose[cryptography]>=3.3.0` 换为 `pyjwt>=2.8.0`（保留 cryptography 依赖）。
  2. `core/security.py` 改 import：`from jose import JWTError, jwt` → `import jwt; from jwt import PyJWTError as JWTError`。
  3. 检查所有 `jose` 用法（`grep -rn "jose" services/api/`），jwt API 基本兼容，但 `jwt.encode`/`decode` 的 `algorithm` 参数与 jose 略有差异，逐处核对。
  4. 跑 auth 单测。
- **验证**：`pytest tests/business/test_auth_service.py tests/integration -q`；手动登录/刷新 token。
- **风险**：中。API 差异可能导致 token 签发/验证失败。需仔细核对 encode/decode 调用。
- **依赖**：无。

---

#### 4.2.13 【DEP-05】无 `uv.lock` / `poetry.lock`

- **状态**：❌ 未修
- **定位**：根目录无锁文件
- **现状证据**：项目用 uv workspace 但无 `uv.lock`。
- **为什么要改**：无法保证可复现构建。
- **目标改法**：
  ```bash
  uv lock   # 生成 uv.lock
  ```
  提交 `uv.lock`。
- **验证**：`uv sync --frozen` 能从 lock 文件复现环境。
- **风险**：低。首次生成可能解析到新版本，需跑测试确认。
- **依赖**：§4.2.x DEP-06（先把 py-shared 纳入 workspace 再 lock 更合理）。

---

#### 4.2.14 【DEP-06】uv workspace 未含 `packages/py-shared`

- **状态**：❌ 未修
- **定位**：`pyproject.toml` `[tool.uv.workspace]` members
- **现状证据**：`members = ["services/api", "services/agent", "services/mcp"]`，不含 `packages/py-shared`（该包有 pyproject.toml）。
- **为什么要改**：py-shared 是 §4.2.1 循环依赖解耦的目标落点，须先纳入 workspace。
- **目标改法**：
  ```toml
  [tool.uv.workspace]
  members = ["services/api", "services/agent", "services/mcp", "packages/py-shared"]
  ```
- **验证**：`uv sync` 无报错；`packages/py-shared` 可被 api/agent depends-on。
- **风险**：低。
- **依赖**：无。建议在 §4.2.1 之前做。

---

#### 4.2.15 【前端 SSE 渲染安全】`MermaidBlock.tsx` 仍用 `dangerouslySetInnerHTML` + eslint 无禁止规则

- **状态**：❌ 未修
- **定位**：
  - `apps/web/src/components/common/MermaidBlock.tsx:77` `dangerouslySetInnerHTML={{ __html: svg }}`
  - `apps/web/eslint.config.js`（无 `react/no-danger` 规则，未引 eslint-plugin-react）
- **现状证据**：mermaid 渲染输出的 svg 未经 DOMPurify sanitize 直接注入。项目已依赖 dompurify 但此处未用。
- **为什么要改**：mermaid 输出虽相对可控，但若 mermaid 版本有 XSS 或输入含恶意标签，存在风险。
- **目标改法**：
  1. `MermaidBlock.tsx:77` 注入前 sanitize：
  ```typescript
  import DOMPurify from 'dompurify';
  // ...
  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(svg) }}
  ```
  2. eslint 加禁止规则（安装 `eslint-plugin-react` 后）：
  ```javascript
  // eslint.config.js
  import react from 'eslint-plugin-react';
  // plugins: { react, ... }
  rules: {
    'react/no-danger': 'warn',  // warn 而非 error，避免 MermaidBlock 这类已 sanitize 的误报；或用 'error' + // eslint-disable-next-line 显式豁免
  }
  ```
- **验证**：`npm run lint`；单测 mermaid 输出含 `<script>` 时被 sanitize。
- **风险**：低。DOMPurify sanitize 可能移除 mermaid 某些合法 SVG 属性，需视觉确认图表仍正常渲染。
- **依赖**：无。

---

#### 4.2.16 【N-02】`agentQuestion.ts` 715 行单文件未拆分

- **状态**：❌ 未修
- **定位**：`apps/web/src/utils/agentQuestion.ts`（715 行，25+ 函数）
- **现状证据**：`isPlaceholderOptions`/`ensureAgentQuestion`/`extractAskUserFromText`/`extractMarkdownQuiz`/`hydrateAgentMessages`/`formatMemoryChipContent` 等全塞一文件。
- **为什么要改**：难维护。
- **目标改法**：
  按职责拆分到 `apps/web/src/utils/agentQuestion/` 目录：
  - `normalize.ts`（isPlaceholderOptions/ensureAgentQuestion 等归一化）
  - `extract.ts`（extractAskUserFromText/extractMarkdownQuiz 等提取）
  - `hydrate.ts`（hydrateAgentMessages 等）
  - `format.ts`（formatMemoryChipContent 等）
  - `index.ts`（re-export，保持现有 import 路径 `@/utils/agentQuestion` 兼容）
- **验证**：`npm run test:web`；`npm run lint`。
- **风险**：低。纯文件拆分，逻辑不变。保持 index.ts re-export 兼容。
- **依赖**：无。

---

#### 4.2.17 【api/real/index.ts】654 行单类未分层

- **状态**：❌ 未修
- **定位**：`apps/web/src/api/real/index.ts`（654 行，单类 `RealApiClient`）
- **现状证据**：register/login/listProjects/getGraphData 等全内联。
- **为什么要改**：难维护。
- **目标改法**：
  按域拆分到 `apps/web/src/api/real/` 下：
  - `auth.ts`（register/login/refresh）
  - `projects.ts`（listProjects/import/...）
  - `graph.ts`（getGraphData）
  - `notes.ts`、`agent.ts`、`settings.ts`
  - `index.ts` 组合为 `RealApiClient`（或改为多个 api 对象）
- **验证**：`npm run test:web`；e2e。
- **风险**：低。保持对外 API 不变。
- **依赖**：无。

---

#### 4.2.18 【前端测试质量 T-06 ~ T-13】

- **状态**：多数 ❌ 未修
- **定位与改法**（逐条）：

  **T-06**（`playwright.config.ts:24` 强制 mock）：若要真实后端 e2e，新增一个 playwright project 用 `VITE_USE_MOCK=false` + 真实后端启动。**工作量大，可延后**。短期保留 mock e2e，加注释说明局限。

  **T-07**（`agent.spec.ts:16` 断言薄弱）：补充断言——流式片段顺序、thinking 与 text_delta 分离、反问面板出现。
  ```typescript
  // 示例：断言 thinking 与 text_delta 分离
  await expect(page.getByTestId('thinking-block')).toBeVisible();
  await expect(page.getByTestId('stream-renderer')).toBeVisible();
  ```

  **T-08**（`graph.spec.ts` 仅 SVG+首节点）：补节点点击/缩放/searchQuery 过滤断言。

  **T-09**（sse-parser 源码无 console.warn）：`apps/web/src/utils/sse-parser.ts` 的 catch 块加 `console.warn('SSE malformed JSON skipped', raw)`，测试验证警告被调用（spy console.warn）。

  **T-10**（`agentSSEStream.test.ts:60` 宽松断言）：改为确定性断言——明确 abort 时机后 text 应为何值，删除 `=== 'A' || === 'AB'`。
  ```typescript
  // 改为：明确 abort 后 text 应为 'A'（或 'AB'，取决于流处理时机），用 waitFor 锁定
  expect(result.text).toBe('A');  // 或重构测试使行为确定
  ```

  **T-11**（`AgentContextSidebar.test.tsx` 仅 1 测试）：补 toolLog 切换、project 绑定、memory 加载、Agent 切换测试。

  **T-12**（`settingsStore.test.ts:51-56` 凑用例）：删除该 fakeSettings 自校验，改为测 `updateSettings()` 调用 `getApi()` 的真实行为（mock api）。

  **T-13**（`setup.ts:4` 强制 NODE_ENV='development'）：保留（React RTL act() 需要），加注释说明 production 行为需另建测试配置。
- **验证**：`npm run test:web`；`npm run test:e2e`。
- **风险**：低（纯测试改进）。
- **依赖**：无。

---

### 4.3 P2 — 下迭代（2-3 个月）

---

#### 4.3.1 【D-02】`env.py` `parents[5]` 硬编码

- **状态**：❌ 未修
- **定位**：`services/api/backend/migrations/alembic/env.py:16`
- **现状证据**：`ROOT = Path(__file__).resolve().parents[5]`，假设固定 5 层目录结构。
- **目标改法**：
  改为基于环境变量或 settings：
  ```python
  # env.py:16
  from backend.config import get_settings
  ROOT = Path(get_settings().repo_root)  # config 暴露 repo 根
  # 或退路：env 变量
  ROOT = Path(os.environ.get("REPOPILOT_ROOT", Path(__file__).resolve().parents[5]))
  ```
  需在 `config.py` 加 `repo_root` 字段。
- **风险**：低。确认 Docker/包装目录下仍能解析。

#### 4.3.2 【D-03 / D-04】单迁移无 CI 往返 + downgrade 无测试

- **状态**：❌ 未修
- **定位**：无 `.github/workflows`；`tests/unit/test_schema_sync.py` 仅测 upgrade
- **目标改法**：
  1. 建 `.github/workflows/ci.yml`（或 gitlab-ci），含后端测试 + 迁移往返测试。
  2. 迁移往返测试：`tests/unit/test_migration_roundtrip.py`：
  ```python
  def test_migration_upgrade_downgrade(tmp_db):
      cfg = make_alembic_config(tmp_db)
      command.upgrade(cfg, "head")
      command.downgrade(cfg, "base")   # 验证可回退
      command.upgrade(cfg, "head")      # 再升
  ```
- **风险**：低。

#### 4.3.3 【D-07】`render_as_batch` 无 dialect 判断

- **状态**：❌ 未修
- **定位**：`env.py:41-47,53-57`
- **现状证据**：offline 与 online 均硬编码 `render_as_batch=True`，PG 下强制 batch 重建表。
- **目标改法**：
  ```python
  # env.py online do_run_migrations
  is_sqlite = connection.dialect.name == "sqlite"
  context.configure(
      connection=connection,
      target_metadata=target_metadata,
      render_as_batch=is_sqlite,  # 仅 SQLite 需要 batch
  )
  ```
  offline 同理（offline 无 connection，可按 url 判断 dialect）。
- **风险**：低。SQLite 不变，PG 改为非 batch 更高效。

#### 4.3.4 【D-08】`alembic.ini` 默认 url

- **状态**：❌ 未修
- **定位**：`alembic.ini:5`
- **现状证据**：`sqlalchemy.url = sqlite:///data/voyager.db`
- **目标改法**：改为空或占位，运行时由 env.py 覆盖：
  ```ini
  sqlalchemy.url =
  ```
- **风险**：低。确认 env.py 仍覆盖。

#### 4.3.5 【D-06】`refresh_tokens` 缺 `last_used_at`

- **状态**：❌ 未修
- **定位**：`6096bed38e20_initial_schema.py:50-59`、`models/user.py:39-51`
- **目标改法**：新迁移加列：
  ```python
  op.add_column('refresh_tokens', sa.Column('last_used_at', sa.DateTime(), nullable=True))
  ```
  模型加 `last_used_at: Mapped[datetime | None]`。在 refresh 调用时更新该字段。
- **风险**：低。

#### 4.3.6 【DOC-05】`DEVELOPMENT_ROADMAP.md` 112 个 `[ ]` 未勾选

- **状态**：❌ 未修
- **定位**：`docs/development/DEVELOPMENT_ROADMAP.md:84-408`
- **目标改法**：逐项核对代码实际状态，已完成的改 `[x]`。或注明"此为 v1 规划，实际进度见 PROGRESS_REPORT"。
- **风险**：低。

#### 4.3.7 【DOC-10】`docs/superpowers/` 定位不明

- **状态**：🟡 部分修
- **定位**：`docs/superpowers/`（仅 plans/1 文件）
- **目标改法**：加 `docs/superpowers/README.md` 说明定位（如"审查与整改计划归档"），或合并进 `docs/review/`。
- **风险**：低。

#### 4.3.8 【DEP-02】api/agent 依赖未收敛

- **状态**：🟡 部分修
- **目标改法**：在 §4.2.1 下沉 py-shared 后，把 api/agent 重合的 8 项依赖改为 `depends-on ["voyager-shared"]`，消除版本重复声明。
- **依赖**：§4.2.1。

#### 4.3.9 【DEP-07】`types` 三重解析

- **状态**：❌ 未修
- **定位**：`apps/web/package.json:22`（`"*"`）+ `tsconfig.json:24-27`（paths）+ `vite.config.ts`（alias）
- **目标改法**：保留 workspace 依赖（`"*"`），删除 tsconfig paths 与 vite alias 中的 `types` 映射（让 workspace symlink 生效）。或反之保留 paths 删 workspace。**统一为一种解析方式**。需确认 build（dist）时仍能解析。
- **风险**：中。改解析方式可能影响 build，需测 `npm run build`。

---

### 4.4 P3 — 持续改进

---

#### 4.4.1 【6.1】`load_chat_history` 丢 tool 消息

- **状态**：🟡 部分修（已加注释，行为未变）
- **定位**：`services/agent/agent_core/memory/context.py:253-266`
- **说明**：当前设计取舍已注释说明（tool 消息缺 tool_call_id 无法安全重放，依赖 short_memory 摘要补偿）。可接受。若要改进：保留最近一轮完整 tool 交互（assistant tool_calls + tool results），其余只留 user/assistant。
- **风险**：中（改变 history 结构可能影响 LLM 行为）。

#### 4.4.2 【T-09】sse-parser 源码告警

- 见 §4.2.18 T-09。

#### 4.4.3 其他 P3 杂项

- icon 抽离、`cn()` 强制、React 19 ViewTransition、错误边界细分、跨文档 markdown-link-check CI、CODE_OF_CONDUCT.md 补全等，见 full-review §14.4，低优先持续改进。

---

## 5. 待澄清问题（需用户决策）

以下决策无法从代码推断，执行前需确认：

1. **§4.1.4 git 历史清洗**：仓库是否曾推送到公开远端？若有，凭据视为已泄漏，必须轮换密码；历史清洗需所有协作者配合。
2. **§4.1.13 LICENSE 选择**：项目是开源（MIT/Apache-2.0）还是专有？影响许可声明。
3. **§4.2.1 循环依赖解耦**：是否启动 `packages/py-shared` 下沉？这是大工程，需确认排期。
4. **§4.2.12 python-jose→pyjwt 迁移**：是否在本迭代做？涉及 auth 链路。
5. **§4.1.3 mock localStorage 改造**：是否影响 e2e 跨页持久化？需确认 e2e 依赖。

---

## 6. 验证清单

每完成一批修改后，按序执行：

### 6.1 后端
```bash
cd services/api
pytest tests -q                          # 全量后端测试
# 迁移相关（§4.1.8/4.1.9/4.3.x）
alembic upgrade head
sqlite3 data/voyager.db ".indexes" | grep -E "ix_(categories|tags|projects|agent_sessions|notes|agent_messages|project_analyses)"
alembic downgrade -1 && alembic upgrade head   # 往返（§4.3.2）
```

### 6.2 前端
```bash
cd apps/web
npm run lint
npm run test:web
npm run test:e2e
npm run build                            # 确认 build 不破（§4.3.9）
```

### 6.3 Agent
```bash
# Agent 核心单测（§4.2.3 改 _handle_dispatches 后必跑）
pytest tests/unit/test_react_engine_run.py tests/unit/test_hub_handle_chat.py tests/unit/test_hub_handle_dispatches.py -q
```

### 6.4 仓库卫生
```bash
git check-ignore -v .claude/ .pytest_cache/ archive/test.pkg   # §4.1.5
git log --all -S "<REDACTED-EMAIL>" -- archive/data/   # §4.1.4 历史清洗后应空
git status                                                     # 确认无意外跟踪
```

### 6.5 文档一致性
```bash
# §4.1.12
grep -rn "六个\|七个\|14 个工具\|19 个工具" docs/product/   # 确认与代码(7 Agent/24 工具)一致
```

### 6.6 手动冒烟（Agent 链路）
寒暄 → Scout 速览 → Mentor 讲解（触发 ask_user）→ 反问回答 → Hub 汇总，确认 SSE 事件序列与落库正常（§4.2.3/4.2.4 后必做）。

---

## 7. 执行顺序建议（考虑依赖与风险）

**第一波（P0，本周，低风险先行）**：
1. §4.1.4 git 历史 PII 清洗 + 密码轮换 ★**最先**
2. §4.1.5 .gitignore 补全
3. §4.1.6 删 worktree 残骸
4. §4.1.7 archive README 隐私声明
5. §4.1.2 agent_proxy read 超时
6. §4.1.8 + §4.1.9 迁移补索引 + unique 约束
7. §4.1.12 文档三方对齐
8. §4.1.13 标准文件（待 LICENSE 决策）

**第二波（P0，需测试兜底）**：
9. §4.1.11 后端测试补强（先做，为后续重构兜底）
10. §4.1.10 拆 processSSEStream（先补前端测试质量 §4.2.18 T-10）
11. §4.1.1 _session_stream_cancel Redis 改造
12. §4.1.3 mock localStorage（确认 e2e 影响）

**第三波（P1，本迭代）**：
13. §4.2.14 py-shared 纳入 workspace
14. §4.2.1 循环依赖解耦（大工程，分多 PR）
15. §4.2.2 Agent 元数据收敛
16. §4.2.3 _handle_dispatches 三分支收敛
17. §4.2.4 工具错误 LLM 回灌区分
18. §4.2.6 ensure_tools_loaded 显式化
19. §4.2.7 魔数收敛
20. §4.2.12 jose→pyjwt
21. §4.2.13 uv.lock
22. §4.2.15 MermaidBlock sanitize + eslint
23. §4.2.16 / §4.2.17 前端拆分
24. §4.2.18 前端测试质量
25. §4.2.5 / §4.2.8 / §4.2.9 / §4.2.10 / §4.2.11 小项

**第四波（P2/P3，下迭代起）**：
26. §4.3.x alembic env 改造 + CI + downgrade 测试
27. §4.3.6 / §4.3.7 文档
28. §4.3.8 / §4.3.9 依赖收敛
29. §4.4.x 持续改进

---

## 8. 报告元信息

- **核实方法**：6 个只读子代理并行亲验，覆盖 Agent 核心 / 后端安全 / archive PII / alembic / 前端 / 文档依赖。所有结论附路径:行号证据。
- **未覆盖**：运行时性能 profiling、实际渗透测试、UI 设计审查、React 19 兼容性实测。
- **诚实声明**：
  - 审查报告（AGENT_CODE_REVIEW.md）末尾自评"已解决"的若干项，经亲验实为"部分修"，本报告以代码现状为准重新定性。
  - full-review v2 的 3 处行数修正（agent_service 1501 / react 1282 / builtin 1409）经亲验一致。
  - DEP-03/DEP-04 论断"v10未发布/Vitest4未发布"已过时，本报告标注为 ⚪。
  - archive/dist/* 系列论断（H-01~04）经亲验"从未入仓"，真实 PII 在 archive/data/（H-05），本报告已纠正定位。
- **本报告未修改任何源文件**，仅产出本文档。
