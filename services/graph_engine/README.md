# Voyager 图谱引擎

目录命名对齐 `services/agent`（`{service}_core` / `{service}_runtime`）。

## 目录职责

| 路径 | 对齐 | 职责 | 对外名 |
|------|------|------|--------|
| [`graph_engine_core/`](graph_engine_core/) | `agent_core` | 权威 C 索引/查询引擎（MIT，迁自 codebase-memory-mcp；符号统一 `engine_*` 前缀） | 二进制 **`graph-engine`** |
| [`graph_engine_fallback/`](graph_engine_fallback/) | `graph_engine_fallback` | Python 降级实现（C 不可用时回退，含可选 HTTP 进程 `python -m graph_fallback.server`） | 包 `graph_fallback` |
| [`graph_engine_runtime/`](graph_engine_runtime/) | `agent_runtime` | Graph 运行层（job 管理 / C-py fallback / sidecar / 对外服务） | 发行名 `graph-engine` |
| [`layout/`](layout/) | （可选加速） | 3D 布局 native 库（CMake） | 库 **`graph_layout`**，CLI **`graph-layout-cli`** |

**命名：** 对外统一 `GRAPH_*` 环境变量；二进制/包名均按功能命名，无品牌前缀。
**勿混淆：** ① Python 发行包名 `graph-engine`（本服务的 wheel）与 C sidecar 二进制 `graph-engine`（`graph_engine_core/build/c/` 产物）是两样东西——前者是 uv workspace 发行包，后者是 C 可执行文件；② `graph-layout-cli` 只做布局，非索引 sidecar。

## 可选：C 引擎 sidecar（`graph_engine_core`，性能增强）

构建与运行见 [`graph_engine_core/README.md`](graph_engine_core/README.md)。

```powershell
.\services\graph_engine\graph_engine_core\scripts\build.ps1
$env:GRAPH_CACHE_DIR = "$PWD\data\graph-engine-cache"
$env:GRAPH_ENGINE_BIN = "$PWD\services\graph_engine\graph_engine_core\build\c\graph-engine"
# API 侧：
$env:GRAPH_ENGINE_URL = "http://127.0.0.1:9750"
```

API 启动时若配置了 `GRAPH_ENGINE_BIN`（或在约定路径找到二进制），会在 sidecar 不健康时自动拉起。

## 默认：Python 回退（`graph_engine_fallback/graph_fallback`，进程内）

默认（`GRAPH_ENGINE_URL` 空）走进程内 `graph_fallback`，装即用、严格两进程拓扑（前端 + 后端单进程）。
新功能与索引质量以 `graph_engine_core` 为准；需要 C 引擎性能时见上节（构建二进制 + 设 `GRAPH_ENGINE_URL`）。

可选 sidecar：

```powershell
.\scripts\start-graph-engine.ps1
```

## 布局加速（`layout/`）

```bash
cmake -S services/graph_engine/layout -B services/graph_engine/layout/build -DCMAKE_BUILD_TYPE=Release
cmake --build services/graph_engine/layout/build --config Release
# 产物：graph_layout（共享库）+ graph-layout-cli
```

无此库时 Python `force_layout_3d` 兜底。

## 许可

- C 引擎迁入代码：见 `graph_engine_core/LICENSE` / 仓库根 `THIRD_PARTY.md`
- Python / layout 自有实现：Voyager
