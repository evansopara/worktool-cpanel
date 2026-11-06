'use client';

import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ChevronDown, Download, Users } from 'lucide-react';
import jsPDF from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { toast } from 'sonner';
import api, { departmentsApi, kpiReportApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Avatar, Button, IconButton, StatusPill, Tabs, type StatusTone } from '@/components/wc';
import { card, ErrorNote } from './parts';
import type { PerfUrl } from './usePerfUrl';

// KPI report tab (Insights / MInsights): the existing KPI report under the
// shared header. The date range comes from the header; Department and
// Employee filters are its own. Estimate drift is a sub-tab.

interface Employee {
  id: number;
  first_name: string;
  last_name: string;
  role: string;
  effective_department?: string;
}
interface DailyDetail {
  date: string;
  total_span_seconds: number;
  tasks: string[];
  status: 'poor' | 'fair' | 'good';
}
interface TaskBreakdown {
  title: string;
  status: string;
  estimated_minutes: number;
  actual_minutes: number;
  percentage: number;
}
interface KpiResponse {
  employees: Employee[];
  from: string;
  to: string;
  daily_details?: DailyDetail[];
  chart?: { date: string; hours: number }[];
  task_breakdown?: TaskBreakdown[];
  overview?: { total_working_days: number; active_days: number; average_daily_hours: number; productivity_score: number; unique_task_count: number };
  staff_summary?: {
    id: number;
    name: string;
    role: string;
    department?: string;
    total_hours: number;
    active_days: number;
    tasks_completed: number;
    tasks_in_progress: number;
    productivity_score: number;
  };
}

const DAY_STATUS: Record<DailyDetail['status'], { label: string; tone: StatusTone; rule: string }> = {
  poor: { label: 'Poor', tone: 'missed', rule: 'Less than 2 hours worked' },
  fair: { label: 'Fair', tone: 'pending', rule: '2 to 4 hours worked' },
  good: { label: 'Good', tone: 'done', rule: '4 hours or more worked' },
};

const TASK_STATUS: Record<string, string> = {
  not_started: 'Not started',
  todo: 'To do',
  in_progress: 'In progress',
  review: 'In review',
  deadline_missed: 'Deadline missed',
  completed: 'Completed',
  not_approved: 'Not approved',
  on_hold: 'On hold',
};
const taskStatus = (s: string) => TASK_STATUS[s] ?? s.replace(/_/g, ' ');

const fmtHM = (minutes: number) => `${Math.floor(minutes / 60)}h ${Math.round(minutes % 60)}m`;
const fmtSecs = (s: number) => fmtHM(s / 60);
const fmtDay = (d: string) => format(parseISO(d), 'MMM d, yyyy');
const nameOf = (e: Employee) => `${e.first_name} ${e.last_name}`.trim();

/** A pill holding a native select: "Department  All departments ⌄". */
function PillSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <label className="relative flex h-12 shrink-0 items-center gap-2 rounded-full bg-surface pr-9 pl-4 focus-within:ring-2 focus-within:ring-ink">
      <span className="text-[13px] text-ink-3">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="max-w-[180px] cursor-pointer appearance-none border-0 bg-transparent font-ui text-[14.5px] font-bold text-ink outline-none">
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3.5 size-4" strokeWidth={2.4} aria-hidden="true" />
    </label>
  );
}

function HoursChart({ chart }: { chart: { date: string; hours: number }[] }) {
  const max = Math.max(1, ...chart.map((c) => c.hours));
  const step = Math.max(1, Math.ceil(chart.length / 8));
  return (
    <figure className="m-0 flex flex-col gap-2">
      <div className="relative flex h-56 items-end gap-[3px] lg:h-60 lg:gap-1">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <span key={f} aria-hidden="true" className="absolute inset-x-0 border-t border-dark-1" style={{ bottom: `${f * 100}%` }} />
        ))}
        {chart.map((p) => (
          <div key={p.date} className="group relative z-[1] flex h-full flex-1 items-end justify-center">
            <div
              className={cn('w-full max-w-7 rounded-t-[6px] transition-opacity group-hover:opacity-85', p.hours > 0 ? 'bg-yellow' : 'bg-dark-line')}
              style={{ height: p.hours > 0 ? `${Math.max(2, (p.hours / max) * 100)}%` : '4px' }}
            />
            <div className="pointer-events-none absolute -top-9 left-1/2 z-10 -translate-x-1/2 rounded-lg bg-surface px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-ink opacity-0 shadow-float transition-opacity group-hover:opacity-100">
              {fmtDay(p.date)} · {p.hours}h
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-[3px] lg:gap-1">
        {chart.map((p, i) => (
          <span key={p.date} className="flex-1 text-center font-mono text-[11px] text-on-dark-2">
            {i % step === 0 ? format(parseISO(p.date), 'd') : ''}
          </span>
        ))}
      </div>
    </figure>
  );
}

export function KpiTab({ url }: { url: PerfUrl }) {
  const [sub, setSub] = useState<'kpi' | 'drift'>('kpi');
  const [view, setView] = useState<'daily' | 'score' | 'summary'>('daily');
  const [department, setDepartment] = useState('');
  const employeeId = url.employee;

  const { data: departments = [] } = useQuery<string[]>({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.list().then((r) => r.data),
  });

  const params = { department: department || undefined, employee_id: employeeId || undefined, range: 'custom', from: url.range.from, to: url.range.to };
  const q = useQuery<KpiResponse>({
    queryKey: ['kpi-report', department, employeeId, url.range],
    queryFn: () => kpiReportApi.productivity(params).then((r) => r.data),
    placeholderData: keepPreviousData,
  });

  const employees = q.data?.employees ?? [];
  const summary = q.data?.staff_summary;
  const overview = q.data?.overview;
  const chart = q.data?.chart ?? [];
  const tasks = q.data?.task_breakdown ?? [];
  const ready = !!employeeId && !!summary && !!overview;

  const exportPdf = () => {
    if (!summary || !q.data) return;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('KPI Report', 14, 18);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`${summary.name}  ·  ${summary.role.replace(/_/g, ' ')}${summary.department ? '  ·  ' + summary.department : ''}`, 14, 26);
    doc.text(`Period: ${fmtDay(q.data.from)} - ${fmtDay(q.data.to)}`, 14, 32);
    doc.setTextColor(0);
    doc.setFontSize(10);
    const lines = [
      `Total Hours: ${summary.total_hours}h`,
      `Active Days: ${summary.active_days}`,
      `Tasks Completed: ${summary.tasks_completed}`,
      `Tasks In Progress: ${summary.tasks_in_progress}`,
      `Productivity Score: ${summary.productivity_score}%`,
    ];
    lines.forEach((line, i) => doc.text(line, 14, 42 + i * 6));
    const y = 42 + lines.length * 6 + 6;
    if (tasks.length) {
      autoTable(doc, {
        startY: y,
        head: [['Task', 'Status', 'Estimated', 'Actual', '%']],
        body: tasks.map((t) => [t.title, taskStatus(t.status), fmtHM(t.estimated_minutes), fmtHM(t.actual_minutes), `${t.percentage}%`]),
        headStyles: { fillColor: [18, 18, 18] },
        styles: { fontSize: 9 },
      });
    } else {
      doc.text('No tasks recorded in this period.', 14, y);
    }
    doc.save(`kpi-report-${summary.name.trim().replace(/[^a-z0-9]+/gi, '_')}-${q.data.from}-to-${q.data.to}.pdf`);
  };

  const exportExcel = async () => {
    try {
      const res = await api.get<Blob>('/kpi-report/productivity', { params: { ...params, format: 'xlsx' }, responseType: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(res.data);
      a.download = `kpi-${(summary?.name ?? 'report').replace(/[^a-z0-9]+/gi, '-')}-${url.range.from}-to-${url.range.to}.xlsx`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      toast.error('Couldn’t export the report.');
    }
  };

  const drift = [...tasks]
    .filter((t) => t.estimated_minutes > 0)
    .map((t) => ({ ...t, drift: t.percentage - 100 }))
    .sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift));
  const estTotal = drift.reduce((n, t) => n + t.estimated_minutes, 0);
  const logTotal = drift.reduce((n, t) => n + t.actual_minutes, 0);

  return (
    <div className="flex flex-col gap-3.5 lg:gap-5">
      <div className="flex items-center gap-3">
        <Tabs
          label="Report"
          value={sub}
          onChange={setSub}
          className="flex-1 lg:flex-none [&>button]:flex-1 lg:[&>button]:flex-none"
          items={[
            { value: 'kpi', label: 'KPI report' },
            { value: 'drift', label: 'Estimate drift' },
          ]}
        />
        <IconButton aria-label="Export PDF" variant="white" className="size-12 lg:hidden" onClick={exportPdf} disabled={!ready}>
          <Download aria-hidden="true" />
        </IconButton>
      </div>

      <div className="-mx-[18px] flex items-center gap-2.5 overflow-x-auto px-[18px] lg:mx-0 lg:flex-wrap lg:px-0">
        <PillSelect
          label="Department"
          value={department}
          onChange={(d) => {
            setDepartment(d);
            url.setEmployee('');
          }}
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </PillSelect>
        <PillSelect label="Employee" value={employeeId} onChange={url.setEmployee}>
          <option value="">{employees.length ? 'Choose' : 'None found'}</option>
          {summary && !employees.some((e) => String(e.id) === employeeId) && <option value={summary.id}>{summary.name}</option>}
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {nameOf(e)}
            </option>
          ))}
        </PillSelect>
        <span className="hidden flex-1 lg:block" />
        <Button variant="white" className="hidden lg:inline-flex" onClick={exportPdf} disabled={!ready}>
          Export PDF
        </Button>
        <Button variant="white" className="hidden lg:inline-flex" onClick={exportExcel} disabled={!ready}>
          Export Excel
        </Button>
      </div>

      {!employeeId ? (
        <div className="flex flex-col items-center gap-3 rounded-[28px] bg-surface px-6 py-14 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-stone text-ink-2">
            <Users className="size-6" aria-hidden="true" />
          </span>
          <p className="m-0 font-display text-2xl font-bold">Choose an employee</p>
          <p className="m-0 max-w-sm text-sm text-ink-3">Pick a department and an employee to see their daily hours and productivity for this period.</p>
        </div>
      ) : q.isError ? (
        <ErrorNote />
      ) : !ready ? (
        <div className="flex flex-col gap-3.5">
          <div className="h-72 animate-pulse rounded-[28px] bg-ink" />
          <div className="h-64 animate-pulse rounded-[28px] bg-surface" />
        </div>
      ) : sub === 'kpi' ? (
        <>
          <section aria-labelledby="h-hours" className="flex flex-col gap-4 rounded-[28px] bg-ink p-5 text-white lg:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <Avatar name={summary.name} size="lg" />
                <div className="flex flex-col">
                  <h2 id="h-hours" className="m-0 font-display text-[24px] font-bold tracking-[-0.02em] lg:text-[28px]">
                    Daily hours — {summary.name}
                  </h2>
                  <span className="text-[13px] text-on-dark">
                    {format(parseISO(q.data!.from), 'MMMM d')} – {format(parseISO(q.data!.to), 'MMMM d')}
                    {department ? ` · ${department}` : ' · all departments'}
                  </span>
                </div>
              </div>
              <span className="hidden items-center gap-2 text-xs text-on-dark lg:flex">
                <span className="size-2.5 rounded-[3px] bg-yellow" aria-hidden="true" />
                Hours logged
              </span>
            </div>
            {chart.every((c) => c.hours === 0) ? <p className="m-0 py-14 text-center text-sm text-on-dark">No time tracked in this period.</p> : <HoursChart chart={chart} />}
          </section>

          <section aria-label="Breakdown" className={cn(card, 'flex flex-col gap-4')}>
            <div className="-mx-5 overflow-x-auto px-5 lg:mx-0 lg:px-0">
              <Tabs
                label="Breakdown"
                on="white"
                value={view}
                onChange={setView}
                className="bg-transparent p-0 [&>button:not([aria-selected=true])]:bg-stone [&>button]:mr-1.5"
                items={[
                  { value: 'daily', label: 'Daily productivity details' },
                  { value: 'score', label: 'Productivity score' },
                  { value: 'summary', label: 'Staff summary' },
                ]}
              />
            </div>

            {view === 'daily' && (
              <>
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
                      {(q.data?.daily_details ?? []).map((d) => (
                        <tr key={d.date} className="border-t border-line align-top">
                          <td className="px-1 py-3.5 font-semibold whitespace-nowrap">{fmtDay(d.date)}</td>
                          <td className="px-1 py-3.5 font-mono whitespace-nowrap">{fmtSecs(d.total_span_seconds)}</td>
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
              </>
            )}

            {view === 'score' && (
              <div className="grid gap-3.5 lg:grid-cols-2 lg:gap-5">
                <div className="flex flex-col gap-3 rounded-[22px] bg-surface-2 p-5">
                  <div className="flex justify-between text-sm">
                    <span className="text-ink-2">Working days</span>
                    <span className="font-semibold">{overview.total_working_days}</span>
                  </div>
                  <div className="flex justify-between border-t border-line pt-3 text-sm">
                    <span className="text-ink-2">Average daily hours</span>
                    <span className="font-semibold">{fmtHM(overview.average_daily_hours * 60)}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-line pt-3">
                    <span className="text-sm font-semibold">Productivity score</span>
                    <span className={cn('font-display text-[34px] leading-none font-bold', overview.productivity_score >= 100 ? 'text-done' : 'text-pending')}>
                      {overview.productivity_score}%
                    </span>
                  </div>
                  <p className="m-0 text-[13px] text-ink-3">
                    Logged time against estimates, over {overview.unique_task_count} {overview.unique_task_count === 1 ? 'task' : 'tasks'}.
                  </p>
                </div>
                <div className="flex max-h-[420px] flex-col gap-3 overflow-y-auto">
                  <h3 className="m-0 text-[15px] font-bold">Task efficiency</h3>
                  {tasks.length === 0 && <p className="m-0 text-sm text-ink-3">No tasks in this period.</p>}
                  {tasks.map((t) => (
                    <div key={t.title} className="flex items-start justify-between gap-3 border-t border-line pt-3">
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-sm font-semibold">{t.title}</span>
                        <span className="text-[12.5px] text-ink-3">
                          {taskStatus(t.status)} · est. {fmtHM(t.estimated_minutes)} · logged {fmtHM(t.actual_minutes)}
                        </span>
                      </span>
                      <span className={cn('shrink-0 text-sm font-bold', t.percentage >= 100 ? 'text-done' : 'text-pending')}>{t.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {view === 'summary' && (
              <dl className="m-0 grid grid-cols-2 gap-2.5 lg:grid-cols-5">
                {[
                  { k: 'Total hours', v: `${summary.total_hours}h`, note: `${summary.active_days} active days` },
                  { k: 'Tasks completed', v: String(summary.tasks_completed), note: 'in this period' },
                  { k: 'In progress', v: String(summary.tasks_in_progress), note: 'tasks active now' },
                  { k: 'Productivity', v: `${summary.productivity_score}%`, note: 'estimate vs time logged' },
                  { k: 'Department', v: summary.department ?? '—', note: summary.role.replace(/_/g, ' '), small: true },
                ].map((s) => (
                  <div key={s.k} className="flex flex-col gap-1 rounded-[20px] bg-surface-2 p-4">
                    <dt className="text-[12.5px] font-semibold text-ink-3">{s.k}</dt>
                    <dd className={cn('m-0 font-display leading-none font-bold', s.small ? 'text-lg' : 'text-[30px]')}>{s.v}</dd>
                    <span className="text-xs text-ink-3 capitalize">{s.note}</span>
                  </div>
                ))}
              </dl>
            )}
          </section>
        </>
      ) : (
        <section aria-labelledby="h-drift" className={cn(card, 'flex flex-col gap-4')}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2 id="h-drift" className="m-0 font-display text-[22px] font-bold tracking-[-0.02em]">
                Estimate drift — {summary.name}
              </h2>
              <p className="m-0 text-[13px] text-ink-3">Logged time against each task’s estimate, furthest off first.</p>
            </div>
            {estTotal > 0 && (
              <p className="m-0 text-sm">
                Overall <b>{Math.round((logTotal / estTotal) * 100)}%</b> of estimate · est. {fmtHM(estTotal)} · logged {fmtHM(logTotal)}
              </p>
            )}
          </div>
          {drift.length === 0 ? (
            <p className="m-0 py-6 text-center text-sm text-ink-3">No tasks with an estimate in this period.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col p-0">
              {drift.map((t) => (
                <li key={t.title} className="flex flex-col gap-1.5 border-t border-line py-3">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-sm font-semibold">{t.title}</span>
                      <span className="text-[12.5px] text-ink-3">
                        {taskStatus(t.status)} · est. {fmtHM(t.estimated_minutes)} · logged {fmtHM(t.actual_minutes)}
                      </span>
                    </span>
                    <span className={cn('shrink-0 text-sm font-bold', Math.abs(t.drift) <= 10 ? 'text-done' : t.drift > 0 ? 'text-missed' : 'text-review')}>
                      {t.drift > 0 ? '+' : ''}
                      {t.drift}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-stone">
                    <div className={cn('h-full rounded-full', t.drift > 10 ? 'bg-missed' : 'bg-ink')} style={{ width: `${Math.min(100, t.percentage / 2)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="m-0 text-xs text-ink-3">Over 100% means more time than estimated; the bar’s midpoint is the estimate.</p>
        </section>
      )}
    </div>
  );
}
