'use client';
/**
 * The Stage (§2 Signature moment 1, §4 Timer "The Stage"): a void framed by the gold badge rim,
 * a fixed starfield, the task bar, the clock with its flanks, the gold hairline and the controls.
 */
import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Clock as ClockIcon, Pause, Play, Square, Trash2 } from 'lucide-react';
import { Button, Kbd } from '@/components/ui/button';
import { MenuContent, MenuItem, MenuRoot, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { IconButton } from '@/components/ui/button';
import { MoreHorizontal } from 'lucide-react';
import { Skeleton, ErrorState } from '@/components/ui/feedback';
import { Starfield } from '@/components/ui/brand';
import { Tip } from '@/components/ui/tooltip';
import { cn } from '@/components/ui/cn';
import { useTimer, DAY_SECONDS } from '@/components/app/timer-context';
import { useUi } from '@/components/app/ui-context';
import { useSettings } from '@/components/app/settings-context';
import { useCatalog } from '@/components/app/catalog-context';
import { ProjectPicker, TaskCombobox, type TaskComboboxHandle } from '@/components/app/pickers';
import { durationWords, formatClock, formatStartedFlank, formatTime } from '@/lib/format';
import { useAlignedNow, useReducedMotion, safeLocal } from '@/lib/client/hooks';
import type { TaskItem } from '@/lib/types';

function Flank({ label, value, align = 'left' }: { label: string; value: string; align?: 'left' | 'right' }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1', align === 'right' ? 'md:items-end md:text-right' : '')}>
      <span className="micro-label">{label}</span>
      <span className="tnum truncate text-sm text-text-secondary">{value}</span>
    </div>
  );
}

const ClockDigits = forwardRef<HTMLDivElement, { text: string; state: 'idle' | 'running' | 'paused'; entering: boolean }>(function ClockDigits(
  { text, state, entering },
  ref,
) {
  const chars = text.split('');
  const render = (cls: string) => (
    <span className={cn('clock-layer block', cls)}>
      {chars.map((c, i) => (
        <span key={i} className="clock-digit" style={entering ? { animationDelay: `calc(var(--stagger-digit) * ${i})` } : undefined}>
          {c}
        </span>
      ))}
    </span>
  );
  return (
    <div ref={ref} className="clock" data-state={state} data-long={text.length >= 8 ? 'true' : 'false'} data-entering={entering ? 'true' : 'false'} aria-hidden>
      {render('clock-gold text-gold')}
      {render('clock-flat')}
    </div>
  );
});

export function Stage() {
  const timer = useTimer();
  const ui = useUi();
  const { tz, settings } = useSettings();
  const { projects } = useCatalog();
  const reduced = useReducedMotion();
  const v = timer.view;
  const status = v?.status ?? 'idle';
  const now = useAlignedNow(timer.serverNow, 1000, status !== 'idle');

  // ---- task bar state
  const [text, setText] = useState('');
  const [selected, setSelected] = useState<TaskItem | null>(null);
  const [highlight, setHighlight] = useState<TaskItem | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectTouched, setProjectTouched] = useState(false);
  const combo = useRef<TaskComboboxHandle>(null);

  useEffect(() => {
    if (projectTouched || !settings) return;
    const lp = projects.find((p) => p.id === settings.last_project_id && !p.archived)?.id ?? null;
    setProjectId(lp);
  }, [settings, projects, projectTouched]);

  useEffect(() => {
    ui.registerTaskInput(() => combo.current?.focus());
    return () => ui.registerTaskInput(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = highlight ?? selected;
  const pickerValue = shown ? shown.project?.id ?? null : projectId;

  /** Would the Start button start the paused task? (§4 Start button) */
  const resumesPaused = useMemo(() => {
    if (status !== 'paused' || !v?.task) return false;
    if (shown) return shown.id === v.task.id;
    const t = text.trim().toLowerCase();
    return Boolean(t) && t === v.task.name.toLowerCase() && (v.project?.id ?? null) === projectId;
  }, [status, v, shown, text, projectId]);

  const startLabel = status === 'running' ? 'Switch' : resumesPaused ? 'Resume' : 'Start';
  const empty = !text.trim() && !selected;

  const commit = async (choice?: { task: TaskItem } | { text: string }) => {
    const c = choice ?? (selected ? { task: selected } : text.trim() ? { text: text.trim() } : null);
    if (!c) return;
    const ok =
      'task' in c
        ? await timer.start({ task_id: c.task.id, label: c.task.name })
        : await timer.start({ task_name: c.text, project_id: projectId, label: c.text });
    if (!ok) return;
    safeLocal()?.setItem('fl-started-once', '1');
    window.dispatchEvent(new Event('fl-started'));
    setText('');
    setSelected(null);
    setHighlight(null);
  };

  // ---- digit entrance (30ms stagger, 180ms each) on every start/switch
  const [entering, setEntering] = useState(false);
  const firstSeq = useRef(timer.enterSeq);
  useEffect(() => {
    if (timer.enterSeq === firstSeq.current || reduced) return;
    setEntering(true);
    const t = setTimeout(() => setEntering(false), 30 * 8 + 180 + 50);
    return () => clearTimeout(t);
  }, [timer.enterSeq, reduced]);

  // ---- clock values
  const secs = timer.clockSeconds(now);
  const sessionSecs = timer.sessionSeconds(now);
  const over24 = status === 'running' && sessionSecs >= DAY_SECONDS;
  const [words, setWords] = useState('');
  const minute = Math.floor(secs / 60);
  useEffect(() => setWords(status === 'idle' ? '' : durationWords(secs)), [minute, status]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- starfield avoid zones and light-pool placement
  const stageRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const clockRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const [poolTop, setPoolTop] = useState<number | null>(null);
  useLayoutEffect(() => {
    const stage = stageRef.current;
    const clock = clockRef.current;
    if (!stage || !clock) return;
    const place = () => {
      const s = stage.getBoundingClientRect();
      const c = clock.getBoundingClientRect();
      const mid = c.top - s.top + c.height / 2 + 0.08 * s.height;
      setPoolTop(mid - (0.45 * s.height) / 2);
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(stage);
    ro.observe(clock);
    return () => ro.disconnect();
  }, [timer.loading]);

  if (timer.loading && !v) {
    return (
      <section aria-label="Timer" aria-busy className="stage flex flex-col gap-6">
        <Skeleton className="h-11 w-full" />
        <Skeleton style={{ width: 240, height: 20 }} />
        <Skeleton className="rounded-md" style={{ width: 'min(var(--size-clock-skeleton), 100%)', height: 'var(--text-clock)' }} />
        <div className="flex gap-2">
          <Skeleton className="h-11 w-28" />
          <Skeleton className="h-11 w-28" />
        </div>
      </section>
    );
  }
  if (!v && timer.error) {
    return (
      <section aria-label="Timer" className="stage">
        <ErrorState
          title="Couldn't reach your timer."
          body="Your time is safe on the server — this is just a connection problem."
          onRetry={() => void timer.refresh()}
        />
      </section>
    );
  }

  const paused = status === 'paused';
  const running = status === 'running';
  const runStart = v?.run?.started_at ?? v?.session?.started_at ?? null;
  const busy = timer.busy;

  return (
    <section ref={stageRef} aria-label="Timer" className="stage">
      <Starfield
        count={10}
        seed={8_102_026}
        minSize={5}
        maxSize={12}
        minOpacity={0.04}
        maxOpacity={0.08}
        avoid={[barRef, clockRef, controlsRef]}
        containerRef={stageRef}
      />
      <div aria-hidden className="light-pool" data-on={running ? 'true' : 'false'} style={poolTop !== null ? { top: poolTop } : undefined} />

      <div className="stage-layer flex flex-col">
        {/* Task bar */}
        <div ref={barRef} className="flex flex-col gap-2 md:flex-row md:items-stretch">
          <TaskCombobox
            ref={combo}
            className="min-w-0 flex-1"
            text={text}
            onTextChange={setText}
            selected={selected}
            onSelect={setSelected}
            onHighlight={setHighlight}
            projectId={projectId}
            onCommit={(c) => void commit(c)}
            placeholder={running ? 'Switch to another task…' : 'What are you working on?'}
            label="What are you working on?"
            newLabel={(t) => `Start “${t}” as a new task`}
          />
          <div className="flex items-stretch gap-2">
            <ProjectPicker
              value={pickerValue}
              onChange={(id) => {
                setProjectTouched(true);
                setProjectId(id);
              }}
              disabled={Boolean(shown)}
              disabledTip={shown ? `This task belongs to ${shown.project?.name ?? 'No project'}. Change it in Your data.` : undefined}
              className="min-w-0 flex-1 md:flex-none md:max-w-56"
            />
            <div className="flex items-stretch gap-1">
              <Button
                variant="primary"
                size="lg"
                disabled={empty}
                loading={busy === 'start'}
                tip={empty ? 'Type a task or pick one below' : undefined}
                onClick={() => void commit()}
              >
                {startLabel}
              </Button>
              <span aria-hidden className="inline-flex size-11 items-center justify-center rounded-sm border border-border bg-surface-raised font-mono text-micro text-text-secondary">
                ⏎
              </span>
            </div>
          </div>
        </div>

        {/* Task line */}
        <div className="mt-8 flex min-h-7 items-center gap-3">
          {status === 'idle' ? (
            <p className="text-body text-text-muted">Ready when you are.</p>
          ) : (
            <>
              <span className="onair" data-paused={paused ? 'true' : 'false'} aria-hidden />
              <Tip label={v?.task?.name}>
                <h2 tabIndex={0} className="section-heading min-w-0 truncate text-text-primary">
                  {v?.task?.name}
                </h2>
              </Tip>
              <span className="sr-only">{paused ? '(paused)' : '(running)'}</span>
            </>
          )}
        </div>

        {/* Clock + flanks */}
        <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:gap-8">
          {status !== 'idle' ? (
            <div className="order-2 md:order-1 md:w-40 md:shrink-0">
              <Flank label={v?.project ? 'Project' : 'No project'} value={v?.project?.name ?? '—'} />
            </div>
          ) : null}
          <div className="order-1 min-w-0 md:order-2">
            <ClockDigits ref={clockRef} text={status === 'idle' ? '0:00:00' : formatClock(secs)} state={status} entering={entering} />
            <div role="timer" aria-live="off" className="sr-only">
              {words}
            </div>
          </div>
          {status !== 'idle' ? (
            <div className="order-3 md:ml-auto md:w-44 md:shrink-0">
              {paused && v?.paused_at ? (
                <Flank label="Paused" value={formatTime(v.paused_at, tz)} align="right" />
              ) : runStart ? (
                <Flank label="Started" value={formatStartedFlank(runStart, tz, now)} align="right" />
              ) : null}
            </div>
          ) : null}
        </div>
        {/* Left-aligned with the clock's first digit: on md+ the left flank (w-40) and the row gap (gap-8) sit before it. */}
        <div className={cn('hairline-gold', status !== 'idle' && 'md:ml-48')} aria-hidden />

        {/* Controls */}
        {status !== 'idle' ? (
          <div ref={controlsRef} className="mt-6 flex flex-wrap items-center gap-2">
            {running ? (
              <>
                <Button size="lg" variant="secondary" icon={<Pause className="size-4" aria-hidden />} loading={busy === 'pause'} onClick={() => void timer.pause()} iconRight={<Kbd className="ml-1">P</Kbd>}>
                  Pause
                </Button>
                <Button size="lg" variant="primary" icon={<Square className="size-4" aria-hidden />} loading={busy === 'stop'} onClick={() => void timer.stop()} iconRight={<Kbd className="ml-1 border-on-accent text-on-accent">S</Kbd>}>
                  Stop
                </Button>
              </>
            ) : (
              <>
                <Button size="lg" variant="primary" icon={<Play className="size-4" aria-hidden />} loading={busy === 'resume'} onClick={() => void timer.resume()} iconRight={<Kbd className="ml-1 border-on-accent text-on-accent">P</Kbd>}>
                  Resume
                </Button>
                <Button size="lg" variant="secondary" icon={<Square className="size-4" aria-hidden />} loading={busy === 'stop'} onClick={() => void timer.stop()} iconRight={<Kbd className="ml-1">S</Kbd>}>
                  Stop
                </Button>
              </>
            )}
            <MenuRoot modal={false}>
              <MenuTrigger asChild>
                <IconButton label="More timer options" className="size-11">
                  <MoreHorizontal className="size-4" aria-hidden />
                </IconButton>
              </MenuTrigger>
              <MenuContent align="start">
                {running && v?.session ? (
                  <>
                    <MenuItem icon={<ClockIcon className="size-4" />} onSelect={() => ui.openEditStart(v.session!.id, v.session!.started_at)}>
                      Edit start time…
                    </MenuItem>
                    <MenuItem icon={<Square className="size-4" />} onSelect={() => ui.openStopAt()}>
                      Stop at…
                    </MenuItem>
                    <MenuSeparator />
                  </>
                ) : null}
                <MenuItem danger icon={<Trash2 className="size-4" />} onSelect={() => ui.setDiscard(true)}>
                  Discard timer
                </MenuItem>
              </MenuContent>
            </MenuRoot>
            {over24 ? (
              <p className="w-full text-meta text-text-secondary">This timer has run for over 24 hours. Pick when you actually stopped.</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
