# RepoPilot 架构重构:详细执行步骤

> **文档目的**:任何 AI agent(包括两年前的模型)只看本文档就能精确完成每个改动,无需猜测。
> **前置阅读**:`docs/review/ARCHITECTURE_REFACTOR_REPORT/ARCHITECTURE_REFACTOR_REPORT.md`(背景与目标架构)
> **验证基线**:每步完成后必须跑 `pytest tests/unit -q`(预期 171 passed, 1 failed 基线 `test_run_llm_error_yields_error_sse` 与本次无关)

---

## 执行前必读

### 依赖链约束(代码验证)

本次重构有一个核心难点:**`security.py` 依赖 `api_backend.config.get_settings`**,而 `config.py` 含全部业务配置(数据库、LLM、graph、agent 等)。这意味着:

- **不能简单地把 security 整个移到 py-shared**--它依赖 config,而 config 属于 api_backend
- 解法:security 的 `decrypt_secret`/`is_encrypted_secret`/`encrypt_secret` 需要的只是 `secret_key`(一个字符串)。阶段 2 把这几个函数移到 py-shared 时,**参数化**(接收 `key_material: str` 参数,而非直接 import get_settings)

同理:
- **`models/*.py` 依赖 `database.Base`**(DeclarativeBase)。移到 py-shared 时,Base 要么一起移,要么 models 改为接收 Base 参数。阶段 2 采用:**Base 移到 py-shared**(它是纯 SQLAlchemy 基类,不含业务配置)
- **`index_pipeline.py` 依赖 api_backend 的 7 个模块**(config/error_codes/exceptions/models/github_accounts/rp_graph_client/database/app_state_service)。阶段 3 移到 graph_engine_runtime 时,这些依赖要通过 Contract 注入,不能直接 import

### 验证命令(每步后都跑)

```bash
# 1. lint
PYTHONPATH=. uv run --project services/api ruff check services/api/api_backend services/agent tests scripts/export_openapi.py scripts/_debug_mentor_empty.py

# 2. 类型检查(本地有 numpy 环境问题,CI 用 Py311;本地可选跑)
PYTHONPATH=. uv run --project services/api mypy services/api/api_backend

# 3. import 冲烟(验证 import 链通)
PYTHONPATH=. uv run --project services/api python -c "
import api_backend.main
import api_backend.services.agent_service
import agent_core.agents.hub
print('OK')
"

# 4. 单元测试
PYTHONPATH=. uv run --project services/api pytest tests/unit -q

# 5. C 二进制构建(仅阶段 1 需要)
cd services/graph_engine/graph_engine_core && make -f Makefile.rp rp-graph-engine
```

---

## 阶段 1:C 引擎前端遗留清理

**目标**:删除 RepoPilot 不需要的 C 前端资源服务(asset_pack),消除 src/ui/ 的前后端混合。
**风险**:极低(asset_pack 在默认构建中本就不编译)。

### 步骤 1.1:删除前端资源文件

删除以下 3 个文件(它们是上游 CBM 的 React graph-ui 资源托管,RepoPilot 前端在 apps/web,不需要):

```
services/graph_engine/graph_engine_core/src/ui/asset_pack.c        # 892 行,前端资源服务
services/graph_engine/graph_engine_core/src/ui/asset_pack.h        # 前端资源头文件
services/graph_engine/graph_engine_core/src/ui/asset_manifest_stub.c  # 6 行,资源清单 stub
```

**保留**:`asset_pack_stub.c`(98 行,空实现,默认编译用它)。

### 步骤 1.2:清理 Makefile 的 TEST/ASSET 引用

文件:`services/graph_engine/graph_engine_core/Makefile.rp`

删除或注释以下行(它们引用已删除的 asset_pack.c):

| 行号 | 内容 | 操作 |
|------|------|------|
| 462 | `TEST_PROD_SRCS = $(subst src/ui/asset_pack_stub.c,src/ui/asset_pack.c src/ui/asset_manifest_stub.c,$(PROD_SRCS))` | 删除整行(TEST 模式不再替换) |
| 1063 | `UI_ASSET_MANIFEST = $(BUILD_DIR)/generated/ui_asset_manifest.c` | 删除 |
| 1067-1080 | `ifeq ($(UI_ASSET_PREBUILT),1) ... endif` 整个 UI asset 构建块 | 删除 |
| 1071 | `PROD_SRCS_WITH_ASSETS = $(subst src/ui/asset_pack_stub.c,src/ui/asset_pack.c $(UI_ASSET_MANIFEST),$(PROD_SRCS))` | 删除 |

**注意**:删除前先搜索 `PROD_SRCS_WITH_ASSETS` 和 `UI_ASSET_MANIFEST` 是否被其他 target 引用。如果只被 `cbm-with-ui` target(:1085)引用,而 RepoPilot 不构建 `cbm-with-ui`(只构建 `rp-graph-engine`),则安全删除。

### 步骤 1.3:移除 sidecar 的 --ui=true 参数

文件:`services/api/api_backend/services/graph_engine_sidecar.py`:108-112

```python
# 改前
cmd = [
    str(bin_path),
    "--ui=true",
    f"--port={port}",
]

# 改后(删除 "--ui=true" 行)
cmd = [
    str(bin_path),
    f"--port={port}",
]
```

### 步骤 1.4:更新 README

文件:`services/graph_engine/graph_engine_core/README.md`

在开头描述区补充:"C 引擎只提供功能 API(/api/layout、/rpc),前端可视化由 RepoPilot `apps/web` 负责。asset_pack 前端资源服务已移除。"

### 步骤 1.5:验证

```bash
# C 二进制仍可构建(不含 asset_pack)
cd services/graph_engine/graph_engine_core && make -f Makefile.rp rp-graph-engine
# 预期:成功产出 build/c/rp-graph-engine(.exe)

# Python 侧不受影响
PYTHONPATH=. uv run --project services/api python -c "import api_backend.services.graph_engine_sidecar; print('OK')"
```

---

## 阶段 2:共享层下沉到 packages/py-shared

**目标**:消除 agent_core -> api_backend 的 A/B/C/D/G 类依赖(14 处),让共享数据模型/工具/Contract 归位。
**风险**:中低。需处理 Base 下沉和 security 参数化两个难点。

### 步骤 2.1:搭建 py-shared 包结构

创建以下目录和文件:

```
packages/py-shared/
├── pyproject.toml              # 已存在,需确认 dependencies 含 sqlalchemy、pydantic、cryptography
├── repopilot_shared/
│   ├── __init__.py             # 已存在(空)
│   ├── database.py             # 新建:Base = DeclarativeBase
│   ├── models/                 # 新建
│   │   ├── __init__.py
│   │   ├── project.py          # 从 api_backend/models/project.py 移入
│   │   ├── app_state.py        # 从 api_backend/models/app_state.py 移入
│   │   └── agent.py            # 从 api_backend/models/agent.py 移入
│   ├── schemas/                # 新建
│   │   ├── __init__.py
│   │   └── project.py          # ImportRepoItem(从 api_backend/schemas/project.py 抽出)
│   ├── security/               # 新建
│   │   ├── __init__.py
│   │   ├── crypto.py           # 从 api_backend/core/security.py 抽出(参数化)
│   │   └── url_safety.py       # 从 api_backend/core/url_safety.py 移入
│   └── ports/                  # 新建
│       ├── __init__.py         # 从 api_backend/ports/__init__.py 移入(7 个 Protocol)
│       └── (sqlalchemy_adapters 留在 api_backend,它是 Embedded Adapter)
```

### 步骤 2.2:database.py 下沉(Base 移到 py-shared)

**关键**:`api_backend/database.py:79` 的 `class Base(DeclarativeBase)` 是所有 model 的基类。它不含业务配置,是纯 SQLAlchemy 基类。

1. 在 `packages/py-shared/repopilot_shared/database.py` 创建:
```python
"""共享数据库基类(api_backend / agent_core 共用)。"""
from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    pass
```

2. `api_backend/database.py` 改为 re-export:
```python
# 改前
class Base(DeclarativeBase):
    pass

# 改后
from repopilot_shared.database import Base  # noqa: F401
```

3. 同步 `services/api/pyproject.toml` 的 dependencies 加入 `repopilot-py-shared`(workspace 内部包)

### 步骤 2.3:models 下沉(project / app_state / agent)

对 `models/project.py`、`models/app_state.py`、`models/agent.py` 三个文件:

1. 移到 `packages/py-shared/repopilot_shared/models/`
2. 每个文件改 `from api_backend.database import Base` -> `from repopilot_shared.database import Base`
3. `api_backend/models/` 下保留 re-export(避免 breaking 其他 import):
```python
# api_backend/models/project.py(改为 re-export)
from repopilot_shared.models.project import *  # noqa: F401, F403
from repopilot_shared.models.project import Project, Tag  # 显式
```
4. `api_backend/models/__init__.py` 保持不变(它 re-export 子模块)

**注意**:models 互相依赖(project 引用 Tag、agent 引用 AgentSession 等)。移到 py-shared 后,内部 import 改为 `from repopilot_shared.models.xxx import`。

### 步骤 2.4:security 参数化(处理循环依赖)

`core/security.py` 的 `decrypt_secret`/`is_encrypted_secret`/`encrypt_secret`/`ensure_encrypted_secret` 依赖 `get_settings().secret_key`。

**解法**:移到 py-shared 时,把 `secret_key` 改为参数:

```python
# packages/py-shared/repopilot_shared/security/crypto.py
from cryptography.fernet import Fernet, InvalidToken
import base64, hashlib
from functools import lru_cache

@lru_cache()
def _fernet(key_material: str) -> Fernet:
    digest = hashlib.sha256(key_material.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))

def is_encrypted_secret(value: str | None) -> bool:
    """纯前缀判断，与密钥无关（is_encrypted_secret 不需要 key_material）。"""
    if not value or not value.startswith("enc:"):
        return False
        _fernet(key_material).decrypt(value[4:].encode())
        return True
    except (InvalidToken, Exception):
        return False

def decrypt_secret(value: str | None, key_material: str) -> str | None:
    # 参数化:接收 key_material 而非 import get_settings
    ...

def encrypt_secret(plain: str, key_material: str) -> str:
    ...
```

`api_backend/core/security.py` 保留为**薄封装**(注入 `get_settings().secret_key`):
```python
# api_backend/core/security.py(保留,薄封装)
from repopilot_shared.security.crypto import decrypt_secret as _decrypt, ...
from api_backend.config import get_settings

def decrypt_secret(value: str | None) -> str | None:
    return _decrypt(value, get_settings().secret_key)

# 其他同理
```

agent_core 的 4 处 `from api_backend.core.security import decrypt_secret/is_encrypted_secret` 改为:
```python
from repopilot_shared.security.crypto import decrypt_secret, is_encrypted_secret
# 调用时传入 key_material(由 Contract 注入)
```

### 步骤 2.5:url_safety 下沉

`core/url_safety.py` 是**纯函数**(只依赖 ipaddress/socket/urllib),无 api_backend 依赖。直接移到 `packages/py-shared/repopilot_shared/security/url_safety.py`。

agent_core 的 1 处 `from api_backend.core.url_safety import assert_safe_outbound_https_url` 改为 `from repopilot_shared.security.url_safety import assert_safe_outbound_https_url`。

### 步骤 2.6:ports Protocol 下沉

`ports/__init__.py`(7 个 Protocol)只依赖 `typing.Protocol` + `uuid.UUID`,无 api_backend 依赖。

1. 移到 `packages/py-shared/repopilot_shared/ports/__init__.py`
2. `api_backend/ports/__init__.py` 改为 re-export:
```python
from repopilot_shared.ports import *  # noqa: F401, F403
```
3. `ports/sqlalchemy_adapters.py` **留在 api_backend**(它是 Embedded Adapter,依赖具体 ORM)

agent_core 的 2 处 `from api_backend.ports.sqlalchemy_adapters import build_tool_ports` **暂不改**(build_tool_ports 是 Adapter 不是 Contract,阶段 4 Contract 化时处理)。

### 步骤 2.7:Schema 下沉

`schemas/project.py` 的 `ImportRepoItem`(行 98-101)是纯 Pydantic 模型。移到 `packages/py-shared/repopilot_shared/schemas/project.py`。

agent_core 的 1 处 `from api_backend.schemas.project import ImportRepoItem` 改为 `from repopilot_shared.schemas.project import ImportRepoItem`。

### 步骤 2.8:删除 SSE 假依赖

`services/sse_stream.py`(api_backend)是 re-export 自 agent_core。它被 agent_core 的 2 处反向 import(hub.py:14, react.py:11)使用。

1. **删除** `api_backend/services/sse_stream.py`(它只是 re-export)
2. agent_core 的 hub.py:14 和 react.py:11 改为直接用 agent_core 自己的:
```python
# 改前
from api_backend.services.sse_stream import format_sse

# 改后
from agent_core.agents.stream_events import format_sse
```
3. api_backend 其他引用 `from api_backend.services.sse_stream import` 的地方(如 sse_stream.py 被谁 import),改为 `from agent_core.agents.stream_events import`

### 步骤 2.9:配置同步

1. 根 `pyproject.toml:25` mypy_path 加入 `packages/py-shared`:
```toml
mypy_path = ["services/api", "services/agent", "services/graph_engine/graph_engine_runtime", "packages/py-shared"]
```
2. `services/api/api_backend/path_setup.py:13-15` 加入 py-shared 路径:
```python
candidates = (
    _SERVICES_ROOT / "agent",
    _SERVICES_ROOT / "graph_engine" / "graph_engine_runtime",
    _SERVICES_ROOT.parent / "packages" / "py-shared",  # 新增
)
```
3. `services/api/pyproject.toml` dependencies 加入 `"repopilot-py-shared"`,或确认 uv workspace 自动解析
4. `tests/conftest.py` 和 `tests/pytest.ini` 的 pythonpath 确认含 `packages/py-shared`(或靠 path_setup 注入)

### 步骤 2.10:验证

```bash
# A/B/C/D/G 类依赖消除验证(预期 0)
grep -rnE 'from api_backend\.models' services/agent/agent_core/ --include='*.py' | grep -v '/__pycache__/' | wc -l
grep -rnE 'from api_backend\.core\.(security|url_safety)' services/agent/agent_core/ --include='*.py' | grep -v '/__pycache__/' | wc -l
# ports Protocol 已下沉;sqlalchemy_adapters Adapter 按设计保留(阶段 4 Contract 化时处理)
grep -rnE 'from api_backend\.ports' services/agent/agent_core/ --include='*.py' | grep -v '/__pycache__/' | grep -v 'sqlalchemy_adapters' | wc -l
grep -rnE 'from api_backend\.schemas' services/agent/agent_core/ --include='*.py' | grep -v '/__pycache__/' | wc -l
grep -rnE 'from api_backend\.services\.sse_stream' services/agent/agent_core/ --include='*.py' | grep -v '/__pycache__/' | wc -l
# 以上全部应为 0

# 反向依赖从 40 减到 26
grep -rnE 'from api_backend|import api_backend' services/agent/agent_core/ --include='*.py' | grep -v '/__pycache__/' | wc -l
# 预期:26(只剩 E+F 类)

# 全套测试
PYTHONPATH=. uv run --project services/api pytest tests/unit -q
# 预期:171 passed, 1 failed(基线)
```

---

## 阶段 3:Graph 逻辑移到 graph_engine_runtime

**目标**:消除 F 类依赖(15 处),将 Graph job 管理/C-py fallback/sidecar 从 api_backend 移到 graph_engine_runtime。
**风险**:中。需处理 index_pipeline 对 api_backend 的 7 个依赖 + lifespan 迁移。

### 步骤 3.1:创建 graph_engine_runtime 目录结构

```
services/graph_engine/graph_engine_runtime/
├── rp_graph/                   # 已存在(Python 回退实现)
│   ├── __init__.py
│   ├── engine.py
│   ├── indexer.py
│   ├── store.py
│   └── server.py
├── __init__.py                 # 新建
├── client.py                   # 从 api_backend/services/rp_graph_client.py 移入
├── index_pipeline.py           # 从 api_backend/services/index_pipeline.py 移入
├── sidecar.py                  # 从 api_backend/services/graph_engine_sidecar.py 移入
└── runtime.py                  # 新建:GraphRuntimeInterface + EmbeddedGraphRuntime
```

### 步骤 3.2:迁移 3 个文件

将以下文件从 api_backend 移到 graph_engine_runtime:

| 来源 | 目标 | 行数 |
|------|------|------|
| `api_backend/services/rp_graph_client.py` | `graph_engine_runtime/client.py` | 530 |
| `api_backend/services/index_pipeline.py` | `graph_engine_runtime/index_pipeline.py` | 1147 |
| `api_backend/services/graph_engine_sidecar.py` | `graph_engine_runtime/sidecar.py` | 159 |

### 步骤 3.3:处理 index_pipeline 的 7 个 api_backend 依赖

`index_pipeline.py` 依赖以下 api_backend 模块(代码验证):

| 行号 | 当前 import | 解法 |
|------|-------------|------|
| 19 | `from api_backend.config import get_settings` | 通过 Contract 注入 settings(graph 相关配置) |
| 20 | `from api_backend.core import error_codes as EC` | error_codes 下沉到 py-shared(阶段 2 应含此项,若遗漏则补) |
| 21 | `from api_backend.core.exceptions import AppException, NotFoundError` | exceptions 下沉到 py-shared,或 Contract 定义异常 |
| 22 | `from api_backend.models.graph_index import GraphIndexStatus` | models 下沉到 py-shared(阶段 2 已做 project/app_state/agent,补 graph_index) |
| 23 | `from api_backend.models.project import Project` | 已在 py-shared(阶段 2) |
| 24 | `from api_backend.services.github_accounts import primary_token` | 通过 Contract 注入(GitHubClientPort) |
| 25 | `from api_backend.services.rp_graph_client import RpGraphClient, RpGraphError` | 改为 `from graph_engine_runtime.client import RpGraphClient, RpGraphError`(同包) |
| 613,676,807 | `from api_backend.database import get_session_factory` | 通过 Contract 注入 DB session factory |
| 808 | `from api_backend.services.app_state_service import get_or_create_app_state` | 通过 Contract 注入(AppStateServicePort) |

**解法**:定义 `GraphRuntimeContext`(dataclass,持有所有依赖),index_pipeline 从 context 取依赖而非直接 import。

### 步骤 3.4:处理 client.py 和 sidecar.py 的依赖

`rp_graph_client.py`:
- :18 `from api_backend.config import get_settings` -> Contract 注入
- :19 `from api_backend.core import error_codes as EC` -> py-shared

`graph_engine_sidecar.py`:
- :16 `from api_backend.config import REPO_ROOT, get_settings` -> Contract 注入

### 步骤 3.5:创建 GraphRuntimeInterface + EmbeddedGraphRuntime

`graph_engine_runtime/runtime.py`:

```python
"""Graph Runtime Interface + Embedded 实现。"""
from __future__ import annotations
from typing import Protocol, Any, AsyncIterator

class GraphRuntimeInterface(Protocol):
    """Graph 引擎统一接口(api_backend 只依赖此接口)。"""
    async def health(self) -> bool: ...
    async def fetch_layout(self, project: str, **kwargs) -> dict: ...
    async def index_repository(self, project: str, **kwargs) -> dict: ...
    async def search_graph(self, project: str, **kwargs) -> dict: ...
    async def trace_path(self, project: str, **kwargs) -> dict: ...
    async def start_worker(self) -> None: ...
    async def stop_worker(self) -> None: ...

class EmbeddedGraphRuntime:
    """Embedded 实现(默认,同进程)。"""
    def __init__(self, settings, db_factory, ...):
        # 注入 api_backend 的 settings / db_factory / contracts
        ...
    # 委托给 client.py / index_pipeline.py / sidecar.py
```

### 步骤 3.6:api_backend 改为调 GraphRuntimeInterface

1. `api_backend/main.py` 的 lifespan(:54-78)改为:
```python
# 改前
from api_backend.services.graph_engine_sidecar import ensure_graph_engine_sidecar, stop_graph_engine_sidecar
from api_backend.services.index_pipeline import start_index_worker, stop_index_worker

# 改后
from graph_engine_runtime.runtime import EmbeddedGraphRuntime
graph_runtime = EmbeddedGraphRuntime(settings=settings, db_factory=get_session_factory(), ...)
# lifespan 内:
await graph_runtime.start_worker()
# finally:
await graph_runtime.stop_worker()
```

2. api_backend 的路由层(`api/graph_l1.py` 等)改为调 `graph_runtime.fetch_layout()` 而非直接 import rp_graph_client

### 步骤 3.7:agent_core 改为调 graph_engine_runtime

`agent_core/tools/builtin.py` 的 15 处 F 类依赖:

```python
# 改前
from api_backend.services import index_pipeline as pipeline
from api_backend.services.rp_graph_client import RpGraphClient, RpGraphError

# 改后(通过注入的 GraphRuntimeInterface)
# builtin.py 的工具函数接收 graph_runtime 参数(由 agent_runtime 注入)
```

### 步骤 3.8:验证

```bash
# F 类依赖消除(预期 0)
grep -rnE 'from api_backend\.services\.(rp_graph_client|index_pipeline)' services/agent/agent_core/ --include='*.py' | grep -v '/__pycache__/' | wc -l

# api_backend 不再直接 import graph 服务(预期 0 或仅通过 runtime)
grep -rnE 'from api_backend\.services\.(rp_graph_client|index_pipeline|graph_engine_sidecar)' services/api/api_backend/ --include='*.py' | grep -v '/__pycache__/' | wc -l

# 全套测试
PYTHONPATH=. uv run --project services/api pytest tests/unit -q
```

---

## 阶段 4:Agent 逻辑移到 agent_runtime + Contract 化

**目标**:消除 E 类依赖(11 处)+ api_backend 的 19 处正向依赖,让 agent_core 只依赖 py-shared。
**风险**:中高。agent_service.py(1590 行)拆分是最大风险点。

### 步骤 4.1:定义 6 个业务服务 Contract(放 py-shared)

`packages/py-shared/repopilot_shared/contracts/`:

```python
# contracts/app_state.py
class AppStateServicePort(Protocol):
    async def get_or_create_app_state(self, db) -> Any: ...
    async def ensure_singleton_rows(self, db) -> None: ...

# contracts/profile.py
class ProfileServicePort(Protocol):
    async def get_or_create_profile(self, db) -> Any: ...
    def profile_to_out(self, row) -> Any: ...

# contracts/settings.py
class SettingsServicePort(Protocol):
    def ensure_providers(self, raw: dict) -> list: ...

# contracts/github.py
class GitHubClientPort(Protocol):
    async def fetch_repo_info(self, owner: str, repo: str, token: str | None) -> dict: ...
    async def fetch_readme_text(self, ...) -> str: ...

# contracts/llm_usage.py
class LLMUsagePort(Protocol):
    def parse_usage_details(self, raw) -> dict: ...
    def record_parsed_usage_fire_and_forget(self, ...) -> None: ...

# contracts/session.py
class SessionQueryPort(Protocol):
    async def get_session_project_ids(self, db, session_id) -> list: ...
```

### 步骤 4.2:agent_core 改为依赖 Contract

agent_core 的 11 处 E 类依赖,改为接收 Protocol 参数(由 agent_runtime 注入):

```python
# 改前(llm/config.py:112)
from api_backend.core.security import decrypt_secret

# 改后
def build_llm_config_from_user(..., crypto_port: CryptoPort):
    crypto_port.decrypt_secret(...)
```

每个 Contract 通过函数参数或类构造注入,不直接 import api_backend。

### 步骤 4.3:拆分 agent_service.py

`agent_service.py`(1590 行)拆为两部分:

**移到 agent_runtime 的(执行编排 + SSE)**:
- `stream_chat`(:644)
- `stream_question_answer`(:778)
- `stream_analyze`(:945)
- `stream_import_assist`(:1036)
- `stream_graph_guide`(:1366)
- `stream_trending_scout`(:1422)
- `stream_classify_project`(:1460)
- `stream_generate_note`(:1505)
- `_AgentSegmentBuffer`(:366)
- `_apply_persistence_side_effects`(:545)
- session stream/cancel token 管理(:40-85)

**留在 api_backend 的(CRUD + 元数据)**:
- `get_session_project_ids`(:86)
- `set_session_projects`(:104)
- `create_session`(:254)/`update_session`(:280)/`delete_session`(:316)
- `list_sessions`(:224)/`get_session_detail`(:234)
- `append_message`(:335)
- `get_context_window`(:1549)

### 步骤 4.4:api_backend 改为调 AgentRuntimeInterface

定义 `AgentRuntimeInterface`(放 py-shared),api 的 `api/agent.py` 路由层调此接口。

### 步骤 4.5:验证

```bash
# E 类依赖消除
grep -rnE 'from api_backend\.services' services/agent/agent_core/ --include='*.py' | grep -v '/__pycache__/' | grep -vE 'sse_stream|index_pipeline|rp_graph_client' | wc -l
# 预期:0

# agent_core 完全不依赖 api_backend
grep -rnE 'from api_backend|import api_backend' services/agent/agent_core/ --include='*.py' | grep -v '/__pycache__/' | wc -l
# 预期:0

# api_backend 不直接 import agent_core(仅通过 Runtime Interface)
grep -rnE 'from agent_core|import agent_core' services/api/api_backend/ --include='*.py' | grep -v '/__pycache__/' | wc -l
# 预期:0

# 全套测试
PYTHONPATH=. uv run --project services/api pytest tests/unit -q
```

---

## 阶段 5:命名统一 + 目录归位

**目标**:消除 `_runtime` 一词两义,后缀语义统一。
**风险**:低(机械改名)。

### 步骤 5.1:graph_engine_runtime -> graph_engine_fallback

当前 `graph_engine_runtime/` 是 Python 实现(rp_graph)。阶段 3 新建的运行层也叫 `graph_engine_runtime`。需要:

1. **先把当前的 `graph_engine_runtime/` 改名为 `graph_engine_fallback/`**(它是 Python 回退实现)
2. **阶段 3 新建的运行层目录命名为 `graph_engine_runtime/`**(它承接 job 管理/fallback/sidecar)

改名影响面(9 处代码引用 + 文档):

| 文件 | 改动 |
|------|------|
| `services/api/api_backend/path_setup.py:15` | `graph_engine_runtime` -> `graph_engine_fallback` |
| `services/api/api_backend/services/rp_graph_client.py:23` | 同上(若阶段 3 未迁走) |
| `services/graph_engine/pyproject.toml:13` | `"graph_engine_runtime" = ""` -> `"graph_engine_fallback" = ""` |
| `scripts/start-graph-engine.{ps1,sh}` | PYTHONPATH 路径 |
| `pyproject.toml:25` | mypy_path |
| `tests/unit/test_rp_graph_engine.py:9` | sys.path |
| `package.json:50` | lint-staged glob |
| `services/graph_engine/README.md` | 文档 |

### 步骤 5.2:mcp_server -> mcp_runtime

| 文件 | 改动 |
|------|------|
| `services/mcp/pyproject.toml` | `packages = ["mcp_server"]` -> `["mcp_runtime"]` |
| `services/mcp/mcp_server/` 目录 | git mv -> `mcp_runtime/` |
| `services/mcp/README.md` | 文档 |

### 步骤 5.3:验证

```bash
# 目录结构确认
ls services/graph_engine/  # 预期:core/ fallback/ runtime/ layout/
ls services/mcp/           # 预期:mcp_runtime/

# import 冲烟
PYTHONPATH=. uv run --project services/api python -c "from rp_graph import GraphEngine; print('OK')"
PYTHONPATH=. uv run --project services/api pytest tests/unit -q
```

---

## 附录:风险检查清单

| 检查点 | 验证命令 | 预期 |
|--------|----------|------|
| agent_core 不依赖 api_backend | `grep -rnE 'from api_backend\|import api_backend' services/agent/agent_core/ --include='*.py' \| grep -v __pycache__ \| wc -l` | 0 |
| api_backend 不直接 import agent_core | `grep -rnE 'from agent_core\|import agent_core' services/api/api_backend/ --include='*.py' \| grep -v __pycache__ \| wc -l` | 0 |
| C 二进制可构建 | `make -f Makefile.rp rp-graph-engine` | 成功 |
| Python import 链通 | `python -c "import api_backend.main; import agent_core.agents.hub"` | OK |
| 单元测试 | `pytest tests/unit -q` | 171 passed, 1 failed(基线) |
| 默认两进程 | `scripts/dev.ps1` 启动后只有 :5173 + :19878 | 两进程 |
| ruff 无新错 | `ruff check services/api/api_backend services/agent tests scripts` | 无新增(基线 4 个除外) |

---

## 附录:阶段依赖图

```
阶段 1(C 清理)     ── 独立
阶段 2(共享下沉)   ── 独立(可与 1 并行)
阶段 3(Graph 运行层)── 依赖 2
阶段 4(Agent 运行层)── 依赖 2 + 3
阶段 5(命名统一)   ── 依赖 3
```

**建议执行顺序**:1 -> 2 -> 3 -> 4 -> 5。每阶段完成后 commit + 验证。
