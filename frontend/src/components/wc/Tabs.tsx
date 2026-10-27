'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from './Badge';

export type TabItem<T extends string> = {
  value: T;
  label: string;
  /** Muted mono count after the label (e.g. "Active 12") */
  count?: number;
  /** Yellow badge for items that need action */
  badge?: number;
};

// Pill tab group; the active tab is ink. `on` is the surface the group sits
// on: a white track on stone pages, a stone track inside white cards.
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  on = 'stone',
  label,
  className,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  on?: 'stone' | 'white';
  label: string;
  className?: string;
}) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);

  // Arrow keys move between tabs, as for a native tab list.
  function onKeyDown(e: React.KeyboardEvent, i: number) {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + items.length) % items.length;
    onChange(items[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        'flex max-w-full gap-0.5 self-start overflow-x-auto rounded-full p-[5px]',
        on === 'stone' ? 'bg-surface' : 'bg-stone',
        className,
      )}
    >
      {items.map((t, i) => {
        const selected = t.value === value;
        return (
          <button
            key={t.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              'flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-full border-0 px-[18px] font-ui text-sm font-semibold whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-1',
              selected ? 'bg-ink text-white' : 'bg-transparent text-ink-2 hover:text-ink',
            )}
          >
            {t.label}
            {t.count !== undefined && <span className="font-mono text-xs opacity-70">{t.count}</span>}
            {t.badge ? <Badge count={t.badge} /> : null}
          </button>
        );
      })}
    </div>
  );
}
