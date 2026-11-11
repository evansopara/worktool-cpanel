'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { User, UserRole } from '@/types';
import api from '@/lib/api';
import { AppShell } from '@/components/shell/AppShell';
import { ManagerHome } from '@/components/home/ManagerHome';
import { StaffHome } from '@/components/home/StaffHome';
import { mockAdapter } from '../tasks/mockApi';

// Step 5 check page: the real Home screens on sample data, no login needed.
//   ?role=manager (default) | staff     &task=ID opens a task panel

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
  const staff = useSearchParams().get('role') === 'staff';
  const user = sampleUser(staff);
  // Answer API calls from memory while this page is open.
  const [original] = useState(() => {
    const before = api.defaults.adapter;
    api.defaults.adapter = mockAdapter(user.id);
    return before;
  });
  useEffect(() => () => void (api.defaults.adapter = original), [original]);

  return (
    <AppShell user={user} unread={2} onSignOut={() => {}} previewPath="/dashboard">
      {staff ? <StaffHome user={user} /> : <ManagerHome user={user} />}
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
