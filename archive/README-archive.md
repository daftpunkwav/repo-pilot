# Archive — RepoPilot v1.x

归档时间：2026-07-03
归档原因：v2.0 重构，保留旧实现作为参考

## 目录说明

- `backend/` — Flask 单文件后端
- `frontend/` — 原生 JS 前端
- `data/` — JSON 数据文件（已迁移到 SQLite）
- `build/` — 旧构建产物
- `dist/` — 旧打包产物
- `main.py` — 旧入口
- `*.spec` — 旧 spec 文件
- `*.txt` — 旧构建日志

## 可借鉴的逻辑

- GitHub Star 导入逻辑：`backend/github_api.py`
- 项目分类/筛选逻辑：`backend/store.py`
- 图谱可视化：`frontend/graph.html`
- 主题系统：`frontend/style.css`

## 已废弃

- 不要直接运行这些代码
- 不要在此基础上开发
- 如需参考，请复制逻辑到新代码库
