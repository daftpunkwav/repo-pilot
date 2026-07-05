# RepoPilot API 服务

传统后端：**用户认证、项目管理、笔记、图谱、设置**。  
Agent 对话 HTTP 入口暂在本服务（`backend/api/agent.py`），Agent 推理逻辑在 `backend/agents/`。

## 开发

```bash
# 在仓库根目录
python -m venv .venv
.venv\Scripts\activate
pip install -e "./services/api[dev]"

# 启动（默认端口见 apps/web/vite.config.ts 代理配置）
uvicorn backend.main:app --reload --port 19876
```

## 目录

```
services/api/
└── backend/
    ├── api/         # FastAPI 路由
    ├── agents/      # Agent 实现（待迁移至 services/agent）
    ├── core/        # 安全、中间件
    ├── models/      # SQLAlchemy 模型
    ├── schemas/     # Pydantic DTO
    ├── services/    # 业务服务层
    └── tools/       # Agent 工具注册
```
