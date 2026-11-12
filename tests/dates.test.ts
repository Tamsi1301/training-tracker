import { describe, expect, it } from 'vitest';
import {
  addDays, fmtDate, isoWeek, parseDateDE, periodOf, periodSubtitle, periodTitle, shiftPeriod, startOfWeek, weekdayMon0,
} from '../src/lib/dates';

describe('Wochen beginnen am Montag', () => {
  it('Montag bleibt Montag, Sonntag gehört zur vorherigen Woche', () => {
    expect(startOfWeek('2026-11-09')).toBe('2026-11-09'); // Montag
    expect(startOfWeek('2026-11-12')).toBe('2026-11-09'); // Donnerstag
    expect(startOfWeek('2026-11-15')).toBe('2026-11-09'); // Sonntag
    expect(startOfWeek('2026-11-16')).toBe('2026-11-16'); // nächster Montag
    expect(weekdayMon0('2026-11-15')).toBe(6);
  });
  it('Woche über Monats- und Jahresgrenze', () => {
    const p = periodOf('woche', '2026-01-01'); // Donnerstag
    expect(p).toEqual({ kind: 'woche', start: '2025-12-29', end: '2026-01-04' });
    expect(periodTitle(p)).toBe('KW 1');
    expect(periodSubtitle(p)).toBe('29. Dez. 2025 – 4. Jan. 2026');
  });
  it('ISO-Kalenderwochen', () => {
    expect(isoWeek('2026-11-12')).toEqual({ year: 2026, week: 46 });
    expect(isoWeek('2021-01-03')).toEqual({ year: 2020, week: 53 });
    expect(isoWeek('2024-12-30')).toEqual({ year: 2025, week: 1 });
  });
  it('Zeitumstellung verschiebt keine Tage', () => {
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(startOfWeek('2026-03-29')).toBe('2026-03-23');
  });
});

describe('Monat und Jahr', () => {
  it('Monatsgrenzen inkl. Schaltjahr', () => {
    expect(periodOf('monat', '2024-02-15')).toEqual({ kind: 'monat', start: '2024-02-01', end: '2024-02-29' });
    expect(periodOf('monat', '2026-11-12')).toMatchObject({ start: '2026-11-01', end: '2026-11-30' });
    expect(periodTitle(periodOf('monat', '2026-03-02'))).toBe('März 2026');
  });
  it('Jahr', () => {
    expect(periodOf('jahr', '2026-06-01')).toEqual({ kind: 'jahr', start: '2026-01-01', end: '2026-12-31' });
  });
  it('Blättern', () => {
    expect(shiftPeriod(periodOf('woche', '2026-11-12'), -1).start).toBe('2026-11-02');
    expect(shiftPeriod(periodOf('monat', '2026-01-31'), -1)).toMatchObject({ start: '2025-12-01', end: '2025-12-31' });
    expect(shiftPeriod(periodOf('monat', '2026-01-31'), 1)).toMatchObject({ start: '2026-02-01', end: '2026-02-28' });
    expect(shiftPeriod(periodOf('jahr', '2026-05-05'), -2).start).toBe('2024-01-01');
  });
});

describe('Datumsformat TT.MM.JJJJ', () => {
  it('formatiert und parst', () => {
    expect(fmtDate('2026-11-02')).toBe('02.11.2026');
    expect(parseDateDE('02.11.2026')).toBe('2026-11-02');
    expect(parseDateDE('2.1.2026')).toBe('2026-01-02');
    expect(parseDateDE('31.02.2026')).toBeNull();
    expect(parseDateDE('2026-11-02')).toBeNull();
  });
});
