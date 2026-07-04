# Phase 7 — 笔记

> **路由：** `/notes`  
> **前置依赖：** Gate 4（笔记 CRUD Mock）  
> **原型参考：** `notes.html`  
> **门禁：** Gate 7

---

## 1. 页面职责

**跨项目** 笔记管理：浏览、搜索、编辑、删除；左侧列表 + 右侧编辑器/预览。

项目详情内笔记 Tab 共用组件，本页提供全局视图。

---

## 2. 功能清单

| 功能 | 说明 |
|------|------|
| 侧栏搜索 | 过滤标题/内容（客户端 filter Mock；Real 用 `/notes/search`） |
| 笔记列表 | 标题、来源项目名、更新时间 |
| 选中笔记 | 右侧加载内容 |
| 新建笔记 | 选择关联项目 → 空白编辑器 |
| 编辑模式 | 标题 + Markdown  textarea |
| 预览模式 | 分屏或 Tab 切换实时预览 |
| 保存 | `updateNote` / `createNote` |
| 删除 | 确认对话框 |
| 跳转项目 | 来源项目名 Link → `/projects/:id` |

---

## 3. 组件树

```
NotesPage
├── NoteSidebar
│   ├── SearchInput
│   ├── CreateNoteButton
│   └── NoteListItem[]
├── NoteContent
│   ├── NoteHeader（标题 + 操作）
│   ├── MarkdownRenderer（预览）
│   └── NoteEditor（编辑）
└── DeleteConfirmDialog
```

---

## 4. Mock API

| 方法 | 说明 |
|------|------|
| `listAllNotes()` | ≥10 条，分布在 5+ 项目 |
| `listProjects` | 新建时选项目 |
| `getNote` / `createNote` / `updateNote` / `deleteNote` | 标准 CRUD |

**noteStore：** `editingNoteId`, `editorContent`, `previewMode`, `searchQuery`。

---

## 5. 设计规范

| 项 | 规范 |
|----|------|
| 布局 | 左 280px 列表 + 右内容区（原型） |
| 预览 | `react-markdown`，防抖 200ms |
| 空态列表 | 「在项目详情页创建笔记」 |
| 空态内容 | 「选择一条笔记」 |

---

## 6. 验收标准

| ID | 条件 | MVP |
|----|------|-----|
| G7-01 | 列表展示所有 Mock 笔记 | — |
| G7-02 | 搜索过滤标题 | — |
| G7-03 | 创建笔记并保存出现在列表 | AC-11 |
| G7-04 | 编辑 Markdown 预览正确（表格/代码） | AC-11 |
| G7-05 | 删除笔记从列表消失 | AC-11 |
| G7-06 | 来源项目链接可跳转 | — |
| G7-07 | `data-testid` note-item, save-note-btn | E2E |

---

## 7. 与 MVP 关系

MVP §2.2 将「笔记搜索」标为 v1.1；本页 v1.0 实现 **客户端过滤** 即可，不需后端全文搜索。
