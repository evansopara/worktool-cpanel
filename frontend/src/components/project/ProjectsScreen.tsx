'use client';

import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { User } from '@/types';
import { Sheet, SheetActions, SheetDescription, SheetTitle } from '@/components/wc';
import { errorText } from '@/lib/tasks';
import { projectsApi } from '@/lib/api';
import type { ProjectFull } from '@/lib/projects';
import { useTaskWorkspace } from '@/components/task/useTaskWorkspace';
import { ProjectsList } from './ProjectsList';
import { ProjectDetail } from './ProjectDetail';
import { ProjectForm } from './ProjectForm';

/**
 * Projects list and project detail. The open project is in the URL
 * (?id=12), so a project can be linked to and Back works. Needs a
 * <Suspense> parent.
 */
export function ProjectsScreen({ user }: { user: User }) {
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const ws = useTaskWorkspace(user);

  const id = params.get('id') ? Number(params.get('id')) : null;
  const go = (next: number | null) => router.push(next === null ? pathname : `${pathname}?id=${next}`, { scroll: true });

  const [form, setForm] = useState<{ open: boolean; project: ProjectFull | null }>({ open: false, project: null });
  const [deleting, setDeleting] = useState<ProjectFull | null>(null);

  const remove = useMutation({
    mutationFn: (pid: number) => projectsApi.remove(pid),
    onSuccess: () => {
      toast.success('Project deleted');
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['home'] });
      setDeleting(null);
      go(null);
    },
    onError: (err) => toast.error(errorText(err, 'Could not delete the project.')),
  });

  return (
    <>
      {id === null ? (
        <ProjectsList canCreate={ws.manager} onOpen={go} onNew={() => setForm({ open: true, project: null })} />
      ) : (
        <ProjectDetail
          key={id}
          projectId={id}
          user={user}
          ws={ws}
          onBack={() => go(null)}
          onEdit={(p) => setForm({ open: true, project: p })}
          onDelete={setDeleting}
        />
      )}
      <ProjectForm open={form.open} project={form.project} onClose={() => setForm({ open: false, project: null })} />
      <Sheet open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        {deleting && (
          <>
            <SheetTitle>Delete “{deleting.name}”?</SheetTitle>
            <SheetDescription>This permanently deletes the project and everything in it: all its tasks, the plan, resources and team chat. It can’t be undone.</SheetDescription>
            <SheetActions confirmLabel="Delete project" confirmDisabled={remove.isPending} onConfirm={() => remove.mutate(deleting.id)} />
          </>
        )}
      </Sheet>
      {ws.dialogs}
    </>
  );
}
