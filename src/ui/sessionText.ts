/** Texte für die Darstellung einer Einheit in Listen und Details. */
import { fmtDuration, fmtNum, plural } from '../lib/format';
import { fmtPace, paceSecPerKm } from '../lib/pace';
import { satzAnzahl } from '../lib/stats';
import type { Session } from '../lib/types';
import { hallenById } from '../store';

export function sessionTitle(s: Session): string {
  if (s.sport === 'bouldern') return hallenById.value.get(s.halleId)?.name ?? 'Bouldern';
  if (s.sport === 'laufen') return s.distanzKm > 0 ? `${fmtNum(s.distanzKm)} km` : 'Lauf';
  return s.fokusMuskulatur.length ? s.fokusMuskulatur.join(', ') : 'Krafttraining';
}

export function sessionSummary(s: Session): string {
  const parts: string[] = [];
  if (s.sport === 'bouldern') parts.push(`Max ${s.sessionMaxGrad} von ${s.hallenMaxGrad}`);
  if (s.sport === 'laufen') {
    const p = paceSecPerKm(s.distanzKm, s.dauerSekunden);
    if (p != null) parts.push(fmtPace(p));
  }
  if (s.sport === 'kraft') {
    parts.push(plural(s.uebungen.length, 'Übung', 'Übungen'));
    const n = satzAnzahl(s);
    if (n) parts.push(plural(n, 'Satz', 'Sätze'));
  }
  if (s.dauerSekunden) parts.push(fmtDuration(s.dauerSekunden));
  return parts.join(' · ');
}
