// Publishing and the list of changes that are not on the live website yet.
// On every publish we keep a snapshot of all content; open changes are the difference to it.
// State lives in local, gitignored files (a volume in Docker).
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CF_DEPLOY_HOOK_URL, DASHBOARD_DATA_DIR } from 'astro:env/server';
import { LOCALES } from '@lightning/shared';
import { ENTITIES, type Entity, type EntityKey } from './entities';
import { db } from './server';

const DATA_DIR = DASHBOARD_DATA_DIR || process.cwd();
const STATE_FILE = join(DATA_DIR, '.deploy-state.json');
const SNAPSHOT_FILE = join(DATA_DIR, '.deploy-snapshot.json');

/** Order of the groups in the change list. */
const ORDER: EntityKey[] = ['news', 'apps', 'features', 'projects'];

type Row = Record<string, unknown> & { id: string };
type Tables = Record<EntityKey, Row[]>;

interface DeployState {
  lastDeployAt: string | null;
  /** Deletions counted before snapshots existed (no details available). */
  pendingDeletions: number;
}

interface Snapshot {
  takenAt: string;
  tables: Partial<Tables>;
}

export interface ChangeEntry {
  entity: EntityKey;
  id: string;
  title: string;
  /** Parent app for features. */
  context: string | null;
  kind: 'new' | 'changed' | 'deleted';
  /** Labels of the changed fields (empty when unknown). */
  fields: string[];
  /** Edit page, or null for deleted rows. */
  href: string | null;
}

export interface Changelog {
  /** Changes that affect the live website. */
  entries: ChangeEntry[];
  /** Changes to entries that are not on the website (drafts before and after). */
  drafts: ChangeEntry[];
  /** Deletions without details (from before the first snapshot). */
  unnamedDeletions: number;
  /** False until the first publish with this version: changes are then guessed from timestamps. */
  exact: boolean;
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T;
  } catch {
    return null;
  }
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(file, JSON.stringify(value));
}

export async function readDeployState(): Promise<DeployState> {
  const state = await readJson<Partial<DeployState>>(STATE_FILE);
  return { lastDeployAt: state?.lastDeployAt ?? null, pendingDeletions: state?.pendingDeletions ?? 0 };
}

async function loadAll(): Promise<Tables> {
  const entries = await Promise.all(
    ORDER.map(async (key) => {
      const { data, error } = await db().from(ENTITIES[key].table).select('*');
      if (error) throw new Error(`Laden von ${ENTITIES[key].label} fehlgeschlagen: ${error.message}`);
      return [key, (data ?? []) as Row[]] as const;
    }),
  );
  return Object.fromEntries(entries) as Tables;
}

export async function triggerDeploy(): Promise<void> {
  const hook = CF_DEPLOY_HOOK_URL;
  if (!hook) throw new Error('CF_DEPLOY_HOOK_URL fehlt in der .env.');
  // Snapshot first, so it matches what the build is about to read.
  const tables = await loadAll();
  const res = await fetch(hook, { method: 'POST' });
  if (!res.ok) throw new Error(`Cloudflare antwortete mit ${res.status} ${res.statusText}.`);
  const now = new Date().toISOString();
  await writeJson(SNAPSHOT_FILE, { takenAt: now, tables } satisfies Snapshot);
  await writeJson(STATE_FILE, { lastDeployAt: now, pendingDeletions: 0 } satisfies DeployState);
}

/**
 * Before the first snapshot, deletions can only be counted: remember one if the row
 * was published and already existed at the last deploy.
 */
export async function recordDeletion(row: { published?: boolean; created_at?: string } | null): Promise<void> {
  if (!row?.published || (await readJson<Snapshot>(SNAPSHOT_FILE))) return;
  const state = await readDeployState();
  if (state.lastDeployAt && row.created_at && row.created_at > state.lastDeployAt) return;
  await writeJson(STATE_FILE, { ...state, pendingDeletions: state.pendingDeletions + 1 });
}

/** Database columns of an entity with readable labels, e.g. title_en → "Titel (EN)". */
function trackedColumns(entity: Entity) {
  return entity.fields
    .filter((f) => f.type !== 'section')
    .flatMap((f) =>
      f.i18n
        ? LOCALES.map((lang) => ({ column: `${f.name}_${lang}`, label: `${f.label} (${lang.toUpperCase()})` }))
        : [{ column: f.name, label: f.label }],
    );
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export async function getChangelog(): Promise<Changelog> {
  const [state, snapshot, current] = await Promise.all([readDeployState(), readJson<Snapshot>(SNAPSHOT_FILE), loadAll()]);

  const appNames = new Map<string, string>();
  for (const app of [...(snapshot?.tables.apps ?? []), ...current.apps]) appNames.set(app.id, String(app.name));

  const entries: ChangeEntry[] = [];
  const drafts: ChangeEntry[] = [];
  const add = (key: EntityKey, row: Row, kind: ChangeEntry['kind'], fields: string[], live: boolean) => {
    const entity = ENTITIES[key];
    const entry: ChangeEntry = {
      entity: key,
      id: row.id,
      title: String(row[entity.titleField] || '(ohne Titel)'),
      context: key === 'features' ? (appNames.get(String(row.app_id)) ?? null) : null,
      kind,
      fields,
      href: kind === 'deleted' ? null : `/${key}/${row.id}`,
    };
    (live ? entries : drafts).push(entry);
  };

  for (const key of ORDER) {
    const rows = current[key];
    if (snapshot) {
      const before = new Map((snapshot.tables[key] ?? []).map((r) => [r.id, r]));
      const columns = trackedColumns(ENTITIES[key]);
      for (const row of rows) {
        const old = before.get(row.id);
        before.delete(row.id);
        if (!old) {
          add(key, row, 'new', [], Boolean(row.published));
          continue;
        }
        const fields = columns.filter((c) => !same(row[c.column], old[c.column])).map((c) => c.label);
        if (fields.length) add(key, row, 'changed', fields, Boolean(row.published || old.published));
      }
      for (const old of before.values()) add(key, old, 'deleted', [], Boolean(old.published));
    } else {
      // No snapshot yet: everything touched since the last publish (or ever) counts.
      for (const row of rows) {
        if (state.lastDeployAt && String(row.updated_at) <= state.lastDeployAt) continue;
        const isNew = Boolean(state.lastDeployAt && String(row.created_at) > state.lastDeployAt);
        add(key, row, isNew ? 'new' : 'changed', [], Boolean(row.published));
      }
    }
  }

  return { entries, drafts, unnamedDeletions: snapshot ? 0 : state.pendingDeletions, exact: Boolean(snapshot) };
}
