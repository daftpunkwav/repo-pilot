# API 契约

服务间与前后端的**权威 API 定义**。

## 当前状态

**已启用生成流水线：**

```bash
npm run export:openapi   # → packages/contracts/openapi.json
npm run generate:types   # → packages/types/src/generated.ts
```

工具链：`openapi-typescript`。CI 入口 `npm run ci` 含生成步骤。

权威运行时 schema 仍是 FastAPI Pydantic；OpenAPI 为导出快照。
手写 `apps/web/src/api/types.ts` 可逐步改为 `import type { ... } from '@repopilot/types'`。
