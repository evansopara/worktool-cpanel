'use client';

import { useAuth } from '@/providers/AuthProvider';
import { ClientsScreen } from '@/components/clients/ClientsScreen';

// Clients hub: Operations Managers and Team Leads.
export default function ClientsPage() {
  const { user } = useAuth();
  if (!user) return null;
  if (!['operations_manager', 'team_lead'].includes(user.role)) {
    return <p className="m-0 p-10 text-sm text-ink-3">Clients is for Operations Managers and Team Leads.</p>;
  }
  return <ClientsScreen />;
}
