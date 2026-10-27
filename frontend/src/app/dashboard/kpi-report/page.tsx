'use client';

import { useEffect, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import Header from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { departmentsApi, kpiReportApi } from '@/lib/api';
import { BarChart3, Users, Clock, ListChecks, Gauge, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import { autoTable } from 'jspdf-autotable';

const KPI_ROLES = ['operations_manager', 'team_lead'];

const RANGE_OPTIONS = [
  { value: 'last_7_days', label: 'Last 7 Days' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'custom', label: 'Custom Range' },
];

const ALL_DEPARTMENTS = '__all';

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

interface ChartPoint { date: string; hours: number; }

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

const STATUS_STYLES: Record<string, string> = {
  poor: 'bg-red-100 text-red-700',
  fair: 'bg-amber-100 text-amber-700',
  good: 'bg-green-100 text-green-700',
};

const STATUS_LABELS: Record<string, string> = { poor: 'Poor', fair: 'Fair', good: 'Good' };

const TASK_STATUS_LABELS: Record<string, string> = {
  not_started: 'Not Started',
  todo: 'Todo',
  in_progress: 'In Progress',
  review: 'Review',
  deadline_missed: 'Deadline Missed',
  completed: 'Completed',
  not_approved: 'Not Approved',
  on_hold: 'On Hold',
  pending: 'Pending',
  technical_support: 'Technical Support',
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

function pctColor(pct: number): string {
  return pct >= 100 ? 'text-green-600' : 'text-orange-600';
}

function DailyHoursChart({ chart }: { chart: ChartPoint[] }) {
  const maxHours = Math.max(1, ...chart.map((c) => c.hours));
  const labelStep = Math.max(1, Math.ceil(chart.length / 8));

  return (
    <div className="pt-2">
      <div className="flex items-end gap-1 h-48 border-b border-border">
        {chart.map((point) => {
          const heightPct = Math.max(2, (point.hours / maxHours) * 100);
          return (
            <div key={point.date} className="group relative flex-1 flex items-end justify-center h-full">
              <div
                className="w-full max-w-6 rounded-t-[4px] bg-primary/80 hover:bg-primary transition-colors"
                style={{ height: `${heightPct}%` }}
              />
              <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground text-background text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                {fmtDate(point.date)} · {point.hours}h
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-1 mt-1.5">
        {chart.map((point, i) => (
          <div key={point.date} className="flex-1 text-center">
            {i % labelStep === 0 && (
              <span className="text-[10px] text-muted-foreground">{fmtDateShort(point.date)}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function KpiReportPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [department, setDepartment] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  // Cached separately from the live `employees` list so the dropdown keeps
  // showing the picked name even if a subsequent fetch's employees array
  // (transiently or due to a backend inconsistency) doesn't include them.
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

  useEffect(() => {
    if (employeeId && !employees.some((e) => String(e.id) === employeeId)) {
      setEmployeeId('');
      setPickedEmployee(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [department]);

  if (!canView) return null;

  const selectedEmployee =
    employees.find((e) => String(e.id) === employeeId) ??
    (pickedEmployee && String(pickedEmployee.id) === employeeId ? pickedEmployee : undefined);
  const hasData = !!employeeId && !!data?.overview && !!data?.staff_summary;
  const chart = data?.chart ?? [];

  const exportPdf = () => {
    if (!data?.staff_summary || !data?.overview) return;
    const summary = data.staff_summary;
    const tasks = data.task_breakdown ?? [];

    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text('KPI Report', 14, 18);

    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(
      `${summary.name}  ·  ${summary.role.replace(/_/g, ' ')}${summary.department ? '  ·  ' + summary.department : ''}`,
      14, 26
    );
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
        body: tasks.map((t) => [
          t.title,
          TASK_STATUS_LABELS[t.status] ?? t.status.replace(/_/g, ' '),
          fmtHM(t.estimated_minutes),
          fmtHM(t.actual_minutes),
          `${t.percentage}%`,
        ]),
        headStyles: { fillColor: [30, 41, 59] },
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
    <div>
      <Header title="KPI Report" />
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">KPI Report</h1>
          <p className="text-sm text-muted-foreground mt-1">Employee performance and productivity tracking</p>
        </div>

        {/* Filter & Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="w-4 h-4" /> Filter & Selection
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Department</label>
                <Select
                  value={department || ALL_DEPARTMENTS}
                  onValueChange={(v) => setDepartment(v === ALL_DEPARTMENTS ? '' : (v as string))}
                >
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_DEPARTMENTS}>All Departments</SelectItem>
                    {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Employee</label>
                <Select
                  value={employeeId}
                  onValueChange={(v) => {
                    const id = v as string;
                    setEmployeeId(id);
                    setPickedEmployee(employees.find((e) => String(e.id) === id) ?? null);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select employee">
                      {(v: string | null) => {
                        const emp =
                          employees.find((e) => String(e.id) === v) ??
                          (pickedEmployee && String(pickedEmployee.id) === v ? pickedEmployee : undefined);
                        return emp ? `${emp.first_name} ${emp.last_name}` : 'Select employee';
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {employees.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">No employees found</div>
                    ) : (
                      employees.map((e) => (
                        <SelectItem key={e.id} value={String(e.id)}>
                          {e.first_name} {e.last_name}
                          {e.effective_department ? ` · ${e.effective_department}` : ''}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Date Range</label>
                <Select value={range} onValueChange={(v) => setRange(v as string)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RANGE_OPTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isCustomRange && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">From</label>
                  <Input type="date" value={customFrom} max={customTo || undefined} onChange={(e) => setCustomFrom(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">To</label>
                  <Input type="date" value={customTo} min={customFrom || undefined} onChange={(e) => setCustomTo(e.target.value)} />
                </div>
                {!customRangeReady && (
                  <p className="text-xs text-muted-foreground self-end pb-2">Pick both a start and end date.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Content */}
        {!employeeId ? (
          <Card>
            <CardContent className="py-16 flex flex-col items-center text-center">
              <Users className="w-12 h-12 text-muted-foreground/30 mb-3" />
              <p className="font-semibold">Select an Employee</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Choose a department and employee to view their KPI report and productivity data.
              </p>
            </CardContent>
          </Card>
        ) : isLoading || !hasData ? (
          <div className="grid grid-cols-1 gap-4">
            <div className="h-56 bg-muted animate-pulse rounded-xl" />
            <div className="h-64 bg-muted animate-pulse rounded-xl" />
          </div>
        ) : (
          <>
            {/* Daily hours chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Daily Hours — {selectedEmployee?.first_name} {selectedEmployee?.last_name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {chart.every((c) => c.hours === 0) ? (
                  <p className="text-sm text-muted-foreground text-center py-10">No time tracked in this period</p>
                ) : (
                  <DailyHoursChart chart={chart} />
                )}
              </CardContent>
            </Card>

            <Tabs defaultValue="daily">
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="daily">Daily Productivity Details</TabsTrigger>
                <TabsTrigger value="score">Productivity Score</TabsTrigger>
                <TabsTrigger value="summary">Staff Summary</TabsTrigger>
              </TabsList>

              {/* Daily Productivity Details */}
              <TabsContent value="daily" className="mt-4 space-y-4">
                <Card>
                  <CardContent className="pt-4">
                    <p className="font-semibold text-sm mb-3">Performance Status Legend</p>
                    <div className="flex flex-wrap gap-6">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-red-600">Poor</p>
                          <p className="text-xs text-muted-foreground">Less than 2 hours worked</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-amber-600">Fair</p>
                          <p className="text-xs text-muted-foreground">2 to 4 hours worked</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-green-600">Good</p>
                          <p className="text-xs text-muted-foreground">4 hours or more worked</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="border rounded-lg overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/20">
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Date</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Total Span</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Tasks</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.daily_details ?? []).map((d) => (
                        <tr key={d.date} className="border-b last:border-0">
                          <td className="px-4 py-4 align-top font-medium whitespace-nowrap">{fmtDate(d.date)}</td>
                          <td className="px-4 py-4 align-top whitespace-nowrap">{fmtHoursFromSeconds(d.total_span_seconds)}</td>
                          <td className="px-4 py-4 align-top">
                            <p className="font-medium">{d.tasks.length} {d.tasks.length === 1 ? 'task' : 'tasks'}</p>
                            {d.tasks.length === 0 ? (
                              <p className="text-xs text-muted-foreground italic">No tasks recorded</p>
                            ) : (
                              <ul className="text-xs text-muted-foreground mt-0.5">
                                {d.tasks.map((t) => <li key={t}>• {t}</li>)}
                              </ul>
                            )}
                          </td>
                          <td className="px-4 py-4 align-top whitespace-nowrap">
                            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[d.status]}`}>
                              {STATUS_LABELS[d.status]}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>

              {/* Productivity Score */}
              <TabsContent value="score" className="mt-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader><CardTitle className="text-base">Productivity Overview</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Total Working Days</span>
                        <span className="font-semibold">{data!.overview!.total_working_days}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Average Daily Hours</span>
                        <span className="font-semibold">{fmtHM(data!.overview!.average_daily_hours * 60)}</span>
                      </div>
                      <div className="border-t pt-3 flex items-center justify-between">
                        <span className="text-sm font-medium">Productivity Score</span>
                        <span className={`text-2xl font-bold ${pctColor(data!.overview!.productivity_score)}`}>
                          {data!.overview!.productivity_score}%
                        </span>
                      </div>
                      <p className="text-xs italic text-muted-foreground">
                        Based on {data!.overview!.unique_task_count} unique {data!.overview!.unique_task_count === 1 ? 'task' : 'tasks'} in this period.
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader><CardTitle className="text-base">Task Efficiency Breakdown</CardTitle></CardHeader>
                    <CardContent className="space-y-3 max-h-96 overflow-y-auto">
                      {(data?.task_breakdown ?? []).length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">No tasks in this period</p>
                      ) : (
                        data!.task_breakdown!.map((t) => (
                          <div key={t.title} className="flex items-start justify-between border-b last:border-0 pb-3 last:pb-0">
                            <div>
                              <p className="text-sm font-medium">{t.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Est: {fmtHM(t.estimated_minutes)} · Act: {fmtHM(t.actual_minutes)}
                              </p>
                            </div>
                            <span className={`text-sm font-semibold ${pctColor(t.percentage)}`}>{t.percentage}%</span>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Staff Summary */}
              <TabsContent value="summary" className="mt-4 space-y-4">
                <Card>
                  <CardContent className="pt-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{data!.staff_summary!.name}</p>
                      <p className="text-sm text-muted-foreground capitalize">
                        {data!.staff_summary!.role.replace(/_/g, ' ')}
                        {data!.staff_summary!.department ? ` · ${data!.staff_summary!.department}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-xs text-muted-foreground">
                        {fmtDate(data!.from)} – {fmtDate(data!.to)}
                      </p>
                      <Button size="sm" variant="outline" onClick={exportPdf}>
                        <Download className="w-3.5 h-3.5 mr-1" /> Export PDF
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="border rounded-xl px-4 py-4">
                    <div className="flex items-center gap-2 mb-1 text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      <span className="text-xs font-medium">Total Hours</span>
                    </div>
                    <p className="text-2xl font-bold">{data!.staff_summary!.total_hours}h</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{data!.staff_summary!.active_days} active days</p>
                  </div>
                  <div className="border rounded-xl px-4 py-4">
                    <div className="flex items-center gap-2 mb-1 text-muted-foreground">
                      <ListChecks className="w-4 h-4" />
                      <span className="text-xs font-medium">Tasks Completed</span>
                    </div>
                    <p className="text-2xl font-bold">{data!.staff_summary!.tasks_completed}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">in this period</p>
                  </div>
                  <div className="border rounded-xl px-4 py-4">
                    <div className="flex items-center gap-2 mb-1 text-muted-foreground">
                      <BarChart3 className="w-4 h-4" />
                      <span className="text-xs font-medium">In Progress</span>
                    </div>
                    <p className="text-2xl font-bold">{data!.staff_summary!.tasks_in_progress}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">tasks currently active</p>
                  </div>
                  <div className="border rounded-xl px-4 py-4">
                    <div className="flex items-center gap-2 mb-1 text-muted-foreground">
                      <Gauge className="w-4 h-4" />
                      <span className="text-xs font-medium">Productivity Score</span>
                    </div>
                    <p className={`text-2xl font-bold ${pctColor(data!.staff_summary!.productivity_score)}`}>
                      {data!.staff_summary!.productivity_score}%
                    </p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}
