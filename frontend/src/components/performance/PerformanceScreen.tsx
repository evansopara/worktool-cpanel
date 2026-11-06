'use client';

import type { User } from '@/types';
import { PageBody } from '@/components/shell/PageHeader';
import { isManager } from '@/components/shell/nav';
import { rangeLabel } from '@/lib/performance';
import { AttendanceTab } from './AttendanceTab';
import { KpiTab } from './KpiTab';
import { LeaderboardTab } from './LeaderboardTab';
import { OverviewTab } from './OverviewTab';
import { PerfHeader } from './PerfHeader';
import { PersonView } from './PersonView';
import { usePerfUrl } from './usePerfUrl';

/**
 * Performance page (Performance page spec): managers get Overview, KPI
 * report, Leaderboard and Attendance tabs and anyone's person view; staff
 * and interns get "My performance" (their position plus the leaderboard).
 * Needs a <Suspense> parent (it reads the URL).
 */
export function PerformanceScreen({ user }: { user: User }) {
  const url = usePerfUrl();
  const manager = isManager(user);

  if (url.person && (manager || url.person === user.id)) {
    return (
      // PersonPerformance has only a breadcrumb above it; the range carries over.
      <PageBody className="gap-3.5 lg:gap-5">
        <PersonView url={url} id={url.person} manager={manager} />
      </PageBody>
    );
  }

  if (!manager) {
    return (
      <PageBody className="gap-3.5 lg:gap-5">
        <PerfHeader url={url} manager={false} />
        <LeaderboardTab url={url} manager={false} meId={user.id} />
      </PageBody>
    );
  }

  const tab = url.tab ?? 'overview';
  return (
    <PageBody className="gap-3.5 lg:gap-5">
      <PerfHeader
        url={url}
        manager
        mobileSub={url.tab === null ? rangeLabel(url.range, true) : undefined}
      />
      {tab === 'overview' && <OverviewTab url={url} />}
      {tab === 'kpi' && <KpiTab url={url} />}
      {tab === 'leaderboard' && <LeaderboardTab url={url} manager meId={user.id} />}
      {tab === 'attendance' && <AttendanceTab url={url} />}
    </PageBody>
  );
}
