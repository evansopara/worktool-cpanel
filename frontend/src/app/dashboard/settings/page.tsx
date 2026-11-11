'use client';

import { useAuth } from '@/providers/AuthProvider';
import { SettingsScreen } from '@/components/settings/SettingsScreen';
import ClientSettings from '@/components/legacy/ClientSettings';

// Settings (redesign step 6). Clients keep the old page until the client
// portal is designed.
export default function SettingsPage() {
  const { user, setUser } = useAuth();
  if (!user) return null;
  if (user.role === 'client') return <ClientSettings />;
  return <SettingsScreen user={user} onUserChange={setUser} />;
}
