import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Session refresh + access rules (§1 Roles, §7 Auth).
 * Public: /sign-in, /set-password, /api/auth/*, /api/health, /health and the static files a browser
 * needs before signing in (/sw.js, /manifest.webmanifest, /icons/*). Every other page
 * redirects to /sign-in?next=…, every other API route answers 401.
 */
const PUBLIC_PAGES = ['/sign-in', '/set-password'];

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (pathname === '/api/health' || pathname === '/health') return NextResponse.next();

  let res = NextResponse.next({ request: req });
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    return pathname.startsWith('/api/')
      ? NextResponse.json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong on our side. Try again in a moment.' } }, { status: 500 })
      : res;
  }
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) req.cookies.set(name, value);
        res = NextResponse.next({ request: req });
        for (const { name, value, options } of list) res.cookies.set(name, value, options);
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  const signedIn = Boolean(data.user);

  if (pathname.startsWith('/api/auth/')) return res;
  if (pathname.startsWith('/api/')) {
    if (!signedIn) {
      return NextResponse.json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in to continue.' } }, { status: 401 });
    }
    return res;
  }
  if (PUBLIC_PAGES.includes(pathname)) {
    if (signedIn && pathname === '/sign-in') {
      const next = req.nextUrl.searchParams.get('next');
      const dest = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
      return NextResponse.redirect(new URL(dest, req.url));
    }
    return res;
  }
  if (!signedIn) {
    const to = new URL('/sign-in', req.url);
    to.searchParams.set('next', pathname + search);
    return NextResponse.redirect(to);
  }
  return res;
}

export const config = {
  runtime: 'nodejs',
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/).*)'],
};
