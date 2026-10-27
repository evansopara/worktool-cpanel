'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowLeft, ExternalLink, Link2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/providers/AuthProvider';
import { reviewLinksApi, usersApi } from '@/lib/api';
import type { ReviewLink, User } from '@/types';
import { cn } from '@/lib/utils';
import { errorText } from '@/lib/tasks';
import { Button, IconButton, SearchField, SegmentedFilter, Sheet, SheetActions, SheetDescription, SheetTitle, StatusPill, type StatusTone } from '@/components/wc';
import { PageBody, PageHeader } from '@/components/shell/PageHeader';

// Review links: Project Managers send a link to a Team Lead, who approves it
// or asks for changes. No artboard exists; it follows the People hub style.

type Status = 'all' | 'pending' | 'approved' | 'not_approved';
const STATUS: Record<string, { label: string; tone: StatusTone }> = {
  pending: { label: 'Pending', tone: 'pending' },
  approved: { label: 'Approved', tone: 'done' },
  not_approved: { label: 'Not approved', tone: 'missed' },
};
const fullName = (u?: { first_name: string; last_name: string } | null) => (u ? `${u.first_name} ${u.last_name}`.trim() : '');
const input = 'h-12 w-full rounded-2xl border-0 bg-surface-2 px-4 font-ui text-[15px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink';
const label = 'text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink-3';
const EMPTY = { title: '', link_url: '', description: '', assigned_to: '' };

export default function ReviewLinksPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<Status>('all');
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [responding, setResponding] = useState<{ link: ReviewLink; status: 'approved' | 'not_approved' } | null>(null);
  const [comment, setComment] = useState('');
  const [deleting, setDeleting] = useState<ReviewLink | null>(null);

  const { data: links = [], isLoading } = useQuery<ReviewLink[]>({ queryKey: ['review-links'], queryFn: () => reviewLinksApi.list().then((r) => r.data) });
  const { data: users = [] } = useQuery<User[]>({ queryKey: ['users'], queryFn: () => usersApi.list().then((r) => r.data) });

  const isReviewer = user?.role === 'team_lead';
  const isSender = user?.role === 'project_manager';
  // Reviewers see everything sent for review; senders only what they sent.
  const scoped = isSender ? links.filter((l) => l.sent_by === user?.id) : links;
  const term = search.trim().toLowerCase();
  const shown = scoped.filter((l) => (status === 'all' || l.status === status) && (!term || l.title.toLowerCase().includes(term)));
  const teamLeads = users.filter((u) => u.role === 'team_lead');
  const refresh = () => qc.invalidateQueries({ queryKey: ['review-links'] });

  const create = useMutation({
    mutationFn: () => reviewLinksApi.create({ ...form, assigned_to: form.assigned_to ? Number(form.assigned_to) : undefined }),
    onSuccess: () => {
      refresh();
      toast.success('Review link sent');
      setSending(false);
      setForm(EMPTY);
    },
    onError: (err) => toast.error(errorText(err, 'Could not send the link.')),
  });
  const respond = useMutation({
    mutationFn: () => reviewLinksApi.respond(responding!.link.id, responding!.status, comment.trim() || undefined),
    onSuccess: () => {
      refresh();
      toast.success('Review submitted');
      setResponding(null);
      setComment('');
    },
    onError: (err) => toast.error(errorText(err, 'Could not submit the review.')),
  });
  const remove = useMutation({
    mutationFn: (id: number) => reviewLinksApi.remove(id),
    onSuccess: () => {
      refresh();
      toast.success('Review link removed');
      setDeleting(null);
    },
    onError: (err) => toast.error(errorText(err, 'Could not remove the link.')),
  });

  const title = isReviewer ? 'Reviews' : isSender ? 'Send for review' : 'Review links';
  const description = isReviewer ? 'Links Project Managers sent you to review' : isSender ? 'Send links to a Team Lead for review' : 'Links shared for review';
  const stats = [
    { label: 'Total links', value: scoped.length, dark: true },
    { label: 'Pending review', value: scoped.filter((l) => l.status === 'pending').length },
    { label: 'Approved', value: scoped.filter((l) => l.status === 'approved').length },
  ];
  const sendButton = isSender && (
    <Button variant="accent" onClick={() => setSending(true)}>
      <Plus strokeWidth={2.4} aria-hidden="true" />
      Send review link
    </Button>
  );

  return (
    <PageBody className="gap-3.5 lg:gap-5">
      <div className="flex items-center gap-2.5 lg:hidden">
        <Link href="/dashboard/more" aria-label="Back to More" className="flex size-11 items-center justify-center rounded-full bg-surface text-ink">
          <ArrowLeft className="size-[18px]" aria-hidden="true" />
        </Link>
        <h1 className="m-0 flex-1 font-display text-[30px] leading-none font-bold tracking-[-0.04em]">{title}</h1>
        {isSender && (
          <button type="button" aria-label="Send review link" onClick={() => setSending(true)} className="flex size-12 cursor-pointer items-center justify-center rounded-full border-0 bg-yellow text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink">
            <Plus className="size-5" strokeWidth={2.4} aria-hidden="true" />
          </button>
        )}
      </div>
      <PageHeader className="hidden lg:flex" title={title} description={description} actions={sendButton} />

      <section aria-label="Summary" className="grid grid-cols-3 gap-2.5 lg:gap-3.5">
        {stats.map((s) => (
          <div key={s.label} className={cn('flex flex-col gap-1 rounded-[22px] p-4 lg:flex-row lg:items-center lg:gap-[18px] lg:rounded-[26px] lg:px-[26px] lg:py-[22px]', s.dark ? 'bg-ink text-white' : 'bg-surface')}>
            <span className={cn('font-display text-[34px] leading-none font-bold lg:text-[56px] lg:leading-[0.9]', s.dark && 'text-yellow')}>{s.value}</span>
            <span className="text-[12.5px] font-semibold lg:text-base">{s.label}</span>
          </div>
        ))}
      </section>

      <div className="flex flex-col gap-2.5 lg:flex-row lg:flex-wrap lg:items-center">
        <SearchField value={search} onChange={setSearch} placeholder="Search links" className="w-full flex-none lg:w-auto lg:flex-[1_1_240px]" />
        <div className="self-start overflow-x-auto rounded-full bg-surface p-1 max-lg:max-w-full">
          <SegmentedFilter
            variant="inline"
            className="flex-nowrap whitespace-nowrap"
            label="Status"
            value={status}
            onChange={setStatus}
            items={[
              { value: 'all', label: 'All' },
              { value: 'pending', label: 'Pending' },
              { value: 'approved', label: 'Approved' },
              { value: 'not_approved', label: 'Not approved' },
            ]}
          />
        </div>
      </div>

      <section aria-label={isSender ? 'Sent links' : 'Links to review'} className="flex flex-col gap-2.5 lg:gap-3">
        {isLoading && <p className="m-0 text-sm text-ink-3">Loading…</p>}
        {!isLoading && shown.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-[28px] bg-surface px-6 py-14 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-stone text-ink-2">
              <Link2 className="size-6" aria-hidden="true" />
            </span>
            <p className="m-0 font-display text-2xl font-bold">No review links</p>
            <p className="m-0 text-sm text-ink-3">{term || status !== 'all' ? 'Nothing matches this search.' : isSender ? 'Links you send for review will show up here.' : 'Links sent to you will show up here.'}</p>
          </div>
        )}
        {shown.map((l) => {
          const s = STATUS[l.status] ?? { label: l.status, tone: 'todo' as StatusTone };
          const person = isSender ? `To ${fullName(l.assignee) || 'no one yet'}` : `From ${fullName(l.sender) || 'unknown'}`;
          return (
            <article key={l.id} className="flex flex-col gap-3 rounded-[24px] bg-surface p-[18px] lg:rounded-[26px] lg:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1">
                  <h2 className="m-0 text-[17px] font-bold lg:text-lg">{l.title}</h2>
                  <p className="m-0 text-[13px] text-ink-3">
                    {person} · {format(new Date(l.created_at), 'MMM d, yyyy')}
                  </p>
                </div>
                <StatusPill tone={s.tone} size="md">
                  {s.label}
                </StatusPill>
              </div>
              {l.description && <p className="m-0 line-clamp-4 text-sm leading-normal whitespace-pre-wrap text-ink-2">{l.description}</p>}
              {l.review_comment && (
                <div className={cn('flex flex-col gap-1 rounded-[18px] px-4 py-3', l.status === 'approved' ? 'bg-done-tint text-done' : 'bg-missed-tint text-missed')}>
                  <span className="text-xs font-bold uppercase tracking-[0.06em]">{l.status === 'approved' ? 'Comment' : 'What to change'}</span>
                  <p className="m-0 text-sm whitespace-pre-wrap">{l.review_comment}</p>
                  {l.reviewed_at && <span className="text-xs opacity-80">{format(new Date(l.reviewed_at), "MMM d, yyyy 'at' h:mm a")}</span>}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <a href={l.link_url} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-1.5 rounded-full bg-stone px-4 text-sm font-semibold text-ink no-underline outline-none focus-visible:ring-2 focus-visible:ring-ink">
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                  Open link
                </a>
                {isReviewer && l.status === 'pending' && (
                  <>
                    <Button size="md" variant="danger" onClick={() => setResponding({ link: l, status: 'not_approved' })}>
                      Not approved
                    </Button>
                    <Button size="md" onClick={() => setResponding({ link: l, status: 'approved' })}>
                      Approve
                    </Button>
                  </>
                )}
                {isSender && (
                  <IconButton variant="danger" className="ml-auto" aria-label={`Delete ${l.title}`} onClick={() => setDeleting(l)}>
                    <Trash2 strokeWidth={2} aria-hidden="true" />
                  </IconButton>
                )}
              </div>
            </article>
          );
        })}
      </section>

      <Sheet open={sending} onOpenChange={(o) => !o && setSending(false)}>
        <SheetTitle>Send review link</SheetTitle>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Title</span>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={input} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Link</span>
          <input type="url" placeholder="https://" value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} className={input} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Description</span>
          <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`${input} h-auto py-3 leading-normal`} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Send to</span>
          <select value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} className={input}>
            <option value="">Choose a Team Lead…</option>
            {teamLeads.map((u) => (
              <option key={u.id} value={u.id}>
                {fullName(u)}
              </option>
            ))}
          </select>
          {teamLeads.length === 0 && <span className="text-[12.5px] text-ink-3">No Team Leads found.</span>}
        </label>
        <SheetActions confirmLabel={create.isPending ? 'Sending…' : 'Send'} confirmDisabled={!form.title.trim() || !form.link_url.trim() || create.isPending} onConfirm={() => create.mutate()} />
      </Sheet>

      <Sheet open={!!responding} onOpenChange={(o) => !o && setResponding(null)}>
        {responding && (
          <>
            <SheetTitle>{responding.status === 'approved' ? 'Approve this link?' : 'Ask for changes'}</SheetTitle>
            <SheetDescription>{responding.link.title}</SheetDescription>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={responding.status === 'approved' ? 'Optional comment' : 'Explain what needs to change'}
              className={`${input} h-auto py-3 leading-normal`}
            />
            <SheetActions
              confirmLabel={respond.isPending ? 'Submitting…' : responding.status === 'approved' ? 'Approve' : 'Send back'}
              confirmDisabled={respond.isPending}
              onConfirm={() => respond.mutate()}
            />
          </>
        )}
      </Sheet>

      <Sheet open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        {deleting && (
          <>
            <SheetTitle>Delete this review link?</SheetTitle>
            <SheetDescription>“{deleting.title}” is removed for you and the reviewer. This can’t be undone.</SheetDescription>
            <SheetActions confirmLabel={remove.isPending ? 'Deleting…' : 'Delete'} confirmDisabled={remove.isPending} onConfirm={() => remove.mutate(deleting.id)} />
          </>
        )}
      </Sheet>
    </PageBody>
  );
}
