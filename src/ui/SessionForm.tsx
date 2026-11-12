/** Formular für eine Einheit (Neu und Bearbeiten) – Bouldern, Kraftsport, Laufen. */
import { useMemo } from 'preact/hooks';
import { fmtDate } from '../lib/dates';
import { fmtNum, fmtClock, parseClock, parseNum } from '../lib/format';
import { uuid } from '../lib/ids';
import { fmtPace, paceSecPerKm } from '../lib/pace';
import { isKraft, sortNewestFirst, uebungenNachHaeufigkeit } from '../lib/stats';
import { findUebung, normText } from '../lib/uebungen';
import type { BoulderSession, KraftSession, LaufSession, Muskelgruppe, Satz, Session, Sport } from '../lib/types';
import { GRAD_MAX, GRAD_MIN, MUSKELGRUPPEN } from '../lib/types';
import { data, hallenById, saveHalle, saveSession, uebungenById } from '../store';
import { DateField, Field, SuggestInput, confirmDialog } from './components';
import { IconCopy, IconMore, IconPlus, IconTrash } from './icons';

// ================================================================ Entwurf

export interface SatzDraft {
  key: string;
  gewicht: string;
  wdh: string;
  dauer: string;
  notiz: string;
  modus: 'wdh' | 'dauer';
  offen: boolean;
}
export interface UebungDraft {
  key: string;
  name: string;
  variante: string;
  saetze: SatzDraft[];
  notiz: string;
  notizOffen: boolean;
  gleichOffen: boolean;
  gleichKg: string;
}
export interface Draft {
  sport: Sport;
  id?: string;
  erstellt?: string;
  datum: string;
  dauerMin: string;
  notizen: string;
  halleId: string | null;
  grad: number | null;
  neueHalle: { name: string; maxGrad: number } | null;
  km: string;
  h: string;
  m: string;
  s: string;
  fokus: Muskelgruppe[];
  uebungen: UebungDraft[];
}

const k = () => uuid().slice(0, 8);
const numStr = (n: number | null | undefined) => (n == null ? '' : fmtNum(n, 3).replace(/\./g, ''));

export const emptySatz = (gewicht = ''): SatzDraft => ({ key: k(), gewicht, wdh: '', dauer: '', notiz: '', modus: 'wdh', offen: false });
export const emptyUebung = (): UebungDraft => ({
  key: k(),
  name: '',
  variante: '',
  saetze: [emptySatz()],
  notiz: '',
  notizOffen: false,
  gleichOffen: false,
  gleichKg: '',
});

/** Zuletzt verwendete Halle als Vorauswahl. */
function lastHalleId(): string | null {
  const last = sortNewestFirst(data.value.sessions).find((s) => s.sport === 'bouldern') as BoulderSession | undefined;
  if (last && hallenById.value.has(last.halleId)) return last.halleId;
  return data.value.hallen[0]?.id ?? null;
}

export function newDraft(sport: Sport, datum: string): Draft {
  return {
    sport,
    datum,
    dauerMin: '',
    notizen: '',
    halleId: sport === 'bouldern' ? lastHalleId() : null,
    grad: null,
    neueHalle: null,
    km: '',
    h: '',
    m: '',
    s: '',
    fokus: [],
    uebungen: sport === 'kraft' ? [emptyUebung()] : [],
  };
}

export function draftFromSession(s: Session): Draft {
  const d = newDraft(s.sport, s.datum);
  d.id = s.id;
  d.erstellt = s.erstellt;
  d.notizen = s.notizen ?? '';
  d.dauerMin = s.dauerSekunden != null && s.sport !== 'laufen' ? numStr(Math.round((s.dauerSekunden / 60) * 10) / 10) : '';
  if (s.sport === 'bouldern') {
    d.halleId = s.halleId;
    d.grad = s.sessionMaxGrad;
  } else if (s.sport === 'laufen') {
    d.km = numStr(s.distanzKm);
    const t = Math.round(s.dauerSekunden);
    d.h = t >= 3600 ? String(Math.floor(t / 3600)) : '';
    d.m = String(Math.floor((t % 3600) / 60));
    d.s = String(t % 60).padStart(2, '0');
  } else {
    d.fokus = [...s.fokusMuskulatur];
    d.uebungen = s.uebungen.map((e) => {
      const u = uebungenById.value.get(e.uebungId);
      return {
        ...emptyUebung(),
        name: u?.name ?? '',
        variante: u?.variante ?? '',
        notiz: e.notiz ?? '',
        notizOffen: !!e.notiz,
        saetze: e.saetze.map((x) => ({
          key: k(),
          gewicht: numStr(x.gewichtKg),
          wdh: numStr(x.wiederholungen),
          dauer: x.dauerSekunden ? fmtClock(x.dauerSekunden) : '',
          notiz: x.notiz ?? '',
          modus: x.dauerSekunden && x.wiederholungen == null ? ('dauer' as const) : ('wdh' as const),
          offen: false,
        })),
      };
    });
  }
  return d;
}

// ================================================================ Prüfen & Speichern

type Errors = Record<string, string>;

function parseOpt(v: string, field: string, label: string, errors: Errors, min = 0): number | null {
  const n = parseNum(v);
  if (n == null) return null;
  if (isNaN(n) || n < min) {
    errors[field] = `${label}: bitte eine gültige Zahl eingeben.`;
    return null;
  }
  return n;
}

export function laufSekunden(d: Pick<Draft, 'h' | 'm' | 's'>): number | null {
  const h = parseNum(d.h) ?? 0;
  const m = parseNum(d.m) ?? 0;
  const s = parseNum(d.s) ?? 0;
  if ([h, m, s].some((x) => isNaN(x) || x < 0)) return NaN;
  const total = Math.round(h * 3600 + m * 60 + s);
  return total > 0 ? total : null;
}

export function validate(d: Draft): { errors: Errors; session?: Session; namen?: { name: string; variante: string }[] } {
  const errors: Errors = {};
  const dauerMin = d.sport === 'laufen' ? null : parseOpt(d.dauerMin, 'dauer', 'Dauer', errors);
  const base = {
    id: d.id ?? uuid(),
    datum: d.datum,
    dauerSekunden: dauerMin != null ? Math.round(dauerMin * 60) : null,
    erstellt: d.erstellt ?? '',
    geaendert: '',
    ...(d.notizen.trim() ? { notizen: d.notizen.trim() } : {}),
  };

  if (d.sport === 'bouldern') {
    const halle = d.halleId ? hallenById.value.get(d.halleId) : null;
    const hallenMax = d.neueHalle ? d.neueHalle.maxGrad : halle?.maxGrad;
    if (d.neueHalle && !d.neueHalle.name.trim()) errors.halle = 'Bitte einen Namen für die Halle eingeben.';
    if (!d.neueHalle && !halle) errors.halle = 'Bitte eine Halle wählen.';
    if (d.grad == null) errors.grad = 'Bitte das Session-Maximum wählen.';
    else if (hallenMax != null && d.grad > hallenMax) errors.grad = `Höchstens ${hallenMax} in dieser Halle.`;
    if (Object.keys(errors).length) return { errors };
    const s: BoulderSession = { ...base, sport: 'bouldern', halleId: d.halleId ?? '', sessionMaxGrad: d.grad!, hallenMaxGrad: hallenMax! };
    return { errors, session: s };
  }

  if (d.sport === 'laufen') {
    const km = parseNum(d.km);
    if (km == null) errors.km = 'Bitte die Distanz eingeben.';
    else if (isNaN(km) || km < 0) errors.km = 'Bitte eine gültige Distanz eingeben.';
    const sek = laufSekunden(d);
    if (sek == null) errors.zeit = 'Bitte die Dauer eingeben.';
    else if (isNaN(sek)) errors.zeit = 'Bitte eine gültige Dauer eingeben.';
    if (Object.keys(errors).length) return { errors };
    const s: LaufSession = { ...base, sport: 'laufen', distanzKm: km!, dauerSekunden: sek! };
    return { errors, session: s };
  }

  // Kraft
  const namen: { name: string; variante: string }[] = [];
  const uebungen: KraftSession['uebungen'] = [];
  d.uebungen.forEach((u, ui) => {
    const leer = !u.name.trim() && u.saetze.every((x) => !x.gewicht && !x.wdh && !x.dauer && !x.notiz) && !u.notiz.trim();
    if (leer) return;
    if (!u.name.trim()) errors[`u${ui}`] = 'Bitte einen Namen für die Übung eingeben.';
    const saetze: Satz[] = [];
    u.saetze.forEach((x, si) => {
      if (!x.gewicht.trim() && !x.wdh.trim() && !x.dauer.trim() && !x.notiz.trim()) return;
      const f = `u${ui}s${si}`;
      const gewicht = parseOpt(x.gewicht, f, 'Gewicht', errors);
      const wdh = x.modus === 'wdh' ? parseOpt(x.wdh, f, 'Wiederholungen', errors) : null;
      let dauer: number | null = null;
      if (x.modus === 'dauer' && x.dauer.trim()) {
        const c = parseClock(x.dauer);
        if (c == null || isNaN(c)) errors[f] = 'Dauer als m:ss oder Minuten eingeben.';
        else dauer = c;
      }
      const satz: Satz = { gewichtKg: gewicht, wiederholungen: wdh };
      if (dauer != null) satz.dauerSekunden = dauer;
      if (x.notiz.trim()) satz.notiz = x.notiz.trim();
      saetze.push(satz);
    });
    namen.push({ name: u.name, variante: u.variante });
    uebungen.push({ uebungId: '', saetze, ...(u.notiz.trim() ? { notiz: u.notiz.trim() } : {}) });
  });
  if (!uebungen.length) errors.uebungen = 'Bitte mindestens eine Übung eintragen.';
  if (Object.keys(errors).length) return { errors };
  const s: KraftSession = { ...base, sport: 'kraft', fokusMuskulatur: d.fokus, uebungen };
  return { errors, session: s, namen };
}

export async function submitDraft(d: Draft): Promise<{ errors: Errors; saved?: Session }> {
  const v = validate(d);
  if (!v.session) return { errors: v.errors };
  let s = v.session;
  if (s.sport === 'bouldern' && d.neueHalle) {
    const h = await saveHalle({ name: d.neueHalle.name, maxGrad: d.neueHalle.maxGrad });
    s = { ...s, halleId: h.id };
  }
  const saved = await saveSession(s, v.namen);
  return { errors: {}, saved };
}

// ================================================================ Formular

export function SessionForm({ draft, onChange, errors }: { draft: Draft; onChange: (d: Draft) => void; errors: Errors }) {
  const set = (patch: Partial<Draft>) => onChange({ ...draft, ...patch });
  return (
    <div>
      <Field label="Datum">
        <DateField value={draft.datum} onChange={(datum) => set({ datum })} />
      </Field>
      {draft.sport === 'bouldern' && <BoulderFields draft={draft} set={set} errors={errors} />}
      {draft.sport === 'laufen' && <LaufFields draft={draft} set={set} errors={errors} />}
      {draft.sport === 'kraft' && <KraftFields draft={draft} set={set} errors={errors} />}
      {draft.sport !== 'laufen' && (
        <Field label="Dauer (Minuten)" for="f-dauer" error={errors.dauer} hint={draft.sport === 'kraft' ? 'Optional' : undefined}>
          <input
            id="f-dauer"
            class={`input${errors.dauer ? ' invalid' : ''}`}
            inputMode="decimal"
            placeholder="z. B. 90"
            value={draft.dauerMin}
            onInput={(e) => set({ dauerMin: (e.target as HTMLInputElement).value })}
          />
        </Field>
      )}
      <Field label="Notizen" for="f-notiz">
        <textarea
          id="f-notiz"
          class="textarea"
          placeholder="Optional"
          value={draft.notizen}
          onInput={(e) => set({ notizen: (e.target as HTMLTextAreaElement).value })}
        />
      </Field>
    </div>
  );
}

type FP = { draft: Draft; set: (p: Partial<Draft>) => void; errors: Errors };

// ---------------------------------------------------------------- Bouldern

export function GradeGrid(props: { max: number; value: number | null; onChange: (g: number) => void; gold?: boolean; label: string; min?: number }) {
  const grades = [];
  for (let g = props.min ?? GRAD_MIN; g <= props.max; g++) grades.push(g);
  return (
    <div class="grade-grid" role="group" aria-label={props.label}>
      {grades.map((g) => (
        <button
          type="button"
          class={`grade${props.gold ? ' gold' : ''}${!props.gold && props.value != null && g < props.value ? ' below' : ''}`}
          aria-pressed={props.value === g}
          aria-label={`Grad ${g}`}
          onClick={() => props.onChange(g)}
        >
          {g}
        </button>
      ))}
    </div>
  );
}

function BoulderFields({ draft, set, errors }: FP) {
  const hallen = useMemo(() => {
    const used = new Map<string, string>();
    for (const s of data.value.sessions) if (s.sport === 'bouldern' && s.datum > (used.get(s.halleId) ?? '')) used.set(s.halleId, s.datum);
    return [...data.value.hallen].sort((a, b) => (used.get(b.id) ?? '').localeCompare(used.get(a.id) ?? '') || a.name.localeCompare(b.name, 'de'));
  }, [data.value]);
  const halle = draft.halleId ? hallenById.value.get(draft.halleId) : undefined;
  const neu = draft.neueHalle ?? (hallen.length === 0 ? { name: '', maxGrad: 8 } : null);
  const max = neu ? neu.maxGrad : halle?.maxGrad ?? null;

  return (
    <>
      <Field label="Halle" error={errors.halle}>
        {hallen.length > 0 && (
          <div class="chips">
            {hallen.map((h) => (
              <button
                type="button"
                class="chip"
                aria-pressed={!neu && draft.halleId === h.id}
                onClick={() => set({ halleId: h.id, neueHalle: null, grad: draft.grad != null && draft.grad > h.maxGrad ? null : draft.grad })}
              >
                {h.name}
              </button>
            ))}
            <button type="button" class="chip" aria-pressed={!!draft.neueHalle} onClick={() => set({ neueHalle: draft.neueHalle ? null : { name: '', maxGrad: 8 } })}>
              <IconPlus size={16} /> Neue Halle
            </button>
          </div>
        )}
        {neu && (
          <div class="form-card" style={{ marginTop: hallen.length ? '12px' : 0 }}>
            <input
              class={`input${errors.halle ? ' invalid' : ''}`}
              placeholder="Name der Halle"
              aria-label="Name der neuen Halle"
              value={neu.name}
              onInput={(e) => set({ neueHalle: { ...neu, name: (e.target as HTMLInputElement).value } })}
            />
            <div class="label" style={{ marginTop: '14px' }}>
              Höchster Grad der Halle
            </div>
            <GradeGrid
              gold
              max={GRAD_MAX}
              value={neu.maxGrad}
              label="Höchster Grad der Halle"
              onChange={(g) => set({ neueHalle: { ...neu, maxGrad: g }, grad: draft.grad != null && draft.grad > g ? null : draft.grad })}
            />
          </div>
        )}
      </Field>
      <Field label="Session-Maximum" error={errors.grad}>
        {max == null ? (
          <div class="footnote">Bitte zuerst eine Halle wählen.</div>
        ) : (
          <>
            <GradeGrid max={max} value={draft.grad} onChange={(grad) => set({ grad })} label="Session-Maximum" />
            <div class="footnote" style={{ textAlign: 'center', fontSize: '15px' }} aria-live="polite">
              {draft.grad != null ? (
                <>
                  <span style={{ color: 'var(--text)' }}>{draft.grad}</span> von {max}
                </>
              ) : (
                `Skala dieser Halle: 1–${max}`
              )}
            </div>
          </>
        )}
      </Field>
    </>
  );
}

// ---------------------------------------------------------------- Laufen

function LaufFields({ draft, set, errors }: FP) {
  const km = parseNum(draft.km);
  const sek = laufSekunden(draft);
  const pace = paceSecPerKm(km != null && !isNaN(km) ? km : null, sek != null && !isNaN(sek) ? sek : null);
  const inp = (key: 'h' | 'm' | 's', label: string, ph: string) => (
    <label>
      <input
        class={`input num${errors.zeit ? ' invalid' : ''}`}
        inputMode="numeric"
        pattern="[0-9]*"
        placeholder={ph}
        aria-label={label}
        value={draft[key]}
        onInput={(e) => set({ [key]: (e.target as HTMLInputElement).value } as Partial<Draft>)}
      />
      <span class="unit">{label}</span>
    </label>
  );
  return (
    <>
      <Field label="Distanz (km)" for="f-km" error={errors.km}>
        <input
          id="f-km"
          class={`input${errors.km ? ' invalid' : ''}`}
          inputMode="decimal"
          placeholder="z. B. 5,2"
          value={draft.km}
          onInput={(e) => set({ km: (e.target as HTMLInputElement).value })}
        />
      </Field>
      <Field label="Dauer" error={errors.zeit}>
        <div class="clock-input">
          {inp('h', 'Std', '0')}
          <span class="sep">:</span>
          {inp('m', 'Min', '00')}
          <span class="sep">:</span>
          {inp('s', 'Sek', '00')}
        </div>
      </Field>
      <div class="pace-display" aria-live="polite">
        <span class="muted">Pace</span>
        <span>
          <span class="big">{pace != null ? fmtPace(pace, false) : '–:––'}</span>
          <span class="muted"> /km</span>
        </span>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- Kraft

function letzteLeistung(name: string, variante: string, datum: string, ownId?: string): string | null {
  const u = findUebung(data.value.uebungen, name, variante);
  if (!u) return null;
  const s = sortNewestFirst(data.value.sessions.filter(isKraft)).find(
    (x) => x.id !== ownId && x.datum <= datum && x.uebungen.some((e) => e.uebungId === u.id),
  );
  if (!s) return null;
  const saetze = s.uebungen.filter((e) => e.uebungId === u.id).flatMap((e) => e.saetze);
  if (!saetze.length) return `Zuletzt ${fmtDate(s.datum)}: ohne Sätze`;
  const parts = saetze.map((x) => {
    if (x.dauerSekunden && x.wiederholungen == null) return fmtClock(x.dauerSekunden);
    const w = x.gewichtKg != null ? `${fmtNum(x.gewichtKg)} kg` : 'KG';
    return `${x.wiederholungen != null ? fmtNum(x.wiederholungen) : '–'} × ${w}`;
  });
  const grouped: string[] = [];
  for (let i = 0; i < parts.length; ) {
    let n = 1;
    while (parts[i + n] === parts[i]) n++;
    grouped.push(n > 1 ? `${n}× ${parts[i]}` : parts[i]);
    i += n;
  }
  return `Zuletzt ${fmtDate(s.datum)}: ${grouped.join(' · ')}`;
}

function KraftFields({ draft, set, errors }: FP) {
  const freq = useMemo(() => uebungenNachHaeufigkeit(data.value.sessions), [data.value.sessions]);
  const namen = useMemo(() => {
    const order = new Map(freq.map((f, i) => [f.uebungId, i]));
    const byName = new Map<string, { name: string; rank: number }>();
    for (const u of data.value.uebungen) {
      const r = order.get(u.id) ?? 1e9;
      const cur = byName.get(normText(u.name));
      if (!cur || r < cur.rank) byName.set(normText(u.name), { name: u.name, rank: r });
    }
    return [...byName.values()].sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name, 'de')).map((x) => x.name);
  }, [data.value.uebungen, freq]);

  const nameSuggest = (q: string) => {
    const n = normText(q);
    return namen.filter((x) => normText(x) !== n && (!n || normText(x).includes(n)));
  };
  const varianteSuggest = (name: string) => (q: string) => {
    const n = normText(q);
    const own = data.value.uebungen.filter((u) => u.variante && normText(u.name) === normText(name)).map((u) => u.variante);
    const all = [...new Set(data.value.uebungen.map((u) => u.variante).filter(Boolean))];
    const list = own.length ? [...own, ...all.filter((v) => !own.includes(v))] : all;
    return [...new Set(list)].filter((v) => normText(v) !== n && (!n || normText(v).includes(n)));
  };

  const setU = (i: number, patch: Partial<UebungDraft>) =>
    set({ uebungen: draft.uebungen.map((u, j) => (j === i ? { ...u, ...patch } : u)) });
  const setS = (i: number, si: number, patch: Partial<SatzDraft>) =>
    setU(i, { saetze: draft.uebungen[i].saetze.map((x, j) => (j === si ? { ...x, ...patch } : x)) });

  const removeUebung = async (i: number) => {
    const u = draft.uebungen[i];
    const hasData = u.name.trim() || u.saetze.some((x) => x.gewicht || x.wdh || x.dauer);
    if (hasData && !(await confirmDialog({ title: 'Übung entfernen?', message: u.name || undefined, confirmLabel: 'Entfernen', destructive: true })))
      return;
    set({ uebungen: draft.uebungen.filter((_, j) => j !== i) });
  };

  return (
    <>
      <Field label="Fokus">
        <div class="chips">
          {MUSKELGRUPPEN.map((m) => (
            <button
              type="button"
              class="chip"
              aria-pressed={draft.fokus.includes(m)}
              onClick={() => set({ fokus: draft.fokus.includes(m) ? draft.fokus.filter((x) => x !== m) : [...draft.fokus, m] })}
            >
              {m}
            </button>
          ))}
        </div>
      </Field>

      <div class="field">
        <div class="label">Übungen</div>
        {draft.uebungen.map((u, i) => {
          const last = u.name.trim() ? letzteLeistung(u.name, u.variante, draft.datum, draft.id) : null;
          return (
            <div class="exercise" key={u.key}>
              <div class="exercise-head">
                <div class="exercise-names">
                  <SuggestInput
                    class={`name-input${errors[`u${i}`] ? ' invalid' : ''}`}
                    ariaLabel={`Übung ${i + 1}: Name`}
                    placeholder="Übung, z. B. Kniebeuge"
                    value={u.name}
                    onInput={(name) => setU(i, { name })}
                    suggestions={nameSuggest}
                  />
                  <SuggestInput
                    ariaLabel={`Übung ${i + 1}: Gerät oder Variante`}
                    placeholder="Gerät/Variante (optional)"
                    value={u.variante}
                    onInput={(variante) => setU(i, { variante })}
                    suggestions={varianteSuggest(u.name)}
                  />
                </div>
                <button type="button" class="icon-btn" aria-label="Übung entfernen" onClick={() => removeUebung(i)}>
                  <IconTrash size={20} />
                </button>
              </div>
              {errors[`u${i}`] && <div class="field-error">{errors[`u${i}`]}</div>}
              {last && <div class="exercise-last">{last}</div>}

              <div class="sets">
                {u.saetze.length > 0 && (
                  <div class="set-head" aria-hidden="true">
                    <span>#</span>
                    <span>kg</span>
                    <span>{u.saetze.every((x) => x.modus === 'dauer') ? 'Dauer' : 'Wdh.'}</span>
                    <span />
                    <span />
                  </div>
                )}
                {u.saetze.map((x, si) => {
                  const err = errors[`u${i}s${si}`];
                  return (
                    <div key={x.key}>
                      <div class="set-row">
                        <span class="nr">{si + 1}</span>
                        <input
                          class={`input num${err ? ' invalid' : ''}`}
                          inputMode="decimal"
                          placeholder="KG"
                          aria-label={`Satz ${si + 1}: Gewicht in kg (leer = Körpergewicht)`}
                          value={x.gewicht}
                          onInput={(e) => setS(i, si, { gewicht: (e.target as HTMLInputElement).value })}
                        />
                        {x.modus === 'wdh' ? (
                          <input
                            class={`input num${err ? ' invalid' : ''}`}
                            inputMode="decimal"
                            placeholder="Wdh."
                            aria-label={`Satz ${si + 1}: Wiederholungen`}
                            value={x.wdh}
                            onInput={(e) => setS(i, si, { wdh: (e.target as HTMLInputElement).value })}
                          />
                        ) : (
                          <input
                            class={`input num${err ? ' invalid' : ''}`}
                            inputMode="decimal"
                            placeholder="m:ss"
                            aria-label={`Satz ${si + 1}: Dauer (m:ss)`}
                            value={x.dauer}
                            onInput={(e) => setS(i, si, { dauer: (e.target as HTMLInputElement).value })}
                          />
                        )}
                        <button
                          type="button"
                          class="icon-btn"
                          aria-label={`Satz ${si + 1} kopieren`}
                          onClick={() => {
                            const copy = { ...x, key: k(), offen: false };
                            const saetze = [...u.saetze];
                            saetze.splice(si + 1, 0, copy);
                            setU(i, { saetze });
                          }}
                        >
                          <IconCopy size={19} />
                        </button>
                        <button
                          type="button"
                          class={`icon-btn${x.offen ? ' gold' : ''}`}
                          aria-label={`Satz ${si + 1}: weitere Optionen`}
                          aria-expanded={x.offen}
                          onClick={() => setS(i, si, { offen: !x.offen })}
                        >
                          <IconMore size={20} />
                        </button>
                      </div>
                      {!x.offen && x.notiz && <div class="set-note">{x.notiz}</div>}
                      {err && <div class="field-error" style={{ marginLeft: '32px' }}>{err}</div>}
                      {x.offen && (
                        <div class="set-extra">
                          <input
                            class="input"
                            placeholder="Notiz zum Satz, z. B. Gewicht je Seite"
                            aria-label={`Satz ${si + 1}: Notiz`}
                            value={x.notiz}
                            onInput={(e) => setS(i, si, { notiz: (e.target as HTMLInputElement).value })}
                          />
                          <div class="row">
                            <button
                              type="button"
                              class="btn secondary small"
                              onClick={() => setS(i, si, { modus: x.modus === 'wdh' ? 'dauer' : 'wdh' })}
                            >
                              {x.modus === 'wdh' ? 'Dauer statt Wdh.' : 'Wdh. statt Dauer'}
                            </button>
                            <span class="spacer" />
                            <button
                              type="button"
                              class="btn danger small"
                              onClick={() => setU(i, { saetze: u.saetze.filter((_, j) => j !== si) })}
                            >
                              Satz löschen
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {u.gleichOffen && (
                <div class="same-weight">
                  <input
                    class="input num"
                    inputMode="decimal"
                    placeholder="kg"
                    aria-label="Gewicht für alle Sätze"
                    value={u.gleichKg}
                    onInput={(e) => setU(i, { gleichKg: (e.target as HTMLInputElement).value })}
                  />
                  <button
                    type="button"
                    class="btn primary small"
                    onClick={() =>
                      setU(i, { gleichOffen: false, saetze: u.saetze.map((x) => ({ ...x, gewicht: u.gleichKg })) })
                    }
                  >
                    Für alle {u.saetze.length} Sätze
                  </button>
                </div>
              )}
              {u.notizOffen && (
                <input
                  class="input"
                  style={{ marginTop: '8px' }}
                  placeholder="Notiz zur Übung"
                  aria-label="Notiz zur Übung"
                  value={u.notiz}
                  onInput={(e) => setU(i, { notiz: (e.target as HTMLInputElement).value })}
                />
              )}
              <div class="exercise-actions">
                <button
                  type="button"
                  class="btn ghost small"
                  onClick={() => {
                    const lastS = u.saetze[u.saetze.length - 1];
                    setU(i, { saetze: [...u.saetze, { ...emptySatz(lastS?.gewicht ?? ''), modus: lastS?.modus ?? 'wdh' }] });
                  }}
                >
                  <IconPlus size={17} /> Satz
                </button>
                <button
                  type="button"
                  class="btn ghost small"
                  aria-expanded={u.gleichOffen}
                  onClick={() => setU(i, { gleichOffen: !u.gleichOffen, gleichKg: u.gleichKg || u.saetze[0]?.gewicht || '' })}
                >
                  Gleiches Gewicht
                </button>
                {!u.notizOffen && (
                  <button type="button" class="btn ghost small" onClick={() => setU(i, { notizOffen: true })}>
                    Notiz
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {errors.uebungen && <div class="field-error">{errors.uebungen}</div>}
        <button
          type="button"
          class="btn secondary block"
          style={{ marginTop: '12px' }}
          onClick={() => set({ uebungen: [...draft.uebungen, emptyUebung()] })}
        >
          <IconPlus size={19} /> Übung hinzufügen
        </button>
      </div>
    </>
  );
}
