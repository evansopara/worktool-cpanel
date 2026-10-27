'use client';

import { useAuth } from '@/providers/AuthProvider';
import { MoreScreen } from '@/components/shell/MoreScreen';

// Mobile More menu, opened from the dock.
export default function MorePage() {
  const { user, logout } = useAuth();
  if (!user) return null;
  return <MoreScreen user={user} onSignOut={logout} />;
}
