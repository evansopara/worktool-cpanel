'use client';

import { cn } from '@/lib/utils';

export type FilterItem<T extends string> = { value: T; label: string; count?: number };

// Toggle chips for filtering a list (Projects categories, Home All/Active/
// Completed). `chips` = separate white chips on stone (Projects); `inline` =
// borderless chips inside a card (staff Home).
export function SegmentedFilter<T extends string>({
  items,
  value,
  onChange,
  variant = 'chips',
  label,
  className,
}: {
  items: FilterItem<T>[];
  value: T;
  onChange: (value: T) => void;
  variant?: 'chips' | 'inline';
  label: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn('flex flex-wrap', variant === 'chips' ? 'gap-2' : 'gap-1', className)}>
      {items.map((f) => {
        const on = f.value === value;
        return (
          <button
            key={f.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(f.value)}
            className={cn(
              'flex cursor-pointer items-center rounded-full border-0 font-ui text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-1',
              variant === 'chips' ? 'h-[42px] gap-2 px-[18px]' : 'h-[38px] gap-1.5 px-4',
              on ? 'bg-ink text-white' : variant === 'chips' ? 'bg-surface text-ink-2 hover:text-ink' : 'bg-transparent text-ink-2 hover:text-ink',
            )}
          >
            {f.label}
            {f.count !== undefined && (
              <span className={cn('font-mono', variant === 'chips' ? 'text-[12.5px] opacity-75' : 'text-xs opacity-70')}>{f.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
