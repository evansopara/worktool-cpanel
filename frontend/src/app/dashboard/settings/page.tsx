'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import Header from '@/components/layout/Header';
import { authApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { roleLabel } from '@/lib/utils';

export default function SettingsPage() {
  const { user, setUser } = useAuth();

  const [profile, setProfile] = useState({
    first_name: user?.first_name ?? '',
    last_name: user?.last_name ?? '',
    phone: user?.phone ?? '',
  });

  const [passwords, setPasswords] = useState({
    current_password: '',
    password: '',
    password_confirmation: '',
  });

  const profileMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => authApi.updateProfile(data),
    onSuccess: (res) => {
      setUser(res.data);
      toast.success('Profile updated');
    },
    onError: () => toast.error('Failed to update profile'),
  });

  const passwordMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => authApi.changePassword(data),
    onSuccess: () => {
      toast.success('Password changed');
      setPasswords({ current_password: '', password: '', password_confirmation: '' });
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error?.response?.data?.message ?? 'Failed to change password');
    },
  });

  return (
    <div>
      <Header title="Settings" />
      <div className="p-6 max-w-2xl space-y-6">
        {/* Profile info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 pb-2">
              <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-xl font-bold text-primary-foreground">
                {(user?.first_name?.[0] ?? '') + (user?.last_name?.[0] ?? '')}
              </div>
              <div>
                <p className="font-medium">{user?.first_name} {user?.last_name}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{roleLabel(user?.role ?? '')}</p>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>First Name</Label>
                <Input value={profile.first_name} onChange={(e) => setProfile({ ...profile, first_name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Last Name</Label>
                <Input value={profile.last_name} onChange={(e) => setProfile({ ...profile, last_name: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
            </div>
            <Button
              onClick={() => profileMutation.mutate(profile)}
              disabled={profileMutation.isPending}
            >
              {profileMutation.isPending ? 'Saving...' : 'Save Profile'}
            </Button>
          </CardContent>
        </Card>

        {/* Change password */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Change Password</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Current Password</Label>
              <Input type="password" value={passwords.current_password} onChange={(e) => setPasswords({ ...passwords, current_password: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>New Password</Label>
              <Input type="password" value={passwords.password} onChange={(e) => setPasswords({ ...passwords, password: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Confirm New Password</Label>
              <Input type="password" value={passwords.password_confirmation} onChange={(e) => setPasswords({ ...passwords, password_confirmation: e.target.value })} />
            </div>
            <Button
              onClick={() => passwordMutation.mutate(passwords)}
              disabled={!passwords.current_password || !passwords.password || passwordMutation.isPending}
            >
              {passwordMutation.isPending ? 'Changing...' : 'Change Password'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
