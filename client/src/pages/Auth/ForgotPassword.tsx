import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Pizza, Mail, CheckCircle } from 'lucide-react';
import { authApi } from '@/api/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const schema = z.object({
  email: z.string().email('Invalid email address'),
});
type FormData = z.infer<typeof schema>;

export default function ForgotPassword() {
  const [sent, setSent] = useState(false);
  const [devResetLink, setDevResetLink] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const { mutate, isPending } = useMutation({
    mutationFn: ({ email }: FormData) => authApi.forgotPassword(email),
    onSuccess: (result: { message: string; resetLink?: string }) => {
      setSent(true);
      // In dev mode, the server returns the reset link
      if (result?.resetLink) {
        setDevResetLink(result.resetLink);
      }
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-red-600 p-3 rounded-2xl mb-3">
            <Pizza className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Forgot Password</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            We'll send you a reset link
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          {sent ? (
            <div className="flex flex-col items-center text-center gap-4 py-4">
              <CheckCircle className="h-12 w-12 text-green-500" />
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Check your email</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  If an account exists with that email, you'll receive a password reset link shortly.
                </p>
              </div>
              {devResetLink && (
                <div className="w-full mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <p className="text-xs font-medium text-yellow-700 dark:text-yellow-400 mb-1">Dev Mode — Reset Link:</p>
                  <Link
                    to={new URL(devResetLink).pathname}
                    className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 break-all underline"
                  >
                    {devResetLink}
                  </Link>
                </div>
              )}
              <Link
                to="/login"
                className="text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit((d) => mutate(d))} className="space-y-4">
              <Input
                label="Email address"
                type="email"
                placeholder="you@example.com"
                required
                error={errors.email?.message}
                leftIcon={<Mail className="h-4 w-4" />}
                {...register('email')}
              />
              <Button type="submit" className="w-full" loading={isPending}>
                Send reset link
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
