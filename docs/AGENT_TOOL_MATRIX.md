# Agent & Tool 矩阵（§4.1.12 — 文档真源）

> 所有产品/技术文档以本表为准。本文档由代码推导，定期与
> `services/api/api_backend/services/settings_service.py` (AGENT_IDS) 与
> `services/agent/agent_core/tools/builtin.py` (@tool 装饰器) 同步核对。

## Agent 列表（代码实际注册数：7）

| id | 名称 | 职责 | 实现状态 |
|----|------|------|----------|
| `hub` | 调度 | 解析用户意图、规划任务、调度专业 Agent、合并结果 | ✅ 已实现 |
| `scout` | 速览 | 10 秒级判断项目是什么、技术栈、难度、值不值得学 | ✅ 已实现 |
| `mentor` | 导师 | 复杂概念多路径讲解，按需 ask_user 反问 / quiz | ✅ 已实现 |
| `navigator` | 规划师 | 基于项目库 + 知识图谱 + 目标，规划可执行学习路线 | ✅ 已实现 |
| `curator` | 知识组织 | 分类 / 标签 / 笔记 / 进度 / 导入（reflexion 工作流） | ✅ 已实现 |
| `scribe` | 文书 | 笔记撰写、文档润色、知识沉淀 | ✅ 已实现 |
| `atlas` | 图谱 | 知识图谱构建 / 探索 / 可视化 | ✅ 已实现 |

> 不存在 `evaluator` Agent。早期 v1/v2 草稿中提及的 "Evaluator" 已在 v2 重构中
> 并入 `hub` 的评估再调度逻辑，参见 §4.2.3。

## 工具列表（代码实际 @tool 数：24）

工具全部由 `services/agent/agent_core/tools/builtin.py` 中以 `@tool` 装饰器注册。
完整名称清单（按源码出现顺序）：

1. `query_user_projects`
2. `get_project_detail`
3. `fetch_github_repo`
4. `fetch_readme`
5. `query_knowledge_graph`
6. `list_categories`
7. `suggest_category`
8. `list_notes`
9. `draft_note_outline`
10. `ask_user`
11. `manage_session_projects`
12. `propose_memory`
13. `get_learning_stats`
14. `dispatch_agent`
15. `select_import_repos`
16. `create_note`
17. `update_note`
18. `ensure_category`
19. `set_project_category`
20. `list_tags`
21. `ensure_tags`
22. `set_project_tags`
23. `update_project_progress`
24. `import_github_repos`

> 与 v1 PRD (14)、v2 PRD (19) 的旧描述差异：v2 增补知识图谱 / 笔记 / Agent
> 调度观测 / 项目导入管理四类工具后总数为 24。任何低于此数的文档表述需以
> 本表为准并修正。

## 同步流程

- 修改 `services/api/api_backend/services/settings_service.py:AGENT_IDS` → 同步本表 §Agent
- 修改 `services/agent/agent_core/tools/builtin.py`（新增/删除 `@tool`） → 同步本表 §工具
- 修订 v1/v2 PRD、PROGRESS_REPORT 之前先查本表