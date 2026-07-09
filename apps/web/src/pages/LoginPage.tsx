import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { LoginForm } from '@/components/auth/LoginForm';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

export function LoginPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const location = useLocation();

  if (isLoading) return <LoadingSpinner fullScreen />;
  if (isAuthenticated) {
    const from = (location.state as { from?: { pathname: string; search?: string } } | null)?.from;
    const target = from ? `${from.pathname}${from.search ?? ''}` : '/';
    return <Navigate to={target} replace />;
  }

  return (
    <AuthLayout title="登录" subtitle="使用你的 RepoPilot 账号">
      <LoginForm />
    </AuthLayout>
  );
}
