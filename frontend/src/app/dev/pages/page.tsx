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
import LeavePage from '@/app/dashboard/leave/page';
import StaffComplaintsPage from '@/app/dashboard/staff-complaints/page';
import QueriesPage from '@/app/dashboard/queries/page';
import SupportPage from '@/app/dashboard/support/page';
import { mockAdapter } from '../tasks/mockApi';

// Check page for the restyled pages that have no artboard, on sample data.
//   ?p=notifications (default) | review-links | kpi-report | leave | staff-complaints | queries | support
//   &role=team_lead (default) | project_manager | staff

const PAGES = {
  notifications: NotificationsPage,
  'review-links': ReviewLinksPage,
  'kpi-report': KpiReportPage,
  leave: LeavePage,
  'staff-complaints': StaffComplaintsPage,
  queries: QueriesPage,
  support: SupportPage,
};

function Preview() {
  const params = useSearchParams();
  const key = (params.get('p') ?? 'notifications') as keyof typeof PAGES;
  const role = (params.get('role') ?? 'team_lead') as UserRole;
  const user: User = {
    id: role === 'project_manager' ? 2 : role === 'staff' ? 10 : 13,
    username: 'sample',
    first_name: role === 'project_manager' ? 'Adeyemo' : role === 'staff' ? 'Victor' : 'Emmanuel',
    last_name: role === 'project_manager' ? 'Titilope' : role === 'staff' ? 'Adeleye' : 'Evans',
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
      <AppShell user={user} unread={2} badges={role === 'staff' ? { tasks: 2, inbox: 3, penalties: 1 } : { tasks: 4, inbox: 1, people: 3, clients: 2, reviews: 1 }} onSignOut={() => {}} previewPath={`/dashboard/${key}`}>
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
