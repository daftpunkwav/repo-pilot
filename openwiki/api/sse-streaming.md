---
type: API 参考
title: SSE 流式协议
description: RepoPilot 中用于智能体实时通信的 Server-Sent Events 流式协议
tags: [api, sse, streaming, real-time, agent]
openwiki:
  roles: [integration]
  source_paths: [services/api/backend/services/sse_stream.py, services/api/backend/agents/stream_events.py]
---

# SSE 流式协议

## 概述

RepoPilot 使用 Server-Sent Events（SSE）实现智能体的实时通信。这使得 AI 生成的内容能够渐进式传输，包括思考过程、工具调用和最终回复。

## 连接

```
POST /api/v1/agent/chat
Content-Type: application/json
Authorization: Bearer <token>
Accept: text/event-stream
```

响应头：
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

## 事件格式

```
event: <event_type>
id: <sequence_number>
data: <json_payload>

```

## 事件类型

### `switch`

智能体切换通知。

```json
{
  "target_agent": "scout",
  "reason": "Analyzing repository structure..."
}
```

**字段：**
- `target_agent`：被派发的智能体 ID
- `reason`：切换原因的可读说明

### `subagent_start`

子智能体开始执行。

```json
{
  "target": "scout",
  "task_summary": "Quick analysis of facebook/react"
}
```

### `subagent_end`

子智能体执行完成。

```json
{
  "target": "scout",
  "summary": "Analysis completed: React is a UI library..."
}
```

### `thinking`

智能体的内部推理过程（对用户可见）。

```json
{
  "content": "The user wants to understand React's architecture. I should fetch the README first, then look at the project structure..."
}
```

### `text`

文本内容片段（流式响应）。

```json
{
  "content": "React is a JavaScript library for building user interfaces."
}
```

### `tool_call`

工具调用。

```json
{
  "tool": "fetch_github_repo",
  "params": {
    "owner": "facebook",
    "repo": "react"
  }
}
```

### `tool_result`

工具执行结果。

```json
{
  "tool": "fetch_github_repo",
  "status": "success",
  "result": {
    "name": "react",
    "stars": 220000,
    "language": "JavaScript"
  }
}
```

出错时：
```json
{
  "tool": "fetch_github_repo",
  "status": "error",
  "error": "Repository not found"
}
```

### `question`

面向用户的交互式问题。

```json
{
  "question_id": "q_12345",
  "type": "choice",
  "title": "What's your experience level?",
  "items": [
    {
      "key": "level",
      "question": "How experienced are you with React?",
      "type": "choice",
      "options": ["Beginner", "Intermediate", "Advanced"]
    }
  ]
}
```

**问题类型：**
- `choice`：多选项选择
- `text`：自由文本输入
- `slider`：数值范围选择
- `quiz`：带评分的多问题测验

### `run_trace`

用于调试的执行轨迹。

```json
{
  "agent_id": "scout",
  "iterations": 3,
  "tools_called": ["fetch_github_repo", "fetch_readme"],
  "duration_ms": 2500
}
```

### `action_result`

UI 操作的结果。

```json
{
  "action": "create_note",
  "success": true,
  "data": {
    "note_id": "uuid",
    "title": "React Architecture Notes"
  }
}
```

### `done`

流结束。

```json
{}
```

### `error`

发生错误。

```json
{
  "code": "AGENT_ERROR",
  "message": "Failed to analyze repository"
}
```

## 完整示例

```
event: switch
id: 1
data: {"target_agent": "scout", "reason": "User wants quick project overview"}

event: thinking
id: 2
data: {"content": "【Scout】Fetching repository metadata..."}

event: tool_call
id: 3
data: {"tool": "fetch_github_repo", "params": {"owner": "facebook", "repo": "react"}}

event: tool_result
id: 4
data: {"tool": "fetch_github_repo", "status": "success", "result": {"name": "react", "stars": 220000}}

event: thinking
id: 5
data: {"content": "Got metadata. Now fetching README for more details..."}

event: tool_call
id: 6
data: {"tool": "fetch_readme", "params": {"owner": "facebook", "repo": "react"}}

event: tool_result
id: 7
data: {"tool": "fetch_readme", "status": "success", "result": {"content": "# React..."}}

event: text
id: 8
data: {"content": "React is a JavaScript library for building user interfaces. Created by Facebook, it has 220k+ stars on GitHub."}

event: done
id: 9
data: {}
```

## 客户端实现

### JavaScript 示例

```typescript
const response = await fetch('/api/v1/agent/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    message: 'Tell me about React',
    session_id: sessionId
  })
});

const reader = response.body?.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader!.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  const events = parseSSE(chunk);
  
  for (const event of events) {
    switch (event.event) {
      case 'text':
        appendToChat(event.data.content);
        break;
      case 'thinking':
        showThinking(event.data.content);
        break;
      case 'tool_call':
        showToolCall(event.data.tool);
        break;
      case 'done':
        finalizeMessage();
        break;
    }
  }
}
```

### 事件解析器

```typescript
function parseSSE(data: string): SSEEvent[] {
  const events: SSEEvent[] = [];
  const lines = data.split('\n');
  
  let currentEvent: Partial<SSEEvent> = {};
  
  for (const line of lines) {
    if (line.startsWith('event: ')) {
      currentEvent.type = line.slice(7);
    } else if (line.startsWith('id: ')) {
      currentEvent.id = parseInt(line.slice(4));
    } else if (line.startsWith('data: ')) {
      try {
        currentEvent.data = JSON.parse(line.slice(6));
      } catch {
        currentEvent.data = line.slice(6);
      }
    } else if (line === '') {
      if (currentEvent.type) {
        events.push(currentEvent as SSEEvent);
      }
      currentEvent = {};
    }
  }
  
  return events;
}
```

## 取消

客户端可以取消正在进行的流：

```typescript
// Send cancellation request
await fetch(`/api/v1/agent/sessions/${sessionId}/cancel`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
});
```

服务器将以下列事件终止流：
```
event: error
id: 10
data: {"code": "CANCELLED", "message": "Stream cancelled by user"}
```

## 错误处理

| 错误代码 | 描述 | 处理方式 |
|------------|-------------|--------|
| `AGENT_ERROR` | 智能体执行失败 | 重试或联系支持 |
| `RATE_LIMITED` | 请求过多 | 等待后重试 |
| `INVALID_SESSION` | 会话不存在 | 创建新会话 |
| `CANCELLED` | 流已取消 | 正常终止 |
| `TIMEOUT` | 请求超时 | 使用更短的消息重试 |