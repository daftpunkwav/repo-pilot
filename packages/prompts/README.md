# Prompt 库

Agent 系统使用的 Prompt 模板（Markdown / Jinja2 / YAML）。

## 规划结构

```
prompts/
├── hub/
├── scout/
├── mentor/
├── navigator/
├── curator/
└── scribe/
```

运行时由 `services/agent` 加载；v1.0 阶段模板可能仍在 `services/api/backend/agents/` 各 Agent 目录内，逐步外置到此包。
