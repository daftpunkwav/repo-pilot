# RepoPilot 架构重构报告:Core / Runtime / Embedded / Remote

> 版本: 2026-08-12
> 状态: **待批准**
> 范围: services/ 下 api / agent / graph_engine / mcp 的职责分离与 Runtime 边界建立
> 参考文档: 本仓库 `docs/architecture/{REPO_LAYOUT,PATH_MAPPING,OVERVIEW}.md`、`docs/review/REMEDIATION_PLAN_20260806.md`；外部参考架构见文末附录

---

## 一、项目定位与重构动机

### 1.1 当前定位

RepoPilot 是一个**本地优先**的 GitHub 学习工具。用户在 Web 端与 Agent 对话,Agent 自动导入项目、clone 仓库、请求 Graph Engine 建立 index,过程中持续讲解、出题;index 完成后自动跳转图谱页面,展示依赖关系、调用链、字段定义与使用等。

### 1.2 长期愿景(RepoPilot -> KnowledgePilot)

GitHub 源码只是知识的一种来源。未来可能支持新闻、技术文章、文档、教材、论文、课程资料、网页等知识源,统一经过索引、解析、抽取、关系构建,形成知识图谱。因此:

- **Graph Engine 未来可能独立发布**,不能只围绕"GitHub 源码图谱"设计
- **Graph Engine 必须能脱离 RepoPilot 独立运行**(不依赖 api_backend / agent / web / RepoPilot-specific database)
- **Graph Engine 的功能源码与服务源码必须彻底解耦**--即使第三方 C 实现内部没有做到,也要通过渐进式重构建立边界

### 1.3 当前架构问题(全部代码验证)

| 问题 | 证据 | 后果 |
|------|------|------|
| Agent 执行逻辑混在 api_backend | `agent_service.py` **1590 行**,混合 SSE 接线 + 任务编排 + 业务逻辑 | 每加一个工作流场景就膨胀,已接近不可维护 |
| Graph job 管理逻辑混在 api_backend | `rp_graph_client.py`(530)+`index_pipeline.py`(1147)+`graph_engine_sidecar.py`(159)= **1836 行**散落 3 文件 | api 承担了不属于它的 Graph 生命周期管理 |
| agent_core 反向依赖 api_backend | **40 处** `from api_backend.*`(models/services/core/schemas/ports) | 循环依赖,agent_core 无法独立 |
| api_backend 正向依赖 agent_core | **19 处** `from agent_core.*`(6 文件) | api 无法脱离 agent 独立编译运行 |
| C 引擎混入前端资源服务 | `src/ui/asset_pack.c`(892 行)服务 text/html/index.html/assets/webp | 上游 codebase-memory-mcp 遗留,RepoPilot 前端在 apps/web,不需要 |
| C 引擎功能与服务目录混合 | `src/ui/` 混了 HTTP 功能 API + 前端资源 + 布局算法;`src/daemon/` 混在 `src/` 下 | 看不出"功能 vs 服务"边界(但依赖方向干净,见 §5) |
| py-shared 空壳 | 仅 `pyproject.toml` + 空 `__init__.py` | 共享数据模型/工具无承载位置 |
| services/ 命名不统一 | `agent_runtime`(进程入口) vs `graph_engine_runtime`(Python 库)同后缀不同语义 | 看目录名无法判断用途 |

### 1.4 不重构的代价

继续在当前结构上开发,`agent_service.py` 会从 1590 行涨到 2500+,graph 的 job 逻辑会与 api 业务逻辑长出更深依赖。**越晚拆,成本越高,最终可能无法拆分。** 现在是拆分成本最低的窗口(py-shared 空壳、ports 已有 7 个 Protocol、MCP 仍占位)。

---

## 二、目标架构

### 2.1 核心概念

| 概念 | 定义 | 本项目对应 |
|------|------|------------|
| **Core** | 功能本身(能力实现),不依赖 HTTP/Server/Process/Port/Runtime | agent_core、graph_engine_core(C)、graph_engine_fallback(Python 降级) |
| **Runtime** | 让 Core 持续运行、管理生命周期、调度任务、对外提供服务 | agent_runtime、graph_engine_runtime |
| **Server** | Runtime 对外提供网络服务的接口(可选,Runtime 可不含 Server) | agent_runtime 的 FastAPI、graph_engine_runtime 的 HTTP/JSON-RPC |
| **Embedded** | Runtime 在 api 进程内运行(同进程 import,Adapter 注入) | 默认模式:Web + API 两进程 |
| **Remote** | Runtime 作为独立进程,通过网络调用 | 未来:Web + API + Agent + Graph 多进程 |
| **Contract** | 跨服务的数据/业务访问协议(Protocol/Interface),与实现解耦 | `packages/py-shared` 中的 Protocol 定义 |
| **Adapter** | Contract 的具体实现(Embedded 版进程内实现 / Remote 版 HTTP 实现) | api_backend 提供 Embedded Adapter |

### 2.2 关键原则

1. **Core 不依赖 Runtime** - 依赖方向:Runtime -> Core,不可逆
2. **Core 不依赖 API Backend** - agent_core / graph_engine_core / graph_engine_fallback 不 `import api_backend`
3. **API Backend 不直接 import Core** - api 通过 Runtime Interface 访问 agent/graph 能力
4. **进程边界 ≠ 代码职责边界** - 逻辑分离先行,物理分离按需;双进程与四进程都合法
5. **不为微服务而微服务** - 拆分依据是生命周期/状态所有权/任务边界/部署边界,不是形式对称
6. **Graph Engine 必须能独立** - `services/graph_engine/` 拿出来不依赖 api_backend / agent / web

### 2.3 依赖关系图(目标)

```
                     ┌─────────────┐
                     │     Web     │ :5173
                     └──────┬──────┘
                            │ HTTP/SSE
                            ↓
                     ┌─────────────┐
                     │ API Backend │ :19878
                     └──┬───┬───┬──┘
                        │   │   │
            ┌───────────┘   │   └───────────┐
            ↓               ↓               ↓
   ┌────────────────┐ ┌──────────┐  ┌──────────────┐
   │ Agent Runtime  │ │ 传统 CRUD │  │ Graph Runtime│
   │  Interface     │ │ Service  │  │  Interface   │
   └───────┬────────┘ └──────────┘  └──────┬───────┘
           │                               │
           ↓                          ┌────┴────┐
     ┌──────────┐                     ↓         ↓
     │Agent Core│              C Engine    Python Engine
     └──────────┍             (core)       (fallback)

  Contract 层(packages/py-shared):
    models / schemas / ports(Protocol) / security / contracts
    (SSE format_sse 留在 agent_core/agents/stream_events，非跨服务契约)
```

### 2.4 部署模式

- **Embedded(默认)**:API 进程内注入 EmbeddedAgentRuntime + EmbeddedGraphRuntime -> 两进程(Web + API)
- **Remote(未来)**:Agent/Graph 各自独立进程,API 通过 HTTP Adapter 调用 -> 四进程
- **Graph Engine 独立发布(终极目标)**:`services/graph_engine/` 脱离 KnowledgePilot,成为独立知识索引与图谱基础设施

---

## 三、当前现状(全部代码验证)

### 3.1 services/ 目录结构

```
services/
├── api/
│   └── api_backend/              # FastAPI 后端(含 agent/graph 逻辑,需剥离)
├── agent/
│   ├── agent_core/               # Agent 权威实现(7853 行,反向依赖 api_backend 40 处)
│   └── agent_runtime/            # 独立进程入口(4KB 薄壳,默认不启动)
├── graph_engine/
│   ├── graph_engine_core/        # C 引擎(1213 文件,含前端资源遗留)
│   ├── graph_engine_runtime/     # Python 实现(包名 rp_graph,2203 行,含 server.py)
│   └── layout/                   # 3D 布局 native 库
└── mcp/
    └── mcp_server/               # 占位(10 行 docstring)
```

### 3.2 agent_core -> api_backend 反向依赖(40 处完整清单)

| 类别 | 处数 | 具体依赖(文件:行) | 性质 |
|------|------|----------|------|
| A. 共享数据模型 | 4 | `models.project.Project`(context.py:9, builtin.py:10)、`models.app_state.AppState`(config.py:9)、`models.agent.AgentMessage/AgentSession`(service.py:10) | SQLAlchemy ORM,纯数据结构 |
| B. 共享 Schema | 1 | `schemas.project.ImportRepoItem`(builtin.py:1719) | Pydantic 数据契约 |
| C. 共享工具函数 | 5 | `core.security.decrypt_secret`(config.py:112)、`core.security.is_encrypted_secret`(config.py:167,219,247)、`core.url_safety.assert_safe_outbound_https_url`(provider.py:97) | 纯函数,无状态无 DB |
| D. 已有 Contract 的 Port | 2 | `ports.sqlalchemy_adapters.build_tool_ports`(context.py:106, builtin.py:22) | 已是 Protocol + Adapter |
| E. 业务服务 | 11 | `services.app_state_service`(hub.py:13, config.py:267)、`services.settings_service.ensure_providers`(config.py:119,273)、`services.profile_service`(service.py:11, builtin.py:1024)、`services.github_client`(builtin.py:226,270)、`services.llm_usage_parse`(provider.py:450)、`services.llm_usage_service`(provider.py:503)、`services.agent_service.get_session_project_ids`(context.py:74) | agent 通过 api 业务层访问数据 |
| F. Graph 引擎访问 | 15 | `services.index_pipeline`(builtin.py:348,386,437,489,533,563,591,627 共 8 处)、`services.rp_graph_client`(builtin.py:387,438,490,534,564,592,628 共 7 处) | agent 直接调 api 的 graph 客户端 |
| G. SSE 格式化(假依赖) | 2 | `services.sse_stream.format_sse`(hub.py:14, react.py:11) | 本就来自 agent_core,api 是 re-export |

**注意**:E 类的 `sse_stream.format_sse` 与 G 类重叠--api_backend 的 `sse_stream.py` 其实 `from agent_core.agents.stream_events import format_sse` 是 re-export,agent_core 反过来 import 它是循环假象。

### 3.3 api_backend -> agent_core 正向依赖(19 处完整清单)

| 文件 | 处数 | 用途 |
|------|------|------|
| `services/agent_service.py` | 13 | Agent 执行(HubService:11、build_llm_config_from_user:12、MemoryService:13、ensure_tools_loaded:14、AGENT_DEFINITIONS:291、get_registry:952、ReActEngine:1049、get_registry:1050、build_llm_config_from_user:1051、LLMProvider:1052、ContextBuilder:1053、MemoryService:1054、ToolRegistry:1055) |
| `api/settings.py` | 2 | LLM 配置校验(build_llm_config_from_user:61、LLMProvider:62) |
| `api/user.py` | 1 | MemoryService:2 |
| `services/agent_catalog.py` | 1 | Agent 清单(get_registry:65) |
| `services/settings_service.py` | 1 | Agent registry(get_registry:27) |
| `services/sse_stream.py` | 1 | SSE 格式化(re-export 自 agent_core:3) |

### 3.4 C 引擎结构(完整验证)

#### 3.4.1 src/ 目录(15 个子目录)

| 子目录 | .c 数 | 行数 | Makefile 分组 | 性质 |
|--------|--------|------|---------------|------|
| `foundation/` | 29 | 12634 | FOUNDATION_SRCS | **功能**:内存/线程/文件/日志/SHA256/平台兼容 |
| `store/` | 1 | 8427 | STORE_SRCS | **功能**:SQLite 图谱存储 |
| `cypher/` | 1 | 4972 | CYPHER_SRCS | **功能**:Cypher 查询解析 |
| `pipeline/` | 31 | 28439 | PIPELINE_SRCS | **功能**:索引流水线(AST/解析/符号提取) |
| `simhash/` | 1 | 538 | SIMHASH_SRCS | **功能**:相似度哈希 |
| `semantic/` | 3 | 2243 | SEMANTIC_SRCS | **功能**:语义分析(AST profile/rotsq) |
| `traces/` | 1 | 142 | TRACES_SRCS | **功能**:调用链追踪 |
| `discover/` | 4 | 3027 | DISCOVER_SRCS | **功能**:项目发现 |
| `graph_buffer/` | 1 | 1843 | GRAPH_BUFFER_SRCS | **功能**:图缓冲区 |
| `git/` | 1 | 411 | GIT_SRCS | **功能**:Git 上下文解析 |
| `watcher/` | 1 | 1440 | WATCHER_SRCS | **功能**:文件监听 |
| `ui/` | 7 | 5301 | UI_SRCS | **服务**:HTTP server + 前端资源 + 布局 |
| `daemon/` | 10 | 18634 | DAEMON_SRCS | **服务**:进程管理/IPC/锁/版本协调 |
| `cli/` | 12 | 29605 | CLI_SRCS | **服务**:命令行界面 |
| `mcp/` | 3 | 12928 | MCP_SRCS | **服务**:MCP 协议适配 |
| `main.c` | 1 | 2868 | (入口) | **服务**:初始化和编排 |

**Makefile 聚合**:
```makefile
PROD_SRCS = $(FOUNDATION_SRCS) $(STORE_SRCS) $(CYPHER_SRCS) $(MCP_SRCS) \
            $(DAEMON_SRCS) $(DISCOVER_SRCS) $(GRAPH_BUFFER_SRCS) \
            $(PIPELINE_SRCS) $(SIMHASH_SRCS) $(SEMANTIC_SRCS) \
            $(TRACES_SRCS) $(WATCHER_SRCS) $(GIT_SRCS) $(CLI_SRCS) \
            $(UI_SRCS) $(YYJSON_SRC)
```
所有源文件编译成**单一二进制** `rp-graph-engine`。

#### 3.4.2 src/ui/ 的混合情况

| 文件 | 行数 | 实际职责 | RepoPilot 需要? | 正确归类 |
|------|------|----------|-----------------|----------|
| `http_server.c` | 2139 | HTTP 功能 API(`/api/layout`、`/rpc` 的 search_graph/trace_path/index_repository)+ **index_job_t 结构体与 job 管理** | ✅ | 服务 |
| `httpd.c` | 866 | HTTP 底层(socket/请求解析/响应) | ✅ | 服务 |
| `layout3d.c` | 869 | 3D 布局算法(anchor-based,纯计算) | ✅ | **功能**(被错误归到 ui/) |
| `config.c` | 431 | UI 配置(语言/缓存目录) | ⚠️ 部分 | 服务 |
| `asset_pack.c` | 892 | **前端资源服务**(text/html/index.html/assets/webp) | ❌ 不需要 | 服务(上游遗留) |
| `asset_pack_stub.c` | 98 | asset_pack 空实现(占位) | ✅ 默认编译用此 | 服务(stub) |
| `asset_manifest_stub.c` | 6 | 资源清单空实现 | ✅ 默认编译用此 | 服务(stub) |

**Makefile 的 stub 机制**:
- `Makefile.rp` UI_SRCS 默认编译 `asset_pack_stub.c`(空实现)
- `TEST_PROD_SRCS` = `$(subst src/ui/asset_pack_stub.c,src/ui/asset_pack.c ...,$(PROD_SRCS))` -- 仅 TEST 模式替换为真实 asset_pack
- `graph_engine_sidecar.py:110` 拉起时传 `--ui=true`(stub 模式下为 no-op)

### 3.5 C 引擎依赖方向验证(拆分可行性的核心证据)

#### 功能 -> 服务(反向依赖):全部为 0

```
foundation/   -> include ui/daemon/cli/mcp:  0 文件
store/        -> include ui/daemon/cli/mcp:  0 文件
cypher/       -> include ui/daemon/cli/mcp:  0 文件
pipeline/     -> include ui/daemon/cli/mcp:  0 文件
simhash/      -> include ui/daemon/cli/mcp:  0 文件
semantic/     -> include ui/daemon/cli/mcp:  0 文件
traces/       -> include ui/daemon/cli/mcp:  0 文件
discover/     -> include ui/daemon/cli/mcp:  0 文件
graph_buffer/ -> include ui/daemon/cli/mcp:  0 文件
git/          -> include ui/daemon/cli/mcp:  0 文件
watcher/      -> include ui/daemon/cli/mcp:  0 文件
```

功能模块对 `http_server.h`/`httpd.h` 的引用: **0 文件**

**结论:功能代码完全不依赖服务代码。依赖方向严格是 服务 -> 功能(单向)。**

#### 服务 -> 功能(正常依赖)

- `ui/` -> 功能模块: 7 文件(include store/watcher/git/mcp/cli)
- `daemon/` -> 功能模块: 11 文件(include store/cli/watcher/ui)
- `cli/` -> 功能模块: 11 文件
- `mcp/` -> 功能模块: 4 文件

#### `cbm.h`(内部核心头文件)

- 位置:`internal/cbm/cbm.h`
- 内容:语言枚举 + tree_sitter 接口 + arena(纯功能定义,不含服务逻辑)
- 被 `pipeline/`(10 文件)和 `discover/`(5 文件)引用
- **属于功能库**,lib + exe 分离时编进 `libgraph_engine_core.a`

#### `main.c`(服务入口)

- 2868 行,49 个 #include
- include daemon/ui/cli/mcp 的头文件 + `store/store.h` + `cbm.h`
- **不含功能逻辑**,只做初始化和编排(服务侧)

### 3.6 Python 侧结构

| 文件 | 行数 | 性质 |
|------|------|------|
| `engine.py` | 656 | **功能**(GraphEngine 类:索引/查询/布局/路径追踪) |
| `indexer.py` | 1065 | **功能**(索引实现) |
| `store.py` | 355 | **功能**(SQLite 存储) |
| `server.py` | 117 | **服务**(HTTP sidecar 入口,`python -m rp_graph.server`) |
| `__init__.py` | 10 | 包入口 |

**Python 库与服务可分离**(已验证):
- `server.py` 依赖 `engine.py`(`from .engine import get_engine`)
- `engine.py` **不依赖** `server.py`(0 命中)

### 3.7 已就位的架构基础

| 基础 | 现状 | 说明 |
|------|------|------|
| `api_backend/ports/__init__.py` | 7 个 Protocol(ProjectPort/NotePort/SessionPort/GraphPort/TagPort/CategoryPort/ToolPorts) | Contract 已定义,agent_core 已通过 `build_tool_ports` 依赖抽象 |
| `api_backend/ports/sqlalchemy_adapters.py` | Embedded Adapter 已实现 | SqlAlchemyProjectPort 等,是 Adapter 模式的现成范例 |
| `packages/py-shared/` | 空壳(pyproject.toml + 空 __init__.py) | workspace 已纳入,包结构已搭好 |
| Python `engine.py` 不依赖 `server.py` | 0 命中 | Python 库与服务可分离 |
| `agent_runtime` 不被 agent_core 依赖 | 0 命中 | agent_runtime 可干净删除/独立 |
| C 功能模块不依赖服务模块 | 0 命中(全部 11 个功能目录) | C lib + exe 分离在依赖层面干净 |

---

## 四、C 引擎拆分可行性分析(核心)

### 4.1 结论:C 引擎功能与服务可以拆分

**之前"C 无法物理拆分"的判断是错误的。** 验证结果:

1. **依赖方向干净**:11 个功能模块对 4 个服务模块的反向 include = 全部 0
2. **Makefile 已按模块分组**:FOUNDATION/STORE/PIPELINE/UI/DAEMON/CLI/MCP 等,改链接规则即可
3. **主要障碍是工作量和上游同步**,不是技术不可行

### 4.2 三个拆分等级

#### 等级 A:删除前端遗留(立即可做,极低风险)

| 改动 | 说明 |
|---|---|
| 删除 `asset_pack.c` + `asset_pack.h` | 前端资源服务,RepoPilot 不需要(apps/web 负责) |
| `Makefile.rp` 移除 TEST_PROD_SRCS 的 subst 行 | 不再有 TEST 模式替换 |
| `graph_engine_sidecar.py:110` 移除 `--ui=true` | stub 模式下是 no-op |
| README 补充 | "C 引擎只提供功能 API,前端由 apps/web 负责" |

**效果**:`src/ui/` 从 7 个 .c 减到 4 个。**风险极低**(默认本就编 stub)。

#### 等级 B:目录归位(中等成本,不改编译逻辑)

```
graph_engine_core/
├── src/                    # 功能源码(纯能力)
│   ├── foundation/         (29 .c, 12634 行)
│   ├── store/              (1 .c, 8427 行)
│   ├── cypher/             (1 .c, 4972 行)
│   ├── pipeline/           (31 .c, 28439 行)
│   ├── simhash/            (1 .c, 538 行)
│   ├── semantic/           (3 .c, 2243 行)
│   ├── traces/             (1 .c, 142 行)
│   ├── discover/           (4 .c, 3027 行)
│   ├── graph_buffer/       (1 .c, 1843 行)
│   ├── git/                (1 .c, 411 行)
│   ├── watcher/            (1 .c, 1440 行)
│   └── layout3d.c          (← 从 ui/ 移出,它是功能不是服务)
│
├── server/                 # 服务源码(运行层)
│   ├── http_server.c       (2139 行,功能 API + job 管理)
│   ├── httpd.c             (866 行,HTTP 底层)
│   ├── config.c            (431 行,配置)
│   ├── asset_pack_stub.c   (98 行,stub)
│   ├── daemon/             (10 .c, 18634 行,进程管理)
│   ├── cli/                (12 .c, 29605 行,命令行)
│   └── mcp/                (3 .c, 12928 行,MCP 协议)
│
├── main.c                  # 入口(服务侧,2868 行)
└── vendored/               (第三方库,不动)
```

**需要改**:Makefile 路径(~50 处)+ include 路径(~30 处)。**不改编译逻辑**。
**效果**:目录看出"功能 vs 服务"。**风险中**(量大但机械,增大上游 diff)。

#### 等级 C:编译分离 lib + exe(高成本,真正解耦)

```makefile
# 功能源码 -> 静态库
CORE_SRCS = $(FOUNDATION_SRCS) $(STORE_SRCS) $(CYPHER_SRCS) \
            $(PIPELINE_SRCS) $(SIMHASH_SRCS) $(SEMANTIC_SRCS) \
            $(TRACES_SRCS) $(DISCOVER_SRCS) $(GRAPH_BUFFER_SRCS) \
            $(GIT_SRCS) $(WATCHER_SRCS) src/layout3d.c

libgraph_engine_core.a: $(CORE_OBJS)
	$(AR) rcs $@ $^

# 服务源码 + 链接库 -> 可执行
SERVER_SRCS = $(UI_SRCS) $(DAEMON_SRCS) $(CLI_SRCS) $(MCP_SRCS)

rp-graph-engine: $(SERVER_OBJS) libgraph_engine_core.a $(VENDORED_LIBS)
	$(CC) $(SERVER_OBJS) -L. -lgraph_engine_core $(VENDORED_LIBS) -o $@
```

**效果**:
- `libgraph_engine_core.a` = 纯功能库(可被其他 C 程序/Python binding/第三方项目链接)
- `rp-graph-engine` = 服务可执行(链接上面的库)
- **满足"Graph Core 能被 Python/C/CLI/Agent/Desktop/第三方项目直接调用,不需要启动 HTTP Server"的诉求**

**需要改**:Makefile 链接规则重写 + vendored 库链接顺序 + `http_server.c` 的 `index_job_t` 留服务侧。
**风险高**(链接规则 + vendored 依赖),但**技术可行**(依赖方向已验证干净)。

### 4.3 `http_server.c` 的 `index_job_t` 问题

`http_server.c`(2139 行)内部定义了 `index_job_t` 结构体和 job 调度逻辑(含 `cbm_http_server` 结构体、`index_jobs[MAX_INDEX_JOBS]`、调度/取消/状态)。这是 **C 引擎自带的 job 管理**(在服务层)。

- 等级 C 拆分时,这部分**留在服务侧**(含 HTTP server 引用),不进 lib
- 功能库只提供 `cbm_index_repository()` 等纯功能函数,job 调度由服务层或 Python runtime 管理
- **两套 job 管理**:C sidecar 模式下 C 引擎自己管 job;Python 回退模式下 Python `index_pipeline.py` 管 job。两套不共享,状态不同步。这是功能层面问题,阶段 3 迁移时需决定统一策略。

### 4.4 渐进式 C 拆分路径(对应 GPT 文档 Phase 0-4)

| Phase | 目标 | 改动范围 | 风险 | 完成标准 |
|-------|------|----------|------|----------|
| Phase 0 | 依赖分析(已完成) | 不改代码 | 无 | 依赖图生成(本报告 §3.5) |
| Phase 1 | 建立 Public API | 在功能模块上建立统一 `graph_index()`/`graph_query()`/`graph_layout()` 接口 | 低 | 服务层只调 Public API |
| Phase 2 | 隔离 Server | 让 HTTP/daemon/main 只调 Public API,不直接调功能函数 | 中 | 服务层不直接 include store/pipeline 等 |
| Phase 3 | 目录归位(等级 B) | `src/` 下功能模块不动,服务模块移到 `server/` | 中 | 目录看出"功能 vs 服务" |
| Phase 4 | Library 化(等级 C) | 功能编成 `libgraph_engine_core.a`,服务链接它 | 高 | `libgraph_engine_core.a` + `rp-graph-engine` 两个产物 |

---

## 五、改动办法(Python 侧 + C 侧 + 命名)

### 5.1 阶段 1:C 引擎前端遗留清理(等级 A)

**目标**:消除 `src/ui/` 的前后端混合,删除 RepoPilot 不需要的前端资源服务。

| 改动 | 说明 |
|---|---|
| 确认 stub 为默认编译目标 | `Makefile.rp` UI_SRCS 已是 `asset_pack_stub.c`,无需改 |
| 删除 `asset_pack.c` + `asset_pack.h` + `asset_manifest_stub.c` | RepoPilot 前端在 apps/web,不需要 C 引擎服务前端资源 |
| `graph_engine_sidecar.py:110` 移除 `--ui=true` | stub 模式下为 no-op,传它有误导性 |
| README 补充 | "C 引擎只提供功能 API,前端可视化由 apps/web 负责" |

**风险**:极低。`asset_pack.c` 在默认构建中本就不编译(stub 替代)。

### 5.2 阶段 2:共享层下沉到 packages/py-shared

**目标**:消除 agent_core -> api_backend 的 A/B/C/D/G 类依赖(14 处)。

| 迁移项 | 来源(api_backend) | 目标(py-shared) | 处数 |
|--------|---------------------|-------------------|------|
| 数据模型 | `models.{project,app_state,agent}` | `repopilot_shared/models/` | 4 |
| Schema | `schemas.project.ImportRepoItem` | `repopilot_shared/schemas/` | 1 |
| 安全工具 | `core.security.{decrypt_secret,is_encrypted_secret}` | `repopilot_shared/security/` | 4 |
| URL 安全 | `core.url_safety.assert_safe_outbound_https_url` | `repopilot_shared/security/url_safety.py` | 1 |
| Port Protocol | `ports/__init__.py` 的 7 个 Protocol | `repopilot_shared/ports/` | 2 |
| SSE 工具(假依赖) | `services/sse_stream.py`(re-export 自 agent_core) | 删除 api 侧 re-export,agent_core 直接用自己的 | 2 |

**结果**:40 处反向依赖减到 26 处(只剩 E+F)。py-shared 从空壳变实心。
**风险**:中低。移动纯数据结构和纯函数,不改业务逻辑。

### 5.3 阶段 3:Graph 逻辑移到 graph_engine_runtime

**目标**:消除 F 类依赖(15 处),将 Graph job 管理/C-py fallback/sidecar 生命周期从 api_backend 移到 graph_engine_runtime。

| 迁移项 | 来源(api_backend) | 目标(graph_engine_runtime) | 行数 |
|--------|---------------------|------------------------------|------|
| Graph 客户端 + C/py fallback | `services/rp_graph_client.py` | `graph_engine_runtime/client.py` | 530 |
| 索引流水线 + job 管理 | `services/index_pipeline.py` | `graph_engine_runtime/index_pipeline.py` | 1147 |
| C sidecar 生命周期 | `services/graph_engine_sidecar.py` | `graph_engine_runtime/sidecar.py` | 159 |
| Python server.py(已在) | `graph_engine_runtime/rp_graph/server.py` | 保持原位(包内 `python -m rp_graph.server`) | 117 |

**api_backend 改为**:
- 定义 `GraphRuntimeInterface`(Protocol),放 py-shared
- 提供 `EmbeddedGraphRuntime`(Adapter,import graph_engine_runtime,注入到 api)
- api 只调 `graph_runtime.fetch_layout()` / `graph_runtime.index_repository()` / `graph_runtime.health()`,不关心 C/py 选择

**agent_core 改为**:
- `tools/builtin.py` 的 15 处 `from api_backend.services.rp_graph_client/index_pipeline` 改为 `from graph_engine_runtime import ...`

**C 引擎不拆源码(本阶段)**:
- graph_engine_runtime 通过 subprocess 启动/管理 C 二进制
- C 内部 lib + exe 分离(等级 B/C)留到阶段 6

**结果**:agent_core 不再直接依赖 api_backend 的 graph 服务。api_backend 不再直接管 graph job。
**风险**:中。需处理 index_worker 的 lifespan 管理。

### 5.4 阶段 4:Agent 逻辑移到 agent_runtime + Contract 化

**目标**:消除 E 类依赖(11 处)+ api_backend 的 19 处正向依赖。

#### 5.4.1 agent_runtime 承接 Agent 执行逻辑

从 `api_backend/services/agent_service.py`(1590 行)抽出:
- Agent 执行编排(stream_chat、_orchestrate_multi 等)-> `agent_runtime/`
- SSE 接线 -> `agent_runtime/`
- 任务生命周期管理(未来扩展:workflow state、task cancel)-> `agent_runtime/`

api_backend 保留:
- Agent REST 路由(`api/agent.py`,薄层,转发到 agent_runtime)
- Agent 元信息查询(agent_catalog,通过 Contract)

#### 5.4.2 业务服务 Contract 化

为 agent_core 需要的 6 个业务服务定义 Protocol(放 py-shared):

| Contract | 方法 | api_backend 的 Embedded Adapter |
|----------|------|--------------------------------|
| `AppStateServicePort` | `get_or_create_app_state()` | `app_state_service` 现有实现 |
| `ProfileServicePort` | `get_or_create_profile()`, `profile_to_out()` | `profile_service` 现有实现 |
| `SettingsServicePort` | `ensure_providers()` | `settings_service` 现有实现 |
| `GitHubClientPort` | `fetch_repo_info()`, `fetch_readme_text()` | `github_client` 现有实现 |
| `LLMUsagePort` | `parse_usage_details()`, `record_parsed_usage_fire_and_forget()` | `llm_usage_*` 现有实现 |
| `SessionQueryPort` | `get_session_project_ids()` | `agent_service` 中的查询方法 |

agent_core 改为依赖 Protocol,运行时由 agent_runtime 注入 Embedded Adapter(或未来 Remote Adapter)。

**结果**:`grep 'from api_backend' services/agent/agent_core/` = **0**。`grep 'from agent_core' services/api/api_backend/` = **0**。
**风险**:中高。Contract 设计需准确覆盖 agent_core 的实际数据访问需求。

### 5.5 阶段 5:命名统一 + 目录归位

| 当前 | 目标 | 理由 |
|------|------|------|
| `graph_engine_runtime/`(Python 实现) | `graph_engine_fallback/` | 消除 `_runtime` 一词两义;`_fallback` 明示降级语义 |
| `graph_engine_runtime/`(新增运行层) | `graph_engine_runtime/` | 承接从 api_backend 移出的 graph job/fallback/sidecar 逻辑 |
| `agent_runtime/` | 保持(或 `agent_server/`) | 已是进程入口语义 |
| `mcp_server/` | `mcp_runtime/` | MCP 是独立服务(工具工厂+server+client),不只是 server |

**最终目录**:
```
services/
├── api/
│   └── api_backend/              # 传统后端(CRUD/数据/REST),不含 agent/graph 执行逻辑
├── agent/
│   ├── agent_core/               # Agent 功能实现(只依赖 py-shared)
│   └── agent_runtime/            # Agent 运行层(执行编排/任务生命周期/SSE)
├── graph_engine/
│   ├── graph_engine_core/        # C 引擎(功能实现,编译出二进制;未来 lib + exe 分离)
│   ├── graph_engine_fallback/    # Python 降级实现(C 不可用时回退,含 server.py)
│   ├── graph_engine_runtime/     # Graph 运行层(job 管理/C-py fallback/sidecar)
│   └── layout/                   # 3D 布局 native 库
└── mcp/
    └── mcp_runtime/              # MCP 独立服务(工具工厂/server/client)
```

**后缀语义统一**:
- `_core` = 主力功能实现(agent_core、graph_engine_core)
- `_fallback` = 降级实现(C 不可用时回退,graph_engine_fallback)
- `_runtime` = 运行层(agent_runtime、graph_engine_runtime、mcp_runtime)
- `_backend` = 后端整体(api_backend)

### 5.6 阶段 6:C 引擎 lib + exe 分离(等级 C,对应 GPT Phase 1-4)

在 Python 侧逻辑分离完成后,执行 C 引擎的渐进式拆分:

| 步骤 | 对应 GPT Phase | 目标 | 风险 |
|------|----------------|------|------|
| 6a | Phase 1 | 建立 Public API(`graph_index()`/`graph_query()`/`graph_layout()`) | 低 |
| 6b | Phase 2 | 服务层只调 Public API,不直接 include store/pipeline | 中 |
| 6c | Phase 3 | 目录归位(等级 B):功能留 `src/`,服务移 `server/` | 中 |
| 6d | Phase 4 | Library 化(等级 C):`libgraph_engine_core.a` + `rp-graph-engine` | 高 |

### 5.7 阶段 7(未来):Embedded / Remote 双模式

```python
# py-shared 中的 Interface
class AgentRuntimeInterface(Protocol):
    async def stream_chat(self, ...) -> AsyncIterator[str]: ...
    async def cancel_task(self, task_id: str) -> bool: ...

# Embedded 实现(默认,两进程)
class EmbeddedAgentRuntime:
    """同进程注入,直接调 agent_core"""
    def __init__(self, agent_core, data_adapter): ...

# Remote 实现(未来,多进程)
class RemoteAgentRuntime:
    """HTTP 调用独立 agent_runtime 进程"""
    def __init__(self, base_url: str): ...
```

api_backend 根据配置选择注入哪个实现:
- 默认(`AGENT_BASE_URL` 空):EmbeddedAgentRuntime -> 两进程
- 设 `AGENT_BASE_URL`:RemoteAgentRuntime -> 三进程

Graph 同理。

---

## 六、影响与风险

### 6.1 影响面

| 维度 | 影响 |
|------|------|
| **代码搬迁量** | ~3400 行(graph 1836 + agent 1590)从 api_backend 移到各自 runtime |
| **import 变更** | 40+19=59 处反向+正向依赖重接线 |
| **新增文件** | py-shared 从空壳到 ~15-20 个文件(models/schemas/ports/security/contracts) |
| **C 引擎改动(阶段 6)** | Makefile 链接规则重写 + 目录归位(~80 处路径改) |
| **配置变更** | mypy_path、sys.path 注入、pyproject packages 需同步 |
| **测试** | 全部 171 个单元测试须持续通过(1 个基线失败除外) |
| **文档** | REPO_LAYOUT/PATH_MAPPING/OVERVIEW/README 需同步更新 |
| **运行时行为** | 默认仍两进程(Embedded),不改用户可见行为 |

### 6.2 风险矩阵

| 风险 | 等级 | 缓解 |
|------|------|------|
| agent_service.py 拆分破坏 SSE 流 | **高** | 先写 characterization test 固定现有 SSE 行为,再拆;每步跑 pytest |
| Contract 设计不完整,遗漏 agent_core 数据访问 | 中 | 阶段 4 前完整 grep agent_core 的所有 api_backend 访问,逐一映射 |
| C 引擎删除 asset_pack 后构建失败 | 低 | 默认本就编 stub;删除前跑 `make -f Makefile.rp rp-graph-engine` |
| C 引擎 lib + exe 分离时 vendored 链接顺序错误 | 高 | 阶段 6d 重点;保留原 Makefile 备份,逐步迁移 |
| C 引擎目录归位增大上游 diff | 中 | 接受:Graph Engine 未来独立发布,上游同步频率会降低 |
| py-shared 迁移后 mypy 类型丢失 | 低 | py-shared 用 pydantic + Protocol,mypy 天然支持 |
| index_worker lifespan 迁移导致启动失败 | 中 | 阶段 3 重点验证;graph_engine_runtime 的 lifespan 由 api 代理调用 |
| 两套 job 管理(C 的 index_job_t vs Python 的 index_pipeline)状态不一致 | 中 | 阶段 3 决定统一策略:C 模式下用 C 的 job 管理,Python 模式下用 Python 的 |

### 6.3 不做的事(明示)

- ❌ 不改默认进程拓扑(仍两进程,Embedded 模式)
- ❌ 不实现 Remote Adapter(阶段 7,未来)
- ❌ 不实现 Agent workflow 状态机(是 runtime 的未来扩展,本次只建边界)
- ❌ 不实现 Graph job 优先级/取消(是 runtime 的未来扩展,本次只搬迁现有逻辑)
- ❌ 不改前端(apps/web 零影响)
- ❌ 不暴力重写上游 C 工程(采用渐进式 Phase 0-4)

---

## 七、结果与验收标准

### 7.1 阶段验收标准

| 阶段 | 验收标准 | 验证方式 |
|------|----------|----------|
| 1. C 引擎清理 | `asset_pack.c` 删除;`--ui=true` 移除;C 二进制仍可构建 | `make -f Makefile.rp rp-graph-engine` 成功 |
| 2. 共享下沉 | `grep 'from api_backend.models\|from api_backend.core.security\|from api_backend.core.url_safety' services/agent/agent_core/` = 0 | grep + pytest |
| 3. Graph 移到 runtime | `grep 'from api_backend.services.rp_graph_client\|from api_backend.services.index_pipeline' services/agent/agent_core/` = 0 | grep + import 冒烟 + pytest |
| 4. Agent Contract 化 | `grep 'from api_backend' services/agent/agent_core/` = **0**;`grep 'from agent_core' services/api/api_backend/` = **0** | grep + import 冒烟 + pytest |
| 5. 命名统一 | `graph_engine_runtime` -> `graph_engine_fallback`;`mcp_server` -> `mcp_runtime`;后缀语义一致 | 目录检查 |
| 6. C lib + exe | `libgraph_engine_core.a` + `rp-graph-engine` 两个产物;功能库不含 HTTP/daemon | 构建验证 |
| 7. 双模式(未来) | EmbeddedAdapter + RemoteAdapter 都可运行 | 冒烟测试 |

### 7.2 全局验收(重构完成后须能回答)

1. **agent_core 是什么?** -> Agent 的功能实现(agents/llm/tools/memory),只依赖 py-shared
2. **agent_runtime 是什么?** -> Agent 运行层(执行编排/任务生命周期/SSE),可独立进程、独立部署
3. **graph_engine_core 是什么?** -> C Graph Engine 功能实现(索引/查询/布局),可编译为 `libgraph_engine_core.a`
4. **graph_engine_fallback 是什么?** -> Python 降级功能实现(C 引擎不可用时回退)
5. **graph_engine_runtime 是什么?** -> Graph 运行层(job 管理/C-py fallback/sidecar/对外服务)
6. **API Backend 是否知道 Agent 用哪个 LLM?** -> 不应该(通过 Contract)
7. **API Backend 是否知道 Graph 用 C 还是 Python?** -> 不应该(通过 GraphRuntimeInterface)
8. **删除 agent_runtime 后,agent_core 能独立编译吗?** -> 能(不依赖 runtime)
9. **删除 graph_engine_runtime 后,graph_engine_core/fallback 能独立编译吗?** -> 能
10. **api_backend 能独立运行(不 import agent_core/rp_graph)吗?** -> 能(通过 Runtime Interface,Embedded 模式下 Adapter 在启动期注入)
11. **graph_engine 能脱离 RepoPilot 独立运行吗?** -> 能(不依赖 api_backend/agent/web)
12. **C 引擎功能库能被外部程序直接链接吗?** -> 能(`libgraph_engine_core.a`,不需要启动 HTTP Server)
13. **默认本地运行仍是整体应用吗?** -> 是(两进程:Web + API,内含 Embedded Runtime)
14. **未来能分别部署 Web/API/Agent/Graph 吗?** -> 能(切换 Remote Adapter)

### 7.3 持续验证

每个阶段完成后:
- `ruff check services/`(无新错)
- `mypy services/api/api_backend`(CI 环境 Python 3.11)
- `pytest tests/unit -q`(171 passed,1 基线失败除外)
- `import 冒烟`(api_backend + agent_core + graph_engine_runtime 全链 import 通)

---

## 八、迁移顺序与依赖

```
阶段 1(C 引擎清理)     ── 独立,无依赖
     │
阶段 2(共享下沉)       ── 独立,无依赖(可与阶段 1 并行)
     │
阶段 3(Graph 移到 runtime) ── 依赖阶段 2(py-shared 已就位)
     │
阶段 4(Agent Contract 化)  ── 依赖阶段 2 + 3
     │
阶段 5(命名统一)       ── 依赖阶段 3(graph_engine_runtime 已建)
     │
阶段 6(C lib + exe)    ── 依赖阶段 1(前端遗留已清);可与 2-5 并行
     │
阶段 7(双模式,未来)    ── 依赖阶段 1-6 全部完成
```

**建议**:阶段 1 和 2 可并行,是最低风险的起点。阶段 3 和 4 是 Python 侧核心。阶段 6 是 C 侧核心,可与 Python 侧并行(依赖方向已验证干净)。

---

## 九、上游 MIT 项目处理策略

C 引擎迁自 [codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp)(MIT License)。处理策略比较:

| 方案 | 优点 | 缺点 | 采纳? |
|------|------|------|-------|
| A. 直接在原工程上重构 | 简单 | 破坏上游同步 | ❌ |
| B. upstream + patches | 保持上游同步 | patches 管理复杂 | ❌ |
| C. fork 后逐渐重构 | 可追溯 + 可重构 | fork 偏离上游 | ✅ 当前模式 |
| D. 抽取核心代码重新组织 | 最干净 | 丢失上游历史 | ❌(本次不采用) |

**当前是方案 C**(fork 后逐渐重构)。阶段 6 的目录归位和 lib + exe 分离会增大与上游 diff,但:
- Graph Engine 未来独立发布,上游同步频率会自然降低
- MIT License 允许重组,只需保留 `LICENSE` / `NOTICE` / `THIRD_PARTY.md`
- 内部符号保留 `cbm_*` 前缀,便于追溯

---

## 十、MCP 定位

MCP 不适合作为 agent 子进程。它有三个独立角色:

| 角色 | 说明 | 服务方向 |
|------|------|----------|
| 工具工厂 | 用户演示操作 -> 录制 -> 封装 -> 测试 -> 注册为 MCP 工具 | 独立子系统 |
| MCP 客户端 | agent 通过 MCP 协议调外部 AI(Claude Code/Codex) | agent -> 外部 |
| MCP 服务端 | RepoPilot 把自身能力暴露给外部 AI("Claude Code 你自己接入 RepoPilot 的 MCP") | 外部 -> RepoPilot |

**结论**:MCP 是 `services/` 下的独立服务,与 agent/graph_engine 平级。当前占位(`mcp_runtime/`),实际开发留待 v1.4+。

---

## 附录:参考文档

以下文档为外部 AI(GPT)辅助生成的架构构想,**作为参考,具体以本仓库实际代码为准**:

1. **《RepoPilot 目标架构与重构要求》** - 定义 Core/Runtime/API/Web/Graph/Agent 生命周期/MCP 的职责边界、目标目录、依赖原则、迁移策略(5 阶段)。关键贡献:明确"Core=能力 / Runtime=运行管理 / API=传统后端"三分原则。
2. **《RepoPilot 架构重构总纲:Core / Runtime / Embedded / Remote》** - 定义 Embedded/Remote 双模式、Runtime Interface(Protocol + Adapter)、进程边界与代码职责边界的区分。关键贡献:明确"双进程不会因 Runtime 抽离而消失"(Embedded 模式)。
3. **《RepoPilot -> KnowledgePilot 长期架构设计与 Graph Engine 重构方案讨论报告》** - 定义 Graph Engine 独立发布愿景、C 引擎渐进式拆分 Phase 0-7、上游 MIT 项目处理策略。关键贡献:明确"功能源码和服务源码必须彻底解耦,即使第三方实现内部没有做到也要通过渐进式重构建立边界"。

### 参考文档与实际代码的差异(以代码为准)

| 参考文档说法 | 实际代码情况 | 本次采纳 |
|--------------|--------------|----------|
| "默认多进程(Web:5173+API:1111+Agent:2222+Graph:3333)" | 当前默认两进程(5173+19878) | **保持两进程**(Embedded 模式),多进程为未来可选 |
| "agent_runtime -> agent_core 单向依赖" | agent_core 反向依赖 api_backend 40 处 | 阶段 2-4 逐步消除,通过 Contract + Adapter |
| "graph_engine_runtime 管理 C/py fallback" | fallback 逻辑在 api_backend 的 rp_graph_client.py | 阶段 3 迁移到 graph_engine_runtime |
| "C 源码不机械拆分" | C 依赖方向干净(功能不依赖服务,全部 0),lib+exe 技术可行 | **修正:阶段 6 渐进式拆分**(Phase 0-4) |
| "MCP 放 services/mcp/mcp_runtime" | 当前 mcp_server 是 10 行占位 | 采纳命名,实际开发留待 v1.4+ |
| 端口号 1111/2222/3333 | 实际端口 19878/19877/9750 | 以实际代码为准 |

---

## 附:本次对话已完成的前序工作

本次重构报告基于以下已完成的工作(已提交到 main 分支):

| commit | 内容 |
|--------|------|
| `b5db14f` | graph_engine 重组为 core/runtime/layout 三段 + 发行包名 rp-graph -> repopilot-graph-engine |
| `2f31408` | backend 包改名为 api_backend,对齐兄弟服务命名 |
| `37bb501` | graph sidecar 默认不自动拉起,确保严格两进程拓扑 |
| `e64e3af` | 删除 api_backend agent 兼容 shim,直接 import agent_core |

这些工作建立了命名基础和默认两进程拓扑,是本次 Runtime 边界重构的前提。
