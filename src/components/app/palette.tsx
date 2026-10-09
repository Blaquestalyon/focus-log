'use client';
/**
 * ⌘K command palette (§4 "Command palette"): the only frosted surface. Groups of at most 8
 * fuzzy-matched results; Enter runs and closes; Esc closes.
 */
import { useRouter } from 'next/navigation';
import { useMemo, useState, type ReactNode } from 'react';
import * as D from '@radix-ui/react-dialog';
import { Command } from 'cmdk';
import { CornerDownLeft, Plus } from 'lucide-react';
import { toast } from '@/lib/client/toast';
import { useUi } from './ui-context';
import { useTimer } from './timer-context';
import { useCatalog } from './catalog-context';
import { useSettings } from './settings-context';
import { signOut, NAV } from './shell';
import { ProjectDot } from '@/components/ui/brand';
import { download, messageOf } from '@/lib/client/api';
import { addDays, mondayOf, todayStr } from '@/lib/time';

/** Subsequence fuzzy score; -1 when not a match. */
export function fuzzyScore(text: string, q: string): number {
  if (!q) return 0;
  const t = text.toLowerCase();
  const s = q.toLowerCase().trim();
  if (!s) return 0;
  const idx = t.indexOf(s);
  if (idx >= 0) return 1000 - idx;
  let ti = 0;
  let score = 0;
  for (const ch of s) {
    const found = t.indexOf(ch, ti);
    if (found < 0) return -1;
    score += found === ti ? 2 : 1;
    ti = found + 1;
  }
  return score;
}

const GROUP =
  '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-micro [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.08em] [&_[cmdk-group-heading]]:text-text-muted';

interface Item { id: string; label: string; hint?: ReactNode; icon?: ReactNode; keywords?: string; run: () => void }

export function CommandPalette() {
  const ui = useUi();
  const router = useRouter();
  const timer = useTimer();
  const { tasks, projects } = useCatalog();
  const { settings, tz } = useSettings();
  const [q, setQ] = useState('');

  const close = () => {
    ui.setPalette(false);
    setQ('');
  };
  const run = (fn: () => void) => () => {
    close();
    fn();
  };

  const v = timer.view;
  const defaultProject = projects.find((p) => p.id === settings?.last_project_id && !p.archived)?.id ?? null;

  const groups = useMemo(() => {
    const timerItems: Item[] = [];
    if (v?.status === 'running') {
      timerItems.push({ id: 'pause', label: 'Pause', run: run(() => void timer.pause()) });
      timerItems.push({ id: 'stop', label: 'Stop', run: run(() => void timer.stop()) });
      timerItems.push({ id: 'stopat', label: 'Stop at…', run: run(() => ui.openStopAt()) });
      timerItems.push({ id: 'discard', label: 'Discard timer', run: run(() => ui.setDiscard(true)) });
    } else if (v?.status === 'paused') {
      timerItems.push({ id: 'resume', label: 'Resume', run: run(() => void timer.resume()) });
      timerItems.push({ id: 'stop', label: 'Stop', run: run(() => void timer.stop()) });
      timerItems.push({ id: 'discard', label: 'Discard timer', run: run(() => ui.setDiscard(true)) });
    }
    const taskItems: Item[] = tasks
      .filter((t) => !t.archived)
      .map((t) => ({
        id: `task-${t.id}`,
        label: t.name,
        keywords: t.project?.name ?? 'No project',
        icon: <ProjectDot color={t.project?.color ?? null} />,
        hint: <span className="truncate text-meta text-text-muted">{t.project?.name ?? 'No project'}</span>,
        run: run(() => void timer.start({ task_id: t.id, label: t.name })),
      }));
    const navItems: Item[] = NAV.map((n) => ({ id: `go-${n.href}`, label: n.label, keywords: 'go to', run: run(() => router.push(n.href)) }));
    const actionItems: Item[] = [
      { id: 'add', label: 'Add time', run: run(() => ui.openAddTime({ date: todayStr(tz) })) },
      { id: 'newproject', label: 'New project', run: run(() => ui.openProject()) },
      { id: 'newtask', label: 'New task', run: run(() => ui.openTask()) },
      {
        id: 'export',
        label: 'Export this week (CSV)',
        run: run(() => {
          const mon = mondayOf(todayStr(tz));
          download(`/api/export.csv?range=custom&from=${mon}&to=${addDays(mon, 6)}`).catch((e) => toast.error(messageOf(e)));
        }),
      },
      { id: 'shortcuts', label: 'Keyboard shortcuts', run: run(() => ui.setShortcuts(true)) },
      { id: 'signout', label: 'Sign out', run: run(() => void signOut('local')) },
    ];
    return { timerItems, taskItems, navItems, actionItems };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v?.status, tasks, tz, router]);

  const filter = (items: Item[], keepOrder = false) => {
    if (!q.trim()) return items.slice(0, 8);
    const scored = items
      .map((i) => ({ i, s: Math.max(fuzzyScore(i.label, q), i.keywords ? fuzzyScore(i.keywords, q) - 500 : -1) }))
      .filter((x) => x.s >= 0);
    if (!keepOrder) scored.sort((a, b) => b.s - a.s);
    return scored.slice(0, 8).map((x) => x.i);
  };

  const typed = q.trim();
  const timerItems = filter(groups.timerItems);
  const taskItems = filter(groups.taskItems, true);
  const navItems = filter(groups.navItems);
  const actionItems = filter(groups.actionItems);
  const exact = tasks.some((t) => !t.archived && t.name.toLowerCase() === typed.toLowerCase());
  const nothing = typed && !timerItems.length && !taskItems.length && !navItems.length && !actionItems.length;
  const startNew = () => run(() => void timer.start({ task_name: typed, project_id: defaultProject, label: typed }))();

  const renderItem = (i: Item) => (
    <Command.Item
      key={i.id}
      value={i.id}
      onSelect={i.run}
      className="group flex h-10 cursor-pointer items-center gap-3 rounded-sm px-3 text-sm text-text-primary data-[selected=true]:bg-surface-raised"
    >
      {i.icon}
      <span className="min-w-0 flex-1 truncate">{i.label}</span>
      {i.hint}
      <kbd className="kbd hidden border-accent-subtle-border text-accent-text group-data-[selected=true]:inline-flex" aria-hidden>
        <CornerDownLeft className="size-3" />
      </kbd>
    </Command.Item>
  );

  return (
    <D.Root open={ui.palette} onOpenChange={(o) => (o ? ui.setPalette(true) : close())}>
      <D.Portal>
        <D.Overlay className="anim-backdrop fixed inset-0 z-[var(--z-palette)] bg-backdrop" />
        <D.Content
          aria-describedby={undefined}
          className="anim-palette palette-top palette-glass z-[var(--z-palette)] w-[calc(100vw-2rem)] max-w-[var(--size-palette)] overflow-hidden rounded-md border border-border shadow-overlay"
        >
          <D.Title className="sr-only">Command palette</D.Title>
          <Command shouldFilter={false} loop label="Command palette">
            <div className="border-b border-border">
              <Command.Input
                value={q}
                onValueChange={setQ}
                placeholder="Type a command or a task to start…"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && nothing) {
                    e.preventDefault();
                    startNew();
                  }
                }}
                className="h-12 w-full bg-transparent px-4 text-body text-text-primary outline-none placeholder:text-text-muted"
              />
            </div>
            <Command.List className="max-h-[60vh] overflow-y-auto p-1">
              {nothing ? (
                <div className="px-4 py-8 text-center">
                  <p className="mx-auto text-sm text-text-primary">Nothing matches &ldquo;{typed}&rdquo;.</p>
                  <p className="mx-auto mt-1 text-meta text-text-muted">Press Enter to start it as a new task.</p>
                </div>
              ) : null}
              {timerItems.length ? (
                <Command.Group heading="Timer" className={GROUP}>
                  {timerItems.map(renderItem)}
                </Command.Group>
              ) : null}
              {taskItems.length || (typed && !exact && !nothing) ? (
                <Command.Group heading="Start a task" className={GROUP}>
                  {taskItems.map(renderItem)}
                  {typed && !exact
                    ? renderItem({
                        id: 'start-new',
                        label: `Start “${typed}” as a new task`,
                        icon: <Plus className="size-4 text-text-secondary" aria-hidden />,
                        run: startNew,
                      })
                    : null}
                </Command.Group>
              ) : null}
              {navItems.length ? (
                <Command.Group heading="Go to" className={GROUP}>
                  {navItems.map(renderItem)}
                </Command.Group>
              ) : null}
              {actionItems.length ? (
                <Command.Group heading="Actions" className={GROUP}>
                  {actionItems.map(renderItem)}
                </Command.Group>
              ) : null}
            </Command.List>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
