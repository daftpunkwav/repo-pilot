# Phase 9 — 个人资料

> **路由：** `/profile`  
> **入口：** Topbar 用户菜单 →「个人资料」（**不在侧栏**）  
> **前置依赖：** Gate 8  
> **门禁：** Gate 9

---

## 1. 页面职责

**账号级个人信息**管理，与「应用设置」分离：

| 本页 | 设置页 |
|------|--------|
| 头像 URL | 主题 / 字体 |
| 用户名（展示） | GitHub PAT 绑定 |
| 用户 ID（只读） | LLM 配置 |
| 邮箱（可选展示） | 数据导出 |
| 修改密码 | — |
| 注册时间 | — |

符合 PRD §3.1 用户头像（v1.0 URL 头像）与修改密码 P0 需求。

---

## 2. 功能清单

| 功能 | 说明 |
|------|------|
| 头像 | 显示 `avatar_url` 或首字母占位；输入 GitHub/URL 头像 → `updateProfile` |
| 用户名 | 只读展示（v1.0 不支持改名） |
| 用户 ID | 只读 `user.id`，可复制 |
| 邮箱 | 只读展示（若有） |
| GitHub 登录名 | 只读 `github_login` |
| 注册时间 | 格式化 `created_at` |
| 修改密码 | 旧密码 + 新密码 + 确认 → `changePassword` → 清空 token → `/login` |
| 危险区 | 退出登录按钮（冗余入口） |

---

## 3. 组件树

```
ProfilePage
├── ProfileHeader（大头像 + 用户名）
├── ProfileInfoCard（ID、邮箱、GitHub、注册时间）
├── AvatarUrlForm
├── ChangePasswordForm
└── DangerZone（退出登录）
```

---

## 4. Mock API

| 方法 | 说明 |
|------|------|
| `me()` | 当前用户 |
| `updateProfile({ avatar_url })` | MVP 仅支持 avatar_url |
| `changePassword` | 成功 → 前端清 token |

---

## 5. 设计规范

| 项 | 规范 |
|----|------|
| 布局 | 单栏居中 max-width 640px，卡片分段 |
| 头像 | 96px 圆形，预览即时更新 |
| 密码表单 | 三字段，强度提示与注册一致 |
| ID 字段 | `font-mono` + 复制按钮 |

---

## 6. 验收标准

| ID | 条件 | MVP |
|----|------|-----|
| G9-01 | 展示当前 Mock 用户信息 | — |
| G9-02 | 更新头像 URL 后 Topbar 头像同步 | — |
| G9-03 | 改密成功跳转登录，旧 token 失效 | AC-15 |
| G9-04 | 错误旧密码提示 | AC-15 |
| G9-05 | 用户 ID 可复制 | — |
| G9-06 | 侧栏无「个人资料」项 | ROUTES-AND-NAV |

---

## 7. 与 PRD 关系

- v1.0：**URL 头像**（GitHub 头像 URL），不上传文件（v1.1）
- 用户名注册后不可改（可在 UI 注明）
