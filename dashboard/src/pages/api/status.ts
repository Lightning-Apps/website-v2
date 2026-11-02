import type { APIRoute } from 'astro';
import { getSiteStatus } from '../../lib/status';

export const GET: APIRoute = async () => {
  try {
    return Response.json(await getSiteStatus(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
};
