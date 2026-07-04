# Phase 8 — 应用设置

> **路由：** `/settings`  
> **前置依赖：** Gate 1  
> **原型参考：** `settings.html`  
> **门禁：** Gate 8

---

## 1. 页面职责

**应用级配置**（非个人账号资料）：

- 外观（主题、字体）
- GitHub 账号绑定（PAT）
- LLM BYOK 配置与测试
- 数据导出

**不包含：** 修改头像、用户名展示、改密（见 [09-PROFILE.md](./09-PROFILE.md)）。

---

## 2. 功能清单

| Section | 功能 |
|---------|------|
| 外观 | 主题 dark/light/system；字体缩放 0.8–**1.5**（滑块 step 0.1） |
| GitHub | 已绑定列表、解绑、绑定表单（username + PAT） |
| LLM | provider 选择、model、api_base、api_key（password）、测试连通 |
| 数据 | 导出项目 JSON、导出笔记 JSON |
| 关于 | 版本号 RepoPilot v1.0.0 |

### 设置页子导航

左侧 sticky subnav（原型 `settings-shell`）：外观 | GitHub | LLM | 数据 | 关于

---

## 3. 组件树

```
SettingsPage
├── SettingsSubnav
└── SettingsMain
    ├── AppearanceSection
    ├── GitHubSection
    ├── LLMSection
    ├── DataSection
    └── AboutSection
```

---

## 4. Mock API

| 方法 | 说明 |
|------|------|
| `getSettings` / `updateSettings` | 含 `llm_configured`, `llm_api_key_masked` |
| `testLLM` | 延迟 ~800ms，返回 success + latency_ms |
| `listGithubAccounts` / `bindGithub` / `unbindGithub` | 绑定流程 |
| `exportProjects` | 触发 JSON 下载 |

**settingsStore：** load / update / testLLM 状态。

---

## 5. 设计规范

| 项 | 规范 |
|----|------|
| 布局 | 左 subnav 200px + 主区 max-width 900px |
| LLM 未配置 | subnav 红点 `dot-unset` |
| API Key | 显示脱敏 `sk-****xxxx`，输入 type=password |
| 测试按钮 | 显示成功/失败 + 延迟 ms |

---

## 6. 验收标准

| ID | 条件 | MVP |
|----|------|-----|
| G8-01 | 主题切换即时生效 | AC-13 |
| G8-02 | 字体缩放即时生效（--font-scale） | AC-13 |
| G8-03 | 绑定 GitHub Mock 成功列表刷新 | AC-06 |
| G8-04 | 解绑确认后列表为空 | — |
| G8-05 | LLM 配置保存 + 测试显示延迟 | AC-13 |
| G8-06 | 导出项目触发浏览器下载 | — |
| G8-07 | API Key 不在 GET 响应中以明文出现 | §9.4 |

---

## 7. 审查重点

- PAT/API Key 输入框不记录到 console
- `updateSettings` 乐观更新 + 失败回滚
- 与 Profile 页职责不重叠
