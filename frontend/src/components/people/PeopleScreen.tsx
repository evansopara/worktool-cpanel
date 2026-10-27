'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, ExternalLink, Eye, MessageCircle, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { leaveApi, queriesApi, staffComplaintsApi, usersApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Avatar, Button, IconButton, Sheet, SheetActions, SheetDescription, SheetTitle, StatusPill, initials, type StatusTone } from '@/components/wc';
import { PageBody } from '@/components/shell/PageHeader';
import { errorText, fmtWhen } from '@/lib/tasks';
import { fmtDay, fmtRange } from '@/lib/projects';
import { roleLabel } from '@/components/shell/nav';

// People hub for Operations Managers and Team Leads (People / MPeople
// artboards): Leave, Team, Queries, Staff complaints.

type Tab = 'leave' | 'team' | 'queries' | 'complaints';
type Person = { id: number; first_name: string; last_name: string; email?: string | null };
type Leave = {
  id: number;
  user?: Person;
  leave_type: string;
  start_date: string;
  end_date: string;
  total_days?: number | null;
  reason?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  review_comment?: string | null;
  reviewed_at?: string | null;
  reviewer?: Person | null;
  proof_image_url?: string | null;
  created_at: string;
};
type StaffQuery = {
  id: number;
  subject: string;
  message: string;
  status: 'pending' | 'acknowledged' | 'contested';
  response?: string | null;
  submitter?: Person;
  assignee?: Person;
  created_at: string;
};
type Complaint = {
  id: number;
  name?: string;
  email?: string;
  department?: string | null;
  detailed_explanation: string;
  screenshot_url?: string | null;
  status: 'pending' | 'reviewed' | 'resolved';
  review_comments?: string | null;
  created_at: string;
};
type Member = Person & { role: string; department?: string | null; specialization?: string | null; work_status?: string | null };

const name = (p?: Person | null) => (p ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() : '—');
const leaveType = (t: string) => ({ day_off: 'Day Off', leave_of_absence: 'Leave of Absence' })[t] ?? t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const days = (n?: number | null) => (n ? `${n} day${n === 1 ? '' : 's'}` : '—');
const ROLE_ORDER = ['operations_manager', 'team_lead', 'project_manager', 'staff', 'intern', 'customer_support_officer', 'client'];
const AVATAR_TONES = ['bg-yellow text-ink', 'bg-ink text-yellow', 'bg-review-tint text-review', 'bg-done-tint text-done'];

function presence(m: Member): { label: string; dot: string } {
  switch (m.work_status) {
    case 'available':
      return { label: 'Online', dot: 'bg-live' };
    case 'busy':
      return { label: 'Busy', dot: 'bg-missed' };
    case 'on_leave':
      return { label: 'On leave', dot: 'bg-review-bar' };
    default:
      return { label: 'Away', dot: 'bg-pending-line' };
  }
}

/** Needs a <Suspense> parent (the tab is in the URL: ?tab=team). */
export function PeopleScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tabParam = params.get('tab');
  const tab: Tab = tabParam === 'team' || tabParam === 'queries' || tabParam === 'complaints' ? tabParam : 'leave';
  const setTab = (t: Tab) => router.replace(t === 'leave' ? pathname : `${pathname}?tab=${t}`, { scroll: false });

  const leave = useQuery<Leave[]>({ queryKey: ['leave'], queryFn: () => leaveApi.list().then((r) => r.data) });
  const complaints = useQuery<Complaint[]>({ queryKey: ['staff-complaints'], queryFn: () => staffComplaintsApi.list().then((r) => r.data) });
  const pendingLeave = (leave.data ?? []).filter((l) => l.status === 'pending').length;
  const pendingComplaints = (complaints.data ?? []).filter((c) => c.status === 'pending').length;
  const [asking, setAsking] = useState(false);

  const tabs: { value: Tab; label: string; badge: number }[] = [
    { value: 'leave', label: 'Leave', badge: pendingLeave },
    { value: 'team', label: 'Team', badge: 0 },
    { value: 'queries', label: 'Queries', badge: 0 },
    { value: 'complaints', label: 'Staff complaints', badge: pendingComplaints },
  ];

  return (
    <PageBody className="gap-3.5 pt-[52px] lg:gap-[22px] lg:pt-7">
      {/* Mobile title row */}
      <div className="flex items-center gap-2.5 lg:hidden">
        <Link href="/dashboard/more" aria-label="Back to More" className="flex size-11 items-center justify-center rounded-full bg-surface text-ink">
          <ArrowLeft className="size-[18px]" aria-hidden="true" />
        </Link>
        <h1 className="m-0 flex-1 font-display text-[34px] leading-none font-bold tracking-[-0.04em]">People</h1>
        {tab === 'queries' && (
          <button type="button" aria-label="Send query" onClick={() => setAsking(true)} className="flex size-12 cursor-pointer items-center justify-center rounded-full border-0 bg-yellow text-ink">
            <Plus className="size-5" strokeWidth={2.4} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Desktop header: title + tabs */}
      <header className="hidden flex-wrap items-end justify-between gap-5 pt-2 pb-1 lg:flex">
        <div className="flex flex-col gap-2.5">
          <h1 className="m-0 font-display text-[56px] leading-none font-bold tracking-[-0.04em]">People</h1>
          <p className="m-0 text-base text-ink-2">Your team, their leave, and every query and complaint</p>
        </div>
        <TabBar tabs={tabs} tab={tab} onChange={setTab} />
      </header>
      <div className="-mx-[18px] overflow-x-auto px-[18px] lg:hidden">
        <TabBar tabs={tabs} tab={tab} onChange={setTab} mobile />
      </div>

      {tab === 'leave' && <LeaveTab items={leave.data ?? []} loading={leave.isLoading} />}
      {tab === 'team' && <TeamTab />}
      {tab === 'queries' && <QueriesTab onSend={() => setAsking(true)} />}
      {tab === 'complaints' && <ComplaintsTab items={complaints.data ?? []} loading={complaints.isLoading} />}
      <SendQuerySheet open={asking} onClose={() => setAsking(false)} />
    </PageBody>
  );
}

function TabBar({ tabs, tab, onChange, mobile }: { tabs: { value: Tab; label: string; badge: number }[]; tab: Tab; onChange: (t: Tab) => void; mobile?: boolean }) {
  return (
    <div role="tablist" aria-label="People sections" className={cn('flex gap-0.5', mobile ? 'w-max gap-1.5' : 'flex-wrap rounded-full bg-surface p-[5px]')}>
      {tabs.map((t) => {
        const on = t.value === tab;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.value)}
            className={cn(
              'flex h-[42px] shrink-0 cursor-pointer items-center gap-2 rounded-full border-0 px-4 font-ui text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ink lg:px-[18px]',
              on ? 'bg-ink text-white' : mobile ? 'bg-surface text-ink-2' : 'bg-transparent text-ink-2 hover:text-ink',
            )}
          >
            {t.label}
            {t.badge > 0 && <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-yellow px-[5px] text-[11px] font-bold text-ink">{t.badge}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ── Leave ────────────────────────────────────────────────────────────

/** Everything about one leave application, including the decision. */
function LeaveDetails({ leave: l, onClose }: { leave: Leave | null; onClose: () => void }) {
  const rows: [string, string][] = l
    ? [
        ['Applicant', name(l.user)],
        ['Type', leaveType(l.leave_type)],
        ['Period', fmtRange(l.start_date, l.end_date)],
        ['Days', String(l.total_days ?? '—')],
        ['Applied', fmtDay(l.created_at)],
        ...(l.status !== 'pending'
          ? ([
              [l.status === 'approved' ? 'Approved by' : 'Rejected by', l.reviewer ? name(l.reviewer) : '—'],
              ['Decided', l.reviewed_at ? fmtWhen(l.reviewed_at) : '—'],
            ] as [string, string][])
          : []),
      ]
    : [];
  return (
    <Sheet open={l !== null} onOpenChange={(o) => !o && onClose()}>
      {l && (
        <>
          <div className="flex items-start justify-between gap-3">
            <SheetTitle>Leave application</SheetTitle>
            <StatusPill tone={l.status === 'approved' ? 'done' : l.status === 'rejected' ? 'missed' : 'pending'} size="md">
              {l.status === 'approved' ? 'Approved' : l.status === 'rejected' ? 'Rejected' : 'Pending'}
            </StatusPill>
          </div>
          <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-5 gap-y-2.5 rounded-[18px] bg-surface-2 p-4 text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="font-semibold text-ink-3">{k}</dt>
                <dd className="m-0 font-semibold text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-col gap-1.5">
            <span className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">Reason given</span>
            <p className="m-0 text-[14.5px] leading-normal whitespace-pre-wrap">{l.reason || 'No reason given'}</p>
          </div>
          {l.review_comment && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">Reviewer’s comment</span>
              <p className="m-0 text-[14.5px] leading-normal whitespace-pre-wrap">{l.review_comment}</p>
            </div>
          )}
          {l.proof_image_url && (
            <a href={l.proof_image_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-ink">
              View attached proof <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          )}
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </>
      )}
    </Sheet>
  );
}

function LeaveTab({ items, loading }: { items: Leave[]; loading: boolean }) {
  const qc = useQueryClient();
  const [rejecting, setRejecting] = useState<Leave | null>(null);
  const [viewing, setViewing] = useState<Leave | null>(null);
  const [comment, setComment] = useState('');
  const decide = useMutation({
    mutationFn: ({ id, status, review_comment }: { id: number; status: 'approved' | 'rejected'; review_comment?: string }) => leaveApi.decide(id, { status, review_comment }),
    onSuccess: (_, v) => {
      toast.success(v.status === 'approved' ? 'Leave approved' : 'Leave rejected');
      qc.invalidateQueries({ queryKey: ['leave'] });
      qc.invalidateQueries({ queryKey: ['home'] });
      setRejecting(null);
      setComment('');
    },
    onError: (err) => toast.error(errorText(err, 'Could not save the decision.')),
  });

  const pending = items.filter((l) => l.status === 'pending');
  const history = items.filter((l) => l.status !== 'pending');
  const stats = [
    { value: pending.length, label: 'Pending review', note: 'Applications awaiting review', color: 'text-yellow' },
    { value: items.filter((l) => l.status === 'approved').length, label: 'Approved', note: 'Approved applications', color: 'text-white' },
    { value: items.filter((l) => l.status === 'rejected').length, label: 'Rejected', note: 'Rejected applications', color: 'text-idle' },
  ];

  return (
    <div className="flex flex-col gap-3 lg:gap-5">
      <section aria-label="Leave summary" className="flex overflow-hidden rounded-card bg-ink text-white lg:flex-wrap lg:rounded-[28px]">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-1 flex-col gap-[3px] border-r border-dark-2 p-4 last:border-r-0 lg:flex-[1_1_220px] lg:flex-row lg:items-center lg:gap-[18px] lg:px-7 lg:py-6">
            <span className={cn('font-display text-[34px] leading-none font-bold lg:text-[56px] lg:leading-[0.9]', s.color)}>{s.value}</span>
            <span className="flex flex-col gap-0.5">
              <span className="text-[12.5px] font-semibold text-on-dark lg:text-base lg:text-white">{s.label}</span>
              <span className="hidden text-[13.5px] text-on-dark-2 lg:inline">{s.note}</span>
            </span>
          </div>
        ))}
      </section>

      <section aria-labelledby="h-wait" className="flex flex-col gap-3">
        <h2 id="h-wait" className="mx-1 mt-1.5 mb-0 font-display text-[21px] font-bold tracking-[-0.02em] lg:m-0 lg:text-[26px]">
          Waiting on you
        </h2>
        {loading && <p className="m-0 text-sm text-ink-3">Loading…</p>}
        {!loading && pending.length === 0 && <p className="m-0 rounded-card bg-surface p-6 text-sm text-ink-3">No leave applications waiting.</p>}
        <div className="grid gap-3 lg:grid-cols-[repeat(auto-fit,minmax(340px,1fr))] lg:gap-3.5">
          {pending.map((l) => (
            <article key={l.id} className="flex flex-col gap-3 rounded-card bg-surface p-[18px] lg:gap-4 lg:rounded-[26px] lg:p-6">
              <div className="flex items-center gap-3">
                <Avatar name={name(l.user)} className="size-[42px] lg:size-[46px] lg:text-[15px]" />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-base font-bold lg:text-[17px]">{name(l.user)}</span>
                  <span className="truncate text-[12.5px] text-ink-3 lg:text-[13px]">{l.user?.email}</span>
                </div>
                <StatusPill tone="review" size="md">
                  {leaveType(l.leave_type)}
                </StatusPill>
              </div>
              <p className="m-0 text-[14.5px] font-semibold lg:hidden">
                {fmtRange(l.start_date, l.end_date)} · {days(l.total_days)}
              </p>
              <div className="hidden flex-wrap gap-x-6 gap-y-2 rounded-[18px] bg-surface-2 px-4 py-3.5 lg:flex">
                <Fact k="Period" v={fmtRange(l.start_date, l.end_date)} />
                <Fact k="Days" v={String(l.total_days ?? '—')} />
                <Fact k="Applied" v={fmtDay(l.created_at)} />
              </div>
              <p className="m-0 text-[13.5px] text-ink-2 lg:text-[14.5px]">
                “{l.reason || 'No reason given'}”<span className="lg:hidden"> · applied {fmtDay(l.created_at)}</span>
              </p>
              <div className="grid grid-cols-2 gap-2 lg:gap-2.5">
                <button type="button" disabled={decide.isPending} onClick={() => setRejecting(l)} className="h-[46px] cursor-pointer rounded-full border-0 bg-stone font-ui text-[14.5px] font-semibold text-missed outline-none focus-visible:ring-2 focus-visible:ring-ink disabled:opacity-40 lg:h-12 lg:text-[15px]">
                  Reject
                </button>
                <button type="button" disabled={decide.isPending} onClick={() => decide.mutate({ id: l.id, status: 'approved' })} className="h-[46px] cursor-pointer rounded-full border-0 bg-ink font-ui text-[14.5px] font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-ink disabled:opacity-40 lg:h-12 lg:text-[15px]">
                  Approve
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="h-hist" className="flex flex-col gap-1.5 lg:rounded-[28px] lg:bg-surface lg:p-[26px]">
        <h2 id="h-hist" className="mx-1 mt-1.5 mb-1.5 font-display text-[21px] font-bold tracking-[-0.02em] lg:m-0 lg:mb-2 lg:text-2xl">
          History
        </h2>
        {history.length === 0 && <p className="m-0 text-sm text-ink-3 lg:border-t lg:border-line lg:pt-4">No decided applications yet.</p>}
        {history.map((l) => (
          <div key={l.id} className="flex flex-wrap items-center gap-3 rounded-[22px] bg-surface px-4 py-3.5 lg:gap-x-6 lg:gap-y-2.5 lg:rounded-none lg:border-t lg:border-line lg:px-0">
            <span className="flex min-w-0 flex-1 items-center gap-3 lg:flex-[2_1_220px]">
              <Avatar name={name(l.user)} tone="stone" className="size-[38px] text-[13px]" />
              <span className="flex min-w-0 flex-col gap-px">
                <span className="text-[15px] font-bold">
                  {name(l.user)}
                  <span className="lg:hidden"> · {leaveType(l.leave_type)}</span>
                </span>
                <span className="truncate text-[12.5px] text-ink-3">
                  <span className="lg:hidden">
                    {fmtRange(l.start_date, l.end_date)} · {days(l.total_days)}
                  </span>
                  <span className="hidden lg:inline">{l.user?.email}</span>
                </span>
              </span>
            </span>
            <span className="hidden flex-[1_1_130px] text-sm font-semibold lg:inline">{leaveType(l.leave_type)}</span>
            <span className="hidden flex-[1.5_1_180px] flex-col gap-px text-sm lg:flex">
              <span className="font-semibold">{fmtRange(l.start_date, l.end_date)}</span>
              <span className="text-[12.5px] text-ink-3">
                {days(l.total_days)} · applied {fmtDay(l.created_at)}
              </span>
            </span>
            <span className="hidden min-w-0 flex-[1.5_1_160px] truncate text-[13.5px] text-ink-2 lg:inline" title={l.review_comment ?? l.reason ?? ''}>
              {l.review_comment || l.reason}
            </span>
            <StatusPill tone={l.status === 'approved' ? 'done' : 'missed'} size="md">
              {l.status === 'approved' ? 'Approved' : 'Rejected'}
            </StatusPill>
            <IconButton aria-label={`View ${name(l.user)}’s leave application`} title="View details" onClick={() => setViewing(l)}>
              <Eye strokeWidth={2} aria-hidden="true" />
            </IconButton>
          </div>
        ))}
      </section>

      <LeaveDetails leave={viewing} onClose={() => setViewing(null)} />

      <Sheet open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        {rejecting && (
          <>
            <SheetTitle>Reject {name(rejecting.user)}’s leave?</SheetTitle>
            <SheetDescription>
              {leaveType(rejecting.leave_type)} · {fmtRange(rejecting.start_date, rejecting.end_date)}
            </SheetDescription>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">Comment (optional)</span>
              <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} className="rounded-2xl border-0 bg-surface-2 px-4 py-3 font-ui text-[15px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink" />
            </label>
            <SheetActions confirmLabel="Reject leave" confirmDisabled={decide.isPending} onConfirm={() => decide.mutate({ id: rejecting.id, status: 'rejected', review_comment: comment.trim() || undefined })} />
          </>
        )}
      </Sheet>
    </div>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <span className="flex flex-col gap-0.5">
      <span className="text-xs font-semibold uppercase tracking-[0.05em] text-ink-3">{k}</span>
      <span className="text-[15px] font-semibold">{v}</span>
    </span>
  );
}

// ── Team ─────────────────────────────────────────────────────────────

function TeamTab() {
  const { data: users = [], isLoading } = useQuery<Member[]>({ queryKey: ['users'], queryFn: () => usersApi.list().then((r) => r.data) });
  const groups = ROLE_ORDER.map((role) => ({ role, people: users.filter((u) => u.role === role) })).filter((g) => g.people.length);
  // Avatar colours cycle through the whole list, not per group.
  const offset = groups.map((_, i) => groups.slice(0, i).reduce((n, g) => n + g.people.length, 0));

  return (
    <div className="flex flex-col gap-3 lg:gap-6">
      {isLoading && <p className="m-0 text-sm text-ink-3">Loading…</p>}
      {groups.map((g, gi) => (
        <section key={g.role} className="flex flex-col gap-2 lg:gap-3">
          <h2 className="mx-1 mt-1 mb-0 flex items-baseline gap-2 font-display text-xl font-bold tracking-[-0.02em] lg:m-0 lg:gap-2.5 lg:text-2xl">
            {roleLabel(g.role)}
            <span className="font-mono text-[13px] font-semibold text-ink-3 lg:text-sm">{g.people.length}</span>
          </h2>
          <div className="flex flex-col overflow-hidden rounded-card bg-surface lg:grid lg:grid-cols-[repeat(auto-fill,minmax(230px,1fr))] lg:gap-3 lg:overflow-visible lg:bg-transparent">
            {g.people.map((p, pi) => {
              const tone = AVATAR_TONES[(offset[gi] + pi) % AVATAR_TONES.length];
              const pr = presence(p);
              const dept = p.department || p.specialization;
              return (
                <article key={p.id} className="flex min-h-[66px] items-center gap-3 border-b border-surface-2 px-3.5 py-2.5 last:border-b-0 lg:flex-col lg:items-stretch lg:gap-3.5 lg:rounded-card lg:border-0 lg:bg-surface lg:p-5">
                  <div className="flex items-center justify-between lg:w-full">
                    <span className={cn('relative flex size-11 items-center justify-center rounded-full text-sm font-bold lg:size-14 lg:font-display lg:text-[19px]', tone)}>
                      {initials(name(p))}
                      <span className={cn('absolute right-0 bottom-0 size-[11px] rounded-full border-[2.5px] border-surface lg:right-px lg:bottom-px lg:size-[13px] lg:border-[3px]', pr.dot)} />
                    </span>
                    <MessageLink who={name(p)} className="hidden lg:flex" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5 lg:flex-none lg:gap-[3px]">
                    <span className="text-[15px] font-bold lg:text-base">{name(p)}</span>
                    <span className="truncate text-[12.5px] text-ink-3 lg:text-[13px]">
                      <span className="lg:hidden">{[pr.label, dept, p.email].filter(Boolean).join(' · ')}</span>
                      <span className="hidden lg:inline">{p.email}</span>
                    </span>
                  </div>
                  <div className="hidden flex-wrap gap-1.5 lg:flex">
                    <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[12.5px] font-semibold">{pr.label}</span>
                    {dept && <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[12.5px] font-semibold capitalize">{dept.replace(/_/g, ' ')}</span>}
                  </div>
                  <MessageLink who={name(p)} className="flex lg:hidden" />
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function MessageLink({ who, className }: { who: string; className?: string }) {
  return (
    <Link href="/dashboard/messages" aria-label={`Message ${who}`} className={cn('size-11 shrink-0 items-center justify-center rounded-full bg-stone text-ink', className)}>
      <MessageCircle className="size-[18px]" aria-hidden="true" />
    </Link>
  );
}

// ── Queries ──────────────────────────────────────────────────────────

const QUERY_STATUS: Record<StaffQuery['status'], [string, StatusTone]> = {
  pending: ['Awaiting reply', 'pending'],
  acknowledged: ['Acknowledged', 'done'],
  contested: ['Contested', 'missed'],
};

function QueriesTab({ onSend }: { onSend: () => void }) {
  const qc = useQueryClient();
  const { data: queries = [], isLoading } = useQuery<StaffQuery[]>({ queryKey: ['queries'], queryFn: () => queriesApi.list().then((r) => r.data) });
  const [deleting, setDeleting] = useState<StaffQuery | null>(null);
  const remove = useMutation({
    mutationFn: (id: number) => queriesApi.remove(id),
    onSuccess: () => {
      toast.success('Query deleted');
      qc.invalidateQueries({ queryKey: ['queries'] });
      setDeleting(null);
    },
    onError: (err) => toast.error(errorText(err, 'Could not delete the query.')),
  });

  return (
    <div className="flex flex-col gap-3 lg:gap-3.5">
      <div className="hidden flex-wrap items-center justify-between gap-3 lg:flex">
        <p className="m-0 text-[15px] text-ink-2">Send and track queries issued to staff</p>
        <Button onClick={onSend}>
          <Plus strokeWidth={2.4} aria-hidden="true" />
          Send query
        </Button>
      </div>
      {isLoading && <p className="m-0 text-sm text-ink-3">Loading…</p>}
      {!isLoading && queries.length === 0 && <p className="m-0 rounded-card bg-surface p-6 text-sm text-ink-3">No queries issued.</p>}
      {queries.map((q) => {
        const [label, tone] = QUERY_STATUS[q.status] ?? QUERY_STATUS.pending;
        return (
          <article key={q.id} className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-card bg-surface p-[18px] lg:rounded-[26px] lg:px-[26px] lg:py-6">
            <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="m-0 font-display text-xl font-bold tracking-[-0.02em] lg:text-2xl">{q.subject}</h2>
                <StatusPill tone={tone}>{label}</StatusPill>
              </div>
              <p className="m-0 text-[15px] whitespace-pre-wrap">{q.message}</p>
              {q.response && (
                <p className={cn('m-0 rounded-2xl px-3.5 py-2.5 text-sm', q.status === 'contested' ? 'bg-missed-tint text-missed' : 'bg-done-tint text-done')}>
                  <strong>{q.status === 'contested' ? 'Contested: ' : 'Reply: '}</strong>
                  {q.response}
                </p>
              )}
              <p className="m-0 text-[13.5px] text-ink-3">
                Issued by {name(q.submitter)} to {name(q.assignee)} · {formatDistanceToNow(new Date(q.created_at), { addSuffix: true })}
              </p>
            </div>
            <button type="button" onClick={() => setDeleting(q)} className="h-11 cursor-pointer rounded-full border-0 bg-stone px-[18px] font-ui text-sm font-semibold text-missed outline-none focus-visible:ring-2 focus-visible:ring-ink">
              Delete
            </button>
          </article>
        );
      })}
      <Sheet open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        {deleting && (
          <>
            <SheetTitle>Delete the query “{deleting.subject}”?</SheetTitle>
            <SheetDescription>Issued to {name(deleting.assignee)}. This can’t be undone.</SheetDescription>
            <SheetActions confirmLabel="Delete query" confirmDisabled={remove.isPending} onConfirm={() => remove.mutate(deleting.id)} />
          </>
        )}
      </Sheet>
    </div>
  );
}

const QUERY_TARGET_ROLES = ['project_manager', 'staff', 'intern', 'customer_support_officer'];

function SendQuerySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      {open && <SendQueryBody onClose={onClose} />}
    </Sheet>
  );
}

function SendQueryBody({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: users = [] } = useQuery<Member[]>({ queryKey: ['users'], queryFn: () => usersApi.list().then((r) => r.data) });
  const [f, setF] = useState({ assigned_to: '', subject: '', message: '' });
  const send = useMutation({
    mutationFn: () => queriesApi.create({ ...f, assigned_to: Number(f.assigned_to), subject: f.subject.trim(), message: f.message.trim() }),
    onSuccess: () => {
      toast.success('Query sent');
      qc.invalidateQueries({ queryKey: ['queries'] });
      onClose();
    },
    onError: (err) => toast.error(errorText(err, 'Could not send the query.')),
  });
  const ready = f.assigned_to && f.subject.trim() && f.message.trim() && !send.isPending;
  const field = 'h-12 w-full rounded-2xl border-0 bg-surface-2 px-4 font-ui text-[15px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink';
  const label = 'text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink-3';
  return (
    <>
      <SheetTitle>Send a query</SheetTitle>
      <SheetDescription>The staff member is notified and can acknowledge or contest it.</SheetDescription>
      <label className="flex flex-col gap-1.5">
        <span className={label}>Staff member</span>
        <select value={f.assigned_to} onChange={(e) => setF({ ...f, assigned_to: e.target.value })} className={field}>
          <option value="">Choose a staff member</option>
          {users
            .filter((u) => QUERY_TARGET_ROLES.includes(u.role))
            .map((u) => (
              <option key={u.id} value={u.id}>
                {name(u)} — {roleLabel(u.role)}
              </option>
            ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={label}>Subject</span>
        <input value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} className={field} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={label}>Message</span>
        <textarea rows={4} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} className={`${field} h-auto py-3 leading-normal`} />
      </label>
      <SheetActions confirmLabel="Send query" confirmDisabled={!ready} onConfirm={() => ready && send.mutate()} />
    </>
  );
}

// ── Staff complaints ─────────────────────────────────────────────────

const COMPLAINT_TONE: Record<Complaint['status'], StatusTone> = { pending: 'missed', reviewed: 'review', resolved: 'done' };

function ComplaintsTab({ items, loading }: { items: Complaint[]; loading: boolean }) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Complaint['status']>('pending');
  const [reviewing, setReviewing] = useState<Complaint | null>(null);
  const [review, setReview] = useState<{ status: Complaint['status']; comment: string }>({ status: 'reviewed', comment: '' });
  const save = useMutation({
    mutationFn: () => staffComplaintsApi.update(reviewing!.id, { status: review.status, review_comments: review.comment.trim() || undefined }),
    onSuccess: () => {
      toast.success('Complaint updated');
      qc.invalidateQueries({ queryKey: ['staff-complaints'] });
      qc.invalidateQueries({ queryKey: ['home'] });
      setReviewing(null);
    },
    onError: (err) => toast.error(errorText(err, 'Could not save the review.')),
  });
  const shown = items.filter((c) => c.status === filter);

  return (
    <div className="flex flex-col gap-3 lg:gap-4">
      <div role="group" aria-label="Complaint status" className="flex flex-wrap gap-2">
        {(['pending', 'reviewed', 'resolved'] as const).map((s) => {
          const on = filter === s;
          return (
            <button
              key={s}
              type="button"
              aria-pressed={on}
              onClick={() => setFilter(s)}
              className={cn('flex h-[42px] cursor-pointer items-center gap-2 rounded-full border-0 px-[18px] font-ui text-sm font-semibold capitalize outline-none focus-visible:ring-2 focus-visible:ring-ink', on ? 'bg-ink text-white' : 'bg-surface text-ink-2')}
            >
              {s}
              <span className={cn('font-mono', on && s === 'pending' && 'text-yellow')}>{items.filter((c) => c.status === s).length}</span>
            </button>
          );
        })}
      </div>
      {loading && <p className="m-0 text-sm text-ink-3">Loading…</p>}
      {!loading && shown.length === 0 && <p className="m-0 rounded-card bg-surface p-6 text-sm text-ink-3">No {filter} complaints.</p>}
      {shown.map((c) => (
        <article key={c.id} className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-card bg-surface p-5 lg:rounded-[26px] lg:p-[26px]">
          <span className={cn('shrink-0 font-display text-4xl leading-none font-bold lg:text-5xl', c.status === 'pending' ? 'text-missed' : 'text-ink')}>#{c.id}</span>
          <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-1.5">
            <p className="m-0 text-base font-bold whitespace-pre-wrap lg:text-lg">“{c.detailed_explanation}”</p>
            <p className="m-0 text-sm text-ink-2">{[c.name, c.email, c.department ? `Department: ${c.department}` : null].filter(Boolean).join(' · ')}</p>
            <p className="m-0 text-[13px] text-ink-3">Submitted {fmtWhen(c.created_at)}</p>
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
          <StatusPill tone={COMPLAINT_TONE[c.status]} size="md" className="capitalize">
            {c.status}
          </StatusPill>
          <Button
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
            <SheetDescription>{reviewing.name}</SheetDescription>
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
    </div>
  );
}
