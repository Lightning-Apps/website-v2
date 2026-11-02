// Scheduled releases: a selection of open changes that goes live once, at a set time.
// Exactly the selected changes are published, in their state at that time; all other changes stay open.
import { DASHBOARD_SCHEDULER } from 'astro:env/server';
import type { EntityKey } from './entities';
import { getChangelog, publish, withDependencies } from './publish';
import { db, formatDateTime } from './server';

export interface ScheduledChange {
  key: string;
  entity: EntityKey;
  title: string;
}

export interface Schedule {
  id: number;
  created_at: string;
  run_at: string;
  changes: ScheduledChange[];
  status: 'pending' | 'running' | 'done' | 'failed';
  started_at: string | null;
  finished_at: string | null;
  release_id: number | null;
  message: string | null;
}

const TABLE = 'scheduled_releases';
/** Finished runs shown in the log. */
const LOG_SIZE = 20;
/** A run that takes longer than this was interrupted (e.g. container restart). */
const STALE_MS = 15 * 60_000;
/** A run this much after its time is reported as late. */
const LATE_MS = 5 * 60_000;

function check<T>({ data, error }: { data: T; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data;
}

/** Whether this dashboard runs due releases on its own (on the server: DASHBOARD_SCHEDULER=on). */
export const schedulerEnabled = () => DASHBOARD_SCHEDULER === 'on';

/** Value for a datetime-local input, in the server's time zone. */
export function toLocalInput(date: Date): string {
  return date.toLocaleString('sv-SE').slice(0, 16).replace(' ', 'T');
}

/** Parses a datetime-local value (server time zone); must lie in the future. */
export function parseRunAt(value: FormDataEntryValue | null): Date {
  const date = new Date(String(value ?? ''));
  if (Number.isNaN(date.getTime())) throw new Error('Bitte Datum und Uhrzeit angeben.');
  if (date.getTime() < Date.now() + 60_000) throw new Error('Der Zeitpunkt muss in der Zukunft liegen.');
  return date;
}

/** Upcoming and running releases (soonest first) and the latest finished ones. */
export async function listSchedules(): Promise<{ upcoming: Schedule[]; log: Schedule[] }> {
  const [upcoming, log] = await Promise.all([
    db().from(TABLE).select('*').in('status', ['pending', 'running']).order('run_at'),
    db().from(TABLE).select('*').in('status', ['done', 'failed']).order('finished_at', { ascending: false }).limit(LOG_SIZE),
  ]);
  return { upcoming: check(upcoming) as Schedule[], log: check(log) as Schedule[] };
}

/** Changes that belong to an upcoming release, with its time as text. */
export async function reservedKeys(): Promise<Map<string, string>> {
  const { upcoming } = await listSchedules();
  return new Map(upcoming.flatMap((s) => s.changes.map((c) => [c.key, `${formatDateTime(s.run_at)} Uhr`] as const)));
}

/** Upcoming release per change, for the change list. */
export async function scheduleByKey(): Promise<Map<string, Schedule>> {
  const { upcoming } = await listSchedules();
  return new Map(upcoming.flatMap((s) => s.changes.map((c) => [c.key, s] as const)));
}

export async function createSchedule(selection: string[], runAt: Date): Promise<Schedule> {
  const [{ entries }, reserved] = await Promise.all([getChangelog(), reservedKeys()]);
  const chosen = withDependencies(new Set(selection), entries);
  if (chosen.size === 0) throw new Error('Keine Änderung ausgewählt.');
  const taken = entries.filter((e) => chosen.has(e.key) && reserved.has(e.key));
  if (taken.length) throw new Error(taken.map((e) => `„${e.title}“ ist schon für ${reserved.get(e.key)} geplant.`).join(' '));
  const changes: ScheduledChange[] = entries.filter((e) => chosen.has(e.key)).map((e) => ({ key: e.key, entity: e.entity, title: e.title }));
  return check(await db().from(TABLE).insert({ run_at: runAt.toISOString(), changes }).select('*').single()) as Schedule;
}

async function pending(id: number): Promise<Schedule> {
  const row = check(await db().from(TABLE).select('*').eq('id', id).maybeSingle()) as Schedule | null;
  if (!row || row.status === 'running' || row.status === 'done') throw new Error('Diese Veröffentlichung läuft schon oder ist erledigt.');
  return row;
}

/** New time; also plans a failed release again. */
export async function reschedule(id: number, runAt: Date): Promise<void> {
  const row = await pending(id);
  if (row.status === 'failed') {
    const reserved = await reservedKeys();
    const taken = row.changes.filter((c) => reserved.has(c.key));
    if (taken.length) throw new Error(taken.map((c) => `„${c.title}“ ist inzwischen für ${reserved.get(c.key)} geplant.`).join(' '));
  }
  check(
    await db()
      .from(TABLE)
      .update({ run_at: runAt.toISOString(), status: 'pending', started_at: null, finished_at: null, message: null })
      .eq('id', id)
      .in('status', ['pending', 'failed']),
  );
}

/** Takes one change out of a release, together with the changes that only work with it. */
export async function removeChange(id: number, key: string): Promise<void> {
  const row = await pending(id);
  const { entries } = await getChangelog();
  const gone = new Set([key, ...row.changes.filter((c) => withDependencies(new Set([c.key]), entries).has(key)).map((c) => c.key)]);
  const changes = row.changes.filter((c) => !gone.has(c.key));
  if (changes.length === 0) return cancelSchedule(id);
  check(await db().from(TABLE).update({ changes }).eq('id', id).eq('status', row.status));
}

/** Drops the plan; the changes stay open. */
export async function cancelSchedule(id: number): Promise<void> {
  check(await db().from(TABLE).delete().eq('id', id).in('status', ['pending', 'failed']));
}

/** Claims a release for running; null if it is already taken (another tick, another dashboard). */
async function claim(id: number, dueOnly: boolean): Promise<Schedule | null> {
  let query = db().from(TABLE).update({ status: 'running', started_at: new Date().toISOString() }).eq('id', id).in('status', dueOnly ? ['pending'] : ['pending', 'failed']);
  if (dueOnly) query = query.lte('run_at', new Date().toISOString());
  return check(await query.select('*').maybeSingle()) as Schedule | null;
}

async function finish(id: number, values: Partial<Schedule>): Promise<void> {
  check(await db().from(TABLE).update({ ...values, finished_at: new Date().toISOString() }).eq('id', id));
}

async function execute(schedule: Schedule): Promise<void> {
  try {
    const { entries } = await getChangelog();
    const open = new Set(entries.map((e) => e.key));
    const keys = schedule.changes.map((c) => c.key).filter((k) => open.has(k));
    const gone = schedule.changes.length - keys.length;
    const notes = [
      gone > 0 && `${gone === 1 ? '1 Änderung war' : `${gone} Änderungen waren`} schon veröffentlicht oder verworfen.`,
      Date.parse(schedule.started_at!) - Date.parse(schedule.run_at) > LATE_MS && 'Verspätet, weil das Dashboard zur geplanten Zeit nicht lief.',
    ].filter(Boolean);
    if (keys.length === 0) {
      await finish(schedule.id, { status: 'done', message: ['Nichts mehr zu veröffentlichen.', ...notes].join(' ') });
      return;
    }
    const { published, release } = await publish(keys, { exact: true, newsDate: new Date().toLocaleDateString('sv-SE') });
    await finish(schedule.id, {
      status: 'done',
      release_id: release,
      message: [`${published === 1 ? '1 Änderung' : `${published} Änderungen`} veröffentlicht.`, ...notes].join(' '),
    });
  } catch (e) {
    await finish(schedule.id, { status: 'failed', message: (e as Error).message }).catch(() => {});
    throw e;
  }
}

/** Publishes a release right away (manually, before its time or after a failure). */
export async function runNow(id: number): Promise<void> {
  const schedule = await claim(id, false);
  if (!schedule) throw new Error('Diese Veröffentlichung läuft schon oder ist erledigt.');
  await execute(schedule);
}

let busy = false;

/** Runs all releases that are due, one after the other. */
export async function runDue(): Promise<void> {
  if (busy) return;
  busy = true;
  try {
    // Runs that never finished (container restart mid-run) are reported instead of hanging forever.
    await db()
      .from(TABLE)
      .update({ status: 'failed', finished_at: new Date().toISOString(), message: 'Unterbrochen. Bitte prüfen, ob die Änderungen online sind, und neu planen.' })
      .eq('status', 'running')
      .lt('started_at', new Date(Date.now() - STALE_MS).toISOString());
    const due = check(await db().from(TABLE).select('id').eq('status', 'pending').lte('run_at', new Date().toISOString()).order('run_at')) as { id: number }[];
    for (const { id } of due) {
      const schedule = await claim(id, true);
      if (schedule) await execute(schedule).catch((e) => console.error(`Geplante Veröffentlichung #${id} fehlgeschlagen:`, e));
    }
  } finally {
    busy = false;
  }
}

/** Checks for due releases every minute. Started once per process. */
export function startScheduler(): void {
  const g = globalThis as { __lightningScheduler?: boolean };
  if (!schedulerEnabled() || g.__lightningScheduler) return;
  g.__lightningScheduler = true;
  const tick = () => runDue().catch((e) => console.error('Zeitplan-Prüfung fehlgeschlagen:', e));
  setTimeout(tick, 5_000);
  setInterval(tick, 60_000);
}
