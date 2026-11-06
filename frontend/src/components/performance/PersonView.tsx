'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, buttonVariants } from '@/components/wc';
import {
  MEASURE_LABEL,
  MISS_CAUSE,
  measureReason,
  periodWord,
  performanceApi,
  rangeLabel,
  roleName,
  weekday,
  type PersonView as PersonData,
} from '@/lib/performance';
import { AttendanceDays, card, cardTitle, ErrorNote, Loading } from './parts';
import type { PerfUrl } from './usePerfUrl';

/** Person view (PersonPerformance), opened from any name. */
export function PersonView({ url, id, manager }: { url: PerfUrl; id: number; manager: boolean }) {
  const q = useQuery({ queryKey: ['performance', 'person', id, url.range], queryFn: () => performanceApi.person(id, url.range) });

  return (
    <div className="flex flex-col gap-3.5 lg:gap-5">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm">
        <button
          type="button"
          onClick={url.closePerson}
          className="flex cursor-pointer items-center gap-1 rounded-md border-0 bg-transparent p-0 font-ui text-sm font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink"
        >
          <ChevronLeft className="size-4" strokeWidth={2.2} aria-hidden="true" />
          {manager ? 'Performance' : 'My performance'}
        </button>
        <span className="text-ink-3">/</span>
        <span className="text-ink-3">People</span>
      </nav>
      {q.isLoading ? <Loading /> : !q.data ? <ErrorNote text="You can’t see this person’s performance, or it couldn’t load." /> : <Body d={q.data} url={url} manager={manager} />}
    </div>
  );
}

function Body({ d, url, manager }: { d: PersonData; url: PerfUrl; manager: boolean }) {
  const row = d.row;
  const word = periodWord(d);
  const lateDays = (d.attendance?.days ?? []).filter((x) => x.status === 'late' || x.status === 'missed').map((x) => format(parseISO(x.date), 'EEEE'));
  const firstName = d.user.name.split(' ')[0];

  return (
    <>
      <section aria-label="Summary" className="flex flex-wrap items-center gap-4 rounded-[28px] bg-ink px-5 py-5 text-white lg:gap-6 lg:px-7 lg:py-6">
        <Avatar name={d.user.name} size="lg" className="size-16 text-xl lg:size-[74px] lg:text-2xl" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="m-0 truncate font-display text-[30px] leading-none font-bold tracking-[-0.03em] lg:text-[40px]">{d.user.name}</h1>
          <p className="m-0 text-sm text-on-dark">
            {roleName(d.user.role)} · {rangeLabel(d).replace('This week · ', 'this week · ').replace('Last week · ', 'last week · ')}
          </p>
        </div>
        {row && (
          <dl className="m-0 flex gap-6">
            <div className="flex flex-col">
              <dt className="text-xs text-on-dark">Score</dt>
              <dd className="m-0 font-display text-[40px] leading-none font-bold text-yellow lg:text-[46px]">{row.score ?? '—'}</dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-xs text-on-dark">Rank</dt>
              <dd className="m-0 font-display text-[40px] leading-none font-bold lg:text-[46px]">{row.rank ? `#${row.rank}` : '—'}</dd>
              {row.movement ? (
                <span className={cn('text-xs font-bold', row.movement > 0 ? 'text-live' : 'text-missed-on-dark')}>
                  {row.movement > 0 ? '↑' : '↓'}
                  {Math.abs(row.movement)} since the last period
                </span>
              ) : (
                !row.ranked && <span className="text-xs text-on-dark">Not ranked yet · {row.tasks} of 5 tasks</span>
              )}
            </div>
          </dl>
        )}
      </section>

      {row ? (
        <div className="grid gap-3.5 lg:grid-cols-[1.4fr_1fr] lg:gap-5">
          <section aria-labelledby="h-made" className={cn(card, 'flex flex-col gap-4')}>
            <h2 id="h-made" className={cardTitle}>
              How the score is made
            </h2>
            {Object.entries(row.measures).map(([key, m]) => {
              const lift = row.lift === key;
              const pct = m.value === null ? 0 : Math.min(100, key === 'estimate' ? (m.score ?? 0) : m.value);
              return (
                <div key={key} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span>
                      <b>{MEASURE_LABEL[key]}</b> <span className="text-ink-3">· {m.weight}%</span>
                    </span>
                    <b>{m.value === null ? '—' : key === 'decision_speed' ? `${m.value}h` : `${m.value}%`}</b>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-stone">
                    <div className={cn('h-full rounded-full', lift ? 'bg-pending-line' : 'bg-ink')} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[12.5px] text-ink-3">{measureReason(key, m, lift, lateDays)}</span>
                </div>
              );
            })}
          </section>

          <section aria-labelledby="h-rank" className={cn(card, 'flex flex-col gap-3')}>
            <h2 id="h-rank" className={cardTitle}>
              Rank, last 6 {d.history.length && isWeek(d) ? 'weeks' : 'periods'}
            </h2>
            <RankChart history={d.history} />
          </section>
        </div>
      ) : (
        <p className="m-0 rounded-[24px] bg-surface p-5 text-sm text-ink-3">{roleName(d.user.role)}s aren’t on a leaderboard, so there’s no score — attendance and deadlines are below.</p>
      )}

      {d.attendance && (
        <section aria-labelledby="h-att" className={cn(card, 'flex flex-col gap-3')}>
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="h-att" className={cardTitle}>
              Attendance checks
            </h2>
            {d.attendance.rate !== null && (
              <b className="text-sm">
                {d.attendance.rate}% {word}
              </b>
            )}
          </div>
          <AttendanceDays days={d.attendance.days} detailed />
        </section>
      )}

      <section aria-labelledby="h-missed" className={cn(card, 'flex flex-col gap-2')}>
        <h2 id="h-missed" className={cardTitle}>
          Missed deadlines and why
        </h2>
        {d.missed_deadlines.length === 0 ? (
          <p className="m-0 border-t border-line pt-3 text-sm text-ink-3">No missed deadlines {word}.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {d.missed_deadlines.map((t) => (
              <li key={t.id} className="border-t border-line">
                <Link href={`/dashboard/tasks?task=${t.id}`} className="flex items-center justify-between gap-3 py-3 text-ink no-underline outline-none focus-visible:ring-2 focus-visible:ring-ink">
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[14.5px] font-bold hover:underline">{t.title}</span>
                    <span className="text-[12.5px] text-ink-3">
                      {[
                        t.project,
                        `due ${format(parseISO(t.deadline), 'MMM d, h:mm a')}`,
                        t.extension?.requested_deadline ? `extension requested to ${format(parseISO(t.extension.requested_deadline), 'MMM d, h:mm a')}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  {t.cause && <span className="shrink-0 rounded-full bg-review-tint px-3 py-1 text-xs font-semibold text-review">{MISS_CAUSE[t.cause] ?? t.cause}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap gap-2.5">
        {manager && (
          <Link href={url.href({ tab: 'kpi', employee: String(d.user.id) })} className={buttonVariants({ variant: 'primary' })}>
            Daily hours in KPI report
          </Link>
        )}
        <Link href={`/dashboard/tasks?q=${encodeURIComponent(firstName)}`} className={buttonVariants({ variant: 'white' })}>
          {manager ? `${firstName}’s tasks` : 'My tasks'}
        </Link>
      </div>
    </>
  );
}

const isWeek = (r: { from: string; to: string }) => parseISO(r.from).getDay() === 1 && (parseISO(r.to).getTime() - parseISO(r.from).getTime()) / 86400000 === 6;

/** Rank over the last 6 periods: a line where higher on the chart = better rank. */
function RankChart({ history }: { history: PersonData['history'] }) {
  const ranked = history.filter((h) => h.rank !== null);
  if (ranked.length === 0) return <p className="m-0 text-sm text-ink-3">Not ranked in any of the last 6 periods yet.</p>;
  const W = 320;
  const H = 120;
  const pad = 20;
  const ranks = ranked.map((h) => h.rank!);
  const best = Math.min(...ranks);
  const worst = Math.max(...ranks, best + 1);
  const x = (i: number) => pad + (i * (W - pad * 2)) / Math.max(1, history.length - 1);
  const y = (rank: number) => pad + ((rank - best) / (worst - best)) * (H - pad * 2);
  const points = history.map((h, i) => (h.rank === null ? null : { x: x(i), y: y(h.rank), h })).filter((p): p is NonNullable<typeof p> => p !== null);
  const last = points[points.length - 1];
  const first = ranked[0].rank!;
  const now = ranked[ranked.length - 1].rank!;
  const trend = now < first ? 'Climbing' : now > first ? 'Slipping' : 'Holding steady';

  return (
    <figure className="m-0 flex flex-col gap-2">
      <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full" role="img" aria-label={`Rank over the last ${history.length} periods: ${history.map((h) => (h.rank ? `#${h.rank}` : 'not ranked')).join(', ')}`}>
        <polyline points={points.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinejoin="round" className="text-ink" />
        {points.slice(0, -1).map((p, i) => (
          <text key={i} x={p.x} y={p.y + 16} textAnchor="middle" className="fill-ink-3 text-[10px]">
            #{p.h.rank}
          </text>
        ))}
        {last && (
          <>
            <circle cx={last.x} cy={last.y} r={6} className="fill-yellow stroke-ink" strokeWidth={2} />
            <text x={last.x} y={last.y - 11} textAnchor="middle" className="fill-ink text-[12px] font-bold">
              #{last.h.rank}
            </text>
          </>
        )}
        {history.map((h, i) => (
          <text key={h.from} x={x(i)} y={H + 14} textAnchor="middle" className="fill-ink-3 text-[9px]">
            {weekday(h.from) === 'Mon' && isWeek(h) ? format(parseISO(h.from), 'MMM d') : ''}
          </text>
        ))}
      </svg>
      <figcaption className="text-[13px] text-ink-2">
        {trend}: #{first} → #{now} over {ranked.length} ranked {ranked.length === 1 ? 'period' : 'periods'}.
      </figcaption>
    </figure>
  );
}
