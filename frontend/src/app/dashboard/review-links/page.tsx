'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import Header from '@/components/layout/Header';
import { reviewLinksApi, usersApi } from '@/lib/api';
import { ReviewLink, User } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { Plus, Link2, ExternalLink, Clock, CheckCircle2, AlertCircle, Trash2, Search } from 'lucide-react';

const STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Approved', className: 'bg-green-100 text-green-700' },
  not_approved: { label: 'Not Approved', className: 'bg-red-100 text-red-600' },
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, className: 'bg-slate-100 text-slate-700' };
  return <span className={`text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap ${meta.className}`}>{meta.label}</span>;
}

function Description({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 160;
  return (
    <div className="mt-1">
      <p className="text-muted-foreground">{isLong && !expanded ? `${text.slice(0, 160)}...` : text}</p>
      {isLong && (
        <button type="button" className="text-sm text-blue-600 hover:underline mt-0.5" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}

export default function ReviewLinksPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: links = [], isLoading } = useQuery<ReviewLink[]>({
    queryKey: ['review-links'],
    queryFn: () => reviewLinksApi.list().then((r) => r.data),
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => usersApi.list().then((r) => r.data),
  });

  const isReviewer = user?.role === 'team_lead';
  const isSender = user?.role === 'project_manager';

  // Reviewer sees everything sent for review; sender only sees what they personally sent.
  const scopedLinks = isSender ? links.filter((l) => l.sent_by === user?.id) : links;

  const filteredLinks = scopedLinks.filter((l) => {
    const matchSearch = l.title.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalCount = scopedLinks.length;
  const pendingCount = scopedLinks.filter((l) => l.status === 'pending').length;
  const reviewedCount = scopedLinks.filter((l) => l.status === 'approved').length;

  // ── Send flow (Project Manager) ─────────────────────────────────────────
  const [sendOpen, setSendOpen] = useState(false);
  const [form, setForm] = useState({ title: '', link_url: '', description: '', assigned_to: '' });
  const teamLeads = users.filter((u) => u.role === 'team_lead');

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => reviewLinksApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['review-links'] });
      toast.success('Review link sent');
      setSendOpen(false);
      setForm({ title: '', link_url: '', description: '', assigned_to: '' });
    },
    onError: () => toast.error('Failed to send'),
  });

  const [deleteId, setDeleteId] = useState<number | null>(null);
  const deleteMutation = useMutation({
    mutationFn: (id: number) => reviewLinksApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['review-links'] });
      toast.success('Review link removed');
      setDeleteId(null);
    },
    onError: () => toast.error('Failed to remove review link'),
  });

  // ── Review flow (Team Lead) ──────────────────────────────────────────────
  const [respondId, setRespondId] = useState<number | null>(null);
  const [respondStatus, setRespondStatus] = useState<'approved' | 'not_approved'>('approved');
  const [comment, setComment] = useState('');

  const respondMutation = useMutation({
    mutationFn: ({ id, status, review_comment }: { id: number; status: 'approved' | 'not_approved'; review_comment: string }) =>
      reviewLinksApi.respond(id, status, review_comment || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['review-links'] });
      toast.success('Review submitted');
      setRespondId(null);
      setComment('');
    },
    onError: () => toast.error('Failed to submit review'),
  });

  const openRespond = (id: number, status: 'approved' | 'not_approved') => {
    setRespondId(id);
    setRespondStatus(status);
    setComment('');
  };

  const pageTitle = isReviewer ? 'Assigned Reviews' : isSender ? 'Send for Review' : 'Review Links';
  const pageSubtitle = isReviewer
    ? 'Review links sent by Project Managers'
    : isSender
      ? 'Send links to Team Leads for review'
      : 'Links shared with you for review';

  return (
    <div>
      <Header title={pageTitle} />
      <div className="p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">{pageTitle}</h1>
            <p className="text-muted-foreground mt-1">{pageSubtitle}</p>
          </div>
          {isSender && (
            <Dialog open={sendOpen} onOpenChange={(v) => { setSendOpen(v); if (!v) setForm({ title: '', link_url: '', description: '', assigned_to: '' }); }}>
              <DialogTrigger render={<Button className="w-full sm:w-auto shrink-0 rounded-xl h-11 px-5 bg-violet-600 hover:bg-violet-700 text-white" />}>
                <Plus className="w-4 h-4 mr-1.5" /> Send Review Link
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Send Review Link</DialogTitle></DialogHeader>
                <div className="space-y-3 mt-2">
                  <div className="space-y-1">
                    <Label>Title</Label>
                    <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Link URL</Label>
                    <Input type="url" value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} placeholder="https://" />
                  </div>
                  <div className="space-y-1">
                    <Label>Description</Label>
                    <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
                  </div>
                  <div className="space-y-1">
                    <Label>Assign To</Label>
                    <Select value={form.assigned_to} onValueChange={(v) => setForm({ ...form, assigned_to: v as string })}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a team lead...">
                          {(v: string | null) => {
                            const u = teamLeads.find((au) => String(au.id) === v);
                            return u ? `${u.first_name} ${u.last_name}` : 'Select a team lead...';
                          }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {teamLeads.map((u) => (
                          <SelectItem key={u.id} value={String(u.id)}>{u.first_name} {u.last_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {teamLeads.length === 0 && (
                      <p className="text-xs text-muted-foreground">No team leads found.</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      onClick={() => createMutation.mutate({
                        ...form,
                        assigned_to: form.assigned_to ? Number(form.assigned_to) : undefined,
                      })}
                      disabled={!form.title || !form.link_url || createMutation.isPending}
                    >
                      {createMutation.isPending ? 'Sending...' : 'Send'}
                    </Button>
                    <Button variant="outline" onClick={() => setSendOpen(false)}>Cancel</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="border rounded-2xl p-6 flex items-start justify-between">
            <div>
              <p className="text-muted-foreground">Total Links</p>
              <p className="text-4xl font-bold mt-2">{totalCount}</p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <ExternalLink className="w-4 h-4 text-blue-600" />
            </div>
          </div>
          <div className="border rounded-2xl p-6 flex items-start justify-between">
            <div>
              <p className="text-muted-foreground">Pending Review</p>
              <p className="text-4xl font-bold mt-2">{pendingCount}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
          </div>
          <div className="border rounded-2xl p-6 flex items-start justify-between">
            <div>
              <p className="text-muted-foreground">Reviewed</p>
              <p className="text-4xl font-bold mt-2">{reviewedCount}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search reviews..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-11 h-11 rounded-xl" />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as string)}>
            <SelectTrigger className="h-11 rounded-xl w-full sm:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="not_approved">Not Approved</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="border rounded-2xl p-6">
          <h2 className="text-2xl font-bold mb-4">{isSender ? 'Sent Links' : 'Links to Review'}</h2>

          {isLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-28 bg-muted animate-pulse rounded-2xl" />)}</div>
          ) : filteredLinks.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Link2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No review links found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLinks.map((link) => (
                <div key={link.id} className="border rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-bold">{link.title}</h3>
                        <StatusBadge status={link.status} />
                      </div>
                      {link.description && <Description text={link.description} />}
                      <p className="text-sm text-muted-foreground mt-2">
                        {isSender
                          ? `Assigned to: ${link.assignee ? `${link.assignee.first_name} ${link.assignee.last_name}` : 'Unassigned'}`
                          : `Sent by: ${link.sender ? `${link.sender.first_name} ${link.sender.last_name}` : 'Unknown'}`}
                        {' '}· {formatDate(link.created_at, 'M/d/yyyy')}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button variant="outline" className="rounded-xl" render={<a href={link.link_url} target="_blank" rel="noopener noreferrer" />}>
                        <ExternalLink className="w-4 h-4 mr-1.5" /> Open Link
                      </Button>

                      {isReviewer && link.status === 'pending' && (
                        <>
                          <Button
                            className="rounded-xl bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => openRespond(link.id, 'approved')}
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1.5" /> Approve
                          </Button>
                          <Button
                            variant="outline"
                            className="rounded-xl border-red-200 text-red-600 hover:bg-red-50"
                            onClick={() => openRespond(link.id, 'not_approved')}
                          >
                            <AlertCircle className="w-4 h-4 mr-1.5" /> Not Approved
                          </Button>
                        </>
                      )}

                      {isSender && (
                        <Button
                          variant="outline"
                          size="icon"
                          className="rounded-xl h-10 w-10 border-red-200 text-red-500 hover:bg-red-50"
                          onClick={() => setDeleteId(link.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {link.review_comment && (
                    <div className={`mt-3 p-3 rounded-xl border ${link.status === 'approved' ? 'bg-green-50 border-green-100' : 'bg-orange-50 border-orange-100'}`}>
                      <div className={`flex items-center gap-1.5 font-semibold text-sm ${link.status === 'approved' ? 'text-green-700' : 'text-orange-700'}`}>
                        {link.status === 'approved' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                        {link.status === 'approved' ? 'Comment:' : 'Revision Comment:'}
                      </div>
                      <p className={`text-sm mt-1 ${link.status === 'approved' ? 'text-green-700' : 'text-orange-700'}`}>{link.review_comment}</p>
                      {link.reviewed_at && (
                        <p className={`text-xs mt-1 ${link.status === 'approved' ? 'text-green-500/80' : 'text-orange-500/80'}`}>
                          Added: {formatDate(link.reviewed_at, "M/d/yyyy 'at' h:mm:ss a")}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Review decision dialog */}
      <Dialog open={!!respondId} onOpenChange={(v) => !v && setRespondId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{respondStatus === 'approved' ? 'Approve Review Link' : 'Mark as Not Approved'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={respondStatus === 'approved' ? 'Optional comment...' : 'Explain what needs to change...'}
              rows={3}
            />
            <div className="flex gap-2">
              <Button
                className={`flex-1 ${respondStatus === 'approved' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} text-white`}
                onClick={() => respondMutation.mutate({ id: respondId!, status: respondStatus, review_comment: comment })}
                disabled={respondMutation.isPending}
              >
                {respondMutation.isPending ? 'Submitting...' : respondStatus === 'approved' ? 'Approve' : 'Submit'}
              </Button>
              <Button variant="outline" onClick={() => setRespondId(null)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Delete Review Link</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground mt-1">Are you sure you want to delete this review link? This action cannot be undone.</p>
          <div className="flex gap-2 mt-4">
            <Button variant="destructive" className="flex-1" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(deleteId!)}>
              {deleteMutation.isPending ? 'Deleting...' : 'Yes, Delete'}
            </Button>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
