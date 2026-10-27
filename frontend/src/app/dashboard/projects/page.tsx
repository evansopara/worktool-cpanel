'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import Header from '@/components/layout/Header';
import { projectsApi, usersApi, messagesApi } from '@/lib/api';
import { Project, ProjectCategory, Task, ProjectMember } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { statusColor, formatDate, domainExpiryStatus } from '@/lib/utils';
import { toast } from 'sonner';
import { Plus, FolderKanban, Trash2, ChevronRight, ArrowLeft, Pencil, X, Users, Search, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';

const CATEGORIES: { value: ProjectCategory; label: string }[] = [
  { value: 'website_development', label: 'Website Development' },
  { value: 'dpl_outright', label: 'DPL Outright' },
  { value: 'dpl_partnership', label: 'DPL Partnership' },
  { value: 'direct_marketing', label: 'Direct Marketing' },
  { value: 'support_maintenance', label: 'Support & Maintenance' },
];

type DeliverableRow = { name: string; start_date: string; end_date: string };
const emptyDeliverable = (): DeliverableRow => ({ name: '', start_date: '', end_date: '' });


export default function ProjectsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  // List view state
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);

  // Create form state
  const [form, setForm] = useState({
    name: '', description: '', category: '' as ProjectCategory | '', client_id: '',
    start_date: '', end_date: '', status: 'active',
    domain_registered_at: '', domain_expires_at: '',
  });
  const [memberIds, setMemberIds] = useState<number[]>([]);
  const [planEnabled, setPlanEnabled] = useState(false);
  const [plan, setPlan] = useState({ name: '', description: '', start_date: '', end_date: '' });
  const [deliverables, setDeliverables] = useState<DeliverableRow[]>([emptyDeliverable()]);

  // Detail view state
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<'tasks' | 'resources' | null>(null);
  const [chatPage, setChatPage] = useState(false);
  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [addMemberUserId, setAddMemberUserId] = useState('');
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [editForm, setEditForm] = useState({
    name: '', description: '', category: '' as ProjectCategory | '',
    status: '' as 'active' | 'inactive' | 'pending' | 'completed' | '',
    start_date: '', end_date: '',
    domain_registered_at: '', domain_expires_at: '',
  });

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list().then((r) => r.data),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list().then((r) => r.data),
    enabled: ['operations_manager', 'team_lead', 'project_manager', 'customer_support_officer'].includes(user?.role ?? ''),
  });

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', selectedId],
    queryFn: () => projectsApi.get(selectedId!).then((r) => r.data),
    enabled: selectedId !== null,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['project-messages', selectedId],
    queryFn: () => messagesApi.projectMessages(selectedId!).then((r) => r.data),
    enabled: selectedId !== null,
    refetchInterval: chatPage ? 5000 : false,
  });

  type UserRow = { id: number; first_name: string; last_name: string; role: string };
  const allUsers = users as UserRow[];
  const clients = allUsers.filter((u) => u.role === 'client');
  const nonClients = allUsers.filter((u) => u.role !== 'client');

  const resetForm = () => {
    setForm({ name: '', description: '', category: '', client_id: '', start_date: '', end_date: '', status: 'active', domain_registered_at: '', domain_expires_at: '' });
    setMemberIds([]);
    setPlanEnabled(false);
    setPlan({ name: '', description: '', start_date: '', end_date: '' });
    setDeliverables([emptyDeliverable()]);
  };

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const projectRes = await projectsApi.create(data);
      const projectId = projectRes.data.id;
      if (planEnabled && plan.name) {
        const planRes = await projectsApi.createPlan(projectId, {
          title: plan.name,
          description: plan.description || undefined,
          start_date: plan.start_date || undefined,
          end_date: plan.end_date || undefined,
        });
        const planId = planRes.data.id;
        for (const d of deliverables.filter((d) => d.name.trim())) {
          await projectsApi.createDeliverable(projectId, planId, {
            title: d.name,
            start_date: d.start_date || undefined,
            due_date: d.end_date || undefined,
          });
        }
      }
      return projectRes;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project created');
      setCreateOpen(false);
      resetForm();
    },
    onError: (err: unknown) => {
      const data = (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data;
      const detail = data?.message ?? (data?.errors ? Object.values(data.errors).flat().join(', ') : 'Unknown error');
      toast.error(`Failed to create project: ${detail}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => projectsApi.update(selectedId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', selectedId] });
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
    mutationFn: () => projectsApi.remove(selectedId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project deleted');
      setSelectedId(null);
      setDeleteOpen(false);
    },
    onError: () => toast.error('Failed to delete project'),
  });

  const sendMessageMutation = useMutation({
    mutationFn: (content: string) => messagesApi.sendProjectMessage(selectedId!, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-messages', selectedId] });
      setChatInput('');
    },
    onError: () => toast.error('Failed to send message'),
  });

  const addMemberMutation = useMutation({
    mutationFn: (userId: number) => projectsApi.addMember(selectedId!, { user_id: userId, role: 'member' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', selectedId] });
      setAddMemberUserId('');
      toast.success('Member added');
    },
    onError: () => toast.error('Failed to add member'),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: number) => projectsApi.removeMember(selectedId!, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', selectedId] });
      toast.success('Member removed');
    },
    onError: () => toast.error('Failed to remove member'),
  });

  const toggleCategory = (cat: string) => {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

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

  const canCreate = ['operations_manager', 'team_lead', 'project_manager', 'customer_support_officer'].includes(user?.role ?? '');
  const canSubmit = form.name && form.category && form.start_date && form.end_date && !createMutation.isPending;

  const updateDeliverable = (i: number, field: keyof DeliverableRow, value: string) => {
    setDeliverables((prev) => prev.map((d, idx) => idx === i ? { ...d, [field]: value } : d));
  };

  // Auto-scroll chat to bottom when messages change or chat page opens
  useEffect(() => {
    if (chatPage) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, chatPage]);

  // ── Chat page ─────────────────────────────────────────────────────────────
  if (selectedId !== null && chatPage) {
    if (projectLoading || !project) {
      return (
        <div>
          <Header title="Team Chat" />
          <div className="p-6 animate-pulse space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={`h-10 bg-muted rounded-2xl w-64 ${i % 2 === 0 ? '' : 'ml-auto'}`} />
            ))}
          </div>
        </div>
      );
    }

    type MsgType = { id: number; content: string; sender_id?: number; sender?: { id?: number; first_name: string; last_name: string }; created_at: string };

    return (
      <div className="flex flex-col h-[calc(100vh-64px)]">
        <Header title="Team Chat" />

        {/* Project sub-header — sits below the main dashboard header */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b bg-background shrink-0">
          <Button variant="ghost" size="sm" className="-ml-1" onClick={() => setChatPage(false)}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{project.name}</p>
            <p className="text-xs text-muted-foreground">Project group chat</p>
          </div>
          <button
            onClick={() => setMembersModalOpen(true)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-muted"
          >
            <Users className="w-3.5 h-3.5" />
            {project.members?.length ?? 0} members
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <svg className="w-12 h-12 text-muted-foreground/30 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
              <p className="text-sm text-muted-foreground font-medium">No messages yet</p>
              <p className="text-xs text-muted-foreground mt-1">Be the first to start the conversation</p>
            </div>
          ) : (messages as MsgType[]).map((msg) => {
            const isMe = msg.sender_id === user?.id || msg.sender?.id === user?.id;
            return (
              <div key={msg.id} className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {(msg.sender?.first_name?.[0] ?? '?') + (msg.sender?.last_name?.[0] ?? '')}
                </div>
                <div className={`max-w-[70%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className={`flex items-center gap-1.5 mb-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                    <span className="text-xs font-medium">{isMe ? 'You' : `${msg.sender?.first_name} ${msg.sender?.last_name}`}</span>
                    <span className="text-xs text-muted-foreground">{formatDate(msg.created_at, 'h:mm a')}</span>
                  </div>
                  <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${isMe ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-muted rounded-tl-sm'}`}>
                    {msg.content}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        {/* Input bar */}
        <div className="border-t bg-background px-4 py-3 flex gap-2 shrink-0">
          <Input
            placeholder="Type a message..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && chatInput.trim()) {
                e.preventDefault();
                sendMessageMutation.mutate(chatInput.trim());
              }
            }}
            className="flex-1"
            disabled={sendMessageMutation.isPending}
          />
          <Button
            disabled={!chatInput.trim() || sendMessageMutation.isPending}
            onClick={() => { if (chatInput.trim()) sendMessageMutation.mutate(chatInput.trim()); }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </Button>
        </div>

        {/* Members modal */}
        <Dialog open={membersModalOpen} onOpenChange={setMembersModalOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>Project Members ({project.members?.length ?? 0})</DialogTitle></DialogHeader>
            <div className="space-y-2 mt-2 max-h-80 overflow-y-auto">
              {project.members?.map((m: ProjectMember) => (
                <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                    {(m.user?.first_name?.[0] ?? '') + (m.user?.last_name?.[0] ?? '')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{m.user?.first_name} {m.user?.last_name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{(m.role ?? m.user?.role ?? '').replace(/_/g, ' ')}</p>
                  </div>
                  {m.user?.id === user?.id && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">You</span>
                  )}
                </div>
              ))}
              {!project.members?.length && <p className="text-sm text-muted-foreground text-center py-4">No members yet</p>}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── Detail view ──────────────────────────────────────────────────────────
  if (selectedId !== null) {
    if (projectLoading || !project) {
      return (
        <div>
          <Header title="Project" />
          <div className="p-6 animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-64" />
            <div className="h-48 bg-muted rounded" />
            <div className="h-32 bg-muted rounded" />
          </div>
        </div>
      );
    }

    const durationDays = project.start_date && project.end_date
      ? Math.ceil((new Date(project.end_date).getTime() - new Date(project.start_date).getTime()) / 86400000)
      : null;

    const categoryLabel = CATEGORIES.find((c) => c.value === project.category)?.label ?? project.category?.replace(/_/g, ' ');
    const domainStatus = domainExpiryStatus(project.domain_expires_at);

    return (
      <div>
        <Header title={project.name} />
        <div className="p-6 space-y-4">
          {/* Top bar */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" className="-ml-1" onClick={() => { setSelectedId(null); setActiveSection(null); setChatPage(false); }}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to Projects
            </Button>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => openEdit(project)}>
                <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
              </Button>
            </div>
          </div>

          {/* Title */}
          <div>
            <h2 className="text-2xl font-bold">{project.name}</h2>
            {(categoryLabel || project.client) && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {[categoryLabel, project.client ? `${project.client.first_name} ${project.client.last_name}` : null]
                  .filter(Boolean).join(' • ')}
              </p>
            )}
          </div>

          {/* Project Overview card */}
          <div className="border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-base">Project Overview</h3>
              <div className="flex items-center gap-2">
                <Badge className={`${statusColor(project.status)} capitalize`} variant="outline">{project.status}</Badge>
                {domainStatus === 'expired' && (
                  <Badge className="bg-red-100 text-red-700 border-red-200" variant="outline">Domain Expired</Badge>
                )}
                {domainStatus === 'expiring' && (
                  <Badge className="bg-amber-100 text-amber-700 border-amber-200" variant="outline">Domain Expiring Soon</Badge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Timeline & Duration */}
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Timeline</p>
                    <p className="text-sm text-muted-foreground">
                      {project.start_date ? new Date(project.start_date).toLocaleDateString() : '—'} -{' '}
                      {project.end_date ? new Date(project.end_date).toLocaleDateString() : '—'}
                    </p>
                  </div>
                </div>
                {durationDays !== null && (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Duration</p>
                      <p className="text-sm text-muted-foreground">{durationDays} days</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Progress */}
              <div>
                <p className="text-sm font-semibold mb-3">Progress</p>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Completion</span>
                  <span className="font-medium">{project.progress ?? 0}%</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-foreground rounded-full transition-all" style={{ width: `${project.progress ?? 0}%` }} />
                </div>
              </div>

              {/* Project Details */}
              <div>
                <p className="text-sm font-semibold mb-3">Project Details</p>
                <div className="space-y-1.5 text-sm">
                  {categoryLabel && (
                    <p><span className="text-muted-foreground">Category: </span>{categoryLabel}</p>
                  )}
                  {project.manager && (
                    <p><span className="text-muted-foreground">Manager: </span>{project.manager.first_name} {project.manager.last_name}</p>
                  )}
                  <p><span className="text-muted-foreground">Created: </span>{new Date(project.created_at).toLocaleDateString()}</p>
                  {project.domain_registered_at && (
                    <p><span className="text-muted-foreground">Domain Registered: </span>{new Date(project.domain_registered_at).toLocaleDateString()}</p>
                  )}
                  {project.domain_expires_at && (
                    <p className={domainStatus ? 'text-red-600 font-medium' : ''}>
                      <span className={domainStatus ? '' : 'text-muted-foreground'}>Domain Expires: </span>
                      {new Date(project.domain_expires_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Description */}
            {project.description && (
              <div className="pt-4 border-t">
                <p className="text-sm font-semibold mb-1">Description</p>
                <p className="text-sm text-muted-foreground">{project.description}</p>
              </div>
            )}
          </div>

          {/* Project Plan card */}
          <div className="border rounded-xl p-5">
            <h3 className="font-semibold text-base mb-4">Project Plan</h3>
            {project.plans?.length ? (
              <div className="space-y-3">
                {project.plans.map((plan: { id: number; title: string; description?: string; deliverables?: { id: number; title: string; status: string }[] }) => (
                  <div key={plan.id} className="border rounded-lg p-4">
                    <p className="font-medium text-sm">{plan.title}</p>
                    {plan.description && <p className="text-xs text-muted-foreground mt-1 mb-3">{plan.description}</p>}
                    {plan.deliverables?.length ? (
                      <div className="space-y-1.5 mt-2">
                        {plan.deliverables.map((d) => (
                          <div key={d.id} className="flex items-center justify-between text-xs p-2 bg-muted/30 rounded">
                            <span>{d.title}</span>
                            <Badge className={`text-xs ${statusColor(d.status)}`} variant="outline">{d.status}</Badge>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No project plan created yet.</p>
            )}
          </div>

          {/* Action cards */}
          <div className="grid grid-cols-3 gap-4">
            {([
              { key: 'tasks' as const, label: 'View Tasks', desc: 'Manage project tasks', icon: (
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                </div>
              )},
              { key: 'resources' as const, label: 'Resources', desc: 'View project resources', icon: (
                <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
              )},
            ] as { key: 'tasks' | 'resources'; label: string; desc: string; icon: React.ReactNode }[]).map(({ key, label, desc, icon }) => (
              <button
                key={key}
                onClick={() => setActiveSection(activeSection === key ? null : key)}
                className={`flex items-center gap-3 p-4 border rounded-xl text-left transition-colors hover:bg-muted/40 ${activeSection === key ? 'border-primary bg-primary/5' : ''}`}
              >
                {icon}
                <div>
                  <p className="font-medium text-sm">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </button>
            ))}
            {/* Team Chat — navigates to dedicated chat page */}
            <button
              onClick={() => setChatPage(true)}
              className="flex items-center gap-3 p-4 border rounded-xl text-left transition-colors hover:bg-muted/40"
            >
              <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <div>
                <p className="font-medium text-sm">Team Chat</p>
                <p className="text-xs text-muted-foreground">Internal team communication</p>
              </div>
            </button>
          </div>

          {/* Expanded section */}
          {activeSection === 'tasks' && (
            <div className="border rounded-xl p-5">
              <h3 className="font-semibold text-sm mb-3">Tasks ({project.tasks?.length ?? 0})</h3>
              <div className="space-y-2">
                {!project.tasks?.length ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No tasks yet</p>
                ) : project.tasks.map((task: Task) => (
                  <div key={task.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="text-sm font-medium">{task.title}</p>
                      {task.assignee && <p className="text-xs text-muted-foreground">{task.assignee.first_name} {task.assignee.last_name}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      {task.deadline && <span className="text-xs text-muted-foreground">{formatDate(task.deadline)}</span>}
                      <Badge className={`text-xs ${statusColor(task.status)}`} variant="outline">{task.status.replace(/_/g, ' ')}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === 'resources' && (
            <div className="border rounded-xl p-5">
              <h3 className="font-semibold text-sm mb-3">Resources</h3>
              <div className="space-y-2">
                {!project.resources?.length ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No resources yet</p>
                ) : project.resources.map((r: { id: number; name: string; url: string; type?: string }) => (
                  <div key={r.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="text-sm font-medium">{r.name}</p>
                      {r.type && <p className="text-xs text-muted-foreground capitalize">{r.type}</p>}
                    </div>
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">Open →</a>
                  </div>
                ))}
              </div>
            </div>
          )}

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
                      {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
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
              {/* Members management */}
              <div className="space-y-2">
                <Label>Members</Label>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {project.members?.length ? project.members.map((m: ProjectMember) => (
                    <div key={m.id} className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                        {(m.user?.first_name?.[0] ?? '') + (m.user?.last_name?.[0] ?? '')}
                      </div>
                      <span className="text-sm flex-1">{m.user?.first_name} {m.user?.last_name}</span>
                      <span className="text-xs text-muted-foreground capitalize">{(m.role ?? m.user?.role ?? '').replace(/_/g, ' ')}</span>
                      <Button
                        variant="ghost" size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => m.user && removeMemberMutation.mutate(m.user.id)}
                        disabled={removeMemberMutation.isPending}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )) : (
                    <p className="text-xs text-muted-foreground">No members yet</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Select value={addMemberUserId} onValueChange={(v) => setAddMemberUserId(v as string)}>
                    <SelectTrigger className="flex-1 h-8 text-sm">
                      <SelectValue placeholder="Add a member...">
                        {(v: string | null) => {
                          const u = nonClients.find((au) => String(au.id) === v);
                          return u ? `${u.first_name} ${u.last_name} — ${u.role.replace(/_/g, ' ')}` : 'Add a member...';
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {nonClients
                        .filter((u) => !project.members?.some((m: ProjectMember) => m.user?.id === u.id))
                        .map((u) => (
                          <SelectItem key={u.id} value={String(u.id)}>
                            {u.first_name} {u.last_name} — {u.role.replace(/_/g, ' ')}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm" variant="outline"
                    className="h-8 px-3"
                    disabled={!addMemberUserId || addMemberMutation.isPending}
                    onClick={() => addMemberMutation.mutate(Number(addMemberUserId))}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <Button className="flex-1" disabled={!editForm.name || updateMutation.isPending}
                  onClick={() => updateMutation.mutate({
                    name: editForm.name,
                    description: editForm.description || undefined,
                    category: editForm.category || undefined,
                    status: editForm.status || undefined,
                    start_date: editForm.start_date || undefined,
                    end_date: editForm.end_date || undefined,
                    domain_registered_at: editForm.domain_registered_at || null,
                    domain_expires_at: editForm.domain_expires_at || null,
                  })}>
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>Delete Project</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground mt-1">
              Are you sure you want to delete <span className="font-medium text-foreground">{project.name}</span>? This action cannot be undone.
            </p>
            <div className="flex gap-2 mt-4">
              <Button variant="destructive" className="flex-1" disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}>
                {deleteMutation.isPending ? 'Deleting...' : 'Yes, Delete'}
              </Button>
              <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── List view ────────────────────────────────────────────────────────────
  const filtered = projects.filter((p: Project) => p.name.toLowerCase().includes(search.toLowerCase()));

  const now = new Date().getTime();
  const overdueCount = projects.filter((p: Project) => p.end_date && new Date(p.end_date).getTime() < now && p.status !== 'inactive' && p.status !== 'completed').length;
  const completedThisWeekCount = projects.filter((p: Project) => (p.progress ?? 0) >= 100 && new Date(p.updated_at).getTime() >= now - 7 * 86400000).length;
  const urgentCount = projects.filter((p: Project) => p.status === 'active' && new Date(p.updated_at).getTime() < now - 10 * 86400000).length;

  return (
    <div>
      <Header title="Projects" />
      <div className="p-6 space-y-5">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-muted-foreground mt-1">Manage and track your digital agency projects</p>
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search projects by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-11 h-12 rounded-xl"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl bg-red-50 p-5 flex items-start justify-between">
            <div>
              <p className="font-semibold text-red-700">Project Overdue</p>
              <p className="text-4xl font-bold text-red-800 mt-2">{overdueCount}</p>
              <p className="text-sm text-red-700/70 mt-1">Projects past deadline</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-red-600" />
            </div>
          </div>

          <div className="rounded-2xl bg-green-50 p-5 flex items-start justify-between">
            <div>
              <p className="font-semibold text-green-700">Completed This Week</p>
              <p className="text-4xl font-bold text-green-800 mt-2">{completedThisWeekCount}</p>
              <p className="text-sm text-green-700/70 mt-1">Projects finished recently</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
          </div>

          <div className="rounded-2xl bg-red-50 p-5 flex items-start justify-between">
            <div>
              <p className="font-semibold text-red-700">Urgent Attention</p>
              <p className="text-4xl font-bold text-red-800 mt-2">{urgentCount}</p>
              <p className="text-sm text-red-700/70 mt-1">No activity for 10+ days</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
          </div>
        </div>

        {canCreate && (
          <Dialog open={createOpen} onOpenChange={(v) => { setCreateOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger render={<Button className="bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-xl h-11 px-5" />}>
              <Plus className="w-4 h-4 mr-1.5" /> Add Project
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Create Project</DialogTitle></DialogHeader>
                <div className="space-y-4 mt-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Project Information</p>
                  <div className="space-y-1">
                    <Label>Project Name <span className="text-destructive">*</span></Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Enter project name" />
                  </div>
                  <div className="space-y-1">
                    <Label>Description</Label>
                    <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Optional project description" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Category <span className="text-destructive">*</span></Label>
                      <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as ProjectCategory })}>
                        <SelectTrigger><SelectValue placeholder="Select category..." /></SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Client</Label>
                      <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v as string })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select client...">
                            {(v: string | null) => {
                              const c = clients.find((cl) => String(cl.id) === v);
                              return c ? `${c.first_name} ${c.last_name}` : 'Select client...';
                            }}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {clients.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.first_name} {c.last_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Start Date <span className="text-destructive">*</span></Label>
                      <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>End Date <span className="text-destructive">*</span></Label>
                      <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Domain Registered Date</Label>
                      <Input type="date" value={form.domain_registered_at} onChange={(e) => setForm({ ...form, domain_registered_at: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Domain Expiry Date</Label>
                      <Input type="date" value={form.domain_expires_at} onChange={(e) => setForm({ ...form, domain_expires_at: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Team Members</Label>
                    {nonClients.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No users available</p>
                    ) : (
                      <div className="border rounded-md max-h-44 overflow-y-auto">
                        {nonClients.map((u) => (
                          <label key={u.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer border-b last:border-0">
                            <input type="checkbox" className="h-4 w-4 rounded border-input accent-primary"
                              checked={memberIds.includes(u.id)}
                              onChange={(e) => {
                                if (e.target.checked) setMemberIds([...memberIds, u.id]);
                                else setMemberIds(memberIds.filter((id) => id !== u.id));
                              }} />
                            <span className="text-sm flex-1">{u.first_name} {u.last_name}</span>
                            <span className="text-xs text-muted-foreground capitalize">{u.role.replace(/_/g, ' ')}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    {memberIds.length > 0 && <p className="text-xs text-muted-foreground">{memberIds.length} member{memberIds.length > 1 ? 's' : ''} selected</p>}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" className="h-4 w-4 rounded border-input accent-primary"
                      checked={planEnabled} onChange={(e) => setPlanEnabled(e.target.checked)} />
                    <div>
                      <p className="text-sm font-medium">Create Plan Now</p>
                      <p className="text-xs text-muted-foreground">Optionally set up a project plan and deliverables</p>
                    </div>
                  </label>
                  {planEnabled && (
                    <div className="space-y-3 pl-7">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Plan Details</p>
                      <div className="space-y-1">
                        <Label>Plan Name <span className="text-destructive">*</span></Label>
                        <Input value={plan.name} onChange={(e) => setPlan({ ...plan, name: e.target.value })} placeholder="e.g. Phase 1" />
                      </div>
                      <div className="space-y-1">
                        <Label>Plan Description</Label>
                        <Textarea value={plan.description} onChange={(e) => setPlan({ ...plan, description: e.target.value })} rows={2} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label>Plan Start Date <span className="text-destructive">*</span></Label>
                          <Input type="date" value={plan.start_date} onChange={(e) => setPlan({ ...plan, start_date: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <Label>Plan End Date <span className="text-destructive">*</span></Label>
                          <Input type="date" value={plan.end_date} onChange={(e) => setPlan({ ...plan, end_date: e.target.value })} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Deliverables</p>
                          <Button type="button" size="sm" variant="outline" onClick={() => setDeliverables([...deliverables, emptyDeliverable()])}>
                            <Plus className="w-3 h-3 mr-1" /> Add
                          </Button>
                        </div>
                        {deliverables.map((d, i) => (
                          <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
                            <div className="space-y-1">
                              {i === 0 && <Label className="text-xs">Name</Label>}
                              <Input placeholder="Deliverable name" value={d.name} onChange={(e) => updateDeliverable(i, 'name', e.target.value)} />
                            </div>
                            <div className="space-y-1">
                              {i === 0 && <Label className="text-xs">Start Date</Label>}
                              <Input type="date" value={d.start_date} onChange={(e) => updateDeliverable(i, 'start_date', e.target.value)} />
                            </div>
                            <div className="space-y-1">
                              {i === 0 && <Label className="text-xs">End Date</Label>}
                              <Input type="date" value={d.end_date} onChange={(e) => updateDeliverable(i, 'end_date', e.target.value)} />
                            </div>
                            <div className={i === 0 ? 'pt-5' : ''}>
                              <Button type="button" size="icon" variant="ghost" className="h-9 w-9 text-muted-foreground hover:text-destructive"
                                disabled={deliverables.length === 1}
                                onClick={() => setDeliverables(deliverables.filter((_, idx) => idx !== i))}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-4 border-t mt-2">
                  <Button className="flex-1" disabled={!canSubmit}
                    onClick={() => createMutation.mutate({
                      name: form.name,
                      description: form.description || undefined,
                      category: form.category,
                      client_id: form.client_id ? Number(form.client_id) : undefined,
                      start_date: form.start_date,
                      end_date: form.end_date,
                      domain_registered_at: form.domain_registered_at || undefined,
                      domain_expires_at: form.domain_expires_at || undefined,
                      status: form.status,
                      member_ids: memberIds.length ? memberIds : undefined,
                    })}>
                    {createMutation.isPending ? 'Creating...' : 'Create Project'}
                  </Button>
                  <Button variant="outline" onClick={() => { setCreateOpen(false); resetForm(); }}>Cancel</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <FolderKanban className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No projects found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {CATEGORIES.map((cat) => {
              const catProjects = filtered.filter((p: Project) => p.category === cat.value);
              if (catProjects.length === 0) return null;
              const isOpen = openCategories.has(cat.value);
              return (
                <div key={cat.value} className="border rounded-2xl overflow-hidden">
                  <button type="button"
                    className="w-full flex items-center justify-between px-6 py-5 hover:bg-muted/30 transition-colors text-left"
                    onClick={() => toggleCategory(cat.value)}>
                    <div className="flex items-center gap-3">
                      <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-90' : ''}`} />
                      <span className="font-bold text-lg">{cat.label}</span>
                    </div>
                    <span className="text-sm text-muted-foreground bg-muted rounded-full px-4 py-1.5">{catProjects.length} projects</span>
                  </button>
                  {isOpen && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-3">
                      {catProjects.map((project: Project) => (
                        <div key={project.id} onClick={() => setSelectedId(project.id)} className="cursor-pointer">
                          <Card className="hover:shadow-md transition-shadow h-full">
                            <CardContent className="pt-5 pb-4">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <h3 className="font-semibold text-sm leading-snug">{project.name}</h3>
                                <div className="flex items-center gap-1 shrink-0">
                                  {domainExpiryStatus(project.domain_expires_at) && (
                                    <Badge className="text-xs bg-red-100 text-red-700 border-red-200" variant="outline">Domain</Badge>
                                  )}
                                  <Badge className={`text-xs ${statusColor(project.status)}`} variant="outline">{project.status}</Badge>
                                </div>
                              </div>
                              {project.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{project.description}</p>}
                              {typeof project.progress === 'number' && project.progress > 0 && (
                                <div className="mb-2">
                                  <div className="flex justify-between text-xs text-muted-foreground mb-0.5">
                                    <span>Progress</span><span>{project.progress}%</span>
                                  </div>
                                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-primary rounded-full" style={{ width: `${project.progress}%` }} />
                                  </div>
                                </div>
                              )}
                              <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                                {project.manager && <span>PM: {project.manager.first_name} {project.manager.last_name}</span>}
                                {project.end_date && <span>Due {formatDate(project.end_date)}</span>}
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {(() => {
              const uncategorised = filtered.filter((p: Project) => !p.category);
              if (uncategorised.length === 0) return null;
              const isOpen = openCategories.has('__none__');
              return (
                <div className="border rounded-2xl overflow-hidden">
                  <button type="button"
                    className="w-full flex items-center justify-between px-6 py-5 hover:bg-muted/30 transition-colors text-left"
                    onClick={() => toggleCategory('__none__')}>
                    <div className="flex items-center gap-3">
                      <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-90' : ''}`} />
                      <span className="font-bold text-lg">Uncategorised</span>
                    </div>
                    <span className="text-sm text-muted-foreground bg-muted rounded-full px-4 py-1.5">{uncategorised.length} projects</span>
                  </button>
                  {isOpen && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-3">
                      {uncategorised.map((project: Project) => (
                        <div key={project.id} onClick={() => setSelectedId(project.id)} className="cursor-pointer">
                          <Card className="hover:shadow-md transition-shadow h-full">
                            <CardContent className="pt-5 pb-4">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <h3 className="font-semibold text-sm leading-snug">{project.name}</h3>
                                <div className="flex items-center gap-1 shrink-0">
                                  {domainExpiryStatus(project.domain_expires_at) && (
                                    <Badge className="text-xs bg-red-100 text-red-700 border-red-200" variant="outline">Domain</Badge>
                                  )}
                                  <Badge className={`text-xs ${statusColor(project.status)}`} variant="outline">{project.status}</Badge>
                                </div>
                              </div>
                              {project.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{project.description}</p>}
                              <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                                {project.manager && <span>PM: {project.manager.first_name} {project.manager.last_name}</span>}
                                {project.end_date && <span>Due {formatDate(project.end_date)}</span>}
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
