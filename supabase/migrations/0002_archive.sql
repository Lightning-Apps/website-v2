-- Archive: apps and projects that are no longer worked on stay visible in a separate archive.

alter table public.apps
  add column archived boolean not null default false,
  add column active_from int check (active_from between 1990 and 2100),
  add column active_until int check (active_until between 1990 and 2100),
  add column archive_note_de text not null default '',
  add column archive_note_en text not null default '';

alter table public.projects
  add column archived boolean not null default false,
  add column active_from int check (active_from between 1990 and 2100),
  add column active_until int check (active_until between 1990 and 2100),
  add column archive_note_de text not null default '',
  add column archive_note_en text not null default '';

-- "archived" used to be a project status; it is a separate flag now.
update public.projects set archived = true, status = 'active' where status = 'archived';

do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.projects'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%status%'
  loop
    execute format('alter table public.projects drop constraint %I', c);
  end loop;
end $$;

alter table public.projects
  add constraint projects_status_check check (status in ('active', 'coming_soon'));
