# RepoPilot 图谱引擎

## 默认：C 引擎 sidecar（迁入源码）

源码位于 [`c/`](c/)（MIT，迁自 codebase-memory-mcp）。构建与运行见 [`c/README.md`](c/README.md)。

```powershell
.\services\graph_engine\c\scripts\build.ps1
$env:CBM_CACHE_DIR = "$PWD\data\graph-engine-cache"
$env:RP_GRAPH_ENGINE_BIN = "$PWD\services\graph_engine\c\build\c\rp-graph-engine"
# API 侧：
$env:RP_GRAPH_ENGINE_URL = "http://127.0.0.1:9750"
```

API 启动时若配置了 `RP_GRAPH_ENGINE_BIN`（或在约定路径找到二进制），会在 sidecar 不健康时自动拉起。

## 回退：进程内 Python（`python/rp_graph`）

当 `RP_GRAPH_ENGINE_URL` 未设置或 sidecar 不可达时，回退到 Python 引擎。  
新功能与索引质量以 C 引擎为准；Python 路径仅作兼容。

可选 native 布局加速见 [`native/`](native/)（CMake）。

## 许可

- C 引擎迁入代码：见 `c/LICENSE` / 仓库根 `THIRD_PARTY.md`
- Python / native 自有实现：RepoPilot
