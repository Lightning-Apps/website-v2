import type { APIRoute } from 'astro';
import { cancelSchedule, createSchedule, parseRunAt, removeChange, reschedule, runNow } from '../../lib/schedule';

// Scheduled releases: plan a selection from the change list, move, shorten, cancel or run one now.
export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  const action = String(form.get('_action') ?? '');
  const id = Number(form.get('id'));
  try {
    switch (action) {
      case 'create': {
        const schedule = await createSchedule(form.getAll('change').map(String), parseRunAt(form.get('run_at')));
        return redirect(`/geplant/?done=created#s-${schedule.id}`, 303);
      }
      case 'reschedule':
        await reschedule(id, parseRunAt(form.get('run_at')));
        return redirect(`/geplant/?done=moved#s-${id}`, 303);
      case 'remove':
        await removeChange(id, String(form.get('key') ?? ''));
        return redirect(`/geplant/?done=removed#s-${id}`, 303);
      case 'cancel':
        await cancelSchedule(id);
        return redirect('/geplant/?done=cancelled', 303);
      case 'run':
        await runNow(id);
        return redirect('/geplant/?done=run', 303);
      default:
        return new Response('Bad request', { status: 400 });
    }
  } catch (e) {
    const message = encodeURIComponent((e as Error).message);
    // Planning starts in the change list: go back there with the error.
    return redirect(action === 'create' ? `/?changes=open&error=${message}` : `/geplant/?error=${message}`, 303);
  }
};
