import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Pizza, Mail, Lock, AlertCircle } from 'lucide-react';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/store/auth';
import type { ApiError } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

type FormData = z.infer<typeof schema>;

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setAccessToken, setUser } = useAuthStore();
  const [loginError, setLoginError] = useState<string | null>(null);
  const searchParams = new URLSearchParams(location.search);
  const rawRedirect = searchParams.get('redirect') || '/';
  // Prevent open redirect attacks — only allow internal paths
  const isInternalPath = (path: string) => path.startsWith('/') && !path.startsWith('//') && !path.includes('://');
  const redirectTo = isInternalPath(rawRedirect) ? rawRedirect : '/';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { rememberMe: false },
  });

  const { mutate: login, isPending } = useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      setLoginError(null);
      setAccessToken(data.accessToken);
      setUser(data.user);
      navigate(redirectTo, { replace: true });
      toast.success(`Welcome back, ${data.user.firstName}!`);
    },
    onError: (err: ApiError) => {
      if (err.status === 423) {
        setLoginError('Your account has been locked. Please contact an administrator.');
      } else if (err.status === 401) {
        setLoginError('Invalid email or password. Please check your credentials and try again.');
      } else if (err.status === 429) {
        setLoginError('Too many login attempts. Please wait a few minutes and try again.');
      } else {
        setLoginError(err.message || 'Login failed. Please try again.');
      }
    },
  });

  const onSubmit = (data: FormData) => {
    setLoginError(null);
    login({ email: data.email, password: data.password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="bg-red-600 p-3 rounded-2xl mb-3">
            <Pizza className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Pizza Box Manager</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Sign in to your account
          </p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {loginError && (
              <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-400">{loginError}</p>
              </div>
            )}
            <Input
              label="Email address"
              type="email"
              placeholder="you@example.com"
              required
              disabled={isPending}
              error={errors.email?.message}
              leftIcon={<Mail className="h-4 w-4" />}
              {...register('email')}
            />
            <Input
              label="Password"
              type="password"
              placeholder="Enter your password"
              required
              disabled={isPending}
              error={errors.password?.message}
              leftIcon={<Lock className="h-4 w-4" />}
              {...register('password')}
            />

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                  {...register('rememberMe')}
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">Remember me</span>
              </label>
              <Link
                to="/forgot-password"
                className="text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400"
              >
                Forgot password?
              </Link>
            </div>

            <Button type="submit" className="w-full" loading={isPending}>
              Sign in
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-6">
          &copy; {new Date().getFullYear()} Pizza Box Manager. All rights reserved.
        </p>
      </div>
    </div>
  );
}
