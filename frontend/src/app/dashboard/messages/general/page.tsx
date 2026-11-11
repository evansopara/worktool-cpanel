'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import Header from '@/components/layout/Header';
import { messagesApi } from '@/lib/api';
import { GeneralChannelMessage } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getInitials, timeAgo } from '@/lib/utils';
import { Send } from 'lucide-react';

export default function GeneralChannelPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [message, setMessage] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages = [] } = useQuery({
    queryKey: ['general-messages'],
    queryFn: () => messagesApi.generalMessages().then((r) => r.data),
    refetchInterval: 5000,
  });

  const sendMutation = useMutation({
    mutationFn: (content: string) => messagesApi.sendGeneral(content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['general-messages'] });
      setMessage('');
    },
  });

  const reactMutation = useMutation({
    mutationFn: ({ id, emoji }: { id: number; emoji: string }) => messagesApi.reactGeneral(id, emoji),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['general-messages'] }),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!message.trim()) return;
    sendMutation.mutate(message.trim());
  };

  return (
    <div className="flex flex-col h-screen">
      <Header title="General Channel" />
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg: GeneralChannelMessage) => {
          const isMe = msg.sender_id === user?.id;
          const reactionEntries = Object.entries(msg.reactions ?? {});

          return (
            <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                  {getInitials(msg.sender?.first_name, msg.sender?.last_name)}
                </AvatarFallback>
              </Avatar>
              <div className={`max-w-lg flex flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-2">
                  {!isMe && <span className="text-xs font-medium">{msg.sender?.first_name}</span>}
                  <span className="text-xs text-muted-foreground">{timeAgo(msg.created_at)}</span>
                </div>
                <div className={`px-3 py-2 rounded-2xl text-sm ${
                  isMe ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-muted rounded-tl-sm'
                }`}>
                  {msg.content}
                </div>
                {reactionEntries.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {reactionEntries.map(([emoji, users]) => (
                      <button
                        key={emoji}
                        onClick={() => reactMutation.mutate({ id: msg.id, emoji })}
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-muted text-xs hover:bg-muted/80"
                      >
                        {emoji} <span>{(users as string[]).length}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex gap-1">
                  {['👍', '❤️', '😄', '🎉'].map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => reactMutation.mutate({ id: msg.id, emoji })}
                      className="opacity-0 hover:opacity-100 group-hover:opacity-100 text-xs px-1 py-0.5 rounded hover:bg-muted transition-opacity"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
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
          placeholder="Message everyone..."
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
        />
        <Button size="icon" onClick={handleSend} disabled={!message.trim() || sendMutation.isPending}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
