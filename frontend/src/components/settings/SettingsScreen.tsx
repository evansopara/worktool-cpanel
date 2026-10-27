'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import type { User } from '@/types';
import { authApi, issuesApi } from '@/lib/api';
import { cn, roleLabel } from '@/lib/utils';
import { errorText } from '@/lib/tasks';
import { useThemeChoice, type ThemeChoice } from '@/lib/theme';
import { initials } from '@/components/wc';
import { PageBody } from '@/components/shell/PageHeader';

// Settings (Settings / MSettings artboards): profile, password, appearance
// and "Report an issue".

const card = 'flex flex-col gap-3.5 rounded-[26px] bg-surface p-5 lg:rounded-[28px] lg:p-7';
const h2 = 'm-0 font-display text-[22px] font-bold tracking-[-0.02em] lg:text-[26px]';
const label = 'flex min-w-0 flex-col gap-2 text-[13.5px] font-semibold text-ink-2';
const input = 'h-[50px] w-full rounded-2xl border-0 bg-surface-2 px-[18px] font-ui text-[15px] font-normal text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink';
const area = `${input} h-auto resize-y py-3.5 leading-normal`;

export function SettingsScreen({ user, onUserChange }: { user: User; onUserChange: (u: User) => void }) {
  const name = `${user.first_name} ${user.last_name}`.trim() || user.username;
  const anchors = [
    ['profile', 'Profile'],
    ['password', 'Password'],
    ['appearance', 'Appearance'],
    ['report', 'Report an issue'],
  ];

  return (
    <PageBody className="max-w-[1080px] gap-3.5 pt-[52px] lg:gap-5 lg:pt-7">
      <div className="flex items-center gap-2.5 lg:hidden">
        <Link href="/dashboard/more" aria-label="Back to More" className="flex size-11 items-center justify-center rounded-full bg-surface text-ink">
          <ArrowLeft className="size-[18px]" aria-hidden="true" />
        </Link>
        <span className="m-0 flex-1 font-display text-[34px] leading-none font-bold tracking-[-0.04em]">Settings</span>
      </div>

      <section aria-label="Your profile" className="flex flex-wrap items-center gap-4 rounded-[28px] bg-ink p-5 text-white lg:gap-6 lg:rounded-[32px] lg:p-8">
        <span aria-hidden="true" className="flex size-16 shrink-0 items-center justify-center rounded-full bg-yellow font-display text-2xl font-bold text-ink lg:size-[104px] lg:text-[38px]">
          {initials(name)}
        </span>
        <div className="flex min-w-0 flex-[1_1_180px] flex-col gap-1 lg:flex-[1_1_300px] lg:gap-1.5">
          <h1 className="m-0 font-display text-[26px] leading-none font-bold tracking-[-0.03em] lg:text-5xl lg:tracking-[-0.035em]">{name}</h1>
          <p className="m-0 truncate text-sm text-on-dark lg:text-base">
            {roleLabel(user.role)}
            {user.email && <span className="hidden lg:inline"> · {user.email}</span>}
          </p>
          {user.email && <p className="m-0 truncate text-sm text-on-dark lg:hidden">{user.email}</p>}
        </div>
        <nav aria-label="Settings sections" className="hidden flex-wrap gap-1.5 lg:flex">
          {anchors.map(([id, text], i) => (
            <a key={id} href={`#${id}`} className={cn('flex h-10 items-center rounded-full px-4 text-sm font-semibold no-underline outline-none focus-visible:ring-2 focus-visible:ring-yellow', i === 0 ? 'bg-surface text-ink' : 'bg-dark-1 text-white hover:bg-dark-2')}>
              {text}
            </a>
          ))}
        </nav>
      </section>

      <Profile key={user.id} user={user} onUserChange={onUserChange} />
      <div className="flex flex-col gap-3.5 lg:flex-row lg:flex-wrap lg:gap-5">
        <Password />
        <Appearance />
      </div>
      <Report />
    </PageBody>
  );
}

function Profile({ user, onUserChange }: { user: User; onUserChange: (u: User) => void }) {
  const [f, setF] = useState({ first_name: user.first_name ?? '', last_name: user.last_name ?? '', phone: user.phone ?? '' });
  const save = useMutation({
    mutationFn: () => authApi.updateProfile(f),
    onSuccess: (res) => {
      onUserChange(res.data);
      toast.success('Profile updated');
    },
    onError: (err) => toast.error(errorText(err, 'Could not update your profile.')),
  });
  return (
    <section id="profile" aria-labelledby="h-prof" className={cn(card, 'scroll-mt-6 lg:gap-[18px]')}>
      <h2 id="h-prof" className={h2}>
        Profile
      </h2>
      <div className="grid gap-3.5 lg:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
        <label className={label}>
          First name
          <input value={f.first_name} onChange={(e) => setF({ ...f, first_name: e.target.value })} className={input} />
        </label>
        <label className={label}>
          Last name
          <input value={f.last_name} onChange={(e) => setF({ ...f, last_name: e.target.value })} className={input} />
        </label>
        <label className={label}>
          Phone
          <input type="tel" placeholder="Add a phone number" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className={input} />
        </label>
      </div>
      <button type="button" onClick={() => save.mutate()} disabled={!f.first_name.trim() || save.isPending} className="h-12 cursor-pointer self-stretch rounded-full border-0 bg-ink px-6 font-ui text-[15px] font-semibold text-white outline-none hover:bg-black focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:opacity-40 lg:self-start">
        Save profile
      </button>
    </section>
  );
}

const NO_PASSWORDS = { current_password: '', password: '', password_confirmation: '' };

function Password() {
  const [f, setF] = useState(NO_PASSWORDS);
  const change = useMutation({
    mutationFn: () => authApi.changePassword(f),
    onSuccess: () => {
      toast.success('Password changed');
      setF(NO_PASSWORDS);
    },
    onError: (err) => toast.error(errorText(err, 'Could not change your password.')),
  });
  const mismatch = f.password_confirmation !== '' && f.password !== f.password_confirmation;
  const fields: [keyof typeof f, string, string][] = [
    ['current_password', 'Current password', 'current-password'],
    ['password', 'New password', 'new-password'],
    ['password_confirmation', 'Confirm new password', 'new-password'],
  ];
  return (
    <section id="password" aria-labelledby="h-pass" className={cn(card, 'scroll-mt-6 lg:flex-[1_1_380px]')}>
      <h2 id="h-pass" className={h2}>
        Change password
      </h2>
      {fields.map(([k, text, auto]) => (
        <label key={k} className={label}>
          {text}
          <input type="password" autoComplete={auto} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className={input} />
        </label>
      ))}
      {mismatch && <p className="m-0 text-[13px] font-semibold text-missed">The new passwords don’t match.</p>}
      <button
        type="button"
        onClick={() => change.mutate()}
        disabled={!f.current_password || !f.password || mismatch || !f.password_confirmation || change.isPending}
        className="h-12 cursor-pointer self-stretch rounded-full border-0 bg-stone px-6 font-ui text-[15px] font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:opacity-40 lg:self-start"
      >
        Update password
      </button>
    </section>
  );
}

const THEMES: { value: ThemeChoice; label: string; preview: React.ReactNode }[] = [
  { value: 'light', label: 'Light', preview: <span className="flex h-[72px] items-end rounded-xl bg-[#EFEDE7] p-2"><span className="h-[18px] w-3/5 rounded-md bg-white" /></span> },
  { value: 'dark', label: 'Dark', preview: <span className="flex h-[72px] items-end rounded-xl bg-[#121212] p-2"><span className="h-[18px] w-3/5 rounded-md bg-[#FFD43B]" /></span> },
  { value: 'device', label: 'Device', preview: <span className="block h-[72px] rounded-xl bg-[linear-gradient(90deg,#EFEDE7_50%,#121212_50%)]" /> },
];

function Appearance() {
  const [choice, setChoice] = useThemeChoice();
  return (
    <section id="appearance" aria-labelledby="h-app" className={cn(card, 'scroll-mt-6 lg:flex-[1_1_380px]')}>
      <h2 id="h-app" className={h2}>
        Appearance
      </h2>
      <div role="radiogroup" aria-labelledby="h-app" className="grid grid-cols-3 gap-2.5">
        {THEMES.map((t) => {
          const on = choice === t.value;
          return (
            <button
              key={t.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setChoice(t.value)}
              className={cn('flex cursor-pointer flex-col gap-2.5 rounded-[20px] border-2 p-2.5 text-left font-ui outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2', on ? 'border-ink bg-surface' : 'border-transparent bg-surface-2')}
            >
              <span aria-hidden="true">{t.preview}</span>
              <span className="text-sm font-semibold text-ink">{t.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

type Issue = { id: number; title: string; description: string; status: string; created_at: string };
const ISSUE_STATUS: Record<string, string> = {
  pending: 'bg-pending-tint text-pending',
  reviewing: 'bg-review-tint text-review',
  resolved: 'bg-done-tint text-done',
  closed: 'bg-ink text-white',
};
const CATEGORIES = [
  ['bug', 'Bug'],
  ['feature_request', 'Feature request'],
  ['improvement', 'Improvement'],
  ['other', 'Other'],
];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const NO_REPORT = { title: '', category: 'other', priority: 'medium', description: '', suggestions: '' };

function Report() {
  const qc = useQueryClient();
  const [f, setF] = useState(NO_REPORT);
  const issues = useQuery<Issue[]>({ queryKey: ['issues'], queryFn: () => issuesApi.list().then((r) => r.data) });
  const submit = useMutation({
    mutationFn: () => issuesApi.create({ ...f, title: f.title.trim(), description: f.description.trim(), suggestions: f.suggestions.trim() || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['issues'] });
      toast.success('Report submitted. Thank you.');
      setF(NO_REPORT);
    },
    onError: (err) => toast.error(errorText(err, 'Could not submit the report.')),
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <section id="report" aria-labelledby="h-rep" className={cn(card, 'scroll-mt-6 lg:flex-row lg:flex-wrap lg:gap-7')}>
      <div className="flex flex-col gap-3.5 lg:flex-[3_1_400px]">
        <div className="flex flex-col gap-1.5">
          <h2 id="h-rep" className={h2}>
            Report an issue
          </h2>
          <p className="m-0 text-sm text-ink-2 lg:text-[14.5px]">Help us improve the app by reporting bugs, requesting features, or suggesting improvements.</p>
        </div>
        <label className={label}>
          Issue title
          <input required placeholder="Brief description of the issue" value={f.title} onChange={set('title')} className={input} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>
            Category
            <select value={f.category} onChange={set('category')} className={cn(input, 'px-3.5')}>
              {CATEGORIES.map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Priority
            <select value={f.priority} onChange={set('priority')} className={cn(input, 'px-3.5')}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p[0].toUpperCase() + p.slice(1)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className={label}>
          Issue description
          <textarea required rows={4} placeholder="Steps to reproduce, expected behaviour, and actual behaviour" value={f.description} onChange={set('description')} className={area} />
        </label>
        <label className={label}>
          Suggestions (optional)
          <textarea rows={3} placeholder="Any suggestions on how this could be fixed or improved" value={f.suggestions} onChange={set('suggestions')} className={area} />
        </label>
        <button type="button" onClick={() => submit.mutate()} disabled={!f.title.trim() || !f.description.trim() || submit.isPending} className="h-[50px] cursor-pointer self-stretch rounded-full border-0 bg-yellow px-[26px] font-ui text-[15px] font-bold text-ink outline-none hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:opacity-40 lg:self-start">
          Submit report
        </button>
      </div>
      <div className="flex flex-col gap-3 lg:flex-[2_1_260px]">
        <h3 className="m-0 text-base font-bold">Your reports</h3>
        {issues.isLoading && <p className="m-0 text-sm text-ink-3">Loading…</p>}
        {issues.data?.length === 0 && <p className="m-0 rounded-[22px] bg-surface-2 p-5 text-sm text-ink-3">Nothing reported yet.</p>}
        {issues.data?.map((i) => (
          <article key={i.id} className="flex flex-col gap-2 rounded-[22px] bg-surface-2 p-5">
            <div className="flex items-start justify-between gap-2.5">
              <span className="text-base font-bold">{i.title}</span>
              <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[12.5px] font-semibold capitalize', ISSUE_STATUS[i.status] ?? ISSUE_STATUS.pending)}>{i.status}</span>
            </div>
            <p className="m-0 line-clamp-3 text-sm text-ink-2">{i.description}</p>
            <p className="m-0 text-[13px] text-ink-3">Submitted {format(new Date(i.created_at), 'MMM d, yyyy · h:mm a')}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
