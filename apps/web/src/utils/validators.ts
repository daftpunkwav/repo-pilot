export interface ValidationResult {
  valid: boolean;
  message?: string;
}

const USERNAME_MIN = 3;
const USERNAME_MAX = 32;
const PASSWORD_MIN = 8;
const AVATAR_MAX_LENGTH = 512;
const GITHUB_URL_RE = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/;
// 头像 URL 白名单：仅允许已知安全域名，防止 javascript:/data: 等 XSS 向量
const AVATAR_HOST_RE = /^https:\/\/avatars\.githubusercontent\.com\//i;

export function validateUsername(username: string): ValidationResult {
  const trimmed = username.trim();
  if (trimmed.length < USERNAME_MIN) {
    return { valid: false, message: `用户名至少 ${USERNAME_MIN} 个字符` };
  }
  if (trimmed.length > USERNAME_MAX) {
    return { valid: false, message: `用户名最多 ${USERNAME_MAX} 个字符` };
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(trimmed)) {
    return { valid: false, message: '用户名只能包含字母、数字、点、下划线和连字符' };
  }
  return { valid: true };
}

export function validatePassword(password: string): ValidationResult {
  if (password.length < PASSWORD_MIN) {
    return { valid: false, message: `密码至少 ${PASSWORD_MIN} 个字符` };
  }
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return { valid: false, message: '密码需同时包含字母和数字' };
  }
  return { valid: true };
}

export function validateLoginForm(username: string, password: string): ValidationResult {
  const u = validateUsername(username);
  if (!u.valid) return u;
  if (password.length < PASSWORD_MIN) {
    return { valid: false, message: `密码至少 ${PASSWORD_MIN} 个字符` };
  }
  return { valid: true };
}

export function validateRegisterForm(
  username: string,
  password: string,
  confirmPassword: string
): ValidationResult {
  const u = validateUsername(username);
  if (!u.valid) return u;
  const p = validatePassword(password);
  if (!p.valid) return p;
  if (password !== confirmPassword) {
    return { valid: false, message: '两次输入的密码不一致' };
  }
  return { valid: true };
}

export function validatePasswordChange(
  oldPassword: string,
  newPassword: string,
  confirmPassword: string
): ValidationResult {
  if (!oldPassword) {
    return { valid: false, message: '请输入旧密码' };
  }
  const p = validatePassword(newPassword);
  if (!p.valid) return p;
  if (newPassword !== confirmPassword) {
    return { valid: false, message: '两次输入的新密码不一致' };
  }
  if (oldPassword === newPassword) {
    return { valid: false, message: '新密码不能与旧密码相同' };
  }
  return { valid: true };
}

export function validateGithubUrl(url: string): ValidationResult {
  const trimmed = url.trim();
  if (!GITHUB_URL_RE.test(trimmed)) {
    return { valid: false, message: '请输入有效的 GitHub 仓库 URL' };
  }
  return { valid: true };
}

export function validateAvatarUrl(url: string): ValidationResult {
  const trimmed = url.trim();
  if (!trimmed) {
    return { valid: false, message: '头像 URL 不能为空' };
  }
  if (trimmed.length > AVATAR_MAX_LENGTH) {
    return { valid: false, message: `头像 URL 不能超过 ${AVATAR_MAX_LENGTH} 个字符` };
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') {
      return { valid: false, message: '头像 URL 必须使用 HTTPS 协议' };
    }
  } catch {
    return { valid: false, message: '头像 URL 格式不正确' };
  }
  if (!AVATAR_HOST_RE.test(trimmed)) {
    return { valid: false, message: '头像 URL 域名不在白名单内' };
  }
  return { valid: true };
}

export function parseGithubUrl(url: string): { owner: string; repo: string; name: string } | null {
  const match = trimmedGithubUrl(url).match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)/);
  if (!match?.[1] || !match[2]) return null;
  const owner = match[1];
  const repo = match[2].replace(/\.git$/, '');
  return { owner, repo, name: `${owner}/${repo}` };
}

function trimmedGithubUrl(url: string): string {
  return url.trim().replace(/\/$/, '');
}

export function validateGithubUrls(text: string): {
  valid: Array<{ owner: string; repo: string; url: string; name: string }>;
  invalid: string[];
} {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const valid: Array<{ owner: string; repo: string; url: string; name: string }> = [];
  const invalid: string[] = [];

  for (const line of lines) {
    const parsed = parseGithubUrl(line);
    if (parsed) {
      valid.push({
        ...parsed,
        url: `https://github.com/${parsed.owner}/${parsed.repo}`,
      });
    } else {
      invalid.push(line);
    }
  }
  return { valid, invalid };
}
