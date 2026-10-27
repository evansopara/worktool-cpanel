'use client';

import { useAuth } from '@/providers/AuthProvider';
import { AdminScreen } from '@/components/admin/AdminScreen';

// Admin: Operations Managers and Team Leads.
export default function AdminPage() {
  const { user } = useAuth();
  if (!user) return null;
  if (!['operations_manager', 'team_lead'].includes(user.role)) {
    return <p className="m-0 p-10 text-sm text-ink-3">Admin is for Operations Managers and Team Leads.</p>;
  }
  return <AdminScreen me={user} />;
}
