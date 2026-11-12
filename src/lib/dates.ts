/**
 * Datums- und Zeitraumlogik. Alle Tage als lokale Kalendertage „JJJJ-MM-TT“.
 * Wochenstart ist Montag (ISO 8601).
 */

export type PeriodKind = 'woche' | 'monat' | 'jahr';

export interface Period {
  kind: PeriodKind;
  /** erster Tag (inklusive) */
  start: string;
  /** letzter Tag (inklusive) */
  end: string;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** „JJJJ-MM-TT“ → lokales Datum 12:00 Uhr (robust gegen Zeitumstellung). */
export function fromISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function isISODate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return toISODate(fromISODate(s)) === s;
}

export function today(now: Date = new Date()): string {
  return toISODate(now);
}

export function addDays(iso: string, n: number): string {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

/** Wochentag mit Montag = 0 … Sonntag = 6. */
export function weekdayMon0(iso: string): number {
  return (fromISODate(iso).getDay() + 6) % 7;
}

/** Montag der Woche, in der `iso` liegt. */
export function startOfWeek(iso: string): string {
  return addDays(iso, -weekdayMon0(iso));
}

/** ISO-Kalenderwoche und zugehöriges Jahr. */
export function isoWeek(iso: string): { year: number; week: number } {
  const thursday = fromISODate(addDays(startOfWeek(iso), 3));
  const year = thursday.getFullYear();
  const jan4 = toISODate(new Date(year, 0, 4, 12));
  const week1Monday = startOfWeek(jan4);
  const diffDays = Math.round((thursday.getTime() - fromISODate(week1Monday).getTime()) / 86400000);
  return { year, week: Math.floor(diffDays / 7) + 1 };
}

export function periodOf(kind: PeriodKind, iso: string): Period {
  const d = fromISODate(iso);
  if (kind === 'woche') {
    const start = startOfWeek(iso);
    return { kind, start, end: addDays(start, 6) };
  }
  if (kind === 'monat') {
    const start = toISODate(new Date(d.getFullYear(), d.getMonth(), 1, 12));
    const end = toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12));
    return { kind, start, end };
  }
  return { kind, start: `${d.getFullYear()}-01-01`, end: `${d.getFullYear()}-12-31` };
}

/** Verschiebt einen Zeitraum um `n` Wochen/Monate/Jahre. */
export function shiftPeriod(p: Period, n: number): Period {
  if (p.kind === 'woche') return periodOf('woche', addDays(p.start, 7 * n));
  const d = fromISODate(p.start);
  if (p.kind === 'monat') return periodOf('monat', toISODate(new Date(d.getFullYear(), d.getMonth() + n, 1, 12)));
  return periodOf('jahr', toISODate(new Date(d.getFullYear() + n, 0, 1, 12)));
}

export function inPeriod(iso: string, p: { start: string; end: string }): boolean {
  return iso >= p.start && iso <= p.end;
}

/** Ganze Tage zwischen zwei Kalendertagen (b − a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((fromISODate(b).getTime() - fromISODate(a).getTime()) / 86400000);
}

const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const MONATE_KURZ = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'];
const WOCHENTAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const WOCHENTAGE_KURZ = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export const monthName = (m0: number) => MONATE[m0];
export const monthShort = (m0: number) => MONATE_KURZ[m0];
export const weekdayName = (iso: string) => WOCHENTAGE[weekdayMon0(iso)];
export const weekdayShort = (iso: string) => WOCHENTAGE_KURZ[weekdayMon0(iso)];

/** „JJJJ-MM-TT“ → „TT.MM.JJJJ“ */
export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

/** „TT.MM.JJJJ“ (auch einstellige Tag/Monat) → „JJJJ-MM-TT“, ungültig → null. */
export function parseDateDE(input: string): string | null {
  const m = String(input).trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;
  const iso = `${m[3]}-${pad2(Number(m[2]))}-${pad2(Number(m[1]))}`;
  return isISODate(iso) ? iso : null;
}

/** Überschrift eines Zeitraums, z. B. „KW 46“, „November 2026“, „2026“. */
export function periodTitle(p: Period): string {
  const d = fromISODate(p.start);
  if (p.kind === 'woche') return `KW ${isoWeek(p.start).week}`;
  if (p.kind === 'monat') return `${monthName(d.getMonth())} ${d.getFullYear()}`;
  return String(d.getFullYear());
}

/** Untertitel, z. B. „10.–16. Nov. 2026“ oder „29. Dez. 2025 – 4. Jan. 2026“. */
export function periodSubtitle(p: Period): string {
  if (p.kind !== 'woche') return '';
  const a = fromISODate(p.start);
  const b = fromISODate(p.end);
  if (a.getFullYear() !== b.getFullYear())
    return `${a.getDate()}. ${monthShort(a.getMonth())} ${a.getFullYear()} – ${b.getDate()}. ${monthShort(b.getMonth())} ${b.getFullYear()}`;
  if (a.getMonth() !== b.getMonth())
    return `${a.getDate()}. ${monthShort(a.getMonth())} – ${b.getDate()}. ${monthShort(b.getMonth())} ${b.getFullYear()}`;
  return `${a.getDate()}.–${b.getDate()}. ${monthShort(b.getMonth())} ${b.getFullYear()}`;
}

/** „Heute“, „Gestern“ oder „Mo, 10.11.2026“ */
export function fmtDateRelative(iso: string, now: string = today()): string {
  const diff = daysBetween(iso, now);
  if (diff === 0) return 'Heute';
  if (diff === 1) return 'Gestern';
  return `${weekdayShort(iso)}, ${fmtDate(iso)}`;
}
