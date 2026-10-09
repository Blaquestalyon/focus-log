'use client';
/** A tiny in-page event bus: anything that changes sessions announces it, lists refetch. */
type Handler = (detail?: unknown) => void;
const handlers = new Map<string, Set<Handler>>();

export type AppEvent = 'sessions-changed' | 'tasks-changed' | 'projects-changed' | 'settings-changed' | 'data-changed';

export function emit(name: AppEvent, detail?: unknown) {
  handlers.get(name)?.forEach((h) => h(detail));
}

export function on(name: AppEvent, h: Handler): () => void {
  let set = handlers.get(name);
  if (!set) handlers.set(name, (set = new Set()));
  set.add(h);
  return () => set!.delete(h);
}
