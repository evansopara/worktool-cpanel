'use client';

import { useEffect, useState } from 'react';
import { Bell, BellRing, CheckCheck, TriangleAlert, Video } from 'lucide-react';
import { useAuth } from '@/providers/AuthProvider';
import { useNotificationAlert } from '@/providers/NotificationAlertProvider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { notificationsApi, bookingsApi } from '@/lib/api';
import { Notification, Booking } from '@/types';
import { timeAgo, formatDate } from '@/lib/utils';
import Link from 'next/link';

interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { permission, requestPermission, pushError, retryPush } = useNotificationAlert();

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list().then((r) => r.data),
    refetchInterval: 60_000,
  });

  const { data: bookings = [] } = useQuery<Booking[]>({
    queryKey: ['bookings'],
    queryFn: () => bookingsApi.list().then((r) => r.data),
    refetchInterval: 60_000,
  });

  // Re-check every 30s so the meeting banner disappears on its own once the
  // meeting's end time passes, without needing a page refresh.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const now = new Date().getTime();
  const currentMeeting = bookings
    .filter((b) => b.status !== 'cancelled')
    .filter((b) => b.scheduled_by === user?.id || b.participants?.includes(user?.id ?? -1))
    .filter((b) => new Date(b.end_time).getTime() > now)
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0];
  const meetingInProgress = currentMeeting && new Date(currentMeeting.start_time).getTime() <= now;

  const unread = notifications.filter((n) => !n.read).length;

  const markReadMutation = useMutation({
    mutationFn: (id: number) => notificationsApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  return (
    <>
    <header className="h-14 border-b bg-white flex items-center justify-between px-6 shrink-0 gap-4">
      <h1 className="text-base font-semibold text-foreground shrink-0">{title}</h1>

      {currentMeeting && (
        <div className="hidden md:flex flex-1 min-w-0 justify-center">
          <div className="flex items-center gap-3 max-w-xl px-4 py-1.5 rounded-full bg-primary/5 border border-primary/20">
            <span className="relative flex h-2 w-2 shrink-0">
              {meetingInProgress && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              )}
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            <div className="min-w-0 text-xs leading-tight">
              <p className="font-semibold truncate">
                {meetingInProgress ? 'Now: ' : 'Up next: '}{currentMeeting.title}
              </p>
              <p className="text-muted-foreground truncate">
                {formatDate(currentMeeting.start_time, 'h:mm a')} - {formatDate(currentMeeting.end_time, 'h:mm a')}
                {currentMeeting.description ? ` · ${currentMeeting.description}` : ''}
              </p>
            </div>
            {currentMeeting.meeting_link && (
              <a
                href={currentMeeting.meeting_link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline shrink-0"
              >
                <Video className="w-3.5 h-3.5" /> Join
              </a>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 shrink-0">

        {/* Prompt to enable browser notifications, until granted or denied */}
        {permission === 'default' && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={requestPermission}
            title="Get a browser alert and sound when new notifications arrive"
          >
            <BellRing className="w-3.5 h-3.5" />
            Enable alerts
          </Button>
        )}

        {/* Notification bell dropdown */}
        <DropdownMenu
          onOpenChange={(open) => {
            if (open && unread > 0) markAllMutation.mutate();
          }}
        >
          <DropdownMenuTrigger render={
            <button className="relative inline-flex items-center justify-center size-8 rounded-lg hover:bg-muted transition-colors outline-none">
              <Bell className="w-4 h-4" />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none pointer-events-none">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </button>
          } />

          <DropdownMenuContent
            align="end"
            sideOffset={8}
            className="p-0 overflow-hidden"
            style={{ width: '320px' }}
          >
            {/* Header row */}
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Notifications</span>
                {unread > 0 && (
                  <span className="h-5 min-w-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {unread}
                  </span>
                )}
              </div>
            </div>

            <DropdownMenuSeparator />

            {/* Scrollable notification list */}
            <div className="overflow-y-auto max-h-72">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <Bell className="w-8 h-8 mb-2 opacity-25" />
                  <p className="text-sm">No notifications</p>
                </div>
              ) : (
                notifications.map((n: Notification) => (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-4 py-3 border-b last:border-b-0 ${
                      !n.read ? 'bg-blue-50/60' : 'bg-white'
                    }`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                        !n.read ? 'bg-blue-500' : 'bg-gray-300'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground leading-tight">{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[11px] text-muted-foreground/70 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                    {!n.read && (
                      <button
                        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors mt-0.5"
                        onClick={() => markReadMutation.mutate(n.id)}
                        title="Mark as read"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            <DropdownMenuSeparator />

            {/* Footer */}
            <div className="px-4 py-2.5">
              <Link
                href="/dashboard/notifications"
                className="text-xs text-blue-600 hover:underline block text-center font-medium"
              >
                View all notifications
              </Link>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User avatar */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
            {(user?.first_name?.[0] ?? '') + (user?.last_name?.[0] ?? '')}
          </div>
          <span className="text-sm font-medium hidden sm:block">{user?.first_name}</span>
        </div>

      </div>
    </header>

    {/* TEMPORARY: push-notification debugging bar. Stays until push setup succeeds. */}
    {pushError && (
      <div className="flex items-start gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-800 shrink-0">
        <TriangleAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <p className="flex-1 min-w-0 break-words">
          <span className="font-semibold">Push setup failed</span> (debug build 2) at {pushError}
        </p>
        <button
          className="shrink-0 rounded border border-red-300 px-2 py-0.5 font-medium hover:bg-red-100"
          onClick={retryPush}
        >
          Retry
        </button>
      </div>
    )}
    </>
  );
}
