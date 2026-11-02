import type { APIRoute } from 'astro';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { PREVIEW_DIST } from '../../lib/preview';

// Serves the last preview build (static files) under /preview/.
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

async function file(path: string): Promise<string | null> {
  try {
    const info = await stat(path);
    if (info.isFile()) return path;
    if (info.isDirectory()) return file(join(path, 'index.html'));
  } catch {}
  return null;
}

export const GET: APIRoute = async ({ params, redirect, url }) => {
  if (url.pathname === '/preview') return redirect('/preview/', 301);
  const target = normalize(join(PREVIEW_DIST, params.path ?? ''));
  if (target !== PREVIEW_DIST && !target.startsWith(PREVIEW_DIST + sep)) return new Response('Not found', { status: 404 });

  // Pages without trailing slash: redirect like the live site does.
  if (!extname(target) && !url.pathname.endsWith('/') && (await file(target))) return redirect(`${url.pathname}/`, 301);

  const found = await file(target);
  const notFound = found ? null : await file(join(PREVIEW_DIST, '404.html'));
  const path = found ?? notFound;
  if (!path) {
    return new Response('Noch keine Vorschau vorhanden. Erstelle sie in der Übersicht des Dashboards.', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
  return new Response(await readFile(path), {
    status: found ? 200 : 404,
    headers: { 'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' },
  });
};
