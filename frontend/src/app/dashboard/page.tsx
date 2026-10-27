'use client';

import { Suspense } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { MANAGER_ROLES } from '@/lib/tasks';
import { ManagerHome } from '@/components/home/ManagerHome';
import { StaffHome } from '@/components/home/StaffHome';
import ClientDashboard from '@/components/legacy/ClientDashboard';

// Home: manager and staff versions (redesign step 5). Clients keep the old
// dashboard until the client portal is designed.
export default function HomePage() {
  const { user } = useAuth();
  if (!user) return null;
  if (user.role === 'client') return <ClientDashboard />;
  return (
    <Suspense fallback={null}>{MANAGER_ROLES.includes(user.role) ? <ManagerHome user={user} /> : <StaffHome user={user} />}</Suspense>
  );
}
