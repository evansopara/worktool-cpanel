'use client';

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/wc';
import {
  BOARD_COLUMNS,
  MEASURE_LABEL,
  measureText,
  periodWord,
  roleName,
  weekday,
  type Board,
  type BoardRow,
  type CheckStatus,
  type DayCheck,
  type Range,
} from '@/lib/performance';

export const card = 'rounded-[26px] bg-surface p-5 lg:rounded-[28px] lg:p-6';
export const cardTitle = 'm-0 font-display text-[21px] font-bold tracking-[-0.02em] lg:text-[24px]';
export const th = 'px-2 pb-3 text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-3';

/** ↑2 green, ↓1 red, — grey. */
export function Movement({ value, className }: { value: number | null; className?: string }) {
  if (!value) {
    return (
      <span className={cn('text-[13px] font-semibold text-ink-3', className)} aria-label="No change">
        —
      </span>
    );
  }
  const up = value > 0;
  return (
    <span
      className={cn('inline-flex items-center gap-0.5 text-[13px] font-bold', up ? 'text-done' : 'text-missed', className)}
      aria-label={`${up ? 'Up' : 'Down'} ${Math.abs(value)}`}
    >
      {up ? <ArrowUp className="size-3" strokeWidth={2.6} aria-hidden="true" /> : <ArrowDown className="size-3" strokeWidth={2.6} aria-hidden="true" />}
      {Math.abs(value)}
    </span>
  );
}

/** Avatar, name and a muted line under it. */
export function PersonCell({
  name,
  sub,
  tag,
  onOpen,
  tone = 'stone',
}: {
  name: string;
  sub?: string;
  tag?: React.ReactNode;
  onOpen?: () => void;
  tone?: 'stone' | 'yellow';
}) {
  const label = (
    <span className="flex min-w-0 flex-col">
      <span className="flex items-center gap-2 truncate text-[14.5px] font-bold text-ink">
        <span className="truncate">{name}</span>
        {tag}
      </span>
      {sub && <span className="truncate text-xs text-ink-3">{sub}</span>}
    </span>
  );
  return (
    <span className="flex min-w-0 items-center gap-3">
      <Avatar name={name} size="sm" tone={tone} className="text-[11px]" />
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 cursor-pointer rounded-md border-0 bg-transparent p-0 text-left font-ui outline-none hover:[&_span]:underline focus-visible:ring-2 focus-visible:ring-ink"
        >
          {label}
        </button>
      ) : (
        label
      )}
    </span>
  );
}

export function YouTag() {
  return <span className="rounded-full bg-ink px-2 py-0.5 text-[10.5px] font-bold text-yellow">You</span>;
}

const notRanked = (r: BoardRow) => `Not ranked yet · ${r.tasks} of 5 tasks`;

/** Top 3: #2, #1 (centre, black), #3 (spec §4). */
export function Podium({ rows, compact }: { rows: BoardRow[]; compact?: boolean }) {
  const top = [rows.find((r) => r.rank === 2), rows.find((r) => r.rank === 1), rows.find((r) => r.rank === 3)];
  if (!top[1]) return null;
  return (
    <div className="grid grid-cols-3 items-end gap-2 lg:gap-3.5">
      {top.map((r, i) => {
        if (!r) return <div key={i} />;
        const first = r.rank === 1;
        return (
          <div
            key={r.user.id}
            className={cn(
              'flex flex-col items-center gap-1 rounded-[22px] px-2 text-center lg:rounded-[28px] lg:gap-1.5',
              first ? 'bg-ink pt-5 pb-5 text-white lg:pt-8 lg:pb-8' : 'bg-surface pt-4 pb-4 lg:pt-6 lg:pb-6',
              !first && (r.rank === 2 ? 'lg:mt-8' : 'lg:mt-12'),
            )}
          >
            <span
              className={cn(
                'font-display font-bold leading-none tracking-[-0.03em]',
                first ? 'text-[32px] text-yellow lg:text-[46px]' : 'text-[24px] lg:text-[32px]',
                r.rank === 2 && 'text-ink-3',
                r.rank === 3 && 'text-pending',
              )}
            >
              #{r.rank}
            </span>
            <Avatar name={r.user.name} size={first && !compact ? 'lg' : 'md'} tone={first ? 'yellow' : 'stone'} className={cn(first && !compact && 'lg:size-[58px]')} />
            <span className="mt-1 max-w-full truncate px-1 text-[13px] font-bold lg:text-[15px]">{r.user.name}</span>
            <span className={cn('hidden text-xs lg:block', first ? 'text-on-dark' : 'text-ink-3')}>{roleName(r.user.role)}</span>
            <span className="font-display text-[19px] font-bold lg:text-[24px]">{r.score ?? '—'}</span>
          </div>
        );
      })}
    </div>
  );
}

type SortKey = 'rank' | 'name' | 'score' | string;

/**
 * Ranked table (desktop). `columns` picks the measure columns; sortable by
 * any column header (Overview's People table).
 */
export function BoardTable({
  rows,
  board,
  columns,
  meId,
  sortable,
  showTasks = true,
  onOpen,
}: {
  rows: BoardRow[];
  board: Board;
  columns?: string[];
  meId?: number;
  sortable?: boolean;
  showTasks?: boolean;
  onOpen?: (id: number) => void;
}) {
  const cols = columns ? columns.map((k) => BOARD_COLUMNS[board].find((c) => c.key === k)!).filter(Boolean) : BOARD_COLUMNS[board];
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'rank', dir: 1 });

  const sorted = [...rows].sort((a, b) => {
    const val = (r: BoardRow): number | string => {
      if (sort.key === 'rank') return r.rank ?? 9999;
      if (sort.key === 'name') return r.user.name.toLowerCase();
      if (sort.key === 'score') return r.score ?? -1;
      // Estimate accuracy sorts by closeness to 100%.
      const m = r.measures[sort.key];
      return m?.value == null ? -1 : sort.key === 'estimate' ? (m.score ?? -1) : m.value;
    };
    const [x, y] = [val(a), val(b)];
    return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
  });

  const header = (key: SortKey, label: string, align = 'text-left', defaultDir: 1 | -1 = -1) => {
    const on = sort.key === key;
    if (!sortable)
      return (
        <th key={key} className={cn(th, align)}>
          {label}
        </th>
      );
    return (
      <th key={key} className={cn(th, align)} aria-sort={on ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
        <button
          type="button"
          onClick={() => setSort(on ? { key, dir: sort.dir === 1 ? -1 : 1 } : { key, dir: defaultDir })}
          className={cn('inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 font-ui text-[11px] font-semibold uppercase tracking-[0.07em] outline-none focus-visible:ring-2 focus-visible:ring-ink', on ? 'text-ink' : 'text-ink-3 hover:text-ink')}
        >
          {label}
          {on && (sort.dir === 1 ? <ChevronUp className="size-3" aria-hidden="true" /> : <ChevronDown className="size-3" aria-hidden="true" />)}
        </button>
      </th>
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse">
        <thead>
          <tr className="border-b border-line">
            {header('rank', 'Rank', 'text-left w-14', 1)}
            {header('name', 'Name', 'text-left', 1)}
            {header('score', 'Score')}
            {cols.map((c) => header(c.key, c.label))}
            <th className={cn(th, 'text-right')}>Change</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const me = r.user.id === meId;
            return (
              <tr key={r.user.id} className={cn('border-b border-line last:border-0', me && 'bg-brief-tint')}>
                <td className="px-2 py-3 font-display text-[19px] font-bold">{r.rank ?? '—'}</td>
                <td className="px-2 py-3">
                  <PersonCell
                    name={r.user.name}
                    sub={r.ranked ? `${roleName(r.user.role)}${showTasks ? ` · ${r.tasks} tasks` : ''}` : notRanked(r)}
                    tag={me ? <YouTag /> : undefined}
                    onOpen={onOpen ? () => onOpen(r.user.id) : undefined}
                  />
                </td>
                <td className="px-2 py-3 font-display text-[19px] font-bold">{r.score ?? '—'}</td>
                {cols.map((c) => {
                  const m = r.measures[c.key];
                  const low = c.key === 'attendance' && m?.value != null && m.value < 80;
                  return (
                    <td key={c.key} className={cn('px-2 py-3 text-[13.5px]', low && 'font-semibold text-missed')}>
                      {measureText(c.key, m)}
                    </td>
                  );
                })}
                <td className="px-2 py-3 text-right">
                  <Movement value={r.movement} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Mobile list (MLeaderboard): rank, name, on-time line, score and movement. */
export function BoardList({ rows, board, meId, onOpen }: { rows: BoardRow[]; board: Board; meId?: number; onOpen?: (id: number) => void }) {
  const key = board === 'pm' ? 'team_on_time' : 'on_time';
  return (
    <ol className="m-0 flex list-none flex-col overflow-hidden rounded-[24px] bg-surface p-0">
      {rows.map((r) => {
        const m = r.measures[key];
        const body = (
          <>
            <span className="w-7 shrink-0 font-display text-lg font-bold">{r.rank ?? '—'}</span>
            <Avatar name={r.user.name} size="md" tone="stone" className="text-[13px]" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="flex items-center gap-2 truncate text-[15.5px] font-bold">
                <span className="truncate">{r.user.name}</span>
                {r.user.id === meId && <YouTag />}
              </span>
              <span className="truncate text-[13px] text-ink-3">{r.ranked ? `${measureText(key, m)} on time` : notRanked(r)}</span>
            </span>
            <span className="flex shrink-0 flex-col items-end">
              <span className="font-display text-[19px] font-bold">{r.score ?? '—'}</span>
              <Movement value={r.movement} className="text-xs" />
            </span>
          </>
        );
        return (
          <li key={r.user.id} className={cn('border-b border-line last:border-0', r.user.id === meId && 'bg-brief-tint')}>
            {onOpen ? (
              <button type="button" onClick={() => onOpen(r.user.id)} className="flex w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-4 py-3.5 text-left font-ui text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-inset">
                {body}
              </button>
            ) : (
              <div className="flex items-center gap-3 px-4 py-3.5">{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

const CHECK_TEXT: Record<CheckStatus, { label: string; text: string; dot: string; pill: string }> = {
  answered: { label: 'Answered', text: 'text-done', dot: 'bg-live', pill: 'bg-done-tint text-done' },
  late: { label: 'Late', text: 'text-pending', dot: 'bg-pending-line', pill: 'bg-pending-tint text-pending' },
  missed: { label: 'Missed', text: 'text-missed', dot: 'bg-missed', pill: 'bg-missed-tint text-missed' },
  pending: { label: 'Waiting', text: 'text-review', dot: 'bg-review-bar', pill: 'bg-review-tint text-review' },
  skipped: { label: 'Skipped', text: 'text-ink-3', dot: 'bg-idle', pill: 'bg-todo-tint text-todo' },
};

export function checkLabel(status: CheckStatus, onLeave = true): string {
  if (status === 'skipped') return onLeave ? 'Skipped · leave' : 'Skipped';
  return CHECK_TEXT[status].label;
}

export function CheckPill({ status }: { status: CheckStatus }) {
  return <span className={cn('inline-block rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap', CHECK_TEXT[status].pill)}>{checkLabel(status)}</span>;
}

export function CheckDot({ status }: { status: CheckStatus }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[12.5px] font-semibold whitespace-nowrap', CHECK_TEXT[status].text)}>
      <span className={cn('size-2 rounded-full', CHECK_TEXT[status].dot)} aria-hidden="true" />
      {checkLabel(status, false)}
    </span>
  );
}

/** "On time" / "Late" / … as used in the day boxes. */
export function checkWord(status: CheckStatus | null): { text: string; cls: string } {
  if (!status) return { text: '—', cls: 'text-ink-3' };
  if (status === 'answered') return { text: 'On time', cls: 'text-done' };
  if (status === 'pending') return { text: 'Waiting', cls: 'text-review' };
  if (status === 'skipped') return { text: 'Not counted', cls: 'text-ink-3' };
  return { text: CHECK_TEXT[status].label, cls: CHECK_TEXT[status].text };
}

/** Seconds left until `iso`, ticking every second. */
export function useSecondsLeft(iso: string | null | undefined, offsetMs = 0): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!iso) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [iso]);
  if (!iso) return 0;
  return Math.max(0, Math.floor((new Date(iso).getTime() - (now + offsetMs)) / 1000));
}

export const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

/** Staff: the yellow "Your position" card (StaffLeaderboard). */
export function MyPositionCard({ row, lift, range }: { row: BoardRow; lift: string | null; range: Range }) {
  const word = periodWord(range);
  const move = row.movement
    ? `${row.movement > 0 ? 'Up' : 'Down'} ${Math.abs(row.movement)} ${Math.abs(row.movement) === 1 ? 'place' : 'places'} since the last period`
    : 'Same place as the last period';
  const liftText = lift ? `Biggest lift: ${liftAdvice(lift, row)}` : null;
  return (
    <section aria-label="Your position" className="flex items-center gap-4 rounded-[24px] bg-yellow px-5 py-4 lg:gap-6 lg:rounded-[26px] lg:px-7 lg:py-5">
      <span className="font-display text-[38px] leading-none font-bold tracking-[-0.03em] lg:text-[46px]">{row.rank ? `#${row.rank}` : '—'}</span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[15px] font-bold lg:text-base">
          {row.ranked ? `Your position ${word} · ${row.score ?? '—'} points` : `Not ranked yet · ${row.tasks} of 5 tasks ${word}`}
        </span>
        <span className="text-[13px] text-ink-2">{[row.ranked ? move : null, liftText].filter(Boolean).join(' · ')}</span>
      </span>
    </section>
  );
}

function liftAdvice(key: string, row: BoardRow): string {
  const m = row.measures[key];
  switch (key) {
    case 'attendance': {
      const misses = [m.late ? `${m.late} late` : '', m.missed ? `${m.missed} missed` : ''].filter(Boolean).join(', ');
      return `answer every attendance check${misses ? ` (${misses} this period)` : ''}`;
    }
    case 'on_time':
    case 'team_on_time':
      return 'submit every task by its deadline';
    case 'first_time':
      return 'get tasks approved first time';
    case 'estimate':
      return 'keep logged time close to the estimate';
    default:
      return MEASURE_LABEL[key]?.toLowerCase() ?? key;
  }
}

/** Day boxes for one person's checks (staff strip, person view). */
export function AttendanceDays({ days, detailed }: { days: DayCheck[]; detailed?: boolean }) {
  if (!days.length) return <p className="m-0 text-sm text-ink-3">No checks in this period yet.</p>;
  return (
    <ul className={cn('m-0 grid list-none gap-2 p-0', detailed ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5' : 'grid-cols-5')}>
      {days.map((d) => {
        const w = checkWord(d.status);
        return (
          <li key={d.date} className={cn('flex flex-col gap-0.5 rounded-2xl bg-surface-2', detailed ? 'px-3.5 py-3' : 'items-center px-2 py-2.5 text-center')}>
            <span className="text-[11.5px] font-semibold text-ink-3">
              {weekday(d.date)}
              {detailed && ` · sent ${new Date(d.sent_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
            </span>
            <span className={cn('font-bold', detailed ? 'text-[15px]' : 'text-[12.5px]', w.cls)}>{w.text}</span>
            {detailed && (
              <span className="font-mono text-xs text-ink-2">
                {d.responded_at ? `Answered ${new Date(d.responded_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : 'No answer'}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function Loading({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col gap-3.5', className)} aria-busy="true">
      <div className="h-32 animate-pulse rounded-[28px] bg-surface" />
      <div className="h-72 animate-pulse rounded-[28px] bg-surface" />
    </div>
  );
}

export function ErrorNote({ text = 'Couldn’t load this. Check your connection and try again.' }: { text?: string }) {
  return <p className="m-0 rounded-[24px] bg-surface p-6 text-center text-sm text-ink-3">{text}</p>;
}
