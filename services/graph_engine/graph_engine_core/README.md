# RepoPilot 图谱 C 引擎（rp-graph-engine）

本目录由 MIT 许可的 [codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp) **源码迁入**（非运行时外链）。  
内部符号仍可能带 `cbm_*` 前缀；对外产物名为 **`rp-graph-engine`**。

## 能力

- HTTP：`/api/layout`、`/api/index`、`/api/index-status`、`/api/project-health`、`DELETE /api/project` 等
- JSON-RPC：`POST /rpc`（`tools/call`：`search_graph`、`get_graph_schema`、`trace_path` 等）
- **不含**上游 React `graph-ui`；可视化由 RepoPilot `apps/web` 负责

> C 引擎只提供功能 API（`/api/layout`、`/rpc`），前端可视化由 RepoPilot `apps/web` 负责。asset_pack 前端资源服务已移除。

## 构建

依赖（WSL/Ubuntu 示例）：`build-essential`、`make`、`zlib1g-dev`、`python3`。

**Makefile 入口优先 `Makefile.rp`；`Makefile.cbm` 仅为兼容上游脚本的 `include` 别名。**

Windows（推荐 WSL）：

```powershell
# 在仓库根或本目录
.\services\graph_engine\graph_engine_core\scripts\build.ps1
```

或：

```bash
cd services/graph_engine/graph_engine_core
# 若从 Windows 复制过脚本，先去掉 CRLF：python 规范化或 dos2unix scripts/*.sh
make -f Makefile.rp -j$(nproc) rp-graph-engine
# 产物：build/c/rp-graph-engine
```

## 运行

```powershell
$env:CBM_CACHE_DIR = "<repo>/data/graph-engine-cache"
$env:CBM_ALLOWED_ROOT = "<允许索引的根目录>"
.\rp-graph-engine.exe --ui=true --port=9750
```

RepoPilot API 通过环境变量对接：

- `RP_GRAPH_ENGINE_URL=http://127.0.0.1:9750`
- `RP_GRAPH_ENGINE_BIN=<本目录构建出的可执行文件>`
- 可选：`CBM_CACHE_DIR`（图谱 SQLite 缓存根）

## 许可

见本目录 [`LICENSE`](LICENSE)（Copyright © 2025 DeusData，MIT）及 [`THIRD_PARTY.md`](THIRD_PARTY.md)。
