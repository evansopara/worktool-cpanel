'use client';

import Link from 'next/link';
import { Bell, ChevronRight } from 'lucide-react';
import type { User } from '@/types';
import { cn } from '@/lib/utils';
import { initials } from '@/components/wc';
import { NavIcon } from './NavIcon';
import { roleLabel, type NavGroup, type SectionKey } from './nav';

// Pinned black sidebar, lg and up (Topbar artboard). The shell keeps it at
// full height while only the page content scrolls; the menu scrolls on its
// own if it is taller than the window.
export function AppSidebar({
  user,
  groups,
  active,
  badges = {},
  unread = 0,
  onSignOut,
}: {
  user: User;
  groups: NavGroup[];
  active: SectionKey | null;
  badges?: Partial<Record<SectionKey, number>>;
  unread?: number;
  onSignOut: () => void;
}) {
  const name = `${user.first_name} ${user.last_name}`.trim();
  return (
    <aside className="hidden h-dvh w-[248px] shrink-0 flex-col gap-[18px] overflow-y-auto bg-ink px-4 py-[22px] font-ui text-on-ink lg:flex">
      <div className="flex items-center gap-2.5 px-1.5">
        <Link href="/dashboard" className="flex flex-1 items-center gap-2.5 text-white no-underline outline-none focus-visible:rounded-xl focus-visible:ring-2 focus-visible:ring-yellow">
          {/* Stand-in mark from the mockups until the real logo files are supplied (spec §10) */}
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-yellow font-display text-[17px] font-extrabold tracking-[-0.05em] text-ink">
            wc
          </span>
          <span className="font-display text-[19px] font-bold tracking-[-0.02em]">wcdigital</span>
        </Link>
        <Link
          href="/dashboard/notifications"
          aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
          className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-dark-1 text-on-ink outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-yellow"
        >
          <Bell className="size-[17px]" strokeWidth={2} aria-hidden="true" />
          {unread > 0 && <span className="absolute top-2 right-[9px] size-2 rounded-full border-2 border-dark-1 bg-alert" />}
        </Link>
      </div>

      <nav aria-label="Main" className="mt-[18px] flex flex-1 flex-col gap-4">
        {groups.map((g) => (
          <div key={g.label || 'main'} className="flex flex-col gap-0.5">
            {g.label && (
              <p className="m-0 mb-1 px-3.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-idle">{g.label}</p>
            )}
            {g.sections.map((s) => {
              const on = s.key === active;
              const badge = badges[s.key] ?? 0;
              return (
                <Link
                  key={s.key}
                  href={s.href}
                  aria-current={on ? 'page' : undefined}
                  className={cn(
                    'flex h-[42px] items-center gap-3 rounded-full px-3.5 text-[14.5px] font-semibold no-underline outline-none focus-visible:ring-2 focus-visible:ring-yellow',
                    on ? 'bg-yellow text-ink' : 'text-nav hover:bg-dark-1 hover:text-white',
                  )}
                >
                  <NavIcon name={s.key} />
                  <span className="flex-1">{s.label}</span>
                  {badge > 0 && (
                    <span
                      className={cn(
                        'flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11.5px] font-bold',
                        on ? 'bg-ink text-yellow' : 'bg-yellow text-ink',
                      )}
                    >
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="flex flex-col gap-1.5">
        <Link
          href="/dashboard/settings"
          className="flex items-center gap-3 rounded-2xl bg-dark-1 p-2.5 text-white no-underline outline-none hover:bg-dark-2 focus-visible:ring-2 focus-visible:ring-yellow"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-yellow text-[13.5px] font-bold text-ink">
            {initials(name || user.username)}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-px">
            <span className="truncate text-sm font-bold">{name || user.username}</span>
            <span className="truncate text-[12.5px] text-on-dark-2">{roleLabel(user.role)}</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-on-dark-2" strokeWidth={2} aria-hidden="true" />
        </Link>
        {/* Not in the artboard: Settings has no sign-out yet, so it stays here. */}
        <button
          type="button"
          onClick={onSignOut}
          className="h-9 cursor-pointer rounded-full border-0 bg-transparent px-3.5 text-left font-ui text-[13px] font-semibold text-on-dark-2 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-yellow"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
