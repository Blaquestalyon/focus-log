'use client';
import { useEffect, type ReactNode } from 'react';
import { UiProvider } from './ui-context';
import { SettingsProvider } from './settings-context';
import { CatalogProvider } from './catalog-context';
import { TimerProvider, useTimer } from './timer-context';
import { AppShell } from './shell';
import { TimerEffects } from './timer-effects';
import { Shortcuts } from './shortcuts';
import { CommandPalette } from './palette';
import { DiscardDialog, EditStartDialog, StopAtDialog } from './timer-dialogs';
import { SessionDialog } from './session-dialog';
import { ProjectDialog, TaskDialog } from './data-dialogs';
import { HelpDialog, ShortcutsDialog } from './help-dialogs';
import { registerServiceWorker, resaveSubscription } from '@/lib/client/push';
import { flushPendingToast } from '@/lib/client/toast';

function LiveRegion() {
  const { announcement } = useTimer();
  return (
    <div className="sr-only" aria-live="polite" role="status">
      {announcement}
    </div>
  );
}

/** Register /sw.js on every signed-in load and re-save this browser's alert sign-up (F21 step 6). */
function ServiceWorkerSetup() {
  useEffect(() => {
    void (async () => {
      await registerServiceWorker();
      await resaveSubscription();
    })();
    flushPendingToast();
  }, []);
  return null;
}

export function AppProviders({ email, children }: { email: string; children: ReactNode }) {
  return (
    <UiProvider>
      <SettingsProvider>
        <CatalogProvider>
          <TimerProvider>
            <AppShell email={email}>{children}</AppShell>
            <TimerEffects />
            <Shortcuts />
            <CommandPalette />
            <StopAtDialog />
            <EditStartDialog />
            <DiscardDialog />
            <SessionDialog />
            <ProjectDialog />
            <TaskDialog />
            <HelpDialog />
            <ShortcutsDialog />
            <LiveRegion />
            <ServiceWorkerSetup />
          </TimerProvider>
        </CatalogProvider>
      </SettingsProvider>
    </UiProvider>
  );
}
