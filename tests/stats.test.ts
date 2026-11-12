import { describe, expect, it } from 'vitest';
import {
  boulderBest, boulderBestPerHalle, computeStreak, fastestRun, longestRun, paceSeries, sessionsInRange, summarize,
  uebungBest, uebungSeries,
} from '../src/lib/stats';
import { periodOf } from '../src/lib/dates';
import { boulder, halle, kraft, lauf, satz, uebung } from './helpers';

describe('Kennzahlen je Zeitraum', () => {
  const h = halle('Testhalle', 8);
  const u = uebung('Kniebeuge');
  const all = [
    boulder('2026-11-09', h, 5), // Mo KW 46
    lauf('2026-11-11', 5, 1500),
    lauf('2026-11-15', 10, 3600), // So KW 46
    kraft('2026-11-16', [{ u, saetze: [satz(50, 10)] }]), // Mo KW 47
    lauf('2026-11-08', 3, 900), // So KW 45
  ];
  it('Woche Mo–So', () => {
    const w = sessionsInRange(all, periodOf('woche', '2026-11-12'));
    const s = summarize(w);
    expect(s.total).toBe(3);
    expect(s.perSport).toEqual({ bouldern: 1, kraft: 0, laufen: 2 });
    expect(s.laufKm).toBe(15);
    expect(s.avgPace).toBeCloseTo(5100 / 15, 6);
    expect(s.dauerSekunden).toBe(5400 + 1500 + 3600);
  });
  it('Monat und Jahr', () => {
    expect(summarize(sessionsInRange(all, periodOf('monat', '2026-11-01'))).total).toBe(5);
    expect(summarize(sessionsInRange(all, periodOf('jahr', '2025-06-01'))).total).toBe(0);
  });
  it('Zeitraum ohne Läufe hat keine Pace', () => {
    expect(summarize([boulder('2026-11-09', h, 5)]).avgPace).toBeNull();
  });
});

describe('Serien (Wochen in Folge)', () => {
  const h = halle('H', 7);
  it('zählt aufeinanderfolgende Wochen, laufende Woche bricht nicht ab', () => {
    const s = [
      boulder('2026-10-20', h, 4), // KW 43
      lauf('2026-10-27', 5, 1500), // KW 44
      lauf('2026-11-08', 5, 1500), // KW 45 (Sonntag)
    ];
    // heute: Donnerstag KW 46, noch nichts diese Woche → Serie 3 bleibt bestehen
    expect(computeStreak(s, '2026-11-12')).toEqual({ current: 3, longest: 3, thisWeekDone: false });
    // mit Einheit in dieser Woche → 4
    expect(computeStreak([...s, lauf('2026-11-10', 5, 1500)], '2026-11-12')).toMatchObject({ current: 4, thisWeekDone: true });
  });
  it('eine ganze Woche Pause beendet die Serie', () => {
    const s = [lauf('2026-10-13', 5, 1500), lauf('2026-10-20', 5, 1500), lauf('2026-11-03', 5, 1500)];
    expect(computeStreak(s, '2026-11-12')).toEqual({ current: 1, longest: 2, thisWeekDone: false });
    expect(computeStreak(s, '2026-11-17')).toMatchObject({ current: 0, longest: 2 });
  });
  it('je Sportart', () => {
    const s = [boulder('2026-11-03', h, 4), lauf('2026-11-10', 5, 1500)];
    expect(computeStreak(s, '2026-11-12', 'bouldern').current).toBe(1);
    expect(computeStreak(s, '2026-11-12', 'laufen').current).toBe(1);
    expect(computeStreak(s, '2026-11-12', 'kraft').current).toBe(0);
    expect(computeStreak(s, '2026-11-12').current).toBe(2);
  });
  it('Serie über den Jahreswechsel', () => {
    const s = [lauf('2025-12-22', 5, 1500), lauf('2025-12-31', 5, 1500), lauf('2026-01-05', 5, 1500)];
    expect(computeStreak(s, '2026-01-06').current).toBe(3);
  });
  it('keine Einheiten', () => {
    expect(computeStreak([], '2026-11-12')).toEqual({ current: 0, longest: 0, thisWeekDone: false });
  });
});

describe('Bestleistungen', () => {
  it('Bouldern relativ zur Halle', () => {
    const a = halle('A', 7);
    const b = halle('B', 10);
    const s = [boulder('2026-01-01', b, 7), boulder('2026-02-01', a, 6), boulder('2026-03-01', a, 5)];
    // 6/7 ≈ 0,857 schlägt 7/10
    expect(boulderBest(s)?.sessionMaxGrad).toBe(6);
    expect(boulderBest(s)?.halleId).toBe(a.id);
  });
  it('Gleichstand: höherer absoluter Grad gewinnt, dann der frühere', () => {
    const a = halle('A', 5);
    const b = halle('B', 10);
    const s = [boulder('2026-01-01', a, 4), boulder('2026-02-01', b, 8), boulder('2026-03-01', b, 8)];
    expect(boulderBest(s)?.datum).toBe('2026-02-01');
  });
  it('nutzt den Hallen-Schnappschuss, nicht den aktuellen Hallenwert', () => {
    const a = halle('A', 8);
    const s = [boulder('2025-01-01', a, 6, 6), boulder('2026-01-01', a, 7, 8)];
    expect(boulderBest(s)?.datum).toBe('2025-01-01'); // 6/6 = 100 %
  });
  it('Bestleistung je Halle', () => {
    const a = halle('A', 8);
    const b = halle('B', 8);
    const m = boulderBestPerHalle([boulder('2026-01-01', a, 5), boulder('2026-01-02', a, 6), boulder('2026-01-03', b, 3)]);
    expect(m.get(a.id)?.sessionMaxGrad).toBe(6);
    expect(m.get(b.id)?.sessionMaxGrad).toBe(3);
  });
  it('Laufen: längster Lauf und schnellste Pace (ab 1 km)', () => {
    const s = [lauf('2026-01-01', 21.1, 7600), lauf('2026-01-02', 5, 1400), lauf('2026-01-03', 0.4, 80), lauf('2026-01-04', 0, 600)];
    expect(longestRun(s)?.distanzKm).toBe(21.1);
    expect(fastestRun(s)?.pace).toBe(280);
    expect(paceSeries(s).map((p) => p.pace)).toHaveLength(3); // Distanz 0 ohne Pace
  });
  it('Kraft: schwerstes Gewicht je Übung, Variante getrennt', () => {
    const ht = uebung('Hip thrusts');
    const htP = uebung('Hip thrusts', 'panatta');
    const s = [
      kraft('2026-01-01', [{ u: ht, saetze: [satz(60, 10), satz(70, 8)] }, { u: htP, saetze: [satz(120, 8)] }]),
      kraft('2026-01-05', [{ u: ht, saetze: [satz(72.5, 6), satz(null, 10)] }]),
    ];
    expect(uebungBest(s, ht.id)).toMatchObject({ art: 'gewicht', wert: 72.5, datum: '2026-01-05' });
    expect(uebungBest(s, htP.id)).toMatchObject({ art: 'gewicht', wert: 120 });
    const series = uebungSeries(s, ht.id);
    expect(series.map((p) => p.maxGewicht)).toEqual([70, 72.5]);
    expect(series[0].volumen).toBe(60 * 10 + 70 * 8);
    expect(series[1].volumen).toBe(72.5 * 6); // Körpergewicht zählt nicht zum Volumen
  });
  it('Kraft: Körpergewicht → meiste Wiederholungen, zeitbasiert → längste Dauer', () => {
    const kz = uebung('Klimmzüge', 'mit Band');
    const pl = uebung('Plank');
    const leer = uebung('Dehnen');
    const s = [
      kraft('2026-01-01', [{ u: kz, saetze: [satz(null, 6), satz(null, 7.5)] }, { u: pl, saetze: [satz(null, null, { dauerSekunden: 60 })] }]),
      kraft('2026-01-08', [{ u: pl, saetze: [satz(null, null, { dauerSekunden: 90 })] }, { u: leer, saetze: [] }]),
    ];
    expect(uebungBest(s, kz.id)).toMatchObject({ art: 'wdh', wert: 7.5 });
    expect(uebungBest(s, pl.id)).toMatchObject({ art: 'dauer', wert: 90 });
    expect(uebungBest(s, leer.id)).toBeNull();
  });
});
