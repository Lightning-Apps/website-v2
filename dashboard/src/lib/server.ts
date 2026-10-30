// Server-only helpers. The service_role key never leaves this process.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CF_DEPLOY_HOOK_URL, DASHBOARD_DATA_DIR, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from 'astro:env/server';
import { LOCALES, MEDIA_BUCKET, PLATFORM_STATES, type Platform } from '@lightning/shared';
import { PLATFORM_NAMES, type Entity, type Field } from './entities';

let client: SupabaseClient | undefined;

export function configError(): string | null {
  if (!SUPABASE_URL) return 'SUPABASE_URL fehlt in der .env.';
  if (!SUPABASE_SERVICE_ROLE_KEY) return 'SUPABASE_SERVICE_ROLE_KEY fehlt in der .env.';
  return null;
}

export function db(): SupabaseClient {
  const error = configError();
  if (error) throw new Error(error);
  client ??= createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export function mediaPublicUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return db().storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
}

async function uploadImage(file: File, folder: string): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error(`„${file.name}“ ist kein Bild.`);
  const ext = (file.name.split('.').pop() ?? 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
  const base = file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'bild';
  const path = `${folder}/${Date.now()}-${base}.${ext}`;
  const { error } = await db().storage.from(MEDIA_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`Upload fehlgeschlagen: ${error.message}`);
  return path;
}

/** Turns a submitted form into a row for the entity's table (uploads images on the way). */
export async function formToRow(entity: Entity, form: FormData): Promise<Record<string, unknown>> {
  const row: Record<string, unknown> = {};
  const columns = (f: Field) => (f.i18n ? LOCALES.map((l) => `${f.name}_${l}`) : [f.name]);

  for (const field of entity.fields) {
    for (const column of columns(field)) {
      const raw = form.get(column);
      const text = typeof raw === 'string' ? raw.trim() : '';
      switch (field.type) {
        case 'checkbox':
          row[column] = form.get(column) === 'on';
          break;
        case 'number':
          row[column] = Number.parseInt(text, 10) || 0;
          break;
        case 'url':
        case 'app':
          row[column] = text || null;
          break;
        case 'image': {
          const file = form.get(`${column}__file`);
          if (form.get(`${column}__remove`) === 'on') row[column] = null;
          else if (file instanceof File && file.size > 0) row[column] = await uploadImage(file, entity.key);
          // Otherwise keep the existing value (column not sent).
          break;
        }
        case 'platforms': {
          const platforms: Platform[] = [];
          for (const name of PLATFORM_NAMES) {
            if (form.get(`platform_${name}`) !== 'on') continue;
            const state = String(form.get(`platform_${name}_state`));
            platforms.push({ name, state: (PLATFORM_STATES as readonly string[]).includes(state) ? (state as Platform['state']) : 'planned' });
          }
          row[column] = platforms;
          break;
        }
        default:
          row[column] = text;
      }
    }
  }
  return row;
}

/** Deletes image files that a save replaced or removed, or all of a deleted row's images (pass `after` = null). */
export async function cleanupImages(entity: Entity, before: Record<string, unknown> | null, after: Record<string, unknown> | null) {
  if (!before) return;
  const stale = entity.fields
    .filter((f) => f.type === 'image')
    .map((f) => f.name)
    .filter((column) => before[column] && (after === null || (column in after && after[column] !== before[column])))
    .map((column) => String(before[column]));
  if (stale.length) await db().storage.from(MEDIA_BUCKET).remove(stale);
}

/* Deploy state lives in a local, gitignored file (a volume in Docker). */
const DATA_DIR = DASHBOARD_DATA_DIR || process.cwd();
const STATE_FILE = join(DATA_DIR, '.deploy-state.json');

interface DeployState {
  lastDeployAt: string | null;
  /** Rows deleted since the last deploy that are still visible on the live site. */
  pendingDeletions: number;
}

export async function readDeployState(): Promise<DeployState> {
  try {
    const state = JSON.parse(await readFile(STATE_FILE, 'utf8')) as Partial<DeployState>;
    return { lastDeployAt: state.lastDeployAt ?? null, pendingDeletions: state.pendingDeletions ?? 0 };
  } catch {
    return { lastDeployAt: null, pendingDeletions: 0 };
  }
}

async function writeDeployState(state: DeployState): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2));
}

export async function triggerDeploy(): Promise<void> {
  const hook = CF_DEPLOY_HOOK_URL;
  if (!hook) throw new Error('CF_DEPLOY_HOOK_URL fehlt in der .env.');
  const res = await fetch(hook, { method: 'POST' });
  if (!res.ok) throw new Error(`Cloudflare antwortete mit ${res.status} ${res.statusText}.`);
  await writeDeployState({ lastDeployAt: new Date().toISOString(), pendingDeletions: 0 });
}

/**
 * Remembers a deletion until the next deploy, but only if the row is still on the live site:
 * it was published and already existed at the last deploy.
 */
export async function recordDeletion(row: { published?: boolean; created_at?: string } | null): Promise<void> {
  if (!row?.published) return;
  const state = await readDeployState();
  if (state.lastDeployAt && row.created_at && row.created_at > state.lastDeployAt) return;
  await writeDeployState({ ...state, pendingDeletions: state.pendingDeletions + 1 });
}

/** Changes that are not on the live site yet: edited/created rows and deletions since the last deploy. */
export async function pendingChanges(state: DeployState): Promise<{ changed: number; deleted: number }> {
  const tables = ['apps', 'app_features', 'projects', 'news'];
  const counts = await Promise.all(
    tables.map(async (table) => {
      let query = db().from(table).select('id', { count: 'exact', head: true });
      if (state.lastDeployAt) query = query.gt('updated_at', state.lastDeployAt);
      const { count } = await query;
      return count ?? 0;
    }),
  );
  return { changed: counts.reduce((a, b) => a + b, 0), deleted: state.pendingDeletions };
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}
