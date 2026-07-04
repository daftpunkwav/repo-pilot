import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

export function RegisterPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) return <LoadingSpinner fullScreen />;
  if (isAuthenticated) return <Navigate to="/" replace />;

  return (
    <AuthLayout title="注册" subtitle="创建 RepoPilot 账号">
      <RegisterForm />
    </AuthLayout>
  );
}
