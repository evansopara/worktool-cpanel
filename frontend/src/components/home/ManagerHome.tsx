'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Check, ChevronRight, Plus } from 'lucide-react';
import type { User } from '@/types';
import { cn } from '@/lib/utils';
import { Button, DateRange, Pagination, SearchField, SegmentedFilter, type DateRangeValue } from '@/components/wc';
import { PageBody } from '@/components/shell/PageHeader';
import { homeApi, taskApi, type HomeData } from '@/lib/tasks';
import { ManagerTaskCard, ManagerTaskTable } from '@/components/task/TaskRows';
import { useTaskWorkspace } from '@/components/task/useTaskWorkspace';
import { CardTitle, Greeting, MobileTopBar } from './parts';

// Manager Home (Main / MHome artboards, spec §6): Needs you, task status,
// project pipeline and every task (same table as the Tasks page).

const STATUS = [
  { key: 'in_progress', label: 'In progress', dot: 'bg-pending-line' },
  { key: 'pending', label: 'Pending', dot: 'bg-missed' },
  { key: 'todo', label: 'To do', dot: 'bg-idle' },
  { key: 'review', label: 'In review', dot: 'bg-review-bar' },
] as const;

export function ManagerHome({ user }: { user: User }) {
  const [now] = useState(() => new Date());
  const ws = useTaskWorkspace(user);
  const home = useQuery({ queryKey: ['home'], queryFn: homeApi.get, refetchInterval: 60_000 });

  const [state, setState] = useState<'active' | 'completed'>('active');
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

  // Managers see every task, as on the Tasks page.
  const params = { tab: 'all' as const, state, q, from: range.from, to: range.to, page };
  const list = useQuery({ queryKey: ['tasks', 'home', params], queryFn: () => taskApi.list(params), placeholderData: keepPreviousData, refetchInterval: 30_000 });
  const tasks = list.data?.data ?? [];
  const total = list.data?.meta.total ?? 0;
  const d = home.data;

  return (
    <>
      <PageBody className="gap-[18px] lg:gap-5">
        <MobileTopBar user={user} search />
        <header className="flex flex-wrap items-end justify-between gap-5 lg:pt-2 lg:pb-3">
          <Greeting user={user} now={now} />
          <div className="hidden flex-wrap gap-2.5 lg:flex">
            <Link href="/dashboard/projects" className="inline-flex h-12 items-center rounded-full bg-surface px-[22px] text-[15px] font-semibold text-ink no-underline outline-none focus-visible:ring-2 focus-visible:ring-ink">
              Add project
            </Link>
            <Button variant="accent" onClick={ws.newTask}>
              <Plus strokeWidth={2.4} aria-hidden="true" />
              New task
            </Button>
          </div>
        </header>

        <div className="flex flex-col gap-[18px] lg:flex-row lg:flex-wrap lg:gap-5">
          <NeedsYou needs={d?.needs ?? []} />
          <TaskStatus counts={d?.status_counts} />
        </div>

        <div className="order-last lg:order-none">
          <Pipeline pipeline={d?.pipeline} />
        </div>

        {/* Tasks */}
        <section aria-labelledby="h-mine" className="flex flex-col gap-2.5 lg:gap-[18px]">
          <div className="flex flex-wrap items-center gap-3 px-0.5 pt-1.5 lg:p-0">
            <h2 id="h-mine" className="m-0 mr-auto font-display text-[22px] font-bold tracking-[-0.02em] lg:text-[26px]">
              Tasks
            </h2>
            <Link href="/dashboard/tasks" className="py-2.5 text-sm font-semibold text-ink lg:hidden">
              See all
            </Link>
            <div className="hidden flex-wrap items-center gap-3 lg:flex">
              <div className="rounded-full bg-surface p-1">
                <SegmentedFilter
                  variant="inline"
                  label="Task status"
                  value={state}
                  onChange={(v) => {
                    setState(v);
                    setPage(1);
                  }}
                  items={[
                    { value: 'active', label: 'Active' },
                    { value: 'completed', label: 'Completed' },
                  ]}
                />
              </div>
              <SearchField value={search} onChange={setSearch} placeholder="Search task or staff" className="h-[46px] min-w-[220px] flex-none" />
              <DateRange
                value={range}
                onChange={(r) => {
                  setRange(r);
                  setPage(1);
                }}
                className="h-[46px]"
              />
            </div>
          </div>

          {/* Desktop: the same table as the Tasks page */}
          <div className="hidden lg:block">
            <ManagerTaskTable
              tasks={tasks}
              since={list.dataUpdatedAt}
              onOpen={ws.openPanel}
              onEdit={ws.edit}
              onDelete={ws.onDelete}
              footer={<Pagination page={page} total={total} onPageChange={setPage} />}
            />
          </div>

          {/* Mobile rows: the first few, "See all" opens Tasks */}
          <div className="flex flex-col gap-2.5 lg:hidden">
            {tasks.slice(0, 3).map((t) => (
              <ManagerTaskCard key={t.id} t={t} since={list.dataUpdatedAt} onOpen={ws.openPanel} onEdit={ws.edit} onDelete={ws.onDelete} />
            ))}
            {tasks.length === 0 && !list.isLoading && <p className="m-0 rounded-[22px] bg-surface p-5 text-center text-sm text-ink-3">No tasks here.</p>}
          </div>
        </section>
      </PageBody>
      {ws.dialogs}
    </>
  );
}

function NeedsYou({ needs }: { needs: NonNullable<HomeData['needs']> }) {
  const open = needs.reduce((n, i) => n + i.count, 0);
  return (
    <section aria-labelledby="h-needs" className="flex min-w-0 flex-col gap-1.5 rounded-[26px] bg-ink p-5 text-white lg:flex-[5_1_380px] lg:gap-[18px] lg:rounded-[28px] lg:p-7">
      <div className="mb-1.5 flex items-center justify-between lg:mb-0">
        <h2 id="h-needs" className="m-0 font-display text-2xl font-bold tracking-[-0.02em] lg:text-[26px]">
          Needs you
        </h2>
        <span className="hidden text-[13px] font-semibold text-on-dark-2 lg:inline">
          {open} open item{open === 1 ? '' : 's'}
        </span>
      </div>
      <div className="flex flex-col">
        {needs.length === 0 && <p className="m-0 border-t border-dark-2 pt-4 text-sm text-on-dark">Nothing waiting on you right now.</p>}
        {needs.map((n) => (
          <Link key={n.key} href={n.href} className="flex min-h-[52px] items-center gap-3.5 border-t border-dark-2 py-2 text-white no-underline outline-none focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-yellow lg:min-h-16 lg:gap-[18px]">
            <span className="w-[30px] shrink-0 font-display text-[28px] leading-none font-bold text-yellow lg:w-11 lg:text-4xl">{n.count}</span>
            <span className="flex flex-1 flex-col gap-0.5">
              <span className="text-[14.5px] font-semibold lg:text-[15.5px]">{n.label}</span>
              {n.detail && <span className="hidden text-[13px] text-on-dark-2 lg:inline">{n.detail}</span>}
            </span>
            <span className="flex shrink-0 items-center justify-center text-yellow lg:size-[38px] lg:rounded-full lg:bg-dark-2 lg:text-white">
              <ChevronRight className="size-[18px]" strokeWidth={2} aria-hidden="true" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function TaskStatus({ counts }: { counts?: HomeData['status_counts'] }) {
  const c = counts ?? { in_progress: 0, pending: 0, todo: 0, review: 0, technical_support: 0, deadline_missed: 0 };
  const open = STATUS.reduce((n, s) => n + c[s.key], 0);
  const biggest = [...STATUS].sort((a, b) => c[b.key] - c[a.key])[0];
  const share = open ? c[biggest.key] / open : 0;
  const summary = !open
    ? 'No open tasks.'
    : share >= 0.9
      ? `${open} open tasks — nearly all ${biggest.label.toLowerCase()}.`
      : share > 0.5
        ? `${open} open tasks — most are ${biggest.label.toLowerCase()}.`
        : `${open} open tasks.`;

  return (
    <section aria-labelledby="h-ts" className="flex min-w-0 flex-col gap-2.5 lg:flex-[7_1_480px] lg:gap-6 lg:rounded-[28px] lg:bg-surface lg:p-7">
      <div className="flex items-center justify-between gap-2.5 px-0.5 pt-1.5 lg:p-0">
        <CardTitle id="h-ts" small>
          <span className="lg:text-[26px]">Task status</span>
        </CardTitle>
        <Link href="/dashboard/tasks" className="hidden text-sm font-semibold text-ink lg:inline">
          Open tasks →
        </Link>
      </div>
      {/* Desktop tiles */}
      <div className="hidden grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3 lg:grid">
        {STATUS.map((s) => (
          <Link key={s.key} href="/dashboard/tasks" className="flex flex-col gap-2 rounded-[20px] bg-surface-2 p-4 text-ink no-underline outline-none focus-visible:ring-2 focus-visible:ring-ink">
            <span className="flex items-center gap-2 text-[13.5px] font-semibold text-ink-2">
              <span className={cn('size-2.5 rounded-[3px]', s.dot)} />
              {s.label}
            </span>
            <span className="font-display text-[44px] leading-none font-bold tracking-[-0.03em]">{c[s.key]}</span>
          </Link>
        ))}
      </div>
      {/* Mobile tiles: In review first, on ink */}
      <div className="grid grid-cols-2 gap-2.5 lg:hidden">
        {[STATUS[3], STATUS[2], STATUS[0], STATUS[1]].map((s, i) => (
          <Link key={s.key} href="/dashboard/tasks" className={cn('flex flex-col gap-1.5 rounded-[22px] p-4 no-underline', i === 0 ? 'bg-ink text-yellow' : 'bg-surface text-ink')}>
            <span className="font-display text-4xl leading-none font-bold">{c[s.key]}</span>
            <span className="text-[13.5px] font-semibold">{s.label}</span>
          </Link>
        ))}
      </div>
      <div className="hidden flex-col gap-2.5 lg:flex">
        <div
          role="img"
          aria-label={`Of ${open} open tasks: ${STATUS.map((s) => `${c[s.key]} ${s.label.toLowerCase()}`).join(', ')}`}
          className="flex h-3.5 overflow-hidden rounded-full bg-line"
        >
          {STATUS.map((s) => (c[s.key] ? <span key={s.key} className={cn('min-w-1.5', s.dot)} style={{ flex: c[s.key] }} /> : null))}
        </div>
        <p className="m-0 text-[13.5px] text-ink-3">{summary}</p>
      </div>
    </section>
  );
}

function Pipeline({ pipeline }: { pipeline?: HomeData['pipeline'] }) {
  const p = pipeline ?? { active: { total: 0, items: [] }, pending: { total: 0, items: [] }, completed: { total: 0, items: [] } };
  const column = 'flex min-w-0 flex-[1_1_260px] flex-col gap-2.5';
  const head = (label: string, n: number) => (
    <div className="flex items-baseline gap-2.5 px-1">
      <h3 className="m-0 text-[15px] font-bold">{label}</h3>
      <span className="font-mono text-[13px] font-semibold text-ink-3">{n}</span>
    </div>
  );
  const card = 'flex flex-col gap-1.5 rounded-[18px] bg-surface-2 px-4 py-3.5 text-ink no-underline outline-none focus-visible:ring-2 focus-visible:ring-ink';
  const empty = (text: string) => (
    <div className="flex min-h-[120px] flex-1 items-center justify-center rounded-[20px] border-[1.5px] border-dashed border-handle p-5 text-center text-sm font-semibold text-ink-3 lg:min-h-60">{text}</div>
  );

  return (
    <>
      {/* Desktop board */}
      <section aria-labelledby="h-pipe" className="hidden flex-col gap-5 rounded-[28px] bg-surface p-7 lg:flex">
        <div className="flex items-center justify-between gap-2.5">
          <CardTitle id="h-pipe">Project pipeline</CardTitle>
          <Link href="/dashboard/projects" className="text-sm font-semibold text-ink">
            All projects →
          </Link>
        </div>
        <div className="flex flex-wrap gap-4">
          <div className={column}>
            {head('Active', p.active.total)}
            {p.active.items.length === 0
              ? empty('No active projects')
              : p.active.items.map((x) => (
                  <Link key={x.id} href={`/dashboard/projects?id=${x.id}`} className={card}>
                    <span className="text-[15px] font-bold">{x.name}</span>
                    <span className="text-[13px] text-ink-3">{x.category}</span>
                    {x.flag && (
                      <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-done">
                        <span className="size-[7px] rounded-full bg-live" />
                        {x.flag}
                      </span>
                    )}
                  </Link>
                ))}
          </div>
          <div className={column}>
            {head('Pending', p.pending.total)}
            {p.pending.items.length === 0
              ? empty('No pending projects')
              : p.pending.items.map((x) => (
                  <Link key={x.id} href={`/dashboard/projects?id=${x.id}`} className={card}>
                    <span className="text-[15px] font-bold">{x.name}</span>
                    <span className="text-[13px] text-ink-3">{x.category}</span>
                    {x.flag && (
                      <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-pending">
                        <span className="size-[7px] rounded-full bg-pending-line" />
                        {x.flag}
                      </span>
                    )}
                  </Link>
                ))}
            {p.pending.total > p.pending.items.length && (
              <Link href="/dashboard/projects" className="px-1 py-1.5 text-[13.5px] font-semibold text-ink">
                + {p.pending.total - p.pending.items.length} more pending
              </Link>
            )}
          </div>
          <div className={column}>
            {head('Completed', p.completed.total)}
            {p.completed.items.length === 0
              ? empty('No completed projects')
              : p.completed.items.map((x) => (
                  <Link key={x.id} href={`/dashboard/projects?id=${x.id}`} className={cn(card, 'flex-row items-center gap-3 py-3')}>
                    <span className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-ink text-yellow">
                      <Check className="size-3.5" strokeWidth={2.6} aria-hidden="true" />
                    </span>
                    <span className="flex flex-col gap-px">
                      <span className="text-[15px] font-bold">{x.name}</span>
                      <span className="text-[13px] text-ink-3">{x.category}</span>
                    </span>
                  </Link>
                ))}
          </div>
        </div>
      </section>

      {/* Mobile strip */}
      <section aria-labelledby="h-pipe-m" className="flex flex-col gap-2.5 lg:hidden">
        <h2 id="h-pipe-m" className="m-0 mx-0.5 mt-1.5 font-display text-[22px] font-bold">
          Projects
        </h2>
        <Link href="/dashboard/projects" className="flex overflow-hidden rounded-[22px] bg-surface text-ink no-underline">
          {(['active', 'pending', 'completed'] as const).map((k) => (
            <span key={k} className="flex flex-1 flex-col gap-1 border-r border-line p-4 last:border-r-0">
              <span className="font-display text-[30px] leading-none font-bold">{p[k].total}</span>
              <span className="text-[13px] font-semibold text-ink-2 capitalize">{k}</span>
            </span>
          ))}
        </Link>
      </section>
    </>
  );
}
