'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { SectionKey } from '@/components/shell/nav';

export type Badges = Partial<Record<SectionKey, number>>;

/**
 * Pending counts for the menu (GET /badges). Polled every minute and on
 * returning to the tab; pages that change a count invalidate ['badges'].
 */
export function useBadges(enabled = true) {
  const { data } = useQuery({
    queryKey: ['badges'],
    queryFn: () => api.get<Badges>('/badges').then((r) => r.data),
    enabled,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  return data ?? {};
}
