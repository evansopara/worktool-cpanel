'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, Button, Sheet, SheetActions, SheetDescription, SheetTitle, StatusPill } from '@/components/wc';
import { errorText, fmtWhen, personName, taskApi, type ExtensionRequest } from '@/lib/tasks';

// Extension requests tab on Tasks / My tasks (Tasks, StaffTasks, MTasks, MStaffTasks artboards).

export function useExtensionRequests() {
  return useQuery({ queryKey: ['extension-requests'], queryFn: taskApi.extensions, refetchInterval: 60_000 });
}

function statusPill(r: ExtensionRequest) {
  if (r.status === 'approved') return <StatusPill tone="done" size="md">Approved</StatusPill>;
  if (r.status === 'rejected') return <StatusPill tone="missed" size="md">Declined</StatusPill>;
  return <StatusPill tone="pending" size="md">Pending</StatusPill>;
}

function useDecide() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ r, status }: { r: ExtensionRequest; status: 'approved' | 'declined' }) => taskApi.decideExtension(r.task_id, r.id, status),
    onSuccess: (_, { r, status }) => {
      toast.success(status === 'approved' ? 'Extension approved' : 'Extension declined');
      qc.invalidateQueries({ queryKey: ['extension-requests'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['task', r.task_id] });
      qc.invalidateQueries({ queryKey: ['task-events', r.task_id] });
    },
    onError: (err) => toast.error(errorText(err, 'Could not decide the request.')),
  });
}

/** The dark banner above the task list: first pending request, tap to decide. */
export function ExtensionBanner({ requests, onOpen }: { requests: ExtensionRequest[]; onOpen: () => void }) {
  const pending = requests.filter((r) => r.status === 'pending');
  if (pending.length === 0) return null;
  const first = pending[0];
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex cursor-pointer flex-wrap items-center gap-3.5 rounded-card border-0 bg-ink p-4 text-left font-ui text-white outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 lg:gap-4 lg:px-[22px] lg:py-[18px]"
    >
      <span className="shrink-0 font-display text-[30px] leading-none font-bold text-yellow lg:text-[34px]">{pending.length}</span>
      <span className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5 lg:gap-[3px]">
        <span className="text-[14.5px] font-semibold lg:text-base">
          <span className="lg:hidden">Extension request{pending.length > 1 ? 's' : ''} to decide</span>
          <span className="hidden lg:inline">
            {personName(first.requester)} wants more time on “{first.task?.title}”
          </span>
        </span>
        <span className="text-[12.5px] text-on-dark-2 lg:text-[13.5px]">
          <span className="lg:hidden">
            {personName(first.requester)} · {fmtWhen(first.task?.deadline)} → {fmtWhen(first.requested_deadline)}
          </span>
          <span className="hidden lg:inline">
            {fmtWhen(first.task?.deadline)} → {fmtWhen(first.requested_deadline)} · tap to decide
          </span>
        </span>
      </span>
      <span className="hidden h-[42px] shrink-0 items-center rounded-full bg-yellow px-[18px] text-sm font-bold text-ink lg:flex">Review request</span>
      <ArrowRight className="size-5 shrink-0 text-yellow lg:hidden" aria-hidden="true" />
    </button>
  );
}

export function ManagerExtensions({ requests }: { requests: ExtensionRequest[] }) {
  const decide = useDecide();
  const pending = requests.filter((r) => r.status === 'pending');

  return (
    <div className="flex flex-col gap-3 lg:gap-5">
      {pending.length > 0 && (
        <section aria-labelledby="h-dec" className="flex flex-col gap-4 rounded-[26px] bg-ink p-5 text-white lg:gap-[22px] lg:rounded-[28px] lg:p-7">
          <div className="flex items-center gap-3">
            <h2 id="h-dec" className="m-0 font-display text-xl font-bold lg:text-[26px]">
              Awaiting your decision
            </h2>
            <span className="rounded-full bg-yellow px-2.5 py-1 text-[13px] font-bold text-ink">{pending.length}</span>
          </div>
          {pending.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-4 border-t border-dark-line pt-4 first-of-type:border-0 first-of-type:pt-0 lg:gap-6">
              <div className="flex min-w-0 flex-[1_1_260px] items-center gap-3.5">
                <Avatar name={personName(r.requester) || '?'} size="lg" />
                <div className="flex min-w-0 flex-col gap-[3px]">
                  <span className="text-[17px] font-bold">{personName(r.requester)}</span>
                  <span className="text-sm text-on-dark">
                    {r.task?.project?.name} · {r.task?.title}
                  </span>
                  {r.reason && <span className="text-[13px] text-on-dark-2 italic">“{r.reason}”</span>}
                </div>
              </div>
              <div className="grid flex-[1_1_100%] grid-cols-2 gap-2.5 lg:flex lg:flex-none lg:items-center lg:gap-3.5">
                <div className="flex flex-col gap-[3px] rounded-[18px] bg-dark-1 px-3.5 py-3 lg:bg-transparent lg:p-0">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-on-dark-2 lg:text-xs">Current</span>
                  <span className="text-sm font-semibold text-on-dark line-through lg:text-[15px]">{fmtWhen(r.task?.deadline)}</span>
                </div>
                <ArrowRight className="hidden size-[22px] text-yellow lg:block" aria-hidden="true" />
                <div className="flex flex-col gap-[3px] rounded-[18px] bg-yellow px-3.5 py-3 text-ink lg:bg-transparent lg:p-0 lg:text-white">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.06em] lg:text-xs lg:text-on-dark-2">Requested</span>
                  <span className="text-sm font-bold lg:text-[15px]">{fmtWhen(r.requested_deadline)}</span>
                </div>
              </div>
              <div className="grid flex-[1_1_100%] grid-cols-2 gap-2.5 lg:flex lg:flex-none">
                <Button variant="dark-outline" disabled={decide.isPending} onClick={() => decide.mutate({ r, status: 'declined' })}>
                  Decline
                </Button>
                <Button variant="accent" disabled={decide.isPending} onClick={() => decide.mutate({ r, status: 'approved' })}>
                  Approve
                </Button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section aria-labelledby="h-hist" className="flex flex-col gap-3.5 rounded-[26px] bg-surface p-5 lg:rounded-[28px] lg:p-7">
        <div className="flex flex-col gap-1">
          <h2 id="h-hist" className="m-0 font-display text-xl font-bold lg:text-2xl">
            All extension requests
          </h2>
          <p className="m-0 text-sm text-ink-3">Complete history of deadline extension requests</p>
        </div>
        {requests.length === 0 && <p className="m-0 border-t border-line pt-4 text-sm text-ink-3">No extension requests yet.</p>}
        {requests.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-x-7 gap-y-3 border-t border-line py-4">
            <span className="flex flex-[2_1_220px] flex-col gap-0.5">
              <span className="text-[15px] font-bold">{personName(r.requester)}</span>
              <span className="text-[13px] text-ink-3">{r.task?.project?.name}</span>
            </span>
            <span className="flex-[2_1_220px] text-[14.5px]">{r.task?.title}</span>
            <span className="flex flex-[1_1_150px] flex-col gap-0.5 text-[13.5px]">
              <span className="text-ink-3">New deadline —</span>
              <span className="font-semibold">
                {r.status === 'approved' ? 'Approved' : 'Requested'} {fmtWhen(r.approved_deadline ?? r.requested_deadline)}
              </span>
            </span>
            {statusPill(r)}
          </div>
        ))}
      </section>
    </div>
  );
}

export function StaffExtensions({ requests }: { requests: ExtensionRequest[] }) {
  const [asking, setAsking] = useState(false);
  return (
    <section aria-labelledby="h-ext" className="flex flex-col gap-3.5 rounded-[26px] bg-surface p-5 lg:rounded-card-lg lg:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="h-ext" className="m-0 font-display text-xl font-bold lg:text-[26px]">
          Extension requests
        </h2>
        <Button size="md" className="h-[46px] px-5 text-[14.5px]" onClick={() => setAsking(true)}>
          Request an extension
        </Button>
      </div>
      {requests.length === 0 && <p className="m-0 border-t border-line pt-4 text-sm text-ink-3">You haven’t asked for more time on any task.</p>}
      {requests.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center gap-x-7 gap-y-2 border-t border-line py-4">
          <span className="flex flex-[2_1_240px] flex-col gap-0.5">
            <span className="text-[15.5px] font-bold">{r.task?.title}</span>
            <span className="text-[13px] text-ink-3">{r.task?.project?.name}</span>
          </span>
          <span className="flex-[2_1_240px] text-sm">
            {r.status === 'pending' && (
              <>
                <span className="text-ink-3 line-through">{fmtWhen(r.task?.deadline)}</span> →{' '}
              </>
            )}
            <strong>{fmtWhen(r.approved_deadline ?? r.requested_deadline)}</strong>
          </span>
          {statusPill(r)}
        </div>
      ))}
      <RequestExtensionSheet open={asking} onClose={() => setAsking(false)} />
    </section>
  );
}

/** Staff: ask for a later deadline on one of their open tasks. */
export function RequestExtensionSheet({ open, onClose, taskId }: { open: boolean; onClose: () => void; taskId?: number }) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      {open && <RequestBody onClose={onClose} taskId={taskId} />}
    </Sheet>
  );
}

function RequestBody({ onClose, taskId }: { onClose: () => void; taskId?: number }) {
  const qc = useQueryClient();
  const { data: tasks = [] } = useQuery({ queryKey: ['tasks', 'all'], queryFn: taskApi.all });
  const open = tasks.filter((t) => t.status !== 'completed');
  const [task, setTask] = useState(taskId ? String(taskId) : '');
  const [deadline, setDeadline] = useState('');
  const [reason, setReason] = useState('');
  const current = open.find((t) => String(t.id) === task);

  const send = useMutation({
    mutationFn: () => taskApi.requestExtension(Number(task), { requested_deadline: deadline, reason: reason.trim() }),
    onSuccess: () => {
      toast.success('Extension requested — you can keep working while it’s decided');
      qc.invalidateQueries({ queryKey: ['extension-requests'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['task', Number(task)] });
      onClose();
    },
    onError: (err) => toast.error(errorText(err, 'Could not send the request.')),
  });

  const ready = task && deadline && reason.trim() && !send.isPending;
  const field = 'h-12 w-full rounded-2xl border-0 bg-surface-2 px-4 font-ui text-[15px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink';
  const label = 'text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink-3';

  return (
    <>
      <SheetTitle>Request an extension</SheetTitle>
      <SheetDescription>Your manager decides. You can keep working on the task in the meantime.</SheetDescription>
      <label className="flex flex-col gap-1.5">
        <span className={label}>Task</span>
        <select value={task} onChange={(e) => setTask(e.target.value)} className={field}>
          <option value="">Choose a task</option>
          {open.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
        {current && <span className="text-[12.5px] text-ink-3">Current deadline: {fmtWhen(current.deadline)}</span>}
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={label}>New deadline</span>
        <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={field} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={label}>Reason</span>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className={`${field} h-auto py-3 leading-normal`} />
      </label>
      <SheetActions confirmLabel="Send request" confirmDisabled={!ready} onConfirm={() => ready && send.mutate()} />
    </>
  );
}
