-- News URLs carry the post's date (/newsroom/20260101/<slug>/), so a slug only has to be unique per day.
alter table public.news drop constraint news_slug_key;
alter table public.news add constraint news_published_at_slug_key unique (published_at, slug);
