/** Datenmodell der App. Datumswerte sind lokale Kalendertage im Format JJJJ-MM-TT. */

export type Sport = 'bouldern' | 'kraft' | 'laufen';

export const SPORTS: readonly Sport[] = ['bouldern', 'kraft', 'laufen'] as const;

export const SPORT_LABEL: Record<Sport, string> = {
  bouldern: 'Bouldern',
  kraft: 'Kraftsport',
  laufen: 'Laufen',
};

export const MUSKELGRUPPEN = [
  'Brust',
  'Rücken',
  'Schultern',
  'Arme',
  'Beine',
  'Core',
  'Ganzkörper',
] as const;
export type Muskelgruppe = (typeof MUSKELGRUPPEN)[number];

/** Skala der Boulder-Grade (ganze Zahlen). */
export const GRAD_MIN = 1;
export const GRAD_MAX = 10;

interface SessionBase {
  id: string;
  sport: Sport;
  /** Kalendertag JJJJ-MM-TT */
  datum: string;
  /** Dauer der Einheit in Sekunden. Bei Laufen Pflicht, sonst optional. */
  dauerSekunden: number | null;
  notizen?: string;
  /** ISO-Zeitstempel */
  erstellt: string;
  geaendert: string;
}

export interface BoulderSession extends SessionBase {
  sport: 'bouldern';
  halleId: string;
  /** Session-Maximum (1–10) */
  sessionMaxGrad: number;
  /** Maximalgrad der Halle zum Zeitpunkt der Einheit (Schnappschuss) */
  hallenMaxGrad: number;
}

export interface Satz {
  /** null = Körpergewicht */
  gewichtKg: number | null;
  /** Dezimalzahlen erlaubt (Teilwiederholungen) */
  wiederholungen: number | null;
  /** für zeitbasierte Sätze (z. B. Plank) */
  dauerSekunden?: number | null;
  notiz?: string;
}

export interface UebungEintrag {
  uebungId: string;
  saetze: Satz[];
  /** Notiz an der Übung (z. B. bei Übungen ohne Sätze) */
  notiz?: string;
}

export interface KraftSession extends SessionBase {
  sport: 'kraft';
  fokusMuskulatur: Muskelgruppe[];
  uebungen: UebungEintrag[];
}

export interface LaufSession extends SessionBase {
  sport: 'laufen';
  distanzKm: number;
  dauerSekunden: number;
}

export type Session = BoulderSession | KraftSession | LaufSession;

export interface Halle {
  id: string;
  name: string;
  /** höchster Grad, den die Halle anbietet (1–10) */
  maxGrad: number;
  erstellt: string;
  geaendert: string;
}

/** Eine Übung ist die Kombination aus Name und Gerät/Variante. */
export interface Uebung {
  id: string;
  name: string;
  /** Gerät/Variante, leerer String = keine Angabe */
  variante: string;
  erstellt: string;
  geaendert: string;
}

export interface AppData {
  sessions: Session[];
  hallen: Halle[];
  uebungen: Uebung[];
}

export interface Backup extends AppData {
  format: string;
  version: number;
  app: string;
  exportiert: string;
}
