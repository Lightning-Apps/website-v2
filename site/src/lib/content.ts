import { getCollection, type CollectionEntry } from 'astro:content';
import { marked } from 'marked';
import { mediaUrl } from '@lightning/shared';

export type App = CollectionEntry<'apps'>['data'];
export type Feature = CollectionEntry<'features'>['data'];
export type Project = CollectionEntry<'projects'>['data'];
export type News = CollectionEntry<'news'>['data'];

const bySort = <T extends { sort_order: number }>(a: T, b: T) => a.sort_order - b.sort_order;

export async function getApps(): Promise<App[]> {
  return (await getCollection('apps')).map((e) => e.data).sort(bySort);
}

export async function getFeatures(appUuid: string): Promise<Feature[]> {
  return (await getCollection('features'))
    .map((e) => e.data)
    .filter((f) => f.app_id === appUuid)
    .sort(bySort);
}

export async function getProjects(): Promise<Project[]> {
  return (await getCollection('projects')).map((e) => e.data).sort(bySort);
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
