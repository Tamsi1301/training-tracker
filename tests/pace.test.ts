import { describe, expect, it } from 'vitest';
import { averagePace, fmtPace, paceSecPerKm } from '../src/lib/pace';
import { fmtClock, fmtDuration, fmtNum, parseClock, parseNum } from '../src/lib/format';

describe('Pace', () => {
  it('berechnet Sekunden pro km', () => {
    expect(paceSecPerKm(10, 3000)).toBe(300);
    expect(paceSecPerKm(5.2, 1725)).toBeCloseTo(331.73, 1);
  });
  it('liefert bei Distanz 0 oder fehlender Dauer null statt Fehler', () => {
    expect(paceSecPerKm(0, 1800)).toBeNull();
    expect(paceSecPerKm(5, 0)).toBeNull();
    expect(paceSecPerKm(null, 100)).toBeNull();
    expect(paceSecPerKm(-1, 100)).toBeNull();
    expect(paceSecPerKm(NaN, 100)).toBeNull();
    expect(fmtPace(null)).toBe('–');
  });
  it('formatiert als m:ss /km ohne „5:60“', () => {
    expect(fmtPace(300)).toBe('5:00 /km');
    expect(fmtPace(331.73)).toBe('5:32 /km');
    expect(fmtPace(359.6)).toBe('6:00 /km');
    expect(fmtPace(65, false)).toBe('1:05');
  });
  it('Ø-Pace = Gesamtzeit ÷ Gesamtdistanz (gewichtet)', () => {
    // 3 km in 15 min (5:00) + 15 km in 90 min (6:00) → 105 min / 18 km = 5:50
    const p = averagePace([
      { distanzKm: 3, dauerSekunden: 900 },
      { distanzKm: 15, dauerSekunden: 5400 },
      { distanzKm: 0, dauerSekunden: 600 },
    ]);
    expect(p).toBeCloseTo(350, 5);
    expect(averagePace([])).toBeNull();
  });
});

describe('Formatierung', () => {
  it('Zahlen mit Komma', () => {
    expect(fmtNum(12.5)).toBe('12,5');
    expect(fmtNum(1234.5)).toBe('1.234,5');
    expect(fmtNum(2.25)).toBe('2,25');
  });
  it('parseNum akzeptiert Komma und Punkt', () => {
    expect(parseNum('12,5')).toBe(12.5);
    expect(parseNum('12.5')).toBe(12.5);
    expect(parseNum(' ')).toBeNull();
    expect(parseNum('abc')).toBeNaN();
    expect(parseNum('1,2,3')).toBeNaN();
  });
  it('Dauer parsen und formatieren', () => {
    expect(parseClock('1:02:03')).toBe(3723);
    expect(parseClock('28:45')).toBe(1725);
    expect(parseClock('45')).toBe(2700);
    expect(parseClock('1:75')).toBeNaN();
    expect(parseClock('')).toBeNull();
    expect(fmtClock(3723)).toBe('1:02:03');
    expect(fmtClock(1725)).toBe('28:45');
    expect(fmtDuration(4800)).toBe('1 h 20 min');
    expect(fmtDuration(2700)).toBe('45 min');
    expect(fmtDuration(null)).toBe('–');
  });
});
