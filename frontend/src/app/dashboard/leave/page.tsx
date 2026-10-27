'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import Header from '@/components/layout/Header';
import { leaveApi } from '@/lib/api';
import { LeaveApplication } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { statusColor, formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { Calendar, Eye, Clock, CheckCircle2, XCircle, FileText, Mail } from 'lucide-react';

const LEAVE_TYPES = [
  { value: 'day_off', label: 'Day Off', description: 'Unlimited · Subject to approval' },
  { value: 'leave_of_absence', label: 'Leave of Absence', description: 'Max 14 days per year' },
];

const LEAVE_TYPE_STYLES: Record<string, string> = {
  day_off: 'bg-blue-100 text-blue-700',
  leave_of_absence: 'bg-purple-100 text-purple-700',
};

const ANNUAL_CAP = 14;

function leaveTypeLabel(type: string): string {
  return LEAVE_TYPES.find((t) => t.value === type)?.label ?? type.replace(/_/g, ' ');
}

export default function LeavePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'apply' | 'history'>('apply');
  const [form, setForm] = useState({ leave_type: '', start_date: '', end_date: '', reason: '' });
  const [decideId, setDecideId] = useState<number | null>(null);
  const [decision, setDecision] = useState({ status: 'approved', review_comment: '' });
  const [viewId, setViewId] = useState<number | null>(null);

  const { data: leaves = [], isLoading } = useQuery<LeaveApplication[]>({
    queryKey: ['leave'],
    queryFn: () => leaveApi.list().then((r) => r.data),
  });

  const decideLeave = leaves.find((l) => l.id === decideId) ?? null;
  const viewLeave = leaves.find((l) => l.id === viewId) ?? null;

  const currentYear = new Date().getFullYear();
  const usedLeaveOfAbsenceDays = leaves
    .filter((l) =>
      l.user_id === user?.id &&
      l.leave_type === 'leave_of_absence' &&
      l.status !== 'rejected' &&
      new Date(l.start_date).getFullYear() === currentYear
    )
    .reduce((sum, l) => sum + (l.total_days ?? 0), 0);
  const remainingLeaveOfAbsence = Math.max(0, ANNUAL_CAP - usedLeaveOfAbsenceDays);

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => leaveApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leave'] });
      toast.success('Leave application submitted');
      setForm({ leave_type: '', start_date: '', end_date: '', reason: '' });
      setTab('history');
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error?.response?.data?.message ?? 'Failed to submit application');
    },
  });

  const decideMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => leaveApi.decide(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leave'] });
      toast.success('Decision recorded');
      setDecideId(null);
    },
  });

  const canDecide = ['operations_manager', 'team_lead'].includes(user?.role ?? '');
  const myLeaves = leaves.filter((l) => l.user_id === user?.id);

  const decideDialog = (
    <Dialog open={!!decideId} onOpenChange={() => setDecideId(null)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Review Leave Application</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-2">
          {decideLeave && (
            <div className="space-y-1 rounded-md border bg-muted/30 p-3">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{leaveTypeLabel(decideLeave.leave_type)}</p>
                {decideLeave.user && (
                  <span className="text-xs text-muted-foreground">— {decideLeave.user.first_name} {decideLeave.user.last_name}</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatDate(decideLeave.start_date)} → {formatDate(decideLeave.end_date)}
              </p>
              <div className="space-y-0.5 pt-1">
                <Label className="text-xs text-muted-foreground">Reason</Label>
                <p className="text-sm whitespace-pre-wrap break-words">{decideLeave.reason || 'No reason provided'}</p>
              </div>
            </div>
          )}
          <div className="space-y-1">
            <Label>Decision</Label>
            <Select value={decision.status} onValueChange={(v) => setDecision({ ...decision, status: v as string })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="approved">Approve</SelectItem>
                <SelectItem value="rejected">Reject</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Comment (optional)</Label>
            <Textarea value={decision.review_comment} onChange={(e) => setDecision({ ...decision, review_comment: e.target.value })} rows={2} />
          </div>
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={() => decideMutation.mutate({ id: decideId!, data: decision })}
              disabled={decideMutation.isPending}
            >
              {decideMutation.isPending ? 'Saving...' : 'Confirm'}
            </Button>
            <Button variant="outline" onClick={() => setDecideId(null)}>Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  const viewDialog = (
    <Dialog open={!!viewId} onOpenChange={() => setViewId(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Leave Application Details</DialogTitle></DialogHeader>
        {viewLeave && (
          <div className="space-y-3 mt-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{leaveTypeLabel(viewLeave.leave_type)}</p>
              <Badge className={`text-xs ${statusColor(viewLeave.status)}`} variant="outline">{viewLeave.status}</Badge>
            </div>
            {viewLeave.user && (
              <p className="text-xs text-muted-foreground">
                Requested by {viewLeave.user.first_name} {viewLeave.user.last_name}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {formatDate(viewLeave.start_date)} → {formatDate(viewLeave.end_date)}
              {typeof viewLeave.total_days === 'number' && ` (${viewLeave.total_days} working day${viewLeave.total_days === 1 ? '' : 's'})`}
            </p>
            <div className="space-y-0.5">
              <Label className="text-xs text-muted-foreground">Reason</Label>
              <p className="text-sm whitespace-pre-wrap break-words">{viewLeave.reason || 'No reason provided'}</p>
            </div>
            {viewLeave.status !== 'pending' && (
              <div className="space-y-0.5 border-t pt-3">
                <Label className="text-xs text-muted-foreground">
                  {viewLeave.reviewer ? `Reviewed by ${viewLeave.reviewer.first_name} ${viewLeave.reviewer.last_name}` : 'Reviewer Comment'}
                </Label>
                <p className="text-sm whitespace-pre-wrap break-words">{viewLeave.review_comment || 'No comment provided'}</p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );

  // ── Reviewer view (Operations Manager / Team Lead) ─────────────────────────
  if (canDecide) {
    const pendingCount = leaves.filter((l) => l.status === 'pending').length;
    const approvedCount = leaves.filter((l) => l.status === 'approved').length;
    const rejectedCount = leaves.filter((l) => l.status === 'rejected').length;

    return (
      <div>
        <Header title="Leave Management" />
        <div className="p-6 space-y-5">
          <div>
            <h1 className="text-3xl font-bold">Leave Management</h1>
            <p className="text-muted-foreground mt-1">Review and manage staff leave applications</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border rounded-2xl p-6">
              <div className="flex items-center gap-2 text-amber-600 font-semibold">
                <Clock className="w-5 h-5" /> Pending Review
              </div>
              <p className="text-4xl font-bold text-amber-500 mt-3">{pendingCount}</p>
              <p className="text-sm text-muted-foreground mt-1">Applications awaiting review</p>
            </div>
            <div className="border rounded-2xl p-6">
              <div className="flex items-center gap-2 text-green-600 font-semibold">
                <CheckCircle2 className="w-5 h-5" /> Approved
              </div>
              <p className="text-4xl font-bold text-green-600 mt-3">{approvedCount}</p>
              <p className="text-sm text-muted-foreground mt-1">Approved applications</p>
            </div>
            <div className="border rounded-2xl p-6">
              <div className="flex items-center gap-2 text-red-600 font-semibold">
                <XCircle className="w-5 h-5" /> Rejected
              </div>
              <p className="text-4xl font-bold text-red-600 mt-3">{rejectedCount}</p>
              <p className="text-sm text-muted-foreground mt-1">Rejected applications</p>
            </div>
          </div>

          <div className="border rounded-2xl p-6">
            <h2 className="text-2xl font-bold">All Applications</h2>
            <p className="text-muted-foreground mt-1 mb-4">Complete history of leave applications</p>

            {isLoading ? (
              <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />)}</div>
            ) : leaves.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No leave applications</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-3 pr-4 font-medium whitespace-nowrap">Staff Member</th>
                      <th className="pb-3 pr-4 font-medium whitespace-nowrap">Type</th>
                      <th className="pb-3 pr-4 font-medium whitespace-nowrap">Period</th>
                      <th className="pb-3 pr-4 font-medium whitespace-nowrap">Days</th>
                      <th className="pb-3 pr-4 font-medium whitespace-nowrap">Status</th>
                      <th className="pb-3 pr-4 font-medium whitespace-nowrap">Applied</th>
                      <th className="pb-3 pr-4 font-medium whitespace-nowrap">Reason</th>
                      <th className="pb-3 font-medium whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaves.map((leave) => (
                      <tr key={leave.id} className="border-b last:border-0 align-top">
                        <td className="py-4 pr-4">
                          <p className="font-semibold whitespace-nowrap">{leave.user?.first_name} {leave.user?.last_name}</p>
                          {leave.user?.email && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Mail className="w-3 h-3 shrink-0" /> {leave.user.email}
                            </p>
                          )}
                        </td>
                        <td className="py-4 pr-4">
                          <span className={`text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap ${LEAVE_TYPE_STYLES[leave.leave_type] ?? 'bg-slate-100 text-slate-700'}`}>
                            {leaveTypeLabel(leave.leave_type)}
                          </span>
                        </td>
                        <td className="py-4 pr-4 whitespace-nowrap">
                          {formatDate(leave.start_date)} - {formatDate(leave.end_date)}
                        </td>
                        <td className="py-4 pr-4 whitespace-nowrap">{leave.total_days ?? '—'}</td>
                        <td className="py-4 pr-4">
                          <Badge className={`text-xs capitalize ${statusColor(leave.status)}`} variant="outline">{leave.status}</Badge>
                        </td>
                        <td className="py-4 pr-4 whitespace-nowrap">{formatDate(leave.created_at)}</td>
                        <td className="py-4 pr-4 max-w-[200px]">
                          <p className="truncate text-muted-foreground">{leave.reason || '—'}</p>
                        </td>
                        <td className="py-4">
                          <div className="flex items-center gap-1">
                            <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setViewId(leave.id)} title="View details">
                              <Eye className="w-4 h-4" />
                            </Button>
                            {leave.status === 'pending' && (
                              <Button variant="outline" size="sm" className="h-8" onClick={() => setDecideId(leave.id)}>Review</Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {decideDialog}
        {viewDialog}
      </div>
    );
  }

  // ── Applicant view (Staff / Intern / etc.) ─────────────────────────────────
  const canSubmit = form.leave_type && form.start_date && form.end_date && !createMutation.isPending;

  return (
    <div>
      <Header title="Leave Application" />
      <div className="p-6 space-y-5">
        <div>
          <h1 className="text-3xl font-bold">Leave Application</h1>
          <p className="text-muted-foreground mt-1">Apply for day off or leave of absence</p>
        </div>

        <div className="flex rounded-xl overflow-hidden border">
          <button
            type="button"
            onClick={() => setTab('apply')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${tab === 'apply' ? 'bg-white text-foreground' : 'bg-muted/60 text-muted-foreground hover:bg-muted'}`}
          >
            <Calendar className="w-4 h-4" /> Apply for Leave
          </button>
          <button
            type="button"
            onClick={() => setTab('history')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${tab === 'history' ? 'bg-white text-foreground' : 'bg-muted/60 text-muted-foreground hover:bg-muted'}`}
          >
            <FileText className="w-4 h-4" /> Application History
          </button>
        </div>

        {tab === 'apply' ? (
          <>
            <div className="border rounded-2xl p-6">
              <h2 className="text-xl font-bold">Leave Balance ({currentYear})</h2>
              <p className="text-muted-foreground mt-1 mb-4">Your available working days (Monday-Friday only)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl bg-blue-50 p-5">
                  <div className="flex items-center gap-2 text-blue-700 font-semibold">
                    <Calendar className="w-5 h-5" /> Day Off
                  </div>
                  <p className="text-3xl font-bold text-blue-800 mt-2">Unlimited</p>
                  <p className="text-sm text-blue-700/70 mt-1">Subject to approval</p>
                </div>
                <div className="rounded-xl bg-green-50 p-5">
                  <div className="flex items-center gap-2 text-green-700 font-semibold">
                    <Calendar className="w-5 h-5" /> Leave of Absence
                  </div>
                  <p className="text-3xl font-bold text-green-800 mt-2">{remainingLeaveOfAbsence} days</p>
                  <p className="text-sm text-green-700/70 mt-1">{usedLeaveOfAbsenceDays} of {ANNUAL_CAP} working days used</p>
                </div>
              </div>
            </div>

            <div className="border rounded-2xl p-6">
              <h2 className="text-xl font-bold">Submit Leave Application</h2>
              <p className="text-muted-foreground mt-1 mb-4">Fill out the form below to apply for leave (only working days Monday-Friday are counted)</p>
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label>Leave Type</Label>
                  <Select value={form.leave_type} onValueChange={(v) => setForm({ ...form, leave_type: v as string })}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select leave type" /></SelectTrigger>
                    <SelectContent>
                      {LEAVE_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.leave_type && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {form.leave_type === 'leave_of_absence'
                        ? `${remainingLeaveOfAbsence} of ${ANNUAL_CAP} working days remaining`
                        : 'Unlimited · Subject to approval'}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Start Date</Label>
                    <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>End Date</Label>
                    <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Reason</Label>
                  <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={3} placeholder="Briefly explain the reason for your leave" />
                </div>
                <Button onClick={() => createMutation.mutate(form)} disabled={!canSubmit}>
                  {createMutation.isPending ? 'Submitting...' : 'Submit Application'}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="border rounded-2xl p-6">
            <h2 className="text-xl font-bold">Application History</h2>
            <p className="text-muted-foreground mt-1 mb-4">Your past and pending leave applications</p>

            {isLoading ? (
              <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}</div>
            ) : myLeaves.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No leave applications yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {myLeaves.map((leave) => (
                  <div key={leave.id} className="flex items-center justify-between p-4 border rounded-xl">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${LEAVE_TYPE_STYLES[leave.leave_type] ?? 'bg-slate-100 text-slate-700'}`}>
                          {leaveTypeLabel(leave.leave_type)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1.5">
                        {formatDate(leave.start_date)} → {formatDate(leave.end_date)}
                        {typeof leave.total_days === 'number' && ` · ${leave.total_days} day${leave.total_days === 1 ? '' : 's'}`}
                      </p>
                      {leave.reason && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{leave.reason}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={`text-xs capitalize ${statusColor(leave.status)}`} variant="outline">{leave.status}</Badge>
                      <Button variant="ghost" size="icon-sm" onClick={() => setViewId(leave.id)} title="View details">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {viewDialog}
    </div>
  );
}
