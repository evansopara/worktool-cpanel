'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/wc';
import { fmtTime } from '@/lib/tasks';
import { performanceApi, periodWord, roleName } from '@/lib/performance';
import { BoardTable, card, cardTitle, ErrorNote, Loading, useSecondsLeft } from './parts';
import type { PerfUrl } from './usePerfUrl';

/**
 * Overview (Performance artboard): three headline tiles, top 3 and the
 * People table. Below lg this is the MPerformance hub: the tiles plus links
 * to Leaderboard, Attendance and KPI report.
 */
export function OverviewTab({ url }: { url: PerfUrl }) {
  const q = useQuery({
    queryKey: ['performance', 'overview', url.range],
    queryFn: () => performanceApi.overview(url.range),
    refetchInterval: 60_000,
  });
  const today = q.data?.today;
  const minutesLeft = Math.ceil(useSecondsLeft(today?.answer_by) / 60);

  if (q.isLoading) return <Loading />;
  if (!q.data) return <ErrorNote />;
  const d = q.data;

  const todayValue = today?.sent_at ? `${today.answered}/${today.expected}` : '—';
  const todayNote = !today?.working_day
    ? 'No check today'
    : !today.sent_at
      ? 'Not sent yet · goes out at a random time'
      : minutesLeft > 0
        ? `Sent ${fmtTime(today.sent_at)} · ${minutesLeft} min left`
        : `Sent ${fmtTime(today.sent_at)} · window closed`;

  const tiles = [
    {
      label: 'On-time delivery',
      short: 'On time',
      value: d.on_time.pct === null ? '—' : `${d.on_time.pct}%`,
      note: 'Tasks submitted by the deadline',
      shortNote: 'Tasks by deadline',
      href: url.href({ tab: 'kpi' }),
    },
    { label: 'Today’s check', short: 'Today’s check', value: todayValue, note: todayNote, shortNote: todayNote, href: url.href({ tab: 'attendance' }), blue: true },
    {
      label: 'Missed checks',
      short: 'Missed checks',
      value: String(d.missed_checks),
      note: `No answer within 30 minutes · ${periodWord(url.range)}`,
      shortNote: periodWord(url.range),
      href: url.href({ tab: 'attendance' }),
      yellow: d.missed_checks > 0,
    },
  ];

  const links = [
    { label: 'Leaderboard', sub: 'Full ranking · staff and project managers', href: url.href({ tab: 'leaderboard' }) },
    { label: 'Attendance', sub: 'Live check board and week view', href: url.href({ tab: 'attendance' }) },
    { label: 'KPI report', sub: 'Daily hours, productivity, estimate drift', href: url.href({ tab: 'kpi' }) },
  ];

  return (
    <div className="flex flex-col gap-3.5 lg:gap-5">
      <div className="grid grid-cols-3 gap-2.5 lg:gap-4">
        {tiles.map((t) => (
          <Link
            key={t.label}
            href={t.href}
            className={cn(
              'flex min-w-0 flex-col gap-1 rounded-[22px] p-3.5 text-ink no-underline outline-none transition-[filter] hover:brightness-[0.98] focus-visible:ring-2 focus-visible:ring-ink lg:rounded-[24px] lg:p-5',
              t.yellow ? 'bg-yellow' : 'bg-surface',
            )}
          >
            <span className="text-[13.5px] font-semibold lg:text-[13px]">
              <span className="lg:hidden">{t.short}</span>
              <span className="hidden lg:inline">{t.label}</span>
            </span>
            <span className={cn('font-display text-[28px] leading-none font-bold tracking-[-0.03em] lg:text-[40px]', t.blue && 'text-review-bar')}>{t.value}</span>
            <span className={cn('text-[12.5px] lg:text-[12.5px]', t.yellow ? 'text-ink-2' : 'text-ink-3')}>
              <span className="lg:hidden">{t.shortNote}</span>
              <span className="hidden lg:inline">{t.note}</span>
            </span>
          </Link>
        ))}
      </div>

      {/* Mobile hub links (MPerformance) */}
      <nav aria-label="Performance sections" className="overflow-hidden rounded-[26px] bg-surface lg:hidden">
        {links.map((l) => (
          <Link key={l.label} href={l.href} className="flex items-center gap-3 border-b border-line px-5 py-4 text-ink no-underline last:border-0 outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-inset">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-lg font-bold">{l.label}</span>
              <span className="text-[14px] text-ink-3">{l.sub}</span>
            </span>
            <ChevronRight className="size-5 text-ink-3" aria-hidden="true" />
          </Link>
        ))}
      </nav>

      <section aria-labelledby="h-top" className="hidden flex-col rounded-[28px] bg-ink px-6 pt-5 pb-3 text-white lg:flex">
        <div className="flex items-center justify-between pb-3">
          <h2 id="h-top" className="m-0 font-display text-[22px] font-bold tracking-[-0.02em]">
            Top {periodWord(url.range)}
          </h2>
          <Link href={url.href({ tab: 'leaderboard' })} className="text-[13px] font-semibold text-yellow underline underline-offset-2">
            Full board
          </Link>
        </div>
        {d.top.length === 0 && <p className="m-0 border-t border-dark-line py-5 text-sm text-on-dark">Nobody has 5 tasks in this period yet.</p>}
        {d.top.map((r) => (
          <button
            key={r.user.id}
            type="button"
            onClick={() => url.openPerson(r.user.id)}
            className="flex cursor-pointer items-center gap-4 border-0 border-t border-solid border-dark-line bg-transparent py-3.5 text-left font-ui text-white outline-none focus-visible:ring-2 focus-visible:ring-yellow"
          >
            <span className="w-6 font-display text-[22px] font-bold text-yellow">{r.rank}</span>
            <Avatar name={r.user.name} size="sm" className="text-[11px]" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[14.5px] font-bold">{r.user.name}</span>
              <span className="text-xs text-on-dark">{roleName(r.user.role)}</span>
            </span>
            <span className="font-display text-[22px] font-bold">{r.score}</span>
          </button>
        ))}
      </section>

      <section aria-labelledby="h-people" className={cn(card, 'hidden flex-col gap-3 lg:flex')}>
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="h-people" className={cardTitle}>
            People
          </h2>
          <span className="text-[13px] text-ink-3">Click a name for their full performance view</span>
        </div>
        {d.people.length === 0 ? (
          <p className="m-0 py-6 text-center text-sm text-ink-3">No staff or interns yet.</p>
        ) : (
          <BoardTable rows={d.people} board="staff" columns={['on_time', 'attendance', 'estimate']} sortable showTasks={false} onOpen={url.openPerson} />
        )}
      </section>
    </div>
  );
}
