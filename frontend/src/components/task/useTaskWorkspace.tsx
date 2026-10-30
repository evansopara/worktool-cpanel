'use client';

import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { User } from '@/types';
import { Sheet, SheetActions, SheetDescription, SheetTitle } from '@/components/wc';
import { errorText, MANAGER_ROLES, taskApi, type TaskDetail } from '@/lib/tasks';
import { RequestExtensionSheet } from './ExtensionRequests';
import { TaskForm } from './TaskForm';
import { TaskPanelDrawer } from './TaskPanel';
import { useTaskActions } from './useTaskActions';

/**
 * Everything a page with task lists needs around them: the task panel (kept
 * in the URL as ?task=ID), New/Edit form, delete confirmation, Request
 * extension sheet and the start prompts. Render `dialogs` once. Needs a
 * <Suspense> parent because it reads the URL.
 */
export function useTaskWorkspace(user: User) {
  const manager = MANAGER_ROLES.includes(user.role);
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const actions = useTaskActions();

  const [form, setForm] = useState<{ open: boolean; task: TaskDetail | null }>({ open: false, task: null });
  const [deleting, setDeleting] = useState<{ id: number; title: string } | null>(null);
  const [asking, setAsking] = useState<number | null>(null);

  const panelId = params.get('task') ? Number(params.get('task')) : null;
  const openPanel = (id: number | null) => {
    const next = new URLSearchParams(params.toString());
    if (id === null) next.delete('task');
    else next.set('task', String(id));
    router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
  };

  const remove = useMutation({
    mutationFn: (id: number) => taskApi.remove(id),
    onSuccess: (_, id) => {
      toast.success('Task deleted');
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['home'] });
      if (panelId === id) openPanel(null);
      setDeleting(null);
    },
    onError: (err) => toast.error(errorText(err, 'Could not delete the task.')),
  });

  const edit = async (id: number) => {
    try {
      const task = await qc.fetchQuery({ queryKey: ['task', id], queryFn: () => taskApi.get(id) });
      setForm({ open: true, task });
    } catch (err) {
      toast.error(errorText(err, 'Could not open the task.'));
    }
  };

  return {
    manager,
    actions,
    panelId,
    openPanel,
    edit,
    onDelete: (t: { id: number; title: string }) => setDeleting({ id: t.id, title: t.title }),
    newTask: () => setForm({ open: true, task: null }),
    requestExtension: (id: number) => setAsking(id),
    dialogs: (
      <>
        <TaskPanelDrawer
          taskId={panelId}
          onClose={() => openPanel(null)}
          manager={manager}
          userId={user.id}
          actions={actions}
          onEdit={(t) => setForm({ open: true, task: t })}
          onDelete={(t) => setDeleting({ id: t.id, title: t.title })}
        />
        <TaskForm open={form.open} task={form.task} onClose={() => setForm({ open: false, task: null })} />
        <RequestExtensionSheet open={asking !== null} taskId={asking ?? undefined} onClose={() => setAsking(null)} />
        <Sheet open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
          {deleting && (
            <>
              <SheetTitle>Delete “{deleting.title}”?</SheetTitle>
              <SheetDescription>It disappears from every list. Its history is kept.</SheetDescription>
              <SheetActions confirmLabel="Delete task" confirmDisabled={remove.isPending} onConfirm={() => remove.mutate(deleting.id)} />
            </>
          )}
        </Sheet>
        {actions.dialogs}
      </>
    ),
  };
}
