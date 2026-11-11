'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { User, UserRole } from '@/types';
import api from '@/lib/api';
import { AppShell } from '@/components/shell/AppShell';
import { PerformanceScreen } from '@/components/performance/PerformanceScreen';
import { AttendancePrompt } from '@/components/performance/AttendancePrompt';
import { performanceMock } from './mockApi';

// Performance check page: the real screens on the artboards' sample data.
//   ?role=manager (default) | staff   plus the page's own ?tab= &person= &board=
//   ?prompt=1 with role=staff shows the "Are you there?" check.

function sampleUser(staff: boolean): User {
  return {
    id: staff ? 10 : 1,
    username: 'sample',
    first_name: staff ? 'Victor' : 'Olubukola',
    last_name: staff ? 'Adeleye' : 'Ige',
    email: null,
    role: (staff ? 'staff' : 'operations_manager') as UserRole,
    status: 'active',
    must_set_password: false,
    is_active: true,
    created_at: '',
    updated_at: '',
  };
}

function Preview() {
  const params = useSearchParams();
  const staff = params.get('role') === 'staff';
  const user = sampleUser(staff);
  // Answer API calls from memory while this page is open.
  const [original] = useState(() => {
    const before = api.defaults.adapter;
    api.defaults.adapter = performanceMock(user.id);
    return before;
  });
  useEffect(() => () => void (api.defaults.adapter = original), [original]);

  return (
    <AppShell user={user} unread={2} badges={{ people: 3, clients: 2 }} onSignOut={() => {}} previewPath="/dashboard/performance">
      <PerformanceScreen user={user} />
      {staff && params.get('prompt') === '1' && <AttendancePrompt firstName="Victor" />}
    </AppShell>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Preview />
    </Suspense>
  );
}
