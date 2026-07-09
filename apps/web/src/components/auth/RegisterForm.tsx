import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { validateRegisterForm } from '@/utils/validators';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

export function RegisterForm() {
  const { register, error, clearError } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    const validation = validateRegisterForm(username, password, confirmPassword);
    if (!validation.valid) {
      setFieldError(validation.message ?? '表单校验失败');
      return;
    }
    setFieldError(null);
    setSubmitting(true);
    try {
      await register(username, password);
      navigate('/', { replace: true });
    } catch {
      // store 已处理
    } finally {
      setSubmitting(false);
    }
  };

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
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={submitting}
        />
      </label>
      <label className="form-field">
        <span>密码</span>
        <input
          className="input"
          type="password"
          name="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={submitting}
        />
      </label>
      <label className="form-field">
        <span>确认密码</span>
        <input
          className="input"
          type="password"
          name="confirmPassword"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={submitting}
        />
      </label>
      <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
        {submitting ? <LoadingSpinner label="" /> : '注册'}
      </button>
      <p className="auth-form__footer">
        已有账号？ <Link to="/login">登录</Link>
      </p>
    </form>
  );
}
