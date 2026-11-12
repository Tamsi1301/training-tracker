import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { backupToJson, createBackup, mergeData, parseBackup, previewBackup } from '../src/lib/backup';
import { applyChanges, closeDb, loadAll, replaceAll } from '../src/lib/db';
import type { AppData } from '../src/lib/types';
import { boulder, halle, kraft, lauf, satz, uebung } from './helpers';

function sample(): AppData {
  const h = halle('Testhalle', 8);
  const u1 = uebung('Kniebeuge');
  const u2 = uebung('Hip thrusts', 'panatta');
  return {
    hallen: [h],
    uebungen: [u1, u2],
    sessions: [
      boulder('2026-01-02', h, 5, 8, { notizen: 'Überhang, „schwer“ 💪' }),
      kraft('2026-01-03', [
        { u: u1, saetze: [satz(60, 10), satz(62.5, 2.25, { notiz: 'Myo 1' })] },
        { u: u2, saetze: [satz(null, null, { dauerSekunden: 90 })] },
      ]),
      lauf('2026-01-04', 0, 600),
      lauf('2026-01-05', 10.25, 3001),
    ],
  };
}

const sortById = (d: AppData) => ({
  sessions: [...d.sessions].sort((a, b) => a.id.localeCompare(b.id)),
  hallen: [...d.hallen].sort((a, b) => a.id.localeCompare(b.id)),
  uebungen: [...d.uebungen].sort((a, b) => a.id.localeCompare(b.id)),
});

describe('Export/Import-Roundtrip', () => {
  it('Export → Import verändert keine Daten (JSON)', () => {
    const data = sample();
    const json = backupToJson(createBackup(data, new Date('2026-11-12T10:00:00Z')));
    const parsed = parseBackup(json);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect({ sessions: parsed.backup.sessions, hallen: parsed.backup.hallen, uebungen: parsed.backup.uebungen }).toEqual(data);
    // zweiter Durchlauf liefert identisches JSON
    expect(backupToJson(createBackup(parsed.backup, new Date('2026-11-12T10:00:00Z')))).toBe(json);
  });

  it('Roundtrip über IndexedDB (Ersetzen) verändert keine Daten', async () => {
    const data = sample();
    await replaceAll(data);
    const loaded = await loadAll();
    const parsed = parseBackup(backupToJson(createBackup(loaded)));
    if (!parsed.ok) throw new Error(parsed.error);
    await replaceAll(parsed.backup);
    expect(sortById(await loadAll())).toEqual(sortById(data));
    await applyChanges({ del: { sessions: [data.sessions[0].id] } });
    expect((await loadAll()).sessions).toHaveLength(3);
    await closeDb();
  });

  it('Zusammenführen derselben Sicherung ändert nichts', () => {
    const data = sample();
    const r = mergeData(data, data);
    expect(sortById(r.data)).toEqual(sortById(data));
    expect(r.sessions).toEqual({ neu: 0, aktualisiert: 0, unveraendert: 4 });
  });

  it('Vorschau', () => {
    const p = previewBackup(createBackup(sample()));
    expect(p).toMatchObject({ sessions: 4, hallen: 1, uebungen: 2, von: '2026-01-02', bis: '2026-01-05' });
  });
});

describe('Zusammenführen', () => {
  it('erkennt Dubletten per id, neuerer Stand gewinnt', () => {
    const base = sample();
    const changed = structuredClone(base);
    changed.sessions[3] = { ...changed.sessions[3], notizen: 'geändert', geaendert: '2027-01-01T00:00:00.000Z' };
    const older = structuredClone(base);
    older.sessions[2] = { ...older.sessions[2], notizen: 'alt', geaendert: '2000-01-01T00:00:00.000Z' };
    const extra = lauf('2026-02-01', 5, 1500);

    const r = mergeData(base, { ...changed, sessions: [...changed.sessions, extra] });
    expect(r.sessions).toEqual({ neu: 1, aktualisiert: 1, unveraendert: 3 });
    expect(r.data.sessions.find((s) => s.id === base.sessions[3].id)?.notizen).toBe('geändert');

    const r2 = mergeData(base, older);
    expect(r2.data.sessions.find((s) => s.id === base.sessions[2].id)?.notizen).toBeUndefined();
  });

  it('bildet gleichnamige Hallen und gleiche Übungen (Name+Variante) mit anderer id auf vorhandene ab', () => {
    const base = sample();
    const h2 = halle('testhalle', 8); // gleicher Name, andere id
    const u2 = uebung('Kniebeuge'); // gleiche Übung, andere id
    const u3 = uebung('Kniebeuge', 'Multipresse'); // andere Variante → neue Übung
    const s1 = boulder('2026-03-01', h2, 6);
    const s2 = kraft('2026-03-02', [{ u: u2, saetze: [satz(70, 5)] }, { u: u3, saetze: [satz(80, 5)] }]);
    const r = mergeData(base, { hallen: [h2], uebungen: [u2, u3], sessions: [s1, s2] });
    expect(r.data.hallen).toHaveLength(1);
    expect(r.data.uebungen).toHaveLength(3);
    const ms1 = r.data.sessions.find((s) => s.id === s1.id);
    expect(ms1 && ms1.sport === 'bouldern' && ms1.halleId).toBe(base.hallen[0].id);
    const ms2 = r.data.sessions.find((s) => s.id === s2.id);
    expect(ms2 && ms2.sport === 'kraft' && ms2.uebungen.map((e) => e.uebungId)).toEqual([base.uebungen[0].id, u3.id]);
  });
});

describe('Prüfung der Sicherung', () => {
  it('lehnt fremde oder kaputte Dateien ab', () => {
    expect(parseBackup('kein json').ok).toBe(false);
    expect(parseBackup('{"format":"anderes"}').ok).toBe(false);
    const b = createBackup(sample());
    expect(parseBackup(JSON.stringify({ ...b, version: 99 })).ok).toBe(false);
    const broken = { ...b, sessions: [{ ...b.sessions[0], datum: '31.12.2026' }] };
    const r = parseBackup(JSON.stringify(broken));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Einheit 1/);
    const orphan = { ...b, hallen: [] };
    expect(parseBackup(JSON.stringify(orphan)).ok).toBe(false);
  });
  it('akzeptiert BOM', () => {
    expect(parseBackup('﻿' + JSON.stringify(createBackup(sample()))).ok).toBe(true);
  });
});
