'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/providers/AuthProvider';
import { leaveApi } from '@/lib/api';
import type { LeaveApplication } from '@/types';
import { cn } from '@/lib/utils';
import { errorText, fmtWhen } from '@/lib/tasks';
import { fmtDay, fmtRange } from '@/lib/projects';
import { Button, IconButton, SegmentedFilter, Sheet, SheetTitle, StatusPill, type StatusTone } from '@/components/wc';
import { PageBody } from '@/components/shell/PageHeader';
import { Empty, Facts, Field, Note, ScreenHeader, area, card, cardTitle, field } from '@/components/requests/parts';

// Leave application for staff, interns, Project Managers and Customer
// Support Officers. Operations Managers and Team Leads decide leave in the
// People hub, so they're sent there.

const LEAVE_TYPES = [
  { value: 'day_off', label: 'Day off' },
  { value: 'leave_of_absence', label: 'Leave of absence' },
];
const ANNUAL_CAP = 14;
const STATUS: Record<string, { label: string; tone: StatusTone }> = {
  pending: { label: 'Pending', tone: 'pending' },
  approved: { label: 'Approved', tone: 'done' },
  rejected: { label: 'Rejected', tone: 'missed' },
};
const typeLabel = (t: string) => LEAVE_TYPES.find((x) => x.value === t)?.label ?? t.replace(/_/g, ' ');
const days = (n?: number | null) => (typeof n === 'number' ? `${n} working day${n === 1 ? '' : 's'}` : '');
const EMPTY = { leave_type: '', start_date: '', end_date: '', reason: '' };

export default function LeavePage() {
  const { user } = useAuth();
  const router = useRouter();
  const reviewer = user?.role === 'operations_manager' || user?.role === 'team_lead';
  useEffect(() => {
    if (reviewer) router.replace('/dashboard/people');
  }, [reviewer, router]);

  const qc = useQueryClient();
  const [tab, setTab] = useState<'apply' | 'history'>('apply');
  const [form, setForm] = useState(EMPTY);
  const [viewing, setViewing] = useState<LeaveApplication | null>(null);
  const [year] = useState(() => new Date().getFullYear());

  const { data: leaves = [], isLoading } = useQuery<LeaveApplication[]>({ queryKey: ['leave'], queryFn: () => leaveApi.list().then((r) => r.data), enabled: !!user && !reviewer });
  const mine = leaves.filter((l) => l.user_id === user?.id);
  const used = mine
    .filter((l) => l.leave_type === 'leave_of_absence' && l.status !== 'rejected' && new Date(l.start_date).getFullYear() === year)
    .reduce((sum, l) => sum + (l.total_days ?? 0), 0);
  const remaining = Math.max(0, ANNUAL_CAP - used);

  const create = useMutation({
    mutationFn: () => leaveApi.create(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leave'] });
      toast.success('Leave application sent');
      setForm(EMPTY);
      setTab('history');
    },
    onError: (err) => toast.error(errorText(err, 'Could not send the application.')),
  });

  if (!user || reviewer) return null;
  const backwards = !!form.start_date && !!form.end_date && form.end_date < form.start_date;
  const ready = form.leave_type && form.start_date && form.end_date && !backwards && !create.isPending;
  const pending = mine.filter((l) => l.status === 'pending').length;

  const apply = (
    <div className="flex flex-col gap-3.5 lg:flex-row lg:items-start lg:gap-5">
      <section aria-label={`Leave balance ${year}`} className="grid grid-cols-2 gap-2.5 lg:flex-[0_0_320px] lg:grid-cols-1 lg:gap-3.5">
        <div className="flex flex-col gap-1 rounded-[22px] bg-ink p-4 text-white lg:rounded-[26px] lg:p-6">
          <span className="text-[12.5px] font-semibold text-on-dark lg:text-sm">Day off</span>
          <span className="font-display text-[28px] leading-none font-bold text-yellow lg:text-[40px]">Unlimited</span>
          <span className="text-xs text-on-dark-2 lg:text-[13px]">Subject to approval</span>
        </div>
        <div className="flex flex-col gap-1 rounded-[22px] bg-surface p-4 lg:rounded-[26px] lg:p-6">
          <span className="text-[12.5px] font-semibold text-ink-2 lg:text-sm">Leave of absence</span>
          <span className="font-display text-[28px] leading-none font-bold lg:text-[40px]">{remaining} days</span>
          <span className="text-xs text-ink-3 lg:text-[13px]">
            {used} of {ANNUAL_CAP} used in {year}
          </span>
        </div>
      </section>

      <section aria-labelledby="h-apply" className={cn(card, 'lg:flex-1')}>
        <div className="flex flex-col gap-1">
          <h2 id="h-apply" className={cardTitle}>
            Apply for leave
          </h2>
          <p className="m-0 text-sm text-ink-3">Only working days (Monday to Friday) are counted.</p>
        </div>
        <Field label="Leave type" hint={form.leave_type === 'leave_of_absence' ? `${remaining} of ${ANNUAL_CAP} working days left this year` : form.leave_type ? 'Unlimited · subject to approval' : undefined}>
          <select value={form.leave_type} onChange={(e) => setForm({ ...form, leave_type: e.target.value })} className={field}>
            <option value="">Choose a type…</option>
            {LEAVE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="First day">
            <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className={field} />
          </Field>
          <Field label="Last day">
            <input type="date" value={form.end_date} min={form.start_date || undefined} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className={field} aria-invalid={backwards} />
          </Field>
        </div>
        {backwards && <p className="m-0 text-[13px] font-semibold text-missed">The last day is before the first day.</p>}
        <Field label="Reason">
          <textarea rows={3} placeholder="Briefly explain the reason for your leave" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className={area} />
        </Field>
        <Button className="self-stretch lg:self-start" disabled={!ready} onClick={() => create.mutate()}>
          {create.isPending ? 'Sending…' : 'Send application'}
        </Button>
      </section>
    </div>
  );

  const history = (
    <section aria-label="Your applications" className={card}>
      {isLoading && <p className="m-0 text-sm text-ink-3">Loading…</p>}
      {!isLoading && mine.length === 0 && <Empty icon={<CalendarDays />} title="No applications yet" text="Leave you apply for shows up here with its decision." />}
      <ul className="m-0 flex list-none flex-col p-0">
        {mine.map((l) => {
          const s = STATUS[l.status] ?? STATUS.pending;
          return (
            <li key={l.id} className="flex items-center gap-3 border-t border-line py-3.5 first:border-t-0 first:pt-0">
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[15px] font-bold">{typeLabel(l.leave_type)}</span>
                <span className="text-[13px] text-ink-2">
                  {fmtRange(l.start_date, l.end_date)}
                  {days(l.total_days) && ` · ${days(l.total_days)}`}
                </span>
                {l.reason && <span className="line-clamp-1 text-[12.5px] text-ink-3">{l.reason}</span>}
              </span>
              <StatusPill tone={s.tone} size="md">
                {s.label}
              </StatusPill>
              <IconButton aria-label={`View ${typeLabel(l.leave_type)} application`} title="View details" onClick={() => setViewing(l)}>
                <Eye strokeWidth={2} aria-hidden="true" />
              </IconButton>
            </li>
          );
        })}
      </ul>
    </section>
  );

  return (
    <PageBody className="gap-3.5 lg:gap-5">
      <ScreenHeader title="Leave" description="Apply for a day off or leave of absence, and follow your applications" />
      <div className="rounded-full bg-surface p-1 lg:self-start">
        <SegmentedFilter
          variant="inline"
          label="Leave views"
          value={tab}
          onChange={setTab}
          className="flex-nowrap [&>button]:flex-1 [&>button]:justify-center"
          items={[
            { value: 'apply', label: 'Apply' },
            { value: 'history', label: 'My applications', count: pending || undefined },
          ]}
        />
      </div>
      {tab === 'apply' ? apply : history}

      <Sheet open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        {viewing && (
          <>
            <div className="flex items-start justify-between gap-3">
              <SheetTitle>{typeLabel(viewing.leave_type)}</SheetTitle>
              <StatusPill tone={(STATUS[viewing.status] ?? STATUS.pending).tone} size="md">
                {(STATUS[viewing.status] ?? STATUS.pending).label}
              </StatusPill>
            </div>
            <Facts
              rows={[
                ['Period', fmtRange(viewing.start_date, viewing.end_date)],
                ['Days', String(viewing.total_days ?? '—')],
                ['Applied', fmtDay(viewing.created_at)],
                ...(viewing.status !== 'pending'
                  ? ([
                      [viewing.status === 'approved' ? 'Approved by' : 'Rejected by', viewing.reviewer ? `${viewing.reviewer.first_name} ${viewing.reviewer.last_name}` : '—'],
                      ['Decided', viewing.reviewed_at ? fmtWhen(viewing.reviewed_at) : '—'],
                    ] as [string, string][])
                  : []),
              ]}
            />
            <Note label="Reason">{viewing.reason || 'No reason given'}</Note>
            {viewing.review_comment && (
              <Note label="Reviewer’s comment" tone={viewing.status === 'approved' ? 'done' : 'missed'}>
                {viewing.review_comment}
              </Note>
            )}
            <Button variant="secondary" onClick={() => setViewing(null)}>
              Close
            </Button>
          </>
        )}
      </Sheet>
    </PageBody>
  );
}
