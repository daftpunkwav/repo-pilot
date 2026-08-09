---
type: API 参考
title: REST API 参考
description: RepoPilot 的完整 REST API 参考，包括认证、项目、智能体（Agent）和资源端点
tags: [api, rest, endpoints, reference]
openwiki:
  roles: [integration]
  source_paths: [services/api/backend/api/]
---

# REST API 参考

## 基础 URL

```
Development: http://127.0.0.1:19878/api/v1
Production: https://api.repopilot.example.com/api/v1
```

## 认证

除 `/auth/login`、`/auth/register`、`/auth/refresh` 外，所有端点都需要通过以下方式之一进行认证：

1. **httpOnly Cookie**（浏览器客户端首选）
2. **Authorization 请求头**：`Bearer <access_token>`

### 响应格式

成功：
```json
{
  "code": 0,
  "message": "success",
  "data": { ... }
}
```

错误：
```json
{
  "code": 4001,
  "message": "Error description",
  "data": null
}
```

分页：
```json
{
  "code": 0,
  "message": "success",
  "data": { ... },
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 100,
    "total_pages": 5
  }
}
```

---

## 认证端点

### POST /auth/register

注册新用户。

**请求：**
```json
{
  "username": "string (3-32 chars)",
  "password": "string (8-72 bytes)",
  "email": "optional@example.com"
}
```

**响应：** `TokenOut`

### POST /auth/login

用户认证。

**请求：**
```json
{
  "username": "string",
  "password": "string",
  "remember_me": false
}
```

**响应：** `TokenOut` + 设置 httpOnly Cookie

### POST /auth/refresh

刷新访问令牌。

**请求：**（Cookie 或请求体中包含 `refresh_token`）

**响应：** `AccessTokenOut`

### POST /auth/logout

用户登出。

**响应：** 成功 + 清除 Cookie

### POST /auth/password

修改密码。

**请求：**
```json
{
  "old_password": "string",
  "new_password": "string (8-72 bytes)"
}
```

---

## 项目端点

### GET /projects

列出用户的项目。

**查询参数：**
| 参数 | 类型 | 说明 |
|-------|------|-------------|
| `keyword` | string | 在名称/描述中搜索 |
| `lang` | string | 按语言筛选 |
| `category_id` | UUID | 按分类筛选 |
| `tag_id` | UUID | 按标签筛选 |
| `progress` | string | 按进度状态筛选 |
| `star_min` | int | 最小 star 数 |
| `star_max` | int | 最大 star 数 |
| `sort` | string | 排序字段 |
| `page` | int | 页码（默认：1） |
| `page_size` | int | 每页条数（默认：20） |

**响应：** `PaginatedResponse[ProjectOut]`

### GET /projects/stats

获取项目统计信息。

**响应：** `ProjectStats`

```json
{
  "total": 50,
  "by_progress": {
    "none": 20,
    "learning": 15,
    "learned": 10,
    "mastered": 5
  },
  "by_language": {
    "Python": 20,
    "JavaScript": 15
  }
}
```

### POST /projects

创建新项目。

**请求：** `ProjectCreate`
```json
{
  "name": "string (1-128 chars)",
  "url": "https://github.com/owner/repo",
  "description": "optional string",
  "category_id": "optional UUID",
  "stars": 0,
  "language": "optional string",
  "progress": "none|learning|learned|mastered",
  "source": "manual|github",
  "tags": ["tag1", "tag2"]
}
```

### GET /projects/{id}

获取项目详情。

**响应：** `ProjectOut`

### PUT /projects/{id}

更新项目。

**请求：** `ProjectUpdate`（部分更新）

### DELETE /projects/{id}

删除项目。

### POST /projects/import

从 GitHub 导入项目。

**请求：**
```json
{
  "repos": [
    {"owner": "facebook", "repo": "react"}
  ],
  "auto_categorize": true
}
```

---

## 智能体（Agent）端点

### GET /agent/sessions

列出智能体会话。

**响应：** `list[AgentSessionOut]`

### POST /agent/sessions

创建新会话。

**响应：** `AgentSessionOut`

### GET /agent/sessions/{id}

获取会话详情（含消息）。

**响应：** `AgentSessionDetailOut`

### PUT /agent/sessions/{id}

更新会话。

**请求：**
```json
{
  "title": "optional string",
  "project_id": "optional UUID",
  "project_ids": ["optional UUID array"],
  "active_agent": "optional string"
}
```

### DELETE /agent/sessions/{id}

删除会话。

### POST /agent/chat

向智能体发送消息（SSE 流式响应）。

**请求：** `AgentChatRequest`
```json
{
  "session_id": "optional UUID",
  "message": "string (1-8000 chars)",
  "project_id": "optional UUID",
  "preferred_agent": "optional string"
}
```

**响应：** Server-Sent Events 流

```
event: switch
id: 1
data: {"target_agent": "scout", "reason": "Analyzing repository..."}

event: thinking
id: 2
data: {"content": "User wants to understand the project..."}

event: text
id: 3
data: {"content": "This project is..."}

event: done
id: 4
data: {}
```

### POST /agent/analyze

分析项目（SSE 流式响应）。

**请求：**
```json
{
  "depth": "quick|deep",
  "force_refresh": false,
  "agent_id": "optional string"
}
```

### POST /agent/classify

自动分类项目。

**请求：**
```json
{
  "project_id": "UUID",
  "user_hint": "optional string"
}
```

### POST /agent/generate-note

生成学习笔记。

**请求：**
```json
{
  "project_id": "UUID",
  "mode": "project|standalone",
  "topic": "optional string"
}
```

### POST /agent/question

回答交互式问题。

**请求：** `AgentQuestionAnswer`
```json
{
  "question_id": "string",
  "answers": {"key": "value"},
  "skipped": false,
  "session_id": "optional UUID"
}
```

---

## 分类端点

### GET /categories

列出分类。

**响应：** `list[CategoryOut]`

### POST /categories

创建分类。

**请求：** `CategoryCreate`

### PUT /categories/{id}

更新分类。

### DELETE /categories/{id}

删除分类。

---

## 标签端点

### GET /tags

列出标签。

**响应：** `list[TagOut]`

### POST /tags

创建标签。

**请求：** `TagCreate`

### DELETE /tags/{id}

删除标签。

---

## 笔记端点

### GET /notes

列出笔记。

**查询参数：** `project_id`（可选）

**响应：** `list[NoteOut]`

### POST /notes

创建笔记。

**请求：** `NoteCreate`
```json
{
  "title": "string (1-256 chars)",
  "content": "string (max 100000 chars)"
}
```

### GET /notes/{id}

获取笔记。

**响应：** `NoteOut`

### PUT /notes/{id}

更新笔记。

**请求：** `NoteUpdate`

### DELETE /notes/{id}

删除笔记。

---

## 图谱端点

### GET /graph

获取知识图谱数据。

**响应：**
```json
{
  "nodes": [
    {"id": "...", "type": "project", "label": "...", "data": {...}}
  ],
  "edges": [
    {"source": "...", "target": "...", "type": "...", "weight": 1.0}
  ]
}
```

### POST /graph/guide

获取图谱讲解（SSE）。

**请求：**
```json
{
  "message": "string",
  "selected_node_id": "optional string"
}
```

---

## 设置端点

### GET /settings

获取用户设置。

**响应：** `SettingsOut`

### PUT /settings

更新设置。

**请求：**
```json
{
  "llm": {
    "provider": "openai",
    "model": "gpt-4",
    "api_key": "sk-..."
  },
  "agent": {
    "speaking_style": "gentle",
    "auto_confirm": false
  }
}
```

---

## 用户端点

### GET /user/me

获取当前用户资料。

**响应：** `UserOut`

### PUT /user/me

更新用户资料。

**请求：** `UserUpdate`

### GET /user/profile

获取 AI 用户画像（供智能体使用）。

**响应：** `ProfileOut`

---

## GitHub 端点

### GET /github/bind

获取 GitHub 绑定状态。

### POST /github/bind

绑定 GitHub 账户。

**请求：**
```json
{"access_token": "ghp_..."}
```

### DELETE /github/bind

解绑 GitHub 账户。

### GET /github/stars

获取用户的 GitHub 已 star 仓库。

**查询参数：** `page`、`per_page`

**响应：** `list[GitHubRepo]`