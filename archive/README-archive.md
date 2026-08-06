# Archive — RepoPilot v1.x

归档时间：2026-07-03
归档原因：v2.0 重构，保留旧实现作为参考

## 目录说明

- `backend/` — Flask 单文件后端
- `frontend/` — 原生 JS 前端
- `data/` — JSON 数据文件（已迁移到 SQLite）
- `main.py` — 旧入口
- `*.spec` — 旧 spec 文件

## 可借鉴的逻辑

- GitHub Star 导入逻辑：`backend/github_api.py`
- 项目分类/筛选逻辑：`backend/store.py`
- 图谱可视化：`frontend/graph.html`
- 主题系统：`frontend/style.css`

## 已废弃

- 不要直接运行这些代码
- 不要在此基础上开发
- 如需参考，请复制逻辑到新代码库

## 隐私与安全声明

- `archive/data/stash_users.json` 历史版本曾含真实用户邮箱、密码 SHA256 哈希与盐值。
  - 虽当前工作区已脱敏为 `[redacted]`，但 git 历史中仍可检出（详见 `docs/review/REMEDIATION_PLAN_20260806.md` §4.1.4）。
  - 本仓库 §4.1.4 已执行 `git filter-repo --replace-text` + `--invert-paths --path archive/data/stash_users.json`，
    当前可达历史中不再含真实凭据；强制推送（force-push）到 GitHub/GitLab/Gitee 三个公开远端为手动步骤，详见 `docs/review/REMEDIATION_REMAINING.md`。
- **禁止**将本目录任何文件推送到公开仓库；处理前必须先核验是否含 PII。
- `archive/data/stash_data.json`（项目画像）不含凭据 PII，但仍属用户行为数据，勿公开。