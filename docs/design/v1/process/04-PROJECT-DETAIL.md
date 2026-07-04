# Phase 4 — 项目详情

> **路由：** `/projects/:id`  
> **前置依赖：** Gate 3  
> **原型参考：** `project-detail.html`  
> **门禁：** Gate 4

---

## 1. 页面职责

单个项目的 **深度阅读与学习中心**：元信息、README、笔记、进度/标签、Scout 快速分析、跳转 GitHub。

---

## 2. 功能清单

| 功能 | 说明 |
|------|------|
| Hero | 仓库名、描述、语言、Stars、分类、导入时间 |
| 进度选择 | 四档 pill 切换 → `updateProgress` |
| 标签编辑 | 多选标签 → `setProjectTags` |
| 打开 GitHub | 外链 `target=_blank` |
| 删除项目 | 确认对话框 → `deleteProject` → `/projects` |
| Tab: README | `MarkdownRenderer` 渲染 `project.readme` |
| Tab: 笔记 | 笔记列表 + 创建/编辑/删除（内嵌 `NoteEditor`） |
| Tab: Agent | 嵌入简化 `ChatPanel` 或按钮跳 `/agent?project=:id` |
| Scout 分析 | 按钮 → `analyzeProject(id, 'scout')` SSE 流展示 |
| 侧栏 | 项目元信息、相关项目（Mock 2–3 条） |

---

## 3. 组件树

```
ProjectDetailPage
├── ProjectHeader（Hero + 操作）
├── ProgressPills
├── TagEditor
├── Tabs
│   ├── ReadmeTab → MarkdownRenderer
│   ├── NotesTab → NoteList + NoteEditor
│   └── AgentTab → Scout 入口 / 迷你 Chat
├── ScoutAnalysisPanel（流式 Markdown，条件渲染）
└── ProjectSidePanel
```

---

## 4. Mock API

| 方法 | 说明 |
|------|------|
| `getProject(id)` | 含 readme 全文（至少 react 项目有） |
| `listNotes(projectId)` | 该项目笔记 |
| `createNote` / `updateNote` / `deleteNote` | CRUD |
| `updateProgress` | 四枚举 |
| `setProjectTags` | 全量替换 tag_ids |
| `deleteProject` | 成功返回 |
| `analyzeProject` | SSE Mock，30s 内完成打字效果 |

**SSE Mock：** 使用 `content` 字段（非 `delta`），事件 `text_delta` → `done`。

---

## 5. 设计规范

| 项 | 规范 |
|----|------|
| 布局 | 主区 + 右侧 320px sticky 侧栏（原型 `pd-shell`） |
| README | 工具栏字号调节（仅影响 readme 区） |
| Markdown | `react-markdown` + `remark-gfm`，代码高亮 |
| Tab | `aria-selected`，计数徽章 |

---

## 6. 验收标准

| ID | 条件 | MVP |
|----|------|-----|
| G4-01 | 有效 id 展示完整 Header + README | AC-10 |
| G4-02 | 无效 id → Toast + 跳转 `/projects` | — |
| G4-03 | 进度切换持久化（Mock 内存） | — |
| G4-04 | 笔记 CRUD + Markdown 预览 | AC-11 |
| G4-05 | Scout 点击后流式显示分析 Markdown | AC-17 |
| G4-06 | README 空态 EmptyState | — |
| G4-07 | `data-testid="readme-content"` `tab-notes` | E2E |

---

## 7. 与笔记页关系

项目内笔记 Tab 与 `/notes` 跨项目页 **共用** `NoteEditor`、`MarkdownRenderer` 组件；数据均走 Mock API。
