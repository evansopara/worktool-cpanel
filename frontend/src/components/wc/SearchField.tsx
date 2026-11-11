'use client';

import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

// 48px pill search input. `on` is the surface it sits on.
export function SearchField({
  value,
  onChange,
  placeholder,
  on = 'stone',
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  on?: 'stone' | 'white';
  className?: string;
}) {
  return (
    <label
      className={cn(
        'flex h-12 min-w-0 flex-[1_1_240px] items-center gap-2 rounded-full px-[18px] text-ink-3 focus-within:ring-2 focus-within:ring-ink sm:max-w-[420px]',
        on === 'stone' ? 'bg-surface' : 'bg-stone',
        className,
      )}
    >
      <Search className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
      <input
        type="search"
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 border-0 bg-transparent font-ui text-[14.5px] text-ink outline-none placeholder:text-ink-3"
      />
    </label>
  );
}
