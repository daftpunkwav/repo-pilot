# API 契约

服务间与前后端的**权威 API 定义**。

## 当前状态

**占位。** 实际契约仍分散在：

- 后端 Pydantic：`services/api/backend/schemas/`
- 前端 TypeScript：`apps/web/src/api/types.ts`
- OpenAPI：可从运行中的 FastAPI `/openapi.json` 导出（开发端口 `19878`）

## 内容（规划）

- `openapi.yaml` — 由 `services/api` 导出或手写维护
- `agent-api.yaml` — Agent 服务 SSE / 对话接口
- `events/` — 跨服务事件 schema（若引入消息队列）

## 类型生成

| 目标 | 来源 |
|------|------|
| `packages/types` (TS) | openapi-generator / orval |
| `packages/py-shared` (Python) | datamodel-code-generator |

`apps/web` 应逐步改为引用 `@repopilot/types`，而非手写 `api/types.ts`。
