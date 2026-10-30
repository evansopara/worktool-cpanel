'use client';

import { useAuth } from '@/providers/AuthProvider';
import { MoreScreen } from '@/components/shell/MoreScreen';
import { useBadges } from '@/lib/badges';

// Mobile More menu, opened from the dock.
export default function MorePage() {
  const { user, logout } = useAuth();
  const badges = useBadges(!!user);
  if (!user) return null;
  return <MoreScreen user={user} badges={badges} onSignOut={logout} />;
}
