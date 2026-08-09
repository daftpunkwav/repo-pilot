# RepoPilot 自研图谱引擎

进程内 Python 引擎（`python/rp_graph`）为默认运行时；`native/` 提供可选 C 布局加速与 `rp-graph-engine` CLI。

## 能力

- `index_repository`：full / moderate / fast / cross-repo-intelligence + persistence（`graph.db` / `.zst`）
- `search_graph` / `search_code` / `get_code_snippet`
- `trace_path`（calls / data_flow / cross_service + 风险分级）
- `query_graph`（Cypher 子集，硬上限 10 万行）
- `get_graph_schema` / `get_architecture`

## 构建 native（可选）

```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release
```

## Sidecar

```bash
set RP_GRAPH_ALLOWED_ROOT=.../data
python -m rp_graph.server
```

默认监听 `127.0.0.1:9750`。

## 许可

实现为 RepoPilot 自有代码；设计对照参考了 MIT 许可的 codebase-memory 能力面（见仓库 `THIRD_PARTY`）。
