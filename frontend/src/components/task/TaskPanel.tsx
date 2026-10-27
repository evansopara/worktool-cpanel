'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Pause, Pencil, Play, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Avatar, Drawer, DrawerClose, StatusPill, Tabs } from '@/components/wc';
import { DEADLINE_PASSED, deadlinePassed, errorText, fmtMinutes, fmtWhen, personName, statusInfo, taskApi, type HistoryFilter, type TaskDetail } from '@/lib/tasks';
import { LiveClock } from './LiveClock';
import { HistoryFilters, HistorySummaryTiles, HistoryTimeline } from './TaskHistory';
import type { useTaskActions } from './useTaskActions';

type Actions = ReturnType<typeof useTaskActions>;

/**
 * Task panel (TaskPanel artboard, spec §7.9): a 620px drawer on desktop and a
 * full-screen sheet on mobile, opened from any task title. Same content for
 * both roles; only the header actions change.
 */
export function TaskPanelDrawer({
  taskId,
  onClose,
  manager,
  userId,
  actions,
  onEdit,
  onDelete,
}: {
  taskId: number | null;
  onClose: () => void;
  manager: boolean;
  userId: number;
  actions: Actions;
  onEdit: (task: TaskDetail) => void;
  onDelete: (task: TaskDetail) => void;
}) {
  return (
    <Drawer open={taskId !== null} onOpenChange={(o) => !o && onClose()} label="Task details and history">
      {taskId !== null && <TaskPanel taskId={taskId} manager={manager} userId={userId} actions={actions} onEdit={onEdit} onDelete={onDelete} />}
    </Drawer>
  );
}

function TaskPanel({
  taskId,
  manager,
  userId,
  actions,
  onEdit,
  onDelete,
}: {
  taskId: number;
  manager: boolean;
  userId: number;
  actions: Actions;
  onEdit: (task: TaskDetail) => void;
  onDelete: (task: TaskDetail) => void;
}) {
  const qc = useQueryClient();
  // Staff open on Details (instructions first); managers on History.
  const [tab, setTab] = useState<'details' | 'history'>(manager ? 'history' : 'details');
  const [filter, setFilter] = useState<HistoryFilter>('all');

  const taskQuery = useQuery({ queryKey: ['task', taskId], queryFn: () => taskApi.get(taskId), refetchInterval: 30_000 });
  const historyQuery = useQuery({
    queryKey: ['task-events', taskId, filter],
    queryFn: () => taskApi.events(taskId, filter),
    refetchInterval: 30_000,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['tasks'] });
    qc.invalidateQueries({ queryKey: ['task', taskId] });
    qc.invalidateQueries({ queryKey: ['task-events', taskId] });
    qc.invalidateQueries({ queryKey: ['extension-requests'] });
  };

  const decide = useMutation({
    mutationFn: (status: 'approved' | 'declined') => taskApi.decideExtension(taskId, taskQuery.data!.pending_extension!.id, status),
    onSuccess: (_, status) => {
      toast.success(status === 'approved' ? 'Extension approved' : 'Extension declined');
      refresh();
    },
    onError: (err) => toast.error(errorText(err, 'Could not decide the request.')),
  });

  const review = useMutation({
    mutationFn: (verdict: 'approve' | 'send-back') => (verdict === 'approve' ? taskApi.approve(taskId) : taskApi.sendBack(taskId)),
    onSuccess: (_, verdict) => {
      toast.success(verdict === 'approve' ? 'Task approved' : 'Sent back for changes');
      refresh();
    },
    onError: (err) => toast.error(errorText(err, 'Could not update the task.')),
  });

  const t = taskQuery.data;
  if (!t) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <div className="flex justify-end">
          <CloseButton />
        </div>
        <p className="m-0 text-sm text-ink-3">{taskQuery.isError ? 'This task could not be loaded.' : 'Loading task…'}</p>
      </div>
    );
  }

  const status = statusInfo(t.status);
  const assignee = personName(t.assignee) || 'Unassigned';
  const creator = personName(t.assigner);
  const since = taskQuery.dataUpdatedAt;
  // Timer actions belong to the assignee, who can also be a manager (PMs).
  const isAssignee = t.assignee_id === userId;
  const actionTask = {
    id: t.id,
    title: t.title,
    project: t.project?.name,
    assignedBy: creator,
    deadline: t.deadline,
    estimateMinutes: t.estimate_minutes,
  };
  const eventCount = historyQuery.data?.data.length;

  return (
    <div className="flex flex-col gap-[18px] p-6">
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="text-[13px] font-semibold text-ink-3">{t.project?.name}</span>
          <h2 className="m-0 font-display text-[30px] leading-[1.08] font-bold tracking-[-0.025em]">{t.title}</h2>
          <div className="flex flex-wrap gap-1.5">
            <StatusPill tone={status.tone} size="md">
              {status.label}
            </StatusPill>
            {t.pending_extension && (
              <StatusPill tone="pending" size="md">
                Extension pending
              </StatusPill>
            )}
          </div>
        </div>
        <CloseButton />
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <span className="flex min-w-0 flex-[1_1_200px] items-center gap-2">
          <Avatar name={assignee} size="sm" />
          <span className="text-sm">
            <strong>{assignee}</strong>
            {creator && <span className="text-ink-3"> · assigned by {creator}</span>}
          </span>
        </span>
        {manager && (
          <span className="flex gap-2">
            <button type="button" onClick={() => onEdit(t)} className={pill('bg-ink text-white')}>
              <Pencil className="size-3.5" strokeWidth={2} aria-hidden="true" />
              Edit
            </button>
            <button type="button" onClick={() => onDelete(t)} className={pill('bg-missed-tint text-missed')}>
              Delete
            </button>
          </span>
        )}
        {isAssignee &&
          t.status !== 'completed' && (
            <span className="flex gap-2">
              <button
                type="button"
                disabled={actions.busy === t.id || deadlinePassed(t)}
                title={deadlinePassed(t) ? DEADLINE_PASSED : undefined}
                onClick={() => (t.is_timer_running ? actions.stop(actionTask) : actions.start(actionTask))}
                className={pill(t.is_timer_running ? 'bg-ink text-white' : 'bg-done-tint text-done')}
              >
                {t.is_timer_running ? <Pause className="size-3 fill-current" aria-hidden="true" /> : <Play className="size-3 fill-current" aria-hidden="true" />}
                {t.is_timer_running ? 'Stop' : 'Start'}
              </button>
              <button type="button" disabled={actions.busy === t.id || deadlinePassed(t)} title={deadlinePassed(t) ? DEADLINE_PASSED : undefined} onClick={() => actions.submit(actionTask)} className={pill('bg-yellow font-bold text-ink')}>
                Submit
              </button>
            </span>
          )}
      </div>

      {manager && t.status === 'review' && (
        <div className="flex flex-wrap items-center gap-3 rounded-[20px] bg-review-tint px-4 py-3 text-review">
          <span className="flex-[1_1_180px] text-sm font-semibold">Submitted for review</span>
          <span className="flex gap-2">
            <button type="button" disabled={review.isPending} onClick={() => review.mutate('send-back')} className={pill('bg-surface text-ink')}>
              Send back
            </button>
            <button type="button" disabled={review.isPending} onClick={() => review.mutate('approve')} className={pill('bg-yellow font-bold text-ink')}>
              Approve
            </button>
          </span>
        </div>
      )}

      <Tabs
        label="Task sections"
        on="white"
        value={tab}
        onChange={setTab}
        className="w-full self-stretch [&>button]:flex-1 [&>button]:justify-center"
        items={[
          { value: 'details', label: 'Details' },
          { value: 'history', label: 'History', count: eventCount },
        ]}
      />

      {tab === 'details' ? (
        <div className="flex flex-col gap-3.5">
          <section aria-label="Instructions" className="flex flex-col gap-2 rounded-[20px] bg-brief-tint px-[18px] py-4">
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.07em]">
              <FileText className="size-[15px]" strokeWidth={2} aria-hidden="true" />
              Instructions
            </span>
            {t.has_instructions ? (
              <p className="m-0 text-[15px] leading-[1.6] whitespace-pre-wrap">{t.description}</p>
            ) : (
              <p className="m-0 text-[14.5px] text-ink-2">No instructions were added to this task.</p>
            )}
          </section>
          <dl className="m-0 grid grid-cols-2 gap-2">
            <Fact k="Assignee" v={assignee} />
            <Fact k="Created by" v={creator || '—'} />
            <Fact k="Scheduled start" v={fmtWhen(t.start_date)} />
            <Fact k="Deadline" v={fmtWhen(t.deadline)} danger={t.status === 'deadline_missed'} />
            <Fact k="Estimate" v={fmtMinutes(t.estimate_minutes)} />
            <Fact k="Time logged" v={<LiveClock seconds={t.logged_seconds} running={t.is_timer_running} since={since} className="font-ui" />} />
          </dl>
        </div>
      ) : (
        <div className="flex flex-col gap-[18px]">
          {historyQuery.data ? (
            <>
              <HistorySummaryTiles summary={historyQuery.data.summary} running={t.is_timer_running} />
              <HistoryFilters value={filter} onChange={setFilter} />
              <HistoryTimeline
                events={historyQuery.data.data}
                deadline={t.deadline}
                waiting={t.pending_extension && filter !== 'sessions' && filter !== 'edits' ? { manager } : null}
                onDecide={(s) => decide.mutate(s)}
                deciding={decide.isPending}
              />
            </>
          ) : (
            <p className="m-0 text-sm text-ink-3">{historyQuery.isError ? 'History could not be loaded.' : 'Loading history…'}</p>
          )}
          <p className="m-0 rounded-[14px] bg-surface-2 px-3.5 py-3 text-[12.5px] text-ink-2">
            History is written by the server and can’t be edited or deleted — everyone on this task sees the same record.
          </p>
        </div>
      )}
    </div>
  );
}

function pill(colors: string) {
  return cn(
    'inline-flex h-[42px] cursor-pointer items-center gap-1.5 rounded-full border-0 px-4 font-ui text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:opacity-40',
    colors,
  );
}

function CloseButton() {
  return (
    <DrawerClose
      aria-label="Close task"
      className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-stone text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink"
    >
      <X className="size-[18px]" strokeWidth={2.2} aria-hidden="true" />
    </DrawerClose>
  );
}

function Fact({ k, v, danger }: { k: string; v: React.ReactNode; danger?: boolean }) {
  return (
    <div className="flex flex-col gap-[3px] rounded-2xl bg-surface-2 px-3.5 py-3">
      <dt className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">{k}</dt>
      <dd className={cn('m-0 text-[14.5px] font-semibold', danger && 'text-missed')}>{v}</dd>
    </div>
  );
}
