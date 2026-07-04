import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { validateLoginForm } from '@/utils/validators';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

export function LoginForm() {
  const { login, error, clearError, isLoading } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    const validation = validateLoginForm(username, password);
    if (!validation.valid) {
      setFieldError(validation.message ?? '表单校验失败');
      return;
    }
    setFieldError(null);
    setSubmitting(true);
    try {
      await login(username, password);
      navigate('/', { replace: true });
    } catch {
      // store 已设置 error
    } finally {
      setSubmitting(false);
    }
  };

  const busy = submitting || isLoading;

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      {(fieldError || error) && (
        <div className="auth-alert" role="alert">
          <strong>{fieldError ?? error}</strong>
        </div>
      )}
      <div className="field-group">
        <label htmlFor="login-username">用户名</label>
        <input
          id="login-username"
          className="input"
          type="text"
          name="username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={busy}
        />
      </div>
      <div className="field-group">
        <label htmlFor="login-password">密码</label>
        <input
          id="login-password"
          className="input"
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
        />
      </div>
      <button type="submit" className="auth-btn" disabled={busy}>
        {busy ? <LoadingSpinner label="" /> : '登录'}
      </button>
      <div className="auth-divider" />
      <p className="auth-bottom">
        还没有账号？ <Link to="/register">注册</Link>
      </p>
    </form>
  );
}
