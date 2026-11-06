'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Check, Download, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Avatar, Button, Tabs } from '@/components/wc';
import { errorText, fmtTime } from '@/lib/tasks';
import { performanceApi, roleName, weekday, type AttendanceWeek, type CheckStatus, type Flag, type TodaySummary } from '@/lib/performance';
import { card, cardTitle, CheckDot, CheckPill, ErrorNote, Loading, mmss, PersonCell, th, useSecondsLeft } from './parts';
import type { PerfUrl } from './usePerfUrl';

const RULE =
  'One random time per day, the same for everyone (meetings included), picked between 10:00 AM and 4:30 PM. Answer within 30 minutes; up to 60 counts as late. People on leave are skipped.';

/** Attendance (Attendance / MAttendance): live check, flags, today, this week. */
export function AttendanceTab({ url }: { url: PerfUrl }) {
  const [view, setView] = useState<'today' | 'week'>('today');
  const today = useQuery({ queryKey: ['performance', 'attendance', 'today'], queryFn: performanceApi.today, refetchInterval: 30_000 });
  const week = useQuery({
    queryKey: ['performance', 'attendance', url.range],
    queryFn: () => performanceApi.attendance(url.range),
    refetchInterval: 60_000,
  });

  if (today.isLoading || week.isLoading) return <Loading />;
  if (!today.data || !week.data) return <ErrorNote />;

  return (
    <>
      {/* Desktop */}
      <div className="hidden flex-col gap-5 lg:flex">
        <LiveCard t={today.data} />
        <FlagsCard flags={week.data.flags} />
        {today.data.rows && <TodayTable t={today.data} />}
        <WeekGrid w={week.data} />
      </div>

      {/* Mobile */}
      <div className="flex flex-col gap-3.5 lg:hidden">
        <Tabs
          label="Attendance view"
          value={view}
          onChange={setView}
          className="w-full [&>button]:flex-1"
          items={[
            { value: 'today', label: 'Today' },
            { value: 'week', label: 'This week' },
          ]}
        />
        {view === 'today' ? <MobileToday t={today.data} flags={week.data.flags} /> : <MobileWeek w={week.data} />}
      </div>
    </>
  );
}

function useReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => performanceApi.review(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['performance'] });
      qc.invalidateQueries({ queryKey: ['badges'] });
      toast.success('Marked reviewed');
    },
    onError: (e) => toast.error(errorText(e, 'Couldn’t mark it reviewed.')),
  });
}

const dayName = (date: string) => format(parseISO(date), 'EEEE');

function flagLine(f: Flag) {
  const nth = f.misses_this_week === 2 ? '2nd' : f.misses_this_week === 3 ? '3rd' : `${f.misses_this_week}th`;
  return [
    f.sent_at ? `Sent to everyone at ${fmtTime(f.sent_at)}` : null,
    f.late_until ? `no answer by ${fmtTime(f.late_until)}` : null,
    f.misses_this_week > 1 ? `${nth} miss this week` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

function LiveCard({ t }: { t: TodaySummary }) {
  const left = useSecondsLeft(t.answer_by);
  const total = 30 * 60;
  if (!t.sent_at) {
    return (
      <section aria-label="Today’s check" className="flex flex-col gap-1.5 rounded-[28px] bg-ink px-6 py-5 text-white">
        <span className="text-xs font-bold uppercase tracking-[0.08em] text-yellow">Today’s check</span>
        <p className="m-0 font-display text-[26px] font-bold">{t.working_day ? 'Not sent yet' : 'No check today'}</p>
        <p className="m-0 text-[13px] text-on-dark">
          {t.working_day ? 'It goes out to everyone at one random time between 10:00 AM and 4:30 PM. The time isn’t shown until then.' : 'Checks run Monday to Friday.'}
        </p>
      </section>
    );
  }
  const stats = [
    { n: t.answered ?? 0, label: 'Answered', note: 'tapped “I’m here”' },
    { n: t.waiting ?? 0, label: 'Waiting', note: left > 0 ? 'still in the window' : 'will count as missed' },
    { n: t.skipped ?? 0, label: 'Skipped', note: 'on approved leave' },
  ];
  return (
    <section aria-label="Today’s check" className="flex flex-col gap-4 rounded-[28px] bg-ink px-6 py-5 text-white">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-yellow">
            <span className={cn('size-2 rounded-full bg-yellow', left > 0 && 'animate-pulse')} aria-hidden="true" />
            {left > 0 ? 'Live · today’s check' : 'Today’s check'}
          </span>
          <p className="m-0 font-display text-[26px] font-bold tracking-[-0.02em]">Went out to everyone at {fmtTime(t.sent_at)}</p>
          <p className="m-0 text-[13px] text-on-dark">
            Same time for everyone · answer by {fmtTime(t.answer_by)} · late until {fmtTime(t.late_until)}
          </p>
          <div className="mt-1 h-1.5 w-full max-w-[280px] overflow-hidden rounded-full bg-dark-line">
            <div className="h-full rounded-full bg-yellow" style={{ width: `${((total - left) / total) * 100}%` }} />
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end">
          <span className="font-mono text-[44px] leading-none font-bold text-yellow" aria-live="off">
            {mmss(left)}
          </span>
          <span className="text-xs text-on-dark">left in the window</span>
        </div>
      </div>
      <dl className="m-0 grid grid-cols-3 gap-2.5">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col rounded-[18px] bg-dark-1 px-4 py-3">
            <dd className="m-0 font-display text-[26px] leading-none font-bold">{s.n}</dd>
            <dt className="mt-1 text-[12.5px] font-bold">{s.label}</dt>
            <span className="text-[11.5px] text-on-dark-2">{s.note}</span>
          </div>
        ))}
      </dl>
    </section>
  );
}

function exportFlags(flags: Flag[]) {
  const rows = [['Person', 'Role', 'Date', 'Sent at', 'Misses that week'], ...flags.map((f) => [f.user.name, roleName(f.user.role), f.date, f.sent_at ? fmtTime(f.sent_at) : '', String(f.misses_this_week)])];
  const csv = '﻿' + rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `missed-checks-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function FlagsCard({ flags }: { flags: Flag[] }) {
  const review = useReview();
  return (
    <section aria-labelledby="h-flags" className={cn(card, 'flex flex-col gap-3')}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="h-flags" className={cn(cardTitle, 'flex items-center gap-2.5')}>
          Flagged for review
          {flags.length > 0 && <span className="flex size-6 items-center justify-center rounded-full bg-yellow text-xs font-bold">{flags.length}</span>}
        </h2>
        <Button variant="secondary" size="md" onClick={() => exportFlags(flags)} disabled={!flags.length}>
          <Download aria-hidden="true" />
          Export
        </Button>
      </div>
      {flags.length === 0 ? (
        <p className="m-0 border-t border-line pt-3 text-sm text-ink-3">No missed checks waiting for review.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {flags.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-4 border-t border-line py-3">
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[14.5px] font-bold">
                  {f.user.name} · missed {dayName(f.date)}’s check
                </span>
                <span className="text-[12.5px] text-ink-3">{flagLine(f)}</span>
              </span>
              <Button size="md" onClick={() => review.mutate(f.id)} disabled={review.isPending && review.variables === f.id}>
                Mark reviewed
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TodayTable({ t }: { t: TodaySummary }) {
  return (
    <section aria-labelledby="h-today" className={cn(card, 'flex flex-col gap-3')}>
      <h2 id="h-today" className={cardTitle}>
        Today’s check · {format(parseISO(t.date), 'EEE, MMM d')} · sent {fmtTime(t.sent_at)}
      </h2>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-line">
            <th className={th}>Person</th>
            <th className={cn(th, 'w-40')}>Answered</th>
            <th className={cn(th, 'w-40')}>Status</th>
          </tr>
        </thead>
        <tbody>
          {(t.rows ?? []).map((r) => (
            <tr key={r.id} className="border-b border-line last:border-0">
              <td className="px-2 py-2.5">
                <PersonCell name={r.user.name} sub={roleName(r.user.role)} />
              </td>
              <td className="px-2 py-2.5 font-mono text-[13px] font-semibold">{r.responded_at ? fmtTime(r.responded_at) : '—'}</td>
              <td className="px-2 py-2.5">
                <CheckPill status={r.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function WeekGrid({ w }: { w: AttendanceWeek }) {
  return (
    <section aria-labelledby="h-week" className={cn(card, 'flex flex-col gap-3')}>
      <h2 id="h-week" className={cardTitle}>
        This week
      </h2>
      {w.days.length === 0 ? (
        <p className="m-0 text-sm text-ink-3">No checks have gone out in this period yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr className="border-b border-line">
                <th className={th}>Person</th>
                {w.days.map((d) => (
                  <th key={d.date} className={th}>
                    {weekday(d.date)} {fmtTime(d.sent_at)}
                  </th>
                ))}
                <th className={cn(th, 'text-right')}>Rate</th>
              </tr>
            </thead>
            <tbody>
              {w.people.map((p) => (
                <tr key={p.user.id} className="border-b border-line last:border-0">
                  <td className="px-2 py-2.5 text-[13.5px] font-bold whitespace-nowrap">{p.user.name}</td>
                  {w.days.map((d) => (
                    <td key={d.date} className="px-2 py-2.5">
                      {p.cells[d.date] ? <CheckDot status={p.cells[d.date].status} /> : <span className="text-[12.5px] text-ink-3">—</span>}
                    </td>
                  ))}
                  <td className={cn('px-2 py-2.5 text-right font-mono text-[13px] font-bold', p.rate !== null && p.rate < 80 && 'text-missed')}>
                    {p.rate === null ? '—' : `${p.rate}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="m-0 text-xs text-ink-3">{RULE}</p>
    </section>
  );
}

// ── Mobile ─────────────────────────────────────────────────────────────

function MobileToday({ t, flags }: { t: TodaySummary; flags: Flag[] }) {
  const review = useReview();
  const left = useSecondsLeft(t.answer_by);
  const rows = t.rows ?? [];
  const waiting = rows.filter((r) => r.status === 'pending');
  const answered = rows.filter((r) => r.status === 'answered' || r.status === 'late');
  const missed = rows.filter((r) => r.status === 'missed');
  const skipped = rows.filter((r) => r.status === 'skipped');
  const pct = t.expected ? ((t.answered ?? 0) / t.expected) * 100 : 0;

  const group = (title: string, sub: string, list: typeof rows, right: (r: (typeof rows)[number]) => React.ReactNode) =>
    list.length > 0 && (
      <section className="flex flex-col gap-2">
        <div className="px-1">
          <h2 className="m-0 text-[16px] font-bold">
            {title} <span className="font-mono text-[13px] text-ink-3">{list.length}</span>
          </h2>
          <p className="m-0 text-[12.5px] text-ink-3">{sub}</p>
        </div>
        <ul className="m-0 flex list-none flex-col overflow-hidden rounded-[22px] bg-surface p-0">
          {list.map((r) => (
            <li key={r.id} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0">
              <Avatar name={r.user.name} size="md" tone="stone" className="text-[12px]" />
              <span className="min-w-0 flex-1 truncate text-[15px] font-bold">{r.user.name}</span>
              {right(r)}
            </li>
          ))}
        </ul>
      </section>
    );

  return (
    <>
      <section aria-label="Today’s check" className="flex flex-col gap-2.5 rounded-[24px] bg-ink px-5 py-4 text-white">
        {t.sent_at ? (
          <>
            <span className="flex items-center gap-2 text-[13px] text-on-dark">
              <span className="size-2 rounded-full bg-pending-line" aria-hidden="true" />
              Today · sent at {fmtTime(t.sent_at)}
            </span>
            <p className="m-0 font-display text-[30px] leading-none font-bold">
              {t.answered} of {t.expected} answered
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-dark-line">
              <div className="h-full rounded-full bg-live" style={{ width: `${pct}%` }} />
            </div>
            <p className="m-0 text-[14px] text-on-dark">
              {left > 0 ? (
                <>
                  <b className="text-yellow">{Math.ceil(left / 60)} min</b> left to answer
                </>
              ) : (
                'The answer window has closed'
              )}
            </p>
          </>
        ) : (
          <>
            <p className="m-0 font-display text-[26px] font-bold">{t.working_day ? 'Not sent yet' : 'No check today'}</p>
            <p className="m-0 text-[13.5px] text-on-dark">{t.working_day ? 'It goes out at one random time between 10:00 AM and 4:30 PM.' : 'Checks run Monday to Friday.'}</p>
          </>
        )}
      </section>

      {flags.slice(0, 3).map((f) => (
        <section key={f.id} aria-label="Needs your review" className="flex flex-col gap-2 rounded-[22px] border-2 border-missed bg-surface px-4 py-3.5">
          <span className="text-xs font-bold uppercase tracking-[0.07em] text-missed">Needs your review</span>
          <p className="m-0 text-[15.5px] font-bold">
            {f.user.name} missed {dayName(f.date)}’s check
          </p>
          {f.misses_this_week > 1 && <p className="m-0 text-[13px] text-ink-3">That’s miss number {f.misses_this_week} this week.</p>}
          <Button className="mt-1 w-full" onClick={() => review.mutate(f.id)} disabled={review.isPending && review.variables === f.id}>
            Mark reviewed
          </Button>
        </section>
      ))}

      {group('Still waiting', 'Haven’t tapped “I’m here” yet', waiting, () => (
        <span className="text-[13px] font-semibold text-review">Not yet</span>
      ))}
      {group('Answered', 'Time they answered', answered, (r) => (
        <span className={cn('text-[13px] font-semibold', r.status === 'late' ? 'text-pending' : 'text-ink')}>
          {fmtTime(r.responded_at)}
          {r.status === 'late' && ' · late'}
        </span>
      ))}
      {group('Missed', 'No answer within 60 minutes', missed, () => (
        <span className="text-[13px] font-semibold text-missed">Missed</span>
      ))}
      {group('Not counted today', 'Approved leave doesn’t count against anyone', skipped, () => (
        <span className="text-[13px] text-ink-3">On leave</span>
      ))}
    </>
  );
}

const BOX: Record<CheckStatus, { mark: React.ReactNode; cls: string; label: string }> = {
  answered: { mark: <Check className="size-3.5" strokeWidth={3} />, cls: 'bg-done-tint text-done', label: 'on time' },
  late: { mark: 'L', cls: 'bg-pending-tint text-pending', label: 'late' },
  missed: { mark: <X className="size-3.5" strokeWidth={3} />, cls: 'bg-missed-tint text-missed', label: 'missed' },
  pending: { mark: '·', cls: 'bg-review-tint text-review', label: 'waiting' },
  skipped: { mark: '–', cls: 'bg-stone text-ink-3', label: 'not counted' },
};

function MobileWeek({ w }: { w: AttendanceWeek }) {
  if (!w.days.length) return <ErrorNote text="No checks have gone out in this period yet." />;
  return (
    <>
      <ul className="m-0 flex list-none flex-col overflow-hidden rounded-[22px] bg-surface p-0">
        {w.people.map((p) => (
          <li key={p.user.id} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0">
            <span className="min-w-0 flex-1 truncate text-[14.5px] font-bold">{p.user.name}</span>
            <span className="flex gap-1">
              {w.days.map((d) => {
                const c = p.cells[d.date];
                const b = c ? BOX[c.status] : BOX.skipped;
                return (
                  <span key={d.date} title={`${weekday(d.date)}: ${b.label}`} aria-label={`${weekday(d.date)}: ${b.label}`} className={cn('flex size-7 items-center justify-center rounded-lg text-xs font-bold', b.cls)}>
                    {b.mark}
                  </span>
                );
              })}
            </span>
            <span className={cn('w-11 text-right font-mono text-[13px] font-bold', p.rate !== null && p.rate < 80 && 'text-missed')}>
              {p.rate === null ? '—' : `${p.rate}%`}
            </span>
          </li>
        ))}
      </ul>
      <p className="m-0 px-1 text-xs text-ink-3">✓ on time · L late · ✕ missed · – not counted. {RULE}</p>
    </>
  );
}
