'use client';

import { Suspense } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { PeopleScreen } from '@/components/people/PeopleScreen';

// People hub: Operations Managers and Team Leads. Other roles keep their
// own Leave / Complaints / Penalties pages until those are designed.
export default function PeoplePage() {
  const { user } = useAuth();
  if (!user) return null;
  if (!['operations_manager', 'team_lead'].includes(user.role)) {
    return <p className="m-0 p-10 text-sm text-ink-3">People is for Operations Managers and Team Leads.</p>;
  }
  return (
    <Suspense fallback={null}>
      <PeopleScreen />
    </Suspense>
  );
}
