# RepoPilot 测试目录

按测试类型分层组织，运行方式：

```bash
# 全部后端测试
pytest test -q

# 仓库根目录（含前端）
npm run test:api
npm run test:web
```

## 目录说明

| 目录 | 说明 |
|------|------|
| `unit/` | 单元测试：纯函数、无 I/O |
| `function/` | 函数测试：单函数多场景 |
| `module/` | 模块测试：schema / 模型元数据 |
| `business/` | 业务逻辑测试：service 层 |
| `integration/` | 集成测试：HTTP API 端到端 |
| `integration/test_tags_api.py` | 标签 CRUD |
| `integration/test_settings_api.py` | 设置持久化 |
| `integration/test_profile_api.py` | 用户画像 |
| `integration/test_overview_api.py` | 总览聚合 |
| `integration/test_agent_api.py` | Agent 会话 |

## 环境

- 测试数据库：临时 SQLite 文件（每个用例隔离）
- `SECRET_KEY`：测试专用固定值，长度必须不少于 32 字节（`test/conftest.py` 在导入 backend 前注入）
