# RepoPilot 测试

后端 Python 测试目录（前端测试见 `apps/web/tests/`，Vitest + Playwright）。

## 运行

```bash
# 后端全量（pytest）
npm run test:api        # 等价: pytest tests -q

# 前端单元测试
npm run test:web

# 前端 E2E（Playwright，强制 VITE_USE_MOCK=true）
npm run test:e2e -w web

# 全量
npm run test
```

## 目录

| 子目录 | 覆盖范围 |
|------|------|
| `unit/` | 纯逻辑单测（Hub 模式 / ReAct 引擎 / Memory / SSRF / 工具权限等） |
| `function/` | 函数级测试（如图谱相似度） |
| `module/` | 模块级测试（schema / memory service / intent classifier） |
| `business/` | 业务 service 测试（auth / project） |
| `integration/` | HTTP API 集成测试（auth / projects / categories / tags / notes / graph / settings / profile / overview / agent 等） |

## 约定

- 每个测试独立 SQLite 临时文件（`tests/conftest.py` 的 `client` fixture）
- `SECRET_KEY` 等环境变量在 `tests/conftest.py` 注入；`RATE_LIMIT_ENABLED=false` 默认关闭限流，限流测试单独启用
- 前端 E2E 当前仅走 Mock 轨（`playwright.config.ts` 强制 `VITE_USE_MOCK=true`），无真实后端 e2e
