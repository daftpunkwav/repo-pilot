# Phase 1 — 登录与注册

> **前置依赖：** Phase 0 通过 Gate 0  
> **原型参考：** `login.html`, `register.html`  
> **门禁：** Gate 1

---

## 1. 页面职责

| 路由 | 职责 |
|------|------|
| `/login` | 用户名+密码登录，错误提示，跳转总览 |
| `/register` | 注册并自动登录 |

---

## 2. 功能清单

### LoginPage

| 功能 | 说明 |
|------|------|
| 用户名输入 | 3–32 字符 |
| 密码输入 | `type=password`，≥8 字符 |
| 提交 | Enter 或按钮 → `authStore.login()` |
| 错误展示 | `authStore.error` → `ErrorBanner` |
| 加载态 | 提交中按钮 disabled + Spinner |
| 跳转注册 | Link → `/register` |
| 已登录重定向 | 访问 `/login` 且已认证 → `/` |

### RegisterPage

| 功能 | 说明 |
|------|------|
| 用户名 / 密码 / 确认密码 | 与登录相同校验 |
| 密码一致性 | 前后密码必须相同 |
| 密码强度 | ≥8 + 字母 + 数字 |
| 提交 | `authStore.register()` → 成功 → `/` |
| 跳转登录 | Link → `/login` |

---

## 3. 组件树

```
LoginPage
├── AuthLayout（居中卡片，可选 fluid-blob 背景）
├── LoginForm
│   ├── InputField username
│   ├── InputField password
│   ├── Button submit
│   └── Link → /register
└── ErrorBanner

RegisterPage
├── AuthLayout
├── RegisterForm
│   ├── InputField username
│   ├── InputField password
│   ├── InputField confirmPassword
│   ├── Button submit
│   └── Link → /login
└── ErrorBanner
```

---

## 4. Mock API

| 方法 | 行为 |
|------|------|
| `login({ username, password })` | 匹配 mock 用户则返回 token + user；否则抛 `AUTH_FAILED` |
| `register({ username, password })` | 用户名已存在抛错；否则创建用户并返回 token |
| `logout()` | 清空 token |
| `me()` | 有 token 返回当前用户 |

**Mock 用户（`api/mock/data/users.ts`）：**

- 主用户：`zhang.jie` / `demo1234`
- 测试用户：`testuser` / `test1234`

Token 存 `localStorage`: `rp_token`, `rp_refresh`。

---

## 5. 设计规范

| 项 | 规范 |
|----|------|
| 布局 | 全屏居中，最大宽 400px 表单卡 |
| 背景 | 可选复用原型 `particles-bg` / `fluid-blob`（纯 CSS/轻 JS） |
| Logo | RP 方块 + RepoPilot 字标 |
| 表单 | 使用 `design-system.css` 的 `.input`, `.btn`, `.card` |
| 无障碍 | `label` 关联 `input`，`name` 属性供 E2E |

---

## 6. 校验函数

使用 `utils/validators.ts`（与 FRONTEND_SPEC §6.1 / §9.5 一致）：

- `validateUsername`
- `validatePassword`
- `validateLoginForm` / `validateRegisterForm`

---

## 7. 验收标准

| ID | 条件 | 对应 MVP |
|----|------|----------|
| G1-01 | 正确账号登录 → `/` | AC-02 |
| G1-02 | 错误密码 → 红色错误提示 | AC-02 |
| G1-03 | 合法注册 → 自动登录 → `/` | AC-01 |
| G1-04 | 用户名过短/密码弱 → 前端拦截，不提交 | AC-01 |
| G1-05 | 已登录访问 `/login` → `/` | — |
| G1-06 | 登出后 token 清除 | — |
| G1-07 | `[name="username"]` `[name="password"]` 存在供 E2E | — |
| G1-08 | Vitest：`validators` 单元测试通过 | §11 |

---

## 8. 审查重点

- 密码不出现在 console / 网络日志
- 错误信息来自 API `error.message`，不暴露堆栈
- 表单提交防重复（loading 态）
