'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import Header from '@/components/layout/Header';
import { deadlineApi, tasksApi } from '@/lib/api';
import { DeadlineExtensionRequest, Task } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { Plus, AlertCircle, CheckCircle2, XCircle, Eye } from 'lucide-react';

const REQUESTER_ROLES = ['staff', 'intern'];
const MANAGER_ROLES = ['operations_manager', 'team_lead', 'project_manager', 'customer_support_officer'];

const STATUS_META: Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-700', icon: AlertCircle },
  approved: { label: 'Approved', className: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  rejected: { label: 'Declined', className: 'bg-red-100 text-red-600', icon: XCircle },
};

function StatusPill({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, className: 'bg-slate-100 text-slate-700', icon: AlertCircle };
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap ${meta.className}`}>
      <Icon className="w-3.5 h-3.5" /> {meta.label}
    </span>
  );
}

function fmt(date?: string | null) {
  return date ? formatDate(date, 'M/d/yyyy, hh:mm a') : '—';
}

export default function ExtensionRequestsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState<string>('');
  const [taskId, setTaskId] = useState<string>('');
  const [reason, setReason] = useState('');
  const [requestedDeadline, setRequestedDeadline] = useState('');

  const { data: requests = [], isLoading } = useQuery<DeadlineExtensionRequest[]>({
    queryKey: ['deadline-requests'],
    queryFn: () => deadlineApi.list().then((r) => r.data),
  });

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ['tasks'],
    queryFn: () => tasksApi.list().then((r) => r.data),
    enabled: open,
  });

  const eligibleTasks = tasks.filter((t) => t.deadline && t.project?.manager_id);
  const eligibleProjects = Array.from(
    new Map(eligibleTasks.map((t) => [t.project_id, t.project!])).values()
  );
  const tasksInProject = eligibleTasks.filter((t) => String(t.project_id) === projectId);
  const selectedTask = tasksInProject.find((t) => String(t.id) === taskId);

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => deadlineApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deadline-requests'] });
      toast.success('Extension request submitted');
      setOpen(false);
      setProjectId('');
      setTaskId('');
      setReason('');
      setRequestedDeadline('');
    },
    onError: () => toast.error('Failed to submit request'),
  });

  const decideMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => deadlineApi.decide(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deadline-requests'] });
      // Approving/declining can change the task's deadline and clear a
      // deadline_missed status — refresh cached task lists so that shows up
      // immediately elsewhere in the app (e.g. re-enabling the timer).
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Decision recorded');
      setReviewReq(null);
    },
    onError: () => toast.error('Failed to record decision'),
  });

  const [viewReq, setViewReq] = useState<DeadlineExtensionRequest | null>(null);

  // Reviewing a request always opens a confirmation form — the requester's
  // requested deadline is only a starting suggestion, the approver can change
  // both the deadline and working hours before confirming either decision.
  const [reviewReq, setReviewReq] = useState<DeadlineExtensionRequest | null>(null);
  const [reviewAction, setReviewAction] = useState<'approved' | 'rejected'>('approved');
  const [reviewForm, setReviewForm] = useState({ approved_deadline: '', approved_working_hours: '', approved_working_minutes: '', decision_reason: '' });

  const openReview = (req: DeadlineExtensionRequest, action: 'approved' | 'rejected') => {
    setReviewReq(req);
    setReviewAction(action);
    setReviewForm({
      approved_deadline: formatDate(req.requested_deadline, "yyyy-MM-dd'T'HH:mm"),
      approved_working_hours: '',
      approved_working_minutes: '',
      decision_reason: '',
    });
  };

  const submitReview = () => {
    if (!reviewReq) return;
    const data: Record<string, unknown> = {
      status: reviewAction,
      decision_reason: reviewForm.decision_reason,
    };
    if (reviewAction === 'approved') {
      data.approved_deadline = reviewForm.approved_deadline;
      if (reviewForm.approved_working_hours) data.approved_working_hours = Number(reviewForm.approved_working_hours);
      if (reviewForm.approved_working_minutes) data.approved_working_minutes = Number(reviewForm.approved_working_minutes);
    }
    decideMutation.mutate({ id: reviewReq.id, data });
  };

  const canRequest = REQUESTER_ROLES.includes(user?.role ?? '');
  const isManager = MANAGER_ROLES.includes(user?.role ?? '');

  const submit = () => {
    if (!selectedTask) return;
    createMutation.mutate({
      task_id: selectedTask.id,
      project_manager_id: selectedTask.project!.manager_id,
      reason,
      requested_deadline: requestedDeadline,
    });
  };

  const requestDialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="rounded-xl h-11 px-5 bg-slate-900 hover:bg-slate-800 text-white" />}>
        <Plus className="w-4 h-4 mr-1.5" /> New Request
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Request Deadline Extension</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-2">
          <div className="space-y-1">
            <Label>Project</Label>
            <Select
              value={projectId}
              onValueChange={(v) => { setProjectId(v as string); setTaskId(''); }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a project">
                  {(v: string | null) => eligibleProjects.find((p) => String(p.id) === v)?.name ?? 'Select a project'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {eligibleProjects.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {tasks.length > 0 && eligibleProjects.length === 0 && (
              <p className="text-xs text-muted-foreground">
                None of your tasks are eligible yet — each task needs a deadline, and its project needs a manager assigned. Ask an Operations Manager to assign a manager to the project.
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label>Task</Label>
            <Select value={taskId} onValueChange={(v) => setTaskId(v as string)} disabled={!projectId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={projectId ? 'Select a task' : 'Select a project first'}>
                  {(v: string | null) => tasksInProject.find((t) => String(t.id) === v)?.title ?? (projectId ? 'Select a task' : 'Select a project first')}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {tasksInProject.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>{t.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {projectId && tasksInProject.length === 0 && (
              <p className="text-xs text-muted-foreground">No eligible tasks under this project.</p>
            )}
          </div>
          {selectedTask && (
            <p className="text-xs text-muted-foreground">
              Project: {selectedTask.project?.name ?? '—'} · Current deadline: {formatDate(selectedTask.deadline, 'MMM d, yyyy, h:mm a')} · Manager: {selectedTask.project?.manager?.first_name ?? 'Assigned manager'}
            </p>
          )}
          <div className="space-y-1">
            <Label>Requested new deadline</Label>
            <Input type="datetime-local" value={requestedDeadline} onChange={(e) => setRequestedDeadline(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Reason</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
          </div>
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={submit}
              disabled={!selectedTask || !reason || !requestedDeadline || createMutation.isPending}
            >
              {createMutation.isPending ? 'Submitting...' : 'Submit Request'}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  const reviewDialog = (
    <Dialog open={!!reviewReq} onOpenChange={(v) => !v && setReviewReq(null)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{reviewAction === 'approved' ? 'Approve Extension Request' : 'Decline Extension Request'}</DialogTitle>
        </DialogHeader>
        {reviewReq && (
          <div className="space-y-4 mt-2">
            <div className="rounded-xl bg-muted/40 p-4 space-y-3">
              <p className="font-bold">Request Details</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <p><span className="text-muted-foreground">Staff: </span><span className="font-semibold">{reviewReq.requester ? `${reviewReq.requester.first_name} ${reviewReq.requester.last_name}` : `#${reviewReq.requester_id}`}</span></p>
                <p><span className="text-muted-foreground">Project: </span><span className="font-semibold">{reviewReq.task?.project?.name ?? '—'}</span></p>
                <p><span className="text-muted-foreground">Task: </span><span className="font-semibold">{reviewReq.task?.title ?? `Task #${reviewReq.task_id}`}</span></p>
                <p><span className="text-muted-foreground">Current Deadline: </span><span className="font-semibold">{fmt(reviewReq.task?.deadline)}</span></p>
              </div>
              <div className="text-sm">
                <p className="text-muted-foreground">Reason:</p>
                <p>{reviewReq.reason}</p>
              </div>
            </div>

            <div className="space-y-1">
              <Label>New Deadline</Label>
              <Input
                type="datetime-local"
                value={reviewForm.approved_deadline}
                onChange={(e) => setReviewForm({ ...reviewForm, approved_deadline: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <Label>Estimated Time</Label>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="number"
                  min="0"
                  placeholder="Hours"
                  value={reviewForm.approved_working_hours}
                  onChange={(e) => setReviewForm({ ...reviewForm, approved_working_hours: e.target.value })}
                />
                <Input
                  type="number"
                  min="0"
                  max="59"
                  placeholder="Minutes"
                  value={reviewForm.approved_working_minutes}
                  onChange={(e) => setReviewForm({ ...reviewForm, approved_working_minutes: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Decision Reason <span className="text-destructive">*</span></Label>
              <Textarea
                rows={4}
                placeholder={reviewAction === 'approved' ? 'Please explain why you approved this request...' : 'Please explain why you declined this request...'}
                value={reviewForm.decision_reason}
                onChange={(e) => setReviewForm({ ...reviewForm, decision_reason: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setReviewReq(null)}>Cancel</Button>
              <Button
                className={reviewAction === 'approved' ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}
                disabled={!reviewForm.decision_reason || (reviewAction === 'approved' && !reviewForm.approved_deadline) || decideMutation.isPending}
                onClick={submitReview}
              >
                {decideMutation.isPending ? 'Saving...' : reviewAction === 'approved' ? 'Approve Request' : 'Decline Request'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );

  const viewDialog = (
    <Dialog open={!!viewReq} onOpenChange={(v) => !v && setViewReq(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Extension Request Details</DialogTitle></DialogHeader>
        {viewReq && (
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <p><span className="text-muted-foreground">Staff Member: </span><span className="font-semibold">{viewReq.requester ? `${viewReq.requester.first_name} ${viewReq.requester.last_name}` : `#${viewReq.requester_id}`}</span></p>
              <p><span className="text-muted-foreground">Project: </span><span className="font-semibold">{viewReq.task?.project?.name ?? '—'}</span></p>
              <p><span className="text-muted-foreground">Task: </span><span className="font-semibold">{viewReq.task?.title ?? `Task #${viewReq.task_id}`}</span></p>
              <p><span className="text-muted-foreground">Status: </span><StatusPill status={viewReq.status} /></p>
              <p><span className="text-muted-foreground">Current Deadline: </span><span className="font-semibold">{fmt(viewReq.task?.deadline)}</span></p>
              <p><span className="text-muted-foreground">Requested Deadline: </span><span className="font-semibold">{fmt(viewReq.requested_deadline)}</span></p>
            </div>
            <div className="text-sm">
              <p className="text-muted-foreground">Reason for Extension:</p>
              <p className="whitespace-pre-wrap break-words">{viewReq.reason || '—'}</p>
            </div>
            <div className="text-sm border-t pt-3">
              <p className="text-muted-foreground">Decision Reason:</p>
              <p className="whitespace-pre-wrap break-words">{viewReq.decision_reason || 'No decision yet'}</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );

  // ── Manager / reviewer view ─────────────────────────────────────────────
  if (isManager) {
    const pending = requests.filter((r) => r.status === 'pending');

    return (
      <div>
        <Header title="Deadline Extension Requests" />
        <div className="p-6 space-y-5">
          <div>
            <h1 className="text-3xl font-bold">Deadline Extension Requests</h1>
            <p className="text-muted-foreground mt-1">Review and manage deadline extension requests from your team</p>
          </div>

          <span className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 w-fit">
            <AlertCircle className="w-4 h-4" /> {pending.length} Pending
          </span>

          <div className="border rounded-2xl p-6">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-6 h-6 text-amber-500" />
              <h2 className="text-2xl font-bold">Pending Requests</h2>
            </div>
            <p className="text-muted-foreground mt-1 mb-4">Requests awaiting your decision</p>

            {isLoading ? (
              <div className="space-y-2">{[...Array(2)].map((_, i) => <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />)}</div>
            ) : pending.length === 0 ? (
              <p className="text-center py-10 text-muted-foreground text-sm">No pending requests</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-3 pr-4 font-medium whitespace-nowrap">Project / Staff Member</th>
                      <th className="pb-3 pr-4 font-medium whitespace-nowrap">Task</th>
                      <th className="pb-3 pr-4 font-medium">Current Deadline</th>
                      <th className="pb-3 pr-4 font-medium">Requested Deadline</th>
                      <th className="pb-3 font-medium whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pending.map((req) => (
                      <tr key={req.id} className="border-b last:border-0 align-top">
                        {/* Project / Staff Member Combined */}
                        <td className="py-4 pr-4 min-w-[160px] max-w-[240px] leading-snug">
                          <p className="text-xs text-muted-foreground">Project: {req.task?.project?.name ?? '—'}</p>
                          <p className="font-semibold mt-0.5">
                            {req.requester ? `${req.requester.first_name} ${req.requester.last_name}` : `#${req.requester_id}`}
                          </p>
                        </td>
                        <td className="py-4 pr-4 min-w-[140px] max-w-[240px]">{req.task?.title ?? `Task #${req.task_id}`}</td>
                        <td className="py-4 pr-4 whitespace-nowrap">{fmt(req.task?.deadline)}</td>
                        <td className="py-4 pr-4 whitespace-nowrap">{fmt(req.requested_deadline)}</td>
                        <td className="py-4">
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 border-green-200 text-green-700 hover:bg-green-50"
                              onClick={() => openReview(req, 'approved')}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 border-red-200 text-red-600 hover:bg-red-50"
                              onClick={() => openReview(req, 'rejected')}
                            >
                              <XCircle className="w-3.5 h-3.5 mr-1" /> Decline
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="border rounded-2xl p-6">
            <h2 className="text-2xl font-bold">All Extension Requests</h2>
            <p className="text-muted-foreground mt-1 mb-4">Complete history of deadline extension requests</p>

            {isLoading ? (
              <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />)}</div>
            ) : requests.length === 0 ? (
              <p className="text-center py-10 text-muted-foreground text-sm">No extension requests yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-3 pr-4 font-medium whitespace-nowrap">Project / Staff Member</th>
                      <th className="pb-3 pr-4 font-medium whitespace-nowrap">Task</th>
                      <th className="pb-3 pr-4 font-medium">New Deadline</th>
                      <th className="pb-3 pr-4 font-medium">Requested Deadline</th>
                      <th className="pb-3 pr-4 font-medium whitespace-nowrap">Status</th>
                      <th className="pb-3 font-medium whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((req) => (
                      <tr key={req.id} className="border-b last:border-0 align-top">
                        {/* Project / Staff Member Combined */}
                        <td className="py-4 pr-4 min-w-[160px] max-w-[240px] leading-snug">
                          <p className="text-xs text-muted-foreground">Project: {req.task?.project?.name ?? '—'}</p>
                          <p className="font-semibold mt-0.5">
                            {req.requester ? `${req.requester.first_name} ${req.requester.last_name}` : `#${req.requester_id}`}
                          </p>
                        </td>
                        <td className="py-4 pr-4 min-w-[140px] max-w-[240px]">{req.task?.title ?? `Task #${req.task_id}`}</td>
                        <td className="py-4 pr-4 whitespace-nowrap">{fmt(req.approved_deadline)}</td>
                        <td className="py-4 pr-4 whitespace-nowrap">{fmt(req.requested_deadline)}</td>
                        <td className="py-4 pr-4"><StatusPill status={req.status} /></td>
                        <td className="py-4">
                          <div className="flex items-center gap-2">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8"
                              onClick={() => setViewReq(req)}
                              title="View details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            {req.status === 'pending' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 border-green-200 text-green-700 hover:bg-green-50"
                                  onClick={() => openReview(req, 'approved')}
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 border-red-200 text-red-600 hover:bg-red-50"
                                  onClick={() => openReview(req, 'rejected')}
                                >
                                  Decline
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {reviewDialog}
        {viewDialog}
      </div>
    );
  }

  // ── Requester view ────────────────────────────────────────────────────────
  return (
    <div>
      <Header title="Extension Requests" />
      <div className="p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Extension Requests</h1>
            <p className="text-muted-foreground mt-1">Request deadline extensions for your tasks</p>
          </div>
          {canRequest && <div className="w-full sm:w-auto shrink-0">{requestDialog}</div>}
        </div>

        <div className="border rounded-2xl p-6">
          <h2 className="text-2xl font-bold">Your Extension Requests</h2>
          <p className="text-muted-foreground mt-1 mb-4">View the status of your deadline extension requests</p>

          {isLoading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />)}</div>
          ) : requests.length === 0 ? (
            <p className="text-center py-10 text-muted-foreground text-sm">No extension requests yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 pr-4 font-medium whitespace-nowrap">Project</th>
                    <th className="pb-3 pr-4 font-medium whitespace-nowrap">Task</th>
                    <th className="pb-3 pr-4 font-medium whitespace-nowrap">Current Deadline</th>
                    <th className="pb-3 pr-4 font-medium whitespace-nowrap">Requested Deadline</th>
                    <th className="pb-3 pr-4 font-medium whitespace-nowrap">Reason</th>
                    <th className="pb-3 pr-4 font-medium whitespace-nowrap">Status</th>
                    <th className="pb-3 pr-4 font-medium whitespace-nowrap">Decision Reason</th>
                    <th className="pb-3 font-medium whitespace-nowrap">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req) => (
                    <tr key={req.id} className="border-b last:border-0 align-top">
                      <td className="py-4 pr-4 font-semibold whitespace-nowrap">{req.task?.project?.name ?? '—'}</td>
                      <td className="py-4 pr-4 whitespace-nowrap">{req.task?.title ?? `Task #${req.task_id}`}</td>
                      <td className="py-4 pr-4 whitespace-nowrap">{fmt(req.task?.deadline)}</td>
                      <td className="py-4 pr-4 whitespace-nowrap">{fmt(req.requested_deadline)}</td>
                      <td className="py-4 pr-4 max-w-[180px]"><p className="truncate">{req.reason || '—'}</p></td>
                      <td className="py-4 pr-4"><StatusPill status={req.status} /></td>
                      <td className="py-4 pr-4 max-w-[180px]"><p className="truncate">{req.decision_reason || '—'}</p></td>
                      <td className="py-4 whitespace-nowrap">{fmt(req.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
