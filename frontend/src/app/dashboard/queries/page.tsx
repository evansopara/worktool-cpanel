'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import Header from '@/components/layout/Header';
import { queriesApi, usersApi } from '@/lib/api';
import { StaffQuery, User } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { timeAgo, formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { Plus, AlertTriangle, User as UserIcon, Calendar, CheckCircle2, XCircle, Trash2 } from 'lucide-react';

const TARGET_ROLES = ['project_manager', 'staff', 'intern', 'customer_support_officer'];
const ISSUER_ROLES = ['operations_manager', 'team_lead'];

const STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-700' },
  acknowledged: { label: 'Acknowledged', className: 'bg-green-100 text-green-700' },
  contested: { label: 'Contested', className: 'bg-red-100 text-red-600' },
};

const emptyForm = { subject: '', message: '', assigned_to: '' };

export default function QueriesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [contestId, setContestId] = useState<number | null>(null);
  const [contestReason, setContestReason] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const isManager = ISSUER_ROLES.includes(user?.role ?? '');

  const { data: queries = [], isLoading } = useQuery<StaffQuery[]>({
    queryKey: ['queries'],
    queryFn: () => queriesApi.list().then((r) => r.data),
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => usersApi.list().then((r) => r.data),
    enabled: isManager,
  });

  const targets = users.filter((u) => TARGET_ROLES.includes(u.role));

  const resetForm = () => setForm(emptyForm);

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => queriesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['queries'] });
      toast.success('Query sent');
      setOpen(false);
      resetForm();
    },
    onError: () => toast.error('Failed to send query'),
  });

  const respondMutation = useMutation({
    mutationFn: ({ id, status, response }: { id: number; status: 'acknowledged' | 'contested'; response?: string }) =>
      queriesApi.respond(id, status, response),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['queries'] });
      toast.success(variables.status === 'acknowledged' ? 'Query acknowledged' : 'Query contested');
      setContestId(null);
      setContestReason('');
    },
    onError: () => toast.error('Failed to respond'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => queriesApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['queries'] });
      toast.success('Query removed');
      setDeleteId(null);
    },
    onError: () => toast.error('Failed to remove query'),
  });

  const canSubmit = form.subject && form.message && form.assigned_to && !createMutation.isPending;

  return (
    <div>
      <Header title="Staff Queries" />
      <div className="p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">{isManager ? 'Staff Queries Management' : 'Staff Queries'}</h1>
            <p className="text-muted-foreground mt-1">
              {isManager ? 'Send and track queries issued to staff' : 'View all queries issued across the team'}
            </p>
          </div>

          {isManager && (
            <Button
              className="w-full sm:w-auto shrink-0 rounded-xl h-11 px-5 bg-slate-900 hover:bg-slate-800 text-white"
              onClick={() => { resetForm(); setOpen(true); }}
            >
              <Plus className="w-4 h-4 mr-1.5" /> Send Query
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-40 bg-muted animate-pulse rounded-2xl" />)}</div>
        ) : queries.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No queries yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {queries.map((q) => {
              const meta = STATUS_META[q.status] ?? { label: q.status, className: 'bg-slate-100 text-slate-700' };
              const isTarget = q.assigned_to === user?.id;
              const canManage = q.submitted_by === user?.id || isManager;
              return (
                <div key={q.id} className="border rounded-2xl p-6 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold">{q.subject}</h3>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={`text-xs font-semibold px-3 py-1 rounded-full ${meta.className}`}>{meta.label}</span>
                    </div>
                    <p className="text-muted-foreground mt-3">{q.message}</p>
                    <div className="flex items-start gap-8 mt-4 text-sm text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-2">
                        <UserIcon className="w-4 h-4" />
                        Issued by {q.submitter?.first_name} {q.submitter?.last_name}
                      </span>
                      <span className="flex items-center gap-2">
                        <UserIcon className="w-4 h-4" />
                        Issued to {q.assignee?.first_name} {q.assignee?.last_name}
                      </span>
                      <span className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {timeAgo(q.created_at)}
                      </span>
                    </div>

                    {q.response && (
                      <div className={`mt-3 p-3 rounded-xl border ${q.status === 'acknowledged' ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                        <div className={`flex items-center gap-1.5 font-semibold text-sm ${q.status === 'acknowledged' ? 'text-green-700' : 'text-red-700'}`}>
                          {q.status === 'acknowledged' ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                          {q.status === 'acknowledged' ? 'Comment:' : 'Contest Reason:'}
                        </div>
                        <p className={`text-sm mt-1 ${q.status === 'acknowledged' ? 'text-green-700' : 'text-red-700'}`}>{q.response}</p>
                        {q.responded_at && (
                          <p className={`text-xs mt-1 ${q.status === 'acknowledged' ? 'text-green-500/80' : 'text-red-500/80'}`}>
                            Added: {formatDate(q.responded_at, "M/d/yyyy 'at' h:mm:ss a")}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {isTarget && q.status === 'pending' && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className="rounded-xl bg-green-600 hover:bg-green-700 text-white"
                          disabled={respondMutation.isPending}
                          onClick={() => respondMutation.mutate({ id: q.id, status: 'acknowledged' })}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1.5" /> Acknowledge
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl border-red-200 text-red-600 hover:bg-red-50"
                          onClick={() => { setContestId(q.id); setContestReason(''); }}
                        >
                          <XCircle className="w-4 h-4 mr-1.5" /> Contest
                        </Button>
                      </div>
                    )}
                    {canManage && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="rounded-xl h-10 w-10 border-red-200 text-red-500 hover:bg-red-50"
                        onClick={() => setDeleteId(q.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Send query dialog */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Send Query</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1">
              <Label>Staff Member</Label>
              <Select value={form.assigned_to} onValueChange={(v) => setForm({ ...form, assigned_to: v as string })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a staff member...">
                    {(v: string | null) => {
                      const u = targets.find((t) => String(t.id) === v);
                      return u ? `${u.first_name} ${u.last_name}` : 'Select a staff member...';
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {targets.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.first_name} {u.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Subject</Label>
              <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Message</Label>
              <Textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={4} />
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => createMutation.mutate(form)} disabled={!canSubmit}>
                {createMutation.isPending ? 'Sending...' : 'Send'}
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Contest dialog */}
      <Dialog open={!!contestId} onOpenChange={(v) => !v && setContestId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Contest Query</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <Textarea
              value={contestReason}
              onChange={(e) => setContestReason(e.target.value)}
              placeholder="Explain why you believe this query is unwarranted..."
              rows={4}
            />
            <div className="flex gap-2">
              <Button
                variant="destructive"
                className="flex-1"
                disabled={!contestReason.trim() || respondMutation.isPending}
                onClick={() => respondMutation.mutate({ id: contestId!, status: 'contested', response: contestReason })}
              >
                {respondMutation.isPending ? 'Submitting...' : 'Submit Contest'}
              </Button>
              <Button variant="outline" onClick={() => setContestId(null)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Delete Query</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground mt-1">
            Are you sure you want to delete this query? This action cannot be undone.
          </p>
          <div className="flex gap-2 mt-4">
            <Button
              variant="destructive"
              className="flex-1"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate(deleteId!)}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Yes, Delete'}
            </Button>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
