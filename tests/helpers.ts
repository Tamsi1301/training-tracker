/** Erfundene Testdaten – keine echten Trainingsdaten. */
import type { BoulderSession, Halle, KraftSession, LaufSession, Satz, Uebung } from '../src/lib/types';

let n = 0;
const nid = (p: string) => `${p}-${++n}`;
const ts = '2025-01-01T10:00:00.000Z';

export const halle = (name: string, maxGrad: number, id = nid('h')): Halle => ({ id, name, maxGrad, erstellt: ts, geaendert: ts });
export const uebung = (name: string, variante = '', id = nid('u')): Uebung => ({ id, name, variante, erstellt: ts, geaendert: ts });

export const boulder = (datum: string, h: Halle, grad: number, hallenMax = h.maxGrad, extra: Partial<BoulderSession> = {}): BoulderSession => ({
  id: nid('s'), sport: 'bouldern', datum, dauerSekunden: 5400, halleId: h.id, sessionMaxGrad: grad, hallenMaxGrad: hallenMax,
  erstellt: `${datum}T18:00:00.000Z`, geaendert: `${datum}T18:00:00.000Z`, ...extra,
});

export const lauf = (datum: string, distanzKm: number, dauerSekunden: number, extra: Partial<LaufSession> = {}): LaufSession => ({
  id: nid('s'), sport: 'laufen', datum, distanzKm, dauerSekunden,
  erstellt: `${datum}T07:00:00.000Z`, geaendert: `${datum}T07:00:00.000Z`, ...extra,
});

export const satz = (gewichtKg: number | null, wiederholungen: number | null, extra: Partial<Satz> = {}): Satz => ({ gewichtKg, wiederholungen, ...extra });

export const kraft = (datum: string, uebungen: { u: Uebung; saetze: Satz[] }[], extra: Partial<KraftSession> = {}): KraftSession => ({
  id: nid('s'), sport: 'kraft', datum, dauerSekunden: 3600, fokusMuskulatur: ['Beine'],
  uebungen: uebungen.map((e) => ({ uebungId: e.u.id, saetze: e.saetze })),
  erstellt: `${datum}T17:00:00.000Z`, geaendert: `${datum}T17:00:00.000Z`, ...extra,
});
