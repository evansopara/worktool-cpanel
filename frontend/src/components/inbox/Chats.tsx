'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, isToday, isYesterday } from 'date-fns';
import { ArrowLeft, Copy, Forward, MoreHorizontal, Pin, PinOff, Reply, Search, SendHorizontal, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import type { User } from '@/types';
import { usersApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Sheet, SheetActions, SheetDescription, SheetTitle, initials } from '@/components/wc';
import { roleLabel } from '@/components/shell/nav';
import { errorText } from '@/lib/tasks';
import type { ChatMessage } from '@/lib/projects';
import { inboxApi, type ConvKey, type InboxData, type Preview } from '@/lib/inbox';
import { forwardContent, parseMessage, plainText, replyContent } from '@/lib/messages';

// Chats tab of Inbox: conversation list (channels, project chats, direct
// messages) and the open conversation. No live updates on this server, so
// the open conversation polls every 5 seconds.

type Member = { id: number; first_name: string; last_name: string; role: string };

export type Conv = {
  key: ConvKey;
  title: string;
  meta: string;
  ini: string;
  square: boolean; // channels and projects are rounded squares, people circles
  tone: string;
  preview: Preview;
  unread: number;
  href?: string;
};

const TONES = ['bg-yellow text-ink', 'bg-ink text-yellow', 'bg-review-tint text-review', 'bg-done-tint text-done', 'bg-pending-tint text-pending'];
const fullName = (u: { first_name?: string; last_name?: string }) => `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim();

function stamp(at?: string) {
  if (!at) return '';
  const d = new Date(at);
  if (isToday(d)) return format(d, 'H:mm');
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMM d');
}

/** Conversations grouped as on the artboard; people never messaged come last. */
export function useConversations(user: User) {
  const inbox = useQuery({ queryKey: ['inbox'], queryFn: inboxApi.summary, refetchInterval: 15_000 });
  const users = useQuery<Member[]>({ queryKey: ['users'], queryFn: () => usersApi.list().then((r) => r.data) });

  return useMemo(() => {
    const d: InboxData = inbox.data ?? { general: { last: null }, projects: [], direct: [] };
    const people = new Map((users.data ?? []).filter((u) => u.id !== user.id && u.role !== 'client').map((u) => [u.id, u]));
    let i = 0;
    const tone = () => TONES[i++ % TONES.length];

    const general: Conv = { key: 'general', title: 'General channel', meta: 'Everyone at WC Digital', ini: '#', square: true, tone: tone(), preview: d.general.last, unread: 0 };
    const projects: Conv[] = d.projects.map((p) => ({
      key: `p${p.id}`,
      title: p.name,
      meta: 'Project group chat',
      ini: initials(p.name),
      square: true,
      tone: tone(),
      preview: p.last,
      unread: 0,
      href: `/dashboard/projects?id=${p.id}`,
    }));
    const talked = d.direct
      .filter((x) => people.has(x.user_id))
      .map((x): Conv => {
        const u = people.get(x.user_id)!;
        return { key: `u${u.id}`, title: fullName(u), meta: roleLabel(u.role), ini: initials(fullName(u)), square: false, tone: tone(), preview: x.last, unread: x.unread };
      });
    const talkedIds = new Set(d.direct.map((x) => x.user_id));
    const others = [...people.values()]
      .filter((u) => !talkedIds.has(u.id))
      .sort((a, b) => fullName(a).localeCompare(fullName(b)))
      .map((u): Conv => ({ key: `u${u.id}`, title: fullName(u), meta: roleLabel(u.role), ini: initials(fullName(u)), square: false, tone: tone(), preview: null, unread: 0 }));

    return {
      loading: inbox.isLoading,
      sections: [
        { label: 'Channels', items: [general] },
        { label: 'Project chats', items: projects },
        { label: 'Direct messages', items: [...talked, ...others] },
      ],
      byKey: new Map([general, ...projects, ...talked, ...others].map((c) => [c.key, c])),
    };
  }, [inbox.data, inbox.isLoading, users.data, user.id]);
}

export function ConversationList({
  sections,
  current,
  onPick,
  mobile,
}: {
  sections: { label: string; items: Conv[] }[];
  current: ConvKey | null;
  onPick: (k: ConvKey) => void;
  mobile?: boolean;
}) {
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  const shown = sections
    .map((s) => ({ ...s, items: s.items.filter((c) => !term || c.title.toLowerCase().includes(term)) }))
    .filter((s) => s.items.length);

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <label className="flex h-12 shrink-0 items-center gap-2 rounded-full bg-surface px-[18px] text-ink-3 focus-within:ring-2 focus-within:ring-ink">
        <Search className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
        <input type="search" aria-label="Search people and chats" placeholder="Search people and chats" value={q} onChange={(e) => setQ(e.target.value)} className="min-w-0 flex-1 border-0 bg-transparent font-ui text-[14.5px] text-ink outline-none lg:text-[14.5px]" />
      </label>
      <div className={cn('flex flex-col gap-3.5', !mobile && 'min-h-0 overflow-y-auto')}>
        {shown.map((s) => (
          <section key={s.label} className="flex flex-col gap-0.5 lg:gap-1">
            <h2 className="m-0 mx-1.5 my-1 text-xs font-semibold uppercase tracking-[0.07em] text-ink-3 lg:mx-0 lg:my-0 lg:px-3 lg:py-1">{s.label}</h2>
            <div className={cn('flex flex-col', mobile && 'overflow-hidden rounded-card bg-surface')}>
              {s.items.map((c) => {
                const on = !mobile && c.key === current;
                return (
                  <button
                    key={c.key}
                    type="button"
                    aria-current={on ? 'true' : undefined}
                    onClick={() => onPick(c.key)}
                    className={cn(
                      'flex w-full cursor-pointer items-center gap-3 border-0 text-left font-ui outline-none focus-visible:ring-2 focus-visible:ring-ink',
                      mobile ? 'min-h-[68px] border-b border-bubble bg-surface px-3.5 py-2.5 last:border-b-0' : 'min-h-[60px] rounded-[20px] px-3 py-2',
                      on ? 'bg-ink text-white' : !mobile && 'bg-transparent text-ink hover:bg-surface',
                    )}
                  >
                    <span className={cn('flex shrink-0 items-center justify-center font-bold', mobile ? 'size-[46px] text-sm' : 'size-10 text-[13px]', c.square ? (mobile ? 'rounded-[15px]' : 'rounded-[14px]') : 'rounded-full', c.tone)}>{c.ini}</span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex justify-between gap-2">
                        <span className={cn('truncate font-bold', mobile ? 'text-[15.5px]' : 'text-[14.5px]')}>{c.title}</span>
                        <span className={cn('shrink-0 text-xs', on ? 'opacity-70' : 'text-ink-3')}>{stamp(c.preview?.at)}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className={cn('min-w-0 flex-1 truncate', mobile ? 'text-[13.5px] text-ink-2' : 'text-[13px] opacity-75')}>
                          {c.preview ? `${c.preview.mine ? 'You' : (c.preview.sender ?? '').split(' ')[0]}: ${plainText(c.preview.content)}` : c.meta}
                        </span>
                        {c.unread > 0 && <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-yellow px-[5px] text-[11px] font-bold text-ink">{c.unread}</span>}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}


/** The open conversation: desktop pane, or a full-screen sheet on phones. */
export function Conversation({ conv, user, onBack }: { conv: Conv; user: User; onBack: () => void }) {
  const qc = useQueryClient();
  const messages = useQuery({ queryKey: ['conversation', conv.key], queryFn: () => inboxApi.messages(conv.key), refetchInterval: 5_000 });
  // Opening a chat marks its messages read on the server; recount the badges.
  const loaded = messages.isSuccess;
  useEffect(() => {
    if (loaded) qc.invalidateQueries({ queryKey: ['badges'] });
  }, [conv.key, loaded, qc]);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['conversation', conv.key] });
    qc.invalidateQueries({ queryKey: ['inbox'] });
  };
  const send = useMutation({
    mutationFn: (text: string) => inboxApi.send(conv.key, text),
    onSuccess: refresh,
    onError: (err) => toast.error(errorText(err, 'Message not sent.')),
  });
  // Opening a direct message marks it read on the server; refresh the list's badge.
  const list = messages.data ?? [];
  useEffect(() => {
    if (conv.unread && messages.isSuccess) qc.invalidateQueries({ queryKey: ['inbox'] });
  }, [conv.unread, messages.isSuccess, qc]);

  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Braces matter: newer browsers return a Promise from scrollIntoView.
    end.current?.scrollIntoView({ block: 'end' });
  }, [list.length, conv.key]);

  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<{ name: string; content: string } | null>(null);
  const [acting, setActing] = useState<ChatMessage | null>(null);
  const [forwarding, setForwarding] = useState<ChatMessage | null>(null);
  const [deleting, setDeleting] = useState<ChatMessage | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const body = text.trim();
    if (!body || send.isPending) return;
    send.mutate(replyTo ? replyContent(replyTo.name, replyTo.content, body) : body);
    setText('');
    setReplyTo(null);
  };

  const lead = user.role === 'operations_manager' || user.role === 'team_lead';
  const senderId = (m: ChatMessage) => m.sender?.id ?? m.sender_id;
  const senderName = (m: ChatMessage) => (senderId(m) === user.id ? 'You' : fullName(m.sender ?? {}) || 'Someone');
  const canDelete = (m: ChatMessage) => senderId(m) === user.id || (lead && conv.key[0] !== 'u');
  const canPin = conv.key === 'general' ? lead : true;

  const pin = useMutation({
    mutationFn: (m: ChatMessage) => inboxApi.pin(conv.key, m.id, !m.is_pinned),
    onSuccess: (_, m) => {
      refresh();
      toast.success(m.is_pinned ? 'Message unpinned' : 'Message pinned');
    },
    onError: (err) => toast.error(errorText(err, 'Could not pin the message.')),
  });
  const remove = useMutation({
    mutationFn: (m: ChatMessage) => inboxApi.remove(conv.key, m.id),
    onSuccess: () => {
      refresh();
      setDeleting(null);
      toast.success('Message deleted');
    },
    onError: (err) => toast.error(errorText(err, 'Could not delete the message.')),
  });

  const copy = (m: ChatMessage) => {
    navigator.clipboard
      ?.writeText(plainText(m.content))
      .then(() => toast.success('Copied'))
      .catch(() => toast.error('Could not copy.'));
  };
  const startReply = (m: ChatMessage) => {
    setReplyTo({ name: senderId(m) === user.id ? fullName(user) || 'You' : fullName(m.sender ?? {}) || 'Someone', content: m.content });
  };
  // Starting a reply puts the cursor in the message box.
  useEffect(() => {
    if (replyTo) box.current?.focus();
  }, [replyTo]);

  const pinned = list.filter((m) => m.is_pinned);
  const [pinIndex, setPinIndex] = useState(0);
  const shownPin = pinned.length ? pinned[pinIndex % pinned.length] : null;
  const jumpTo = (id: number) => {
    const el = document.getElementById(`msg-${id}`);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el?.classList.add('ring-2', 'ring-yellow');
    setTimeout(() => el?.classList.remove('ring-2', 'ring-yellow'), 1600);
  };

  const header = (
    <>
      <span className={cn('flex size-11 shrink-0 items-center justify-center text-sm font-bold lg:size-[46px]', conv.square ? 'rounded-[15px] lg:rounded-[14px]' : 'rounded-full', conv.tone)}>{conv.ini}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-px lg:gap-0.5">
        <span className="truncate font-display text-[19px] leading-[1.1] font-bold lg:text-[22px] lg:tracking-[-0.01em]">{conv.title}</span>
        <span className="text-[12.5px] text-ink-3 lg:text-[13px]">{conv.meta}</span>
      </span>
    </>
  );

  return (
    <section aria-label={`Conversation: ${conv.title}`} className="fixed inset-0 z-50 flex flex-col bg-stone lg:static lg:z-auto lg:min-h-0 lg:flex-1 lg:overflow-hidden lg:rounded-[28px] lg:bg-surface">
      <header className="flex shrink-0 items-center gap-2.5 px-3.5 pt-[50px] pb-3.5 lg:gap-3 lg:border-b lg:border-line lg:px-[22px] lg:py-[18px]">
        <button type="button" aria-label="Back to inbox" onClick={onBack} className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-surface text-ink lg:hidden">
          <ArrowLeft className="size-[18px]" aria-hidden="true" />
        </button>
        {conv.href ? (
          <Link href={conv.href} className="flex min-w-0 flex-1 items-center gap-2.5 text-ink no-underline lg:gap-3">
            {header}
          </Link>
        ) : (
          <span className="flex min-w-0 flex-1 items-center gap-2.5 lg:gap-3">{header}</span>
        )}
      </header>

      {shownPin && (
        <button
          type="button"
          onClick={() => {
            jumpTo(shownPin.id);
            setPinIndex((i) => i + 1);
          }}
          className="mx-2.5 flex shrink-0 cursor-pointer items-center gap-2.5 rounded-t-[18px] border-0 border-b border-line bg-surface px-4 py-2.5 text-left font-ui text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink lg:m-0 lg:rounded-none lg:px-[22px]"
        >
          <Pin className="size-4 shrink-0 text-ink-2" aria-hidden="true" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">
              Pinned{pinned.length > 1 ? ` · ${(pinIndex % pinned.length) + 1} of ${pinned.length}` : ''}
            </span>
            <span className="truncate text-sm">{plainText(shownPin.content)}</span>
          </span>
        </button>
      )}

      <div className={cn('mx-2.5 flex flex-1 flex-col gap-3.5 overflow-y-auto bg-surface px-3 py-[18px] lg:m-0 lg:rounded-none lg:px-[22px] lg:py-6', !shownPin && 'rounded-t-[30px]')}>
        {messages.isLoading && <p className="m-auto text-sm text-ink-3">Loading…</p>}
        {!messages.isLoading && list.length === 0 && <p className="m-auto text-sm text-ink-3">No messages yet. Say hello.</p>}
        <MessageList messages={list} meId={user.id} onAct={setActing} onJump={jumpTo} />
        <div ref={end} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="mx-2.5 flex shrink-0 flex-col gap-2 border-t border-line bg-surface px-2.5 pt-2.5 pb-[max(30px,env(safe-area-inset-bottom))] lg:m-0 lg:px-[18px] lg:py-4"
      >
        {replyTo && (
          <div className="flex items-start gap-2 rounded-2xl border-l-4 border-yellow bg-stone py-2 pr-2 pl-3">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[12.5px] font-bold">Replying to {replyTo.name}</span>
              <span className="truncate text-[13px] text-ink-2">{plainText(replyTo.content)}</span>
            </span>
            <button type="button" aria-label="Cancel reply" onClick={() => setReplyTo(null)} className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-ink-2 outline-none hover:bg-surface focus-visible:ring-2 focus-visible:ring-ink">
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2 lg:gap-2.5">
          <label className="flex min-h-[46px] flex-1 items-center rounded-[23px] bg-stone px-4 py-2 focus-within:ring-2 focus-within:ring-ink lg:min-h-12 lg:px-[18px]">
            <textarea
              ref={box}
              rows={1}
              aria-label="Message"
              placeholder={`Message ${conv.square ? (conv.key === 'general' ? 'everyone' : conv.title) : conv.title.split(' ')[0]}`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                // Desktop: Enter sends, Shift+Enter adds a line. Phones: Enter adds a line.
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia('(pointer: fine)').matches) {
                  e.preventDefault();
                  submit();
                }
              }}
              className="max-h-32 min-w-0 flex-1 resize-none border-0 bg-transparent font-ui text-[15px] leading-normal text-ink outline-none [field-sizing:content]"
            />
          </label>
          <button type="submit" aria-label="Send" disabled={!text.trim() || send.isPending} className="flex size-[46px] shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-yellow text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink disabled:opacity-50 lg:size-12">
            <SendHorizontal className="size-[18px]" aria-hidden="true" />
          </button>
        </div>
      </form>

      {/* Message actions */}
      <Sheet open={!!acting} onOpenChange={(o) => !o && setActing(null)}>
        {acting && (
          <>
            <SheetTitle>{senderName(acting)}</SheetTitle>
            <SheetDescription className="line-clamp-2">{plainText(acting.content)}</SheetDescription>
            <div className="flex flex-col">
              {[
                { label: 'Reply', icon: Reply, run: () => startReply(acting) },
                { label: 'Copy', icon: Copy, run: () => copy(acting) },
                { label: 'Forward', icon: Forward, run: () => setForwarding(acting) },
                ...(canPin ? [{ label: acting.is_pinned ? 'Unpin' : 'Pin', icon: acting.is_pinned ? PinOff : Pin, run: () => pin.mutate(acting) }] : []),
                ...(canDelete(acting) ? [{ label: 'Delete', icon: Trash2, run: () => setDeleting(acting), danger: true }] : []),
              ].map((a) => (
                <button
                  key={a.label}
                  type="button"
                  onClick={() => {
                    setActing(null);
                    a.run();
                  }}
                  className={cn(
                    'flex h-[52px] cursor-pointer items-center gap-3.5 rounded-2xl border-0 bg-transparent px-3 text-left font-ui text-[15.5px] font-semibold outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ink',
                    'danger' in a && a.danger ? 'text-missed' : 'text-ink',
                  )}
                >
                  <a.icon className="size-[18px]" aria-hidden="true" />
                  {a.label}
                </button>
              ))}
            </div>
          </>
        )}
      </Sheet>

      <ForwardSheet
        message={forwarding}
        user={user}
        onClose={() => setForwarding(null)}
      />

      <Sheet open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        {deleting && (
          <>
            <SheetTitle>Delete this message?</SheetTitle>
            <SheetDescription>It’s removed for everyone in this chat.</SheetDescription>
            <SheetActions confirmLabel={remove.isPending ? 'Deleting…' : 'Delete'} confirmDisabled={remove.isPending} onConfirm={() => remove.mutate(deleting)} />
          </>
        )}
      </Sheet>
    </section>
  );
}

/** Pick a chat to forward a message to. */
function ForwardSheet({ message, user, onClose }: { message: ChatMessage | null; user: User; onClose: () => void }) {
  const qc = useQueryClient();
  const { sections } = useConversations(user);
  const [q, setQ] = useState('');
  const forward = useMutation({
    mutationFn: (to: Conv) => inboxApi.send(to.key, forwardContent(message!.content)),
    onSuccess: (_, to) => {
      qc.invalidateQueries({ queryKey: ['conversation', to.key] });
      qc.invalidateQueries({ queryKey: ['inbox'] });
      toast.success(`Forwarded to ${to.title}`);
      onClose();
    },
    onError: (err) => toast.error(errorText(err, 'Could not forward the message.')),
  });
  const term = q.trim().toLowerCase();
  const all = sections.flatMap((s) => s.items).filter((c) => !term || c.title.toLowerCase().includes(term));
  return (
    <Sheet open={!!message} onOpenChange={(o) => !o && onClose()}>
      {message && (
        <>
          <SheetTitle>Forward to…</SheetTitle>
          <label className="flex h-12 items-center gap-2 rounded-full bg-stone px-[18px] text-ink-3 focus-within:ring-2 focus-within:ring-ink">
            <Search className="size-4 shrink-0" aria-hidden="true" />
            <input type="search" aria-label="Search chats" placeholder="Search chats" value={q} onChange={(e) => setQ(e.target.value)} className="min-w-0 flex-1 border-0 bg-transparent font-ui text-[15px] text-ink outline-none" />
          </label>
          <ul className="m-0 flex max-h-[50vh] list-none flex-col overflow-y-auto p-0">
            {all.map((c) => (
              <li key={c.key}>
                <button
                  type="button"
                  disabled={forward.isPending}
                  onClick={() => forward.mutate(c)}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border-0 bg-transparent px-2 py-2 text-left font-ui text-ink outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ink disabled:opacity-50"
                >
                  <span className={cn('flex size-9 shrink-0 items-center justify-center text-xs font-bold', c.square ? 'rounded-xl' : 'rounded-full', c.tone)}>{c.ini}</span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[15px] font-semibold">{c.title}</span>
                    <span className="truncate text-[12.5px] text-ink-3">{c.meta}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Sheet>
  );
}

function dayLabel(d: Date) {
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'EEEE, MMM d');
}

/** The text inside a bubble: forwarded label, quoted reply, then the message. */
export function MessageText({ content, mine, onQuote }: { content: string; mine: boolean; onQuote?: () => void }) {
  const m = parseMessage(content);
  return (
    <>
      {m.forwarded && (
        <span className={cn('mb-1 flex items-center gap-1 text-[12px] italic', mine ? 'text-on-dark' : 'text-ink-3')}>
          <Forward className="size-3" aria-hidden="true" />
          Forwarded
        </span>
      )}
      {m.reply && (
        <span
          role={onQuote ? 'button' : undefined}
          onClick={onQuote}
          className={cn('mb-1.5 flex flex-col rounded-xl border-l-4 border-yellow px-2.5 py-1.5', mine ? 'bg-dark-2' : 'bg-surface', onQuote && 'cursor-pointer')}
        >
          <span className="text-[12.5px] font-bold">{m.reply.name}</span>
          <span className={cn('line-clamp-3 text-[13px]', mine ? 'text-on-dark' : 'text-ink-2')}>{m.reply.text}</span>
        </span>
      )}
      {m.body}
    </>
  );
}

/** Long-press (phones) or the ⋯ button (desktop) opens a message's actions. */
function useLongPress(onLong: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  return {
    onTouchStart: () => {
      clear();
      timer.current = setTimeout(onLong, 450);
    },
    onTouchEnd: clear,
    onTouchMove: clear,
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      onLong();
    },
  };
}

function Bubble({ m, mine, onAct, onJump, list }: { m: ChatMessage; mine: boolean; onAct: (m: ChatMessage) => void; onJump: (id: number) => void; list: ChatMessage[] }) {
  const press = useLongPress(() => onAct(m));
  // A quoted reply jumps to the newest earlier message from that person that starts with the quote.
  const parsed = parseMessage(m.content);
  const quoted = parsed.reply
    ? [...list]
        .reverse()
        .find((x) => x.id < m.id && plainText(x.content).startsWith(parsed.reply!.text.split('\n')[0]))
    : undefined;
  return (
    <div className={cn('group flex items-center gap-1', mine && 'flex-row-reverse')}>
      <span
        id={`msg-${m.id}`}
        {...press}
        className={cn(
          'px-[15px] py-[11px] text-[15px] leading-normal transition-shadow select-text [overflow-wrap:anywhere] whitespace-pre-wrap [-webkit-touch-callout:none]',
          mine ? 'rounded-[20px_6px_20px_20px] bg-ink text-white' : 'rounded-[6px_20px_20px_20px] bg-bubble text-ink',
        )}
      >
        {m.is_pinned && <Pin className={cn('mr-1 mb-0.5 inline size-3', mine ? 'text-yellow' : 'text-ink-3')} aria-label="Pinned" />}
        <MessageText content={m.content} mine={mine} onQuote={quoted ? () => onJump(quoted.id) : undefined} />
      </span>
      <button
        type="button"
        aria-label="Message actions"
        onClick={() => onAct(m)}
        className="hidden size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-ink-3 opacity-0 outline-none group-hover:opacity-100 hover:bg-stone focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ink lg:flex"
      >
        <MoreHorizontal className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function MessageList({ messages, meId, onAct, onJump }: { messages: ChatMessage[]; meId: number; onAct: (m: ChatMessage) => void; onJump: (id: number) => void }) {
  const days = messages.map((m) => dayLabel(new Date(m.created_at)));
  const senders: number[] = [];
  return (
    <>
      {messages.map((m, i) => {
        const sid = m.sender?.id ?? m.sender_id ?? 0;
        if (!senders.includes(sid)) senders.push(sid);
        const mine = sid === meId;
        const who = mine ? 'You' : fullName(m.sender ?? {}) || 'Someone';
        // Consecutive messages from one person share one name line and avatar.
        const sameAsPrev = i > 0 && (messages[i - 1].sender?.id ?? messages[i - 1].sender_id) === sid && days[i - 1] === days[i];
        const tone = mine ? 'bg-ink text-yellow' : TONES[senders.indexOf(sid) % TONES.length];
        return (
          <div key={m.id} className="flex flex-col gap-3.5">
            {days[i] !== days[i - 1] && <p className="m-0 self-center text-[12.5px] font-semibold text-ink-3">{days[i]}</p>}
            <div className={cn('flex items-end gap-2 lg:gap-2.5', mine && 'flex-row-reverse', sameAsPrev && '-mt-2.5')}>
              <span className={cn('flex size-[30px] shrink-0 items-center justify-center rounded-full text-[10.5px] font-bold lg:size-8 lg:text-[11.5px]', tone, sameAsPrev && 'invisible')}>{initials(fullName(m.sender ?? {}) || who)}</span>
              <div className={cn('flex max-w-[80%] flex-col gap-1 lg:max-w-[70%]', mine ? 'items-end' : 'items-start')}>
                {!sameAsPrev && (
                  <span className="px-1 text-[12.5px] font-semibold text-ink-2">
                    {who} <span className="font-normal text-ink-3">{format(new Date(m.created_at), 'h:mm a')}</span>
                  </span>
                )}
                <Bubble m={m} mine={mine} onAct={onAct} onJump={onJump} list={messages} />
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
