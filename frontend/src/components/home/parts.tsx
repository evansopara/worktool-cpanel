'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { Bell, Search } from 'lucide-react';
import { notificationsApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { initials } from '@/components/wc';
import type { User } from '@/types';

// Pieces shared by the manager and staff Home pages (Main, StaffHome, MHome, MStaffHome).

export function greeting(now: Date): string {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/** Date line + "Good afternoon, Olubukola." (two lines on desktop). */
export function Greeting({ user, now, suffix }: { user: User; now: Date; suffix?: string }) {
  const first = user.first_name || user.username;
  return (
    <div className="flex flex-col gap-1.5 px-0.5 pt-1 lg:gap-2.5 lg:p-0">
      <p className="m-0 text-sm font-semibold text-ink-3">
        {format(now, 'EEEE, MMMM d')}
        {suffix && ` · ${suffix}`}
      </p>
      <h1 className="m-0 font-display text-[40px] leading-none font-bold tracking-[-0.04em] lg:text-[56px] lg:leading-[0.98]">
        {greeting(now)},<br className="hidden lg:inline" /> {first}.
      </h1>
    </div>
  );
}

/** Phone-only top row: logo, (search), notifications, avatar → Settings. */
export function MobileTopBar({ user, search }: { user: User; search?: boolean }) {
  const { data: unread = 0 } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationsApi.unreadCount().then((r) => Number(r.data?.count ?? 0)),
    refetchInterval: 60_000,
  });
  const round = 'flex size-11 items-center justify-center rounded-full bg-surface text-ink no-underline outline-none focus-visible:ring-2 focus-visible:ring-ink';
  return (
    <div className="flex items-center gap-2.5 lg:hidden">
      <span className="flex size-10 items-center justify-center rounded-xl bg-yellow font-display text-base font-extrabold tracking-[-0.05em] text-ink">wc</span>
      <span className="flex-1" />
      {search && (
        <Link href="/dashboard/more" aria-label="Search" className={round}>
          <Search className="size-[18px]" strokeWidth={2} aria-hidden="true" />
        </Link>
      )}
      <Link href="/dashboard/notifications" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} className={cn(round, 'relative')}>
        <Bell className="size-[18px]" strokeWidth={2} aria-hidden="true" />
        {unread > 0 && <span className="absolute top-[9px] right-2.5 size-[9px] rounded-full border-2 border-surface bg-missed" />}
      </Link>
      <Link href="/dashboard/settings" aria-label="Your settings" className="flex size-11 items-center justify-center rounded-full bg-ink text-sm font-bold text-yellow no-underline outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2">
        {initials(`${user.first_name} ${user.last_name}`.trim() || user.username)}
      </Link>
    </div>
  );
}

/** Section title used by the white Home cards. */
export function CardTitle({ id, children, small }: { id: string; children: React.ReactNode; small?: boolean }) {
  return (
    <h2 id={id} className={cn('m-0 font-display font-bold tracking-[-0.02em]', small ? 'text-[22px]' : 'text-[26px]')}>
      {children}
    </h2>
  );
}
