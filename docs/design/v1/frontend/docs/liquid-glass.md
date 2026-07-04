# 液态玻璃（Liquid Glass）

RepoPilot 前端 mock 的**液态玻璃唯一参考实现**位于：

```
src/styles/liquid-glass.css
```

以后提到「液态玻璃」，即指该文件中的 `.liquid-glass` 体系，**不要自行猜测** blur / opacity / shadow 数值。

## 设计依据

1. **项目标准实例**（glass-card 参考代码）——顶边 + 左边折射高光、半透明 tint、`backdrop-filter: blur(12px)`、多层 inset shadow。
2. **[Apple HIG · Materials](https://developer.apple.com/design/human-interface-guidelines/materials)** — Liquid Glass 用于**导航/控件层**，浮于内容之上；内容层用 Standard materials；避免 glass 叠 glass； tint 仅用于强调主操作。
3. **[Adopting Liquid Glass](https://developer.apple.com/documentation/TechnologyOverviews/adopting-liquid-glass)** — 分层设计、系统级反射/折射/阴影/模糊；尊重 Reduce Transparency / Reduce Motion。

> Web mock 无法复刻 Metal 实时 lensing，用 CSS `backdrop-filter` + 边缘高光 + inset shadow **近似**视觉。

## 标准实现（glass-card）

与用户提供的参考代码 **1:1 对齐**，类名 `.glass-card` 可直接使用：

```css
background: rgba(255, 255, 255, 0.08);
backdrop-filter: blur(12px);
border: 1px solid rgba(255, 255, 255, 0.3);
/* + 外阴影 / inset 高光 / 顶边+左边折射线 */
```

完整定义见 `src/styles/liquid-glass.css`。

## 快速使用

### 无色玻璃卡片

```html
<div class="glass-card liquid-glass-padded">
  ...
</div>
```

### 玻璃按钮（上层控件 · control）

```html
<a class="btn glass-card glass-card--control liquid-glass--pill liquid-glass--interactive liquid-glass-btn">
  浏览项目库
</a>
```

### Hero 三层叠放（总览页）

```html
<div class="overview-hero-wrap">
  <div class="overview-hero-art" aria-hidden><!-- 底层艺术字 --></div>
  <section class="overview-hero glass-card glass-card--panel"><!-- 中层 --></section>
</div>
```

### 品牌 Primary CTA（如「和 Agent 对话」）

```html
<a class="btn glass-card glass-card--control liquid-glass--pill liquid-glass--interactive liquid-glass--pulse liquid-glass-btn">
  和 Agent 对话
</a>
```

### React 组件

`GlassCard` 已封装 `liquid-glass`：

```tsx
<GlassCard className="liquid-glass--rounded">...</GlassCard>
```

## CSS 变量（可调）

| 变量 | 默认值 | 含义 |
|------|--------|------|
| `--lg-tint` | `rgba(255,255,255,0.08)` | 玻璃底色（glass-card 标准） |
| `--lg-blur` | `12px` | 背景模糊 |
| `--lg-border` | `rgba(255,255,255,0.3)` | 外边框 |
| `--lg-shadow-outer` | `0 8px 32px rgba(0,0,0,0.1)` | 外阴影（深度） |
| `--lg-brand-tint` | `rgba(0,122,255,0.21)` | 品牌 tint（Primary） |

局部覆盖示例：

```css
.my-panel {
  --lg-tint: rgba(255, 255, 255, 0.28);
  --lg-blur: 16px;
}
```

## 类名一览

| 类名 | 用途 |
|------|------|
| `.glass-card` | **标准类名**，与参考代码同名 |
| `.liquid-glass` | 等价于 `.glass-card` |
| `.glass-card--panel` | 中层大面板：0.05 tint · blur 8px · 无内发光 |
| `.glass-card--control` | 上层控件：0.12 tint · blur 15px · 内发光 |
| `.liquid-glass--strong` | 更强 blur |
| `.liquid-glass--brand` | 品牌蓝 tint + 字色 |
| `.liquid-glass--rounded` / `--pill` / `--square` | 圆角 |
| `.liquid-glass--interactive` | hover 上浮 |
| `.liquid-glass--pulse` | 间歇跳动（CTA） |
| `.liquid-glass-btn` | 按钮高度/内边距 |
| `.liquid-glass-padded` | 卡片内边距 |

## 原则（红队清单）

- ✅ 用于顶栏、侧边栏、浮动按钮、Sheet、Primary CTA
- ✅ 背后需要有**有层次的背景**（渐变/内容），玻璃才有意义 — hero 区已有轻渐变即可
- ❌ 不要在大面积列表/表格内容层滥用
- ❌ 不要 glass 叠 glass（两层都 blur 会发灰、脏）
- ❌ tint 不要到处加——只强调主操作

## 引入方式

`main.tsx` 在 `design-system.css` 之后引入：

```ts
import '@/styles/liquid-glass.css';
```

`design-system.css` 中旧的 `.glass` 规则已迁移至本文件；保留 `.glass` 别名以兼容现有组件。
