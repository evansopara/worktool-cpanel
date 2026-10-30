'use client';

import { Suspense } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { ProjectsScreen } from '@/components/project/ProjectsScreen';

export default function ProjectsPage() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <Suspense fallback={null}>
      <ProjectsScreen user={user} />
    </Suspense>
  );
}
