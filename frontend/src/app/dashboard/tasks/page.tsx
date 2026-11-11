'use client';

import { Suspense } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { TasksScreen } from '@/components/task/TasksScreen';

export default function TasksPage() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <Suspense fallback={null}>
      <TasksScreen user={user} />
    </Suspense>
  );
}
