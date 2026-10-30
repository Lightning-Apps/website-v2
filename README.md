# Lightning Apps – Website v2

Zwei Teile in einem Repo:

| Ordner | Was | Läuft wo |
| --- | --- | --- |
| `site/` | Öffentliche Website (Astro, komplett statisch, DE/EN) | Cloudflare |
| `dashboard/` | Redaktions-Dashboard für Apps, Projekte, News | lokal auf deinem Mac oder als Docker-Container im Heimnetz |
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
CF_DEPLOY_HOOK_URL=…                 # Cloudflare → Projekt → Settings → Build → Deploy hooks
SITE_URL=https://deine-domain.de
```

## Starten

```bash
npm run dev         # Website auf http://localhost:4321
npm run dashboard   # Dashboard auf http://127.0.0.1:4322
npm run build       # Website bauen (Ausgabe: site/dist)
```

## Cloudflare

Das Projekt läuft als Cloudflare-Worker, der nur die statischen Dateien aus `site/dist` ausliefert (Konfiguration: `wrangler.jsonc`, der Projektname dort muss zum Namen in Cloudflare passen).

Projekt-Einstellungen (Workers & Pages → Projekt → Settings → Build):

- **Root directory:** `/` (Repo-Hauptordner – nicht `site`, weil die Website den Workspace `shared` braucht)
- **Build command:** `npm run build`
- **Deploy command:** `npx wrangler deploy`
- **Build-Variablen** (Settings → Build → Variables and secrets): `SUPABASE_URL`, `SUPABASE_ANON_KEY` (Publishable Key), `SITE_URL` (deine Domain), `NODE_VERSION=26`. Der Secret Key gehört **nicht** zu Cloudflare.
- Danach einen Deploy Hook anlegen und die URL als `CF_DEPLOY_HOOK_URL` ins Dashboard eintragen.

## Dashboard auf dem Homeserver (Docker)

Auf dem Server läuft das Dashboard als Container mit Passwort-Login. Es bleibt **nur im Heimnetz bzw. per VPN erreichbar** – den Port nicht im Router freigeben.

Auf der Ubuntu-VM (Docker + Compose vorhanden):

```bash
git clone https://github.com/Lightning-Apps/website-v2.git
cd website-v2
cp dashboard/.env.example dashboard/.env.server
```

Passwort-Hash und Session-Secret erzeugen (fragt das Passwort verdeckt ab, mind. 12 Zeichen; Node auf dem Server ist nicht nötig):

```bash
docker run --rm -it -v "$PWD/dashboard/scripts:/s:ro" node:26-alpine node /s/hash-password.mjs
```

In `dashboard/.env.server` eintragen:

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CF_DEPLOY_HOOK_URL`, `SITE_URL`
- die beiden ausgegebenen Zeilen `DASHBOARD_PASSWORD_HASH=…` und `DASHBOARD_SESSION_SECRET=…`
- `DASHBOARD_ALLOWED_HOSTS` – genau die Adressen, unter denen du das Dashboard aufrufst, mit Port, z. B. `192.168.1.20:4322,ubuntu-vm.local:4322`. Hinter einem Reverse Proxy mit eigener Domain: `dashboard.home.lan` (ohne Port).

Starten:

```bash
docker compose -f compose.dashboard.yml up -d --build
```

Danach `http://<IP-der-VM>:4322` öffnen. Die Zeitzone für Datumsangaben ist `Europe/Berlin`; ändern mit `DASHBOARD_TZ=Europe/Vienna` (als Umgebungsvariable beim Start oder in einer `.env` neben `compose.dashboard.yml`). Anderer Port: `DASHBOARD_PORT=8090 docker compose -f compose.dashboard.yml up -d` (dann den Port auch in `DASHBOARD_ALLOWED_HOSTS` anpassen).

Update nach neuen Commits:

```bash
git pull && docker compose -f compose.dashboard.yml up -d --build
```

Sicherheit im Überblick: Login mit scrypt-gehashtem Passwort, signiertes HttpOnly-Session-Cookie (14 Tage), Sperre nach 5 Fehlversuchen für 15 Minuten, nur erlaubte Hostnamen, Formulare nur von der eigenen Adresse, Container läuft als Nicht-Root mit schreibgeschütztem Dateisystem. Secrets werden zur Laufzeit gelesen und landen nie im Image.

## Einen News-Beitrag veröffentlichen

1. `npm run dashboard` → **Newsroom** → **+ Beitrag anlegen**.
2. Titel, Slug, Datum, Kategorie ausfüllen; Text in Markdown (Vorschau rechts). Über die Tabs **Deutsch / English** beide Sprachen pflegen – leere englische Felder zeigen automatisch den deutschen Text.
3. Optional Titelbild hochladen und eine zugehörige App wählen.
4. **Veröffentlicht** anhaken → **Speichern**.
5. **Website veröffentlichen** klicken.

Nicht angehakte Einträge bleiben Entwürfe und sind öffentlich unsichtbar.

## Texte, die im Code stehen

About-Us-Inhalte, Impressum, Datenschutz und alle UI-Texte stehen in `site/src/i18n/ui.ts` bzw. den Seiten unter `site/src/pages/[lang]/`. Die Kontaktadresse steht in `site/src/pages/[lang]/about.astro`.
