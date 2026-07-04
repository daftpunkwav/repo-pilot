# Phase 6 — 知识图谱

> **路由：** `/graph`  
> **前置依赖：** Gate 3（项目 Mock 数据）  
> **原型参考：** `graph.html`  
> **门禁：** Gate 6

---

## 1. 页面职责

基于项目相似度的 **力导向图**：节点交互、缩放拖拽、搜索高亮、筛选、跳转详情。

---

## 2. 功能清单

| 功能 | 说明 |
|------|------|
| 图谱画布 | D3.js SVG 力模拟 |
| 控制栏 | 搜索、min_similarity 滑块、max_edges、分类筛选 |
| 节点点击 | 选中 → 右侧 `NodeDetailPanel` |
| 节点双击 | → `/projects/:id` |
| 拖拽节点 | D3 drag |
| 缩放平移 | D3 zoom |
| 重置视图 | 按钮恢复 zoom + 选中清空 |
| 性能警告 | 节点 >1000 提示提高 min_similarity |

---

## 3. 组件树

```
GraphPage
├── GraphControls
├── ForceGraph（D3）
└── NodeDetailPanel（条件）
    ├── 项目名 / 语言 / Stars
    ├── ProgressBadge
    └── Button → 项目详情
```

---

## 4. Mock API

| 方法 | 说明 |
|------|------|
| `getGraph({ min_similarity, max_edges })` | ≥15 nodes, ≥20 edges |

**节点视觉（FRONTEND_SPEC §6.5 / §7.1）：**

- 颜色：`category_id` → CSS 变量
- 大小：`log2(stars+1)*2+4`，clamp [4,20]
- 边透明度：`similarity` 映射 [0.1, 0.8]
- 缩放 >0.8 显示标签

**D3 配置：** `FORCE_CONFIG` 见 FRONTEND_SPEC。

---

## 5. graphStore

`selectedNodeId`, `highlightNodeId`, `minSimilarity`, `maxEdges`, `categoryFilter`, `zoomLevel`。

---

## 6. 设计规范

| 项 | 规范 |
|----|------|
| 画布 | 占满 Main 剩余高度，`min-height: 500px` |
| 详情面板 | 右侧抽屉 320px |
| 搜索 | 匹配节点名 → highlight + 居中 |
| 加载 | 中央 Spinner「正在计算图谱…」 |

| G6-09 | 仅 1 个项目时 EmptyState 提示 | — |

---

## 7. 验收标准

| ID | 条件 | MVP |
|----|------|-----|
| G6-01 | Mock 图谱渲染，节点+边可见 | AC-12 |
| G6-02 | 点击节点显示详情面板 | AC-12 |
| G6-03 | 双击跳转项目详情 | AC-12 |
| G6-04 | 拖拽/缩放流畅 | AC-12 |
| G6-05 | 搜索高亮匹配节点 | — |
| G6-06 | similarity 滑块变更重新 fetch | — |
| G6-07 | <2s 渲染 100 节点（Mock 数据） | §9.2 |
| G6-08 | `data-testid="force-graph-svg"` `graph-node` | E2E |
| G6-09 | 仅 1 个项目时 EmptyState 提示 | — |

---

## 8. 审查重点

- D3 在 `useEffect` 清理 simulation，防内存泄漏
- `resize` 节流 150ms 重算宽高
- 路由离开卸载 SVG
