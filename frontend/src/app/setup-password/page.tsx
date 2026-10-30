'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { authApi } from '@/lib/api';
import { AuthField, AuthLayout, PasswordInput, authButton } from '@/components/auth/AuthLayout';

const schema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    password_confirmation: z.string(),
  })
  .refine((d) => d.password === d.password_confirmation, {
    message: 'Passwords do not match',
    path: ['password_confirmation'],
  });

type FormData = z.infer<typeof schema>;

function SetupPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    if (!token) {
      toast.error('Invalid or missing token.');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.setupPassword(token, data.password, data.password_confirmation);
      const { token: authToken, user } = res.data;
      localStorage.setItem('auth_token', authToken);
      localStorage.setItem('auth_user', JSON.stringify(user));
      toast.success('Password set successfully!');
      router.replace('/dashboard');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error?.response?.data?.message ?? 'Failed to set password.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthLayout title="Link not valid" intro="This password link is missing its token. Ask your manager to send a new one.">
        <a href="/auth" className={`${authButton} flex items-center justify-center no-underline`}>
          Back to sign in
        </a>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Set your password" intro="Choose a password for your account. Use at least 8 characters.">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-[18px]" noValidate>
        <AuthField label="New password" htmlFor="password" error={errors.password?.message}>
          <PasswordInput id="password" autoComplete="new-password" aria-invalid={!!errors.password} {...register('password')} />
        </AuthField>
        <AuthField label="Confirm password" htmlFor="password_confirmation" error={errors.password_confirmation?.message}>
          <PasswordInput id="password_confirmation" autoComplete="new-password" aria-invalid={!!errors.password_confirmation} {...register('password_confirmation')} />
        </AuthField>
        <button type="submit" disabled={loading} className={authButton}>
          {loading ? 'Setting password…' : 'Set password'}
        </button>
      </form>
    </AuthLayout>
  );
}

export default function SetupPasswordPage() {
  return (
    <Suspense>
      <SetupPasswordForm />
    </Suspense>
  );
}
