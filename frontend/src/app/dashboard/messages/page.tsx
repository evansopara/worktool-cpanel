'use client';

import { Suspense } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { InboxScreen } from '@/components/inbox/InboxScreen';

// Inbox: chats (general channel, project chats, direct messages) and memos.
export default function InboxPage() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <Suspense fallback={null}>
      <InboxScreen user={user} />
    </Suspense>
  );
}
