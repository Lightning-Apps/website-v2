import type { APIRoute } from 'astro';
import { publish } from '../../lib/publish';

// Publishes all open changes, or only the ones ticked in the change list (`mode=selected`).
export const POST: APIRoute = async ({ request, redirect }) => {
  try {
    const form = await request.formData();
    const selection = form.get('mode') === 'selected' ? form.getAll('change').map(String) : null;
    const { published, release } = await publish(selection);
    return redirect(`/?deployed=${release}&count=${published}`, 303);
  } catch (e) {
    return redirect(`/?error=${encodeURIComponent((e as Error).message)}`, 303);
  }
};
