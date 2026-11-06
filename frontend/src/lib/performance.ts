import { addDays, endOfWeek, format, isSameDay, isValid, parseISO, startOfWeek } from 'date-fns';
import api from '@/lib/api';

// Performance page (KPIs, leaderboard, attendance). Shapes match
// app/Http/Controllers/Api/PerformanceController.php.

export type Board = 'staff' | 'pm';
export type PerfTab = 'overview' | 'kpi' | 'leaderboard' | 'attendance';
export type Range = { from: string; to: string }; // YYYY-MM-DD

export type PersonRef = { id: number; name: string; role: string };

export type Measure = {
  value: number | null;
  score: number | null;
  weight: number;
  ok?: number;
  total?: number;
  sent_back?: number;
  late?: number;
  missed?: number;
};

export type BoardRow = {
  user: PersonRef;
  score: number | null;
  rank: number | null;
  ranked: boolean;
  tasks: number;
  movement: number | null;
  measures: Record<string, Measure>;
};

export type CheckStatus = 'pending' | 'answered' | 'late' | 'missed' | 'skipped';

export type DayCheck = { date: string; sent_at: string; status: CheckStatus | null; responded_at: string | null };

export type TodaySummary = {
  date: string;
  working_day: boolean;
  sent_at: string | null;
  answer_by?: string;
  late_until?: string;
  expected?: number;
  answered?: number;
  waiting?: number;
  missed?: number;
  skipped?: number;
  rows?: { id: number; user: PersonRef; status: CheckStatus; responded_at: string | null }[];
};

export type Overview = Range & {
  on_time: { pct: number | null; ok: number; total: number };
  today: TodaySummary;
  missed_unreviewed: number;
  top: BoardRow[];
  people: BoardRow[];
};

export type Leaderboard = Range & {
  board: Board;
  weights: Record<string, number>;
  min_tasks: number;
  rows: BoardRow[];
  me: (BoardRow & { lift: string | null }) | null;
  my_attendance: { days: DayCheck[]; rate: number | null } | null;
};

export type Flag = {
  id: number;
  user: PersonRef;
  date: string;
  sent_at: string | null;
  late_until: string | null;
  misses_this_week: number;
};

export type AttendanceWeek = Range & {
  days: { date: string; sent_at: string }[];
  people: { user: PersonRef; cells: Record<string, { status: CheckStatus; responded_at: string | null }>; rate: number | null }[];
  flags: Flag[];
};

export type MissedDeadline = {
  id: number;
  title: string;
  project: string | null;
  deadline: string;
  cause: string | null;
  extension: { status: string; requested_deadline: string | null } | null;
};

export type PersonView = Range & {
  user: PersonRef;
  board: Board | null;
  row: (BoardRow & { lift: string | null }) | null;
  history: { from: string; to: string; rank: number | null; score: number | null }[];
  attendance: { days: DayCheck[]; rate: number | null } | null;
  missed_deadlines: MissedDeadline[];
};

export type MyCheck = {
  id: number;
  status: CheckStatus;
  sent_at: string;
  answer_by: string;
  late_until: string;
  responded_at: string | null;
  server_now: string;
};

export const performanceApi = {
  overview: (r: Range) => api.get<Overview>('/performance/overview', { params: r }).then((x) => x.data),
  leaderboard: (board: Board, r: Range) => api.get<Leaderboard>('/performance/leaderboard', { params: { board, ...r } }).then((x) => x.data),
  today: () => api.get<TodaySummary>('/performance/attendance/today').then((x) => x.data),
  attendance: (r: Range) => api.get<AttendanceWeek>('/performance/attendance', { params: r }).then((x) => x.data),
  person: (id: number, r: Range) => api.get<PersonView>(`/performance/people/${id}`, { params: r }).then((x) => x.data),
  myCheck: () => api.get<{ check: MyCheck | null }>('/attendance/me').then((x) => x.data.check),
  respond: (id: number) => api.post<{ status: CheckStatus; responded_at: string }>(`/attendance/checks/${id}/respond`).then((x) => x.data),
  review: (id: number) => api.post(`/attendance/checks/${id}/review`).then((x) => x.data),
};

// Everyone except Team Leads answers the daily check (decided 2026-11-06).
export const CHECKED_ROLES = ['operations_manager', 'project_manager', 'customer_support_officer', 'staff', 'intern'];

const ymd = (d: Date) => format(d, 'yyyy-MM-dd');

/** Monday to Sunday of the current week. */
export function thisWeek(now = new Date()): Range {
  return { from: ymd(startOfWeek(now, { weekStartsOn: 1 })), to: ymd(endOfWeek(now, { weekStartsOn: 1 })) };
}

export function validDate(s: string | null): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && isValid(parseISO(s));
}

/** "This week · Oct 26 – Nov 1, 2026", or just the dates for other ranges. */
export function rangeLabel(r: Range, short = false): string {
  const from = parseISO(r.from);
  const to = parseISO(r.to);
  const sameYear = from.getFullYear() === to.getFullYear();
  const dates = `${format(from, sameYear ? 'MMM d' : 'MMM d, yyyy')} – ${format(to, short ? 'MMM d' : 'MMM d, yyyy')}`;
  const week = thisWeek();
  if (r.from === week.from && r.to === week.to) return `This week · ${dates}`;
  const last = { from: ymd(addDays(parseISO(week.from), -7)), to: ymd(addDays(parseISO(week.to), -7)) };
  if (r.from === last.from && r.to === last.to) return `Last week · ${dates}`;
  return dates;
}

/** "this week" / "last week" / "this period", for sentences. */
export function periodWord(r: Range): string {
  const week = thisWeek();
  if (r.from === week.from && r.to === week.to) return 'this week';
  if (isSameDay(addDays(parseISO(r.from), 7), parseISO(week.from)) && isSameDay(addDays(parseISO(r.to), 7), parseISO(week.to))) return 'last week';
  return 'this period';
}

export const ROLE_LABEL: Record<string, string> = {
  operations_manager: 'Operations Manager',
  team_lead: 'Team Lead',
  project_manager: 'Project manager',
  customer_support_officer: 'Customer support',
  staff: 'Staff',
  intern: 'Intern',
};

export const roleName = (role: string) => ROLE_LABEL[role] ?? role.replace(/_/g, ' ');

export const MEASURE_LABEL: Record<string, string> = {
  on_time: 'On-time delivery',
  first_time: 'First-time approval',
  estimate: 'Estimate accuracy',
  attendance: 'Attendance',
  team_on_time: 'Team on-time',
  on_schedule: 'Projects on schedule',
  decision_speed: 'Decision speed',
  client_rating: 'Client rating',
};

/** Column headings for the board tables, in board order. */
export const BOARD_COLUMNS: Record<Board, { key: string; label: string }[]> = {
  staff: [
    { key: 'on_time', label: 'On time' },
    { key: 'first_time', label: 'First-time OK' },
    { key: 'estimate', label: 'Estimate' },
    { key: 'attendance', label: 'Attendance' },
  ],
  pm: [
    { key: 'team_on_time', label: 'Team on time' },
    { key: 'on_schedule', label: 'On schedule' },
    { key: 'decision_speed', label: 'Decisions' },
    { key: 'client_rating', label: 'Client rating' },
    { key: 'estimate', label: 'Estimate' },
  ],
};

/** A measure's value as shown in tables: "88%", "3.5h", or "—". */
export function measureText(key: string, m: Measure | undefined): string {
  if (!m || m.value === null || m.value === undefined) return '—';
  return key === 'decision_speed' ? `${m.value}h` : `${m.value}%`;
}

export function scoreFormula(board: Board): string {
  return board === 'pm'
    ? 'Score = team on-time 35% · projects on schedule 20% · decision speed 20% · client rating 15% · estimate quality 10%'
    : 'Score = on-time 40% · first-time approval 25% · estimate accuracy 15% · attendance 20%';
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The one-line reason under each bar in "How the score is made". */
export function measureReason(key: string, m: Measure, lift: boolean, lateDays: string[]): string {
  if (m.value === null) return 'No data in this period yet';
  switch (key) {
    case 'on_time':
    case 'team_on_time':
      return `${m.ok} of ${plural(m.total ?? 0, 'task')} submitted by the deadline`;
    case 'first_time':
      return m.sent_back ? `${plural(m.sent_back, 'task')} sent back for changes` : 'Every reviewed task approved first time';
    case 'estimate': {
      const off = m.value - 100;
      if (Math.abs(off) <= 5) return 'Logged time almost exactly matches estimates';
      return off > 0 ? `Logged ${off}% more time than estimated` : `Logged ${-off}% less time than estimated`;
    }
    case 'attendance': {
      const parts = [];
      if (m.late) parts.push(`${m.late === 1 ? 'One' : m.late} late ${m.late === 1 ? 'answer' : 'answers'}${lateDays.length ? ` (${lateDays.join(', ')})` : ''}`);
      if (m.missed) parts.push(`${plural(m.missed, 'missed check')}`);
      const text = parts.length ? parts.join(', ') : 'Every check answered on time';
      return lift && parts.length ? `${text} — the biggest lift available` : text;
    }
    case 'on_schedule':
      return `${m.ok} of ${plural(m.total ?? 0, 'project')} on schedule`;
    case 'decision_speed':
      return `Median ${m.value}h from submit or request to a decision`;
    case 'client_rating':
      return `${m.value}% of client feedback satisfied`;
  }
  return '';
}

export const MISS_CAUSE: Record<string, string> = {
  late_start: 'Late start',
  over_estimate: 'Over estimate',
  waited_on_extension: 'Waited on extension',
  not_started: 'Not started',
  manager_change: 'Manager change',
};

/** "Mon" for a YYYY-MM-DD date. */
export const weekday = (date: string) => format(parseISO(date), 'EEE');
