/**
 * Kleine IndexedDB-Schicht. Datenbank-Versionierung erlaubt spätere Erweiterungen
 * (z. B. Wochenziele als eigener Store oder Eintrag in `meta`).
 */
import type { AppData, Halle, Session, Uebung } from './types';

export const DB_NAME = 'training';
export const DB_VERSION = 1;

type StoreName = 'sessions' | 'hallen' | 'uebungen' | 'meta';

export interface MetaValues {
  /** ISO-Zeitstempel des letzten erfolgreichen Exports */
  letztesBackup?: string;
  /** Darstellung */
  theme?: 'auto' | 'hell' | 'dunkel';
}

let dbPromise: Promise<IDBDatabase> | null = null;

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transaktion abgebrochen'));
  });
}

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      // Version 1
      if (!db.objectStoreNames.contains('sessions')) {
        const s = db.createObjectStore('sessions', { keyPath: 'id' });
        s.createIndex('datum', 'datum');
      }
      if (!db.objectStoreNames.contains('hallen')) db.createObjectStore('hallen', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('uebungen')) db.createObjectStore('uebungen', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

/** Nur für Tests: Verbindung schließen und vergessen. */
export async function closeDb(): Promise<void> {
  if (dbPromise) (await dbPromise).close();
  dbPromise = null;
}

async function getAll<T>(store: StoreName): Promise<T[]> {
  const db = await openDb();
  return reqToPromise(db.transaction(store).objectStore(store).getAll() as IDBRequest<T[]>);
}

export async function loadAll(): Promise<AppData> {
  const [sessions, hallen, uebungen] = await Promise.all([
    getAll<Session>('sessions'),
    getAll<Halle>('hallen'),
    getAll<Uebung>('uebungen'),
  ]);
  return { sessions, hallen, uebungen };
}

export interface Changes {
  put?: { sessions?: Session[]; hallen?: Halle[]; uebungen?: Uebung[] };
  del?: { sessions?: string[]; hallen?: string[]; uebungen?: string[] };
}

/** Schreibt mehrere Änderungen atomar in einer Transaktion. */
export async function applyChanges(c: Changes): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(['sessions', 'hallen', 'uebungen'], 'readwrite');
  for (const store of ['sessions', 'hallen', 'uebungen'] as const) {
    const os = tx.objectStore(store);
    for (const item of c.put?.[store] ?? []) os.put(item);
    for (const key of c.del?.[store] ?? []) os.delete(key);
  }
  await txDone(tx);
}

/** Ersetzt den kompletten Datenbestand atomar. */
export async function replaceAll(data: AppData): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(['sessions', 'hallen', 'uebungen'], 'readwrite');
  for (const store of ['sessions', 'hallen', 'uebungen'] as const) {
    const os = tx.objectStore(store);
    os.clear();
    for (const item of data[store]) os.put(item);
  }
  await txDone(tx);
}

export async function getMeta<K extends keyof MetaValues>(key: K): Promise<MetaValues[K] | undefined> {
  const db = await openDb();
  const row = await reqToPromise(db.transaction('meta').objectStore('meta').get(key));
  return (row as { value?: MetaValues[K] } | undefined)?.value;
}

export async function setMeta<K extends keyof MetaValues>(key: K, value: MetaValues[K]): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('meta', 'readwrite');
  tx.objectStore('meta').put({ key, value });
  await txDone(tx);
}

/** Bittet den Browser, die Daten nicht automatisch zu löschen (wo unterstützt). */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
