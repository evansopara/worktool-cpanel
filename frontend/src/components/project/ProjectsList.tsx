'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Plus, Search } from 'lucide-react';
import { format } from 'date-fns';
import type { Project } from '@/types';
import { cn } from '@/lib/utils';
import { Button, StatusPill } from '@/components/wc';
import { PageBody, PageHeader } from '@/components/shell/PageHeader';
import { CATEGORIES, categoryLabel, categoryOf, initialsOf, isOverdue, projectApi, projectHealth, projectStatus } from '@/lib/projects';

// Projects list (Projects / MProjects artboards): health strip, category
// chips, then projects grouped by category.

const SHOW_DESKTOP = 4;
const SHOW_MOBILE = 2;

function note(p: Project, now: number): { text: string; tone: string } {
  if ((p.progress ?? 0) >= 100 || p.status === 'completed') return { text: categoryLabel(p), tone: 'text-ink-3 font-normal' };
  if (isOverdue(p, now)) return { text: `Overdue · was due ${format(new Date(p.end_date!), 'MMM d')}`, tone: 'text-missed font-semibold' };
  if (p.end_date) return { text: `Due ${format(new Date(p.end_date), 'MMM d, yyyy')}`, tone: 'text-ink-3 font-normal' };
  return { text: categoryLabel(p), tone: 'text-ink-3 font-normal' };
}

export function ProjectsList({ canCreate, onOpen, onNew }: { canCreate: boolean; onOpen: (id: number) => void; onNew: () => void }) {
  const [now] = useState(() => Date.now());
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const { data: projects = [], isLoading } = useQuery({ queryKey: ['projects'], queryFn: projectApi.list });

  const health = projectHealth(projects, now);
  const term = search.trim().toLowerCase();
  const filtered = projects.filter((p) => !term || p.name.toLowerCase().includes(term));
  const groups = [
    ...CATEGORIES.map((c) => ({ key: c.value as string, label: c.label, tile: c.tile, items: filtered.filter((p) => p.category === c.value) })),
    { key: 'none', label: 'Uncategorised', tile: 'bg-stone text-ink', items: filtered.filter((p) => !categoryOf(p)) },
  ].filter((g) => g.items.length > 0 && (category === 'all' || category === g.key));

  const chips = [
    { key: 'all', label: 'All', n: null as number | null },
    ...CATEGORIES.map((c) => ({ key: c.value as string, label: c.label, n: projects.filter((p) => p.category === c.value).length })).filter((c) => c.n),
  ];
  const stats = [
    { value: health.overdue, label: 'Overdue', note: 'Projects past deadline', mobile: 'Projects past deadline', color: 'text-missed' },
    { value: health.urgent, label: 'Urgent attention', note: 'No activity for 10+ days', mobile: 'No activity for 10+ days', color: 'text-pending' },
    { value: health.completedThisWeek, label: 'Completed this week', note: 'Projects finished recently', mobile: 'Completed this week', color: 'text-done' },
  ];

  const chipRow = (
    <div role="group" aria-label="Category" className="flex gap-2 overflow-x-auto px-[18px] lg:flex-wrap lg:overflow-visible lg:px-0">
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          aria-pressed={category === c.key}
          onClick={() => setCategory(c.key)}
          className={cn(
            'flex h-[42px] shrink-0 cursor-pointer items-center gap-2 rounded-full border-0 px-4 font-ui text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ink lg:px-[18px]',
            category === c.key ? 'bg-ink text-white' : 'bg-surface text-ink-2',
          )}
        >
          {c.label}
          {c.n !== null && <span className="hidden font-mono text-[12.5px] opacity-75 lg:inline">{c.n}</span>}
        </button>
      ))}
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <PageBody className="hidden gap-6 lg:flex">
        <PageHeader
          title="Projects"
          description="Manage and track your digital agency projects"
          actions={
            <>
              <label className="flex h-12 min-w-[260px] items-center gap-2 rounded-full bg-surface px-[18px] text-ink-3 focus-within:ring-2 focus-within:ring-ink">
                <Search className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                <input
                  type="search"
                  aria-label="Search projects by name"
                  placeholder="Search projects by name"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="min-w-0 flex-1 border-0 bg-transparent font-ui text-[15px] text-ink outline-none"
                />
              </label>
              {canCreate && (
                <Button variant="accent" onClick={onNew}>
                  <Plus strokeWidth={2.4} aria-hidden="true" />
                  New project
                </Button>
              )}
            </>
          }
        />

        <section aria-label="Project health" className="flex flex-wrap overflow-hidden rounded-[28px] bg-surface">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-[1_1_240px] items-center gap-5 border-r border-line px-7 py-[26px] last:border-r-0">
              <span className={cn('font-display text-[60px] leading-[0.9] font-bold tracking-[-0.04em]', s.color)}>{s.value}</span>
              <span className="flex flex-col gap-[3px]">
                <span className="text-base font-bold">{s.label}</span>
                <span className="text-[13.5px] text-ink-3">{s.note}</span>
              </span>
            </div>
          ))}
        </section>

        {chipRow}

        {isLoading && <p className="m-0 text-sm text-ink-3">Loading projects…</p>}
        {!isLoading && groups.length === 0 && <p className="m-0 rounded-card bg-surface p-8 text-center text-sm text-ink-3">No projects found.</p>}
        {groups.map((g) => {
          const shown = category === 'all' ? g.items.slice(0, SHOW_DESKTOP) : g.items;
          return (
            <section key={g.key} className="flex flex-col gap-3.5 pt-2">
              <div className="flex items-baseline gap-3">
                <h2 className="m-0 font-display text-[28px] font-bold tracking-[-0.02em]">{g.label}</h2>
                <span className="font-mono text-sm font-semibold text-ink-3">{g.items.length} projects</span>
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3.5">
                {shown.map((p) => {
                  const s = projectStatus(p);
                  const n = note(p, now);
                  const progress = Math.min(100, p.progress ?? 0);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onOpen(p.id)}
                      className="flex min-h-[200px] cursor-pointer flex-col gap-4 rounded-card border-0 bg-surface p-[18px] text-left font-ui text-ink outline-none hover:shadow-float focus-visible:ring-2 focus-visible:ring-ink"
                    >
                      <span className="flex w-full items-start justify-between">
                        <span className={cn('flex size-[52px] items-center justify-center rounded-2xl font-display text-[19px] font-bold', g.tile)}>{initialsOf(p.name)}</span>
                        <StatusPill tone={s.tone} size="md">
                          {s.label}
                        </StatusPill>
                      </span>
                      <span className="flex flex-1 flex-col gap-1">
                        <span className="text-lg font-bold tracking-[-0.01em]">{p.name}</span>
                        <span className={cn('text-[13.5px]', n.tone)}>{n.text}</span>
                      </span>
                      {progress > 0 && (
                        <span className="flex w-full items-center gap-2.5">
                          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                            <span className="block h-full rounded-full bg-ink" style={{ width: `${progress}%` }} />
                          </span>
                          <span className="font-mono text-[12.5px] font-semibold">{progress}%</span>
                        </span>
                      )}
                    </button>
                  );
                })}
                {category === 'all' && g.items.length > SHOW_DESKTOP && (
                  <button
                    type="button"
                    onClick={() => setCategory(g.key)}
                    className="flex min-h-[200px] cursor-pointer flex-col items-center justify-center gap-2.5 rounded-card border-[1.5px] border-dashed border-handle bg-transparent font-ui text-[15px] font-semibold text-ink-2 outline-none focus-visible:ring-2 focus-visible:ring-ink"
                  >
                    <span className="flex size-11 items-center justify-center rounded-full bg-surface">
                      <ChevronRight className="size-[18px]" aria-hidden="true" />
                    </span>
                    View all {g.items.length}
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </PageBody>

      {/* Mobile */}
      <div className="flex flex-col gap-4 pt-14 pb-6 lg:hidden">
        <div className="flex items-center justify-between px-[18px]">
          <h1 className="m-0 font-display text-[40px] leading-none font-bold tracking-[-0.04em]">Projects</h1>
          {canCreate && (
            <button type="button" aria-label="New project" onClick={onNew} className="flex size-12 cursor-pointer items-center justify-center rounded-full border-0 bg-yellow text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2">
              <Plus className="size-5" strokeWidth={2.4} aria-hidden="true" />
            </button>
          )}
        </div>
        <label className="mx-[18px] flex h-[50px] items-center gap-2.5 rounded-full bg-surface px-[18px] text-ink-3 focus-within:ring-2 focus-within:ring-ink">
          <Search className="size-[17px] shrink-0" strokeWidth={2} aria-hidden="true" />
          <input type="search" aria-label="Search projects by name" placeholder="Search projects by name" value={search} onChange={(e) => setSearch(e.target.value)} className="min-w-0 flex-1 border-0 bg-transparent font-ui text-[15px] text-ink outline-none" />
        </label>
        <div className="flex gap-2.5 overflow-x-auto px-[18px]">
          {stats.map((s, i) => (
            <div key={s.label} className={cn('flex w-[140px] shrink-0 flex-col gap-1.5 rounded-[22px] p-4', i === 0 ? 'bg-ink text-yellow' : 'bg-surface text-ink')}>
              <span className="font-display text-[38px] leading-none font-bold">{s.value}</span>
              <span className="text-[13px] leading-[1.3] font-semibold">{s.mobile}</span>
            </div>
          ))}
        </div>
        {chipRow}
        {!isLoading && groups.length === 0 && <p className="mx-[18px] my-0 rounded-[22px] bg-surface p-6 text-center text-sm text-ink-3">No projects found.</p>}
        {groups.map((g) => {
          const shown = category === 'all' ? g.items.slice(0, SHOW_MOBILE) : g.items;
          return (
            <section key={g.key} className="flex flex-col gap-2 px-[18px]">
              <h2 className="mx-1 mt-2 mb-0 flex items-baseline gap-2 font-display text-[22px] font-bold">
                {g.label}
                <span className="font-mono text-[13px] font-semibold text-ink-3">{g.items.length}</span>
              </h2>
              {shown.map((p) => {
                const n = note(p, now);
                return (
                  <button key={p.id} type="button" onClick={() => onOpen(p.id)} className="flex cursor-pointer items-center gap-3.5 rounded-[22px] border-0 bg-surface px-3.5 py-3 text-left font-ui text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink">
                    <span className={cn('flex size-[46px] shrink-0 items-center justify-center rounded-[15px] font-display text-base font-bold', g.tile)}>{initialsOf(p.name)}</span>
                    <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                      <span className="text-base font-bold">{p.name}</span>
                      <span className={cn('text-[13px] font-semibold', n.tone)}>{n.text}</span>
                    </span>
                    <ChevronRight className="size-[18px] shrink-0 text-ink-3" aria-hidden="true" />
                  </button>
                );
              })}
              {category === 'all' && g.items.length > SHOW_MOBILE && (
                <button type="button" onClick={() => setCategory(g.key)} className="cursor-pointer self-start border-0 bg-transparent px-1 py-2 font-ui text-sm font-semibold text-ink">
                  View all {g.items.length}
                </button>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
