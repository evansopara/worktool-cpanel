'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import Header from '@/components/layout/Header';
import { projectsApi } from '@/lib/api';
import { Project, Resource } from '@/types';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import { FileText, ExternalLink } from 'lucide-react';

export default function ResourcesPage() {
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list().then((r) => r.data),
  });

  return (
    <div>
      <Header title="Resources" />
      <div className="p-6 space-y-6">
        {isLoading ? (
          <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}</div>
        ) : (
          projects.map((project: Project) => {
            if (!project.resources || project.resources.length === 0) return null;
            return (
              <div key={project.id}>
                <h3 className="text-sm font-semibold mb-2">{project.name}</h3>
                <div className="space-y-2">
                  {project.resources.map((r: Resource) => (
                    <div key={r.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-sm font-medium">{r.name}</p>
                          <div className="flex items-center gap-2">
                            {r.type && <Badge variant="secondary" className="text-xs capitalize">{r.type}</Badge>}
                            <span className="text-xs text-muted-foreground">{formatDate(r.created_at)}</span>
                          </div>
                        </div>
                      </div>
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                        Open <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
        {!isLoading && projects.every((p: Project) => !p.resources?.length) && (
          <div className="text-center py-16 text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No resources uploaded yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
