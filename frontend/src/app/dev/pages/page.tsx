'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { User, UserRole } from '@/types';
import api from '@/lib/api';
import { AppShell } from '@/components/shell/AppShell';
import { AuthContext } from '@/providers/AuthProvider';
import NotificationsPage from '@/app/dashboard/notifications/page';
import ReviewLinksPage from '@/app/dashboard/review-links/page';
import KpiReportPage from '@/app/dashboard/kpi-report/page';
import { mockAdapter } from '../tasks/mockApi';

// Check page for the restyled pages that have no artboard, on sample data.
//   ?p=notifications (default) | review-links | kpi-report     &role=team_lead | project_manager

const PAGES = { notifications: NotificationsPage, 'review-links': ReviewLinksPage, 'kpi-report': KpiReportPage };

function Preview() {
  const params = useSearchParams();
  const key = (params.get('p') ?? 'notifications') as keyof typeof PAGES;
  const role = (params.get('role') ?? 'team_lead') as UserRole;
  const user: User = {
    id: role === 'project_manager' ? 2 : 13,
    username: 'sample',
    first_name: role === 'project_manager' ? 'Adeyemo' : 'Emmanuel',
    last_name: role === 'project_manager' ? 'Titilope' : 'Evans',
    email: null,
    role,
    status: 'active',
    must_set_password: false,
    is_active: true,
    created_at: '',
    updated_at: '',
  };
  const [original] = useState(() => {
    const before = api.defaults.adapter;
    api.defaults.adapter = mockAdapter(user.id);
    return before;
  });
  useEffect(() => () => void (api.defaults.adapter = original), [original]);
  const Page = PAGES[key] ?? NotificationsPage;

  return (
    <AuthContext.Provider value={{ user, token: null, loading: false, login: async () => {}, logout: async () => {}, setUser: () => {} }}>
      <AppShell user={user} unread={2} onSignOut={() => {}} previewPath={`/dashboard/${key}`}>
        <Page />
      </AppShell>
    </AuthContext.Provider>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Preview />
    </Suspense>
  );
}
