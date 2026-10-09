'use client';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ProjectItem, SessionRow, TaskItem } from '@/lib/types';

/** What starting a task means: an existing task, or a typed name under a project. */
export type StartInput = { task_id: string; label: string } | { task_name: string; project_id: string | null; label: string };

export interface SessionDialogState {
  mode: 'add' | 'edit';
  date?: string;
  session?: SessionRow;
}

interface DialogState {
  addTime: SessionDialogState | null;
  stopAt: { pendingStart?: StartInput } | null;
  editStart: { sessionId: string; startedAt: string } | null;
  discard: boolean;
  project: { project?: ProjectItem; onCreated?: (p: ProjectItem) => void } | null;
  task: { task?: TaskItem; onCreated?: (t: TaskItem) => void } | null;
  shortcuts: boolean;
  help: boolean;
  palette: boolean;
}

interface Ctx extends DialogState {
  openAddTime: (s?: Partial<SessionDialogState>) => void;
  openEditSession: (session: SessionRow) => void;
  closeSession: () => void;
  openStopAt: (pendingStart?: StartInput) => void;
  closeStopAt: () => void;
  openEditStart: (sessionId: string, startedAt: string) => void;
  closeEditStart: () => void;
  setDiscard: (o: boolean) => void;
  openProject: (p?: ProjectItem, onCreated?: (p: ProjectItem) => void) => void;
  closeProject: () => void;
  openTask: (t?: TaskItem, onCreated?: (t: TaskItem) => void) => void;
  closeTask: () => void;
  setShortcuts: (o: boolean) => void;
  setHelp: (o: boolean) => void;
  setPalette: (o: boolean) => void;
  /** Focus the stage's task input (the `N` shortcut and "Start a timer"). */
  focusTaskInput: () => void;
  registerTaskInput: (fn: (() => void) | null) => void;
}

const UiCtx = createContext<Ctx | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [s, set] = useState<DialogState>({
    addTime: null, stopAt: null, editStart: null, discard: false, project: null, task: null, shortcuts: false, help: false, palette: false,
  });
  const [focusFn, setFocusFn] = useState<(() => void) | null>(null);
  const patch = useCallback((p: Partial<DialogState>) => set((cur) => ({ ...cur, ...p })), []);

  const value = useMemo<Ctx>(
    () => ({
      ...s,
      openAddTime: (x) => patch({ addTime: { mode: 'add', ...x } }),
      openEditSession: (session) => patch({ addTime: { mode: 'edit', session } }),
      closeSession: () => patch({ addTime: null }),
      openStopAt: (pendingStart) => patch({ stopAt: { pendingStart } }),
      closeStopAt: () => patch({ stopAt: null }),
      openEditStart: (sessionId, startedAt) => patch({ editStart: { sessionId, startedAt } }),
      closeEditStart: () => patch({ editStart: null }),
      setDiscard: (o) => patch({ discard: o }),
      openProject: (project, onCreated) => patch({ project: { project, onCreated } }),
      closeProject: () => patch({ project: null }),
      openTask: (task, onCreated) => patch({ task: { task, onCreated } }),
      closeTask: () => patch({ task: null }),
      setShortcuts: (o) => patch({ shortcuts: o }),
      setHelp: (o) => patch({ help: o }),
      setPalette: (o) => patch({ palette: o }),
      focusTaskInput: () => focusFn?.(),
      registerTaskInput: (fn) => setFocusFn(() => fn),
    }),
    [s, patch, focusFn],
  );
  return <UiCtx.Provider value={value}>{children}</UiCtx.Provider>;
}

export function useUi(): Ctx {
  const c = useContext(UiCtx);
  if (!c) throw new Error('UiProvider missing');
  return c;
}
