# lightning apps – Website v2

Zwei Teile in einem Repo:

| Ordner | Was | Läuft wo |
| --- | --- | --- |
| `site/` | Öffentliche Website (Astro, komplett statisch, DE/EN) | Cloudflare Pages |
| `dashboard/` | Redaktions-Dashboard für Apps, Projekte, News | **nur lokal** auf deinem Mac |
| `supabase/` | Datenbank-Schema (`migrations/`) und Platzhalter-Inhalte (`seed.sql`) | Supabase-Projekt „Game Tracker“ (`dxftytekcnsmpbxxtxdx`) |
| `shared/` | Gemeinsame Typen und Helfer | – |

## So funktioniert's

1. Im **Dashboard** schreibst/änderst du Inhalte → sie landen in Supabase.
2. **„Website veröffentlichen“** ruft den Cloudflare Deploy Hook auf.
3. Cloudflare baut die Seite neu; beim Build liest Astro alle *veröffentlichten* Inhalte mit dem öffentlichen Key aus Supabase.
4. Nach 1–2 Minuten ist die neue Version online.

Die Website selbst hat weder Login noch Schreibzugriff. In Supabase erlaubt Row-Level Security dem öffentlichen Key nur das Lesen veröffentlichter Einträge; Schreiben geht ausschließlich mit dem `service_role`-Key, der nur in `dashboard/.env` auf deinem Rechner liegt.

## Einrichtung

Voraussetzung: **Node 26** (siehe `.node-version`; Astro 7 braucht ≥ 22.23).

```bash
npm install
```

**site/.env** (aus `site/.env.example`):

```
SUPABASE_URL=https://dxftytekcnsmpbxxtxdx.supabase.co
SUPABASE_ANON_KEY=sb_publishable_…   # Supabase → Project Settings → API Keys → Publishable key
```

**dashboard/.env** (aus `dashboard/.env.example`):

```
SUPABASE_URL=https://dxftytekcnsmpbxxtxdx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=…          # Supabase → Project Settings → API Keys → Secret key
CF_DEPLOY_HOOK_URL=…                 # Cloudflare → Pages-Projekt → Settings → Builds → Deploy hooks
SITE_URL=https://deine-domain.de
```

## Starten

```bash
npm run dev         # Website auf http://localhost:4321
npm run dashboard   # Dashboard auf http://127.0.0.1:4322
npm run build       # Website bauen (Ausgabe: site/dist)
```

## Cloudflare Pages

Pages-Projekt mit dem Git-Repo verbinden:

- **Framework preset:** Astro
- **Root directory:** `site`
- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Environment variables:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SITE_URL` (deine Domain), `NODE_VERSION=26`
- Danach unter *Settings → Builds → Deploy hooks* einen Hook anlegen und die URL in `dashboard/.env` eintragen.

## Einen News-Beitrag veröffentlichen

1. `npm run dashboard` → **Newsroom** → **+ Beitrag anlegen**.
2. Titel, Slug, Datum, Kategorie ausfüllen; Text in Markdown (Vorschau rechts). Über die Tabs **Deutsch / English** beide Sprachen pflegen – leere englische Felder zeigen automatisch den deutschen Text.
3. Optional Titelbild hochladen und eine zugehörige App wählen.
4. **Veröffentlicht** anhaken → **Speichern**.
5. **Website veröffentlichen** klicken.

Nicht angehakte Einträge bleiben Entwürfe und sind öffentlich unsichtbar.

## Texte, die im Code stehen

About-Us-Inhalte, Impressum, Datenschutz und alle UI-Texte stehen in `site/src/i18n/ui.ts` bzw. den Seiten unter `site/src/pages/[lang]/`. Die Kontaktadresse steht in `site/src/pages/[lang]/about.astro`.
