'use client';

import { useEffect, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Download, Users } from 'lucide-react';
import jsPDF from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { useAuth } from '@/providers/AuthProvider';
import { departmentsApi, kpiReportApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button, StatusPill, Tabs, type StatusTone } from '@/components/wc';
import { PageBody, PageHeader } from '@/components/shell/PageHeader';

// KPI report (Operations Managers and Team Leads). Insights / KPI is not
// designed yet, so this restyles the old report with the shell's pieces.

const KPI_ROLES = ['operations_manager', 'team_lead'];

const RANGE_OPTIONS = [
  { value: 'last_7_days', label: 'Last 7 days' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'last_30_days', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom range' },
];

interface Employee {
  id: number;
  first_name: string;
  last_name: string;
  role: string;
  department?: string;
  effective_department?: string;
}

interface DailyDetail {
  date: string;
  total_span_seconds: number;
  tasks: string[];
  status: 'poor' | 'fair' | 'good';
}

interface ChartPoint {
  date: string;
  hours: number;
}

interface TaskBreakdown {
  title: string;
  status: string;
  estimated_minutes: number;
  actual_minutes: number;
  percentage: number;
}

interface Overview {
  total_working_days: number;
  active_days: number;
  average_daily_hours: number;
  productivity_score: number;
  unique_task_count: number;
}

interface StaffSummary {
  id: number;
  name: string;
  role: string;
  department?: string;
  total_hours: number;
  active_days: number;
  tasks_completed: number;
  tasks_in_progress: number;
  productivity_score: number;
}

interface KpiResponse {
  employees: Employee[];
  from: string;
  to: string;
  daily_details?: DailyDetail[];
  chart?: ChartPoint[];
  task_breakdown?: TaskBreakdown[];
  overview?: Overview;
  staff_summary?: StaffSummary;
}

const DAY_STATUS: Record<DailyDetail['status'], { label: string; tone: StatusTone; rule: string }> = {
  poor: { label: 'Poor', tone: 'missed', rule: 'Less than 2 hours worked' },
  fair: { label: 'Fair', tone: 'pending', rule: '2 to 4 hours worked' },
  good: { label: 'Good', tone: 'done', rule: '4 hours or more worked' },
};

const TASK_STATUS_LABELS: Record<string, string> = {
  not_started: 'Not started',
  todo: 'To do',
  in_progress: 'In progress',
  review: 'In review',
  deadline_missed: 'Deadline missed',
  completed: 'Completed',
  not_approved: 'Not approved',
  on_hold: 'On hold',
  pending: 'Pending',
  technical_support: 'Technical support',
};

function fmtHM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
}

function fmtHoursFromSeconds(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function fmtDateShort(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
}

function scoreColor(pct: number): string {
  return pct >= 100 ? 'text-done' : 'text-pending';
}

const field = 'h-12 w-full rounded-2xl border-0 bg-surface-2 px-4 font-ui text-[15px] normal-case tracking-normal font-normal text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink';
const fieldLabel = 'flex min-w-0 flex-col gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink-3';
const card = 'rounded-[26px] bg-surface p-5 lg:rounded-[28px] lg:p-7';

/** Hours per day: one series in ink, thin bars with rounded tops and a hover label. */
function DailyHoursChart({ chart }: { chart: ChartPoint[] }) {
  const maxHours = Math.max(1, ...chart.map((c) => c.hours));
  const labelStep = Math.max(1, Math.ceil(chart.length / 8));
  return (
    <figure className="m-0 flex flex-col gap-1.5">
      <div className="flex h-48 items-end gap-0.5 border-b border-line">
        {chart.map((point) => (
          <div key={point.date} className="group relative flex h-full flex-1 items-end justify-center">
            <div className="w-full max-w-6 rounded-t-[4px] bg-ink transition-opacity group-hover:opacity-80" style={{ height: `${Math.max(1, (point.hours / maxHours) * 100)}%` }} />
            <div className="pointer-events-none absolute -top-9 left-1/2 z-10 -translate-x-1/2 rounded-lg bg-ink px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-white opacity-0 shadow-float transition-opacity group-hover:opacity-100">
              {fmtDate(point.date)} · {point.hours}h
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-0.5">
        {chart.map((point, i) => (
          <div key={point.date} className="flex-1 text-center">
            {i % labelStep === 0 && <span className="text-[11px] text-ink-3">{fmtDateShort(point.date)}</span>}
          </div>
        ))}
      </div>
    </figure>
  );
}

export default function KpiReportPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<'daily' | 'score'>('daily');
  const [department, setDepartment] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  // Cached separately from the live `employees` list so the picker keeps
  // showing the chosen name even if a later fetch's list misses them.
  const [pickedEmployee, setPickedEmployee] = useState<Employee | null>(null);
  const [range, setRange] = useState('last_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  useEffect(() => {
    if (user && !KPI_ROLES.includes(user.role)) {
      router.replace('/dashboard');
    }
  }, [user, router]);

  const canView = !!user && KPI_ROLES.includes(user.role);

  const { data: departments = [] } = useQuery<string[]>({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.list().then((r) => r.data),
    enabled: canView,
  });

  const isCustomRange = range === 'custom';
  const customRangeReady = !isCustomRange || (!!customFrom && !!customTo);

  const { data, isLoading } = useQuery<KpiResponse>({
    queryKey: ['kpi-report', department, employeeId, range, customFrom, customTo],
    queryFn: () =>
      kpiReportApi
        .productivity({
          department: department || undefined,
          employee_id: employeeId || undefined,
          range,
          from: isCustomRange ? customFrom : undefined,
          to: isCustomRange ? customTo : undefined,
        })
        .then((r) => r.data),
    enabled: canView && customRangeReady,
    placeholderData: keepPreviousData,
  });

  // The backend already applies the department filter, so this list is pre-scoped.
  const employees = data?.employees ?? [];

  if (!canView) return null;

  const selectedEmployee =
    employees.find((e) => String(e.id) === employeeId) ?? (pickedEmployee && String(pickedEmployee.id) === employeeId ? pickedEmployee : undefined);
  const hasData = !!employeeId && !!data?.overview && !!data?.staff_summary;
  const chart = data?.chart ?? [];
  const summary = data?.staff_summary;
  const overview = data?.overview;

  const pickDepartment = (d: string) => {
    setDepartment(d);
    // The employee list is re-scoped; drop a pick from another department.
    setEmployeeId('');
    setPickedEmployee(null);
  };

  const exportPdf = () => {
    if (!data?.staff_summary || !data?.overview) return;
    const summary = data.staff_summary;
    const tasks = data.task_breakdown ?? [];

    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text('KPI Report', 14, 18);

    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`${summary.name}  ·  ${summary.role.replace(/_/g, ' ')}${summary.department ? '  ·  ' + summary.department : ''}`, 14, 26);
    doc.text(`Period: ${fmtDate(data.from)} - ${fmtDate(data.to)}`, 14, 32);

    doc.setTextColor(0);
    doc.setFontSize(10);
    const summaryLines = [
      `Total Hours: ${summary.total_hours}h`,
      `Active Days: ${summary.active_days}`,
      `Tasks Completed: ${summary.tasks_completed}`,
      `Tasks In Progress: ${summary.tasks_in_progress}`,
      `Productivity Score: ${summary.productivity_score}%`,
    ];
    summaryLines.forEach((line, i) => doc.text(line, 14, 42 + i * 6));

    const tableStartY = 42 + summaryLines.length * 6 + 6;
    if (tasks.length > 0) {
      autoTable(doc, {
        startY: tableStartY,
        head: [['Task', 'Status', 'Estimated', 'Actual', '%']],
        body: tasks.map((t) => [t.title, TASK_STATUS_LABELS[t.status] ?? t.status.replace(/_/g, ' '), fmtHM(t.estimated_minutes), fmtHM(t.actual_minutes), `${t.percentage}%`]),
        headStyles: { fillColor: [18, 18, 18] },
        styles: { fontSize: 9 },
      });
    } else {
      doc.setFontSize(10);
      doc.text('No tasks recorded in this period.', 14, tableStartY);
    }

    const fileSafeName = summary.name.trim().replace(/[^a-z0-9]+/gi, '_');
    doc.save(`kpi-report-${fileSafeName}-${data.from}-to-${data.to}.pdf`);
  };

  return (
    <PageBody className="gap-3.5 lg:gap-5">
      <PageHeader title="KPI report" description="Employee performance and productivity tracking" />

      <section aria-label="Filters" className={cn(card, 'grid gap-3.5 lg:grid-cols-3')}>
        <label className={fieldLabel}>
          Department
          <select value={department} onChange={(e) => pickDepartment(e.target.value)} className={field}>
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className={fieldLabel}>
          Employee
          <select
            value={employeeId}
            onChange={(e) => {
              setEmployeeId(e.target.value);
              setPickedEmployee(employees.find((x) => String(x.id) === e.target.value) ?? null);
            }}
            className={field}
          >
            <option value="">{employees.length ? 'Choose an employee' : 'No employees found'}</option>
            {/* Keep the picked person listed even if the latest list misses them. */}
            {selectedEmployee && !employees.some((x) => x.id === selectedEmployee.id) && (
              <option value={selectedEmployee.id}>
                {selectedEmployee.first_name} {selectedEmployee.last_name}
              </option>
            )}
            {employees.map((x) => (
              <option key={x.id} value={x.id}>
                {x.first_name} {x.last_name}
                {x.effective_department ? ` · ${x.effective_department}` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className={fieldLabel}>
          Date range
          <select value={range} onChange={(e) => setRange(e.target.value)} className={field}>
            {RANGE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        {isCustomRange && (
          <>
            <label className={fieldLabel}>
              From
              <input type="date" value={customFrom} max={customTo || undefined} onChange={(e) => setCustomFrom(e.target.value)} className={field} />
            </label>
            <label className={fieldLabel}>
              To
              <input type="date" value={customTo} min={customFrom || undefined} onChange={(e) => setCustomTo(e.target.value)} className={field} />
            </label>
            {!customRangeReady && <p className="m-0 self-end pb-3 text-[13px] text-ink-3">Pick both a start and end date.</p>}
          </>
        )}
      </section>

      {!employeeId ? (
        <div className="flex flex-col items-center gap-3 rounded-[28px] bg-surface px-6 py-14 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-stone text-ink-2">
            <Users className="size-6" aria-hidden="true" />
          </span>
          <p className="m-0 font-display text-2xl font-bold">Choose an employee</p>
          <p className="m-0 max-w-sm text-sm text-ink-3">Pick a department and an employee to see their KPI report and productivity.</p>
        </div>
      ) : isLoading || !hasData || !summary || !overview ? (
        <div className="flex flex-col gap-3.5">
          <div className="h-56 animate-pulse rounded-[28px] bg-surface" />
          <div className="h-64 animate-pulse rounded-[28px] bg-surface" />
        </div>
      ) : (
        <>
          <section aria-label="Summary" className="flex flex-wrap items-center gap-4 rounded-[28px] bg-ink p-5 text-white lg:gap-6 lg:p-7">
            <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-1">
              <h2 className="m-0 font-display text-[26px] leading-none font-bold tracking-[-0.03em] lg:text-[34px]">{summary.name}</h2>
              <p className="m-0 text-sm text-on-dark">
                <span className="capitalize">{summary.role.replace(/_/g, ' ')}</span>
                {summary.department ? ` · ${summary.department}` : ''} · {fmtDate(data!.from)} – {fmtDate(data!.to)}
              </p>
            </div>
            <Button variant="accent" onClick={exportPdf}>
              <Download strokeWidth={2.2} aria-hidden="true" />
              Export PDF
            </Button>
            <dl className="m-0 grid w-full grid-cols-2 gap-2.5 lg:grid-cols-4">
              {[
                { k: 'Total hours', v: `${summary.total_hours}h`, note: `${summary.active_days} active days` },
                { k: 'Tasks completed', v: String(summary.tasks_completed), note: 'in this period' },
                { k: 'In progress', v: String(summary.tasks_in_progress), note: 'tasks currently active' },
                { k: 'Productivity', v: `${summary.productivity_score}%`, note: 'estimate vs time logged', yellow: true },
              ].map((s) => (
                <div key={s.k} className="flex flex-col gap-1 rounded-[20px] bg-dark-1 p-4">
                  <dt className="text-[12.5px] font-semibold text-on-dark">{s.k}</dt>
                  <dd className={cn('m-0 font-display text-[32px] leading-none font-bold', s.yellow && 'text-yellow')}>{s.v}</dd>
                  <span className="text-xs text-on-dark-2">{s.note}</span>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="h-hours" className={cn(card, 'flex flex-col gap-4')}>
            <h2 id="h-hours" className="m-0 font-display text-[22px] font-bold tracking-[-0.02em] lg:text-[26px]">
              Daily hours
            </h2>
            {chart.every((c) => c.hours === 0) ? <p className="m-0 py-10 text-center text-sm text-ink-3">No time tracked in this period.</p> : <DailyHoursChart chart={chart} />}
          </section>

          <Tabs
            label="Report views"
            value={tab}
            onChange={setTab}
            items={[
              { value: 'daily', label: 'Daily details' },
              { value: 'score', label: 'Productivity score' },
            ]}
          />

          {tab === 'daily' && (
            <section aria-label="Daily details" className={cn(card, 'flex flex-col gap-4')}>
              <div className="flex flex-wrap gap-x-6 gap-y-2.5">
                {Object.values(DAY_STATUS).map((s) => (
                  <span key={s.label} className="flex items-center gap-2 text-[13px] text-ink-2">
                    <StatusPill tone={s.tone}>{s.label}</StatusPill>
                    {s.rule}
                  </span>
                ))}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse text-sm">
                  <thead>
                    <tr className="text-left text-[11.5px] uppercase tracking-[0.06em] text-ink-3">
                      <th className="px-1 pb-2.5 font-semibold">Date</th>
                      <th className="px-1 pb-2.5 font-semibold">Time logged</th>
                      <th className="px-1 pb-2.5 font-semibold">Tasks</th>
                      <th className="px-1 pb-2.5 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.daily_details ?? []).map((d) => (
                      <tr key={d.date} className="border-t border-line align-top">
                        <td className="px-1 py-3.5 font-semibold whitespace-nowrap">{fmtDate(d.date)}</td>
                        <td className="px-1 py-3.5 font-mono whitespace-nowrap">{fmtHoursFromSeconds(d.total_span_seconds)}</td>
                        <td className="px-1 py-3.5">
                          <span className="font-semibold">
                            {d.tasks.length} {d.tasks.length === 1 ? 'task' : 'tasks'}
                          </span>
                          {d.tasks.length > 0 && (
                            <ul className="m-0 mt-1 flex list-none flex-col gap-0.5 p-0 text-[13px] text-ink-2">
                              {d.tasks.map((t) => (
                                <li key={t}>{t}</li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td className="px-1 py-3.5">
                          <StatusPill tone={DAY_STATUS[d.status].tone}>{DAY_STATUS[d.status].label}</StatusPill>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {tab === 'score' && (
            <div className="grid gap-3.5 lg:grid-cols-2 lg:gap-5">
              <section aria-labelledby="h-over" className={cn(card, 'flex flex-col gap-3')}>
                <h2 id="h-over" className="m-0 font-display text-[22px] font-bold tracking-[-0.02em]">
                  Overview
                </h2>
                <div className="flex justify-between border-t border-line pt-3 text-sm">
                  <span className="text-ink-2">Working days</span>
                  <span className="font-semibold">{overview.total_working_days}</span>
                </div>
                <div className="flex justify-between border-t border-line pt-3 text-sm">
                  <span className="text-ink-2">Average daily hours</span>
                  <span className="font-semibold">{fmtHM(overview.average_daily_hours * 60)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-line pt-3">
                  <span className="text-sm font-semibold">Productivity score</span>
                  <span className={cn('font-display text-[34px] leading-none font-bold', scoreColor(overview.productivity_score))}>{overview.productivity_score}%</span>
                </div>
                <p className="m-0 text-[13px] text-ink-3">
                  Based on {overview.unique_task_count} {overview.unique_task_count === 1 ? 'task' : 'tasks'} in this period.
                </p>
              </section>
              <section aria-labelledby="h-eff" className={cn(card, 'flex max-h-[480px] flex-col gap-3 overflow-y-auto')}>
                <h2 id="h-eff" className="m-0 font-display text-[22px] font-bold tracking-[-0.02em]">
                  Task efficiency
                </h2>
                {(data?.task_breakdown ?? []).length === 0 && <p className="m-0 py-6 text-center text-sm text-ink-3">No tasks in this period.</p>}
                {(data?.task_breakdown ?? []).map((t) => (
                  <div key={t.title} className="flex items-start justify-between gap-3 border-t border-line pt-3">
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-sm font-semibold">{t.title}</span>
                      <span className="text-[12.5px] text-ink-3">
                        {TASK_STATUS_LABELS[t.status] ?? t.status.replace(/_/g, ' ')} · est. {fmtHM(t.estimated_minutes)} · logged {fmtHM(t.actual_minutes)}
                      </span>
                    </span>
                    <span className={cn('shrink-0 text-sm font-bold', scoreColor(t.percentage))}>{t.percentage}%</span>
                  </div>
                ))}
              </section>
            </div>
          )}
        </>
      )}
    </PageBody>
  );
}
