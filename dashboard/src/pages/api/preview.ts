import type { APIRoute } from 'astro';
import { previewState, startPreview } from '../../lib/preview';

export const GET: APIRoute = async () => Response.json(await previewState(), { headers: { 'Cache-Control': 'no-store' } });

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData().catch(() => new FormData());
  startPreview(form.get('drafts') === 'on');
  return Response.json(await previewState());
};
