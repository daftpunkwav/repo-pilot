# Contributing to RepoPilot

感谢你考虑为 RepoPilot 贡献代码！本文档整理了本地开发、提交规范、PR 流程的要点。
完整开发流程见 [`docs/development/guides/DEVELOPMENT_PROCESS.md`](docs/development/guides/DEVELOPMENT_PROCESS.md)，
任务分配与里程碑见 [`docs/development/DEVELOPMENT_ROADMAP.md`](docs/development/DEVELOPMENT_ROADMAP.md)。

## 开发环境

- Python 3.14+
- Node.js >= 20.11
- pnpm 10.x
- SQLite（开发默认） / PostgreSQL（生产可选）

```bash
# Python 依赖（项目根）
python -m venv .venv
.venv\Scripts\pip install -e services/api -e services/agent -e services/mcp -e packages/py-shared

# Node 依赖（前端）
cd apps/web && npm install

# 数据库初始化
alembic upgrade head
```

## 分支模型

- `main` — 主干，受保护
- `feat/*`、`fix/*`、`refactor/*`、`chore/*` — 短生命周期功能/修复
- `claude/*` — Claude/Codex 自动分支

## 提交规范

- 中文/英文皆可；建议中文简述 + emoji 前缀
- 单一 commit 单一目的（拆分 build / test / lint / impl 改动）
- 引用具体 §4.x.x ID（如 `fix(api): 落实 §4.1.1 跨 worker 会话流取消信号`）

## 检查清单

每个 PR 必须：

- [ ] `pytest tests/ -q` 通过
- [ ] `npm run test` (前端) 通过
- [ ] `npm run typecheck:web` 通过
- [ ] 新代码含单测（参考 `tests/unit/test_stream_cancel.py` 风格）
- [ ] 不引入 `.env.local`、`node_modules/`、`.pytest_cache/`、build 产物
- [ ] 历史 PII 不入仓（参见 SECURITY.md）

## 评审流程

1. 提交 PR，CI 自动跑 lint / typecheck / 单测
2. 评审者检查：行为契约 / 测试覆盖 / 文档同步 / 仓库卫生
3. Squash merge 入 main；远端三个仓库（GitHub / GitLab / Gitee）统一推送

## 风格与原则

- 中文注释；英文命名（API/类型/字段）
- 最小必要改动（参见 AGENTS.md）
- 真源单一：Agent 列表见 `docs/AGENT_TOOL_MATRIX.md`，与代码同步
- PII 卫生：发现历史 / 凭据泄漏请立即报告（见 SECURITY.md）