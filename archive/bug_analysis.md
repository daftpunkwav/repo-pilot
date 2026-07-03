# Login Bug Analysis: "记住密码" & "保持登录" 功能失效

> **项目**: GitHub Stash (D:\AgentsTool)
> **分析日期**: 2026-07-02
> **技术栈**: Python Flask 后端 + pywebview 桌面壳 + 原生 JS 前端

---

## 1. 项目架构与登录流程概览

```
main.py (pywebview)
  └─ 启动 Flask (127.0.0.1:19876) → 加载 WebView 页面

前端 (index.html + login.js + app.js)
  └─ localStorage 存储: ghs_token / ghs_persistent_token / ghs_remembered_creds

后端 (server.py + store.py)
  ├─ sessions: dict          ← 内存字典 (服务重启全部丢失)
  ├─ remembered_sessions.json ← 持久化到磁盘
  └─ stash_users.json        ← 用户数据库
```

| 功能 | 前端存储 Key | 后端存储 | 持久化方式 |
|------|-------------|---------|-----------|
| 会话 Token | `ghs_token` | `sessions` 内存字典 | **不持久** (重启丢失) |
| 保持登录 Token | `ghs_persistent_token` | `remembered_sessions.json` | 磁盘持久化 |
| 记住密码 | `ghs_remembered_creds` | 无 | **仅 localStorage** |

---

## 2. 根本原因分析

### Bug #1 (🔴 严重): `btoa`/`atob` 编码缺陷——凭据存储静默失败

**文件**: `frontend/login.js` 第 28-36 行、第 18-25 行

```javascript
// 保存凭据
function saveRememberedCredentials(username, password, rememberMe) {
  try {
    const encoded = btoa(JSON.stringify({ username, password, remember_me: rememberMe }));
    localStorage.setItem(REMEMBER_KEY, encoded);
  } catch {}  // ← 空 catch，静默吞掉所有异常
}

// 读取凭据
function loadRememberedCredentials() {
  try {
    const raw = localStorage.getItem(REMEMBER_KEY);
    const creds = JSON.parse(atob(raw));
    // ...
  } catch {}  // ← 空 catch，静默吞掉所有异常
}
```

**问题**: `btoa()` 只能编码 Latin-1 字符 (码点 0-255)。`JSON.stringify()` 默认保留 Unicode 字符（如中文）。当用户名或密码包含任意非 ASCII 字符时，`btoa()` 抛出 `InvalidCharacterError`，被空 catch 吞掉，凭据**从未写入** localStorage。

**影响范围**: 任何包含中文/特殊字符的用户名或密码会导致"记住密码"**完全失效**，且无任何错误提示。

**修复方案**:
```javascript
// 使用 TextEncoder / encodeURIComponent 安全编码
function saveRememberedCredentials(username, password, rememberMe) {
  try {
    const json = JSON.stringify({ username, password, remember_me: rememberMe });
    const encoded = btoa(unescape(encodeURIComponent(json)));
    localStorage.setItem(REMEMBER_KEY, encoded);
  } catch (e) {
    console.error("Failed to save credentials:", e);
  }
}

function loadRememberedCredentials() {
  try {
    const raw = localStorage.getItem(REMEMBER_KEY);
    if (!raw) return;
    const creds = JSON.parse(decodeURIComponent(escape(atob(raw))));
    // ...
  } catch (e) {
    console.error("Failed to load credentials:", e);
  }
}
```

---

### Bug #2 (🔴 严重): `checkAuth()` 将网络错误等同于鉴权失败，误清除 Token

**文件**: `frontend/app.js` 第 93-127 行

```javascript
async function checkAuth() {
  if (state.authToken) {
    try {
      const u = await API("/api/user");
      // ... 成功
      return;
    } catch (e) {
      state.authToken = "";
      localStorage.removeItem("ghs_token");  // ← 网络错误也会执行这里！
      state.currentUser = null;
    }
  }
  const persistent = localStorage.getItem("ghs_persistent_token");
  if (persistent) {
    try {
      const u = await fetch("/api/user", {
        headers: { "Authorization": "Bearer " + persistent },
      }).then(/* ... */);
      // ... 成功
      return;
    } catch (e) {
      localStorage.removeItem("ghs_persistent_token");  // ← 网络错误也会执行这里！
    }
  }
}
```

**问题**: `catch` 块不区分错误类型。当 Flask 服务器尚未完全就绪（网络层面的 `TypeError: Failed to fetch`），代码仍然执行 `removeItem`，导致合法的 Token 被清除。

**触发场景**（关键路径）:

```
应用启动 → main.py 启动 Flask 线程 → 立即创建 WebView 窗口 → WebView 加载页面
                                                 ↑
                                        Flask 可能尚未绑定端口！
```

在 `main.py` 中，`flask_thread.start()` 后没有任何就绪等待就直接创建窗口。若 WebView 在 Flask 绑定端口前加载页面，`checkAuth()` 中的 `fetch` 会因网络错误失败，导致：

1. `ghs_token` 被清除 ✓
2. `ghs_persistent_token` 被清除 ✓
3. 用户看到空白登录表单——必须重新输入账号密码 ✓

**这完美解释了「每次都需要重新输入账号密码」的症状。**

**修复方案**:

方案 A（后端）——加入 Flask 就绪等待：
```python
# main.py
import time, urllib.request

def wait_for_flask(url, timeout=10):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            urllib.request.urlopen(url)
            return True
        except:
            time.sleep(0.1)
    return False

flask_thread.start()
wait_for_flask("http://127.0.0.1:19876")
webview.create_window(...)
```

方案 B（前端）——区分错误类型并加入重试：
```javascript
async function checkAuth() {
  if (state.authToken) {
    try {
      const u = await API("/api/user");
      // ... 成功
      return;
    } catch (e) {
      // 仅鉴权失败(401)时清除 token，网络错误保留重试
      if (e.error === "未登录") {
        state.authToken = "";
        localStorage.removeItem("ghs_token");
        state.currentUser = null;
      }
      // 网络错误不处理，保留 token 供后续重试
    }
  }
  // ... persistent token 同理
}
```

---

### Bug #3 (🟡 中等): 退出登录未清除持久化 Token

**文件**: `frontend/app.js` 第 130-137 行、`backend/server.py` 第 169-173 行

```javascript
// app.js - bindLogout()
function bindLogout() {
  $("btnLogout").addEventListener("click", async () => {
    try { await API("/api/logout", { method: "POST" }); } catch (e) {}
    state.authToken = "";
    state.currentUser = null;
    localStorage.removeItem("ghs_token");        // ✓ 清除
    // ❌ 未清除 ghs_persistent_token
    // ❌ 未清除 ghs_remembered_creds
    $("authOverlay").classList.remove("hidden");
  });
}
```

```python
# server.py - api_logout()
@app.route("/api/logout", methods=["POST"])
def api_logout():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if token in sessions:
        del sessions[token]           # ✓ 删除会话
    # ❌ 未删除 remembered_sessions 中的持久化 token
    return jsonify({"ok": True})
```

**问题**: 用户点击退出后，`ghs_persistent_token` 仍保留在 localStorage 和服务器磁盘文件中。下次启动时 `checkAuth()` 仍能通过持久化 Token 自动登录——这导致"退出登录"形同虚设，也使得"保持登录"复选框的开关语义被破坏。

**修复方案**:
```javascript
// 前端 - bindLogout()
localStorage.removeItem("ghs_token");
localStorage.removeItem("ghs_persistent_token");     // 新增
localStorage.removeItem("ghs_remembered_creds");     // 新增
```

```python
# 后端 - api_logout()
@app.route("/api/logout", methods=["POST"])
def api_logout():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if token in sessions:
        del sessions[token]
    # 清除对应的持久化 token
    to_delete = [k for k, v in remembered_sessions.items() if v.get("user_id") == sessions.get(token)]
    for k in to_delete:
        del remembered_sessions[k]
    if to_delete:
        save_remembered()
    return jsonify({"ok": True})
```

---

### Bug #4 (🟡 中等): 异常处理全部静默——无法定位问题

**文件**: `frontend/login.js`

```javascript
function saveRememberedCredentials(...) {
  try { /* ... */ } catch {}  // 静默
}

function loadRememberedCredentials() {
  try { /* ... */ } catch {}  // 静默
}

function getPersistentToken() {
  try { return localStorage.getItem("ghs_persistent_token"); }
  catch { return null; }       // 静默
}
```

**问题**: 三个函数中所有异常均被静默吞掉。一旦发生任何错误（localStorage 满、禁用、编码失败等），开发者和用户都无法感知，导致功能"神秘地"不工作。

**修复方案**: 至少输出 `console.error`，并在生产环境中考虑上报。

---

### Bug #5 (🟢 低): `saveRememberedCredentials` 中 `rememberMe` 参数语义歧义

**文件**: `frontend/login.js` 第 85 行、第 29 行

```javascript
// 调用时
const rememberMe = $("loginRememberMe").checked;  // "保持登录" 复选框
saveRememberedCredentials(username, password, rememberMe);

// 函数内
function saveRememberedCredentials(username, password, rememberMe) {
  // ...
  const encoded = btoa(JSON.stringify({
    username, password,
    remember_me: rememberMe  // 参数名是 rememberMe，键名是 remember_me
  }));
}
```

**问题**: `rememberMe` 是"保持登录"的值，但在"记住密码"函数中保存。这导致：当用户只勾选"记住密码"而不勾选"保持登录"时，`remember_me: false` 被保存。下次加载时 `loadRememberedCredentials` 中 `if (creds.remember_me)` 为 false，"保持登录"复选框不会被勾选——这是期望行为，但语义上容易混淆。不是直接导致 bug，但增加了维护风险。

---

## 3. Bug 影响汇总

| Bug | 影响功能 | 严重度 | 触发条件 |
|-----|---------|--------|---------|
| #1 `btoa` 编码 | 记住密码 | 🔴 严重 | 用户名或密码含非 ASCII 字符 |
| #2 网络错误误清除 Token | **两者均失效** | 🔴 严重 | Flask 启动慢于 WebView 页面加载 |
| #3 退出登录不完整 | 保持登录 | 🟡 中等 | 用户每次点击退出登录 |
| #4 静默异常 | **两者均失效** | 🟡 中等 | 任何 localStorage 异常 |
| #5 参数语义 | 间接影响 | 🟢 低 | 维护/修改时 |

---

## 4. 推荐修复优先级

1. **立即修复 Bug #2**（网络错误误清除 Token）——这是导致"每次都需要重新输入"的最可能直接原因
2. **立即修复 Bug #1**（`btoa` 编码）——防止含非 ASCII 凭据的用户永久无法使用"记住密码"
3. **修复 Bug #4**（静默异常）——为后续调试提供可见性
4. **修复 Bug #3**（退出登录不完整）——使"保持登录"复选框语义正确

---

## 5. 已排除的怀疑点

| 怀疑点 | 结论 |
|-------|------|
| `DOMContentLoaded` 时序导致 `loadRememberedCredentials` 不执行 | **已排除**——脚本在 `<body>` 底部同步加载，`DOMContentLoaded` 注册早于事件触发 |
| `remembered_sessions.json` 文件路径错误 | **已排除**——`path_util.py` 正确区分 `frozen`/开发模式，dist 目录下文件存在且数据有效 |
| 服务器 `require_auth` 未检查 `remembered_sessions` | **已排除**——装饰器中明确包含 `elif token in remembered_sessions` 分支 |
| `onLoginSuccess` 未保存 Token | **已排除**——正确保存 `ghs_token` 到 localStorage |


---

## 6. 修复记录 (2026-07-02)

### 修复 #2: Flask 启动竞态（前后端双保险）

**`main.py`** — 加入 Flask 就绪等待：
```python
import os, sys, time, threading, urllib.request
# ...
deadline = time.time() + 10
while time.time() < deadline:
    try:
        urllib.request.urlopen("http://127.0.0.1:19876")
        break
    except Exception:
        time.sleep(0.1)
```

**`frontend/app.js`** — `checkAuth()` 区分网络错误与鉴权失败：
- session token 分支：仅 `e.error === "未登录"` 时清除
- persistent token 分支：同上

### 修复 #1: `btoa`/`atob` 编码缺陷

**`frontend/login.js`**：
- `saveRememberedCredentials()`: `btoa(JSON.stringify(...))` → `btoa(unescape(encodeURIComponent(json)))`
- `loadRememberedCredentials()`: `JSON.parse(atob(raw))` → `JSON.parse(decodeURIComponent(escape(atob(raw))))`
- 损坏的凭据自动清理：catch 中追加 `localStorage.removeItem(REMEMBER_KEY)`

### 修复 #3: 退出登录不完整

**`frontend/app.js`** — `bindLogout()` 新增清除：
```javascript
localStorage.removeItem("ghs_persistent_token");
localStorage.removeItem("ghs_remembered_creds");
```

**`backend/server.py`** — `api_logout()` 同步清除服务器端持久化 token：
```python
user_id = sessions[token]
del sessions[token]
to_delete = [k for k, v in remembered_sessions.items() if v.get("user_id") == user_id]
for k in to_delete:
    del remembered_sessions[k]
if to_delete:
    save_remembered()
```

### 修复 #4: 静默异常

**`frontend/login.js`** — 所有空 `catch {}` 改为 `catch (e) { console.error("...", e); }`
