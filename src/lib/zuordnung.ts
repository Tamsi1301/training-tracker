/**
 * Muskelgruppen: Übungen-Zuordnung (CSV) und Ableitung des Fokus einer Kraft-Einheit.
 *
 * Datei uebungen_zuordnung.csv: uebung;geraet_variante;anzahl_einheiten;muskelgruppe
 * - Zuordnung über Name + Variante (Groß-/Kleinschreibung egal)
 * - anzahl_einheiten nur zur Kontrolle (wird nicht gespeichert)
 * - unbekannte Muskelgruppen → Fehlerbericht (keine stille Abbildung)
 */
import { parseCsv, type CsvFehler } from './csv';
import { parseDateDE } from './dates';
import { parseNum } from './format';
import { uuid } from './ids';
import { cleanText, normText, uebungKey } from './uebungen';
import type { AppData, KraftSession, Muskelgruppe, Session, Uebung } from './types';
import { MUSKELGRUPPEN } from './types';

export const ZUORDNUNG_COLUMNS = ['uebung', 'geraet_variante', 'anzahl_einheiten', 'muskelgruppe'];

/** Exakter Begriff (Groß/Klein egal) → Muskelgruppe, sonst null. */
export function parseMuskelgruppe(v: string): Muskelgruppe | null {
  const n = normText(v);
  return MUSKELGRUPPEN.find((m) => normText(m) === n) ?? null;
}

/** Sortiert und entdoppelt Muskelgruppen in der Reihenfolge der Liste. */
export function ordneMuskelgruppen(list: Iterable<Muskelgruppe>): Muskelgruppe[] {
  const set = new Set(list);
  return MUSKELGRUPPEN.filter((m) => set.has(m));
}

/** Fokus = Menge der Muskelgruppen aller Übungen der Einheit. */
export function fokusAusUebungen(uebungIds: string[], byId: Map<string, Uebung>): Muskelgruppe[] {
  return ordneMuskelgruppen(uebungIds.flatMap((id) => byId.get(id)?.muskelgruppen ?? []));
}

const gleich = (a: Muskelgruppe[], b: Muskelgruppe[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * Leitet den Fokus neu ab für Kraft-Einheiten, deren Fokus leer ist oder automatisch
 * abgeleitet wurde. Von Hand gewählte Fokusse bleiben unverändert.
 * Gibt nur die geänderten Einheiten zurück.
 */
export function fokusNeuAbleiten(sessions: Session[], uebungen: Uebung[], now: string): KraftSession[] {
  const byId = new Map(uebungen.map((u) => [u.id, u]));
  const changed: KraftSession[] = [];
  for (const s of sessions) {
    if (s.sport !== 'kraft') continue;
    const auto = s.fokusAbgeleitet === true || s.fokusMuskulatur.length === 0;
    if (!auto) continue;
    const fokus = fokusAusUebungen(
      s.uebungen.map((e) => e.uebungId),
      byId,
    );
    if (fokus.length === 0 && !s.fokusAbgeleitet) continue; // nichts abzuleiten
    if (gleich(fokus, s.fokusMuskulatur) && s.fokusAbgeleitet === true) continue;
    changed.push({ ...s, fokusMuskulatur: fokus, fokusAbgeleitet: true, geaendert: now });
  }
  return changed;
}

// ---------------------------------------------------------------- Import

export interface ZuordnungZeile {
  zeile: number;
  name: string;
  variante: string;
  muskelgruppe: Muskelgruppe;
  /** Wert aus der Datei (nur Kontrolle) */
  anzahlDatei: number | null;
  /** Anzahl Einheiten mit dieser Übung in der App (nur Kontrolle) */
  anzahlApp: number;
  status: 'neu' | 'gesetzt' | 'geaendert' | 'unveraendert';
  uebungId: string;
}

export interface ZuordnungResult {
  zeilen: ZuordnungZeile[];
  fehler: CsvFehler[];
  zeilenGesamt: number;
  /** neu anzulegende Übungen */
  neueUebungen: Uebung[];
  /** aktualisierte Übungen (Muskelgruppe gesetzt oder geändert) */
  geaenderteUebungen: Uebung[];
  /** Einheiten, deren Fokus danach (neu) abgeleitet wird */
  fokusEinheiten: KraftSession[];
}

/** Erkennt eine Zuordnungs-Datei (mit oder ohne Kopfzeile). */
export function isZuordnungCsv(text: string): boolean {
  const rows = parseCsv(text).slice(0, 2);
  if (!rows.length) return false;
  const first = normText(rows[0].cells[0]);
  if (first === 'uebung' || first === 'übung') return true;
  if (first === 'datum') return false;
  const r = rows[0].cells;
  return parseDateDE(r[0] ?? '') == null && r.length >= 4 && r.length <= 5 && parseMuskelgruppe(r[3] ?? '') != null;
}

export function importZuordnung(text: string, data: AppData, opts: { now?: Date; idGen?: () => string } = {}): ZuordnungResult {
  const now = (opts.now ?? new Date()).toISOString();
  const id = opts.idGen ?? uuid;
  const res: ZuordnungResult = { zeilen: [], fehler: [], zeilenGesamt: 0, neueUebungen: [], geaenderteUebungen: [], fokusEinheiten: [] };

  const rows = parseCsv(text);
  if (!rows.length) {
    res.fehler.push({ zeile: 0, problem: 'Die Datei enthält keine Daten.' });
    return res;
  }
  if (rows[0].cells.length === 1 && /[,\t]/.test(rows[0].cells[0])) {
    res.fehler.push({ zeile: rows[0].line, problem: 'Falsches Trennzeichen. Erwartet wird das Semikolon „;“.' });
    return res;
  }
  let cols = ZUORDNUNG_COLUMNS;
  const h = normText(rows[0].cells[0]);
  if (h === 'uebung' || h === 'übung') {
    cols = rows[0].cells.map((c) => {
      const n = normText(c).replace(/[\s-]+/g, '_');
      return n === 'übung' ? 'uebung' : n === 'gerät_variante' || n === 'variante' ? 'geraet_variante' : n;
    });
    rows.shift();
  }
  res.zeilenGesamt = rows.length;

  // Zählung in der App (Kontrolle)
  const countById = new Map<string, number>();
  for (const s of data.sessions)
    if (s.sport === 'kraft') for (const uid of new Set(s.uebungen.map((e) => e.uebungId))) countById.set(uid, (countById.get(uid) ?? 0) + 1);

  const byKey = new Map(data.uebungen.map((u) => [uebungKey(u.name, u.variante), u]));
  const updated = new Map<string, Uebung>();
  const seen = new Map<string, { zeile: number; gruppe: Muskelgruppe }>();

  for (const r of rows) {
    const get = (c: string) => {
      const i = cols.indexOf(c);
      return i < 0 ? '' : (r.cells[i] ?? '').trim();
    };
    const errs: string[] = [];
    const name = cleanText(get('uebung'));
    const variante = cleanText(get('geraet_variante'));
    const rawGruppe = get('muskelgruppe');
    const rawAnzahl = get('anzahl_einheiten');
    if (!name) errs.push('Übung fehlt.');
    let gruppe: Muskelgruppe | null = null;
    if (!rawGruppe) errs.push('Muskelgruppe fehlt.');
    else {
      gruppe = parseMuskelgruppe(rawGruppe);
      if (!gruppe) errs.push(`Unbekannte Muskelgruppe „${rawGruppe}“. Erlaubt: ${MUSKELGRUPPEN.join(', ')}.`);
    }
    let anzahl: number | null = null;
    if (rawAnzahl) {
      const n = parseNum(rawAnzahl);
      if (n == null || isNaN(n) || n < 0 || !Number.isInteger(n)) errs.push(`anzahl_einheiten „${rawAnzahl}“ ist keine ganze Zahl.`);
      else anzahl = n;
    }
    const key = uebungKey(name, variante);
    const prev = seen.get(key);
    if (!errs.length && prev) {
      if (prev.gruppe !== gruppe) errs.push(`Widerspricht Zeile ${prev.zeile} (dort „${prev.gruppe}“).`);
      else continue; // doppelte, gleichlautende Zeile
    }
    if (errs.length || !gruppe) {
      res.fehler.push(...errs.map((problem) => ({ zeile: r.line, problem })));
      continue;
    }
    seen.set(key, { zeile: r.line, gruppe });

    let u = updated.get(key) ?? byKey.get(key);
    let status: ZuordnungZeile['status'];
    if (!u) {
      u = { id: id(), name, variante, muskelgruppen: [gruppe], erstellt: now, geaendert: now };
      res.neueUebungen.push(u);
      status = 'neu';
    } else {
      const cur = u.muskelgruppen ?? [];
      if (cur.includes(gruppe)) status = 'unveraendert';
      else {
        status = cur.length ? 'geaendert' : 'gesetzt';
        u = { ...u, muskelgruppen: [gruppe], geaendert: now };
        updated.set(key, u);
      }
    }
    res.zeilen.push({
      zeile: r.line,
      name,
      variante,
      muskelgruppe: gruppe,
      anzahlDatei: anzahl,
      anzahlApp: countById.get(u.id) ?? 0,
      status,
      uebungId: u.id,
    });
  }

  res.geaenderteUebungen = [...updated.values()];
  const changedIds = new Map(res.geaenderteUebungen.map((u) => [u.id, u]));
  const alle = [...data.uebungen.map((u) => changedIds.get(u.id) ?? u), ...res.neueUebungen];
  res.fokusEinheiten = fokusNeuAbleiten(data.sessions, alle, now);
  res.fehler.sort((a, b) => a.zeile - b.zeile);
  return res;
}

/** Übernimmt eine Zuordnung in die Daten. */
export function applyZuordnung(data: AppData, res: ZuordnungResult): AppData {
  const changed = new Map(res.geaenderteUebungen.map((u) => [u.id, u]));
  const fokus = new Map(res.fokusEinheiten.map((s) => [s.id, s]));
  return {
    ...data,
    uebungen: [...data.uebungen.map((u) => changed.get(u.id) ?? u), ...res.neueUebungen],
    sessions: data.sessions.map((s) => fokus.get(s.id) ?? s),
  };
}

/** Vorlage mit den vorhandenen Übungen (zum Ergänzen der Muskelgruppen). */
export function zuordnungVorlage(data: AppData): string {
  const count = new Map<string, number>();
  for (const s of data.sessions)
    if (s.sport === 'kraft') for (const uid of new Set(s.uebungen.map((e) => e.uebungId))) count.set(uid, (count.get(uid) ?? 0) + 1);
  const q = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const rows = [...data.uebungen]
    .sort((a, b) => a.name.localeCompare(b.name, 'de') || a.variante.localeCompare(b.variante, 'de'))
    .map((u) => [q(u.name), q(u.variante), String(count.get(u.id) ?? 0), u.muskelgruppen?.[0] ?? ''].join(';'));
  const beispiel = rows.length ? [] : ['Kniebeuge;;0;Beine', 'Hip thrusts;Maschine;0;Gesäß'];
  return '﻿' + [ZUORDNUNG_COLUMNS.join(';'), ...rows, ...beispiel].join('\r\n') + '\r\n';
}
