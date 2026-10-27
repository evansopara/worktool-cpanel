'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import Header from '@/components/layout/Header';
import { bookingsApi, usersApi } from '@/lib/api';
import { Booking, BookingType, User } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { Plus, Calendar, Trash2, Pencil, Clock, Users } from 'lucide-react';

const TYPE_LABELS: Record<BookingType, string> = {
  one_on_one: 'One-on-One Booking',
  team: 'Team Booking',
  marketing_meeting_call: 'Marketing Meeting Call',
  general: 'General Booking',
};

const TYPE_STYLES: Record<BookingType, string> = {
  one_on_one: 'bg-blue-100 text-blue-700',
  team: 'bg-green-100 text-green-700',
  marketing_meeting_call: 'bg-purple-100 text-purple-700',
  general: 'bg-slate-100 text-slate-700',
};

const MARKETING_KEYWORDS = ['media buying', 'media_buying', 'automation', 'copywriting', 'copywriter', 'community manager', 'community_manager', 'marketing'];

const emptyForm = {
  title: '', description: '', type: 'one_on_one' as BookingType,
  participants: '', start_time: '', end_time: '', meeting_link: '',
};

export default function BookingsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: bookings = [], isLoading } = useQuery<Booking[]>({
    queryKey: ['bookings'],
    queryFn: () => bookingsApi.list().then((r) => r.data),
  });

  // Latest meeting date first; id breaks ties for meetings starting at the same time.
  const sortedBookings = [...bookings].sort(
    (a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime() || b.id - a.id
  );

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => usersApi.list().then((r) => r.data),
  });

  const resetForm = () => setForm(emptyForm);

  const openCreate = () => {
    setEditingId(null);
    resetForm();
    setOpen(true);
  };

  const openEdit = (b: Booking) => {
    setEditingId(b.id);
    setForm({
      title: b.title,
      description: b.description ?? '',
      type: b.type,
      participants: (b.participants ?? []).join(','),
      start_time: formatDate(b.start_time, "yyyy-MM-dd'T'HH:mm"),
      end_time: formatDate(b.end_time, "yyyy-MM-dd'T'HH:mm"),
      meeting_link: b.meeting_link ?? '',
    });
    setOpen(true);
  };

  const eligibleParticipants = users.filter((u) => {
    if (u.id === user?.id || u.role === 'client') return false;
    if (form.type !== 'marketing_meeting_call') return true;
    if (u.role === 'project_manager') return true;
    const spec = (u.specialization ?? '').toLowerCase();
    return MARKETING_KEYWORDS.some((k) => spec.includes(k));
  });

  // General and Marketing Meeting Call bookings auto-include every eligible participant —
  // no manual picking, so their participant list is derived straight from eligibility each render.
  const isAutoSelectType = form.type === 'general' || form.type === 'marketing_meeting_call';
  const participantIds = isAutoSelectType
    ? eligibleParticipants.map((u) => u.id)
    : form.participants.split(',').filter(Boolean).map(Number);

  const participantNames = (b: Booking) => {
    const names = (b.participants ?? [])
      .map((id) => users.find((u) => u.id === id))
      .filter((u): u is User => !!u)
      .map((u) => `${u.first_name} ${u.last_name}`);
    if (names.length === 0) return 'No participants';
    if (names.length <= 3) return names.join(', ');
    return `${names.slice(0, 3).join(', ')} +${names.length - 3} more`;
  };

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => bookingsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
      toast.success('Meeting scheduled');
      setOpen(false);
      resetForm();
    },
    onError: () => toast.error('Failed to schedule meeting'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => bookingsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
      toast.success('Meeting updated');
      setOpen(false);
      setEditingId(null);
      resetForm();
    },
    onError: () => toast.error('Failed to update meeting'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => bookingsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
      toast.success('Booking removed');
      setDeleteId(null);
    },
    onError: () => toast.error('Failed to remove booking'),
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const canSubmit = form.title && form.type && participantIds.length > 0 && form.start_time && form.end_time && !isSaving;

  const submitBooking = () => {
    const payload = {
      title: form.title,
      description: form.description || undefined,
      type: form.type,
      participants: participantIds,
      start_time: form.start_time,
      end_time: form.end_time,
      meeting_link: form.meeting_link || undefined,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <div>
      <Header title="Bookings & Meetings" />
      <div className="p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Bookings Management</h1>
            <p className="text-muted-foreground mt-1">Schedule and manage team meetings</p>
          </div>

          <Button
            className="w-full sm:w-auto shrink-0 rounded-xl h-11 px-5 bg-slate-900 hover:bg-slate-800 text-white"
            onClick={openCreate}
          >
            <Plus className="w-4 h-4 mr-1.5" /> Schedule Meeting
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-40 bg-muted animate-pulse rounded-2xl" />)}</div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No bookings yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedBookings.map((b) => {
              const canManage = b.scheduled_by === user?.id || ['operations_manager', 'team_lead'].includes(user?.role ?? '');
              return (
                <div key={b.id} className="border rounded-2xl p-6 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold">{b.title}</h3>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={`text-xs font-semibold px-3 py-1 rounded-full ${TYPE_STYLES[b.type] ?? 'bg-slate-100 text-slate-700'}`}>
                        {TYPE_LABELS[b.type] ?? b.type.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-900 text-white capitalize">
                        {b.status}
                      </span>
                    </div>
                    {b.description && <p className="text-muted-foreground mt-3">{b.description}</p>}
                    <div className="flex items-start gap-8 mt-4 text-sm text-muted-foreground flex-wrap">
                      <span className="flex items-start gap-2">
                        <Clock className="w-4 h-4 mt-0.5 shrink-0" />
                        <span>
                          <span className="font-semibold text-foreground block">{formatDate(b.start_time, 'MMM d, yyyy')}</span>
                          {formatDate(b.start_time, 'HH:mm')} - {formatDate(b.end_time, 'HH:mm')}
                        </span>
                      </span>
                      <span className="flex items-start gap-2 max-w-xs">
                        <Users className="w-4 h-4 mt-0.5 shrink-0" />
                        <span>{participantNames(b)}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        By {b.scheduler?.first_name} {b.scheduler?.last_name}
                      </span>
                    </div>
                    {b.meeting_link && (
                      <a href={b.meeting_link} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline mt-2 block truncate">
                        {b.meeting_link}
                      </a>
                    )}
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="icon"
                        className="rounded-xl h-10 w-10"
                        onClick={() => openEdit(b)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="rounded-xl h-10 w-10 border-red-200 text-red-500 hover:bg-red-50"
                        onClick={() => setDeleteId(b.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Schedule / Edit dialog */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); resetForm(); } }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? 'Edit Meeting' : 'Schedule Meeting'}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1">
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm({ ...form, type: v as BookingType, participants: '' })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(v: string | null) => TYPE_LABELS[(v ?? 'one_on_one') as BookingType]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="one_on_one">One-on-One Booking</SelectItem>
                  <SelectItem value="team">Team Booking</SelectItem>
                  <SelectItem value="marketing_meeting_call">Marketing Meeting Call</SelectItem>
                  <SelectItem value="general">General Booking</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.type === 'one_on_one' ? (
              <div className="space-y-1">
                <Label>Participant</Label>
                <Select value={form.participants} onValueChange={(v) => setForm({ ...form, participants: v as string })}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a person...">
                      {(v: string | null) => {
                        const u = eligibleParticipants.find((au) => String(au.id) === v);
                        return u ? `${u.first_name} ${u.last_name}` : 'Select a person...';
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleParticipants.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>{u.first_name} {u.last_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : isAutoSelectType ? (
              <div className="space-y-1">
                <Label>Participants (auto-selected)</Label>
                <div className="max-h-32 overflow-y-auto border rounded-lg p-2.5 text-sm bg-muted/30">
                  {eligibleParticipants.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {form.type === 'marketing_meeting_call'
                        ? 'No marketing staff or project managers found'
                        : 'No eligible users found'}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{eligibleParticipants.length} participant(s)</span> will be automatically included: {eligibleParticipants.map((u) => `${u.first_name} ${u.last_name}`).join(', ')}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <Label>Participants</Label>
                <div className="max-h-32 overflow-y-auto border rounded-lg p-2 space-y-1">
                  {eligibleParticipants.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-1">No eligible participants for this meeting type</p>
                  ) : eligibleParticipants.map((u) => (
                    <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded"
                        checked={form.participants.split(',').includes(String(u.id))}
                        onChange={(e) => {
                          const ids = form.participants.split(',').filter(Boolean);
                          if (e.target.checked) ids.push(String(u.id));
                          else ids.splice(ids.indexOf(String(u.id)), 1);
                          setForm({ ...form, participants: ids.join(',') });
                        }}
                      />
                      {u.first_name} {u.last_name}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Start</Label>
                <Input type="datetime-local" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>End</Label>
                <Input type="datetime-local" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Meeting Link</Label>
              <Input value={form.meeting_link} onChange={(e) => setForm({ ...form, meeting_link: e.target.value })} placeholder="https://" />
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={submitBooking} disabled={!canSubmit}>
                {isSaving ? 'Saving...' : editingId ? 'Save Changes' : 'Schedule'}
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Delete Booking</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground mt-1">
            Are you sure you want to delete this booking? This action cannot be undone.
          </p>
          <div className="flex gap-2 mt-4">
            <Button
              variant="destructive"
              className="flex-1"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate(deleteId!)}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Yes, Delete'}
            </Button>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
