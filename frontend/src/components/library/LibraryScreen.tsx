'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { notesApi, sopsApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button, Sheet, SheetActions, SheetDescription, SheetTitle } from '@/components/wc';
import { PageBody } from '@/components/shell/PageHeader';
import { errorText } from '@/lib/tasks';

// Library (Knowledge / MLibrary artboards): SOPs and personal notes.

type Segment = { id: number; title: string; content: string; order_index?: number | null };
type Sop = { id: number; title: string; description?: string | null; category?: string | null; segments?: Segment[]; updated_at?: string };
type Note = { id: number; title: string; content?: string | null; color?: string | null; todo_items?: unknown[] | null; updated_at: string };

// Notes keep the colour values the old Notes page stored, shown in the new palette.
const NOTE_COLORS = [
  { label: 'Yellow', value: 'bg-yellow-50 border-yellow-200', cls: 'bg-yellow', meta: 'text-[#4D3B00]' },
  { label: 'Blue', value: 'bg-blue-50 border-blue-200', cls: 'bg-review-tint', meta: 'text-review' },
  { label: 'Green', value: 'bg-green-50 border-green-200', cls: 'bg-done-tint', meta: 'text-done' },
  { label: 'Pink', value: 'bg-pink-50 border-pink-200', cls: 'bg-missed-tint', meta: 'text-missed' },
  { label: 'Purple', value: 'bg-purple-50 border-purple-200', cls: 'bg-brief-tint', meta: 'text-pending' },
  { label: 'White', value: '', cls: 'bg-surface', meta: 'text-ink-3' },
];
const noteColor = (v?: string | null) => NOTE_COLORS.find((c) => c.value === (v ?? '')) ?? NOTE_COLORS[NOTE_COLORS.length - 1];

export function LibraryScreen() {
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  const sops = useQuery<Sop[]>({ queryKey: ['sops'], queryFn: () => sopsApi.list().then((r) => r.data) });
  const notes = useQuery<Note[]>({ queryKey: ['notes'], queryFn: () => notesApi.list().then((r) => r.data) });
  const [sopForm, setSopForm] = useState<{ open: boolean; sop: Sop | null }>({ open: false, sop: null });
  const [openSop, setOpenSop] = useState<number | null>(null);
  const [noteForm, setNoteForm] = useState<{ open: boolean; note: Note | null }>({ open: false, note: null });

  const match = (...s: (string | null | undefined)[]) => !term || s.some((x) => x?.toLowerCase().includes(term));
  const sopList = (sops.data ?? []).filter((s) => match(s.title, s.description, s.category, ...(s.segments ?? []).map((g) => g.title)));
  const noteList = (notes.data ?? []).filter((n) => match(n.title, n.content));
  const total = sops.data?.length ?? 0;

  const search = (
    <label className="flex h-12 items-center gap-2 rounded-full bg-surface px-[18px] text-ink-3 focus-within:ring-2 focus-within:ring-ink lg:min-w-[280px]">
      <Search className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
      <input type="search" aria-label="Search SOPs and notes" placeholder="Search SOPs and notes" value={q} onChange={(e) => setQ(e.target.value)} className="min-w-0 flex-1 border-0 bg-transparent font-ui text-[14.5px] text-ink outline-none" />
    </label>
  );

  return (
    <PageBody className="gap-3.5 pt-[52px] lg:gap-[22px] lg:pt-7">
      <div className="flex items-center gap-2.5 lg:hidden">
        <Link href="/dashboard/more" aria-label="Back to More" className="flex size-11 items-center justify-center rounded-full bg-surface text-ink">
          <ArrowLeft className="size-[18px]" aria-hidden="true" />
        </Link>
        <h1 className="m-0 flex-1 font-display text-[34px] leading-none font-bold tracking-[-0.04em]">Library</h1>
      </div>
      <div className="lg:hidden">{search}</div>
      <header className="hidden flex-wrap items-end justify-between gap-5 pt-2 pb-1 lg:flex">
        <div className="flex flex-col gap-2.5">
          <h1 className="m-0 font-display text-[56px] leading-none font-bold tracking-[-0.04em]">Library</h1>
          <p className="m-0 text-base text-ink-2">Standard operating procedures for everyone, and notes just for you</p>
        </div>
        {search}
      </header>

      {/* SOP hero */}
      <section aria-labelledby="h-sop" className="flex flex-wrap items-center gap-7 rounded-[28px] bg-ink p-6 text-white lg:rounded-[32px] lg:p-10">
        <div className="flex flex-[1_1_280px] flex-col gap-3 lg:gap-3.5">
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-yellow lg:text-[13px]">Standard operating procedures</p>
          <h2 id="h-sop" className="m-0 font-display text-[32px] leading-[1.02] font-bold tracking-[-0.03em] lg:text-[44px]">
            {total === 0 ? 'No SOPs yet' : `${total} procedure${total === 1 ? '' : 's'}`}
          </h2>
          <p className="m-0 max-w-[440px] text-[15px] leading-normal text-on-dark lg:text-base">
            {total === 0 ? 'Write the first procedure so every project runs from the same playbook.' : 'The playbook every project runs from. Open one to read or update its sections.'}
          </p>
          <button type="button" onClick={() => setSopForm({ open: true, sop: null })} className="inline-flex h-[50px] cursor-pointer items-center gap-2 self-start rounded-full border-0 bg-yellow px-6 font-ui text-[15px] font-bold text-ink outline-none focus-visible:ring-2 focus-visible:ring-yellow focus-visible:ring-offset-2 focus-visible:ring-offset-ink">
            <Plus className="size-[18px]" strokeWidth={2.4} aria-hidden="true" />
            New SOP
          </button>
        </div>
        <div aria-hidden="true" className="hidden flex-[0_1_300px] flex-col gap-2.5 lg:flex">
          <span className="h-[58px] rounded-[18px] bg-dark-1" />
          <span className="ml-7 h-[58px] rounded-[18px] bg-dark-1" />
          <span className="ml-14 h-[58px] rounded-[18px] bg-yellow opacity-90" />
        </div>
      </section>

      {sopList.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-[repeat(auto-fill,minmax(280px,1fr))] lg:gap-3.5">
          {sopList.map((s) => (
            <button key={s.id} type="button" onClick={() => setOpenSop(s.id)} className="flex cursor-pointer flex-col gap-2 rounded-card border-0 bg-surface p-5 text-left font-ui text-ink outline-none hover:shadow-float focus-visible:ring-2 focus-visible:ring-ink lg:p-6">
              {s.category && <span className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">{s.category}</span>}
              <span className="font-display text-[22px] leading-tight font-bold tracking-[-0.02em]">{s.title}</span>
              {s.description && <span className="line-clamp-2 text-sm text-ink-2">{s.description}</span>}
              <span className="mt-auto pt-1 text-[13px] font-semibold text-ink-3">
                {s.segments?.length ?? 0} section{s.segments?.length === 1 ? '' : 's'}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Notes */}
      <section aria-labelledby="h-notes" className="flex flex-col gap-3 pt-1.5 lg:gap-3.5">
        <div className="flex items-baseline justify-between gap-3 px-1 lg:px-0">
          <h2 id="h-notes" className="m-0 font-display text-[22px] font-bold tracking-[-0.02em] lg:text-[30px]">
            My notes
          </h2>
          <span className="text-[13px] font-semibold text-ink-3 lg:text-[13.5px]">Only visible to you</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-[repeat(auto-fill,minmax(250px,1fr))] lg:gap-3.5">
          {noteList.map((n) => {
            const c = noteColor(n.color);
            return (
              <button key={n.id} type="button" onClick={() => setNoteForm({ open: true, note: n })} className={cn('flex min-h-40 cursor-pointer flex-col gap-2.5 rounded-card border-0 p-4 text-left font-ui text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink lg:min-h-[220px] lg:rounded-[26px] lg:p-6', c.cls)}>
                <span className="font-display text-lg font-bold tracking-[-0.02em] lg:text-2xl">{n.title}</span>
                <span className="line-clamp-5 flex-1 text-sm leading-[1.55] whitespace-pre-wrap lg:text-[15px]">{n.content}</span>
                <span className={cn('text-xs font-semibold lg:text-[13px]', c.meta)}>Edited {formatDistanceToNow(new Date(n.updated_at), { addSuffix: true })}</span>
              </button>
            );
          })}
          <button type="button" onClick={() => setNoteForm({ open: true, note: null })} className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-3 rounded-card border-[1.5px] border-dashed border-handle bg-transparent font-ui text-[15px] font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink lg:min-h-[220px] lg:rounded-[26px]">
            <span className="flex size-[52px] items-center justify-center rounded-full bg-surface">
              <Plus className="size-5" aria-hidden="true" />
            </span>
            New note
          </button>
        </div>
      </section>

      <SopSheet id={openSop} onClose={() => setOpenSop(null)} onEdit={(s) => setSopForm({ open: true, sop: s })} />
      <SopForm open={sopForm.open} sop={sopForm.sop} onClose={() => setSopForm({ open: false, sop: null })} />
      <NoteForm open={noteForm.open} note={noteForm.note} onClose={() => setNoteForm({ open: false, note: null })} />
    </PageBody>
  );
}

const field = 'h-12 w-full rounded-2xl border-0 bg-surface-2 px-4 font-ui text-[15px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink';
const area = `${field} h-auto py-3 leading-normal`;
const label = 'text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink-3';

function SopSheet({ id, onClose, onEdit }: { id: number | null; onClose: () => void; onEdit: (s: Sop) => void }) {
  return (
    <Sheet open={id !== null} onOpenChange={(o) => !o && onClose()}>
      {id !== null && <SopBody id={id} onClose={onClose} onEdit={onEdit} />}
    </Sheet>
  );
}

function SopBody({ id, onClose, onEdit }: { id: number; onClose: () => void; onEdit: (s: Sop) => void }) {
  const qc = useQueryClient();
  const sop = useQuery<Sop>({ queryKey: ['sop', id], queryFn: () => sopsApi.get(id).then((r) => r.data) });
  const [adding, setAdding] = useState({ title: '', content: '' });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['sop', id] });
    qc.invalidateQueries({ queryKey: ['sops'] });
  };
  const add = useMutation({
    mutationFn: () => sopsApi.addSegment(id, { title: adding.title.trim(), content: adding.content.trim(), order_index: sop.data?.segments?.length ?? 0 }),
    onSuccess: () => {
      setAdding({ title: '', content: '' });
      refresh();
    },
    onError: (err) => toast.error(errorText(err, 'Could not add the section.')),
  });
  const removeSeg = useMutation({ mutationFn: (segId: number) => sopsApi.removeSegment(id, segId), onSuccess: refresh });
  const removeSop = useMutation({
    mutationFn: () => sopsApi.remove(id),
    onSuccess: () => {
      toast.success('SOP deleted');
      qc.invalidateQueries({ queryKey: ['sops'] });
      onClose();
    },
    onError: (err) => toast.error(errorText(err, 'Could not delete the SOP.')),
  });
  const s = sop.data;
  if (!s) return <SheetTitle>{sop.isError ? 'SOP not found' : 'Loading…'}</SheetTitle>;
  const segments = [...(s.segments ?? [])].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));

  return (
    <>
      <SheetTitle>{s.title}</SheetTitle>
      {(s.description || s.category) && <SheetDescription>{[s.category, s.description].filter(Boolean).join(' · ')}</SheetDescription>}
      <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
        {segments.length === 0 && <li className="rounded-2xl bg-surface-2 p-4 text-sm text-ink-3">No sections yet.</li>}
        {segments.map((g, i) => (
          <li key={g.id} className="flex flex-col gap-1.5 rounded-[18px] bg-surface-2 p-4">
            <div className="flex items-start justify-between gap-3">
              <span className="text-[15px] font-bold">
                <span className="mr-2 font-mono text-[13px] text-ink-3">{String(i + 1).padStart(2, '0')}</span>
                {g.title}
              </span>
              <button type="button" onClick={() => removeSeg.mutate(g.id)} className="cursor-pointer border-0 bg-transparent p-0 font-ui text-[13px] font-semibold text-missed">
                Remove
              </button>
            </div>
            <p className="m-0 text-sm leading-[1.55] whitespace-pre-wrap text-ink-2">{g.content}</p>
          </li>
        ))}
      </ol>
      <div className="flex flex-col gap-2 rounded-[18px] border-[1.5px] border-dashed border-handle p-3">
        <span className={label}>Add a section</span>
        <input placeholder="Section title" value={adding.title} onChange={(e) => setAdding({ ...adding, title: e.target.value })} className={field} />
        <textarea rows={3} placeholder="What to do" value={adding.content} onChange={(e) => setAdding({ ...adding, content: e.target.value })} className={area} />
        <Button size="md" className="self-start" disabled={!adding.title.trim() || !adding.content.trim() || add.isPending} onClick={() => add.mutate()}>
          Add section
        </Button>
      </div>
      <div className="flex flex-wrap gap-2.5">
        <Button variant="secondary" size="md" onClick={() => onEdit(s)}>
          Edit details
        </Button>
        <Button variant="danger" size="md" disabled={removeSop.isPending} onClick={() => removeSop.mutate()}>
          Delete SOP
        </Button>
      </div>
    </>
  );
}

function SopForm({ open, sop, onClose }: { open: boolean; sop: Sop | null; onClose: () => void }) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      {open && <SopFormBody key={sop?.id ?? 'new'} sop={sop} onClose={onClose} />}
    </Sheet>
  );
}

function SopFormBody({ sop, onClose }: { sop: Sop | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ title: sop?.title ?? '', category: sop?.category ?? '', description: sop?.description ?? '' });
  const save = useMutation({
    mutationFn: () => {
      const data = { title: f.title.trim(), category: f.category.trim() || null, description: f.description.trim() || null };
      return sop ? sopsApi.update(sop.id, data) : sopsApi.create(data);
    },
    onSuccess: () => {
      toast.success(sop ? 'SOP updated' : 'SOP created');
      qc.invalidateQueries({ queryKey: ['sops'] });
      if (sop) qc.invalidateQueries({ queryKey: ['sop', sop.id] });
      onClose();
    },
    onError: (err) => toast.error(errorText(err, 'Could not save the SOP.')),
  });
  return (
    <>
      <SheetTitle>{sop ? 'Edit SOP' : 'New SOP'}</SheetTitle>
      <label className="flex flex-col gap-1.5">
        <span className={label}>Title</span>
        <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className={field} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={label}>Category</span>
        <input placeholder="e.g. Website delivery" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} className={field} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={label}>Description</span>
        <textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className={area} />
      </label>
      {!sop && <p className="m-0 text-[13px] text-ink-3">Add the procedure’s sections after creating it.</p>}
      <SheetActions confirmLabel={sop ? 'Save changes' : 'Create SOP'} confirmDisabled={!f.title.trim() || save.isPending} onConfirm={() => save.mutate()} />
    </>
  );
}

function NoteForm({ open, note, onClose }: { open: boolean; note: Note | null; onClose: () => void }) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      {open && <NoteFormBody key={note?.id ?? 'new'} note={note} onClose={onClose} />}
    </Sheet>
  );
}

function NoteFormBody({ note, onClose }: { note: Note | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ title: note?.title ?? '', content: note?.content ?? '', color: note?.color ?? NOTE_COLORS[0].value });
  const done = (msg: string) => {
    toast.success(msg);
    qc.invalidateQueries({ queryKey: ['notes'] });
    onClose();
  };
  const save = useMutation({
    mutationFn: () => (note ? notesApi.update(note.id, f) : notesApi.create(f)),
    onSuccess: () => done(note ? 'Note saved' : 'Note added'),
    onError: (err) => toast.error(errorText(err, 'Could not save the note.')),
  });
  const remove = useMutation({
    mutationFn: () => notesApi.remove(note!.id),
    onSuccess: () => done('Note deleted'),
    onError: (err) => toast.error(errorText(err, 'Could not delete the note.')),
  });
  return (
    <>
      <SheetTitle>{note ? 'Edit note' : 'New note'}</SheetTitle>
      <label className="flex flex-col gap-1.5">
        <span className={label}>Title</span>
        <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className={field} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={label}>Note</span>
        <textarea rows={6} value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} className={area} />
      </label>
      <div className="flex flex-col gap-1.5">
        <span className={label}>Colour</span>
        <div role="radiogroup" aria-label="Note colour" className="flex flex-wrap gap-2">
          {NOTE_COLORS.map((c) => (
            <button
              key={c.label}
              type="button"
              role="radio"
              aria-checked={f.color === c.value}
              aria-label={c.label}
              onClick={() => setF({ ...f, color: c.value })}
              className={cn('size-9 cursor-pointer rounded-full border border-line outline-none focus-visible:ring-2 focus-visible:ring-ink', c.cls, f.color === c.value && 'ring-2 ring-ink ring-offset-2')}
            />
          ))}
        </div>
      </div>
      <SheetActions confirmLabel={note ? 'Save note' : 'Add note'} confirmDisabled={!f.title.trim() || save.isPending} onConfirm={() => save.mutate()} />
      {note && (
        <button type="button" onClick={() => remove.mutate()} disabled={remove.isPending} className="h-10 cursor-pointer self-center rounded-full border-0 bg-transparent px-4 font-ui text-sm font-semibold text-missed disabled:opacity-40">
          Delete note
        </button>
      )}
    </>
  );
}
