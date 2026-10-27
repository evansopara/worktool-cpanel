import { differenceInCalendarDays, format } from 'date-fns';
import api, { messagesApi, projectsApi } from '@/lib/api';
import type { Deliverable, Project, ProjectCategory, ProjectPlan, Resource } from '@/types';
import type { StatusTone } from '@/components/wc';

// Redesigned Projects pages (Projects / ProjectDetail / MProjects / MProject artboards).

export type ProjectFull = Project & {
  plans?: (ProjectPlan & { deliverables?: Deliverable[] })[];
  resources?: Resource[];
};

export type ChatMessage = {
  id: number;
  content: string;
  sender_id?: number;
  sender?: { id?: number; first_name: string; last_name: string };
  created_at: string;
};

export const CATEGORIES: { value: ProjectCategory; label: string; tile: string }[] = [
  { value: 'website_development', label: 'Website Development', tile: 'bg-yellow text-ink' },
  { value: 'dpl_outright', label: 'DPL Outright', tile: 'bg-ink text-yellow' },
  { value: 'dpl_partnership', label: 'DPL Partnership', tile: 'bg-review-tint text-review' },
  { value: 'direct_marketing', label: 'Direct Marketing', tile: 'bg-done-tint text-done' },
  { value: 'support_maintenance', label: 'Support & Maintenance', tile: 'bg-pending-tint text-pending' },
];

export function categoryOf(p: { category?: string | null }) {
  return CATEGORIES.find((c) => c.value === p.category);
}

export function categoryLabel(p: { category?: string | null }): string {
  return categoryOf(p)?.label ?? (p.category ? p.category.replace(/_/g, ' ') : 'Uncategorised');
}

const STATUS: Record<string, [string, StatusTone]> = {
  active: ['Active', 'review'],
  pending: ['Pending', 'pending'],
  completed: ['Completed', 'done'],
  inactive: ['Inactive', 'todo'],
};

export function projectStatus(p: Pick<Project, 'status' | 'progress'>): { label: string; tone: StatusTone } {
  // A project at 100% reads as completed, as on the old page's counters.
  if ((p.progress ?? 0) >= 100) return { label: 'Completed', tone: 'done' };
  const [label, tone] = STATUS[p.status] ?? ['Pending', 'pending'];
  return { label, tone };
}

export function isOverdue(p: Project, now: number): boolean {
  return !!p.end_date && new Date(p.end_date).getTime() < now && p.status !== 'inactive' && p.status !== 'completed' && (p.progress ?? 0) < 100;
}

/** The three counters at the top of Projects, with the old page's rules. */
export function projectHealth(projects: Project[], now: number) {
  return {
    overdue: projects.filter((p) => isOverdue(p, now)).length,
    urgent: projects.filter((p) => p.status === 'active' && new Date(p.updated_at).getTime() < now - 10 * 86400000).length,
    completedThisWeek: projects.filter((p) => (p.progress ?? 0) >= 100 && new Date(p.updated_at).getTime() >= now - 7 * 86400000).length,
  };
}

export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function fmtDay(iso?: string | null): string {
  return iso ? format(new Date(iso), 'MMM d, yyyy') : '—';
}

/** "Nov 3 – Nov 21, 2025" */
export function fmtRange(start?: string | null, end?: string | null): string {
  if (!start && !end) return '—';
  if (!start || !end) return fmtDay(start ?? end);
  const a = new Date(start);
  const b = new Date(end);
  return a.getFullYear() === b.getFullYear() ? `${format(a, 'MMM d')} – ${format(b, 'MMM d, yyyy')}` : `${fmtDay(start)} – ${fmtDay(end)}`;
}

export function durationDays(start?: string | null, end?: string | null): number | null {
  return start && end ? Math.max(0, differenceInCalendarDays(new Date(end), new Date(start))) : null;
}

/** Domain expiry on the detail page: expired, within 30 days, or fine. */
export function domainState(expires?: string | null, now = Date.now()): 'expired' | 'expiring' | null {
  if (!expires) return null;
  const t = new Date(expires).getTime();
  if (t < now) return 'expired';
  return t - now < 30 * 86400000 ? 'expiring' : null;
}

export const projectApi = {
  list: () => projectsApi.list().then((r) => r.data as Project[]),
  get: (id: number) => projectsApi.get(id).then((r) => r.data as ProjectFull),
  messages: (id: number) => messagesApi.projectMessages(id).then((r) => r.data as ChatMessage[]),
  send: (id: number, content: string) => messagesApi.sendProjectMessage(id, content),
  setDeliverableStatus: (projectId: number, planId: number, id: number, status: string) =>
    api.put(`/projects/${projectId}/plans/${planId}/deliverables/${id}`, { status }),
};
