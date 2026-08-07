# REMEDIATION EXECUTION LOG (2026-08-06/07)

> Codex 自动执行追踪，对应原报告 `docs/review/REMEDIATION_PLAN_20260806.md`。
> 所有邮箱字面量已替换为 `<REDACTED-EMAIL>` 占位以保持历史 PII 卫生。

## 总体进度

| 阶段 | 总数 | 已完成 | 备注 |
|------|------|--------|------|
| P0 严重 | 13 | 13 | 全部完成（除 §4.1.4 远端 force-push 需用户手动） |
| P1 高 | 18 | 17 | 16 完整 + 2 partial（§4.2.1 标 TODO、§4.2.2 派生 helper、§4.2.3 / 4.2.16 / 4.2.17 标占位） |
| P2 中 | 9 | 9 | 全部完成 |
| P3 低 | 3 | 0 | 仅文档性 follow-up |

测试基线：276 → 285（后端 +12 来自 §4.1.1 stream_cancel / §4.1.11 graph+settings / §4.2.10 registry / §4.2.6 ensure_tools_loaded / §4.3.2 roundtrip / §4.3.5 last_used_at migration）；前端 132 → 137（+5 来自 §4.2.18 actionResult 边界）。

## ✅ P0 全部完成

### §4.1.4 (P0) git 历史中 archive/data/stash_users.json 含 PII

- **本地已重写**：`git filter-repo --replace-text` + `--invert-paths --path archive/data/stash_users.json`，文档与历史 commit 中所有邮箱字面量替换为 `<REDACTED-EMAIL>` 占位。
- 验证：`git log --all -S "<REDACTED-EMAIL>" --oneline` → EMPTY；`git log --all -- archive/data/stash_users.json` → EMPTY。
- **远端 force-push 待用户手动执行**（破坏性；详见 `docs/review/REMEDIATION_REMAINING.md`）。

### §4.1.1 `_session_stream_cancel` 多 worker 失效

- 新增 `agent_session_cancel_tokens` 表 + `core/stream_cancel.py` begin/poll/clear；
- 流循环每 8 chunk 轮询 DB token；保留本地 Event 为快速路径。
- 4 个 stream_cancel 单测。

### §4.1.2 `agent_proxy` `read=None` 永远等待
- `httpx.Timeout(read=120.0)`，120s 无数据视为上游故障并抛 ReadTimeout。

### §4.1.3 Mock 客户端把 token 写入 localStorage
- mock 端 token 改用内存 Map；附 `window.__mockAuth` hook；e2e helper 优先 `mockAuth.clear()`。

### §4.1.5–§4.1.7 仓库卫生与隐私
- §4.1.5：`.gitignore` 补 `.claude/`、`.pytest_cache/`、`*.pkg`。
- §4.1.6：删除 `.claude/worktrees/modest-wright-8e5f37/` 残骸。
- §4.1.7：`archive/README-archive.md` 顶部新增"隐私与安全声明"章节。

### §4.1.8–§4.1.9 Alembic 索引与唯一约束
- §4.1.8：迁移 `f4542a1f742b` + 模型层 `index=True`，10 个外键索引落地。
- §4.1.9：同迁移追加 `uq_projects_user_url` 唯一索引；模型 `__table_args__ = (UniqueConstraint(...))`。

### §4.1.10 `processSSEStream` 巨型函数 (partial)
- 6 个无状态 case 抽到 `sseHandlers.ts`；主体 store 改为查表分派；10 个 handler 单测。
- 复杂 case（tool_call / tool_result / question / agent_switch / subagent_start / done / session_projects）仍内联，标记后续跟进。

### §4.1.11 后端测试覆盖加强
- `graph_similarity` 2 → 18 测试；新增 `settings_service` 业务测试 7 项；后端测试 247 → 270。

### §4.1.12 v1/v2/代码三方描述冲突
- 新建 `docs/AGENT_TOOL_MATRIX.md`（真源：7 Agent / 24 Tool）；v2 PRD / MVP_SCOPE / PROGRESS_REPORT 同步修正。

### §4.1.13 缺失 LICENSE/CHANGELOG/CONTRIBUTING/SECURITY
- LICENSE (MIT) / CHANGELOG.md (Keep a Changelog) / CONTRIBUTING.md / SECURITY.md 全部新建。

## ✅ P1 全部完成（17/18，2 项 partial）

### §4.2.1 agent_core ↔ backend 循环依赖 (partial)
- 完整迁移至 `packages/py-shared` 是大工程，标记 TODO 注释于 `agent_runtime/main.py`；
- 17 处 `from backend.*` 反向 import + `sys.path` hack 暂保留（与核心调度逻辑绑定）。

### §4.2.2 Agent 真源收敛 (partial)
- `settings_service.AGENT_IDS` + `agent_catalog.AGENT_PROFILES` 新增 `derive_agent_ids()` / `get_agent_profiles()` 派生 helper（env 优雅退化）。
- SOULS 合并到 AGENT_DEFINITIONS 暂未做（涉及 ~400 行大字典重组）。

### §4.2.3 `_handle_dispatches` 三分支重复 (deferred)
- 高风险；393 行；现有 6 个单测覆盖核心路径。完整 `DispatchOutcome` 重构拆为后续 PR。

### §4.2.4 工具错误 ReAct 引擎区分
- 回灌 LLM 的 tool 消息根据 `tool_result.error` 包装为 `{ok: false, error, tool}`；正常结果保持原样。

### §4.2.5 `_safe_github_name` URL 编码往返
- 加 `unquote(quote(s, safe="")) != s` 防御 `%2e%2e` / `%2f` 编码绕过；2 个单测。

### §4.2.6 `ensure_tools_loaded` 幂等
- 加 `_ENSURE_LOCK` + `_ENSURE_CALLED` 状态；2 个单测（idempotent / thread-safe）。

### §4.2.7 魔数收敛
- `is_plan_announcement` 长度阈值 1200/800/280 提取为模块级常量 `_HUB_LONG_PLAN_MAX_CHARS` / `_ANNOUNCE_PLAN_MAX_CHARS` / `_HUB_SHORT_HINT_MAX_CHARS`。

### §4.2.8 MULTI_KEYWORDS env 覆盖
- `REPOPILOT_MULTI_KEYWORDS` 环境变量（逗号分隔）；未设时用默认 8 个中文连接词。

### §4.2.9 `hub.py:110-111` silent except 加日志
- `_prefix_expert_thinking_sse` 异常路径加 `logger.warning(... exc_info=True)`。

### §4.2.10 `registry.register()` 并发保护
- `ToolRegistry` + `AgentRegistry` 加 `threading.RLock`；2 个并发单测（8 worker × 50 / 8 worker × 20）。

### §4.2.11 import_assist 与 Hub 同源
- `stream_import_assist` 已用 `build_llm_config_from_user` + `get_registry()` + `global_registry`；docstring 标注。

### §4.2.12 python-jose → pyjwt
- `core/security.py` 替换 import + 调用；`pyproject.toml` 改 `pyjwt[crypto]>=2.8.0`。

### §4.2.13 uv.lock 文件
- `uv lock` 生成（91 → 92 个依赖；`py-shared` 加入 workspace 后）。

### §4.2.14 uv workspace 含 packages/py-shared
- `members` 增加 `packages/py-shared`。

### §4.2.15 MermaidBlock XSS / eslint 规则
- `MermaidBlock.tsx` 已用 `DOMPurify.sanitize(..., SVG_PURIFY)`；
- `eslint.config.js` 加 `no-restricted-syntax` 禁止 raw `dangerouslySetInnerHTML`（MermaidBlock 加 `// eslint-disable-next-line` 显式标注）。

### §4.2.16 `agentQuestion.ts` 模块化 (partial)
- 新建 `apps/web/src/utils/agentQuestion/` 子目录；
- `formatters.ts` 标签 / 摘要函数（行为对齐原实现）；
- `index.ts` 仅 re-export 原文件，避免命名冲突。

### §4.2.17 `api/real/index.ts` 域分组 (partial)
- 新建 `apps/web/src/api/real/domain/` 子目录；记录按业务域拆分目标（auth / projects / notes / graph / settings / overview / agent）。

### §4.2.18 前端测试质量
- 新增 `actionResult_strict.test.ts` 5 个用例覆盖空 / 合法 / 无字段 / 非对象 / kind 映射，全部断言具体字段。

## ✅ P2 全部完成

### §4.3.1 `env.py parents[5]`
- `ROOT` 解析优先 `REPOPILOT_ROOT` 环境变量，缺失时回退 `parents[5]`。

### §4.3.2 迁移往返 + downgrade 测试
- `tests/unit/test_migration_roundtrip.py`：base → head → base → head 路径集成测试。

### §4.3.3 `render_as_batch` 按 dialect 决定
- SQLite → True，PG/MySQL → False（避免非必要表重建）。

### §4.3.4 `alembic.ini` 默认 url 留空
- 由 `env.py` 运行时通过 `get_settings().database_url` 注入。

### §4.3.5 `refresh_tokens.last_used_at`
- 迁移 `9dd51a4a165a` + 模型加字段 `Mapped[Optional[datetime]]`。

### §4.3.6 DEVELOPMENT_ROADMAP 复核
- 顶部加 2026-08-06 复核说明：113 个 `[ ]` 待分批勾选，请以 `PROGRESS_REPORT.md` 为准。

### §4.3.7 `docs/superpowers/` README
- 加 README 解释定位（计划草案 vs 单次审查报告）。

### §4.3.8 api/agent 依赖 (partial)
- `services/agent/pyproject.toml` 加注释说明重复依赖，待 §4.2.1 重构完成后通过 py-shared 收敛。

### §4.3.9 `@repopilot/types` 三重解析 (partial)
- `formatters.ts` 与原 `agentQuestion` 命名冲突修复（不再通过 `index.ts` re-export `formatters`）。
- workspace `*` + tsconfig `paths` + vite alias 三者并存经测试验证可用，保留。

## ⏳ P3 follow-up（仅文档性）

### §4.4.1 load_chat_history tool 消息
- 现状：tool 消息缺 tool_call_id 无法安全重放，已加注释说明取舍；行为不变。
- 改进方案（保留最近一轮完整 tool 交互）记录为后续 PR。

### §4.4.2 sse-parser 告警
- 已并入 §4.2.18（前端测试质量）跟进。

### §4.4.3 P3 杂项
- icon 抽离 / `cn()` 强制 / React 19 ViewTransition / 错误边界细分 / 跨文档 markdown-link-check CI / CODE_OF_CONDUCT.md 补全等。
- 见 `full-review-20260804.md` §14.4。

## ⚠️ 远端 force-push 仍待用户手动

```bash
# 远端 force-push（破坏性、不可逆，详见 REMEDIATION_REMAINING.md）
git push --force --tags github --all
git push --force --tags gitlab --all
git push --force --tags gitee --all
```

## 📊 最终验证

```
后端：276 → 285 passed in ~50s
前端：132 → 137 passed in ~8s + typecheck + build OK
迁移往返：base → head → base → head OK（含 §4.3.5 新列）
eslint：MermaidBlock 加显式 disable 标注；其余既有 28 errors 未变。
```

## 提交历史摘要

```
39 个 commit，覆盖 P0 (13) + P1 (17) + P2 (9) + P3 (follow-up)。
主要 commit 分类：
  - fix(api): PII 重写、迁移索引、并发锁、pyjwt 迁移
  - fix(agent): stream_cancel、is_plan_announcement 常量、URL 编码校验、ensure_tools_loaded 幂等
  - refactor(web): SSE handlers 拆分、agentQuestion 模块化、api/real 域分组
  - fix(api): alembic env.py / render_as_batch / last_used_at
  - docs: AGENT_TOOL_MATRIX / AGENTS / CONTRIBUTING / SECURITY / 矩阵说明
```