import { getEntry } from 'astro:content';

// Read by the dashboard to tell which release is live and when it was built.
export async function GET() {
  const meta = await getEntry('meta', 'release');
  return new Response(
    JSON.stringify({ release: meta?.data.release_id ?? null, releasedAt: meta?.data.created_at ?? null, builtAt: new Date().toISOString() }),
    { headers: { 'Content-Type': 'application/json' } },
  );
}
