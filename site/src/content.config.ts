import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { createClient } from '@supabase/supabase-js';
import {
  APP_STATUSES,
  NEWS_CATEGORIES,
  PLAN_PERIODS,
  PLATFORM_STATES,
  PROJECT_STATUSES,
} from '@lightning/shared';

import { readFile } from 'node:fs/promises';

// The website shows the newest release: a fixed state written by the dashboard's "Publish".
// Edits in the content tables stay invisible until they are published.
// The dashboard's preview passes the content as a file instead (PREVIEW_CONTENT_FILE).
type Rows = Record<string, unknown>[];
interface Release {
  id: number | null;
  created_at: string;
  content: Record<'apps' | 'features' | 'plans' | 'projects' | 'news', Rows>;
}

let release: Promise<Release> | undefined;

async function fetchRelease(): Promise<Release> {
  const previewFile = process.env.PREVIEW_CONTENT_FILE;
  if (previewFile) return JSON.parse(await readFile(previewFile, 'utf8')) as Release;

  const url = import.meta.env.SUPABASE_URL;
  const key = import.meta.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set (see site/.env.example).');
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supabase
    .from('releases')
    .select('id, created_at, content')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Supabase: loading the release failed: ${error.message}`);
  if (!data) throw new Error('Supabase: no release yet. Publish once from the dashboard.');
  return data as Release;
}

async function rows(key: keyof Release['content'], idField: 'slug' | 'id' = 'slug') {
  release ??= fetchRelease();
  const list = (await release).content[key] ?? [];
  // `uuid` keeps the database id for relations; `id` is the collection key (the slug for pages).
  return [...list]
    .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
    .map((row) => ({ ...row, uuid: String(row.id), id: String(row[idField]) }));
}

const archive = {
  archived: z.boolean(),
  active_from: z.number().nullable(),
  active_until: z.number().nullable(),
  archive_note_de: z.string(),
  archive_note_en: z.string(),
};

const base = {
  id: z.string(),
  uuid: z.string(),
  sort_order: z.number(),
  updated_at: z.string(),
};

const apps = defineCollection({
  loader: () => rows('apps'),
  schema: z.object({
    ...base,
    slug: z.string(),
    name: z.string(),
    tagline_de: z.string(),
    tagline_en: z.string(),
    description_de: z.string(),
    description_en: z.string(),
    body_de: z.string(),
    body_en: z.string(),
    icon_path: z.string().nullable(),
    hero_path: z.string().nullable(),
    accent_color: z.string(),
    status: z.enum(APP_STATUSES),
    release_label_de: z.string(),
    release_label_en: z.string(),
    app_store_url: z.string().nullable(),
    platforms: z.array(z.object({ name: z.string(), state: z.enum(PLATFORM_STATES) })),
    featured: z.boolean(),
    show_on_home: z.boolean().default(true),
    home_sort_order: z.number().nullable().default(null),
    show_in_nav: z.boolean().default(true),
    // Pricing (defaults for releases from before pricing existed)
    price_eur: z.number().nullable().default(null),
    has_iap: z.boolean().default(false),
    trial_days: z.number().nullable().default(null),
    family_sharing: z.boolean().default(false),
    pricing_note_de: z.string().default(''),
    pricing_note_en: z.string().default(''),
    // TestFlight (defaults for releases from before it existed)
    testflight_url: z.string().nullable().default(null),
    testflight_note_de: z.string().default(''),
    testflight_note_en: z.string().default(''),
    ...archive,
  }),
});

const plans = defineCollection({
  loader: () => rows('plans', 'id'),
  schema: z.object({
    ...base,
    app_id: z.string(),
    name_de: z.string(),
    name_en: z.string(),
    price_eur: z.number(),
    period: z.enum(PLAN_PERIODS),
    recommended: z.boolean(),
    highlights_de: z.string(),
    highlights_en: z.string(),
  }),
});

const features = defineCollection({
  loader: () => rows('features', 'id'),
  schema: z.object({
    ...base,
    app_id: z.string(),
    title_de: z.string(),
    title_en: z.string(),
    text_de: z.string(),
    text_en: z.string(),
    image_path: z.string().nullable(),
  }),
});

const projects = defineCollection({
  loader: () => rows('projects'),
  schema: z.object({
    ...base,
    slug: z.string(),
    name: z.string(),
    description_de: z.string(),
    description_en: z.string(),
    url: z.string().nullable(),
    status: z.enum(PROJECT_STATUSES),
    ...archive,
  }),
});

const news = defineCollection({
  loader: () => rows('news'),
  schema: z.object({
    ...base,
    slug: z.string(),
    published_at: z.string(),
    category: z.enum(NEWS_CATEGORIES),
    title_de: z.string(),
    title_en: z.string(),
    summary_de: z.string(),
    summary_en: z.string(),
    body_de: z.string(),
    body_en: z.string(),
    cover_path: z.string().nullable(),
    related_app_id: z.string().nullable(),
  }),
});

// Which release this build shows (written to /build.json for the dashboard).
const meta = defineCollection({
  loader: async () => {
    release ??= fetchRelease();
    const { id, created_at } = await release;
    return [{ id: 'release', release_id: id, created_at }];
  },
  schema: z.object({ id: z.string(), release_id: z.number().nullable(), created_at: z.string() }),
});

export const collections = { apps, features, plans, projects, news, meta };
