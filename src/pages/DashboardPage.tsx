import { signal } from '@preact/signals';
import { useMemo, useState } from 'preact/hooks';
import {
  addDays, daysBetween, fmtDate, fromISODate, monthName, periodOf, periodSubtitle, periodTitle, shiftPeriod, today, weekdayName,
  type Period, type PeriodKind,
} from '../lib/dates';
import { fmtClock, fmtNum } from '../lib/format';
import { fmtPace } from '../lib/pace';
import {
  boulderBest, boulderBestPerHalle, boulderSeries, computeStreak, fastestRun, longestRun, paceSeries,
  sessionsInRange, summarize, uebungArt, uebungBest, uebungenNachHaeufigkeit, uebungSeries, type UebungBest,
} from '../lib/stats';
import { SPORT_LABEL, SPORTS, type Session, type Sport } from '../lib/types';
import { uebungLabel } from '../lib/uebungen';
import { data, hallenById, lastBackup, tab, uebungenById } from '../store';
import { EmptyState, Row, Segmented } from '../ui/components';
import { IconChevronLeft, IconChevronRight, IconFlame, IconOverview, IconPin, IconShield, IconTrophy, SportBadge } from '../ui/icons';
import { LineChart } from '../ui/LineChart';
import { SessionSheet } from '../ui/SessionDetail';

const periodKind = signal<PeriodKind>('woche');
const periodAnchor = signal<string>(today());
const chartRange = signal<'3m' | '12m' | 'alle'>('12m');
const chosenUebung = signal<string | null>(null);
const kraftMetric = signal<'gewicht' | 'volumen'>('gewicht');

const SPORT_COLOR: Record<Sport, string> = { bouldern: 'var(--c-bouldern)', kraft: 'var(--c-kraft)', laufen: 'var(--c-laufen)' };

function BackupNotice({ hasData }: { hasData: boolean }) {
  if (!hasData) return null;
  const lb = lastBackup.value;
  const days = lb ? daysBetween(lb.slice(0, 10), today()) : null;
  const text =
    days == null ? 'Noch kein Backup erstellt' : days === 0 ? 'Letztes Backup heute' : days === 1 ? 'Letztes Backup gestern' : `Letztes Backup vor ${days} Tagen`;
  const warn = days == null || days > 14;
  return (
    <button class={`notice${warn ? ' warn' : ''}`} onClick={() => (tab.value = 'einstellungen')}>
      <span class={`badge small ${warn ? 'gold' : 'neutral'}`}>
        <IconShield size={17} />
      </span>
      <span class="spacer">
        {text}
        {warn && <div class="faint" style={{ fontSize: '13px' }}>Jetzt sichern, damit nichts verloren geht</div>}
      </span>
      <IconChevronRight size={18} class="faint" />
    </button>
  );
}

function PeriodNav({ p }: { p: Period }) {
  const t = today();
  const canNext = shiftPeriod(p, 1).start <= t;
  const isCurrent = p.start <= t && p.end >= t;
  return (
    <div class="period-nav">
      <button class="icon-btn" aria-label="Vorheriger Zeitraum" onClick={() => (periodAnchor.value = shiftPeriod(p, -1).start)}>
        <IconChevronLeft />
      </button>
      <div class="center">
        <button onClick={() => (periodAnchor.value = t)} aria-label="Zum aktuellen Zeitraum" disabled={isCurrent}>
          <div class="t">{periodTitle(p)}</div>
          <div class="s">{p.kind === 'woche' ? periodSubtitle(p) : isCurrent ? 'aktuell' : 'Zurück zu heute'}</div>
        </button>
      </div>
      <button class="icon-btn" aria-label="Nächster Zeitraum" disabled={!canNext} onClick={() => (periodAnchor.value = shiftPeriod(p, 1).start)}>
        <IconChevronRight />
      </button>
    </div>
  );
}

function DurationValue({ sec }: { sec: number }) {
  if (!sec) return <>–</>;
  const min = Math.round(sec / 60);
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return (<>{m}<small>min</small></>);
  return (<>{fmtNum(h)}<small>h</small>{m > 0 && <> {m}<small>min</small></>}</>);
}

function Summary({ sessions }: { sessions: Session[] }) {
  const s = summarize(sessions);
  const boulder = boulderBest(sessions);
  return (
    <>
      <div class="hero">
        <div class="eyebrow">Einheiten</div>
        <div style={{ marginTop: '6px' }}>
          <span class="big">{s.total}</span>
        </div>
        <div class="sport-split">
          {SPORTS.map((sp) => (
            <div class="item">
              <SportBadge sport={sp} small />
              <div>
                <div class="n">{s.perSport[sp]}</div>
                <div class="l">{SPORT_LABEL[sp]}</div>
              </div>
            </div>
          ))}
        </div>
        <div class="bar" aria-hidden="true">
          {SPORTS.map((sp) => (
            <span style={{ flexGrow: s.perSport[sp], flexBasis: 0, background: SPORT_COLOR[sp], display: s.perSport[sp] ? 'block' : 'none' }} />
          ))}
        </div>
      </div>
      <div class="stat-grid">
        <div class="stat">
          <div class="k">Gesamtdauer</div>
          <div class="v">
            <DurationValue sec={s.dauerSekunden} />
          </div>
        </div>
        <div class="stat">
          <div class="k">Laufkilometer</div>
          <div class="v">
            {fmtNum(s.laufKm, 1)}
            <small>km</small>
          </div>
        </div>
        <div class="stat">
          <div class="k">Ø Pace</div>
          <div class="v">
            {fmtPace(s.avgPace, false)}
            {s.avgPace != null && <small>/km</small>}
          </div>
        </div>
        <div class="stat">
          <div class="k">Bouldern bestes</div>
          <div class="v">
            {boulder ? boulder.sessionMaxGrad : '–'}
            {boulder && <small>von {boulder.hallenMaxGrad}</small>}
          </div>
        </div>
      </div>
    </>
  );
}

function Streaks({ sessions }: { sessions: Session[] }) {
  const t = today();
  const all = computeStreak(sessions, t);
  // letzte 8 Wochen als Punkte
  const weeks = new Set(sessions.map((s) => periodOf('woche', s.datum).start));
  const thisWeek = periodOf('woche', t).start;
  const dots = Array.from({ length: 8 }, (_, i) => weeks.has(addDays(thisWeek, -7 * (7 - i))));
  return (
    <div class="card">
      <div class="streak">
        <span class="badge gold" style={{ width: '48px', height: '48px', borderRadius: '15px' }}>
          <IconFlame size={26} />
        </span>
        <div class="spacer">
          <div>
            <span class="big">{all.current}</span>
            <span class="muted" style={{ marginLeft: '8px' }}>
              {all.current === 1 ? 'Woche in Folge' : 'Wochen in Folge'}
            </span>
          </div>
          <div class="dots" aria-label="Letzte 8 Wochen">
            {dots.map((on) => (
              <span class={on ? 'on' : ''} />
            ))}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div class="faint" style={{ fontSize: '13px' }}>
            Rekord
          </div>
          <div style={{ fontSize: '20px' }}>{all.longest}</div>
        </div>
      </div>
      {!all.thisWeekDone && all.current > 0 && (
        <p class="footnote" style={{ margin: '10px 0 0' }}>
          Diese Woche noch offen – eine Einheit verlängert die Serie.
        </p>
      )}
      <div class="streak-sports">
        {SPORTS.map((sp) => {
          const st = computeStreak(sessions, t, sp);
          return (
            <div class="item" aria-label={`${SPORT_LABEL[sp]}: ${st.current} Wochen in Folge`}>
              <SportBadge sport={sp} small />
              <span>
                <b>{st.current}</b> Wo.
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function rangeStart(r: '3m' | '12m' | 'alle'): string {
  if (r === 'alle') return '0000-01-01';
  return addDays(today(), r === '3m' ? -91 : -365);
}

function Progress({ sessions }: { sessions: Session[] }) {
  const from = rangeStart(chartRange.value);
  const inRange = useMemo(() => sessions.filter((s) => s.datum >= from), [sessions, from]);

  const boulder = useMemo(() => boulderSeries(inRange), [inRange]);
  const pace = useMemo(() => paceSeries(inRange), [inRange]);
  const freq = useMemo(() => uebungenNachHaeufigkeit(sessions), [sessions]);
  const uId = chosenUebung.value && uebungenById.value.has(chosenUebung.value) ? chosenUebung.value : freq[0]?.uebungId ?? null;
  const uPoints = useMemo(() => (uId ? uebungSeries(inRange, uId) : []), [inRange, uId]);
  const uArt = useMemo(() => (uId ? uebungArt(uebungSeries(sessions, uId)) : 'leer'), [sessions, uId]);

  const kraftPts = uPoints
    .map((q) => {
      const y =
        uArt === 'gewicht' ? (kraftMetric.value === 'volumen' ? q.volumen : q.maxGewicht) : uArt === 'wdh' ? q.maxWdh : q.maxDauer;
      return y != null && y > 0 ? { x: q.datum, y } : null;
    })
    .filter((x): x is { x: string; y: number } => x != null);

  const fmtKraft = (v: number) =>
    uArt === 'dauer' ? fmtClock(v) : uArt === 'wdh' ? `${fmtNum(v)} Wdh.` : kraftMetric.value === 'volumen' ? `${fmtNum(Math.round(v))} kg` : `${fmtNum(v)} kg`;

  return (
    <>
      <Segmented
        label="Zeitraum der Kurven"
        value={chartRange.value}
        onChange={(v) => (chartRange.value = v)}
        options={[
          { value: '3m', label: '3 Monate' },
          { value: '12m', label: '12 Monate' },
          { value: 'alle', label: 'Alles' },
        ]}
      />
      <div style={{ height: '12px' }} />

      <div class="chart-card">
        <div class="chart-head">
          <div>
            <div class="t">
              <SportBadge sport="bouldern" small /> Bouldern
            </div>
            <div class="s">Session-Maximum im Verhältnis zur Halle</div>
          </div>
        </div>
        {boulder.length ? (
          <>
            <LineChart
              label="Verlauf Boulder-Session-Maximum"
              points={boulder.map((b) => ({ x: b.datum, y: b.grad, ref: b.hallenMax }))}
              color="var(--c-bouldern)"
              yDomain={[0, Math.max(...boulder.map((b) => b.hallenMax))]}
              integer
              yFormat={(v) => String(v)}
              readout={(q) => ({
                value: `${q.y} von ${q.ref}`,
                detail: hallenById.value.get(boulder.find((b) => b.datum === q.x && b.grad === q.y)?.halleId ?? '')?.name,
              })}
            />
            <div class="legend">
              <span style={{ color: 'var(--c-bouldern)' }}>
                <i />
                <span class="muted">Session-Maximum</span>
              </span>
              <span style={{ color: 'var(--text-3)' }}>
                <i class="dash" />
                <span class="muted">Hallen-Maximum</span>
              </span>
            </div>
          </>
        ) : (
          <div class="chart-empty">Keine Boulder-Einheiten in diesem Zeitraum.</div>
        )}
      </div>

      <div class="chart-card">
        <div class="chart-head">
          <div style={{ minWidth: 0 }}>
            <div class="t">
              <SportBadge sport="kraft" small /> Kraftsport
            </div>
            <div class="s">
              {uArt === 'gewicht' ? (kraftMetric.value === 'volumen' ? 'Volumen je Einheit (kg × Wdh.)' : 'Schwerstes Gewicht je Einheit') : uArt === 'wdh' ? 'Meiste Wiederholungen (Körpergewicht)' : uArt === 'dauer' ? 'Längste Dauer' : 'Verlauf je Übung'}
            </div>
          </div>
        </div>
        {freq.length ? (
          <>
            <div class="row" style={{ marginBottom: '6px', flexWrap: 'wrap' }}>
              <select
                class="select compact"
                style={{ flex: '1 1 160px' }}
                aria-label="Übung wählen"
                value={uId ?? ''}
                onChange={(e) => (chosenUebung.value = (e.target as HTMLSelectElement).value)}
              >
                {freq.map((f) => (
                  <option value={f.uebungId}>{uebungLabel(uebungenById.value.get(f.uebungId))}</option>
                ))}
              </select>
              {uArt === 'gewicht' && (
                <div style={{ flex: '0 0 170px' }}>
                  <Segmented
                    label="Kennzahl"
                    value={kraftMetric.value}
                    onChange={(v) => (kraftMetric.value = v)}
                    options={[
                      { value: 'gewicht', label: 'Gewicht' },
                      { value: 'volumen', label: 'Volumen' },
                    ]}
                  />
                </div>
              )}
            </div>
            {kraftPts.length ? (
              <LineChart
                label="Verlauf der gewählten Übung"
                points={kraftPts}
                color="var(--c-kraft)"
                integer={uArt === 'wdh'}
                yFormat={(v) => (uArt === 'dauer' ? fmtClock(v) : fmtNum(v >= 10000 ? Math.round(v / 1000) : v, 1) + (v >= 10000 ? 'k' : ''))}
                readout={(q) => ({ value: fmtKraft(q.y) })}
              />
            ) : (
              <div class="chart-empty">Keine Werte für diese Übung im gewählten Zeitraum.</div>
            )}
          </>
        ) : (
          <div class="chart-empty">Noch keine Kraft-Einheiten.</div>
        )}
      </div>

      <div class="chart-card">
        <div class="chart-head">
          <div>
            <div class="t">
              <SportBadge sport="laufen" small /> Laufen
            </div>
            <div class="s">Pace je Lauf · schneller ist oben</div>
          </div>
        </div>
        {pace.length ? (
          <LineChart
            label="Verlauf der Lauf-Pace"
            points={pace.map((q) => ({ x: q.datum, y: q.pace }))}
            color="var(--c-laufen)"
            invert
            yFormat={(v) => fmtClock(v)}
            readout={(q) => ({
              value: fmtPace(q.y),
              detail: `${fmtNum(pace.find((x) => x.datum === q.x && x.pace === q.y)?.distanzKm ?? 0)} km`,
            })}
          />
        ) : (
          <div class="chart-empty">Keine Läufe mit Distanz in diesem Zeitraum.</div>
        )}
      </div>
    </>
  );
}

function Bests({ sessions, onOpen }: { sessions: Session[]; onOpen: (id: string) => void }) {
  const [showAll, setShowAll] = useState(false);
  const b = boulderBest(sessions);
  const perHalle = boulderBestPerHalle(sessions);
  const lr = longestRun(sessions);
  const fr = fastestRun(sessions);
  const kraftBests = useMemo(
    () =>
      uebungenNachHaeufigkeit(sessions)
        .map((f) => uebungBest(sessions, f.uebungId))
        .filter((x): x is UebungBest => x != null),
    [sessions],
  );
  const fmtBest = (x: UebungBest) => (x.art === 'gewicht' ? `${fmtNum(x.wert)} kg` : x.art === 'wdh' ? `${fmtNum(x.wert)} Wdh.` : fmtClock(x.wert));
  const shown = showAll ? kraftBests : kraftBests.slice(0, 5);
  const hasAny = b || lr || kraftBests.length;
  if (!hasAny) return <div class="card faint">Noch keine Bestleistungen – das ändert sich mit deiner ersten Einheit.</div>;

  return (
    <div class="stack">
      {(b || lr) && (
        <div class="list">
          {b && (
            <Row
              icon={<SportBadge sport="bouldern" />}
              title="Bouldern"
              sub={`Relativ zur Halle · ${hallenById.value.get(b.halleId)?.name ?? ''} · ${fmtDate(b.datum)}`}
              value={`${b.sessionMaxGrad} von ${b.hallenMaxGrad}`}
              onClick={() => onOpen(b.id)}
            />
          )}
          {perHalle.size > 1 &&
            [...perHalle.entries()].map(([hid, s]) => (
              <Row
                icon={<span class="badge bouldern"><IconPin size={18} /></span>}
                title={hallenById.value.get(hid)?.name ?? 'Halle'}
                sub={`Bestes in dieser Halle · ${fmtDate(s.datum)}`}
                value={`${s.sessionMaxGrad} von ${s.hallenMaxGrad}`}
                onClick={() => onOpen(s.id)}
              />
            ))}
          {lr && <Row icon={<SportBadge sport="laufen" />} title="Längster Lauf" sub={fmtDate(lr.datum)} value={`${fmtNum(lr.distanzKm)} km`} onClick={() => onOpen(lr.id)} />}
          {fr && (
            <Row
              icon={<SportBadge sport="laufen" />}
              title="Schnellste Pace"
              sub={`${fmtNum(fr.session.distanzKm)} km · ${fmtDate(fr.session.datum)}`}
              value={fmtPace(fr.pace)}
              onClick={() => onOpen(fr.session.id)}
            />
          )}
        </div>
      )}
      {kraftBests.length > 0 && (
        <div class="list">
          {shown.map((x) => (
            <Row
              icon={<SportBadge sport="kraft" />}
              title={uebungLabel(uebungenById.value.get(x.uebungId))}
              sub={fmtDate(x.datum)}
              value={fmtBest(x)}
              onClick={() => onOpen(x.sessionId)}
            />
          ))}
          {kraftBests.length > 5 && (
            <button class="list-row accent" onClick={() => setShowAll(!showAll)}>
              <span class="main">
                <div class="title">{showAll ? 'Weniger anzeigen' : `Alle ${kraftBests.length} Übungen anzeigen`}</div>
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function DashboardPage() {
  const [openId, setOpenId] = useState<string | null>(null);
  const sessions = data.value.sessions;
  const p = periodOf(periodKind.value, periodAnchor.value);
  const inPeriod = useMemo(() => sessionsInRange(sessions, p), [sessions, p.start, p.end]);
  const t = today();
  const d = fromISODate(t);

  return (
    <div class="page">
      <header class="page-header">
        <div>
          <div class="eyebrow">
            {weekdayName(t)}, {d.getDate()}. {monthName(d.getMonth())}
          </div>
          <h1 class="large-title">Übersicht</h1>
        </div>
      </header>

      {sessions.length === 0 ? (
        <EmptyState
          art={<IconOverview size={88} strokeWidth={0.9} />}
          title="Willkommen"
          text="Erfasse deine erste Einheit oder spiele eine Sicherung bzw. deine Altdaten ein. Danach siehst du hier Fortschritt, Serien und Bestleistungen."
        >
          <div class="stack" style={{ maxWidth: '280px', margin: '0 auto' }}>
            <button class="btn primary" onClick={() => (tab.value = 'neu')}>
              Erste Einheit erfassen
            </button>
            <button class="btn secondary" onClick={() => (tab.value = 'einstellungen')}>
              Daten importieren
            </button>
          </div>
        </EmptyState>
      ) : (
        <>
          <BackupNotice hasData />
          <Segmented
            label="Zeitraum"
            value={periodKind.value}
            onChange={(v) => {
              periodKind.value = v;
              periodAnchor.value = t;
            }}
            options={[
              { value: 'woche', label: 'Woche' },
              { value: 'monat', label: 'Monat' },
              { value: 'jahr', label: 'Jahr' },
            ]}
          />
          <PeriodNav p={p} />
          <Summary sessions={inPeriod} />

          <section class="section">
            <h2 class="section-title">
              <span>Serie</span>
            </h2>
            <Streaks sessions={sessions} />
          </section>

          <section class="section">
            <h2 class="section-title">
              <span>Fortschritt</span>
            </h2>
            <Progress sessions={sessions} />
          </section>

          <section class="section">
            <h2 class="section-title">
              <span class="row" style={{ gap: '6px' }}>
                <IconTrophy size={16} /> Bestleistungen
              </span>
            </h2>
            <Bests sessions={sessions} onOpen={setOpenId} />
          </section>
        </>
      )}
      {openId && <SessionSheet id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

