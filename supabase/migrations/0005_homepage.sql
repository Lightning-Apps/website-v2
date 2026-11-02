-- Homepage: which apps appear as tiles, and at most one app presented in the hero.

alter table public.apps add column show_on_home boolean not null default true;

-- Keep only the first featured app (by sort order), then allow at most one.
update public.apps set featured = false
where featured and id <> (select id from public.apps where featured order by sort_order, created_at limit 1);
create unique index apps_one_featured_idx on public.apps ((true)) where featured;

-- Existing releases: give app rows the new column (so they don't show up as changed).
update public.releases r set
  baseline = jsonb_set(r.baseline, '{apps}', coalesce((
    select jsonb_agg(a || '{"show_on_home": true}'::jsonb) from jsonb_array_elements(r.baseline -> 'apps') a), '[]')),
  content = jsonb_set(r.content, '{apps}', coalesce((
    select jsonb_agg(a || '{"show_on_home": true}'::jsonb) from jsonb_array_elements(r.content -> 'apps') a), '[]'));
