'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import Header from '@/components/layout/Header';
import { staffComplaintsApi } from '@/lib/api';
import { StaffComplaint } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { AlertTriangle, User as UserIcon, Mail, Building2, Calendar, Eye } from 'lucide-react';

type ComplaintStatus = StaffComplaint['status'];

const STATUS_TABS: { key: ComplaintStatus; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'reviewed', label: 'Reviewed' },
  { key: 'resolved', label: 'Resolved' },
];

const STATUS_META: Record<ComplaintStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-red-500 text-white' },
  reviewed: { label: 'Reviewed', className: 'bg-blue-100 text-blue-700' },
  resolved: { label: 'Resolved', className: 'bg-green-100 text-green-700' },
};

function StatusBadge({ status }: { status: ComplaintStatus }) {
  const meta = STATUS_META[status];
  return <span className={`text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap ${meta.className}`}>{meta.label}</span>;
}

const MANAGER_ROLES = ['operations_manager', 'team_lead'];

function ManagementView() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<ComplaintStatus>('pending');
  const [reviewId, setReviewId] = useState<number | null>(null);
  const [reviewStatus, setReviewStatus] = useState<ComplaintStatus>('pending');
  const [reviewComment, setReviewComment] = useState('');

  const { data: complaints = [], isLoading } = useQuery<StaffComplaint[]>({
    queryKey: ['staff-complaints'],
    queryFn: () => staffComplaintsApi.list().then((r) => r.data),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => staffComplaintsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff-complaints'] });
      toast.success('Complaint updated');
      setReviewId(null);
    },
    onError: () => toast.error('Failed to update complaint'),
  });

  const counts = STATUS_TABS.reduce((acc, t) => {
    acc[t.key] = complaints.filter((c) => c.status === t.key).length;
    return acc;
  }, {} as Record<ComplaintStatus, number>);

  const filtered = complaints.filter((c) => c.status === activeTab);
  const reviewingComplaint = complaints.find((c) => c.id === reviewId);

  const openReview = (c: StaffComplaint) => {
    setReviewId(c.id);
    setReviewStatus(c.status);
    setReviewComment(c.review_comments ?? '');
  };

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-3xl font-bold">Staff Complaints Management</h1>
        <p className="text-muted-foreground mt-1">Review and manage complaints submitted by staff members.</p>
      </div>

      <div className="flex rounded-lg border overflow-hidden">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === t.key ? 'bg-white text-foreground shadow-sm' : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
            }`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.key === 'pending' ? (
              <>
                {t.label}
                {counts.pending > 0 && (
                  <span className="inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-red-500 text-white text-xs font-bold">
                    {counts.pending}
                  </span>
                )}
              </>
            ) : (
              `${t.label} (${counts[t.key]})`
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-36 bg-muted animate-pulse rounded-2xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No complaints in this category</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((c) => (
            <div key={c.id} className="border rounded-2xl p-6 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xl font-bold">Complaint #{c.id}</h3>
                  <StatusBadge status={c.status} />
                </div>
                <div className="flex items-center gap-6 mt-3 text-sm text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1.5"><UserIcon className="w-4 h-4" /> {c.name}</span>
                  <span className="flex items-center gap-1.5"><Mail className="w-4 h-4" /> {c.email}</span>
                  {c.department && <span className="flex items-center gap-1.5"><Building2 className="w-4 h-4" /> {c.department}</span>}
                </div>
                <p className="text-muted-foreground mt-3">{c.detailed_explanation}</p>
                <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Submitted: {formatDate(c.created_at, "MMM d, yyyy, h:mm a")}
                </p>
                {c.review_comments && (
                  <div className="mt-3 p-3 rounded-xl bg-muted/30">
                    <p className="text-sm font-semibold">Review Comments:</p>
                    <p className="text-sm mt-0.5">{c.review_comments}</p>
                  </div>
                )}
              </div>
              <Button variant="outline" size="sm" className="shrink-0 rounded-xl" onClick={() => openReview(c)}>
                <Eye className="w-4 h-4 mr-1.5" /> Review
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!reviewId} onOpenChange={(v) => !v && setReviewId(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Complaint #{reviewingComplaint?.id}</DialogTitle></DialogHeader>
          {reviewingComplaint && (
            <div className="space-y-3 mt-2">
              <StatusBadge status={reviewingComplaint.status} />
              <p className="text-sm text-muted-foreground">
                {reviewingComplaint.name} ({reviewingComplaint.email}){reviewingComplaint.department ? ` — ${reviewingComplaint.department}` : ''}
                <br />Submitted: {formatDate(reviewingComplaint.created_at, "MMM d, yyyy, h:mm a")}
              </p>
              <p className="text-sm">{reviewingComplaint.detailed_explanation}</p>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={reviewStatus} onValueChange={(v) => setReviewStatus(v as ComplaintStatus)}>
                  <SelectTrigger className="w-full">
                    <SelectValue>{(v: string | null) => STATUS_META[(v ?? 'pending') as ComplaintStatus].label}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_TABS.map((t) => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Review Comment</Label>
                <Textarea
                  rows={3}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Let the staff member know what's happening..."
                />
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  disabled={updateMutation.isPending}
                  onClick={() => updateMutation.mutate({
                    id: reviewingComplaint.id,
                    data: { status: reviewStatus, review_comments: reviewComment || undefined },
                  })}
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
                <Button variant="outline" onClick={() => setReviewId(null)}>Cancel</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SubmitView() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim(),
    email: user?.email ?? '',
    department: user?.department ?? '',
    detailed_explanation: '',
  });

  const { data: complaints = [], isLoading } = useQuery<StaffComplaint[]>({
    queryKey: ['staff-complaints'],
    queryFn: () => staffComplaintsApi.list().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => staffComplaintsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff-complaints'] });
      toast.success('Complaint submitted');
      setForm((f) => ({ ...f, detailed_explanation: '' }));
    },
    onError: () => toast.error('Failed to submit complaint'),
  });

  const canSubmit = form.name.trim() && form.email.trim() && form.detailed_explanation.trim() && !createMutation.isPending;

  return (
    <div className="p-6">
      <p className="text-muted-foreground mb-6">
        Raise a workplace concern or issue you&apos;d like management to look into.
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="border rounded-2xl p-6">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-orange-500" />
            <h2 className="text-2xl font-bold">Send Complaint</h2>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Let us know about any workplace concerns or issues you&apos;d like to raise.
          </p>

          <div className="mt-4 p-3 rounded-xl bg-blue-50 border border-blue-100 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
            <p className="text-sm text-blue-700">
              Please provide as much detail as possible so this can be looked into properly.
            </p>
          </div>

          <div className="space-y-3 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Department</Label>
              <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Detailed Explanation</Label>
              <Textarea
                rows={5}
                placeholder="Describe the issue in detail..."
                value={form.detailed_explanation}
                onChange={(e) => setForm({ ...form, detailed_explanation: e.target.value })}
              />
            </div>
            <Button className="w-full" disabled={!canSubmit} onClick={() => createMutation.mutate(form)}>
              {createMutation.isPending ? 'Submitting...' : 'Submit Complaint'}
            </Button>
          </div>
        </div>

        <div className="border rounded-2xl p-6">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
            <h2 className="text-2xl font-bold">Your Complaints</h2>
          </div>
          <p className="text-muted-foreground text-sm mt-1">Track the status of your submitted complaints.</p>

          <div className="mt-4 space-y-3 max-h-[640px] overflow-y-auto pr-1">
            {isLoading ? (
              [...Array(3)].map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)
            ) : complaints.length === 0 ? (
              <p className="text-center py-10 text-sm text-muted-foreground">No complaints submitted yet</p>
            ) : complaints.map((c) => (
              <div key={c.id} className="border rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold">Complaint #{c.id}</h3>
                  <StatusBadge status={c.status} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Submitted: {formatDate(c.created_at, "MMM d, yyyy, h:mm a")}
                </p>
                <p className="text-sm mt-2">{c.detailed_explanation}</p>
                {c.review_comments && (
                  <div className="mt-3 p-3 rounded-lg bg-blue-50">
                    <p className="text-sm font-semibold text-blue-700">Review Comments:</p>
                    <p className="text-sm text-blue-700 mt-0.5">{c.review_comments}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StaffComplaintsPage() {
  const { user } = useAuth();
  const isManager = MANAGER_ROLES.includes(user?.role ?? '');

  return (
    <div>
      <Header title={isManager ? 'Staff Complaints Management' : 'Send Complaint'} />
      {isManager ? <ManagementView /> : <SubmitView />}
    </div>
  );
}
