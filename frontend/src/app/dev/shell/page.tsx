'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import type { User, UserRole } from '@/types';
import { AppShell } from '@/components/shell/AppShell';
import { MoreScreen } from '@/components/shell/MoreScreen';
import { PageBody, PageHeader } from '@/components/shell/PageHeader';
import { Button } from '@/components/wc';

// Step 2 check page: the app shell with a sample user, no login needed.
//   ?role=operations_manager|team_lead|project_manager|staff|intern|customer_support_officer
//   &path=/dashboard/leave   (the page the menu treats as open)
//   &view=more               (the mobile More screen)

const NAMES: Record<string, [string, string]> = {
  operations_manager: ['Olubukola', 'Ige'],
  staff: ['Victor', 'Adeleye'],
};

function sampleUser(role: UserRole): User {
  const [first, last] = NAMES[role] ?? ['Sample', 'User'];
  return {
    id: 0,
    username: 'sample',
    first_name: first,
    last_name: last,
    email: null,
    role,
    status: 'active',
    must_set_password: false,
    is_active: true,
    created_at: '',
    updated_at: '',
  };
}

function Preview() {
  const params = useSearchParams();
  const role = (params.get('role') ?? 'operations_manager') as UserRole;
  const path = params.get('path') ?? '/dashboard/tasks';
  const user = sampleUser(role);
  const badges = role === 'staff' || role === 'intern' ? { tasks: 1 } : { tasks: 1, people: 3, clients: 2 };

  return (
    <AppShell user={user} unread={2} badges={badges} onSignOut={() => {}} previewPath={params.get('view') === 'more' ? '/dashboard/more' : path}>
      {params.get('view') === 'more' ? (
        <MoreScreen user={user} badges={badges} onSignOut={() => {}} />
      ) : (
        <PageBody>
          <PageHeader
            title="Tasks"
            description="Every task across projects, with time tracked against estimates"
            actions={
              <Button variant="accent">
                <Plus strokeWidth={2.4} aria-hidden="true" />
                New task
              </Button>
            }
          />
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="h-40 rounded-card-lg bg-surface p-6 text-sm text-ink-3">
              Sample content block {i + 1}, so the page scrolls while the sidebar stays put.
            </div>
          ))}
        </PageBody>
      )}
    </AppShell>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Preview />
    </Suspense>
  );
}
