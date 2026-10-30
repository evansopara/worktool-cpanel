'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import Header from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { projectsApi, tasksApi } from '@/lib/api';
import { Task } from '@/types';
import { formatDate, toDatetimeLocalValue } from '@/lib/utils';
import { toast } from 'sonner';
import Link from 'next/link';
import TimerCell from '@/components/tasks/TimerCell';
import { useTaskActions } from '@/components/task/useTaskActions';
import {
  CheckSquare, Hourglass, ListTodo, GitPullRequestArrow, Headphones,
  Pencil, Trash2, Play, Square, CheckCheck, ChevronDown, ChevronUp,
  Play as PlayIcon, Clock, CheckCircle2, AlertCircle,
} from 'lucide-react';

const TASK_STATUSES = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'todo', label: 'Todo' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'deadline_missed', label: 'Deadline Missed' },
  { value: 'completed', label: 'Completed' },
  { value: 'not_approved', label: 'Not Approved' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'technical_support', label: 'Technical Support' },
] as const;

const TASK_PRIORITIES = ['low', 'medium', 'high'] as const;

const STATUS_STYLES: Record<string, string> = {
  not_started: 'bg-slate-100 text-slate-600',
  todo: 'bg-gray-100 text-gray-600',
  pending: 'bg-orange-100 text-orange-700',
  in_progress: 'bg-blue-100 text-blue-700',
  review: 'bg-yellow-100 text-yellow-700',
  deadline_missed: 'bg-red-100 text-red-700',
  completed: 'bg-green-100 text-green-700',
  not_approved: 'bg-rose-100 text-rose-700',
  on_hold: 'bg-purple-100 text-purple-700',
  technical_support: 'bg-cyan-100 text-cyan-700',
};

const CATEGORY_LABELS: Record<string, string> = {
  website_development: 'website development',
  dpl_outright: 'dpl outright',
  dpl_partnership: 'dpl partnership',
  direct_marketing: 'direct marketing',
  support_maintenance: 'support maintenance',
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

type Project = {
  id: number;
  name: string;
  status: string;
  progress?: number;
  category?: string;
  updated_at?: string;
};

export default function DashboardPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  // Starting goes through the new task rules' prompts (read first, start early).
  const taskActions = useTaskActions();

  const [expandedStatus, setExpandedStatus] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [myTasksTab, setMyTasksTab] = useState<'active' | 'completed'>('active');
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [deleteTask, setDeleteTask] = useState<Task | null>(null);
  const [editForm, setEditForm] = useState({
    title: '', description: '', project_id: '', assignee_id: '', priority: 'medium',
    start_date: '', deadline: '', status: 'todo', working_hours: '', working_minutes: '',
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list().then((r) => r.data),
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => tasksApi.list().then((r) => r.data),
    refetchInterval: 5000,
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

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const tasksByProjectId = (tasks as Task[]).reduce<Record<number, Task[]>>((acc, t) => {
    (acc[t.project_id] ??= []).push(t);
    return acc;
  }, {});

  const activeTaskProjectIds = new Set(
    (tasks as Task[])
      .filter((t) => t.status === 'in_progress' || t.is_timer_running)
      .map((t) => t.project_id)
  );

  const timerRunningProjectIds = new Set(
    (tasks as Task[]).filter((t) => t.is_timer_running).map((t) => t.project_id)
  );

  const activeProjects = (projects as Project[]).filter((p) => activeTaskProjectIds.has(p.id));
  const completedProjects = (projects as Project[]).filter((p) => p.progress === 100);
  const completedIds = new Set(completedProjects.map((p) => p.id));
  const activeIds = new Set(activeProjects.map((p) => p.id));

  const pendingProjects = (projects as Project[]).filter((p) => {
    if (activeIds.has(p.id) || completedIds.has(p.id)) return false;
    const pt = tasksByProjectId[p.id] ?? [];
    if (pt.length === 0) return true;
    return pt.every((t) => new Date(t.updated_at) < sevenDaysAgo);
  });

  function projectActivityNote(p: Project): string {
    if (timerRunningProjectIds.has(p.id)) return 'Task timer running';
    const pt = tasksByProjectId[p.id] ?? [];
    if (pt.length === 0) return 'No tasks assigned';
    const allOld = pt.every((t) => new Date(t.updated_at) < sevenDaysAgo);
    if (allOld) return 'No work activity for 1+ week';
    return 'Recent team chat';
  }

  function activityNoteClass(note: string): string {
    if (note === 'Task timer running') return 'text-green-600';
    if (note === 'No tasks assigned') return 'text-orange-500';
    if (note.includes('No work activity')) return 'text-orange-500';
    return 'text-muted-foreground';
  }

  const inProgressTasks = (tasks as Task[]).filter((t) => t.status === 'in_progress');
  const todoTasks = (tasks as Task[]).filter((t) => t.status === 'todo');
  const reviewTasks = (tasks as Task[]).filter((t) => t.status === 'review');
  const techSupportTasks = (tasks as Task[]).filter((t) => t.status === 'technical_support');
  const pendingTasks = (tasks as Task[]).filter((t) => t.status === 'pending');

  const isStaffOrIntern = ['staff', 'intern'].includes(user?.role ?? '');

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

  const taskGroups = [
    {
      key: 'in_progress',
      label: 'Tasks in Progress',
      count: inProgressTasks.length,
      icon: CheckSquare,
      iconColor: 'text-blue-600',
      borderColor: 'border-blue-200',
      tasks: inProgressTasks,
    },
    {
      key: 'pending',
      label: 'Pending Tasks',
      count: pendingTasks.length,
      icon: Hourglass,
      iconColor: 'text-orange-600',
      borderColor: 'border-orange-200',
      tasks: pendingTasks,
    },
    {
      key: 'todo',
      label: 'Todo Tasks',
      count: todoTasks.length,
      icon: ListTodo,
      iconColor: 'text-gray-600',
      borderColor: 'border-gray-200',
      tasks: todoTasks,
    },
    {
      key: 'review',
      label: 'Tasks in Review',
      count: reviewTasks.length,
      icon: GitPullRequestArrow,
      iconColor: 'text-violet-600',
      borderColor: 'border-violet-200',
      tasks: reviewTasks,
    },
  ];

  return (
    <div>
      <Header title="Dashboard" />
      {taskActions.dialogs}
      <div className="p-6 space-y-8">

        {/* Project Status */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Project Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* Active Projects */}
            <div className="border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b bg-white">
                <div className="flex items-center gap-2">
                  <PlayIcon className="w-4 h-4 text-green-600" />
                  <span className="font-semibold text-green-700 text-sm">Active Projects</span>
                </div>
                <span className="text-sm font-semibold text-muted-foreground">{activeProjects.length}</span>
              </div>
              <div className="overflow-y-auto max-h-64 divide-y bg-white">
                {activeProjects.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No active projects</p>
                ) : (
                  activeProjects.map((p) => {
                    const note = projectActivityNote(p);
                    return (
                      <Link key={p.id} href="/dashboard/projects" className="block px-4 py-3 hover:bg-muted/30 transition-colors">
                        <p className="font-semibold text-sm leading-snug">{p.name}</p>
                        {p.category && (
                          <p className="text-xs text-muted-foreground mt-0.5">{CATEGORY_LABELS[p.category] ?? p.category}</p>
                        )}
                        <p className={`text-xs mt-0.5 italic ${activityNoteClass(note)}`}>{note}</p>
                      </Link>
                    );
                  })
                )}
              </div>
            </div>

            {/* Pending Projects */}
            <div className="border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b bg-white">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-yellow-600" />
                  <span className="font-semibold text-yellow-700 text-sm">Pending Projects</span>
                </div>
                <span className="text-sm font-semibold text-muted-foreground">{pendingProjects.length}</span>
              </div>
              <div className="overflow-y-auto max-h-64 divide-y bg-white">
                {pendingProjects.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No pending projects</p>
                ) : (
                  pendingProjects.map((p) => {
                    const note = projectActivityNote(p);
                    return (
                      <Link key={p.id} href="/dashboard/projects" className="block px-4 py-3 hover:bg-muted/30 transition-colors">
                        <p className="font-semibold text-sm leading-snug">{p.name}</p>
                        {p.category && (
                          <p className="text-xs text-muted-foreground mt-0.5">{CATEGORY_LABELS[p.category] ?? p.category}</p>
                        )}
                        <p className={`text-xs mt-0.5 italic ${activityNoteClass(note)}`}>{note}</p>
                      </Link>
                    );
                  })
                )}
              </div>
            </div>

            {/* Completed Projects */}
            <div className="border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b bg-white">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  <span className="font-semibold text-blue-700 text-sm">Completed Projects</span>
                </div>
                <span className="text-sm font-semibold text-muted-foreground">{completedProjects.length}</span>
              </div>
              <div className="overflow-y-auto max-h-64 divide-y bg-white">
                {completedProjects.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No completed projects</p>
                ) : (
                  completedProjects.map((p) => (
                    <Link key={p.id} href="/dashboard/projects" className="block px-4 py-3 hover:bg-muted/30 transition-colors">
                      <p className="font-semibold text-sm leading-snug">{p.name}</p>
                      {p.category && (
                        <p className="text-xs text-muted-foreground mt-0.5">{CATEGORY_LABELS[p.category] ?? p.category}</p>
                      )}
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Task Status */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Task Status</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {taskGroups.map((group) => {
              const Icon = group.icon;
              const isExpanded = expandedStatus === group.key;
              return (
                <div key={group.key} className={`border ${group.borderColor} rounded-xl overflow-hidden`}>
                  <div className="px-4 py-4 bg-white">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`w-5 h-5 ${group.iconColor}`} />
                      <span className={`font-semibold text-sm ${group.iconColor}`}>{group.label}</span>
                    </div>
                    <p className="text-3xl font-bold mt-1 mb-3">{group.count}</p>
                    <button
                      onClick={() => setExpandedStatus(isExpanded ? null : group.key)}
                      className="w-full flex items-center justify-between px-3 py-2 border rounded-lg text-sm text-muted-foreground hover:bg-muted/30 transition-colors"
                    >
                      <span>View Tasks</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="border-t divide-y max-h-64 overflow-y-auto bg-white">
                      {group.tasks.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">No tasks</p>
                      ) : (
                        group.tasks.map((task) => (
                          <div key={task.id} className="px-4 py-3">
                            <p className="text-sm font-medium leading-snug">{task.title}</p>
                            {task.project && (
                              <p className="text-xs text-muted-foreground mt-0.5">{task.project.name}</p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Technical Support */}
          {(['staff', 'intern'].includes(user?.role ?? '') || techSupportTasks.length > 0) && (
            <div className="mt-4">
              <div className="border border-pink-200 rounded-xl overflow-hidden">
                <div className="px-4 py-4 bg-white">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="w-5 h-5 text-pink-600" />
                    <span className="font-semibold text-sm text-pink-600">Technical Support</span>
                  </div>
                  <p className="text-3xl font-bold mt-1 mb-3">{techSupportTasks.length}</p>
                  {techSupportTasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No technical support tasks</p>
                  ) : (
                    <button
                      onClick={() => setExpandedStatus(expandedStatus === 'technical_support' ? null : 'technical_support')}
                      className="w-full flex items-center justify-between px-3 py-2 border rounded-lg text-sm text-muted-foreground hover:bg-muted/30 transition-colors"
                    >
                      <span>View Tasks</span>
                      {expandedStatus === 'technical_support' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  )}
                </div>
                {expandedStatus === 'technical_support' && techSupportTasks.length > 0 && (
                  <div className="border-t divide-y max-h-64 overflow-y-auto bg-white">
                    {techSupportTasks.map((task) => (
                      <div key={task.id} className="px-4 py-3">
                        <p className="text-sm font-medium leading-snug">{task.title}</p>
                        {task.project && (
                          <p className="text-xs text-muted-foreground mt-0.5">{task.project.name}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* My Tasks Table */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">My Tasks</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <Input
                placeholder="Search task or staff..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-56"
              />
              <Input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="w-40"
              />
              <span className="text-sm text-muted-foreground">to</span>
              <Input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="w-40"
              />
              {(filterDateFrom || filterDateTo) && (
                <button
                  onClick={() => { setFilterDateFrom(''); setFilterDateTo(''); }}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex rounded-lg border overflow-hidden">
            <button
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${myTasksTab === 'active' ? 'bg-white text-foreground shadow-sm' : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'}`}
              onClick={() => setMyTasksTab('active')}
            >
              Active Tasks
            </button>
            <button
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${myTasksTab === 'completed' ? 'bg-white text-foreground shadow-sm' : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'}`}
              onClick={() => setMyTasksTab('completed')}
            >
              Completed
            </button>
          </div>

          {(() => {
            const filtered = (tasks as Task[]).filter((t) => {
              const isCompleted = t.status === 'completed';
              if (myTasksTab === 'completed' ? !isCompleted : isCompleted) return false;
              if (search) {
                const q = search.toLowerCase();
                const nameMatch = t.title.toLowerCase().includes(q);
                const assigneeMatch = t.assignee
                  ? `${t.assignee.first_name} ${t.assignee.last_name}`.toLowerCase().includes(q)
                  : false;
                if (!nameMatch && !assigneeMatch) return false;
              }
              if (filterDateFrom || filterDateTo) {
                const deadline = t.deadline ? t.deadline.slice(0, 10) : null;
                const start = t.start_date ? t.start_date.slice(0, 10) : null;
                const inRange = (d: string | null) => {
                  if (!d) return false;
                  if (filterDateFrom && d < filterDateFrom) return false;
                  if (filterDateTo && d > filterDateTo) return false;
                  return true;
                };
                if (!inRange(deadline) && !inRange(start)) return false;
              }
              return true;
            });
            return filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">No tasks found</p>
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
                      <td className="px-3 py-4 align-top whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[task.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {TASK_STATUSES.find((s) => s.value === task.status)?.label ?? task.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      {/* Assignee — one word per line */}
                      <td className="px-3 py-4 align-top">
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
                      <td className="px-3 py-4 align-top whitespace-nowrap">
                        <TimerCell
                          timeSpent={task.time_spent}
                          isRunning={task.is_timer_running}
                          timerStartTime={task.timer_start_time}
                        />
                      </td>
                      <td className="px-3 py-4 align-top whitespace-nowrap">
                        <p className="text-xs">{fmtDateTime(task.start_date)}</p>
                        {task.actual_start_time && (
                          <p className="text-xs text-green-600 mt-0.5">Started: {fmtTime(task.actual_start_time)}</p>
                        )}
                      </td>
                      <td className="px-3 py-4 align-top whitespace-nowrap">
                        <p className="text-xs">{fmtDateTime(task.deadline)}</p>
                        {task.timer_stopped_at && (
                          <p className="text-xs text-red-500 mt-0.5">Ended: {fmtTime(task.timer_stopped_at)}</p>
                        )}
                      </td>
                      <td className="px-3 py-4 align-top whitespace-nowrap">
                        <span className="text-xs">{fmtWorkingHours(task.working_hours, task.working_minutes)}</span>
                      </td>
                      <td className="px-3 py-4 align-top">
                        {isStaffOrIntern ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() =>
                                task.is_timer_running
                                  ? timerMutation.mutate({ id: task.id, running: true })
                                  : taskActions.start({
                                      id: task.id,
                                      title: task.title,
                                      deadline: task.deadline ?? null,
                                      estimateMinutes: (task.working_hours ?? 0) * 60 + (task.working_minutes ?? 0),
                                    })
                              }
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
                            <button
                              onClick={() => submitMutation.mutate(task)}
                              disabled={!!task.deadline && new Date(task.deadline) < new Date() || submitMutation.isPending}
                              title="Submit for review"
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
          );
          })()}
        </div>
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
                  <Select value={editForm.project_id} onValueChange={(v) => setEditForm({ ...editForm, project_id: v as string })}>
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
                  <Select value={editForm.priority} onValueChange={(v) => setEditForm({ ...editForm, priority: v as string })}>
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
                  <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v as string })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TASK_STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Deadline</Label>
                  <Input type="datetime-local" value={editForm.deadline} onChange={(e) => setEditForm({ ...editForm, deadline: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Start Date</Label>
                  <Input type="datetime-local" value={editForm.start_date} onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Estimated Time</Label>
                  <div className="flex gap-1.5 items-center">
                    <Input type="number" min="0" placeholder="h" value={editForm.working_hours} onChange={(e) => setEditForm({ ...editForm, working_hours: e.target.value })} />
                    <Input type="number" min="0" max="59" placeholder="m" value={editForm.working_minutes} onChange={(e) => setEditForm({ ...editForm, working_minutes: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  className="flex-1"
                  disabled={!editForm.title || updateMutation.isPending}
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

      {/* Delete Confirmation */}
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
