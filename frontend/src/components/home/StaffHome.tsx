'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { FileText, Pause, Play } from 'lucide-react';
import type { User } from '@/types';
import { cn } from '@/lib/utils';
import { DateRange, Pagination, ScheduleBoxes, ScheduleInline, SearchField, SegmentedFilter, StatusPill, type DateRangeValue } from '@/components/wc';
import { PageBody } from '@/components/shell/PageHeader';
import { fmtMinutes, fmtTime, fmtWhen, homeApi, isMissed, statusInfo, taskApi, type HomeData, type TaskListItem } from '@/lib/tasks';
import { LiveClock, TimerDot } from '@/components/task/LiveClock';
import { toActionTask } from '@/components/task/TaskRows';
import { useTaskWorkspace } from '@/components/task/useTaskWorkspace';
import { CardTitle, Greeting, MobileTopBar } from './parts';

// Staff Home (StaffHome / MStaffHome artboards, spec §6–7.5): running-task
// card, technical support count, extension request, and My tasks.

type Filter = 'all' | 'active' | 'completed';
type Workspace = ReturnType<typeof useTaskWorkspace>;

export function StaffHome({ user }: { user: User }) {
  const [now] = useState(() => new Date());
  const ws = useTaskWorkspace(user);
  const home = useQuery({ queryKey: ['home'], queryFn: homeApi.get, refetchInterval: 30_000 });

  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [range, setRange] = useState<DateRangeValue>({ from: '', to: '' });
  const [page, setPage] = useState(1);
  useEffect(() => {
    const id = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [search]);

  const params = { tab: filter, q, from: range.from, to: range.to, page };
  const list = useQuery({ queryKey: ['tasks', 'home', params], queryFn: () => taskApi.list(params), placeholderData: keepPreviousData, refetchInterval: 30_000 });
  // Counts on the All / Active / Completed filter.
  const counts = useQuery({
    queryKey: ['tasks', 'home-counts'],
    queryFn: async () => {
      const [a, b, c] = await Promise.all((['all', 'active', 'completed'] as const).map((tab) => taskApi.list({ tab, page: 1 })));
      return { all: a.meta.total, active: b.meta.total, completed: c.meta.total };
    },
  });

  const tasks = list.data?.data ?? [];
  const total = list.data?.meta.total ?? 0;
  const first = total ? (page - 1) * 10 + 1 : 0;
  const d = home.data;
  const supportCount = d?.status_counts.technical_support ?? 0;
  const pickFilter = (f: Filter) => {
    setFilter(f);
    setPage(1);
  };
  const filterItems = [
    { value: 'all' as Filter, label: 'All', count: counts.data?.all },
    { value: 'active' as Filter, label: 'Active', count: counts.data?.active },
    { value: 'completed' as Filter, label: 'Completed', count: counts.data?.completed },
  ];

  return (
    <>
      <PageBody className="gap-[18px] lg:gap-5">
        <MobileTopBar user={user} />
        <header className="flex flex-wrap items-end justify-between gap-5 lg:pt-2 lg:pb-3">
          <Greeting user={user} now={now} suffix="Staff" />
          <Link href="/dashboard/tasks" className="hidden h-12 items-center rounded-full bg-surface px-[22px] text-[15px] font-semibold text-ink no-underline outline-none focus-visible:ring-2 focus-visible:ring-ink lg:inline-flex">
            All my tasks
          </Link>
        </header>

        <div className="flex flex-col gap-3.5 lg:flex-row lg:flex-wrap lg:gap-5">
          <CurrentTask task={d?.current ?? null} loading={home.isLoading} since={home.dataUpdatedAt} ws={ws} />

          {/* Desktop side cards */}
          <div className="hidden min-w-0 flex-col gap-5 lg:flex lg:flex-[4_1_320px]">
            <section aria-labelledby="h-sup" className="flex flex-col gap-2.5 rounded-card-lg bg-surface p-[26px]">
              <h2 id="h-sup" className="m-0 text-[15px] font-semibold text-ink-2">
                Technical support
              </h2>
              <p className="m-0 font-display text-[60px] leading-[0.9] font-bold">{supportCount}</p>
              <p className="m-0 text-sm text-ink-3">{supportCount ? `${supportCount} task${supportCount === 1 ? '' : 's'} waiting on technical support` : 'No technical support tasks'}</p>
            </section>
            <ExtensionCard ext={d?.extension ?? null} />
          </div>

          {/* Mobile stat tiles */}
          <div className="grid grid-cols-2 gap-2.5 lg:hidden">
            <Link href="/dashboard/support" className="flex flex-col gap-1.5 rounded-[22px] bg-surface p-4 text-ink no-underline">
              <span className="font-display text-[34px] leading-none font-bold">{supportCount}</span>
              <span className="text-[13px] font-semibold text-ink-2">Technical support tasks</span>
            </Link>
            <Link href="/dashboard/tasks?view=ext" className="flex flex-col gap-1.5 rounded-[22px] bg-surface p-4 text-ink no-underline">
              <span className="font-display text-[34px] leading-none font-bold">{d?.extension?.status === 'pending' ? 1 : 0}</span>
              <span className="text-[13px] font-semibold text-ink-2">Extension request pending</span>
            </Link>
          </div>
        </div>

        {/* My tasks */}
        <section aria-labelledby="h-mine" className="flex flex-col gap-3 lg:rounded-card-lg lg:bg-surface lg:p-7">
          <div className="flex flex-wrap items-center gap-3 lg:pb-1.5">
            <CardTitle id="h-mine" small>
              <span className="lg:text-[26px]">My tasks</span>
            </CardTitle>
            <span className="ml-auto text-[12.5px] text-ink-3 lg:hidden">
              {total ? `${first}–${Math.min(page * 10, total)} of ${total}` : ''}
            </span>
            <div className="ml-auto hidden flex-wrap items-center gap-3 lg:flex">
              <div className="rounded-full bg-stone p-1">
                <SegmentedFilter variant="inline" label="Filter tasks" value={filter} onChange={pickFilter} items={filterItems} />
              </div>
              <SearchField on="white" value={search} onChange={setSearch} placeholder="Search tasks" className="h-[46px] min-w-[220px] flex-none" />
              <DateRange
                on="white"
                value={range}
                onChange={(r) => {
                  setRange(r);
                  setPage(1);
                }}
                className="h-[46px]"
              />
            </div>
          </div>

          {/* Mobile filters */}
          <div className="flex flex-col gap-3 lg:hidden">
            <div className="rounded-full bg-surface p-1">
              <SegmentedFilter variant="inline" label="Filter tasks" value={filter} onChange={pickFilter} items={filterItems} className="[&>button]:flex-1 [&>button]:justify-center" />
            </div>
            <DateRange
              value={range}
              onChange={(r) => {
                setRange(r);
                setPage(1);
              }}
            />
          </div>

          {/* Desktop rows */}
          <div aria-hidden="true" className="hidden flex-wrap gap-x-5 gap-y-2.5 px-1 pb-1.5 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink-3 lg:flex">
            <span className="flex-[3_1_240px]">Task</span>
            <span className="flex-[0_0_130px]">Status</span>
            <span className="flex-[0_0_96px]">Time</span>
            <span className="flex-[2_1_230px]">Schedule</span>
            <span className="flex-[0_0_200px] text-right">Action</span>
          </div>
          <ul className="m-0 hidden list-none flex-col p-0 lg:flex">
            {tasks.length === 0 && <li className="border-t border-line px-1 py-8 text-center text-sm text-ink-3">{list.isLoading ? 'Loading…' : 'No tasks here.'}</li>}
            {tasks.map((t) => (
              <StaffRow key={t.id} t={t} since={list.dataUpdatedAt} ws={ws} />
            ))}
          </ul>
          {total > 0 && <Pagination className="hidden border-t border-line pt-3.5 lg:flex" page={page} total={total} onPageChange={setPage} />}

          {/* Mobile rows */}
          <div className="flex flex-col overflow-hidden rounded-[22px] bg-surface lg:hidden">
            {tasks.length === 0 && <p className="m-0 p-5 text-center text-sm text-ink-3">{list.isLoading ? 'Loading…' : 'No tasks here.'}</p>}
            {tasks.map((t) => {
              const s = statusInfo(t.status);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => ws.openPanel(t.id)}
                  className="flex cursor-pointer flex-col gap-1.5 border-0 border-b border-surface-2 bg-transparent px-3.5 py-3 text-left font-ui text-ink outline-none last:border-b-0 focus-visible:bg-surface-2"
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="flex min-w-0 flex-col gap-px">
                      <span className="text-[14.5px] font-bold">{t.title}</span>
                      <span className="text-xs text-ink-3">{t.project?.name}</span>
                    </span>
                    <StatusPill tone={s.tone} className="shrink-0 px-2 py-[3px] text-[11px]">
                      {s.label}
                    </StatusPill>
                  </span>
                  <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-2">
                    <span>
                      <strong className="text-ink">Start</strong> {fmtWhen(t.start_date)}
                    </span>
                    <span className={isMissed(t) ? 'text-missed' : ''}>
                      <strong>Deadline</strong> {fmtWhen(t.deadline)}
                    </span>
                    <LiveClock seconds={t.logged_seconds} running={t.is_timer_running} since={list.dataUpdatedAt} />
                  </span>
                </button>
              );
            })}
          </div>
          {total > 0 && <Pagination variant="mobile" className="lg:hidden" page={page} total={total} onPageChange={setPage} />}
        </section>
      </PageBody>
      {ws.dialogs}
    </>
  );
}

/** The running-task card (spec §7.5); the next scheduled task when nothing runs. */
function CurrentTask({ task: t, loading, since, ws }: { task: TaskListItem | null; loading: boolean; since: number; ws: Workspace }) {
  const shell = 'flex min-w-0 flex-col gap-3 rounded-[26px] bg-ink p-[18px] text-white lg:flex-[7_1_520px] lg:gap-3.5 lg:rounded-[28px] lg:p-6';
  if (!t) {
    return (
      <section aria-label="Current task" className={shell}>
        <h2 className="m-0 font-display text-[22px] font-bold">{loading ? 'Loading…' : 'Nothing scheduled'}</h2>
        {!loading && <p className="m-0 text-sm text-on-dark">You have no open tasks. New tasks from your manager will show up here.</p>}
      </section>
    );
  }

  const s = statusInfo(t.status);
  const a = toActionTask(t);
  const running = t.is_timer_running;
  const locked = !running && t.lock_early_start && t.start_date && new Date(t.start_date) > new Date() ? `Opens at ${fmtTime(t.start_date)}` : null;

  return (
    <section aria-labelledby="h-now" className={shell}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5 lg:gap-[3px]">
          <h2 id="h-now" className="m-0 text-[17px] leading-[1.25] font-bold lg:font-display lg:text-[22px] lg:leading-[1.15]">
            <button type="button" onClick={() => ws.openPanel(t.id)} className="cursor-pointer border-0 bg-transparent p-0 text-left font-[inherit] text-inherit outline-none hover:underline focus-visible:rounded focus-visible:ring-2 focus-visible:ring-yellow">
              {t.title}
            </button>
          </h2>
          <span className="text-[12.5px] text-on-dark-2 lg:text-[13px]">
            {t.project?.name} · est. {fmtMinutes(t.estimate_minutes)}
          </span>
        </div>
        <span className="shrink-0 rounded-full bg-dark-2 px-[9px] py-1 text-[11.5px] font-semibold text-on-ink lg:px-2.5 lg:text-xs">{s.label}</span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 lg:gap-2.5">
        <span className="mr-auto flex items-center gap-2 lg:gap-2.5">
          <TimerDot running={running} className="size-2 lg:size-[9px]" />
          <LiveClock seconds={t.logged_seconds} running={running} since={since} className="text-[26px] leading-none text-yellow lg:text-[32px]" />
        </span>
        <button
          type="button"
          disabled={ws.actions.busy === t.id || !!locked}
          onClick={() => (running ? ws.actions.stop(a) : ws.actions.start(a))}
          aria-pressed={running}
          className={cn(
            'inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full border-0 px-3.5 font-ui text-[13.5px] font-bold text-ink outline-none lg:gap-[7px] lg:px-4 lg:text-sm focus-visible:ring-2 focus-visible:ring-yellow focus-visible:ring-offset-2 focus-visible:ring-offset-ink disabled:cursor-not-allowed disabled:opacity-50',
            running ? 'bg-white' : 'bg-yellow',
          )}
        >
          {!locked && (running ? <Pause className="size-3 fill-current" aria-hidden="true" /> : <Play className="size-3 fill-current" aria-hidden="true" />)}
          {locked ?? (running ? 'Stop' : 'Start')}
        </button>
        <button
          type="button"
          disabled={ws.actions.busy === t.id}
          onClick={() => ws.actions.submit(a)}
          className="h-10 cursor-pointer rounded-full border border-dark-line bg-transparent px-3.5 font-ui text-[13.5px] font-semibold text-white lg:px-4 lg:text-sm outline-none hover:bg-dark-1 focus-visible:ring-2 focus-visible:ring-yellow disabled:opacity-50"
        >
          Submit
        </button>
      </div>

      <ScheduleBoxes tone="dark" start={fmtWhen(t.start_date)} deadline={fmtWhen(t.deadline)} missed={isMissed(t)} />

      {t.has_instructions && (
        <button
          type="button"
          onClick={() => ws.actions.read(a)}
          className="flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border-0 bg-dark-1 px-3 py-2 text-left font-ui text-white outline-none focus-visible:ring-2 focus-visible:ring-yellow"
        >
          <FileText className="size-[13px] shrink-0" strokeWidth={2} aria-hidden="true" />
          <span className="shrink-0 text-[12.5px] font-semibold">Instructions</span>
          <span className="min-w-0 flex-1 truncate text-[12.5px] opacity-70">{t.instructions_preview}</span>
          <span className="shrink-0 text-[12.5px] font-semibold underline">Read</span>
        </button>
      )}
      {t.pending_extension && <p className="m-0 text-[12.5px] font-semibold text-yellow">Extension requested — you can keep working while it’s decided.</p>}
    </section>
  );
}

function ExtensionCard({ ext }: { ext: HomeData['extension'] | null }) {
  return (
    <section aria-labelledby="h-ext" className="flex flex-col gap-2.5 rounded-card-lg bg-surface p-[26px]">
      <h2 id="h-ext" className="m-0 text-[15px] font-semibold text-ink-2">
        Your extension request
      </h2>
      {ext ? (
        <>
          <p className="m-0 text-base font-bold">{ext.task_title}</p>
          <p className="m-0 text-[13.5px] text-ink-2">{ext.from ? `${fmtWhen(ext.from)} → ${fmtWhen(ext.requested)}` : `New deadline ${fmtWhen(ext.requested)}`}</p>
          <StatusPill tone={ext.status === 'pending' ? 'pending' : ext.status === 'approved' ? 'done' : 'missed'} className="self-start px-[11px] py-1 text-[12.5px]">
            {ext.status === 'pending' ? 'Pending · awaiting manager' : ext.status === 'approved' ? 'Approved' : 'Declined'}
          </StatusPill>
        </>
      ) : (
        <p className="m-0 text-sm text-ink-3">You haven’t asked for more time on any task.</p>
      )}
    </section>
  );
}

function StaffRow({ t, since, ws }: { t: TaskListItem; since: number; ws: Workspace }) {
  const s = statusInfo(t.status);
  const a = toActionTask(t);
  const running = t.is_timer_running;
  const missedNoRequest = t.status === 'deadline_missed' && !t.pending_extension;
  const btn = 'inline-flex h-[38px] cursor-pointer items-center gap-1.5 rounded-full border-0 px-3.5 font-ui text-[13px] font-bold outline-none focus-visible:ring-2 focus-visible:ring-ink disabled:opacity-50';

  return (
    <li className="flex flex-wrap items-center gap-x-5 gap-y-2.5 border-t border-line px-1 py-[13px]">
      <span className="flex min-w-0 flex-[3_1_240px] flex-col gap-0.5">
        <button type="button" onClick={() => ws.openPanel(t.id)} className="cursor-pointer border-0 bg-transparent p-0 text-left font-ui text-[15px] font-bold text-ink outline-none hover:underline focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ink">
          {t.title}
        </button>
        <span className="text-[12.5px] text-ink-3">
          {t.project?.name} · est. {fmtMinutes(t.estimate_minutes)}
        </span>
      </span>
      <span className="flex-[0_0_130px]">
        <StatusPill tone={s.tone}>{s.label}</StatusPill>
      </span>
      <span className="flex flex-[0_0_96px] items-center gap-[7px] text-ink-2">
        <TimerDot running={running} className={cn('size-[7px]', !running && 'opacity-0')} />
        <LiveClock seconds={t.logged_seconds} running={running} since={since} className="text-[13.5px]" />
      </span>
      <ScheduleInline className="flex-[2_1_230px]" start={fmtWhen(t.start_date)} deadline={fmtWhen(t.deadline)} missed={isMissed(t)} />
      <span className="flex flex-[0_0_200px] justify-end gap-1.5">
        {t.status === 'completed' ? (
          <span className="text-[13px] font-semibold text-done">Completed</span>
        ) : (
          <>
            {missedNoRequest && (
              <button type="button" onClick={() => ws.requestExtension(t.id)} className={cn(btn, 'bg-stone font-semibold text-ink')}>
                Request extension
              </button>
            )}
            <button
              type="button"
              disabled={ws.actions.busy === t.id}
              aria-label={`${running ? 'Stop' : 'Start'} timer for ${t.title}`}
              onClick={() => (running ? ws.actions.stop(a) : ws.actions.start(a))}
              className={cn(btn, running ? 'bg-ink text-white' : 'bg-done-tint text-done')}
            >
              {running ? <Pause className="size-[11px] fill-current" aria-hidden="true" /> : <Play className="size-[11px] fill-current" aria-hidden="true" />}
              {running ? 'Stop' : 'Start'}
            </button>
            {!missedNoRequest && (
              <button type="button" disabled={ws.actions.busy === t.id} onClick={() => ws.actions.submit(a)} className={cn(btn, 'bg-yellow text-ink')}>
                Submit
              </button>
            )}
          </>
        )}
      </span>
      {(t.pending_extension || t.status === 'review') && (
        <span className={cn('flex-[1_0_100%] text-[12.5px] font-semibold', t.pending_extension ? 'text-pending' : 'text-review')}>
          {t.pending_extension ? 'Extension requested — you can keep working while it’s decided.' : 'Waiting for review. You can still restart the timer or resubmit.'}
        </span>
      )}
    </li>
  );
}
