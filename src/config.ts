/**
 * Zentrale Konfiguration der App.
 * Name, Kurzname und Farben werden hier gepflegt. Die Werte werden auch von
 * vite.config.ts (Web-App-Manifest) und scripts/icons.mjs (Icons) gelesen.
 */
export const APP_CONFIG = {
  /** Vollständiger Name (Startbildschirm, Titel) */
  name: 'Training',
  /** Kurzname unter dem Icon auf dem Home-Bildschirm */
  shortName: 'Training',
  /** Buchstabe(n) des Platzhalter-Monogramms im Icon */
  monogram: 'T',
  description: 'Persönlicher Trainings-Tracker für Bouldern, Kraftsport und Laufen.',
  /** Hintergrund- und Statusleistenfarben (hell / dunkel) */
  colors: {
    backgroundLight: '#F5F5F3',
    backgroundDark: '#1C1C1E',
    iconBackground: '#3A3A3C',
    iconForeground: '#C9AE78',
  },
  /** Dateiformat-Kennung der JSON-Sicherung */
  backupFormat: 'training-backup',
  backupVersion: 1,
} as const;

/** Version der App (aus package.json via Vite) */
export const APP_VERSION: string = import.meta.env.VITE_APP_VERSION ?? 'dev';
