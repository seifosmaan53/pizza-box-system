import { useMutation, useQuery } from '@tanstack/react-query';
import type { User } from '@/types';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/store/auth';
import { queryClient } from '@/lib/queryClient';
import type { LoginRequest } from '@/types';

export function useAuth() {
  const { user, accessToken, setAccessToken, setUser, logout: logoutStore } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const loginMutation = useMutation({
    mutationFn: (data: LoginRequest) => authApi.login(data),
    onSuccess: (data) => {
      setAccessToken(data.accessToken);
      setUser(data.user);
      const redirectTo = (location.state as { from?: string })?.from || '/';
      navigate(redirectTo, { replace: true });
      toast.success(`Welcome back, ${data.user.firstName}!`);
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message || 'Login failed. Please check your credentials.');
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: () => {
      logoutStore();
      queryClient.clear();
      navigate('/login');
      toast.success('Logged out successfully');
    },
  });

  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ['me'],
    queryFn: authApi.getMe,
    enabled: !!accessToken && !user,
    retry: false,
    onSuccess: (data: User) => setUser(data),
  } as Parameters<typeof useQuery>[0]);

  return {
    user: user || me,
    accessToken,
    isAuthenticated: !!accessToken,
    isLoading: meLoading,
    login: loginMutation.mutate,
    loginAsync: loginMutation.mutateAsync,
    isLoginLoading: loginMutation.isPending,
    loginError: loginMutation.error,
    logout: logoutMutation.mutate,
    isLogoutLoading: logoutMutation.isPending,
  };
}
