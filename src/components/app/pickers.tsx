'use client';
/**
 * The task combobox and project picker shared by the Timer stage and the session dialog
 * (§4 Timer "Task bar").
 */
import { forwardRef, useEffect, useId, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, Folder, Plus, Search } from 'lucide-react';
import { cn } from '@/components/ui/cn';
import { ProjectDot } from '@/components/ui/brand';
import { Tip } from '@/components/ui/tooltip';
import { PopoverContent, PopoverRoot, PopoverTrigger } from '@/components/ui/popover';
import type { ProjectItem, TaskItem } from '@/lib/types';
import { useCatalog } from './catalog-context';
import { useUi } from './ui-context';

export const TASK_MAX = 80;

function Highlight({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <span className="font-semibold text-text-primary">{text.slice(i, i + q.length)}</span>
      {text.slice(i + q.length)}
    </>
  );
}

type Option = { kind: 'task'; task: TaskItem; section: 'Recent' | 'Matching tasks' } | { kind: 'new'; text: string };

export interface TaskComboboxHandle {
  focus: () => void;
  clear: () => void;
}

export interface TaskComboboxProps {
  text: string;
  onTextChange: (t: string) => void;
  /** The project new tasks are filed under (for the "as a new task" check). */
  projectId: string | null;
  /** Called with the chosen saved task, or null when the owner types freely. */
  selected: TaskItem | null;
  onSelect: (t: TaskItem | null) => void;
  /** Reports the highlighted saved task (or null) so the picker can follow it. */
  onHighlight?: (t: TaskItem | null) => void;
  /** Enter on a task option, a "new" option or free text. */
  onCommit: (choice: { task: TaskItem } | { text: string }) => void;
  placeholder: string;
  label: string;
  newLabel: (text: string) => string;
  excludeTaskId?: string | null;
  invalid?: boolean;
  describedBy?: string;
  id?: string;
  disabled?: boolean;
  /** Stage: Enter starts. Dialog: Enter only picks. */
  className?: string;
}

export const TaskCombobox = forwardRef<TaskComboboxHandle, TaskComboboxProps>(function TaskCombobox(p, ref) {
  const { tasks } = useCatalog();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const q = p.text.trim();

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    clear: () => {
      p.onTextChange('');
      p.onSelect(null);
      setOpen(false);
    },
  }));

  const activeTasks = useMemo(() => tasks.filter((t) => !t.archived), [tasks]);
  const byRecent = useMemo(
    () => [...activeTasks].sort((a, b) => (b.last_used_at ?? '').localeCompare(a.last_used_at ?? '') || a.name.localeCompare(b.name)),
    [activeTasks],
  );

  const options: Option[] = useMemo(() => {
    if (!q) {
      return byRecent
        .filter((t) => t.last_used_at && t.id !== p.excludeTaskId)
        .slice(0, 6)
        .map((task) => ({ kind: 'task', task, section: 'Recent' }));
    }
    const lq = q.toLowerCase();
    const matches: Option[] = byRecent
      .filter((t) => t.name.toLowerCase().includes(lq) || (t.project?.name ?? '').toLowerCase().includes(lq))
      .slice(0, 8)
      .map((task) => ({ kind: 'task', task, section: 'Matching tasks' }));
    const exists = activeTasks.some((t) => (t.project?.id ?? null) === p.projectId && t.name.toLowerCase() === lq);
    return exists ? matches : [...matches, { kind: 'new', text: q }];
  }, [q, byRecent, activeTasks, p.projectId, p.excludeTaskId]);

  useEffect(() => {
    setActive(-1);
  }, [q]);

  useEffect(() => {
    const o = active >= 0 ? options[active] : null;
    p.onHighlight?.(o?.kind === 'task' ? o.task : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, options]);

  const choose = (o: Option) => {
    if (o.kind === 'task') {
      p.onTextChange(o.task.name);
      p.onSelect(o.task);
      setOpen(false);
      p.onCommit({ task: o.task });
    } else {
      p.onSelect(null);
      setOpen(false);
      p.onCommit({ text: o.text });
    }
  };

  const showList = open && options.length > 0 && !p.disabled;
  const optId = (i: number) => `${listId}-o${i}`;
  let lastSection = '';

  return (
    <div className={cn('relative', p.className)}>
      <input
        ref={inputRef}
        id={p.id}
        role="combobox"
        aria-label={p.label}
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && active >= 0 ? optId(active) : undefined}
        aria-invalid={p.invalid || undefined}
        aria-describedby={p.describedBy}
        disabled={p.disabled}
        maxLength={TASK_MAX}
        value={p.text}
        placeholder={p.placeholder}
        autoComplete="off"
        spellCheck={false}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onChange={(e) => {
          p.onTextChange(e.target.value);
          if (p.selected && e.target.value !== p.selected.name) p.onSelect(null);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setActive((i) => (options.length ? (i + 1) % options.length : -1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setOpen(true);
            setActive((i) => (options.length ? (i <= 0 ? options.length - 1 : i - 1) : -1));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            if (showList && active >= 0 && options[active]) choose(options[active]);
            else if (p.selected && p.selected.name === p.text) p.onCommit({ task: p.selected });
            else if (q) p.onCommit({ text: q });
          } else if (e.key === 'Escape') {
            if (showList) {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
            } else if (p.text) {
              e.preventDefault();
              e.stopPropagation();
              p.onTextChange('');
              p.onSelect(null);
            }
          }
        }}
        className={cn(
          'h-11 w-full rounded-sm border border-border bg-surface-raised px-3 text-body text-text-primary placeholder:text-text-muted transition-fast hover:border-border-strong',
          'aria-[invalid=true]:border-danger-text disabled:cursor-not-allowed disabled:opacity-50',
        )}
      />
      {p.text.length >= 70 ? (
        <span className="tnum pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-micro text-text-muted" aria-live="polite">
          {p.text.length}/{TASK_MAX}
        </span>
      ) : null}
      <ul
        id={listId}
        role="listbox"
        aria-label={p.label}
        hidden={!showList}
        className="anim-menu absolute left-0 right-0 top-full z-[var(--z-dropdown)] mt-1 max-h-80 overflow-y-auto rounded-md border border-border bg-surface-raised p-1 shadow-overlay"
      >
        {options.map((o, i) => {
          const section = o.kind === 'task' ? o.section : '';
          const header = section && section !== lastSection ? section : '';
          lastSection = section || lastSection;
          return (
            <li key={o.kind === 'task' ? o.task.id : 'new'} role="presentation">
              {header ? <div className="micro-label px-2 pb-1 pt-2" role="presentation">{header}</div> : null}
              <div
                id={optId(i)}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(o)}
                className={cn(
                  'flex h-10 cursor-pointer items-center gap-2 rounded-sm px-2 text-sm',
                  i === active ? 'bg-surface-overlay' : '',
                )}
              >
                {o.kind === 'task' ? (
                  <>
                    <ProjectDot color={o.task.project?.color ?? null} />
                    <span className="min-w-0 flex-1 truncate text-text-secondary">
                      <Highlight text={o.task.name} q={q} />
                    </span>
                    <span className="max-w-[40%] truncate text-meta text-text-muted">{o.task.project?.name ?? 'No project'}</span>
                  </>
                ) : (
                  <>
                    <Plus className="size-4 text-text-secondary" aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-text-primary">{p.newLabel(o.text)}</span>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
});

/** Project picker: "No project" first, then active projects A–Z; search past 8; New project… */
export function ProjectPicker({
  value,
  onChange,
  disabled,
  disabledTip,
  size = 'lg',
  id,
  label = 'Project',
  className,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
  disabledTip?: ReactNode;
  size?: 'md' | 'lg';
  id?: string;
  label?: string;
  className?: string;
}) {
  const { projects } = useCatalog();
  const ui = useUi();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const active = useMemo(() => projects.filter((p) => !p.archived).sort((a, b) => a.name.localeCompare(b.name)), [projects]);
  const current = projects.find((p) => p.id === value) ?? null;
  const list = q ? active.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())) : active;

  const trigger = (
    <button
      type="button"
      id={id}
      aria-label={`${label}: ${current?.name ?? 'No project'}`}
      aria-disabled={disabled || undefined}
      onClick={(e) => {
        if (disabled) e.preventDefault();
      }}
      className={cn(
        'inline-flex max-w-full items-center gap-2 rounded-sm border border-border-strong bg-surface-raised px-3 text-sm text-text-primary transition-fast',
        size === 'lg' ? 'h-11' : 'h-10',
        disabled ? 'cursor-not-allowed opacity-40' : 'hover:bg-surface-overlay active:bg-surface',
        className,
      )}
    >
      {current ? <ProjectDot color={current.color} /> : <Folder className="size-4 text-text-secondary" aria-hidden />}
      <span className="truncate">{current?.name ?? 'No project'}</span>
    </button>
  );

  if (disabled) return <Tip label={disabledTip}>{trigger}</Tip>;

  const pick = (pid: string | null) => {
    onChange(pid);
    setOpen(false);
    setQ('');
  };

  return (
    <PopoverRoot open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        {active.length > 8 ? (
          <div className="relative mb-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-text-muted" aria-hidden />
            <input
              autoFocus
              aria-label="Search projects"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search projects"
              className="h-9 w-full rounded-sm border border-border bg-surface px-8 text-sm placeholder:text-text-muted"
            />
          </div>
        ) : null}
        <div role="listbox" aria-label="Projects" className="max-h-72 overflow-y-auto">
          <PickRow selected={value === null} onPick={() => pick(null)} icon={<Folder className="size-4 text-text-secondary" aria-hidden />}>
            No project
          </PickRow>
          {list.map((p: ProjectItem) => (
            <PickRow key={p.id} selected={value === p.id} onPick={() => pick(p.id)} icon={<ProjectDot color={p.color} />}>
              {p.name}
            </PickRow>
          ))}
        </div>
        <div className="mt-1 border-t border-border pt-1">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              ui.openProject(undefined, (created) => onChange(created.id));
            }}
            className="flex h-9 w-full items-center gap-2 rounded-sm px-2 text-sm text-text-primary transition-fast hover:bg-surface-overlay"
          >
            <Plus className="size-4 text-text-secondary" aria-hidden />
            New project…
          </button>
        </div>
      </PopoverContent>
    </PopoverRoot>
  );
}

function PickRow({ selected, onPick, icon, children }: { selected: boolean; onPick: () => void; icon: ReactNode; children: ReactNode }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onPick}
      className={cn(
        'flex h-9 w-full items-center gap-2 rounded-sm px-2 text-left text-sm transition-fast hover:bg-surface-overlay',
        selected ? 'text-accent-text' : 'text-text-primary',
      )}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {selected ? <Check className="size-4" aria-hidden /> : null}
    </button>
  );
}
