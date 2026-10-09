'use client';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '@/lib/client/api';
import { useEvent } from '@/lib/client/hooks';
import type { ProjectItem, TaskItem } from '@/lib/types';

/** Active tasks and projects for the pickers, combobox and palette. */
interface Ctx {
  tasks: TaskItem[];
  projects: ProjectItem[];
  loaded: boolean;
  reload: () => Promise<void>;
}

const CatalogCtx = createContext<Ctx | null>(null);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [t, p] = await Promise.all([api<TaskItem[]>('/api/tasks'), api<ProjectItem[]>('/api/projects')]);
      setTasks(t);
      setProjects(p);
      setLoaded(true);
    } catch {
      /* pickers keep their last list; the screens show their own errors */
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);
  useEvent(['tasks-changed', 'projects-changed', 'sessions-changed', 'data-changed'], () => void reload());

  return <CatalogCtx.Provider value={{ tasks, projects, loaded, reload }}>{children}</CatalogCtx.Provider>;
}

export function useCatalog(): Ctx {
  const c = useContext(CatalogCtx);
  if (!c) throw new Error('CatalogProvider missing');
  return c;
}
