# Third-Party Notes

## 图谱 C 引擎（迁入）

[`services/graph_engine/c`](services/graph_engine/c) 源码迁自 MIT 许可的
[codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp)（Copyright © 2025 DeusData）。

- 许可证全文见 [`services/graph_engine/c/LICENSE`](services/graph_engine/c/LICENSE)
- 归属说明见 [`services/graph_engine/c/NOTICE`](services/graph_engine/c/NOTICE)
- 对外产物名：`rp-graph-engine`（内部符号可仍含 `cbm_*`）
- RepoPilot 通过本机 HTTP sidecar（默认 `127.0.0.1:9750`）调用；**不**依赖外部全局安装的 CBM

## Python 回退引擎

[`services/graph_engine/python`](services/graph_engine/python) 为进程内 Python 实现，仅在 C 引擎 sidecar 不可用时回退使用。
