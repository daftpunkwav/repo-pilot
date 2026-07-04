/* ==========================================================================
 * topbar.js · RepoPilot 前端 · 全局顶栏组件
 *
 * 使用方式（每个页面）：
 *   <body data-page="projects">
 *     ...
 *     <header id="app-topbar"></header>
 *     ...
 *     <script src="./assets/topbar.js"></script>
 *
 * 自动行为：
 *   - 渲染统一顶栏：面包屑 + 全局搜索 + 主题切换 + 通知 + 头像
 *   - 面包屑由 data-page 与可选 data-breadcrumb(JSON) 控制
 *   - 全局搜索 Enter 跳转 projects.html?q=xxx
 *
 * ========================================================================== */

(function () {
  'use strict';

  // 页面 key → 中文名
  const PAGE_LABEL = {
    overview: '总览',
    projects: '项目库',
    agent: 'Agent Chat',
    graph: '图谱',
    notes: '笔记',
    settings: '设置',
    'project-detail': '项目详情',
    'note-edit': '笔记编辑'
  };

  const ICONS = {
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
    help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 3.5"/><circle cx="12" cy="17" r=".8" fill="currentColor"/></svg>',
    github: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.92.58.11.79-.25.79-.56v-2c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.78 1.19 1.78 1.19 1.04 1.78 2.72 1.27 3.38.97.1-.75.4-1.27.74-1.56-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.18 1.18.92-.26 1.91-.39 2.89-.39.98 0 1.97.13 2.89.39 2.21-1.49 3.18-1.18 3.18-1.18.62 1.58.23 2.75.11 3.04.74.81 1.18 1.84 1.18 3.1 0 4.43-2.7 5.41-5.26 5.69.41.36.78 1.06.78 2.13v3.16c0 .31.21.68.8.56C20.21 21.38 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z"/></svg>'
  };

  /**
   * 解析面包屑
   * 优先级：data-breadcrumb (JSON) > 根据 data-page 自动生成
   */
  function resolveCrumbs() {
    const raw = document.body.getAttribute('data-breadcrumb');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) { /* ignore */ }
    }
    const page = document.body.getAttribute('data-page') || '';
    const label = PAGE_LABEL[page] || page;
    return [{ label }];
  }

  /**
   * 读取当前主题
   */
  function getTheme() {
    return localStorage.getItem('rp_theme') || 'light';
  }

  function setTheme(t) {
    localStorage.setItem('rp_theme', t);
    document.documentElement.setAttribute('data-theme', t === 'dark' ? 'dark' : '');
  }

  /**
   * 渲染面包屑 HTML
   */
  function renderCrumbs(crumbs) {
    return crumbs.map((c, i) => {
      const sep = i < crumbs.length - 1
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><path d="M9 6l6 6-6 6"/></svg>'
        : '';
      const inner = c.to
        ? `<a href="${c.to}" style="color:var(--text-500);text-decoration:none;">${c.label}</a>`
        : (i === crumbs.length - 1 ? `<strong>${c.label}</strong>` : `<span>${c.label}</span>`);
      return `<span>${inner}</span>${sep}`;
    }).join('');
  }

  /**
   * 渲染顶栏
   */
  function mountTopbar() {
    const container = document.getElementById('app-topbar');
    if (!container) return;

    const crumbs = resolveCrumbs();
    const theme = getTheme();
    const showGithubBadge = document.body.getAttribute('data-show-github') !== 'false';

    const githubBadge = showGithubBadge
      ? `<span class="gh-bound" title="GitHub 账号已绑定">
           ${ICONS.github}
           @zhang-jie
         </span>`
      : '';

    const html = `
      <header class="topbar">
        <div class="topbar-crumb">
          ${renderCrumbs(crumbs)}
        </div>
        <div class="topbar-spacer"></div>
        <div class="topbar-search">
          ${ICONS.search}
          <input type="text" placeholder="全局搜索..." id="rp-global-search" autocomplete="off" />
          <kbd style="font:500 10px/1 var(--font-mono);color:var(--text-400);padding:2px 5px;border:1px solid var(--bg-300);border-radius:4px;background:var(--bg-50);">⌘K</kbd>
        </div>
        ${githubBadge}
        <button class="topbar-action" id="rp-theme-toggle" title="主题切换">
          ${theme === 'dark' ? ICONS.sun : ICONS.moon}
        </button>
        <button class="topbar-action" title="通知" style="position:relative;">
          ${ICONS.bell}
          <span style="position:absolute;top:6px;right:6px;width:8px;height:8px;border-radius:999px;background:var(--error);border:2px solid var(--bg-50);"></span>
        </button>
        <button class="topbar-action" title="帮助">${ICONS.help}</button>
        <a href="settings.html" class="topbar-action" title="账号" style="display:grid;place-items:center;">
          <div class="avatar" style="width:28px;height:28px;font-size:11px;">ZJ</div>
        </a>
      </header>
    `;

    container.outerHTML = html;

    // 绑定主题切换
    const themeBtn = document.getElementById('rp-theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const cur = getTheme();
        setTheme(cur === 'dark' ? 'light' : 'dark');
        // 重新渲染顶栏（更新图标）
        mountTopbar();
      });
    }

    // 绑定全局搜索
    const searchInput = document.getElementById('rp-global-search');
    if (searchInput) {
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const q = encodeURIComponent(searchInput.value.trim());
          window.location.href = `projects.html?q=${q}`;
        }
      });
    }
  }

  window.RepoPilotTopbar = {
    mount: mountTopbar,
    setTheme,
    getTheme
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountTopbar);
  } else {
    mountTopbar();
  }
})();