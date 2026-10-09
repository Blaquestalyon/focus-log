'use client';
/** Recent row (§4 Timer): up to 6 recently used active tasks, excluding the one on the clock. */
import { useMemo } from 'react';
import { Play } from 'lucide-react';
import { ProjectDot } from '@/components/ui/brand';
import { Tip } from '@/components/ui/tooltip';
import { useCatalog } from '@/components/app/catalog-context';
import { useTimer } from '@/components/app/timer-context';

export function RecentRow() {
  const { tasks } = useCatalog();
  const timer = useTimer();
  const onClock = timer.view?.task?.id ?? null;
  const recent = useMemo(
    () =>
      tasks
        .filter((t) => !t.archived && t.last_used_at && t.id !== onClock)
        .sort((a, b) => (b.last_used_at ?? '').localeCompare(a.last_used_at ?? ''))
        .slice(0, 6),
    [tasks, onClock],
  );
  if (!tasks.some((t) => !t.archived) || recent.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1" aria-label="Recent tasks" role="group">
      <span className="micro-label mr-1">Recent</span>
      {recent.map((t) => {
        const name = t.name.length > 24 ? `${t.name.slice(0, 23)}…` : t.name;
        return (
          <Tip key={t.id} label={`${t.name} · ${t.project?.name ?? 'No project'}`}>
            <button
              type="button"
              onClick={() => void timer.start({ task_id: t.id, label: t.name })}
              aria-label={`Start ${t.name}`}
              className="group inline-flex h-10 items-center"
            >
              <span className="inline-flex h-8 items-center gap-2 rounded-sm border border-border bg-surface px-3 text-sm text-text-secondary transition-fast group-hover:bg-surface-raised group-hover:text-text-primary group-active:bg-surface">
                <ProjectDot color={t.project?.color ?? null} />
                {name}
                <Play className="hidden size-3.5 group-hover:block group-focus-visible:block" aria-hidden />
              </span>
            </button>
          </Tip>
        );
      })}
    </div>
  );
}
