import { isAxiosError } from 'axios';
import { format } from 'date-fns';
import api from '@/lib/api';
import type { StatusTone } from '@/components/wc';

// Redesigned task screens: API calls, types and formatting
// (design/HANDOFF_SPEC.md §7; backend rules in app/Http/Controllers/Api/TaskController.php).

export type Person = { id: number; name: string };

export type TaskListItem = {
  id: number;
  title: string;
  status: string;
  priority: string;
  project: { id: number; name: string } | null;
  assignee: Person | null;
  assigned_by: Person | null;
  start_date: string | null;
  deadline: string | null;
  estimate_minutes: number;
  logged_seconds: number;
  is_timer_running: boolean;
  timer_start_time: string | null;
  /** The timer has run at least once. */
  has_been_started?: boolean;
  has_instructions: boolean;
  instructions_preview: string | null;
  pending_extension: boolean;
  lock_early_start: boolean;
};

export type TaskPage = { data: TaskListItem[]; meta: { total: number; page: number; per_page: number; last_page: number } };

export type ManagerTab = 'all' | 'mine';
export type StaffTab = 'active' | 'completed';
export type ListParams = {
  tab: ManagerTab | StaffTab | 'all';
  /** Home's Active / Completed toggle */
  state?: 'active' | 'completed';
  q?: string;
  from?: string;
  to?: string;
  status?: string;
  /** Tasks of one project (project detail) */
  project_id?: number;
  page: number;
};

/** GET /home (app/Http/Controllers/Api/HomeController.php) */
export type HomeData = {
  status_counts: Record<'in_progress' | 'pending' | 'todo' | 'review' | 'technical_support' | 'deadline_missed', number>;
  needs?: { key: string; count: number; label: string; detail: string; href: string }[];
  pipeline?: Record<'active' | 'pending' | 'completed', { total: number; items: { id: number; name: string; category: string; flag?: string | null }[] }>;
  current?: TaskListItem | null;
  extension?: { id: number; task_title: string; from: string | null; requested: string | null; status: 'pending' | 'approved' | 'declined' } | null;
};

export type ExtensionRequest = {
  id: number;
  task_id: number;
  requester_id: number;
  reason: string;
  requested_deadline: string;
  approved_deadline: string | null;
  status: 'pending' | 'approved' | 'rejected';
  decision_reason: string | null;
  decided_at?: string | null;
  created_at: string;
  task?: { id: number; title: string; deadline: string | null; project?: { id: number; name: string } | null } | null;
  requester?: { id: number; first_name: string; last_name: string } | null;
  decider?: { id: number; first_name: string; last_name: string } | null;
};

/** GET /tasks/{id}: the full task plus panel extras. */
export type TaskDetail = {
  id: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  project_id: number;
  project?: { id: number; name: string } | null;
  assignee_id: number | null;
  assignee?: { id: number; first_name: string; last_name: string } | null;
  assigner?: { id: number; first_name: string; last_name: string } | null;
  start_date: string | null;
  deadline: string | null;
  working_hours: number | null;
  working_minutes: number | null;
  is_timer_running: boolean;
  lock_early_start: boolean;
  estimate_minutes: number;
  logged_seconds: number;
  has_instructions: boolean;
  pending_extension: ExtensionRequest | null;
};

export type TaskEventItem = {
  id: number;
  type: string;
  actor: { id: number; name: string; role: string } | null;
  from: Record<string, unknown> | null;
  to: Record<string, unknown> | null;
  meta: Record<string, unknown> | null;
  created_at: string;
};

export type HistorySummary = {
  worked: { seconds: number; sessions: number };
  start: { state: 'not_started' | 'started' | 'early' | 'on_time' | 'late'; minutes: number | null };
  finish: {
    state: 'early' | 'late' | 'over_estimate' | 'within_estimate' | 'no_estimate';
    minutes: number | null;
    logged_minutes: number;
    estimate_minutes: number;
  };
  changes: { edits: number; extension: 'pending' | 'approved' | 'declined' | null };
};

export type HistoryFilter = 'all' | 'sessions' | 'edits' | 'deadlines';

/** A refusal from the task rules, with what the UI should do next. */
export type RuleError = {
  code: string;
  message: string;
  instructions?: string;
  scheduled_start?: string;
  opens_at?: string;
  clash?: { id: number; title: string; deadline: string | null } | null;
};

export function ruleError(err: unknown): RuleError | null {
  if (isAxiosError(err) && err.response?.data && typeof err.response.data === 'object' && 'code' in err.response.data) {
    return err.response.data as RuleError;
  }
  return null;
}

/** The message to show for any failed task request. */
export function errorText(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const data = err.response?.data as { message?: string; errors?: Record<string, string[]> } | undefined;
    const first = data?.errors ? Object.values(data.errors)[0]?.[0] : undefined;
    return first ?? data?.message ?? fallback;
  }
  return fallback;
}

export const homeApi = {
  get: () => api.get<HomeData>('/home').then((r) => r.data),
};

export const taskApi = {
  list: (p: ListParams) =>
    api.get<TaskPage>('/tasks', { params: { ...p, q: p.q || undefined, from: p.from || undefined, to: p.to || undefined } }).then((r) => r.data),
  all: () => api.get<TaskDetail[]>('/tasks').then((r) => r.data),
  get: (id: number) => api.get<TaskDetail>(`/tasks/${id}`).then((r) => r.data),
  events: (id: number, type: HistoryFilter) =>
    api.get<{ data: TaskEventItem[]; summary: HistorySummary }>(`/tasks/${id}/events`, { params: { type } }).then((r) => r.data),
  create: (data: Record<string, unknown>) => api.post('/tasks', data),
  update: (id: number, data: Record<string, unknown>) => api.patch(`/tasks/${id}`, data),
  remove: (id: number) => api.delete(`/tasks/${id}`),
  start: (id: number, confirm: { confirm_read?: boolean; confirm_early?: boolean } = {}) => api.post(`/tasks/${id}/timer/start`, confirm),
  stop: (id: number) => api.post(`/tasks/${id}/timer/stop`),
  submit: (id: number) => api.post(`/tasks/${id}/submit`),
  approve: (id: number) => api.post(`/tasks/${id}/approve`),
  sendBack: (id: number, reason?: string) => api.post(`/tasks/${id}/send-back`, { reason }),
  readInstructions: (id: number) => api.post(`/tasks/${id}/instructions/read`),
  extensions: () => api.get<ExtensionRequest[]>('/deadline-requests').then((r) => r.data),
  requestExtension: (id: number, data: { requested_deadline: string; reason: string }) => api.post(`/tasks/${id}/extension-requests`, data),
  decideExtension: (taskId: number, reqId: number, status: 'approved' | 'declined') =>
    api.patch(`/tasks/${taskId}/extension-requests/${reqId}`, { status }),
  exportFile: (fmt: 'xlsx' | 'csv', p: Omit<ListParams, 'page'>) =>
    api.get<Blob>('/tasks/export', { params: { ...p, format: fmt, q: p.q || undefined, from: p.from || undefined, to: p.to || undefined }, responseType: 'blob' }),
  exportRows: (p: Omit<ListParams, 'page'>) =>
    api
      .get<{ header: string[]; rows: string[][]; filename: string }>('/tasks/export', {
        params: { ...p, format: 'json', q: p.q || undefined, from: p.from || undefined, to: p.to || undefined },
      })
      .then((r) => r.data),
};

// ── Formatting ─────────────────────────────────────────────────────────

/** "Oct 26, 1:01 PM" */
export function fmtWhen(iso: string | null | undefined): string {
  return iso ? format(new Date(iso), 'MMM d, h:mm a') : '—';
}

/** "1:01 PM" */
export function fmtTime(iso: string | null | undefined): string {
  return iso ? format(new Date(iso), 'h:mm a') : '';
}

/** Timer display: "03:02:43" */
export function fmtClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/** Estimates and spans: "2h", "2h 59m", "30 min", "—" */
export function fmtMinutes(minutes: number | null | undefined): string {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${m}m`;
  return h ? `${h}h` : `${m} min`;
}

const STATUS: Record<string, [string, StatusTone]> = {
  deadline_missed: ['Deadline missed', 'missed'],
  in_progress: ['In progress', 'pending'],
  on_hold: ['Paused', 'todo'],
  review: ['In review', 'review'],
  completed: ['Completed', 'done'],
  not_approved: ['Sent back', 'missed'],
};

export function statusInfo(status: string): { label: string; tone: StatusTone } {
  const [label, tone] = STATUS[status] ?? ['To do', 'todo'];
  return { label, tone };
}

/** Past the deadline the timer and Submit are locked until the deadline moves (the server enforces it too). */
export function deadlinePassed(t: { status: string; deadline: string | null }): boolean {
  return t.status !== 'completed' && !!t.deadline && new Date(t.deadline) <= new Date();
}

export const DEADLINE_PASSED = 'Deadline passed — ask for an extension to keep working.';

export function isMissed(t: { status: string; deadline: string | null }): boolean {
  return t.status === 'deadline_missed' || (!!t.deadline && t.status !== 'completed' && t.status !== 'review' && new Date(t.deadline) < new Date());
}

/** Office hours used to work out an estimate from a task's dates: 8am–6pm, Monday to Friday. */
export const WORK_DAY = { start: 8, end: 18, days: [1, 2, 3, 4, 5] };

/** Minutes of office time between two moments (0 if the end isn't after the start). */
export function workingMinutes(from: Date, to: Date): number {
  if (!(to > from)) return 0;
  let total = 0;
  const day = new Date(from);
  day.setHours(0, 0, 0, 0);
  while (day < to) {
    if (WORK_DAY.days.includes(day.getDay())) {
      const open = new Date(day);
      open.setHours(WORK_DAY.start, 0, 0, 0);
      const close = new Date(day);
      close.setHours(WORK_DAY.end, 0, 0, 0);
      const a = Math.max(open.getTime(), from.getTime());
      const b = Math.min(close.getTime(), to.getTime());
      if (b > a) total += b - a;
    }
    day.setDate(day.getDate() + 1);
  }
  return Math.round(total / 60_000);
}

/** Staff lists shade tasks the assignee hasn't worked on yet. */
export function notStarted(t: { status: string; has_been_started?: boolean; is_timer_running: boolean; logged_seconds: number }): boolean {
  return t.status !== 'completed' && !t.has_been_started && !t.is_timer_running && t.logged_seconds === 0;
}

/** Roles that manage tasks; matches User::MANAGER_ROLES on the server. */
export const MANAGER_ROLES = ['operations_manager', 'team_lead', 'project_manager', 'customer_support_officer'];

export function personName(u: { first_name?: string; last_name?: string } | null | undefined): string {
  return u ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() : '';
}
