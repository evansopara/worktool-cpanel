'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { User } from '@/types';
import { cn } from '@/lib/utils';
import {
  Button,
  DateRange,
  ExportMenu,
  Pagination,
  SearchField,
  Sheet,
  SheetActions,
  SheetDescription,
  SheetTitle,
  Tabs,
  type DateRangeValue,
  type ExportFormat,
} from '@/components/wc';
import { PageBody, PageHeader } from '@/components/shell/PageHeader';
import { errorText, MANAGER_ROLES, taskApi, type ListParams, type ManagerTab, type StaffTab, type TaskDetail, type TaskListItem } from '@/lib/tasks';
import { ExtensionBanner, ManagerExtensions, RequestExtensionSheet, StaffExtensions, useExtensionRequests } from './ExtensionRequests';
import { ManagerTaskCard, ManagerTaskTable, StaffTaskCard, StaffTaskTable } from './TaskRows';
import { TaskForm } from './TaskForm';
import { TaskPanelDrawer } from './TaskPanel';
import { useTaskActions } from './useTaskActions';
import { exportTasks } from './exportTasks';

// Tasks (managers) and My tasks (staff): Tasks / StaffTasks / MTasks /
// MStaffTasks artboards, spec §7. Lists, filters and paging run on the server.

type Tab = ManagerTab | StaffTab | 'ext';

const STATUS_CHIPS = [
  { value: '', label: 'All', dot: 'bg-ink' },
  { value: 'deadline_missed', label: 'Missed', dot: 'bg-missed' },
  { value: 'review', label: 'In review', dot: 'bg-review' },
  { value: 'in_progress', label: 'In progress', dot: 'bg-pending-line' },
];

/** Needs a <Suspense> parent (it reads the URL's ?task=). */
export function TasksScreen({ user }: { user: User }) {
  const manager = MANAGER_ROLES.includes(user.role);
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [tab, setTab] = useState<Tab>(manager ? 'all' : 'active');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [range, setRange] = useState<DateRangeValue>({ from: '', to: '' });
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<{ open: boolean; task: TaskDetail | null }>({ open: false, task: null });
  const [deleting, setDeleting] = useState<{ id: number; title: string } | null>(null);
  const [asking, setAsking] = useState<number | null>(null);

  // The open task panel lives in the URL (?task=ID) so it can be linked to.
  const panelId = params.get('task') ? Number(params.get('task')) : null;
  const openPanel = (id: number | null) => {
    const next = new URLSearchParams(params.toString());
    if (id === null) next.delete('task');
    else next.set('task', String(id));
    router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
  };

  // Search runs on the server, a moment after typing stops.
  useEffect(() => {
    const id = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [search]);

  const listTab = (tab === 'ext' ? (manager ? 'all' : 'active') : tab) as ListParams['tab'];
  const filters = { tab: listTab, q, from: range.from, to: range.to, status: status || undefined };
  const list = useQuery({
    queryKey: ['tasks', 'list', filters, page],
    queryFn: () => taskApi.list({ ...filters, page }),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
    enabled: tab !== 'ext',
  });
  // Counts on the staff tabs ("Active 12").
  const counts = useQuery({
    queryKey: ['tasks', 'counts'],
    queryFn: async () => {
      const [a, c] = await Promise.all([taskApi.list({ tab: 'active', page: 1 }), taskApi.list({ tab: 'completed', page: 1 })]);
      return { active: a.meta.total, completed: c.meta.total };
    },
    enabled: !manager,
  });
  const extensions = useExtensionRequests();
  const requests = extensions.data ?? [];
  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  const actions = useTaskActions();

  const remove = useMutation({
    mutationFn: (id: number) => taskApi.remove(id),
    onSuccess: (_, id) => {
      toast.success('Task deleted');
      qc.invalidateQueries({ queryKey: ['tasks'] });
      if (panelId === id) openPanel(null);
      setDeleting(null);
    },
    onError: (err) => toast.error(errorText(err, 'Could not delete the task.')),
  });

  const edit = async (id: number) => {
    try {
      const task = await qc.fetchQuery({ queryKey: ['task', id], queryFn: () => taskApi.get(id) });
      setForm({ open: true, task });
    } catch (err) {
      toast.error(errorText(err, 'Could not open the task.'));
    }
  };

  const changeTab = (t: Tab) => {
    setTab(t);
    setPage(1);
  };

  const doExport = async (format: ExportFormat) => {
    const { tab: t, q: query, from, to } = filters;
    try {
      await exportTasks(format, { tab: t, q: query, from, to });
    } catch (err) {
      toast.error(errorText(err, 'Export failed.'));
    }
  };

  const tasks: TaskListItem[] = list.data?.data ?? [];
  const total = list.data?.meta.total ?? 0;
  const since = list.dataUpdatedAt;
  const onDelete = (t: { id: number; title: string }) => setDeleting({ id: t.id, title: t.title });

  const desktopTabs = manager
    ? [
        { value: 'all' as Tab, label: 'All tasks' },
        { value: 'mine' as Tab, label: 'My tasks' },
        { value: 'ext' as Tab, label: 'Extension requests', badge: pendingCount },
      ]
    : [
        { value: 'active' as Tab, label: 'Active', count: counts.data?.active },
        { value: 'completed' as Tab, label: 'Completed', count: counts.data?.completed },
        { value: 'ext' as Tab, label: 'Extension requests', badge: pendingCount },
      ];
  const mobileTabs = manager
    ? [
        { value: 'all' as Tab, label: 'All' },
        { value: 'mine' as Tab, label: 'Mine' },
        { value: 'ext' as Tab, label: 'Extensions', badge: pendingCount },
      ]
    : [
        { value: 'active' as Tab, label: 'Active' },
        { value: 'completed' as Tab, label: 'Done' },
        { value: 'ext' as Tab, label: 'Extensions', badge: pendingCount },
      ];

  const pager = (variant: 'desktop' | 'mobile') => (
    <Pagination
      variant={variant}
      page={page}
      total={total}
      onPageChange={(p) => {
        setPage(p);
        document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
      }}
    />
  );
  const extView = manager ? <ManagerExtensions requests={requests} /> : <StaffExtensions requests={requests} />;
  const newTask = () => setForm({ open: true, task: null });

  return (
    <>
      {/* Desktop, lg and up */}
      <PageBody className="hidden lg:flex">
        <PageHeader
          title={manager ? 'Tasks' : 'My tasks'}
          description={manager ? 'Every task across projects, with time tracked against estimates' : 'Every task assigned to you, with your time tracked against the estimate'}
          actions={
            manager && (
              <Button variant="accent" onClick={newTask}>
                <Plus strokeWidth={2.4} aria-hidden="true" />
                New task
              </Button>
            )
          }
        />
        {tab !== 'ext' && (
          <div className="flex flex-wrap items-center gap-2.5">
            <SearchField value={search} onChange={setSearch} placeholder={manager ? 'Search task or staff' : 'Search your tasks'} />
            <DateRange
              value={range}
              onChange={(r) => {
                setRange(r);
                setPage(1);
              }}
            />
            <ExportMenu onSelect={doExport} />
          </div>
        )}
        <Tabs label="Task views" value={tab} onChange={changeTab} items={desktopTabs} />
        {tab === 'ext' ? (
          extView
        ) : (
          <div className="flex flex-col gap-[18px]">
            {manager && <ExtensionBanner requests={requests} onOpen={() => changeTab('ext')} />}
            {manager ? (
              <ManagerTaskTable tasks={tasks} since={since} onOpen={openPanel} onEdit={edit} onDelete={onDelete} footer={pager('desktop')} />
            ) : (
              <StaffTaskTable tasks={tasks} since={since} actions={actions} onOpen={openPanel} onRequestExtension={setAsking} footer={pager('desktop')} />
            )}
          </div>
        )}
      </PageBody>

      {/* Mobile, below lg */}
      <div className="flex flex-col gap-3.5 px-[18px] pt-14 pb-6 lg:hidden">
        <div className="flex items-center justify-between">
          <h1 className="m-0 font-display text-[40px] leading-none font-bold tracking-[-0.04em]">{manager ? 'Tasks' : 'My tasks'}</h1>
          {manager && (
            <button type="button" aria-label="New task" onClick={newTask} className="flex size-12 cursor-pointer items-center justify-center rounded-full border-0 bg-yellow text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2">
              <Plus className="size-5" strokeWidth={2.4} aria-hidden="true" />
            </button>
          )}
        </div>
        <Tabs label="Task views" value={tab} onChange={changeTab} items={mobileTabs} className="w-full self-stretch [&>button]:flex-1 [&>button]:justify-center [&>button]:px-2 [&>button]:text-[13.5px]" />
        {tab === 'ext' ? (
          extView
        ) : (
          <div className="flex flex-col gap-3">
            {manager && (
              <>
                <DateRange
                  value={range}
                  onChange={(r) => {
                    setRange(r);
                    setPage(1);
                  }}
                />
                <ExtensionBanner requests={requests} onOpen={() => changeTab('ext')} />
                <div role="group" aria-label="Status filter" className="flex gap-2 overflow-x-auto">
                  {STATUS_CHIPS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      aria-pressed={status === c.value}
                      onClick={() => {
                        setStatus(c.value);
                        setPage(1);
                      }}
                      className={cn(
                        'flex h-[38px] shrink-0 cursor-pointer items-center gap-1.5 rounded-full border-0 px-3.5 font-ui text-[13.5px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ink',
                        status === c.value ? 'bg-ink text-white' : 'bg-surface text-ink-2',
                      )}
                    >
                      <span className={cn('size-2 rounded-[3px]', c.dot, status === c.value && c.value === '' && 'bg-white')} />
                      {c.label}
                    </button>
                  ))}
                </div>
              </>
            )}
            {tasks.length === 0 && !list.isLoading && <p className="m-0 rounded-card bg-surface p-6 text-center text-sm font-semibold text-ink-3">No tasks here.</p>}
            {tasks.map((t) =>
              manager ? (
                <ManagerTaskCard key={t.id} t={t} since={since} onOpen={openPanel} onEdit={edit} onDelete={onDelete} />
              ) : (
                <StaffTaskCard key={t.id} t={t} since={since} actions={actions} onOpen={openPanel} onRequestExtension={setAsking} />
              ),
            )}
            {total > 0 && pager('mobile')}
          </div>
        )}
      </div>

      <TaskPanelDrawer
        taskId={panelId}
        onClose={() => openPanel(null)}
        manager={manager}
        userId={user.id}
        actions={actions}
        onEdit={(t) => setForm({ open: true, task: t })}
        onDelete={onDelete}
      />
      <TaskForm open={form.open} task={form.task} onClose={() => setForm({ open: false, task: null })} />
      <RequestExtensionSheet open={asking !== null} taskId={asking ?? undefined} onClose={() => setAsking(null)} />
      <Sheet open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        {deleting && (
          <>
            <SheetTitle>Delete “{deleting.title}”?</SheetTitle>
            <SheetDescription>It disappears from every list. Its history is kept.</SheetDescription>
            <SheetActions confirmLabel="Delete task" confirmDisabled={remove.isPending} onConfirm={() => remove.mutate(deleting.id)} />
          </>
        )}
      </Sheet>
      {actions.dialogs}
    </>
  );
}
