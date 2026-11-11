'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { User, UserRole } from '@/types';
import api from '@/lib/api';
import { AppShell } from '@/components/shell/AppShell';
import { LibraryScreen } from '@/components/library/LibraryScreen';
import { mockAdapter } from '../tasks/mockApi';

// Step 6 check page: the real Library hub on sample data, no login needed.
//   (Operations Manager only)

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
    <AppShell user={user} unread={2} onSignOut={() => {}} previewPath="/dashboard/library">
      <LibraryScreen />
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
