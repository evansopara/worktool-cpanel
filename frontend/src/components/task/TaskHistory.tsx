'use client';

import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  fmtClock,
  fmtMinutes,
  fmtTime,
  fmtWhen,
  MANAGER_ROLES,
  statusInfo,
  type HistoryFilter,
  type HistorySummary,
  type TaskEventItem,
} from '@/lib/tasks';

// History tab of the task panel (TaskPanel artboard, spec §7.9).

const ICONS = {
  created: 'M12 5v14M5 12h14',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0',
  play: 'M8 5v14l11-7z',
  stop: 'M7 7h10v10H7z',
  missed: 'M12 8v4M12 16h.01M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
  ext: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  wait: 'M12 6v6l4 2',
  check: 'M5 12l5 5L20 7',
  back: 'M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-1',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
};

// Marker colours: black = manager, yellow = timer, grey = system,
// red = missed or estimate reached, blue = staff request, dashed = waiting.
const MARKERS = {
  manager: 'bg-ink text-yellow',
  timer: 'bg-yellow text-ink',
  system: 'bg-stone text-ink-2',
  missed: 'bg-missed text-white',
  staff: 'bg-review-tint text-review',
  pending: 'border-2 border-dashed border-pending-line bg-surface text-pending',
};

type Marker = keyof typeof MARKERS;

type Item = {
  key: string;
  at: Date | null; // null = "Now"
  marker: Marker;
  icon: keyof typeof ICONS;
  title: string;
  actor: string;
  detail?: string;
  change?: { field: string; from: string; to: string };
  note?: string;
  session?: { label: string; left: number; width: number; due: number | null };
  decide?: boolean;
};

const FIELD_LABELS: Record<string, string> = {
  title: 'Title',
  status: 'Status',
  priority: 'Priority',
  start_date: 'Scheduled start',
  deadline: 'Deadline',
  estimate_minutes: 'Estimate',
  progress: 'Progress',
  lock_early_start: 'Early start',
};

const CAUSES: Record<string, string> = {
  waited_on_extension: 'Waited on extension',
  manager_change: 'Manager change',
  not_started: 'Not started',
  late_start: 'Late start',
  over_estimate: 'Over estimate',
};

function str(v: unknown): string {
  return v === null || v === undefined ? '' : String(v);
}

function fieldValue(field: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return 'None';
  if (field === 'start_date' || field === 'deadline') return fmtWhen(str(v));
  if (field === 'estimate_minutes') return fmtMinutes(Number(v));
  if (field === 'status') return statusInfo(str(v)).label;
  if (field === 'lock_early_start') return v ? "Can't start before scheduled time" : 'Can start early';
  if (field === 'progress') return `${v}%`;
  return str(v);
}

function toItem(e: TaskEventItem, deadline: string | null): Item {
  const at = new Date(e.created_at);
  const meta = e.meta ?? {};
  const from = e.from ?? {};
  const to = e.to ?? {};
  const isManagerActor = !!e.actor && MANAGER_ROLES.includes(e.actor.role);
  const by = e.actor ? `by ${e.actor.name}` : '· System';
  const base = { key: String(e.id), at, actor: by, marker: (isManagerActor ? 'manager' : e.actor ? 'staff' : 'system') as Marker };
  const reason = str(meta.reason) || undefined;

  switch (e.type) {
    case 'created': {
      const parts = [
        to.estimate_minutes ? `est. ${fmtMinutes(Number(to.estimate_minutes))}` : null,
        to.start_date ? `scheduled ${fmtWhen(str(to.start_date))}` : null,
        to.deadline ? `due ${fmtWhen(str(to.deadline))}` : null,
      ].filter(Boolean);
      return { ...base, icon: 'created', title: 'Task created', detail: parts.join(' · ') || undefined };
    }
    case 'assigned':
      return e.from
        ? { ...base, icon: 'edit', title: 'Reassigned', change: { field: 'Assignee', from: str(from.name), to: str(to.name) || 'Nobody' } }
        : { ...base, icon: 'created', title: `Assigned to ${str(to.name)}` };
    case 'field_edited': {
      const field = str(meta.field);
      const label = FIELD_LABELS[field] ?? field;
      return {
        ...base,
        icon: 'edit',
        title: `${label} edited`,
        change: { field: label, from: fieldValue(field, from.value), to: fieldValue(field, to.value) },
        note: reason,
      };
    }
    case 'instructions_edited':
      return { ...base, icon: 'edit', title: 'Instructions edited', change: { field: 'Instructions', from: 'Previous version', to: 'Updated version' } };
    case 'timer_started': {
      const early = Number(meta.early_minutes ?? 0);
      return {
        ...base,
        marker: 'timer',
        icon: 'play',
        title: early ? 'Timer started early' : 'Timer started',
        detail: early ? `${fmtMinutes(early)} before scheduled start · confirmed in the early-start prompt` : undefined,
        change: meta.clash_title ? { field: 'Scheduled now', from: '', to: str(meta.clash_title) } : undefined,
      };
    }
    case 'timer_stopped': {
      const seconds = Number(meta.session_seconds ?? 0);
      const start = new Date(at.getTime() - seconds * 1000);
      // Bar spans the session, stretched to the deadline if it falls after.
      const due = deadline ? new Date(deadline) : null;
      const end = due && due > at ? due : at;
      const span = Math.max(1, end.getTime() - start.getTime());
      return {
        ...base,
        marker: meta.by_system ? 'system' : 'timer',
        icon: 'stop',
        title: 'Timer stopped',
        detail: meta.by_system ? 'Stopped automatically by the system' : undefined,
        session: {
          label: `Session ${fmtTime(start.toISOString())} → ${fmtTime(at.toISOString())} · ${fmtClock(seconds)}`,
          left: 0,
          width: ((at.getTime() - start.getTime()) / span) * 100,
          due: due && due >= start ? ((due.getTime() - start.getTime()) / span) * 100 : null,
        },
      };
    }
    case 'timer_restarted':
      return { ...base, marker: 'timer', icon: 'play', title: 'Timer restarted after submit', detail: 'Back to In progress' };
    case 'deadline_soon':
      return { ...base, marker: 'system', icon: 'bell', title: `Deadline in ${fmtMinutes(Number(meta.minutes ?? 0))}`, detail: 'Reminder sent' };
    case 'deadline_missed':
      return {
        ...base,
        marker: 'missed',
        icon: 'missed',
        title: 'Deadline missed',
        detail:
          [meta.timer_running ? 'Timer automatically stopped by system' : null, meta.cause ? `Cause: ${CAUSES[str(meta.cause)] ?? str(meta.cause)}` : null]
            .filter(Boolean)
            .join(' · ') || undefined,
      };
    case 'estimate_reached':
      return {
        ...base,
        marker: 'missed',
        icon: 'missed',
        title: 'Estimate reached',
        detail: `${fmtMinutes(Number(meta.estimate_minutes ?? 0))} logged — timer keeps running, now counted as over estimate`,
      };
    case 'extension_requested':
      return { ...base, icon: 'ext', title: 'Extension requested', change: { field: 'Deadline', from: fmtWhen(str(from.deadline)), to: fmtWhen(str(to.deadline)) }, note: reason };
    case 'extension_approved':
      return { ...base, icon: 'check', title: 'Extension approved', change: { field: 'Deadline', from: fmtWhen(str(from.deadline)), to: fmtWhen(str(to.deadline)) }, note: reason };
    case 'extension_declined':
      return { ...base, icon: 'ext', title: 'Extension declined', note: reason };
    case 'estimate_requested':
      return {
        ...base,
        icon: 'ext',
        title: 'More time requested',
        change: { field: 'Estimate', from: fmtMinutes(Number(from.estimate_minutes)), to: fmtMinutes(Number(to.estimate_minutes)) },
        note: reason,
      };
    case 'estimate_approved':
      return {
        ...base,
        icon: 'check',
        title: 'Estimate edited',
        detail: 'More time approved',
        change: { field: 'Estimate', from: fmtMinutes(Number(from.estimate_minutes)), to: fmtMinutes(Number(to.estimate_minutes)) },
        note: reason,
      };
    case 'estimate_declined':
      return { ...base, icon: 'ext', title: 'More time declined', note: reason };
    case 'submitted':
      return { ...base, icon: 'check', title: 'Submitted for review' };
    case 'approved':
      return { ...base, icon: 'check', title: 'Approved', detail: 'Task completed' };
    case 'sent_back':
      return { ...base, icon: 'back', title: 'Sent back', note: reason };
    case 'deleted':
      return { ...base, icon: 'trash', title: 'Task deleted' };
    default:
      return { ...base, icon: 'edit', title: e.type.replace(/_/g, ' ') };
  }
}

const FILTERS: { value: HistoryFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'sessions', label: 'Work sessions' },
  { value: 'edits', label: 'Edits' },
  { value: 'deadlines', label: 'Deadlines' },
];

export function HistorySummaryTiles({ summary, running }: { summary: HistorySummary; running: boolean }) {
  const { worked, start, finish, changes } = summary;
  const spent = finish.logged_minutes ? fmtMinutes(finish.logged_minutes) : '0 min';
  const startTile =
    start.state === 'early'
      ? { v: `${fmtMinutes(start.minutes)} early`, note: 'Timer started before schedule', tone: 'bg-done-tint text-done' }
      : start.state === 'late'
        ? { v: `${fmtMinutes(start.minutes)} late`, note: 'Timer started after schedule', tone: 'bg-missed-tint text-missed' }
        : start.state === 'on_time'
          ? { v: 'On time', note: 'Timer started as scheduled', tone: 'bg-done-tint text-done' }
          : start.state === 'started'
            ? { v: 'Started', note: 'No scheduled start set', tone: 'bg-surface-2 text-ink' }
            : { v: 'Not started', note: 'No timer yet', tone: 'bg-pending-tint text-pending' };
  const finishTile =
    finish.state === 'early'
      ? { k: 'Finish', v: finish.minutes ? `${fmtMinutes(finish.minutes)} early` : 'On time', note: 'Submitted before the deadline', tone: 'bg-done-tint text-done' }
      : finish.state === 'late'
        ? { k: 'Finish', v: `${fmtMinutes(finish.minutes)} late`, note: 'Submitted after the deadline', tone: 'bg-missed-tint text-missed' }
        : finish.state === 'over_estimate'
          ? { k: 'Estimate', v: `${fmtMinutes(finish.minutes)} over`, note: `${spent} logged of ${fmtMinutes(finish.estimate_minutes)}`, tone: 'bg-missed-tint text-missed' }
          : finish.state === 'within_estimate'
            ? { k: 'Estimate', v: 'On track', note: `${spent} logged of ${fmtMinutes(finish.estimate_minutes)}`, tone: 'bg-surface-2 text-ink' }
            : { k: 'Estimate', v: 'None', note: 'No estimate set', tone: 'bg-surface-2 text-ink' };
  const ext = changes.extension;
  const lastTile = ext
    ? { k: 'Extension', v: ext[0].toUpperCase() + ext.slice(1), note: `${changes.edits} edit${changes.edits === 1 ? '' : 's'}` }
    : { k: 'Edits', v: String(changes.edits), note: changes.edits ? 'Changes after creation' : 'No changes after creation' };

  const tiles = [
    { k: 'Time worked', v: fmtClock(worked.seconds), note: `${worked.sessions} work session${worked.sessions === 1 ? '' : 's'}${running ? ' · timer running' : ''}`, tone: 'bg-ink text-white' },
    { k: 'Start', ...startTile },
    finishTile,
    { ...lastTile, tone: 'bg-surface-2 text-ink' },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {tiles.map((t) => (
        <div key={t.k} className={cn('flex flex-col gap-1 rounded-[18px] p-3.5', t.tone)}>
          <span className="text-[11.5px] font-semibold uppercase tracking-[0.06em] opacity-75">{t.k}</span>
          <span className="font-display text-[22px] leading-[1.1] font-bold">{t.v}</span>
          <span className="text-[12.5px] opacity-80">{t.note}</span>
        </div>
      ))}
    </div>
  );
}

export function HistoryFilters({ value, onChange }: { value: HistoryFilter; onChange: (f: HistoryFilter) => void }) {
  return (
    <div role="group" aria-label="Show" className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[12.5px] font-semibold text-ink-3">Show</span>
      {FILTERS.map((f) => (
        <button
          key={f.value}
          type="button"
          aria-pressed={f.value === value}
          onClick={() => onChange(f.value)}
          className={cn(
            'h-[34px] cursor-pointer rounded-full border-0 px-3 font-ui text-[12.5px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ink',
            f.value === value ? 'bg-ink text-white' : 'bg-surface-2 text-ink-2',
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

export function HistoryTimeline({
  events,
  deadline,
  waiting,
  onDecide,
  deciding,
}: {
  events: TaskEventItem[];
  deadline: string | null;
  /** A pending extension: "Waiting for your decision" at the end */
  waiting?: { manager: boolean } | null;
  onDecide?: (status: 'approved' | 'declined') => void;
  deciding?: boolean;
}) {
  const items: Item[] = [...events].reverse().map((e) => toItem(e, deadline));
  if (waiting) {
    items.push({
      key: 'waiting',
      at: null,
      marker: 'pending',
      icon: 'wait',
      title: waiting.manager ? 'Waiting for your decision' : 'Waiting for a manager’s decision',
      actor: '',
      decide: waiting.manager,
    });
  }

  if (items.length === 0) {
    return <p className="m-0 rounded-2xl bg-surface-2 p-4 text-sm text-ink-3">Nothing here yet.</p>;
  }

  const days = items.map((it) => (it.at ? format(it.at, 'MMM d') : ''));
  return (
    <ol className="m-0 flex list-none flex-col p-0">
      {items.map((it, i) => {
        const day = days[i];
        // A day label above the first entry of each day.
        const showDay = day && day !== days.slice(0, i).filter(Boolean).at(-1);
        const last = i === items.length - 1;
        return (
          <li key={it.key} className="flex flex-col">
            {showDay && <p className="m-0 mt-1.5 mb-2.5 text-xs font-bold uppercase tracking-[0.07em] text-ink-3">{day}</p>}
            <div className="flex gap-3">
              <span className="w-[58px] shrink-0 pt-[7px] text-right font-mono text-xs font-semibold text-ink-2">
                {it.at ? format(it.at, 'h:mm a') : 'Now'}
              </span>
              <span className="flex shrink-0 flex-col items-center">
                <span className={cn('flex size-[30px] items-center justify-center rounded-full', MARKERS[it.marker])}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d={ICONS[it.icon]} />
                  </svg>
                </span>
                {!last && <span className="min-h-4 w-0.5 flex-1 bg-line" />}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-1 pb-5">
                <p className="m-0 text-[14.5px] leading-[1.4]">
                  <strong>{it.title}</strong> {it.actor && <span className="text-ink-3">{it.actor}</span>}
                </p>
                {it.detail && <p className="m-0 text-[13.5px] text-ink-2">{it.detail}</p>}
                {it.change && (
                  <p className="m-0 flex flex-wrap items-center gap-1.5 rounded-[14px] bg-surface-2 px-3 py-2.5 text-[13.5px]">
                    <span className="font-semibold">{it.change.field}</span>
                    {it.change.from && <span className="text-idle line-through">{it.change.from}</span>}
                    <span aria-hidden="true">→</span>
                    <span className="font-bold">{it.change.to}</span>
                  </p>
                )}
                {it.note && <p className="m-0 text-[13px] text-ink-2 italic">“{it.note}”</p>}
                {it.session && (
                  <div className="flex flex-col gap-1.5 rounded-[14px] bg-brief-tint p-3">
                    <div className="relative h-2.5 overflow-hidden rounded-full bg-brief-track">
                      <span className="absolute inset-y-0 rounded-full bg-ink" style={{ left: `${it.session.left}%`, width: `${it.session.width}%` }} />
                      {it.session.due !== null && <span className="absolute inset-y-0 w-0.5 bg-missed" style={{ left: `${Math.min(99.5, it.session.due)}%` }} />}
                    </div>
                    <span className="font-mono text-[12.5px] font-semibold">{it.session.label}</span>
                  </div>
                )}
                {it.decide && onDecide && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={deciding}
                      onClick={() => onDecide('declined')}
                      className="h-10 cursor-pointer rounded-full border-0 bg-stone px-4 font-ui text-[13.5px] font-semibold text-missed outline-none focus-visible:ring-2 focus-visible:ring-ink disabled:opacity-40"
                    >
                      Decline
                    </button>
                    <button
                      type="button"
                      disabled={deciding}
                      onClick={() => onDecide('approved')}
                      className="h-10 cursor-pointer rounded-full border-0 bg-yellow px-[18px] font-ui text-[13.5px] font-bold text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink disabled:opacity-40"
                    >
                      Approve
                    </button>
                  </div>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
