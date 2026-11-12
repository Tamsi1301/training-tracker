import { signal } from '@preact/signals';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { addDays, fmtDateRelative, fromISODate, monthName, periodOf, today } from '../lib/dates';
import { plural } from '../lib/format';
import { SPORT_LABEL, type Session, type Sport } from '../lib/types';
import { highlightId, sessionsNewest, tab } from '../store';
import { EmptyState, Segmented } from '../ui/components';
import { IconHistory, SPORT_ICON, SportBadge } from '../ui/icons';
import { SessionSheet } from '../ui/SessionDetail';
import { sessionSummary, sessionTitle } from '../ui/sessionText';

type SportFilter = 'alle' | Sport;
const sportFilter = signal<SportFilter>('alle');
const rangeFilter = signal<string>('alle');

const PAGE = 60;

function rangeOptions(sessions: Session[]): { value: string; label: string }[] {
  const years = [...new Set(sessions.map((s) => s.datum.slice(0, 4)))].sort().reverse();
  return [
    { value: 'alle', label: 'Gesamter Zeitraum' },
    { value: 'woche', label: 'Diese Woche' },
    { value: 'monat', label: 'Dieser Monat' },
    { value: '3m', label: 'Letzte 3 Monate' },
    { value: '12m', label: 'Letzte 12 Monate' },
    ...years.map((y) => ({ value: `y${y}`, label: `Jahr ${y}` })),
  ];
}

function rangeOf(v: string): { start: string; end: string } | null {
  const t = today();
  if (v === 'woche' || v === 'monat') return periodOf(v, t);
  if (v === '3m') return { start: addDays(t, -91), end: '9999-12-31' };
  if (v === '12m') return { start: addDays(t, -365), end: '9999-12-31' };
  if (v.startsWith('y')) return { start: `${v.slice(1)}-01-01`, end: `${v.slice(1)}-12-31` };
  return null;
}

export function HistoryPage() {
  const [openId, setOpenId] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const sentinel = useRef<HTMLDivElement>(null);
  const all = sessionsNewest.value;

  const filtered = useMemo(() => {
    const r = rangeOf(rangeFilter.value);
    return all.filter((s) => (sportFilter.value === 'alle' || s.sport === sportFilter.value) && (!r || (s.datum >= r.start && s.datum <= r.end)));
  }, [all, sportFilter.value, rangeFilter.value]);

  useEffect(() => setLimit(PAGE), [sportFilter.value, rangeFilter.value]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => e[0].isIntersecting && setLimit((l) => l + PAGE), { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [filtered.length > limit]);

  // Hervorhebung nach dem Speichern
  const hl = highlightId.value;
  useEffect(() => {
    if (!hl) return;
    const t = setTimeout(() => (highlightId.value = null), 1800);
    return () => clearTimeout(t);
  }, [hl]);

  const groups = useMemo(() => {
    const out: { key: string; label: string; items: Session[] }[] = [];
    for (const s of filtered.slice(0, limit)) {
      const key = s.datum.slice(0, 7);
      let g = out[out.length - 1];
      if (!g || g.key !== key) {
        const d = fromISODate(s.datum);
        g = { key, label: `${monthName(d.getMonth())} ${d.getFullYear()}`, items: [] };
        out.push(g);
      }
      g.items.push(s);
    }
    return out;
  }, [filtered, limit]);

  const countByMonth = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of filtered) m.set(s.datum.slice(0, 7), (m.get(s.datum.slice(0, 7)) ?? 0) + 1);
    return m;
  }, [filtered]);

  return (
    <div class="page">
      <header class="page-header">
        <div>
          <div class="eyebrow">{plural(all.length, 'Einheit', 'Einheiten')}</div>
          <h1 class="large-title">Verlauf</h1>
        </div>
      </header>

      {all.length === 0 ? (
        <EmptyState
          art={<IconHistory size={88} strokeWidth={0.9} />}
          title="Noch keine Einheiten"
          text="Sobald du deine erste Einheit speicherst, erscheint sie hier – nach Monaten geordnet."
        >
          <button class="btn primary" onClick={() => (tab.value = 'neu')}>
            Erste Einheit erfassen
          </button>
        </EmptyState>
      ) : (
        <>
          <div class="filters">
            <Segmented
              label="Sportart filtern"
              value={sportFilter.value}
              onChange={(v) => (sportFilter.value = v)}
              options={[
                { value: 'alle', label: 'Alle' },
                ...(['bouldern', 'kraft', 'laufen'] as Sport[]).map((sp) => {
                  const I = SPORT_ICON[sp];
                  return { value: sp, label: <I size={20} />, aria: SPORT_LABEL[sp] };
                }),
              ]}
            />
            <select
              class="select compact"
              aria-label="Zeitraum filtern"
              value={rangeFilter.value}
              onChange={(e) => (rangeFilter.value = (e.target as HTMLSelectElement).value)}
            >
              {rangeOptions(all).map((o) => (
                <option value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              inline
              art={<IconHistory size={72} strokeWidth={0.9} />}
              title="Nichts gefunden"
              text="Für diese Auswahl gibt es keine Einheiten."
            >
              <button
                class="btn secondary small"
                onClick={() => {
                  sportFilter.value = 'alle';
                  rangeFilter.value = 'alle';
                }}
              >
                Filter zurücksetzen
              </button>
            </EmptyState>
          ) : (
            groups.map((g) => (
              <section key={g.key}>
                <div class="month-head">
                  <span>{g.label}</span>
                  <span>{plural(countByMonth.get(g.key) ?? 0, 'Einheit', 'Einheiten')}</span>
                </div>
                <div class="list">
                  {g.items.map((s) => (
                    <button
                      key={s.id}
                      class={`list-row with-icon history-row${hl === s.id ? ' flash' : ''}`}
                      onClick={() => setOpenId(s.id)}
                      aria-label={`${SPORT_LABEL[s.sport]}, ${fmtDateRelative(s.datum)}, ${sessionTitle(s)}`}
                    >
                      <SportBadge sport={s.sport} />
                      <span class="main">
                        <div class="title">{sessionTitle(s)}</div>
                        <div class="sub">{sessionSummary(s)}</div>
                      </span>
                      <span class="value" style={{ fontSize: '14px' }}>
                        {fmtDateRelative(s.datum)}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ))
          )}
          {filtered.length > limit && <div ref={sentinel} style={{ height: '40px' }} />}
        </>
      )}
      {openId && <SessionSheet id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
