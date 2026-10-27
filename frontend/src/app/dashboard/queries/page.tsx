'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/providers/AuthProvider';
import { queriesApi } from '@/lib/api';
import type { StaffQuery } from '@/types';
import { cn } from '@/lib/utils';
import { errorText } from '@/lib/tasks';
import { Button, SegmentedFilter, Sheet, SheetActions, SheetDescription, SheetTitle, StatusPill, type StatusTone } from '@/components/wc';
import { PageBody } from '@/components/shell/PageHeader';
import { Empty, Note, ScreenHeader, area } from '@/components/requests/parts';

// Queries and penalties. Everyone can see every query (decided 2026-10-27);
// the person a query is issued to acknowledges or contests it. Operations
// Managers and Team Leads issue queries from the People hub.

const STATUS: Record<StaffQuery['status'], { label: string; tone: StatusTone }> = {
  pending: { label: 'Waiting for reply', tone: 'pending' },
  acknowledged: { label: 'Acknowledged', tone: 'done' },
  contested: { label: 'Contested', tone: 'missed' },
};
const name = (u?: { first_name: string; last_name: string } | null) => (u ? `${u.first_name} ${u.last_name}`.trim() : 'someone');

export default function QueriesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const issuer = user?.role === 'operations_manager' || user?.role === 'team_lead';
  useEffect(() => {
    if (issuer) router.replace('/dashboard/people?tab=queries');
  }, [issuer, router]);

  const qc = useQueryClient();
  const [view, setView] = useState<'mine' | 'all'>('mine');
  const [contesting, setContesting] = useState<StaffQuery | null>(null);
  const [reason, setReason] = useState('');
  const { data: queries = [], isLoading } = useQuery<StaffQuery[]>({ queryKey: ['queries'], queryFn: () => queriesApi.list().then((r) => r.data), enabled: !!user && !issuer });

  const respond = useMutation({
    mutationFn: ({ id, status, response }: { id: number; status: 'acknowledged' | 'contested'; response?: string }) => queriesApi.respond(id, status, response),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['queries'] });
      toast.success(v.status === 'acknowledged' ? 'Query acknowledged' : 'Query contested');
      setContesting(null);
      setReason('');
    },
    onError: (err) => toast.error(errorText(err, 'Could not send your reply.')),
  });

  if (!user || issuer) return null;
  const mine = queries.filter((q) => q.assigned_to === user.id);
  const waiting = mine.filter((q) => q.status === 'pending').length;
  const shown = view === 'mine' ? mine : queries;

  return (
    <PageBody className="gap-3.5 lg:gap-5">
      <ScreenHeader title="Queries" description="Queries and penalties issued across the team" />

      {waiting > 0 && (
        <section aria-label="Waiting for your reply" className="flex items-center gap-4 rounded-[26px] bg-ink p-5 text-white lg:p-6">
          <span className="font-display text-[40px] leading-none font-bold text-yellow">{waiting}</span>
          <span className="flex flex-col gap-0.5">
            <span className="text-[15px] font-semibold">{waiting === 1 ? 'Query waiting for your reply' : 'Queries waiting for your reply'}</span>
            <span className="text-[13px] text-on-dark-2">Acknowledge it, or contest it with a reason.</span>
          </span>
        </section>
      )}

      <div className="self-start rounded-full bg-surface p-1">
        <SegmentedFilter
          variant="inline"
          label="Which queries"
          value={view}
          onChange={setView}
          className="flex-nowrap"
          items={[
            { value: 'mine', label: 'Issued to you', count: mine.length },
            { value: 'all', label: 'Everyone', count: queries.length },
          ]}
        />
      </div>

      <section aria-label="Queries" className="flex flex-col gap-2.5 lg:gap-3">
        {isLoading && <p className="m-0 text-sm text-ink-3">Loading…</p>}
        {!isLoading && shown.length === 0 && (
          <Empty icon={<ShieldAlert />} title="No queries" text={view === 'mine' ? 'Nothing has been issued to you.' : 'No queries have been issued yet.'} />
        )}
        {shown.map((q) => {
          const s = STATUS[q.status] ?? STATUS.pending;
          const toMe = q.assigned_to === user.id;
          return (
            <article key={q.id} className={cn('flex flex-col gap-3 rounded-[24px] bg-surface p-[18px] lg:rounded-[26px] lg:p-6', toMe && q.status === 'pending' && 'ring-2 ring-yellow')}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-1">
                  <h2 className="m-0 text-[17px] font-bold lg:text-lg">{q.subject}</h2>
                  <p className="m-0 text-[13px] text-ink-3">
                    {name(q.submitter)} → {toMe ? 'you' : name(q.assignee)} · {formatDistanceToNow(new Date(q.created_at), { addSuffix: true })}
                  </p>
                </div>
                <StatusPill tone={s.tone} size="md">
                  {s.label}
                </StatusPill>
              </div>
              <p className="m-0 text-sm leading-normal whitespace-pre-wrap text-ink-2">{q.message}</p>
              {q.response && (
                <Note label={q.status === 'acknowledged' ? 'Comment' : 'Reason for contesting'} tone={q.status === 'acknowledged' ? 'done' : 'missed'}>
                  {q.response}
                  {q.responded_at && <span className="mt-1 block text-xs opacity-80">{format(new Date(q.responded_at), "MMM d, yyyy 'at' h:mm a")}</span>}
                </Note>
              )}
              {toMe && q.status === 'pending' && (
                <div className="grid grid-cols-2 gap-2 lg:flex">
                  <Button variant="danger" disabled={respond.isPending} onClick={() => setContesting(q)}>
                    Contest
                  </Button>
                  <Button disabled={respond.isPending} onClick={() => respond.mutate({ id: q.id, status: 'acknowledged' })}>
                    Acknowledge
                  </Button>
                </div>
              )}
            </article>
          );
        })}
      </section>

      <Sheet open={!!contesting} onOpenChange={(o) => !o && setContesting(null)}>
        {contesting && (
          <>
            <SheetTitle>Contest this query</SheetTitle>
            <SheetDescription>{contesting.subject}</SheetDescription>
            <textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explain why you believe this query is unwarranted" className={area} />
            <SheetActions
              confirmLabel={respond.isPending ? 'Sending…' : 'Contest query'}
              confirmDisabled={!reason.trim() || respond.isPending}
              onConfirm={() => respond.mutate({ id: contesting.id, status: 'contested', response: reason.trim() })}
            />
          </>
        )}
      </Sheet>
    </PageBody>
  );
}
