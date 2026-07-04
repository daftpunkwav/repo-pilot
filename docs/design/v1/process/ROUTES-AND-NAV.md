# 路由与导航规范

> 前端 Mock 开发期间的唯一路由表。实现 `App.tsx` / `createBrowserRouter` 时必须与此一致。

---

## 1. 路由表

| 路径 | 页面组件 | 认证 | 布局 |
|------|----------|------|------|
| `/login` | `LoginPage` | 公开 | 无 AppShell |
| `/register` | `RegisterPage` | 公开 | 无 AppShell |
| `/` | `OverviewPage` | 需登录 | AppShell |
| `/projects` | `ProjectsPage` | 需登录 | AppShell |
| `/projects/:id` | `ProjectDetailPage` | 需登录 | AppShell |
| `/agent` | `AgentPage` | 需登录 | AppShell |
| `/agent/sessions/:sessionId` | `AgentPage` | 需登录 | AppShell |
| `/graph` | `GraphPage` | 需登录 | AppShell |
| `/notes` | `NotesPage` | 需登录 | AppShell |
| `/settings` | `SettingsPage` | 需登录 | AppShell |
| `/profile` | `ProfilePage` | 需登录 | AppShell |
| `*` | `Navigate → /` | — | — |

---

## 2. 侧栏导航（顺序固定）

与原型 `sidebar.js` `NAV_ITEMS` 对齐：

| 顺序 | key | 标签 | 路由 | 角标 |
|------|-----|------|------|------|
| 1 | overview | 总览 | `/` | 可选：项目总数 |
| 2 | projects | 项目库 | `/projects` | 项目数 |
| 3 | agent | Agent Chat | `/agent` | `AI` |
| 4 | graph | 图谱 | `/graph` | — |
| 5 | notes | 笔记 | `/notes` | 笔记数 |
| 6 | settings | 设置 | `/settings` | — |

**不在侧栏：**

| 入口 | 路由 | 触发 |
|------|------|------|
| 个人资料 | `/profile` | Topbar 用户头像下拉 →「个人资料」 |
| 项目详情 | `/projects/:id` | 项目库行点击 / 图谱节点 / 总览卡片 |
| 登录注册 | `/login` `/register` | 未认证重定向 |

---

## 3. Topbar 用户菜单

```
[头像] username ▾
  ├── 个人资料    → /profile
  ├── 设置        → /settings
  ├── ─────────
  └── 退出登录    → authStore.logout() → /login
```

---

## 4. 面包屑约定

| 页面 | 面包屑 |
|------|--------|
| 总览 | `总览` |
| 项目库 | `项目库` |
| 项目详情 | `项目库 / facebook/react` |
| Agent | `Agent Chat` |
| 图谱 | `知识图谱` |
| 笔记 | `笔记` |
| 设置 | `设置` |
| 个人资料 | `个人资料` |

---

## 5. 重定向逻辑

| 场景 | 行为 |
|------|------|
| 未登录访问受保护路由 | `→ /login` |
| 已登录访问 `/login` | `→ /` |
| 项目不存在 | Toast + `→ /projects` |
| 登出 | `→ /login` replace |
