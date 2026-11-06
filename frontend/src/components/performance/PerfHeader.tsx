'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DateRange, Tabs } from '@/components/wc';
import { rangeLabel, type PerfTab } from '@/lib/performance';
import type { PerfUrl } from './usePerfUrl';

const TAB_TITLES: Record<PerfTab, string> = {
  overview: 'Performance',
  kpi: 'Insights',
  leaderboard: 'Leaderboard',
  attendance: 'Attendance',
};

/**
 * Shared header (PerfTabs): title, one line, tab bar and the one date range
 * that applies to every tab. Staff get "My performance" with no tab bar.
 * On mobile each tab is its own screen with a back button to Performance.
 */
export function PerfHeader({
  url,
  manager,
  missedBadge,
  showRange = true,
  mobileSub,
}: {
  url: PerfUrl;
  manager: boolean;
  missedBadge?: number;
  showRange?: boolean;
  mobileSub?: string;
}) {
  const tab = url.tab ?? 'overview';
  const title = manager ? 'Performance' : 'My performance';
  const description = manager
    ? 'KPIs, leaderboard and attendance in one place — the period applies to every tab'
    : 'Your score, rank and attendance, plus the full team ranking';
  const small = manager ? TAB_TITLES[tab] : title;
  const showBack = manager && url.tab !== null;

  return (
    <header className="flex flex-col gap-3.5 lg:gap-4">
      {/* Mobile */}
      <div className="flex flex-col gap-2 lg:hidden">
        <div className="flex items-center gap-3">
          {showBack && (
            <Link
              href={url.href({ tab: null })}
              aria-label="Back to Performance"
              className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink"
            >
              <ChevronLeft className="size-5" strokeWidth={2.2} aria-hidden="true" />
            </Link>
          )}
          <h1 className="m-0 font-display text-[38px] leading-none font-bold tracking-[-0.04em]">{small}</h1>
        </div>
        {mobileSub && <p className="m-0 text-[14.5px] text-ink-2">{mobileSub}</p>}
      </div>

      {/* Desktop */}
      <div className="hidden flex-wrap items-end justify-between gap-5 pt-2 lg:flex">
        <div className="flex flex-col gap-2.5">
          <h1 className="m-0 font-display text-[56px] leading-none font-bold tracking-[-0.04em]">{title}</h1>
          <p className="m-0 text-base text-ink-2">{description}</p>
        </div>
        {manager && (
          <Tabs
            label="Performance sections"
            value={tab}
            onChange={(t) => url.setTab(t === 'overview' ? null : t)}
            items={[
              { value: 'overview', label: 'Overview' },
              { value: 'kpi', label: 'KPI report' },
              { value: 'leaderboard', label: 'Leaderboard' },
              { value: 'attendance', label: 'Attendance', badge: missedBadge || undefined },
            ]}
          />
        )}
      </div>

      {showRange && (
        // The mobile hub (MPerformance) shows only the period line above.
        <div className={cn('flex-col gap-2 lg:flex lg:flex-row lg:items-center lg:justify-between', mobileSub ? 'hidden' : 'flex')}>
          <DateRange value={url.range} onChange={(r) => r.from && r.to && url.setRange(r)} />
          <p className="m-0 text-[13.5px] font-semibold text-ink-2">Showing: {rangeLabel(url.range)}</p>
        </div>
      )}
    </header>
  );
}
