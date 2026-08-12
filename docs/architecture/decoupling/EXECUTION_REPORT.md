# RepoPilot 服务脱耦与删用户系统 —— 执行报告

> 版本： 2026-08-09 | 状态： **已实施**
>
> 本文是一份**可直接照做的执行报告**，目标读者是接手实施的工程师或 AI Agent。包含：排查证据、整体设计、核心代码、改动位置（file:line）、报错码表、执行顺序。
>
> 前提：RepoPilot 是**纯本地单机应用**，用户本机安装即用，不发布云端、不考虑多用户。

---

## 目录

1. [目标与设计原则](#1-目标与设计原则)
2. [排查结论（现状证据）](#2-排查结论现状证据)
3. [整体设计](#3-整体设计)
4. [报错码体系](#4-报错码体系)
5. [执行任务 A：后端模块容错挂载](#5-执行任务-a后端模块容错挂载)
6. [执行任务 B：前端错误码与友好降级](#6-执行任务-b前端错误码与友好降级)
7. [执行任务 C：删用户系统](#7-执行任务-c删用户系统)
8. [执行任务 D：Agent 服务运行时隔离](#8-执行任务-dagent-服务运行时隔离)
9. [报错码表](#9-报错码表)
10. [执行顺序与验收](#10-执行顺序与验收)
11. [风险与回滚](#11-风险与回滚)

---

## 1. 目标与设计原则

### 1.1 目标

1. **故障隔离**：任一服务/模块坏了，其他服务/模块都能正常启动与运行。具体：
   - Agent 服务坏 → 项目导入仍可用（仅 Agent 辅助导入不可用，弹友好通知 + 报错码）
   - 图谱服务坏 → 笔记/项目/Agent 照常
   - 任何模块 import 失败 → app 仍启动，该模块路由标记不可用，其余路由正常
2. **友好报错**：服务不可用时前端弹友好通知，附报错码；用户可凭码查表定位。
3. **删用户系统**：纯本地单机无多用户，删除认证/用户体系；但**保留学习画像**（Agent 共享）与设置（在个人主页）。
4. **预留接口**：未来 MCP 服务可平滑接入。

### 1.2 设计原则

- **模块级故障隔离，不拆物理进程**：纯本地单机，无需多进程/微服务（过度设计）。在单进程内做到"模块挂载容错 + 运行时依赖降级"。
- **单向依赖守恒**：业务服务（project/note/graph）**不 import** agent_service；agent 工具经 ports 访问业务。此边界已存在，须守恒。
- **错误码贯穿全链路**：后端 `detail.code` → 前端 `error.code` → toast 显示 `[码] 友好提示` → 用户查表。
- **删用户系统不删数据所有权语义**：`user_id` 字段可保留为"本地学习者 ID"（单例），避免大规模 FK 拆除；删除的是**认证流程**（登录/注册/token/密码），不是数据维度。

---

## 2. 排查结论（现状证据）

### 2.1 启动期耦合（最严重短板）

**`main.py:25-35` 顶部平铺 import 所有 router：**
```python
from api_backend.api import (
    agent, auth, categories, github, graph, notes, overview, projects,
    settings as settings_api, tags, user,
)
```
任一 router 模块 import 时抛异常（如 agent 依赖的 litellm 缺失、graph 引擎客户端未装），**整个 app 起不来**，所有服务连带不可用。这是"图谱坏了影响笔记"的根因。

**`lifespan`（`main.py:37-45`）只做 `init_db()` + `seed_preset_categories()`**，不初始化 agent/llm/graph——这些是请求期懒加载。✅ 这点有利，运行期各服务天然独立。

**Agent tools 注册在 `agent_service.py:28` 模块 import 时副作用执行** `ensure_tools_loaded()`。即 agent_service 被 import 时工具就注册了，不在 lifespan 内。若 agent_core 有问题，import 阶段就炸。

### 2.2 运行时耦合

**业务→agent 是单向**：`project_service` / `note_service` / `graph_service` **都不 import agent_service**（grep 确认无反向耦合）。✅ agent 挂了业务不受影响。

**agent_service.py 是 1558 行巨型模块**（`services/api/api_backend/services/agent_service.py`），`stream_import_assist`（out_degree 23）、`stream_chat`（out_degree 19）跨服务耦合重。

### 2.3 前端错误处理现状（关键缺口）

| 项 | 现状 | 位置 | 缺口 |
|----|------|------|------|
| HTTP 错误 | 统一抛 `ApiRequestError(code='API_ERROR', message)` | `apps/web/src/api/real/http.ts:69,202` | **code 恒为 'API_ERROR'**，后端 `detail.code` 被丢弃 |
| 错误消息解析 | `extractApiErrorMessage` 只取 message | `http.ts:47-64` | **丢弃 detail.code**（:55-57） |
| 错误码映射表 | **不存在** | — | 无 `code→友好提示` 映射 |
| Toast | `useUIStore.addToast` 3 秒自动消失 | `stores/uiStore.ts:64-72` | 各页面 catch 写死中文文案，无码 |
| Agent 降级 | EmbedAgentChat 失败仅面板内显示错误条 | `EmbedAgentChat.tsx:213-221` | `ImportAgentModal.agentPanel` 必填，无法隐藏面板 |
| 导入 fallback | ImportUrlsModal 有逐个创建 fallback | `ImportUrlsModal.tsx:148-163` | fallback 吞掉原始错误；ImportStarsDrawer 无 fallback |
| ErrorBoundary | 全局唯一，包裹 RouterProvider | `App.tsx:192` | 页面级无独立边界；reset 不重拉 chunk |

**核心结论**：前端**没有任何错误码机制**，所有错误靠写死中文文案，无法做"按码降级"。

### 2.4 User 表耦合面（删用户系统爆炸半径）

**`User` 表（`models/user.py`）混装多职责**：
- 认证：`username` / `password_hash` / `token_version`
- GitHub 集成：`github_accounts`（JSON，存加密 PAT）
- Agent 权限：`agent_permissions`（JSON）
- 设置：`settings_json`（JSON，存 LLM 配置 + agent 配置 + github_stars_cache）

**`get_current_user`（`api/deps.py:54-110`）被全部 11 个 api 模块 `Depends`**：auth/agent/categories/notes/github/projects/overview/settings/tags/user/graph。删 User 表则所有端点 401。

**`user_id` FK 扎根**：projects/notes/categories/agent_sessions/user_profiles 全 `ForeignKey("users.id")`。

**学习画像 `UserProfile` 已是独立表**（`models/agent.py:33`，`__tablename__="user_profiles"`），仅 FK 到 users.id。✅ 可保留。

**关键发现**：`api/user.py` 文件名叫"用户画像 API"，实际是**学习画像**（`/user/profile` → `UserProfile`/`MemoryService`）。语义上属 Agent 画像域，删用户系统时该留。

**token 完全存于 `User.github_accounts` JSON**（`services/github_accounts.py:44 primary_token` 解密），无独立 `user_github_accounts` 表。`github_client.py` 本身不耦合 User（纯 HTTP 客户端，token 作参数传入）。

### 2.5 数据层

- `init_db()`（`database.py:73-91`）：`alembic upgrade head`，不 create_all。
- migrations 在 `services/api/api_backend/migrations/alembic/versions/`，4 个版本，初始 `6096bed38e20`。
- `alembic.ini` 在仓库根。
- 启动期无其他初始化（agent tools 在 import 时注册）。

---

## 3. 整体设计

### 3.1 三层故障隔离

```
┌─────────────────────────────────────────────────────────────┐
│ 层 1：启动期容错（任务 A）                                    │
│   main.py 路由按域懒加载 + 单域失败不阻塞 app 启动             │
│   失败的域记入 MODULE_STATUS，其路由返回 503 + 报错码           │
├─────────────────────────────────────────────────────────────┤
│ 层 2：运行时降级（任务 B/D）                                   │
│   前端按错误码降级：agent 坏 → 隐藏 agent 面板 + toast 码       │
│   后端 agent 端点 try/except → 返回结构化错误码                │
├─────────────────────────────────────────────────────────────┤
│ 层 3：数据层解耦（任务 C）                                    │
│   删认证流程，保留 user_id 维度（单例本地学习者）              │
│   User 表字段拆分到独立表（settings/profile/github_accounts） │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 错误码流转

```
后端异常
  → raise HTTPException(status, detail={"code":"AGENT_LLM_UNAVAILABLE","message":...})
  → 响应体 {"detail":{"code":"AGENT_LLM_UNAVAILABLE","message":"..."}}
前端 http.ts
  → ApiRequestError(code="AGENT_LLM_UNAVAILABLE", message="...")  // 改造：保留后端 code
  → 错误码映射表 errorCodes.ts: code → {title, hint, severity}
前端页面 catch
  → addToast({type:'error', code:'AGENT_LLM_UNAVAILABLE'})  // 改造：toast 带 code
  → 渲染 "[AGENT_LLM_UNAVAILABLE] Agent 服务暂不可用，已切换手动模式"
用户
  → 凭码查 docs 报错码表（§9）定位排查
```

### 3.3 删用户系统后的鉴权模型

纯本地单机，**不删除 `user_id` 数据维度**（避免大规模 FK 拆除），而是：
- **删除认证流程**：注册/登录/刷新/登出/改密/CSRF/限流中间件/JWT/RefreshToken 表
- **保留单例本地学习者**：`users` 表保留 1 行固定记录（启动期自动确保），`user_id` 作为数据归属维度保留
- **`get_current_user` → `get_local_user`**：不再校验 token，直接返回单例 User（纯本地，无认证需求）
- **前端删除登录/注册页与 ProtectedRoute 重定向**，直接进入应用

这样改动面从"拆 11 个模块的 FK"降到"替换 1 个依赖函数 + 删 auth 路由"，爆炸半径可控。

---

## 4. 报错码体系

### 4.1 命名规范

`<域>_<原因>`，全大写下划线。域前缀见 [`ERROR_CODES.md`](./ERROR_CODES.md)。完整码表**仅**维护在该文件与同步实现中，勿在本报告复制。

### 4.2 后端错误响应统一格式

所有业务异常用统一格式（已有 `core/responses.py` 的 `wrap_data`，错误侧补 `wrap_error`）：

```python
# 新增：services/api/api_backend/core/responses.py
def wrap_error(code: str, message: str, status_code: int = 503, **extra) -> HTTPException:
    """统一错误响应：{detail:{code, message, ...}}"""
    return HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, **extra},
    )
```

### 4.3 前端错误码映射

```typescript
// 新增：apps/web/src/utils/errorCodes.ts
export const ERROR_CODES: Record<string, { title: string; hint: string; severity: 'error' | 'warning' | 'info' }> = {
  AGENT_LLM_UNAVAILABLE: { title: 'Agent 服务暂不可用', hint: '未配置 LLM API Key 或连接失败，已切换手动模式', severity: 'warning' },
  AGENT_MODULE_DOWN:     { title: 'Agent 模块未就绪',   hint: 'Agent 服务启动失败，请检查日志或重启', severity: 'error' },
  GRAPH_MODULE_DOWN:     { title: '图谱模块未就绪',     hint: '图谱服务不可用，项目/笔记功能不受影响', severity: 'warning' },
  GRAPH_NOT_INDEXED:     { title: '项目尚未索引',       hint: '请先构建代码图谱', severity: 'info' },
  MODULE_LOAD_FAILED:    { title: '模块加载失败',       hint: '某后端模块启动异常，部分功能不可用', severity: 'error' },
  // ... 完整表见 §9
};

export function describeError(code: string) {
  return ERROR_CODES[code] ?? { title: '发生错误', hint: '请稍后重试或查看日志', severity: 'error' };
}
```

---

## 5. 执行任务 A：后端模块容错挂载

### 5.1 改动目标

`main.py` 顶部平铺 import 改为**按域懒加载 + 单域失败不阻塞**。失败的域其路由返回 503 + `MODULE_LOAD_FAILED` 码。

### 5.2 改动位置

- `services/api/api_backend/main.py:25-35`（平铺 import）→ 改为容错挂载
- `services/api/api_backend/main.py:106-116`（include_router）→ 改为容错 include
- 新增 `services/api/api_backend/core/module_registry.py`（模块状态登记）

### 5.3 核心代码

**新增 `services/api/api_backend/core/module_registry.py`：**

```python
"""模块注册表 —— 记录各域模块的加载状态，支持故障隔离。"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Callable

logger = logging.getLogger(__name__)


@dataclass
class ModuleStatus:
    name: str
    loaded: bool = False
    error: str | None = None
    router: Any = None  # 加载成功时持有 router 对象


# 全局状态：模块名 → 状态
_MODULE_STATES: dict[str, ModuleStatus] = {}


def safe_load_router(name: str, loader: Callable[[], Any]) -> Any | None:
    """安全加载单个域的 router。失败则记录状态并返回 None，不抛异常。

    Args:
        name: 域名（如 "agent"、"graph"），用于状态登记与报错码
        loader: 返回 router 对象的无参 callable（通常用 lambda 延迟 import）
    Returns:
        router 对象；失败返回 None
    """
    try:
        router = loader()
        _MODULE_STATES[name] = ModuleStatus(name=name, loaded=True, router=router)
        return router
    except Exception as e:
        # 关键：捕获 import 期异常，不让它冒泡到 app 启动
        logger.exception("模块 %s 加载失败，已跳过: %s", name, e)
        _MODULE_STATES[name] = ModuleStatus(name=name, loaded=False, error=str(e))
        return None


def get_module_status(name: str) -> ModuleStatus | None:
    return _MODULE_STATES.get(name)


def all_module_statuses() -> list[ModuleStatus]:
    return list(_MODULE_STATES.values())


def is_module_available(name: str) -> bool:
    s = _MODULE_STATES.get(name)
    return s is not None and s.loaded
```

**改造 `services/api/api_backend/main.py`（替换 :25-35 与 :106-116）：**

```python
"""FastAPI 应用入口 —— v2.0（模块容错挂载）"""
import json
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from api_backend.config import get_settings
from api_backend.core.limiter import limiter
from api_backend.core.middleware import setup_middleware
from api_backend.core.csrf import CsrfMiddleware
from api_backend.core.module_registry import safe_load_router, all_module_statuses
from api_backend.database import get_session_factory, init_db
from api_backend.services.seed_service import seed_preset_categories

settings = get_settings()
api = settings.api_v1_prefix


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if len(settings.secret_key.encode("utf-8")) < 32:
        raise ValueError("SECRET_KEY 长度必须至少为 32 字节")
    await init_db()
    factory = get_session_factory()
    async with factory() as session:
        await seed_preset_categories(session)
    yield


class _LoginBodyCacheMiddleware:
    # ... 保持不变（登录限流用；删用户系统后此中间件随之移除）...
    pass


app = FastAPI(title=settings.app_name, version="2.0.0", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(_LoginBodyCacheMiddleware)
app.add_middleware(CsrfMiddleware)
setup_middleware(app)


# —— 模块容错挂载：单域失败不阻塞 app 启动 ——
# 每个域用 lambda 延迟 import，失败记入 module_registry
_MODULES: list[tuple[str, callable]] = [
    ("auth",       lambda: __import__("api_backend.api.auth", fromlist=["router"]).router),
    ("projects",   lambda: __import__("api_backend.api.projects", fromlist=["router"]).router),
    ("categories", lambda: __import__("api_backend.api.categories", fromlist=["router"]).router),
    ("notes",      lambda: __import__("api_backend.api.notes", fromlist=["router"]).router),
    ("graph",      lambda: __import__("api_backend.api.graph", fromlist=["router"]).router),
    ("tags",       lambda: __import__("api_backend.api.tags", fromlist=["router"]).router),
    ("overview",   lambda: __import__("api_backend.api.overview", fromlist=["router"]).router),
    ("user",       lambda: __import__("api_backend.api.user", fromlist=["router"]).router),
    ("agent",      lambda: __import__("api_backend.api.agent", fromlist=["router"]).router),
    ("github",     lambda: __import__("api_backend.api.github", fromlist=["router"]).router),
    ("settings",   lambda: __import__("api_backend.api.settings", fromlist=["router"]).router),
]

for _name, _loader in _MODULES:
    _router = safe_load_router(_name, _loader)
    if _router is not None:
        app.include_router(_router, prefix=api)


@app.get("/health")
async def health():
    """健康检查：返回各模块加载状态。"""
    return {"status": "ok", "modules": [
        {"name": s.name, "loaded": s.loaded, "error": s.error}
        for s in all_module_statuses()
    ]}


# —— 模块级 503 兜底：未加载成功的域，其前缀路由统一返回 503 ——
@app.api_route(f"{api}/{{module}}/{{rest:path}}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def module_unavailable(module: str, rest: str):
    from api_backend.core.module_registry import get_module_status
    status = get_module_status(module)
    if status and not status.loaded:
        return JSONResponse(
            status_code=503,
            content={"detail": {
                "code": "MODULE_LOAD_FAILED",
                "message": f"模块 {module} 加载失败，服务不可用",
                "module": module,
                "error": status.error,
            }},
        )
    # 已加载但路径不匹配 → 走 FastAPI 默认 404
    return JSONResponse(status_code=404, content={"detail": "Not Found"})
```

> **注意**：上面 `__import__` 写法是为了在 lambda 里延迟 import。也可以用 `importlib.import_module`。关键是**不在文件顶部平铺 import**，让单模块失败被 `safe_load_router` 捕获。

### 5.4 改动原因

| 原因 | 说明 |
|------|------|
| 启动期隔离 | 平铺 import 任一失败全 app 崩；容错挂载单失败仅该域不可用 |
| 503 兜底 | 未加载域的路由请求返回结构化错误码，前端可识别并降级 |
| /health 增强 | 返回模块状态，便于前端启动期探测哪些功能可用 |

### 5.5 验收

- 故意在某 router 模块制造 import 错误（如 `raise ImportError`）→ app 仍启动，该域路由返回 503 + `MODULE_LOAD_FAILED`，其他域正常。
- `/health` 返回各模块 loaded 状态。

---

## 6. 执行任务 B：前端错误码与友好降级

### 6.1 改动目标

1. 前端 HTTP 层保留后端 `detail.code`（不再恒为 'API_ERROR'）。
2. 新增错误码映射表 `errorCodes.ts`。
3. Toast 支持带码显示。
4. Agent 不可用时降级：导入场景隐藏/折叠 Agent 面板 + toast 提示。

### 6.2 改动位置

- `apps/web/src/api/real/http.ts:47-64`（extractApiErrorMessage 丢弃 code）→ 保留 code
- `apps/web/src/api/real/http.ts:12-20`（ApiRequestError）→ code 字段保留后端值
- 新增 `apps/web/src/utils/errorCodes.ts`
- `apps/web/src/stores/uiStore.ts:64-72`（addToast）→ 支持 code 字段
- `apps/web/src/components/common/ToastContainer.tsx`→ 渲染码
- `apps/web/src/components/project/ImportAgentModal.tsx:10`（agentPanel 必填）→ 改可选
- `apps/web/src/components/agent/EmbedAgentChat.tsx`→ 首检健康 + 折叠降级

### 6.3 核心代码

**改造 `apps/web/src/api/real/http.ts`（保留后端 code）：**

```typescript
// apps/web/src/api/real/http.ts

export class ApiRequestError extends Error {
  code: string;      // 改造：保留后端 detail.code，不再恒为 'API_ERROR'
  status: number;    // 新增：HTTP 状态码，供降级判断
  constructor(code: string, message: string, status: number = 0) {
    super(message);
    this.name = 'ApiRequestError';
    this.code = code;
    this.status = status;
  }
}

// 从错误体提取 code + message（改造：不再丢弃 code）
export function extractApiError(res: Response, body: any): ApiRequestError {
  // 后端统一格式：{detail:{code, message}}
  if (body?.detail?.code && body?.detail?.message) {
    return new ApiRequestError(body.detail.code, body.detail.message, res.status);
  }
  // 兼容旧格式 {error:{code, message}}
  if (body?.error?.code && body?.error?.message) {
    return new ApiRequestError(body.error.code, body.error.message, res.status);
  }
  // FastAPI 422 校验
  if (Array.isArray(body?.detail) && body.detail.length) {
    return new ApiRequestError('VALIDATION_ERROR', body.detail[0]?.msg ?? '参数校验失败', res.status);
  }
  if (typeof body?.detail === 'string') {
    return new ApiRequestError('API_ERROR', body.detail, res.status);
  }
  return new ApiRequestError('API_ERROR', '请求失败', res.status);
}
```

> 原 `extractApiErrorMessage` 返回字符串，现改为 `extractApiError` 返回 `ApiRequestError` 对象。调用处（`parseJson` :66-72、`apiSSE` :191-203）相应改为 `throw extractApiError(res, json)`。

**新增 `apps/web/src/utils/errorCodes.ts`：**（见 §4.3，完整表见 §9）

**改造 `apps/web/src/stores/uiStore.ts`（Toast 带 code）：**

```typescript
// apps/web/src/stores/uiStore.ts
export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  code?: string;   // 新增：报错码，用于渲染与查表
  duration?: number;
}

interface UIStore {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  // ...
}

export const useUIStore = create<UIStore>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
    const duration = toast.duration ?? 3000;
    if (duration > 0) {
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, duration);
    }
  },
  // ...
}));
```

**改造 `apps/web/src/components/common/ToastContainer.tsx`（渲染码）：**

```tsx
// apps/web/src/components/common/ToastContainer.tsx
import { useUIStore } from '@/stores/uiStore';
import { describeError } from '@/utils/errorCodes';

export function ToastContainer() {
  const toasts = useUIStore((s) => s.toasts);
  const removeToast = useUIStore((s) => s.removeToast);

  return (
    <div className="toast-container" role="alert" aria-live="polite">
      {toasts.map((t) => {
        const desc = t.code ? describeError(t.code) : null;
        return (
          <div key={t.id} className={`toast toast--${t.type}`}>
            {t.code && <span className="toast-code" data-testid="toast-code">{t.code}</span>}
            <span className="toast-title">{desc?.title ?? t.message}</span>
            {desc?.hint && <span className="toast-hint">{desc.hint}</span>}
            <button className="toast-close" onClick={() => removeToast(t.id)}>×</button>
          </div>
        );
      })}
    </div>
  );
}
```

### 6.4 Agent 降级（导入场景核心）

**改造 `apps/web/src/components/project/ImportAgentModal.tsx`（agentPanel 可选）：**

```tsx
// apps/web/src/components/project/ImportAgentModal.tsx
interface ImportAgentModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  size?: 'default' | 'large';
  agentPanel?: ReactNode;   // 改造：加 ?，可选
  children: ReactNode;
}
```
渲染处加条件：`{agentPanel && <div className="import-agent-modal__agent">{agentPanel}</div>}`。

**改造 `EmbedAgentChat`：首检健康，失败则通知父组件降级。** 新增 `onUnavailable?: () => void` prop，首次发送前/挂载时探测 `/health` 或直接捕获首次失败，调用 `onUnavailable` 让父组件隐藏面板。

```tsx
// apps/web/src/components/agent/EmbedAgentChat.tsx（新增降级逻辑，简化示意）
export function EmbedAgentChat({ mode, onUnavailable, ...rest }: EmbedAgentChatProps) {
  const [unavailable, setUnavailable] = useState(false);
  const addToast = useUIStore((s) => s.addToast);

  // 首次发送失败时降级
  const handleSendFailure = (code: string) => {
    if (code === 'AGENT_MODULE_DOWN' || code === 'AGENT_LLM_UNAVAILABLE') {
      setUnavailable(true);
      onUnavailable?.();
      addToast({ type: 'warning', code, message: 'Agent 助手不可用，已切换手动模式' });
    }
  };

  if (unavailable) return null;  // 隐藏面板
  // ... 原有渲染
}
```

`ImportUrlsModal` 传入 `onUnavailable` 后可选择折叠 agent 区或显示占位提示。

### 6.5 改动原因

| 原因 | 说明 |
|------|------|
| 保留 code | 原 code 恒 'API_ERROR'，无法按码降级；保留后端 code 才能区分 agent 坏 vs 图谱坏 |
| 映射表 | 集中维护 code→友好提示，避免散落各页面的写死文案 |
| agentPanel 可选 | Agent 坏时能隐藏面板，而非一直显示错误条 |
| 首检降级 | 用户进入导入页时即知 agent 不可用，而非发消息失败后才知道 |

### 6.6 验收

- 后端返回 `{"detail":{"code":"AGENT_LLM_UNAVAILABLE","message":"..."}}` → 前端 toast 显示 `[AGENT_LLM_UNAVAILABLE] Agent 服务暂不可用` + hint。
- Agent 服务停用 → 导入页 agent 面板隐藏/折叠，toast 提示，手动导入正常。

---

## 7. 执行任务 C：删用户系统

### 7.1 改动目标

删除认证流程（登录/注册/token/密码/CSRF/JWT/RefreshToken），保留 `user_id` 数据维度（单例本地学习者）与学习画像、设置。

### 7.2 改动位置与内容

#### C-1：替换鉴权依赖

**`services/api/api_backend/api/deps.py`** —— `get_current_user` → `get_local_user`：

```python
# services/api/api_backend/api/deps.py（改造后）
"""依赖注入 —— 本地单机模式，无认证，返回单例本地学习者。"""
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from api_backend.database import get_session
from api_backend.models.user import User

# 固定的本地学习者 ID（首启时自动创建）
LOCAL_USER_ID = UUID("00000000-0000-0000-0000-000000000001")


async def get_db() -> AsyncSession:
    async for session in get_session():
        yield session


async def get_local_user(db: AsyncSession = Depends(get_db)) -> User:
    """本地单机：无认证，直接返回单例 User。

    改动原因：纯本地应用无多用户无认证需求；
    保留 user_id 维度避免拆除所有 FK，但不再校验 token。
    """
    user = await db.get(User, LOCAL_USER_ID)
    if not user:
        # 首次启动自动创建单例本地学习者
        user = User(
            id=LOCAL_USER_ID,
            username="local",
            password_hash="",  # 无认证，留空
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    return user


# 兼容别名：避免大规模改动所有 Depends 调用点
get_current_user = get_local_user
```

> **关键决策**：保留 `get_current_user` 名字作为别名，这样 11 个 api 模块的 `Depends(get_current_user)` **无需逐个改**。只改 deps.py 一处，爆炸半径最小。

#### C-2：删除认证路由与中间件

**`services/api/api_backend/main.py`**：
- 从 `_MODULES` 列表移除 `("auth", ...)` 一行。
- 移除 `_LoginBodyCacheMiddleware`（main.py:51-93）及其 `app.add_middleware` 调用。
- 移除 `CsrfMiddleware`（无认证无需 CSRF）——**待确认**：CSRF 也保护非认证写操作，保留与否见 §11 风险。

**删除文件**：
- `services/api/api_backend/api/auth.py`（整个文件）
- `services/api/api_backend/services/auth_service.py`
- `services/api/api_backend/core/auth_cookies.py`
- `services/api/api_backend/core/security.py` 中的 `create_access_token`/`decode_token`/`hash_password`/`verify_password`/`create_refresh_token_value`/`hash_refresh_token`（保留 `encrypt_secret`/`decrypt_secret`/`ensure_encrypted_secret`/`is_encrypted_secret`/`_fernet`，GitHub PAT 加密仍用）。

**`services/api/api_backend/models/user.py`**：
- 删除 `RefreshToken` 类（整个表）。
- `User` 类删除 `password_hash`、`token_version` 字段；保留 `username`（固定 "local"）、`github_accounts`、`agent_permissions`、`settings_json`、`email`、`avatar_url`。

#### C-3：剥离 User 表字段（可选，推荐二期）

当前 `User` 表混装 github_accounts/agent_permissions/settings_json。**一期可暂不拆**（保留在单例 User 上，功能不损）。二期按域拆表：

| 字段 | 迁移目标表 | 理由 |
|------|-----------|------|
| `settings_json` | `app_settings`（单行） | 设置不属用户认证，独立表语义清晰 |
| `agent_permissions` | `agent_permissions`（单行） | Agent 权限独立 |
| `github_accounts` | `github_accounts`（独立表） | GitHub 集成独立域 |

> 一期不拆的原因：拆表涉及 settings_service/github_accounts 服务全量改造，与脱耦主线无关。先删认证、保功能，二期再拆。

#### C-4：Alembic 迁移

新增迁移 `services/api/api_backend/migrations/alembic/versions/<新rev>_remove_auth.py`：

```python
"""remove auth system (local single-user)

Revision ID: <新rev>
Revises: e30c21e90eef
"""
from alembic import op
import sqlalchemy as sa

revision = "<新rev>"
down_revision = "e30c21e90eef"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 删除 refresh_tokens 表
    op.drop_table("refresh_tokens")
    # users 表删除认证字段
    op.drop_column("users", "password_hash")
    op.drop_column("users", "token_version")
    # 插入单例本地学习者（若不存在）
    op.execute(
        "INSERT OR IGNORE INTO users (id, username, github_accounts, agent_permissions, settings_json) "
        "VALUES ('00000000-0000-0000-0000-000000000001', 'local', '[]', '{}', '{}')"
    )


def downgrade() -> None:
    op.add_column("users", sa.Column("password_hash", sa.String(255), nullable=False, server_default=""))
    op.add_column("users", sa.Column("token_version", sa.Integer, server_default="0", nullable=False))
    op.create_table("refresh_tokens", ...)
```

#### C-5：前端删除认证 UI

**`apps/web/src/App.tsx`**：
- 删除 `/login`、`/register` 路由（:62-75）。
- 删除 `ProtectedRoute` 包裹（所有路由直接渲染）。
- 删除 `AuthBootstrap`（:182-188）。

**删除文件**：
- `apps/web/src/pages/LoginPage.tsx`
- `apps/web/src/pages/RegisterPage.tsx`
- `apps/web/src/components/layout/ProtectedRoute.tsx`
- `apps/web/src/stores/authStore.ts`

**`apps/web/src/api/real/http.ts`**：
- 删除 401 自动 refresh 逻辑（:97-103, :145-151）。
- 删除 CSRF token 注入（:105-120）——若后端保留 CSRF 则前端保留。

### 7.3 改动原因

| 原因 | 说明 |
|------|------|
| 保留 user_id 维度 | 避免拆 11 个模块的 FK，爆炸半径从"拆全库"降到"改 1 个 deps 函数 + 删 auth 文件" |
| get_current_user 别名 | 11 个 api 模块的 Depends 调用零改动 |
| 保留 UserProfile | 学习画像已是独立表，Agent 共享，语义属 Agent 域 |
| 一期不拆 User 字段 | 拆表是独立工作，不阻塞脱耦主线；保功能优先 |
| 保留 encrypt_secret | GitHub PAT 加密仍需 Fernet |

### 7.4 验收

- 启动后无登录页，直接进入应用。
- 项目/笔记/图谱/Agent 功能正常（user_id 自动为单例）。
- `refresh_tokens` 表已删；`users` 表无 password_hash/token_version。
- 学习画像 `/profile` 可用。

---

## 8. 执行任务 D：Agent 服务运行时隔离

### 8.1 改动目标

Agent 端点（尤其 `stream_analyze`/`stream_trending_scout`/`stream_classify_project`/`stream_generate_note`）**无外层 try/except**（排查确认），HubService 内部失败会沿 SSE 生成器抛出。需补外层兜底，转结构化错误码。

### 8.2 改动位置

- `services/api/api_backend/api/agent.py` 各 SSE 端点（:268-297 analyze、:339-354 trending-scout、:357-375 classify、:378-397 note/generate）
- `services/api/api_backend/services/agent_service.py` 对应 stream 函数

### 8.3 核心代码

**为无兜底的 stream 函数补外层 try/except（以 stream_analyze 为例）：**

```python
# services/api/api_backend/services/agent_service.py（stream_analyze 改造，:948-1030）
async def stream_analyze(db, user, project_id, agent_id, question, permissions, ...):
    try:
        # ... 原有逻辑 ...
        async for event in hub.handle_direct_agent(...):
            yield event
    except asyncio.CancelledError:
        raise
    except Exception as e:
        logger.exception("stream_analyze 失败: %s", e)
        yield encode_stream_item(StreamEvent(
            type="error",
            data={"code": "AGENT_ANALYZE_FAILED", "message": f"分析失败: {e}"},
        ))
```

**同理为 `stream_trending_scout`/`stream_classify_project`/`stream_generate_note` 补兜底**，错误码分别为 `AGENT_TRENDING_FAILED`/`AGENT_CLASSIFY_FAILED`/`AGENT_NOTE_FAILED`。

**Agent 模块不可用检测**：`agent.py` 路由层在调用 agent_service 前，检查模块状态：

```python
# services/api/api_backend/api/agent.py（各 SSE 端点入口加检查）
from api_backend.core.module_registry import is_module_available

@router.post("/import-assist")
async def import_assist(...):
    if not is_module_available("agent"):
        yield encode_stream_item(StreamEvent(
            type="error",
            data={"code": "AGENT_MODULE_DOWN", "message": "Agent 模块未就绪"},
        ))
        return
    # ... 原有逻辑（含已有的 try/except 降级）...
```

### 8.4 改动原因

| 原因 | 说明 |
|------|------|
| 补外层兜底 | 4 个 stream 函数无 try/except，HubService 失败直接抛出生成器，前端收到非 SSE 错误体解析失败 |
| 模块状态检查 | agent 模块加载失败时，路由层直接返回结构化错误码，不进入会失败的 agent_service |
| 错误码区分 | 不同流不同码，便于定位 |

### 8.5 验收

- Agent LLM 未配置 → `stream_analyze` 返回 `{"type":"error","data":{"code":"AGENT_ANALYZE_FAILED",...}}`，前端 toast 显示码。
- agent 模块加载失败 → 任一 agent 端点返回 `AGENT_MODULE_DOWN`。

---

## 9. 报错码表

> **单一权威源**：[`ERROR_CODES.md`](./ERROR_CODES.md)  
> 同步实现：
> - `apps/web/src/utils/errorCodes.ts`
> - `services/api/api_backend/core/error_codes.py`
>
> 本节不再维护副本。新增/改名码时改上述三处，并跑 `tests/unit/test_error_codes_sync.py`。
>
> 命名：`<域>_<原因>`。禁止业务路径再使用泛化码 `NOT_FOUND` / `FORBIDDEN` / `LLM_ERROR`（见 ERROR_CODES.md「弃用 / 兼容」）。

---

## 10. 执行顺序与验收

### 10.1 推荐顺序（依赖关系）

```
任务 A（后端容错挂载）   ← 基础，先做；不影响现有功能
   ↓
任务 D（Agent 运行时兜底）← 依赖 A 的 module_registry
   ↓
任务 B（前端错误码）     ← 依赖 D 产生的结构化错误码
   ↓
任务 C（删用户系统）     ← 独立大改，最后做；做完后移除 auth 中间件
```

### 10.2 各任务验收清单

| 任务 | 验收项 | 方法 |
|------|--------|------|
| A | 故意制造某 router import 失败，app 仍启动 | 在某 router 顶部加 `raise ImportError`，启动 app，访问 `/health` 看 loaded=false |
| A | 失败域路由返回 503 + `MODULE_LOAD_FAILED` | 请求该域任一端点，确认响应体 |
| D | agent LLM 未配置时 stream 端点返回错误码 | 不配 Key 调 `/agent/analyze/{id}`，确认 SSE error 事件含 code |
| B | 后端返回码，前端 toast 显示码 | 后端造错，前端看 toast 含 `[CODE]` |
| B | agent 坏时导入页隐藏 agent 面板 | 停 agent 模块，打开导入页，确认面板隐藏 + toast |
| C | 无登录页直接进入应用 | 启动前端，确认无 /login 重定向 |
| C | refresh_tokens 表已删 | 查 DB schema |
| C | 学习画像可用 | 访问 /profile，确认画像数据 |

### 10.3 回归测试

每个任务完成后运行：
```bash
cd services/api && python -m pytest tests/ -x
cd apps/web && npx playwright test
```

---

## 11. 风险与回滚

### 11.1 风险

| # | 风险 | 影响 | 应对 |
|---|------|------|------|
| R1 | 模块容错挂载的 `__import__` 写法可读性差 | 维护 | 可改用 `importlib.import_module`；加注释说明 |
| R2 | 503 兜底路由 `/{module}/{rest:path}` 可能误捕获已加载模块的未知路径 | 路由 404 变 503 | 兜底路由里先查 module_registry，已加载模块返回 404 不返回 503（代码已处理） |
| R3 | 删用户系统后 CSRF 是否保留 | 安全 | 纯本地无认证，CSRF 主要防认证 cookie 被盗用；无认证后 CSRF 意义下降。但 CSRF 也防写操作跨站，**建议保留**（代价小） |
| R4 | `get_current_user` 别名保留，名字误导 | 维护 | 加注释说明是本地单例别名；二期可全量改名 |
| R5 | User 表字段不拆（一期）仍有耦合 | 维护 | 二期拆表，文档已记录 |
| R6 | 删 auth 后前端 http.ts 的 401 refresh 逻辑残留 | 死代码 | C-5 明确删除 |
| R7 | agent_service.py 巨型模块未拆 | 维护 | 建议后续独立重构任务拆分（§审计建议 4） |

### 11.2 回滚

- 每个任务独立 commit，可单独 revert。
- 任务 C 的 Alembic 迁移有 `downgrade()`，可回退。
- 前端删除的文件在 git 历史可恢复。

---

## 附录：排查证据索引

| 结论 | 证据位置 |
|------|---------|
| 平铺 import 致启动耦合 | `services/api/api_backend/main.py:25-35` |
| lifespan 不初始化 agent | `main.py:37-45` |
| agent tools import 时注册 | `services/api/api_backend/services/agent_service.py:28` |
| 业务不 import agent_service | grep 确认 project_service/note_service/graph_service 无反向 import |
| agent_service 巨型 | `services/agent_service.py` 1558 行，stream_import_assist out_degree 23 |
| 前端 code 恒 'API_ERROR' | `apps/web/src/api/real/http.ts:69,202` |
| 前端丢弃 detail.code | `http.ts:55-57` extractApiErrorMessage 只取 message |
| 无错误码映射表 | grep ERROR_CODES/errorMap 无命中 |
| agentPanel 必填 | `apps/web/src/components/project/ImportAgentModal.tsx:10` |
| 导入 fallback | `apps/web/src/components/project/ImportUrlsModal.tsx:148-163` |
| User 表混装 | `services/api/api_backend/models/user.py:26-28` |
| get_current_user 11 模块依赖 | deps.py:54-110 + 各 api 模块 Depends |
| UserProfile 独立表 | `services/api/api_backend/models/agent.py:33` |
| token 在 github_accounts JSON | `services/api/api_backend/services/github_accounts.py:44` |
| 4 个 stream 无兜底 | agent_service.py stream_analyze/stream_trending_scout/stream_classify_project/stream_generate_note |
| migrations 位置 | `services/api/api_backend/migrations/alembic/versions/` 4 个版本 |
| init_db alembic upgrade | `services/api/api_backend/database.py:73-91` |
