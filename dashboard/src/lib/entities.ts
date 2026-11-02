import {
  APP_STATUSES,
  NEWS_CATEGORIES,
  PLAN_PERIODS,
  PLATFORM_STATES,
  PROJECT_STATUSES,
  type Platform,
} from '@lightning/shared';

export type FieldType =
  | 'text'
  | 'textarea'
  | 'markdown'
  | 'select'
  | 'checkbox'
  | 'number'
  /** Euros with cent, empty = null. */
  | 'price'
  /** Whole number, empty = null. */
  | 'count'
  | 'year'
  /** A sub-heading in the form; stores nothing. */
  | 'section'
  | 'date'
  | 'url'
  | 'color'
  | 'image'
  | 'platforms'
  | 'app';

export interface Field {
  name: string;
  label: string;
  type: FieldType;
  /** Stored as `<name>_de` and `<name>_en`. */
  i18n?: boolean;
  required?: boolean;
  options?: readonly { value: string; label: string }[];
  help?: string;
  /** Edited elsewhere (e.g. on the Startseite page): not in the form, but labelled in the change list. */
  formHidden?: boolean;
}

export interface Entity {
  key: EntityKey;
  table: string;
  label: string;
  singular: string;
  /** Column shown as the row title in lists. */
  titleField: string;
  orderBy: { column: string; ascending: boolean };
  fields: Field[];
  /** Shown as a sub-item of this entity in the sidebar. */
  parent?: EntityKey;
}

export type EntityKey = 'news' | 'apps' | 'projects' | 'features' | 'plans';

const opts = <T extends string>(values: readonly T[], labels: Record<T, string>) =>
  values.map((value) => ({ value, label: labels[value] }));

export const PLATFORM_NAMES = ['iOS', 'iPadOS', 'macOS', 'watchOS', 'tvOS', 'visionOS'] as const;
export const PLATFORM_STATE_LABELS: Record<Platform['state'], string> = {
  available: 'Verfügbar',
  in_development: 'In Entwicklung',
  planned: 'Geplant',
};

const published: Field = { name: 'published', label: 'Veröffentlicht', type: 'checkbox', help: 'Nur veröffentlichte Einträge erscheinen auf der Website.' };
const sortOrder: Field = { name: 'sort_order', label: 'Reihenfolge', type: 'number', help: 'Kleinere Zahl = weiter vorne.' };
// Apps and projects that are no longer worked on move from the main lists to the archive.
const archiveFields: Field[] = [
  { name: 'archive', label: 'Archiv', type: 'section', help: 'Für Einträge, an denen nicht mehr gearbeitet wird. Sie verschwinden dann aus den normalen Listen und erscheinen im Archiv.' },
  { name: 'archived', label: 'Archiviert', type: 'checkbox' },
  { name: 'active_from', label: 'Aktiv von (Jahr)', type: 'year' },
  { name: 'active_until', label: 'Aktiv bis (Jahr)', type: 'year' },
  { name: 'archive_note', label: 'Abschlussnotiz', type: 'textarea', i18n: true, help: 'Ein Satz fürs Archiv, z. B. warum es eingestellt wurde oder was daraus wurde.' },
];

export const PLAN_PERIOD_LABELS: Record<(typeof PLAN_PERIODS)[number], string> = {
  week: 'pro Woche',
  month: 'pro Monat',
  year: 'pro Jahr',
  once: 'einmalig (In-App-Kauf)',
};

const pricingFields: Field[] = [
  { name: 'pricing', label: 'Preise', type: 'section', help: 'Preise in Euro inkl. MwSt., wie im App Store. Abos und In-App-Freischaltungen legst du unten unter „Preispläne“ an.' },
  { name: 'price_eur', label: 'Kaufpreis (€)', type: 'price', help: 'Leer lassen, wenn der Download kostenlos ist.' },
  { name: 'has_iap', label: 'Enthält In-App-Käufe', type: 'checkbox', help: 'Wird automatisch angezeigt, sobald es Preispläne gibt.' },
  { name: 'trial_days', label: 'Kostenloser Testzeitraum (Tage)', type: 'count' },
  { name: 'family_sharing', label: 'Familienfreigabe', type: 'checkbox' },
  { name: 'pricing_note', label: 'Preishinweis', type: 'textarea', i18n: true, help: 'Optional, z. B. „Einführungspreis bis Ende Dezember“.' },
];

const slug: Field = { name: 'slug', label: 'Slug (URL)', type: 'text', required: true, help: 'Nur Kleinbuchstaben, Zahlen und Bindestriche, z. B. „mein-beitrag“.' };

export const ENTITIES: Record<EntityKey, Entity> = {
  news: {
    key: 'news',
    table: 'news',
    label: 'Newsroom',
    singular: 'Beitrag',
    titleField: 'title_de',
    orderBy: { column: 'published_at', ascending: false },
    fields: [
      { name: 'title', label: 'Titel', type: 'text', i18n: true, required: true },
      slug,
      { name: 'published_at', label: 'Datum', type: 'date', required: true },
      {
        name: 'category',
        label: 'Kategorie',
        type: 'select',
        options: opts(NEWS_CATEGORIES, { release: 'Release', update: 'Update', studio: 'Studio' }),
      },
      { name: 'summary', label: 'Kurzfassung', type: 'textarea', i18n: true },
      { name: 'body', label: 'Text', type: 'markdown', i18n: true },
      { name: 'cover_path', label: 'Titelbild', type: 'image' },
      { name: 'related_app_id', label: 'Zugehörige App', type: 'app' },
      published,
    ],
  },
  apps: {
    key: 'apps',
    table: 'apps',
    label: 'Apps',
    singular: 'App',
    titleField: 'name',
    orderBy: { column: 'sort_order', ascending: true },
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      slug,
      { name: 'tagline', label: 'Tagline', type: 'text', i18n: true },
      { name: 'description', label: 'Kurzbeschreibung', type: 'textarea', i18n: true },
      { name: 'body', label: 'Ausführliche Beschreibung', type: 'markdown', i18n: true },
      {
        name: 'status',
        label: 'Status',
        type: 'select',
        options: opts(APP_STATUSES, { available: 'Verfügbar', coming_soon: 'Demnächst', in_development: 'In Entwicklung' }),
      },
      { name: 'release_label', label: 'Status-Text', type: 'text', i18n: true, help: 'z. B. „Herbst 2026“ oder „Jetzt verfügbar“.' },
      { name: 'app_store_url', label: 'App-Store-Link', type: 'url' },
      { name: 'platforms', label: 'Plattformen', type: 'platforms' },
      { name: 'icon_path', label: 'App-Icon', type: 'image', help: 'Quadratisch, mind. 512 × 512 px.' },
      { name: 'hero_path', label: 'Hero-Bild', type: 'image', help: 'Großes Bild für Startseite und App-Seite (PNG mit transparentem Hintergrund wirkt am besten).' },
      { name: 'accent_color', label: 'Akzentfarbe', type: 'color' },
      { name: 'featured', label: 'Auf der Startseite präsentiert', type: 'checkbox', formHidden: true },
      { name: 'show_on_home', label: 'Auf der Startseite gezeigt', type: 'checkbox', formHidden: true },
      sortOrder,
      published,
      ...pricingFields,
      ...archiveFields,
    ],
  },
  features: {
    key: 'features',
    table: 'app_features',
    label: 'Funktionen',
    singular: 'Funktion',
    titleField: 'title_de',
    orderBy: { column: 'sort_order', ascending: true },
    // Own list page (src/pages/features/index.astro), grouped by app.
    parent: 'apps',
    fields: [
      { name: 'app_id', label: 'App', type: 'app', required: true },
      { name: 'title', label: 'Titel', type: 'text', i18n: true, required: true },
      { name: 'text', label: 'Text', type: 'textarea', i18n: true },
      { name: 'image_path', label: 'Bild / Screenshot', type: 'image' },
      sortOrder,
      { ...published, help: 'Erscheint nur, wenn auch die App veröffentlicht ist.' },
    ],
  },
  plans: {
    key: 'plans',
    table: 'app_plans',
    label: 'Preispläne',
    singular: 'Preisplan',
    titleField: 'name_de',
    orderBy: { column: 'sort_order', ascending: true },
    parent: 'apps',
    fields: [
      { name: 'app_id', label: 'App', type: 'app', required: true },
      { name: 'name', label: 'Name', type: 'text', i18n: true, required: true, help: 'z. B. „Bloom Plus“ oder „Pro freischalten“.' },
      { name: 'price_eur', label: 'Preis (€)', type: 'price', required: true },
      { name: 'period', label: 'Zeitraum', type: 'select', options: opts(PLAN_PERIODS, PLAN_PERIOD_LABELS) },
      { name: 'recommended', label: 'Empfohlen (wird hervorgehoben)', type: 'checkbox' },
      { name: 'highlights', label: 'Vorteile', type: 'textarea', i18n: true, help: 'Ein Vorteil pro Zeile.' },
      sortOrder,
      { ...published, help: 'Erscheint nur, wenn auch die App veröffentlicht ist.' },
    ],
  },
  projects: {
    key: 'projects',
    table: 'projects',
    label: 'Projekte',
    singular: 'Projekt',
    titleField: 'name',
    orderBy: { column: 'sort_order', ascending: true },
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      slug,
      { name: 'description', label: 'Beschreibung', type: 'textarea', i18n: true },
      { name: 'url', label: 'Link', type: 'url' },
      {
        name: 'status',
        label: 'Status',
        type: 'select',
        options: opts(PROJECT_STATUSES, { active: 'Aktiv', coming_soon: 'Demnächst' }),
      },
      sortOrder,
      published,
      ...archiveFields,
    ],
  },
};

export function getEntity(key: string | undefined): Entity | undefined {
  return key && key in ENTITIES ? ENTITIES[key as EntityKey] : undefined;
}

export { PLATFORM_STATES };

/** Entities that belong to an app (features, plans). */
export const APP_CHILDREN = Object.values(ENTITIES).filter((e) => e.parent === 'apps');
