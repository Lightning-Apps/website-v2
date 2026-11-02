# Lightning Apps – Website v2

Zwei Teile in einem Repo:

| Ordner | Was | Läuft wo |
| --- | --- | --- |
| `site/` | Öffentliche Website (Astro, komplett statisch, DE/EN) | Cloudflare |
| `dashboard/` | Redaktions-Dashboard für Apps, Projekte, News | lokal auf deinem Mac oder als Docker-Container im Heimnetz |
| `supabase/` | Datenbank-Schema (`migrations/`) und Platzhalter-Inhalte (`seed.sql`) | Supabase-Projekt „LA website“ (`dxftytekcnsmpbxxtxdx`) |
| `shared/` | Gemeinsame Typen und Helfer | – |

## So funktioniert's

1. Im **Dashboard** schreibst/änderst du Inhalte → sie landen in den Supabase-Tabellen (Arbeitsstand).
2. Die Übersicht zeigt alle **offenen Änderungen** gegenüber dem zuletzt veröffentlichten Stand. Jede lässt sich im Detail ansehen (vorher/nachher) und verwerfen.
3. **„Vorschau erstellen“** baut die Website mit dem Arbeitsstand im Dashboard und zeigt sie unter `/preview/` – nichts davon geht online.
4. **Veröffentlichen** (alles oder eine Auswahl) speichert einen neuen festen **Stand** in der Tabelle `releases` und ruft den Cloudflare Deploy Hook auf.
5. Cloudflare baut die Seite aus dem neuesten Stand. Die Übersicht zeigt den Build-Fortschritt und welcher Stand live ist (`/build.json` der Website).

Die Website baut **immer aus dem neuesten Stand**, nie direkt aus den Tabellen – auch ein Build nach einem Git-Push bringt also keine unveröffentlichten Änderungen online.

Die Website selbst hat weder Login noch Schreibzugriff. Der öffentliche Key darf nur den veröffentlichten Inhalt der Stände lesen; Entwürfe und Schreibzugriff gibt es ausschließlich mit dem `service_role`-Key im Dashboard. Ersetzte oder gelöschte Bilder bleiben bis zum nächsten Veröffentlichen gespeichert (damit Verwerfen funktioniert) und werden dann aufgeräumt.

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
CF_DEPLOY_HOOK_URL=…                 # Cloudflare → Worker → Settings → Builds → Deploy Hooks
SITE_URL=https://deine-domain.de

# Optional, für den Build-Fortschritt in der Übersicht:
CF_ACCOUNT_ID=…
CF_API_TOKEN=…
CF_WORKER_NAME=website-v2
```

Ohne `CF_ACCOUNT_ID`/`CF_API_TOKEN` zeigt die Übersicht nur, welcher Stand live ist. Mit Token siehst du zusätzlich die Build-Phase (Warteschlange, Vorbereitung, Build, Erfolg/Fehler), Dauer und Auslöser.

**API-Token anlegen:** Cloudflare → *My Profile* → *API Tokens* → *Create Token* → *Custom token*, Berechtigungen (Account): **Workers Builds Configuration – Read** und **Workers Scripts – Read**, nur für deinen Account. Die Account-ID steht im Cloudflare-Dashboard im Menü neben dem Account-Namen (*Copy account ID*). Das Token ist ein Secret und gehört nur in `dashboard/.env` bzw. `.env.server`.

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
- optional `CF_ACCOUNT_ID`, `CF_API_TOKEN`, `CF_WORKER_NAME` für den Build-Fortschritt
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

Sicherheit im Überblick: Login mit scrypt-gehashtem Passwort, signiertes HttpOnly-Session-Cookie (14 Tage), Sperre nach 5 Fehlversuchen für 15 Minuten, nur erlaubte Hostnamen, Formulare nur von der eigenen Adresse, Container läuft als Nicht-Root mit schreibgeschütztem Dateisystem. Secrets werden zur Laufzeit gelesen und landen nie im Image; der Vorschau-Build bekommt keine Dashboard-Secrets.

Die Vorschau wird im Container gebaut (braucht kurz etwa 300–500 MB RAM) und im Volume `dashboard-data` abgelegt; sie ist nur mit Login erreichbar.

## Einen News-Beitrag veröffentlichen

1. `npm run dashboard` → **Newsroom** → **+ Beitrag anlegen**.
2. Titel, Slug, Datum, Kategorie ausfüllen; Text in Markdown (Vorschau rechts). Über die Tabs **Deutsch / English** beide Sprachen pflegen – im englischen Tab steht der deutsche Text als Platzhalter, **„Aus Deutsch übernehmen“** kopiert ihn zum Übersetzen ins Feld. Leere englische Felder zeigen auf der Website den deutschen Text.
3. Optional Titelbild hochladen und eine zugehörige App wählen.
4. **Veröffentlicht** anhaken → **Speichern**.
5. Optional **Vorschau erstellen** und prüfen.
6. **Änderungen ansehen** → Auswahl veröffentlichen, oder **Alles veröffentlichen**.

Nicht angehakte Einträge bleiben Entwürfe und sind öffentlich unsichtbar.

## Veröffentlichung planen

Im Fenster **Offene Änderungen** die gewünschten Änderungen auswählen → **Planen …** → Datum und Uhrzeit → **Auswahl planen**. Zum Zeitpunkt veröffentlicht das Dashboard auf dem Heimserver genau diese Änderungen, in ihrer dann aktuellen Fassung (spätere Korrekturen gehen also mit), und startet einmal den Build. Alle anderen offenen Änderungen bleiben offen; geplante Änderungen werden beim sofortigen Veröffentlichen nicht mitgenommen. Neue Beiträge bekommen das Datum des Veröffentlichungstags.

Unter **Geplante Veröffentlichungen** lassen sich Termine verschieben, Änderungen herausnehmen, die Planung aufheben oder alles vorzeitig veröffentlichen; darunter steht ein Protokoll. Das Dashboard prüft jede Minute, ob etwas fällig ist. War der Server zum Zeitpunkt aus, wird nachgeholt, sobald er wieder läuft. Lokal (`npm run dashboard`) wird nicht automatisch veröffentlicht, außer mit `DASHBOARD_SCHEDULER=on` in `dashboard/.env`.

## Texte, die im Code stehen

About-Us-Inhalte und alle UI-Texte stehen in `site/src/i18n/ui.ts` bzw. den Seiten unter `site/src/pages/[lang]/`. Impressum und Datenschutz: `site/src/pages/[lang]/imprint.astro` und `privacy.astro`; Anbieterangaben und Kontaktadresse zentral in `site/src/lib/legal.ts`.
