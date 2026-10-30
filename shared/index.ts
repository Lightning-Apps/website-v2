// Shared row types and constants for the site and the dashboard.
// Mirrors supabase/migrations/0001_init.sql.

export const LOCALES = ['de', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const APP_STATUSES = ['available', 'coming_soon', 'in_development'] as const;
export type AppStatus = (typeof APP_STATUSES)[number];

export const PLATFORM_STATES = ['available', 'in_development', 'planned'] as const;
export type PlatformState = (typeof PLATFORM_STATES)[number];

export const PROJECT_STATUSES = ['active', 'coming_soon', 'archived'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const NEWS_CATEGORIES = ['release', 'update', 'studio'] as const;
export type NewsCategory = (typeof NEWS_CATEGORIES)[number];

export const MEDIA_BUCKET = 'media';

interface Row {
  id: string;
  published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Platform {
  name: string;
  state: PlatformState;
}

export interface AppRow extends Row {
  slug: string;
  name: string;
  tagline_de: string;
  tagline_en: string;
  description_de: string;
  description_en: string;
  body_de: string;
  body_en: string;
  icon_path: string | null;
  hero_path: string | null;
  accent_color: string;
  status: AppStatus;
  release_label_de: string;
  release_label_en: string;
  app_store_url: string | null;
  platforms: Platform[];
  featured: boolean;
}

export interface AppFeatureRow extends Row {
  app_id: string;
  title_de: string;
  title_en: string;
  text_de: string;
  text_en: string;
  image_path: string | null;
}

export interface ProjectRow extends Row {
  slug: string;
  name: string;
  description_de: string;
  description_en: string;
  url: string | null;
  status: ProjectStatus;
}

export interface NewsRow extends Row {
  slug: string;
  published_at: string;
  category: NewsCategory;
  title_de: string;
  title_en: string;
  summary_de: string;
  summary_en: string;
  body_de: string;
  body_en: string;
  cover_path: string | null;
  related_app_id: string | null;
}

/** Public URL of a file in the media bucket (paths are stored relative to the bucket). */
export function mediaUrl(supabaseUrl: string, path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`;
}

/** Picks the localized variant of a `<field>_de` / `<field>_en` column, falling back to German. */
export function pick<T extends object>(row: T, field: string, lang: Locale): string {
  const r = row as Record<string, unknown>;
  const value = r[`${field}_${lang}`];
  if (typeof value === 'string' && value.trim()) return value;
  const fallback = r[`${field}_de`];
  return typeof fallback === 'string' ? fallback : '';
}
