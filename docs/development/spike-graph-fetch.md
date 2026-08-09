# Spike: 图谱取数通路

**状态：** 已拍板  
**范围：** 图数据如何进入 RepoPilot（不含渲染）

## 结论

| 通路 | 角色 | 决策 |
|------|------|------|
| Engine UI HTTP `GET /api/layout` | **主通路**（bulk 布局） | 采用 |
| MCP `POST /rpc` tools/call | Agent 交互 | 采用 |
| 直接读 SQLite | 降级 / 排障 | 仅兜底 |

## 核实事实

- Engine UI HTTP：`http://localhost:9749`
- Bulk 布局：`GET /api/layout?project=&max_nodes=`  
  - 默认 `max_nodes=5000`，步进按 5000 设计
- 响应形状：

```json
{
  "nodes": [{
    "id", "x", "y", "z", "label", "name", "file_path",
    "qualified_name", "start_line", "end_line",
    "size", "color", "status", "in_calls"
  }],
  "edges": [{ "source", "target", "type" }],
  "total_nodes"
}
```

- MCP：`POST /rpc`（JSON-RPC）适合 Agent 工具调用，**不适合**大批量拉全图
- SQLite：`~/.cache/codebase-memory-mcp/` — schema 耦合，仅作 fallback
- RepoPilot 索引规模约 **7400 nodes / 20k+ edges**；带 budget 的 layout（5000）是设计路径

## 拍板

1. **主通路**：UI HTTP `/api/layout`，按 `max_nodes` 预算分页/分批（默认 5000）。
2. **Agent**：走 MCP `/rpc`，不把 MCP 当 bulk 取数层。
3. **SQLite**：禁止作为默认读路径；仅在 HTTP/MCP 不可用时降级，且接受 schema 漂移风险。
4. **根目录**：`CBM_ALLOWED_ROOT` 指向仓库 `data/`。
5. **缓存**：本地图/克隆缓存落在 `data/repo-cache/`。

## 非目标

- 不在本 spike 定渲染栈（见 `spike-graph-render.md`）
- 不直接耦合 CBM 内部 SQLite schema 做生产读路径
