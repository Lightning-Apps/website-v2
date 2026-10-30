-- Placeholder content (DE/EN). Replace everything via the local dashboard.

insert into public.apps (slug, name, tagline_de, tagline_en, description_de, description_en, body_de, body_en,
  accent_color, status, release_label_de, release_label_en, platforms, featured, published, sort_order)
values
  ('aurora', 'Aurora',
   'Dein Tag. Klar strukturiert.', 'Your day. Clearly organized.',
   'Platzhalter: Aurora bündelt Termine, Aufgaben und Notizen in einer ruhigen Oberfläche.',
   'Placeholder: Aurora brings events, tasks and notes together in one calm interface.',
   E'Aurora ist eine **Platzhalter-App**. Ersetze diesen Text im Dashboard.\n\nHier steht später die ausführliche Beschreibung.',
   E'Aurora is a **placeholder app**. Replace this text in the dashboard.\n\nThe detailed description goes here.',
   '#5e5ce6', 'available', 'Jetzt verfügbar', 'Available now',
   '[{"name":"iOS","state":"available"},{"name":"iPadOS","state":"available"},{"name":"macOS","state":"planned"}]',
   true, true, 1),
  ('pulse', 'Pulse',
   'Bleib in Bewegung.', 'Keep moving.',
   'Platzhalter: Pulse begleitet dich bei Training und Alltag.',
   'Placeholder: Pulse accompanies you through workouts and everyday life.',
   E'Pulse ist eine **Platzhalter-App**.', E'Pulse is a **placeholder app**.',
   '#ff375f', 'coming_soon', 'Herbst 2026', 'Fall 2026',
   '[{"name":"iOS","state":"in_development"},{"name":"watchOS","state":"planned"}]',
   false, true, 2),
  ('atlas', 'Atlas',
   'Die Welt, kartiert.', 'The world, mapped.',
   'Platzhalter: Atlas hilft dir, Orte zu entdecken und Routen zu planen.',
   'Placeholder: Atlas helps you discover places and plan routes.',
   E'Atlas ist eine **Platzhalter-App**.', E'Atlas is a **placeholder app**.',
   '#30d158', 'in_development', 'In Entwicklung', 'In development',
   '[{"name":"iOS","state":"in_development"},{"name":"visionOS","state":"planned"}]',
   false, true, 3);

insert into public.app_features (app_id, title_de, title_en, text_de, text_en, sort_order)
select a.id, f.title_de, f.title_en, f.text_de, f.text_en, f.sort_order
from public.apps a
cross join (values
  ('Alles auf einen Blick', 'Everything at a glance', 'Platzhalter-Feature mit kurzer Beschreibung.', 'Placeholder feature with a short description.', 1),
  ('Durchdacht bis ins Detail', 'Thoughtful in every detail', 'Noch ein Platzhalter-Feature.', 'Another placeholder feature.', 2),
  ('Privat by Design', 'Private by design', 'Deine Daten bleiben auf deinem Gerät.', 'Your data stays on your device.', 3)
) as f(title_de, title_en, text_de, text_en, sort_order);

insert into public.projects (slug, name, description_de, description_en, url, status, published, sort_order)
values
  ('open-source-kit', 'Open Source Kit',
   'Platzhalter: Eine Sammlung kleiner Open-Source-Werkzeuge.',
   'Placeholder: A collection of small open-source tools.',
   'https://github.com/', 'active', true, 1),
  ('hardware-lab', 'Hardware Lab',
   'Platzhalter: Experimente mit Arduino und Co.',
   'Placeholder: Experiments with Arduino and friends.',
   null, 'coming_soon', true, 2);

insert into public.news (slug, published_at, category, title_de, title_en, summary_de, summary_en, body_de, body_en, related_app_id, published)
values
  ('willkommen-neue-website', '2026-10-30', 'studio',
   'Willkommen auf der neuen Website', 'Welcome to the new website',
   'lightning apps hat ein neues Zuhause im Netz.', 'lightning apps has a new home on the web.',
   E'Platzhalter-Beitrag. **Markdown** funktioniert hier.\n\n- Punkt eins\n- Punkt zwei',
   E'Placeholder post. **Markdown** works here.\n\n- Point one\n- Point two',
   null, true),
  ('aurora-update', '2026-10-15', 'update',
   'Aurora erhält ein großes Update', 'Aurora gets a big update',
   'Neue Funktionen für mehr Überblick.', 'New features for a better overview.',
   'Platzhalter-Beitrag zu einem App-Update.', 'Placeholder post about an app update.',
   (select id from public.apps where slug = 'aurora'), true),
  ('pulse-ankuendigung', '2026-09-20', 'release',
   'Pulse kommt im Herbst', 'Pulse arrives this fall',
   'Ein erster Blick auf unsere nächste App.', 'A first look at our next app.',
   'Platzhalter-Beitrag zur Ankündigung.', 'Placeholder announcement post.',
   (select id from public.apps where slug = 'pulse'), true),
  ('entwurf-beispiel', '2026-10-30', 'update',
   'Entwurf (nicht öffentlich)', 'Draft (not public)',
   'Dieser Beitrag ist ein Entwurf.', 'This post is a draft.',
   'Entwurf.', 'Draft.', null, false);
