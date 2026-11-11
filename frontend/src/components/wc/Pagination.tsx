'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export const PER_PAGE = 10; // spec §7.2: 10 tasks per page everywhere

// Page numbers to show: all of them when they fit, otherwise first, last and
// the current page (plus `siblings` either side) with gaps ("…") between.
function pageList(page: number, pages: number, siblings: number): (number | 'gap')[] {
  if (pages <= 5 + siblings * 2) return Array.from({ length: pages }, (_, i) => i + 1);
  const keep = new Set([1, pages]);
  for (let n = page - siblings; n <= page + siblings; n++) keep.add(n);
  const out: (number | 'gap')[] = [];
  for (let n = 1; n <= pages; n++) {
    if (keep.has(n)) out.push(n);
    else if (out[out.length - 1] !== 'gap') out.push('gap');
  }
  return out;
}

// Desktop: "Showing 11–20 of 27 tasks" with ‹ numbered pages ›. Mobile: a
// centred row of 44px buttons only; the page shows "11–20 of 27" in its section
// header (MStaffHome). `total` comes from the server's meta.total; the arrows
// dim on the first and last page.
export function Pagination({
  page,
  total,
  perPage = PER_PAGE,
  onPageChange,
  noun = 'tasks',
  variant = 'desktop',
  className,
}: {
  page: number;
  total: number;
  perPage?: number;
  onPageChange: (page: number) => void;
  noun?: string;
  variant?: 'desktop' | 'mobile';
  className?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  const current = Math.min(Math.max(1, page), pages);
  const first = total === 0 ? 0 : (current - 1) * perPage + 1;
  const last = Math.min(current * perPage, total);
  const atStart = current === 1;
  const atEnd = current === pages;

  const mobile = variant === 'mobile';
  // Mobile sits on stone, so its buttons are white; desktop sits in a white card.
  const size = mobile ? 'size-11' : 'size-10';
  const idle = mobile ? 'bg-surface text-ink' : 'bg-stone text-ink';
  const arrow = cn(
    'flex cursor-pointer items-center justify-center rounded-full border-0 outline-none focus-visible:ring-2 focus-visible:ring-ink aria-disabled:cursor-default aria-disabled:opacity-35',
    size,
    idle,
  );

  return (
    <div className={cn('flex flex-wrap items-center gap-3', mobile ? 'justify-center' : 'justify-between', className)}>
      {!mobile && (
        <span className="text-[13.5px] text-ink-3">
          Showing{' '}
          <strong className="font-semibold text-ink">
            {first}–{last}
          </strong>{' '}
          of {total} {noun}
        </span>
      )}
      <nav aria-label="Pages" className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label="Previous page"
          aria-disabled={atStart}
          onClick={() => !atStart && onPageChange(current - 1)}
          className={arrow}
        >
          <ChevronLeft className="size-4" strokeWidth={2.2} aria-hidden="true" />
        </button>
        {pageList(current, pages, mobile ? 0 : 1).map((n, i) =>
          n === 'gap' ? (
            <span key={`gap-${i}`} aria-hidden="true" className="px-1 text-sm text-ink-3">
              …
            </span>
          ) : (
            <button
              key={n}
              type="button"
              aria-label={`Page ${n}`}
              aria-current={n === current ? 'page' : undefined}
              onClick={() => onPageChange(n)}
              className={cn(
                'cursor-pointer rounded-full border-0 px-2 font-ui text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-1',
                mobile ? 'h-11 min-w-11' : 'h-10 min-w-10',
                n === current ? 'bg-ink text-white' : idle,
              )}
            >
              {n}
            </button>
          ),
        )}
        <button
          type="button"
          aria-label="Next page"
          aria-disabled={atEnd}
          onClick={() => !atEnd && onPageChange(current + 1)}
          className={arrow}
        >
          <ChevronRight className="size-4" strokeWidth={2.2} aria-hidden="true" />
        </button>
      </nav>
    </div>
  );
}
