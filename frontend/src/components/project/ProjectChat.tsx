'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { SendHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { initials } from '@/components/wc';
import { errorText } from '@/lib/tasks';
import { projectApi, type ChatMessage } from '@/lib/projects';

// Project team chat: the preview on Overview (last few messages) and the
// full Team chat tab. No live updates on this server, so it polls.

export function useProjectChat(projectId: number) {
  const qc = useQueryClient();
  const messages = useQuery({ queryKey: ['project-messages', projectId], queryFn: () => projectApi.messages(projectId), refetchInterval: 15_000 });
  const send = useMutation({
    mutationFn: (content: string) => projectApi.send(projectId, content),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-messages', projectId] }),
    onError: (err) => toast.error(errorText(err, 'Message not sent.')),
  });
  return { messages: messages.data ?? [], loading: messages.isLoading, send };
}

function senderName(m: ChatMessage) {
  return `${m.sender?.first_name ?? ''} ${m.sender?.last_name ?? ''}`.trim() || 'Someone';
}

/** Senders alternate between the two avatar tones, by order of first appearance. */
function toneFor(messages: ChatMessage[]) {
  const order: number[] = [];
  for (const m of messages) {
    const id = m.sender?.id ?? m.sender_id ?? 0;
    if (!order.includes(id)) order.push(id);
  }
  return (m: ChatMessage) => (order.indexOf(m.sender?.id ?? m.sender_id ?? 0) % 2 === 0 ? 'bg-yellow text-ink' : 'bg-ink text-yellow');
}

export function ChatMessages({ messages, meId, compact }: { messages: ChatMessage[]; meId: number; compact?: boolean }) {
  const tone = toneFor(messages);
  return (
    <>
      {messages.map((m) => {
        const mine = (m.sender?.id ?? m.sender_id) === meId;
        return (
          <div key={m.id} className={cn('flex gap-2.5', !compact && mine && 'flex-row-reverse')}>
            <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full text-[11.5px] font-bold', tone(m))}>{initials(senderName(m))}</span>
            <div className={cn('flex min-w-0 flex-col gap-1', !compact && mine && 'items-end')}>
              <span className="text-[13px] font-bold">
                {!compact && mine ? 'You' : senderName(m)} <span className="font-normal text-ink-3">{format(new Date(m.created_at), 'h:mm a')}</span>
              </span>
              <span
                className={cn(
                  'px-[13px] py-[9px] text-sm leading-[1.45] [overflow-wrap:anywhere] whitespace-pre-wrap',
                  !compact && mine ? 'rounded-[16px_4px_16px_16px] bg-yellow' : 'rounded-[4px_16px_16px_16px] bg-surface-2',
                )}
              >
                {m.content}
              </span>
            </div>
          </div>
        );
      })}
    </>
  );
}

export function ChatInput({ onSend, busy }: { onSend: (text: string) => void; busy: boolean }) {
  const [text, setText] = useState('');
  const submit = () => {
    if (!text.trim() || busy) return;
    onSend(text.trim());
    setText('');
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex h-12 items-center gap-2 rounded-full bg-stone pr-1.5 pl-[18px] focus-within:ring-2 focus-within:ring-ink"
    >
      <input
        type="text"
        aria-label="Message the team"
        placeholder="Message the team"
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="min-w-0 flex-1 border-0 bg-transparent font-ui text-[14.5px] text-ink outline-none"
      />
      <button type="submit" aria-label="Send" disabled={!text.trim() || busy} className="flex size-[38px] shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-ink text-yellow outline-none focus-visible:ring-2 focus-visible:ring-yellow disabled:opacity-40">
        <SendHorizontal className="size-4" aria-hidden="true" />
      </button>
    </form>
  );
}

/** The full Team chat tab. */
export function ProjectChatPanel({ projectId, meId, members }: { projectId: number; meId: number; members: number }) {
  const { messages, loading, send } = useProjectChat(projectId);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  return (
    <section aria-label="Team chat" className="flex flex-col gap-4 rounded-[28px] bg-surface p-5 lg:p-6">
      <div className="flex flex-col gap-0.5">
        <h2 className="m-0 font-display text-[22px] font-bold">Team chat</h2>
        <span className="text-[13px] text-ink-3">
          {members} member{members === 1 ? '' : 's'} · internal only
        </span>
      </div>
      <div className="flex max-h-[60vh] min-h-[240px] flex-col gap-4 overflow-y-auto pr-1">
        {loading && <p className="m-0 text-sm text-ink-3">Loading messages…</p>}
        {!loading && messages.length === 0 && <p className="m-auto text-sm text-ink-3">No messages yet. Start the conversation.</p>}
        <ChatMessages messages={messages} meId={meId} />
        <div ref={end} />
      </div>
      <ChatInput onSend={(t) => send.mutate(t)} busy={send.isPending} />
    </section>
  );
}

export function ProgressRing({ value, size }: { value: number; size: 'lg' | 'sm' }) {
  const pct = Math.max(0, Math.min(100, value));
  const box = size === 'lg' ? 168 : 84;
  const stroke = size === 'lg' ? 16 : 9;
  const r = (box - stroke) / 2 - (size === 'lg' ? 0 : 0.5);
  const c = 2 * Math.PI * r;
  return (
    <div role="img" aria-label={`${pct}% complete`} className="relative shrink-0" style={{ width: box, height: box }}>
      <svg width={box} height={box} viewBox={`0 0 ${box} ${box}`} aria-hidden="true">
        <circle cx={box / 2} cy={box / 2} r={r} fill="none" className="stroke-dark-2" strokeWidth={stroke} />
        {pct > 0 && (
          <circle
            cx={box / 2}
            cy={box / 2}
            r={r}
            fill="none"
            className="stroke-yellow"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${(c * pct) / 100} ${c}`}
            transform={`rotate(-90 ${box / 2} ${box / 2})`}
          />
        )}
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('font-display font-bold tracking-[-0.03em]', size === 'lg' ? 'text-[40px]' : 'text-[19px]')}>{pct}%</span>
        {size === 'lg' && <span className="text-[12.5px] text-on-dark">complete</span>}
      </span>
    </div>
  );
}
