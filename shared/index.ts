// Shared row types and constants for the site and the dashboard.
// Mirrors supabase/migrations/0001_init.sql.

export const LOCALES = ['de', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const APP_STATUSES = ['available', 'coming_soon', 'in_development'] as const;
export type AppStatus = (typeof APP_STATUSES)[number];

export const PLATFORM_STATES = ['available', 'in_development', 'planned'] as const;
export type PlatformState = (typeof PLATFORM_STATES)[number];

export const PROJECT_STATUSES = ['active', 'coming_soon'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const NEWS_CATEGORIES = ['release', 'update', 'studio'] as const;
export type NewsCategory = (typeof NEWS_CATEGORIES)[number];

export const PLAN_PERIODS = ['week', 'month', 'year', 'once'] as const;
export type PlanPeriod = (typeof PLAN_PERIODS)[number];

export const MEDIA_BUCKET = 'media';

interface Row {
  id: string;
  published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** Apps and projects that are no longer worked on; shown in the archive instead of the main lists. */
interface Archivable {
  archived: boolean;
  active_from: number | null;
  active_until: number | null;
  archive_note_de: string;
  archive_note_en: string;
}

export interface Platform {
  name: string;
  state: PlatformState;
}

export interface AppRow extends Row, Archivable {
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
  /** Presented in the homepage hero (at most one app). */
  featured: boolean;
  /** Shown as a tile on the homepage; always listed in the navigation and on the apps page. */
  show_on_home: boolean;
  /** Own position among the homepage tiles; null = the order of the apps list. */
  home_sort_order: number | null;
  /** Listed in the "Our Apps" menu (at most four). */
  show_in_nav: boolean;
  /** Purchase price in euros; null = free download. */
  price_eur: number | null;
  has_iap: boolean;
  trial_days: number | null;
  family_sharing: boolean;
  pricing_note_de: string;
  pricing_note_en: string;
  /** Public TestFlight invitation; null = no public beta. */
  testflight_url: string | null;
  testflight_note_de: string;
  testflight_note_en: string;
}

/** A subscription or in-app purchase of an app. */
export interface AppPlanRow extends Row {
  app_id: string;
  name_de: string;
  name_en: string;
  price_eur: number;
  period: PlanPeriod;
  recommended: boolean;
  /** One benefit per line. */
  highlights_de: string;
  highlights_en: string;
}

export interface AppFeatureRow extends Row {
  app_id: string;
  title_de: string;
  title_en: string;
  text_de: string;
  text_en: string;
  image_path: string | null;
}

export interface ProjectRow extends Row, Archivable {
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

/** "2021–2024", "seit 2021" / "since 2021", or "" when no years are set. */
export function activePeriod(row: Pick<Archivable, 'active_from' | 'active_until'>, lang: Locale): string {
  const { active_from: from, active_until: until } = row;
  if (from && until) return from === until ? String(from) : `${from}–${until}`;
  if (from) return `${lang === 'de' ? 'seit' : 'since'} ${from}`;
  if (until) return `${lang === 'de' ? 'bis' : 'until'} ${until}`;
  return '';
}

/** Picks the localized variant of a `<field>_de` / `<field>_en` column, falling back to German. */
export function pick<T extends object>(row: T, field: string, lang: Locale): string {
  const r = row as Record<string, unknown>;
  const value = r[`${field}_${lang}`];
  if (typeof value === 'string' && value.trim()) return value;
  const fallback = r[`${field}_de`];
  return typeof fallback === 'string' ? fallback : '';
}

/** "4,99 €" / "€4.99". */
export function formatPrice(eur: number, lang: Locale): string {
  return new Intl.NumberFormat(lang === 'de' ? 'de-DE' : 'en-IE', { style: 'currency', currency: 'EUR' }).format(eur);
}

/** Homepage tile order: the own order once one is set (apps without a position go last), otherwise the apps list order. */
export function byHomeOrder<T extends { sort_order: number; home_sort_order: number | null }>(a: T, b: T): number {
  return (a.home_sort_order ?? Infinity) - (b.home_sort_order ?? Infinity) || a.sort_order - b.sort_order;
}
