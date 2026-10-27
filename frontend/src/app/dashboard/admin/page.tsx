'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Header from '@/components/layout/Header';
import { usersApi } from '@/lib/api';
import { User } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { statusColor, roleLabel, getInitials, timeAgo } from '@/lib/utils';
import { toast } from 'sonner';
import { Plus, Shield, KeyRound, UserX, UserCheck } from 'lucide-react';

const ADMIN_ROLES = ['operations_manager', 'team_lead'];

export default function AdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    first_name: '', last_name: '', username: '', email: '', role: 'staff', specialization: '', department: '',
  });

  const isOpsManager = user?.role === 'operations_manager';
  const canManageUsers = ADMIN_ROLES.includes(user?.role ?? '');

  useEffect(() => {
    if (user && !ADMIN_ROLES.includes(user.role)) {
      router.replace('/dashboard');
    }
  }, [user, router]);

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['users', 'all'],
    queryFn: () => usersApi.listAll().then((r) => r.data),
    enabled: canManageUsers,
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => usersApi.create(data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success(`User created. A password setup email was sent to ${res.data.user.email}.`);
      setOpen(false);
      setForm({ first_name: '', last_name: '', username: '', email: '', role: 'staff', specialization: '', department: '' });
    },
    onError: () => toast.error('Failed to create user'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => usersApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => usersApi.deactivate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('User deactivated. Their sessions were ended and they can no longer log in.');
    },
    onError: () => toast.error('Failed to deactivate user'),
  });

  const activateMutation = useMutation({
    mutationFn: (id: number) => usersApi.activate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('User activated. They can log in again.');
    },
    onError: () => toast.error('Failed to activate user'),
  });

  const resetTokenMutation = useMutation({
    mutationFn: (id: number) => usersApi.resetPasswordToken(id),
    onSuccess: () => {
      toast.success('A password setup email has been sent to the user.');
    },
    onError: () => toast.error('Failed to send password reset email'),
  });

  const [editingEmailId, setEditingEmailId] = useState<number | null>(null);
  const [emailDraft, setEmailDraft] = useState('');

  const saveEmail = (id: number) => {
    setEditingEmailId(null);
    updateMutation.mutate({ id, data: { email: emailDraft.trim() || null } });
  };

  if (!canManageUsers) return null;

  const activeUsers = users.filter((u) => u.is_active);
  const deactivatedUsers = users.filter((u) => !u.is_active);

  const renderUserTable = (list: User[], emptyLabel: string) => (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left p-3 font-medium text-muted-foreground">User</th>
            <th className="text-left p-3 font-medium text-muted-foreground">Username</th>
            <th className="text-left p-3 font-medium text-muted-foreground">Role</th>
            <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
            <th className="text-left p-3 font-medium text-muted-foreground">Joined</th>
            <th className="text-right p-3 font-medium text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody>
          {list.length === 0 ? (
            <tr>
              <td colSpan={6} className="p-6 text-center text-muted-foreground text-sm">{emptyLabel}</td>
            </tr>
          ) : (
            list.map((u) => (
              <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                <td className="p-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {getInitials(u.first_name, u.last_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">{u.first_name} {u.last_name}</p>
                      {editingEmailId === u.id ? (
                        <Input
                          autoFocus
                          type="email"
                          value={emailDraft}
                          onChange={(e) => setEmailDraft(e.target.value)}
                          onBlur={() => saveEmail(u.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEmail(u.id);
                            if (e.key === 'Escape') setEditingEmailId(null);
                          }}
                          placeholder="name@example.com"
                          className="h-6 text-xs px-1.5 w-44"
                        />
                      ) : isOpsManager ? (
                        <button
                          type="button"
                          className="text-xs text-muted-foreground hover:text-foreground hover:underline text-left"
                          onClick={() => {
                            setEmailDraft(u.email ?? '');
                            setEditingEmailId(u.id);
                          }}
                        >
                          {u.email || 'Add email…'}
                        </button>
                      ) : (
                        <p className="text-xs text-muted-foreground">{u.email || '—'}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="p-3 text-xs text-muted-foreground">{u.username}</td>
                <td className="p-3">
                  {isOpsManager ? (
                    <Select value={u.role} onValueChange={(v) => updateMutation.mutate({ id: u.id, data: { role: v } })}>
                      <SelectTrigger className="h-7 text-xs w-36 border-0 bg-transparent p-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {['operations_manager', 'team_lead', 'project_manager', 'staff', 'intern', 'customer_support_officer', 'client'].map((r) => (
                          <SelectItem key={r} value={r} className="text-xs">{roleLabel(r)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-xs">{roleLabel(u.role)}</span>
                  )}
                </td>
                <td className="p-3">
                  {isOpsManager ? (
                    <Select value={u.status} onValueChange={(v) => updateMutation.mutate({ id: u.id, data: { status: v } })}>
                      <SelectTrigger className="h-7 text-xs w-24 border-0 bg-transparent p-0">
                        <Badge className={`text-xs ${statusColor(u.status)}`} variant="outline">{u.status}</Badge>
                      </SelectTrigger>
                      <SelectContent>
                        {['active', 'inactive', 'pending'].map((s) => (
                          <SelectItem key={s} value={s} className="text-xs capitalize">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge className={`text-xs ${statusColor(u.status)}`} variant="outline">{u.status}</Badge>
                  )}
                </td>
                <td className="p-3 text-xs text-muted-foreground">{timeAgo(u.created_at)}</td>
                <td className="p-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {isOpsManager && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-primary"
                        title="Send password setup email"
                        onClick={() => resetTokenMutation.mutate(u.id)}
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {u.is_active ? (
                      u.id !== user?.id && u.role !== 'team_lead' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          title="Deactivate user"
                          onClick={() => {
                            if (confirm(`Deactivate ${u.first_name} ${u.last_name}? They will be logged out immediately and won't be able to log back in until reactivated.`)) {
                              deactivateMutation.mutate(u.id);
                            }
                          }}
                        >
                          <UserX className="w-3.5 h-3.5" />
                        </Button>
                      )
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-green-600"
                        title="Activate user"
                        onClick={() => activateMutation.mutate(u.id)}
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div>
      <Header title="Admin Panel" />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{users.length} users total</span>
          </div>
          {isOpsManager && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger render={<Button size="sm" />}>
                <Plus className="w-4 h-4 mr-1" /> Create User
                </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Create New User</DialogTitle></DialogHeader>
                <div className="space-y-3 mt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>First Name</Label>
                      <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Last Name</Label>
                      <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Username</Label>
                    <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Email</Label>
                    <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@example.com" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Role</Label>
                      <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as string })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {['operations_manager', 'team_lead', 'project_manager', 'staff', 'intern', 'customer_support_officer', 'client'].map((r) => (
                            <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Specialization</Label>
                      <Input value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} placeholder="e.g. developer" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Department</Label>
                    <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
                  </div>
                  <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
                    A password setup link will be emailed to the user.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      onClick={() => createMutation.mutate(form)}
                      disabled={!form.first_name || !form.last_name || !form.username || !form.email || createMutation.isPending}
                    >
                      {createMutation.isPending ? 'Creating...' : 'Create User'}
                    </Button>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />)}</div>
        ) : (
          <>
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-foreground">Active Users ({activeUsers.length})</h2>
              {renderUserTable(activeUsers, 'No active users')}
            </div>
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-foreground">Deactivated Users ({deactivatedUsers.length})</h2>
              {renderUserTable(deactivatedUsers, 'No deactivated users')}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
