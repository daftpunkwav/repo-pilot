# Voyager API 服务

传统后端：**用户认证、项目管理、笔记、图谱、Overview、设置**。  
Agent 对话 HTTP 入口与推理逻辑暂在本服务（`api_backend/api/agent.py`、`api_backend/agents/`）。

版本：`2.0.0`（与根包一致）。

## 开发

```bash
# 在仓库根目录
python -m venv .venv
.venv\Scripts\activate
pip install -e "./services/api[dev]"

# 启动（端口与 apps/web Vite 代理一致：19878）
npm run dev:api
# 或：
# uvicorn api_backend.main:app --reload --host 127.0.0.1 --port 19878 --app-dir services/api
```

健康检查：`GET http://127.0.0.1:19878/health`  
API 前缀：`/api/v1`（auth / projects / categories / tags / notes / graph / overview / user / agent / github / settings）

## 目录

```
services/api/
└── api_backend/
    ├── api/         # FastAPI 路由
    ├── agents/      # Multi-Agent（Hub + 6 专家；待迁至 services/agent）
    ├── core/        # 安全、中间件
    ├── llm/         # LiteLLM BYOK
    ├── memory/      # 短期/长期记忆
    ├── models/      # SQLAlchemy 模型
    ├── schemas/     # Pydantic DTO
    ├── services/    # 业务服务层
    └── tools/       # Agent 工具注册（约 24 个内置工具）
```

实现细节见 [`docs/development/PROGRESS_REPORT.md`](../../docs/development/PROGRESS_REPORT.md)。
