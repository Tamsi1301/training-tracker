/** Deutsche Formatierung und Eingabe-Parsing (Komma als Dezimaltrenner). */

/** Zahl mit Komma, höchstens `maxDecimals` Nachkommastellen, ohne überflüssige Nullen. */
export function fmtNum(n: number, maxDecimals = 2, minDecimals = 0): string {
  return n.toLocaleString('de-DE', {
    maximumFractionDigits: maxDecimals,
    minimumFractionDigits: minDecimals,
    useGrouping: true,
  });
}

/**
 * Liest eine Zahl im deutschen Format („12,5“). Ein Punkt wird ebenfalls als
 * Dezimaltrenner akzeptiert („12.5“). Leere Eingabe → null, Unsinn → NaN.
 */
export function parseNum(input: string | null | undefined): number | null {
  if (input == null) return null;
  const s = String(input).trim().replace(/\s/g, '');
  if (s === '') return null;
  if (!/^[-+]?(\d+([.,]\d*)?|[.,]\d+)$/.test(s)) return NaN;
  return Number(s.replace(',', '.'));
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Sekunden → „h:mm:ss“ bzw. „m:ss“ (unter einer Stunde). */
export function fmtClock(totalSeconds: number, forceHours = false): string {
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0 || forceHours) return `${h}:${pad2(m)}:${pad2(sec)}`;
  return `${m}:${pad2(sec)}`;
}

/** Sekunden → „1 h 20 min“ / „45 min“ / „30 s“. */
export function fmtDuration(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null || !isFinite(totalSeconds)) return '–';
  const s = Math.round(totalSeconds);
  if (s < 60) return `${s} s`;
  const totalMin = Math.round(s / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

/**
 * Liest eine Dauer: „h:mm:ss“, „mm:ss“ oder nur Minuten („45“, „1,5“).
 * Rückgabe in Sekunden, leer → null, ungültig → NaN.
 */
export function parseClock(input: string | null | undefined): number | null {
  if (input == null) return null;
  const s = String(input).trim();
  if (s === '') return null;
  if (s.includes(':')) {
    const parts = s.split(':');
    if (parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return NaN;
    const nums = parts.map(Number);
    if (nums.length === 3) {
      const [h, m, sec] = nums;
      if (m > 59 || sec > 59) return NaN;
      return h * 3600 + m * 60 + sec;
    }
    const [m, sec] = nums;
    if (sec > 59) return NaN;
    return m * 60 + sec;
  }
  const min = parseNum(s);
  if (min == null || isNaN(min) || min < 0) return NaN;
  return Math.round(min * 60);
}

/** Einheiten-Wort mit korrekter Einzahl/Mehrzahl. */
export function plural(n: number, one: string, many: string): string {
  return `${fmtNum(n)} ${n === 1 ? one : many}`;
}
