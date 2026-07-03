/* ==========================================================================
 * sidebar.js · RepoPilot 前端 · 全局侧边栏组件
 *
 * 使用方式（每个页面）：
 *   <body data-page="overview">
 *     <div id="app-sidebar"></div>
 *     ...
 *     <script src="./assets/api-mock.js"></script>
 *     <script src="./assets/sidebar.js"></script>
 *
 * 自动行为：
 *   - 渲染用户规定的 6 项导航（顺序固定）
 *   - 根据 data-page 自动高亮当前项
 *   - 从 localStorage 读取登录态，渲染底部用户信息
 *   - 桌面优先，最小宽度 900px
 *
 * 路由约定（与 ApiClient 对齐）：
 *   overview          -> overview.html
 *   projects          -> projects.html
 *   agent             -> agent.html
 *   graph             -> graph.html
 *   notes             -> notes.html
 *   settings          -> settings.html
 *   project-detail    -> project-detail.html?id=xxx
 * ========================================================================== */

(function () {
  'use strict';

  // ---- 图标（与设计系统一致，全部 inline SVG） ----
  const ICONS = {
    overview: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
    projects: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>',
    agent: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a3 3 0 0 1-3 3H8l-5 4V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v9z"/></svg>',
    graph: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="M8 7l8 0M7.5 8L11 16M16.5 8L13 16"/></svg>',
    notes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>'
  };

  // ---- 用户规定的导航顺序 ----
  const NAV_ITEMS = [
    { key: 'overview', label: '总览',   href: 'overview.html' },
    { key: 'projects', label: '项目库', href: 'projects.html', badge: '24' },
    { key: 'agent',    label: 'Agent Chat', href: 'agent.html', badge: 'AI', badgeStyle: 'ai' },
    { key: 'graph',    label: '图谱',   href: 'graph.html' },
    { key: 'notes',    label: '笔记',   href: 'notes.html', badge: '4' },
    { key: 'settings', label: '设置',   href: 'settings.html' }
  ];

  /**
   * 渲染单个 nav-item
   */
  function renderNavItem(item, activeKey, isChild) {
    const isActive = item.key === activeKey;
    const cls = [
      'nav-item',
      isActive ? 'active' : '',
      item.badgeStyle === 'ai' ? 'ai-badge' : ''
    ].filter(Boolean).join(' ');
    const badge = item.badge
      ? `<span class="nav-badge">${item.badge}</span>`
      : '';
    return `
      <a href="${item.href}" class="${cls}" data-nav-key="${item.key}">
        ${ICONS[item.key] || ''}
        <span>${item.label}</span>
        ${badge}
      </a>
    `;
  }

  /**
   * 读取当前登录用户（mock-first，纯前端）
   * 真实接入后端时，ApiClient.me() 已具备此能力。
   */
  function getCurrentUser() {
    // 1) 优先读 localStorage（登录态持久化）
    try {
      const raw = localStorage.getItem('rp_user');
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }

    // 2) 退化：使用 api-mock 中的 MOCK_USER 字段（如果已加载）
    if (window.ApiClient && typeof window.ApiClient.me === 'function') {
      // api-mock 直接同步返回 MOCK_USER
      try {
        return { id: 'usr_zhang_jie', username: 'zhang.jie', github_login: 'zhang-jie', github_bound: true };
      } catch (e) { /* ignore */ }
    }

    // 3) 兜底默认（与设计稿一致）
    return { id: 'usr_zhang_jie', username: 'zhang.jie', github_login: 'zhang-jie', github_bound: true };
  }

  /**
   * 渲染用户底部卡片（带折叠按钮）
   */
  function renderUserFooter(user) {
    const initials = (user.username || 'G').slice(0, 2).toUpperCase();
    return `
      <div class="sidebar-footer">
        <a class="nav-item" href="settings.html" style="padding:8px 10px;">
          <div class="avatar" style="width:28px;height:28px;font-size:11px;">${initials}</div>
          <div style="display:flex;flex-direction:column;line-height:1.2;flex:1;min-width:0;">
            <span style="font-size:12px;font-weight:600;">${user.username}</span>
            <span style="font-size:10px;color:var(--text-400);">Pro · 24 / ∞</span>
          </div>
          <button class="icon-btn" style="width:24px;height:24px;" onclick="event.preventDefault();event.stopPropagation();" aria-label="折叠">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M9 6l6 6-6 6"/></svg>
          </button>
        </a>
      </div>
    `;
  }

  /**
   * 主入口：找到 #app-sidebar 容器，渲染侧边栏
   */
  function mountSidebar() {
    const container = document.getElementById('app-sidebar');
    if (!container) return;

    const page = document.body.getAttribute('data-page') || '';
    const user = getCurrentUser();

    // 项目详情页：projects 也高亮
    const activeKey = page === 'project-detail' ? 'projects' : page;

    const navHtml = NAV_ITEMS.map(item => renderNavItem(item, activeKey)).join('');
    const footerHtml = renderUserFooter(user);

    container.outerHTML = `
      <aside class="sidebar">
        <div class="sidebar-brand">
          <div class="sidebar-logo">RP</div>
          <div style="display:flex;flex-direction:column;line-height:1.2;">
            <span class="sidebar-name">RepoPilot</span>
            <span style="font-size:10px;color:var(--text-400);letter-spacing:0.06em;">v1.0.0</span>
          </div>
        </div>
        ${navHtml}
        ${footerHtml}
      </aside>
    `;
  }

  // 暴露 API
  window.RepoPilotSidebar = {
    mount: mountSidebar,
    NAV_ITEMS,
    ICONS
  };

  // DOM ready 后自动挂载
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountSidebar);
  } else {
    mountSidebar();
  }
})();