'use client';

import { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { projectsApi, messagesApi } from '@/lib/api';
import Header from '@/components/layout/Header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { statusColor, formatDate, domainExpiryStatus } from '@/lib/utils';
import { Project, Task, ProjectMember, ProjectCategory } from '@/types';
import Link from 'next/link';
import { toast } from 'sonner';
import { Pencil, Trash2 } from 'lucide-react';

const CATEGORIES: { value: ProjectCategory; label: string }[] = [
  { value: 'website_development', label: 'Website Development' },
  { value: 'dpl_outright', label: 'DPL Outright' },
  { value: 'dpl_partnership', label: 'DPL Partnership' },
  { value: 'direct_marketing', label: 'Direct Marketing' },
  { value: 'support_maintenance', label: 'Support & Maintenance' },
];

export default function ProjectDetailClient({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '', description: '', category: '' as ProjectCategory | '',
    status: '' as 'active' | 'inactive' | 'pending' | 'completed' | '',
    start_date: '', end_date: '',
    domain_registered_at: '', domain_expires_at: '',
  });

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.get(Number(id)).then((r) => r.data),
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['project-messages', id],
    queryFn: () => messagesApi.projectMessages(Number(id)).then((r) => r.data),
  });

  const openEdit = (p: Project) => {
    setEditForm({
      name: p.name,
      description: p.description ?? '',
      category: p.category ?? '',
      status: p.status,
      start_date: p.start_date ? p.start_date.slice(0, 10) : '',
      end_date: p.end_date ? p.end_date.slice(0, 10) : '',
      domain_registered_at: p.domain_registered_at ? p.domain_registered_at.slice(0, 10) : '',
      domain_expires_at: p.domain_expires_at ? p.domain_expires_at.slice(0, 10) : '',
    });
    setEditOpen(true);
  };

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => projectsApi.update(Number(id), data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', id] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project updated');
      setEditOpen(false);
    },
    onError: (err: unknown) => {
      const data = (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data;
      const detail = data?.message ?? (data?.errors ? Object.values(data.errors).flat().join(', ') : 'Unknown error');
      toast.error(`Failed to update project: ${detail}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => projectsApi.remove(Number(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project deleted');
      router.push('/dashboard/projects');
    },
    onError: () => toast.error('Failed to delete project'),
  });

  if (isLoading) {
    return (
      <div>
        <Header title="Project" />
        <div className="p-6 animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-64" />
          <div className="h-32 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!project) return null;

  const creatorName = project.creator
    ? `${project.creator.first_name} ${project.creator.last_name}`
    : '—';

  return (
    <div>
      <Header title={project.name} />
      <div className="p-6">
        {/* Info */}
        <div className="flex items-start justify-between mb-4 gap-4">
          <div>
            <h2 className="text-xl font-semibold">{project.name}</h2>
            {project.category && (
              <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                {CATEGORIES.find((c) => c.value === project.category)?.label ?? project.category.replace(/_/g, ' ')}
              </p>
            )}
            {project.description && (
              <p className="text-muted-foreground text-sm mt-1">{project.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge className={statusColor(project.status)} variant="outline">{project.status}</Badge>
            {domainExpiryStatus(project.domain_expires_at) === 'expired' && (
              <Badge className="bg-red-100 text-red-700 border-red-200" variant="outline">Domain Expired</Badge>
            )}
            {domainExpiryStatus(project.domain_expires_at) === 'expiring' && (
              <Badge className="bg-amber-100 text-amber-700 border-amber-200" variant="outline">Domain Expiring Soon</Badge>
            )}
            <Button size="sm" variant="outline" onClick={() => openEdit(project)}>
              <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
            </Button>
          </div>
        </div>

        {typeof project.progress === 'number' && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Progress</span><span>{project.progress}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${project.progress}%` }} />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Client', value: project.client ? `${project.client.first_name} ${project.client.last_name}` : '—' },
            { label: 'Created By', value: creatorName },
            { label: 'Start Date', value: formatDate(project.start_date) },
            { label: 'End Date', value: formatDate(project.end_date) },
            { label: 'Domain Registered', value: formatDate(project.domain_registered_at) },
            { label: 'Domain Expires', value: formatDate(project.domain_expires_at) },
          ].map((item) => (
            <div key={item.label} className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="text-sm font-medium mt-0.5">{item.value}</p>
            </div>
          ))}
        </div>

        <Tabs defaultValue="tasks">
          <TabsList>
            <TabsTrigger value="tasks">Tasks ({project.tasks?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="members">Members ({project.members?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="plans">Plans</TabsTrigger>
            <TabsTrigger value="messages">Messages ({messages.length})</TabsTrigger>
            <TabsTrigger value="resources">Resources</TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" className="mt-4">
            <div className="space-y-2">
              {project.tasks?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No tasks yet</p>
              ) : (
                project.tasks?.map((task: Task) => (
                  <div key={task.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="text-sm font-medium">{task.title}</p>
                      {task.assignee && (
                        <p className="text-xs text-muted-foreground">
                          {task.assignee.first_name} {task.assignee.last_name}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {task.deadline && (
                        <span className="text-xs text-muted-foreground">{formatDate(task.deadline)}</span>
                      )}
                      <Badge className={`text-xs ${statusColor(task.status)}`} variant="outline">
                        {task.status.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="members" className="mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {project.members?.map((member: ProjectMember) => (
                <div key={member.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                    {(member.user?.first_name?.[0] ?? '') + (member.user?.last_name?.[0] ?? '')}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{member.user?.first_name} {member.user?.last_name}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {member.role ? member.role.replace(/_/g, ' ') : member.user?.role?.replace(/_/g, ' ')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="plans" className="mt-4">
            <div className="space-y-3">
              {project.plans?.map((plan: { id: number; title: string; description?: string; deliverables?: { id: number; title: string; status: string }[] }) => (
                <Card key={plan.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{plan.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {plan.description && <p className="text-xs text-muted-foreground mb-3">{plan.description}</p>}
                    <div className="space-y-1.5">
                      {plan.deliverables?.map((d) => (
                        <div key={d.id} className="flex items-center justify-between text-xs p-2 bg-muted/30 rounded">
                          <span>{d.title}</span>
                          <Badge className={`text-xs ${statusColor(d.status)}`} variant="outline">{d.status}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {!project.plans?.length && (
                <p className="text-sm text-muted-foreground text-center py-8">No plans yet</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="messages" className="mt-4">
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {messages.map((msg: { id: number; content: string; sender?: { first_name: string; last_name: string }; created_at: string }) => (
                <div key={msg.id} className="flex gap-3 p-3 border rounded-lg">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                    {(msg.sender?.first_name?.[0] ?? '') + (msg.sender?.last_name?.[0] ?? '')}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">{msg.sender?.first_name} {msg.sender?.last_name}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(msg.created_at, 'MMM d, h:mm a')}</span>
                    </div>
                    <p className="text-sm mt-0.5">{msg.content}</p>
                  </div>
                </div>
              ))}
              {messages.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No messages yet</p>
              )}
            </div>
            <div className="mt-4">
              <Link href={`/dashboard/messages?project=${id}`} className="text-sm text-primary hover:underline">
                Open full message view →
              </Link>
            </div>
          </TabsContent>

          <TabsContent value="resources" className="mt-4">
            <div className="space-y-2">
              {project.resources?.map((r: { id: number; name: string; url: string; type?: string }) => (
                <div key={r.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="text-sm font-medium">{r.name}</p>
                    {r.type && <p className="text-xs text-muted-foreground capitalize">{r.type}</p>}
                  </div>
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                    Open →
                  </a>
                </div>
              ))}
              {!project.resources?.length && (
                <p className="text-sm text-muted-foreground text-center py-8">No resources yet</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Edit Project</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1">
              <Label>Project Name <span className="text-destructive">*</span></Label>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Category</Label>
                <Select value={editForm.category} onValueChange={(v) => setEditForm({ ...editForm, category: v as ProjectCategory })}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v as 'active' | 'inactive' | 'pending' | 'completed' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Start Date</Label>
                <Input type="date" value={editForm.start_date} onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>End Date</Label>
                <Input type="date" value={editForm.end_date} onChange={(e) => setEditForm({ ...editForm, end_date: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Domain Registered Date</Label>
                <Input type="date" value={editForm.domain_registered_at} onChange={(e) => setEditForm({ ...editForm, domain_registered_at: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Domain Expiry Date</Label>
                <Input type="date" value={editForm.domain_expires_at} onChange={(e) => setEditForm({ ...editForm, domain_expires_at: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                className="flex-1"
                disabled={!editForm.name || updateMutation.isPending}
                onClick={() => updateMutation.mutate({
                  name: editForm.name,
                  description: editForm.description || undefined,
                  category: editForm.category || undefined,
                  status: editForm.status || undefined,
                  start_date: editForm.start_date || undefined,
                  end_date: editForm.end_date || undefined,
                  domain_registered_at: editForm.domain_registered_at || null,
                  domain_expires_at: editForm.domain_expires_at || null,
                })}
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Delete Project</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground mt-1">
            Are you sure you want to delete <span className="font-medium text-foreground">{project.name}</span>? This action cannot be undone.
          </p>
          <div className="flex gap-2 mt-4">
            <Button
              variant="destructive"
              className="flex-1"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Yes, Delete'}
            </Button>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
