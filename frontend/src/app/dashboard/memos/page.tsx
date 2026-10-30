'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import Header from '@/components/layout/Header';
import { memosApi, usersApi } from '@/lib/api';
import { Memo, MemoResponse, User } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { Plus, Mail, FileText, Clock, Eye, MessageSquare } from 'lucide-react';

const TYPE_LABELS: Record<Memo['type'], string> = {
  individual: 'Individual',
  general: 'General',
  department: 'Department',
};

const TYPE_STYLES: Record<Memo['type'], string> = {
  individual: 'bg-blue-100 text-blue-700',
  general: 'bg-green-100 text-green-700',
  department: 'bg-purple-100 text-purple-700',
};

const COMPOSER_ROLES = ['operations_manager', 'team_lead', 'project_manager'];

export default function MemosPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Memo | null>(null);
  const [replyText, setReplyText] = useState('');

  const [form, setForm] = useState({
    subject: '', content: '', type: 'individual' as Memo['type'], recipients: '', department: '',
  });

  const { data: memos = [], isLoading } = useQuery<Memo[]>({
    queryKey: ['memos'],
    queryFn: () => memosApi.list().then((r) => r.data),
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => usersApi.list().then((r) => r.data),
  });

  const departments = Array.from(new Set(users.map((u) => u.department).filter((d): d is string => !!d)));
  const otherUsers = users.filter((u) => u.id !== user?.id);

  const resetForm = () => setForm({ subject: '', content: '', type: 'individual', recipients: '', department: '' });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => memosApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['memos'] });
      toast.success('Memo sent');
      setOpen(false);
      resetForm();
    },
    onError: () => toast.error('Failed to send memo'),
  });

  const replyMutation = useMutation({
    mutationFn: ({ id, content }: { id: number; content: string }) => memosApi.respond(id, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['memos'] });
      toast.success('Reply sent');
      setReplyText('');
    },
  });

  const memoDetail = useQuery({
    queryKey: ['memo', selected?.id],
    queryFn: () => memosApi.get(selected!.id).then((r) => r.data),
    enabled: !!selected,
  });

  // Opening a memo marks it (and any replies posted since the last view) as read server-side;
  // refresh the list so the card's "New" / unread-reply state reflects that immediately.
  useEffect(() => {
    if (memoDetail.dataUpdatedAt) {
      qc.invalidateQueries({ queryKey: ['memos'] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memoDetail.dataUpdatedAt]);

  const recipientsLabel = (memo: Memo) => {
    if (memo.type === 'department') return `${memo.department} Department`;
    const names = memo.recipients
      .map((id) => users.find((u) => u.id === id))
      .filter((u): u is User => !!u)
      .map((u) => `${u.first_name} ${u.last_name}`);
    if (names.length === 0) return '—';
    if (names.length <= 2) return names.join(', ');
    return `${names.slice(0, 2).join(', ')} +${names.length - 2} more`;
  };

  const canCompose = COMPOSER_ROLES.includes(user?.role ?? '');
  const canSubmit = form.subject && form.content
    && (form.type === 'department' ? !!form.department : !!form.recipients)
    && !createMutation.isPending;

  const submitMemo = () => {
    const payload: Record<string, unknown> = { subject: form.subject, content: form.content, type: form.type };
    if (form.type === 'department') {
      payload.department = form.department;
    } else {
      payload.recipients = form.recipients.split(',').filter(Boolean).map(Number);
    }
    createMutation.mutate(payload);
  };

  return (
    <div>
      <Header title="Memos" />
      <div className="p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8 text-blue-600" />
              <h1 className="text-3xl font-bold">Memos</h1>
            </div>
            <p className="text-muted-foreground mt-1">View memos sent to you</p>
          </div>

          {canCompose && (
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
              <DialogTrigger render={<Button className="rounded-xl h-11 px-5" />}>
                <Plus className="w-4 h-4 mr-1.5" /> New Memo
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Send Memo</DialogTitle></DialogHeader>
                <div className="space-y-3 mt-2">
                  <div className="space-y-1">
                    <Label>Subject</Label>
                    <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Message</Label>
                    <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={5} />
                  </div>
                  <div className="space-y-1">
                    <Label>Memo Type</Label>
                    <Select
                      value={form.type}
                      onValueChange={(v) => setForm({ ...form, type: v as Memo['type'], recipients: '', department: '' })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="individual">Individual</SelectItem>
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="department">Department</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {form.type === 'individual' && (
                    <div className="space-y-1">
                      <Label>Recipient</Label>
                      <Select value={form.recipients} onValueChange={(v) => setForm({ ...form, recipients: v as string })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a person...">
                            {(v: string | null) => {
                              const u = otherUsers.find((au) => String(au.id) === v);
                              return u ? `${u.first_name} ${u.last_name}` : 'Select a person...';
                            }}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {otherUsers.map((u) => (
                            <SelectItem key={u.id} value={String(u.id)}>{u.first_name} {u.last_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {form.type === 'general' && (
                    <div className="space-y-1">
                      <Label>Recipients (select users)</Label>
                      <div className="max-h-32 overflow-y-auto border rounded-lg p-2 space-y-1">
                        {otherUsers.map((u) => (
                          <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              className="rounded"
                              checked={form.recipients.split(',').includes(String(u.id))}
                              onChange={(e) => {
                                const ids = form.recipients.split(',').filter(Boolean);
                                if (e.target.checked) ids.push(String(u.id));
                                else ids.splice(ids.indexOf(String(u.id)), 1);
                                setForm({ ...form, recipients: ids.join(',') });
                              }}
                            />
                            {u.first_name} {u.last_name}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {form.type === 'department' && (
                    <div className="space-y-1">
                      <Label>Department</Label>
                      <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v as string })}>
                        <SelectTrigger><SelectValue placeholder="Select department..." /></SelectTrigger>
                        <SelectContent>
                          {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={submitMemo} disabled={!canSubmit}>
                      {createMutation.isPending ? 'Sending...' : 'Send Memo'}
                    </Button>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-muted animate-pulse rounded-2xl" />)}
          </div>
        ) : memos.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Mail className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No memos yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {memos.map((memo) => {
              const readEntry = memo.reads?.find((r) => r.user_id === user?.id);
              const isNew = memo.sender_id !== user?.id && !readEntry;
              const responses = memo.responses ?? [];
              const unreadReplies = readEntry
                ? responses.filter((r) => r.user_id !== user?.id && new Date(r.created_at) > new Date(readEntry.read_at))
                : [];
              const lastReply = responses.length ? responses[responses.length - 1] : null;
              return (
                <div key={memo.id} className="border rounded-2xl p-6 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-xl font-bold">{memo.subject}</h3>
                      {isNew && (
                        <span className="bg-red-500 text-white rounded-full px-3 py-1 text-xs font-semibold">New</span>
                      )}
                      {!isNew && unreadReplies.length > 0 && (
                        <span className="bg-orange-500 text-white rounded-full px-3 py-1 text-xs font-semibold">
                          {unreadReplies.length} New Repl{unreadReplies.length === 1 ? 'y' : 'ies'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={`text-xs font-semibold px-3 py-1 rounded-full ${TYPE_STYLES[memo.type]}`}>
                        {TYPE_LABELS[memo.type]}
                      </span>
                      <span className="text-xs font-semibold px-3 py-1 rounded-full border bg-white">
                        From: {memo.sender?.first_name} {memo.sender?.last_name}
                      </span>
                      <span className="text-xs font-semibold px-3 py-1 rounded-full border bg-white">
                        To: {recipientsLabel(memo)}
                      </span>
                    </div>
                    <div className="flex items-center gap-6 mt-3 text-sm text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4" />
                        {formatDate(memo.created_at, "MMM d, yyyy 'at' h:mm a")}
                      </span>
                      {readEntry && (
                        <span className="flex items-center gap-1.5 text-green-600 font-medium">
                          <Eye className="w-4 h-4" />
                          Read on {formatDate(readEntry.read_at)}
                        </span>
                      )}
                    </div>
                    {lastReply && (
                      <div className="mt-3 flex items-start gap-2 bg-muted/30 rounded-lg p-2.5">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                          {(lastReply.user?.first_name?.[0] ?? '') + (lastReply.user?.last_name?.[0] ?? '')}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium flex items-center gap-1.5">
                            <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                            {responses.length} repl{responses.length === 1 ? 'y' : 'ies'} · latest from {lastReply.user?.first_name} {lastReply.user?.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{lastReply.content}</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <Button variant="outline" className="rounded-xl h-10 px-4 shrink-0" onClick={() => setSelected(memo)}>
                    <Eye className="w-4 h-4 mr-1.5" /> View
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(v) => { if (!v) { setSelected(null); setReplyText(''); } }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          {selected && memoDetail.data && (
            <>
              <DialogHeader>
                <DialogTitle>{memoDetail.data.subject}</DialogTitle>
                <p className="text-xs text-muted-foreground">
                  From: {memoDetail.data.sender?.first_name} {memoDetail.data.sender?.last_name} · {formatDate(memoDetail.data.created_at, "MMM d, yyyy 'at' h:mm a")}
                </p>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <p className="text-sm whitespace-pre-wrap">{memoDetail.data.content}</p>
                {memoDetail.data.responses?.length > 0 && (
                  <div className="border-t pt-4 space-y-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Replies</p>
                    {memoDetail.data.responses.map((r: MemoResponse) => (
                      <div key={r.id} className="flex gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                          {(r.user?.first_name?.[0] ?? '') + (r.user?.last_name?.[0] ?? '')}
                        </div>
                        <div>
                          <p className="text-xs font-medium">{r.user?.first_name} {r.user?.last_name}</p>
                          <p className="text-sm">{r.content}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(r.created_at, "MMM d, yyyy 'at' h:mm a")}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="border-t pt-4 flex gap-2">
                  <Textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Write a reply..."
                    rows={2}
                    className="flex-1"
                  />
                  <Button
                    onClick={() => replyMutation.mutate({ id: selected.id, content: replyText })}
                    disabled={!replyText || replyMutation.isPending}
                  >
                    Reply
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
