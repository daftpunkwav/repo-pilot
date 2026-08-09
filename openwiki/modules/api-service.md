---
type: 后端模块
title: API 服务模块
description: RepoPilot 的基于 FastAPI 的后端服务，提供 REST API、身份验证、数据库访问和智能体集成
tags: [backend, fastapi, api, rest]
openwiki:
  roles: [architecture, domain]
  source_paths: [services/api/backend/]
  symbols: [FastAPI, main, app]
---

# API 服务模块

## 概述

API 服务是一个基于 FastAPI 的后端，提供用于身份验证、CRUD 操作、项目管理和智能体集成的 REST API。它是 RepoPilot 平台的中央数据权威。

## 目录结构

```
services/api/backend/
├── api/                   # API route handlers
│   ├── agent.py          # Agent endpoints (SSE streaming)
│   ├── auth.py           # Authentication endpoints
│   ├── categories.py     # Category management
│   ├── github.py         # GitHub integration
│   ├── graph.py          # Knowledge graph endpoints
│   ├── notes.py          # Note CRUD
│   ├── overview.py       # Dashboard/overview data
│   ├── projects.py       # Project management
│   ├── settings.py       # User settings
│   ├── tags.py           # Tag management
│   └── user.py           # User profile
├── core/                  # Core utilities
│   ├── auth_cookies.py   # Cookie handling
│   ├── csrf.py           # CSRF protection
│   ├── exceptions.py     # Custom exceptions
│   ├── limiter.py        # Rate limiting
│   ├── middleware.py     # FastAPI middleware
│   ├── responses.py      # Response wrappers
│   ├── security.py       # JWT and security
│   ├── stream_cancel.py  # SSE stream cancellation
│   └── url_safety.py     # URL validation
├── models/                # SQLAlchemy ORM models
│   ├── agent.py          # Agent session/message models
│   ├── category.py       # Category model
│   ├── note.py           # Note model
│   ├── project.py        # Project and Tag models
│   └── user.py           # User and RefreshToken models
├── schemas/               # Pydantic schemas
│   ├── agent.py          # Agent request/response schemas
│   ├── category.py       # Category schemas
│   ├── common.py         # Common response wrappers
│   ├── note.py           # Note schemas
│   ├── overview.py       # Dashboard schemas
│   ├── profile.py        # Profile schemas
│   ├── project.py        # Project schemas
│   ├── settings.py       # Settings schemas
│   ├── tag.py            # Tag schemas
│   └── user.py           # User/auth schemas
├── services/              # Business logic services
│   ├── agent_catalog.py  # Agent definitions
│   ├── agent_proxy.py    # Agent forwarding
│   ├── agent_service.py  # Agent session management
│   ├── auth_service.py   # Authentication logic
│   ├── github_accounts.py# GitHub account management
│   ├── github_client.py  # GitHub API client
│   ├── graph_service.py  # Graph computation
│   ├── overview_service.py# Dashboard data
│   ├── profile_service.py# Profile management
│   ├── project_service.py# Project operations
│   ├── seed_service.py   # Database seeding
│   ├── settings_service.py# Settings operations
│   ├── sse_stream.py     # SSE formatting
│   └── tag_service.py    # Tag operations
├── ports/                 # Database abstraction layer
│   └── sqlalchemy_adapters.py # SQLAlchemy implementations
├── agents/                # Compatibility shims → agent_core
├── llm/                   # Compatibility shims → agent_core
├── memory/                # Compatibility shims → agent_core
├── tools/                 # Compatibility shims → agent_core
├── config.py             # Application configuration
├── database.py           # Database connection management
└── main.py               # FastAPI application entry
```

## 主应用程序

### FastAPI 应用配置

```python
# main.py
app = FastAPI(
    title="RepoPilot API",
    version="2.0.0",
    lifespan=lifespan
)

# Middleware
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(CsrfMiddleware)
setup_middleware(app)

# Exception handlers
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(projects.router, prefix="/api/v1")
# ... etc
```

### 生命周期事件

```python
@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Startup: Validate JWT secret, init DB, seed categories
    if len(settings.secret_key.encode("utf-8")) < 32:
        raise ValueError("SECRET_KEY must be at least 32 bytes")
    await init_db()
    await seed_preset_categories(session)
    yield
    # Shutdown cleanup
```

## API 路由

### 身份验证（`/api/v1/auth`）

| 方法 | 端点 | 描述 |
|--------|----------|-------------|
| POST | `/register` | 用户注册 |
| POST | `/login` | 用户登录（设置 httpOnly cookie） |
| POST | `/refresh` | 刷新访问令牌 |
| POST | `/logout` | 登出（清除 cookie） |
| POST | `/password` | 修改密码 |

### 项目（`/api/v1/projects`）

| 方法 | 端点 | 描述 |
|--------|----------|-------------|
| GET | `/` | 列出项目（分页、可筛选） |
| POST | `/` | 创建新项目 |
| GET | `/stats` | 项目统计信息 |
| GET | `/{id}` | 获取项目详情 |
| PUT | `/{id}` | 更新项目 |
| DELETE | `/{id}` | 删除项目 |
| POST | `/import` | 从 GitHub 导入 |
| GET | `/{id}/readme` | 从 GitHub 获取 README |

### 智能体（`/api/v1/agent`）

| 方法 | 端点 | 描述 |
|--------|----------|-------------|
| GET | `/sessions` | 列出智能体会话 |
| POST | `/sessions` | 创建新会话 |
| GET | `/sessions/{id}` | 获取会话详情 |
| PUT | `/sessions/{id}` | 更新会话 |
| DELETE | `/sessions/{id}` | 删除会话 |
| POST | `/chat` | 发送消息（SSE 流式传输） |
| POST | `/analyze` | 分析项目（SSE） |
| POST | `/classify` | 分类项目（SSE） |
| POST | `/generate-note` | 生成笔记（SSE） |

### 其他路由

- `/api/v1/categories` - 分类 CRUD
- `/api/v1/tags` - 标签管理
- `/api/v1/notes` - 笔记 CRUD
- `/api/v1/graph` - 知识图谱数据
- `/api/v1/settings` - 用户设置
- `/api/v1/user` - 个人资料管理
- `/api/v1/github` - GitHub 集成
- `/api/v1/overview` - 仪表板数据

## 安全特性

### 身份验证

- **JWT 令牌**：短期访问令牌（15 分钟）
- **刷新令牌**：长期有效并支持轮换（7 天）
- **Cookie 安全**：httpOnly、secure、sameSite=strict
- **令牌版本**：密码修改时递增，使现有令牌失效

### 速率限制

```python
# Using slowapi
@app.post("/auth/login")
@limiter.limit("5/minute")
async def login(request: Request, ...):
    ...
```

### CSRF 防护

```python
# CsrfMiddleware validates Origin/Referer for state-changing requests
# Bypasses for same-origin GET requests
```

### 输入验证

- URL 验证（仅允许 https/http，禁止私有 IP）
- 密码长度验证（bcrypt 72 字节限制）
- 通过 SQLAlchemy ORM 防止 SQL 注入
- 通过输出编码防止 XSS

## 数据库层

### 连接管理

```python
# database.py
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

engine = create_async_engine(settings.database_url)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession)
```

### 端口（Port）模式

API 使用"端口"模式进行数据库抽象：

```python
# ports/sqlalchemy_adapters.py
class ProjectPort:
    async def get_owned(self, project_id: UUID, user_id: UUID) -> Project | None:
        ...
    
    async def search(self, user_id: UUID, query: str, ...) -> list[Project]:
        ...
```

## 配置

### 设置（config.py）

```python
class Settings(BaseSettings):
    app_name: str = "RepoPilot API"
    secret_key: str  # JWT signing key
    database_url: str = "sqlite+aiosqlite:///data/repopilot.db"
    api_v1_prefix: str = "/api/v1"
    
    # Cookie settings
    cookie_secure: bool = False
    cookie_samesite: str = "lax"
    
    # Rate limiting
    rate_limit: str = "100/minute"
```

### 环境变量

```bash
SECRET_KEY="your-32-byte-secret-key"
DATABASE_URL="sqlite+aiosqlite:///data/repopilot.db"
AGENT_BASE_URL="http://127.0.0.1:19877"  # Optional standalone agent
```