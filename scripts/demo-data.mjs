/**
 * Erzeugt eine Sicherung mit ERFUNDENEN Beispieldaten (zum Ausprobieren der App).
 * Aufruf: node scripts/demo-data.mjs <ziel.json>
 * Die Datei kann in der App unter Einstellungen → Backup importieren eingespielt werden.
 * Hinweis: *.json-Sicherungen sind per .gitignore vom Repo ausgeschlossen.
 */
import { writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const out = process.argv[2];
if (!out) {
  console.error('Bitte Zieldatei angeben: node scripts/demo-data.mjs demo.json');
  process.exit(1);
}

let seed = 42;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const ts = (day, h) => `${day}T${String(h).padStart(2, '0')}:00:00.000Z`;

const hallen = [
  { id: randomUUID(), name: 'Blockwerk', maxGrad: 8 },
  { id: randomUUID(), name: 'Kletterhalle Süd', maxGrad: 7 },
].map((h) => ({ ...h, erstellt: '2025-01-01T00:00:00.000Z', geaendert: '2025-01-01T00:00:00.000Z' }));

const ueb = (name, variante, gruppe) => ({ id: randomUUID(), name, variante, muskelgruppen: [gruppe], erstellt: '2025-01-01T00:00:00.000Z', geaendert: '2025-01-01T00:00:00.000Z' });
const U = {
  kb: ueb('Kniebeuge', '', 'Beine'),
  bd: ueb('Bankdrücken', '', 'Brust'),
  ht: ueb('Hip thrusts', '', 'Gesäß'),
  htm: ueb('Hip thrusts', 'Maschine', 'Gesäß'),
  lz: ueb('Latzug', '', 'Rücken'),
  kz: ueb('Klimmzüge', 'mit Band', 'Rücken'),
  ru: ueb('Einarmiges Rudern', 'je Seite', 'Rücken'),
  pl: ueb('Plank', '', 'Core'),
};
const uebungen = Object.values(U);

const sessions = [];
const end = new Date(2026, 10, 12, 12);
const start = new Date(2025, 8, 1, 12);
let level = 0;
for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
  const day = iso(d);
  const wd = (d.getDay() + 6) % 7;
  level = (d - start) / (end - start);
  if (rnd() < 0.08) continue; // gelegentliche Pause
  if ((wd === 1 || wd === 4) && rnd() < 0.85) {
    const h = rnd() < 0.7 ? hallen[0] : hallen[1];
    const grad = Math.min(h.maxGrad, Math.max(3, Math.round(3 + level * 3 + (rnd() - 0.5) * 1.6)));
    sessions.push({ id: randomUUID(), sport: 'bouldern', datum: day, dauerSekunden: (75 + Math.round(rnd() * 45)) * 60, halleId: h.id, sessionMaxGrad: grad, hallenMaxGrad: h.maxGrad, erstellt: ts(day, 18), geaendert: ts(day, 18) });
  }
  if ((wd === 0 || wd === 3) && rnd() < 0.8) {
    const w = (base, inc) => Math.round((base + level * inc + (rnd() - 0.5) * 4) * 2) / 2;
    const sets = (n, kg, reps, extra = {}) => Array.from({ length: n }, (_, i) => ({ gewichtKg: kg, wiederholungen: reps - (i > 1 ? 1 : 0), ...extra }));
    const legDay = rnd() < 0.5;
    const uebungenS = legDay
      ? [
          { uebungId: U.kb.id, saetze: sets(3, w(40, 25), 10) },
          { uebungId: rnd() < 0.5 ? U.ht.id : U.htm.id, saetze: sets(3, w(60, 40), 10) },
          { uebungId: U.pl.id, saetze: [{ gewichtKg: null, wiederholungen: null, dauerSekunden: 45 + Math.round(level * 60) }] },
        ]
      : [
          { uebungId: U.bd.id, saetze: sets(3, w(30, 12.5), 10) },
          { uebungId: U.lz.id, saetze: sets(3, w(35, 15), 11) },
          { uebungId: U.kz.id, saetze: sets(3, null, 5 + Math.round(level * 4)) },
          { uebungId: U.ru.id, saetze: sets(3, w(12, 6), 12, { notiz: 'Gewicht je Arm' }) },
        ];
    sessions.push({ id: randomUUID(), sport: 'kraft', datum: day, dauerSekunden: (50 + Math.round(rnd() * 25)) * 60, fokusMuskulatur: legDay ? ['Beine', 'Gesäß', 'Core'] : ['Brust', 'Rücken'], fokusAbgeleitet: true, uebungen: uebungenS, erstellt: ts(day, 17), geaendert: ts(day, 17) });
  }
  if ((wd === 2 || wd === 6) && rnd() < 0.75) {
    const km = Math.round((pick([5, 5, 6.5, 8, 10]) + (wd === 6 ? 2 * level * 3 : 0) + rnd() * 0.6) * 10) / 10;
    const pace = 375 - level * 40 + (rnd() - 0.5) * 30;
    sessions.push({ id: randomUUID(), sport: 'laufen', datum: day, distanzKm: km, dauerSekunden: Math.round(km * pace), erstellt: ts(day, 7), geaendert: ts(day, 7) });
  }
}
sessions.at(-1).notizen = 'Erfundener Beispieleintrag.';

const backup = { format: 'training-backup', version: 1, app: 'Training', exportiert: new Date().toISOString(), sessions, hallen, uebungen };
writeFileSync(out, JSON.stringify(backup, null, 2));
console.log(`${sessions.length} erfundene Einheiten → ${out}`);
