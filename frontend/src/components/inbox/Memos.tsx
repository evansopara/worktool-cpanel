'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Mail } from 'lucide-react';
import { toast } from 'sonner';
import type { User } from '@/types';
import { usersApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Sheet, SheetActions, SheetDescription, SheetTitle } from '@/components/wc';
import { errorText } from '@/lib/tasks';
import { MEMO_TYPES, memoApi, type Memo } from '@/lib/inbox';

// Memos tab of Inbox. Old Memos page rules: managers write memos;
// recipients read them and reply; the sender or an Operations Manager can
// delete one.

type Member = { id: number; first_name: string; last_name: string; role: string; department?: string | null };
type Filter = 'all' | Memo['type'];

const fullName = (u?: { first_name?: string; last_name?: string }) => (u ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() : '');
const when = (iso: string) => format(new Date(iso), 'MMM d, yyyy · h:mm a');

export function MemosTab({ user }: { user: User }) {
  const { data: memos = [], isLoading } = useQuery({ queryKey: ['memos'], queryFn: memoApi.list, refetchInterval: 60_000 });
  const { data: users = [] } = useQuery<Member[]>({ queryKey: ['users'], queryFn: () => usersApi.list().then((r) => r.data) });
  const [filter, setFilter] = useState<Filter>('all');
  const [openId, setOpenId] = useState<number | null>(null);
  const names = new Map(users.map((u) => [u.id, fullName(u)]));
  const shown = memos.filter((m) => filter === 'all' || m.type === filter);

  const to = (m: Memo) => {
    if (m.type === 'department') return m.department ? `${m.department} team` : 'A department';
    if (m.type === 'general' && m.recipients.length > 2) return `${m.recipients.length} people`;
    return m.recipients.map((id) => names.get(id)).filter(Boolean).join(', ') || '—';
  };
  const unread = (m: Memo) => m.sender_id !== user.id && m.recipients.includes(user.id) && !m.reads?.some((r) => r.user_id === user.id);

  return (
    <section aria-label="Memos" className="flex flex-col gap-3 lg:gap-3.5">
      <div role="group" aria-label="Memo type" className="flex gap-2 overflow-x-auto lg:flex-wrap">
        {(['all', 'individual', 'department', 'general'] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={cn('h-[38px] shrink-0 cursor-pointer rounded-full border-0 px-3.5 font-ui text-[13.5px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ink lg:h-[42px] lg:px-[18px] lg:text-sm', filter === f ? 'bg-ink text-white' : 'bg-surface text-ink-2')}
          >
            {f === 'all' ? 'All memos' : MEMO_TYPES[f].label}
          </button>
        ))}
      </div>
      {isLoading && <p className="m-0 text-sm text-ink-3">Loading…</p>}
      {!isLoading && shown.length === 0 && <p className="m-0 rounded-card bg-surface p-6 text-sm text-ink-3">No memos here.</p>}
      {shown.map((m) => (
        <article key={m.id} className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-card bg-surface p-[18px] lg:px-[26px] lg:py-[22px]">
          <span className={cn('flex size-[46px] shrink-0 items-center justify-center rounded-[15px] lg:size-[52px] lg:rounded-2xl', MEMO_TYPES[m.type].tile)}>
            <Mail className="size-[22px]" aria-hidden="true" />
          </span>
          <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-1.5">
            <h2 className="m-0 flex flex-wrap items-center gap-2 font-display text-lg font-bold tracking-[-0.01em] lg:text-[22px]">
              {m.subject}
              {unread(m) && <span className="rounded-full bg-yellow px-2 py-0.5 font-ui text-[11px] font-bold">New</span>}
            </h2>
            <p className="m-0 text-[13.5px] text-ink-2 lg:text-sm">
              {MEMO_TYPES[m.type].label} · From {fullName(m.sender) || '—'} · To {to(m)}
            </p>
            <span className="text-[13px] text-ink-3 lg:hidden">{when(m.created_at)}</span>
          </div>
          <span className="hidden text-[13.5px] text-ink-3 lg:inline">{when(m.created_at)}</span>
          <button type="button" onClick={() => setOpenId(m.id)} className="h-11 cursor-pointer rounded-full border-0 bg-stone px-5 font-ui text-sm font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink">
            Read memo
          </button>
        </article>
      ))}
      <MemoSheet id={openId} user={user} onClose={() => setOpenId(null)} />
    </section>
  );
}

function MemoSheet({ id, user, onClose }: { id: number | null; user: User; onClose: () => void }) {
  return (
    <Sheet open={id !== null} onOpenChange={(o) => !o && onClose()}>
      {id !== null && <MemoBody id={id} user={user} onClose={onClose} />}
    </Sheet>
  );
}

function MemoBody({ id, user, onClose }: { id: number; user: User; onClose: () => void }) {
  const qc = useQueryClient();
  // Opening a memo marks it read on the server.
  const memo = useQuery({ queryKey: ['memo', id], queryFn: () => memoApi.get(id) });
  const loaded = memo.isSuccess;
  useEffect(() => {
    if (loaded) qc.invalidateQueries({ queryKey: ['badges'] });
  }, [id, loaded, qc]);
  const [reply, setReply] = useState('');
  const respond = useMutation({
    mutationFn: () => memoApi.respond(id, reply.trim()),
    onSuccess: () => {
      setReply('');
      qc.invalidateQueries({ queryKey: ['memo', id] });
      qc.invalidateQueries({ queryKey: ['memos'] });
    },
    onError: (err) => toast.error(errorText(err, 'Reply not sent.')),
  });
  const remove = useMutation({
    mutationFn: () => memoApi.remove(id),
    onSuccess: () => {
      toast.success('Memo deleted');
      qc.invalidateQueries({ queryKey: ['memos'] });
      onClose();
    },
    onError: (err) => toast.error(errorText(err, 'Could not delete the memo.')),
  });
  const m = memo.data;
  if (!m) return <SheetTitle>{memo.isError ? 'Memo not found' : 'Loading…'}</SheetTitle>;
  const canDelete = m.sender_id === user.id || user.role === 'operations_manager';

  return (
    <>
      <SheetTitle>{m.subject}</SheetTitle>
      <SheetDescription>
        {MEMO_TYPES[m.type].label} · From {fullName(m.sender)} · {when(m.created_at)}
        {m.sender_id === user.id && ` · Read by ${m.reads?.length ?? 0} of ${m.recipients.length}`}
      </SheetDescription>
      <div className="rounded-[18px] bg-surface-2 p-4 text-[15px] leading-[1.6] whitespace-pre-wrap">{m.content}</div>
      {(m.responses?.length ?? 0) > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">Replies</span>
          {m.responses!.map((r) => (
            <div key={r.id} className="flex flex-col gap-1 rounded-2xl bg-bubble px-3.5 py-2.5">
              <span className="text-[12.5px] font-semibold text-ink-2">
                {fullName(r.user)} <span className="font-normal text-ink-3">{when(r.created_at)}</span>
              </span>
              <span className="text-sm whitespace-pre-wrap">{r.content}</span>
            </div>
          ))}
        </div>
      )}
      <label className="flex flex-col gap-1.5">
        <span className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">Reply</span>
        <textarea rows={2} value={reply} onChange={(e) => setReply(e.target.value)} className="rounded-2xl border-0 bg-surface-2 px-4 py-3 font-ui text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-ink" />
      </label>
      <SheetActions confirmLabel="Send reply" cancelLabel="Close" confirmDisabled={!reply.trim() || respond.isPending} onConfirm={() => respond.mutate()} />
      {canDelete && (
        <button type="button" onClick={() => remove.mutate()} disabled={remove.isPending} className="h-10 cursor-pointer self-center rounded-full border-0 bg-transparent px-4 font-ui text-sm font-semibold text-missed disabled:opacity-40">
          Delete memo
        </button>
      )}
    </>
  );
}

export function NewMemoSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      {open && <NewMemoBody onClose={onClose} />}
    </Sheet>
  );
}

function NewMemoBody({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: users = [] } = useQuery<Member[]>({ queryKey: ['users'], queryFn: () => usersApi.list().then((r) => r.data) });
  const staff = users.filter((u) => u.role !== 'client');
  const departments = [...new Set(users.map((u) => u.department).filter((d): d is string => !!d))].sort();
  const [f, setF] = useState<{ type: Memo['type']; subject: string; content: string; recipients: number[]; department: string }>({
    type: 'individual',
    subject: '',
    content: '',
    recipients: [],
    department: '',
  });
  const send = useMutation({
    mutationFn: () =>
      memoApi.create({
        type: f.type,
        subject: f.subject.trim(),
        content: f.content.trim(),
        ...(f.type === 'department' ? { department: f.department } : { recipients: f.recipients }),
      }),
    onSuccess: () => {
      toast.success('Memo sent');
      qc.invalidateQueries({ queryKey: ['memos'] });
      onClose();
    },
    onError: (err) => toast.error(errorText(err, 'Could not send the memo.')),
  });
  const ready = f.subject.trim() && f.content.trim() && (f.type === 'department' ? f.department : f.recipients.length) && !send.isPending;
  const field = 'h-12 w-full rounded-2xl border-0 bg-surface-2 px-4 font-ui text-[15px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink';
  const label = 'text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink-3';

  return (
    <>
      <SheetTitle>New memo</SheetTitle>
      <label className="flex flex-col gap-1.5">
        <span className={label}>Type</span>
        <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as Memo['type'], recipients: [], department: '' })} className={field}>
          <option value="individual">Individual — one person</option>
          <option value="general">Broadcast — choose several people</option>
          <option value="department">Department — everyone in a department</option>
        </select>
      </label>
      {f.type === 'individual' && (
        <label className="flex flex-col gap-1.5">
          <span className={label}>To</span>
          <select value={f.recipients[0] ?? ''} onChange={(e) => setF({ ...f, recipients: e.target.value ? [Number(e.target.value)] : [] })} className={field}>
            <option value="">Choose a person</option>
            {staff.map((u) => (
              <option key={u.id} value={u.id}>
                {fullName(u)}
              </option>
            ))}
          </select>
        </label>
      )}
      {f.type === 'general' && (
        <div className="flex flex-col gap-1.5">
          <span className={label}>To ({f.recipients.length})</span>
          <div className="flex max-h-44 flex-col gap-1 overflow-y-auto rounded-2xl bg-surface-2 p-2">
            {staff.map((u) => (
              <label key={u.id} className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-surface">
                <input
                  type="checkbox"
                  checked={f.recipients.includes(u.id)}
                  onChange={(e) => setF({ ...f, recipients: e.target.checked ? [...f.recipients, u.id] : f.recipients.filter((x) => x !== u.id) })}
                  className="size-4 accent-ink"
                />
                <span className="text-sm font-semibold">{fullName(u)}</span>
              </label>
            ))}
          </div>
        </div>
      )}
      {f.type === 'department' && (
        <label className="flex flex-col gap-1.5">
          <span className={label}>Department</span>
          <select value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })} className={field}>
            <option value="">Choose a department</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="flex flex-col gap-1.5">
        <span className={label}>Subject</span>
        <input value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} className={field} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={label}>Memo</span>
        <textarea rows={5} value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} className={`${field} h-auto py-3 leading-normal`} />
      </label>
      <SheetActions confirmLabel="Send memo" confirmDisabled={!ready} onConfirm={() => ready && send.mutate()} />
    </>
  );
}
