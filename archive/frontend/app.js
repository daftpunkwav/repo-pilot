/**
 * app.js — 主逻辑：分类、视图切换、卡片/列表、筛选、CRUD、缩放/字体、进度追踪
 */
const $ = id => document.getElementById(id);
const API = (url, opts = {}) => {
  if (state.authToken) {
    opts.headers = opts.headers || {};
    opts.headers["Authorization"] = `Bearer ${state.authToken}`;
  }
  return fetch(url, opts).then(async r => { const d = await r.json(); if (!r.ok) throw d; return d; });
};

const PROGRESS_OPTIONS = ["none", "learning", "learned", "mastered"];
const PROGRESS_LABELS = { none: "未学习", learning: "正在学习", learned: "已经学习", mastered: "熟练掌握" };
const PROGRESS_ICONS = { none: "fa-regular fa-circle", learning: "fa-solid fa-circle-play", learned: "fa-solid fa-circle-check", mastered: "fa-solid fa-crown" };
const PROGRESS_CLASSES = { none: "prog-none", learning: "prog-learning", learned: "prog-learned", mastered: "prog-mastered" };

const state = {
  settings: { theme: "dark", zoom: 1.0, font_scale: 1.0, view_mode: "list" },
  categories: [],
  projects: [],
  currentCat: "全部",
  keyword: "",
  editingIdx: -1,
  expandedIdx: -1,
  viewMode: "list",
  filters: { langs: [], starMin: 0, starMax: null, sort: "", progress: [] },
  allLanguages: [],
  cardDetailIdx: -1,
  authToken: localStorage.getItem("ghs_token") || "",
  currentUser: null,
};

// ═══ 分类图标映射 ═══
const CAT_ICONS = {
  "全部": "fa-solid fa-border-all",
  "AI / 机器学习": "fa-solid fa-brain",
  "Web 前端": "fa-solid fa-globe",
  "后端 / API": "fa-solid fa-server",
  "DevOps / 工具链": "fa-solid fa-gears",
  "数据科学": "fa-solid fa-chart-bar",
  "安全 / 逆向": "fa-solid fa-shield-halved",
  "游戏开发": "fa-solid fa-gamepad",
  "移动开发": "fa-solid fa-mobile-screen",
  "系统 / 底层": "fa-solid fa-microchip",
  "其他": "fa-solid fa-ellipsis",
};

// ═══ 主题定义 ═══
const THEMES = {
  light:           { name: "默认浅色",   cat: "light", colors: ["#f3f3f7", "#ffffff", "#3b6cf4", "#1a1a26"] },
  "light-warm":    { name: "暖白",       cat: "light", colors: ["#faf6f0", "#ffffff", "#c7763e", "#2d2418"] },
  "light-cool":    { name: "冷白",       cat: "light", colors: ["#f3f5f9", "#ffffff", "#4a6cf7", "#1a1e2b"] },
  dark:            { name: "午夜",       cat: "dark",  colors: ["#09090d", "#16161f", "#6b8cff", "#e2e2ee"] },
  "dark-moon":     { name: "月夜",       cat: "dark",  colors: ["#0f0c1a", "#1a1730", "#9b7ef8", "#e4e0f0"] },
  "dark-graphite": { name: "石墨",       cat: "dark",  colors: ["#1a1a1e", "#28282e", "#7e8ea0", "#e4e4e8"] },
  "hc-light":      { name: "高对比浅色", cat: "hc",    colors: ["#ffffff", "#ffffff", "#0000ee", "#000000"] },
  "hc-dark":       { name: "高对比深色", cat: "hc",    colors: ["#000000", "#000000", "#55aaff", "#ffffff"] },
};

// ═══ 初始化 ═══
async function init() {
  await checkAuth();
  await loadSettings();
  await loadCategories();
  await loadProjects();
  bindEvents();
  bindSearch();
  bindViewToggle();
  bindFilter();
  bindProgressFilter();
  bindLogout();
  bindSidebarResize();
}
init();

// ═══ 侧边栏拖拽调整宽度 ═══
const SIDEBAR_WIDTH_KEY = "ghs_sidebar_width";

function bindSidebarResize() {
  const handle = $("sidebarResizeHandle");
  const sidebar = document.querySelector(".sidebar");
  if (!handle || !sidebar) return;

  // 恢复保存的宽度
  const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
  if (saved) {
    const w = parseInt(saved, 10);
    if (w >= 180 && w <= 480) {
      document.documentElement.style.setProperty("--sidebar-width", w + "px");
    }
  }

  let startX = 0;
  let startWidth = 0;

  handle.addEventListener("mousedown", e => {
    e.preventDefault();
    startX = e.clientX;
    startWidth = sidebar.getBoundingClientRect().width;
    handle.classList.add("active");
    document.body.classList.add("resizing-sidebar");

    const onMove = ev => {
      const delta = ev.clientX - startX;
      let newWidth = startWidth + delta;
      newWidth = Math.max(180, Math.min(480, newWidth));
      document.documentElement.style.setProperty("--sidebar-width", newWidth + "px");
    };

    const onUp = () => {
      handle.classList.remove("active");
      document.body.classList.remove("resizing-sidebar");
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      const finalWidth = sidebar.getBoundingClientRect().width;
      localStorage.setItem(SIDEBAR_WIDTH_KEY, Math.round(finalWidth));
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });
}
async function checkAuth() {
  // 先尝试 session token
  if (state.authToken) {
    try {
      const u = await API("/api/user");
      state.currentUser = u;
      $("authOverlay").classList.add("hidden");
      $("userNameDisplay").textContent = u.username;
      updateGhBoundAccounts();
      return;
    } catch (e) {
      // 仅 401 鉴权失败时清除 token，网络错误保留重试
      if (e.error === "未登录") {
        state.authToken = "";
        localStorage.removeItem("ghs_token");
        state.currentUser = null;
      }
    }
  }
  // 再尝试持久化 token
  const persistent = localStorage.getItem("ghs_persistent_token");
  if (persistent) {
    try {
      const u = await fetch("/api/user", {
        headers: { "Authorization": "Bearer " + persistent },
      }).then(async r => { const d = await r.json(); if (!r.ok) throw d; return d; });
      state.authToken = persistent;
      state.currentUser = u;
      localStorage.setItem("ghs_token", persistent);
      $("authOverlay").classList.add("hidden");
      $("userNameDisplay").textContent = u.username;
      updateGhBoundAccounts();
      return;
    } catch (e) {
      // 仅 401 鉴权失败时清除持久化 token
      if (e.error === "未登录") {
        localStorage.removeItem("ghs_persistent_token");
      }
    }
  }
  $("authOverlay").classList.remove("hidden");
}

function onLoginSuccess(token, user) {
  state.authToken = token;
  state.currentUser = user;
  localStorage.setItem("ghs_token", token);
  $("authOverlay").classList.add("hidden");
  $("userNameDisplay").textContent = user.username;
  updateGhBoundAccounts();
  loadCategories();
  loadProjects();
}

function bindLogout() {
  $("btnLogout").addEventListener("click", async () => {
    try { await API("/api/logout", { method: "POST" }); } catch (e) {}
    state.authToken = "";
    state.currentUser = null;
    localStorage.removeItem("ghs_token");
    localStorage.removeItem("ghs_persistent_token");
    localStorage.removeItem("ghs_remembered_creds");
    $("authOverlay").classList.remove("hidden");
    $("userNameDisplay").textContent = "";
    $("ghBoundAccounts").classList.add("hidden");
  });
}

function updateGhBoundAccounts() {
  if (!state.currentUser || !state.currentUser.github_accounts || !state.currentUser.github_accounts.length) {
    $("ghBoundAccounts").classList.add("hidden");
    return;
  }
  $("ghBoundAccounts").classList.remove("hidden");
  $("ghBoundList").innerHTML = state.currentUser.github_accounts.map((a, i) =>
    `<span class="gh-bound-chip" data-github-id="${esc(a.github_id)}">
      <i class="fa-brands fa-github"></i> ${esc(a.github_id)}
      ${i === 0 ? '<span class="chip-default">默认</span>' : ''}
    </span>`
  ).join("");
  $("ghBoundList").querySelectorAll(".gh-bound-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      $("ghUsername").value = chip.dataset.githubId;
    });
  });
}

// ═══ 设置 ═══
async function loadSettings() {
  state.settings = await API("/api/settings");
  state.viewMode = state.settings.view_mode || "list";
  applySettings();
  applyViewToggle();
}

function applySettings() {
  const { theme, zoom, font_scale } = state.settings;
  document.documentElement.setAttribute("data-theme", theme);
  document.querySelector(".main-zoom").style.zoom = zoom;
  document.documentElement.style.fontSize = (16 * font_scale) + "px";

  const rz = $("rZoom"), rf = $("rFont");
  if (rz) { rz.value = zoom; $("vZoom").textContent = Math.round(zoom * 100) + "%"; }
  if (rf) { rf.value = font_scale; $("vFont").textContent = Math.round(font_scale * 100) + "%"; }

  // 更新主题选择器 active 状态
  document.querySelectorAll(".theme-swatch").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.theme === theme);
  });

  // 防止 zoom 反复设置导致布局漂移：延迟一帧强制重排 sidebar-footer
  requestAnimationFrame(() => {
    const footer = document.querySelector(".sidebar-footer");
    if (footer) {
      footer.style.display = "flex";
      footer.style.visibility = "visible";
    }
  });
}

function renderThemeSwatches() {
  const currentTheme = state.settings.theme;
  const containers = {
    light: $("themeSwatchesLight"),
    dark: $("themeSwatchesDark"),
    hc: $("themeSwatchesHC"),
  };
  Object.values(containers).forEach(c => { if (c) c.innerHTML = ""; });

  for (const [key, t] of Object.entries(THEMES)) {
    const container = containers[t.cat];
    if (!container) continue;
    const isActive = key === currentTheme;
    const swatch = document.createElement("button");
    swatch.className = "theme-swatch" + (isActive ? " active" : "");
    swatch.dataset.theme = key;
    swatch.innerHTML = `<span>${t.name}</span>
      <span class="theme-swatch-dots">
        ${t.colors.map(c => `<span class="theme-swatch-dot" style="background:${c}"></span>`).join("")}
      </span>`;
    swatch.addEventListener("click", () => setTheme(key));
    container.appendChild(swatch);
  }
}

// ═══ 视图切换 ═══
function bindViewToggle() {
  $("viewToggle").addEventListener("click", e => {
    const btn = e.target.closest(".view-option");
    if (!btn) return;
    state.viewMode = btn.dataset.view;
    applyViewToggle();
    persistViewMode();
    renderProjects();
  });
}

function applyViewToggle() {
  const opts = $("viewToggle").querySelectorAll(".view-option");
  opts.forEach(o => o.classList.toggle("active", o.dataset.view === state.viewMode));
  const listArea = $("projectListArea");
  listArea.classList.toggle("card-mode", state.viewMode === "card");
  listArea.classList.toggle("list-mode", state.viewMode === "list");
}

async function persistViewMode() {
  state.settings.view_mode = state.viewMode;
  await API("/api/settings", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(state.settings) });
}

// ═══ 筛选 ═══
function bindFilter() {
  $("btnFilter").addEventListener("click", e => {
    e.stopPropagation();
    $("filterPanel").classList.toggle("hidden");
    if (!$("filterPanel").classList.contains("hidden")) {
      renderFilterLanguages();
    }
  });

  $("btnFilterApply").addEventListener("click", () => {
    applyFilters();
    $("filterPanel").classList.add("hidden");
  });

  $("btnFilterReset").addEventListener("click", () => {
    state.filters = { langs: [], starMin: 0, starMax: null, sort: "", progress: [] };
    $("filterStarMin").value = "";
    $("filterStarMax").value = "";
    $("filterSort").value = "";
    renderFilterLanguages();
    renderProgressFilter();
    updateFilterBadge();
    applyFilters();
    $("filterPanel").classList.add("hidden");
  });

  // 点击外部关闭
  document.addEventListener("click", e => {
    if (!$("filterWrap").contains(e.target)) {
      $("filterPanel").classList.add("hidden");
    }
  });

  $("filterPanel").addEventListener("click", e => e.stopPropagation());
}

function renderFilterLanguages() {
  const container = $("filterLanguages");
  container.innerHTML = state.allLanguages.map(l =>
    `<label class="checkbox-label">
      <input type="checkbox" value="${esc(l.name)}" ${state.filters.langs.includes(l.name) ? "checked" : ""}>
      <span>${esc(l.name)}</span>
      <span class="lang-count">${l.count}</span>
    </label>`
  ).join("");
}

function bindProgressFilter() {
  renderProgressFilter();
}

function renderProgressFilter() {
  const container = $("filterProgress");
  if (!container) return;
  container.innerHTML = PROGRESS_OPTIONS.map(p =>
    `<label class="checkbox-label">
      <input type="checkbox" value="${p}" ${state.filters.progress.includes(p) ? "checked" : ""}>
      <i class="${PROGRESS_ICONS[p]} progress-check-icon ${PROGRESS_CLASSES[p]}"></i>
      <span>${PROGRESS_LABELS[p]}</span>
    </label>`
  ).join("");
}

function applyFilters() {
  const checks = $("filterLanguages").querySelectorAll("input:checked");
  state.filters.langs = Array.from(checks).map(c => c.value);
  state.filters.starMin = parseInt($("filterStarMin").value) || 0;
  state.filters.starMax = parseInt($("filterStarMax").value) || null;
  state.filters.sort = $("filterSort").value;
  const progChecks = $("filterProgress").querySelectorAll("input:checked");
  state.filters.progress = Array.from(progChecks).map(c => c.value);
  updateFilterBadge();
  state.expandedIdx = -1;
  loadProjects();
}

function updateFilterBadge() {
  const badge = $("filterBadge");
  const btn = $("btnFilter");
  let count = state.filters.langs.length + state.filters.progress.length;
  if (state.filters.starMin > 0 || state.filters.starMax !== null) count++;
  if (state.filters.sort) count++;
  badge.textContent = count;
  badge.classList.toggle("hidden", count === 0);
  btn.classList.toggle("has-filters", count > 0);
}

// ═══ 分类 ═══
let catCounts = {};

async function loadCategories() {
  state.categories = await API("/api/categories");
  await loadStats();
}

async function loadStats() {
  const stats = await API("/api/stats");
  catCounts = stats.categories || {};
  // 构建语言列表（含计数）
  const langMap = stats.languages || {};
  state.allLanguages = Object.keys(langMap)
    .filter(l => l)
    .map(l => ({ name: l, count: langMap[l] }))
    .sort((a, b) => b.count - a.count);
  renderCategoryNav();
}

function catIcon(name) { return CAT_ICONS[name] || "fa-solid fa-folder"; }

function renderCategoryNav() {
  const nav = $("catNav");
  nav.innerHTML = "";

  const cats = ["全部", ...state.categories];
  const total = Object.values(catCounts).reduce((a, b) => a + b, 0);

  cats.forEach(cat => {
    const btn = document.createElement("button");
    btn.className = "cat-btn" + (state.currentCat === cat ? " active" : "");
    btn.dataset.cat = cat;
    const n = cat === "全部" ? total : (catCounts[cat] || 0);
    btn.innerHTML = `<i class="${catIcon(cat)} cat-icon"></i> ${esc(cat)}`;
    btn.innerHTML += `<span class="cat-count">${n}</span>`;
    btn.addEventListener("click", () => selectCategory(cat));
    nav.appendChild(btn);
  });

  // 保护：确保 sidebar-footer 始终可见
  const footer = document.querySelector(".sidebar-footer");
  if (footer) {
    footer.style.display = "flex";
    footer.style.visibility = "visible";
  }
}

function selectCategory(cat) {
  state.currentCat = cat;
  state.expandedIdx = -1;
  renderCategoryNav();
  loadProjects();
}

// ═══ 项目列表 ═══
async function loadProjects() {
  const params = new URLSearchParams({ category: state.currentCat });
  if (state.keyword) params.set("keyword", state.keyword);
  if (state.filters.sort) params.set("sort", state.filters.sort);
  if (state.filters.starMin > 0) params.set("star_min", state.filters.starMin);
  if (state.filters.starMax !== null) params.set("star_max", state.filters.starMax);
  if (state.filters.progress.length > 0) params.set("progress", state.filters.progress.join(","));
  state.projects = await API(`/api/projects?${params}`);
  // 前端过滤多语言
  if (state.filters.langs.length > 0) {
    state.projects = state.projects.filter(p =>
      state.filters.langs.some(l => (p.language || "").toLowerCase() === l.toLowerCase())
    );
  }
  renderProjects();
  loadStats();
}

function renderProjects() {
  const list = $("projectList"), empty = $("emptyState");
  const title = $("categoryTitle"), badge = $("projectCount");

  title.textContent = state.currentCat === "全部" ? "全部项目" : state.currentCat;
  badge.textContent = state.projects.length;

  if (state.projects.length === 0) {
    list.style.display = "none"; empty.classList.remove("hidden");
  } else {
    empty.classList.add("hidden"); list.style.display = "";
    if (state.viewMode === "list") {
      list.innerHTML = state.projects.map((p, i) => cardHTML(p, i)).join("");
      // 展开事件
      list.querySelectorAll(".card-header").forEach(h => {
        h.addEventListener("click", e => {
          if (e.target.closest("[data-action]")) return;
          const card = h.closest(".project-card");
          const idx = parseInt(card.dataset.index);
          toggleExpand(idx);
          e.stopPropagation();
        });
      });
      list.querySelectorAll(".card-name").forEach(a => {
        a.addEventListener("click", e => e.stopPropagation());
      });
    } else {
      list.innerHTML = state.projects.map((p, i) => cardGridHTML(p, i)).join("");
      list.querySelectorAll(".grid-card").forEach(card => {
        card.addEventListener("click", e => {
          if (e.target.closest("[data-action]")) return;
          const idx = parseInt(card.dataset.index);
          openCardDetail(idx);
        });
      });
    }
  }
}

// ═══ 列表模式 HTML ═══
function cardHTML(p, idx) {
  const expanded = state.expandedIdx === idx;
  const desc = p.description || "";
  const tags = (p.tags || []).filter(Boolean);
  const progress = p.progress || "none";

  return `
    <div class="project-card${expanded ? " expanded" : ""}" data-index="${idx}">
      <div class="card-header">
        <i class="fa-solid fa-chevron-right expand-arrow"></i>
        <a class="card-name" href="${esc(p.url)}" target="_blank" title="${esc(p.name)}">${esc(p.name)}</a>
        <span class="progress-badge ${PROGRESS_CLASSES[progress]}" data-action="progress" data-idx="${idx}" data-progress="${progress}" title="点击切换学习进度">
          <i class="${PROGRESS_ICONS[progress]}"></i> ${PROGRESS_LABELS[progress]}
        </span>
        ${desc ? `<span class="card-desc-inline">${esc(desc)}</span>` : ""}
        <div class="card-meta">
          ${p.language ? `<span class="card-lang">${esc(p.language)}</span>` : ""}
          ${p.stars ? `<span class="card-stars"><i class="fa-solid fa-star"></i>${fmtNum(p.stars)}</span>` : ""}
        </div>
      </div>
      <div class="card-body">
        ${desc ? `<div class="detail-desc">${esc(desc)}</div>` : ""}
        <div class="detail-extra">
          <span><i class="fa-solid fa-tag"></i> ${esc(p.category)}</span>
          ${p.note ? `<span><i class="fa-solid fa-note-sticky"></i> ${esc(p.note)}</span>` : ""}
          ${p.url ? `<span><i class="fa-solid fa-link"></i> ${esc(new URL(p.url).hostname)}</span>` : ""}
        </div>
        ${tags.length ? `<div class="detail-tags">${tags.map(t => `<span class="tag">${esc(t)}</span>`).join("")}</div>` : ""}
        <div class="card-actions">
          <button class="btn btn-outline btn-sm" data-action="edit" data-idx="${idx}"><i class="fa-solid fa-pen"></i> 编辑</button>
          <button class="btn btn-outline btn-sm btn-danger-ghost" data-action="delete" data-idx="${idx}"><i class="fa-solid fa-trash"></i> 删除</button>
        </div>
      </div>
    </div>`;
}

// ═══ 卡片模式 HTML ═══
function cardGridHTML(p, idx) {
  const desc = p.description || "";
  const tags = (p.tags || []).filter(Boolean);
  const catLabel = p.category || "";
  const progress = p.progress || "none";

  return `
    <div class="grid-card" data-index="${idx}">
      <div class="grid-card-inner">
        <div class="grid-card-header">
          <i class="fa-brands fa-github grid-card-icon"></i>
          <span class="grid-card-name" title="${esc(p.name)}">${esc(p.name)}</span>
        </div>
        <span class="progress-badge progress-badge-sm ${PROGRESS_CLASSES[progress]}" data-action="progress" data-idx="${idx}" data-progress="${progress}" title="点击切换学习进度">
          <i class="${PROGRESS_ICONS[progress]}"></i> ${PROGRESS_LABELS[progress]}
        </span>
        ${desc ? `<div class="grid-card-desc">${esc(desc)}</div>` : `<div class="grid-card-desc placeholder">暂无描述</div>`}
        <div class="grid-card-meta">
          ${p.language ? `<span class="card-lang">${esc(p.language)}</span>` : ""}
          ${p.stars ? `<span class="card-stars"><i class="fa-solid fa-star"></i>${fmtNum(p.stars)}</span>` : ""}
        </div>
        <div class="grid-card-footer">
          ${catLabel ? `<span class="grid-card-cat"><i class="fa-solid fa-tag"></i> ${esc(catLabel)}</span>` : ""}
          ${tags.length ? `<span class="grid-card-tags">${tags.slice(0, 2).map(t => `<span class="tag">${esc(t)}</span>`).join("")}${tags.length > 2 ? `<span class="tag">+${tags.length - 2}</span>` : ""}</span>` : ""}
        </div>
      </div>
    </div>`;
}

// ═══ 卡片详情弹窗 ═══
function openCardDetail(idx) {
  state.cardDetailIdx = idx;
  const p = state.projects[idx];
  $("cardDetailTitle").textContent = p.name;
  const tags = (p.tags || []).filter(Boolean);
  const hostname = p.url ? (() => { try { return new URL(p.url).hostname; } catch { return p.url; } })() : "";

  $("cardDetailBody").innerHTML = `
    <div class="detail-section">
      <div class="detail-row">
        <span class="detail-label"><i class="fa-solid fa-align-left"></i> 描述</span>
        <span class="detail-value">${p.description ? esc(p.description) : '<span class="text-muted">暂无</span>'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label"><i class="fa-solid fa-link"></i> URL</span>
        <span class="detail-value">${p.url ? `<a href="${esc(p.url)}" target="_blank">${esc(hostname)}</a>` : '<span class="text-muted">暂无</span>'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label"><i class="fa-solid fa-tag"></i> 分类</span>
        <span class="detail-value">${esc(p.category)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label"><i class="fa-solid fa-hashtag"></i> 标签</span>
        <span class="detail-value">${tags.length ? tags.map(t => `<span class="tag">${esc(t)}</span>`).join(" ") : '<span class="text-muted">暂无</span>'}</span>
      </div>
      ${p.note ? `<div class="detail-row">
        <span class="detail-label"><i class="fa-solid fa-note-sticky"></i> 备注</span>
        <span class="detail-value">${esc(p.note)}</span>
      </div>` : ""}
      <div class="detail-row">
        <span class="detail-label"><i class="fa-solid fa-star"></i> Star 数</span>
        <span class="detail-value">${fmtNum(p.stars)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label"><i class="fa-solid fa-code"></i> 语言</span>
        <span class="detail-value">${p.language ? esc(p.language) : '<span class="text-muted">暂无</span>'}</span>
      </div>
    </div>
  `;

  showModal("modalCardDetail");
}

// ═══ 列表模式展开 ═══
function toggleExpand(idx) {
  state.expandedIdx = state.expandedIdx === idx ? -1 : idx;
  renderProjects();
}

function fmtNum(n) {
  if (n >= 10000) return (n / 1000).toFixed(1) + "k";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

async function cycleProgress(idx, el) {
  const current = el.dataset.progress;
  const nextIdx = (PROGRESS_OPTIONS.indexOf(current) + 1) % PROGRESS_OPTIONS.length;
  const next = PROGRESS_OPTIONS[nextIdx];
  try {
    const res = await API(`/api/projects/${idx}/progress`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ progress: next }),
    });
    state.projects[idx].progress = next;
    el.dataset.progress = next;
    el.innerHTML = `<i class="${PROGRESS_ICONS[next]}"></i> ${PROGRESS_LABELS[next]}`;
    el.className = el.className.replace(/prog-\w+/g, PROGRESS_CLASSES[next]);
  } catch (e) {}
}

// ═══ CRUD ═══

function openAddModal() {
  state.editingIdx = -1;
  $("modalTitle").textContent = "添加项目";
  ["fName","fUrl","fDesc","fTags","fLanguage","fNote"].forEach(id => $(id).value = "");
  $("fStars").value = "0";
  renderCategorySelect();
  $("fCategory").value = state.currentCat !== "全部" ? state.currentCat : "其他";
  $("modalError").classList.add("hidden");
  showModal("modalProject");
}

function editProject(idx) {
  const p = state.projects[idx];
  state.editingIdx = idx;
  $("modalTitle").textContent = "编辑项目";
  $("fName").value = p.name;
  $("fUrl").value = p.url;
  $("fDesc").value = p.description;
  $("fTags").value = (p.tags || []).join(", ");
  $("fStars").value = p.stars || 0;
  $("fLanguage").value = p.language || "";
  $("fNote").value = p.note || "";
  renderCategorySelect();
  $("fCategory").value = p.category;
  $("modalError").classList.add("hidden");
  showModal("modalProject");
}

async function saveProject() {
  const name = $("fName").value.trim();
  if (!name) { $("modalError").textContent = "名称不能为空"; $("modalError").classList.remove("hidden"); return; }

  const payload = {
    name,
    url: $("fUrl").value.trim(),
    description: $("fDesc").value.trim(),
    category: $("fCategory").value,
    tags: $("fTags").value.split(",").map(t => t.trim()).filter(Boolean),
    stars: parseInt($("fStars").value) || 0,
    language: $("fLanguage").value.trim(),
    note: $("fNote").value.trim(),
  };

  try {
    if (state.editingIdx >= 0) {
      await API(`/api/projects/update/${state.editingIdx}`, { method: "PUT", headers: {"Content-Type":"application/json"}, body: JSON.stringify(payload) });
    } else {
      await API("/api/projects/add", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(payload) });
    }
    hideModal("modalProject");
    await loadProjects();
  } catch (e) {
    $("modalError").textContent = e.error || "操作失败";
    $("modalError").classList.remove("hidden");
  }
}

async function deleteProject(idx) {
  const p = state.projects[idx];
  if (!confirm(`确认删除 "${p.name}"？`)) return;
  await API(`/api/projects/delete/${idx}`, { method: "DELETE" });
  if (state.expandedIdx === idx) state.expandedIdx = -1;
  await loadProjects();
}

function renderCategorySelect() {
  $("fCategory").innerHTML = state.categories.map(c =>
    `<option value="${esc(c)}">${esc(c)}</option>`
  ).join("");
}

// ═══ 搜索 ═══

function bindSearch() {
  const inp = $("searchInput"), clr = $("clearSearch");
  inp.addEventListener("input", () => {
    state.keyword = inp.value.trim();
    clr.classList.toggle("visible", state.keyword.length > 0);
    state.expandedIdx = -1;
    loadProjects();
  });
  clr.addEventListener("click", () => { inp.value = ""; inp.dispatchEvent(new Event("input")); inp.focus(); });
}

// ═══ 全局事件 ═══

function bindEvents() {
  // 图谱（关闭按钮在 openGraph 内绑定）
  $("btnGraph").addEventListener("click", openGraph);
  // 添加
  $("btnAdd").addEventListener("click", openAddModal);
  $("btnSave").addEventListener("click", saveProject);

  // 关闭弹窗
  document.querySelectorAll(".modal-close, [data-close]").forEach(el => {
    el.addEventListener("click", () => hideModal(el.dataset.close));
  });
  document.querySelectorAll(".modal-overlay").forEach(ov => {
    ov.addEventListener("click", e => { if (e.target === ov) ov.classList.add("hidden"); });
  });

  // 项目列表内的编辑/删除/进度切换（事件代理）
  $("projectListArea").addEventListener("click", e => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    e.stopPropagation();
    const idx = parseInt(btn.dataset.idx);
    if (btn.dataset.action === "edit") editProject(idx);
    if (btn.dataset.action === "delete") deleteProject(idx);
    if (btn.dataset.action === "progress") cycleProgress(idx, btn);
  });

  // 卡片详情弹窗 - 编辑/删除
  $("btnCardEdit").addEventListener("click", () => {
    hideModal("modalCardDetail");
    editProject(state.cardDetailIdx);
  });
  $("btnCardDelete").addEventListener("click", async () => {
    await deleteProject(state.cardDetailIdx);
    hideModal("modalCardDetail");
  });

  // 设置
  $("btnSettings").addEventListener("click", () => { applySettings(); renderThemeSwatches(); showModal("modalSettings"); });
  $("btnManageCats").addEventListener("click", async () => { await renderCatManageList(); showModal("modalCategories"); });
  $("btnAddCat").addEventListener("click", addCategory);
  $("newCatName").addEventListener("keydown", e => { if (e.key === "Enter") addCategory(); });
  $("btnGitHub").addEventListener("click", () => showModal("modalGitHub"));
}

// ═══ 工具函数 ═══

function showModal(id) { $(id).classList.remove("hidden"); }
function hideModal(id) { $(id).classList.add("hidden"); }

function esc(s) {
  if (typeof s !== "string") return s;
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ═══ 设置面板 ──

document.addEventListener("DOMContentLoaded", () => {
  $("rZoom").addEventListener("input", e => { $("vZoom").textContent = Math.round(parseFloat(e.target.value) * 100) + "%"; });
  $("rZoom").addEventListener("change", () => saveZoomFont());
  $("rFont").addEventListener("input", e => { $("vFont").textContent = Math.round(parseFloat(e.target.value) * 100) + "%"; });
  $("rFont").addEventListener("change", () => saveZoomFont());
  $("btnExport").addEventListener("click", exportData);
  $("btnImportTrigger").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", importData);
  $("btnClearAll").addEventListener("click", clearAllData);
});

async function setTheme(theme) {
  state.settings.theme = theme;
  await API("/api/settings", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(state.settings) });
  applySettings();
}

async function saveZoomFont() {
  state.settings.zoom = parseFloat($("rZoom").value);
  state.settings.font_scale = parseFloat($("rFont").value);
  await API("/api/settings", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(state.settings) });
  applySettings();
}

async function exportData() {
  const data = await API("/api/projects?category=全部");
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `github_stash_${new Date().toISOString().slice(0,10)}.json`;
  a.click(); URL.revokeObjectURL(url);
}

async function importData() {
  const file = $("importFile").files[0];
  if (!file) return;
  try {
    const items = JSON.parse(await file.text());
    if (!Array.isArray(items)) throw new Error("格式错误");
    const res = await API("/api/projects/import", {
      method: "POST", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ items: items.map(it => ({ name: it.name||"", url: it.url||"", description: it.description||"", category: it.category||"其他", tags: it.tags||[], stars: it.stars||0, language: it.language||"", note: it.note||"" })) }),
    });
    alert(`导入 ${res.added} 个项目`);
    $("importFile").value = "";
    await loadCategories(); await loadProjects();
  } catch (e) { alert("导入失败: " + (e.message || e.error || "未知错误")); }
}

async function clearAllData() {
  if (!confirm("确认清空全部数据？不可恢复！")) return;
  const all = await API("/api/projects?category=全部");
  for (const p of all) await API(`/api/projects/delete/${p.index}`, { method: "DELETE" });
  await loadCategories(); await loadProjects();
  hideModal("modalSettings");
}

// ═══ 分类管理 ──

const PRESET_CATS = ["AI / 机器学习","Web 前端","后端 / API","DevOps / 工具链","数据科学","安全 / 逆向","游戏开发","移动开发","系统 / 底层","其他"];

async function renderCatManageList() {
  const cats = await API("/api/categories");
  $("catList").innerHTML = cats.map(c => `
    <div class="cat-manage-item">
      <i class="${catIcon(c)}" style="opacity:0.5;margin-right:8px;width:16px;"></i>
      <span style="flex:1">${esc(c)}</span>
      ${PRESET_CATS.includes(c) ? `<span class="preset-tag">预设</span>` : `<button class="del-cat-btn" data-cat="${esc(c)}"><i class="fa-solid fa-trash"></i></button>`}
    </div>
  `).join("");

  $("catList").querySelectorAll(".del-cat-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const cat = btn.dataset.cat;
      if (!confirm(`删除分类「${cat}」？项目将移至「其他」。`)) return;
      await API("/api/categories/remove", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({name:cat}) });
      await loadCategories(); await loadProjects(); await renderCatManageList();
    });
  });
}

async function addCategory() {
  const name = $("newCatName").value.trim();
  if (!name) return;
  try {
    await API("/api/categories/add", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({name}) });
    $("newCatName").value = "";
    await loadCategories(); await renderCatManageList();
  } catch (e) { alert(e.error || "添加失败"); }
}

// ═══ 图谱（重新设计：D3 力导向图，直接渲染） ═══

let _graphState = null;
const GRAPH_COLORS = [
  "#58a6ff", "#f78166", "#7ee787", "#d2a8ff",
  "#ffa657", "#79c0ff", "#a5d6ff", "#56d364",
  "#f778ba", "#e3b341", "#ff7b72", "#7ee787"
];

let _graphGen = 0;

function openGraph() {
  const overlay = $("graphOverlay");
  const body = $("graphBody");
  if (!overlay || !body) return;
  if (!overlay.classList.contains("hidden")) return; // 防止重复打开

  // 递增代数——用于检测过期的异步回调
  const gen = ++_graphGen;

  // 重置内容
  body.innerHTML = `
    <div class="graph-loading" id="graphLoading">
      <div class="graph-spinner"></div>
      <p>正在加载…</p>
    </div>
    <div class="graph-tooltip" id="graphTooltip"></div>
    <div class="graph-zoom-indicator" id="graphZoomIndicator"></div>
  `;
  const legend = $("graphLegend");
  if (legend) legend.innerHTML = "";
  const stats = $("graphStats");
  if (stats) stats.textContent = "";

  overlay.classList.remove("hidden");

  // 绑定关闭按钮
  const closeBtn = $("graphBtnClose");
  if (closeBtn) closeBtn.onclick = closeGraph;

  // Escape 关闭（存储引用以便 closeGraph 清理）
  const escHandler = (e) => {
    if (e.key === "Escape" && !overlay.classList.contains("hidden")) {
      closeGraph();
    }
  };
  document.addEventListener("keydown", escHandler);
  _graphState = { escHandler };

  // 懒加载 D3 后渲染
  loadD3().then(() => {
    return fetch("/graph-api", {
      headers: { "Authorization": "Bearer " + (state.authToken || "") }
    }).then(r => {
      if (!r.ok) throw new Error("请求失败 (" + r.status + ")");
      return r.json();
    });
  }).then(data => {
    if (gen !== _graphGen) return; // 已关闭或重新打开，丢弃过期回调
    const loading = $("graphLoading");
    if (loading) loading.classList.add("hidden");
    if (!data || !data.nodes || data.nodes.length === 0) {
      body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-size:0.9rem">暂无项目数据，添加项目后即可查看图谱</div>';
      return;
    }
    renderGraph(data);
  }).catch(err => {
    if (gen !== _graphGen) return;
    const loading = $("graphLoading");
    let msg = err.message || "加载失败";
    if (msg.includes("401") || msg.includes("登录")) {
      msg = "请先登录后再查看图谱";
    }
    if (loading) {
      loading.innerHTML = '<p style="color:var(--text-muted)">' + msg + '</p>';
    }
  });
}

function closeGraph() {
  const overlay = $("graphOverlay");
  if (!overlay) return;
  overlay.classList.add("hidden");
  if (_graphState) {
    if (_graphState.simulation) _graphState.simulation.stop();
    if (_graphState.escHandler) document.removeEventListener("keydown", _graphState.escHandler);
    if (_graphState.docClickHandler) document.removeEventListener("click", _graphState.docClickHandler);
    _graphState = null;
  }
  const body = $("graphBody");
  if (body) body.innerHTML = "";
  const legend = $("graphLegend");
  if (legend) legend.innerHTML = "";
}

function loadD3() {
  if (typeof d3 !== "undefined") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://d3js.org/d3.v7.min.js";
    s.onload = resolve;
    s.onerror = () => reject(new Error("D3.js 加载失败，请检查网络连接"));
    document.head.appendChild(s);
  });
}

function renderGraph(data) {
  const body = $("graphBody");
  const tooltipEl = $("graphTooltip");
  const legendEl = $("graphLegend");
  const zoomIndicator = $("graphZoomIndicator");
  const statsEl = $("graphStats");
  if (!body) return;

  let showLabels = true;
  let labels = null;
  let nodeG = null;
  let link = null;

  const { nodes, edges } = data;
  const nodesData = nodes.map(n => Object.assign({}, n));
  const edgesData = edges.map(e => Object.assign({}, e));

  if (statsEl) statsEl.textContent = nodesData.length + " 节点 · " + edgesData.length + " 连线";

  const width = body.clientWidth || 800;
  const height = body.clientHeight || 600;
  const colorScale = d3.scaleOrdinal(GRAPH_COLORS).domain([...new Set(nodesData.map(n => n.category))]);

  // ── SVG ──
  const svg = d3.select(body).append("svg")
    .attr("width", width)
    .attr("height", height);

  // 背景点击取消高亮
  svg.on("click", () => {
    if (!_graphState) return;
    const { nodeG, link } = _graphState;
    nodeG.selectAll("circle").transition().duration(250).attr("opacity", 1);
    nodeG.selectAll("text").transition().duration(250).attr("opacity", _graphState.showLabels ? 1 : 0);
    link.transition().duration(250).attr("stroke-opacity", 0.3).attr("stroke", "var(--text-muted)");
    if (tooltipEl) tooltipEl.classList.remove("visible");
  });

  const g = svg.append("g");

  // ── 缩放 ──
  let zoomTimeout;
  const zoomBehavior = d3.zoom()
    .scaleExtent([0.1, 8])
    .on("zoom", (event) => {
      g.attr("transform", event.transform);
      if (zoomIndicator) {
        zoomIndicator.textContent = Math.round(event.transform.k * 100) + "%";
        zoomIndicator.style.opacity = "1";
        clearTimeout(zoomTimeout);
        zoomTimeout = setTimeout(() => { if (zoomIndicator) zoomIndicator.style.opacity = "0"; }, 1500);
      }
      updateLabels(event.transform.k);
    });
  svg.call(zoomBehavior);
  svg.call(zoomBehavior.transform, d3.zoomIdentity.translate(width / 2, height / 2));

  // ── 连线 ──
  link = g.append("g")
    .selectAll("line")
    .data(edgesData)
    .join("line")
    .attr("class", "link")
    .attr("stroke-width", d => Math.max(0.5, Math.min(4, d.weight * 5)));

  // ── 节点半径 ──
  const maxStars = d3.max(nodesData, d => d.stars) || 100;
  const rScale = d3.scaleSqrt().domain([0, maxStars + 1]).range([5, 40]);

  // ── 节点 ──
  nodeG = g.append("g")
    .selectAll("g")
    .data(nodesData)
    .join("g")
    .attr("class", "node-group")
    .call(d3.drag()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
      })
      .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y; })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null; d.fy = null;
      })
    );

  nodeG.append("circle")
    .attr("class", "node-circle")
    .attr("r", d => rScale(d.stars))
    .attr("fill", d => colorScale(d.category))
    .attr("stroke", "var(--bg-secondary)")
    .attr("stroke-width", 2)
    .on("mouseenter", function(event, d) { highlightNode(d, true, this); showTooltip(event, d); })
    .on("mousemove", function(event) { moveTooltip(event); })
    .on("mouseleave", function(event, d) { highlightNode(d, false, this); hideTooltip(); })
    .on("click", function(event, d) {
      event.stopPropagation();
      if (d.url) window.open(d.url, "_blank");
    });

  // ── 标签 ──
  labels = nodeG.append("text")
    .attr("class", "node-label")
    .attr("dx", d => rScale(d.stars) + 6)
    .attr("dy", 3)
    .attr("font-size", "10px")
    .attr("text-anchor", "start")
    .text(d => d.name.length > 20 ? d.name.slice(0, 18) + "…" : d.name);

  function updateLabels(scale) {
    if (!labels) return;
    if (!showLabels) { labels.attr("opacity", 0); return; }
    if (scale < 0.35) labels.attr("opacity", 0);
    else if (scale < 0.7) labels.attr("opacity", d => d.stars >= 100 ? 1 : 0);
    else labels.attr("opacity", 1);
    labels.attr("font-size", Math.min(12, Math.max(8, 10 / Math.sqrt(scale))) + "px");
  }

  // ── 高亮/取消高亮 ──
  function highlightNode(d, enter, circleEl) {
    if (enter) {
      const connected = new Set();
      edgesData.forEach(e => {
        const s = typeof e.source === "object" ? e.source.id : e.source;
        const t = typeof e.target === "object" ? e.target.id : e.target;
        if (s === d.id) connected.add(t);
        if (t === d.id) connected.add(s);
      });
      nodeG.selectAll("circle").transition().duration(200)
        .attr("opacity", nd => (nd.id === d.id || connected.has(nd.id)) ? 1 : 0.1);
      nodeG.selectAll("text").transition().duration(200)
        .attr("opacity", nd => (nd.id === d.id || connected.has(nd.id)) ? 1 : 0.05);
      link.transition().duration(200)
        .attr("stroke-opacity", e => {
          const s = typeof e.source === "object" ? e.source.id : e.source;
          const t = typeof e.target === "object" ? e.target.id : e.target;
          return (s === d.id || t === d.id) ? 0.85 : 0.04;
        })
        .attr("stroke", e => {
          const s = typeof e.source === "object" ? e.source.id : e.source;
          const t = typeof e.target === "object" ? e.target.id : e.target;
          return (s === d.id || t === d.id) ? colorScale(d.category) : "var(--text-muted)";
        });
      d3.select(circleEl).transition().duration(200)
        .attr("r", rScale(d.stars) * 1.35);
    } else {
      nodeG.selectAll("circle").transition().duration(250).attr("opacity", 1);
      nodeG.selectAll("text").transition().duration(250).attr("opacity", showLabels ? 1 : 0);
      link.transition().duration(250).attr("stroke-opacity", 0.3).attr("stroke", "var(--text-muted)");
      d3.select(circleEl).transition().duration(250).attr("r", rScale(d.stars));
    }
  }

  // ── Tooltip ──
  const progressMap = { none: "未学习", learning: "正在学习", learned: "已学习", mastered: "熟练掌握" };

  function showTooltip(event, d) {
    if (!tooltipEl) return;
    tooltipEl.innerHTML =
      '<div class="tt-name">' + esc(d.name) + '</div>' +
      '<div class="tt-row"><span class="tt-label">分类</span>' + esc(d.category) + '</div>' +
      '<div class="tt-row"><span class="tt-label">语言</span>' + esc(d.language || "—") + '</div>' +
      '<div class="tt-row"><span class="tt-label">进度</span>' + (progressMap[d.progress] || "未学习") + '</div>' +
      '<div class="tt-row"><span class="tt-label">Star</span>' + d.stars + '</div>' +
      (d.desc ? '<div class="tt-desc">' + esc(d.desc) + '</div>' : "") +
      (d.url ? '<a class="tt-link" href="' + esc(d.url) + '" target="_blank">' + esc(d.url) + '</a>' : "");
    tooltipEl.classList.add("visible");
    moveTooltip(event);
  }

  function moveTooltip(event) {
    if (!tooltipEl) return;
    const rect = body.getBoundingClientRect();
    let x = event.clientX - rect.left + 16;
    let y = event.clientY - rect.top - 10;
    if (x + 300 > rect.width) x = event.clientX - rect.left - 310;
    if (y + 200 > rect.height) y = rect.height - 210;
    tooltipEl.style.left = x + "px";
    tooltipEl.style.top = y + "px";
  }

  function hideTooltip() {
    if (tooltipEl) tooltipEl.classList.remove("visible");
  }

  // ── 仿真 ──
  const simulation = d3.forceSimulation(nodesData)
    .force("link", d3.forceLink(edgesData).id(d => d.id).distance(70))
    .force("charge", d3.forceManyBody().strength(-400))
    .force("center", d3.forceCenter(0, 0))
    .force("collide", d3.forceCollide().radius(d => rScale(d.stars) + 8))
    .on("tick", () => {
      link
        .attr("x1", d => d.source.x).attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x).attr("y2", d => d.target.y);
      nodeG.attr("transform", d => "translate(" + d.x + "," + d.y + ")");
    });

  // 保存状态（合并，保留 openGraph 设置的 escHandler 等）
  Object.assign(_graphState, { simulation, nodeG, link, labels, showLabels, colorScale, nodesData, edgesData, rScale, zoomBehavior, svg, g, width, height });

  // ── 图例 + 分类筛选 ──
  const categories = [...new Set(nodesData.map(n => n.category))];
  let activeFilter = null;

  if (legendEl) {
    legendEl.innerHTML = categories.map(c =>
      '<div class="graph-legend-item" data-cat="' + esc(c) + '">' +
      '<div class="graph-legend-swatch" style="background:' + colorScale(c) + '"></div>' +
      '<span>' + esc(c) + '</span></div>'
    ).join("");

    legendEl.querySelectorAll(".graph-legend-item").forEach(item => {
      item.addEventListener("click", () => {
        const cat = item.dataset.cat;
        if (activeFilter === cat) {
          activeFilter = null;
          legendEl.querySelectorAll(".graph-legend-item").forEach(i => i.classList.remove("dimmed"));
          nodeG.selectAll("circle").transition().duration(250).attr("opacity", 1);
          nodeG.selectAll("text").transition().duration(250).attr("opacity", showLabels ? 1 : 0);
          link.transition().duration(250).attr("stroke-opacity", 0.3);
        } else {
          activeFilter = cat;
          legendEl.querySelectorAll(".graph-legend-item").forEach(i => {
            i.classList.toggle("dimmed", i.dataset.cat !== cat);
          });
          nodeG.selectAll("circle").transition().duration(250)
            .attr("opacity", nd => nd.category === cat ? 1 : 0.08);
          nodeG.selectAll("text").transition().duration(250)
            .attr("opacity", nd => nd.category === cat ? 1 : 0);
          link.transition().duration(250)
            .attr("stroke-opacity", e => {
              return (e.source.category === cat && e.target.category === cat) ? 0.6 : 0.03;
            });
        }
      });
    });
  }

  // ── 搜索 ──
  const searchInput = document.getElementById("graphSearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const q = searchInput.value.trim().toLowerCase();
      const dropdown = document.getElementById("graphSearchDropdown");
      if (!dropdown) return;
      if (!q) { dropdown.classList.remove("visible"); return; }
      const matches = nodesData.filter(n =>
        n.name.toLowerCase().includes(q) ||
        (n.category && n.category.toLowerCase().includes(q)) ||
        (n.language && n.language.toLowerCase().includes(q))
      ).slice(0, 8);
      if (matches.length === 0) {
        dropdown.innerHTML = '<div class="graph-search-item" style="color:var(--text-muted);cursor:default">无匹配结果</div>';
      } else {
        dropdown.innerHTML = matches.map(n =>
          '<div class="graph-search-item" data-id="' + n.id + '">' +
          '<span class="dot" style="background:' + colorScale(n.category) + '"></span>' +
          esc(n.name) +
          '<span class="cat-label">' + esc(n.category) + '</span></div>'
        ).join("");
      }
      dropdown.classList.add("visible");
    });

    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        const dropdown = document.getElementById("graphSearchDropdown");
        if (dropdown) dropdown.classList.remove("visible");
        searchInput.blur();
      }
      if (e.key === "Enter") {
        const q = searchInput.value.trim().toLowerCase();
        const match = nodesData.find(n => n.name.toLowerCase().includes(q));
        if (match) {
          focusOnNode(match);
          const dropdown = document.getElementById("graphSearchDropdown");
          if (dropdown) dropdown.classList.remove("visible");
        }
      }
    });

    // 点击搜索结果项（事件委托）
    const dropdown = document.getElementById("graphSearchDropdown");
    if (dropdown) {
      dropdown.addEventListener("click", (e) => {
        const item = e.target.closest(".graph-search-item");
        if (!item || !item.dataset.id) return;
        const id = parseInt(item.dataset.id);
        const node = nodesData.find(n => n.id === id);
        if (node) {
          focusOnNode(node);
          searchInput.value = node.name;
          dropdown.classList.remove("visible");
        }
      });
    }

    // 点击外部关闭搜索下拉（存储引用以便 closeGraph 清理）
    const docClickHandler = (e) => {
      if (!e.target.closest(".graph-topbar-center")) {
        const dd = document.getElementById("graphSearchDropdown");
        if (dd) dd.classList.remove("visible");
      }
    };
    document.addEventListener("click", docClickHandler);
    if (_graphState) _graphState.docClickHandler = docClickHandler;
  }

  function focusOnNode(d) {
    if (!d || d.x === undefined) return;
    const scale = 2;
    const tx = width / 2 - d.x * scale;
    const ty = height / 2 - d.y * scale;
    svg.transition().duration(600).call(
      zoomBehavior.transform,
      d3.zoomIdentity.translate(tx, ty).scale(scale)
    );
    // 高亮 3 秒后恢复
    nodeG.selectAll("circle").transition().duration(300)
      .attr("opacity", nd => nd.id === d.id ? 1 : 0.1);
    nodeG.selectAll("text").transition().duration(300)
      .attr("opacity", nd => nd.id === d.id ? 1 : 0);
    link.transition().duration(300).attr("stroke-opacity", 0.05);
    setTimeout(() => {
      nodeG.selectAll("circle").transition().duration(400).attr("opacity", 1);
      nodeG.selectAll("text").transition().duration(400).attr("opacity", showLabels ? 1 : 0);
      link.transition().duration(400).attr("stroke-opacity", 0.3);
    }, 3000);
  }

  // ── 工具栏按钮 ──
  const fitBtn = document.getElementById("graphBtnFit");
  if (fitBtn) fitBtn.addEventListener("click", () => {
    svg.transition().duration(500).call(
      zoomBehavior.transform,
      d3.zoomIdentity.translate(width / 2, height / 2)
    );
  });

  const labelBtn = document.getElementById("graphBtnLabels");
  if (labelBtn) labelBtn.addEventListener("click", function() {
    showLabels = !showLabels;
    this.classList.toggle("active", showLabels);
    if (showLabels) {
      updateLabels(d3.zoomTransform(svg.node()).k);
    } else {
      labels.attr("opacity", 0);
    }
    if (_graphState) _graphState.showLabels = showLabels;
  });
}
