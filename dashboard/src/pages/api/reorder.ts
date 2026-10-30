import type { APIRoute } from 'astro';
import { getEntity } from '../../lib/entities';
import { db } from '../../lib/server';

const SORTABLE = new Set(['apps', 'projects', 'features']);

/**
 * Saves a new order: body { entity, ids, appId? } with ids in display order.
 * Only rows whose position actually changed are written (each write marks the row as an open change).
 */
export const POST: APIRoute = async ({ request }) => {
  const json = (status: number, body: object) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  let payload: { entity?: string; ids?: unknown; appId?: string };
  try {
    payload = await request.json();
  } catch {
    return json(400, { error: 'Ungültige Anfrage.' });
  }
  const entity = getEntity(payload.entity);
  const ids = payload.ids;
  if (!entity || !SORTABLE.has(entity.key) || !Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
    return json(400, { error: 'Ungültige Anfrage.' });
  }

  let query = db().from(entity.table).select('id, sort_order');
  if (entity.key === 'features') {
    if (!payload.appId) return json(400, { error: 'App fehlt.' });
    query = query.eq('app_id', payload.appId);
  }
  const { data: rows, error } = await query;
  if (error) return json(500, { error: error.message });

  // The list must match exactly what is in the database (no foreign or missing ids).
  const current = new Map(rows.map((r) => [r.id as string, r.sort_order as number]));
  if (ids.length !== current.size || ids.some((id) => !current.has(id))) {
    return json(409, { error: 'Die Liste ist veraltet. Bitte Seite neu laden.' });
  }

  const updates = (ids as string[])
    .map((id, index) => ({ id, sort_order: index + 1 }))
    .filter(({ id, sort_order }) => current.get(id) !== sort_order);
  for (const { id, sort_order } of updates) {
    const { error: updateError } = await db().from(entity.table).update({ sort_order }).eq('id', id);
    if (updateError) return json(500, { error: updateError.message });
  }
  return json(200, { ok: true, updated: updates.length });
};
