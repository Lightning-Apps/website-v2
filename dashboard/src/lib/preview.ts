// Preview: builds the website with the current, unpublished content into the data folder
// and serves it under /preview/ (behind the dashboard login). Nothing reaches Cloudflare.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { DASHBOARD_DATA_DIR, SITE_URL, SUPABASE_URL } from 'astro:env/server';
import { loadAll, siteContent } from './publish';
import { formatDateTime } from './server';

const ROOT = join(DASHBOARD_DATA_DIR || process.cwd(), '.preview');
export const PREVIEW_DIST = join(ROOT, 'dist');
const META_FILE = join(ROOT, 'meta.json');

export interface PreviewMeta {
  builtAt: string;
  includeDrafts: boolean;
}

export interface PreviewState {
  building: boolean;
  startedAt: string | null;
  error: string | null;
  /** Last successful build. */
  meta: PreviewMeta | null;
}

let building: { startedAt: string } | null = null;
let lastError: string | null = null;

/** The site workspace: next to the dashboard in the repository and in the container. */
function siteRoot(): string {
  const candidates = [resolve(process.cwd(), 'site'), resolve(process.cwd(), '../site')];
  const found = candidates.find((dir) => existsSync(join(dir, 'astro.config.mjs')));
  if (!found) throw new Error('Website-Quellen (site/) nicht gefunden.');
  return found;
}

async function readMeta(): Promise<PreviewMeta | null> {
  try {
    return JSON.parse(await readFile(META_FILE, 'utf8')) as PreviewMeta;
  } catch {
    return null;
  }
}

export async function previewState(): Promise<PreviewState> {
  return { building: Boolean(building), startedAt: building?.startedAt ?? null, error: lastError, meta: await readMeta() };
}

function run(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((done, fail) => {
    const child = spawn(command, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    const output: string[] = [];
    const collect = (chunk: Buffer) => output.push(...chunk.toString().split('\n').filter(Boolean));
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    child.on('error', fail);
    child.on('close', (code) => {
      if (code === 0) done();
      // Strip color codes; the last lines usually name the problem.
      else fail(new Error(output.slice(-12).join('\n').replace(/\u001b\[[0-9;]*m/g, '') || `Build beendet mit Code ${code}.`));
    });
  });
}

async function build(includeDrafts: boolean): Promise<void> {
  const site = siteRoot();
  const astro = join(dirname(site), 'node_modules', 'astro', 'bin', 'astro.mjs');
  // Built next to Astro's own working files: it moves files between both, which needs one filesystem.
  const out = join(site, '.astro', `preview-${Date.now()}`);
  const contentFile = join(ROOT, 'content.json');
  await mkdir(ROOT, { recursive: true });

  const now = new Date().toISOString();
  await writeFile(contentFile, JSON.stringify({ id: null, created_at: now, content: siteContent(await loadAll(), includeDrafts) }));

  // A clean environment: the build gets no dashboard secrets.
  await run(process.execPath, [astro, 'build'], site, {
    PATH: process.env.PATH,
    HOME: tmpdir(),
    TZ: process.env.TZ,
    NODE_ENV: 'production',
    ASTRO_TELEMETRY_DISABLED: '1',
    SUPABASE_URL,
    SITE_URL: SITE_URL || undefined,
    SITE_BASE: '/preview',
    SITE_OUT_DIR: out,
    SITE_CACHE_DIR: join(ROOT, 'cache'),
    PREVIEW_CONTENT_FILE: contentFile,
    PREVIEW_LABEL: `Vorschau vom ${formatDateTime(now)} Uhr${includeDrafts ? ' · mit Entwürfen' : ''} – nicht veröffentlicht`,
  });

  try {
    await rm(PREVIEW_DIST, { recursive: true, force: true });
    await cp(out, PREVIEW_DIST, { recursive: true });
  } finally {
    await rm(out, { recursive: true, force: true });
  }
  await writeFile(META_FILE, JSON.stringify({ builtAt: now, includeDrafts } satisfies PreviewMeta));
}

/** Starts a preview build in the background (one at a time). */
export function startPreview(includeDrafts: boolean): void {
  if (building) return;
  building = { startedAt: new Date().toISOString() };
  lastError = null;
  build(includeDrafts)
    .catch((e: Error) => {
      lastError = e.message;
      console.error('Vorschau fehlgeschlagen:', e);
    })
    .finally(async () => {
      building = null;
      // Leftovers of failed builds.
      const dir = join(siteRoot(), '.astro');
      const names = await readdir(dir).catch(() => []);
      await Promise.all(names.filter((n) => n.startsWith('preview-')).map((n) => rm(join(dir, n), { recursive: true, force: true })));
    });
}
