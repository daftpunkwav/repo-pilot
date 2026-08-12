# types

由 `packages/contracts/openapi.json` 生成的共享 TypeScript 类型。

```bash
# 仓库根
npm run generate:types
```

- `src/generated.ts` — openapi-typescript 输出（勿手改）
- `src/aliases.ts` — 友好别名与前端常用收紧（手写，generate 不覆盖）
- `apps/web` 通过 `types` / `@/api/types` 消费
