import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { getApi } from '@/api/client';
import { formatDateTime } from '@/utils/date';
import {
  validatePassword,
  validateAvatarUrl,
  validatePasswordChange,
} from '@/utils/validators';
import { GlassCard } from '@/components/common/GlassCard';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useUIStore } from '@/stores/uiStore';

export function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const setUser = useAuthStore((s) => s.setUser);
  const navigate = useNavigate();
  const addToast = useUIStore((s) => s.addToast);
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url ?? '');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState('');

  const { data: learningProfile, refetch: refetchProfile } = useQuery({
    queryKey: ['userProfile'],
    queryFn: async () => (await getApi().getUserProfile()).data,
  });

  if (!user) return <LoadingSpinner />;

  const saveAvatar = async () => {
    const v = validateAvatarUrl(avatarUrl);
    if (!v.valid) {
      addToast({ type: 'error', message: v.message ?? '头像 URL 不合法' });
      return;
    }
    setSaving(true);
    try {
      const res = await getApi().updateProfile({ avatar_url: avatarUrl || undefined });
      setUser(res.data);
      addToast({ type: 'success', message: '头像已更新' });
    } catch {
      addToast({ type: 'error', message: '更新失败' });
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    const v = validatePasswordChange(oldPassword, newPassword, confirmPassword);
    if (!v.valid) {
      addToast({ type: 'error', message: v.message ?? '密码不符合要求' });
      return;
    }
    try {
      await getApi().changePassword({ old_password: oldPassword, new_password: newPassword });
      await logout();
      navigate('/login', { replace: true });
      addToast({ type: 'success', message: '密码已修改，请重新登录' });
    } catch {
      addToast({ type: 'error', message: '旧密码不正确' });
    }
  };

  const copyId = () => {
    void navigator.clipboard.writeText(user.id);
    addToast({ type: 'info', message: '已复制用户 ID' });
  };

  const initial = user.username.charAt(0).toUpperCase();

  return (
    <div className="page profile-page">
      <GlassCard className="profile-header glass-card--overview-outer">
        {avatarUrl || user.avatar_url ? (
          <img
            src={avatarUrl || user.avatar_url}
            alt=""
            className="profile-header__avatar"
          />
        ) : (
          <span className="profile-header__avatar profile-header__avatar--placeholder">
            {initial}
          </span>
        )}
        <h1>{user.username}</h1>
        <p className="profile-header__hint">v1.0 用户名注册后不可修改</p>
      </GlassCard>

      <GlassCard className="glass-card--overview-outer">
        <h2>账号信息</h2>
        <dl className="profile-dl">
          <dt>用户 ID</dt>
          <dd className="font-mono">
            {user.id}
            <button type="button" className="btn btn-ghost btn-sm" onClick={copyId}>
              复制
            </button>
          </dd>
          {user.email && (
            <>
              <dt>邮箱</dt>
              <dd>{user.email}</dd>
            </>
          )}
          {user.github_login && (
            <>
              <dt>GitHub</dt>
              <dd>{user.github_login}</dd>
            </>
          )}
          <dt>注册时间</dt>
          <dd>{formatDateTime(user.created_at)}</dd>
        </dl>
      </GlassCard>

      <GlassCard className="glass-card--overview-outer">
        <h2>头像 URL</h2>
        <input
          className="input"
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          placeholder="https://avatars.githubusercontent.com/…"
        />
        <button
          type="button"
          className="btn btn-primary"
          disabled={saving}
          onClick={() => void saveAvatar()}
        >
          更新头像
        </button>
      </GlassCard>

      <GlassCard className="glass-card--overview-outer">
        <h2>学习画像（Agent 共享）</h2>
        <p className="muted small">
          由 Hub 统筹维护：各 Agent 提交提案，证据加权合并后写入。可在此查看与补充摘要。
        </p>
        {learningProfile ? (
          <>
            <dl className="profile-dl">
              <dt>历史摘要</dt>
              <dd>{learningProfile.history_summary || '暂无'}</dd>
              <dt>技术熟练度</dt>
              <dd>
                {Object.keys(learningProfile.tech_proficiency || {}).length === 0
                  ? '暂无'
                  : Object.entries(learningProfile.tech_proficiency)
                      .map(([k, v]) => `${k}: ${String(v)}`)
                      .join(' · ')}
              </dd>
              <dt>学习偏好</dt>
              <dd>
                {Object.keys(learningProfile.learning_preferences || {}).length === 0
                  ? '暂无'
                  : JSON.stringify(learningProfile.learning_preferences)}
              </dd>
              <dt>目标</dt>
              <dd>
                {(learningProfile.goals ?? []).length === 0
                  ? '暂无'
                  : learningProfile.goals.map((g) => g.title).join('；')}
              </dd>
              <dt>长期记忆</dt>
              <dd>
                {(() => {
                  const items = learningProfile.memory_items ?? [];
                  return items.length === 0
                    ? '暂无'
                    : items
                        .slice(0, 8)
                        .map((m) => m.content)
                        .join(' · ');
                })()}
              </dd>
            </dl>
            <label className="form-field">
              更新历史摘要
              <textarea
                className="input"
                rows={3}
                value={summaryDraft || learningProfile.history_summary || ''}
                onChange={(e) => setSummaryDraft(e.target.value)}
                placeholder="描述你的学习背景与目标…"
              />
            </label>
            <button
              type="button"
              className="btn btn-primary"
              onClick={async () => {
                try {
                  await getApi().updateUserProfile({
                    history_summary: summaryDraft || learningProfile.history_summary,
                  });
                  void refetchProfile();
                  addToast({ type: 'success', message: '学习画像已更新' });
                } catch {
                  addToast({ type: 'error', message: '更新失败' });
                }
              }}
            >
              保存画像
            </button>
          </>
        ) : (
          <p className="muted">加载中…</p>
        )}
      </GlassCard>

      <GlassCard className="glass-card--overview-outer">
        <h2>修改密码</h2>
        <label className="form-field">
          旧密码
          <input
            className="input"
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
          />
        </label>
        <label className="form-field">
          新密码
          <input
            className="input"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </label>
        <label className="form-field">
          确认新密码
          <input
            className="input"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </label>
        {newPassword && !validatePassword(newPassword).valid && (
          <p className="form-hint">{validatePassword(newPassword).message}</p>
        )}
        <button type="button" className="btn btn-primary" onClick={() => void changePassword()}>
          修改密码
        </button>
      </GlassCard>

      <GlassCard className="danger-zone">
        <h2>危险区</h2>
        <button
          type="button"
          className="btn btn-danger"
          onClick={async () => {
            await logout();
            navigate('/login', { replace: true });
          }}
        >
          退出登录
        </button>
      </GlassCard>
    </div>
  );
}
