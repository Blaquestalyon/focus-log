'use client';
/**
 * Toasts (§4 "Toasts"): Sonner, auto-dismiss after 5s (errors 6s), at most 3 visible.
 * Errors are also announced assertively through a dedicated live region.
 */
import { toast as base, type ExternalToast } from 'sonner';

function announceAssertive(message: string) {
  const el = typeof document !== 'undefined' ? document.getElementById('fl-assertive') : null;
  if (!el) return;
  el.textContent = '';
  setTimeout(() => (el.textContent = message), 50);
}

type Msg = Parameters<typeof base>[0];

export const toast = Object.assign((m: Msg, o?: ExternalToast) => base.info(m, o), {
  success: (m: Msg, o?: ExternalToast) => base.success(m, o),
  info: (m: Msg, o?: ExternalToast) => base.info(m, o),
  error: (m: Msg, o?: ExternalToast) => {
    if (typeof m === 'string') announceAssertive(m);
    return base.error(m, { duration: 6000, ...o });
  },
  dismiss: base.dismiss,
});

/** A toast to show after a full page navigation (e.g. "Password set. You're signed in."). */
export function toastAfterNavigation(message: string) {
  try {
    sessionStorage.setItem('fl-toast', message);
  } catch {
    /* ignore */
  }
}

export function flushPendingToast() {
  try {
    const m = sessionStorage.getItem('fl-toast');
    if (m) {
      sessionStorage.removeItem('fl-toast');
      base.success(m);
    }
  } catch {
    /* ignore */
  }
}
