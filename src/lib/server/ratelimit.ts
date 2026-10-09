/**
 * In-memory sliding-window limits (blueprint §6 "Rate limits"; the app runs as one instance).
 * Kept on globalThis so every route bundle shares one store.
 */
const g = globalThis as unknown as { __flBuckets?: Map<string, number[]> };
const buckets: Map<string, number[]> = (g.__flBuckets ??= new Map());

/**
 * Sliding window: allow at most `limit` requests per `windowMs` for `key`.
 * Returns true when this request is allowed (and counts it).
 */
export function take(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (!v.length || now - v[v.length - 1] > 24 * 3600_000) buckets.delete(k);
  }
  return true;
}

export function resetBuckets() {
  buckets.clear();
}

/**
 * Client IP: the LAST address in X-Forwarded-For (appended by Railway's proxy), never the
 * first (a client can forge it). Falls back to x-real-ip, then "unknown".
 */
export function clientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for');
  if (xff) {
    const parts = xff.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return headers.get('x-real-ip')?.trim() || 'unknown';
}
