-- Navigation: up to four apps are listed in the "Our Apps" menu (the dashboard enforces the limit).

alter table public.apps add column show_in_nav boolean not null default false;

-- Start with the first four apps that are on the website now.
update public.apps set show_in_nav = true
where id in (select id from public.apps where published and not archived order by sort_order limit 4);

-- Existing releases: take over the values of the apps (so they don't show up as changed).
update public.releases r set
  baseline = jsonb_set(r.baseline, '{apps}', coalesce((
    select jsonb_agg(a || jsonb_build_object('show_in_nav', coalesce((select x.show_in_nav from public.apps x where x.id = (a ->> 'id')::uuid), false)))
    from jsonb_array_elements(r.baseline -> 'apps') a), '[]')),
  content = jsonb_set(r.content, '{apps}', coalesce((
    select jsonb_agg(a || jsonb_build_object('show_in_nav', coalesce((select x.show_in_nav from public.apps x where x.id = (a ->> 'id')::uuid), false)))
    from jsonb_array_elements(r.content -> 'apps') a), '[]'));
