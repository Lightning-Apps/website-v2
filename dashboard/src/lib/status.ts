// Build status: which release the live website shows (its /build.json) and, with an API token,
// the state of the Cloudflare builds.
import { CF_ACCOUNT_ID, CF_API_TOKEN, CF_WORKER_NAME, SITE_URL } from 'astro:env/server';
import { latestReleaseInfo, type ReleaseInfo } from './publish';

export interface LiveInfo {
  release: number | null;
  builtAt: string;
}

export interface BuildInfo {
  uuid: string;
  status: 'queued' | 'initializing' | 'running' | 'stopped';
  outcome: string | null;
  createdOn: string | null;
  stoppedOn: string | null;
  /** "Dashboard", "Git-Push" … */
  trigger: string;
  commitMessage: string | null;
}

export interface SiteStatus {
  release: ReleaseInfo | null;
  live: LiveInfo | null;
  build: BuildInfo | null;
  /** Why the Cloudflare part is missing (no token, API error). */
  buildError: string | null;
  apiConfigured: boolean;
}

const API = 'https://api.cloudflare.com/client/v4';
let workerTag: string | undefined;

async function cf<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${CF_API_TOKEN}` },
    signal: AbortSignal.timeout(8000),
  });
  const body = (await res.json().catch(() => null)) as { success?: boolean; result?: T; errors?: { message: string }[] } | null;
  if (!res.ok || !body?.success) {
    throw new Error(body?.errors?.map((e) => e.message).join(', ') || `Cloudflare antwortete mit ${res.status}.`);
  }
  return body.result as T;
}

interface CfBuild {
  build_uuid: string;
  status: BuildInfo['status'];
  build_outcome?: string | null;
  created_on?: string | null;
  stopped_on?: string | null;
  deploy_hook?: { deploy_hook_name?: string } | null;
  build_trigger_metadata?: { build_trigger_source?: string; commit_message?: string | null } | null;
}

const TRIGGERS: Record<string, string> = {
  deploy_hook: 'Dashboard',
  api: 'Dashboard',
  push: 'Git-Push',
  manual: 'Manuell in Cloudflare',
  pull_request: 'Pull Request',
};

function toBuild(b: CfBuild): BuildInfo {
  const source = b.deploy_hook?.deploy_hook_name ? 'deploy_hook' : (b.build_trigger_metadata?.build_trigger_source ?? '');
  return {
    uuid: b.build_uuid,
    status: b.status,
    outcome: b.build_outcome ?? null,
    createdOn: b.created_on ?? null,
    stoppedOn: b.stopped_on ?? null,
    trigger: TRIGGERS[source] ?? (source || 'Unbekannt'),
    commitMessage: b.build_trigger_metadata?.commit_message ?? null,
  };
}

/** Newest build of the Worker; falls back to the build started with the release if listing is not allowed. */
async function latestBuild(release: ReleaseInfo | null): Promise<BuildInfo | null> {
  const account = CF_ACCOUNT_ID!;
  try {
    if (!workerTag) {
      const scripts = await cf<{ id: string; tag: string }[]>(`/accounts/${account}/workers/scripts`);
      workerTag = scripts.find((s) => s.id === (CF_WORKER_NAME || 'website-v2'))?.tag;
      if (!workerTag) throw new Error(`Worker „${CF_WORKER_NAME || 'website-v2'}“ nicht gefunden.`);
    }
    const builds = await cf<CfBuild[]>(`/accounts/${account}/builds/workers/${workerTag}/builds?page=1&per_page=1`);
    return builds[0] ? toBuild(builds[0]) : null;
  } catch (e) {
    if (!release?.build_uuid) throw e;
    return toBuild(await cf<CfBuild>(`/accounts/${account}/builds/builds/${release.build_uuid}`));
  }
}

async function liveInfo(): Promise<LiveInfo | null> {
  if (!SITE_URL) return null;
  try {
    // The query string gets past caches in between.
    const res = await fetch(new URL(`build.json?t=${Date.now()}`, SITE_URL.replace(/\/?$/, '/')), {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<LiveInfo>;
    return data.builtAt ? { release: data.release ?? null, builtAt: data.builtAt } : null;
  } catch {
    return null;
  }
}

export async function getSiteStatus(): Promise<SiteStatus> {
  const apiConfigured = Boolean(CF_ACCOUNT_ID && CF_API_TOKEN);
  const release = await latestReleaseInfo();
  const [live, build] = await Promise.all([
    liveInfo(),
    apiConfigured ? latestBuild(release).then((b) => ({ b, e: null }), (e: Error) => ({ b: null, e: e.message })) : null,
  ]);
  return {
    release,
    live,
    build: build?.b ?? null,
    buildError: apiConfigured ? (build?.e ?? null) : null,
    apiConfigured,
  };
}
