/**
 * CSV-Import für Altdaten und CSV-Vorlagen.
 * Format: UTF-8 (BOM erlaubt), Trennzeichen „;“, Dezimalkomma, Datum TT.MM.JJJJ.
 * Kopfzeile optional – erkannt am ersten Feld „datum“.
 */
import { parseDateDE } from './dates';
import { parseClock, parseNum } from './format';
import { uuid } from './ids';
import { cleanText, normText, uebungKey } from './uebungen';
import type { AppData, BoulderSession, Halle, KraftSession, LaufSession, Satz, Session, Sport, Uebung, UebungEintrag } from './types';
import { GRAD_MAX, GRAD_MIN, MUSKELGRUPPEN } from './types';

// ---------------------------------------------------------------- Spalten

export const CSV_COLUMNS: Record<Sport, string[]> = {
  kraft: ['datum', 'sportart', 'uebung', 'geraet_variante', 'satz', 'wiederholungen', 'gewicht_kg', 'dauer_min', 'notiz'],
  bouldern: ['datum', 'sportart', 'halle', 'halle_max_grad', 'session_max_grad', 'dauer_min', 'notiz'],
  laufen: ['datum', 'sportart', 'distanz_km', 'dauer', 'notiz'],
};

/** Erfundene Beispielzeilen für die Vorlagen. */
const TEMPLATE_ROWS: Record<Sport, string[][]> = {
  kraft: [
    ['03.03.2025', 'Kraftsport', 'Kniebeuge', '', '1', '10', '40', '', ''],
    ['03.03.2025', 'Kraftsport', 'Kniebeuge', '', '2', '8', '45', '', ''],
    ['03.03.2025', 'Kraftsport', 'Rudern', 'Kabelzug', '1', '12', '27,5', '', 'Gewicht je Seite'],
    ['03.03.2025', 'Kraftsport', 'Klimmzüge', 'mit Band', '1', '6,5', '', '', ''],
    ['03.03.2025', 'Kraftsport', 'Unterarmstütz', '', '', '', '', '1,5', ''],
    ['03.03.2025', 'Kraftsport', 'Dehnen', '', '', '', '', '', 'keine Saetze notiert'],
  ],
  bouldern: [
    ['05.03.2025', 'Bouldern', 'Beispielhalle', '8', '5', '90', 'gute Session'],
    ['12.03.2025', 'Bouldern', 'Beispielhalle', '', '6', '75', ''],
  ],
  laufen: [
    ['07.03.2025', 'Laufen', '5,2', '0:28:45', ''],
    ['14.03.2025', 'Laufen', '10', '1:01:30', 'Intervalle'],
  ],
};

export function templateCsv(sport: Sport): string {
  const lines = [CSV_COLUMNS[sport], ...TEMPLATE_ROWS[sport]].map((r) => r.join(';'));
  return '﻿' + lines.join('\r\n') + '\r\n';
}

export const templateFileName = (sport: Sport) => `vorlage_${sport}.csv`;

// ---------------------------------------------------------------- Parser

export interface CsvRow {
  /** Zeilennummer in der Datei (1-basiert) */
  line: number;
  cells: string[];
}

/** Zerlegt CSV-Text in Zeilen. Unterstützt Anführungszeichen, CRLF und BOM; leere Zeilen werden übersprungen. */
export function parseCsv(text: string, delimiter = ';'): CsvRow[] {
  const src = text.replace(/^﻿/, '');
  const rows: CsvRow[] = [];
  let cells: string[] = [];
  let cell = '';
  let quoted = false;
  let line = 1;
  let rowStart = 1;
  const pushRow = () => {
    cells.push(cell);
    if (cells.some((c) => c.trim() !== '')) rows.push({ line: rowStart, cells });
    cells = [];
    cell = '';
  };
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else {
        if (ch === '\n') line++;
        cell += ch;
      }
      continue;
    }
    if (ch === '"' && cell.trim() === '') {
      cell = '';
      quoted = true;
    } else if (ch === delimiter) {
      cells.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      pushRow();
      line++;
      rowStart = line;
    } else cell += ch;
  }
  if (cell !== '' || cells.length) pushRow();
  return rows;
}

const HEADER_ALIASES: Record<string, string> = {
  übung: 'uebung',
  'gerät_variante': 'geraet_variante',
  variante: 'geraet_variante',
  wdh: 'wiederholungen',
  gewicht: 'gewicht_kg',
  notizen: 'notiz',
  distanz: 'distanz_km',
};

const normHeader = (h: string) => {
  const n = normText(h).replace(/\s*\(.*\)\s*$/, '').replace(/[\s-]+/g, '_');
  return HEADER_ALIASES[n] ?? n;
};

function sportFromLabel(v: string): Sport | null {
  const n = normText(v);
  if (n === 'kraftsport' || n === 'kraft' || n === 'krafttraining') return 'kraft';
  if (n === 'bouldern' || n === 'boulder') return 'bouldern';
  if (n === 'laufen' || n === 'lauf') return 'laufen';
  return null;
}

// ---------------------------------------------------------------- Import

export interface CsvFehler {
  zeile: number;
  problem: string;
}

export interface CsvImportResult {
  sport: Sport | null;
  /** neue Einheiten (Reihenfolge wie in der Datei) */
  sessions: Session[];
  /** gleiche Länge wie `sessions`: true = vermutlich schon vorhanden */
  dubletten: boolean[];
  neueUebungen: Uebung[];
  neueHallen: Halle[];
  fehler: CsvFehler[];
  zeilenGesamt: number;
  zeilenOk: number;
  saetze: number;
}

export interface CsvImportOptions {
  now?: Date;
  idGen?: () => string;
}

type Get = (name: string) => string;

/** Liest einen CSV-Text und baut daraus Einheiten (ohne zu speichern). */
export function importCsv(text: string, existing: AppData, opts: CsvImportOptions = {}): CsvImportResult {
  const nowIso = (opts.now ?? new Date()).toISOString();
  const id = opts.idGen ?? uuid;
  const result: CsvImportResult = {
    sport: null,
    sessions: [],
    dubletten: [],
    neueUebungen: [],
    neueHallen: [],
    fehler: [],
    zeilenGesamt: 0,
    zeilenOk: 0,
    saetze: 0,
  };

  const rows = parseCsv(text);
  if (rows.length === 0) {
    result.fehler.push({ zeile: 0, problem: 'Die Datei enthält keine Daten.' });
    return result;
  }

  if (rows[0].cells.length === 1 && /[,\t]/.test(rows[0].cells[0])) {
    result.fehler.push({ zeile: rows[0].line, problem: 'Falsches Trennzeichen. Erwartet wird das Semikolon „;“.' });
    return result;
  }

  // Kopfzeile erkennen
  let header: string[] | null = null;
  if (normText(rows[0].cells[0]) === 'datum') {
    header = rows[0].cells.map(normHeader);
    rows.shift();
  }

  // Sportart bestimmen
  let sport: Sport | null = null;
  if (header) {
    if (header.includes('uebung')) sport = 'kraft';
    else if (header.includes('halle')) sport = 'bouldern';
    else if (header.includes('distanz_km')) sport = 'laufen';
  }
  if (!sport) {
    const idx = header ? header.indexOf('sportart') : 1;
    for (const r of rows) {
      sport = sportFromLabel(r.cells[idx] ?? '');
      if (sport) break;
    }
  }
  if (!sport) {
    result.fehler.push({ zeile: 0, problem: 'Sportart nicht erkannt. Bitte eine der CSV-Vorlagen verwenden.' });
    return result;
  }
  result.sport = sport;
  result.zeilenGesamt = rows.length;

  const cols = header ?? CSV_COLUMNS[sport];
  const getter = (r: CsvRow): Get => (name) => {
    const i = cols.indexOf(name);
    return i < 0 ? '' : (r.cells[i] ?? '').trim();
  };

  if (sport === 'kraft') importKraft(rows, getter, existing, result, nowIso, id);
  else if (sport === 'bouldern') importBouldern(rows, getter, existing, result, nowIso, id);
  else importLaufen(rows, getter, existing, result, nowIso, id);

  result.fehler.sort((a, b) => a.zeile - b.zeile);
  return result;
}

function checkSportart(get: Get, sport: Sport): string | null {
  const v = get('sportart');
  if (v === '') return null;
  return sportFromLabel(v) === sport ? null : `Sportart „${v}“ passt nicht zu dieser Datei.`;
}

function num(get: Get, col: string, label: string, errs: string[], opt: { int?: boolean; min?: number; max?: number } = {}): number | null {
  const raw = get(col);
  const v = parseNum(raw);
  if (v == null) return null;
  if (isNaN(v)) {
    errs.push(`${label} „${raw}“ ist keine Zahl.`);
    return null;
  }
  if (opt.int && !Number.isInteger(v)) errs.push(`${label} „${raw}“ muss eine ganze Zahl sein.`);
  else if (opt.min != null && v < opt.min) errs.push(`${label} „${raw}“ ist zu klein (mindestens ${opt.min}).`);
  else if (opt.max != null && v > opt.max) errs.push(`${label} „${raw}“ ist zu groß (höchstens ${opt.max}).`);
  return v;
}

function baseDate(get: Get, errs: string[]): string | null {
  const raw = get('datum');
  if (!raw) {
    errs.push('Datum fehlt.');
    return null;
  }
  const iso = parseDateDE(raw);
  if (!iso) errs.push(`Datum „${raw}“ ist ungültig (erwartet TT.MM.JJJJ).`);
  return iso;
}

// ---------------------------------------------------------------- Kraft

function importKraft(rows: CsvRow[], getter: (r: CsvRow) => Get, existing: AppData, res: CsvImportResult, now: string, id: () => string) {
  const byKey = new Map(existing.uebungen.map((u) => [uebungKey(u.name, u.variante), u]));
  type Draft = { session: KraftSession; entries: Map<string, UebungEintrag & { _order: number[] }> };
  const drafts = new Map<string, Draft>();
  let order = 0;

  for (const r of rows) {
    const get = getter(r);
    const errs: string[] = [];
    const datum = baseDate(get, errs);
    const sp = checkSportart(get, 'kraft');
    if (sp) errs.push(sp);
    const name = cleanText(get('uebung'));
    const variante = cleanText(get('geraet_variante'));
    if (!name) errs.push('Übung fehlt.');
    const satzNr = num(get, 'satz', 'Satz', errs, { int: true, min: 1 });
    const wdh = num(get, 'wiederholungen', 'Wiederholungen', errs, { min: 0 });
    const gewicht = num(get, 'gewicht_kg', 'Gewicht', errs, { min: 0 });
    const dauerMin = num(get, 'dauer_min', 'Dauer', errs, { min: 0 });
    const notiz = cleanText(get('notiz'));
    if (errs.length || !datum) {
      res.fehler.push(...errs.map((problem) => ({ zeile: r.line, problem })));
      continue;
    }

    // Übung finden oder neu anlegen (Name + Variante)
    const key = uebungKey(name, variante);
    let u = byKey.get(key);
    if (!u) {
      u = { id: id(), name, variante, erstellt: now, geaendert: now };
      byKey.set(key, u);
      res.neueUebungen.push(u);
    }

    let d = drafts.get(datum);
    if (!d) {
      d = {
        session: {
          id: id(),
          sport: 'kraft',
          datum,
          dauerSekunden: null,
          fokusMuskulatur: [],
          uebungen: [],
          erstellt: now,
          geaendert: now,
        },
        entries: new Map(),
      };
      drafts.set(datum, d);
    }
    let e = d.entries.get(u.id);
    if (!e) {
      e = { uebungId: u.id, saetze: [], _order: [] };
      d.entries.set(u.id, e);
    }

    const hatSatzdaten = satzNr != null || wdh != null || gewicht != null;
    if (hatSatzdaten || dauerMin != null) {
      const satz: Satz = { gewichtKg: gewicht, wiederholungen: wdh };
      if (dauerMin != null) satz.dauerSekunden = Math.round(dauerMin * 60);
      if (notiz) satz.notiz = notiz;
      e.saetze.push(satz);
      e._order.push(satzNr ?? Number.MAX_SAFE_INTEGER - 1e6 + order);
      res.saetze++;
    } else if (notiz) {
      e.notiz = e.notiz ? `${e.notiz}; ${notiz}` : notiz;
    }
    order++;
    res.zeilenOk++;
  }

  const byId = new Map([...byKey.values()].map((u) => [u.id, u]));
  for (const d of drafts.values()) {
    d.session.uebungen = [...d.entries.values()].map(({ _order, ...e }) => {
      const idx = e.saetze.map((_, i) => i).sort((a, b) => _order[a] - _order[b] || a - b);
      const out: UebungEintrag = { uebungId: e.uebungId, saetze: idx.map((i) => e.saetze[i]) };
      if (e.notiz) out.notiz = e.notiz;
      return out;
    });
    // Fokus aus den Muskelgruppen der Übungen ableiten (falls schon zugeordnet)
    const gruppen = new Set(d.session.uebungen.flatMap((e) => byId.get(e.uebungId)?.muskelgruppen ?? []));
    d.session.fokusMuskulatur = MUSKELGRUPPEN.filter((m) => gruppen.has(m));
    d.session.fokusAbgeleitet = true;
    res.sessions.push(d.session);
    res.dubletten.push(existing.sessions.some((s) => s.sport === 'kraft' && s.datum === d.session.datum));
  }
}

// ---------------------------------------------------------------- Bouldern

function importBouldern(rows: CsvRow[], getter: (r: CsvRow) => Get, existing: AppData, res: CsvImportResult, now: string, id: () => string) {
  const byName = new Map(existing.hallen.map((h) => [normText(h.name), h]));
  for (const r of rows) {
    const get = getter(r);
    const errs: string[] = [];
    const datum = baseDate(get, errs);
    const sp = checkSportart(get, 'bouldern');
    if (sp) errs.push(sp);
    const halleName = cleanText(get('halle'));
    if (!halleName) errs.push('Halle fehlt.');
    const range = { int: true, min: GRAD_MIN, max: GRAD_MAX };
    const hallenMaxCsv = num(get, 'halle_max_grad', 'Hallen-Maximalgrad', errs, range);
    const grad = num(get, 'session_max_grad', 'Session-Maximum', errs, range);
    if (get('session_max_grad') === '') errs.push('Session-Maximum fehlt.');
    const dauerMin = num(get, 'dauer_min', 'Dauer', errs, { min: 0 });
    const notiz = cleanText(get('notiz'));

    let halle = halleName ? byName.get(normText(halleName)) : undefined;
    if (halleName && !halle && hallenMaxCsv == null && !errs.length)
      errs.push(`Halle „${halleName}“ ist neu – bitte Hallen-Maximalgrad angeben.`);
    const hallenMax = hallenMaxCsv ?? halle?.maxGrad ?? null;
    if (grad != null && hallenMax != null && grad > hallenMax && !errs.length)
      errs.push(`Session-Maximum ${grad} liegt über dem Hallen-Maximum ${hallenMax}.`);

    if (errs.length || !datum || grad == null || hallenMax == null) {
      res.fehler.push(...errs.map((problem) => ({ zeile: r.line, problem })));
      continue;
    }
    if (!halle) {
      halle = { id: id(), name: halleName, maxGrad: hallenMax, erstellt: now, geaendert: now };
      byName.set(normText(halleName), halle);
      res.neueHallen.push(halle);
    }
    const s: BoulderSession = {
      id: id(),
      sport: 'bouldern',
      datum,
      dauerSekunden: dauerMin != null ? Math.round(dauerMin * 60) : null,
      halleId: halle.id,
      sessionMaxGrad: grad,
      hallenMaxGrad: hallenMax,
      erstellt: now,
      geaendert: now,
    };
    if (notiz) s.notizen = notiz;
    res.sessions.push(s);
    res.dubletten.push(
      existing.sessions.some((x) => x.sport === 'bouldern' && x.datum === datum && x.halleId === halle!.id && x.sessionMaxGrad === grad),
    );
    res.zeilenOk++;
  }
}

// ---------------------------------------------------------------- Laufen

function importLaufen(rows: CsvRow[], getter: (r: CsvRow) => Get, existing: AppData, res: CsvImportResult, now: string, id: () => string) {
  for (const r of rows) {
    const get = getter(r);
    const errs: string[] = [];
    const datum = baseDate(get, errs);
    const sp = checkSportart(get, 'laufen');
    if (sp) errs.push(sp);
    const km = num(get, 'distanz_km', 'Distanz', errs, { min: 0 });
    if (get('distanz_km') === '') errs.push('Distanz fehlt.');
    const rawDauer = get('dauer');
    const dauer = parseClock(rawDauer);
    if (dauer == null) errs.push('Dauer fehlt.');
    else if (isNaN(dauer) || dauer <= 0) errs.push(`Dauer „${rawDauer}“ ist ungültig (erwartet h:mm:ss).`);
    const notiz = cleanText(get('notiz'));
    if (errs.length || !datum || km == null || dauer == null) {
      res.fehler.push(...errs.map((problem) => ({ zeile: r.line, problem })));
      continue;
    }
    const s: LaufSession = {
      id: id(),
      sport: 'laufen',
      datum,
      distanzKm: km,
      dauerSekunden: dauer,
      erstellt: now,
      geaendert: now,
    };
    if (notiz) s.notizen = notiz;
    res.sessions.push(s);
    res.dubletten.push(
      existing.sessions.some(
        (x) => x.sport === 'laufen' && x.datum === datum && Math.abs(x.distanzKm - km) < 1e-6 && x.dauerSekunden === dauer,
      ),
    );
    res.zeilenOk++;
  }
}

/** Übernimmt ein Importergebnis in die Daten (Dubletten optional überspringen). */
export function applyCsvImport(data: AppData, res: CsvImportResult, skipDubletten: boolean): { data: AppData; added: Session[] } {
  const added = res.sessions.filter((_, i) => !(skipDubletten && res.dubletten[i]));
  const usedU = new Set(added.flatMap((s) => (s.sport === 'kraft' ? s.uebungen.map((e) => e.uebungId) : [])));
  const usedH = new Set(added.flatMap((s) => (s.sport === 'bouldern' ? [s.halleId] : [])));
  return {
    added,
    data: {
      sessions: [...data.sessions, ...added],
      uebungen: [...data.uebungen, ...res.neueUebungen.filter((u) => usedU.has(u.id))],
      hallen: [...data.hallen, ...res.neueHallen.filter((h) => usedH.has(h.id))],
    },
  };
}

export const csvDateRange = (res: CsvImportResult) => {
  const d = res.sessions.map((s) => s.datum).sort();
  return d.length ? { von: d[0], bis: d[d.length - 1] } : null;
};

