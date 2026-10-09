'use client';
import Link from 'next/link';
import { Button, Kbd } from '@/components/ui/button';
import { DialogClose, DialogContent, DialogRoot } from '@/components/ui/dialog';
import { useUi } from './ui-context';
import { useIsMac } from './shell';

export function HelpDialog() {
  const ui = useUi();
  const points = [
    'The clock runs on the server, so closing the tab or sleeping your laptop never loses time.',
    'Pause closes a session. Resume starts a new one on the same task, and the clock carries on.',
    'Forgot to stop? Use Stop at… to pick when you really stopped.',
    'Fix any mistake in History: edit, delete, or add time.',
    'Export everything as a spreadsheet from Your data.',
  ];
  return (
    <DialogRoot open={ui.help} onOpenChange={ui.setHelp}>
      {ui.help ? (
        <DialogContent
          title="How Focus Log works"
          footer={
            <DialogClose asChild>
              <Button variant="secondary">Close</Button>
            </DialogClose>
          }
        >
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-text-secondary marker:text-text-muted">
            {points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>
          <p className="mt-4 text-meta text-text-secondary">
            Something not working? Check{' '}
            <Link href="/settings#status" onClick={() => ui.setHelp(false)} className="text-accent-text underline underline-offset-2">
              System status in Settings
            </Link>
            .
          </p>
        </DialogContent>
      ) : null}
    </DialogRoot>
  );
}

export function ShortcutsDialog() {
  const ui = useUi();
  const mac = useIsMac();
  const rows: [string, string[][]][] = [
    ['Open the command palette', [[mac ? '⌘' : 'Ctrl', 'K']]],
    ['Type a new task (goes to Timer)', [['N']]],
    ['Pause or resume', [['P']]],
    ['Stop (the toast offers Undo)', [['S']]],
    ['Add time', [['A']]],
    ['Go to Timer', [['G', 'T']]],
    ['Go to Reports', [['G', 'R']]],
    ['Go to History', [['G', 'H']]],
    ['Go to Your data', [['G', 'D']]],
    ['Go to Settings', [['G', 'S']]],
    ['Keyboard shortcuts', [['?']]],
    ['Close the topmost layer', [['Esc']]],
  ];
  return (
    <DialogRoot open={ui.shortcuts} onOpenChange={ui.setShortcuts}>
      {ui.shortcuts ? (
        <DialogContent
          title="Keyboard shortcuts"
          description="They work anywhere once you're signed in, except while you're typing in a field."
          footer={
            <DialogClose asChild>
              <Button variant="secondary">Close</Button>
            </DialogClose>
          }
        >
          <dl className="flex flex-col">
            {rows.map(([label, keys]) => (
              <div key={label} className="flex h-10 items-center justify-between gap-4 border-b border-border last:border-b-0">
                <dt className="text-sm text-text-secondary">{label}</dt>
                <dd className="flex items-center gap-1">
                  {keys[0].map((k, i) => (
                    <span key={k} className="flex items-center gap-1">
                      {i > 0 && keys[0].length === 2 && keys[0][0] === 'G' ? <span className="text-micro text-text-secondary">then</span> : null}
                      <Kbd>{k}</Kbd>
                    </span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </DialogContent>
      ) : null}
    </DialogRoot>
  );
}
