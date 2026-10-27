'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { projectsApi, usersApi } from '@/lib/api';
import { toDatetimeLocalValue } from '@/lib/utils';
import { Sheet, SheetActions, SheetTitle } from '@/components/wc';
import { errorText, fmtWhen, ruleError, taskApi, workingMinutes, type TaskDetail } from '@/lib/tasks';

// New task / Edit task. Not drawn in the design; built from its parts.

type FormState = {
  title: string;
  description: string;
  project_id: string;
  assignee_id: string;
  priority: string;
  status: string;
  start_date: string;
  deadline: string;
  working_hours: string;
  working_minutes: string;
  lock_early_start: boolean;
  reason: string;
};

const EMPTY: FormState = {
  title: '',
  description: '',
  project_id: '',
  assignee_id: '',
  priority: 'medium',
  status: 'todo',
  start_date: '',
  deadline: '',
  working_hours: '',
  working_minutes: '',
  lock_early_start: false,
  reason: '',
};

const STATUSES = [
  ['todo', 'To do'],
  ['in_progress', 'In progress'],
  ['on_hold', 'Paused'],
  ['review', 'In review'],
  ['not_approved', 'Sent back'],
  ['completed', 'Completed'],
  ['deadline_missed', 'Deadline missed'],
];

const ASSIGNABLE_ROLES = ['staff', 'intern', 'project_manager'];

type UserRow = { id: number; first_name: string; last_name: string; role: string };
type ProjectRow = { id: number; name: string };

function fromTask(t: TaskDetail): FormState {
  return {
    title: t.title,
    description: t.description ?? '',
    project_id: String(t.project_id),
    assignee_id: t.assignee_id ? String(t.assignee_id) : '',
    priority: t.priority ?? 'medium',
    status: t.status,
    start_date: toDatetimeLocalValue(t.start_date),
    deadline: toDatetimeLocalValue(t.deadline),
    working_hours: t.working_hours ? String(t.working_hours) : '',
    working_minutes: t.working_minutes ? String(t.working_minutes) : '',
    lock_early_start: !!t.lock_early_start,
    reason: '',
  };
}

export function TaskForm({ open, task, onClose }: { open: boolean; task: TaskDetail | null; onClose: () => void }) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      {open && <TaskFormBody key={task?.id ?? 'new'} task={task} onClose={onClose} />}
    </Sheet>
  );
}

function TaskFormBody({ task, onClose }: { task: TaskDetail | null; onClose: () => void }) {
  const qc = useQueryClient();
  const initial = useMemo(() => (task ? fromTask(task) : EMPTY), [task]);
  const [form, setForm] = useState<FormState>(initial);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  // Changing either date fills the estimate with the office hours between
  // them (WORK_DAY); it can still be typed over.
  const setDate = (k: 'start_date' | 'deadline', v: string) =>
    setForm((f) => {
      const next = { ...f, [k]: v };
      const mins = next.start_date && next.deadline ? workingMinutes(new Date(next.start_date), new Date(next.deadline)) : 0;
      return mins > 0 ? { ...next, working_hours: String(Math.floor(mins / 60)), working_minutes: mins % 60 ? String(mins % 60) : '' } : next;
    });
  const datesBackwards = !!form.start_date && !!form.deadline && new Date(form.deadline) <= new Date(form.start_date);

  const { data: projects = [] } = useQuery<ProjectRow[]>({ queryKey: ['projects'], queryFn: () => projectsApi.list().then((r) => r.data) });
  const { data: users = [] } = useQuery<UserRow[]>({ queryKey: ['users'], queryFn: () => usersApi.list().then((r) => r.data) });
  // Every task, to stop double-booking someone (the old form's rule).
  const { data: allTasks = [] } = useQuery({ queryKey: ['tasks', 'all'], queryFn: taskApi.all });

  const assignable = users.filter((u) => ASSIGNABLE_ROLES.includes(u.role));
  const conflict =
    form.assignee_id && form.start_date && form.deadline
      ? allTasks.find(
          (t) =>
            t.id !== task?.id &&
            String(t.assignee_id ?? '') === form.assignee_id &&
            !['completed', 'not_approved'].includes(t.status) &&
            t.start_date &&
            t.deadline &&
            new Date(form.start_date) <= new Date(t.deadline) &&
            new Date(t.start_date) <= new Date(form.deadline),
        )
      : undefined;

  const estimate = (f: FormState) => Number(f.working_hours || 0) * 60 + Number(f.working_minutes || 0);
  const needsReason = !!task && (form.deadline !== initial.deadline || estimate(form) !== estimate(initial));

  const save = useMutation({
    mutationFn: () => {
      const data: Record<string, unknown> = {
        title: form.title.trim(),
        description: form.description,
        project_id: Number(form.project_id),
        assignee_id: form.assignee_id ? Number(form.assignee_id) : null,
        priority: form.priority,
        start_date: form.start_date || null,
        deadline: form.deadline || null,
        working_hours: form.working_hours ? Number(form.working_hours) : 0,
        working_minutes: form.working_minutes ? Number(form.working_minutes) : 0,
        lock_early_start: form.lock_early_start,
      };
      if (task) {
        delete data.project_id; // a task stays in its project
        data.status = form.status;
        if (needsReason) data.reason = form.reason.trim();
        return taskApi.update(task.id, data);
      }
      return taskApi.create(data);
    },
    onSuccess: () => {
      toast.success(task ? 'Task updated' : 'Task created');
      qc.invalidateQueries({ queryKey: ['tasks'] });
      if (task) {
        qc.invalidateQueries({ queryKey: ['task', task.id] });
        qc.invalidateQueries({ queryKey: ['task-events', task.id] });
      }
      onClose();
    },
    onError: (err) => toast.error(ruleError(err)?.message ?? errorText(err, task ? 'Could not update the task.' : 'Could not create the task.')),
  });

  const name = (id: string) => {
    const u = users.find((x) => String(x.id) === id);
    return u ? `${u.first_name} ${u.last_name}`.trim() : 'This person';
  };
  const canSave = form.title.trim() && form.project_id && !conflict && !datesBackwards && (!needsReason || form.reason.trim()) && !save.isPending;

  return (
    <>
      <SheetTitle>{task ? 'Edit task' : 'New task'}</SheetTitle>
      <form
        className="flex flex-col gap-3.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSave) save.mutate();
        }}
      >
        <Field label="Title">
          <input required value={form.title} onChange={(e) => set('title', e.target.value)} className={input} />
        </Field>
        <Field label="Instructions" hint="Steps, links, files and what “done” looks like. Staff read these before they start.">
          <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={4} className={`${input} h-auto py-3 leading-normal`} />
        </Field>
        <div className="grid gap-3.5 sm:grid-cols-2">
          {!task && (
            <Field label="Project">
              <select required value={form.project_id} onChange={(e) => set('project_id', e.target.value)} className={input}>
                <option value="">Choose a project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Assignee">
            <select value={form.assignee_id} onChange={(e) => set('assignee_id', e.target.value)} className={input}>
              <option value="">Nobody yet</option>
              {assignable.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.first_name} {u.last_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Priority">
            <select value={form.priority} onChange={(e) => set('priority', e.target.value)} className={input}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </Field>
          {task && (
            <Field label="Status">
              <select value={form.status} onChange={(e) => set('status', e.target.value)} className={input}>
                {STATUSES.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Scheduled start">
            <input type="datetime-local" value={form.start_date} onChange={(e) => setDate('start_date', e.target.value)} className={input} />
          </Field>
          <Field label="Deadline">
            <input type="datetime-local" value={form.deadline} min={form.start_date || undefined} onChange={(e) => setDate('deadline', e.target.value)} aria-invalid={datesBackwards} className={input} />
          </Field>
          <Field label="Estimate" hint="Worked out from the dates (8am–6pm, Mon–Fri). You can change it.">
            <div className="flex gap-2">
              <input type="number" min={0} placeholder="Hours" aria-label="Estimate hours" value={form.working_hours} onChange={(e) => set('working_hours', e.target.value)} className={input} />
              <input type="number" min={0} max={59} placeholder="Minutes" aria-label="Estimate minutes" value={form.working_minutes} onChange={(e) => set('working_minutes', e.target.value)} className={input} />
            </div>
          </Field>
        </div>

        <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3">
          <input type="checkbox" checked={form.lock_early_start} onChange={(e) => set('lock_early_start', e.target.checked)} className="size-[18px] accent-ink" />
          <span className="flex flex-col">
            <span className="text-sm font-semibold">Can’t start before scheduled time</span>
            <span className="text-[12.5px] text-ink-3">Start shows “Opens at …” until then</span>
          </span>
        </label>

        {datesBackwards && (
          <p role="alert" className="m-0 rounded-2xl bg-missed-tint px-4 py-3 text-[13.5px] font-semibold text-missed">
            The deadline is before the start, so this task would be missed as soon as it opens. Set the deadline after {fmtWhen(new Date(form.start_date).toISOString())}.
          </p>
        )}

        {conflict && (
          <p className="m-0 rounded-2xl bg-missed-tint px-4 py-3 text-[13.5px] text-missed">
            {name(form.assignee_id)} already has “{conflict.title}” scheduled from {fmtWhen(conflict.start_date)} to {fmtWhen(conflict.deadline)}.
          </p>
        )}

        {needsReason && (
          <Field label="Reason for the change" hint="Deadline and estimate changes are saved to the task history with this reason.">
            <textarea required value={form.reason} onChange={(e) => set('reason', e.target.value)} rows={2} className={`${input} h-auto py-3 leading-normal`} />
          </Field>
        )}

        <SheetActions confirmLabel={task ? 'Save changes' : 'Create task'} confirmDisabled={!canSave} onConfirm={() => canSave && save.mutate()} />
      </form>
    </>
  );
}

const input =
  'h-12 w-full min-w-0 rounded-2xl border-0 bg-surface-2 px-4 font-ui text-[15px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">{label}</span>
      {children}
      {hint && <span className="text-[12.5px] text-ink-3">{hint}</span>}
    </label>
  );
}
