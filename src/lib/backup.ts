/** JSON-Sicherung: Export, Prüfung, Ersetzen und Zusammenführen. */
import { APP_CONFIG } from '../config';
import { isISODate } from './dates';
import { normText, uebungKey } from './uebungen';
import type { AppData, Backup, Halle, Session, Uebung } from './types';
import { SPORTS } from './types';

export function createBackup(data: AppData, now: Date = new Date()): Backup {
  return {
    format: APP_CONFIG.backupFormat,
    version: APP_CONFIG.backupVersion,
    app: APP_CONFIG.name,
    exportiert: now.toISOString(),
    sessions: data.sessions,
    hallen: data.hallen,
    uebungen: data.uebungen,
  };
}

export function backupToJson(b: Backup): string {
  return JSON.stringify(b, null, 2);
}

export function backupFileName(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `training-backup-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json`;
}

export type ParseResult = { ok: true; backup: Backup } | { ok: false; error: string };

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

function sessionProblem(s: unknown, hallenIds: Set<string>, uebungIds: Set<string>): string | null {
  if (!isObj(s)) return 'kein Objekt';
  if (typeof s.id !== 'string' || !s.id) return 'id fehlt';
  if (!SPORTS.includes(s.sport as never)) return `unbekannte Sportart „${String(s.sport)}“`;
  if (!isISODate(s.datum)) return `ungültiges Datum „${String(s.datum)}“`;
  if (s.sport === 'bouldern') {
    if (typeof s.halleId !== 'string' || !hallenIds.has(s.halleId)) return 'Halle unbekannt';
    if (typeof s.sessionMaxGrad !== 'number' || typeof s.hallenMaxGrad !== 'number') return 'Grad fehlt';
  }
  if (s.sport === 'kraft') {
    if (!Array.isArray(s.uebungen)) return 'Übungen fehlen';
    for (const e of s.uebungen) {
      if (!isObj(e) || typeof e.uebungId !== 'string' || !uebungIds.has(e.uebungId)) return 'Übung unbekannt';
      if (!Array.isArray(e.saetze)) return 'Sätze fehlen';
    }
  }
  if (s.sport === 'laufen' && (typeof s.distanzKm !== 'number' || typeof s.dauerSekunden !== 'number'))
    return 'Distanz oder Dauer fehlt';
  return null;
}

/** Liest und prüft eine JSON-Sicherung. */
export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text.replace(/^﻿/, ''));
  } catch {
    return { ok: false, error: 'Die Datei ist keine gültige JSON-Datei.' };
  }
  if (!isObj(raw) || raw.format !== APP_CONFIG.backupFormat)
    return { ok: false, error: 'Die Datei ist keine Sicherung dieser App.' };
  if (typeof raw.version !== 'number' || raw.version > APP_CONFIG.backupVersion)
    return { ok: false, error: 'Die Sicherung stammt aus einer neueren App-Version. Bitte zuerst die App aktualisieren.' };
  if (!Array.isArray(raw.sessions) || !Array.isArray(raw.hallen) || !Array.isArray(raw.uebungen))
    return { ok: false, error: 'Die Sicherung ist unvollständig.' };

  for (const h of raw.hallen)
    if (!isObj(h) || typeof h.id !== 'string' || typeof h.name !== 'string' || typeof h.maxGrad !== 'number')
      return { ok: false, error: 'Eine Halle in der Sicherung ist fehlerhaft.' };
  for (const u of raw.uebungen)
    if (!isObj(u) || typeof u.id !== 'string' || typeof u.name !== 'string')
      return { ok: false, error: 'Eine Übung in der Sicherung ist fehlerhaft.' };

  const hallenIds = new Set((raw.hallen as Halle[]).map((h) => h.id));
  const uebungIds = new Set((raw.uebungen as Uebung[]).map((u) => u.id));
  for (let i = 0; i < raw.sessions.length; i++) {
    const p = sessionProblem(raw.sessions[i], hallenIds, uebungIds);
    if (p) return { ok: false, error: `Einheit ${i + 1} in der Sicherung ist fehlerhaft (${p}).` };
  }
  // Ältere Sicherungen ohne Variante: Feld ergänzen
  const uebungen = (raw.uebungen as Uebung[]).map((u) => (typeof u.variante === 'string' ? u : { ...u, variante: '' }));
  return { ok: true, backup: { ...(raw as unknown as Backup), uebungen } };
}

export interface BackupPreview {
  sessions: number;
  hallen: number;
  uebungen: number;
  von: string | null;
  bis: string | null;
  exportiert: string;
}

export function previewBackup(b: Backup): BackupPreview {
  const dates = b.sessions.map((s) => s.datum).sort();
  return {
    sessions: b.sessions.length,
    hallen: b.hallen.length,
    uebungen: b.uebungen.length,
    von: dates[0] ?? null,
    bis: dates[dates.length - 1] ?? null,
    exportiert: b.exportiert,
  };
}

export interface MergeStats {
  neu: number;
  aktualisiert: number;
  unveraendert: number;
}

export interface MergeResult {
  data: AppData;
  sessions: MergeStats;
  hallen: MergeStats;
  uebungen: MergeStats;
}

const newer = (a: { geaendert: string }, b: { geaendert: string }) => (a.geaendert ?? '') > (b.geaendert ?? '');

/**
 * Führt eine Sicherung mit dem Bestand zusammen.
 * - Dubletten werden per `id` erkannt; bei Konflikt gewinnt der neuere Stand (`geaendert`).
 * - Hallen mit gleichem Namen bzw. Übungen mit gleichem Name+Variante, aber anderer id,
 *   werden auf den vorhandenen Eintrag abgebildet (keine doppelten Bibliothekseinträge).
 */
export function mergeData(current: AppData, incoming: AppData): MergeResult {
  const stats = () => ({ neu: 0, aktualisiert: 0, unveraendert: 0 });
  const st = { sessions: stats(), hallen: stats(), uebungen: stats() };

  // Hallen
  const hallen = new Map(current.hallen.map((h) => [h.id, h]));
  const hallenByName = new Map(current.hallen.map((h) => [normText(h.name), h.id]));
  const hallenMap = new Map<string, string>();
  for (const h of incoming.hallen) {
    const existing = hallen.get(h.id);
    if (existing) {
      hallenMap.set(h.id, h.id);
      if (newer(h, existing)) {
        hallen.set(h.id, h);
        st.hallen.aktualisiert++;
      } else st.hallen.unveraendert++;
      continue;
    }
    const sameName = hallenByName.get(normText(h.name));
    if (sameName) {
      hallenMap.set(h.id, sameName);
      st.hallen.unveraendert++;
      continue;
    }
    hallen.set(h.id, h);
    hallenByName.set(normText(h.name), h.id);
    hallenMap.set(h.id, h.id);
    st.hallen.neu++;
  }

  // Übungen
  const uebungen = new Map(current.uebungen.map((u) => [u.id, u]));
  const uebungByKey = new Map(current.uebungen.map((u) => [uebungKey(u.name, u.variante), u.id]));
  const uebungMap = new Map<string, string>();
  for (const u of incoming.uebungen) {
    const existing = uebungen.get(u.id);
    if (existing) {
      uebungMap.set(u.id, u.id);
      if (newer(u, existing)) {
        uebungen.set(u.id, u);
        st.uebungen.aktualisiert++;
      } else st.uebungen.unveraendert++;
      continue;
    }
    const sameKey = uebungByKey.get(uebungKey(u.name, u.variante));
    if (sameKey) {
      uebungMap.set(u.id, sameKey);
      st.uebungen.unveraendert++;
      continue;
    }
    uebungen.set(u.id, u);
    uebungByKey.set(uebungKey(u.name, u.variante), u.id);
    uebungMap.set(u.id, u.id);
    st.uebungen.neu++;
  }

  // Einheiten (mit umgeschriebenen Verweisen)
  const remap = (s: Session): Session => {
    if (s.sport === 'bouldern') {
      const hid = hallenMap.get(s.halleId) ?? s.halleId;
      return hid === s.halleId ? s : { ...s, halleId: hid };
    }
    if (s.sport === 'kraft') {
      const changed = s.uebungen.some((e) => (uebungMap.get(e.uebungId) ?? e.uebungId) !== e.uebungId);
      if (!changed) return s;
      return { ...s, uebungen: s.uebungen.map((e) => ({ ...e, uebungId: uebungMap.get(e.uebungId) ?? e.uebungId })) };
    }
    return s;
  };
  const sessions = new Map(current.sessions.map((s) => [s.id, s]));
  for (const raw of incoming.sessions) {
    const s = remap(raw);
    const existing = sessions.get(s.id);
    if (!existing) {
      sessions.set(s.id, s);
      st.sessions.neu++;
    } else if (newer(s, existing)) {
      sessions.set(s.id, s);
      st.sessions.aktualisiert++;
    } else st.sessions.unveraendert++;
  }

  return {
    data: { sessions: [...sessions.values()], hallen: [...hallen.values()], uebungen: [...uebungen.values()] },
    ...st,
  };
}
