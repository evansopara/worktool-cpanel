'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import Header from '@/components/layout/Header';
import { sopsApi } from '@/lib/api';
import { Sop, SopSegment } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Plus, BookOpen, ChevronDown, ChevronRight } from 'lucide-react';

export default function SopsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [segOpen, setSegOpen] = useState<number | null>(null);
  const [segForm, setSegForm] = useState({ title: '', content: '' });
  const [form, setForm] = useState({ title: '', description: '', category: '' });

  const { data: sops = [], isLoading } = useQuery({
    queryKey: ['sops'],
    queryFn: () => sopsApi.list().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => sopsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sops'] });
      toast.success('SOP created');
      setOpen(false);
      setForm({ title: '', description: '', category: '' });
    },
    onError: () => toast.error('Failed to create SOP'),
  });

  const addSegMutation = useMutation({
    mutationFn: ({ sopId, data }: { sopId: number; data: Record<string, unknown> }) => sopsApi.addSegment(sopId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sops'] });
      toast.success('Section added');
      setSegOpen(null);
      setSegForm({ title: '', content: '' });
    },
  });

  const canCreate = ['operations_manager', 'team_lead'].includes(user?.role ?? '');

  return (
    <div>
      <Header title="Standard Operating Procedures" />
      <div className="p-6 space-y-4">
        <div className="flex justify-end">
          {canCreate && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger render={<Button size="sm" />}>
                <Plus className="w-4 h-4 mr-1" /> New SOP
                </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Create SOP</DialogTitle></DialogHeader>
                <div className="space-y-3 mt-2">
                  <div className="space-y-1">
                    <Label>Title</Label>
                    <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Description</Label>
                    <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
                  </div>
                  <div className="space-y-1">
                    <Label>Category</Label>
                    <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Design, Development" />
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
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}</div>
        ) : sops.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No SOPs yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sops.map((sop: Sop) => (
              <Card key={sop.id}>
                <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpanded(expanded === sop.id ? null : sop.id)}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {expanded === sop.id ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                      <CardTitle className="text-sm">{sop.title}</CardTitle>
                      {sop.category && (
                        <Badge variant="secondary" className="text-xs">{sop.category}</Badge>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">{sop.segments?.length ?? 0} sections</Badge>
                  </div>
                  {sop.description && <p className="text-xs text-muted-foreground ml-6">{sop.description}</p>}
                </CardHeader>

                {expanded === sop.id && (
                  <CardContent className="pt-0">
                    <div className="space-y-3 ml-6">
                      {sop.segments?.map((seg: SopSegment, i: number) => (
                        <div key={seg.id} className="border-l-2 border-primary/30 pl-3">
                          <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Section {i + 1}: {seg.title}</p>
                          <p className="text-sm whitespace-pre-wrap">{seg.content}</p>
                        </div>
                      ))}
                      {sop.segments?.length === 0 && (
                        <p className="text-xs text-muted-foreground">No sections yet</p>
                      )}

                      {canCreate && (
                        <Dialog open={segOpen === sop.id} onOpenChange={(o) => setSegOpen(o ? sop.id : null)}>
                          <DialogTrigger render={<Button variant="outline" size="sm" className="text-xs" />}>
                            <Plus className="w-3 h-3 mr-1" /> Add Section
                            </DialogTrigger>
                          <DialogContent className="sm:max-w-md">
                            <DialogHeader><DialogTitle>Add Section</DialogTitle></DialogHeader>
                            <div className="space-y-3 mt-2">
                              <div className="space-y-1">
                                <Label>Section Title</Label>
                                <Input value={segForm.title} onChange={(e) => setSegForm({ ...segForm, title: e.target.value })} />
                              </div>
                              <div className="space-y-1">
                                <Label>Content</Label>
                                <Textarea value={segForm.content} onChange={(e) => setSegForm({ ...segForm, content: e.target.value })} rows={6} />
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  className="flex-1"
                                  onClick={() => addSegMutation.mutate({ sopId: sop.id, data: segForm })}
                                  disabled={!segForm.title || !segForm.content || addSegMutation.isPending}
                                >
                                  Add
                                </Button>
                                <Button variant="outline" onClick={() => setSegOpen(null)}>Cancel</Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
