'use client';

import { useAuth } from '@/providers/AuthProvider';
import { LibraryScreen } from '@/components/library/LibraryScreen';

// Library hub (SOPs and notes): Operations Managers, as the nav has it.
export default function LibraryPage() {
  const { user } = useAuth();
  if (!user) return null;
  if (user.role !== 'operations_manager') {
    return <p className="m-0 p-10 text-sm text-ink-3">Library is for Operations Managers.</p>;
  }
  return <LibraryScreen />;
}
