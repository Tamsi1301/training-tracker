# Training

Persönliche Trainings-App für **Bouldern, Kraftsport und Laufen**: eine Web-App (PWA) für das iPhone.
Sie läuft komplett offline. Alle Daten bleiben auf dem Gerät, es gibt kein Konto und keine Cloud.

> Dieses Repository enthält **keine persönlichen Trainingsdaten**. Tests und Beispiele nutzen ausschließlich erfundene Daten.

---

## Auf dem iPhone installieren

1. Die App-Adresse in **Safari** öffnen: `https://tamsi1301.github.io/training-tracker/`
2. Unten auf **Teilen** tippen (Quadrat mit Pfeil nach oben).
3. **„Zum Home-Bildschirm“** wählen und mit **„Hinzufügen“** bestätigen.
4. Die App ab jetzt **immer über das Icon auf dem Home-Bildschirm** öffnen. Sie startet dann im Vollbild und funktioniert auch offline.

### Wichtig: getrennter Speicher

iOS gibt der installierten App einen **eigenen Speicher**, getrennt von Safari:

- Daten, die du im Safari-Tab einträgst, sind in der Home-Bildschirm-App **nicht** sichtbar, und umgekehrt.
- Nutze deshalb immer nur die installierte App.
- Wenn du die App vom Home-Bildschirm löschst, sind auch ihre Daten weg. **Vorher ein Backup exportieren!**

## Backup (regelmäßig!)

Die Daten liegen nur auf dem iPhone. So sicherst du sie:

1. **Einstellungen → Backup exportieren**
2. Im Teilen-Menü **„In Dateien sichern“** wählen, am besten in **iCloud Drive**.
3. Die Übersicht zeigt „Letztes Backup vor X Tagen“ und weist dich hin, wenn das länger als 14 Tage her ist.

**Wiederherstellen:** Einstellungen → **Backup importieren** → Datei wählen. Danach hast du zwei Möglichkeiten:
- **Zusammenführen:** Vorhandenes bleibt erhalten. Gleiche Einträge (gleiche ID) werden erkannt, und der neuere Stand gewinnt.
- **Ersetzen:** Alle Daten auf dem Gerät werden durch die Sicherung ersetzt.

## Handywechsel

1. Auf dem **alten** iPhone: Einstellungen → Backup exportieren → in iCloud Drive sichern.
2. Auf dem **neuen** iPhone: die App wie oben über Safari installieren und über das Home-Bildschirm-Icon öffnen.
3. Einstellungen → Backup importieren → Datei aus iCloud Drive wählen → **Ersetzen**.

## Altdaten per CSV importieren

Unter **Einstellungen → CSV-Vorlagen** gibt es je Sportart eine Vorlage. Importiert wird über **Einstellungen → CSV importieren**.

Für alle Vorlagen gilt: Semikolon `;` als Trennzeichen, Datum `TT.MM.JJJJ`, Dezimalkomma, UTF-8 (mit oder ohne BOM). Die Kopfzeile ist optional; erkannt wird sie am ersten Feld `datum`.

| Sportart | Spalten |
|---|---|
| Kraftsport | `datum;sportart;uebung;geraet_variante;satz;wiederholungen;gewicht_kg;dauer_min;notiz` |
| Bouldern | `datum;sportart;halle;halle_max_grad;session_max_grad;dauer_min;notiz` |
| Laufen | `datum;sportart;distanz_km;dauer;notiz` (Dauer als `h:mm:ss`) |
| Übungen-Zuordnung | `uebung;geraet_variante;anzahl_einheiten;muskelgruppe` |

**Kraftsport:**
- Eine Zeile pro Satz. Alle Zeilen eines Datums bilden eine Einheit.
- **Name + Gerät/Variante** ergeben zusammen eine Übung. „Hip thrusts“ und „Hip thrusts“ mit Variante „panatta“ sind also zwei Übungen mit eigenen Verläufen.
- Ein leeres `gewicht_kg` bedeutet Körpergewicht. Wiederholungen dürfen Dezimalzahlen sein (z. B. `2,25`).
- Steht kein `satz`, aber eine `dauer_min` in der Zeile, wird daraus ein zeitbasierter Satz (z. B. Plank).
- Fehlen `satz` und `dauer_min`, wird die Übung ohne Sätze angelegt. Die `notiz` gehört dann zur Übung.
- Sonst ist `notiz` die Notiz eines Satzes (z. B. „Myo 1“).

**Übungen-Zuordnung (`uebungen_zuordnung.csv`):**
- Ordnet jeder Übung (Name + Variante, Groß-/Kleinschreibung egal) genau eine Standard-Muskelgruppe zu.
- Erlaubt sind **Brust, Rücken, Schultern, Arme, Beine, Gesäß, Core, Ganzkörper**. Andere Begriffe (z. B. „Po“) meldet der Fehlerbericht, sie werden nicht stillschweigend umgedeutet.
- `anzahl_einheiten` wird nur in der Vorschau angezeigt und mit der Zahl in der App verglichen, aber nicht gespeichert.
- Die App erkennt die Datei beim „CSV importieren“ automatisch, mit oder ohne Kopfzeile.
- **Die Reihenfolge ist egal:** Kommt die Zuordnung nach dem Kraft-Import, wird der Fokus der Einheiten rückwirkend aus der Menge der Muskelgruppen ihrer Übungen abgeleitet. Liegt sie schon vor, setzt der Kraft-Import den Fokus direkt.
- Ein von Hand gewählter Fokus bleibt unverändert.
- Unter **Übungen verwalten** kannst du je Übung auch mehrere Muskelgruppen eintragen (z. B. Beinpresse: Beine und Gesäß). Unter **CSV-Vorlagen → Übungen-Zuordnung** gibt es eine Vorlage, die bereits alle deine Übungen samt Anzahl enthält.

Vor dem Import zeigt die App eine **Vorschau**: Anzahl der Einheiten, den Zeitraum, neue Übungen und Hallen, mögliche Dubletten (abschaltbar) und einen **Fehlerbericht mit Zeilennummer**. Fehlerhafte Zeilen werden übersprungen. Doppelte Schreibweisen von Übungen kannst du später unter **Einstellungen → Übungen verwalten → Zusammenführen** bereinigen.

## Kurze Testanleitung (echtes iPhone)

Das lässt sich nicht automatisch testen. Bitte einmal von Hand durchgehen:

- [ ] Safari → Teilen → „Zum Home-Bildschirm“. Das Icon zeigt ein goldenes „T“ auf Anthrazit.
- [ ] Die App über das Icon öffnen: Vollbild ohne Safari-Leisten, die Statusleiste ist lesbar, nichts liegt unter der Notch oder dem Home-Indikator.
- [ ] Je eine Einheit **Bouldern, Kraftsport und Laufen** anlegen. Bei Zahlenfeldern erscheint die Zahlentastatur mit Komma.
- [ ] Im Verlauf eine Einheit bearbeiten, löschen und mit **Rückgängig** wiederherstellen.
- [ ] **Flugmodus** an, App komplett schließen und neu öffnen: Sie startet, die Schrift stimmt, die Daten sind da.
- [ ] **Backup exportieren**: Das Teilen-Menü erscheint, „In Dateien sichern“ funktioniert.
- [ ] **Backup importieren** → Zusammenführen: Es meldet „0 neu“.
- [ ] Unter Einstellungen → Darstellung zwischen Hell und Dunkel wechseln.
- [ ] Die CSV-Vorlage für Kraftsport herunterladen und wieder importieren: Die Vorschau zeigt keine Fehler.

---

## Deployment auf GitHub Pages

Bei jedem Push auf `main` testet und baut der Workflow `.github/workflows/deploy.yml` die App und veröffentlicht sie automatisch.

**Einmalig in GitHub einstellen:**

1. Im Repository oben auf **Settings** gehen.
2. Links **Pages** wählen.
3. Unter **Build and deployment → Source** die Option **„GitHub Actions“** auswählen. Speichern ist nicht nötig, die Auswahl gilt sofort.
4. Den Code nach `main` bringen, z. B. indem du den Pull Request mergst.
5. Unter **Actions** den Lauf „Tests & Deployment (GitHub Pages)“ abwarten (grüner Haken).
6. Die Adresse steht danach unter **Settings → Pages** („Your site is live at …“).

Ein Update erreicht das iPhone beim nächsten Öffnen der App, spätestens beim übernächsten. Der Service Worker lädt die neue Version im Hintergrund.

## Entwicklung

```bash
npm install
```

```bash
npm run dev
```

```bash
npm test
```

```bash
npm run build
```

- **Stack:** Vite, TypeScript, Preact und Signals. Die Diagramme sind eigene SVGs, gespeichert wird in IndexedDB, Offline-Betrieb und Precache übernimmt `vite-plugin-pwa` (Workbox).
- **Name, Monogramm, Farben:** zentral in `src/config.ts`.
- **Icons:** `npm run icons` erzeugt alle PNGs in `public/icons/` neu (aus Monogramm und Farben). Ein eigenes Icon kannst du verwenden, indem du einfach die PNG-Dateien ersetzt.
- **Demodaten zum Ausprobieren:** `node scripts/demo-data.mjs demo.json` erzeugt eine Sicherung mit erfundenen Daten. Die Datei wird per `.gitignore` nicht eingecheckt.
- **Schrift:** Jost, lokal eingebunden (SIL Open Font License, siehe `src/assets/fonts/OFL-LICENSE.txt`).
- **Erweiterbarkeit:** Die IndexedDB ist versioniert (`src/lib/db.ts`). Wochenziele oder Ähnliches lassen sich später als eigener Store bzw. Meta-Eintrag ergänzen.

### Kernlogik und Tests (`tests/`)

| Bereich | Datei |
|---|---|
| Pace, Zahlen- und Dauerformat | `src/lib/pace.ts`, `src/lib/format.ts` |
| Zeiträume (Woche ab Montag, Monat, Jahr) | `src/lib/dates.ts` |
| Kennzahlen, Serien, Bestleistungen | `src/lib/stats.ts` |
| JSON-Sicherung, Zusammenführen | `src/lib/backup.ts` |
| CSV-Import und Vorlagen | `src/lib/csv.ts` |
| Muskelgruppen, Übungen-Zuordnung, Fokus | `src/lib/zuordnung.ts` |
