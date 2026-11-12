/** Zentraler App-Zustand (Signals) und alle Schreibaktionen. */
import { computed, signal } from '@preact/signals';
import * as db from './lib/db';
import { mergeData, type MergeResult } from './lib/backup';
import { applyCsvImport, type CsvImportResult } from './lib/csv';
import { nowISO, uuid } from './lib/ids';
import { sortNewestFirst } from './lib/stats';
import { cleanText, findUebung, uebungKey } from './lib/uebungen';
import type { AppData, Halle, Session, Uebung } from './lib/types';

export type Theme = 'auto' | 'hell' | 'dunkel';
export type Tab = 'dashboard' | 'neu' | 'verlauf' | 'einstellungen';

export const data = signal<AppData>({ sessions: [], hallen: [], uebungen: [] });
export const ready = signal(false);
export const loadError = signal<string | null>(null);
export const lastBackup = signal<string | null>(null);
export const theme = signal<Theme>('auto');
export const tab = signal<Tab>('dashboard');
/** zuletzt gespeicherte Einheit (zum Hervorheben im Verlauf) */
export const highlightId = signal<string | null>(null);

export const sessionsNewest = computed(() => sortNewestFirst(data.value.sessions));
export const hallenById = computed(() => new Map(data.value.hallen.map((h) => [h.id, h])));
export const uebungenById = computed(() => new Map(data.value.uebungen.map((u) => [u.id, u])));

export async function init(): Promise<void> {
  try {
    const [loaded, lb, th] = await Promise.all([db.loadAll(), db.getMeta('letztesBackup'), db.getMeta('theme')]);
    data.value = loaded;
    lastBackup.value = lb ?? null;
    theme.value = th ?? 'auto';
    void db.requestPersistence();
  } catch (e) {
    console.error(e);
    loadError.value = 'Die Daten konnten nicht geladen werden. Ist privates Surfen aktiv?';
  } finally {
    ready.value = true;
  }
}

// ---------------------------------------------------------------- Einheiten

export interface KraftUebungInput {
  name: string;
  variante: string;
}

/**
 * Speichert eine Einheit. Für Kraft werden Übungen per Name+Variante aufgelöst;
 * neue Übungen werden in derselben Transaktion angelegt.
 */
export async function saveSession(session: Session, kraftNamen?: KraftUebungInput[]): Promise<Session> {
  const now = nowISO();
  const newUebungen: Uebung[] = [];
  let s: Session = { ...session, geaendert: now, erstellt: session.erstellt || now };

  if (s.sport === 'kraft' && kraftNamen) {
    const pool = [...data.value.uebungen];
    s = {
      ...s,
      uebungen: s.uebungen.map((e, i) => {
        const name = cleanText(kraftNamen[i].name);
        const variante = cleanText(kraftNamen[i].variante);
        let u = findUebung(pool, name, variante);
        if (!u) {
          u = { id: uuid(), name, variante, erstellt: now, geaendert: now };
          pool.push(u);
          newUebungen.push(u);
        }
        return { ...e, uebungId: u.id };
      }),
    };
  }

  await db.applyChanges({ put: { sessions: [s], uebungen: newUebungen } });
  const others = data.value.sessions.filter((x) => x.id !== s.id);
  data.value = { ...data.value, sessions: [...others, s], uebungen: [...data.value.uebungen, ...newUebungen] };
  return s;
}

export async function deleteSession(id: string): Promise<Session | undefined> {
  const s = data.value.sessions.find((x) => x.id === id);
  if (!s) return;
  await db.applyChanges({ del: { sessions: [id] } });
  data.value = { ...data.value, sessions: data.value.sessions.filter((x) => x.id !== id) };
  return s;
}

/** Stellt eine gelöschte Einheit wieder her (Rückgängig). */
export async function restoreSession(s: Session): Promise<void> {
  await db.applyChanges({ put: { sessions: [s] } });
  data.value = { ...data.value, sessions: [...data.value.sessions.filter((x) => x.id !== s.id), s] };
}

// ---------------------------------------------------------------- Hallen

export async function saveHalle(input: { id?: string; name: string; maxGrad: number }): Promise<Halle> {
  const now = nowISO();
  const existing = input.id ? hallenById.value.get(input.id) : undefined;
  const h: Halle = existing
    ? { ...existing, name: cleanText(input.name), maxGrad: input.maxGrad, geaendert: now }
    : { id: uuid(), name: cleanText(input.name), maxGrad: input.maxGrad, erstellt: now, geaendert: now };
  await db.applyChanges({ put: { hallen: [h] } });
  data.value = { ...data.value, hallen: [...data.value.hallen.filter((x) => x.id !== h.id), h] };
  return h;
}

export const sessionsForHalle = (id: string) => data.value.sessions.filter((s) => s.sport === 'bouldern' && s.halleId === id);

/** Löscht eine Halle. Verknüpfte Einheiten werden vorher in `moveTo` verschoben. */
export async function deleteHalle(id: string, moveTo?: string): Promise<void> {
  const linked = sessionsForHalle(id);
  if (linked.length && !moveTo) throw new Error('Halle hat verknüpfte Einheiten.');
  const now = nowISO();
  const moved = linked.map((s) => ({ ...s, halleId: moveTo!, geaendert: now }) as Session);
  await db.applyChanges({ put: { sessions: moved }, del: { hallen: [id] } });
  const movedIds = new Set(moved.map((s) => s.id));
  data.value = {
    ...data.value,
    hallen: data.value.hallen.filter((h) => h.id !== id),
    sessions: [...data.value.sessions.filter((s) => !movedIds.has(s.id)), ...moved],
  };
}

// ---------------------------------------------------------------- Übungen

export const sessionsForUebung = (id: string) =>
  data.value.sessions.filter((s) => s.sport === 'kraft' && s.uebungen.some((e) => e.uebungId === id));

/** Benennt eine Übung um. Gibt die kollidierende Übung zurück, falls Name+Variante schon existiert. */
export async function renameUebung(id: string, name: string, variante: string): Promise<{ conflict?: Uebung }> {
  const u = uebungenById.value.get(id);
  if (!u) return {};
  const key = uebungKey(name, variante);
  const conflict = data.value.uebungen.find((x) => x.id !== id && uebungKey(x.name, x.variante) === key);
  if (conflict) return { conflict };
  const updated: Uebung = { ...u, name: cleanText(name), variante: cleanText(variante), geaendert: nowISO() };
  await db.applyChanges({ put: { uebungen: [updated] } });
  data.value = { ...data.value, uebungen: data.value.uebungen.map((x) => (x.id === id ? updated : x)) };
  return {};
}

/** Führt `sourceId` in `targetId` zusammen: alle Einträge zeigen danach auf die Zielübung. */
export async function mergeUebungen(sourceId: string, targetId: string): Promise<number> {
  if (sourceId === targetId) return 0;
  const now = nowISO();
  const changed: Session[] = [];
  for (const s of data.value.sessions) {
    if (s.sport !== 'kraft' || !s.uebungen.some((e) => e.uebungId === sourceId)) continue;
    changed.push({ ...s, geaendert: now, uebungen: s.uebungen.map((e) => (e.uebungId === sourceId ? { ...e, uebungId: targetId } : e)) });
  }
  await db.applyChanges({ put: { sessions: changed }, del: { uebungen: [sourceId] } });
  const ids = new Set(changed.map((s) => s.id));
  data.value = {
    ...data.value,
    uebungen: data.value.uebungen.filter((u) => u.id !== sourceId),
    sessions: [...data.value.sessions.filter((s) => !ids.has(s.id)), ...changed],
  };
  return changed.length;
}

export async function deleteUebung(id: string): Promise<void> {
  if (sessionsForUebung(id).length) throw new Error('Übung wird noch verwendet.');
  await db.applyChanges({ del: { uebungen: [id] } });
  data.value = { ...data.value, uebungen: data.value.uebungen.filter((u) => u.id !== id) };
}

// ---------------------------------------------------------------- Import / Backup

export async function importReplace(incoming: AppData): Promise<void> {
  const clean: AppData = { sessions: incoming.sessions, hallen: incoming.hallen, uebungen: incoming.uebungen };
  await db.replaceAll(clean);
  data.value = clean;
}

export async function importMerge(incoming: AppData): Promise<MergeResult> {
  const r = mergeData(data.value, incoming);
  await db.replaceAll(r.data);
  data.value = r.data;
  return r;
}

export async function importCsvResult(res: CsvImportResult, skipDubletten: boolean): Promise<number> {
  const before = data.value;
  const { data: next, added } = applyCsvImport(before, res, skipDubletten);
  const newU = next.uebungen.slice(before.uebungen.length);
  const newH = next.hallen.slice(before.hallen.length);
  await db.applyChanges({ put: { sessions: added, uebungen: newU, hallen: newH } });
  data.value = next;
  return added.length;
}

export async function markBackup(): Promise<void> {
  const t = nowISO();
  await db.setMeta('letztesBackup', t);
  lastBackup.value = t;
}

// ---------------------------------------------------------------- Darstellung

export async function setTheme(t: Theme): Promise<void> {
  theme.value = t;
  applyTheme(t);
  await db.setMeta('theme', t);
}

export function applyTheme(t: Theme): void {
  const root = document.documentElement;
  if (t === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', t === 'dunkel' ? 'dark' : 'light');
  const dark = t === 'dunkel' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  const color = dark ? '#1C1C1E' : '#F5F5F3';
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    if (t === 'auto') m.setAttribute('content', m.getAttribute('media')?.includes('dark') ? '#1C1C1E' : '#F5F5F3');
    else m.setAttribute('content', color);
  });
}
