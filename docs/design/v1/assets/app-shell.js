/* ==========================================================================
 * app-shell.js · RepoPilot 前端 · 通用初始化与辅助函数
 *
 * 加载顺序（在页面末尾）：
 *   <script src="./assets/api-mock.js"></script>      <!-- 提供 window.ApiClient -->
 *   <script src="./assets/sidebar.js"></script>       <!-- 渲染左侧导航 -->
 *   <script src="./assets/topbar.js"></script>        <!-- 渲染顶部栏 -->
 *   <script src="./assets/app-shell.js"></script>     <!-- 主题应用、通用函数 -->
 *
 * 提供：
 *   - 主题持久化与 applyTheme()
 *   - 全局通用：rpFormatDate / rpFormatNumber / rpGetQueryParam
 *   - toast 提示工具：rpToast(message, type)
 *   - 进度 / 分类 / 语言 的显示辅助
 *
 * ========================================================================== */

(function () {
  'use strict';

  // ---- 主题 ----
  function getTheme() {
    return localStorage.getItem('rp_theme') || 'light';
  }

  function applyTheme() {
    const t = getTheme();
    if (t === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  // 立即同步执行（避免主题闪烁）
  applyTheme();

  // ---- URL Query 解析 ----
  function getQueryParam(name) {
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
  }

  // ---- 数字格式化 ----
  function formatNumber(n) {
    if (n === null || n === undefined) return '0';
    if (n >= 10000) return Math.floor(n / 1000) + 'k';
    return String(n);
  }

  // ---- 日期格式化 ----
  function formatDate(iso) {
    if (!iso) return '-';
    try {
      const d = new Date(iso);
      const now = new Date();
      const diff = now - d;
      const day = 24 * 60 * 60 * 1000;
      if (diff < day) {
        const h = Math.floor(diff / (60 * 60 * 1000));
        if (h < 1) return '刚刚';
        return h + ' 小时前';
      }
      if (diff < 7 * day) return Math.floor(diff / day) + ' 天前';
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    } catch (e) {
      return iso;
    }
  }

  // ---- 进度显示 ----
  const PROGRESS_MAP = {
    none: { label: '待开始', className: 'progress-none' },
    learning: { label: '学习中', className: 'progress-learning' },
    learned: { label: '已学习', className: 'progress-learned' },
    mastered: { label: '已掌握', className: 'progress-mastered' }
  };

  function progressLabel(p) { return PROGRESS_MAP[p]?.label || p || '-'; }
  function progressClass(p) { return PROGRESS_MAP[p]?.className || ''; }

  // ---- 分类显示 ----
  function categoryLabel(id) {
    const map = {
      cat_frontend: 'Web 前端',
      cat_backend: 'Web 后端',
      cat_ai: 'AI / 机器学习',
      cat_data: '数据科学',
      cat_devops: 'DevOps / 运维',
      cat_mobile: '移动开发',
      cat_desktop: '桌面应用',
      cat_game: '游戏开发',
      cat_security: '安全',
      cat_tools: '工具 / 库',
      cat_learning: '学习资源',
      cat_other: '其他'
    };
    return map[id] || id || '-';
  }

  // ---- Toast 提示 ----
  function ensureToastContainer() {
    let c = document.getElementById('rp-toast-container');
    if (!c) {
      c = document.createElement('div');
      c.id = 'rp-toast-container';
      c.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;';
      document.body.appendChild(c);
    }
    return c;
  }

  function toast(message, type = 'info', durationMs = 2200) {
    const c = ensureToastContainer();
    const colors = {
      info: 'var(--brand-500)',
      success: 'var(--success)',
      warning: 'var(--warning)',
      error: 'var(--error)'
    };
    const node = document.createElement('div');
    node.style.cssText = `
      background: var(--bg-50);
      color: var(--text-800);
      padding: 12px 16px;
      border-radius: 12px;
      border: 1px solid var(--bg-300);
      box-shadow: var(--shadow-md);
      font-size: 13px;
      font-weight: 500;
      min-width: 200px;
      max-width: 360px;
      border-left: 4px solid ${colors[type] || colors.info};
      animation: rpToastIn .25s var(--ease);
    `;
    node.textContent = message;
    c.appendChild(node);
    setTimeout(() => {
      node.style.transition = 'opacity .2s, transform .2s';
      node.style.opacity = '0';
      node.style.transform = 'translateX(20px)';
      setTimeout(() => node.remove(), 220);
    }, durationMs);
  }

  // 注入 toast 入场动画
  if (!document.getElementById('rp-toast-style')) {
    const style = document.createElement('style');
    style.id = 'rp-toast-style';
    style.textContent = `@keyframes rpToastIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: none; } }`;
    document.head.appendChild(style);
  }

  // ---- 异步加载 ApiClient（如果页面还未加载） ----
  // 返回 ApiClient 的单例实例，所有页面共享同一个实例（保持登录态等状态一致）
  async function ensureApiClient() {
    if (window.__rpApiInstance) return window.__rpApiInstance;
    let Ctor = window.ApiClient;
    if (!Ctor) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = './assets/api-mock.js';
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
      Ctor = window.ApiClient;
    }
    if (!Ctor) throw new Error('ApiClient 未能加载');
    window.__rpApiInstance = new Ctor();
    return window.__rpApiInstance;
  }

  // ---- 暴露全局 ----
  window.RP = {
    getTheme, applyTheme,
    getQueryParam, formatNumber, formatDate,
    progressLabel, progressClass, categoryLabel,
    toast, ensureApiClient
  };
})();