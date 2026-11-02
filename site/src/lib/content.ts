import { getCollection, type CollectionEntry } from 'astro:content';
import { marked } from 'marked';
import { mediaUrl } from '@lightning/shared';

export type App = CollectionEntry<'apps'>['data'];
export type Feature = CollectionEntry<'features'>['data'];
export type Plan = CollectionEntry<'plans'>['data'];
export type Project = CollectionEntry<'projects'>['data'];
export type News = CollectionEntry<'news'>['data'];

const bySort = <T extends { sort_order: number }>(a: T, b: T) => a.sort_order - b.sort_order;

/** All published apps, archived ones included (detail pages are built for both). */
export async function getAllApps(): Promise<App[]> {
  return (await getCollection('apps')).map((e) => e.data).sort(bySort);
}

/** Apps that are still worked on: navbar, home page, apps overview, footer. */
export async function getApps(): Promise<App[]> {
  return (await getAllApps()).filter((a) => !a.archived);
}

/** Apps in the "Our Apps" menu: the ones picked in the dashboard (at most four), or the first four. */
export async function getNavApps(): Promise<App[]> {
  const apps = await getApps();
  const picked = apps.filter((a) => a.show_in_nav);
  return (picked.length > 0 ? picked : apps).slice(0, 4);
}

export async function getArchivedApps(): Promise<App[]> {
  return (await getAllApps()).filter((a) => a.archived);
}

export async function getFeatures(appUuid: string): Promise<Feature[]> {
  return (await getCollection('features'))
    .map((e) => e.data)
    .filter((f) => f.app_id === appUuid)
    .sort(bySort);
}

export async function getPlans(appUuid: string): Promise<Plan[]> {
  return (await getCollection('plans'))
    .map((e) => e.data)
    .filter((p) => p.app_id === appUuid)
    .sort(bySort);
}

export async function getAllProjects(): Promise<Project[]> {
  return (await getCollection('projects')).map((e) => e.data).sort(bySort);
}

export async function getProjects(): Promise<Project[]> {
  return (await getAllProjects()).filter((p) => !p.archived);
}

export async function getArchivedProjects(): Promise<Project[]> {
  return (await getAllProjects()).filter((p) => p.archived);
}

export async function hasArchive(): Promise<boolean> {
  return (await getArchivedApps()).length > 0 || (await getArchivedProjects()).length > 0;
}

/** Newest first. */
export async function getNews(): Promise<News[]> {
  return (await getCollection('news'))
    .map((e) => e.data)
    .sort((a, b) => b.published_at.localeCompare(a.published_at) || a.sort_order - b.sort_order);
}

export function media(path: string | null | undefined): string | null {
  return mediaUrl(import.meta.env.SUPABASE_URL, path);
}

export function renderMarkdown(source: string): string {
  return marked.parse(source, { async: false });
}

/** The public TestFlight link, if the app has an open beta (archived apps have none). */
export function betaUrl(app: App): string | null {
  return app.archived ? null : app.testflight_url;
}
