'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/providers/AuthProvider';
import { authApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

const schema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

type FormData = z.infer<typeof schema>;

function ForgotPasswordDialog() {
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<button type="button" className="text-base font-semibold text-center w-full text-slate-900 hover:text-slate-600 mt-6" />}>
        Forgot Password?
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Reset your password</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-2">
          <p className="text-sm text-muted-foreground">
            Enter your username and we&apos;ll email a password setup link to the address on file for your account.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="forgot-username">Username</Label>
            <Input
              id="forgot-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="your username"
              onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
            />
          </div>
          <Button className="w-full" onClick={onSubmit} disabled={loading}>
            {loading ? 'Sending...' : 'Send Reset Link'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BackgroundArt() {
  return (
    <svg
      className="pointer-events-none fixed inset-0 h-full w-full"
      viewBox="0 0 1920 1080"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <line x1="383" y1="317" x2="191" y2="745" stroke="#a5e4ec" strokeWidth="1.5" opacity="0.6" />
      <line x1="383" y1="317" x2="958" y2="851" stroke="#a5e4ec" strokeWidth="1.5" opacity="0.6" />
      <line x1="191" y1="745" x2="958" y2="851" stroke="#a5e4ec" strokeWidth="1.5" opacity="0.6" />
      <circle cx="383" cy="317" r="7" fill="#67d5e3" />
      <circle cx="191" cy="745" r="7" fill="#67d5e3" />
      <circle cx="958" cy="851" r="6" fill="#8fb8dd" />

      <line x1="1534" y1="211" x2="1727" y2="637" stroke="#d6c8f7" strokeWidth="1.5" opacity="0.6" />
      <line x1="1534" y1="211" x2="958" y2="851" stroke="#d6c8f7" strokeWidth="1.5" opacity="0.6" />
      <line x1="1727" y1="637" x2="958" y2="851" stroke="#d6c8f7" strokeWidth="1.5" opacity="0.6" />
      <circle cx="1534" cy="211" r="7" fill="#c4a6f2" />
      <circle cx="1727" cy="637" r="7" fill="#c4a6f2" />
    </svg>
  );
}

export default function AuthPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

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
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-cyan-50 via-white to-violet-50">
      <BackgroundArt />
      <div className="w-full max-w-md px-4 relative z-10">
        <div className="bg-white rounded-2xl shadow-xl px-10 py-10">
          <h1 className="text-4xl font-bold text-slate-900 text-center">Login</h1>
          <p className="text-slate-400 text-center mt-2 mb-8">Contact your manager if you need an account</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-slate-900 font-medium">Username</Label>
              <Input
                id="username"
                type="text"
                className="h-12 rounded-lg border-slate-200"
                {...register('username')}
              />
              {errors.username && (
                <p className="text-xs text-destructive">{errors.username.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-slate-900 font-medium">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="h-12 rounded-lg border-slate-200 pr-10"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-12 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Login'}
            </Button>
            <ForgotPasswordDialog />
          </form>
        </div>
      </div>
    </div>
  );
}
