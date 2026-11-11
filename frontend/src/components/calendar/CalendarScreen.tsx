'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek } from 'date-fns';
import { ArrowLeft, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { User } from '@/types';
import { bookingsApi, usersApi } from '@/lib/api';
import { cn, toDatetimeLocalValue } from '@/lib/utils';
import { Button, Sheet, SheetActions, SheetDescription, SheetTitle } from '@/components/wc';
import { PageBody } from '@/components/shell/PageHeader';
import { errorText } from '@/lib/tasks';

// Calendar (Workspace / MCalendar artboards): month grid with meeting days
// highlighted, and the month's meetings with edit and delete. Booking rules
// follow the old Bookings page.

type BookingType = 'one_on_one' | 'team' | 'marketing_meeting_call' | 'general';
type Booking = {
  id: number;
  title: string;
  description?: string | null;
  type: BookingType;
  participants?: number[] | null;
  start_time: string;
  end_time: string;
  status?: string | null;
  meeting_link?: string | null;
  scheduled_by: number;
  scheduler?: { id: number; first_name: string; last_name: string };
};
type Member = { id: number; first_name: string; last_name: string; role: string; specialization?: string | null };

const TYPE_LABELS: Record<BookingType, string> = {
  one_on_one: 'One-on-One Booking',
  team: 'Team Booking',
  marketing_meeting_call: 'Marketing Meeting Call',
  general: 'General Booking',
};
const MARKETING_KEYWORDS = ['media buying', 'media_buying', 'automation', 'copywriting', 'copywriter', 'community manager', 'community_manager', 'marketing'];
const name = (u?: { first_name?: string; last_name?: string }) => (u ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() : '');
const isLink = (s: string) => /^https?:\/\//i.test(s);

export function CalendarScreen({ user }: { user: User }) {
  const qc = useQueryClient();
  const [today] = useState(() => new Date());
  const [month, setMonth] = useState(() => startOfMonth(today));
  const [day, setDay] = useState<Date | null>(null);
  const [form, setForm] = useState<{ open: boolean; booking: Booking | null }>({ open: false, booking: null });
  const [deleting, setDeleting] = useState<Booking | null>(null);

  const bookings = useQuery<Booking[]>({ queryKey: ['bookings'], queryFn: () => bookingsApi.list().then((r) => r.data) });
  const { data: users = [] } = useQuery<Member[]>({ queryKey: ['users'], queryFn: () => usersApi.list().then((r) => r.data) });
  const names = new Map(users.map((u) => [u.id, name(u)]));

  const remove = useMutation({
    mutationFn: (id: number) => bookingsApi.remove(id),
    onSuccess: () => {
      toast.success('Meeting deleted');
      qc.invalidateQueries({ queryKey: ['bookings'] });
      setDeleting(null);
    },
    onError: (err) => toast.error(errorText(err, 'Could not delete the meeting.')),
  });

  const all = bookings.data ?? [];
  const cells = useMemo(
    () => eachDayOfInterval({ start: startOfWeek(month, { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }) }),
    [month],
  );
  const onDay = (d: Date) => all.filter((b) => isSameDay(new Date(b.start_time), d));
  const agenda = all
    .filter((b) => (day ? isSameDay(new Date(b.start_time), day) : isSameMonth(new Date(b.start_time), month)))
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  // The next meeting still to come gets the dark card.
  const nextId = agenda.find((b) => new Date(b.end_time) >= today)?.id;
  const canManage = (b: Booking) => b.scheduled_by === user.id || ['operations_manager', 'team_lead'].includes(user.role);
  const goMonth = (n: number) => {
    setMonth((m) => addMonths(m, n));
    setDay(null);
  };
  const who = (b: Booking) => {
    const list = (b.participants ?? []).map((id) => names.get(id)).filter(Boolean) as string[];
    if (list.length === 0) return 'No participants';
    return list.length > 3 ? `${list.slice(0, 2).join(', ')} and ${list.length - 2} others` : list.join(', ');
  };

  const monthNav = (size: 'sm' | 'lg') => (
    <div className="flex items-center gap-1.5 lg:gap-2.5">
      <h2 className={cn('m-0 flex-1 font-display font-bold', size === 'lg' ? 'text-[30px] tracking-[-0.02em]' : 'text-[22px]')}>{format(month, 'MMMM yyyy')}</h2>
      <button type="button" aria-label="Previous month" onClick={() => goMonth(-1)} className="flex size-11 cursor-pointer items-center justify-center rounded-full border-0 bg-stone text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink">
        <ChevronLeft className="size-[18px]" aria-hidden="true" />
      </button>
      <button type="button" aria-label="Next month" onClick={() => goMonth(1)} className="flex size-11 cursor-pointer items-center justify-center rounded-full border-0 bg-stone text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink">
        <ChevronRight className="size-[18px]" aria-hidden="true" />
      </button>
    </div>
  );

  return (
    <PageBody className="gap-3.5 pt-[52px] lg:gap-[22px] lg:pt-7">
      <div className="flex items-center gap-2.5 lg:hidden">
        <Link href="/dashboard/more" aria-label="Back to More" className="flex size-11 items-center justify-center rounded-full bg-surface text-ink">
          <ArrowLeft className="size-[18px]" aria-hidden="true" />
        </Link>
        <h1 className="m-0 flex-1 font-display text-[34px] leading-none font-bold tracking-[-0.04em]">Calendar</h1>
        <button type="button" aria-label="Schedule meeting" onClick={() => setForm({ open: true, booking: null })} className="flex size-12 cursor-pointer items-center justify-center rounded-full border-0 bg-yellow text-ink">
          <Plus className="size-5" strokeWidth={2.4} aria-hidden="true" />
        </button>
      </div>
      <p className="m-0 mx-1 text-sm text-ink-2 lg:hidden">Schedule and manage team meetings</p>
      <header className="hidden flex-wrap items-end justify-between gap-5 pt-2 pb-1 lg:flex">
        <div className="flex flex-col gap-2.5">
          <h1 className="m-0 font-display text-[56px] leading-none font-bold tracking-[-0.04em]">Calendar</h1>
          <p className="m-0 text-base text-ink-2">Schedule and manage team meetings</p>
        </div>
        <Button variant="accent" onClick={() => setForm({ open: true, booking: null })}>
          <Plus strokeWidth={2.4} aria-hidden="true" />
          Schedule meeting
        </Button>
      </header>

      <div className="flex flex-col gap-3.5 lg:flex-row lg:flex-wrap lg:items-start lg:gap-5">
        <section aria-label="Month" className="flex min-w-0 flex-col gap-3 rounded-[26px] bg-surface p-4 lg:flex-[3_1_520px] lg:gap-[18px] lg:rounded-[28px] lg:p-[26px]">
          <div className="lg:hidden">{monthNav('sm')}</div>
          <div className="hidden lg:block">{monthNav('lg')}</div>
          <div className="grid grid-cols-7 gap-1 lg:gap-1.5">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <span key={d} className="py-1 text-center text-[11.5px] font-semibold text-ink-3 lg:py-1.5 lg:text-[12.5px] lg:uppercase lg:tracking-[0.05em]">
                {d}
              </span>
            ))}
            {cells.map((d) => {
              const inMonth = isSameMonth(d, month);
              const meetings = inMonth ? onDay(d) : [];
              const selected = day && isSameDay(d, day);
              if (!inMonth) return <span key={d.toISOString()} aria-hidden="true" />;
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  onClick={() => setDay(selected ? null : d)}
                  aria-pressed={!!selected}
                  aria-label={`${format(d, 'MMMM d')}${meetings.length ? `, ${meetings.length} meeting${meetings.length === 1 ? '' : 's'}` : ''}`}
                  className={cn(
                    'flex h-10 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-0 text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink lg:h-auto lg:min-h-[82px] lg:items-start lg:justify-start lg:rounded-2xl lg:p-2.5 lg:text-left',
                    selected ? 'bg-ink text-white' : meetings.length ? 'bg-yellow' : 'bg-surface-2',
                    isSameDay(d, today) && !selected && 'ring-2 ring-ink ring-inset',
                  )}
                >
                  <span className="font-mono text-[13.5px] font-semibold lg:text-sm">{format(d, 'd')}</span>
                  {meetings.length > 0 && (
                    <span className="hidden text-xs leading-[1.3] font-semibold lg:block">
                      {meetings[0].title} · {format(new Date(meetings[0].start_time), 'HH:mm')}
                      {meetings.length > 1 && ` +${meetings.length - 1}`}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="h-agenda" className="flex min-w-0 flex-col gap-3 lg:flex-[2_1_340px] lg:gap-3.5">
          <div className="flex items-center justify-between gap-2 px-1 pt-1">
            <h2 id="h-agenda" className="m-0 font-display text-[22px] font-bold tracking-[-0.02em] lg:text-[26px]">
              {day ? format(day, 'EEEE, MMM d') : 'Meetings'}
            </h2>
            {day && (
              <button type="button" onClick={() => setDay(null)} className="cursor-pointer border-0 bg-transparent font-ui text-sm font-semibold text-ink">
                Whole month
              </button>
            )}
          </div>
          {bookings.isLoading && <p className="m-0 text-sm text-ink-3">Loading…</p>}
          {!bookings.isLoading && agenda.length === 0 && <p className="m-0 rounded-card bg-surface p-6 text-sm text-ink-3">No meetings {day ? 'on this day' : 'this month'}.</p>}
          {agenda.map((b) => {
            const dark = b.id === nextId;
            const start = new Date(b.start_time);
            return (
              <article key={b.id} className={cn('flex flex-col gap-3 rounded-[26px] p-[18px] lg:gap-3.5 lg:p-[22px]', dark ? 'bg-ink text-white' : 'bg-surface text-ink')}>
                <div className="flex items-start gap-3.5">
                  <div className="flex w-12 shrink-0 flex-col items-center gap-0.5 lg:w-14">
                    <span className="text-[11px] font-semibold tracking-[0.08em] uppercase opacity-75 lg:text-xs">{format(start, 'MMM')}</span>
                    <span className="font-display text-[32px] leading-none font-bold lg:text-[38px]">{format(start, 'd')}</span>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <h3 className="m-0 text-[17px] font-bold lg:text-[19px]">{b.title}</h3>
                    <span className="font-mono text-[13px] font-semibold lg:text-[13.5px]">
                      {format(start, 'HH:mm')} – {format(new Date(b.end_time), 'HH:mm')}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[TYPE_LABELS[b.type] ?? b.type, b.status ? b.status[0].toUpperCase() + b.status.slice(1) : null].filter(Boolean).map((t) => (
                        <span key={t} className={cn('rounded-full px-2.5 py-1 text-[12.5px] font-semibold', dark ? 'bg-dark-2' : 'bg-stone')}>
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                {b.description && <p className="m-0 text-sm whitespace-pre-wrap lg:text-[14.5px]">{b.description}</p>}
                <p className="m-0 text-[13.5px] opacity-80">
                  With {who(b)} · Booked by {name(b.scheduler) || '—'}
                </p>
                {b.meeting_link &&
                  (isLink(b.meeting_link) ? (
                    <a href={b.meeting_link} target="_blank" rel="noopener noreferrer" className="text-[13.5px] font-semibold [overflow-wrap:anywhere] text-inherit">
                      {b.meeting_link}
                    </a>
                  ) : (
                    <p className="m-0 text-[13.5px] font-semibold [overflow-wrap:anywhere]">{b.meeting_link}</p>
                  ))}
                {canManage(b) && (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setForm({ open: true, booking: b })} className={cn('h-11 flex-1 cursor-pointer rounded-full border-0 px-[18px] font-ui text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-yellow lg:h-[42px] lg:flex-none', dark ? 'bg-dark-2 text-white' : 'bg-stone text-ink')}>
                      Edit
                    </button>
                    <button type="button" onClick={() => setDeleting(b)} className={cn('h-11 flex-1 cursor-pointer rounded-full border-0 bg-transparent px-[18px] font-ui text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-yellow lg:h-[42px] lg:flex-none', dark ? 'text-missed-on-dark' : 'text-missed')}>
                      Delete
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </section>
      </div>

      <BookingForm open={form.open} booking={form.booking} users={users} me={user} onClose={() => setForm({ open: false, booking: null })} />
      <Sheet open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        {deleting && (
          <>
            <SheetTitle>Delete “{deleting.title}”?</SheetTitle>
            <SheetDescription>{format(new Date(deleting.start_time), 'EEEE, MMM d · HH:mm')}. This can’t be undone.</SheetDescription>
            <SheetActions confirmLabel="Delete meeting" confirmDisabled={remove.isPending} onConfirm={() => remove.mutate(deleting.id)} />
          </>
        )}
      </Sheet>
    </PageBody>
  );
}

function BookingForm({ open, booking, users, me, onClose }: { open: boolean; booking: Booking | null; users: Member[]; me: User; onClose: () => void }) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      {open && <BookingBody key={booking?.id ?? 'new'} booking={booking} users={users} me={me} onClose={onClose} />}
    </Sheet>
  );
}

function BookingBody({ booking, users, me, onClose }: { booking: Booking | null; users: Member[]; me: User; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    title: booking?.title ?? '',
    description: booking?.description ?? '',
    type: (booking?.type ?? 'one_on_one') as BookingType,
    participants: booking?.participants ?? ([] as number[]),
    start_time: toDatetimeLocalValue(booking?.start_time),
    end_time: toDatetimeLocalValue(booking?.end_time),
    meeting_link: booking?.meeting_link ?? '',
  });

  // Who can be invited; General and Marketing calls include everyone eligible.
  const eligible = users.filter((u) => {
    if (u.id === me.id || u.role === 'client') return false;
    if (f.type !== 'marketing_meeting_call') return true;
    if (u.role === 'project_manager') return true;
    const spec = (u.specialization ?? '').toLowerCase();
    return MARKETING_KEYWORDS.some((k) => spec.includes(k));
  });
  const auto = f.type === 'general' || f.type === 'marketing_meeting_call';
  const participants = auto ? eligible.map((u) => u.id) : f.participants;

  const save = useMutation({
    mutationFn: () => {
      const data = {
        title: f.title.trim(),
        description: f.description || undefined,
        type: f.type,
        participants,
        start_time: f.start_time,
        end_time: f.end_time,
        meeting_link: f.meeting_link || undefined,
      };
      return booking ? bookingsApi.update(booking.id, data) : bookingsApi.create(data);
    },
    onSuccess: () => {
      toast.success(booking ? 'Meeting updated' : 'Meeting scheduled');
      qc.invalidateQueries({ queryKey: ['bookings'] });
      onClose();
    },
    onError: (err) => toast.error(errorText(err, 'Could not save the meeting.')),
  });

  const endOk = f.start_time && f.end_time && f.end_time > f.start_time;
  const ready = f.title.trim() && participants.length > 0 && endOk && !save.isPending;
  const field = 'h-12 w-full min-w-0 rounded-2xl border-0 bg-surface-2 px-4 font-ui text-[15px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink';
  const label = 'text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink-3';

  return (
    <>
      <SheetTitle>{booking ? 'Edit meeting' : 'Schedule meeting'}</SheetTitle>
      <label className="flex flex-col gap-1.5">
        <span className={label}>Title</span>
        <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className={field} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={label}>Type</span>
        <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as BookingType, participants: [] })} className={field}>
          {(Object.keys(TYPE_LABELS) as BookingType[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </label>
      {auto ? (
        <p className="m-0 rounded-2xl bg-surface-2 px-4 py-3 text-[13.5px] text-ink-2">
          Everyone eligible is invited automatically ({participants.length} {participants.length === 1 ? 'person' : 'people'}).
        </p>
      ) : f.type === 'one_on_one' ? (
        <label className="flex flex-col gap-1.5">
          <span className={label}>With</span>
          <select value={f.participants[0] ?? ''} onChange={(e) => setF({ ...f, participants: e.target.value ? [Number(e.target.value)] : [] })} className={field}>
            <option value="">Choose a person</option>
            {eligible.map((u) => (
              <option key={u.id} value={u.id}>
                {name(u)}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <div className="flex flex-col gap-1.5">
          <span className={label}>Participants ({f.participants.length})</span>
          <div className="flex max-h-44 flex-col gap-1 overflow-y-auto rounded-2xl bg-surface-2 p-2">
            {eligible.map((u) => (
              <label key={u.id} className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-surface">
                <input
                  type="checkbox"
                  checked={f.participants.includes(u.id)}
                  onChange={(e) => setF({ ...f, participants: e.target.checked ? [...f.participants, u.id] : f.participants.filter((x) => x !== u.id) })}
                  className="size-4 accent-ink"
                />
                <span className="text-sm font-semibold">{name(u)}</span>
              </label>
            ))}
          </div>
        </div>
      )}
      <div className="grid gap-3.5 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={label}>Starts</span>
          <input type="datetime-local" value={f.start_time} onChange={(e) => setF({ ...f, start_time: e.target.value })} className={field} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Ends</span>
          <input type="datetime-local" min={f.start_time || undefined} value={f.end_time} onChange={(e) => setF({ ...f, end_time: e.target.value })} className={field} />
        </label>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className={label}>Meeting link</span>
        <input type="url" placeholder="https://…" value={f.meeting_link} onChange={(e) => setF({ ...f, meeting_link: e.target.value })} className={field} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={label}>Description</span>
        <textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className={`${field} h-auto py-3 leading-normal`} />
      </label>
      <SheetActions confirmLabel={booking ? 'Save changes' : 'Schedule meeting'} confirmDisabled={!ready} onConfirm={() => ready && save.mutate()} />
    </>
  );
}
