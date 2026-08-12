# Spike: Cross-repo 边

**状态：** 已拍板  
**范围：** 跨仓调用边的产生时机与 L0 类型命名

## 结论

**Phase 3** 对已 READY 的项目集合跑 `cross-repo-intelligence`；L0 边类型定为 `cross_http` / `cross_async`。仓内 HTTP 边继续用既有类型，不混进 cross 前缀。

## 核实事实

- `index_repository` 在 `mode=cross-repo-intelligence` + `target_projects` 时产出：
  - `CROSS_HTTP_CALLS`
  - `CROSS_ASYNC_CALLS`
  - `CROSS_CHANNEL`
- 仓内已有 `HTTP_CALLS`（Voyager 上约 74 条）——这是 **in-repo**，不是 cross-repo

## 拍板

1. **时机**：Phase 3；仅对状态为 READY 的项目集合执行 cross-repo 索引，避免半成品仓污染边。
2. **L0 映射**：
   - `CROSS_HTTP_CALLS` → `cross_http`
   - `CROSS_ASYNC_CALLS` → `cross_async`
   - `CROSS_CHANNEL`：本阶段可入库，UI/L0 优先保证 http/async；channel 是否单独暴露另开任务
3. **边界**：仓内 `HTTP_CALLS` 保持原类型；不得把 in-repo HTTP 标成 `cross_*`。

## 非目标

- Phase 1/2 不做全量 cross-repo 扫描
- 不在本 spike 定 UI 上 cross 边的视觉区分细节
