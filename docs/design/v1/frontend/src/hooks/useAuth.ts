import { useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';

export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);
  const register = useAuthStore((s) => s.register);
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const clearError = useAuthStore((s) => s.clearError);

  const handleLogin = useCallback(
    (username: string, password: string) => login(username, password),
    [login]
  );

  const handleRegister = useCallback(
    (username: string, password: string) => register(username, password),
    [register]
  );

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    login: handleLogin,
    logout,
    register: handleRegister,
    fetchMe,
    clearError,
  };
}
