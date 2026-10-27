'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, KeyRound, Plus, Search, UserCheck, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { usersApi } from '@/lib/api';
import { cn, roleLabel } from '@/lib/utils';
import { errorText } from '@/lib/tasks';
import { Avatar, Sheet, SheetActions, SheetDescription, SheetTitle } from '@/components/wc';
import { PageBody } from '@/components/shell/PageHeader';

// Admin (Admin / MAdmin artboards): accounts, roles and access.
// Operations Managers change accounts; Team Leads can only deactivate and
// reactivate, as the API allows.

type Account = {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email?: string | null;
  role: string;
  status: string;
  is_active: boolean;
  specialization?: string | null;
  department?: string | null;
  created_at: string;
};

const ROLES = ['operations_manager', 'team_lead', 'project_manager', 'staff', 'intern', 'customer_support_officer', 'client'];
const AVATAR_TONES = ['bg-yellow text-ink', 'bg-ink text-yellow', 'bg-review-tint text-review', 'bg-done-tint text-done'];
const STATUS: Record<string, { pill: string; dot: string }> = {
  active: { pill: 'bg-done-tint text-done', dot: 'bg-live' },
  pending: { pill: 'bg-pending-tint text-pending', dot: 'bg-pending' },
  inactive: { pill: 'bg-stone text-ink-2', dot: 'bg-idle' },
  deactivated: { pill: 'bg-missed-tint text-missed', dot: 'bg-missed' },
};
const fullName = (u: Account) => `${u.first_name} ${u.last_name}`.trim();

export function AdminScreen({ me }: { me: { id: number; role: string } }) {
  const qc = useQueryClient();
  const isOM = me.role === 'operations_manager';
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [deactivating, setDeactivating] = useState<Account | null>(null);
  const { data: users = [], isLoading } = useQuery<Account[]>({ queryKey: ['users', 'all'], queryFn: () => usersApi.listAll().then((r) => r.data) });

  const refresh = () => qc.invalidateQueries({ queryKey: ['users'] });
  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => usersApi.update(id, data),
    onSuccess: refresh,
    onError: (err) => toast.error(errorText(err, 'Could not update the user.')),
  });
  const resetPassword = useMutation({
    mutationFn: (id: number) => usersApi.resetPasswordToken(id),
    onSuccess: () => toast.success('A password setup email has been sent.'),
    onError: (err) => toast.error(errorText(err, 'Could not send the email.')),
  });
  const activate = useMutation({
    mutationFn: (id: number) => usersApi.activate(id),
    onSuccess: () => {
      refresh();
      toast.success('User activated. They can sign in again.');
    },
    onError: (err) => toast.error(errorText(err, 'Could not activate the user.')),
  });

  const term = q.trim().toLowerCase();
  const shown = users.filter((u) => !term || [fullName(u), u.email, u.username, roleLabel(u.role)].some((x) => x?.toLowerCase().includes(term)));
  const active = shown.filter((u) => u.is_active);
  const inactive = shown.filter((u) => !u.is_active);
  const tone = (u: Account) => AVATAR_TONES[users.indexOf(u) % AVATAR_TONES.length];

  const search = (className: string) => (
    <label className={cn('flex h-12 items-center gap-2 rounded-full px-[18px] text-ink-3 focus-within:ring-2 focus-within:ring-ink lg:h-[46px] lg:min-w-[260px]', className)}>
      <Search className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
      <input type="search" aria-label="Search users" placeholder="Search users" value={q} onChange={(e) => setQ(e.target.value)} className="min-w-0 flex-1 border-0 bg-transparent font-ui text-[15px] text-ink outline-none lg:text-[14.5px]" />
    </label>
  );

  const row = (u: Account) => {
    const status = u.is_active ? u.status : 'deactivated';
    const st = STATUS[status] ?? STATUS.inactive;
    const canDeactivate = u.is_active && u.id !== me.id && u.role !== 'team_lead';
    return (
      <article key={u.id} className="flex flex-col gap-3 rounded-[24px] bg-surface p-4 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-5 lg:gap-y-2.5 lg:rounded-none lg:border-t lg:border-line lg:bg-transparent lg:px-0 lg:py-3.5">
        <div className="flex min-w-0 items-center gap-3 lg:flex-[2.4_1_260px]">
          <Avatar name={fullName(u) || u.username} className={cn('size-11 lg:size-[42px]', tone(u))} />
          <button type="button" disabled={!isOM} onClick={() => setEditing(u)} className="flex min-w-0 flex-1 cursor-pointer flex-col gap-px border-0 bg-transparent p-0 text-left font-ui text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink disabled:cursor-default">
            <span className="text-[15.5px] font-bold">{fullName(u) || u.username}</span>
            <span className="truncate text-[12.5px] text-ink-3 lg:text-[13px]">
              {u.email || (isOM ? 'Add email…' : 'No email')}
              <span className="hidden lg:inline"> · @{u.username}</span>
            </span>
          </button>
          <StatusBadge status={status} st={st} className="lg:hidden" />
        </div>
        <div className="flex items-center gap-2 lg:contents">
          <label className="flex h-11 min-w-0 flex-1 items-center rounded-full bg-surface-2 pr-1.5 pl-3.5 focus-within:ring-2 focus-within:ring-ink lg:h-[42px] lg:flex-[1.4_1_190px] lg:pl-4">
            <span className="sr-only">Role for {fullName(u)}</span>
            <select
              value={u.role}
              disabled={!isOM || update.isPending}
              onChange={(e) => update.mutate({ id: u.id, data: { role: e.target.value } })}
              className="h-10 min-w-0 flex-1 cursor-pointer border-0 bg-transparent font-ui text-[13.5px] font-semibold text-ink outline-none disabled:cursor-default disabled:opacity-100 lg:h-[38px] lg:text-sm"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>
          </label>
          <span className="hidden lg:flex lg:flex-[0_0_118px]">
            <StatusBadge status={status} st={st} />
          </span>
          <span className="hidden text-[13.5px] text-ink-3 lg:block lg:flex-[1_1_120px]">Joined {formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}</span>
          <span className="flex shrink-0 gap-1.5 lg:w-[90px] lg:justify-end">
            {isOM && (
              <IconButton label={`Send a password setup email to ${fullName(u)}`} onClick={() => resetPassword.mutate(u.id)} disabled={resetPassword.isPending}>
                <KeyRound />
              </IconButton>
            )}
            {canDeactivate && (
              <IconButton label={`Deactivate ${fullName(u)}`} tone="danger" onClick={() => setDeactivating(u)}>
                <UserX />
              </IconButton>
            )}
            {!u.is_active && (
              <IconButton label={`Reactivate ${fullName(u)}`} tone="done" onClick={() => activate.mutate(u.id)} disabled={activate.isPending}>
                <UserCheck />
              </IconButton>
            )}
          </span>
        </div>
      </article>
    );
  };

  const total = users.length;
  const activeCount = users.filter((u) => u.is_active).length;

  return (
    <PageBody className="gap-3.5 pt-[52px] lg:gap-[22px] lg:pt-7">
      <div className="flex items-center gap-2.5 lg:hidden">
        <Link href="/dashboard/more" aria-label="Back to More" className="flex size-11 items-center justify-center rounded-full bg-surface text-ink">
          <ArrowLeft className="size-[18px]" aria-hidden="true" />
        </Link>
        <h1 className="m-0 flex-1 font-display text-[34px] leading-none font-bold tracking-[-0.04em]">Admin</h1>
        {isOM && (
          <button type="button" aria-label="Create user" onClick={() => setCreating(true)} className="flex size-12 cursor-pointer items-center justify-center rounded-full border-0 bg-yellow text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink">
            <Plus className="size-5" strokeWidth={2.4} aria-hidden="true" />
          </button>
        )}
      </div>
      <header className="hidden flex-wrap items-end justify-between gap-5 pt-2 pb-1 lg:flex">
        <div className="flex flex-col gap-2.5">
          <h1 className="m-0 font-display text-[56px] leading-none font-bold tracking-[-0.04em]">Admin</h1>
          <p className="m-0 text-base text-ink-2">Create accounts, set roles and control access</p>
        </div>
        {isOM && (
          <button type="button" onClick={() => setCreating(true)} className="inline-flex h-12 cursor-pointer items-center gap-2 rounded-full border-0 bg-yellow px-[22px] font-ui text-[15px] font-bold text-ink outline-none hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2">
            <Plus className="size-[18px]" strokeWidth={2.4} aria-hidden="true" />
            Create user
          </button>
        )}
      </header>

      <section aria-label="Accounts" className="grid grid-cols-2 gap-2.5 lg:flex lg:flex-wrap lg:gap-3.5">
        <div className="flex flex-col gap-1 rounded-[22px] bg-ink p-4 text-white lg:flex-[1_1_220px] lg:flex-row lg:items-center lg:gap-[18px] lg:rounded-[26px] lg:px-[26px] lg:py-[22px]">
          <span className="font-display text-[38px] leading-none font-bold text-yellow lg:text-[56px] lg:leading-[0.9]">{total}</span>
          <span className="text-[13px] font-semibold lg:text-base">users total</span>
        </div>
        <div className="flex flex-col gap-1 rounded-[22px] bg-surface p-4 lg:flex-[1_1_220px] lg:flex-row lg:items-center lg:gap-[18px] lg:rounded-[26px] lg:px-[26px] lg:py-[22px]">
          <span className="font-display text-[38px] leading-none font-bold lg:text-[56px] lg:leading-[0.9]">{activeCount}</span>
          <span className="text-[13px] font-semibold lg:text-base">active users</span>
        </div>
      </section>

      {search('bg-surface lg:hidden')}

      <section aria-labelledby="h-users" className="flex flex-col gap-2.5 lg:gap-2 lg:rounded-[30px] lg:bg-surface lg:p-[26px]">
        <div className="hidden flex-wrap items-center gap-3 pb-2.5 lg:flex">
          <h2 id="h-users" className="m-0 mr-auto font-display text-[26px] font-bold tracking-[-0.02em]">
            Active users
          </h2>
          {search('bg-stone')}
        </div>
        <h2 className="mx-1 mt-1 mb-0 font-display text-xl font-bold tracking-[-0.02em] lg:hidden">Active users</h2>
        {isLoading && <p className="m-0 text-sm text-ink-3">Loading…</p>}
        {!isLoading && active.length === 0 && <p className="m-0 py-3 text-sm text-ink-3">{term ? 'No active users match.' : 'No active users.'}</p>}
        {active.map(row)}
      </section>

      {inactive.length > 0 && (
        <section aria-labelledby="h-inactive" className="flex flex-col gap-2.5 lg:gap-2 lg:rounded-[30px] lg:bg-surface lg:p-[26px]">
          <h2 id="h-inactive" className="mx-1 mt-1 mb-0 font-display text-xl font-bold tracking-[-0.02em] lg:m-0 lg:pb-2.5 lg:text-[26px]">
            Deactivated users
          </h2>
          {inactive.map(row)}
        </section>
      )}

      <CreateUser open={creating} onClose={() => setCreating(false)} />
      <EditUser user={editing} onClose={() => setEditing(null)} />
      <Deactivate user={deactivating} onClose={() => setDeactivating(null)} />
    </PageBody>
  );
}

function StatusBadge({ status, st, className }: { status: string; st: { pill: string; dot: string }; className?: string }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold capitalize lg:px-[11px] lg:py-[5px] lg:text-[13px]', st.pill, className)}>
      <span aria-hidden="true" className={cn('size-1.5 rounded-full lg:size-[7px]', st.dot)} />
      {status}
    </span>
  );
}

function IconButton({ label, tone = 'stone', onClick, disabled, children }: { label: string; tone?: 'stone' | 'danger' | 'done'; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex size-11 cursor-pointer items-center justify-center rounded-full border-0 outline-none focus-visible:ring-2 focus-visible:ring-ink disabled:opacity-40 lg:size-[42px] [&_svg]:size-4',
        tone === 'stone' && 'bg-stone text-ink',
        tone === 'danger' && 'bg-missed-tint text-missed',
        tone === 'done' && 'bg-done-tint text-done',
      )}
    >
      {children}
    </button>
  );
}

const field = 'h-12 w-full rounded-2xl border-0 bg-surface-2 px-4 font-ui text-[15px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink';
const label = 'text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink-3';

function Field({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className={label}>{name}</span>
      {children}
    </label>
  );
}

const EMPTY = { first_name: '', last_name: '', username: '', email: '', role: 'staff', specialization: '', department: '' };

function CreateUser({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      {open && <CreateUserBody onClose={onClose} />}
    </Sheet>
  );
}

function CreateUserBody({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState(EMPTY);
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const create = useMutation({
    mutationFn: () => usersApi.create(f),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success(`User created. A password setup email was sent to ${res.data.user?.email ?? f.email}.`);
      onClose();
    },
    onError: (err) => toast.error(errorText(err, 'Could not create the user.')),
  });
  const ready = f.first_name.trim() && f.last_name.trim() && f.username.trim() && f.email.trim();
  return (
    <>
      <SheetTitle>Create user</SheetTitle>
      <SheetDescription>A password setup link is emailed to them.</SheetDescription>
      <div className="flex gap-2.5">
        <Field name="First name">
          <input value={f.first_name} onChange={set('first_name')} className={field} />
        </Field>
        <Field name="Last name">
          <input value={f.last_name} onChange={set('last_name')} className={field} />
        </Field>
      </div>
      <Field name="Username">
        <input value={f.username} onChange={set('username')} className={field} />
      </Field>
      <Field name="Email">
        <input type="email" placeholder="name@example.com" value={f.email} onChange={set('email')} className={field} />
      </Field>
      <div className="flex gap-2.5">
        <Field name="Role">
          <select value={f.role} onChange={set('role')} className={field}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {roleLabel(r)}
              </option>
            ))}
          </select>
        </Field>
        <Field name="Specialization">
          <input placeholder="e.g. developer" value={f.specialization} onChange={set('specialization')} className={field} />
        </Field>
      </div>
      <Field name="Department">
        <input value={f.department} onChange={set('department')} className={field} />
      </Field>
      <SheetActions confirmLabel={create.isPending ? 'Creating…' : 'Create user'} confirmDisabled={!ready || create.isPending} onConfirm={() => create.mutate()} />
    </>
  );
}

function EditUser({ user, onClose }: { user: Account | null; onClose: () => void }) {
  return (
    <Sheet open={user !== null} onOpenChange={(o) => !o && onClose()}>
      {user && <EditUserBody key={user.id} user={user} onClose={onClose} />}
    </Sheet>
  );
}

function EditUserBody({ user, onClose }: { user: Account; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email ?? '',
    specialization: user.specialization ?? '',
    department: user.department ?? '',
    status: user.status,
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const save = useMutation({
    mutationFn: () => usersApi.update(user.id, { ...f, email: f.email.trim() || null, specialization: f.specialization.trim() || null, department: f.department.trim() || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('User updated');
      onClose();
    },
    onError: (err) => toast.error(errorText(err, 'Could not update the user.')),
  });
  return (
    <>
      <SheetTitle>{fullName(user)}</SheetTitle>
      <SheetDescription>
        @{user.username} · {roleLabel(user.role)}
      </SheetDescription>
      <div className="flex gap-2.5">
        <Field name="First name">
          <input value={f.first_name} onChange={set('first_name')} className={field} />
        </Field>
        <Field name="Last name">
          <input value={f.last_name} onChange={set('last_name')} className={field} />
        </Field>
      </div>
      <Field name="Email">
        <input type="email" placeholder="name@example.com" value={f.email} onChange={set('email')} className={field} />
      </Field>
      <div className="flex gap-2.5">
        <Field name="Specialization">
          <input value={f.specialization} onChange={set('specialization')} className={field} />
        </Field>
        <Field name="Department">
          <input value={f.department} onChange={set('department')} className={field} />
        </Field>
      </div>
      <Field name="Account status">
        <select value={f.status} onChange={set('status')} className={cn(field, 'capitalize')}>
          {['active', 'pending', 'inactive'].map((s) => (
            <option key={s} value={s}>
              {s[0].toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </Field>
      <SheetActions confirmLabel="Save changes" confirmDisabled={!f.first_name.trim() || save.isPending} onConfirm={() => save.mutate()} />
    </>
  );
}

function Deactivate({ user, onClose }: { user: Account | null; onClose: () => void }) {
  const qc = useQueryClient();
  const deactivate = useMutation({
    mutationFn: (id: number) => usersApi.deactivate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('User deactivated. Their sessions were ended.');
      onClose();
    },
    onError: (err) => toast.error(errorText(err, 'Could not deactivate the user.')),
  });
  return (
    <Sheet open={user !== null} onOpenChange={(o) => !o && onClose()}>
      {user && (
        <>
          <SheetTitle>Deactivate {fullName(user)}?</SheetTitle>
          <SheetDescription>They are signed out straight away and can’t sign in until you reactivate them.</SheetDescription>
          <SheetActions confirmLabel="Deactivate" confirmDisabled={deactivate.isPending} onConfirm={() => deactivate.mutate(user.id)} />
        </>
      )}
    </Sheet>
  );
}
