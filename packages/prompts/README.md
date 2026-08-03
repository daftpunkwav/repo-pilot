# Prompt 库

Agent 系统使用的 Prompt 模板（Markdown / Jinja2 / YAML）。

## 当前状态

**占位包。** 运行时 Prompt / Soul 仍在 `services/api/backend/agents/` 各 Agent 配置内，尚未外置到本包。

## 规划结构

```
prompts/
├── hub/
├── scout/
├── mentor/
├── navigator/
├── curator/
├── scribe/
└── atlas/
```

目标由 `services/agent`（或当前同进程 Agent 运行时）加载；逐步从 `services/api/backend/agents/` 迁出。
