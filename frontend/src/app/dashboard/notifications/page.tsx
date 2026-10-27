'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Header from '@/components/layout/Header';
import { notificationsApi } from '@/lib/api';
import { Notification } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { timeAgo } from '@/lib/utils';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function NotificationsPage() {
  const qc = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list().then((r) => r.data),
  });

  const markAllMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('All notifications marked as read');
    },
  });

  const markReadMutation = useMutation({
    mutationFn: (id: number) => notificationsApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => notificationsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const unread = notifications.filter((n: Notification) => !n.read).length;

  return (
    <div>
      <Header title="Notifications" />
      <div className="p-6 max-w-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium">All Notifications</h2>
            {unread > 0 && <Badge variant="destructive" className="text-xs">{unread} unread</Badge>}
          </div>
          {unread > 0 && (
            <Button variant="outline" size="sm" onClick={() => markAllMutation.mutate()}>
              <CheckCheck className="w-3.5 h-3.5 mr-1.5" /> Mark all read
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No notifications</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n: Notification) => (
              <div
                key={n.id}
                className={`flex items-start gap-3 p-4 rounded-lg border transition-colors ${
                  !n.read ? 'bg-primary/5 border-primary/20' : 'bg-background'
                }`}
              >
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${!n.read ? 'bg-primary' : 'bg-muted'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{timeAgo(n.created_at)}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!n.read && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => markReadMutation.mutate(n.id)}>
                      <CheckCheck className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteMutation.mutate(n.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
