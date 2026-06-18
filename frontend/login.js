/**
 * login.js — 登录 / 注册逻辑
 */
const REMEMBER_KEY = "ghs_remembered_creds";

document.addEventListener("DOMContentLoaded", () => {
  bindAuthTabs();
  bindLoginForm();
  bindRegisterForm();
  loadRememberedCredentials();

  // 绑定 GitHub 账号功能
  const btnBind = $("btnBindGh");
  if (btnBind) btnBind.addEventListener("click", bindGhAccount);
});

/* ── 记住密码 ── */

function loadRememberedCredentials() {
  try {
    const raw = localStorage.getItem(REMEMBER_KEY);
    if (!raw) return;
    const creds = JSON.parse(atob(raw));
    if (creds.username) $("loginUsername").value = creds.username;
    if (creds.password) $("loginPassword").value = creds.password;
    $("loginRememberPwd").checked = true;
    if (creds.remember_me) $("loginRememberMe").checked = true;
  } catch {}
}

function saveRememberedCredentials(username, password, rememberMe) {
  try {
    if (!$("loginRememberPwd").checked) {
      localStorage.removeItem(REMEMBER_KEY);
      return;
    }
    const encoded = btoa(JSON.stringify({ username, password, remember_me: rememberMe }));
    localStorage.setItem(REMEMBER_KEY, encoded);
  } catch {}
}

function getPersistentToken() {
  try {
    return localStorage.getItem("ghs_persistent_token");
  } catch { return null; }
}

function setPersistentToken(token) {
  if (token) {
    localStorage.setItem("ghs_persistent_token", token);
  }
}

/* ── Tab 切换 ── */

function bindAuthTabs() {
  const tabs = $("authTabs").querySelectorAll(".auth-tab");
  const loginForm = $("loginForm");
  const registerForm = $("registerForm");

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      const target = tab.dataset.tab;
      loginForm.classList.toggle("active", target === "login");
      registerForm.classList.toggle("active", target === "register");
      $("loginError").classList.add("hidden");
      $("registerError").classList.add("hidden");
    });
  });
}

function bindLoginForm() {
  $("loginForm").addEventListener("submit", async e => {
    e.preventDefault();
    const username = $("loginUsername").value.trim();
    const password = $("loginPassword").value;
    const rememberMe = $("loginRememberMe").checked;
    const errEl = $("loginError");
    errEl.classList.add("hidden");

    if (!username || !password) {
      errEl.textContent = "请填写账号和密码";
      errEl.classList.remove("hidden");
      return;
    }
    try {
      const data = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, remember_me: rememberMe }),
      }).then(r => r.json());
      if (data.error) {
        errEl.textContent = data.error;
        errEl.classList.remove("hidden");
        return;
      }
      saveRememberedCredentials(username, password, rememberMe);
      if (data.persistent_token) {
        setPersistentToken(data.persistent_token);
      }
      onLoginSuccess(data.token, data.user);
      if (!$("loginRememberPwd").checked) $("loginPassword").value = "";
    } catch (err) {
      errEl.textContent = "请求失败";
      errEl.classList.remove("hidden");
    }
  });
}

function bindRegisterForm() {
  $("registerForm").addEventListener("submit", async e => {
    e.preventDefault();
    const username = $("regUsername").value.trim();
    const password = $("regPassword").value;
    const password2 = $("regPassword2").value;
    const ghEmail = $("regGhEmail").value.trim();
    const ghId = $("regGhId").value.trim();
    const errEl = $("registerError");
    errEl.classList.add("hidden");

    if (!username || !password) {
      errEl.textContent = "请填写账号和密码";
      errEl.classList.remove("hidden");
      return;
    }
    if (username.length < 2 || username.length > 32) {
      errEl.textContent = "账号需 2-32 个字符";
      errEl.classList.remove("hidden");
      return;
    }
    if (password.length < 4) {
      errEl.textContent = "密码至少 4 个字符";
      errEl.classList.remove("hidden");
      return;
    }
    if (password !== password2) {
      errEl.textContent = "两次密码不一致";
      errEl.classList.remove("hidden");
      return;
    }

    const body = { username, password };
    if (ghEmail && ghId) {
      body.github_accounts = [{ email: ghEmail, github_id: ghId }];
    }

    try {
      const data = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(r => r.json());
      if (data.error) {
        errEl.textContent = data.error;
        errEl.classList.remove("hidden");
        return;
      }
      onLoginSuccess(data.token, data.user);
      ["regUsername","regPassword","regPassword2","regGhEmail","regGhId"].forEach(id => $(id).value = "");
    } catch (err) {
      errEl.textContent = "请求失败";
      errEl.classList.remove("hidden");
    }
  });
}

async function bindGhAccount() {
  const email = $("ghBindEmail").value.trim();
  const githubId = $("ghBindId").value.trim();
  if (!email || !githubId) {
    alert("请填写邮箱和 GitHub ID");
    return;
  }
  try {
    await API("/api/user/github", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, github_id: githubId }),
    });
    state.currentUser.github_accounts = state.currentUser.github_accounts || [];
    const existing = state.currentUser.github_accounts.find(a => a.github_id === githubId);
    if (existing) {
      existing.email = email;
    } else {
      state.currentUser.github_accounts.push({ email, github_id: githubId });
    }
    renderGhAccountsList();
    updateGhBoundAccounts();
    $("ghBindEmail").value = "";
    $("ghBindId").value = "";
  } catch (e) {
    alert(e.error || "绑定失败");
  }
}

async function removeGhAccount(githubId) {
  if (!confirm(`确认移除 GitHub 账号「${githubId}」？`)) return;
  try {
    await API("/api/user/github", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ github_id: githubId }),
    });
    state.currentUser.github_accounts = (state.currentUser.github_accounts || []).filter(a => a.github_id !== githubId);
    renderGhAccountsList();
    updateGhBoundAccounts();
  } catch (e) {
    alert(e.error || "移除失败");
  }
}

function renderGhAccountsList() {
  const list = $("ghAccountsList");
  const accounts = state.currentUser && state.currentUser.github_accounts ? state.currentUser.github_accounts : [];
  if (accounts.length === 0) {
    list.innerHTML = '<span class="text-muted" style="font-size:0.82rem">暂无绑定账号</span>';
    return;
  }
  list.innerHTML = accounts.map((a, i) => `
    <div class="gh-account-item">
      <div class="gh-account-info">
        <i class="fa-brands fa-github"></i>
        <span class="gh-account-id">${esc(a.github_id)}</span>
        <span class="gh-account-email">${esc(a.email)}</span>
        ${i === 0 ? '<span class="chip-default-inline">默认</span>' : ''}
      </div>
      <button class="btn btn-ghost btn-sm btn-danger-ghost" onclick="removeGhAccount('${esc(a.github_id)}')"><i class="fa-solid fa-trash"></i></button>
    </div>
  `).join("");
}

// 确保设置面板打开时刷新列表
const origBtnSettings = $("btnSettings");
if (origBtnSettings) {
  const origClick = origBtnSettings.onclick;
  origBtnSettings.addEventListener("click", () => {
    setTimeout(renderGhAccountsList, 50);
  });
}
