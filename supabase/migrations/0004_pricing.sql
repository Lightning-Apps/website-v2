-- Pricing: base price and options on apps, subscription / in-app plans in app_plans.
-- Prices are euros incl. VAT as shown in the App Store.

alter table public.apps
  add column price_eur numeric(10, 2) check (price_eur >= 0),
  add column has_iap boolean not null default false,
  add column trial_days int check (trial_days between 1 and 365),
  add column family_sharing boolean not null default false,
  add column pricing_note_de text not null default '',
  add column pricing_note_en text not null default '';

create table public.app_plans (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps (id) on delete cascade,
  name_de text not null default '',
  name_en text not null default '',
  price_eur numeric(10, 2) not null check (price_eur >= 0),
  -- 'once' = one-time in-app purchase (e.g. "Unlock Pro")
  period text not null default 'month' check (period in ('week', 'month', 'year', 'once')),
  recommended boolean not null default false,
  -- One benefit per line.
  highlights_de text not null default '',
  highlights_en text not null default '',
  published boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index app_plans_app_id_idx on public.app_plans (app_id);
create trigger app_plans_updated_at before update on public.app_plans
  for each row execute function public.set_updated_at();

-- The website reads releases only; plans are written and read by the dashboard (service role).
alter table public.app_plans enable row level security;
revoke all on public.app_plans from anon, authenticated;

-- Existing releases: give app rows the new columns (so they don't show up as changed) and add an empty plan list.
update public.releases r set
  baseline = jsonb_set(r.baseline, '{apps}', coalesce((
    select jsonb_agg(a || '{"price_eur": null, "has_iap": false, "trial_days": null, "family_sharing": false, "pricing_note_de": "", "pricing_note_en": ""}'::jsonb)
    from jsonb_array_elements(r.baseline -> 'apps') a), '[]')) || '{"plans": []}'::jsonb,
  content = jsonb_set(r.content, '{apps}', coalesce((
    select jsonb_agg(a || '{"price_eur": null, "has_iap": false, "trial_days": null, "family_sharing": false, "pricing_note_de": "", "pricing_note_en": ""}'::jsonb)
    from jsonb_array_elements(r.content -> 'apps') a), '[]')) || '{"plans": []}'::jsonb;
