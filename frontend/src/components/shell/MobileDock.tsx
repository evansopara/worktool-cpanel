'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { NavIcon } from './NavIcon';
import { DOCK_SECTIONS, type NavGroup, type SectionKey } from './nav';

export const MORE_HREF = '/dashboard/more';

// Floating bottom dock below lg (MTabBar artboard): Home, Projects, Tasks,
// Inbox, More. `active` is 'more' for any section that lives on the More
// screen. Badges hide on the active tab.
export function MobileDock({
  groups,
  active,
  badges = {},
}: {
  groups: NavGroup[];
  active: SectionKey | 'more' | null;
  badges?: Partial<Record<SectionKey | 'more', number>>;
}) {
  const sections = groups.flatMap((g) => g.sections).filter((s) => DOCK_SECTIONS.includes(s.key));
  const tabs = [
    ...sections.map((s) => ({ key: s.key as SectionKey | 'more', label: s.key === 'tasks' ? 'Tasks' : s.label, href: s.href })),
    { key: 'more' as const, label: 'More', href: MORE_HREF },
  ];

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-4 bottom-[calc(24px+env(safe-area-inset-bottom))] z-40 flex h-[66px] gap-0.5 rounded-full bg-ink p-1.5 font-ui shadow-dock lg:hidden"
    >
      {tabs.map((t) => {
        const on = t.key === active;
        const badge = on ? 0 : (badges[t.key] ?? 0);
        return (
          <Link
            key={t.key}
            href={t.href}
            aria-current={on ? 'page' : undefined}
            className={cn(
              'relative flex flex-1 flex-col items-center justify-center gap-[3px] rounded-full no-underline outline-none focus-visible:ring-2 focus-visible:ring-yellow',
              on ? 'bg-yellow text-ink' : 'text-nav-dock',
            )}
          >
            <NavIcon name={t.key} size={21} strokeWidth={2} />
            <span className="text-[10.5px] font-semibold">{t.label}</span>
            {badge > 0 && (
              <span className="absolute top-[5px] right-3 flex h-4 min-w-4 items-center justify-center rounded-full bg-yellow px-1 text-[10px] font-bold text-ink">
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
