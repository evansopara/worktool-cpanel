'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useAuth } from '@/providers/AuthProvider';
import { authApi } from '@/lib/api';
import { Sheet, SheetActions, SheetDescription, SheetTitle } from '@/components/wc';
import { AuthField, AuthLayout, PasswordInput, authButton, authInput } from '@/components/auth/AuthLayout';

const schema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

type FormData = z.infer<typeof schema>;

function ForgotPassword() {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!username.trim()) {
      toast.error('Enter your username first.');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.forgotPassword(username.trim());
      toast.success(res.data?.message ?? 'If that username exists, a password setup link has been sent to the associated email.');
      setOpen(false);
      setUsername('');
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cursor-pointer self-center rounded-full border-0 bg-transparent px-3 py-2 font-ui text-[15px] font-semibold text-ink outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ink"
      >
        Forgot password?
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTitle>Reset your password</SheetTitle>
        <SheetDescription>Enter your username and we’ll email a password setup link to the address on your account.</SheetDescription>
        <AuthField label="Username" htmlFor="forgot-username">
          <input
            id="forgot-username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
            className={authInput}
          />
        </AuthField>
        <SheetActions confirmLabel={loading ? 'Sending…' : 'Send reset link'} confirmDisabled={loading} onConfirm={onSubmit} />
      </Sheet>
    </>
  );
}

export default function AuthPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      await login(data.username, data.password);
      router.replace('/dashboard');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error?.response?.data?.message ?? 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Sign in" intro="Contact your manager if you need an account.">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-[18px]" noValidate>
        <AuthField label="Username" htmlFor="username" error={errors.username?.message}>
          <input id="username" type="text" autoComplete="username" aria-invalid={!!errors.username} className={authInput} {...register('username')} />
        </AuthField>
        <AuthField label="Password" htmlFor="password" error={errors.password?.message}>
          <PasswordInput id="password" autoComplete="current-password" aria-invalid={!!errors.password} {...register('password')} />
        </AuthField>
        <button type="submit" disabled={loading} className={authButton}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
        <ForgotPassword />
      </form>
    </AuthLayout>
  );
}
