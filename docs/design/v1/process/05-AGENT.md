# Phase 5 — Agent Chat

> **路由：** `/agent`, `/agent/sessions/:sessionId`  
> **前置依赖：** Gate 4（建议；可与 Gate 3 后并行但推荐晚于详情页）  
> **原型参考：** `agent.html`  
> **门禁：** Gate 5

---

## 1. 页面职责

与 6 个专业 Agent 对话：**SSE 流式输出**、工具调用展示、**5 种反问面板**、会话管理、Agent 切换。

---

## 2. 功能清单

| 功能 | 说明 |
|------|------|
| 会话侧栏 | 列表、新建、切换、删除、未读标记 |
| Agent 选择器 | Hub / Scout / Mentor / Navigator / Curator / Scribe |
| 消息列表 | user / assistant / tool / system 气泡 |
| 流式渲染 | `StreamRenderer` 逐字 + Markdown 批量 50ms |
| 思考过程 | `thinking` 事件 → 可折叠灰块 |
| 工具调用 | `ToolCallCard` 折叠 JSON |
| 反问面板 | `QuestionPanel` 5 类型 |
| 输入栏 | Textarea，Enter 发送，Shift+Enter 换行 |
| URL sessionId | 自动 `switchSession` |
| 无 LLM Key | 顶部 Banner 引导去设置（`settings.llm_configured === false`） |

### 反问类型（QuestionPanel）

| type | 组件 |
|------|------|
| radio | 单选 + optional other textarea |
| checkbox | 多选 |
| slider | 滑块 + labels |
| drag_sort | 拖拽排序 |
| knowledge_map | 树形勾选 |

类型定义以 **FRONTEND_SPEC `AgentQuestion`** 为准（扁平结构 + `question_id`）。

---

## 3. 组件树

```
AgentPage
├── SessionSidebar
│   ├── NewSessionButton
│   └── SessionItem[]
├── ChatPanel
│   ├── AgentSelector
│   ├── MessageList
│   │   ├── MessageBubble[]
│   │   ├── StreamRenderer
│   │   ├── ToolCallCard[]
│   │   └── QuestionPanel
│   └── InputBar
└── AgentInfoDrawer（可选）
```

---

## 4. Mock API

| 方法 | 说明 |
|------|------|
| `listAgentSessions` | ≥3 条 |
| `getAgentSession` | 含 messages 历史 |
| `createAgentSession` | 新建空会话 |
| `deleteAgentSession` | 删除 |
| `getAgentProfiles` | 6 Agent emoji + 描述 |
| `getPermissions` | FRONTEND_SPEC `AgentPermissions` 形状 |
| `chatAgent` | AsyncGenerator SSE |
| `answerQuestion` | 提交反问后继续 SSE |

**Mock SSE 场景（至少 3 套）：**

1. 纯文本回复（`text_delta` → `done`）
2. 带 `tool_call` + `tool_result`
3. 带 `question`（含 2 个子问题：radio + checkbox）

**事件名：** `text_delta`, `thinking`, `tool_call`, `tool_result`, `question`, `agent_switch`, `done`, `error`  
**文本字段：** `{ content: string }`

---

## 5. agentStore

完整实现 FRONTEND_SPEC §5.4：`processSSEStream`、 `pendingQuestion`、`streamingContent` 等。

---

## 6. 设计规范

| 项 | 规范 |
|----|------|
| 布局 | 左会话栏 260px + 主聊天区 |
| 用户消息 | 右对齐，品牌色底 |
| Agent 消息 | 左对齐，卡片底，emoji 头像 |
| 流式光标 | 闪烁 `▊` |
| 反问面板 | 嵌入消息流，提交前暂停 streaming |

---

## 7. 验收标准

| ID | 条件 | MVP |
|----|------|-----|
| G5-01 | 新建会话并发送消息，流式显示回复 | AC-19 |
| G5-02 | 流结束后消息固化在列表 | AC-19 |
| G5-03 | 反问 5 类型均可交互并提交 | AC-18 |
| G5-04 | 跳过反问（`allow_skip`） | AC-18 |
| G5-05 | 切换会话加载历史 | — |
| G5-06 | 删除会话确认 | — |
| G5-07 | `llm_configured=false` 显示引导 Banner | AC-14 |
| G5-08 | `data-testid` chat-input, stream-renderer, new-session-btn | E2E |
| G5-09 | agentStore 单元测试覆盖核心 SSE 分支 | §11 |

---

## 8. 审查重点（安全/性能）

- Agent Markdown 不走 `dangerouslySetInnerHTML`
- 流式 Markdown 批量渲染防卡顿
- 错误 SSE → Toast，Input 恢复可用
- 超长会话列表考虑虚拟滚动（>100 条时）
