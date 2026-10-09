'use client';
/**
 * Pop-up alerts in the browser (§5 F21, §8 "Pop-up alerts"). Permission is only ever requested
 * from a tap on Allow alerts; every signed-in load re-saves an existing sign-up.
 */
import { api, ApiError } from './api';

export interface PushSupport {
  sw: boolean;
  push: boolean;
  notification: boolean;
  /** iPhone/iPad Safari in a normal tab (pop-ups need the Home Screen copy). */
  iosTab: boolean;
  /** Everything needed for real push alerts. */
  canPush: boolean;
}

export function pushSupport(): PushSupport {
  if (typeof window === 'undefined') return { sw: false, push: false, notification: false, iosTab: false, canPush: false };
  const sw = 'serviceWorker' in navigator;
  const push = 'PushManager' in window;
  const notification = 'Notification' in window;
  const ua = navigator.userAgent;
  const iOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  return { sw, push, notification, iosTab: iOS && !standalone, canPush: sw && push && notification };
}

export function permission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch {
    return null;
  }
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  const s = pushSupport();
  if (!s.canPush) return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    return (await reg?.pushManager.getSubscription()) ?? null;
  } catch {
    return null;
  }
}

/** This browser's endpoint, for the X-Push-Endpoint header. */
export async function currentEndpoint(): Promise<string | null> {
  return (await currentSubscription())?.endpoint ?? null;
}

/** F21 step 6: re-save the browser's current sign-up on every signed-in visit. */
export async function resaveSubscription(): Promise<void> {
  if (permission() !== 'granted') return;
  const sub = await currentSubscription();
  if (!sub) return;
  try {
    await api('/api/push/subscriptions', { method: 'PUT', body: sub.toJSON() });
  } catch {
    /* System status and Settings show the state; nothing to tell the owner here */
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export type AllowOutcome = 'on' | 'blocked' | 'dismissed' | 'failed' | 'unsupported';

/** F21 steps 1–4. Must be called from a click handler. */
export async function allowAlerts(publicKey: string | null): Promise<AllowOutcome> {
  const s = pushSupport();
  if (!s.notification) return 'unsupported';
  let result: NotificationPermission;
  try {
    result = await Notification.requestPermission();
  } catch {
    return 'failed';
  }
  if (result === 'denied') return 'blocked';
  if (result !== 'granted') return 'dismissed';
  if (!s.canPush || !publicKey) return 'failed';
  try {
    await registerServiceWorker();
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
    }
    await api('/api/push/subscriptions', { method: 'PUT', body: sub.toJSON() });
    return 'on';
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) throw e;
    return 'failed';
  }
}

/** Removing the current browser also cancels its sign-up so it isn't re-saved next visit. */
export async function unsubscribeThisBrowser(): Promise<void> {
  const sub = await currentSubscription();
  try {
    await sub?.unsubscribe();
  } catch {
    /* ignore */
  }
}

/** Close any open pop-up tagged for this session (Keep going, Stop, Stop at, Discard). */
export async function closeNudgeNotifications(sessionId: string): Promise<void> {
  try {
    if (!('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration('/');
    const list = (await reg?.getNotifications({ tag: `fl-nudge-${sessionId}` })) ?? [];
    list.forEach((n) => n.close());
  } catch {
    /* ignore */
  }
}

/** In-tab fallback pop-up (permission granted but no push sign-up). */
export async function showTabNotification(title: string, body: string, tag: string, url: string): Promise<void> {
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration('/') : undefined;
    if (reg) {
      await reg.showNotification(title, { body, tag, icon: '/icons/icon-192.png', data: { url }, requireInteraction: true });
      return;
    }
    const n = new Notification(title, { body, tag, icon: '/icons/icon-192.png' });
    n.onclick = () => {
      window.focus();
      window.location.assign(url);
    };
  } catch {
    /* ignore */
  }
}
