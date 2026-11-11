'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { NavSection, SubPage } from './nav';

// Links between the old pages that make up one hub section (e.g. People:
// Leave, Team, Queries, Staff complaints). Temporary: each hub page gets its
// own tabs when it is rebuilt (spec §9 step 6), and this goes away.
export function SectionTabs({ section, page }: { section: NavSection; page: SubPage }) {
  if (section.pages.length < 2) return null;
  return (
    <nav aria-label={section.label} className="px-[18px] pt-4 sm:px-6 lg:px-10 lg:pt-6">
      <div className="flex max-w-full gap-0.5 self-start overflow-x-auto rounded-full bg-surface p-[5px] sm:inline-flex">
        {section.pages.map((p) => {
          const on = p.href === page.href;
          return (
            <Link
              key={p.href}
              href={p.href}
              aria-current={on ? 'page' : undefined}
              className={cn(
                'flex h-10 shrink-0 items-center rounded-full px-[18px] font-ui text-sm font-semibold whitespace-nowrap no-underline outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-1',
                on ? 'bg-ink text-white' : 'text-ink-2 hover:text-ink',
              )}
            >
              {p.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
