# Phase 3 — 项目库

> **路由：** `/projects`  
> **前置依赖：** Gate 2  
> **原型参考：** `projects.html`  
> **门禁：** Gate 3

---

## 1. 页面职责

用户收藏/导入的 **GitHub 项目主列表**：表格展示、搜索筛选、排序分页、统计条、**批量导入**（GitHub Stars + URL 粘贴）。

**v1.0 仅表格视图**（卡片视图推迟 v1.1，不做 `viewMode` 切换）。

---

## 2. 功能清单

| 功能 | 说明 |
|------|------|
| 页面标题区 | 「项目库」+ 副标题 + 操作按钮组 |
| 统计条 | 可选精简版 4 指标（或与总览共用组件） |
| 筛选栏 | 搜索（防抖 300ms）、分类、语言、进度、标签、排序 |
| 项目表格 | 列：仓库名、语言、Stars、分类、进度、标签、操作 |
| 行点击 | → `/projects/:id` |
| 分页 | page / page_size，默认 20 |
| 空态 | 引导「导入 GitHub Stars」或「粘贴 URL」 |
| GitHub Star 导入抽屉 | 见 §3 |
| URL 批量导入 Modal | 见 §3 |
| 手动添加 | 单条表单 Modal（name 可自动从 URL 解析） |

### 筛选参数映射

`projectStore.toApiParams()` → `listProjects()`，字段见 FRONTEND_SPEC `ProjectListParams`。

---

## 3. 批量导入（非独立页面）

### 3.1 GitHub Star 导入抽屉 `ImportStarsDrawer`

| 步骤 | UI |
|------|-----|
| 打开 | 按钮「同步 GitHub Stars」；仅 `user.github_bound === true` 时显示主按钮，否则显示「先去设置绑定」 |
| 加载 | `listStars()` → 列表含 `already_imported` 标记 |
| 选择 | 多选 checkbox，全选/反选 |
| 确认 | `importProjects(repos)` → Toast 成功数/失败数 → invalidate 列表 |
| 关闭 | 刷新表格 |

**Query 联调：** `/projects?import=stars` 自动打开抽屉（来自总览快捷入口）。

### 3.2 URL 批量粘贴 Modal `ImportUrlsModal`

| 步骤 | UI |
|------|-----|
| 打开 | 按钮「批量粘贴 URL」 |
| 输入 | Textarea，每行一个 URL |
| 校验 | 每行匹配 `^https://github.com/[owner]/[repo]$` |
| 预览 | 解析有效/无效行数 |
| 确认 | 有效 URL 调 `createProject` 或批量 `importProjects` |
| 结果 | 展示成功/跳过（重复）/失败 |

符合 MVP D-14。

---

## 4. 组件树

```
ProjectsPage
├── PageHead（标题 + ImportStarsDrawer 触发 + ImportUrlsModal 触发 + 添加项目）
├── FilterBar
├── ProjectTable
│   └── ProjectRow × N
├── Pagination
├── ImportStarsDrawer
├── ImportUrlsModal
└── AddProjectModal（可选单条）
```

---

## 5. Mock API

| 方法 | Mock 数据要求 |
|------|---------------|
| `listProjects` | ≥15 条，支持 search/filter/sort/page |
| `listCategories` | 12 条预设（MVP 附录 B） |
| `listTags` | ≥8 条 |
| `listStars` | 从 MOCK_PROJECTS 映射 + 部分未导入项 |
| `importProjects` | 返回 `{ succeeded, failed, summary }`（MVP 结构） |
| `createProject` | URL 重复抛 `DUPLICATE_URL` |
| `listGithubAccounts` | 绑定状态供按钮显隐 |

---

## 6. 设计规范

| 项 | 规范 |
|----|------|
| 表格 | `.table`，行 hover，仓库名 `font-mono` |
| 语言 | 彩色圆点 `.lang-*` |
| 进度 | `ProgressBadge` 组件 |
| 筛选栏 | `.filter-bar` 与原型一致 |
| Scout 快捷 | 行内「Scout」按钮 → 跳详情或触发分析（Phase 4） |

---

## 7. 验收标准

| ID | 条件 | MVP |
|----|------|-----|
| G3-01 | 表格展示 ≥15 条 Mock 项目 | — |
| G3-02 | 搜索防抖 300ms 生效 | AC-09 |
| G3-03 | 分类/语言/进度/标签筛选正确 | AC-09 |
| G3-04 | 分页正确 | — |
| G3-05 | Star 导入抽屉多选导入后列表增加 | AC-07 |
| G3-06 | URL 粘贴导入有效行成功、无效行提示 | AC-04 |
| G3-07 | 重复 URL 提示「已存在」 | AC-05 |
| G3-08 | 未绑定 GitHub 时 Star 按钮引导去设置 | AC-06 |
| G3-09 | `data-testid="project-table"` `import-stars-btn` | E2E |
| G3-10 | 无卡片视图切换按钮（v1.0） | MVP §2.2 |

---

## 8. 审查重点

- 筛选变更重置 `page` 为 1
- `react-query` 缓存 key 含筛选参数
- 导入失败不部分静默失败（展示 summary）
