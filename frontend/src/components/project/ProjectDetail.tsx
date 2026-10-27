'use client';

import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowLeft, Check, ChevronRight, ExternalLink, MessageCircle, Paperclip, Pencil, SquareCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { User } from '@/types';
import { cn } from '@/lib/utils';
import { Pagination, Tabs } from '@/components/wc';
import { errorText, taskApi } from '@/lib/tasks';
import { categoryLabel, domainState, durationDays, fmtDay, fmtRange, projectApi, projectStatus, type ProjectFull } from '@/lib/projects';
import { ManagerTaskCard, ManagerTaskTable, StaffTaskCard, StaffTaskTable } from '@/components/task/TaskRows';
import type { useTaskWorkspace } from '@/components/task/useTaskWorkspace';
import { ChatInput, ChatMessages, ProgressRing, ProjectChatPanel, useProjectChat } from './ProjectChat';

// Project detail (ProjectDetail / MProject artboards).

type Tab = 'overview' | 'tasks' | 'resources' | 'chat';
type Workspace = ReturnType<typeof useTaskWorkspace>;

export function ProjectDetail({
  projectId,
  user,
  ws,
  onBack,
  onEdit,
  onDelete,
}: {
  projectId: number;
  user: User;
  ws: Workspace;
  onBack: () => void;
  onEdit: (p: ProjectFull) => void;
  onDelete: (p: ProjectFull) => void;
}) {
  const [tab, setTab] = useState<Tab>('overview');
  const project = useQuery({ queryKey: ['project', projectId], queryFn: () => projectApi.get(projectId) });
  const chat = useProjectChat(projectId);
  const p = project.data;

  if (!p) {
    return (
      <div className="flex flex-col gap-4 px-[18px] pt-14 lg:px-10 lg:pt-7">
        <BackLink onBack={onBack} />
        <p className="m-0 text-sm text-ink-3">{project.isError ? 'This project could not be loaded, or you’re not on its team.' : 'Loading project…'}</p>
      </div>
    );
  }

  const manager = ws.manager;
  const status = projectStatus(p);
  const done = status.label === 'Completed';
  const domain = domainState(p.domain_expires_at);
  const members = p.members?.length ?? 0;
  const days = durationDays(p.start_date, p.end_date);
  const facts = [
    { k: 'Timeline', v: fmtRange(p.start_date, p.end_date) },
    { k: 'Duration', v: days === null ? '—' : `${days} day${days === 1 ? '' : 's'}` },
    { k: 'Manager', v: p.manager ? `${p.manager.first_name} ${p.manager.last_name}` : '—' },
    { k: 'Created', v: fmtDay(p.created_at) },
    ...(p.client ? [{ k: 'Client', v: `${p.client.first_name} ${p.client.last_name}` }] : []),
    ...(p.domain_expires_at ? [{ k: 'Domain expires', v: fmtDay(p.domain_expires_at), warn: !!domain }] : []),
  ];
  const statusChip = (
    <span
      className={cn(
        'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-bold',
        done ? 'bg-yellow text-ink' : status.tone === 'pending' ? 'bg-pending-tint text-pending' : status.tone === 'review' ? 'bg-review-tint text-review' : 'bg-dark-2 text-on-ink',
      )}
    >
      {done && <Check className="size-3.5" strokeWidth={2.6} aria-hidden="true" />}
      {status.label}
    </span>
  );

  const tabs = [
    { value: 'overview' as Tab, label: 'Overview' },
    { value: 'tasks' as Tab, label: 'Tasks', count: p.tasks?.length },
    { value: 'resources' as Tab, label: 'Resources', count: p.resources?.length || undefined },
    { value: 'chat' as Tab, label: 'Team chat', count: chat.messages.length || undefined },
  ];

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-3.5 px-[18px] pt-[52px] pb-10 lg:gap-5 lg:px-10 lg:pt-5 lg:pb-[72px]">
      {/* Mobile top bar */}
      <div className="flex items-center gap-2 lg:hidden">
        <button type="button" aria-label="Back to projects" onClick={onBack} className={roundBtn('bg-surface text-ink')}>
          <ArrowLeft className="size-[18px]" aria-hidden="true" />
        </button>
        <span className="flex-1" />
        {manager && (
          <>
            <button type="button" aria-label="Edit project" onClick={() => onEdit(p)} className={roundBtn('bg-surface text-ink')}>
              <Pencil className="size-4" aria-hidden="true" />
            </button>
            <button type="button" aria-label="Delete project" onClick={() => onDelete(p)} className={roundBtn('bg-missed-tint text-missed')}>
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      {/* Desktop breadcrumb */}
      <nav aria-label="Breadcrumb" className="hidden items-center gap-2 text-sm font-semibold text-ink-3 lg:flex">
        <BackLink onBack={onBack} />
        <span aria-hidden="true">/</span>
        <span>{categoryLabel(p)}</span>
      </nav>

      {/* Header card */}
      <section aria-labelledby="h-proj" className="flex flex-col gap-[18px] rounded-[28px] bg-ink p-[22px] text-white lg:gap-7 lg:rounded-[32px] lg:p-8">
        <div className="flex items-start gap-3.5 lg:flex-wrap lg:justify-between lg:gap-6">
          <div className="flex min-w-0 flex-1 flex-col gap-2.5 lg:gap-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="hidden rounded-full bg-dark-2 px-3 py-1.5 text-[13px] font-semibold text-on-ink lg:inline">{categoryLabel(p)}</span>
              {statusChip}
              {domain && (
                <span className="rounded-full bg-missed-tint px-3 py-1.5 text-[13px] font-bold text-missed">{domain === 'expired' ? 'Domain expired' : 'Domain expiring soon'}</span>
              )}
            </div>
            <h1 id="h-proj" className="m-0 font-display text-[34px] leading-none font-bold tracking-[-0.035em] [overflow-wrap:anywhere] lg:text-[60px] lg:leading-[0.95] lg:tracking-[-0.04em]">
              {p.name}
            </h1>
            <p className="m-0 text-sm text-on-dark lg:text-base">
              <span className="lg:hidden">{categoryLabel(p)}</span>
              <span className="hidden lg:inline">{p.description || `${categoryLabel(p)} project`}</span>
            </p>
            {manager && (
              <div className="hidden flex-wrap gap-2.5 lg:flex">
                <button type="button" onClick={() => onEdit(p)} className="inline-flex h-[46px] cursor-pointer items-center gap-2 rounded-full border-0 bg-white px-5 font-ui text-[14.5px] font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-yellow">
                  <Pencil className="size-4" aria-hidden="true" />
                  Edit project
                </button>
                <button type="button" onClick={() => onDelete(p)} className="inline-flex h-[46px] cursor-pointer items-center rounded-full border border-missed-line-dark bg-transparent px-5 font-ui text-[14.5px] font-semibold text-missed-on-dark outline-none focus-visible:ring-2 focus-visible:ring-yellow">
                  Delete
                </button>
              </div>
            )}
          </div>
          <span className="lg:hidden">
            <ProgressRing value={p.progress ?? 0} size="sm" />
          </span>
          <span className="hidden lg:block">
            <ProgressRing value={p.progress ?? 0} size="lg" />
          </span>
        </div>
        <dl className="m-0 grid grid-cols-2 gap-3.5 border-t border-dark-2 pt-4 lg:grid-cols-[repeat(auto-fit,minmax(170px,1fr))] lg:gap-0 lg:pt-0">
          {facts.map((f) => (
            <div key={f.k} className="flex flex-col gap-[3px] lg:gap-1.5 lg:pt-5 lg:pr-5">
              <dt className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-on-dark-2 lg:text-[12.5px]">{f.k}</dt>
              <dd className={cn('m-0 text-[14.5px] font-semibold lg:text-[17px]', 'warn' in f && f.warn && 'text-missed-on-dark')}>{f.v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <Tabs label="Project sections" value={tab} onChange={setTab} items={tabs} className="hidden lg:flex" />
      {/* Phone: the artboard's short labels, no counts */}
      <Tabs
        label="Project sections"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'overview', label: 'Overview' },
          { value: 'tasks', label: 'Tasks' },
          { value: 'resources', label: 'Files' },
          { value: 'chat', label: 'Chat' },
        ]}
        className="w-full self-stretch lg:hidden [&>button]:flex-1 [&>button]:justify-center [&>button]:px-2 [&>button]:text-[13.5px]"
      />

      {tab === 'overview' && (
        <div className="flex flex-col gap-3.5 lg:flex-row lg:flex-wrap lg:items-start lg:gap-5">
          <PlanCard project={p} manager={manager} />
          {p.description && (
            <p className="m-0 px-1 text-sm text-ink-2 lg:hidden">
              <strong className="text-ink">Description:</strong> {p.description}
            </p>
          )}

          {/* Mobile: chat link */}
          <button type="button" onClick={() => setTab('chat')} className="flex cursor-pointer items-center gap-3.5 rounded-card border-0 bg-surface p-4 text-left font-ui text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink lg:hidden">
            <span className="flex size-[46px] shrink-0 items-center justify-center rounded-[15px] bg-ink text-yellow">
              <MessageCircle className="size-5" aria-hidden="true" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[15.5px] font-bold">
                Team chat · {members} member{members === 1 ? '' : 's'}
              </span>
              <span className="truncate text-[13px] text-ink-3">
                {chat.messages.length ? `${chat.messages.at(-1)!.sender?.first_name ?? 'Someone'}: ${chat.messages.at(-1)!.content}` : 'No messages yet'}
              </span>
            </span>
            <ChevronRight className="size-[18px] shrink-0 text-ink-3" aria-hidden="true" />
          </button>

          {/* Desktop: chat preview + shortcuts */}
          <aside className="hidden min-w-0 flex-col gap-5 lg:flex lg:flex-[2_1_340px]">
            <section aria-labelledby="h-chat" className="flex flex-col gap-4 rounded-[28px] bg-surface p-6">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <h2 id="h-chat" className="m-0 font-display text-[22px] font-bold">
                    Team chat
                  </h2>
                  <span className="text-[13px] text-ink-3">
                    {members} member{members === 1 ? '' : 's'}
                  </span>
                </div>
                <button type="button" onClick={() => setTab('chat')} className="cursor-pointer border-0 bg-transparent font-ui text-sm font-semibold text-ink">
                  Open →
                </button>
              </div>
              {chat.messages.length === 0 && <p className="m-0 text-sm text-ink-3">No messages yet.</p>}
              <ChatMessages messages={chat.messages.slice(-4)} meId={user.id} compact />
              <ChatInput onSend={(t) => chat.send.mutate(t)} busy={chat.send.isPending} />
            </section>
            <nav aria-label="Project shortcuts" className="grid grid-cols-3 gap-2.5">
              {[
                { tab: 'tasks' as Tab, label: 'Tasks', note: 'Manage project tasks', icon: SquareCheck },
                { tab: 'resources' as Tab, label: 'Resources', note: 'Files and links', icon: Paperclip },
                { tab: 'chat' as Tab, label: 'Team chat', note: 'Internal only', icon: MessageCircle },
              ].map((q) => (
                <button key={q.tab} type="button" onClick={() => setTab(q.tab)} className="flex cursor-pointer flex-col gap-2.5 rounded-[22px] border-0 bg-surface p-4 text-left font-ui text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink">
                  <span className="flex size-[38px] items-center justify-center rounded-xl bg-stone">
                    <q.icon className="size-[18px]" aria-hidden="true" />
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-bold">{q.label}</span>
                    <span className="text-xs text-ink-3">{q.note}</span>
                  </span>
                </button>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {tab === 'tasks' && <ProjectTasks projectId={p.id} ws={ws} />}
      {tab === 'resources' && <Resources project={p} />}
      {tab === 'chat' && <ProjectChatPanel projectId={p.id} meId={user.id} members={members} />}
    </div>
  );
}

function roundBtn(colors: string) {
  return cn('flex size-11 cursor-pointer items-center justify-center rounded-full border-0 outline-none focus-visible:ring-2 focus-visible:ring-ink', colors);
}

function BackLink({ onBack }: { onBack: () => void }) {
  return (
    <button type="button" onClick={onBack} className="flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 font-ui text-sm font-semibold text-ink-2 outline-none hover:text-ink focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ink">
      <ArrowLeft className="size-4" aria-hidden="true" />
      Projects
    </button>
  );
}

/** Plan checklist; managers tick steps off. */
function PlanCard({ project: p, manager }: { project: ProjectFull; manager: boolean }) {
  const qc = useQueryClient();
  const toggle = useMutation({
    mutationFn: ({ planId, id, status }: { planId: number; id: number; status: string }) => projectApi.setDeliverableStatus(p.id, planId, id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project', p.id] }),
    onError: (err) => toast.error(errorText(err, 'Could not update the step.')),
  });
  const plans = p.plans ?? [];

  return (
    <section aria-label="Project plan" className="flex min-w-0 flex-col gap-3 rounded-[26px] bg-surface p-5 lg:flex-[3_1_480px] lg:gap-5 lg:rounded-[28px] lg:p-7">
      {plans.length === 0 && (
        <>
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.07em] text-ink-3 lg:text-[13px] lg:tracking-[0.06em]">Project plan</p>
          <p className="m-0 text-sm text-ink-3">No project plan yet.</p>
        </>
      )}
      {plans.map((plan) => {
        const steps = plan.deliverables ?? [];
        const doneCount = steps.filter((d) => d.status === 'completed').length;
        return (
          <div key={plan.id} className="flex flex-col gap-3 lg:gap-5">
            <div className="flex flex-col gap-1 lg:gap-1.5">
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.07em] text-ink-3 lg:text-[13px] lg:tracking-[0.06em]">
                Project plan{steps.length ? ` · ${doneCount} of ${steps.length}` : ''}
              </p>
              <h2 className="m-0 font-display text-[21px] leading-[1.15] font-bold lg:text-[28px] lg:tracking-[-0.02em]">{plan.title}</h2>
              {plan.description && <p className="m-0 text-[13.5px] text-ink-2 lg:text-[15px]">{plan.description}</p>}
            </div>
            <ol className="m-0 flex list-none flex-col p-0">
              {steps.map((d, i) => {
                const isDone = d.status === 'completed';
                const mark = (
                  <span className={cn('flex size-6 items-center justify-center rounded-full lg:size-7', isDone ? 'bg-yellow' : 'border-2 border-line bg-surface')}>
                    {isDone && <Check className="size-3.5" strokeWidth={2.6} aria-hidden="true" />}
                  </span>
                );
                return (
                  <li key={d.id} className="flex min-h-12 items-center gap-3 border-t border-line py-1.5 lg:gap-4 lg:py-3.5">
                    <span className="hidden w-8 shrink-0 font-mono text-[13px] font-semibold text-ink-3 lg:inline">{String(i + 1).padStart(2, '0')}</span>
                    <span className="order-first shrink-0 lg:hidden">{mark}</span>
                    <span className="flex flex-1 flex-col">
                      <span className="text-[14.5px] font-semibold lg:text-[15.5px]">{d.title}</span>
                      {d.due_date && <span className="text-xs text-ink-3">Due {format(new Date(d.due_date), 'MMM d')}</span>}
                    </span>
                    {manager ? (
                      <button
                        type="button"
                        aria-label={isDone ? `Mark “${d.title}” not done` : `Mark “${d.title}” done`}
                        aria-pressed={isDone}
                        disabled={toggle.isPending}
                        onClick={() => toggle.mutate({ planId: plan.id, id: d.id, status: isDone ? 'pending' : 'completed' })}
                        className="hidden cursor-pointer rounded-full border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-ink lg:block"
                      >
                        {mark}
                      </button>
                    ) : (
                      <span className="hidden lg:block" aria-label={isDone ? 'Completed' : 'Not done'}>
                        {mark}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        );
      })}
    </section>
  );
}

function ProjectTasks({ projectId, ws }: { projectId: number; ws: Workspace }) {
  const [page, setPage] = useState(1);
  const params = { tab: 'all' as const, project_id: projectId, page };
  const list = useQuery({ queryKey: ['tasks', 'project', params], queryFn: () => taskApi.list(params), placeholderData: keepPreviousData, refetchInterval: 30_000 });
  const tasks = list.data?.data ?? [];
  const total = list.data?.meta.total ?? 0;
  const since = list.dataUpdatedAt;
  const pager = (variant: 'desktop' | 'mobile') => <Pagination variant={variant} page={page} total={total} onPageChange={setPage} />;

  return (
    <>
      <div className="hidden lg:block">
        {ws.manager ? (
          <ManagerTaskTable tasks={tasks} since={since} onOpen={ws.openPanel} onEdit={ws.edit} onDelete={ws.onDelete} footer={pager('desktop')} />
        ) : (
          <StaffTaskTable tasks={tasks} since={since} actions={ws.actions} onOpen={ws.openPanel} onRequestExtension={ws.requestExtension} footer={pager('desktop')} />
        )}
      </div>
      <div className="flex flex-col gap-3 lg:hidden">
        {tasks.length === 0 && !list.isLoading && <p className="m-0 rounded-card bg-surface p-6 text-center text-sm text-ink-3">No tasks in this project.</p>}
        {tasks.map((t) =>
          ws.manager ? (
            <ManagerTaskCard key={t.id} t={t} since={since} onOpen={ws.openPanel} onEdit={ws.edit} onDelete={ws.onDelete} />
          ) : (
            <StaffTaskCard key={t.id} t={t} since={since} actions={ws.actions} onOpen={ws.openPanel} onRequestExtension={ws.requestExtension} />
          ),
        )}
        {total > 0 && pager('mobile')}
      </div>
    </>
  );
}

function Resources({ project: p }: { project: ProjectFull }) {
  const items = p.resources ?? [];
  return (
    <section aria-label="Resources" className="flex flex-col gap-1 rounded-[26px] bg-surface p-5 lg:rounded-[28px] lg:p-7">
      <h2 className="m-0 mb-2 font-display text-[22px] font-bold lg:text-[26px]">Resources</h2>
      {items.length === 0 && <p className="m-0 border-t border-line pt-4 text-sm text-ink-3">No resources yet.</p>}
      {items.map((r) => (
        <a
          key={r.id}
          href={r.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3.5 border-t border-line py-3.5 text-ink no-underline outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ink"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-stone">
            <Paperclip className="size-[18px]" aria-hidden="true" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[15px] font-semibold">{r.name}</span>
            <span className="text-[12.5px] text-ink-3 capitalize">{r.type ?? 'Link'}</span>
          </span>
          <ExternalLink className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
        </a>
      ))}
    </section>
  );
}
