'use client';

import { useQuery } from '@tanstack/react-query';
import Header from '@/components/layout/Header';
import { usersApi } from '@/lib/api';
import { User } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getInitials, roleLabel } from '@/lib/utils';
import { Users } from 'lucide-react';

export default function TeamPage() {
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list().then((r) => r.data),
  });

  const grouped = users.reduce((acc: Record<string, User[]>, u: User) => {
    const role = u.role ?? 'other';
    if (!acc[role]) acc[role] = [];
    acc[role].push(u);
    return acc;
  }, {});

  const roleOrder = ['operations_manager', 'team_lead', 'project_manager', 'staff', 'intern', 'customer_support_officer', 'client'];

  return (
    <div>
      <Header title="Team" />
      <div className="p-6 space-y-8">
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />)}
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No team members found</p>
          </div>
        ) : (
          roleOrder.filter((role) => grouped[role]?.length > 0).map((role) => (
            <div key={role}>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                {roleLabel(role)} ({grouped[role].length})
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {grouped[role].map((member: User) => (
                  <div key={member.id} className="flex flex-col items-center p-4 border rounded-lg text-center hover:shadow-sm transition-shadow">
                    <Avatar className="h-12 w-12 mb-2">
                      <AvatarFallback className="text-sm font-semibold bg-primary/10 text-primary">
                        {getInitials(member.first_name, member.last_name)}
                      </AvatarFallback>
                    </Avatar>
                    <p className="text-sm font-medium">{member.first_name} {member.last_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{member.email}</p>
                    {member.specialization && (
                      <Badge variant="secondary" className="text-xs mt-1.5 capitalize">{member.specialization}</Badge>
                    )}
                    <div className={`w-2 h-2 rounded-full mt-2 ${
                      member.status === 'active' ? 'bg-green-500' : member.status === 'inactive' ? 'bg-red-500' : 'bg-yellow-500'
                    }`} />
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
