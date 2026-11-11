import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date | undefined | null, fmt = 'MMM d, yyyy'): string {
  if (!date) return '—';
  return format(new Date(date), fmt);
}

// Converts a stored ISO timestamp (UTC) to the value a `datetime-local`
// input expects, expressed in the browser's local time — not a raw string
// slice, which would show the UTC wall-clock time instead of local time.
export function toDatetimeLocalValue(date: string | Date | undefined | null): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function timeAgo(date: string | Date | undefined | null): string {
  if (!date) return '—';
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function formatSeconds(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function getInitials(firstName?: string, lastName?: string): string {
  return `${(firstName?.[0] ?? '').toUpperCase()}${(lastName?.[0] ?? '').toUpperCase()}`;
}

const DOMAIN_WARNING_DAYS = 30;
export function domainExpiryStatus(expiresAt?: string): 'expired' | 'expiring' | null {
  if (!expiresAt) return null;
  const daysLeft = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
  if (daysLeft < 0) return 'expired';
  if (daysLeft <= DOMAIN_WARNING_DAYS) return 'expiring';
  return null;
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-purple-100 text-purple-800',
    blocked: 'bg-red-100 text-red-800',
    review: 'bg-indigo-100 text-indigo-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    open: 'bg-yellow-100 text-yellow-800',
    resolved: 'bg-blue-100 text-blue-800',
    closed: 'bg-gray-100 text-gray-800',
    on_hold: 'bg-orange-100 text-orange-800',
    cancelled: 'bg-red-100 text-red-800',
    archived: 'bg-gray-100 text-gray-800',
  };
  return map[status] ?? 'bg-gray-100 text-gray-800';
}

export function priorityColor(priority: string): string {
  const map: Record<string, string> = {
    low: 'bg-gray-100 text-gray-700',
    medium: 'bg-blue-100 text-blue-700',
    high: 'bg-orange-100 text-orange-700',
    urgent: 'bg-red-100 text-red-700',
  };
  return map[priority] ?? 'bg-gray-100 text-gray-700';
}

export function roleLabel(role: string): string {
  const map: Record<string, string> = {
    operations_manager: 'Operations Manager',
    team_lead: 'Team Lead',
    project_manager: 'Project Manager',
    staff: 'Staff',
    intern: 'Intern',
    customer_support_officer: 'Customer Support',
    client: 'Client',
  };
  return map[role] ?? role;
}
