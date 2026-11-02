// Pricing texts derived from an app and its plans.
import { formatPrice, type Locale } from '@lightning/shared';
import type { App, Plan } from './content';
import { useTranslations } from '../i18n/ui';

/** Every app shows its price (no price means free); archived apps can't be downloaded anymore, so they show none. */
export function hasPricing(app: App): boolean {
  return !app.archived;
}

/** Short label like the App Store: "Kostenlos · In-App-Käufe", "4,99 €", "Kostenlos · Abo verfügbar". */
export function priceLabel(app: App, plans: Plan[], lang: Locale): string {
  const t = useTranslations(lang);
  const base = app.price_eur ? formatPrice(app.price_eur, lang) : t('price.free');
  const subscription = plans.some((p) => p.period !== 'once');
  const extra = subscription ? t('price.subscription') : app.has_iap || plans.length > 0 ? t('price.iap') : null;
  return [base, extra].filter(Boolean).join(' · ');
}

/** Saving of the yearly plan against twelve monthly payments, in percent (only when it is worth mentioning). */
export function yearlySaving(plan: Plan, plans: Plan[]): number | null {
  if (plan.period !== 'year') return null;
  const monthly = plans.filter((p) => p.period === 'month').map((p) => p.price_eur);
  if (!monthly.length) return null;
  const saving = Math.round((1 - plan.price_eur / (Math.min(...monthly) * 12)) * 100);
  return saving >= 5 ? saving : null;
}

/** Benefits of a plan, one per line. */
export function highlights(plan: Plan, lang: Locale): string[] {
  const text = (lang === 'en' && plan.highlights_en.trim()) || plan.highlights_de;
  return text.split('\n').map((line) => line.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
}
