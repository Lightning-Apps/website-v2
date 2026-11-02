// Releases: fixed states of the website. The site builds from the newest release only;
// the content tables are the working copy. Open changes are the difference between the two.
import { CF_DEPLOY_HOOK_URL } from 'astro:env/server';
import { LOCALES, MEDIA_BUCKET } from '@lightning/shared';
import { ENTITIES, type Entity, type EntityKey, type FieldType } from './entities';
import { db } from './server';

/** Order of the groups in the change list. */
const ORDER: EntityKey[] = ['news', 'apps', 'features', 'projects'];
/** Columns that change on every save and mean nothing to the website. */
const IGNORED = new Set(['id', 'created_at', 'updated_at']);
/** Releases kept for history; older ones are deleted on publish. */
const KEEP_RELEASES = 20;

export type Row = Record<string, unknown> & { id: string };
export type Tables = Record<EntityKey, Row[]>;

export interface ReleaseInfo {
  id: number;
  created_at: string;
  build_uuid: string | null;
}

interface Release extends ReleaseInfo {
  baseline: Partial<Tables>;
}

export interface ChangeEntry {
  /** `<entity>:<id>`, used for the selection when publishing. */
  key: string;
  entity: EntityKey;
  id: string;
  title: string;
  /** Parent app for features. */
  context: string | null;
  kind: 'new' | 'changed' | 'deleted';
  /** Labels of the changed fields. */
  fields: string[];
  /** Edit page, or null for deleted rows. */
  href: string | null;
  /** Other changes that have to be published together with this one. */
  requires: string[];
}

export interface Changelog {
  /** Changes that affect the website. */
  entries: ChangeEntry[];
  /** Changes to entries that are not on the website before or after (drafts). Published along automatically. */
  drafts: ChangeEntry[];
  release: ReleaseInfo | null;
}

export interface FieldChange {
  column: string;
  label: string;
  type: FieldType;
  before: unknown;
  after: unknown;
}

const keyOf = (entity: EntityKey, id: string) => `${entity}:${id}`;
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const emptyTables = (): Tables => ({ news: [], apps: [], features: [], projects: [] });

export async function loadAll(): Promise<Tables> {
  const entries = await Promise.all(
    ORDER.map(async (key) => {
      const { data, error } = await db().from(ENTITIES[key].table).select('*');
      if (error) throw new Error(`Laden von ${ENTITIES[key].label} fehlgeschlagen: ${error.message}`);
      return [key, (data ?? []) as Row[]] as const;
    }),
  );
  return Object.fromEntries(entries) as Tables;
}

async function latestRelease(): Promise<Release | null> {
  const { data, error } = await db()
    .from('releases')
    .select('id, created_at, build_uuid, baseline')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Laden des veröffentlichten Stands fehlgeschlagen: ${error.message}`);
  return data as Release | null;
}

export async function latestReleaseInfo(): Promise<ReleaseInfo | null> {
  const { data } = await db().from('releases').select('id, created_at, build_uuid').order('id', { ascending: false }).limit(1).maybeSingle();
  return data as ReleaseInfo | null;
}

function baselineOf(release: Release | null): Tables {
  return { ...emptyTables(), ...(release?.baseline ?? {}) };
}

/** Whether a row shows up on the website (features also need their app). */
function visible(key: EntityKey, row: Row | undefined, tables: Tables): boolean {
  if (!row?.published) return false;
  if (key !== 'features') return true;
  return tables.apps.some((app) => app.id === row.app_id && app.published);
}

/** What the website shows for a state: published rows only (or everything, for a preview with drafts). */
export function siteContent(tables: Tables, includeDrafts = false): Tables {
  const pick = (key: EntityKey) => tables[key].filter((row) => (includeDrafts ? key !== 'features' || tables.apps.some((a) => a.id === row.app_id) : visible(key, row, tables)));
  return { news: pick('news'), apps: pick('apps'), features: pick('features'), projects: pick('projects') };
}

/** Database columns with readable labels, e.g. title_en → "Titel (EN)". */
function columnInfo(entity: Entity) {
  const map = new Map<string, { label: string; type: FieldType }>();
  for (const f of entity.fields) {
    if (f.type === 'section') continue;
    if (f.i18n) for (const lang of LOCALES) map.set(`${f.name}_${lang}`, { label: `${f.label} (${lang.toUpperCase()})`, type: f.type });
    else map.set(f.name, { label: f.label, type: f.type });
  }
  return map;
}

function changedColumns(entity: Entity, before: Row, after: Row): FieldChange[] {
  const info = columnInfo(entity);
  const columns = new Set([...Object.keys(before), ...Object.keys(after)].filter((c) => !IGNORED.has(c)));
  // Form order first, unknown columns last.
  const ordered = [...info.keys(), ...[...columns].filter((c) => !info.has(c))].filter((c) => columns.has(c));
  return ordered
    .filter((c) => !same(before[c], after[c]))
    .map((c) => ({ column: c, label: info.get(c)?.label ?? c, type: info.get(c)?.type ?? 'text', before: before[c], after: after[c] }));
}

function diff(baseline: Tables, current: Tables): Omit<Changelog, 'release'> {
  const appNames = new Map<string, string>();
  for (const app of [...baseline.apps, ...current.apps]) appNames.set(app.id, String(app.name));

  const entries: ChangeEntry[] = [];
  const drafts: ChangeEntry[] = [];
  for (const key of ORDER) {
    const entity = ENTITIES[key];
    const before = new Map(baseline[key].map((r) => [r.id, r]));
    const after = new Map(current[key].map((r) => [r.id, r]));
    for (const id of new Set([...after.keys(), ...before.keys()])) {
      const old = before.get(id);
      const row = after.get(id);
      const kind: ChangeEntry['kind'] = !old ? 'new' : !row ? 'deleted' : 'changed';
      const fields = old && row ? changedColumns(entity, old, row).map((c) => c.label) : [];
      if (kind === 'changed' && fields.length === 0) continue;
      const shown = row ?? old!;
      const entry: ChangeEntry = {
        key: keyOf(key, id),
        entity: key,
        id,
        title: String(shown[entity.titleField] || '(ohne Titel)'),
        context: key === 'features' ? (appNames.get(String(shown.app_id)) ?? null) : null,
        kind,
        fields,
        href: row ? `/${key}/${id}` : null,
        requires: [],
      };
      const live = visible(key, row, current) || visible(key, old, baseline);
      (live ? entries : drafts).push(entry);
    }
  }

  // Dependencies: a feature of an app that is not on the website yet needs that app;
  // deleting an app also deletes its features.
  const byKey = new Map(entries.map((e) => [e.key, e]));
  for (const entry of entries) {
    if (entry.entity === 'features' && entry.kind !== 'deleted') {
      const appId = String(current.features.find((f) => f.id === entry.id)?.app_id);
      const appEntry = byKey.get(keyOf('apps', appId));
      if (appEntry && !visible('apps', baseline.apps.find((a) => a.id === appId), baseline)) entry.requires.push(appEntry.key);
    }
    if (entry.entity === 'apps' && entry.kind === 'deleted') {
      entry.requires.push(
        ...entries
          .filter((e) => e.entity === 'features' && e.kind === 'deleted' && baseline.features.find((f) => f.id === e.id)?.app_id === entry.id)
          .map((e) => e.key),
      );
    }
  }
  return { entries, drafts };
}

export async function getChangelog(): Promise<Changelog> {
  const [release, current] = await Promise.all([latestRelease(), loadAll()]);
  const { entries, drafts } = diff(baselineOf(release), current);
  return { entries, drafts, release: release && { id: release.id, created_at: release.created_at, build_uuid: release.build_uuid } };
}

/** One change with the values before (published) and after (now). */
export async function getChangeDetail(entityKey: EntityKey, id: string) {
  const entity = ENTITIES[entityKey];
  const [release, current] = await Promise.all([latestRelease(), loadAll()]);
  const baseline = baselineOf(release);
  const { entries, drafts } = diff(baseline, current);
  const entry = [...entries, ...drafts].find((e) => e.key === keyOf(entityKey, id));
  if (!entry) return null;
  const before = baseline[entityKey].find((r) => r.id === id);
  const after = current[entityKey].find((r) => r.id === id);
  // New and deleted entries list every filled field.
  const fields = changedColumns(entity, before ?? ({ id } as Row), after ?? ({ id } as Row));
  const apps = new Map([...baseline.apps, ...current.apps].map((a) => [a.id, String(a.name)]));
  return { entry, live: entries.includes(entry), fields, apps };
}

/** Selected changes plus everything they depend on. */
function withDependencies(selected: Set<string>, entries: ChangeEntry[]): Set<string> {
  const byKey = new Map(entries.map((e) => [e.key, e]));
  const result = new Set<string>();
  const add = (key: string) => {
    if (result.has(key) || !byKey.has(key)) return;
    result.add(key);
    byKey.get(key)!.requires.forEach(add);
  };
  selected.forEach(add);
  return result;
}

/**
 * Publishes the selected changes (all when `selection` is null) and starts a Cloudflare build.
 * Changes to drafts are always taken along: they do not change the website.
 */
export async function publish(selection: string[] | null): Promise<{ published: number; release: number }> {
  const hook = CF_DEPLOY_HOOK_URL;
  if (!hook) throw new Error('CF_DEPLOY_HOOK_URL fehlt in der .env.');

  const [release, current] = await Promise.all([latestRelease(), loadAll()]);
  const baseline = baselineOf(release);
  const { entries, drafts } = diff(baseline, current);
  const chosen = selection ? withDependencies(new Set(selection), entries) : new Set(entries.map((e) => e.key));
  const applied = [...entries.filter((e) => chosen.has(e.key)), ...drafts];

  const next: Tables = { news: [...baseline.news], apps: [...baseline.apps], features: [...baseline.features], projects: [...baseline.projects] };
  for (const change of applied) {
    const list = next[change.entity].filter((r) => r.id !== change.id);
    const row = current[change.entity].find((r) => r.id === change.id);
    next[change.entity] = row ? [...list, row] : list;
  }

  const { data: created, error } = await db()
    .from('releases')
    .insert({
      content: siteContent(next),
      baseline: next,
      changes: entries.filter((e) => chosen.has(e.key)).map(({ entity, id, title, kind }) => ({ entity, id, title, kind })),
    })
    .select('id')
    .single();
  if (error) throw new Error(`Speichern des neuen Stands fehlgeschlagen: ${error.message}`);

  let buildUuid: string | null = null;
  try {
    const res = await fetch(hook, { method: 'POST' });
    if (!res.ok) throw new Error(`Cloudflare antwortete mit ${res.status} ${res.statusText}.`);
    const body = (await res.json().catch(() => null)) as { result?: { build_uuid?: string } } | null;
    buildUuid = body?.result?.build_uuid ?? null;
  } catch (e) {
    // Without a build the release would never go live: take it back so nothing is marked as published.
    await db().from('releases').delete().eq('id', created.id);
    throw e;
  }
  await db().from('releases').update({ build_uuid: buildUuid }).eq('id', created.id);
  await db().from('releases').delete().lte('id', created.id - KEEP_RELEASES);
  // Cleanup must never make a publish fail.
  await removeUnusedImages([current, next, baseline]).catch((e) => console.error('Bilder aufräumen fehlgeschlagen:', e));
  return { published: entries.filter((e) => chosen.has(e.key)).length, release: created.id };
}

/** Resets one entry to its published state: undoes edits, removes new entries, restores deleted ones. */
export async function discard(entityKey: EntityKey, id: string): Promise<string> {
  const entity = ENTITIES[entityKey];
  const [release, current] = await Promise.all([latestRelease(), loadAll()]);
  const baseline = baselineOf(release);
  const old = baseline[entityKey].find((r) => r.id === id);
  const row = current[entityKey].find((r) => r.id === id);
  const title = String((old ?? row)?.[entity.titleField] || entity.singular);
  const check = ({ error }: { error: { message: string; code?: string } | null }) => {
    if (error) throw new Error(error.code === '23505' ? 'Der Slug ist inzwischen von einem anderen Eintrag belegt.' : error.message);
  };

  if (!old && row) {
    check(await db().from(entity.table).delete().eq('id', id));
  } else if (old && !row) {
    // A deleted feature needs its app; restoring an app also restores its deleted features.
    if (entityKey === 'features' && !current.apps.some((a) => a.id === old.app_id)) {
      await discard('apps', String(old.app_id));
      return title;
    }
    check(await db().from(entity.table).insert(old));
    if (entityKey === 'apps') {
      const missing = baseline.features.filter((f) => f.app_id === id && !current.features.some((c) => c.id === f.id));
      if (missing.length) check(await db().from(ENTITIES.features.table).insert(missing));
    }
  } else if (old && row) {
    const values = Object.fromEntries(Object.entries(old).filter(([c]) => !IGNORED.has(c)));
    check(await db().from(entity.table).update(values).eq('id', id));
  }
  return title;
}

/**
 * Deletes uploaded images that no state uses any more. Replaced images are kept until then,
 * so discarding a change can bring them back.
 */
async function removeUnusedImages(states: Tables[]): Promise<void> {
  const used = new Set<string>();
  for (const key of ORDER) {
    const columns = ENTITIES[key].fields.filter((f) => f.type === 'image').map((f) => f.name);
    for (const state of states) for (const row of state[key]) for (const c of columns) if (row[c]) used.add(String(row[c]));
  }
  // Keep fresh uploads: a form might be saving right now.
  const cutoff = Date.now() - 60 * 60 * 1000;
  const storage = db().storage.from(MEDIA_BUCKET);
  for (const folder of ORDER) {
    const { data, error } = await storage.list(folder, { limit: 1000 });
    if (error) throw error;
    const stale = (data ?? [])
      .filter((file) => file.id && !used.has(`${folder}/${file.name}`) && Date.parse(file.created_at ?? '') < cutoff)
      .map((file) => `${folder}/${file.name}`);
    if (stale.length) await storage.remove(stale);
  }
}
