-- Homepage: own tile order (null = the order of the apps list).

alter table public.apps add column home_sort_order int;

-- Existing releases: give app rows the new column (so they don't show up as changed).
update public.releases r set
  baseline = jsonb_set(r.baseline, '{apps}', coalesce((
    select jsonb_agg(a || '{"home_sort_order": null}'::jsonb) from jsonb_array_elements(r.baseline -> 'apps') a), '[]')),
  content = jsonb_set(r.content, '{apps}', coalesce((
    select jsonb_agg(a || '{"home_sort_order": null}'::jsonb) from jsonb_array_elements(r.content -> 'apps') a), '[]'));
