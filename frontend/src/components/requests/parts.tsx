'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shell/PageHeader';

// Shared pieces for the staff request pages (leave, complaints, queries,
// technical support). No artboards exist; they follow the People hub.

export const field = 'h-12 w-full rounded-2xl border-0 bg-surface-2 px-4 font-ui text-[15px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink';
export const area = `${field} h-auto resize-y py-3 leading-normal`;
export const card = 'flex flex-col gap-3.5 rounded-[26px] bg-surface p-5 lg:rounded-[28px] lg:p-7';
export const cardTitle = 'm-0 font-display text-[21px] font-bold tracking-[-0.02em] lg:text-2xl';

/** Mobile: back to More + title + optional round action. Desktop: the page header. */
export function ScreenHeader({ title, description, action, mobileAction }: { title: string; description: string; action?: React.ReactNode; mobileAction?: React.ReactNode }) {
  return (
    <>
      <div className="flex items-center gap-2.5 lg:hidden">
        <Link href="/dashboard/more" aria-label="Back to More" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface text-ink">
          <ArrowLeft className="size-[18px]" aria-hidden="true" />
        </Link>
        <h1 className="m-0 min-w-0 flex-1 font-display text-[30px] leading-none font-bold tracking-[-0.04em]">{title}</h1>
        {mobileAction}
      </div>
      <PageHeader className="hidden lg:flex" title={title} description={description} actions={action} />
    </>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <span className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">{label}</span>
      {children}
      {hint && <span className="text-[12.5px] text-ink-3">{hint}</span>}
    </label>
  );
}

export function Empty({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[24px] bg-surface-2 px-6 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-surface text-ink-2 [&_svg]:size-5">{icon}</span>
      <p className="m-0 font-display text-xl font-bold">{title}</p>
      <p className="m-0 max-w-sm text-sm text-ink-3">{text}</p>
    </div>
  );
}

/** Label / value pairs in a tinted box, for details sheets. */
export function Facts({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-5 gap-y-2.5 rounded-[18px] bg-surface-2 p-4 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="font-semibold text-ink-3">{k}</dt>
          <dd className="m-0 font-semibold text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A labelled block of free text (reason, reviewer's comment, ...). */
export function Note({ label, children, tone }: { label: string; children: React.ReactNode; tone?: 'done' | 'missed' | 'review' }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1 rounded-[18px] px-4 py-3',
        tone === 'done' && 'bg-done-tint text-done',
        tone === 'missed' && 'bg-missed-tint text-missed',
        tone === 'review' && 'bg-review-tint text-review',
        !tone && 'bg-surface-2',
      )}
    >
      <span className={cn('text-xs font-bold uppercase tracking-[0.06em]', !tone && 'text-ink-3')}>{label}</span>
      <p className="m-0 text-sm leading-normal whitespace-pre-wrap">{children}</p>
    </div>
  );
}
