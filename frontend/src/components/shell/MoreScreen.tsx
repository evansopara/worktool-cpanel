'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { User } from '@/types';
import { cn } from '@/lib/utils';
import { useDarkMode } from '@/lib/theme';
import { initials } from '@/components/wc';
import { NavIcon } from './NavIcon';
import { buildNav, DOCK_SECTIONS, MORE_ORDER, roleLabel, type SectionKey } from './nav';

// Mobile More menu (MMore artboard): profile card, a tile for every section
// not in the dock, dark mode and sign out. The artboard's search field is left
// out until the search palette is built.
export function MoreScreen({
  user,
  badges = {},
  onSignOut,
}: {
  user: User;
  badges?: Partial<Record<SectionKey, number>>;
  onSignOut: () => void;
}) {
  const [dark, setDark] = useDarkMode();
  const sections = buildNav(user)
    .flatMap((g) => g.sections)
    .filter((s) => !DOCK_SECTIONS.includes(s.key))
    .sort((a, b) => MORE_ORDER.indexOf(a.key) - MORE_ORDER.indexOf(b.key));
  const settings = sections.find((s) => s.key === 'settings');
  const issues = settings?.pages.find((p) => p.href === '/dashboard/issues');
  const tiles = [
    ...sections.map((s) => ({ key: s.key as SectionKey | 'issue', label: s.label, sub: s.sub, href: s.href })),
    ...(issues ? [{ key: 'issue' as const, label: issues.label, sub: 'Bugs and suggestions', href: issues.href }] : []),
  ];
  const name = `${user.first_name} ${user.last_name}`.trim() || user.username;

  return (
    <div className="flex flex-col gap-3.5 px-[18px] pt-14 pb-6">
      <h1 className="m-0 font-display text-[40px] leading-none font-bold tracking-[-0.04em]">More</h1>

      <Link
        href="/dashboard/settings"
        className="flex items-center gap-3.5 rounded-[26px] bg-ink p-4 text-white no-underline outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
      >
        <span className="flex size-[54px] shrink-0 items-center justify-center rounded-full bg-yellow font-display text-xl font-bold text-ink">
          {initials(name)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-[17px] font-bold">{name}</span>
          <span className="truncate text-[13px] text-on-dark">{roleLabel(user.role)}</span>
        </span>
        <ChevronRight className="size-[18px] shrink-0 text-yellow" strokeWidth={2} aria-hidden="true" />
      </Link>

      <div className="grid grid-cols-2 gap-2.5">
        {tiles.map((t, i) => {
          const first = i === 0;
          const badge = t.key === 'issue' ? 0 : (badges[t.key] ?? 0);
          return (
            <Link
              key={t.key}
              href={t.href}
              className={cn(
                'relative flex min-h-[124px] flex-col gap-[22px] rounded-card p-4 no-underline outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2',
                first ? 'bg-ink text-white' : 'bg-surface text-ink',
              )}
            >
              <span
                className={cn(
                  'flex size-[42px] items-center justify-center rounded-[14px] text-ink',
                  first ? 'bg-yellow' : 'bg-stone',
                )}
              >
                <NavIcon name={t.key} size={20} />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="font-display text-[19px] leading-tight font-bold">{t.label}</span>
                <span className="text-[12.5px] opacity-75">{t.sub}</span>
              </span>
              {badge > 0 && (
                <span className="absolute top-3.5 right-3.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-yellow px-[7px] text-xs font-bold text-ink">
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      <div className="flex flex-col overflow-hidden rounded-card bg-surface">
        <label className="flex min-h-14 cursor-pointer items-center gap-3.5 border-b border-line px-4">
          <span className="flex-1 text-[15px] font-semibold">Dark mode</span>
          <input
            type="checkbox"
            role="switch"
            checked={dark}
            onChange={(e) => setDark(e.target.checked)}
            className="h-[26px] w-[46px] cursor-pointer accent-ink"
          />
        </label>
        <button
          type="button"
          onClick={onSignOut}
          className="flex min-h-14 cursor-pointer items-center border-0 bg-surface px-4 text-left font-ui text-[15px] font-semibold text-missed outline-none focus-visible:bg-surface-2"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
