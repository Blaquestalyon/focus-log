'use client';
/**
 * The ONE request helper every user-triggered call goes through. It always ends in a visible
 * outcome: data, or an ApiError carrying a plain-English message. It catches network failures,
 * tolerates non-JSON bodies (proxies, cold starts, missing routes) and redirects on 401.
 */
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public field?: string) {
    super(message);
  }
}

export const NETWORK_MESSAGE = "Couldn't reach Focus Log. Check your connection and try again.";
export const TIMER_NETWORK_MESSAGE = "Couldn't reach Focus Log. Your timer hasn't changed.";
export const SERVER_MESSAGE = 'Something went wrong on our side. Try again in a moment.';

let redirecting = false;
/** A 401: send the browser to sign in (once) and fail the call. */
function signInRequired(): never {
  if (!redirecting && typeof window !== 'undefined') {
    redirecting = true;
    const next = window.location.pathname + window.location.search;
    window.location.assign(`/sign-in?next=${encodeURIComponent(next)}&expired=1`);
  }
  throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
}

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  networkMessage?: string;
  /** Auth routes handle their own 401 (wrong password) instead of redirecting. */
  noAuthRedirect?: boolean;
  signal?: AbortSignal;
}

export async function apiTimed<T>(path: string, opts: ApiOptions = {}): Promise<{ data: T; sentAt: number; receivedAt: number }> {
  const sentAt = Date.now();
  let res: Response;
  try {
    res = await fetch(path, {
      method: opts.method ?? 'GET',
      headers: { ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...opts.headers },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: 'same-origin',
      cache: 'no-store',
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw e;
    throw new ApiError(0, 'NETWORK', opts.networkMessage ?? NETWORK_MESSAGE);
  }
  const receivedAt = Date.now();
  if (res.status === 401 && !opts.noAuthRedirect) signInRequired();
  if (res.status === 204) return { data: undefined as T, sentAt, receivedAt };
  let data: unknown = undefined;
  try {
    data = await res.json();
  } catch {
    if (res.ok) return { data: undefined as T, sentAt, receivedAt };
    throw new ApiError(res.status, 'SERVER_ERROR', res.status === 0 ? opts.networkMessage ?? NETWORK_MESSAGE : SERVER_MESSAGE);
  }
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string; field?: string } } | null)?.error;
    throw new ApiError(res.status, err?.code ?? 'SERVER_ERROR', err?.message ?? SERVER_MESSAGE, err?.field);
  }
  return { data: data as T, sentAt, receivedAt };
}

export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  return (await apiTimed<T>(path, opts)).data;
}

/** Message for any thrown value, never a raw server string. */
export function messageOf(e: unknown, fallback = SERVER_MESSAGE): string {
  if (e instanceof ApiError) return e.message;
  return fallback;
}

/** Download a file from an API route, surfacing errors (e.g. 413) as ApiError. */
export async function download(path: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(path, { credentials: 'same-origin', cache: 'no-store' });
  } catch {
    throw new ApiError(0, 'NETWORK', NETWORK_MESSAGE);
  }
  if (res.status === 401) signInRequired();
  if (!res.ok) {
    let msg = SERVER_MESSAGE;
    let code = 'SERVER_ERROR';
    try {
      const d = await res.json();
      msg = d?.error?.message ?? msg;
      code = d?.error?.code ?? code;
    } catch {
      /* not JSON */
    }
    throw new ApiError(res.status, code, msg);
  }
  const blob = await res.blob();
  const cd = res.headers.get('content-disposition') ?? '';
  const name = /filename="([^"]+)"/.exec(cd)?.[1] ?? 'focus-log.csv';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
