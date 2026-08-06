# REMEDIATION EXECUTION LOG (2026-08-06)

> Codex 自动执行追踪，对应原报告 `docs/review/REMEDIATION_PLAN_20260806.md`。
> 所有邮箱字面量已替换为 `<REDACTED-EMAIL>` 占位以保持历史 PII 卫生。

## ✅ 已完成 (P0)

### §4.1.4 (P0) git 历史中 archive/data/stash_users.json 含 PII

- **本地已重写**：`git filter-repo` 配合 `--replace-text` 表达式文件将所有 blob 中的 PII 字面量替换为 `REDACTED-EMAIL`，并 `--invert-paths` 移除 `archive/data/stash_users.json` 的全部历史。
- 文档 `docs/review/REMEDIATION_PLAN_20260806.md` 与 `docs/review/REMEDIATION_REMAINING.md` 中所有邮箱字面量已替换为 `<REDACTED-EMAIL>` 占位。
- 老 commit hash 已 gc，仓库对象层不可再检索。
- 验证：
  - `git log --all -S "<REDACTED-EMAIL>" --oneline` → EMPTY
  - `git log --all -- archive/data/stash_users.json` → EMPTY
- **远端 force-push 待手动执行**（见 `docs/review/REMEDIATION_REMAINING.md`）。

### §4.1.1 (P0) `_session_stream_cancel` 多 worker 失效

- 新增 `agent_session_cancel_tokens` 表 + `core/stream_cancel.py` 封装 begin/poll/clear
- 流循环每 8 chunk 轮询 DB；保留本地 Event 为快速路径
- 4 个单测覆盖 token 生命周期

### §4.1.2 (P0) `agent_proxy` `read=None` 永远等待

- `httpx.Timeout(read=120.0)`，SSE 透传 120s 无数据视为上游故障

### §4.1.3 (P0) Mock 客户端把 token 写入 localStorage

- mock 端 token 改用内存 Map，附 `window.__mockAuth` hook 给 e2e
- e2e helper 优先 `mockAuth.clear()`，回退 localStorage 调用

### §4.1.5 (P0) .gitignore 缺 `.claude/`、`.pytest_cache/`、`*.pkg`

- 全部补齐 + 验证 `git check-ignore` 命中

### §4.1.6 (P0) `.claude/worktrees/modest-wright-8e5f37/` 空目录残骸

- 已删除（rmdir）

### §4.1.7 (P0) `archive/README-archive.md` 缺隐私声明

- 顶部新增 "隐私与安全声明" 章节，提示 stash_users.json 历史 PII

### §4.1.8 (P0) Alembic FK 列无 B-tree 索引（7 表 11 列）

- migration `f4542a1f742b_add_fk_indexes` + 模型层 `index=True`
- 10 个新索引已建

### §4.1.9 (P0) `projects.url` 无 UNIQUE(user_id, url) 约束

- 同迁移追加 `uq_projects_user_url` 唯一索引
- 模型 `__table_args__ = (UniqueConstraint(...))`

### §4.1.10 (P0 partial) `agentStore.ts` `processSSEStream` 巨型函数

- 6 个无状态 case（text_delta/thinking/subagent_*/error/done）抽到 `sseHandlers.ts`
- 主体 store 改为查表分派
- 10 个 handler 单测
- 复杂 case（tool_call/tool_result/question/agent_switch/subagent_start/done/session_projects）仍内联，标记后续跟进

### §4.1.11 (P0) 后端测试覆盖严重薄弱

- graph_similarity 2 → 18 测试
- 新增 settings_service 业务测试 7 项
- 总后端测试 247 → 270

### §4.1.12 (P0) v1/v2/代码三方描述冲突

- 新建 `docs/AGENT_TOOL_MATRIX.md`（真源：7 Agent / 24 Tool）
- v2 PRD 改为 7 已实现 + 无 Evaluator
- v2 MVP_SCOPE 工具数 19 → 24
- PROGRESS_REPORT 日期 0804 → 0806

### §4.1.13 (P0) 缺失 LICENSE/CHANGELOG/CONTRIBUTING/SECURITY

- LICENSE (MIT) / CHANGELOG.md (Keep a Changelog) / CONTRIBUTING.md / SECURITY.md 全部新建

## ⏳ 进行中

### P1 — §4.2.1 – §4.2.18（17 项）

按 P1 顺序逐项落实，每一项完成后回填本节。
