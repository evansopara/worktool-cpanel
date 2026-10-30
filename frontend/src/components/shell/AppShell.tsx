'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import type { User } from '@/types';
import { AppSidebar } from './AppSidebar';
import { MobileDock, MORE_HREF } from './MobileDock';
import { SectionTabs } from './SectionTabs';
import { buildNav, DOCK_SECTIONS, findActive, type SectionKey } from './nav';

// Redesigned app frame (spec §4): pinned sidebar at lg and up, floating dock
// below. The page area is its own scroll container, so the sidebar stays put
// and the old full-height pages (chat) keep working.
export function AppShell({
  user,
  unread,
  badges,
  onSignOut,
  previewPath,
  children,
}: {
  user: User;
  unread?: number;
  badges?: Partial<Record<SectionKey, number>>;
  onSignOut: () => void;
  /** /dev/shell only: treat this as the current path */
  previewPath?: string;
  children: React.ReactNode;
}) {
  const routePath = usePathname();
  const pathname = previewPath ?? routePath;
  const groups = useMemo(() => buildNav(user), [user]);
  const current = findActive(groups, pathname);
  const activeKey = current?.section.key ?? null;
  const dockActive =
    pathname === MORE_HREF ? 'more' : activeKey && !DOCK_SECTIONS.includes(activeKey) ? 'more' : activeKey;

  // The More tab carries the total of the sections it holds.
  const moreBadge = Object.entries(badges ?? {})
    .filter(([k]) => !DOCK_SECTIONS.includes(k as SectionKey))
    .reduce((n, [, v]) => n + (v ?? 0), 0);

  return (
    <div className="flex h-dvh overflow-hidden bg-stone font-ui text-ink">
      <AppSidebar user={user} groups={groups} active={activeKey} badges={badges} unread={unread} onSignOut={onSignOut} />
      <main className="min-w-0 flex-1 overflow-y-auto pb-[calc(106px+env(safe-area-inset-bottom))] lg:pb-0">
        {current && <SectionTabs section={current.section} page={current.page} />}
        {children}
      </main>
      <MobileDock groups={groups} active={dockActive} badges={{ ...badges, more: moreBadge }} />
    </div>
  );
}
