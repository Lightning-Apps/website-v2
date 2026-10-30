-- lightning apps website: content tables, read-only public access, media bucket.
-- Writes happen only through the local dashboard with the service_role key.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.apps (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  tagline_de text not null default '',
  tagline_en text not null default '',
  description_de text not null default '',
  description_en text not null default '',
  body_de text not null default '',
  body_en text not null default '',
  icon_path text,
  hero_path text,
  accent_color text not null default '#0071e3',
  status text not null default 'in_development'
    check (status in ('available', 'coming_soon', 'in_development')),
  release_label_de text not null default '',
  release_label_en text not null default '',
  app_store_url text,
  platforms jsonb not null default '[]'::jsonb,
  featured boolean not null default false,
  published boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.app_features (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps (id) on delete cascade,
  title_de text not null default '',
  title_en text not null default '',
  text_de text not null default '',
  text_en text not null default '',
  image_path text,
  published boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index app_features_app_id_idx on public.app_features (app_id);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  description_de text not null default '',
  description_en text not null default '',
  url text,
  status text not null default 'active'
    check (status in ('active', 'coming_soon', 'archived')),
  published boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.news (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  published_at date not null default current_date,
  category text not null default 'update'
    check (category in ('release', 'update', 'studio')),
  title_de text not null default '',
  title_en text not null default '',
  summary_de text not null default '',
  summary_en text not null default '',
  body_de text not null default '',
  body_en text not null default '',
  cover_path text,
  related_app_id uuid references public.apps (id) on delete set null,
  published boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index news_related_app_id_idx on public.news (related_app_id);

create trigger apps_updated_at before update on public.apps
  for each row execute function public.set_updated_at();
create trigger app_features_updated_at before update on public.app_features
  for each row execute function public.set_updated_at();
create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();
create trigger news_updated_at before update on public.news
  for each row execute function public.set_updated_at();

-- Public access: read published rows only, never write.
alter table public.apps enable row level security;
alter table public.app_features enable row level security;
alter table public.projects enable row level security;
alter table public.news enable row level security;

revoke all on public.apps, public.app_features, public.projects, public.news from anon, authenticated;
grant select on public.apps, public.app_features, public.projects, public.news to anon;

create policy "Published apps are public" on public.apps
  for select to anon using (published);
create policy "Features of published apps are public" on public.app_features
  for select to anon using (
    published and exists (
      select 1 from public.apps a where a.id = app_id and a.published
    )
  );
create policy "Published projects are public" on public.projects
  for select to anon using (published);
create policy "Published news are public" on public.news
  for select to anon using (published);

-- Media bucket: public URLs for reading; no storage policies, so only service_role can write.
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;
