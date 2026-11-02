import { defineMiddleware } from 'astro:middleware';
import { DASHBOARD_ALLOWED_HOSTS } from 'astro:env/server';
import { SESSION_COOKIE, authRequired, isValidSession } from './lib/auth';
import { startScheduler } from './lib/schedule';

// Scheduled releases go live from here (the first request, at the latest the health check, loads this module).
startScheduler();

// Only answer requests addressed to a known host name (blocks DNS-rebinding tricks).
// On the server, set DASHBOARD_ALLOWED_HOSTS, e.g. "192.168.1.20:4322,dashboard.home.lan".
const allowedHosts = new Set(
  (DASHBOARD_ALLOWED_HOSTS || '127.0.0.1:4322,localhost:4322')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean),
);

const PUBLIC_PATHS = new Set(['/login', '/healthz']);

export const onRequest = defineMiddleware((context, next) => {
  const { request, url, cookies, redirect } = context;

  // Container health check: no data, no host check.
  if (url.pathname === '/healthz') return new Response('ok');

  const host = (request.headers.get('host') ?? '').toLowerCase();
  if (!allowedHosts.has(host)) {
    return new Response(`Forbidden: host "${host}" is not in DASHBOARD_ALLOWED_HOSTS`, { status: 403 });
  }

  // Forms may only be submitted from the dashboard itself (CSRF protection).
  if (!['GET', 'HEAD'].includes(request.method)) {
    const origin = request.headers.get('origin');
    if (!origin || new URL(origin).host.toLowerCase() !== host) {
      return new Response('Forbidden: cross-origin request', { status: 403 });
    }
  }

  if (authRequired() && !PUBLIC_PATHS.has(url.pathname) && !isValidSession(cookies.get(SESSION_COOKIE)?.value)) {
    const back = url.pathname === '/' ? '' : `?next=${encodeURIComponent(url.pathname + url.search)}`;
    return redirect(`/login${back}`, 303);
  }

  return next();
});
