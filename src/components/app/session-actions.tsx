'use client';
/** Row actions shared by Today and History: ⋯ menu and the delete confirmation. */
import { useState } from 'react';
import { Clock, Pencil, Play, Square, Trash2 } from 'lucide-react';
import { MoreMenu, MenuItem, MenuSeparator } from '@/components/ui/menu';
import { ConfirmDialog } from '@/components/ui/dialog';
import { useUi } from './ui-context';
import { useTimer } from './timer-context';
import { useSettings } from './settings-context';
import { api, messageOf } from '@/lib/client/api';
import { emit } from '@/lib/client/events';
import { toast } from '@/lib/client/toast';
import { formatDate, formatDuration, formatTimeRange } from '@/lib/format';
import type { SessionRow } from '@/lib/types';

export function sessionSummary(s: SessionRow, tz: string): string {
  const secs = s.duration_seconds ?? 0;
  return `${s.task.name}, ${formatDate(s.started_at, tz)}, ${formatTimeRange(s.started_at, s.ended_at, tz)} (${formatDuration(secs)})`;
}

export function SessionMenu({ session, context, onDeleted }: { session: SessionRow; context: 'today' | 'history'; onDeleted?: () => void }) {
  const ui = useUi();
  const timer = useTimer();
  const { tz } = useSettings();
  const [confirm, setConfirm] = useState(false);
  const running = !session.ended_at;

  // Clicks inside the menu and its dialog must not reach the row (which opens Edit).
  return (
    <span className="contents" onClick={(e) => e.stopPropagation()}>
      <MoreMenu>
        {running ? (
          <>
            <MenuItem icon={<Clock className="size-4" />} onSelect={() => ui.openEditStart(session.id, session.started_at)}>
              Edit start time…
            </MenuItem>
            {context === 'today' ? (
              <MenuItem icon={<Square className="size-4" />} onSelect={() => ui.openStopAt()}>
                Stop at…
              </MenuItem>
            ) : (
              <>
                <MenuSeparator />
                <MenuItem danger disabled tip="Stop or discard the timer first" icon={<Trash2 className="size-4" />}>
                  Delete…
                </MenuItem>
              </>
            )}
          </>
        ) : (
          <>
            <MenuItem icon={<Pencil className="size-4" />} onSelect={() => ui.openEditSession(session)}>
              Edit…
            </MenuItem>
            <MenuItem icon={<Play className="size-4" />} onSelect={() => void timer.start({ task_id: session.task.id, label: session.task.name })}>
              Start this task again
            </MenuItem>
            <MenuSeparator />
            <MenuItem danger icon={<Trash2 className="size-4" />} onSelect={() => setConfirm(true)}>
              Delete…
            </MenuItem>
          </>
        )}
      </MoreMenu>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Delete this session?"
        description={`${sessionSummary(session, tz)} will be removed from your totals. This can't be undone.`}
        confirmLabel="Delete session"
        onConfirm={async () => {
          try {
            await api(`/api/sessions/${session.id}`, { method: 'DELETE' });
            toast.success('Session deleted.');
            onDeleted?.();
            emit('sessions-changed');
            return true;
          } catch (e) {
            toast.error(messageOf(e));
            return false;
          }
        }}
      />
    </span>
  );
}
