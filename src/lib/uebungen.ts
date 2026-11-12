import type { Uebung } from './types';

/** Normalisiert Text für Vergleiche: Groß/Klein egal, Mehrfach-Leerzeichen zusammengefasst. */
export function normText(s: string | null | undefined): string {
  return (s ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('de-DE');
}

/** Bereinigt eine Benutzereingabe (Leerzeichen trimmen/zusammenfassen, Schreibweise bleibt). */
export function cleanText(s: string | null | undefined): string {
  return (s ?? '').trim().replace(/\s+/g, ' ');
}

/** Identitätsschlüssel einer Übung: Name + Gerät/Variante. */
export function uebungKey(name: string, variante: string | null | undefined): string {
  return `${normText(name)}\u0000${normText(variante)}`;
}

/** Anzeige „Hip thrusts (panatta)“ bzw. „Hip thrusts“. */
export function uebungLabel(u: Pick<Uebung, 'name' | 'variante'> | undefined | null): string {
  if (!u) return 'Unbekannte Übung';
  return u.variante ? `${u.name} (${u.variante})` : u.name;
}

export function findUebung(list: Uebung[], name: string, variante: string): Uebung | undefined {
  const key = uebungKey(name, variante);
  return list.find((u) => uebungKey(u.name, u.variante) === key);
}

export function sortUebungen(list: Uebung[]): Uebung[] {
  return [...list].sort((a, b) => uebungLabel(a).localeCompare(uebungLabel(b), 'de-DE'));
}
