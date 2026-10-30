import type { APIRoute } from 'astro';
import { triggerDeploy } from '../../lib/server';

export const POST: APIRoute = async ({ redirect }) => {
  try {
    await triggerDeploy();
    return redirect('/?deployed=1', 303);
  } catch (e) {
    return redirect(`/?error=${encodeURIComponent((e as Error).message)}`, 303);
  }
};
