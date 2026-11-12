import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applyCsvImport, importCsv, parseCsv, templateCsv } from '../src/lib/csv';
import type { AppData, KraftSession } from '../src/lib/types';
import { uebungLabel } from '../src/lib/uebungen';
import { halle, kraft, lauf, satz, uebung } from './helpers';

const empty: AppData = { sessions: [], hallen: [], uebungen: [] };
let c = 0;
const opts = { now: new Date('2026-11-12T10:00:00Z'), idGen: () => `id-${++c}` };
const fixture = readFileSync(new URL('./fixtures/kraft_beispiel.csv', import.meta.url), 'utf8');

describe('CSV-Parser', () => {
  it('entfernt BOM, kennt CRLF und Anführungszeichen, überspringt Leerzeilen', () => {
    const rows = parseCsv('﻿a;b\r\n\r\n"x;y";"sagt ""hi"""\n');
    expect(rows).toEqual([
      { line: 1, cells: ['a', 'b'] },
      { line: 3, cells: ['x;y', 'sagt "hi"'] },
    ]);
  });
});

describe('CSV-Import Kraft (Format der Altdaten)', () => {
  const res = importCsv(fixture, empty, opts);
  const byDate = (d: string) => res.sessions.find((s) => s.datum === d) as KraftSession;
  const label = (id: string) => uebungLabel(res.neueUebungen.find((u) => u.id === id));

  it('erkennt Sportart und Kopfzeile', () => {
    expect(res.sport).toBe('kraft');
    expect(res.zeilenGesamt).toBe(19);
  });

  it('meldet fehlerhafte Zeilen mit Zeilennummer', () => {
    expect(res.fehler).toEqual([
      { zeile: 17, problem: 'Datum „32.01.2025“ ist ungültig (erwartet TT.MM.JJJJ).' },
      { zeile: 18, problem: 'Übung fehlt.' },
      { zeile: 19, problem: 'Wiederholungen „zehn“ ist keine Zahl.' },
      { zeile: 20, problem: 'Sportart „Laufen“ passt nicht zu dieser Datei.' },
    ]);
    expect(res.zeilenOk).toBe(15);
  });

  it('eine Einheit je Datum', () => {
    expect(res.sessions.map((s) => s.datum)).toEqual(['2025-01-06', '2025-01-08']);
    expect(res.sessions.every((s) => s.sport === 'kraft' && s.dauerSekunden === null)).toBe(true);
  });

  it('Name + Variante sind getrennte Übungen; Variante bleibt Variante', () => {
    const labels = res.neueUebungen.map(uebungLabel);
    expect(labels).toEqual([
      'Beinpresse',
      'Hip thrusts',
      'Hip thrusts (Maschine)',
      'Klimmzüge (mit Band)',
      'Einarmiges Rudern (je Seite)',
      'Bauchzirkel',
      'Dehnen',
      'Plank',
    ]);
    const rudern = res.neueUebungen.find((u) => u.name === 'Einarmiges Rudern')!;
    expect(rudern.variante).toBe('je Seite');
  });

  it('Sätze: Dezimal-Wiederholungen, Körpergewicht, Satz-Notizen, sortiert nach Satznummer', () => {
    const s = byDate('2025-01-06');
    const e = (l: string) => s.uebungen.find((x) => label(x.uebungId) === l)!;
    expect(e('Beinpresse').saetze).toEqual([
      { gewichtKg: 60, wiederholungen: 12 },
      { gewichtKg: 65, wiederholungen: 10 },
      { gewichtKg: 70, wiederholungen: 8 },
    ]);
    expect(e('Klimmzüge (mit Band)').saetze).toEqual([
      { gewichtKg: null, wiederholungen: 6 },
      { gewichtKg: null, wiederholungen: 5.5 },
    ]);
    expect(e('Hip thrusts (Maschine)').saetze[1]).toEqual({ gewichtKg: 85, wiederholungen: 8, notiz: 'Myo 1' });
    // in der Datei steht Satz 2 vor Satz 1
    expect(e('Einarmiges Rudern (je Seite)').saetze).toEqual([
      { gewichtKg: 12.5, wiederholungen: 12, notiz: 'Gewicht je Arm' },
      { gewichtKg: 14, wiederholungen: 12, notiz: 'Gewicht je Arm' },
    ]);
    expect(byDate('2025-01-08').uebungen[0].saetze[1]).toEqual({ gewichtKg: 80, wiederholungen: 2.25, notiz: 'paused 1 sek pause' });
  });

  it('zeitbasierte Zeilen ohne Satznummer werden Sätze mit Dauer', () => {
    const s = byDate('2025-01-06');
    expect(s.uebungen.find((x) => label(x.uebungId) === 'Bauchzirkel')!.saetze).toEqual([
      { gewichtKg: null, wiederholungen: null, dauerSekunden: 720 },
    ]);
    const plank = byDate('2025-01-08').uebungen.find((x) => label(x.uebungId) === 'Plank')!;
    expect(plank.saetze[0].dauerSekunden).toBe(90);
  });

  it('Zeilen ohne Satz und Dauer → Übung ohne Sätze mit Notiz', () => {
    const d = byDate('2025-01-06').uebungen.find((x) => label(x.uebungId) === 'Dehnen')!;
    expect(d).toEqual({ uebungId: d.uebungId, saetze: [], notiz: 'keine Saetze notiert' });
  });

  it('Satzanzahl', () => {
    expect(res.saetze).toBe(14);
  });
});

describe('CSV-Import: vorhandene Daten, Kopfzeile optional, Dubletten', () => {
  it('nutzt vorhandene Übungen (Groß/Klein egal) und legt nur neue an', () => {
    const bp = uebung('beinpresse');
    const data: AppData = { ...empty, uebungen: [bp] };
    const r = importCsv('06.01.2025;Kraftsport;Beinpresse;;1;10;60;;\n06.01.2025;Kraftsport;Beinpresse;Maschine;1;10;60;;\n', data, opts);
    expect(r.fehler).toEqual([]);
    expect(r.neueUebungen.map(uebungLabel)).toEqual(['Beinpresse (Maschine)']);
    expect((r.sessions[0] as KraftSession).uebungen[0].uebungId).toBe(bp.id);
  });

  it('funktioniert ohne Kopfzeile', () => {
    const noHeader = fixture.replace(/^﻿[^\n]*\n/, '');
    const r = importCsv(noHeader, empty, opts);
    expect(r.sport).toBe('kraft');
    expect(r.sessions).toHaveLength(2);
    expect(r.fehler[0].zeile).toBe(16);
  });

  it('erkennt Dubletten (Kraft am selben Tag) und kann sie überspringen', () => {
    const u = uebung('Beinpresse');
    const data: AppData = { ...empty, uebungen: [u], sessions: [kraft('2025-01-06', [{ u, saetze: [satz(60, 12)] }])] };
    const r = importCsv(fixture, data, opts);
    expect(r.dubletten).toEqual([true, false]);
    const applied = applyCsvImport(data, r, true);
    expect(applied.added.map((s) => s.datum)).toEqual(['2025-01-08']);
    // nur Übungen übernehmen, die in übernommenen Einheiten vorkommen
    expect(applied.data.uebungen.map(uebungLabel).sort()).toEqual(['Beinpresse', 'Plank']);
    expect(applyCsvImport(data, r, false).added).toHaveLength(2);
  });

  it('meldet falsches Trennzeichen', () => {
    const r = importCsv('datum,sportart,uebung\n01.01.2025,Kraftsport,X\n', empty, opts);
    expect(r.fehler[0].problem).toMatch(/Trennzeichen/);
  });

  it('leere Datei', () => {
    expect(importCsv('﻿\r\n', empty, opts).fehler[0].problem).toMatch(/keine Daten/);
  });
});

describe('CSV-Import Bouldern und Laufen', () => {
  it('Bouldern: legt fehlende Halle an, nutzt vorhandene, prüft Grade', () => {
    const vorhanden = halle('Kletterhaus', 7);
    const text = [
      'datum;sportart;halle;halle_max_grad;session_max_grad;dauer_min;notiz',
      '01.02.2025;Bouldern;Neue Halle;10;6;90;locker',
      '02.02.2025;Bouldern;kletterhaus;;5;;',
      '03.02.2025;Bouldern;Unbekannt;;5;;',
      '04.02.2025;Bouldern;Kletterhaus;;8;;',
      '05.02.2025;Bouldern;Kletterhaus;;11;;',
      '06.02.2025;Bouldern;Kletterhaus;;4,5;;',
    ].join('\n');
    const r = importCsv(text, { ...empty, hallen: [vorhanden] }, opts);
    expect(r.sport).toBe('bouldern');
    expect(r.neueHallen.map((h) => [h.name, h.maxGrad])).toEqual([['Neue Halle', 10]]);
    expect(r.sessions).toHaveLength(2);
    expect(r.sessions[0]).toMatchObject({ sessionMaxGrad: 6, hallenMaxGrad: 10, dauerSekunden: 5400, notizen: 'locker' });
    expect(r.sessions[1]).toMatchObject({ halleId: vorhanden.id, sessionMaxGrad: 5, hallenMaxGrad: 7 });
    expect(r.fehler.map((f) => f.zeile)).toEqual([4, 5, 6, 7]);
    expect(r.fehler[0].problem).toMatch(/neu/);
    expect(r.fehler[1].problem).toMatch(/über dem Hallen-Maximum/);
    expect(r.fehler[2].problem).toMatch(/höchstens 10/);
    expect(r.fehler[3].problem).toMatch(/ganze Zahl/);
  });

  it('Laufen: Distanz mit Komma, Dauer h:mm:ss, Distanz 0 erlaubt', () => {
    const text = '﻿datum;sportart;distanz_km;dauer;notiz\n07.03.2025;Laufen;5,2;0:28:45;\n08.03.2025;Laufen;0;20:00;Laufband kaputt\n09.03.2025;Laufen;5;;\n';
    const r = importCsv(text, { ...empty, sessions: [lauf('2025-03-07', 5.2, 1725)] }, opts);
    expect(r.sessions[0]).toMatchObject({ distanzKm: 5.2, dauerSekunden: 1725 });
    expect(r.sessions[1]).toMatchObject({ distanzKm: 0, dauerSekunden: 1200, notizen: 'Laufband kaputt' });
    expect(r.dubletten).toEqual([true, false]);
    expect(r.fehler).toEqual([{ zeile: 4, problem: 'Dauer fehlt.' }]);
  });
});

describe('CSV-Vorlagen', () => {
  it('lassen sich fehlerfrei wieder importieren', () => {
    for (const sport of ['kraft', 'bouldern', 'laufen'] as const) {
      const t = templateCsv(sport);
      expect(t.startsWith('﻿datum;sportart;')).toBe(true);
      const r = importCsv(t, empty, opts);
      expect(r.sport).toBe(sport);
      expect(r.fehler).toEqual([]);
      expect(r.sessions.length).toBeGreaterThan(0);
    }
  });
});
