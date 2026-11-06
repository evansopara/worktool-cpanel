'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// The KPI report is now the KPI tab of the Performance page.
export default function KpiReportRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/performance?tab=kpi');
  }, [router]);
  return null;
}
