import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * NJLRII Admin Panel — Server-Side Auth Proxy
 *
 * This proxy runs on the Edge before any protected page is rendered.
 * It checks for a valid Supabase session token in the cookies and
 * redirects unauthenticated users to the login page.
 *
 * NOTE: In Next.js 16 "middleware" was renamed to "proxy".
 * The file must export a function named `proxy` (not `middleware`).
 */

// Protected path prefixes — anything starting with these requires a session
const PROTECTED_PREFIXES = [
  '/overview',
  '/users',
  '/tracker',
  '/papers',
  '/volumes',
  '/issues',
  '/blog',
  '/reviewer',
  '/author',
];

// The login page (never redirect loops)
const LOGIN_PATH = '/';

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Check if the current path needs protection
  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  // Let public routes, API routes, and static assets through without checks
  if (!isProtected) {
    return NextResponse.next();
  }

  // Read the Supabase session token from cookies.
  // Supabase stores its session in a cookie named `sb-<project-ref>-auth-token`
  // OR as `supabase-auth-token` depending on the client version.
  // We do a broad check: look for any cookie that contains a valid access_token.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Misconfigured — fail closed (redirect to login)
    return NextResponse.redirect(new URL(LOGIN_PATH, req.url));
  }

  // Extract the access token from the Authorization header or from cookies
  // Supabase JS v2 stores the session in localStorage on client, but during
  // SSR/Edge we can read it from the cookie that Supabase sets.
  // The cookie key follows the pattern: sb-{project-ref}-auth-token
  const allCookies = req.cookies.getAll();
  let accessToken: string | null = null;

  for (const cookie of allCookies) {
    if (cookie.name.startsWith('sb-') && cookie.name.endsWith('-auth-token')) {
      try {
        // Cookie value is a JSON string: { access_token, refresh_token, ... }
        const parsed = JSON.parse(decodeURIComponent(cookie.value));
        if (parsed?.access_token) {
          accessToken = parsed.access_token;
          break;
        }
      } catch {
        // Not a JSON cookie — skip
      }
    }
  }

  if (!accessToken) {
    // No session cookie found — redirect to login
    const loginUrl = new URL(LOGIN_PATH, req.url);
    loginUrl.searchParams.set('redirect', pathname); // optional: remember where they wanted to go
    return NextResponse.redirect(loginUrl);
  }

  // Verify the token is valid with Supabase (lightweight check, no DB query)
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    // Token is expired or invalid — redirect to login
    const loginUrl = new URL(LOGIN_PATH, req.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Valid session — allow the request through
  return NextResponse.next();
}

// Run proxy on all routes except static files, images, and favicon
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
