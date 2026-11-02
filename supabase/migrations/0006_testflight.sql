-- TestFlight: public beta invitation link per app (null = no public beta) and an optional note.

alter table public.apps
  add column testflight_url text check (testflight_url like 'https://testflight.apple.com/join/%'),
  add column testflight_note_de text not null default '',
  add column testflight_note_en text not null default '';

-- Existing releases: give app rows the new columns (so they don't show up as changed).
update public.releases r set
  baseline = jsonb_set(r.baseline, '{apps}', coalesce((
    select jsonb_agg(a || '{"testflight_url": null, "testflight_note_de": "", "testflight_note_en": ""}'::jsonb)
    from jsonb_array_elements(r.baseline -> 'apps') a), '[]')),
  content = jsonb_set(r.content, '{apps}', coalesce((
    select jsonb_agg(a || '{"testflight_url": null, "testflight_note_de": "", "testflight_note_en": ""}'::jsonb)
    from jsonb_array_elements(r.content -> 'apps') a), '[]'));
