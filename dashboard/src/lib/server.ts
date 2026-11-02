// Server-only helpers. The service_role key never leaves this process.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from 'astro:env/server';
import { LOCALES, MEDIA_BUCKET, PLATFORM_STATES, type Platform } from '@lightning/shared';
import { PLATFORM_NAMES, type Entity, type Field } from './entities';

let client: SupabaseClient | undefined;

export function configError(): string | null {
  if (!SUPABASE_URL) return 'SUPABASE_URL fehlt in der .env.';
  if (!SUPABASE_SERVICE_ROLE_KEY) return 'SUPABASE_SERVICE_ROLE_KEY fehlt in der .env.';
  return null;
}

export function db(): SupabaseClient {
  const error = configError();
  if (error) throw new Error(error);
  client ??= createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export function mediaPublicUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return db().storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
}

async function uploadImage(file: File, folder: string): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error(`„${file.name}“ ist kein Bild.`);
  const ext = (file.name.split('.').pop() ?? 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
  const base = file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'bild';
  const path = `${folder}/${Date.now()}-${base}.${ext}`;
  const { error } = await db().storage.from(MEDIA_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`Upload fehlgeschlagen: ${error.message}`);
  return path;
}

/** Turns a submitted form into a row for the entity's table (uploads images on the way). */
export async function formToRow(entity: Entity, form: FormData): Promise<Record<string, unknown>> {
  const row: Record<string, unknown> = {};
  const columns = (f: Field) => (f.i18n ? LOCALES.map((l) => `${f.name}_${l}`) : [f.name]);

  for (const field of entity.fields) {
    for (const column of columns(field)) {
      const raw = form.get(column);
      const text = typeof raw === 'string' ? raw.trim() : '';
      switch (field.type) {
        case 'checkbox':
          row[column] = form.get(column) === 'on';
          break;
        case 'section':
          break;
        case 'year': {
          const year = Number.parseInt(text, 10);
          row[column] = Number.isFinite(year) ? year : null;
          break;
        }
        case 'number':
          row[column] = Number.parseInt(text, 10) || 0;
          break;
        case 'price': {
          // Accepts "4,99", "4.99" and "4,99 €".
          const value = Number.parseFloat(text.replace(/[^\d,.-]/g, '').replace(',', '.'));
          if (text && !(Number.isFinite(value) && value >= 0)) throw new Error(`„${text}“ ist kein gültiger Preis.`);
          row[column] = text ? Math.round(value * 100) / 100 : null;
          break;
        }
        case 'count': {
          const value = Number.parseInt(text, 10);
          row[column] = Number.isFinite(value) && value > 0 ? value : null;
          break;
        }
        case 'url':
        case 'app':
          row[column] = text || null;
          break;
        case 'image': {
          const file = form.get(`${column}__file`);
          if (form.get(`${column}__remove`) === 'on') row[column] = null;
          else if (file instanceof File && file.size > 0) row[column] = await uploadImage(file, entity.key);
          // Otherwise keep the existing value (column not sent).
          break;
        }
        case 'platforms': {
          const platforms: Platform[] = [];
          for (const name of PLATFORM_NAMES) {
            if (form.get(`platform_${name}`) !== 'on') continue;
            const state = String(form.get(`platform_${name}_state`));
            platforms.push({ name, state: (PLATFORM_STATES as readonly string[]).includes(state) ? (state as Platform['state']) : 'planned' });
          }
          row[column] = platforms;
          break;
        }
        default:
          row[column] = text;
      }
    }
  }
  return row;
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}
