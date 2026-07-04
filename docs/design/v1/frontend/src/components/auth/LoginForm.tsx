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
      // error 已由 store 设置
    } finally {
      setSubmitting(false);
    }
  };

  const busy = submitting || isLoading;

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      {(fieldError || error) && (
        <div className="error-banner" role="alert">
          {fieldError ?? error}
        </div>
      )}
      <label className="form-field">
        <span>用户名</span>
        <input
          className="input"
          type="text"
          name="username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={busy}
        />
      </label>
      <label className="form-field">
        <span>密码</span>
        <input
          className="input"
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
        />
      </label>
      <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
        {busy ? <LoadingSpinner label="" /> : '登录'}
      </button>
      <p className="auth-form__footer">
        还没有账号？ <Link to="/register">注册</Link>
      </p>
    </form>
  );
}
