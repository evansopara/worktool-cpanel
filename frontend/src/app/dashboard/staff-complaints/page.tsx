'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { MessageSquareWarning } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/providers/AuthProvider';
import { staffComplaintsApi } from '@/lib/api';
import type { StaffComplaint } from '@/types';
import { cn } from '@/lib/utils';
import { errorText } from '@/lib/tasks';
import { Button, StatusPill, type StatusTone } from '@/components/wc';
import { PageBody } from '@/components/shell/PageHeader';
import { Empty, Field, Note, ScreenHeader, area, card, cardTitle, field } from '@/components/requests/parts';

// Send a complaint (staff, interns, Project Managers, Customer Support
// Officers). Operations Managers and Team Leads handle complaints in the
// People hub, so they're sent there.

const STATUS: Record<StaffComplaint['status'], { label: string; tone: StatusTone }> = {
  pending: { label: 'Pending', tone: 'pending' },
  reviewed: { label: 'Reviewed', tone: 'review' },
  resolved: { label: 'Resolved', tone: 'done' },
};

export default function StaffComplaintsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const reviewer = user?.role === 'operations_manager' || user?.role === 'team_lead';
  useEffect(() => {
    if (reviewer) router.replace('/dashboard/people?tab=complaints');
  }, [reviewer, router]);

  const qc = useQueryClient();
  const [form, setForm] = useState(() => ({
    name: `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim(),
    email: user?.email ?? '',
    department: user?.department ?? '',
    detailed_explanation: '',
  }));
  const { data: complaints = [], isLoading } = useQuery<StaffComplaint[]>({
    queryKey: ['staff-complaints'],
    queryFn: () => staffComplaintsApi.list().then((r) => r.data),
    enabled: !!user && !reviewer,
  });

  const create = useMutation({
    mutationFn: () => staffComplaintsApi.create(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff-complaints'] });
      toast.success('Complaint sent');
      setForm((f) => ({ ...f, detailed_explanation: '' }));
    },
    onError: (err) => toast.error(errorText(err, 'Could not send the complaint.')),
  });

  if (!user || reviewer) return null;
  const ready = form.name.trim() && form.email.trim() && form.detailed_explanation.trim() && !create.isPending;

  return (
    <PageBody className="gap-3.5 lg:gap-5">
      <ScreenHeader title="Complaints" description="Raise a workplace concern for management to look into" />

      <div className="flex flex-col gap-3.5 lg:flex-row lg:items-start lg:gap-5">
        <section aria-labelledby="h-send" className={cn(card, 'lg:flex-1')}>
          <div className="flex flex-col gap-1">
            <h2 id="h-send" className={cardTitle}>
              Send a complaint
            </h2>
            <p className="m-0 text-sm text-ink-3">Give as much detail as you can so it can be looked into properly.</p>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Field label="Name">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={field} />
            </Field>
            <Field label="Email">
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={field} />
            </Field>
          </div>
          <Field label="Department">
            <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className={field} />
          </Field>
          <Field label="What happened">
            <textarea rows={5} placeholder="Describe the issue in detail" value={form.detailed_explanation} onChange={(e) => setForm({ ...form, detailed_explanation: e.target.value })} className={area} />
          </Field>
          <Button className="self-stretch lg:self-start" disabled={!ready} onClick={() => create.mutate()}>
            {create.isPending ? 'Sending…' : 'Send complaint'}
          </Button>
        </section>

        <section aria-labelledby="h-mine" className={cn(card, 'lg:flex-1')}>
          <h2 id="h-mine" className={cardTitle}>
            Your complaints
          </h2>
          {isLoading && <p className="m-0 text-sm text-ink-3">Loading…</p>}
          {!isLoading && complaints.length === 0 && <Empty icon={<MessageSquareWarning />} title="Nothing sent yet" text="Complaints you send show up here with their status and any reply." />}
          {complaints.map((c) => {
            const s = STATUS[c.status] ?? STATUS.pending;
            return (
              <article key={c.id} className="flex flex-col gap-2 border-t border-line pt-3.5 first-of-type:border-t-0 first-of-type:pt-0">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[15px] font-bold">Complaint #{c.id}</span>
                    <span className="text-[12.5px] text-ink-3">Sent {format(new Date(c.created_at), "MMM d, yyyy 'at' h:mm a")}</span>
                  </span>
                  <StatusPill tone={s.tone} size="md">
                    {s.label}
                  </StatusPill>
                </div>
                <p className="m-0 text-sm leading-normal whitespace-pre-wrap text-ink-2">{c.detailed_explanation}</p>
                {c.review_comments && (
                  <Note label="Reply" tone="review">
                    {c.review_comments}
                  </Note>
                )}
              </article>
            );
          })}
        </section>
      </div>
    </PageBody>
  );
}
