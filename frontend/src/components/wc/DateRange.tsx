'use client';

import { CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';

export type DateRangeValue = { from: string; to: string }; // YYYY-MM-DD or ''

type Props = {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  on?: 'stone' | 'white';
  className?: string;
};

// "From … to …" filter (spec §7.2). Values are YYYY-MM-DD strings, sent to the
// server as ?from=&to=. Each end limits the other so the range can't invert.
// At lg and up it is one pill (Tasks); below lg two labelled boxes (MTasks).
export function DateRange({ value, onChange, on = 'stone', className }: Props) {
  const bg = on === 'stone' ? 'bg-surface' : 'bg-stone';
  const fromInput = {
    type: 'date',
    value: value.from,
    max: value.to || undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, from: e.target.value }),
  } as const;
  const toInput = {
    type: 'date',
    value: value.to,
    min: value.from || undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, to: e.target.value }),
  } as const;

  const pillInput =
    'h-9 min-w-0 border-0 bg-transparent font-ui text-[13.5px] text-ink outline-none focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-ink';
  const box =
    'flex min-w-0 flex-1 flex-col gap-0.5 rounded-2xl px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-3 focus-within:ring-2 focus-within:ring-ink';
  const boxInput = 'h-7 w-full min-w-0 border-0 bg-transparent p-0 font-ui text-sm normal-case tracking-normal text-ink outline-none';

  return (
    <>
      <div
        role="group"
        aria-label="Filter by date range"
        className={cn('hidden h-12 max-w-full items-center gap-1.5 rounded-full pr-2 pl-4 lg:flex', bg, className)}
      >
        <CalendarDays className="size-4 shrink-0 text-ink-2" strokeWidth={2} aria-hidden="true" />
        <span className="text-[13.5px] font-semibold text-ink-2">From</span>
        <input aria-label="From date" className={pillInput} {...fromInput} />
        <span className="text-[13.5px] text-ink-3">to</span>
        <input aria-label="To date" className={pillInput} {...toInput} />
      </div>
      <div role="group" aria-label="Filter by date range" className={cn('flex w-full gap-2 lg:hidden', className)}>
        <label className={cn(box, bg)}>
          From
          <input className={boxInput} {...fromInput} />
        </label>
        <label className={cn(box, bg)}>
          To
          <input className={boxInput} {...toInput} />
        </label>
      </div>
    </>
  );
}
