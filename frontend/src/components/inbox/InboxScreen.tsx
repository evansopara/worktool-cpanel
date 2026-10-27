'use client';

import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Plus, Search } from 'lucide-react';
import type { User } from '@/types';
import { cn } from '@/lib/utils';
import { Sheet, SheetTitle } from '@/components/wc';
import { MEMO_COMPOSERS, parseConv, type ConvKey } from '@/lib/inbox';
import { Conversation, ConversationList, useConversations, type Conv } from './Chats';
import { MemosTab, NewMemoSheet } from './Memos';

/**
 * Inbox (Inbox / MInbox / MChat artboards). Tab and open conversation are
 * in the URL: ?tab=memos, ?c=general | p12 | u5. Needs a <Suspense> parent.
 */
export function InboxScreen({ user }: { user: User }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  // Customer Support Officers had no Memos page before; they still don't.
  const hasMemos = user.role !== 'customer_support_officer';
  const tab = hasMemos && params.get('tab') === 'memos' ? 'memos' : 'chats';
  const picked = parseConv(params.get('c'));
  const convs = useConversations(user);
  const [composing, setComposing] = useState<'chat' | 'memo' | null>(null);

  const go = (next: { tab?: 'chats' | 'memos'; c?: ConvKey | null }) => {
    const q = new URLSearchParams();
    const t = next.tab ?? tab;
    if (t === 'memos') q.set('tab', 'memos');
    const c = next.c === undefined ? picked : next.c;
    if (t === 'chats' && c) q.set('c', c);
    router.replace(q.size ? `${pathname}?${q}` : pathname, { scroll: false });
  };

  // Desktop shows a conversation even before one is picked; phones show the list.
  const current: Conv | undefined = (picked && convs.byKey.get(picked)) || undefined;
  const desktopConv = current ?? convs.byKey.get('general');
  const canWriteMemo = MEMO_COMPOSERS.includes(user.role);
  const newLabel = tab === 'memos' ? 'New memo' : 'New message';
  const showNew = tab === 'chats' || canWriteMemo;

  const tabs = (
    <div role="tablist" aria-label="Inbox sections" className="flex gap-0.5 rounded-full bg-surface p-[5px]">
      {(hasMemos ? (['chats', 'memos'] as const) : (['chats'] as const)).map((t) => (
        <button
          key={t}
          type="button"
          role="tab"
          aria-selected={tab === t}
          onClick={() => go({ tab: t, c: null })}
          className={cn('h-10 flex-1 cursor-pointer rounded-full border-0 px-5 font-ui text-sm font-semibold capitalize outline-none focus-visible:ring-2 focus-visible:ring-ink', tab === t ? 'bg-ink text-white' : 'bg-transparent text-ink-2')}
        >
          {t}
        </button>
      ))}
    </div>
  );

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-3.5 px-[18px] pt-14 pb-6 lg:h-full lg:gap-[18px] lg:px-10 lg:pt-5 lg:pb-12">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="m-0 font-display text-[40px] leading-none font-bold tracking-[-0.04em] lg:text-5xl">Inbox</h1>
        <div className="hidden flex-wrap gap-2.5 lg:flex">
          {tabs}
          {showNew && (
            <button type="button" onClick={() => setComposing(tab === 'memos' ? 'memo' : 'chat')} className="inline-flex h-[50px] cursor-pointer items-center gap-2 rounded-full border-0 bg-yellow px-[22px] font-ui text-[15px] font-bold text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2">
              <Plus className="size-[18px]" strokeWidth={2.4} aria-hidden="true" />
              {newLabel}
            </button>
          )}
        </div>
        {showNew && (
          <button type="button" aria-label={newLabel} onClick={() => setComposing(tab === 'memos' ? 'memo' : 'chat')} className="flex size-12 cursor-pointer items-center justify-center rounded-full border-0 bg-yellow text-ink lg:hidden">
            <Plus className="size-5" strokeWidth={2.4} aria-hidden="true" />
          </button>
        )}
      </header>
      <div className="lg:hidden">{tabs}</div>

      {tab === 'chats' ? (
        <>
          {/* Desktop: list beside the conversation */}
          <div className="hidden min-h-[640px] flex-1 gap-4 lg:flex lg:h-[calc(100dvh-160px)]">
            <aside aria-label="Conversations" className="flex w-[320px] shrink-0 flex-col">
              <ConversationList sections={convs.sections} current={desktopConv?.key ?? null} onPick={(c) => go({ c })} />
            </aside>
            {desktopConv && <Conversation key={desktopConv.key} conv={desktopConv} user={user} onBack={() => go({ c: null })} />}
          </div>
          {/* Phone: the list; a picked conversation opens full screen */}
          <div className="lg:hidden">
            <ConversationList sections={convs.sections} current={null} onPick={(c) => go({ c })} mobile />
            {current && <Conversation key={current.key} conv={current} user={user} onBack={() => go({ c: null })} />}
          </div>
        </>
      ) : (
        <MemosTab user={user} />
      )}

      <NewMemoSheet open={composing === 'memo'} onClose={() => setComposing(null)} />
      <NewChatSheet
        open={composing === 'chat'}
        people={convs.sections[2].items}
        onPick={(c) => {
          setComposing(null);
          go({ c });
        }}
        onClose={() => setComposing(null)}
      />
    </div>
  );
}

function NewChatSheet({ open, people, onPick, onClose }: { open: boolean; people: Conv[]; onPick: (c: ConvKey) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetTitle>New message</SheetTitle>
      <label className="flex h-12 shrink-0 items-center gap-2 rounded-full bg-surface-2 px-[18px] text-ink-3 focus-within:ring-2 focus-within:ring-ink">
        <Search className="size-4" aria-hidden="true" />
        <input autoFocus type="search" aria-label="Search people" placeholder="Search people" value={q} onChange={(e) => setQ(e.target.value)} className="min-w-0 flex-1 border-0 bg-transparent font-ui text-[15px] text-ink outline-none" />
      </label>
      <div className="flex max-h-[50vh] flex-col overflow-y-auto">
        {people
          .filter((p) => !term || p.title.toLowerCase().includes(term))
          .map((p) => (
            <button key={p.key} type="button" onClick={() => onPick(p.key)} className="flex cursor-pointer items-center gap-3 rounded-2xl border-0 bg-transparent px-2 py-2 text-left font-ui text-ink outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ink">
              <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-full text-[13px] font-bold', p.tone)}>{p.ini}</span>
              <span className="flex flex-col">
                <span className="text-[15px] font-bold">{p.title}</span>
                <span className="text-[12.5px] text-ink-3">{p.meta}</span>
              </span>
            </button>
          ))}
      </div>
    </Sheet>
  );
}
