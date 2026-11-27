# Die Weihnachtsstraße

Ein Adventskalender zum Spazierengehen: 24 echte Boxen mit QR-Code und dazu eine verschneite
3D-Straße mit 24 Häusern. Jeden Tag wacht ein weiteres Haus auf. Der QR-Code der Box ist der
Schlüssel zur Haustür – dahinter wartet ein Minispiel und danach die Überraschung in der Box.

```
QR-Code scannen → Haus entdecken → Selfie → Tür geht auf → Minispiel → Belohnung → Box öffnen
```

## Was schon da ist

- **Die Straße** (three.js): 24 Häuser, die aus einer Saat gewürfelt werden – Dachform, Farben,
  Fenster, Lichterketten, Deko und Schnee. Jedes Gerät sieht dieselbe Straße. Wischen läuft die
  Straße entlang, „Zum Baum schauen“ (oder zwei Finger) dreht den Blick bis zum Weihnachtsbaum.
- **Freischaltung**: Haus _n_ öffnet am _n_. Dezember um 0 Uhr Berliner Zeit und bleibt offen.
  Künftige Häuser sind zu sehen, schlafen aber noch (dunkle Fenster, gedimmte Lichter).
- **QR-Code als Schlüssel**: per Handykamera (öffnet die App direkt am richtigen Haus) oder mit
  dem Scanner in der App. Notfalls lässt sich der Code unter dem QR-Code abtippen.
- **Selfie**: wird vor dem Eintreten aufgenommen und hängt danach im Kranz am Haus.
- **Schnee-o-Meter**: Schneewahrscheinlichkeit für heute in Hamburg.
- **Minispiele**: In Haus 1 wohnt die Weihnachtsbäckerei: fünf Kuchen nach Vorlage an einer
  Backstraße aus Form, Creme, Glasur und Dekoration zusammensetzen. Ohne Zeitdruck, mit
  Korrekturmöglichkeit und gespeichertem Zwischenstand. Die anderen Häuser zeigen vorerst
  einen Platzhalter (siehe [Minispiel hinzufügen](#minispiel-hinzufügen)).

## Aufbau

```
backend/     API (Node, Express, TypeScript)      → Heroku
frontend/    App (Vite, React, three.js)          → Cloudflare Pages
scripts/     Startet beides zusammen für die Entwicklung
```

Eine Datenbank gibt es nicht: Die 24 Schlüssel werden aus einem Geheimnis (`QR_SECRET`)
abgeleitet, und alles Persönliche – aufgeschlossene Häuser, Spielstände, Selfies – liegt nur im
Browser des jeweiligen Geräts (localStorage und IndexedDB). Selfies verlassen das Gerät nie.

## Loslegen

Voraussetzung ist Node.js 24.

```sh
npm run setup   # installiert Backend und Frontend
npm run dev     # startet beide
```

Die App läuft dann unter <http://localhost:5180>, die API unter <http://localhost:2412>.

### Dev-Preview: Spiele und Screens direkt testen

Unter <http://localhost:5180/dev> gibt es eine Übersicht mit direkten Links zu allen Screens
und den 24 Spielplätzen. Die Vorschau verwendet dieselben Komponenten wie die App, läuft ohne
Backend und startet mit Beispieldaten. Datum und QR-Freischaltung sind vorbereitet; Fortschritt,
Spielstände und Selfies bleiben nur im Arbeitsspeicher dieses Aufrufs. Die echten Browserdaten
werden weder gelesen noch verändert. Neuladen oder „Zurücksetzen“ startet die jeweilige Vorschau neu.

| Route | Vorschau |
| ----- | -------- |
| `/dev/street` | Straße mit allen freigeschalteten Häusern |
| `/dev/house/1` | Hauskarte; mit `?status=locked`, `available`, `unlocked` oder `completed` |
| `/dev/scanner/1` | QR-Scanner und manuelle Codeeingabe |
| `/dev/selfie/1` | Selfie aufnehmen, bestätigen und ins Haus eintreten |
| `/dev/game/1` | Minispiel; `?completed=true` simuliert einen erneuten Besuch |
| `/dev/reward/1` | Belohnung und erneutes Spielen |
| `/dev/tree` | Offenes Tor und Weihnachtsbaum |

Die Tagesnummer kann jeweils von **1 bis 24** gewählt werden; Tag 24 ist das Tor. Über die
Auswahlleiste lassen sich Screen, Tag und Zustand wechseln. Beim Minispiel kann außerdem ein
gespeicherter Spielstand als JSON geladen werden. Neue Registry-Einträge erscheinen automatisch
in der Übersicht; noch nicht belegte Tage sind als Platzhalter markiert.

Der Testschlüssel im Scanner lautet **`ABCDEFGHJK`** (QR-Inhalt für Tag 1: `1.ABCDEFGHJK`).
Andere Schlüssel zeigen den Fehlerfall. Die Kamera wird tatsächlich verwendet; auf dem Handy
ist dafür HTTPS erforderlich (siehe Tunnel unten). Belohnungen und Wetterdaten sind Beispieldaten.
Selfies werden in der Vorschau nicht dauerhaft gespeichert.

**Erstes Spiel:** Unter <http://localhost:5180/dev/game/1> lässt sich die Weihnachtsbäckerei direkt
spielen. Die Pfeile bewegen den Kuchen zur nächsten bzw. vorherigen Station. Bereits erreichte
Stationen können auch direkt angewählt werden. Erst an der Abgabe wird mit der Vorlage verglichen;
falsche Zutaten können korrigiert werden. Nach fünf passenden Kuchen öffnet der Abschlussknopf die
Belohnung. „Kuchen neu beginnen“ setzt nur den aktuellen Kuchen zurück. „Noch einmal spielen“ startet
eine neue Runde; auch eine unterbrochene Wiederholung lässt sich fortsetzen. In der normalen App
wird der Zwischenstand auf dem Gerät gespeichert; in der Dev-Vorschau gilt weiterhin die oben
beschriebene Isolation.

Die Routen sind im lokalen Vite-Dev-Server aktiv. Normale Produktions-Builds aktivieren sie nicht.
Für einen separaten, teilbaren Vorschau-Build:

```sh
VITE_DEV_PREVIEW=true npm --prefix frontend run build
npm --prefix frontend run preview
```

Dann `/dev` unter der ausgegebenen Vorschau-Adresse öffnen. Bei Hosting auf einem anderen
Server muss dieser die SPA-Einstiegsdatei auch für `/dev/...` ausliefern (Cloudflare Pages macht
das bereits). `npm run preview` allein aktiviert die Routen eines normalen Builds nicht.

### Den Advent vorspulen

Vor dem 1. Dezember schlafen alle Häuser. Zum Ausprobieren `backend/.env` anlegen (Vorlage:
`backend/.env.example`) und ein Datum vortäuschen:

```ini
DEBUG_DATE=2026-12-12
```

### Schlüssel zum Testen

```sh
npm run qr
```

erzeugt die 24 QR-Codes samt Druckbogen in `backend/qr-codes/`. Ohne `QR_SECRET` passen sie zum
lokalen Server. Unter jedem QR-Code steht der Schlüssel – im Scanner über „Code eintippen“
eingeben oder den Link direkt öffnen, z. B. `http://localhost:5180/?k=5.WZ861Q6B7G`.

### Auf dem Handy testen

Browser geben die Kamera nur auf HTTPS-Seiten frei. Am einfachsten geht das mit einem Tunnel:

```sh
npx cloudflared tunnel --url http://localhost:5180
```

## Konfiguration

**Backend** (Umgebungsvariablen, lokal in `backend/.env`):

| Variable        | Bedeutung                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------- |
| `QR_SECRET`     | Geheimnis für die Türschlüssel. In Produktion Pflicht, mindestens 16 Zeichen.               |
| `CALENDAR_YEAR` | Jahr des Kalenders (Standard: 2026).                                                        |
| `FRONTEND_URL`  | Adresse der App – steht in den QR-Codes und ist als Herkunft für API-Aufrufe erlaubt.       |
| `CORS_ORIGINS`  | Optional: weitere erlaubte Herkünfte, kommagetrennt.                                        |
| `REWARDS_JSON`  | Optional: eigene Belohnungstexte, z. B. `{"1":"In Box 1 wartet etwas Süßes!"}`.             |
| `DEBUG_DATE`    | Nur zum Testen: tut so, als wäre heute dieses Datum (`JJJJ-MM-TT`).                         |
| `PORT`          | Port der API (lokal 2412, Heroku setzt ihn selbst).                                         |

**Frontend** (beim Bauen):

| Variable       | Bedeutung                                                                    |
| -------------- | ---------------------------------------------------------------------------- |
| `VITE_API_URL` | Adresse des Backends auf Heroku. Lokal leer lassen – Vite leitet `/api` um.  |

## Veröffentlichen

Beide Dienste bauen aus demselben Git-Repository
(`https://github.com/Straightforward-IT/Cedis-Adventskalender`). Veröffentlicht wird mit:

```sh
./scripts/deploy.sh "Was sich geändert hat"
```

Das Skript prüft Lint, Tests und Build, committet alles, pusht nach GitHub (Cloudflare Pages
baut daraufhin das Frontend) und – falls der Remote `heroku` eingerichtet ist – nach Heroku.

### Backend auf Heroku

```sh
heroku create <app-name> --region eu
heroku config:set QR_SECRET="$(openssl rand -base64 32)" CALENDAR_YEAR=2026 \
  FRONTEND_URL=https://adventskalender.bleck.it
git push heroku main
```

Heroku baut von der Wurzel des Repositorys: `heroku-postbuild` in der `package.json` kompiliert
das Backend, die `Procfile` startet es.

### Frontend auf Cloudflare Pages

Projekt mit dem Repository verbinden und einstellen:

| Einstellung        | Wert                                               |
| ------------------ | -------------------------------------------------- |
| Stammverzeichnis   | `frontend`                                         |
| Build-Befehl       | `npm run build`                                    |
| Ausgabeverzeichnis | `dist`                                             |
| Umgebungsvariablen | `VITE_API_URL=https://<app-name>.herokuapp.com`    |

Danach `adventskalender.bleck.it` als eigene Domain hinzufügen.

### QR-Codes für die Boxen drucken

Die Codes müssen mit **demselben** Geheimnis erzeugt werden, das auf Heroku liegt:

```sh
heroku config:get QR_SECRET        # in backend/.env als QR_SECRET eintragen
npm run qr                         # backend/qr-codes/druckbogen.html öffnen und drucken
```

Wer später neue Codes braucht (etwa fürs nächste Jahr), ändert `QR_SECRET` – die alten Codes
passen dann nicht mehr.

## Minispiel hinzufügen

Ein Minispiel ist eine React-Komponente, die im Inneren eines Hauses gezeichnet wird. Sie bekommt
`MinigameProps` (`frontend/src/minigames/types.ts`) und meldet mit `onComplete()`, dass sie gelöst
ist – danach erscheint die Belohnung. Verlieren oder Zeitdruck gibt es nicht; mit `saveState`
merkt sich ein Spiel seinen Zwischenstand, damit man später weiterspielen kann.

```tsx
// frontend/src/minigames/games/Quiz.tsx
import type { MinigameProps } from '../types.ts'

export default function Quiz({ onComplete }: MinigameProps) {
  return (
    <div>
      <h3>Wie viele Rentiere ziehen den Schlitten?</h3>
      <button className="button" onClick={onComplete}>
        Neun
      </button>
    </div>
  )
}
```

Dann in `frontend/src/minigames/registry.ts` einem Haus zuweisen:

```ts
const games: Partial<Record<number, MinigameDefinition>> = {
  1: { title: 'Rentier-Quiz', load: () => import('./games/Quiz.tsx') },
}
```

Jedes Spiel wird erst geladen, wenn sein Haus betreten wird.

## Befehle

| Befehl          | Wirkung                                             |
| --------------- | --------------------------------------------------- |
| `npm run dev`   | Backend und Frontend für die Entwicklung starten    |
| `npm test`      | Tests beider Teile                                  |
| `npm run lint`  | Code prüfen (oxlint)                                |
| `npm run build` | Beide Teile bauen (inklusive Typprüfung)            |
| `npm run qr`    | QR-Codes und Druckbogen erzeugen                    |

## Gut zu wissen

- **Fortschritt gilt pro Gerät.** Auf einem zweiten Handy müssen die Boxen erneut gescannt werden.
  Safari auf dem iPhone räumt außerdem die Daten von Seiten auf, die sieben Tage lang nicht besucht
  wurden – dann genügt ein erneuter Scan.
- **Die Straße ändern:** `STREET_SEED` in `frontend/src/scene/houseSpec.ts` würfelt alle 24 Häuser neu.
- **Wetterdaten** stammen von [Open-Meteo](https://open-meteo.com/). Die Schneewahrscheinlichkeit
  ist der Anteil der 40 Modellläufe des ICON-Ensembles, in denen es heute in Hamburg schneit.
