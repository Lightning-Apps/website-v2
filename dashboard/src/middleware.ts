import { defineMiddleware } from 'astro:middleware';

// Only answer requests addressed to this machine. Blocks DNS-rebinding tricks
// where a website in your browser tries to talk to the dashboard.
const ALLOWED_HOSTS = new Set(['127.0.0.1:4322', 'localhost:4322']);

export const onRequest = defineMiddleware((context, next) => {
  const host = context.request.headers.get('host') ?? '';
  if (!ALLOWED_HOSTS.has(host)) {
    return new Response('Forbidden', { status: 403 });
  }
  return next();
});
