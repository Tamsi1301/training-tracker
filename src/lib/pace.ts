import { fmtClock } from './format';

/**
 * Pace in Sekunden pro Kilometer.
 * Bei Distanz ≤ 0 oder fehlender/ungültiger Dauer → null (keine Anzeige, kein Fehler).
 */
export function paceSecPerKm(distanzKm: number | null | undefined, dauerSekunden: number | null | undefined): number | null {
  if (distanzKm == null || dauerSekunden == null) return null;
  if (!isFinite(distanzKm) || !isFinite(dauerSekunden)) return null;
  if (distanzKm <= 0 || dauerSekunden <= 0) return null;
  return dauerSekunden / distanzKm;
}

/** Pace → „m:ss /km“ (gerundet auf ganze Sekunden, nie „5:60“). */
export function fmtPace(secPerKm: number | null | undefined, withUnit = true): string {
  if (secPerKm == null || !isFinite(secPerKm) || secPerKm <= 0) return '–';
  return fmtClock(Math.round(secPerKm)) + (withUnit ? ' /km' : '');
}

/** Durchschnittliche Pace mehrerer Läufe: Gesamtzeit ÷ Gesamtdistanz. */
export function averagePace(runs: { distanzKm: number; dauerSekunden: number }[]): number | null {
  let km = 0;
  let sec = 0;
  for (const r of runs) {
    if (r.distanzKm > 0 && r.dauerSekunden > 0) {
      km += r.distanzKm;
      sec += r.dauerSekunden;
    }
  }
  return paceSecPerKm(km, sec);
}
