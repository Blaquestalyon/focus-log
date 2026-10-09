'use client';
/** Settings (§4 "Screen: Settings", F17, F21). Saves on change with a 2-second "Saved". */
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { BellOff, Check, ChevronDown, Monitor, Smartphone, Trash2 } from 'lucide-react';
import { PageHeader, signOut } from '@/components/app/shell';
import { Button, IconButton } from '@/components/ui/button';
import { Field, Input, Select, Switch } from '@/components/ui/form';
import { EmptyState, ErrorState, Skeleton, Tag } from '@/components/ui/feedback';
import { ConfirmDialog } from '@/components/ui/dialog';
import { PopoverContent, PopoverRoot, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/components/ui/cn';
import { useSettings } from '@/components/app/settings-context';
import { useTimer } from '@/components/app/timer-context';
import { useDataSummary } from '@/components/app/notices';
import { sendTestEmail } from '@/components/data/data-screen';
import { PasswordInput } from '@/components/auth/password-input';
import { api, ApiError, download, messageOf } from '@/lib/client/api';
import { emit } from '@/lib/client/events';
import { toast } from '@/lib/client/toast';
import { allowAlerts, currentEndpoint, currentSubscription, permission, pushSupport, unsubscribeThisBrowser } from '@/lib/client/push';
import { formatAgo, formatDateTime, formatDuration, formatMonthDay, formatThreshold } from '@/lib/format';
import { browserTimeZone, supportedTimeZones, utcOffsetLabel } from '@/lib/time';
import { isMobileLabel } from '@/lib/push-label';
import type { PushSubscriptionsResponse, Settings, StatusResponse } from '@/lib/types';

function Card({ title, id, children, danger }: { title: string; id?: string; children: ReactNode; danger?: boolean }) {
  return (
    <section
      id={id}
      aria-labelledby={`${id ?? title}-h`}
      className={cn('scroll-mt-8 rounded-md border bg-surface p-6', danger ? 'border-danger/40' : 'border-border')}
    >
      <h2 id={`${id ?? title}-h`} className="section-heading mb-4 text-text-primary">
        {title}
      </h2>
      {children}
    </section>
  );
}

function SavedMark({ at }: { at: number }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!at) return;
    setShow(true);
    const t = setTimeout(() => setShow(false), 2000);
    return () => clearTimeout(t);
  }, [at]);
  return (
    <span aria-live="polite" className={cn('inline-flex items-center gap-1 text-meta text-text-muted transition-fast', show ? 'opacity-100' : 'opacity-0')}>
      {show ? (
        <>
          <Check className="size-3.5" aria-hidden /> Saved
        </>
      ) : null}
    </span>
  );
}

/** Save a settings field and flash "Saved" next to it. */
function useSave() {
  const { update } = useSettings();
  const [saved, setSaved] = useState<Record<string, number>>({});
  const save = useCallback(
    async (key: string, patch: Partial<Settings>) => {
      if (await update(patch)) setSaved((s) => ({ ...s, [key]: Date.now() }));
    },
    [update],
  );
  return { save, saved };
}

export function SettingsScreen() {
  const { settings, error, reload } = useSettings();
  useEffect(() => {
    if (window.location.hash === '#status' && settings) document.getElementById('status')?.scrollIntoView();
  }, [settings]);

  if (!settings && error) {
    return (
      <>
        <PageHeader title="Settings" />
        <div className="rounded-md border border-border bg-surface">
          <ErrorState title="Couldn't load your settings." onRetry={() => void reload()} />
        </div>
      </>
    );
  }
  if (!settings) {
    return (
      <>
        <PageHeader title="Settings" />
        <div aria-busy className="flex flex-col gap-6">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="rounded-md border border-border bg-surface p-6">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="mt-4 h-10 w-full max-w-md" />
              <Skeleton className="mt-3 h-3 w-64" />
            </div>
          ))}
        </div>
      </>
    );
  }
  return (
    <>
      <PageHeader title="Settings" />
      <div className="flex flex-col gap-6">
        <TimeZoneCard settings={settings} />
        <RemindersCard settings={settings} />
        <WeeklyCard settings={settings} />
        <AccountCard settings={settings} />
        <StatusCard />
        <DangerCard />
      </div>
    </>
  );
}

// ------------------------------------------------------------------ time zone
function TimeZoneCard({ settings }: { settings: Settings }) {
  const { save, saved } = useSave();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [browserZone, setBrowserZone] = useState('');
  useEffect(() => setBrowserZone(browserTimeZone()), []);
  const zones = useMemo(() => supportedTimeZones().map((z) => ({ z, label: `${z} — ${utcOffsetLabel(z)}` })), []);
  const list = q ? zones.filter((x) => x.label.toLowerCase().includes(q.toLowerCase())) : zones;
  const current = zones.find((x) => x.z === settings.time_zone)?.label ?? settings.time_zone;
  return (
    <Card title="Time zone">
      <div className="flex flex-wrap items-center gap-3">
        <PopoverRoot open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`Time zone: ${current}`}
              className="inline-flex h-10 w-full max-w-md items-center justify-between gap-2 rounded-sm border border-border bg-surface-raised px-3 text-left text-sm text-text-primary transition-fast hover:border-border-strong"
            >
              <span className="truncate">{current}</span>
              <ChevronDown className="size-4 text-text-muted" aria-hidden />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[min(28rem,calc(100vw-2rem))] p-2" align="start">
            <Input autoFocus aria-label="Search time zones" placeholder="Search time zones" value={q} onChange={(e) => setQ(e.target.value)} />
            <div role="listbox" aria-label="Time zones" className="mt-2 max-h-72 overflow-y-auto">
              {list.slice(0, 400).map((x) => (
                <button
                  key={x.z}
                  type="button"
                  role="option"
                  aria-selected={x.z === settings.time_zone}
                  onClick={() => {
                    setOpen(false);
                    setQ('');
                    void save('tz', { time_zone: x.z, time_zone_confirmed: true });
                  }}
                  className={cn(
                    'flex h-9 w-full items-center rounded-sm px-2 text-left text-sm transition-fast hover:bg-surface-overlay',
                    x.z === settings.time_zone ? 'text-accent-text' : 'text-text-primary',
                  )}
                >
                  <span className="tnum truncate">{x.label}</span>
                </button>
              ))}
            </div>
          </PopoverContent>
        </PopoverRoot>
        <SavedMark at={saved.tz ?? 0} />
      </div>
      {browserZone && browserZone !== settings.time_zone ? (
        <Button variant="ghost" className="mt-2 -ml-2" onClick={() => void save('tz', { time_zone: browserZone, time_zone_confirmed: true })}>
          Use this computer&apos;s time zone ({browserZone})
        </Button>
      ) : null}
      <p className="mt-2 text-meta text-text-muted">Used for Today, weekly and monthly totals, and when the Monday email arrives.</p>
    </Card>
  );
}

// ------------------------------------------------------------------ reminders
const THRESHOLDS = Array.from({ length: 24 }, (_, i) => (i + 1) * 30);

type Readout = 'on' | 'default' | 'lost' | 'blocked' | 'ios' | 'unsupported';

function RemindersCard({ settings }: { settings: Settings }) {
  const { save, saved } = useSave();
  const [cfg, setCfg] = useState<PushSubscriptionsResponse | null>(null);
  const [cfgError, setCfgError] = useState(false);
  const [readout, setReadout] = useState<Readout | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [remove, setRemove] = useState<PushSubscriptionsResponse['browsers'][number] | null>(null);
  const { tz } = useSettings();

  const load = useCallback(async () => {
    const endpoint = await currentEndpoint();
    try {
      const r = await api<PushSubscriptionsResponse>('/api/push/subscriptions', { headers: endpoint ? { 'X-Push-Endpoint': endpoint } : {} });
      setCfg(r);
      setCfgError(false);
    } catch {
      setCfgError(true);
    }
    const s = pushSupport();
    if (s.iosTab) setReadout('ios');
    else if (!s.canPush) setReadout('unsupported');
    else {
      const p = permission();
      if (p === 'denied') setReadout('blocked');
      else if (p === 'default') setReadout('default');
      else setReadout((await currentSubscription()) ? 'on' : 'lost');
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const notConfigured = cfg ? !cfg.configured : false;
  const allow = async () => {
    setBusy('allow');
    try {
      const r = await allowAlerts(cfg?.public_key ?? null);
      if (r === 'on') toast.success('Pop-up alerts are on for this browser.');
      else if (r === 'blocked') toast.error("Alerts are blocked. You'll still get the reminder email.");
      else if (r === 'failed') toast.error("This browser couldn't turn on pop-ups. You'll still get the reminder email.");
      try {
        localStorage.setItem('fl-notify-prompt-dismissed', '1');
      } catch {
        /* ignore */
      }
    } finally {
      setBusy(null);
      void load();
    }
  };
  const test = async () => {
    setBusy('test');
    try {
      const endpoint = await currentEndpoint();
      await api('/api/push/test', { method: 'POST', body: {}, headers: endpoint ? { 'X-Push-Endpoint': endpoint } : {} });
      toast.success('Test alert sent. If nothing appeared, check Do Not Disturb or Focus Assist.');
    } catch (e) {
      toast.error(e instanceof ApiError && e.status === 503 ? "Pop-up alerts aren't set up yet." : messageOf(e));
    } finally {
      setBusy(null);
      void load();
    }
  };

  const unsetTip = notConfigured ? "Pop-up alerts aren't set up yet" : undefined;
  const readoutText: Record<Readout, ReactNode> = {
    on: (
      <>
        <span>This browser shows pop-up alerts, even with Focus Log closed.</span>
        <Button variant="secondary" loading={busy === 'test'} disabled={notConfigured} tip={unsetTip} onClick={test}>
          Send a test alert
        </Button>
      </>
    ),
    default: (
      <>
        <span>Pop-ups aren&apos;t on for this browser yet.</span>
        <Button variant="secondary" loading={busy === 'allow'} disabled={notConfigured} tip={unsetTip} onClick={allow}>
          Allow alerts
        </Button>
      </>
    ),
    lost: (
      <>
        <span>This browser stopped receiving alerts.</span>
        <Button variant="secondary" loading={busy === 'allow'} disabled={notConfigured} tip={unsetTip} onClick={allow}>
          Turn alerts back on
        </Button>
      </>
    ),
    blocked: <span>Alerts are blocked in this browser. Allow them in your browser&apos;s site settings, then reload.</span>,
    ios: (
      <span>
        On iPhone and iPad, pop-ups only work from the Home Screen. Tap Share, then Add to Home Screen, open Focus Log from that icon, and allow alerts here.
      </span>
    ),
    unsupported: <span>This browser can&apos;t show pop-up alerts. The reminder email still arrives.</span>,
  };
  const canAllowHere = readout === 'default' || readout === 'lost';

  return (
    <Card title="Reminders">
      <div className="flex flex-col gap-5">
        <Field label="Remind me when a timer runs longer than">
          {({ id }) => (
            <div className="flex items-center gap-3">
              <Select
                id={id}
                className="max-w-xs"
                value={String(settings.nudge_after_minutes)}
                onValueChange={(v) => void save('threshold', { nudge_after_minutes: Number(v) })}
                options={THRESHOLDS.map((m) => ({ value: String(m), label: formatThreshold(m) }))}
              />
              <SavedMark at={saved.threshold ?? 0} />
            </div>
          )}
        </Field>
        <label className="flex min-h-10 cursor-pointer items-center gap-3 text-sm text-text-primary">
          <Switch checked={settings.nudge_email_enabled} onCheckedChange={(v) => void save('email', { nudge_email_enabled: v })} />
          Email me a reminder
          <SavedMark at={saved.email ?? 0} />
        </label>
        <div>
          <label className="flex min-h-10 cursor-pointer items-center gap-3 text-sm text-text-primary">
            <Switch checked={settings.nudge_browser_enabled} onCheckedChange={(v) => void save('browser', { nudge_browser_enabled: v })} />
            Show a browser alert
            <SavedMark at={saved.browser ?? 0} />
          </label>
          <p className="mt-1 text-meta text-text-muted">A pop-up on every browser you allow below, even with Focus Log closed, as long as the browser is open.</p>
        </div>

        <div className="rounded-md border border-border bg-surface-raised p-4">
          <div className="micro-label mb-2">This browser</div>
          {readout ? (
            <div className="flex flex-col gap-3 text-sm text-text-secondary sm:flex-row sm:items-center sm:justify-between">{readoutText[readout]}</div>
          ) : (
            <Skeleton className="h-4 w-64" />
          )}
          {notConfigured ? <p className="mt-2 text-meta text-text-muted">Pop-up alerts aren&apos;t set up yet.</p> : null}
        </div>

        <div>
          <div className="micro-label mb-2">Allowed browsers</div>
          {cfgError && !cfg ? (
            <ErrorState className="py-6" title="Couldn't load your data." onRetry={() => void load()} />
          ) : !cfg ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
            </div>
          ) : cfg.browsers.length === 0 ? (
            <EmptyState
              className="py-6"
              icon={<BellOff className="size-10" strokeWidth={1.5} aria-hidden />}
              title="No browsers allowed yet."
              body="Allow alerts on each computer where you want a pop-up."
              actions={
                canAllowHere ? (
                  <Button variant="secondary" loading={busy === 'allow'} disabled={notConfigured} tip={unsetTip} onClick={allow}>
                    Allow alerts on this browser
                  </Button>
                ) : null
              }
            />
          ) : (
            <ul className="rounded-md border border-border">
              {cfg.browsers.map((b) => {
                const Icon = isMobileLabel(b.label) ? Smartphone : Monitor;
                return (
                  <li key={b.id} className="flex min-h-11 items-center gap-3 border-b border-border px-3 py-2 last:border-b-0">
                    <Icon className="size-4 shrink-0 text-text-secondary" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm text-text-primary">{b.label}</span>
                        {b.is_this_browser ? <Tag>This browser</Tag> : null}
                      </div>
                      <div className="tnum text-meta text-text-muted">
                        Last seen {formatMonthDay(b.last_seen_at, tz)} · {b.last_success_at ? `Last alert ${formatDateTime(b.last_success_at, tz)}` : 'No alerts yet'}
                      </div>
                      {b.error_human ? <div className="text-meta text-danger-text">{b.error_human}</div> : null}
                    </div>
                    <IconButton label="Remove this browser" onClick={() => setRemove(b)}>
                      <Trash2 className="size-4" aria-hidden />
                    </IconButton>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="flex flex-col gap-1 text-meta text-text-muted">
          <p>The in-page banner and the flashing tab title always appear while Focus Log is open.</p>
          <p>Do Not Disturb, Windows Focus Assist and full-screen apps can hide pop-ups even when they&apos;re sent. The reminder email always goes out too.</p>
        </div>
      </div>
      <ConfirmDialog
        open={Boolean(remove)}
        onOpenChange={(o) => !o && setRemove(null)}
        title={`Remove ${remove?.label ?? ''}?`}
        description={
          remove?.is_this_browser
            ? 'This browser stops getting pop-up alerts until you allow them again.'
            : 'It stops getting pop-up alerts now. If you open Focus Log in that browser again, it signs back up — to stop it for good, remove it while using that browser, or block alerts there.'
        }
        confirmLabel="Remove browser"
        onConfirm={async () => {
          if (!remove) return;
          try {
            await api(`/api/push/subscriptions/${remove.id}`, { method: 'DELETE' });
            if (remove.is_this_browser) await unsubscribeThisBrowser();
            toast.success(`Removed ${remove.label}.`);
            void load();
          } catch (e) {
            toast.error(messageOf(e));
            return false;
          }
        }}
      />
    </Card>
  );
}

// --------------------------------------------------------------------- weekly
function WeeklyCard({ settings }: { settings: Settings }) {
  const { save, saved } = useSave();
  const [busy, setBusy] = useState(false);
  return (
    <Card title="Weekly summary">
      <label className="flex min-h-10 cursor-pointer items-center gap-3 text-sm text-text-primary">
        <Switch checked={settings.weekly_email_enabled} onCheckedChange={(v) => void save('weekly', { weekly_email_enabled: v })} />
        Email me my week every Monday at 8:00 AM
        <SavedMark at={saved.weekly ?? 0} />
      </label>
      <p className="mt-1 text-meta text-text-muted">Skipped automatically when you logged nothing that week.</p>
      <Button
        variant="secondary"
        className="mt-4"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          await sendTestEmail();
          setBusy(false);
        }}
      >
        Send a test email
      </Button>
    </Card>
  );
}

// -------------------------------------------------------------------- account
function AccountCard({ settings }: { settings: Settings }) {
  const [cur, setCur] = useState('');
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false);
  const [everywhere, setEverywhere] = useState(false);
  const refs = { cur: useRef<HTMLInputElement>(null), pw: useRef<HTMLInputElement>(null), confirm: useRef<HTMLInputElement>(null) };
  const pwErr = (p: string) =>
    p.length < 10 ? 'Use at least 10 characters.' : p.length > 72 ? 'Use 72 characters or fewer.' : p.toLowerCase() === settings.email.toLowerCase() ? 'Pick something other than your email address.' : null;

  const submit = async () => {
    const e = { cur: cur ? null : 'Enter your current password.', pw: pwErr(pw), confirm: confirm === pw ? null : "The two passwords don't match." };
    setErrors(e);
    const first = (['cur', 'pw', 'confirm'] as const).find((k) => e[k]);
    if (first) return refs[first].current?.focus();
    setBusy(true);
    try {
      await api('/api/account/password', { method: 'POST', body: { current_password: cur, new_password: pw } });
      toast.success('Password changed.');
      setCur('');
      setPw('');
      setConfirm('');
      setErrors({});
    } catch (err) {
      if (err instanceof ApiError && err.code === 'WRONG_PASSWORD') setErrors({ cur: err.message });
      else if (err instanceof ApiError && err.field === 'new_password') setErrors({ pw: err.message });
      else toast.error(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Account">
      <Field label="Email" className="max-w-md">
        {({ id }) => <Input id={id} value={settings.email} readOnly aria-readonly className="text-text-secondary" />}
      </Field>
      <form
        noValidate
        className="mt-6 flex max-w-md flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <h3 className="card-heading text-text-primary">Change password</h3>
        <Field label="Current password" error={errors.cur}>
          {({ id, describedBy, invalid }) => (
            <PasswordInput ref={refs.cur} id={id} autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} invalid={invalid} aria-describedby={describedBy} />
          )}
        </Field>
        <Field label="New password" error={errors.pw} hint="At least 10 characters. A short phrase works well.">
          {({ id, describedBy, invalid }) => (
            <PasswordInput
              ref={refs.pw}
              id={id}
              autoComplete="new-password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              onBlur={() => pw && setErrors((x) => ({ ...x, pw: pwErr(pw) }))}
              invalid={invalid}
              aria-describedby={describedBy}
            />
          )}
        </Field>
        <Field label="Confirm new password" error={errors.confirm}>
          {({ id, describedBy, invalid }) => (
            <PasswordInput
              ref={refs.confirm}
              id={id}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onBlur={() => confirm && setErrors((x) => ({ ...x, confirm: confirm === pw ? null : "The two passwords don't match." }))}
              invalid={invalid}
              aria-describedby={describedBy}
            />
          )}
        </Field>
        <div>
          <Button type="submit" variant="primary" loading={busy}>
            Change password
          </Button>
        </div>
      </form>
      <div className="mt-6 border-t border-border pt-6">
        <Button variant="secondary" onClick={() => setEverywhere(true)}>
          Sign out everywhere
        </Button>
      </div>
      <ConfirmDialog
        open={everywhere}
        onOpenChange={setEverywhere}
        title="Sign out on every device?"
        description="You'll need your password to sign back in on each one. Your timer keeps running."
        confirmLabel="Sign out everywhere"
        onConfirm={async () => {
          await signOut('global');
        }}
      />
    </Card>
  );
}

// --------------------------------------------------------------------- status
type Level = 'ok' | 'warning' | 'problem' | 'off';
const DOT: Record<Level, string> = { ok: 'bg-success', warning: 'bg-warning', problem: 'bg-danger-text', off: 'bg-text-muted' };
const LEVEL_WORD: Record<Level, string> = { ok: 'Healthy', warning: 'Warning', problem: 'Problem', off: 'Turned off' };

function StatusLine({ label, level, children }: { label: string; level: Level; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border py-3 last:border-b-0 sm:flex-row sm:items-center sm:gap-4">
      <span className="w-48 shrink-0 text-sm text-text-secondary">{label}</span>
      <span className="flex min-w-0 items-center gap-2 text-sm text-text-primary">
        <span aria-hidden className={cn('inline-block size-2.5 shrink-0 rounded-pill', DOT[level])} />
        <span className="sr-only">{LEVEL_WORD[level]}:</span>
        <span className="tnum">{children}</span>
      </span>
    </div>
  );
}

function StatusCard() {
  const { tz } = useSettings();
  const [s, setS] = useState<StatusResponse | null>(null);
  const [err, setErr] = useState(false);
  const [now, setNow] = useState(Date.now());
  const load = useCallback(async () => {
    try {
      setS(await api<StatusResponse>('/api/status'));
      setErr(false);
    } catch {
      setErr(true);
    }
    setNow(Date.now());
  }, []);
  useEffect(() => {
    void load();
    const iv = setInterval(() => void load(), 30_000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(iv);
      clearInterval(tick);
    };
  }, [load]);

  let body: ReactNode;
  if (!s && err) body = <ErrorState className="py-6" title="Couldn't load your settings." onRetry={() => void load()} />;
  else if (!s) body = <div className="flex flex-col gap-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-4 w-full max-w-md" />)}</div>;
  else {
    const emailLevel: Level = !s.email.configured ? 'problem' : s.email.key_rejected ? 'warning' : 'ok';
    const emailText = !s.email.configured
      ? 'Not set up — POSTMARK_SERVER_TOKEN is missing'
      : s.email.key_rejected
        ? 'Postmark rejected the key — replace POSTMARK_SERVER_TOKEN'
        : `Connected${s.email.last_sent_at ? ` · Last email ${formatDateTime(s.email.last_sent_at, tz)}` : ''}`;
    const ago = s.scheduler.last_tick_at ? formatAgo((now - Date.parse(s.scheduler.last_tick_at)) / 1000) : null;
    const schedLevel: Level = !s.scheduler.enabled ? 'off' : s.scheduler.healthy ? 'ok' : 'problem';
    const schedText = !s.scheduler.enabled
      ? 'Turned off (SCHEDULER_ENABLED=false)'
      : s.scheduler.healthy
        ? `Running${ago ? ` · Last check ${ago}` : ''}`
        : `Not running — ${ago ? `last check ${ago}` : 'no check yet'}`;
    let pushLevel: Level;
    let pushText: string;
    if (!s.push.configured) {
      pushLevel = 'problem';
      pushText = 'Not set up — VAPID keys are missing';
    } else if (!s.push.enabled) {
      pushLevel = 'off';
      pushText = 'Turned off in Reminders';
    } else if (s.push.browsers === 0) {
      pushLevel = 'off';
      pushText = 'No browsers allowed yet';
    } else if (s.push.key_rejected) {
      pushLevel = 'problem';
      pushText = 'The alert keys were rejected — VAPID keys must match the ones browsers signed up with';
    } else if (s.push.failing_browsers.length) {
      pushLevel = 'warning';
      pushText = `Last alert failed on ${s.push.failing_browsers[0]} — see Reminders`;
    } else {
      pushLevel = 'ok';
      pushText = `On · ${s.push.browsers} ${s.push.browsers === 1 ? 'browser' : 'browsers'} · ${s.push.last_sent_at ? `Last alert ${formatDateTime(s.push.last_sent_at, tz)}` : 'No alerts sent yet'}`;
    }
    const capWarn = s.email.monthly_cap > 0 && s.email.sent_this_month >= s.email.monthly_cap * 0.8;
    body = (
      <div>
        <StatusLine label="Email sending" level={emailLevel}>{emailText}</StatusLine>
        <StatusLine label="Background checks" level={schedLevel}>{schedText}</StatusLine>
        <StatusLine label="Pop-up alerts" level={pushLevel}>{pushText}</StatusLine>
        <StatusLine label="Failed emails, last 7 days" level={s.email.failed_7d ? 'warning' : 'ok'}>
          {s.email.failed_7d ? (
            <>
              {s.email.failed_7d} failed —{' '}
              <Link href="/data?tab=emails" className="text-accent-text underline-offset-2 hover:underline">
                see Sent emails
              </Link>
            </>
          ) : (
            '0'
          )}
        </StatusLine>
        <StatusLine label="Emails this month" level={capWarn ? 'warning' : 'ok'}>
          {s.email.sent_this_month} of {s.email.monthly_cap}
        </StatusLine>
        <StatusLine label="Version" level="ok">
          {s.version}
        </StatusLine>
      </div>
    );
  }
  return (
    <Card title="System status" id="status">
      {body}
    </Card>
  );
}

// --------------------------------------------------------------- danger zone
function DangerCard() {
  const timer = useTimer();
  const { summary } = useDataSummary();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  useEffect(() => {
    if (!open) setTyped('');
  }, [open]);
  const n = summary?.totals.sessions ?? 0;
  const hours = formatDuration(summary?.totals.seconds ?? 0);
  return (
    <Card title="Danger zone" danger>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="card-heading text-text-primary">Delete all tracked data</h3>
          <p className="mt-1 text-sm text-text-secondary">Projects, tasks, sessions and email records. Your login, settings and allowed browsers stay.</p>
        </div>
        <Button variant="danger" onClick={() => setOpen(true)}>
          Delete all tracked data…
        </Button>
      </div>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete all tracked data?"
        description={`This permanently deletes every project, task, session and email record — ${n} ${n === 1 ? 'session' : 'sessions'}, ${hours}. Your login, settings and allowed browsers stay. Download a copy of your hours first if you might want them: it's a spreadsheet you can read, and Focus Log can't load it back in.`}
        confirmLabel="Delete everything"
        confirmDisabled={typed !== 'DELETE'}
        onConfirm={async () => {
          if (typed !== 'DELETE') return false;
          try {
            await api('/api/data/delete-all', { method: 'POST', body: { confirm: 'DELETE' } });
            toast.success('All tracked data deleted.');
            emit('data-changed');
            emit('sessions-changed');
            void timer.refresh();
          } catch (e) {
            toast.error(messageOf(e));
            return false;
          }
        }}
      >
        <button
          type="button"
          className="mb-4 text-sm text-accent-text underline-offset-2 hover:underline"
          onClick={() => download('/api/export.csv').catch((e) => toast.error(messageOf(e)))}
        >
          Download a copy
        </button>
        <Field label="Type DELETE to confirm">
          {({ id }) => <Input id={id} autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />}
        </Field>
      </ConfirmDialog>
    </Card>
  );
}
