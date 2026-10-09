'use client';
/**
 * The app shell (§4 "App shell"): 2px ribbon band, 240px sidebar (≥1024px), 64px icon rail
 * (768–1023px), 56px mobile top bar with a 280px drawer (<768px), and the content region.
 */
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import * as D from '@radix-ui/react-dialog';
import { ChartColumn, CircleHelp, Database, History, LogOut, Menu, Search, Settings as SettingsIcon, Timer as TimerIcon } from 'lucide-react';
import { cn } from '@/components/ui/cn';
import { Button, IconButton, Kbd } from '@/components/ui/button';
import { Tip } from '@/components/ui/tooltip';
import { Mark, Wordmark } from '@/components/ui/brand';
import { useTimer } from './timer-context';
import { useUi } from './ui-context';
import { formatClock, formatClockShort } from '@/lib/format';
import { useAlignedNow } from '@/lib/client/hooks';
import { api } from '@/lib/client/api';

export const NAV = [
  { href: '/', label: 'Timer', icon: TimerIcon },
  { href: '/reports', label: 'Reports', icon: ChartColumn },
  { href: '/history', label: 'History', icon: History },
  { href: '/data', label: 'Your data', icon: Database },
  { href: '/settings', label: 'Settings', icon: SettingsIcon },
] as const;

export function useIsMac() {
  const [mac, setMac] = useState(false);
  useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)), []);
  return mac;
}

export async function signOut(scope: 'local' | 'global' = 'local') {
  try {
    await api('/api/auth/sign-out', { method: 'POST', body: { scope } });
  } finally {
    window.location.assign('/sign-in');
  }
}

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

function OnAirDot({ paused }: { paused: boolean }) {
  return <span className="onair" data-paused={paused ? 'true' : 'false'} aria-hidden />;
}

/** Sidebar mini-timer: shown only while running or paused; clicking goes to `/`. */
function MiniTimer({ variant }: { variant: 'full' | 'rail' | 'pill' }) {
  const { view, serverNow, clockSeconds } = useTimer();
  const active = view?.status === 'running' || view?.status === 'paused';
  const now = useAlignedNow(serverNow, 1000, Boolean(active));
  if (!view || !active || !view.task) return null;
  const paused = view.status === 'paused';
  const secs = clockSeconds(now);
  const label = `${paused ? 'Paused' : 'Running'}: ${view.task.name}, ${formatClock(secs)}`;
  if (variant === 'rail') {
    return (
      <Tip label={label} side="right">
        <Link href="/" aria-label={label} className="mx-auto flex h-10 w-12 flex-col items-center justify-center gap-1 rounded-sm transition-fast hover:bg-surface-raised">
          <OnAirDot paused={paused} />
          <span className="tnum text-tag text-text-secondary">{formatClockShort(secs)}</span>
        </Link>
      </Tip>
    );
  }
  if (variant === 'pill') {
    return (
      <Link href="/" aria-label={label} className="flex h-11 items-center gap-2 rounded-pill border border-border bg-surface px-3 transition-fast hover:bg-surface-raised">
        <OnAirDot paused={paused} />
        <span className="tnum text-micro text-text-primary">{formatClock(secs)}</span>
      </Link>
    );
  }
  return (
    <Link href="/" aria-label={label} className="mx-3 flex min-h-10 items-center gap-3 rounded-md border border-border bg-surface px-3 py-2 transition-fast hover:bg-surface-raised max-md:min-h-11">
      <OnAirDot paused={paused} />
      <Tip label={view.task.name}>
        <span className="min-w-0 flex-1 truncate text-sm text-text-primary">{view.task.name}</span>
      </Tip>
      <span className="tnum text-sm text-text-secondary">{formatClock(secs)}</span>
    </Link>
  );
}

function SidebarBody({ email, onNavigate }: { email: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  const ui = useUi();
  const mac = useIsMac();
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2 px-5">
        <Mark />
        <Wordmark />
      </div>
      <div className="px-3 pb-3">
        <Button
          variant="secondary"
          block
          className="justify-between font-normal text-text-secondary"
          onClick={() => {
            onNavigate?.();
            ui.setPalette(true);
          }}
          iconRight={<Kbd>{mac ? '⌘K' : 'Ctrl K'}</Kbd>}
        >
          Search or jump…
        </Button>
      </div>
      <nav aria-label="Main" className="flex flex-col gap-0.5 px-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex h-10 items-center gap-3 rounded-sm px-3 text-sm transition-fast',
                active ? 'bg-surface text-text-primary' : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary',
              )}
            >
              {active ? <span aria-hidden className="absolute inset-y-2 left-0 w-0.5 rounded-pill bg-accent" /> : null}
              <Icon className="size-4" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-4">
        <MiniTimer variant="full" />
      </div>
      <div className="mt-auto flex flex-col gap-1 border-t border-border p-3">
        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            ui.setHelp(true);
          }}
          className="flex h-10 items-center gap-3 rounded-sm px-3 text-sm text-text-secondary transition-fast hover:bg-surface-raised hover:text-text-primary"
        >
          <CircleHelp className="size-4" aria-hidden />
          Help
        </button>
        <div className="flex items-center gap-2 pl-3">
          <Tip label={email}>
            <span tabIndex={0} className="min-w-0 flex-1 truncate text-meta text-text-muted">
              {email}
            </span>
          </Tip>
          <IconButton label="Sign out" onClick={() => void signOut('local')}>
            <LogOut className="size-4" aria-hidden />
          </IconButton>
        </div>
      </div>
    </div>
  );
}

function Rail({ email }: { email: string }) {
  const pathname = usePathname();
  const ui = useUi();
  return (
    <div className="flex h-full flex-col items-center gap-1 py-2">
      <div className="flex h-12 items-center">
        <Tip label="Focus Log" side="right">
          <Link href="/" aria-label="Focus Log — Timer" className="inline-flex size-10 items-center justify-center rounded-sm">
            <Mark />
          </Link>
        </Tip>
      </div>
      <IconButton label="Search or jump…" tip="Search or jump… (⌘K)" onClick={() => ui.setPalette(true)}>
        <Search className="size-4" aria-hidden />
      </IconButton>
      <nav aria-label="Main" className="mt-2 flex flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Tip key={href} label={label} side="right">
              <Link
                href={href}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative inline-flex size-10 items-center justify-center rounded-sm transition-fast',
                  active ? 'bg-surface text-text-primary' : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary',
                )}
              >
                {active ? <span aria-hidden className="absolute inset-y-2 left-0 w-0.5 rounded-pill bg-accent" /> : null}
                <Icon className="size-4" aria-hidden />
              </Link>
            </Tip>
          );
        })}
      </nav>
      <div className="mt-3 w-full">
        <MiniTimer variant="rail" />
      </div>
      <div className="mt-auto flex flex-col items-center gap-1 border-t border-border pt-2">
        <IconButton label="Help" onClick={() => ui.setHelp(true)}>
          <CircleHelp className="size-4" aria-hidden />
        </IconButton>
        <IconButton label="Sign out" tip={`Sign out (${email})`} onClick={() => void signOut('local')}>
          <LogOut className="size-4" aria-hidden />
        </IconButton>
      </div>
    </div>
  );
}

export function AppShell({ email, children }: { email: string; children: ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => setDrawer(false), [pathname]);

  // Service-worker messages: a clicked pop-up asks an open tab to route in-app.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMsg = (e: MessageEvent) => {
      const d = e.data as { type?: string; url?: string } | null;
      if (d?.type === 'fl-open' && typeof d.url === 'string' && d.url.startsWith('/')) router.push(d.url);
    };
    navigator.serviceWorker.addEventListener('message', onMsg);
    return () => navigator.serviceWorker.removeEventListener('message', onMsg);
  }, [router]);

  return (
    <>
      <div className="ribbon-band" aria-hidden />
      <a href="#main" className="sr-only-focusable fixed left-4 top-4 z-[var(--z-tooltip)] rounded-sm bg-accent px-3 py-2 text-sm font-semibold text-on-accent">
        Skip to content
      </a>
      <div className="flex min-h-dvh pt-[var(--size-ribbon)]">
        <aside
          aria-label="Sidebar"
          className="sticky top-[var(--size-ribbon)] hidden h-[calc(100dvh-var(--size-ribbon))] w-[var(--size-sidebar)] shrink-0 border-r border-border bg-bg-0 lg:block"
        >
          <SidebarBody email={email} />
        </aside>
        <aside
          aria-label="Sidebar"
          className="sticky top-[var(--size-ribbon)] hidden h-[calc(100dvh-var(--size-ribbon))] w-[var(--size-rail)] shrink-0 border-r border-border bg-bg-0 md:block lg:hidden"
        >
          <Rail email={email} />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col bg-bg-1">
          <header className="sticky top-[var(--size-ribbon)] z-[var(--z-sticky)] flex h-[var(--size-topbar)] items-center gap-2 border-b border-border bg-bg-0 px-2 md:hidden">
            <Link href="/" aria-label="Focus Log — Timer" className="flex h-10 items-center gap-2 rounded-sm px-2">
              <Mark />
              <Wordmark />
            </Link>
            <div className="ml-auto flex items-center gap-1">
              <MiniTimer variant="pill" />
              <D.Root open={drawer} onOpenChange={setDrawer}>
                <D.Trigger asChild>
                  <IconButton label="Open menu">
                    <Menu className="size-4" aria-hidden />
                  </IconButton>
                </D.Trigger>
                <D.Portal>
                  <D.Overlay className="anim-backdrop fixed inset-0 z-[var(--z-drawer)] bg-backdrop" />
                  <D.Content
                    aria-describedby={undefined}
                    className="anim-drawer fixed inset-y-0 left-0 z-[var(--z-drawer)] w-[var(--size-drawer)] max-w-[85vw] border-r border-border bg-bg-0 pt-[var(--size-ribbon)] shadow-overlay"
                  >
                    <D.Title className="sr-only">Menu</D.Title>
                    <SidebarBody email={email} onNavigate={() => setDrawer(false)} />
                  </D.Content>
                </D.Portal>
              </D.Root>
            </div>
          </header>
          <main id="main" tabIndex={-1} className="flex-1 outline-none">
            <div className="mx-auto w-full max-w-[var(--size-content)] px-4 py-6 md:px-8 md:py-8">{children}</div>
          </main>
        </div>
      </div>
    </>
  );
}

/** Page header: gold h1 on the left, the page's primary action on the right, hairline below. */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="page-title text-gold">{title}</h1>
          {subtitle ? <p className="mt-1 text-meta text-text-secondary">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <div className="mt-4 h-px w-full bg-border" aria-hidden />
    </div>
  );
}
