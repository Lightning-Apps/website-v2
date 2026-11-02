// Price overview texts for the dashboard (the website has its own, translated ones).
import { formatPrice } from '@lightning/shared';

type PricedApp = { price_eur: number | null; has_iap: boolean; trial_days: number | null; family_sharing: boolean };
type PricedPlan = { period: string; published: boolean };

/** The pricing model in a few words, e.g. "Einmalkauf · 4,99 €" or "Kostenlos mit Abo". */
export function pricingModel(app: PricedApp, plans: PricedPlan[]): string {
  const live = plans.filter((p) => p.published);
  const subscription = live.some((p) => p.period !== 'once');
  const iap = app.has_iap || live.some((p) => p.period === 'once');
  if (app.price_eur) return ['Einmalkauf', formatPrice(app.price_eur, 'de'), subscription ? 'mit Abo' : iap ? 'mit In-App-Käufen' : null].filter(Boolean).join(' · ');
  if (subscription) return 'Kostenlos mit Abo';
  if (iap) return 'Kostenlos mit In-App-Käufen';
  return 'Kostenlos';
}

/** Further details: plans, trial, family sharing. */
export function pricingDetails(app: PricedApp, plans: PricedPlan[]): string[] {
  const drafts = plans.filter((p) => !p.published).length;
  return [
    plans.length > 0 && `${plans.length} ${plans.length === 1 ? 'Preisplan' : 'Preispläne'}${drafts ? ` (${drafts} ausgeblendet)` : ''}`,
    app.trial_days && `${app.trial_days} Tage gratis testen`,
    app.family_sharing && 'Familienfreigabe',
  ].filter((x): x is string => Boolean(x));
}
