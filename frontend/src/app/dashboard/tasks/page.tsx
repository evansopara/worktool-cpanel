'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import Header from '@/components/layout/Header';
import { tasksApi, projectsApi, usersApi } from '@/lib/api';
import { Task } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { formatDate, formatSeconds, toDatetimeLocalValue } from '@/lib/utils';
import { toast } from 'sonner';
import TimerCell from '@/components/tasks/TimerCell';
import { Plus, Pencil, Trash2, Play, Square, CheckCheck, AlertTriangle } from 'lucide-react';

const TASK_STATUSES = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'todo', label: 'Todo' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'deadline_missed', label: 'Deadline Missed' },
  { value: 'completed', label: 'Completed' },
  { value: 'not_approved', label: 'Not Approved' },
  { value: 'on_hold', label: 'On Hold' },
] as const;

const TASK_PRIORITIES = ['low', 'medium', 'high'] as const;

const STATUS_STYLES: Record<string, string> = {
  not_started: 'bg-slate-100 text-slate-600',
  todo: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  review: 'bg-yellow-100 text-yellow-700',
  deadline_missed: 'bg-orange-100 text-orange-700',
  completed: 'bg-green-100 text-green-700',
  not_approved: 'bg-red-100 text-red-700',
  on_hold: 'bg-purple-100 text-purple-700',
};

function fmtWorkingHours(hours?: number, minutes?: number): string {
  if (!hours && !minutes) return '—';
  const parts = [];
  if (hours) parts.push(`${hours}hr`);
  if (minutes) parts.push(`${minutes}mins`);
  return parts.join(' ');
}

function fmtDateTime(date?: string | null): string {
  if (!date) return '—';
  return formatDate(date, 'MM/dd/yyyy h:mm a');
}

function fmtTime(date?: string | null): string {
  if (!date) return '';
  return formatDate(date, 'h:mm a');
}

const CONFLICT_EXEMPT_STATUSES = ['completed', 'not_approved'];

function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return new Date(aStart) <= new Date(bEnd) && new Date(bStart) <= new Date(aEnd);
}

function findSchedulingConflict(
  allTasks: Task[],
  assigneeId: string,
  startDate: string,
  deadline: string,
  excludeTaskId?: number
): Task | undefined {
  if (!assigneeId || !startDate || !deadline) return undefined;
  return allTasks.find((t) => {
    if (excludeTaskId && t.id === excludeTaskId) return false;
    if (String(t.assignee_id ?? '') !== assigneeId) return false;
    if (CONFLICT_EXEMPT_STATUSES.includes(t.status)) return false;
    if (!t.start_date || !t.deadline) return false;
    return rangesOverlap(startDate, deadline, t.start_date, t.deadline);
  });
}

export default function TasksPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [deleteTask, setDeleteTask] = useState<Task | null>(null);

  const [form, setForm] = useState({
    title: '', description: '', project_id: '', assignee_id: '', priority: 'medium',
    start_date: '', deadline: '', status: 'todo', working_hours: '', working_minutes: '',
  });

  const [editForm, setEditForm] = useState({
    title: '', description: '', project_id: '', assignee_id: '', priority: 'medium',
    start_date: '', deadline: '', status: 'todo', working_hours: '', working_minutes: '',
  });

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => tasksApi.list().then((r) => r.data),
    refetchInterval: 5000,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list().then((r) => r.data),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list().then((r) => r.data),
    enabled: !['client'].includes(user?.role ?? ''),
  });

  const resetForm = () => setForm({
    title: '', description: '', project_id: '', assignee_id: '', priority: 'medium',
    start_date: '', deadline: '', status: 'todo', working_hours: '', working_minutes: '',
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => tasksApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task created');
      setCreateOpen(false);
      resetForm();
    },
    onError: () => toast.error('Failed to create task'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => tasksApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task updated');
      setEditTask(null);
    },
    onError: () => toast.error('Failed to update task'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => tasksApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task deleted');
      setDeleteTask(null);
    },
    onError: () => toast.error('Failed to delete task'),
  });

  const patchTaskCache = (updated: Task) => {
    qc.setQueryData(['tasks'], (old: Task[] | undefined) =>
      old ? old.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)) : old
    );
  };

  const timerMutation = useMutation({
    mutationFn: ({ id, running }: { id: number; running: boolean }) =>
      running ? tasksApi.stopTimer(id) : tasksApi.startTimer(id),
    onSuccess: (res) => {
      patchTaskCache(res.data);
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: () => toast.error('Timer error'),
  });

  // Stop a running timer the instant its task's deadline passes, instead of
  // waiting for the once-a-minute server-side deadline sweep.
  const autoStopMutation = useMutation({
    mutationFn: (id: number) => tasksApi.stopTimer(id),
    onSuccess: (res) => {
      patchTaskCache(res.data);
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast.error('Timer stopped — deadline reached');
    },
  });

  const autoStoppedRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    const interval = setInterval(() => {
      const nowMs = Date.now();
      (tasks as Task[]).forEach((t) => {
        if (t.is_timer_running && t.deadline && new Date(t.deadline).getTime() <= nowMs && !autoStoppedRef.current.has(t.id)) {
          autoStoppedRef.current.add(t.id);
          autoStopMutation.mutate(t.id, { onSettled: () => autoStoppedRef.current.delete(t.id) });
        }
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);

  const submitMutation = useMutation({
    mutationFn: async (task: Task) => {
      if (task.is_timer_running) {
        const stopRes = await tasksApi.stopTimer(task.id);
        patchTaskCache(stopRes.data);
      }
      return tasksApi.update(task.id, { status: 'review' });
    },
    onSuccess: (res) => {
      patchTaskCache(res.data);
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task submitted for review');
    },
    onError: () => toast.error('Failed to submit task'),
  });

  type UserRow = { id: number; first_name: string; last_name: string; role: string };
  const assignableUsers = (users as UserRow[]).filter((u) =>
    ['staff', 'intern', 'project_manager'].includes(u.role)
  );

  const filtered = (tasks as Task[]).filter((t) => {
    const isCompleted = t.status === 'completed';
    const tabMatch = activeTab === 'completed' ? isCompleted : !isCompleted;
    const searchMatch =
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      (t.assignee && `${t.assignee.first_name} ${t.assignee.last_name}`.toLowerCase().includes(search.toLowerCase()));
    return tabMatch && searchMatch;
  });

  const canCreate = !['client', 'staff', 'intern'].includes(user?.role ?? '');
  const isStaffOrIntern = ['staff', 'intern'].includes(user?.role ?? '');

  const createConflict = findSchedulingConflict(tasks as Task[], form.assignee_id, form.start_date, form.deadline);
  const editConflict = editTask
    ? findSchedulingConflict(tasks as Task[], editForm.assignee_id, editForm.start_date, editForm.deadline, editTask.id)
    : undefined;

  const conflictMessage = (conflict: Task) => {
    const name = conflict.assignee ? `${conflict.assignee.first_name} ${conflict.assignee.last_name}` : 'This user';
    return `${name} already has "${conflict.title}" scheduled from ${fmtDateTime(conflict.start_date)} to ${fmtDateTime(conflict.deadline)}.`;
  };

  const openEdit = (task: Task) => {
    setEditForm({
      title: task.title,
      description: task.description ?? '',
      project_id: String(task.project_id),
      assignee_id: task.assignee_id ? String(task.assignee_id) : '',
      priority: task.priority,
      start_date: toDatetimeLocalValue(task.start_date),
      deadline: toDatetimeLocalValue(task.deadline),
      status: task.status,
      working_hours: task.working_hours ? String(task.working_hours) : '',
      working_minutes: task.working_minutes ? String(task.working_minutes) : '',
    });
    setEditTask(task);
  };

  return (
    <div>
      <Header title="All Tasks" />
      <div className="p-6 space-y-4">

        {/* Top bar */}
        <div className="flex items-center justify-between gap-4">
          <Input
            placeholder="Search task or staff..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <div className="flex items-center gap-2">
            {canCreate && (
              <Dialog open={createOpen} onOpenChange={(v) => { setCreateOpen(v); if (!v) resetForm(); }}>
                <DialogTrigger render={<Button size="sm" />}>
                  <Plus className="w-4 h-4 mr-1" /> New Task
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader><DialogTitle>Create Task</DialogTitle></DialogHeader>
                  <div className="space-y-3 mt-2">
                    <div className="space-y-1">
                      <Label>Title <span className="text-destructive">*</span></Label>
                      <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Description</Label>
                      <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Project <span className="text-destructive">*</span></Label>
                        <Select value={form.project_id ?? ''} onValueChange={(v) => setForm({ ...form, project_id: v as string })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select...">
                              {(v: string | null) => (projects as { id: number; name: string }[]).find((p) => String(p.id) === v)?.name ?? 'Select...'}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {(projects as { id: number; name: string }[]).map((p) => (
                              <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>Priority</Label>
                        <Select value={form.priority ?? ''} onValueChange={(v) => setForm({ ...form, priority: v as string })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {TASK_PRIORITIES.map((p) => (
                              <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Status</Label>
                        <Select value={form.status ?? ''} onValueChange={(v) => setForm({ ...form, status: v as string })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {TASK_STATUSES.map((s) => (
                              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>Assign To</Label>
                        <Select value={form.assignee_id ?? ''} onValueChange={(v) => setForm({ ...form, assignee_id: v as string })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select...">
                              {(v: string | null) => {
                                const u = assignableUsers.find((au) => String(au.id) === v);
                                return u ? `${u.first_name} ${u.last_name}` : 'Select...';
                              }}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {assignableUsers.map((u) => (
                              <SelectItem key={u.id} value={String(u.id)}>
                                {u.first_name} {u.last_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Start Date</Label>
                        <Input type="datetime-local" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <Label>Deadline</Label>
                        <Input type="datetime-local" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>Estimated Time</Label>
                      <div className="flex gap-2 items-center">
                        <Input type="number" min="0" placeholder="Hours" value={form.working_hours} onChange={(e) => setForm({ ...form, working_hours: e.target.value })} />
                        <span className="text-sm text-muted-foreground shrink-0">h</span>
                        <Input type="number" min="0" max="59" placeholder="Minutes" value={form.working_minutes} onChange={(e) => setForm({ ...form, working_minutes: e.target.value })} />
                        <span className="text-sm text-muted-foreground shrink-0">m</span>
                      </div>
                    </div>
                    {createConflict && (
                      <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{conflictMessage(createConflict)}</span>
                      </div>
                    )}
                    <div className="flex gap-2 pt-1">
                      <Button
                        className="flex-1"
                        disabled={!form.title || !form.project_id || !!createConflict || createMutation.isPending}
                        onClick={() => createMutation.mutate({
                          title: form.title,
                          description: form.description || undefined,
                          project_id: Number(form.project_id),
                          assignee_id: form.assignee_id ? Number(form.assignee_id) : undefined,
                          priority: form.priority,
                          status: form.status,
                          start_date: form.start_date || undefined,
                          deadline: form.deadline || undefined,
                          working_hours: form.working_hours ? Number(form.working_hours) : undefined,
                          working_minutes: form.working_minutes ? Number(form.working_minutes) : undefined,
                        })}
                      >
                        {createMutation.isPending ? 'Creating...' : 'Create'}
                      </Button>
                      <Button variant="outline" onClick={() => { setCreateOpen(false); resetForm(); }}>Cancel</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex rounded-lg border overflow-hidden">
          <button
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${activeTab === 'active' ? 'bg-white text-foreground shadow-sm' : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'}`}
            onClick={() => setActiveTab('active')}
          >
            Active Tasks
          </button>
          <button
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${activeTab === 'completed' ? 'bg-white text-foreground shadow-sm' : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'}`}
            onClick={() => setActiveTab('completed')}
          >
            Completed
          </button>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-16">No tasks found</p>
        ) : (
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/20">
                  <th className="text-left px-3 py-3 font-medium text-muted-foreground whitespace-nowrap">Project / Title</th>
                  <th className="text-left px-3 py-3 font-medium text-muted-foreground whitespace-nowrap">Status</th>
                  <th className="text-left px-3 py-3 font-medium text-muted-foreground whitespace-nowrap">Assignee</th>
                  <th className="text-left px-3 py-3 font-medium text-muted-foreground">Time Spent</th>
                  <th className="text-left px-3 py-3 font-medium text-muted-foreground">Start Date</th>
                  <th className="text-left px-3 py-3 font-medium text-muted-foreground">Deadline</th>
                  <th className="text-left px-3 py-3 font-medium text-muted-foreground">Working Hours</th>
                  <th className="text-left px-3 py-3 font-medium text-muted-foreground whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((task: Task) => (
                  <tr key={task.id} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                    {/* Project / Title Combined */}
                    <td className="px-3 py-4 align-top min-w-[180px] max-w-[260px]">
                      <div className="leading-snug whitespace-normal">
                        <p className="text-xs text-muted-foreground">Project: {task.project?.name || '—'}</p>
                        <p className="font-semibold mt-0.5">{task.title}</p>
                        {task.assigner && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            by {task.assigner.first_name} {task.assigner.last_name}
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-3 py-4 align-top whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[task.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {TASK_STATUSES.find((s) => s.value === task.status)?.label ?? task.status.replace(/_/g, ' ')}
                      </span>
                      {task.is_timer_running && (
                        <p className="text-xs text-orange-500 mt-1">Timer running</p>
                      )}
                    </td>

                    {/* Assignee — one word per line */}
                    <td className="px-3 py-4 align-top whitespace-normal">
                      {task.assignee ? (
                        <div className="leading-snug">
                          {`${task.assignee.first_name} ${task.assignee.last_name}`.trim().split(/\s+/).map((word, i) => (
                            <span key={i} className="block">{word}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Time Spent */}
                    <td className="px-3 py-4 align-top whitespace-nowrap">
                      <TimerCell
                        timeSpent={task.time_spent}
                        isRunning={task.is_timer_running}
                        timerStartTime={task.timer_start_time}
                      />
                    </td>

                    {/* Start Date */}
                    <td className="px-3 py-4 align-top whitespace-nowrap">
                      <p className="text-xs">{fmtDateTime(task.start_date)}</p>
                      {task.actual_start_time && (
                        <p className="text-xs text-green-600 mt-0.5">
                          Started: {fmtTime(task.actual_start_time)}
                        </p>
                      )}
                    </td>

                    {/* Deadline */}
                    <td className="px-3 py-4 align-top whitespace-nowrap">
                      <p className="text-xs">{fmtDateTime(task.deadline)}</p>
                      {task.timer_stopped_at && (
                        <p className="text-xs text-red-500 mt-0.5">
                          Ended: {fmtTime(task.timer_stopped_at)}
                        </p>
                      )}
                    </td>

                    {/* Working Hours */}
                    <td className="px-3 py-4 align-top whitespace-nowrap">
                      <span className="text-xs">{fmtWorkingHours(task.working_hours, task.working_minutes)}</span>
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-4 align-top">
                      {isStaffOrIntern ? (
                        <div className="flex items-center gap-1.5">
                          {/* Start / Stop timer */}
                          <button
                            onClick={() => timerMutation.mutate({ id: task.id, running: task.is_timer_running })}
                            disabled={
                              (timerMutation.isPending && timerMutation.variables?.id === task.id) ||
                              (!task.is_timer_running && !!task.deadline && new Date(task.deadline) < new Date())
                            }
                            title={task.is_timer_running ? 'Stop timer' : (!!task.deadline && new Date(task.deadline) < new Date()) ? 'Deadline has passed' : 'Start timer'}
                            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                              task.is_timer_running
                                ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                            }`}
                          >
                            {task.is_timer_running
                              ? <><Square className="w-3 h-3" /> Stop</>
                              : <><Play className="w-3 h-3" /> Start</>}
                          </button>
                          {/* Submit for review */}
                          <button
                            onClick={() => submitMutation.mutate(task)}
                            disabled={!!task.deadline && new Date(task.deadline) < new Date() || submitMutation.isPending}
                            title={!!task.deadline && new Date(task.deadline) < new Date() ? 'Deadline has passed' : 'Submit for review'}
                            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <CheckCheck className="w-3 h-3" /> Submit
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEdit(task)}
                            className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTask(task)}
                            className="p-1.5 rounded hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-600"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      {editTask && (
        <Dialog open={!!editTask} onOpenChange={(v) => { if (!v) setEditTask(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Edit Task</DialogTitle></DialogHeader>
            <div className="space-y-3 mt-2">
              <div className="space-y-1">
                <Label>Title <span className="text-destructive">*</span></Label>
                <Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Description</Label>
                <Textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Project</Label>
                  <Select value={editForm.project_id ?? ''} onValueChange={(v) => setEditForm({ ...editForm, project_id: v as string })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select...">
                        {(v: string | null) => (projects as { id: number; name: string }[]).find((p) => String(p.id) === v)?.name ?? 'Select...'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(projects as { id: number; name: string }[]).map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Priority</Label>
                  <Select value={editForm.priority ?? ''} onValueChange={(v) => setEditForm({ ...editForm, priority: v as string })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TASK_PRIORITIES.map((p) => (
                        <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Status</Label>
                  <Select value={editForm.status ?? ''} onValueChange={(v) => setEditForm({ ...editForm, status: v as string })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TASK_STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Assign To</Label>
                  <Select value={editForm.assignee_id ?? ''} onValueChange={(v) => setEditForm({ ...editForm, assignee_id: v as string })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select...">
                        {(v: string | null) => {
                          const u = assignableUsers.find((au) => String(au.id) === v);
                          return u ? `${u.first_name} ${u.last_name}` : 'Select...';
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {assignableUsers.map((u) => (
                        <SelectItem key={u.id} value={String(u.id)}>
                          {u.first_name} {u.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Start Date</Label>
                  <Input type="datetime-local" value={editForm.start_date} onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Deadline</Label>
                  <Input type="datetime-local" value={editForm.deadline} onChange={(e) => setEditForm({ ...editForm, deadline: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Estimated Time</Label>
                <div className="flex gap-2 items-center">
                  <Input type="number" min="0" placeholder="Hours" value={editForm.working_hours} onChange={(e) => setEditForm({ ...editForm, working_hours: e.target.value })} />
                  <span className="text-sm text-muted-foreground shrink-0">h</span>
                  <Input type="number" min="0" max="59" placeholder="Minutes" value={editForm.working_minutes} onChange={(e) => setEditForm({ ...editForm, working_minutes: e.target.value })} />
                  <span className="text-sm text-muted-foreground shrink-0">m</span>
                </div>
              </div>
              {editConflict && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{conflictMessage(editConflict)}</span>
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <Button
                  className="flex-1"
                  disabled={!editForm.title || !!editConflict || updateMutation.isPending}
                  onClick={() => updateMutation.mutate({
                    id: editTask.id,
                    data: {
                      title: editForm.title,
                      description: editForm.description || undefined,
                      project_id: editForm.project_id ? Number(editForm.project_id) : undefined,
                      assignee_id: editForm.assignee_id ? Number(editForm.assignee_id) : undefined,
                      priority: editForm.priority,
                      status: editForm.status,
                      start_date: editForm.start_date || undefined,
                      deadline: editForm.deadline || undefined,
                      working_hours: editForm.working_hours ? Number(editForm.working_hours) : undefined,
                      working_minutes: editForm.working_minutes ? Number(editForm.working_minutes) : undefined,
                    },
                  })}
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button variant="outline" onClick={() => setEditTask(null)}>Cancel</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteTask && (
        <Dialog open={!!deleteTask} onOpenChange={(v) => { if (!v) setDeleteTask(null); }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>Delete Task</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground mt-1">
              Are you sure you want to delete <span className="font-medium text-foreground">{deleteTask.title}</span>? This action cannot be undone.
            </p>
            <div className="flex gap-2 mt-4">
              <Button
                variant="destructive"
                className="flex-1"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleteTask.id)}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Yes, Delete'}
              </Button>
              <Button variant="outline" onClick={() => setDeleteTask(null)}>Cancel</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
