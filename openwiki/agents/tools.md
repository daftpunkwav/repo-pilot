---
type: 参考
title: 智能体工具参考
description: RepoPilot 中智能体可用的全部 24 个内置工具的完整参考，含参数、授权 Agent 与写权限门控
tags: [agent, tools, reference, api]
openwiki:
  roles: [domain, integration]
  source_paths: [services/agent/agent_core/tools/builtin.py, services/agent/agent_core/tools/registry.py]
  symbols: [tool, ToolRegistry, global_registry, TOOL_PERMISSION_MAP]
  invariants: [工具在 builtin.py 模块导入时通过 @tool 装饰器注册到 global_registry；写库工具受 required_permission 门控，ToolRegistry.execute 执行前检查用户授权]
---

# 智能体工具参考

## 概述

智能体可使用 **24 个内置工具**，全部定义于 `services/agent/agent_core/tools/builtin.py`，通过 `@tool(...)` 装饰器在模块导入时注册到 `global_registry`（`tools/registry.py` 的 `ToolRegistry` 单例，注册路径有线程锁保护）。

每个工具声明：

- `name` / `description`：暴露给 LLM 的工具名与中文说明
- `parameters`：JSON Schema 参数定义
- `allowed_agents`：允许调用的 Agent 白名单
- `timeout_ms`：执行超时（默认 30s）
- `required_permission`：可选写权限门控（见下文）

## 权限门控

写库工具声明 `required_permission`，`ToolRegistry.execute` 在执行前通过 `TOOL_PERMISSION_MAP` 检查 `context.permissions`：

| 权限键 | 门控的工具 |
|--------|-----------|
| `allow_github_api` | `fetch_github_repo`、`fetch_readme` |
| `allow_note_write` | `create_note`、`update_note` |
| `allow_project_write` | `ensure_category`、`set_project_category`、`ensure_tags`、`set_project_tags`、`update_project_progress`、`import_github_repos` |

权限默认值见 `_PERMISSION_DEFAULTS`（`allow_github_api`、`allow_note_write`、`allow_project_write` 默认开启，`allow_file_write` 默认关闭）；用户未显式设置时按默认值放行。权限不足时返回 `{"error": "权限不足：…"}`，不会执行 handler。

## 项目查询工具

### query_user_projects

搜索和筛选用户的项目库。

**参数：**
| 名称 | 类型 | 描述 |
|------|------|-------------|
| `query` | string | 搜索关键词 |
| `language` | string | 按编程语言筛选 |
| `progress` | string | 按学习进度筛选：`none`、`learning`、`learned`、`mastered` |
| `limit` | integer | 最大结果数（默认 20，服务端上限 50） |

**返回值：** `{"count": n, "projects": [{id, name, url, language, stars, progress, description, category_id}]}`

**允许使用的智能体：** scout、mentor、navigator、curator、scribe、hub、atlas（超时 10s）

### get_project_detail

获取用户项目库中单个项目的详细信息。`project_id` 必须是 UUID；误传 `owner/repo` 时仅在用户库内按名称回退，否则返回改用 GitHub 工具的 hint。

**参数：**
| 名称 | 类型 | 描述 |
|------|------|-------------|
| `project_id` | string（必填） | 项目 UUID（勿传 owner/repo） |

**返回值：** 项目详情（含描述、笔记、来源、分类）

**允许使用的智能体：** scout、mentor、navigator、curator、scribe、hub、atlas

## GitHub 工具

### fetch_github_repo

通过 GitHub API 获取公开仓库元数据（库外速览用）。未传参数时可回退到会话绑定项目的 URL。

**参数：**
| 名称 | 类型 | 描述 |
|------|------|-------------|
| `owner` | string | 仓库所有者 |
| `repo` | string | 仓库名称 |
| `full_name` | string | 形如 `owner/repo`，可替代 owner+repo |

**允许使用的智能体：** scout、mentor、curator、hub、navigator（超时 15s）

### fetch_readme

获取 GitHub 仓库 README 文本（截断）。

**参数：**
| 名称 | 类型 | 描述 |
|------|------|-------------|
| `owner` | string | 仓库所有者 |
| `repo` | string | 仓库名称 |
| `full_name` | string | 形如 `owner/repo` |
| `max_chars` | integer | 截断长度（默认 6000） |

**返回值：** `{owner, repo, readme, truncated}`

**允许使用的智能体：** scout、mentor、scribe、curator（超时 15s）

## 知识图谱工具

### query_knowledge_graph

查询用户项目知识图谱：相似项目、关联边。传 `project_id` 时只返回该中心项目的邻域子图。

**参数：**
| 名称 | 类型 | 描述 |
|------|------|-------------|
| `project_id` | string | 中心项目，可选 |
| `min_similarity` | number | 相似度阈值（默认 0.3） |
| `limit` | integer | 最大边数（默认 20，全图节点上限 50） |

**允许使用的智能体：** scout、mentor、navigator、scribe、atlas、hub

## 组织工具（分类 / 标签 / 进度）

### list_categories

列出用户的项目分类（含预设分类标记）。无参数。

**允许使用的智能体：** curator、hub、navigator、scout

### suggest_category

仅作分类澄清/候选展示，**不落库**；意图明确时应改用 `set_project_category` 直接写入。

**参数：** `project_id`、`category_name`（必填）、`reason`、`confidence`

**返回值：** `{suggestion: {..., status: "pending_user_confirm"}}`

**允许使用的智能体：** curator

### ensure_category

确保分类存在：按名称查找预设或用户分类，不存在则创建用户分类。需要 `allow_project_write`。

**参数：** `name`（必填）、`icon`、`color`

**允许使用的智能体：** curator

### set_project_category

为项目设置分类并立即写入数据库；可传 `category_id` 或 `category_name`（名称不存在时自动创建）。需要 `allow_project_write`。

**参数：** `project_id`（必填）、`category_id`、`category_name`

**允许使用的智能体：** curator

### list_tags

列出当前用户的全部标签及引用计数。无参数。

**允许使用的智能体：** curator、hub、navigator、scribe

### ensure_tags

按名称确保标签存在，不存在则创建；返回标签 id 列表。需要 `allow_project_write`。

**参数：** `names`（必填，字符串数组）

**允许使用的智能体：** curator

### set_project_tags

为项目设置标签并写入数据库。可传 `tag_ids`（校验归属，含无效 id 时整体中止）或 `tag_names`（自动 ensure）；`mode=replace` 替换全部，`mode=add` 追加。需要 `allow_project_write`。

**参数：** `project_id`（必填）、`tag_ids`、`tag_names`、`mode`（`replace`/`add`，默认 `replace`）

**允许使用的智能体：** curator

### update_project_progress

更新项目学习进度并写入数据库。需要 `allow_project_write`。

**参数：** `project_id`（必填）、`progress`（必填：`none`/`learning`/`learned`/`mastered`）

**返回值：** 含 `previous_progress` 的操作结果

**允许使用的智能体：** curator、navigator、mentor

## 笔记工具

### list_notes

列出用户笔记，可按项目过滤。

**参数：** `project_id`（可选）、`limit`（默认 10，上限 30）

**允许使用的智能体：** scribe、mentor、navigator、hub

### draft_note_outline

生成笔记大纲草稿（不直接写入数据库）。

**参数：** `title`（必填）、`sections`（必填，章节标题数组）、`compare_with`（可选，对比的已学项目名）

**返回值：** `{title, markdown, mode: "draft"}`

**允许使用的智能体：** scribe

### create_note

真正创建并保存一篇笔记（写入数据库）。对比笔记挂到主 `project_id`，`compare_project_ids` 写入结果元数据。需要 `allow_note_write`。

**参数：** `project_id`（必填）、`title`（必填，上限 256 字符）、`content`（必填，Markdown，上限 100k 字符）、`compare_project_ids`（可选 UUID 数组）

**返回值：** `_action_result("note_created")`，含笔记 resource 与跳转链接

**允许使用的智能体：** scribe

### update_note

更新已有笔记的标题和/或正文（真实写入数据库）。需要 `allow_note_write`。

**参数：** `note_id`（必填）、`title`、`content`

**允许使用的智能体：** scribe

## 导入工具

### select_import_repos

导入场景专用：在左侧列表中勾选/取消勾选仓库（**不真正导入**）；与上下文 `available_repo_keys` 求交。用户明确要求导入时改用 `import_github_repos`。

**参数：** `repo_keys`（必填，`owner/repo` 数组）、`action`（`set`/`add`/`remove`，默认 `set`）、`reason`（展示给用户）

**返回值：** `__select_repos__` 标记的操作结果

**允许使用的智能体：** curator、scout、hub、navigator

### import_github_repos

真正将 GitHub 仓库导入用户项目库（写入数据库）。需要 `allow_project_write`。

**参数：** `repos`（必填，每项为 `owner/repo` 字符串或 `{owner, repo, url}` 对象）

**允许使用的智能体：** curator（超时 120s）

## 用户交互与会话工具

### ask_user

特殊工具：返回 `__question__` 标记，由 ReAct 引擎拦截并暂停流程等待用户回答。澄清需求用 `single_choice`；只有考察掌握度才用 `quiz`。`options` 必须是非空完整选项文案数组（运行时会二次清洗损坏的字符数组）。

**参数：**
| 名称 | 类型 | 描述 |
|------|------|-------------|
| `title` | string（必填） | 问题面板标题 |
| `items` | array（必填） | 问题列表，每项含 `id`/`prompt`/`type`/`options` |
| `allow_skip` | boolean | 是否允许跳过（默认 true） |

**item.type：** `single_choice` | `multi_choice` | `scale` | `text` | `quiz`（quiz 的选项对象可带 `correct=true` 供批改）

**允许使用的智能体：** mentor、navigator、hub、curator、scout、scribe

### manage_session_projects

管理当前会话绑定的项目上下文（可多选）。

**参数：** `action`（必填：`add`/`remove`/`set`）、`project_ids`（必填，UUID 数组）

**允许使用的智能体：** hub、navigator、mentor、scout、curator、scribe、atlas

### propose_memory

向 Hub 提交记忆/画像更新提案（**不会立即写入**；需用户在侧栏确认）。

**参数：** `value`（必填）、`kind`（必填：`long_memory`/`profile_tech`/`preference`）、`confidence`（默认 0.7）、`evidence`（字符串数组）

**返回值：** `__memory_proposal__` 标记，`accepted: false, pending: true`

**允许使用的智能体：** scout、mentor、navigator、curator、scribe、hub、atlas

### get_learning_stats

获取用户学习统计：项目数、进度分布、语言分布、笔记数等。无参数。

**允许使用的智能体：** navigator、hub、mentor、atlas

## 调度工具

### dispatch_agent

**Hub 专用**：将子任务派发给专家 Agent。返回 `__dispatch__` 标记，由 Hub 编排层实际执行。运行时以 `AgentRegistry` 为准校验目标（schema 枚举是静态白名单，新增 Agent 后可能滞后）；`task` 超过 4000 字符会被截断并记录（防 prompt 注入放大）。

**参数：** `target_agent`（必填：scout/mentor/navigator/curator/scribe/atlas）、`task`（必填，结构化任务说明：目标/约束/禁止/期望产出）、`reason`

**允许使用的智能体：** hub

## 新增工具

在 `builtin.py` 中用 `@tool(...)` 装饰器定义 async handler 即可（导入即注册）：

```python
from agent_core.tools.registry import tool

@tool(
    name="my_tool",
    description="工具说明",
    parameters={"type": "object", "properties": {...}},
    allowed_agents=["hub", "scout"],
    timeout_ms=10_000,
    required_permission="allow_project_write",  # 写库工具才需要
)
async def my_tool(context=None, param1: str = "", **kw):
    return {"result": "success"}
```

注意同步更新：目标 Agent 在 `agents/registry.py` `AGENT_DEFINITIONS` 中的 `tools` 白名单；写操作还需在 `TOOL_PERMISSION_MAP` 中登记权限键。聚焦验证：根目录 `npm run test:api`（pytest），无需跑完整 CI。
