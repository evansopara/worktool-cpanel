'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import Header from '@/components/layout/Header';
import { issuesApi } from '@/lib/api';
import { IssueReport, IssueCategory } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { Bug, Lightbulb, AlertCircle, Search, Filter, Eye, Check } from 'lucide-react';

type IssueStatus = IssueReport['status'];

const STATUS_TABS: { key: IssueStatus; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'reviewing', label: 'Reviewing' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'closed', label: 'Closed' },
];

const STATUS_META: Record<IssueStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-700' },
  reviewing: { label: 'Reviewing', className: 'bg-blue-100 text-blue-700' },
  resolved: { label: 'Resolved', className: 'bg-green-100 text-green-700' },
  closed: { label: 'Closed', className: 'bg-slate-100 text-slate-700' },
};

const PRIORITY_META: Record<string, string> = {
  low: 'bg-slate-100 text-slate-700',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

const CATEGORY_META: Record<IssueCategory, string> = {
  bug: 'Bug',
  feature_request: 'Feature Request',
  improvement: 'Improvement',
  other: 'Other',
};

function CategoryIcon({ category, className }: { category?: string; className?: string }) {
  return category === 'feature_request'
    ? <Lightbulb className={`${className ?? ''} text-blue-500`} />
    : <AlertCircle className={`${className ?? ''} text-orange-500`} />;
}

function StatusBadge({ status }: { status: IssueStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={`text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap inline-flex items-center gap-1 ${meta.className}`}>
      {status === 'closed' && <Check className="w-3 h-3" />}
      {meta.label}
    </span>
  );
}

const emptyForm = { title: '', description: '', suggestions: '', category: 'other' as IssueCategory, priority: 'medium' };

function SubmitIssueView() {
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm);

  const { data: issues = [], isLoading } = useQuery<IssueReport[]>({
    queryKey: ['issues'],
    queryFn: () => issuesApi.list().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => issuesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['issues'] });
      toast.success('Issue report submitted');
      setForm(emptyForm);
    },
    onError: () => toast.error('Failed to submit report'),
  });

  const canSubmit = form.title.trim() && form.description.trim() && !createMutation.isPending;

  return (
    <div className="p-6">
      <p className="text-muted-foreground mb-6">
        Help us improve the app by reporting bugs, requesting features, or suggesting improvements.
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Submit form */}
        <div className="border rounded-2xl p-6">
          <div className="flex items-center gap-2">
            <Bug className="w-6 h-6 text-orange-500" />
            <h2 className="text-2xl font-bold">Submit Issue Report</h2>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Describe the issue you&apos;re experiencing or suggest improvements for the application.
          </p>

          <div className="mt-4 p-3 rounded-xl bg-blue-50 border border-blue-100 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
            <p className="text-sm text-blue-700">
              Please provide as much detail as possible to help us understand and resolve the issue quickly.
            </p>
          </div>

          <div className="space-y-3 mt-4">
            <div className="space-y-1">
              <Label>Issue Title *</Label>
              <Input
                placeholder="Brief description of the issue"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as IssueCategory })}>
                  <SelectTrigger className="w-full">
                    <SelectValue>{(v: string | null) => CATEGORY_META[(v ?? 'other') as IssueCategory]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_META).map(([k, label]) => (
                      <SelectItem key={k} value={k}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as string })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['low', 'medium', 'high', 'urgent'].map((p) => (
                      <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Issue Description *</Label>
              <Textarea
                rows={4}
                placeholder="Detailed description of the issue, including steps to reproduce, expected behavior, and actual behavior..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Suggestions (Optional)</Label>
              <Textarea
                rows={3}
                placeholder="Any suggestions on how this could be fixed or improved..."
                value={form.suggestions}
                onChange={(e) => setForm({ ...form, suggestions: e.target.value })}
              />
            </div>
            <Button
              className="w-full"
              disabled={!canSubmit}
              onClick={() => createMutation.mutate({ ...form, suggestions: form.suggestions || undefined })}
            >
              {createMutation.isPending ? 'Submitting...' : 'Submit Report'}
            </Button>
          </div>
        </div>

        {/* Your reports */}
        <div className="border rounded-2xl p-6">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-6 h-6 text-amber-500" />
            <h2 className="text-2xl font-bold">Your Reports</h2>
          </div>
          <p className="text-muted-foreground text-sm mt-1">Track the status of your submitted issue reports.</p>

          <div className="mt-4 space-y-3 max-h-[640px] overflow-y-auto pr-1">
            {isLoading ? (
              [...Array(3)].map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)
            ) : issues.length === 0 ? (
              <p className="text-center py-10 text-sm text-muted-foreground">No reports submitted yet</p>
            ) : issues.map((issue) => (
              <div key={issue.id} className="border rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <CategoryIcon category={issue.category} className="w-4 h-4 shrink-0" />
                    <h3 className="font-semibold truncate">{issue.title}</h3>
                  </div>
                  <StatusBadge status={issue.status} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Submitted: {formatDate(issue.created_at, "MMM d, yyyy, hh:mm a")}
                </p>
                <p className="text-sm mt-2">{issue.description}</p>
                {issue.resolution && (
                  <div className="mt-3 p-3 rounded-lg bg-blue-50">
                    <p className="text-sm font-semibold text-blue-700">Review Comments:</p>
                    <p className="text-sm text-blue-700 mt-0.5">{issue.resolution}</p>
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

function IssueManagementView() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [activeTab, setActiveTab] = useState<IssueStatus>('pending');
  const [reviewId, setReviewId] = useState<number | null>(null);
  const [reviewStatus, setReviewStatus] = useState<IssueStatus>('pending');
  const [reviewComment, setReviewComment] = useState('');

  const { data: issues = [], isLoading } = useQuery<IssueReport[]>({
    queryKey: ['issues'],
    queryFn: () => issuesApi.list().then((r) => r.data),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => issuesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['issues'] });
      toast.success('Report updated');
      setReviewId(null);
    },
    onError: () => toast.error('Failed to update report'),
  });

  const counts = STATUS_TABS.reduce((acc, t) => {
    acc[t.key] = issues.filter((i) => i.status === t.key).length;
    return acc;
  }, {} as Record<IssueStatus, number>);

  const filtered = issues.filter((issue) => {
    if (issue.status !== activeTab) return false;
    if (statusFilter && issue.status !== statusFilter) return false;
    if (categoryFilter && issue.category !== categoryFilter) return false;
    if (priorityFilter && issue.priority !== priorityFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const reporterName = issue.reporter
        ? `${issue.reporter.first_name} ${issue.reporter.last_name} ${issue.reporter.email ?? ''}`.toLowerCase()
        : '';
      if (!issue.title.toLowerCase().includes(q) && !issue.description.toLowerCase().includes(q) && !reporterName.includes(q)) {
        return false;
      }
    }
    return true;
  });

  const reviewingIssue = issues.find((i) => i.id === reviewId);

  const openReview = (issue: IssueReport) => {
    setReviewId(issue.id);
    setReviewStatus(issue.status);
    setReviewComment(issue.resolution ?? '');
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setCategoryFilter('');
    setPriorityFilter('');
  };

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Bug className="w-7 h-7 text-orange-500" /> App Issue/Error Management
        </h1>
        <p className="text-muted-foreground mt-1">Review and manage user-submitted issue reports</p>
      </div>

      <div className="border rounded-2xl p-4 flex flex-col md:flex-row gap-3 md:items-center">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search reports..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? '')}>
          <SelectTrigger className="w-full md:w-40">
            <SelectValue placeholder="All Status">
              {(v: string | null) => (v ? STATUS_META[v as IssueStatus]?.label : 'All Status')}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Status</SelectItem>
            {STATUS_TABS.map((t) => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v ?? '')}>
          <SelectTrigger className="w-full md:w-44">
            <SelectValue placeholder="All Categories">
              {(v: string | null) => (v ? CATEGORY_META[v as IssueCategory] : 'All Categories')}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Categories</SelectItem>
            {Object.entries(CATEGORY_META).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v ?? '')}>
          <SelectTrigger className="w-full md:w-40">
            <SelectValue placeholder="All Priorities">
              {(v: string | null) => (v ? <span className="capitalize">{v}</span> : 'All Priorities')}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Priorities</SelectItem>
            {['low', 'medium', 'high', 'urgent'].map((p) => (
              <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" className="rounded-xl shrink-0" onClick={clearFilters}>
          <Filter className="w-4 h-4 mr-1.5" /> Clear Filters
        </Button>
      </div>

      <div className="flex rounded-lg border overflow-hidden">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              activeTab === t.key ? 'bg-white text-foreground shadow-sm' : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
            }`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}{counts[t.key] > 0 ? ` (${counts[t.key]})` : ''}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-36 bg-muted animate-pulse rounded-2xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Bug className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No reports in this category</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((issue) => (
            <div key={issue.id} className="border rounded-2xl p-6 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <CategoryIcon category={issue.category} className="w-5 h-5 shrink-0" />
                  <h3 className="text-xl font-bold">{issue.title}</h3>
                </div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <StatusBadge status={issue.status} />
                  {issue.priority && (
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full capitalize ${PRIORITY_META[issue.priority] ?? 'bg-slate-100 text-slate-700'}`}>
                      {issue.priority}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  From: {issue.reporter?.first_name} {issue.reporter?.last_name} ({issue.reporter?.email})
                  &nbsp;&nbsp;Submitted: {formatDate(issue.created_at, "MMM d, yyyy, hh:mm a")}
                </p>
                <p className="text-muted-foreground mt-3">{issue.description}</p>
                {issue.resolution && (
                  <div className="mt-3 p-3 rounded-xl bg-muted/30">
                    <p className="text-sm font-semibold">Review Comments:</p>
                    <p className="text-sm mt-0.5">{issue.resolution}</p>
                  </div>
                )}
              </div>
              <Button variant="outline" size="sm" className="shrink-0 rounded-xl" onClick={() => openReview(issue)}>
                <Eye className="w-4 h-4 mr-1.5" /> Review
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!reviewId} onOpenChange={(v) => !v && setReviewId(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{reviewingIssue?.title}</DialogTitle></DialogHeader>
          {reviewingIssue && (
            <div className="space-y-3 mt-2">
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={reviewingIssue.status} />
                {reviewingIssue.priority && (
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full capitalize ${PRIORITY_META[reviewingIssue.priority] ?? 'bg-slate-100 text-slate-700'}`}>
                    {reviewingIssue.priority}
                  </span>
                )}
                {reviewingIssue.category && (
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-700">
                    {CATEGORY_META[reviewingIssue.category]}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                From: {reviewingIssue.reporter?.first_name} {reviewingIssue.reporter?.last_name} ({reviewingIssue.reporter?.email})
                <br />Submitted: {formatDate(reviewingIssue.created_at, "MMM d, yyyy, hh:mm a")}
              </p>
              <p className="text-sm">{reviewingIssue.description}</p>
              {reviewingIssue.suggestions && (
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-xs font-semibold">Suggestions:</p>
                  <p className="text-sm mt-0.5">{reviewingIssue.suggestions}</p>
                </div>
              )}
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={reviewStatus} onValueChange={(v) => setReviewStatus(v as IssueStatus)}>
                  <SelectTrigger className="w-full">
                    <SelectValue>{(v: string | null) => STATUS_META[(v ?? 'pending') as IssueStatus].label}</SelectValue>
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
                  placeholder="Let the reporter know what's happening..."
                />
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  disabled={updateMutation.isPending}
                  onClick={() => updateMutation.mutate({
                    id: reviewingIssue.id,
                    data: { status: reviewStatus, resolution: reviewComment || undefined },
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

export default function IssuesPage() {
  const { user } = useAuth();
  const isTechSupport = user?.role === 'staff' && user?.specialization === 'technical_support';

  return (
    <div>
      <Header title={isTechSupport ? 'App Issue/Error Management' : 'Report App Issue/Error'} />
      {isTechSupport ? <IssueManagementView /> : <SubmitIssueView />}
    </div>
  );
}
