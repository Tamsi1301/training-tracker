/** Auswertungen: Kennzahlen, Serien, Bestleistungen und Verlaufsdaten. */
import { averagePace, paceSecPerKm } from './pace';
import { addDays, inPeriod, startOfWeek } from './dates';
import type { BoulderSession, KraftSession, LaufSession, Satz, Session, Sport } from './types';

export const isBoulder = (s: Session): s is BoulderSession => s.sport === 'bouldern';
export const isKraft = (s: Session): s is KraftSession => s.sport === 'kraft';
export const isLauf = (s: Session): s is LaufSession => s.sport === 'laufen';

/** Chronologisch aufsteigend (Datum, dann Erfassungszeit). */
export function sortChrono<T extends Session>(list: T[]): T[] {
  return [...list].sort((a, b) => (a.datum === b.datum ? a.erstellt.localeCompare(b.erstellt) : a.datum.localeCompare(b.datum)));
}

/** Neueste zuerst. */
export function sortNewestFirst<T extends Session>(list: T[]): T[] {
  return sortChrono(list).reverse();
}

export function sessionsInRange(sessions: Session[], range: { start: string; end: string }): Session[] {
  return sessions.filter((s) => inPeriod(s.datum, range));
}

// ---------------------------------------------------------------- Kennzahlen

export interface Summary {
  total: number;
  perSport: Record<Sport, number>;
  /** Summe aller bekannten Dauern in Sekunden */
  dauerSekunden: number;
  laufKm: number;
  /** Ø-Pace = Gesamtzeit ÷ Gesamtdistanz (s/km) */
  avgPace: number | null;
}

export function summarize(sessions: Session[]): Summary {
  const perSport: Record<Sport, number> = { bouldern: 0, kraft: 0, laufen: 0 };
  let dauer = 0;
  let km = 0;
  const runs: LaufSession[] = [];
  for (const s of sessions) {
    perSport[s.sport]++;
    if (s.dauerSekunden && s.dauerSekunden > 0) dauer += s.dauerSekunden;
    if (isLauf(s)) {
      km += s.distanzKm > 0 ? s.distanzKm : 0;
      runs.push(s);
    }
  }
  return { total: sessions.length, perSport, dauerSekunden: dauer, laufKm: km, avgPace: averagePace(runs) };
}

// ---------------------------------------------------------------- Serien

export interface Streak {
  /** Wochen in Folge bis heute (laufende Woche unterbricht nicht) */
  current: number;
  /** längste Serie überhaupt */
  longest: number;
  /** gibt es in der laufenden Woche schon eine Einheit? */
  thisWeekDone: boolean;
}

/**
 * Serien: Wochen (Mo–So) in Folge mit mindestens einer Einheit.
 * Die laufende Woche bricht eine Serie nicht ab, solange sie nicht vorbei ist.
 */
export function computeStreak(sessions: Session[], todayIso: string, sport?: Sport): Streak {
  const weeks = new Set<string>();
  for (const s of sessions) {
    if (sport && s.sport !== sport) continue;
    if (s.datum > todayIso) continue; // Zukunftseinträge zählen nicht
    weeks.add(startOfWeek(s.datum));
  }
  const thisWeek = startOfWeek(todayIso);
  const thisWeekDone = weeks.has(thisWeek);

  let current = 0;
  let w = thisWeekDone ? thisWeek : addDays(thisWeek, -7);
  while (weeks.has(w)) {
    current++;
    w = addDays(w, -7);
  }

  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const wk of [...weeks].sort()) {
    run = prev !== null && addDays(prev, 7) === wk ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = wk;
  }
  return { current, longest, thisWeekDone };
}

// ---------------------------------------------------------------- Bouldern

export const boulderRatio = (s: BoulderSession) => (s.hallenMaxGrad > 0 ? s.sessionMaxGrad / s.hallenMaxGrad : 0);

/** Vergleich zweier Boulder-Einheiten: höheres Verhältnis zur Halle, dann höherer Grad, dann früher erreicht. */
function betterBoulder(a: BoulderSession, b: BoulderSession): boolean {
  const ra = boulderRatio(a);
  const rb = boulderRatio(b);
  if (Math.abs(ra - rb) > 1e-9) return ra > rb;
  if (a.sessionMaxGrad !== b.sessionMaxGrad) return a.sessionMaxGrad > b.sessionMaxGrad;
  return a.datum < b.datum;
}

/** Beste Boulder-Leistung im Verhältnis zur Halle (z. B. 6 von 7 schlägt 6 von 8). */
export function boulderBest(sessions: Session[]): BoulderSession | null {
  let best: BoulderSession | null = null;
  for (const s of sessions) if (isBoulder(s) && (!best || betterBoulder(s, best))) best = s;
  return best;
}

/** Bestleistung je Halle (höchster Grad, bei Gleichstand der früheste). */
export function boulderBestPerHalle(sessions: Session[]): Map<string, BoulderSession> {
  const map = new Map<string, BoulderSession>();
  for (const s of sessions) {
    if (!isBoulder(s)) continue;
    const cur = map.get(s.halleId);
    if (!cur || s.sessionMaxGrad > cur.sessionMaxGrad || (s.sessionMaxGrad === cur.sessionMaxGrad && s.datum < cur.datum))
      map.set(s.halleId, s);
  }
  return map;
}

export interface BoulderPoint {
  datum: string;
  sessionId: string;
  grad: number;
  hallenMax: number;
  halleId: string;
}

export function boulderSeries(sessions: Session[]): BoulderPoint[] {
  return sortChrono(sessions.filter(isBoulder)).map((s) => ({
    datum: s.datum,
    sessionId: s.id,
    grad: s.sessionMaxGrad,
    hallenMax: s.hallenMaxGrad,
    halleId: s.halleId,
  }));
}

// ---------------------------------------------------------------- Laufen

export interface PacePoint {
  datum: string;
  sessionId: string;
  pace: number;
  distanzKm: number;
}

export function paceSeries(sessions: Session[]): PacePoint[] {
  const out: PacePoint[] = [];
  for (const s of sortChrono(sessions.filter(isLauf))) {
    const p = paceSecPerKm(s.distanzKm, s.dauerSekunden);
    if (p != null) out.push({ datum: s.datum, sessionId: s.id, pace: p, distanzKm: s.distanzKm });
  }
  return out;
}

export function longestRun(sessions: Session[]): LaufSession | null {
  let best: LaufSession | null = null;
  for (const s of sessions) if (isLauf(s) && s.distanzKm > 0 && (!best || s.distanzKm > best.distanzKm)) best = s;
  return best;
}

/** Mindestdistanz, damit ein Lauf für „schnellste Pace“ zählt. */
export const FASTEST_PACE_MIN_KM = 1;

export function fastestRun(sessions: Session[]): { session: LaufSession; pace: number } | null {
  let best: { session: LaufSession; pace: number } | null = null;
  for (const s of sessions) {
    if (!isLauf(s) || s.distanzKm < FASTEST_PACE_MIN_KM) continue;
    const p = paceSecPerKm(s.distanzKm, s.dauerSekunden);
    if (p != null && (!best || p < best.pace)) best = { session: s, pace: p };
  }
  return best;
}

// ---------------------------------------------------------------- Kraft

/** Art der Messung einer Übung: mit Gewicht, nur Wiederholungen (Körpergewicht), nur Dauer. */
export type UebungArt = 'gewicht' | 'wdh' | 'dauer' | 'leer';

export const satzVolumen = (s: Satz) =>
  s.gewichtKg != null && s.gewichtKg > 0 && s.wiederholungen != null && s.wiederholungen > 0 ? s.gewichtKg * s.wiederholungen : 0;

export interface UebungPoint {
  datum: string;
  sessionId: string;
  maxGewicht: number | null;
  volumen: number;
  maxWdh: number | null;
  maxDauer: number | null;
  saetze: number;
}

const maxOf = (vals: (number | null | undefined)[]): number | null => {
  let m: number | null = null;
  for (const v of vals) if (v != null && isFinite(v) && v > 0 && (m == null || v > m)) m = v;
  return m;
};

/** Verlauf einer Übung, ein Punkt je Einheit (mehrere Einträge in derselben Einheit werden zusammengefasst). */
export function uebungSeries(sessions: Session[], uebungId: string): UebungPoint[] {
  const out: UebungPoint[] = [];
  for (const s of sortChrono(sessions.filter(isKraft))) {
    const saetze = s.uebungen.filter((e) => e.uebungId === uebungId).flatMap((e) => e.saetze);
    if (!s.uebungen.some((e) => e.uebungId === uebungId)) continue;
    out.push({
      datum: s.datum,
      sessionId: s.id,
      maxGewicht: maxOf(saetze.map((x) => x.gewichtKg)),
      volumen: saetze.reduce((a, x) => a + satzVolumen(x), 0),
      maxWdh: maxOf(saetze.map((x) => x.wiederholungen)),
      maxDauer: maxOf(saetze.map((x) => x.dauerSekunden)),
      saetze: saetze.length,
    });
  }
  return out;
}

export function uebungArt(points: UebungPoint[]): UebungArt {
  if (points.some((p) => p.maxGewicht != null)) return 'gewicht';
  if (points.some((p) => p.maxWdh != null)) return 'wdh';
  if (points.some((p) => p.maxDauer != null)) return 'dauer';
  return 'leer';
}

export interface UebungBest {
  uebungId: string;
  art: UebungArt;
  /** kg, Wiederholungen oder Sekunden – je nach Art */
  wert: number;
  datum: string;
  sessionId: string;
}

/** Bestleistung einer Übung: schwerstes Gewicht, sonst meiste Wiederholungen, sonst längste Dauer. */
export function uebungBest(sessions: Session[], uebungId: string): UebungBest | null {
  const pts = uebungSeries(sessions, uebungId);
  const art = uebungArt(pts);
  if (art === 'leer') return null;
  const val = (p: UebungPoint) => (art === 'gewicht' ? p.maxGewicht : art === 'wdh' ? p.maxWdh : p.maxDauer);
  let best: UebungPoint | null = null;
  for (const p of pts) {
    const v = val(p);
    if (v != null && (best == null || v > (val(best) ?? 0))) best = p;
  }
  return best ? { uebungId, art, wert: val(best)!, datum: best.datum, sessionId: best.sessionId } : null;
}

/** IDs aller Übungen, die in Einheiten vorkommen, nach Häufigkeit sortiert. */
export function uebungenNachHaeufigkeit(sessions: Session[]): { uebungId: string; count: number; last: string }[] {
  const map = new Map<string, { count: number; last: string }>();
  for (const s of sessions) {
    if (!isKraft(s)) continue;
    const seen = new Set<string>();
    for (const e of s.uebungen) {
      if (seen.has(e.uebungId)) continue;
      seen.add(e.uebungId);
      const cur = map.get(e.uebungId) ?? { count: 0, last: '' };
      cur.count++;
      if (s.datum > cur.last) cur.last = s.datum;
      map.set(e.uebungId, cur);
    }
  }
  return [...map.entries()]
    .map(([uebungId, v]) => ({ uebungId, ...v }))
    .sort((a, b) => b.count - a.count || b.last.localeCompare(a.last));
}

/** Anzahl der Sätze einer Kraft-Einheit. */
export const satzAnzahl = (s: KraftSession) => s.uebungen.reduce((a, e) => a + e.saetze.length, 0);
