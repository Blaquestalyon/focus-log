import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

/** Load public/sw.js into a sandbox with mocked self/clients/registration (T-P10, T-P11). */
function loadSw(opts: { windows?: { url: string; focus: () => unknown; postMessage: (m: unknown) => void }[]; fetch?: typeof fetch } = {}) {
  const listeners: Record<string, (e: unknown) => void> = {};
  const shown: { title: string; options: Record<string, unknown> }[] = [];
  const opened: string[] = [];
  const subscribe = vi.fn(async () => ({ toJSON: () => ({ endpoint: 'https://push.example/new', keys: { p256dh: 'k', auth: 'a' } }) }));
  const self = {
    location: { origin: 'https://focus.example' },
    addEventListener: (t: string, fn: (e: unknown) => void) => (listeners[t] = fn),
    skipWaiting: vi.fn(),
    clients: {
      claim: vi.fn(async () => {}),
      matchAll: vi.fn(async () => opts.windows ?? []),
      openWindow: vi.fn(async (u: string) => opened.push(u)),
    },
    registration: {
      showNotification: vi.fn(async (title: string, options: Record<string, unknown>) => shown.push({ title, options })),
      pushManager: { subscribe },
    },
  };
  const code = fs.readFileSync(path.join(process.cwd(), 'public/sw.js'), 'utf8');
  vm.runInNewContext(code, { self, atob, fetch: opts.fetch ?? (async () => new Response('{}')), Response, Promise, URL, Uint8Array, console });
  const fire = async (type: string, extra: Record<string, unknown>) => {
    let p: Promise<unknown> = Promise.resolve();
    listeners[type]({ ...extra, waitUntil: (x: Promise<unknown>) => (p = x) });
    await p;
  };
  return { listeners, shown, opened, fire, self, subscribe };
}

describe('service worker', () => {
  it('registers no fetch handler', () => {
    const { listeners } = loadSw();
    expect(listeners.fetch).toBeUndefined();
  });
  it('shows the nudge payload, and a fallback for unreadable payloads', async () => {
    const sw = loadSw();
    const payload = { title: 'Focus Log: timer still running', body: 'Invoice prep has been running for 4h 00m.', tag: 'fl-nudge-1', url: '/?nudge=1', requireInteraction: true };
    await sw.fire('push', { data: { json: () => payload } });
    expect(sw.shown[0].title).toBe(payload.title);
    expect(sw.shown[0].options.tag).toBe('fl-nudge-1');
    await sw.fire('push', { data: { json: () => { throw new Error('bad'); } } });
    expect(sw.shown[1].title).toBe('Focus Log');
    expect(sw.shown[1].options.body).toBe("Open Focus Log to see what's happening.");
  });
  it('notificationclick focuses an open window and posts fl-open, else opens one', async () => {
    const post = vi.fn();
    const win = { url: 'https://focus.example/reports', focus: vi.fn(function (this: unknown) { return win; }), postMessage: post };
    const a = loadSw({ windows: [win] });
    await a.fire('notificationclick', { notification: { close: vi.fn(), data: { url: '/?nudge=9' } } });
    expect(post).toHaveBeenCalledWith({ type: 'fl-open', url: '/?nudge=9' });
    const b = loadSw({ windows: [] });
    await b.fire('notificationclick', { notification: { close: vi.fn(), data: { url: '/?nudge=9' } } });
    expect(b.opened).toEqual(['https://focus.example/?nudge=9']);
  });
  it('pushsubscriptionchange re-subscribes with the same key and PUTs, stopping quietly on 401', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const sw = loadSw({
      fetch: (async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        return new Response(null, { status: 401 });
      }) as unknown as typeof fetch,
    });
    await sw.fire('pushsubscriptionchange', { oldSubscription: { options: { applicationServerKey: new Uint8Array([1, 2]) } } });
    expect(sw.subscribe).toHaveBeenCalled();
    expect(calls[0].init?.method).toBe('PUT');
  });
});
