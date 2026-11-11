'use client';

import { useAuth } from '@/providers/AuthProvider';
import { CalendarScreen } from '@/components/calendar/CalendarScreen';
import ClientBookings from '@/components/legacy/ClientBookings';

// Calendar (redesign step 6). Clients keep the old Bookings page until the
// client portal is designed.
export default function BookingsPage() {
  const { user } = useAuth();
  if (!user) return null;
  if (user.role === 'client') return <ClientBookings />;
  return <CalendarScreen user={user} />;
}
