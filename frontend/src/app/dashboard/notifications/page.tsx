'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Bell, Check, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { notificationsApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button, IconButton } from '@/components/wc';
import { PageBody, PageHeader } from '@/components/shell/PageHeader';

// Notifications. No artboard exists; it follows the Inbox list style.

type Item = {
  id: number;
  title: string;
  message: string;
  type: string;
  read: boolean;
  reference_id?: number | null;
  reference_type?: string | null;
  created_at: string;
};

/** Where tapping a notification goes, when it points at something. */
function linkFor(n: Item): string | null {
  if (n.reference_type === 'task' && n.reference_id) return `/dashboard/tasks?task=${n.reference_id}`;
  if (n.reference_type === 'deadline_extension_request') return '/dashboard/tasks?view=ext';
  if (n.type.startsWith('leave')) return '/dashboard/people';
  if (n.type.startsWith('memo')) return '/dashboard/messages';
  return null;
}

export default function NotificationsPage() {
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useQuery<Item[]>({ queryKey: ['notifications'], queryFn: () => notificationsApi.list().then((r) => r.data) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['notifications'] });

  const markAll = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      refresh();
      toast.success('All notifications marked as read');
    },
  });
  const markRead = useMutation({ mutationFn: (id: number) => notificationsApi.markRead(id), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id: number) => notificationsApi.remove(id), onSuccess: refresh });

  const unread = items.filter((n) => !n.read);
  const read = items.filter((n) => n.read);
  const markAllButton = unread.length > 0 && (
    <Button variant="white" size="lg" disabled={markAll.isPending} onClick={() => markAll.mutate()}>
      <Check strokeWidth={2.4} aria-hidden="true" />
      Mark all read
    </Button>
  );

  const row = (n: Item) => {
    const href = linkFor(n);
    const body = (
      <>
        <span aria-hidden="true" className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-yellow shadow-[0_0_0_4px_var(--color-pending-tint)]')} />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className={cn('text-[15px] lg:text-base', n.read ? 'font-semibold' : 'font-bold')}>{n.title}</span>
          <span className="text-sm leading-normal text-ink-2">{n.message}</span>
          <span className="text-[12.5px] text-ink-3">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</span>
        </span>
      </>
    );
    const open = () => !n.read && markRead.mutate(n.id);
    return (
      <li key={n.id} className="flex items-start gap-2 border-t border-line py-3.5 first:border-t-0 lg:py-4">
        {href ? (
          <Link href={href} onClick={open} className="flex min-w-0 flex-1 items-start gap-3.5 rounded-2xl text-ink no-underline outline-none focus-visible:ring-2 focus-visible:ring-ink">
            {body}
          </Link>
        ) : (
          <span className="flex min-w-0 flex-1 items-start gap-3.5">{body}</span>
        )}
        {!n.read && (
          <IconButton aria-label={`Mark “${n.title}” as read`} title="Mark as read" disabled={markRead.isPending} onClick={() => markRead.mutate(n.id)}>
            <Check strokeWidth={2.2} aria-hidden="true" />
          </IconButton>
        )}
        <IconButton variant="danger" aria-label={`Delete “${n.title}”`} title="Delete" disabled={remove.isPending} onClick={() => remove.mutate(n.id)}>
          <Trash2 strokeWidth={2} aria-hidden="true" />
        </IconButton>
      </li>
    );
  };

  const group = (title: string, list: Item[]) =>
    list.length > 0 && (
      <section aria-label={title} className="flex flex-col rounded-[26px] bg-surface px-4 py-2 lg:rounded-[28px] lg:px-7 lg:py-3">
        <h2 className="m-0 pt-2.5 pb-1 text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">
          {title} · {list.length}
        </h2>
        <ul className="m-0 list-none p-0">{list.map(row)}</ul>
      </section>
    );

  return (
    <PageBody className="max-w-[880px] gap-3.5 lg:gap-5">
      <div className="flex items-center gap-2.5 lg:hidden">
        <Link href="/dashboard" aria-label="Back to Home" className="flex size-11 items-center justify-center rounded-full bg-surface text-ink">
          <ArrowLeft className="size-[18px]" aria-hidden="true" />
        </Link>
        <h1 className="m-0 flex-1 font-display text-[30px] leading-none font-bold tracking-[-0.04em]">Notifications</h1>
      </div>
      <PageHeader
        className="hidden lg:flex"
        title="Notifications"
        description={unread.length ? `${unread.length} unread` : 'You’re all caught up'}
        actions={markAllButton}
      />
      {unread.length > 0 && <div className="lg:hidden">{markAllButton}</div>}

      {isLoading && <p className="m-0 text-sm text-ink-3">Loading…</p>}
      {!isLoading && items.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-[28px] bg-surface px-6 py-14 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-stone text-ink-2">
            <Bell className="size-6" aria-hidden="true" />
          </span>
          <p className="m-0 font-display text-2xl font-bold">No notifications</p>
          <p className="m-0 text-sm text-ink-3">Task updates, approvals and memos will show up here.</p>
        </div>
      )}
      {group('New', unread)}
      {group('Earlier', read)}
    </PageBody>
  );
}
