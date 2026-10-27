'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import Header from '@/components/layout/Header';
import { supportApi } from '@/lib/api';
import { TechnicalSupportRequest } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { statusColor, priorityColor, timeAgo } from '@/lib/utils';
import { toast } from 'sonner';
import { Plus, HelpCircle } from 'lucide-react';

export default function SupportPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium' });

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['support'],
    queryFn: () => supportApi.list().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => supportApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support'] });
      toast.success('Support request submitted');
      setOpen(false);
      setForm({ title: '', description: '', priority: 'medium' });
    },
    onError: () => toast.error('Failed to submit request'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => supportApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support'] }),
  });

  const canManage = ['operations_manager', 'team_lead'].includes(user?.role ?? '');

  return (
    <div>
      <Header title="Technical Support" />
      <div className="p-6 space-y-4">
        <div className="flex justify-end">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button size="sm" />}>
              <Plus className="w-4 h-4 mr-1" /> New Request
              </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Submit Support Request</DialogTitle></DialogHeader>
              <div className="space-y-3 mt-2">
                <div className="space-y-1">
                  <Label>Title</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Description</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} />
                </div>
                <div className="space-y-1">
                  <Label>Priority</Label>
                  <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as string })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['low', 'medium', 'high', 'urgent'].map((p) => (
                        <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => createMutation.mutate(form)} disabled={!form.title || !form.description || createMutation.isPending}>
                    {createMutation.isPending ? 'Submitting...' : 'Submit'}
                  </Button>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />)}</div>
        ) : requests.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <HelpCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No support requests</p>
          </div>
        ) : (
          <div className="space-y-2">
            {requests.map((req: TechnicalSupportRequest) => (
              <div key={req.id} className="p-4 border rounded-lg">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{req.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{req.description}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      {req.requester && (
                        <span className="text-xs text-muted-foreground">{req.requester.first_name} {req.requester.last_name}</span>
                      )}
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">{timeAgo(req.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {req.priority && (
                      <Badge className={`text-xs ${priorityColor(req.priority)}`} variant="outline">{req.priority}</Badge>
                    )}
                    {canManage ? (
                      <Select value={req.status} onValueChange={(v) => updateMutation.mutate({ id: req.id, data: { status: v } })}>
                        <SelectTrigger className="h-7 text-xs w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {['open', 'in_progress', 'resolved', 'closed'].map((s) => (
                            <SelectItem key={s} value={s} className="text-xs capitalize">{s.replace(/_/g, ' ')}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge className={`text-xs ${statusColor(req.status)}`} variant="outline">{req.status.replace(/_/g, ' ')}</Badge>
                    )}
                  </div>
                </div>
                {req.resolution && (
                  <div className="mt-3 p-2 bg-muted/30 rounded text-xs">
                    <span className="font-medium">Resolution: </span>{req.resolution}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
