# Spike: 图谱渲染选型

**状态：** 已拍板  
**范围：** 3D 图可视化技术栈（不含取数）

## 结论

**采用 `@react-three/fiber` + `drei` + `three` 栈移植**；不 iframe 参考 UI。深色可开 Bloom；浅色关闭或弱化 Bloom，背景跟设计系统 CSS 变量。

## 核实事实

- 参考 graph-ui 栈：`@react-three/fiber`、`@react-three/drei`、`three`、`postprocessing` Bloom
- 场景结构：`GraphScene` / `NodeCloud` / `EdgeLines`；球体实例化（instanced spheres）；节点量 **>75k** 切 point mode
- RepoPilot 已有 design-system：`data-theme` dark/light + liquid-glass

## 拍板

1. **移植 R3F 栈进 RepoPilot 自有页面**，共享 design-system 主题，**禁止 iframe 嵌入参考 UI**。
2. **深色主题**：允许 Bloom / 后处理增强层次。
3. **浅色主题**：关闭或显著弱化 Bloom；画布/场景背景读取 CSS 变量，避免与 liquid-glass 冲突。
4. **LOD**：沿用参考策略——常规 instanced spheres；极端规模（>75k）切 point mode（当前 RepoPilot ~7.4k 节点，默认走实例化球体即可）。

## 非目标

- 不自研 WebGL 抽象替代 R3F
- 不在本阶段强制对接 cross-repo 边样式（见 `spike-cross-repo.md`）
