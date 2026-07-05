# RepoPilot Desktop

桌面端应用壳层（规划中）。

## 技术方向

- **v1.0**：pywebview 加载 `apps/web` 构建产物，内嵌 `services/api`
- **v1.x+**：可迁移至 Tauri（Rust 壳 + WebView）

## 目录规划

```
desktop/
├── src/           # 壳层入口（pywebview / Tauri）
├── resources/     # 图标、安装器资源
└── package.json   # 桌面构建脚本
```

当前阶段 Web 与 Desktop 共用 `apps/web` UI，本目录为占位，待打包流程落地后填充。
