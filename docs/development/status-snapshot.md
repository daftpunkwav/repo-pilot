# RepoPilot 现状快照(只读盘点 / 2026-08-04,2026-08-05 修订)

> **体例**:每个论断附 `file_path:line`,可验证。区分 **[已核实]** = 亲自 Read 源码;**[仅文档]** = 仅文档声称。
> **范围**:`services/api/api_backend/`、`services/agent/`、`apps/web/src/`、`tests/`、`docs/` 全部权威来源。
> **未覆盖**:`archive/` 旧代码逐字、`apps/web/src/api/real/index.ts` 全部 method body 逐字、`tests/integration/*.py` 全部逐字。本次为不修改模式,未做运行时实测。
> **数字速查**:
> - Agent 数(代码):**7**(`hub / scout / mentor / navigator / curator / scribe / atlas`)
> - 工具数(代码):**24**
> - DB 表(代码):**12**(SPEC 文档 14,其中 3 张以 JSON 字段替代)
> - API 端点(代码):**67**(`@router` 装饰器)+ 1 个 `GET /health` = 68
> - 端口:历史 19876 -> **现行 19878**
> - 文档层:`PRD > SPEC > MVP`(产品权威性)

---

## 0. 文档元信息

| 项 | 值 |
|---|---|
| 报告日期 | 2026-08-04(2026-08-05 修订:端点数/字段数/测试数/mock 文件数/Projects 端点数/对 PROGRESS_REPORT 指控) |
| 报告类型 | 只读盘点 |
| 代码版本 | **2.0.0** |
| 不写文件(本次) | 是(Plan 模式期间) |
| 已探明的事实 | 全部带 [已核实] 标签 |
| 未核实的事实 | 标注 [仅文档] 或 [未逐字读] |

---

## 1. 项目身份

| 维度 | 值 | 引用 |
|---|---|---|
| 项目名 | **RepoPilot** | `package.json:2` |
| 定位 | AI-driven GitHub 开源项目学习平台(7 Agent + BYOK) | `docs/product/v2/PRD/PRD.md:17` |
| 代码版本 | **2.0.0** | `package.json:4`、`apps/web/package.json:4`、`services/api/pyproject.toml:3`、`api_backend/main.py:95` |
| Python 要求 | `>=3.11` | `services/api/pyproject.toml:5`、`pyproject.toml:5` |
| Node 要求 | `>=20.11` | `apps/web/package.json:7` |
| 包管理器 | `npm@10.9.0` | `apps/web/package.json:8` |
| FastAPI 标题 | `RepoPilot` | `api_backend/main.py:95` |
| FastAPI 版本 | `2.0.0` | `api_backend/main.py:95` |
| Monorepo 工具 | npm workspaces(`apps/*`、`packages/*`) | `package.json:6-8` |
| Python workspace | `services/api`、`services/agent`、`services/mcp` | `pyproject.toml:7-8` |

**核心结论**:代码层与产品层在版本号上达成了一致(均为 v2.0.0),但产品层内部"v1 vs v2"两套文档同时存在(`docs/product/v1/`、`docs/product/v2/`),**v2 仍为草稿**(`docs/product/v2/PRD/PRD.md:3` 自承)。

---

## 2. Monorepo 真实布局(REPO_LAYOUT vs PROGRESS_REPORT 冲突)

### 2.1 工作区声明

- npm workspaces:`apps/*`、`packages/*`(`package.json:6-8`)
- uv workspace(根 `pyproject.toml`):`services/api`、`services/agent`、`services/mcp`(`pyproject.toml:7-8`)

### 2.2 顶层目录清单(盘后)

```
RepoPilot/
├── apps/
│   ├── web/                 # React 19 SPA,已实现
│   └── desktop/             # 仅 README 占位(`apps/desktop/README.md:1-19`)
├── services/
│   ├── api/                 # FastAPI 主后端(已实现)
│   │   ├── api_backend/         # 真实实现代码 + shim(agents/llm/memory/tools)
│   │   └── migrations/alembic/versions/6096bed38e20_initial_schema.py
│   ├── agent/               # 真实 Agent 实现所在
│   │   ├── agent_core/      # 主实现(agents/llm/memory/tools)
│   │   └── agent_runtime/   # 独立进程(端口 19877),仍复用 backend
│   └── mcp/                 # 占位(README + pyproject + mcp_server 占位)
├── packages/                # 共享契约
│   ├── types/               # OpenAPI 生成,已就绪
│   ├── ui/                  # 占位(无组件)
│   ├── contracts/           # openapi.json 导出文件
│   ├── prompts/             # 占位 README
│   ├── py-shared/           # 占位 __init__.py
│   └── config/              # tsconfig.base.json
├── scripts/                 # export_openapi.py、dev.ps1、_debug_mentor_empty.py
├── docs/                    # 产品 + 设计 + 架构 + 发展
├── tests/                   # conftest + 5 层
├── archive/                 # v1.x/v0.x 旧 Flask + 原生 JS(归档,不直接运行)
├── data/                    # SQLite 运行时数据目录
├── tmp/                     # 临时(被 .gitignore)
├── .claude/                 # Claude 配置缓存(worktrees)
├── .reasonix/               # Reasonix 工具 JSON 缓存
├── .zcode/                  # ZCode 计划工具缓存(plans/)
├── .playwright-mcp/         # Playwright MCP 临时
├── .playwright-cli/         # Playwright CLI 临时
└── (配置文件).env/.env.example/alembic.ini/pyproject.toml/package.json
```

### 2.3 `services/agent` 真实状态(两文档说法不一)

| 文件 | 声称 | 真实情况(已核实) |
|---|---|---|
| `docs/architecture/REPO_LAYOUT.md:51` | "Agent ✅ 核心已迁入 `services/agent/agent_core/`;`api_backend/{agents,llm,tools,memory}` 为兼容 shim;`agent_runtime` 可独立 SSE" | **事实正确** |
| `docs/development/PROGRESS_REPORT.md:77` | "`services/agent` 的 **agent_core 业务已实现**(agents/llm/tools/memory 均已迁入),但 `agent_runtime` 独立进程仍共享 `backend` 全栈" | **事实正确**(2026-08-05 核实:PROGRESS_REPORT 已在提交 `5ff949c` 修正此前"仍为占位"的过期表述) |
| 实际代码 | — | `services/agent/agent_core/{agents,llm,memory,tools}/*.py` 全部为真实业务(7 Agent、24 工具、Memory、LLM);`services/api/api_backend/{agents,llm,tools,memory}/*.py` 均为 9 行 `globals().update(...)` 转发 shim(`api_backend/agents/__init__.py:1-8`) |

**结论**:**REPO_LAYOUT.md 与 PROGRESS_REPORT.md 现均正确描述** `agent_core` 已实现、`agent_runtime` 同体。本报告早先版本曾指控 PROGRESS_REPORT"已过期"(所引旧表述"独立 Agent 推理进程仍为占位"已不存在),该指控本身已过时,现予撤销。

---

## 3. 后端能力盘点(`services/api/api_backend/`)

### 3.1 入口 / 配置 / 数据库

#### 3.1.1 `pyproject.toml:6-32`
- **运行时依赖**(16 个):`fastapi>=0.104.0`、`slowapi>=0.1.9`、`uvicorn[standard]>=0.24.0`、`sqlalchemy>=2.0.0`、`alembic>=1.12.0`、`pydantic>=2.5.0`、`pydantic-settings>=2.1.0`、`email-validator>=2.0.0`、`python-jose[cryptography]>=3.3.0`、`passlib[bcrypt]>=1.7.4`、`bcrypt>=4.0.0`、`python-multipart>=0.0.6`、`aiosqlite>=0.20.0`、`litellm>=1.40.0`、`python-dotenv>=1.0.0`、`httpx>=0.25.0`
- **dev extras**:`pytest>=7.4.0`、`pytest-asyncio>=0.21.0`、`httpx>=0.25.0`、`ruff>=0.1.0`、`mypy>=1.7.0`
- **构建后端**:`hatchling`,wheel 包名 `backend`

#### 3.1.2 `api_backend/main.py`
- `main.py:13-25` 导入 11 个 router:`agent / auth / categories / github / graph / notes / overview / projects / settings / tags / user`(注意 `auth` 单独挂,其余 10 个走 `/api/v1`)
- `main.py:39-40` 启动期校验 `SECRET_KEY` ≥32 字节,否则 `ValueError`
- `main.py:41` 启动期 `await init_db()`(实际是 Alembic upgrade head)
- `main.py:42-44` `seed_preset_categories(session)` 注入预设分类
- `main.py:48-92` `_LoginBodyCacheMiddleware` 自定义中间件:拦截 `POST /api/v1/auth/login`,从 body 解析 username 写入 `scope["state"]["rate_limit_username"]`,重放完整 body 给下游
- `main.py:95` `FastAPI(title=settings.app_name, version="2.0.0", lifespan=lifespan)`
- `main.py:97-103` Middleware 顺序(自下而上执行):`SlowAPIMiddleware → _LoginBodyCacheMiddleware → CsrfMiddleware → setup_middleware(app)(CORSMiddleware)`
- `main.py:106-116` 路由 mount(11 个 router,共 **67** 个 `@router` 端点,详见 §3.8)
- `main.py:119-121` `GET /health` 返回 `{"status":"ok","version":"2.0.0"}`

#### 3.1.3 `api_backend/config.py`
- `config.py:12-22` `REPO_ROOT`:向上寻找同时含 `apps/` 与 `services/` 的目录;`DATA_DIR = REPO_ROOT/data`
- `config.py:29-33` `Settings(BaseSettings)`:`env_file=".env"`、`env_file_encoding="utf-8"`、`extra="ignore"`
- 21 个字段(`config.py:36-91`):
  - `app_name="RepoPilot"` `:36`
  - `debug=False` `:37`
  - `api_v1_prefix="/api/v1"` `:38`
  - `database_url="sqlite:///{DATA_DIR/'repopilot.db'}"` `:41`
  - `secret_key`(必填)`:44-47`
  - `secrets_encryption_key: Optional[str]` `:49-52`
  - `access_token_expire_minutes=60` `:54`
  - `refresh_token_expire_days=30` `:55`
  - `auth_cookie_secure: Optional[bool]` `:57`
  - `auth_cookie_samesite: Optional[str]` `:58`
  - `rate_limit_enabled=True` `:61`
  - `rate_limit_login="5/minute"` `:62`
  - `rate_limit_register="3/hour"` `:63`
  - `rate_limit_refresh="20/minute"` `:64`
  - `rate_limit_agent="20/minute"` `:66`
  - `cors_allow_origins`(10 个默认 origin,含 `5173/5174/5175/4173/5193/127.0.0.1` 等)`:70-75`;方法 `cors_origins_list()` 逗号切分并过滤空串 `:77-78`
  - `agent_base_url: Optional[str]` `:81-84`(独立 Agent 进程 URL)
  - `agent_internal_token: str=""` `:85-88`
  - `llm_api_key: str=""` `:89`
  - `llm_api_base: Optional[str]` `:90`
  - `llm_model: str="gpt-4o-mini"` `:91`
- `config.py:94-105` `get_settings()` `@lru_cache()`,捕获 `ValidationError` 把"secret_key missing"翻译成中文 `ValueError`
- **`config.py` 没有 `app_port` 字段** — 端口硬编码在 `npm run dev:api` 与 `vite.config.ts`

#### 3.1.4 `api_backend/database.py`
- `database.py:16-17` 模块级单例 `_engine / _session_factory`
- `database.py:20-24` `_async_database_url(url)`:将 `sqlite:///` 转 `sqlite+aiosqlite:///`
- `database.py:27-30` `_ensure_data_dir(url)`:根据 URL 自动 mkdir
- `database.py:33-43` `get_engine()`:懒创建,`echo=settings.debug, future=True`
- `database.py:46-52` `get_session_factory()`:`expire_on_commit=False`、`class_=AsyncSession`
- `database.py:55-59` `reset_database()`:测试用,重置单例
- `database.py:62-63` `class Base(DeclarativeBase)`
- `database.py:66-70` `get_session()`:FastAPI 依赖
- `database.py:73-79` `init_db()` → `asyncio.to_thread(_run_alembic_upgrade())`
- `database.py:82-92` `_run_alembic_upgrade()`:构造 `Config(REPO_ROOT/alembic.ini)`,执行 `command.upgrade(cfg, "head")`

### 3.2 7 Agent 注册表

**主注册表**:`services/agent/agent_core/agents/registry.py:176-437`
**模块单例**:`AgentRegistry`(`registry.py:440-457`);`_registry = AgentRegistry()`(`registry.py:462`);导出 `get_registry()`(`registry.py:465-466`)
**Catalog(静态档案)**:`services/api/api_backend/services/agent_catalog.py:4-53`,7 项 `AgentProfileOut`
**Settings 校验白名单**:`services/api/api_backend/services/settings_service.py:12` `AGENT_IDS = ("hub","scout","mentor","navigator","curator","scribe","atlas")`

#### 3.2.1 Agent 定义核心结构(`registry.py:11-38`)
`@dataclass AgentDefinition` 18 字段:`id, name, description, tools, capabilities, system_prompt, soul, workflow, temperature, max_tokens, max_iterations, streaming, auto_trigger, priority, model_override, display_name, role_hint, serial, intent_patterns`。`workflow` 默认 `Workflow.REACT`(`:21`)。

#### 3.2.2 7 个 Agent 完整注册信息

| 字段 | hub | scout | mentor | navigator | curator | scribe | atlas |
|---|---|---|---|---|---|---|---|
| `id` | hub | scout | mentor | navigator | curator | scribe | atlas |
| `name` | Hub | Scout | Mentor | Navigator | Curator | Scribe | Atlas |
| Soul 行 | `:42-54` | `:55-66` | `:67-82` | `:83-94` | `:95-108` | `:109-122` | `:123-134` |
| tools | `query_user_projects, get_learning_stats, dispatch_agent, ask_user, propose_memory, query_knowledge_graph, manage_session_projects`(`:181-189`) | `get_project_detail, fetch_github_repo, fetch_readme`(`:235-239`) | `query_user_projects, get_project_detail, fetch_readme, query_knowledge_graph, list_notes, ask_user, propose_memory, get_learning_stats, update_project_progress`(`:271-280`) | `query_user_projects, query_knowledge_graph, get_learning_stats, list_notes, ask_user, propose_memory, update_project_progress`(`:312-319`) | `query_user_projects, get_project_detail, list_categories, suggest_category, ensure_category, set_project_category, list_tags, ensure_tags, set_project_tags, update_project_progress, select_import_repos, import_github_repos, ask_user, propose_memory`(`:343-357`) | `query_user_projects, get_project_detail, list_notes, draft_note_outline, create_note, update_note, query_knowledge_graph, fetch_readme, propose_memory, ask_user`(`:383-393`) | `query_knowledge_graph, query_user_projects, get_project_detail, get_learning_stats, propose_memory`(`:417-422`) |
| workflow | `plan_execute` (`:223`) | `react` (`:253`) | `react` (`:292`) | `react` (`:326`) | `reflexion` (`:366`) | `react` (`:400`) | `react` (`:427`) |
| max_iter | 4 (`:227`) | 2 (`:258`) | 2 (`:296`) | 2 (`:330`) | 4 (`:371`) | 4 (`:404`) | 2 (`:431`) |
| priority | 0 (`:224`) | 10 (`:255`) | 20 (`:293`) | 15 (`:327`) | 5 (`:368`) | 5 (`:401`) | 8 (`:428`) |
| auto_trigger | False | True (`:254`) | False | False | True (`:367`) | False | False |
| serial | False | False | True (`:298`) | True (`:332`) | False | True (`:406`) | False |
| intent_patterns | (无) | (分析\|扫一眼\|速览\|overview\|scout\|对比\|比较\|区别\|差异\|vs) (`:260-263`) | (想学习\|学习\|入门\|教我\|讲解\|深入\|怎么理解\|mentor …) (`:299-304`) | (规划\|路线\|学习路径\|roadmap\|navigator) (`:333-335`) | (分类\|整理\|标签\|归类\|curator) (`:373-375`) | (笔记\|总结\|摘要\|outline\|scribe) (`:407-409`) | (图谱\|关联\|相似项目\|知识图\|atlas) (`:433-435`) |
| temperature | 0.5 | 0.3 | 0.55 | 0.45 | 0.3 | 0.45 | 0.45 |
| max_tokens | 4096 | 2400 | 4096 | 3200 | 1600 | 3200 | 1600 |

#### 3.2.3 Soul 风格(`registry.py:41-135`)
每个 Soul 含 6 个风格键 `core / default / gentle / strict / sarcastic / casual`。渲染函数 `render_soul(soul, style="default")`(`:147-150`)。`GLOBAL_OUTPUT_RULES`(`:139-144`):**禁用 emoji + 纯中文 Markdown**。

#### 3.2.4 `AgentRegistry` 类方法(`registry.py:440-457`)
`get(id) / list_all() / has(id) / register(AgentDefinition)`

### 3.3 24 个内置工具(已全部明确归属)

#### 3.3.1 ToolProtocol(`tools/registry.py:11-114`)
- `ToolHandler = Callable[..., Awaitable[Any]]`(`:11`)
- `@dataclass ToolDefinition(name, description, parameters, handler, allowed_agents=[], timeout_ms=30_000, required_permission=None)`(`:47-65`),提供 `to_openai_format()` (`:57-65`)
- `class ToolRegistry`(`:68-114`)
- 权限表 `TOOL_PERMISSION_MAP`(`:15-26`)9 项:`fetch_github_repo/fetch_readme/create_note/update_note/ensure_category/set_project_category/ensure_tags/set_project_tags/update_project_progress/import_github_repos`
- 默认权限 `_PERMISSION_DEFAULTS`(`:29-35`):`allow_web_search=True、allow_github_api=True、allow_file_write=False、allow_note_write=True、allow_project_write=True`
- 装饰器 `@tool(name, description, parameters, allowed_agents=[], timeout_ms=30_000, required_permission=None)`(`:121-142`),立即注册到 `global_registry`
- 超时:`asyncio.wait_for(timeout_ms/1000)` + 异常捕获 → `{"error": ...}`

#### 3.3.2 24 工具矩阵(全部 `services/agent/agent_core/tools/builtin.py`)

| # | Name | 行 | 读/写 | 调度/反问 | 授权 |
|---|---|---|---|---|---|
| 1 | `query_user_projects` | `:67-114` | 读 | — | — |
| 2 | `get_project_detail` | `:132-182` | 读 | — | — |
| 3 | `fetch_github_repo` | `:185-224` | 读(网络) | — | `github_api` |
| 4 | `fetch_readme` | `:227-276` | 读(网络) | — | `github_api` |
| 5 | `query_knowledge_graph` | `:279-319` | 读 | — | — |
| 6 | `list_categories` | `:322-335` | 读 | — | — |
| 7 | `suggest_category` | `:338-372` | 读(仅候选) | — | — |
| 8 | `list_notes` | `:375-408` | 读 | — | — |
| 9 | `draft_note_outline` | `:411-449` | 读(不落库) | — | — |
| 10 | `ask_user` | `:452-554` | 读 | **反问(`__question__`)** | — |
| 11 | `manage_session_projects` | `:557-623` | **写** | — | — |
| 12 | `propose_memory` | `:626-675` | **写**(pending,apply=False) | — | — |
| 13 | `get_learning_stats` | `:678-700` | 读 | — | — |
| 14 | `dispatch_agent` | `:703-774` | 读(返回 `__dispatch__`) | **调度** | — |
| 15 | `select_import_repos` | `:777-828` | 读(返回 `__select_repos__`) | — | — |
| 16 | `create_note` | `:867-949` | **写** | — | `note_write` |
| 17 | `update_note` | `:952-1008` | **写** | — | `note_write` |
| 18 | `ensure_category` | `:1011-1055` | **写** | — | `project_write` |
| 19 | `set_project_category` | `:1058-1116` | **写** | — | `project_write` |
| 20 | `list_tags` | `:1119-1130` | 读 | — | — |
| 21 | `ensure_tags` | `:1133-1165` | **写** | — | `project_write` |
| 22 | `set_project_tags` | `:1168-1259` | **写** | — | `project_write` |
| 23 | `update_project_progress` | `:1262-1317` | **写** | — | `project_write` |
| 24 | `import_github_repos` | `:1320-1404` | **写** | — | `github_api` |

#### 3.3.3 写工具的关键事实

- **`create_note`** (`:867-949`):限标题 256 字 / 正文 100000 字;校验 `compare_project_ids` 归属;返回 `note_created` action + 链接到 `/notes?note=...`;`ports.notes.create → ports.commit()`(`:925, 931`)
- **`update_note`** (`:952-1008`):校验 `note_id` 是 UUID;`ports.notes.update(_uid(ctx), **fields)`;自动 `updated_at=utcnow`
- **`ensure_category`** (`:1011-1055`):`ports.categories.ensure()`;仅 `created=True` 时 commit;返回 `category_ensured` action
- **`set_project_category`** (`:1058-1116`):`category_name` 时也走 ensure;`ports.projects.update_fields(project, category_id=cat.id)` + commit
- **`ensure_tags`** (`:1133-1165`):`ports.tags.ensure_many(uid, wanted)` + commit;返回 `created_names`
- **`set_project_tags`** (`:1168-1259`):校验 `tag_ids` 归属;支持 `mode="replace"/"add"`(add 先 `get_project_tag_ids`);`ports.tags.set_on_project`
- **`update_project_progress`** (`:1262-1317`):白名单 `progress ∈ {none, learning, learned, mastered}`(`:1293-1296`)
- **`import_github_repos`** (`:1320-1404`):解析 str/dict 数组,`_safe_github_name` 校验;`ports.projects.import_repos()`
- **`manage_session_projects`** (`:557-623`):改 `AgentSession` 关联项目,返回 `__session_projects__`
- **`propose_memory`** (`:626-675`):`context.memory.propose_memory(apply=False)` → `pending_memory_proposals` 队列
- **`dispatch_agent`** (`:703-774`):`get_registry().has(target_agent)`;`task` 超 4000 字截断;`reason` 超 500 字截断;返回 `__dispatch__`
- **`ask_user`** (`:452-554`):返回 `__question__`;运行时会修复上游损坏"单字符数组 options"
- **`select_import_repos`** (`:777-828`):返回 `__select_repos__` 不落库

### 3.4 编排工作流

#### 3.4.1 Hub Plan-and-Execute(`agent_core/agents/hub.py`)
- `_DEFAULT_AGENT_CONFIG = AgentEngineConfig()`(`:38`)
- `_EXPERT_SUMMARY_CHARS = 6000`(`:40`);`_EXPERT_HISTORY_WINDOW = 6`(`:42`)
- 派生 `serial=True` 的 Agent 集合 `_SERIAL_DISPATCH_AGENTS`(`:44-46`)
- 关键模块级函数:
  - `structure_expert_summary(agent_id, text)`(`:56-78`):头部 H1/H2/有序列表抓要点 + 正文摘录
  - `apply_merge_mode(agent_def)`(`:195-212`):汇总轮 `workflow=direct, tools=[], max_iter=1, 注入「必须合并提示」`
  - `_CHITCHAT_RE`(`:216-223`) + `is_simple_chitchat(message)`(`:226-231`)+ `apply_chitchat_mode(agent_def)`(`:234-255`):长度 ≤24 字寒暄快路径,`workflow=direct, tools=[], max_tokens=320`
  - `_dispatch_fingerprint(dispatch)`(`:274-284`):去重 key = `sha1(target + task[:])`
  - `apply_evaluate_mode(agent_def)`(`:287-309`):评估轮 `workflow=react, tools=[dispatch_agent, ask_user], max_iter=2`
- `MAX_HUB_DISPATCH_ROUNDS = AgentEngineConfig.max_hub_dispatch_rounds = 2`(`:259`)
- `DispatchRoundOutcome`(`:263-271`):结构化替代 `result_bag`
- `HubService.handle_chat`(`hub.py:354-494`):**唯一主对话入口**;**单 Agent 路径:仅 `force_agent` 直达,否则固定走 Hub**(`:405-409`)
- `HubService.handle_question_answer`(`:496-577`)
- `HubService.handle_direct_agent`(`:579-645`):页面直调 Agent(用于 analyze / classify / note / graph-guide / trending-scout)
- `_orchestrate_multi`(`:647-857`):多意图并行 / 串行调度,每专家包成 `subagent_*` SSE
- **`_dispatch_evaluate_loop`**(`hub.py:859-1126`):**Plan-and-Execute 评估再调度核心**
  - **流程**:去重 → 执行批次 → 反问短路 → 1 专家走 `_run_merge_finalize` → 单专家 passthrough → 评估决定再 dispatch 或收口
  - **再 dispatch 判定**:`eval_result.dispatches` 非空 & `round + 1 < max_hub_dispatch_rounds` → 继续;否则 break
  - **默认 2 轮上限**(来自 `types.py:38`)

#### 3.4.2 ReAct 引擎(`agent_core/agents/react.py`)
- 关键 dataclass:`EngineResult(text, agent_id, usage, iterations, question, dispatches, pending_status)`(`:28-35`)
- `_strip_think_markers(text)`(`:38-44`):剥 `<<<THINK>>>/<<<END_THINK>>>` 标记
- `_emit_text_deltas(text, *, emit_sse, step=24)`(`:47-54`):长文本按 24 字切片发 `text_delta` SSE
- `_stream_plain_text`(`:90-150`):Pyhon async 迭代 LLMChunk;**关键**: `channel="thinking"` 时 reasoning 计入 full + thinking SSE;`channel="text"` 时 reasoning 提升为正文
- `_cot_two_phase_stream`(`:152-302`):CoT 两阶段(分析 + 正文)
- `_plan_phase_to_thinking`(`:305-401`):多步工作流规划阶段;`plan_cap` 默认 420 / ToT 900 / 快速编排 280
- `ReActEngine.run`(`:403-514`):**执行入口**,选择路径(direct/cot/plan_execute/tot/reflexion)
- `_prepare_tools`(`:516-528`):双层过滤(注册表 → AgentDefinition 白名单)
- `_run_degraded`(`:530-545`):无 LLM 降级
- `_run_direct_stream`(`:547-617`):direct / 无工具单次正文流式
- **`_run_tool_loop`**(`:619-1068`):**多步工作流工具环主循环**;`max_iter` 通过 `_effective_max_iter(agent_def)` 取值(`:635`)
- `_run_closing_reply`(`:1070-1154`):收口正文强制无工具再答,`closing_min_tokens=2048`
- `_WORKFLOW_HINTS`(`:1189-1221`):COT/DIRECT/PLAN_EXECUTE/REFLEXION/TOT/REACT 各提示;`PLAN_EXECUTE` 强制"不要一次调度超过 3 个 Agent"
- **`is_plan_announcement(text, *, agent_id, had_tool_calls=False)`**(`:1245-1280`):**关键兜底**,识别 Hub 在 plan_execute 下"只宣布计划"但未真调工具的伪完成

#### 3.4.3 ReAct `_run_tool_loop` 内 5 协议(`react.py:806-1056`)
1. **反问**:`tool_result.__question__ = True` → 发 `tool_result + question` SSE + yield `EngineResult(question=...)` + `("__abort__",)`(`:833-919`)
2. **Hub 调度**:`__dispatch__ = True` → 收 `dispatches` + 注入 tool 消息 + 继续循环(`:921-949`)
3. **会话项目**:`__session_projects__` → 发 `session_projects` SSE(`:951-987`)
4. **导入助手勾选**:`__select_repos__` → 发 `select_repos` SSE(`:989-1026`)
5. **普通工具**:发 `tool_result` + 把截断 JSON 注入 `messages`(`:1028-1056`)

#### 3.4.4 空承诺纠正(`react.py:692-798`)
plan_execute 模式下:
- `_PLAN_HEADER_RE` 行首(「执行计划」/「行动计划」/「计划步骤」)
- `_DISPATCH_HINT_RE` (调度/分派/dispatch + 6 专家名,忽略大小写)
- `_PLAN_ANNOUNCE_RE` (开始分派/正在调度/这就调度/马上调度)
- `_DISPATCH_NEGATION_RE` (无需/不用/不必/不再/无须 + 调度)
- `_DELIVERY_STRUCTURE_RE` (有 H1/H3 标题 / 列表 / 代码块 / 表格 → 不算空承诺)
- 命中则注入"必须 dispatch 或写正文"提示,最多 2 次(`:637 plan_nudge_used`),用尽再空承诺 → 替换为「编排未完成」固定文案(`:786-792`)

#### 3.4.5 Intent Classifier(`agent_core/agents/intent.py`)
- `_FAST_RULE_ORDER = ("scout", "navigator", "mentor", "curator", "scribe", "atlas")`(`:17`)
- `_derive_fast_rules()`(`:20-31`):从注册表派生
- `SubIntent(agent_id, message, reason)`(`:35-38`);`IntentResult(agent_id, confidence, is_multi, sub_intents, plan_summary)`(`:42-47`)
- `IntentClassifier.classify`(`:80-111`):
  - 空 → `agent_id="hub", conf=1.0`
  - 多意图(`_rule_multi`,`MULTI_KEYWORDS = ["并且","同时","另外","还有","以及","并帮我","再帮我","然后"]`)→ `is_multi=True, sub_intents=[...]`
  - 快速规则 → `conf=0.9`
  - LLM 分类(`_llm_classify`,`temperature=0.1, max_tokens=400`)→ 解析 JSON
  - 兜底 → `agent_id="hub", conf=0.5`
- `_split_segments`(`:61-78`):按多意图连接词切分,**最长关键词优先**(避免「并帮我」被「并」截断)

#### 3.4.6 5 类反问(`agents/question.py`)
`_normalize_question(tool_result, *, agent_id)`(`:194-319`),通过 `qtype` 分派:

| 形态 | qtype | 行 | 产物 |
|---|---|---|---|
| 单选 / 测验 | `single_choice / radio / quiz` | `:208-240` | `type="radio"`,可选 `exam=True`;`allow_other=False` 当测验 |
| 多选 | `multi_choice / checkbox` | `:241-256` | `type="checkbox"`,`options=[{value,text}]` |
| 滑块 | `scale / slider` | `:257-267` | `type="slider"`,`min/max/labels` |
| 文本(单选壳) | `text` 或其它 | `:268-278` | `type="radio"`,单「自由填写」选项 |
| 空 items 兜底 | — | `:279-289` | 默认问"水平处于哪个阶段" |

防御性清洗辅助函数:
- `_clean_options(raw)`(`:10-142`):拒绝 `list("abc")` 拆字 / 假 `{"A":""}` / 假「选项 A」占位
- `_parse_letter_options(text)`(`:145-162`):A/B/C/D 行内文本解析
- `_default_options(qid_item, prompt)`(`:165-191`):关键词驱动默认选项

返回结构(`:308-318`):
```python
{
  "question_id": "q_{uuid12}",
  "agent_id": agent_id,
  "intro": {"type":"markdown","content": f"**{title}**"},
  "questions": [...],
  "actions": {"submit":{"text":"提交","style":"primary"}, "skip":{"text":"跳过","style":"ghost"}},
  "allow_skip": bool(tool_result.get("allow_skip", True)),
  "timeout": None,
}
```

### 3.5 Memory 分层与合并协议(`agent_core/memory/`)

#### 3.5.1 `context.py:18-45` AgentRunContext
18 字段:`user_id, session_id, agent_id, db, llm, llm_config, memory, tool_registry(default=global_registry), project_id, project, project_ids, projects, user_profile, long_memory, short_memory, speaking_style(default="default"), permissions, code_of_conduct, agent_guideline, extra, ports`

#### 3.5.2 `ContextBuilder`
- `build_run_context(*, user_id, session_id, agent_id, llm, llm_config, project_id=None, speaking_style="default", permissions=None) -> AgentRunContext`(`:64-130`)
- `build_system_prompt(agent_def, ctx) -> str`(`:132-228`):拼装顺序: `agent_def.system_prompt → render_soul → 用户准则 → Agent 准则 → 画像 → 长期 → 短期 → 项目 → 风格 → 输出规范`
- `build_messages(*, agent_def, ctx, user_message, history=None, prior_agent_summary=None)`(`:230-251`)
- `load_chat_history(session_id, limit=20)`(`:253-266`):**只保留 user/assistant role,system/tool 丢弃**(`:259-265`)
- `context_segments(messages, agent_id) -> list[dict]`(`:268-293`):返回 `System/Soul / 对话消息 / 工具定义 / 记忆` 四段估算
- `STYLE_HINTS`(`:48-54`):5 种风格(default/gentle/strict/sarcastic/casual)语气文案

#### 3.5.3 `MemoryService` 关键方法(`service.py:22-452`)
- `ALLOWED_PREF_KEYS = {"tech_stack","level","language","goal","speaking_style"}`(`:19`)
- `get_session(session_id, user_id) -> AgentSession | None`(`:28`)
- `list_recent_messages(session_id, limit=30)`(`:34`)
- `get_user_profile_dict(user_id)`(`:47`)
- `get_short_memory(user_id, agent_id) -> list[dict]`(`:52-60`):从 `agent_prefs.short_memory[agent_id]` 取
- `append_short_memory(user_id, agent_id, entry, max_items=12)`(`:62-77`):截尾 12 条
- `get_long_memory(user_id) -> list[dict]`(`:79-83`):从 `agent_prefs.memory_items`
- **`propose_memory`**(`:85-122`):**核心合并 API**
  - `value` 截断 2000 字;`evidence` 截断 8 项;`confidence` 钳到 `[0,1]`
  - 生成 `prop_xxx` id
  - `apply=False` 入 pending 队列(`status=pending`);`apply=True` 直接 `_apply_proposal`(`status=applied`)
- `_enqueue_pending_proposal`(`:124-142`):同 value 去重,队列最新 20 条
- `accept_memory_proposal / reject_memory_proposal`(`:144-187`):从 pending 取出/删除
- `_apply_proposal`(`:189-196`):分派到 `_merge_long_memory / _merge_tech_profile / _merge_preference`
- `_merge_long_memory`(`:198-238`):子串/相等冲突检测 → 高置信度覆盖,上限 100 条;首写时同步 `history_summary` 截断 200 字
- `_merge_tech_profile`(`:240-297`):value 解析 `"Python:80"` 或 JSON → **旧×(1-conf) + 新×conf 加权**;同步 `tech_profile JSON + memory_items[category=tech]`
- `_merge_preference`(`:299-362`):走 `_preference_readable`;JSON 按 `ALLOWED_PREF_KEYS` 白名单;`k:v` 同样白名单;否则写 `note`;同步 `preferences + memory_items[category=preference]`
- `_looks_like_answer_dump(obj)`(`:364-375`):识别答题 dump
- `_preference_readable(value)`(`:377-409`):转可读短句,识别答题 dump 抽 3 条生成「答题偏好 · …」
- **`compress_history_if_needed`**(`:410-436`):超过 24 条时,system 不动,中间截成「历史对话摘要」(每条 400 字,最多 20 段) + 最近 12 条
- `_parse(text, fallback)`(`:438-444`);`estimate_tokens(text) -> int = max(1, len(text)//3)`(`:446-452`)

### 3.6 LLM 层与降级

#### 3.6.1 `LLMConfig`(`llm/config.py:14-102`)
- 必填:`provider, model, api_key`;可选:`api_base, api_format="openai", max_context_tokens=128_000, max_output_tokens=4096, temperature=0.7`
- `has_llm`(`:27-29`) = `bool(api_key)`
- `supports_tools`(`:31-36`):`has_llm and model not in {gpt-3.5-turbo-0301, text-davinci-003}`
- `normalized_api_base`(`:38-53`):去末尾 `/` 并截掉 `/v1/messages` 等路径后缀
- **`litellm_model()`**(`:55-102`)10 条解析规则:支持 openai/anthropic/deepseek/gemini/ollama/MiniMax 前缀,有自定义 api_base 时按 api_format 推断

#### 3.6.2 `LLMProvider`(`llm/provider.py:44-358`)
- Dataclass:`LLMChunk(type:text/thinking/tool_call/done/error)`(`:14-20`);`LLMCompleteResult(text, tool_calls, usage, raw_message, failed, reasoning)`(`:23-31`);`LLMTestResult(success, latency_ms, model, reply, error, litellm_model)`(`:34-42`)
- `_kwargs(model_override=None)`(`:54-110`):解析 litellm 模型名;**api_base 每次调用前 `assert_safe_outbound_https_url` SSRF 校验**(`:91-92`)
- `complete`(`:112-147`):
  - 未配置 → `LLM_NOT_CONFIGURED`
  - 未装 litellm → `RuntimeError("litellm 未安装")`
  - `litellm.drop_params=True, modify_params=True`
  - `tools` 给定时附加 `tool_choice="auto"`
  - `stream=True` 走 `_stream`,否则 `_complete_once`
- `_complete_once`(`:149-210`):`asyncio.wait_for(..., timeout=120)`;`TimeoutError` → `RuntimeError("LLM 调用超时（120s）")`;正文空 + 无工具调用时 `text = reasoning` 回落
- `_stream`(`:212-248`):**带 tools 降级为非流式**,把 `tool_calls` 拆 `tool_call` 块、正文按 24 字切片发 `text` 块,最后 `done` 块带 usage;否则真流式
- `complete_json`(`:250-282`):剥 ```json``` 围栏;`json.loads` 失败再用 `{...}` 切片尝试;最终 `logger.warning` 后返回 `{}`
- `test_connection(*, model_override=None)`(`:284-357`):发 `Reply with exactly: OK` 短 prompt(`max_tokens=256, temperature=0`);空时 `success=False` 提示「可能仍在 thinking」

#### 3.6.3 Settings 集成(`llm/config.py:113-218`)
- `build_llm_config_from_settings(raw)`(`:113-139`):用 `decrypt_secret` 解密 `llm_api_key`;`llm_model` 缺省 `"gpt-4o"`;`llm_provider="openai"`;`llm_api_format="openai"`
- `llm_config_status(raw)`(`:142-154`):返回 `ok/missing/decrypt_failed`
- `build_llm_config_from_user / build_llm_bundle_from_user`(`:171-185`)
- `get_agent_model_override / get_agent_speaking_style / get_agent_code_of_conduct / get_agent_guideline`(`:188-218`):从 `raw["agent_llm_configs"]` 读取

### 3.7 数据层(12 张表)

**Alembic `initial_schema` 版本号**:`6096bed38e20`(`migrations/alembic/versions/6096bed38e20_initial_schema.py:14`),`down_revision=None`,`Create Date: 2026-08-03 23:03:29`(`:5`)。

| # | 表 | Alembic 行 | 关键字段 |
|---|---|---|---|
| 1 | `users` | `:22-35` | id PK (uuid4), username UNIQUE indexed, password_hash, email, avatar_url, `github_accounts TEXT DEFAULT="[]"`(JSON), `agent_permissions String(1024) DEFAULT="{}"`, `settings_json TEXT DEFAULT="{}"`(JSON), `token_version INT DEFAULT=0`, created_at, updated_at |
| 2 | `categories` | `:39-49` | id, `user_id FK users.id NULLABLE`(预设=NULL), name, icon, color, is_preset, created_at |
| 3 | `refresh_tokens` | `:50-62` | id PK, `user_id FK indexed`, `token_hash String(64) UNIQUE indexed`, expires_at, revoked, created_at |
| 4 | `tags` | `:64-69` | id, `user_id FK users`, name |
| 5 | `user_profiles` | `:71-81` | `user_id FK users PK`, tech_profile JSON, preferences JSON, goals JSON, history_summary, agent_prefs JSON, updated_at |
| 6 | `projects` | `:82-100` | id, user_id FK, category_id FK categories, name, url, description, stars, language, progress(String 16 default none), source(String 16 default manual), note, imported_at, created_at, updated_at |
| 7 | `agent_sessions` | `:101-114` | id, user_id FK, project_id FK, title(default "新对话"), active_agent(default hub), status(default active), source(default chat), created_at, updated_at |
| 8 | `notes` | `:115-126` | id, user_id FK, project_id FK, title, content, created_at, updated_at |
| 9 | `project_analyses` | `:127-139` | id, project_id FK, agent_id, analysis_type, content, model_used, tokens_used, created_at, expires_at |
| 10 | `project_tags` | `:140-146` | 复合主键(project_id FK + tag_id FK) |
| 11 | `agent_messages` | `:147-158` | id, session_id FK, role, agent_id, content, content_type(default text), `message_meta TEXT DEFAULT="{}"` 映射到物理列 `"metadata"`(SQLAlchemy 保留字规避), created_at |
| 12 | `agent_session_projects` | `:159-165` | 复合主键 + ON DELETE CASCADE(session_id FK + project_id FK) |

#### 3.7.1 Ports(adapter pattern)
- `services/api/api_backend/ports/__init__.py`:6 个 Protocol(`ProjectPort, NotePort, CategoryPort, TagPort, SessionPort, GraphPort`) + `ToolPorts`(聚合 + `commit()`)(`:8-120`)
- `services/api/api_backend/ports/sqlalchemy_adapters.py`:`SqlAlchemyProjectPort / NotePort / CategoryPort / TagPort / SessionPort / GraphPort / ToolPorts` + `build_tool_ports(db)` 工厂
- 设计意图:**Tool 接收的是 Protocol,不直接依赖 SQLAlchemy session**

#### 3.7.2 预设分类种子(`services/api/api_backend/services/seed_service.py:9-15`)
5 项:`前端 / 后端 / AI-ML / DevOps / 其他`(`main.py:31, 44` 启动期 `seed_preset_categories(session)`)

#### 3.7.3 SPEC 14 表 vs 代码 12 表 差异
- `user_settings`(SPEC §2.2)→ 用 `users.settings_json` JSON 字段替代
- `user_github_accounts`(SPEC §2.2)→ 用 `users.github_accounts` JSON 字段替代
- `graph_cache`(SPEC §2.2)→ **未建表**;图谱运行时由 `services/graph_service.py` 实时计算

### 3.8 路由表(67 端点 + `GET /health`)

**路由 mount**(`api_backend/main.py:106-116`):`auth.router -> /api/v1/auth`,其余 10 个 router -> `/api/v1`。各 router 端点数:auth 7、github 5、projects 9、categories 4、tags 4、notes 6、graph 1、overview 4、user 5、settings 4、agent 18 = **67**。

#### 3.8.1 Auth(7 端点,`api/auth.py:73, 107, 135, 170, 188, 193, 208`)
| Method | Path | Limiter | Auth |
|---|---|---|---|
| POST | `/api/v1/auth/register` | `3/hour` | 否 |
| POST | `/api/v1/auth/login` | `5/minute` key=`IP:username` | 否 |
| POST | `/api/v1/auth/refresh` | `20/minute` | 否 |
| POST | `/api/v1/auth/logout` | 无 | 否(可选 refresh) |
| GET | `/api/v1/auth/me` | 无 | Bearer/Cookie |
| PATCH | `/api/v1/auth/me` | 无 | Bearer/Cookie |
| PUT | `/api/v1/auth/password` | 无 | Bearer/Cookie |

#### 3.8.2 GitHub(5 端点,`api/github.py:144, 165, 227, 272, 297`)
| Method | Path | Auth | 备注 |
|---|---|---|---|
| GET | `/api/v1/github/accounts` | Bearer/Cookie | 列出绑定 |
| GET | `/api/v1/github/stars` | Bearer/Cookie | 6h 缓存;`?refresh=true` 强制 |
| POST | `/api/v1/github/bindaccount` | Bearer/Cookie | PAT 加密 |
| DELETE | `/api/v1/github/accounts/{account_id}` | Bearer/Cookie | 解绑 |
| GET | `/api/v1/github/search?q=` | Bearer/Cookie | GitHub 仓库搜索 |

#### 3.8.3 Projects(9 端点,`api/projects.py:40, 78, 87, 121, 136, 197, 217, 234, 244`)
| Method | Path | 文件:行 |
|---|---|---|
| GET | `/api/v1/projects/` | `:40`(列表 + 分页 + 筛选) |
| GET | `/api/v1/projects/stats` | `:78`(progress/language/category) |
| POST | `/api/v1/projects/` | `:87`(手动创建) |
| GET | `/api/v1/projects/{project_id}` | `:121` |
| GET | `/api/v1/projects/{project_id}/readme` | `:136`(从 GitHub 拉 README) |
| PUT | `/api/v1/projects/{project_id}` | `:197` |
| DELETE | `/api/v1/projects/{project_id}` | `:217` |
| POST | `/api/v1/projects/import` | `:234`(批量 ≤ 500) |
| PUT | `/api/v1/projects/{project_id}/progress` | `:244`(progress 通过 Query) |

#### 3.8.4 Categories(4,`api/categories.py:29, 52, 73, 100`)
`GET/POST/PUT/DELETE /api/v1/categories/[/{category_id}]`,预设不可改/删

#### 3.8.5 Tags(4,`api/tags.py:22, 30, 40, 55`)
- GET `/api/v1/tags/`
- POST `/api/v1/tags/`
- DELETE `/api/v1/tags/{tag_id}`
- PUT `/api/v1/tags/projects/{project_id}`(**注:路径在 tags 下,非 projects 下**)

#### 3.8.6 Notes(6,`api/notes.py:43, 53, 67, 77, 92, 107`)
- GET `/api/v1/notes/` 全量
- GET `/api/v1/notes/projects/{project_id}/notes` 单项目
- GET `/api/v1/notes/{note_id}` 详情
- POST `/api/v1/notes/projects/{project_id}/notes` 新建
- PUT `/api/v1/notes/{note_id}` 更新
- DELETE `/api/v1/notes/{note_id}` 删除

#### 3.8.7 Graph(1,`api/graph.py:16`)
- GET `/api/v1/graph/?min_similarity=0.3&max_edges=200`

#### 3.8.8 Overview(4,`api/overview.py:25, 33, 42, 51`)
- GET `/api/v1/overview/activities`
- GET `/api/v1/overview/recent-notes`
- GET `/api/v1/overview/recommended`
- GET `/api/v1/overview/trending`(未鉴权)

#### 3.8.9 User(5,`api/user.py:20, 29, 39, 49, 67`)
- GET `/api/v1/user/profile`
- PATCH `/api/v1/user/profile`
- POST `/api/v1/user/profile/clear-memory`
- POST `/api/v1/user/profile/memory-proposals/{proposal_id}/accept`
- POST `/api/v1/user/profile/memory-proposals/{proposal_id}/reject`

#### 3.8.10 Settings(4,`api/settings.py:22, 30, 39, 89`)
- GET `/api/v1/settings/`
- PUT `/api/v1/settings/`
- POST `/api/v1/settings/test-llm`
- POST `/api/v1/settings/api-key`(加密 LLM Key)

#### 3.8.11 Agent(18 端点,`api/agent.py`)
**会话(5)**(`api/agent.py:78, 86, 94, 109, 124`):
- GET `/api/v1/agent/sessions`
- POST `/api/v1/agent/sessions`
- GET `/api/v1/agent/sessions/{session_id}`
- DELETE `/api/v1/agent/sessions/{session_id}`
- PATCH `/api/v1/agent/sessions/{session_id}`

**SSE 流(9)**(`api/agent.py:173, 196, 224, 268, 300, 318, 339, 357, 378`):
| Method | Path | 用途 |
|---|---|---|
| POST | `/api/v1/agent/sessions/{session_id}/chat` | **SSE 主对话**(`rate_limit_agent=20/min` key `user:{sub}` 或 IP) |
| POST | `/api/v1/agent/chat` | **SSE 旧版兼容** |
| POST | `/api/v1/agent/question` | **SSE 反问答复** |
| POST | `/api/v1/agent/analyze/{project_id}` | **SSE 项目分析**(depth=quick/deep, agent_id) |
| POST | `/api/v1/agent/import-assist` | **SSE 导入助手** |
| POST | `/api/v1/agent/graph-guide` | **SSE 图谱向导(Atlas)** |
| POST | `/api/v1/agent/trending-scout` | **SSE Trending Scout** |
| POST | `/api/v1/agent/classify` | **SSE Curator 分类落库** |
| POST | `/api/v1/agent/note/generate` | **SSE Scribe 笔记生成** |

**静态(3)**(`api/agent.py:400, 419, 424, 444`):
- GET `/api/v1/agent/profiles`(**未鉴权**)
- GET/PATCH `/api/v1/agent/permissions`
- GET `/api/v1/agent/context-window`

### 3.9 安全 / CSRF / Cookie / 限流

#### 3.9.1 鉴权(`api/deps.py:54-109` + `core/auth_cookies.py:131`)
- 双通道:① `Authorization: Bearer <access>` ② httpOnly Cookie `rp_access`
- `get_current_user` 校验 `payload["ver"] == user.token_version`,否则 `401 UNAUTHORIZED "Token revoked"`(`deps.py:99-109`)
- `core/security.py:90-143` refresh 哈希轮换 + `revoke_all_user_refresh_tokens` family-revoke

#### 3.9.2 CSRF(`core/csrf.py:17-49`)
- 仅放行 `GET/HEAD/OPTIONS/TRACE`
- `/auth/*` bypass(自带密码/refresh 校验)
- 有 `rp_access` Cookie 但无 Bearer 时,校验 Cookie `rp_csrf == Header X-CSRF-Token`

#### 3.9.3 出站 SSRF(`core/url_safety.py`)
- `validate_public_https_url` + `assert_safe_outbound_https_url`:排除内网/链路本地/保留 IP;**故意放行 `198.18.0.0/15`**(fake-ip/benchmark)
- **LLM 出站**:`LLMProvider._kwargs` 每次调用前再校验一次,失败抛 `RuntimeError("LLM_API_BASE_BLOCKED: ...")`

#### 3.9.4 限流键函数
- 默认 `get_remote_address`(`core/limiter.py:12`)
- `auth.login` → key=`f"{ip}:{username}"`,username 由 `_LoginBodyCacheMiddleware`(`main.py:48-92`)从 body 注入到 `request.state.rate_limit_username`
- Agent SSE → key 优先 `user:{sub}`,回退 IP(`api/agent.py:61-75`)

### 3.10 业务 Services 摘要

| 文件 | 职责(1 行) |
|---|---|
| `auth_service.py` | JWT 签发 + refresh SHA-256 + 原子轮换 + family-revoke 重放防御 |
| `agent_service.py`(1501 行) | Hub 流式落库、按 agent_switch 分段、SSE 9 个端点、导入助手规则降级、笔记生成 prompt 模板 |
| `agent_catalog.py` | 7 个 Agent 静态档案(常量 `AGENT_PROFILES`) |
| `agent_proxy.py` | 当 `AGENT_BASE_URL` 配置时,API 进程以 httpx 流转发到独立 Agent 进程 |
| `github_accounts.py` | 用户 `github_accounts` JSON 字段 PAT 加密 / 解密取主账号 |
| `github_client.py` | GitHub REST 客户端:Link 头分页 / `/user/starred` vs `/users/{name}/starred` 二选一 / `list_trending_approx` |
| `graph_service.py` | **TF-IDF (0.45) + 语言相同 (0.25) + 分类相同 (0.2) + 名称 Jaccard (0.1)** 组合相似度(`_similarity_detailed`) |
| `project_service.py` | 列表 / 筛选 / 排序 / 分页 / tags 加载 / `import_repos` |
| `overview_service.py` | 活动流 / 最近笔记 / 推荐(进度 + stars 过滤)/ trending(GitHub Search API 近似) |
| `tag_service.py` | 标签 CRUD + 项目标签整体替换 + 标签使用计数 |
| `profile_service.py` | 画像 JSON 字段解析/归一化 / `memory_items` / `pending_memory_proposals` / `extensions` 持久化 / `clear_user_memory` 保留 extensions |
| `settings_service.py` | settings_json 读写 / 明文 LLM Key → 密文迁移 / `_mask_api_key` |
| `seed_service.py` | 5 个预设分类种子 |
| `sse_stream.py` | 薄转发层,权威实现在 `agents/stream_events.py` |

### 3.11 独立 Agent 进程(`services/agent/agent_runtime/main.py`)
- 文件总行 129
- `main.py:17-29` sys.path 注入 `services/agent` 与 `services/api`,`agent_core` + `backend` 双命名空间共存
- `main.py:31` `FastAPI(title="RepoPilot Agent Runtime", version="0.3.0")`
- `main.py:34-47` `_require_internal_token(token)` 从 `api_backend.config.get_settings().agent_internal_token` 读出;读不到 503,不匹配 401
- 端点:
  - `GET /health`(`:50-62`)返回 `{status, service, version, mode, agents:[7 个 id]}`,`mode="agent_core"`
  - `POST /v1/sessions/{session_id}/chat`(`:65-128`)**唯一租户接口**;内部 SSE
    - `agent_runtime/main.py:101-127` **实际调用** `api_backend.services.agent_service.stream_chat(..., force_local=True)` + 转 `encode_stream_item(chunk)`
    - **没有自己的 `HubService`** — `__init__.py:8` 自述:"v1.0 阶段 Agent 逻辑仍在 services/api/api_backend/agents/"
- "独立运行"的现实:**部署层独立(端口 + 内部 token),运行期共享 backend 全栈**

---

## 4. 前端能力盘点(`apps/web/`)

### 4.1 顶层配置

#### 4.1.1 `apps/web/package.json`
- `version: 2.0.0`(`:4`);`type: "module"`(`:5`);`engines.node: ">=20.11"`(`:7`);`packageManager: "npm@10.9.0"`(`:8`)
- Scripts(`:11-19`):`dev, build, preview, test, test:watch, test:coverage, test:e2e, lint, typecheck`
- Deps(`:21-38`):
  - React 19.2.7(`:30-31`)
  - `react-router-dom: ^7.18.1`(`:33`)
  - `@tanstack/react-query: ^5.101.2`(`:23`)
  - `zustand: ^5.0.14`(`:37`)
  - `d3: ^7.9.0`(`:25`)
  - `react-markdown: ^10.1.0`(`:32`)
  - `remark-gfm, rehype-highlight, rehype-sanitize`(`:34-36`)
  - `mermaid: ^11.16.0`(`:28`)
  - `highlight.js: ^11.11.1`(`:27`)
  - `dompurify: ^3.4.12`(`:26`)
  - `@repopilot/types: "*"`(workspace 链接,`:22`)
- devDeps:vitest 4.1.9、playwright 1.61.1、@testing-library、ts 5.9.3、vite 7.1.9、@vitejs/plugin-react 5.0.4

#### 4.1.2 `vite.config.ts`
- Dev server `host: '127.0.0.1', port: 5173`(`:22-32`)
- 代理 `/api → http://127.0.0.1:19878, changeOrigin: true`(`:25-31`),注释明文"19876 在部分 Windows 环境会幽灵 LISTENING;开发暂用 19878"
- 别名(`:13-19`):`@ → ./src`,`@repopilot/types → ../../packages/types/src/index.ts`,`react / react-dom` 显式指向防止 monorepo hoist
- `dedupe: ['react', 'react-dom', '@tanstack/react-query']`(`:20`)
- `test`(`:33-38`):`globals: true, environment: 'jsdom', setupFiles: './tests/setup.ts', include: ['tests/unit/**/*.test.{ts,tsx}']`

#### 4.1.3 环境变量
- `apps/web/.env.development:2` `VITE_USE_MOCK=false`(默认走真实);`.env:1` `VITE_USE_MOCK=true`(全局默认,Mock)
- `.env.development:4` 警告"切勿设为 :19877"
- `apps/web/.env.local:1-2` `VITE_USE_MOCK=false, VITE_API_BASE_URL=http://localhost:19877`(用 Agent 占位)
- 仓库根 `.env.example`(`scripts/export_openapi.py:13-14` 使用 `openapi-export-secret-key-32bytes!!` 作为占位)

### 4.2 入口与路由

#### 4.2.1 `main.tsx:15-36`
- `bootstrap()` 异步启动:① `initApiClient()` ② Mock 模式下动态 `import('@/api/mock/data/overviewScenarios')` + 应用 overview 场景 ③ `createRoot`
- 全局样式:`design-system.css / liquid-glass.css / shell.css / pages/index.css / global.css / highlight.js/styles/github-dark.min.css`

#### 4.2.2 `App.tsx:60-180` 完整路由表

| Path | Component | Shell | 保护 |
|---|---|---|---|
| `/login` | `LoginPage` | — | 否 |
| `/register` | `RegisterPage` | — | 否 |
| `/`(索引) | `OverviewPage` | `AppShell` | `ProtectedRoute` |
| `/projects` | `ProjectsPage` | `AppShell` | `ProtectedRoute` |
| `/projects/:id` | `ProjectDetailPage` | `AppShell` | `ProtectedRoute` |
| `/graph` | `GraphPage` | `AppShell` | `ProtectedRoute` |
| `/settings` | `SettingsPage` | `AppShell` | `ProtectedRoute` |
| `/profile` | `ProfilePage` | `AppShell` | `ProtectedRoute` |
| `/agent`(索引) | `AgentPage` | `AgentShell` | `ProtectedRoute` |
| `/agent/sessions/:sessionId` | `AgentPage`(复用) | `AgentShell` | `ProtectedRoute` |
| `/notes`(索引) | `NotesPage` | `NotesShell` | `ProtectedRoute` |
| `*` | `<Navigate to="/" replace />` | — | — |

- 所有页面 `lazy()` 拆分(`:56-58`)
- `QueryClient` 默认 `staleTime: 5min, gcTime: 30min, retry: 1, refetchOnWindowFocus: false`(`:45-54`)
- `AuthBootstrap`(`:182-188`)挂载后调 `useAuthStore.fetchMe()`

### 4.3 API 客户端双轨

#### 4.3.1 `api/client.ts:43-215` `IApiClient`
接口方法分 9 组(全部 Mock + Real 双实现):
- Auth(7):`register, login, logout, refresh, me, updateProfile, changePassword`
- GitHub(5):`listGithubAccounts, bindGithub, unbindGithub, listStars, importProjects`
- Projects(9):`listProjects, getProject, getProjectReadme, createProject, updateProject, deleteProject, updateProgress, getProjectStats, exportProjects`
- Categories/Tags(8):`listCategories, createCategory, updateCategory, deleteCategory, listTags, createTag, deleteTag, setProjectTags`
- Notes(6):`listNotes(projectId), listAllNotes, getNote, createNote, updateNote, deleteNote`
- Graph(1):`getGraph({min_similarity, max_edges})`
- Settings(6):`getSettings, updateSettings, saveLlmApiKey, testLLM, listTrending, streamTrendingScoutIntro`
- Overview 扩展(4):`listActivities, listRecommendedProjects, listOverviewRecentNotes, listTrending`(已在 Settings 组中)
- Agent 会话(11):`listAgentSessions, getAgentSession, createAgentSession, deleteAgentSession, updateAgentSession, getAgentProfiles, getUserProfile, updateUserProfile, clearUserMemory, acceptMemoryProposal, rejectMemoryProposal, getPermissions`
- SSE(7):`chatAgent, answerQuestion, analyzeProject, generateNote, getContextWindow(非流式), searchGithubRepos(非流式), importAssistChat(SSE), graphGuideChat(SSE)`

**Mock-only dev hooks**:`getAppliedOverviewRound? / applyOverviewScenario?`

切换点(`:232-240`):`createApiClient()` 根据 `import.meta.env.VITE_USE_MOCK === 'true'` 动态 `import('./mock')` 或 `import('./real')`

#### 4.3.2 `api/types.ts`
- OpenAPI 再导出(`:7-72`):`paths, components, operations, Schemas, ApiResponse, ApiError, PaginatedList, User, UserProfile, Project...` 等
- 别名(`:74-78`):`CreateProjectInput === ProjectCreate`(已弃用)
- 前端专属类型:
  - `ProjectListParams`(`:86-96`)
  - `GraphData / GraphNode / GraphEdge`(`:98-116`)
  - `TrendingPeriod = 'daily' | 'weekly' | 'monthly'`(`:118`)
  - `AgentId = 'hub' | 'scout' | 'mentor' | 'navigator' | 'curator' | 'scribe' | 'atlas'`(`:126-133`)
  - `MessageRole = 'user' | 'assistant' | 'tool' | 'system'`(`:135`)
  - `AgentMessage`(`:138-163`):含 `thinking, tool_call, tool_calls, subagents, question, question_answer, agent_switch`
  - **反问系统**(`:175-263`):`AgentQuestion / QuestionItem 联合(Radio/Checkbox/Slider/DragSort/KnowledgeMap)` + 子类型 + `QuestionAnswer 联合` + `QuestionAnswerRecord`
  - **SSE 类型**(`:269-347`):`SSEEventType` 联合(13 种 — 与后端 13 种 StreamEventKind 对应)+ `SSEEvent` + 各事件 payload
  - **前端设置/画像**(`:353-378`):`LlmApiFormat, AgentSpeakingStyle, ProficiencyLevel/Source, TechProficiencyEntry, LearningStyle, Verbosity, LearningPreferences, GoalStatus`
  - **导入助手上下文**(`:389-418`):`ImportAssistRepoSummary, ImportAssistImportedProject, ImportAssistContext, SelectReposEvent`

#### 4.3.3 Mock 数据 13 个文件(`apps/web/src/api/mock/data/`)
`activities / categories / graph / notes / overviewScenarios / profile / projects / recommendations / sessions / settings / tags / trending / users`

#### 4.3.4 Mock SSE 脚本(`mock/sse.ts`)
6 个生成器 + `selectChatScenario(message)` 路由:
- `streamText(text, charDelay=18)`(`:18-26`)逐字 yield `text_delta`
- `mockTextReply(message)`(`:38`)
- `mockToolCallReply()`(`:48`)
- `mockQuestionReply()`(`:79`)
- `mockAfterQuestionAnswer()`(`:119`)
- `mockProjectAnalysis(projectName, agent='scout')`(`:128`)
- `mockTrendingScoutIntro(repo, period='weekly')`(`:146`)
- 路由(`:180-188`):`tool/工具 → mockToolCallReply`,`question/反问/学习 → mockQuestionReply`,其余 → `mockTextReply`

### 4.4 Agent Chat 状态机 + 13 种 SSE 事件

#### 4.4.1 `stores/agentStore.ts` 状态字段(14)
- `sessions, currentSessionId, messages, activeAgent(default 'hub'), streaming, streamingContent, thinkingBuffer, pendingQuestion, toolCalls (Map), subagents, lastSelectRepos, contextRevision, error, streamAbortController`(`:59-75`)

#### 4.4.2 Actions
- `loadSessions() / switchSession(sessionId)`(`:106-147`):流中禁止 DB 覆盖;恢复挂起反问
- `createSession() / deleteSession()`(`:149-185`):优先切到非 `analyze` 会话
- `sendMessage(message)`(`:187-252`)
- `answerQuestion / skipQuestion`(`:254-311`)
- `setActiveAgent(agent)`(`:314`):**仅用于 SSE 调度同步,UI 不再提供手动切换**
- `resetStreamState / cancelStream`(`:318-334`)
- **`processSSEStream(stream)`**(`:336-904`):核心循环,switch on `event.event`

#### 4.4.3 13 种 SSE 事件处理
- `text_delta`(`:388-396`):拼接 streamingContent
- `thinking`(`:397-403`):拼接 thinkingBuffer
- `question`(`:404-423`):标准化 → pendingQuestion,落 offerMsg 卡片
- `tool_call`(`:424-478`):特殊处理 ask_user 挂起弹窗,否则写入 toolCalls Map
- `tool_result`(`:479-530`):回填 result,识别 `__session_projects__` 同步 `sessions[].project_ids`,解析 action 增 contextRevision
- `select_repos`(`:531-546`):**仅同步勾选状态,结果卡由 tool_result 承载,避免双卡**
- `agent_switch`(`:547-614`)
- `subagent_start/thinking/text/done`(`:615-713`):维护 subagents[]
- `session_projects`(`:714-730`)
- `done`(`:731-734`):仅作信号,不 push(多 Agent 编排会多次发出 done,正文只在流结束时落盘一次)
- `error`(`:735-740`)

#### 4.4.4 流结束落盘(`:746-845`)
- 若 `!sawQuestion` 且有正文:检测 `recoverQuestionFromText` 把 JSON/Markdown 反问转弹窗;否则 push assistantMsg
- 若挂起反问:确保不残留流状态
- Abort 处理(`:846-903`):AbortError 把半截正文落成气泡(`*(已中断)*`);其他错误置 `error='连接中断,请重试'`

#### 4.4.5 后端 SSE Schema(`agent_core/agents/stream_events.py:14-28`)
`StreamEventKind` 13 枚举值:`TEXT_DELTA, THINKING, AGENT_SWITCH, TOOL_CALL, TOOL_RESULT, SUBAGENT_START, SUBAGENT_THINKING, SUBAGENT_TEXT, SUBAGENT_DONE, SELECT_REPOS, QUESTION, DONE, ERROR`

Wire 格式(`:38-40`):
```
event: {kind}
data: {json.dumps(data, ensure_ascii=False)}

```

### 4.5 图谱 / 笔记 / Markdown / Mermaid

#### 4.5.1 图谱
- `useGraph`(`apps/web/src/hooks/useGraph.ts`)→ `<ForceGraph>`(`components/graph/ForceGraph.tsx:36-199`) d3 force layout
- `FORCE_CONFIG = {linkDistance:80, chargeStrength:-200, collideRadius:12}`(`:8-12`)
- `pages/GraphPage.tsx:45-58` 根据 categoryFilter 过滤 data.nodes
- `<GraphControls>`(`components/graph/GraphControls.tsx:18-128`):legend + 搜索 + 缩放 + 最小相似度滑块
- `<GraphGuidePanel>`(`:9-48`):折叠 Atlas 图谱向导

#### 4.5.2 笔记分屏
- 视图枚举(`NotesPage.tsx:15`):`'split' | 'list-only' | 'edit-only' | 'preview-only'`
- 三栏:`NoteList`(左)+ `NoteEditor`(中)+ `MarkdownRenderer`(右)
- `noteStore` + `useNotes` hooks
- `NoteEditor.tsx:33` Cmd/Ctrl+S 保存、Cmd/Ctrl+B 粗体、字数统计
- 深链:`/notes?note=<id>&project=<id>`(`NotesPage.tsx:48-57`)

#### 4.5.3 Markdown
`components/common/MarkdownRenderer.tsx:77-124`:
- `react-markdown@10.1`(`:2`)
- 插件(`:3-6`):`remark-gfm / rehype-highlight / rehype-sanitize`(扩展 schema 允许 `code/span/pre` className)
- 自定义组件:
  - `table` → `.markdown-table-wrap`(`:91-95`)
  - `pre` → 检测嵌入 Markdown 表格 / ASCII 架构卡 / Mermaid(`:96-118`)

#### 4.5.4 Mermaid
- `components/common/MermaidBlock.tsx:24-79`
- 仅 `lang === 'mermaid'` 进入(`:7`)
- 动态 `import('mermaid')`(`:36`)
- `mermaid.initialize({theme: 'dark', securityLevel: 'strict'})`(`:37-42`)
- 渲染后 DOMPurify + `SVG_PURIFY` 清洗(`:14-19, 44-47`)
- 失败/被洗空时降级到代码块 + `data-testid="mermaid-fallback"`(`MarkdownRenderer.tsx:62-71`)

### 4.6 7 Agent 头像与注视系统
- `components/agent/avatars/AgentCharacterHead.tsx` 7 个 Agent SVG 头
- `shared.tsx` 共享原子:Eye / GazeEyes / HeadSvgShell
- `AgentAvatar.tsx` 接收 `LookTarget`,驱动 `AgentCharacterHead`
- `AgentCarousel.tsx` Overview 上的 Agent 轮播
- 设计文件 16 个:`ActionResultCard / AgentAvatar / AgentCarousel / AgentContextSidebar / AgentSelector / ChatPanel / ContextWindowPanel / EmbedAgentChat / MessageBubble / QuestionHistoryCard / QuestionPanel / RunTracePanel / StreamRenderer / ToolCallCard / TrendingScoutSpot`

### 4.7 关键页面 1 行职责
| 文件 | 职责 |
|---|---|
| `OverviewPage.tsx` | 首页:统计 + 推荐 + Trending + 最近笔记 + 活动流 + Agent 轮播 |
| `LoginPage.tsx` | 登录页;已登录则 `Navigate` 到来源路由或 `/` |
| `RegisterPage.tsx` | 注册页;已登录跳 `/` |
| `ProjectsPage.tsx` | 项目列表 + ImportStarsDrawer/ImportUrlsModal/CategoryTagManager |
| `ProjectDetailPage.tsx` | 项目详情:基本信息 + 笔记 + README + 6 大专家 Agent AI 面板 + 进度切换 |
| `GraphPage.tsx` | 图谱可视化 + 控制 + 图谱向导侧栏 |
| `NotesPage.tsx` | 笔记分屏:list / edit-only / preview-only / split |
| `SettingsPage.tsx` | 设置:外观/GitHub/LLM/Agent/数据/关于 |
| `ProfilePage.tsx` | 个人资料:头像/密码/学习偏好/记忆管理 |

---

## 5. 共享包与占位

### 5.1 `packages/types/` [已生成]
- `package.json:8-10` `generate` 脚本从 `packages/contracts/openapi.json` 生成 `src/generated.ts`,经 `write-index.mjs` 写入 `src/index.ts`
- `src/generated.ts` 由 openapi-typescript 输出,`src/aliases.ts` 为手写别名
- 前端 `apps/web/vite.config.ts:16-19` 将 `@repopilot/types` alias 直解析 `packages/types/src/index.ts`

### 5.2 `packages/contracts/`
- `openapi.json` 由 `scripts/export_openapi.py`(`:1-29`)生成,OpenAPI 3.1.0,version 2.0.0

### 5.3 `packages/prompts/` [占位]
- 仅 README;真实 Soul 仍在 `services/agent/agent_core/agents/registry.py:42-134`

### 5.4 `packages/py-shared/`
- `pyproject.toml` 包名 `repopilot-py-shared`,依赖 `pydantic>=2.5.0`
- `repopilot_shared/__init__.py` 占位,`__version__="0.1.0"`

### 5.5 `packages/config/`
- `tsconfig.base.json`(ES2022、ESNext、bundler、strict、JSX、unused locals),ESLint/Tailwind 配置缺失

### 5.6 `packages/ui/`
- `src/index.ts:1-2` 占位 `export {}`,无组件

### 5.7 `services/mcp/` [占位]
- README / pyproject(空 deps) / mcp_server 占位 `__init__.py`

### 5.8 `apps/desktop/` [占位]
- 仅 `README.md:1-19`

### 5.9 `services/agent` vs `services/api` Agent 代码 [细节]
- **shim 列表**(`api_backend/agents/`):`__init__.py` `hub.py` `registry.py` `react.py` `intent.py` `question.py` `stream_events.py` `think_stream.py` `types.py` — 每个文件 9 行 `globals().update(...)`
- **shim filter 集合**:`__init__.py:7` 多过滤 `__path__`;子模块过滤 `__name__/__file__/__package__/__loader__/__spec__/__cached__/__builtins__`
- **shim 单一类身份**:`is` 比较相等,所有调用方实际触达 `agent_core.agents` 同一对象

---

## 6. 测试现状

### 6.1 后端(已逐文件名清点)
- `tests/conftest.py:11-16` 注入 `services/api` 与 `services/agent` 进 sys.path
- `conftest.py:21-22` `SECRET_KEY`、`DEBUG=false`、`AUTH_COOKIE_SECURE=false`(HTTP 测试客户端可存 Cookie)、`RATE_LIMIT_ENABLED=false`(默认关闭)
- `conftest.py:30-52` `client` fixture 每个测试独立 SQLite 文件
- `conftest.py:55-64` `auth_headers` fixture 注册用户并构造 Bearer Authorization

#### 子目录
| 子目录 | 数量 | 代表性 |
|---|---|---|
| `unit/` | 34 文件 | Hub 多种模式 / 中间件 / 安全 / 工具权限 / SSRF / ReAct 引擎 / Memory 提案 / Think Stream / SSE 段缓冲 / 工具端口 |
| `function/` | 1 文件 | `test_graph_similarity.py`(`tests/function/test_graph_similarity.py:1-31`) |
| `module/` | 3 文件 | `test_schemas.py / test_memory_service.py / test_intent_classifier.py` |
| `business/` | 2 文件 | `test_auth_service.py / test_project_service.py` |
| `integration/` | 14 文件 | `test_health / test_auth_api / test_auth_cookie_flow / test_categories_api / test_tags_api / test_notes_api / test_projects_api / test_settings_api / test_profile_api / test_overview_api / test_graph_api / test_deps / test_agent_api / test_agent_rate_limit` |

### 6.2 前端
- Vitest 配置嵌 `vite.config.ts:33-38`
- **单元测试**(~25 文件):
  - 工具:`tests/unit/utils/{clone,cn,errors,format,importRepoFilter,sse-parser,user,validators,agentSSEStream}.test.ts`
  - Store:`tests/unit/stores/{authStore,graphStore,noteStore,projectStore,settingsStore}.test.ts`
  - 组件:`tests/unit/components/AgentContextSidebar.test.tsx`
  - 业务/工具单元:`tests/unit/{actionResult,agentQuestion,agentSwitchDisplay,asciiArch,mermaidBlock,messageBubbleShell,runTrace,sessionProjectBind,streamRenderer,streamSessionGuard}.test.{ts,tsx}`
- **E2E**(**6 spec + 1 helper**):
  - `tests/e2e/helpers.ts`
  - `tests/e2e/{auth,overview-mock-rounds,projects,notes,graph,agent}.spec.ts`
  - `playwright.config.ts:1` + `package.json:17` `test:e2e: playwright test`

### 6.3 调试脚本
- `scripts/_debug_mentor_empty.py`(151 行):**复现 Mentor 空正文路径**(FakeLLM + 真实 tool registry,3 个 case)
  - `FakeLLM(LLMProvider)` 用 `script: list[dict]` 预设剧本,可模拟 `text / tool_calls / fail / stream`
  - 3 个 run_case:A tools→空→强制收口;B 三次工具循环→强制收口;C 单次空→强制

---

## 7. 文档 vs 代码差距(精确实证)

### 7.1 Agent 数
| 维度 | 说法 | 引用 |
|---|---|---|
| PRD 主张 | 6 个(无 Atlas) | `docs/product/v1/PRD/PRD.md:13, 66-73` |
| MVP 主张 | 7 个(含 Atlas) | `docs/product/v1/MVP/MVP_SCOPE.md:17, 49-54, 720` |
| **代码实际** | **7 个** | `services/agent/agent_core/agents/registry.py:176-437` |
| Catalog 静态档案 | 7 项 | `services/api/api_backend/services/agent_catalog.py:4-53` |
| Settings 白名单 | 7 项 | `services/api/api_backend/services/settings_service.py:12` |
| **结论** | **代码 7 个,PRD 描述 6 个已过时;MVP 自相一致** | — |

### 7.2 预设分类数
| 维度 | 说法 | 引用 |
|---|---|---|
| MVP 主张 | 5 个 | `docs/product/v1/MVP/MVP_SCOPE.md:38, 99, 743-749` |
| **SPEC 附录 B 主张** | **12 个**(`is_preset=True`) | `docs/product/v1/SPEC/TECHNICAL_SPEC.md:2306-2319` |
| **代码实际** | **5 个** | `services/api/api_backend/services/seed_service.py:9-15` |
| **结论** | **代码 5 个;MVP 一致;SPEC 附录 B 内容过期** | — |

### 7.3 DB 表数
- **SPEC §2.2 + MVP §3.1**:14 张(含 `user_settings / graph_cache / user_github_accounts`)
- **Alembic initial_schema**:12 张
- **差异**:`user_settings` → `users.settings_json` JSON 字段;`user_github_accounts` → `users.github_accounts` JSON;`graph_cache` → 实时计算
- **结论**:**SPEC 需更新为 12 张(含 3 张 JSON 字段替代说明)**

### 7.4 工具命名/数量
- **SPEC/MVP 规划**:14 个
- **代码**:24 个(`builtin.py` `@tool` 数)
- **典型命名差异**(SPEC ↔ 代码):
  - `read_readme` ↔ `fetch_readme`(`builtin.py:227`)
  - `ask_user_question` ↔ `ask_user`(`builtin.py:452`)
  - **`read_source_file / search_web / compare_projects / build_learning_path / save_to_memory / recall_from_memory / get_project_analysis` 均不存在**
- **结论**:24 个为真实清单;SPEC 14 个为规划参考;MVP §7.4 已自承差异

### 7.5 端点差异

| 路径 | SPEC/MVP 规划 | 代码实际 |
|---|---|---|
| `/api/v1/projects/export` | MVP §4.1 标注"尚未实现" | **不存在** |
| `/api/v1/notes/search` | "尚未实现" | **不存在** |
| `/api/v1/agent/compare` | "× 尚未实现" | **不存在** |
| `/api/v1/agent/recommend` | "× 尚未实现" | **不存在** |
| `/api/v1/agent/config` × 子路径 | — | **不存在** |
| **`/api/v1/github/search`** | "未实现" | **已存在**(存在但范围受限;**仅 GitHub 仓库搜索**,非项目库/笔记全文) |
| **`/api/v1/overview/recommended`** | "未实现" | **已存在**(存在但范围受限;**仅按 progress ∈ {none,learning} + stars desc 过滤**,非算法级推荐) |
| `/projects/{id}/notes` | MVP §4.1 写法 | **路径分裂**为 `/api/v1/notes/projects/{id}/notes` |
| `/projects/{id}/tags` | MVP §4.1 写法 | **路径不一致**(`/api/v1/tags/projects/{id}`,`api/tags.py:55`) |
| `/notes` 跨项目搜索 | MVP §4.1 标"× 尚未实现" | **不存在** |

### 7.6 MVP 内部矛盾举例

1. **Agent 数自身矛盾**:`MVP_SCOPE.md:17` 写"7 个(含 Atlas)";`MVP_SCOPE.md:49-54` 又写"6 个(含 Atlas)"——自相矛盾
2. **预设分类自身矛盾**:`MVP_SCOPE.md:38` 主张"5 个";SPEC 附录 B `TECHNICAL_SPEC.md:2306-2319` 主张"12 个 + is_preset=True"
3. **端点存在性与 Agent 描述差异**:MVP §10 step `MVP_SCOPE.md:720` 说"7 个 Agent 全部已实现";同时 `MVP_SCOPE.md:250, 252` 标 `/agent/compare`、`/agent/recommend` × 尚未实现
4. **端点路径写法**:`/projects/{id}/tags`(MVP §4.1) ↔ `/api/v1/tags/projects/{id}`(代码 `api/tags.py:55`)

### 7.7 端口
- **历史** 19876 → **现行** 19878(多处一致):
  - `apps/web/vite.config.ts:27-30` 注释明文记录切换
  - `docs/architecture/PATH_MAPPING.md:68` 记录
  - `docs/development/guides/DEVELOPMENT_PROCESS.md:198` `APP_PORT=19878`
  - `package.json:26` `dev:api` 启动 19878
  - `api_backend/config.py` **无 `app_port` Settings 字段**(端口硬编码在启动命令 / Vite proxy)

---

## 8. 关键事实速查(文件指针对照)

| 目的 | 路径 |
|---|---|
| API 入口 | `services/api/api_backend/main.py` |
| 7 Agent 注册表 | `services/agent/agent_core/agents/registry.py:176-437` |
| Hub 主对话入口 | `services/agent/agent_core/agents/hub.py:354-494` |
| Hub Plan-and-Execute 核心 | `services/agent/agent_core/agents/hub.py:859-1126` |
| ReAct 主循环 | `services/agent/agent_core/agents/react.py:619-1068` |
| ReAct 空承诺纠正 | `services/agent/agent_core/agents/react.py:1245-1280` |
| ToolRegistry & 装饰器 | `services/agent/agent_core/tools/registry.py:121-142` |
| 24 工具实现 | `services/agent/agent_core/tools/builtin.py` |
| 5 类反问 | `services/agent/agent_core/agents/question.py:194-319` |
| 意图分类 | `services/agent/agent_core/agents/intent.py:50-183` |
| Memory 分层与合并 | `services/agent/agent_core/memory/{context.py,service.py}` |
| LLM provider + 出站 SSRF | `services/agent/agent_core/llm/{provider.py,config.py}` |
| 12 张表定义 | `services/api/api_backend/models/*.py` |
| Alembic 初始迁移 | `services/api/api_backend/migrations/alembic/versions/6096bed38e20_initial_schema.py` |
| API 路由 mount | `services/api/api_backend/main.py:106-116` |
| Agent Chat 业务(1501 行) | `services/api/api_backend/services/agent_service.py` |
| 鉴权(Bearer + Cookie + token_version) | `services/api/api_backend/api/deps.py:54-109` + `core/auth_cookies.py` |
| CSRF | `services/api/api_backend/core/csrf.py` |
| SSRF(url 安全) | `services/api/api_backend/core/url_safety.py` |
| 限流键 | `services/api/api_backend/core/limiter.py` + `main.py:48-92` |
| Web 路由 | `apps/web/src/App.tsx:60-180` |
| Web Mock/Real 切换 | `apps/web/src/api/client.ts:232-240` |
| Web Agent 状态机 | `apps/web/src/stores/agentStore.ts:336-904` |
| SSE 事件 schema(后端) | `services/agent/agent_core/agents/stream_events.py:14-28` |
| SSE 事件 schema(前端) | `apps/web/src/api/types.ts:269-347` |
| Vite 代理/端口 | `apps/web/vite.config.ts:22-32` |
| 离线 OpenAPI 导出 | `scripts/export_openapi.py` |
| 后端测试分层 | `tests/{unit,function,module,business,integration}/` |
| 前端测试 | `apps/web/tests/{unit,e2e}/` |
| 文档权威源 | `docs/README.md`:`PRD > SPEC > MVP` |
| 代码现状最准参考 | `docs/development/PROGRESS_REPORT.md`(2026-08-05 核实:基本准确,仅测试函数计数待动态核) / `docs/architecture/REPO_LAYOUT.md`(贴代码) |

---

## 9. 探查局限 / 已明确读过的范围

### 9.1 已明确读过的文件
- 后端入口与配置:`api_backend/{main,config,database}.py` 全文件
- 后端数据:`api_backend/models/{user,project,note,category,agent}.py`、`api_backend/migrations/alembic/{env.py, versions/*.py}`、`api_backend/ports/*` 全文件
- 后端 schemas:`api_backend/schemas/*` 全文件清单与关键行
- 后端 api:`api_backend/api/{auth,agent,categories,deps,github,graph,notes,overview,projects,settings,tags,user}.py` 全文件
- 后端 services:`api_backend/services/{agent_service,auth_service,agent_catalog,agent_proxy,github_accounts,github_client,graph_service,project_service,overview_service,tag_service,profile_service,settings_service,seed_service,sse_stream}.py`
- 后端 core:`api_backend/core/{security,csrf,limiter,url_safety,middleware,responses,exceptions,auth_cookies}.py`
- 后端 ports:`api_backend/ports/{__init__,sqlalchemy_adapters}.py`
- Agent 真实实现:`services/agent/agent_core/{__init__,agents,llm,memory,tools}/**/*.py` 全文件
- Agent shim:`services/api/api_backend/{agents,llm,memory,tools}/*.py` 全文件
- Agent runtime:`services/agent/agent_runtime/main.py`
- 前端:`apps/web/{package.json, vite.config.ts, .env.development, .env}`、`apps/web/src/main.tsx`、`apps/web/src/App.tsx`、`apps/web/src/api/{client,types}.ts`、`apps/web/src/api/mock/{index,sse}.ts`、`apps/web/src/api/mock/data/*` 文件名清单、`apps/web/src/stores/agentStore.ts`、`apps/web/src/components/agent/StreamRenderer.tsx`、`apps/web/src/components/agent/*` 文件清单
- 测试:`tests/conftest.py`、`tests/{unit,function,module,business,integration}/*.py` 文件清单
- 脚本:`scripts/{export_openapi.py, _debug_mentor_empty.py, dev.ps1}` 全文件
- 文档:`docs/{README.md, architecture/*, development/*, product/v1/*, product/v2/*, superpowers/*, design/*, review/*}` 顶层全文件 / 全文档
- 工程:`{package.json, pyproject.toml, alembic.ini, .env.example}` 全文件

### 9.2 未逐字读(本次探查未深入)
- `services/api/api_backend/services/agent_service.py` 整体通读边界已过 1501 行,**部分全局通过引用知道每段做什么**,但**长流程方法**(`stream_chat`,`_orchestrate_multi`)未做逐字符跟踪
- `apps/web/src/api/real/index.ts` 全部 method body 未逐字
- `archive/` 旧 Flask / 原生 JS 代码(`README-archive.md` 已读)
- `docs/design/{frontend/*, process/*, fix/*, review/*}` 实施期文档(仅清点文件清单)

### 9.3 未实测
- 未执行 `npm run dev` / `pytest` / `playwright test`
- 未实测 Mock/Real 切换、SSE 流式行为、数据库实际写入
- 未跑 LLM / 测试连通性
- 未校验 Alembic upgrade head 在新环境的迁移结果

### 9.4 不确定性 [仅文档] 标记
- `docs/product/v1/MVP/MVP_SCOPE.md:250-252` × 标记的多个未实现端点为 **MVP_SCOPE 内部声明**,未交叉验证是否严格指原 SPEC 中的对应端点
- `docs/product/v2/PRD/PRD.md:3` 自承"草稿",v2 MVP 实现层与代码事实不可对齐

---

## 10. 数字一表(本报告所有事实汇总)

| 数字项 | 文档 | 代码 | 结论 |
|---|---|---|---|
| Agent 数 | 6 / 7 / 7+v2 Evaluator | **7** | 代码 7 |
| 预设分类数 | 5 / **12** | **5** | 代码 5 |
| DB 表数 | **14** | **12** | 代码 12 |
| 工具数 | **14** | **24** | 代码 24 |
| 反问 UI 形态 | — | **5**(后端) / **7**(前端 types) | 后端只产前 5,前端预留 7 |
| 反问 protocol 返回结构 | — | 单/多选/滑块/文本/空 items 5 形态 | 见 §3.4.6 |
| SSE 事件类型 | — | **13** | 见 §4.4.5 |
| API 端点数 | ~63(SPEC 含 notes 子路径)/MVP 表声明 14 | **67 + /health** | 见 §3.8 |
| 后端测试 | - | 34 unit + 1 function + 3 module + 2 business + 14 integration = **54 文件**(~210 测试函数) | 见 §6.1 |
| 前端单元测试 | — | ~25 文件 + 8 utils + 5 stores + 1 components | 见 §6.2 |
| 前端 E2E | — | **6 spec + 1 helper** | 见 §6.2 |
| 端口 | 19876 历史 | **19878** | 见 §7.7 |
| LLM | gpt-4o-mini / gpt-4o 默认 | 13 种前缀解析 | 见 §3.6 |
| Hub dispatch rounds | — | **2** 默认 | 见 §3.4 |
| ReAct max_iter | — | **8** 默认 | 见 §3.4 |
| 短期记忆 | — | 12 条上限 | §3.5.3 |
| 长期记忆 | — | 100 条上限 | §3.5.3 |
| history compression | — | 24 → 12 保留 | §3.5.3 |
| thinking meta 上限 | — | 24000 token | `agent_service.py:334` |
| subagent output 上限 | — | 100000 字符 | `agent_service.py:416` |
| Agent 注册 max_tokens 范围 | — | 1600-4096 | §3.2.2 |
| LLM provider 前缀 | — | openai/anthropic/deepseek/gemini/ollama/MiniMax | §3.6.1 |

---

## 11. 报告结束

报告完毕。所有结论均带 `file_path:line`,不含修改建议。