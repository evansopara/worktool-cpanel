'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Clock, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Sheet, SheetActions, SheetDescription, SheetEyebrow, SheetTitle } from '@/components/wc';
import { errorText, fmtMinutes, fmtTime, fmtWhen, ruleError, taskApi, type RuleError } from '@/lib/tasks';

/** What the prompts need to know about a task. */
export type ActionTask = {
  id: number;
  title: string;
  project?: string | null;
  assignedBy?: string | null;
  deadline: string | null;
  estimateMinutes: number;
};

type Confirm = { confirm_read?: boolean; confirm_early?: boolean };

type SheetState =
  | { kind: 'read'; task: ActionTask; text: string; startAfter: boolean; confirm: Confirm }
  | { kind: 'early'; task: ActionTask; error: RuleError; confirm: Confirm; at: number }
  | null;

/**
 * Start / Stop / Submit for the assignee, with the server's prompts
 * (spec §7.6–7.7): the first start on a task with unread instructions shows
 * them ("Got it, start timer"); a start before the scheduled time asks to
 * start early and warns about a task scheduled now. Render `dialogs` once.
 */
export function useTaskActions() {
  const qc = useQueryClient();
  const [sheet, setSheet] = useState<SheetState>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const refresh = (id: number) => {
    qc.invalidateQueries({ queryKey: ['tasks'] });
    qc.invalidateQueries({ queryKey: ['task', id] });
    qc.invalidateQueries({ queryKey: ['task-events', id] });
  };

  async function attempt(task: ActionTask, confirm: Confirm) {
    setBusy(task.id);
    try {
      await taskApi.start(task.id, confirm);
      setSheet(null);
      refresh(task.id);
    } catch (err) {
      const rule = ruleError(err);
      if (rule?.code === 'confirm_read') {
        setSheet({ kind: 'read', task, text: rule.instructions ?? '', startAfter: true, confirm });
      } else if (rule?.code === 'confirm_early') {
        setSheet({ kind: 'early', task, error: rule, confirm, at: Date.now() });
      } else {
        setSheet(null);
        toast.error(rule?.code === 'locked' ? `This task opens at ${fmtTime(rule.opens_at)}.` : errorText(err, 'Could not start the timer.'));
      }
    } finally {
      setBusy(null);
    }
  }

  async function run(task: ActionTask, call: () => Promise<unknown>, failed: string, done?: string) {
    setBusy(task.id);
    try {
      await call();
      refresh(task.id);
      if (done) toast.success(done);
    } catch (err) {
      toast.error(errorText(err, failed));
    } finally {
      setBusy(null);
    }
  }

  return {
    busy,
    start: (task: ActionTask) => attempt(task, {}),
    stop: (task: ActionTask) => run(task, () => taskApi.stop(task.id), 'Could not stop the timer.'),
    submit: (task: ActionTask) => run(task, () => taskApi.submit(task.id), 'Could not submit the task.', 'Submitted for review'),
    /** The card's "Read" link: show the instructions and count them as read. */
    read: async (task: ActionTask) => {
      try {
        const detail = await taskApi.get(task.id);
        setSheet({ kind: 'read', task, text: detail.description ?? '', startAfter: false, confirm: {} });
        await taskApi.readInstructions(task.id);
      } catch (err) {
        toast.error(errorText(err, 'Could not open the instructions.'));
      }
    },
    dialogs: (
      <>
        <Sheet open={sheet?.kind === 'read'} onOpenChange={(o) => !o && setSheet(null)}>
          {sheet?.kind === 'read' && (
            <>
              <SheetEyebrow>
                <FileText aria-hidden="true" />
                {sheet.startAfter ? 'Read before you start' : 'Instructions'}
              </SheetEyebrow>
              <SheetTitle>{sheet.task.title}</SheetTitle>
              {sheet.task.assignedBy && <SheetDescription>From {sheet.task.assignedBy}</SheetDescription>}
              <div className="rounded-[18px] bg-surface-2 p-4 text-[15px] leading-[1.6] whitespace-pre-wrap lg:rounded-[20px] lg:p-[18px]">
                {sheet.text || 'No instructions were added to this task.'}
              </div>
              <SheetActions
                confirmLabel={sheet.startAfter ? 'Got it, start timer' : 'Got it'}
                confirmDisabled={busy === sheet.task.id}
                onConfirm={() =>
                  sheet.startAfter ? attempt(sheet.task, { ...sheet.confirm, confirm_read: true }) : setSheet(null)
                }
              />
            </>
          )}
        </Sheet>

        <Sheet open={sheet?.kind === 'early'} onOpenChange={(o) => !o && setSheet(null)}>
          {sheet?.kind === 'early' && <EarlyPrompt state={sheet} busy={busy === sheet.task.id} onConfirm={() => attempt(sheet.task, { ...sheet.confirm, confirm_early: true })} />}
        </Sheet>
      </>
    ),
  };
}

function EarlyPrompt({
  state,
  busy,
  onConfirm,
}: {
  state: Extract<SheetState, { kind: 'early' }>;
  busy: boolean;
  onConfirm: () => void;
}) {
  const { task, error, at } = state;
  const scheduled = error.scheduled_start ?? null;
  const earlyBy = scheduled ? Math.max(1, Math.round((new Date(scheduled).getTime() - at) / 60000)) : 0;
  const deadlineAt = fmtTime(task.deadline);

  return (
    <>
      <SheetEyebrow tone="done">
        <Clock aria-hidden="true" />
        Starting early · it’s {fmtTime(new Date(at).toISOString())}
      </SheetEyebrow>
      <SheetTitle>This task is scheduled for {fmtTime(scheduled)} — do you want to start early?</SheetTitle>
      <SheetDescription className="text-ink-2">
        {[task.title, task.project, task.deadline ? `deadline ${fmtWhen(task.deadline)}` : null].filter(Boolean).join(' · ')}
      </SheetDescription>
      {error.clash && (
        <div className="flex gap-3 rounded-[18px] bg-pending-tint p-3.5 text-pending-ink lg:rounded-[20px] lg:p-4">
          <AlertTriangle className="mt-px size-5 shrink-0" strokeWidth={2} aria-hidden="true" />
          <p className="m-0 text-sm leading-normal lg:text-[14.5px]">
            <strong>
              You have {error.clash.title} scheduled now{error.clash.deadline ? ` (due ${fmtTime(error.clash.deadline)})` : ''}.
            </strong>{' '}
            Start this one anyway?
          </p>
        </div>
      )}
      <p className="m-0 text-[13px] leading-normal text-ink-2 lg:text-[13.5px]">
        If you start now, the task history will record “Timer started {fmtMinutes(earlyBy)} before scheduled start.”
        {task.estimateMinutes > 0 && ` The ${fmtMinutes(task.estimateMinutes)} estimate`}
        {task.estimateMinutes > 0 && deadlineAt ? ' and' : deadlineAt ? ' The' : ''}
        {deadlineAt && ` the ${deadlineAt} deadline`}
        {(task.estimateMinutes > 0 || deadlineAt) && ' stay the same.'}
      </p>
      <SheetActions confirmLabel="Start early" cancelLabel="Not yet" confirmDisabled={busy} onConfirm={onConfirm} />
    </>
  );
}
