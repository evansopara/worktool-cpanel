'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { thisWeek, validDate, type Board, type PerfTab, type Range } from '@/lib/performance';

const TABS: PerfTab[] = ['overview', 'kpi', 'leaderboard', 'attendance'];

/**
 * Performance page state kept in the URL (spec §2), so the date range
 * survives switching tabs and the page can be linked:
 * ?tab=leaderboard&board=pm&from=2026-10-26&to=2026-11-01&person=12
 */
export function usePerfUrl() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const rawTab = params.get('tab') as PerfTab | null;
  const tab = rawTab && TABS.includes(rawTab) ? rawTab : null;
  const board: Board = params.get('board') === 'pm' ? 'pm' : 'staff';
  const person = Number(params.get('person')) || null;
  const employee = params.get('employee') ?? '';

  const from = params.get('from');
  const to = params.get('to');
  const range: Range = useMemo(() => (validDate(from) && validDate(to) ? { from, to } : thisWeek()), [from, to]);

  const set = useCallback(
    (changes: Record<string, string | null>, push = false) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(changes)) {
        if (v === null || v === '') next.delete(k);
        else next.set(k, v);
      }
      const url = `${pathname}${next.size ? `?${next}` : ''}`;
      if (push) router.push(url, { scroll: false });
      else router.replace(url, { scroll: false });
    },
    [params, pathname, router],
  );

  return {
    tab,
    board,
    person,
    employee,
    range,
    setTab: (t: PerfTab | null) => set({ tab: t, person: null }, true),
    setBoard: (b: Board) => set({ board: b === 'staff' ? null : b }),
    setRange: (r: Range) => set({ from: r.from || null, to: r.to || null }),
    setEmployee: (id: string) => set({ employee: id || null }),
    openPerson: (id: number) => set({ person: String(id) }, true),
    closePerson: () => set({ person: null }, true),
    /** Link to another tab or person, keeping the range. */
    href: (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      next.delete('person');
      for (const [k, v] of Object.entries(changes)) {
        if (v === null) next.delete(k);
        else next.set(k, v);
      }
      return `${pathname}${next.size ? `?${next}` : ''}`;
    },
  };
}

export type PerfUrl = ReturnType<typeof usePerfUrl>;
