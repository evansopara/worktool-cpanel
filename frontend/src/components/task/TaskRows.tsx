'use client';

import { FileText, Pause, Pencil, Play, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IconButton, ScheduleInline, StatusPill } from '@/components/wc';
import { DEADLINE_PASSED, deadlinePassed, fmtClock, fmtMinutes, fmtTime, fmtWhen, isMissed, statusInfo, type TaskListItem } from '@/lib/tasks';
import { LiveClock, TimerDot } from './LiveClock';
import type { ActionTask, useTaskActions } from './useTaskActions';

// Task lists: desktop tables (Tasks, StaffTasks) and mobile cards (MTasks, MStaffTasks).

type Actions = ReturnType<typeof useTaskActions>;

export function toActionTask(t: TaskListItem): ActionTask {
  return {
    id: t.id,
    title: t.title,
    project: t.project?.name,
    assignedBy: t.assigned_by?.name,
    deadline: t.deadline,
    estimateMinutes: t.estimate_minutes,
  };
}

/** "Opens at 1:01 PM" while a locked task's scheduled start is ahead. */
function opensAt(t: TaskListItem): string | null {
  return t.lock_early_start && t.start_date && new Date(t.start_date) > new Date() ? `Opens at ${fmtTime(t.start_date)}` : null;
}

/** Notes under a staff task (extension pending, missed without a request, resubmit). */
function staffNote(t: TaskListItem): { text: string; tone: string } | null {
  const passed = deadlinePassed(t);
  if (t.pending_extension) return { text: passed ? 'Extension requested — the timer unlocks if it’s approved.' : 'Extension requested — you can keep working while it’s decided.', tone: 'text-pending' };
  if (t.status === 'review') return { text: passed ? 'Submitted for review.' : 'Submitted for review. You can still restart the timer or resubmit.', tone: 'text-review' };
  return null;
}

const oneWordPerLine = (name?: string | null) => (name ?? '—').split(' ').join('\n');

const tableHead = 'grid gap-x-4 px-1 pt-3.5 pb-2.5 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink-3';
const MANAGER_COLS = 'grid-cols-[minmax(0,3fr)_132px_104px_104px_minmax(0,2.1fr)_88px]';
const STAFF_COLS = 'grid-cols-[minmax(0,3fr)_132px_104px_104px_minmax(0,2fr)_184px]';

function TitleCell({ t, onOpen, extra }: { t: TaskListItem; onOpen: (id: number) => void; extra?: React.ReactNode }) {
  return (
    <span className="flex min-w-0 flex-col gap-[3px]">
      <button
        type="button"
        onClick={() => onOpen(t.id)}
        className="cursor-pointer border-0 bg-transparent p-0 text-left font-ui text-[15px] leading-[1.35] font-bold text-ink outline-none hover:underline focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ink"
      >
        {t.title}
      </button>
      <span className="text-[12.5px] text-ink-3">{t.project?.name}</span>
      {extra}
    </span>
  );
}

function StatusCell({ t }: { t: TaskListItem }) {
  const s = statusInfo(t.status);
  return (
    <span>
      <StatusPill tone={s.tone}>{s.label}</StatusPill>
    </span>
  );
}

// ── Manager: desktop table ────────────────────────────────────────────

export function ManagerTaskTable({
  tasks,
  since,
  onOpen,
  onEdit,
  onDelete,
  footer,
}: {
  tasks: TaskListItem[];
  since: number;
  onOpen: (id: number) => void;
  onEdit: (id: number) => void;
  onDelete: (t: TaskListItem) => void;
  footer: React.ReactNode;
}) {
  return (
    <section aria-label="Task list" className="overflow-x-auto rounded-[28px] bg-surface px-6 pt-2 pb-[18px]">
      <div className="min-w-[820px]">
        <div aria-hidden="true" className={cn(tableHead, MANAGER_COLS)}>
          <span>Task</span>
          <span>Status</span>
          <span>Assignee</span>
          <span>Time</span>
          <span>Schedule</span>
          <span className="text-right">Actions</span>
        </div>
        <ul className="m-0 flex list-none flex-col p-0">
          {tasks.length === 0 && <li className="border-t border-line px-1 py-8 text-center text-sm text-ink-3">No tasks match.</li>}
          {tasks.map((t) => (
            <li key={t.id} className={cn('grid items-center gap-x-4 border-t border-line px-1 py-3.5', MANAGER_COLS)}>
              <TitleCell
                t={t}
                onOpen={onOpen}
                extra={
                  t.has_instructions && (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-2">
                      <FileText className="size-[13px]" strokeWidth={2} aria-hidden="true" />
                      Has instructions
                    </span>
                  )
                }
              />
              <StatusCell t={t} />
              <span className="text-[13.5px] leading-[1.35] font-semibold whitespace-pre-line">{oneWordPerLine(t.assignee?.name)}</span>
              <span className="flex flex-col gap-px">
                <LiveClock seconds={t.logged_seconds} running={t.is_timer_running} since={since} className="text-[13.5px]" />
                <span className="text-xs text-ink-3">est. {fmtMinutes(t.estimate_minutes)}</span>
              </span>
              <ScheduleInline start={fmtWhen(t.start_date)} deadline={fmtWhen(t.deadline)} missed={isMissed(t)} />
              <span className="flex justify-end gap-1.5">
                <IconButton aria-label={`Edit ${t.title}`} onClick={() => onEdit(t.id)}>
                  <Pencil strokeWidth={2} aria-hidden="true" />
                </IconButton>
                <IconButton variant="danger" aria-label={`Delete ${t.title}`} onClick={() => onDelete(t)}>
                  <Trash2 strokeWidth={2} aria-hidden="true" />
                </IconButton>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="border-t border-line pt-3.5">{footer}</div>
    </section>
  );
}

// ── Staff: desktop table ──────────────────────────────────────────────

function TimerButtons({ t, actions, size }: { t: TaskListItem; actions: Actions; size: 'sm' | 'md' | 'lg' }) {
  const locked = !t.is_timer_running ? opensAt(t) : null;
  const passed = deadlinePassed(t);
  const h = size === 'sm' ? 'h-[38px] px-3.5 text-[13px]' : size === 'md' ? 'h-10 px-3.5 text-[13.5px]' : 'h-11 px-4 text-[14.5px] [&_svg]:size-3';
  const a = toActionTask(t);
  return (
    <>
      <button
        type="button"
        disabled={actions.busy === t.id || !!locked || passed}
        title={passed ? DEADLINE_PASSED : undefined}
        aria-label={`${t.is_timer_running ? 'Stop' : 'Start'} timer for ${t.title}`}
        onClick={() => (t.is_timer_running ? actions.stop(a) : actions.start(a))}
        className={cn(
          'inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border-0 font-ui font-bold outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50',
          h,
          t.is_timer_running ? 'bg-ink text-white' : 'bg-done-tint text-done',
        )}
      >
        {!locked && (t.is_timer_running ? <Pause className="size-[11px] fill-current" aria-hidden="true" /> : <Play className="size-[11px] fill-current" aria-hidden="true" />)}
        {locked ?? (t.is_timer_running ? 'Stop' : 'Start')}
      </button>
      <button
        type="button"
        disabled={actions.busy === t.id || passed}
        title={passed ? DEADLINE_PASSED : undefined}
        onClick={() => actions.submit(a)}
        className={cn(
          'shrink-0 cursor-pointer rounded-full border-0 bg-yellow font-ui font-bold text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-1 disabled:opacity-50',
          h,
        )}
      >
        Submit
      </button>
    </>
  );
}

export function StaffTaskTable({
  tasks,
  since,
  actions,
  onOpen,
  onRequestExtension,
  footer,
}: {
  tasks: TaskListItem[];
  since: number;
  actions: Actions;
  onOpen: (id: number) => void;
  onRequestExtension: (id: number) => void;
  footer: React.ReactNode;
}) {
  return (
    <section aria-label="Task list" className="overflow-x-auto rounded-[28px] bg-surface px-6 pt-2 pb-[18px]">
      <div className="min-w-[900px]">
        <div aria-hidden="true" className={cn(tableHead, STAFF_COLS)}>
          <span>Task</span>
          <span>Status</span>
          <span>Assigned by</span>
          <span>Time</span>
          <span>Schedule</span>
          <span className="text-right">Actions</span>
        </div>
        <ul className="m-0 flex list-none flex-col p-0">
          {tasks.length === 0 && <li className="border-t border-line px-1 py-8 text-center text-sm text-ink-3">No tasks here.</li>}
          {tasks.map((t) => {
            const note = staffNote(t);
            const missedNoRequest = t.status === 'deadline_missed' && !t.pending_extension;
            return (
              <li key={t.id} className={cn('grid items-center gap-x-4 gap-y-1.5 border-t border-line px-1 py-3.5', STAFF_COLS)}>
                <TitleCell
                  t={t}
                  onOpen={onOpen}
                  extra={
                    t.has_instructions && (
                      <button
                        type="button"
                        onClick={() => actions.read(toActionTask(t))}
                        className="flex cursor-pointer items-center gap-1.5 self-start border-0 bg-transparent p-0 font-ui text-xs font-semibold text-ink-2 outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ink"
                      >
                        <FileText className="size-[13px]" strokeWidth={2} aria-hidden="true" />
                        Instructions · <span className="underline">Read</span>
                      </button>
                    )
                  }
                />
                <StatusCell t={t} />
                <span className="text-[13.5px] leading-[1.35] font-semibold whitespace-pre-line">{oneWordPerLine(t.assigned_by?.name)}</span>
                <span className="flex flex-col gap-px">
                  <span className="flex items-center gap-1.5">
                    {t.is_timer_running && <TimerDot running className="size-[7px]" />}
                    <LiveClock seconds={t.logged_seconds} running={t.is_timer_running} since={since} className="text-[13.5px]" />
                  </span>
                  <span className="text-xs text-ink-3">est. {fmtMinutes(t.estimate_minutes)}</span>
                </span>
                <ScheduleInline start={fmtWhen(t.start_date)} deadline={fmtWhen(t.deadline)} missed={isMissed(t)} />
                <span className="flex justify-end gap-1.5">
                  {t.status === 'completed' ? <span className="text-[13px] font-semibold text-done">Completed</span> : <TimerButtons t={t} actions={actions} size="sm" />}
                </span>
                {(note || missedNoRequest) && (
                  <span className={cn('col-span-full flex flex-wrap items-center gap-3 text-[12.5px] font-semibold', note?.tone ?? 'text-missed')}>
                    {note?.text ?? 'Deadline missed — ask for more time if you need it.'}
                    {missedNoRequest && (
                      <button
                        type="button"
                        onClick={() => onRequestExtension(t.id)}
                        className="h-[34px] cursor-pointer rounded-full border-0 bg-stone px-3.5 font-ui text-[13px] font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink"
                      >
                        Request extension
                      </button>
                    )}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      <div className="border-t border-line pt-3.5">{footer}</div>
    </section>
  );
}

// ── Mobile card (staff and managers) ──────────────────────────────────

/** "Oct 26, 2026" + "1:01 PM – 4:00 PM"; both dates when the task spans days. */
function scheduleLines(start: string | null, deadline: string | null): { day: string; time: string } {
  if (!start && !deadline) return { day: 'No dates set', time: '' };
  const day = (d: Date, year = true) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(year ? { year: 'numeric' } : {}) });
  if (!start || !deadline) {
    const only = new Date((deadline ?? start)!);
    return { day: day(only), time: `${deadline ? 'Due' : 'Starts'} ${fmtTime(deadline ?? start)}` };
  }
  const a = new Date(start);
  const b = new Date(deadline);
  const sameDay = a.toDateString() === b.toDateString();
  return {
    day: sameDay ? day(a) : `${day(a, a.getFullYear() !== b.getFullYear())} – ${day(b)}`,
    time: `${fmtTime(start)} – ${fmtTime(deadline)}`,
  };
}

/**
 * One task on phones (Tasks and Home): project and title on the left with the
 * actions under them; status, timer and schedule on the right.
 */
function TaskCard({ t, since, onOpen, meta, actions, footer }: { t: TaskListItem; since: number; onOpen: (id: number) => void; meta?: string; actions: React.ReactNode; footer?: React.ReactNode }) {
  const s = statusInfo(t.status);
  const missed = isMissed(t);
  const when = scheduleLines(t.start_date, t.deadline);
  return (
    <article className="flex flex-col gap-3.5 rounded-[26px] bg-surface p-4 text-ink">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-[13px] font-semibold text-ink-2">
            {t.project?.name}
            {meta && <span className="font-normal text-ink-3"> · {meta}</span>}
          </span>
          <h2 className="m-0 text-[17px] leading-[1.25] font-bold">
            <button type="button" onClick={() => onOpen(t.id)} className="cursor-pointer border-0 bg-transparent p-0 text-left font-ui text-[17px] leading-[1.25] font-bold text-ink outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ink">
              {t.title}
            </button>
          </h2>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <StatusPill tone={s.tone} className="text-[11px] tracking-[0.06em] uppercase">
            {s.label}
          </StatusPill>
          <span className={cn('flex items-center gap-2', t.is_timer_running ? 'text-review' : 'text-ink')}>
            {t.is_timer_running && <span aria-hidden="true" className="size-2 rounded-full bg-review animate-wcpulse motion-reduce:animate-none" />}
            <LiveClock seconds={t.logged_seconds} running={t.is_timer_running} since={since} className="text-[21px] leading-none font-semibold" />
          </span>
        </div>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="flex shrink-0 flex-nowrap gap-2">{actions}</div>
        <span className="flex min-w-0 flex-col items-end gap-0.5 text-right">
          <span className="text-[12.5px] text-ink-3">{when.day}</span>
          {when.time && <span className={cn('text-[13px] leading-snug font-bold', missed ? 'text-missed' : 'text-ink')}>{when.time}</span>}
        </span>
      </div>
      {footer}
    </article>
  );
}

const pillButton = 'inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-full border-0 px-4 font-ui text-[14.5px] font-bold outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-1 [&_svg]:size-3.5';

export function ManagerTaskCard({
  t,
  since,
  onOpen,
  onEdit,
  onDelete,
}: {
  t: TaskListItem;
  since: number;
  onOpen: (id: number) => void;
  onEdit: (id: number) => void;
  onDelete: (t: TaskListItem) => void;
}) {
  return (
    <TaskCard
      t={t}
      since={since}
      onOpen={onOpen}
      meta={t.assignee?.name ?? 'Unassigned'}
      actions={
        <>
          <button type="button" onClick={() => onEdit(t.id)} className={cn(pillButton, 'bg-stone text-ink')}>
            <Pencil strokeWidth={2} aria-hidden="true" />
            Edit
          </button>
          <button type="button" onClick={() => onDelete(t)} aria-label={`Delete ${t.title}`} className={cn(pillButton, 'bg-missed-tint px-3.5 text-missed')}>
            <Trash2 strokeWidth={2} aria-hidden="true" />
          </button>
        </>
      }
    />
  );
}

export function StaffTaskCard({
  t,
  since,
  actions,
  onOpen,
  onRequestExtension,
}: {
  t: TaskListItem;
  since: number;
  actions: Actions;
  onOpen: (id: number) => void;
  onRequestExtension: (id: number) => void;
}) {
  const note = staffNote(t);
  const missedNoRequest = t.status === 'deadline_missed' && !t.pending_extension;
  return (
    <TaskCard
      t={t}
      since={since}
      onOpen={onOpen}
      actions={t.status === 'completed' ? <span className="py-3 text-[13px] font-semibold text-done">Completed · {fmtClock(t.logged_seconds)} logged</span> : <TimerButtons t={t} actions={actions} size="lg" />}
      footer={
        (note || missedNoRequest) && (
          <div className="flex flex-wrap items-center gap-2.5 border-t border-line pt-3">
            <p className={cn('m-0 flex-1 text-[12.5px] font-semibold', note?.tone ?? 'text-missed')}>{note?.text ?? 'Deadline missed — ask for more time if you need it.'}</p>
            {missedNoRequest && (
              <button type="button" onClick={() => onRequestExtension(t.id)} className="h-9 cursor-pointer rounded-full border-0 bg-stone px-3.5 font-ui text-[13px] font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink">
                Request extension
              </button>
            )}
          </div>
        )
      }
    />
  );
}
