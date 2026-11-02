import type { APIRoute } from 'astro';
import { discard } from '../../lib/publish';
import { getEntity } from '../../lib/entities';

// Resets one entry to its published state, then reopens the change list.
export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  const entity = getEntity(String(form.get('entity')));
  const id = String(form.get('id') ?? '');
  if (!entity || !id) return new Response('Bad request', { status: 400 });
  try {
    const title = await discard(entity.key, id);
    return redirect(`/?changes=open&discarded=${encodeURIComponent(title)}`, 303);
  } catch (e) {
    return redirect(`/?changes=open&error=${encodeURIComponent(`Verwerfen fehlgeschlagen: ${(e as Error).message}`)}`, 303);
  }
};
