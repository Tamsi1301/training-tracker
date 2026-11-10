# SPEC: Trainings-Tracker (PWA für iPhone)

Arbeitstitel: **Training** (Name leicht änderbar, zentral in einer Konfigurationsdatei halten).

## 1. Ziel
Eine persönliche Trainings-App für **ein iPhone**, die ich während und nach dem Training bediene. Sportarten: **Bouldern, Kraftsport, Laufen**. Dazu ein Dashboard mit Zusammenfassung und Fortschritt für **Woche, Monat und Jahr**. Die App soll sehr hochwertig und ästhetisch aussehen.

## 2. Technische Vorgaben
- **PWA, rein statisch, kein Backend, keine Konten, kein Cloud-Sync.** Alle Daten liegen lokal im Browser (**IndexedDB**).
- Läuft **vollständig offline** (Service Worker, alle Assets inklusive Schrift lokal, keine Abhängigkeit von CDNs zur Laufzeit).
- **iOS-Home-Bildschirm-Installation** über Safari: Web-App-Manifest, `apple-touch-icon` (180×180), `apple-mobile-web-app-capable`, passende Status-Bar-Einstellung, Safe-Area-Insets beachten (Notch, Home-Indikator), Vollbild-Modus.
- **Mobile first** (iPhone-Hochformat), Touch-Ziele mindestens 44×44 pt, keine Hover-abhängigen Funktionen, Zahlentastatur für numerische Felder (`inputmode`).
- Leichtgewichtiger Stack, z. B. Vite + TypeScript. Sparsam mit Bibliotheken. Diagramme leichtgewichtig und offlinefähig (eigene SVG-Diagramme oder eine kleine Bibliothek).
- **Hosting: GitHub Pages.** Pfade müssen unter einem Unterpfad (`/repo-name/`) funktionieren. Deployment per GitHub Actions einrichten und die Schritte für mich dokumentieren.
- Der Speicher der installierten App ist auf iOS vom Safari-Tab getrennt. Das in der README für mich erklären.

## 3. Sprache und Formate
- Oberfläche komplett **Deutsch**. Einheiten: kg, km, Minuten.
- Datum `TT.MM.JJJJ`, Zahlen mit Komma als Dezimaltrenner, **Wochenstart Montag**.

## 4. Datenmodell
**Einheit (Session)**, gemeinsame Felder:
- `id` (UUID), `sport` (`bouldern` | `kraft` | `laufen`), `datum`, `dauerMinuten` (bzw. Sekunden bei Laufen), `notizen` (optional), `erstellt`/`geaendert`.

**Bouldern**
- `halleId`, `sessionMaxGrad` (Zahl 1–7, nur das Session-Maximum).
- **Halle:** `id`, `name`, `maxGrad` (höchster Schwierigkeitsgrad, den die Halle anbietet, ebenfalls Skala 1–7).
- Anzeige im Verlauf und Dashboard als Vergleich, z. B. „5 von 7".

**Kraftsport**
- `fokusMuskulatur` (Mehrfachauswahl): Brust, Rücken, Schultern, Arme, Beine, Core, Ganzkörper.
- `uebungen[]`: je `uebungId` und `saetze[]`; jeder Satz hat `gewichtKg` und `wiederholungen`. Das Gewicht kann je Satz variieren.
- **Übung (Bibliothek):** `id`, `name`. Füllt sich aus meinen Eingaben, mit Autovervollständigung und Vorschlägen.
- Satzanzahl wird aus der Zahl der Sätze abgeleitet.

**Laufen**
- `distanzKm`, `dauerSekunden` (Eingabe als h:mm:ss), `pace` wird **berechnet** (Minuten pro Kilometer, Anzeige `m:ss /km`). Bei Distanz 0 keine Pace anzeigen, keine Fehler.

## 5. Screens und Funktionen
**Navigation:** Tab-Leiste unten mit Dashboard, Neu (hervorgehoben, zentral), Verlauf, Einstellungen.

**Dashboard**
- Umschalter **Woche | Monat | Jahr**, mit Vor und Zurück zum Blättern durch frühere Zeiträume.
- Kennzahlen je Zeitraum: Anzahl Einheiten gesamt und je Sportart, Gesamtdauer, Laufkilometer, durchschnittliche Pace.
- **Fortschrittskurven:** Boulder-Session-Maximum im Zeitverlauf (mit Hallenmaximum als Bezug), Gewichtsverlauf je gewählter Übung, Pace-Verlauf beim Laufen.
- **Serien:** Wochen in Folge mit mindestens einer Einheit (gesamt, optional je Sportart).
- **Bestleistungen:** höchster Boulder-Grad, schwerstes Gewicht je Übung, längster Lauf, schnellste Pace.
- Backup-Hinweis: „Letztes Backup vor X Tagen".
- **Kein Wochenziel in Version 1.** Die Struktur soll es später erlauben.

**Neue Einheit**
- Zuerst Sportart wählen, dann das passende Formular. Datum standardmäßig heute, änderbar (auch für nachträgliche Einträge).
- Dauer **manuell** eingeben (keine Stoppuhr in Version 1).
- Bouldern: Halle auswählen oder direkt neu anlegen (mit Maximalgrad), Session-Maximum wählen.
- Kraft: Übungen hinzufügen. Pro Übung Sätze als Zeilen (Gewicht, Wiederholungen). Funktion **„Satz kopieren"**. Zusätzlich Schnelleingabe „gleiches Gewicht für alle Sätze".
- Laufen: Distanz, Dauer, Pace live berechnet und angezeigt.
- Speichern mit klarer Bestätigung, ohne Reibung.

**Verlauf**
- Liste aller Einheiten, filterbar nach Sportart und Zeitraum.
- Einträge **bearbeiten und löschen** (Löschen mit Bestätigung, ggf. kurzer „Rückgängig"-Hinweis).

**Einstellungen**
- Hallen verwalten (anlegen, bearbeiten, löschen mit Schutz, wenn Einträge verknüpft sind).
- Übungen verwalten (umbenennen, zusammenführen).
- Darstellung: automatisch (Systemeinstellung), Hell, Dunkel.
- **Export/Import** (siehe Abschnitt 6).

## 6. Backup, Import und Wiederherstellung
- **Export** per Button: vollständige Sicherung als JSON-Datei (Einheiten, Hallen, Übungen, Version). Auf iOS möglichst über das Teilen-Menü („In Dateien sichern") bzw. Datei-Download.
- **Import** per Button: JSON-Sicherung einspielen, mit Wahl **„Ersetzen"** oder **„Zusammenführen"** (Dubletten per `id` erkennen). Vorher Vorschau mit Anzahl der Einträge. Ein Import-Roundtrip (Export, dann Import) darf keine Daten verändern.
- **CSV-Import für Altdaten:** Ich habe Trainingsdaten aus mehreren Jahren. Bereitstelle je Sportart eine **CSV-Vorlage** zum Herunterladen (definierte Spalten, deutsches Zahlen- und Datumsformat) und einen Import mit Fehlerbericht (Zeile, Problem). Fehlende Hallen und Übungen automatisch anlegen, nach Bestätigung.
- Wichtig für Handywechsel: Sicherung auf dem alten Handy exportieren, auf dem neuen die App installieren, importieren.

## 7. Design
**Leitidee:** clean, dezent, hochwertig, Apple-nah (iOS-Gefühl), bewusst eigenständig.
- **Farben:** Weiß, helle und mittlere Grautöne, Anthrazit, **dezenter Goldakzent** (warm, gedämpft, nicht grell). Dunkler Modus: tiefes Anthrazit statt reinem Schwarz, Gold als Akzent.
- **Sportarten-Akzente:** je Sportart eine eigene, gedämpfte Akzentfarbe, die harmonisch zum Gold und Grau passt (z. B. warmer Sand/Terrakotta, Schiefer, Salbei). Farben nicht allein als Informationsträger nutzen.
- **Schrift:** geometrische Grotesk im Stil von **Futura**. Futura selbst ist nicht frei, deshalb eine freie Alternative wie **Jost**, lokal eingebunden (offline). Klare Hierarchie, großzügige Abstände, Zahlen gut lesbar (Kennzahlen groß).
- **Oberfläche:** ruhige Karten mit weichen Rundungen, feine Linien statt schwerer Schatten, sanfte Übergänge, dezente Mikroanimationen (kein Overkill). Leere Zustände gestalten (nicht nur leere Seiten).
- **Icon:** Platzhalter, z. B. goldenes Monogramm auf grauem Grund, in allen nötigen Größen. Muss später leicht austauschbar sein.
- Kontraste und Lesbarkeit prüfen, Bedienung mit einer Hand ermöglichen.

## 8. Qualität
- Tests für die Kernlogik: Pace-Berechnung, Zeiträume (Woche ab Montag, Monat, Jahr), Serienberechnung, Bestleistungen, Export/Import-Roundtrip, CSV-Import.
- Prüfen: offlinefähig, installierbar (Manifest, Service Worker), keine Konsolenfehler.
- Die Installation auf einem echten iPhone kann nicht automatisch getestet werden. Dafür eine **kurze Testanleitung** in die README.
- README (Deutsch): Installation auf iPhone (Safari, „Zum Home-Bildschirm"), Hinweis auf getrennten Speicher, Backup-Anleitung, Handywechsel, Deployment.

## 9. Nicht in Version 1
Konten, Cloud-Sync, Wochenziele, Stoppuhr, Apple-Health-Anbindung, Teilen mit anderen.
