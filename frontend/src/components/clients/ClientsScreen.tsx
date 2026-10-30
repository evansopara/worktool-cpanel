'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { endOfWeek, format, isWithinInterval, startOfWeek, subWeeks } from 'date-fns';
import { ArrowLeft, ExternalLink, Flag, MessageSquareHeart } from 'lucide-react';
import { toast } from 'sonner';
import { complaintsApi, sentimentsApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button, Sheet, SheetActions, SheetDescription, SheetTitle, StatusPill, type StatusTone } from '@/components/wc';
import { PageBody } from '@/components/shell/PageHeader';
import { errorText, fmtWhen } from '@/lib/tasks';

// Clients hub for Operations Managers and Team Leads (Clients / MClients
// artboards): weekly client sentiment, feedback and client complaints.

type Sentiment = {
  id: number;
  sentiment: 'satisfied' | 'dissatisfied';
  is_flagged: boolean;
  feedback?: string | null;
  recorded_at: string;
  client?: { first_name: string; last_name: string };
};
type Complaint = {
  id: number;
  name?: string;
  email?: string;
  product_manager_name?: string | null;
  developer_name?: string | null;
  technical_manager_name?: string | null;
  detailed_explanation: string;
  screenshot_url?: string | null;
  status: 'pending' | 'reviewed' | 'resolved';
  review_comments?: string | null;
  created_at: string;
};

const TONE: Record<Complaint['status'], StatusTone> = { pending: 'missed', reviewed: 'review', resolved: 'done' };

/** The last 8 weeks, Monday to Sunday, as on the old Client Sentiment page. */
function weekOptions(now: Date) {
  return Array.from({ length: 8 }, (_, i) => {
    const start = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
    const end = endOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
    const label = i === 0 ? 'Current week' : i === 1 ? 'Last week' : `${format(start, 'MMM d')} – ${format(end, 'MMM d')}`;
    return { key: String(i), start, end, label };
  });
}

export function ClientsScreen() {
  const [now] = useState(() => new Date());
  const weeks = useMemo(() => weekOptions(now), [now]);
  const [weekKey, setWeekKey] = useState('0');
  const week = weeks.find((w) => w.key === weekKey) ?? weeks[0];

  const sentiments = useQuery<Sentiment[]>({ queryKey: ['sentiments'], queryFn: () => sentimentsApi.list().then((r) => r.data) });
  const complaints = useQuery<Complaint[]>({ queryKey: ['client-complaints'], queryFn: () => complaintsApi.list().then((r) => r.data) });

  const inWeek = (sentiments.data ?? []).filter((s) => isWithinInterval(new Date(s.recorded_at), { start: week.start, end: week.end }));
  const total = inWeek.length;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const stats = [
    { label: 'Satisfied', value: inWeek.filter((s) => s.sentiment === 'satisfied').length, bar: 'bg-live' },
    { label: 'Dissatisfied', value: inWeek.filter((s) => s.sentiment === 'dissatisfied').length, bar: 'bg-pending-line' },
    { label: 'Flags', value: inWeek.filter((s) => s.is_flagged).length, bar: 'bg-missed-on-dark' },
  ];

  const weekSelect = (
    <label className="flex h-11 items-center gap-2 rounded-full bg-surface pr-1.5 pl-3.5 text-sm font-semibold text-ink-3 lg:h-12 lg:pr-2 lg:pl-5">
      <span className="sr-only lg:not-sr-only">Week</span>
      <select value={weekKey} onChange={(e) => setWeekKey(e.target.value)} className="h-10 cursor-pointer border-0 bg-transparent font-ui text-[13.5px] font-bold text-ink outline-none lg:text-[15px]">
        {weeks.map((w) => (
          <option key={w.key} value={w.key}>
            {w.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <PageBody className="gap-3.5 pt-[52px] lg:gap-[22px] lg:pt-7">
      <div className="flex items-center gap-2.5 lg:hidden">
        <Link href="/dashboard/more" aria-label="Back to More" className="flex size-11 items-center justify-center rounded-full bg-surface text-ink">
          <ArrowLeft className="size-[18px]" aria-hidden="true" />
        </Link>
        <h1 className="m-0 flex-1 font-display text-[34px] leading-none font-bold tracking-[-0.04em]">Clients</h1>
        {weekSelect}
      </div>
      <header className="hidden flex-wrap items-end justify-between gap-5 pt-2 pb-1 lg:flex">
        <div className="flex flex-col gap-2.5">
          <h1 className="m-0 font-display text-[56px] leading-none font-bold tracking-[-0.04em]">Clients</h1>
          <p className="m-0 text-base text-ink-2">Monitor client satisfaction, feedback and complaints</p>
        </div>
        {weekSelect}
      </header>

      <div className="flex flex-col gap-3.5 lg:flex-row lg:flex-wrap lg:gap-5">
        <section aria-labelledby="h-sent" className="flex min-w-0 flex-col gap-4 rounded-[26px] bg-ink p-5 text-white lg:flex-[3_1_460px] lg:gap-[26px] lg:rounded-[30px] lg:p-[30px]">
          <div className="flex flex-col gap-1 lg:gap-1.5">
            <h2 id="h-sent" className="m-0 text-sm font-semibold text-on-dark-2 lg:text-[15px]">
              Client sentiment · {week.key === '0' ? 'this week' : week.label.toLowerCase()}
            </h2>
            <p className="m-0 flex items-baseline gap-2.5 lg:gap-3.5">
              <span className="font-display text-[64px] leading-[0.9] font-bold tracking-[-0.04em] text-yellow lg:text-[88px]">{total}</span>
              <span className="text-base font-semibold lg:text-lg">total response{total === 1 ? '' : 's'}</span>
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 lg:grid-cols-[repeat(auto-fit,minmax(150px,1fr))] lg:gap-3">
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col gap-1 rounded-[18px] bg-dark-1 p-3 lg:gap-2.5 lg:rounded-[20px] lg:p-4">
                <span className="order-2 text-xs font-semibold text-on-dark lg:order-none lg:flex lg:items-center lg:justify-between lg:text-sm lg:text-white">
                  {s.label}
                  <span className="hidden font-mono text-[13px] text-on-dark-2 lg:inline">{pct(s.value)}%</span>
                </span>
                <span className="font-display text-[26px] leading-none font-bold lg:text-4xl">{s.value}</span>
                <span className="hidden h-1.5 overflow-hidden rounded-full bg-dark-2 lg:block">
                  <span className={cn('block h-full rounded-full', s.bar)} style={{ width: `${pct(s.value)}%` }} />
                </span>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="h-fb" className="flex min-w-0 flex-col gap-3.5 rounded-[26px] bg-surface p-5 lg:flex-[2_1_340px] lg:rounded-[30px] lg:p-[30px]">
          <div className="hidden flex-col gap-1.5 lg:flex">
            <h2 id="h-fb" className="m-0 font-display text-2xl font-bold tracking-[-0.02em]">
              Client feedback details
            </h2>
            <p className="m-0 text-sm text-ink-3">Individual client sentiment submissions for the selected week</p>
          </div>
          {inWeek.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center lg:min-h-[200px] lg:gap-2.5 lg:rounded-[22px] lg:bg-surface-2 lg:p-6">
              <span className="flex size-12 items-center justify-center rounded-full bg-yellow lg:size-14">
                <MessageSquareHeart className="size-6" aria-hidden="true" />
              </span>
              <p className="m-0 text-base font-bold lg:text-[17px]">{sentiments.isLoading ? 'Loading…' : 'No feedback yet'}</p>
              {!sentiments.isLoading && <p className="m-0 text-[13.5px] text-ink-3 lg:text-sm">No client sentiment data available for the selected week.</p>}
            </div>
          ) : (
            <ul className="m-0 flex list-none flex-col p-0">
              {inWeek.map((s) => (
                <li key={s.id} className="flex flex-col gap-1.5 border-t border-line py-3 first:border-0 first:pt-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[15px] font-bold">
                      {s.client?.first_name} {s.client?.last_name}
                    </span>
                    <span className="flex gap-1.5">
                      {s.is_flagged && (
                        <StatusPill tone="missed" className="flex items-center gap-1">
                          <Flag className="size-3" aria-hidden="true" />
                          Flagged
                        </StatusPill>
                      )}
                      <StatusPill tone={s.sentiment === 'satisfied' ? 'done' : 'pending'}>{s.sentiment === 'satisfied' ? 'Satisfied' : 'Dissatisfied'}</StatusPill>
                    </span>
                  </div>
                  {s.feedback && <p className="m-0 text-sm text-ink-2">{s.feedback}</p>}
                  <span className="text-xs text-ink-3">{fmtWhen(s.recorded_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <Complaints items={complaints.data ?? []} loading={complaints.isLoading} />
    </PageBody>
  );
}

function Complaints({ items, loading }: { items: Complaint[]; loading: boolean }) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Complaint['status']>('pending');
  const [reviewing, setReviewing] = useState<Complaint | null>(null);
  const [review, setReview] = useState<{ status: Complaint['status']; comment: string }>({ status: 'reviewed', comment: '' });
  const save = useMutation({
    mutationFn: () => complaintsApi.update(reviewing!.id, { status: review.status, review_comments: review.comment.trim() || undefined }),
    onSuccess: () => {
      toast.success('Complaint updated');
      qc.invalidateQueries({ queryKey: ['client-complaints'] });
      qc.invalidateQueries({ queryKey: ['home'] });
      setReviewing(null);
    },
    onError: (err) => toast.error(errorText(err, 'Could not save the review.')),
  });
  const pending = items.filter((c) => c.status === 'pending').length;
  const shown = items.filter((c) => c.status === filter);
  const tags = (c: Complaint) =>
    [c.product_manager_name && `PM: ${c.product_manager_name}`, c.developer_name && `Developer: ${c.developer_name}`, c.technical_manager_name && `Technical manager: ${c.technical_manager_name}`].filter(Boolean) as string[];

  return (
    <section aria-labelledby="h-cc" className="flex flex-col gap-3 pt-1.5 lg:gap-3.5">
      <div className="flex flex-wrap items-baseline gap-2.5 px-1 lg:gap-3 lg:px-0">
        <h2 id="h-cc" className="m-0 font-display text-[22px] font-bold tracking-[-0.02em] lg:text-[30px]">
          <span className="lg:hidden">Complaints</span>
          <span className="hidden lg:inline">Client complaints</span>
        </h2>
        {pending > 0 && <StatusPill tone="missed">{pending} pending</StatusPill>}
      </div>
      <div role="group" aria-label="Complaint status" className="flex flex-wrap gap-2">
        {(['pending', 'reviewed', 'resolved'] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={filter === s}
            onClick={() => setFilter(s)}
            className={cn('flex h-10 cursor-pointer items-center gap-2 rounded-full border-0 px-4 font-ui text-sm font-semibold capitalize outline-none focus-visible:ring-2 focus-visible:ring-ink', filter === s ? 'bg-ink text-white' : 'bg-surface text-ink-2')}
          >
            {s}
            <span className="font-mono">{items.filter((c) => c.status === s).length}</span>
          </button>
        ))}
      </div>
      {loading && <p className="m-0 text-sm text-ink-3">Loading…</p>}
      {!loading && shown.length === 0 && <p className="m-0 rounded-card bg-surface p-6 text-sm text-ink-3">No {filter} complaints.</p>}
      {shown.map((c) => (
        <article key={c.id} className="flex flex-col gap-2.5 rounded-card bg-surface p-[18px] lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-7 lg:gap-y-4 lg:rounded-[26px] lg:p-[26px]">
          <div className="flex items-center justify-between lg:contents">
            <span className={cn('font-display text-[32px] leading-none font-bold lg:w-20 lg:shrink-0 lg:text-5xl', c.status === 'pending' ? 'text-missed' : 'text-ink')}>#{c.id}</span>
            <StatusPill tone={TONE[c.status]} className="capitalize lg:order-3">
              {c.status}
            </StatusPill>
          </div>
          <div className="flex min-w-0 flex-col gap-2 lg:flex-[1_1_380px]">
            <p className="m-0 text-[17px] font-bold whitespace-pre-wrap lg:text-[19px]">“{c.detailed_explanation}”</p>
            <p className="m-0 text-[13.5px] text-ink-2 lg:text-sm">
              {c.name}
              <span className="hidden lg:inline"> · {c.email}</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {tags(c).map((t) => (
                <span key={t} className="rounded-full bg-surface-2 px-2.5 py-1 text-[12.5px] font-semibold">
                  {t}
                </span>
              ))}
              <span className="hidden px-0.5 py-1 text-[12.5px] text-ink-3 lg:inline">Submitted {fmtWhen(c.created_at)}</span>
            </div>
            <p className="m-0 text-[12.5px] text-ink-3 lg:hidden">
              {c.email} · {fmtWhen(c.created_at)}
            </p>
            {c.review_comments && (
              <p className="m-0 rounded-2xl bg-surface-2 px-3.5 py-2.5 text-sm">
                <strong>Review: </strong>
                {c.review_comments}
              </p>
            )}
            {c.screenshot_url && (
              <a href={c.screenshot_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 self-start text-[13.5px] font-semibold text-ink">
                <ExternalLink className="size-3.5" aria-hidden="true" />
                Screenshot
              </a>
            )}
          </div>
          <Button
            className="h-[46px] w-full lg:order-4 lg:h-12 lg:w-auto"
            onClick={() => {
              setReviewing(c);
              setReview({ status: c.status === 'pending' ? 'reviewed' : c.status, comment: c.review_comments ?? '' });
            }}
          >
            Review
          </Button>
        </article>
      ))}

      <Sheet open={!!reviewing} onOpenChange={(o) => !o && setReviewing(null)}>
        {reviewing && (
          <>
            <SheetTitle>Complaint #{reviewing.id}</SheetTitle>
            <SheetDescription>
              {reviewing.name} · {reviewing.email}
            </SheetDescription>
            <div className="rounded-[18px] bg-surface-2 p-4 text-[15px] leading-[1.6] whitespace-pre-wrap">{reviewing.detailed_explanation}</div>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">Status</span>
              <select value={review.status} onChange={(e) => setReview({ ...review, status: e.target.value as Complaint['status'] })} className="h-12 rounded-2xl border-0 bg-surface-2 px-4 font-ui text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-ink">
                <option value="pending">Pending</option>
                <option value="reviewed">Reviewed</option>
                <option value="resolved">Resolved</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">Comment</span>
              <textarea rows={3} value={review.comment} onChange={(e) => setReview({ ...review, comment: e.target.value })} className="rounded-2xl border-0 bg-surface-2 px-4 py-3 font-ui text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-ink" />
            </label>
            <SheetActions confirmLabel="Save review" confirmDisabled={save.isPending} onConfirm={() => save.mutate()} />
          </>
        )}
      </Sheet>
    </section>
  );
}
