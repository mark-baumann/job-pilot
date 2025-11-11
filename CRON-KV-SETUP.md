# Cron & KV Setup für job-pilot

## Wie es funktioniert (Datenfluss)

```
[Cron läuft täglich um 02:00 UTC]
    ↓
[/api/scrape-arbeitsagentur-cron: scrapet Arbeitsagentur]
    ↓
[speichert in Vercel KV: kv.set("jobs-cache", {...})]
    ↓
[Frontend lädt /api/get-jobs auf]
    ↓
[/api/get-jobs: liest kv.get("jobs-cache") aus]
    ↓
[PlaywrightRunner.tsx zeigt die Tabelle]
```

## Setup lokal (für Testen)

Damit du lokal testen kannst, brauchst du Vercel KV Credentials. Es gibt zwei Wege:

### Option A: Mit Vercel KV (empfohlen für Production)
1. Erstelle/aktiviere Vercel KV in deinem Vercel-Projekt (Vercel Dashboard → Add-ons).
2. Kopiere die KV-Connection Strings in dein Projekt:
   - `KV_URL`
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
   - `KV_REST_API_READ_ONLY_TOKEN`
3. Erstelle eine `.env.local` Datei im Root des Projekts:
   ```
   KV_URL=redis://...
   KV_REST_API_URL=https://...
   KV_REST_API_TOKEN=eyJh...
   KV_REST_API_READ_ONLY_TOKEN=eyJh...
   ```
4. Starte `npx vercel dev` — die KV-Verbindung wird automatisch geladen.

### Option B: Mit Upstash Redis (externe Lösung)
1. Gehe zu https://upstash.com/docs/redis/features/restapi und erstelle einen Redis-Namespace.
2. Kopiere die REST-URLs und Token in `.env.local` (wie oben).

## Testen lokal

Nach dem Setup kannst du den Flow so testen:

```bash
# Start dev server
npx vercel dev
```

In einem anderen Terminal:

```powershell
# Rufe den Cron manuell auf (jetzt ohne CRON_SECRET nötig)
Invoke-RestMethod -Uri "http://localhost:3000/api/scrape-arbeitsagentur-cron" -Method Post

# Prüfe ob Daten in KV gelandet sind (rufe /api/get-jobs auf)
Invoke-RestMethod -Uri "http://localhost:3000/api/get-jobs"
```

Wenn alles läuft, sieht die Antwort so aus:
```json
{
  "timestamp": 1234567890,
  "jobs": [
    {
      "title": "Senior Software Developer",
      "description": "...",
      "link": "...",
      "firma": "...",
      "arbeitsort": "..."
    },
    ...
  ]
}
```

## Für Production (Vercel Deploy)

1. Stelle sicher, dass Vercel KV in deinem Projekt aktiviert ist.
2. Das ist alles! Der Cron läuft automatisch täglich um 02:00 UTC (wie in `vercel.json` konfiguriert).
3. Vercel stellt die KV-Credentials automatisch über Environment Variables zur Verfügung.

## Troubleshooting

### 500 Fehler bei `/api/get-jobs` oder Cron
**Ursache:** Vercel KV ist nicht konfiguriert oder Credentials fehlen.  
**Fix:**
- Überprüfe in Vercel Dashboard, ob KV aktiviert ist.
- Für lokales Testen: Stelle sicher, dass `.env.local` vorhanden ist und die KV-Credentials enthält.

### Cron gibt `{ success: false, error: "..." }` zurück
**Ursache:** Meistens Fehler beim Scraping (Playwright-Fehler) oder KV-Fehler.  
**Fix:**
- Prüfe die Vercel Function Logs (Vercel Dashboard → Functions → Logs).
- Für lokal: Starte `npx vercel dev` und beobachte die Console-Ausgabe.

### `api/get-jobs` gibt `{ error: "Cache not available yet", jobs: [] }` zurück
**Ursache:** Der Cron ist noch nicht gelaufen oder KV ist leer.  
**Fix:**
- Rufe den Cron manuell auf (wie oben gezeigt).
- Warte bis die Cron-Ausführung abgeschlossen ist.

## Nächste Schritte

1. **Lokal:** Richte Vercel KV in deinem Vercel-Projekt ein und kopiere die `.env.local`.
2. **Test:** Starte `npx vercel dev` und teste den Cron + `/api/get-jobs` manuell.
3. **Deploy:** `git push` — Vercel deployed automatisch und der Cron läuft täglich um 02:00 UTC.
