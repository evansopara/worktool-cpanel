'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import Header from '@/components/layout/Header';
import { messagesApi, usersApi } from '@/lib/api';
import { User, DirectMessage } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getInitials, timeAgo } from '@/lib/utils';
import { Send } from 'lucide-react';

export default function MessagesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [message, setMessage] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list().then((r) => r.data),
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['direct-messages', selectedUser?.id],
    queryFn: () => messagesApi.directMessages(selectedUser!.id).then((r) => r.data),
    enabled: !!selectedUser,
    refetchInterval: 5000,
  });

  const sendMutation = useMutation({
    mutationFn: (content: string) => messagesApi.sendDirect(selectedUser!.id, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['direct-messages', selectedUser?.id] });
      setMessage('');
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const otherUsers = users.filter((u: User) => u.id !== user?.id);

  const handleSend = () => {
    if (!message.trim() || !selectedUser) return;
    sendMutation.mutate(message.trim());
  };

  return (
    <div>
      <Header title="Direct Messages" />
      <div className="flex h-[calc(100vh-56px)]">
        {/* User list */}
        <div className="w-64 border-r overflow-y-auto shrink-0">
          <div className="p-3 border-b">
            <p className="text-xs font-medium text-muted-foreground uppercase">Team Members</p>
          </div>
          {otherUsers.map((u: User) => (
            <button
              key={u.id}
              onClick={() => setSelectedUser(u)}
              className={`w-full flex items-center gap-3 p-3 text-left hover:bg-muted/50 transition-colors ${
                selectedUser?.id === u.id ? 'bg-primary/10' : ''
              }`}
            >
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                  {getInitials(u.first_name, u.last_name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{u.first_name} {u.last_name}</p>
                <p className="text-xs text-muted-foreground capitalize truncate">{u.role?.replace(/_/g, ' ')}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Chat */}
        <div className="flex-1 flex flex-col min-w-0">
          {selectedUser ? (
            <>
              <div className="p-3 border-b flex items-center gap-3">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {getInitials(selectedUser.first_name, selectedUser.last_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{selectedUser.first_name} {selectedUser.last_name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{selectedUser.role?.replace(/_/g, ' ')}</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg: DirectMessage) => {
                  const isMe = msg.sender_id === user?.id;
                  return (
                    <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                      <Avatar className="h-6 w-6 shrink-0">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {isMe
                            ? getInitials(user?.first_name, user?.last_name)
                            : getInitials(selectedUser.first_name, selectedUser.last_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className={`max-w-xs ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                        <div className={`px-3 py-2 rounded-2xl text-sm ${
                          isMe ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-muted rounded-tl-sm'
                        }`}>
                          {msg.content}
                        </div>
                        <span className="text-xs text-muted-foreground">{timeAgo(msg.created_at)}</span>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              <div className="p-3 border-t flex gap-2">
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={`Message ${selectedUser.first_name}...`}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                />
                <Button size="icon" onClick={handleSend} disabled={!message.trim()}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <p className="text-sm">Select a team member to start chatting</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
