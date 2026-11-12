import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applyCsvImport, importCsv } from '../src/lib/csv';
import { applyZuordnung, fokusNeuAbleiten, importZuordnung, isZuordnungCsv, parseMuskelgruppe, zuordnungVorlage } from '../src/lib/zuordnung';
import { backupToJson, createBackup, parseBackup } from '../src/lib/backup';
import type { AppData, KraftSession } from '../src/lib/types';
import { uebungLabel } from '../src/lib/uebungen';
import { kraft, satz, uebung } from './helpers';

const empty: AppData = { sessions: [], hallen: [], uebungen: [] };
let c = 0;
const opts = { now: new Date('2026-11-12T10:00:00Z'), idGen: () => `z-${++c}` };
const kraftCsv = readFileSync(new URL('./fixtures/kraft_beispiel.csv', import.meta.url), 'utf8');
const zuordnungCsv = readFileSync(new URL('./fixtures/uebungen_zuordnung_beispiel.csv', import.meta.url), 'utf8');

function kraftImportiert(base: AppData = empty): AppData {
  return applyCsvImport(base, importCsv(kraftCsv, base, opts), false).data;
}
const fokusJeDatum = (d: AppData) =>
  Object.fromEntries(d.sessions.filter((s): s is KraftSession => s.sport === 'kraft').map((s) => [s.datum, s.fokusMuskulatur]));

describe('Muskelgruppen', () => {
  it('kennt genau die erlaubten Begriffe inkl. Gesäß, Groß/Klein egal, ohne stille Abbildung', () => {
    expect(parseMuskelgruppe('Gesäß')).toBe('Gesäß');
    expect(parseMuskelgruppe('gesäß')).toBe('Gesäß');
    expect(parseMuskelgruppe('CORE')).toBe('Core');
    expect(parseMuskelgruppe('Ganzkörper')).toBe('Ganzkörper');
    expect(parseMuskelgruppe('Po')).toBeNull();
    expect(parseMuskelgruppe('Bizeps')).toBeNull();
    expect(parseMuskelgruppe('Bauch')).toBeNull();
  });
});

describe('Zuordnungs-Import', () => {
  it('erkennt die Datei mit und ohne Kopfzeile', () => {
    expect(isZuordnungCsv(zuordnungCsv)).toBe(true);
    expect(isZuordnungCsv('Kniebeuge;;3;Beine\n')).toBe(true);
    expect(isZuordnungCsv(kraftCsv)).toBe(false);
    expect(isZuordnungCsv(kraftCsv.replace(/^﻿[^\n]*\n/, ''))).toBe(false);
  });

  it('meldet unbekannte und fehlende Muskelgruppen, ungültige Anzahl und Widersprüche', () => {
    const r = importZuordnung(zuordnungCsv, kraftImportiert(), opts);
    expect(r.fehler).toEqual([
      { zeile: 11, problem: 'Unbekannte Muskelgruppe „Po“. Erlaubt: Brust, Rücken, Schultern, Arme, Beine, Gesäß, Core, Ganzkörper.' },
      { zeile: 12, problem: 'Muskelgruppe fehlt.' },
      { zeile: 13, problem: 'anzahl_einheiten „x“ ist keine ganze Zahl.' },
      { zeile: 14, problem: 'Widerspricht Zeile 2 (dort „Beine“).' },
    ]);
    expect(r.zeilenGesamt).toBe(14);
    expect(r.zeilen).toHaveLength(9); // doppelte gleichlautende Zeile zählt nicht doppelt
  });

  it('ordnet über Name + Variante zu (Groß/Klein egal); Varianten bleiben getrennt', () => {
    const data = kraftImportiert();
    const r = importZuordnung(zuordnungCsv, data, opts);
    const next = applyZuordnung(data, r);
    const g = (label: string) => next.uebungen.find((u) => uebungLabel(u) === label)?.muskelgruppen;
    expect(g('Hip thrusts')).toEqual(['Gesäß']);
    expect(g('Hip thrusts (Maschine)')).toEqual(['Gesäß']);
    expect(g('Plank')).toEqual(['Core']); // „plank“ in der Datei
    expect(g('Klimmzüge (mit Band)')).toEqual(['Rücken']);
    expect(r.zeilen.find((z) => z.name === 'Plank' || z.name === 'plank')?.status).toBe('gesetzt');
  });

  it('zeigt anzahl_einheiten nur zur Kontrolle und vergleicht mit der App', () => {
    const base = kraftImportiert();
    const r = importZuordnung(zuordnungCsv, base, opts);
    const bp = r.zeilen.find((z) => z.name === 'Beinpresse')!;
    expect(bp.anzahlDatei).toBe(2);
    expect(bp.anzahlApp).toBe(2);
    expect(JSON.stringify(applyZuordnung(base, r))).not.toContain('anzahl');
    
  });

  it('legt unbekannte Übungen neu an', () => {
    const r = importZuordnung(zuordnungCsv, kraftImportiert(), opts);
    expect(r.neueUebungen.map((u) => [u.name, u.muskelgruppen])).toEqual([['Ausfallschritte', ['Beine']]]);
  });
});

describe('Fokus wird abgeleitet – Reihenfolge der Importe ist egal', () => {
  const erwartet = {
    '2025-01-06': ['Rücken', 'Beine', 'Gesäß', 'Core'],
    '2025-01-08': ['Beine', 'Core'],
  };

  it('Kraft-Import zuerst, Zuordnung danach (rückwirkend)', () => {
    const data = kraftImportiert();
    expect(fokusJeDatum(data)).toEqual({ '2025-01-06': [], '2025-01-08': [] });
    const next = applyZuordnung(data, importZuordnung(zuordnungCsv, data, opts));
    expect(fokusJeDatum(next)).toEqual(erwartet);
  });

  it('Zuordnung zuerst, Kraft-Import danach', () => {
    const z = applyZuordnung(empty, importZuordnung(zuordnungCsv, empty, opts));
    expect(z.uebungen.every((u) => u.muskelgruppen?.length === 1)).toBe(true);
    const next = kraftImportiert(z);
    expect(fokusJeDatum(next)).toEqual(erwartet);
    // keine doppelten Übungen
    expect(next.uebungen.filter((u) => u.name === 'Beinpresse')).toHaveLength(1);
  });

  it('von Hand gewählter Fokus bleibt unverändert', () => {
    const u = uebung('Kniebeuge', '', 'u-kb');
    const manuell = kraft('2026-01-01', [{ u, saetze: [satz(50, 10)] }], { fokusMuskulatur: ['Ganzkörper'] });
    const data: AppData = { ...empty, uebungen: [u], sessions: [manuell] };
    const next = applyZuordnung(data, importZuordnung('uebung;geraet_variante;anzahl_einheiten;muskelgruppe\nKniebeuge;;1;Beine\n', data, opts));
    expect((next.sessions[0] as KraftSession).fokusMuskulatur).toEqual(['Ganzkörper']);
  });

  it('eine geänderte Zuordnung aktualisiert abgeleitete Fokusse; mehrere Gruppen bleiben erhalten', () => {
    const u = { ...uebung('Beinpresse', '', 'u-bp'), muskelgruppen: ['Beine' as const] };
    const s = kraft('2026-01-01', [{ u, saetze: [satz(80, 10)] }], { fokusMuskulatur: ['Beine'], fokusAbgeleitet: true });
    const data: AppData = { ...empty, uebungen: [u], sessions: [s] };
    const r = importZuordnung('Beinpresse;;1;Gesäß\n', data, opts);
    expect(r.zeilen[0].status).toBe('geaendert');
    expect((applyZuordnung(data, r).sessions[0] as KraftSession).fokusMuskulatur).toEqual(['Gesäß']);

    // Übung mit mehreren Gruppen (von Hand gepflegt), die den Wert schon enthält: unverändert
    const multi = { ...u, muskelgruppen: ['Beine' as const, 'Gesäß' as const] };
    const r2 = importZuordnung('Beinpresse;;1;Gesäß\n', { ...data, uebungen: [multi] }, opts);
    expect(r2.zeilen[0].status).toBe('unveraendert');
    expect(r2.geaenderteUebungen).toEqual([]);
  });

  it('fokusNeuAbleiten ändert nichts, wenn nichts abzuleiten ist', () => {
    const u = uebung('Kniebeuge');
    expect(fokusNeuAbleiten([kraft('2026-01-01', [{ u, saetze: [] }], { fokusMuskulatur: [] })], [u], 'x')).toEqual([]);
  });
});

describe('Vorlage und Sicherung', () => {
  it('Vorlage listet vorhandene Übungen mit Anzahl und lässt sich wieder importieren', () => {
    const base = kraftImportiert();
    const data = applyZuordnung(base, importZuordnung(zuordnungCsv, base, opts));
    const t = zuordnungVorlage(data);
    expect(t.startsWith('﻿uebung;geraet_variante;anzahl_einheiten;muskelgruppe\r\n')).toBe(true);
    expect(t).toContain('Hip thrusts;Maschine;1;Gesäß');
    const r = importZuordnung(t, data, opts);
    expect(r.fehler).toEqual([]);
    expect(r.geaenderteUebungen).toEqual([]);
  });

  it('Muskelgruppen und abgeleiteter Fokus überstehen den Export/Import-Roundtrip', () => {
    const base = kraftImportiert();
    const data = applyZuordnung(base, importZuordnung(zuordnungCsv, base, opts));
    const p = parseBackup(backupToJson(createBackup(data)));
    if (!p.ok) throw new Error(p.error);
    expect(p.backup.uebungen).toEqual(data.uebungen);
    expect(p.backup.sessions).toEqual(data.sessions);
  });

  it('lehnt unbekannte Muskelgruppen in einer Sicherung ab', () => {
    const data = { ...empty, uebungen: [{ ...uebung('X'), muskelgruppen: ['Po'] }] } as unknown as AppData;
    expect(parseBackup(backupToJson(createBackup(data))).ok).toBe(false);
  });
});
