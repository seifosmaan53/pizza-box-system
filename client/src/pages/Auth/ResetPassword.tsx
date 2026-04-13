import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Pizza, Lock, CheckCircle } from 'lucide-react';
import { authApi } from '@/api/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const schema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;

export default function ResetPassword() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const { mutate, isPending } = useMutation({
    mutationFn: (data: FormData) => authApi.resetPassword(token!, data.password),
    onSuccess: () => {
      setSuccess(true);
      timerRef.current = setTimeout(() => navigate('/login'), 3000);
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message || 'Reset link is invalid or expired.');
    },
  });

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-500">Invalid reset link.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-red-600 p-3 rounded-2xl mb-3">
            <Pizza className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Reset Password</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Enter your new password
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          {success ? (
            <div className="flex flex-col items-center text-center gap-4 py-4">
              <CheckCircle className="h-12 w-12 text-green-500" />
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Password reset!</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Redirecting you to sign in…
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit((d) => mutate(d))} className="space-y-4">
              <Input
                label="New password"
                type="password"
                placeholder="At least 8 characters"
                required
                error={errors.password?.message}
                leftIcon={<Lock className="h-4 w-4" />}
                {...register('password')}
              />
              <Input
                label="Confirm password"
                type="password"
                placeholder="Repeat your password"
                required
                error={errors.confirmPassword?.message}
                leftIcon={<Lock className="h-4 w-4" />}
                {...register('confirmPassword')}
              />
              <Button type="submit" className="w-full" loading={isPending}>
                Reset password
              </Button>
              <div className="text-center">
                <Link
                  to="/login"
                  className="text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400"
                >
                  Back to sign in
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
