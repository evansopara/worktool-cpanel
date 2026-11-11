'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { projectsApi, usersApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Avatar, Sheet, SheetActions, SheetTitle } from '@/components/wc';
import { errorText } from '@/lib/tasks';
import { CATEGORIES, type ProjectFull } from '@/lib/projects';

// New project / Edit project. Not drawn in the design; built from its parts
// with the old page's fields (members, domain dates, optional plan).

type UserRow = { id: number; first_name: string; last_name: string; role: string };
type Row = { name: string; start: string; end: string };

const day = (iso?: string | null) => (iso ? iso.slice(0, 10) : '');
const roleText = (r: string) => r.replace(/_/g, ' ');

export function ProjectForm({ open, project, onClose }: { open: boolean; project: ProjectFull | null; onClose: () => void }) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      {open && <Body key={project?.id ?? 'new'} project={project} onClose={onClose} />}
    </Sheet>
  );
}

function Body({ project, onClose }: { project: ProjectFull | null; onClose: () => void }) {
  const qc = useQueryClient();
  const editing = !!project;
  const { data: users = [] } = useQuery<UserRow[]>({ queryKey: ['users'], queryFn: () => usersApi.list().then((r) => r.data) });
  const clients = users.filter((u) => u.role === 'client');
  const staff = users.filter((u) => u.role !== 'client');

  const [f, setF] = useState({
    name: project?.name ?? '',
    description: project?.description ?? '',
    category: project?.category ?? '',
    client_id: project?.client_id ? String(project.client_id) : '',
    status: project?.status ?? 'active',
    start_date: day(project?.start_date),
    end_date: day(project?.end_date),
    domain_registered_at: day(project?.domain_registered_at),
    domain_expires_at: day(project?.domain_expires_at),
  });
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const [memberIds, setMemberIds] = useState<number[]>([]);
  const [planOn, setPlanOn] = useState(false);
  const [plan, setPlan] = useState({ name: '', description: '', start: '', end: '' });
  const [rows, setRows] = useState<Row[]>([{ name: '', start: '', end: '' }]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['projects'] });
    if (project) qc.invalidateQueries({ queryKey: ['project', project.id] });
    qc.invalidateQueries({ queryKey: ['home'] });
  };

  const save = useMutation({
    mutationFn: async () => {
      const data: Record<string, unknown> = {
        ...f,
        name: f.name.trim(),
        client_id: f.client_id ? Number(f.client_id) : null,
        domain_registered_at: f.domain_registered_at || null,
        domain_expires_at: f.domain_expires_at || null,
      };
      if (project) return projectsApi.update(project.id, data);
      const res = await projectsApi.create({ ...data, member_ids: memberIds.length ? memberIds : undefined });
      if (planOn && plan.name.trim()) {
        const planRes = await projectsApi.createPlan(res.data.id, {
          title: plan.name.trim(),
          description: plan.description || undefined,
          start_date: plan.start || undefined,
          end_date: plan.end || undefined,
        });
        for (const r of rows.filter((r) => r.name.trim())) {
          await projectsApi.createDeliverable(res.data.id, planRes.data.id, { title: r.name.trim(), start_date: r.start || undefined, due_date: r.end || undefined });
        }
      }
      return res;
    },
    onSuccess: () => {
      toast.success(editing ? 'Project updated' : 'Project created');
      refresh();
      onClose();
    },
    onError: (err) => toast.error(errorText(err, editing ? 'Could not update the project.' : 'Could not create the project.')),
  });

  // Members change straight away when editing, as on the old page.
  const addMember = useMutation({
    mutationFn: (userId: number) => projectsApi.addMember(project!.id, { user_id: userId, role: 'member' }),
    onSuccess: refresh,
    onError: (err) => toast.error(errorText(err, 'Could not add the member.')),
  });
  const removeMember = useMutation({
    mutationFn: (userId: number) => projectsApi.removeMember(project!.id, userId),
    onSuccess: refresh,
    onError: (err) => toast.error(errorText(err, 'Could not remove the member.')),
  });
  const [adding, setAdding] = useState('');

  const ready = f.name.trim() && f.category && f.start_date && f.end_date && !save.isPending;
  const memberUserIds = new Set((project?.members ?? []).map((m) => m.user_id));

  return (
    <>
      <SheetTitle>{editing ? 'Edit project' : 'New project'}</SheetTitle>
      <form
        className="flex flex-col gap-3.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) save.mutate();
        }}
      >
        <Field label="Name">
          <input required value={f.name} onChange={(e) => set('name', e.target.value)} className={input} />
        </Field>
        <Field label="Description">
          <textarea rows={2} value={f.description} onChange={(e) => set('description', e.target.value)} className={`${input} h-auto py-3 leading-normal`} />
        </Field>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Category">
            <select required value={f.category} onChange={(e) => set('category', e.target.value)} className={input}>
              <option value="">Choose a category</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select value={f.status} onChange={(e) => set('status', e.target.value)} className={input}>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="inactive">Inactive</option>
            </select>
          </Field>
          <Field label="Client">
            <select value={f.client_id} onChange={(e) => set('client_id', e.target.value)} className={input}>
              <option value="">No client</option>
              {clients.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.first_name} {u.last_name}
                </option>
              ))}
            </select>
          </Field>
          <span className="hidden sm:block" />
          <Field label="Start date">
            <input required type="date" value={f.start_date} onChange={(e) => set('start_date', e.target.value)} className={input} />
          </Field>
          <Field label="End date">
            <input required type="date" min={f.start_date || undefined} value={f.end_date} onChange={(e) => set('end_date', e.target.value)} className={input} />
          </Field>
          <Field label="Domain registered">
            <input type="date" value={f.domain_registered_at} onChange={(e) => set('domain_registered_at', e.target.value)} className={input} />
          </Field>
          <Field label="Domain expires">
            <input type="date" value={f.domain_expires_at} onChange={(e) => set('domain_expires_at', e.target.value)} className={input} />
          </Field>
        </div>

        {/* Members */}
        <div className="flex flex-col gap-2">
          <span className={labelCls}>Team</span>
          {editing ? (
            <>
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {(project.members ?? []).map((m) => (
                  <li key={m.id} className="flex items-center gap-3 rounded-2xl bg-surface-2 px-3 py-2">
                    <Avatar name={`${m.user?.first_name ?? ''} ${m.user?.last_name ?? ''}`} size="sm" tone="stone" />
                    <span className="flex flex-1 flex-col">
                      <span className="text-sm font-semibold">
                        {m.user?.first_name} {m.user?.last_name}
                      </span>
                      <span className="text-xs text-ink-3 capitalize">{roleText(m.user?.role ?? m.role ?? '')}</span>
                    </span>
                    <button type="button" aria-label={`Remove ${m.user?.first_name}`} onClick={() => removeMember.mutate(m.user_id)} className="flex size-8 cursor-pointer items-center justify-center rounded-full border-0 bg-missed-tint text-missed outline-none focus-visible:ring-2 focus-visible:ring-ink">
                      <X className="size-4" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <select value={adding} onChange={(e) => setAdding(e.target.value)} aria-label="Add a member" className={input}>
                  <option value="">Add a member…</option>
                  {staff
                    .filter((u) => !memberUserIds.has(u.id))
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.first_name} {u.last_name} — {roleText(u.role)}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  disabled={!adding || addMember.isPending}
                  onClick={() => {
                    addMember.mutate(Number(adding));
                    setAdding('');
                  }}
                  className="h-12 shrink-0 cursor-pointer rounded-full border-0 bg-ink px-5 font-ui text-sm font-semibold text-white disabled:opacity-40"
                >
                  Add
                </button>
              </div>
            </>
          ) : (
            <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-2xl bg-surface-2 p-2">
              {staff.map((u) => (
                <label key={u.id} className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-surface">
                  <input
                    type="checkbox"
                    checked={memberIds.includes(u.id)}
                    onChange={(e) => setMemberIds((ids) => (e.target.checked ? [...ids, u.id] : ids.filter((i) => i !== u.id)))}
                    className="size-4 accent-ink"
                  />
                  <span className="flex-1 text-sm font-semibold">
                    {u.first_name} {u.last_name}
                  </span>
                  <span className="text-xs text-ink-3 capitalize">{roleText(u.role)}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Optional plan, new projects only */}
        {!editing && (
          <div className="flex flex-col gap-3 rounded-2xl bg-surface-2 p-4">
            <label className="flex cursor-pointer items-center gap-3">
              <input type="checkbox" checked={planOn} onChange={(e) => setPlanOn(e.target.checked)} className="size-[18px] accent-ink" />
              <span className="text-sm font-semibold">Add a project plan</span>
            </label>
            {planOn && (
              <>
                <input placeholder="Plan name" value={plan.name} onChange={(e) => setPlan({ ...plan, name: e.target.value })} className={cn(input, 'bg-surface')} />
                <input placeholder="What the plan delivers" value={plan.description} onChange={(e) => setPlan({ ...plan, description: e.target.value })} className={cn(input, 'bg-surface')} />
                <span className={labelCls}>Steps</span>
                {rows.map((r, i) => (
                  <div key={i} className="flex flex-wrap gap-2">
                    <input
                      placeholder={`Step ${i + 1}`}
                      value={r.name}
                      onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                      className={cn(input, 'flex-[2_1_200px] bg-surface')}
                    />
                    <input type="date" aria-label={`Step ${i + 1} start`} value={r.start} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} className={cn(input, 'flex-[1_1_120px] bg-surface')} />
                    <input type="date" aria-label={`Step ${i + 1} due`} value={r.end} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} className={cn(input, 'flex-[1_1_120px] bg-surface')} />
                    {rows.length > 1 && (
                      <button type="button" aria-label={`Remove step ${i + 1}`} onClick={() => setRows(rows.filter((_, j) => j !== i))} className="flex size-12 cursor-pointer items-center justify-center rounded-full border-0 bg-surface text-missed">
                        <X className="size-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => setRows([...rows, { name: '', start: '', end: '' }])} className="flex h-10 cursor-pointer items-center gap-1.5 self-start rounded-full border-0 bg-surface px-4 font-ui text-sm font-semibold text-ink">
                  <Plus className="size-4" aria-hidden="true" />
                  Add step
                </button>
              </>
            )}
          </div>
        )}

        <SheetActions confirmLabel={editing ? 'Save changes' : 'Create project'} confirmDisabled={!ready} onConfirm={() => ready && save.mutate()} />
      </form>
    </>
  );
}

const input = 'h-12 w-full min-w-0 rounded-2xl border-0 bg-surface-2 px-4 font-ui text-[15px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink';
const labelCls = 'text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink-3';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={labelCls}>{label}</span>
      {children}
    </label>
  );
}
