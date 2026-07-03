/**
 * github_sync.js — GitHub Star 同步
 */
let ghRepos = [];

document.addEventListener("DOMContentLoaded", () => {
  $("btnFetch").addEventListener("click", fetchStars);
  $("ghUsername").addEventListener("keydown", e => { if (e.key === "Enter") fetchStars(); });
  $("ghSelectAll").addEventListener("change", e => toggleSelectAll(e.target.checked));
  $("btnImportSelected").addEventListener("click", importSelected);
});

async function fetchStars() {
  const username = $("ghUsername").value.trim();
  const status = $("ghStatus"), list = $("ghRepoList"), tb = $("ghToolbar");
  status.className = "gh-status loading"; status.classList.remove("hidden");
  status.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 获取中...';
  list.innerHTML = ""; tb.classList.add("hidden");

  try {
    let url = "/api/github/stars";
    if (username) url += `?github_id=${encodeURIComponent(username)}`;
    const data = await API(url);
    if (data.error) { status.className = "gh-status error"; status.textContent = data.error; return; }
    ghRepos = data.repos;
    if (ghRepos.length === 0) { status.className = "gh-status success"; status.textContent = "没有公开 Star"; return; }

    // 语言统计
    const langStats = {};
    ghRepos.forEach(r => { if (r.language) langStats[r.language] = (langStats[r.language] || 0) + 1; });
    const langText = Object.entries(langStats).sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([l, c]) => `${l}(${c})`).join("  ·  ");

    status.className = "gh-status success";
    status.innerHTML = `<b>${ghRepos.length}</b> 个 Star` +
      (langText ? `<br><span style="font-size:0.72rem;opacity:0.7">${langText}</span>` : "");

    renderGhList(); tb.classList.remove("hidden");
  } catch (e) { status.className = "gh-status error"; status.textContent = e.error || "请求失败"; }
}

function renderGhList() {
  $("ghRepoList").innerHTML = ghRepos.map((r, i) => `
    <div class="gh-repo-item${r.already_saved ? " already-saved" : ""}">
      <input type="checkbox" data-idx="${i}" ${r.already_saved ? "disabled" : ""}>
      <span class="gh-repo-name" title="${esc(r.name)}">${esc(r.name)}</span>
      ${r.language ? `<span class="gh-repo-lang">${esc(r.language)}</span>` : ""}
      <span class="gh-repo-stats"><i class="fa-solid fa-star"></i> ${fmtNum(r.stars)}</span>
      ${r.already_saved ? `<span class="gh-repo-saved">已收藏</span>` : ""}
    </div>
  `).join("");
  $("ghSelectAll").checked = false;
}

function toggleSelectAll(checked) {
  $("ghRepoList").querySelectorAll('input[type="checkbox"]:not([disabled])').forEach(cb => cb.checked = checked);
}

function getSelected() {
  const items = [];
  $("ghRepoList").querySelectorAll('input[type="checkbox"]:checked:not([disabled])').forEach(cb => {
    items.push(ghRepos[parseInt(cb.dataset.idx)]);
  });
  return items;
}

async function importSelected() {
  const sel = getSelected();
  if (!sel.length) return;
  try {
    const res = await API("/api/projects/import", {
      method: "POST", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ items: sel.map(r => ({ name: r.name, url: r.url, description: r.description, category: r.category, tags: r.tags, stars: r.stars, language: r.language })) }),
    });
    alert(`导入 ${res.added} 个项目`);
    const urls = new Set(sel.map(r => r.url));
    ghRepos.forEach(r => { if (urls.has(r.url)) r.already_saved = true; });
    renderGhList(); $("ghSelectAll").checked = false;
    await loadCategories(); await loadProjects();
  } catch (e) { alert("失败: " + (e.error || "")); }
}
