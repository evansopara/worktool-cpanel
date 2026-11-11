'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Header from '@/components/layout/Header';
import { notesApi } from '@/lib/api';
import { Note } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { timeAgo } from '@/lib/utils';
import { toast } from 'sonner';
import { Plus, StickyNote, Trash2 } from 'lucide-react';

const NOTE_COLORS = [
  { label: 'Yellow', value: 'bg-yellow-50 border-yellow-200' },
  { label: 'Blue', value: 'bg-blue-50 border-blue-200' },
  { label: 'Green', value: 'bg-green-50 border-green-200' },
  { label: 'Pink', value: 'bg-pink-50 border-pink-200' },
  { label: 'Purple', value: 'bg-purple-50 border-purple-200' },
  { label: 'Default', value: '' },
];

export default function NotesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', color: '' });

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['notes'],
    queryFn: () => notesApi.list().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => notesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes'] });
      toast.success('Note created');
      setOpen(false);
      setForm({ title: '', content: '', color: '' });
    },
    onError: () => toast.error('Failed to create note'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => notesApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes'] });
      toast.success('Note deleted');
    },
  });

  return (
    <div>
      <Header title="Notes" />
      <div className="p-6 space-y-4">
        <div className="flex justify-end">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button size="sm" />}>
              <Plus className="w-4 h-4 mr-1" /> New Note
              </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Create Note</DialogTitle></DialogHeader>
              <div className="space-y-3 mt-2">
                <div className="space-y-1">
                  <Label>Title</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Content</Label>
                  <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={5} />
                </div>
                <div className="space-y-1.5">
                  <Label>Color</Label>
                  <div className="flex gap-2 flex-wrap">
                    {NOTE_COLORS.map((c) => (
                      <button
                        key={c.label}
                        onClick={() => setForm({ ...form, color: c.value })}
                        className={`w-7 h-7 rounded border-2 ${c.value || 'bg-white border-border'} ${form.color === c.value ? 'ring-2 ring-primary' : ''}`}
                        title={c.label}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => createMutation.mutate(form)} disabled={!form.title || createMutation.isPending}>
                    {createMutation.isPending ? 'Creating...' : 'Create'}
                  </Button>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(6)].map((_, i) => <div key={i} className="h-40 bg-muted animate-pulse rounded-lg" />)}
          </div>
        ) : notes.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <StickyNote className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No notes yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {notes.map((note: Note) => (
              <div key={note.id} className={`rounded-lg border p-4 relative group ${note.color || 'bg-white'}`}>
                <button
                  onClick={() => deleteMutation.mutate(note.id)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <h3 className="font-medium text-sm pr-5">{note.title}</h3>
                {note.content && (
                  <p className="text-xs text-muted-foreground mt-1.5 line-clamp-6 whitespace-pre-wrap">{note.content}</p>
                )}
                {note.todo_items && note.todo_items.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {note.todo_items.slice(0, 5).map((item, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs">
                        <div className={`w-3 h-3 rounded border ${item.done ? 'bg-primary border-primary' : 'border-muted-foreground'}`} />
                        <span className={item.done ? 'line-through text-muted-foreground' : ''}>{item.text}</span>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-2">{timeAgo(note.updated_at)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
