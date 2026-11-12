/** Leichtgewichtiges SVG-Liniendiagramm mit Antippen-zum-Ablesen (kein Hover nötig). */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { fmtDate, fromISODate, monthShort } from '../lib/dates';

export interface ChartPoint {
  x: string; // Datum JJJJ-MM-TT
  y: number;
  /** optionaler Bezugswert (z. B. Hallen-Maximum) */
  ref?: number;
}

interface Props {
  points: ChartPoint[];
  color: string;
  yFormat: (v: number) => string;
  readout: (p: ChartPoint) => { value: string; detail?: string };
  /** feste y-Grenzen */
  yDomain?: [number, number];
  /** größere Werte unten (z. B. Pace: schneller = oben) */
  invert?: boolean;
  integer?: boolean;
  height?: number;
  label: string;
}

const PAD = { l: 36, r: 10, t: 12, b: 24 };

function niceStep(range: number, count: number, integer?: boolean): number {
  const raw = range / Math.max(1, count);
  const pow = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const n = raw / pow;
  let step = (n >= 5 ? 10 : n >= 2 ? 5 : n >= 1 ? 2 : 1) * pow;
  if (n < 1.5) step = pow;
  if (integer) step = Math.max(1, Math.round(step));
  return step;
}

export function LineChart(p: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(320);
  const [sel, setSel] = useState<number | null>(null);
  const h = p.height ?? 170;

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    setW(el.clientWidth || 320);
    const ro = new ResizeObserver(() => setW(el.clientWidth || 320));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pts = p.points;
  useEffect(() => setSel(null), [pts]);

  const geo = useMemo(() => {
    if (!pts.length) return null;
    const xs = pts.map((q) => fromISODate(q.x).getTime());
    const x0 = xs[0];
    const x1 = xs[xs.length - 1];
    const vals = pts.flatMap((q) => (q.ref != null ? [q.y, q.ref] : [q.y]));
    let lo = p.yDomain ? p.yDomain[0] : Math.min(...vals);
    let hi = p.yDomain ? p.yDomain[1] : Math.max(...vals);
    if (!p.yDomain) {
      const pad = (hi - lo) * 0.12 || Math.max(1, Math.abs(hi) * 0.1);
      lo = Math.max(0, lo - pad);
      hi = hi + pad;
    }
    const step = niceStep(hi - lo, 3, p.integer);
    if (!p.yDomain) {
      lo = Math.floor(lo / step) * step;
      hi = Math.ceil(hi / step) * step;
    }
    const ticks: number[] = [];
    for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(Number(v.toFixed(6)));

    const iw = w - PAD.l - PAD.r;
    const ih = h - PAD.t - PAD.b;
    const sx = (t: number) => PAD.l + (x1 === x0 ? iw / 2 : ((t - x0) / (x1 - x0)) * iw);
    const sy = (v: number) => {
      const r = hi === lo ? 0.5 : (v - lo) / (hi - lo);
      return PAD.t + (p.invert ? r : 1 - r) * ih;
    };
    const coords = pts.map((q, i) => ({ x: sx(xs[i]), y: sy(q.y), r: q.ref != null ? sy(q.ref) : null }));

    const line = coords.map((c, i) => `${i ? 'L' : 'M'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join('');
    const baseY = p.invert ? PAD.t : PAD.t + ih;
    const area = coords.length > 1 ? `${line}L${coords[coords.length - 1].x.toFixed(1)},${baseY}L${coords[0].x.toFixed(1)},${baseY}Z` : '';
    // Bezugslinie: waagerechte Abschnitte je Folge gleicher Werte (keine senkrechten Sprünge)
    let ref = '';
    for (let a = 0; a < coords.length; ) {
      const r = coords[a].r;
      let b = a;
      while (b + 1 < coords.length && coords[b + 1].r === r) b++;
      if (r != null) ref += `M${(coords[a].x - 3).toFixed(1)},${r.toFixed(1)}H${(coords[b].x + 3).toFixed(1)}`;
      a = b + 1;
    }

    // x-Beschriftung: Anfang, Ende (und Mitte bei breitem Zeitraum)
    const fmtX = (t: number) => {
      const d = new Date(t);
      const span = x1 - x0;
      return span > 300 * 864e5 ? `${monthShort(d.getMonth())} ${String(d.getFullYear()).slice(2)}` : `${d.getDate()}. ${monthShort(d.getMonth())}`;
    };
    const xLabels =
      x1 === x0
        ? [{ x: sx(x0), t: fmtX(x0), anchor: 'middle' }]
        : [
            { x: sx(x0), t: fmtX(x0), anchor: 'start' },
            ...(iw > 260 ? [{ x: sx((x0 + x1) / 2), t: fmtX((x0 + x1) / 2), anchor: 'middle' }] : []),
            { x: sx(x1), t: fmtX(x1), anchor: 'end' },
          ];
    return { coords, line, area, ref, ticks, sy, xLabels, ih };
  }, [pts, w, h, p.yDomain?.[0], p.yDomain?.[1], p.invert, p.integer]);

  const pick = (clientX: number) => {
    if (!geo || !wrap.current) return;
    const x = clientX - wrap.current.getBoundingClientRect().left;
    let best = 0;
    geo.coords.forEach((c, i) => {
      if (Math.abs(c.x - x) < Math.abs(geo.coords[best].x - x)) best = i;
    });
    setSel(best);
  };

  if (!geo) return null;
  const active = sel ?? pts.length - 1;
  const ro = p.readout(pts[active]);
  const ac = geo.coords[active];
  const gid = `g${p.label.replace(/\W/g, '')}`;
  const sig = pts.length + ':' + pts[0].x + pts[pts.length - 1].x;

  return (
    <div>
      <div class="chart-readout" aria-live="polite">
        <div class="v">{ro.value}</div>
        <div class="d">
          {fmtDate(pts[active].x)}
          {ro.detail ? ` · ${ro.detail}` : ''}
          {sel == null && pts.length > 1 ? ' · zuletzt' : ''}
        </div>
      </div>
      <div ref={wrap}>
        <svg
          class="chart"
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          role="img"
          aria-label={p.label}
          onPointerDown={(e) => pick(e.clientX)}
          onPointerMove={(e) => e.buttons && pick(e.clientX)}
        >
          <defs>
            <linearGradient id={gid} x1="0" x2="0" y1={p.invert ? '1' : '0'} y2={p.invert ? '0' : '1'}>
              <stop offset="0" stop-color={p.color} stop-opacity="0.16" />
              <stop offset="1" stop-color={p.color} stop-opacity="0" />
            </linearGradient>
          </defs>
          {geo.ticks.map((t) => (
            <g>
              <line class="grid" x1={PAD.l} x2={w - PAD.r} y1={geo.sy(t)} y2={geo.sy(t)} />
              <text x={PAD.l - 8} y={geo.sy(t) + 4} text-anchor="end">
                {p.yFormat(t)}
              </text>
            </g>
          ))}
          {geo.xLabels.map((l) => (
            <text x={l.x} y={h - 6} text-anchor={l.anchor}>
              {l.t}
            </text>
          ))}
          {geo.ref && <path class="ref" d={geo.ref} />}
          {geo.area && <path d={geo.area} fill={`url(#${gid})`} key={'a' + sig} style={{ animation: 'fade-in .9s var(--ease)' }} />}
          <path class="line draw" d={geo.line} stroke={p.color} pathLength={1} style={{ ['--len' as string]: 1 }} key={'l' + sig} />
          {pts.length <= 40 &&
            geo.coords.map((c) => <circle cx={c.x} cy={c.y} r={2.6} fill="var(--card)" stroke={p.color} stroke-width={1.6} />)}
          <line class="cursor" x1={ac.x} x2={ac.x} y1={PAD.t} y2={PAD.t + geo.ih} />
          <circle cx={ac.x} cy={ac.y} r={5.5} fill={p.color} stroke="var(--card)" stroke-width={2.5} />
        </svg>
      </div>
    </div>
  );
}
