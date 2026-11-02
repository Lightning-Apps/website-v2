-- Published states of the website. The site builds from the newest release only, so edits in the
-- content tables stay invisible until they are published from the dashboard.
--   content:  what the website shows (published rows only) – public.
--   baseline: all rows at publish time, drafts included – private; the dashboard compares against it.
create table public.releases (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  content jsonb not null,
  baseline jsonb not null,
  -- Summary of the changes published with this release (for the dashboard).
  changes jsonb not null default '[]',
  -- Cloudflare build started for this release (from the deploy hook response).
  build_uuid text
);

alter table public.releases enable row level security;
revoke all on public.releases from anon, authenticated;
-- Column grant: the public key can read the published content, never the drafts in `baseline`.
grant select (id, created_at, content) on public.releases to anon;
create policy "Releases are public" on public.releases for select to anon using (true);

-- First release: the current content, so the website looks the same after the switch.
insert into public.releases (content, baseline, changes)
with
  apps as (select * from public.apps),
  features as (select * from public.app_features),
  projects as (select * from public.projects),
  news as (select * from public.news),
  agg as (
    select
      (select coalesce(jsonb_agg(to_jsonb(a) order by a.sort_order), '[]') from apps a) as apps_all,
      (select coalesce(jsonb_agg(to_jsonb(f) order by f.sort_order), '[]') from features f) as features_all,
      (select coalesce(jsonb_agg(to_jsonb(p) order by p.sort_order), '[]') from projects p) as projects_all,
      (select coalesce(jsonb_agg(to_jsonb(n) order by n.published_at desc), '[]') from news n) as news_all,
      (select coalesce(jsonb_agg(to_jsonb(a) order by a.sort_order), '[]') from apps a where a.published) as apps_pub,
      (select coalesce(jsonb_agg(to_jsonb(f) order by f.sort_order), '[]') from features f
        where f.published and exists (select 1 from apps a where a.id = f.app_id and a.published)) as features_pub,
      (select coalesce(jsonb_agg(to_jsonb(p) order by p.sort_order), '[]') from projects p where p.published) as projects_pub,
      (select coalesce(jsonb_agg(to_jsonb(n) order by n.published_at desc), '[]') from news n where n.published) as news_pub
  )
select
  jsonb_build_object('apps', apps_pub, 'features', features_pub, 'projects', projects_pub, 'news', news_pub),
  jsonb_build_object('apps', apps_all, 'features', features_all, 'projects', projects_all, 'news', news_all),
  '[]'::jsonb
from agg;
