-- Scheduled releases: a selection of open changes that the dashboard publishes once, at a set time.
-- Only the selected changes go live; every other open change stays open.
create table public.scheduled_releases (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  run_at timestamptz not null,
  -- Selected changes: [{ key: "<entity>:<id>", entity, title }]. Titles are kept for the log.
  changes jsonb not null,
  -- pending → running → done | failed
  status text not null default 'pending' check (status in ('pending', 'running', 'done', 'failed')),
  started_at timestamptz,
  finished_at timestamptz,
  release_id bigint,
  message text
);

create index scheduled_releases_status_idx on public.scheduled_releases (status, run_at);

-- Dashboard only (secret key); the public key sees nothing.
alter table public.scheduled_releases enable row level security;
revoke all on public.scheduled_releases from anon, authenticated;
