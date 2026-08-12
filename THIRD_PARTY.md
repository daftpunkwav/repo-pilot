# Third-Party Notes

## 图谱 C 引擎（迁入）

[`services/graph_engine/graph_engine_core`](services/graph_engine/graph_engine_core) 源码迁自 MIT 许可的
[codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp)（Copyright © 2025 DeusData）。

- 许可证全文见 [`services/graph_engine/graph_engine_core/LICENSE`](services/graph_engine/graph_engine_core/LICENSE)
- 归属说明见 [`services/graph_engine/graph_engine_core/NOTICE`](services/graph_engine/graph_engine_core/NOTICE)
- 对外产物名：`rp-graph-engine`（内部符号可仍含 `cbm_*`）
- Voyager 通过本机 HTTP sidecar（默认 `127.0.0.1:9750`）调用；**不**依赖外部全局安装的 CBM

## Python 回退引擎

[`services/graph_engine/graph_engine_runtime`](services/graph_engine/graph_engine_runtime) 为进程内 Python 实现，仅在 C 引擎 sidecar 不可用时回退使用。
