import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { z, ZodError } from 'zod';
import { env } from './env';
import { userClient } from './supabase';
import { take } from './ratelimit';
import { log } from './log';

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string, public field?: string) {
    super(message);
  }
}

export const MSG = {
  unauthenticated: 'Sign in to continue.',
  notFound: 'That item no longer exists.',
  server: 'Something went wrong on our side. Try again in a moment.',
  slowDown: 'Slow down a moment and try again.',
  badRequest: "That request wasn't valid.",
};

export function json(data: unknown, status = 200, headers?: HeadersInit) {
  return NextResponse.json(data, { status, headers });
}

export function errorResponse(status: number, code: string, message: string, field?: string) {
  return NextResponse.json({ error: { code, message, ...(field ? { field } : {}) } }, { status });
}

export interface Ctx {
  req: NextRequest;
  supabase: SupabaseClient;
  user: User;
}

type Handler<P> = (ctx: Ctx, params: P) => Promise<Response>;

function originOk(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  return origin === env.appOrigin;
}

function toResponse(e: unknown): Response {
  if (e instanceof HttpError) return errorResponse(e.status, e.code, e.message, e.field);
  if (e instanceof ZodError) {
    const issue = e.issues[0];
    const field = issue?.path?.length ? String(issue.path[0]) : undefined;
    const message = issue?.code === 'unrecognized_keys' ? MSG.badRequest : issue?.message || MSG.badRequest;
    return errorResponse(400, 'VALIDATION', message, field);
  }
  log.error({ err: e instanceof Error ? { message: e.message, name: e.name } : String(e) }, 'unhandled route error');
  return errorResponse(500, 'SERVER_ERROR', MSG.server);
}

/** Signed-in route. Non-GET routes also get the same-origin check and the per-user rate limit. */
export function authed<P = Record<string, string>>(handler: Handler<P>, opts: { rateLimit?: boolean } = {}) {
  return async (req: NextRequest, context: { params: Promise<P> }) => {
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD' && !originOk(req)) {
        return errorResponse(403, 'FORBIDDEN_ORIGIN', MSG.badRequest);
      }
      const supabase = await userClient();
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) return errorResponse(401, 'UNAUTHENTICATED', MSG.unauthenticated);
      const mutating = req.method !== 'GET' && req.method !== 'HEAD';
      if (mutating && opts.rateLimit !== false && !take(`mut:${data.user.id}`, 120, 60_000)) {
        return errorResponse(429, 'RATE_LIMITED', MSG.slowDown);
      }
      const params = (context?.params ? await context.params : ({} as P));
      return await handler({ req, supabase, user: data.user }, params);
    } catch (e) {
      return toResponse(e);
    }
  };
}

/** Public route (sign-in, password link, set password). Same-origin check on non-GET. */
export function open(handler: (req: NextRequest) => Promise<Response>) {
  return async (req: NextRequest) => {
    try {
      if (req.method !== 'GET' && !originOk(req)) return errorResponse(403, 'FORBIDDEN_ORIGIN', MSG.badRequest);
      return await handler(req);
    } catch (e) {
      return toResponse(e);
    }
  };
}

/** Parse a JSON body against a strict schema (unknown fields → 400). */
export async function body<T extends z.ZodType>(req: NextRequest, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    const text = await req.text();
    raw = text ? JSON.parse(text) : {};
  } catch {
    throw new HttpError(400, 'VALIDATION', MSG.badRequest);
  }
  return schema.parse(raw);
}

export const uuid = z.string().uuid(MSG.badRequest);

/** Throw a mapped HttpError for a database error, or a 500. */
export function dbFail(error: { code?: string; message?: string } | null, context: string): never {
  log.error({ code: error?.code, msg: error?.message?.slice(0, 200), context }, 'database error');
  throw new HttpError(500, 'SERVER_ERROR', MSG.server);
}
