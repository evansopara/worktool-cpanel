'use client';

import { Suspense } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { PerformanceScreen } from '@/components/performance/PerformanceScreen';

// Performance: KPIs, leaderboard and attendance (replaces the KPI report).
export default function PerformancePage() {
  const { user } = useAuth();
  if (!user || user.role === 'client') return null;
  return (
    <Suspense fallback={null}>
      <PerformanceScreen user={user} />
    </Suspense>
  );
}
