'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { LifeBuoy, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/providers/AuthProvider';
import { supportApi } from '@/lib/api';
import type { TechnicalSupportRequest } from '@/types';
import { cn } from '@/lib/utils';
import { errorText, MANAGER_ROLES } from '@/lib/tasks';
import { Button, SegmentedFilter, Sheet, SheetActions, SheetDescription, SheetTitle, StatusPill, type StatusTone } from '@/components/wc';
import { PageBody } from '@/components/shell/PageHeader';
import { Empty, Field, Note, ScreenHeader, area, field } from '@/components/requests/parts';

// Technical support. Anyone can ask for help; technical support staff and
// managers work the queue (the API decides who sees what).

type Status = TechnicalSupportRequest['status'];
const STATUS: Record<Status, { label: string; tone: StatusTone }> = {
  open: { label: 'Open', tone: 'pending' },
  in_progress: { label: 'In progress', tone: 'review' },
  resolved: { label: 'Resolved', tone: 'done' },
  closed: { label: 'Closed', tone: 'todo' },
};
const PRIORITY: Record<string, string> = { low: 'text-ink-3', medium: 'text-ink-2', high: 'text-pending', urgent: 'text-missed' };
const EMPTY = { title: '', description: '', priority: 'medium' };

export default function SupportPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const manages = !!user && (MANAGER_ROLES.includes(user.role) || (user.role === 'staff' && user.specialization === 'technical_support'));
  const [filter, setFilter] = useState<'active' | 'done' | 'all'>('active');
  const [asking, setAsking] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [working, setWorking] = useState<{ req: TechnicalSupportRequest; status: Status; resolution: string } | null>(null);

  const { data: requests = [], isLoading } = useQuery<TechnicalSupportRequest[]>({ queryKey: ['support'], queryFn: () => supportApi.list().then((r) => r.data) });
  const create = useMutation({
    mutationFn: () => supportApi.create(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support'] });
      toast.success('Request sent to technical support');
      setAsking(false);
      setForm(EMPTY);
    },
    onError: (err) => toast.error(errorText(err, 'Could not send the request.')),
  });
  const update = useMutation({
    mutationFn: () =>
      supportApi.update(working!.req.id, {
        status: working!.status,
        resolution: working!.resolution.trim() || null,
        resolved_at: working!.status === 'resolved' ? new Date().toISOString() : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support'] });
      toast.success('Request updated');
      setWorking(null);
    },
    onError: (err) => toast.error(errorText(err, 'Could not update the request.')),
  });

  const done = (r: TechnicalSupportRequest) => r.status === 'resolved' || r.status === 'closed';
  const shown = requests.filter((r) => filter === 'all' || (filter === 'done' ? done(r) : !done(r)));
  const openCount = requests.filter((r) => !done(r)).length;
  const title = manages ? 'Technical management' : 'Technical support';
  const askButton = (
    <Button variant="accent" onClick={() => setAsking(true)}>
      <Plus strokeWidth={2.4} aria-hidden="true" />
      Ask for help
    </Button>
  );

  return (
    <PageBody className="gap-3.5 lg:gap-5">
      <ScreenHeader
        title={title}
        description={manages ? 'Help requests from the team' : 'Get help with tools, access and equipment'}
        action={askButton}
        mobileAction={
          <button type="button" aria-label="Ask for help" onClick={() => setAsking(true)} className="flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-yellow text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink">
            <Plus className="size-5" strokeWidth={2.4} aria-hidden="true" />
          </button>
        }
      />

      <div className="self-start rounded-full bg-surface p-1">
        <SegmentedFilter
          variant="inline"
          label="Requests"
          value={filter}
          onChange={setFilter}
          className="flex-nowrap"
          items={[
            { value: 'active', label: 'Open', count: openCount },
            { value: 'done', label: 'Done' },
            { value: 'all', label: 'All' },
          ]}
        />
      </div>

      <section aria-label="Support requests" className="flex flex-col gap-2.5 lg:gap-3">
        {isLoading && <p className="m-0 text-sm text-ink-3">Loading…</p>}
        {!isLoading && shown.length === 0 && (
          <Empty icon={<LifeBuoy />} title={filter === 'active' ? 'Nothing open' : 'No requests'} text={manages ? 'New help requests from the team show up here.' : 'Ask for help and follow the request here.'} />
        )}
        {shown.map((r) => {
          const s = STATUS[r.status] ?? STATUS.open;
          return (
            <article key={r.id} className="flex flex-col gap-3 rounded-[24px] bg-surface p-[18px] lg:rounded-[26px] lg:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-1">
                  <h2 className="m-0 text-[17px] font-bold lg:text-lg">{r.title}</h2>
                  <p className="m-0 text-[13px] text-ink-3">
                    {manages && r.requester ? `${r.requester.first_name} ${r.requester.last_name} · ` : ''}
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                    {r.priority && (
                      <>
                        {' · '}
                        <span className={cn('font-semibold', PRIORITY[r.priority])}>{r.priority[0].toUpperCase() + r.priority.slice(1)} priority</span>
                      </>
                    )}
                  </p>
                </div>
                <StatusPill tone={s.tone} size="md">
                  {s.label}
                </StatusPill>
              </div>
              <p className="m-0 line-clamp-4 text-sm leading-normal whitespace-pre-wrap text-ink-2">{r.description}</p>
              {r.resolution && (
                <Note label="Resolution" tone="done">
                  {r.resolution}
                </Note>
              )}
              {manages && (
                <Button variant="secondary" size="md" className="self-start" onClick={() => setWorking({ req: r, status: r.status, resolution: r.resolution ?? '' })}>
                  Update
                </Button>
              )}
            </article>
          );
        })}
      </section>

      <Sheet open={asking} onOpenChange={(o) => !o && setAsking(false)}>
        <SheetTitle>Ask for help</SheetTitle>
        <SheetDescription>Technical support is notified straight away.</SheetDescription>
        <Field label="What do you need help with?">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={field} />
        </Field>
        <Field label="Details">
          <textarea rows={4} placeholder="What happened, and what have you tried?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={area} />
        </Field>
        <Field label="Priority">
          <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className={field}>
            {['low', 'medium', 'high', 'urgent'].map((p) => (
              <option key={p} value={p}>
                {p[0].toUpperCase() + p.slice(1)}
              </option>
            ))}
          </select>
        </Field>
        <SheetActions confirmLabel={create.isPending ? 'Sending…' : 'Send request'} confirmDisabled={!form.title.trim() || !form.description.trim() || create.isPending} onConfirm={() => create.mutate()} />
      </Sheet>

      <Sheet open={!!working} onOpenChange={(o) => !o && setWorking(null)}>
        {working && (
          <>
            <SheetTitle>{working.req.title}</SheetTitle>
            <Field label="Status">
              <select value={working.status} onChange={(e) => setWorking({ ...working, status: e.target.value as Status })} className={field}>
                {(Object.keys(STATUS) as Status[]).map((k) => (
                  <option key={k} value={k}>
                    {STATUS[k].label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Resolution" hint="Shown to the person who asked.">
              <textarea rows={3} value={working.resolution} onChange={(e) => setWorking({ ...working, resolution: e.target.value })} className={area} />
            </Field>
            <SheetActions confirmLabel={update.isPending ? 'Saving…' : 'Save'} confirmDisabled={update.isPending} onConfirm={() => update.mutate()} />
          </>
        )}
      </Sheet>
    </PageBody>
  );
}
