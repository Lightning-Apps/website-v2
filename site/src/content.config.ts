import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { createClient } from '@supabase/supabase-js';
import {
  APP_STATUSES,
  NEWS_CATEGORIES,
  PLATFORM_STATES,
  PROJECT_STATUSES,
} from '@lightning/shared';

// Content is read once at build time with the public (read-only) key.
// RLS guarantees only published rows are returned.
const url = import.meta.env.SUPABASE_URL;
const key = import.meta.env.SUPABASE_ANON_KEY;
if (!url || !key) {
  throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set (see site/.env.example).');
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

async function fetchTable(table: string, idField: 'slug' | 'id' = 'slug') {
  const { data, error } = await supabase.from(table).select('*').order('sort_order');
  if (error) throw new Error(`Supabase: loading "${table}" failed: ${error.message}`);
  // `uuid` keeps the database id for relations; `id` is the collection key (the slug for pages).
  return (data ?? []).map((row) => ({ ...row, uuid: row.id, id: String(row[idField]) }));
}

const base = {
  id: z.string(),
  uuid: z.string(),
  sort_order: z.number(),
  updated_at: z.string(),
};

const apps = defineCollection({
  loader: () => fetchTable('apps'),
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
  }),
});

const features = defineCollection({
  loader: () => fetchTable('app_features', 'id'),
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
  loader: () => fetchTable('projects'),
  schema: z.object({
    ...base,
    slug: z.string(),
    name: z.string(),
    description_de: z.string(),
    description_en: z.string(),
    url: z.string().nullable(),
    status: z.enum(PROJECT_STATUSES),
  }),
});

const news = defineCollection({
  loader: () => fetchTable('news'),
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

export const collections = { apps, features, projects, news };
