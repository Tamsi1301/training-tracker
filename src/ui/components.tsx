/** Gemeinsame UI-Bausteine: Sheet, Dialog, Toast, Segmented Control, Felder. */
import { signal } from '@preact/signals';
import type { ComponentChildren, JSX } from 'preact';
import { createContext } from 'preact';
import { useContext, useEffect, useRef, useState } from 'preact/hooks';
import { fmtDate, fmtDateRelative, today } from '../lib/dates';
import { IconAlert, IconCalendar, IconCheck, IconChevronRight, IconMinus, IconPlus } from './icons';

// ================================================================ Sheet

const SheetCtx = createContext<{ close: () => void }>({ close: () => {} });
export const useSheet = () => useContext(SheetCtx);

let openSheets = 0;

export function Sheet(props: {
  title?: string;
  onClose: () => void;
  left?: (close: () => void) => ComponentChildren;
  right?: (close: () => void) => ComponentChildren;
  children: ComponentChildren;
  label?: string;
}) {
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const close = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(props.onClose, reduce ? 0 : 260);
  };
  useEffect(() => {
    openSheets++;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => {
      openSheets--;
      if (openSheets === 0) document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, []);
  return (
    <SheetCtx.Provider value={{ close }}>
      <div class="sheet-root" role="dialog" aria-modal="true" aria-label={props.label ?? props.title}>
        <div class={`sheet-scrim${closing ? ' closing' : ''}`} onClick={close} />
        <div class={`sheet${closing ? ' closing' : ''}`}>
          <div class="sheet-head">
            <div class="left">
              {props.left ? props.left(close) : (
                <button class="btn ghost" onClick={close}>
                  Schließen
                </button>
              )}
            </div>
            <div class="title">{props.title}</div>
            <div class="right">{props.right?.(close)}</div>
          </div>
          <div class="sheet-body">{props.children}</div>
        </div>
      </div>
    </SheetCtx.Provider>
  );
}

// ================================================================ Dialog (Aktionsblatt)

interface DialogAction<T> {
  label: string;
  value: T;
  destructive?: boolean;
}
interface DialogState {
  title: string;
  message?: string;
  actions: DialogAction<unknown>[];
  cancelLabel: string;
  resolve: (v: unknown) => void;
}
const dialogState = signal<DialogState | null>(null);

export function actionSheet<T>(opts: { title: string; message?: string; actions: DialogAction<T>[]; cancelLabel?: string }): Promise<T | null> {
  return new Promise((resolve) => {
    dialogState.value = {
      title: opts.title,
      message: opts.message,
      actions: opts.actions as DialogAction<unknown>[],
      cancelLabel: opts.cancelLabel ?? 'Abbrechen',
      resolve: resolve as (v: unknown) => void,
    };
  });
}

export async function confirmDialog(opts: { title: string; message?: string; confirmLabel: string; destructive?: boolean }): Promise<boolean> {
  const r = await actionSheet({
    title: opts.title,
    message: opts.message,
    actions: [{ label: opts.confirmLabel, value: true, destructive: opts.destructive }],
  });
  return r === true;
}

export function DialogHost() {
  const d = dialogState.value;
  const [leaving, setLeaving] = useState(false);
  if (!d) return null;
  const done = (v: unknown) => {
    setLeaving(true);
    setTimeout(() => {
      dialogState.value = null;
      setLeaving(false);
      d.resolve(v);
    }, 200);
  };
  return (
    <div class="dialog-root" role="alertdialog" aria-modal="true" aria-label={d.title}>
      <div class={`sheet-scrim${leaving ? ' closing' : ''}`} onClick={() => done(null)} />
      <div class={`dialog${leaving ? ' sheet closing' : ''}`} style={leaving ? { position: 'relative', top: 'auto' } : undefined}>
        <div class="dialog-box">
          <div class="dialog-msg">
            <h3>{d.title}</h3>
            {d.message && <p>{d.message}</p>}
          </div>
          {d.actions.map((a) => (
            <button class={`dialog-btn${a.destructive ? ' destructive' : ''}`} onClick={() => done(a.value)}>
              {a.label}
            </button>
          ))}
        </div>
        <button class="dialog-btn dialog-cancel" onClick={() => done(null)}>
          {d.cancelLabel}
        </button>
      </div>
    </div>
  );
}

// ================================================================ Toast

interface ToastState {
  id: number;
  message: string;
  kind: 'ok' | 'error';
  action?: { label: string; run: () => void };
}
const toastState = signal<ToastState | null>(null);
const toastLeaving = signal(false);
let toastTimer: ReturnType<typeof setTimeout> | undefined;
let toastSeq = 0;

export function showToast(message: string, opts: { kind?: 'ok' | 'error'; action?: { label: string; run: () => void }; ms?: number } = {}) {
  clearTimeout(toastTimer);
  toastLeaving.value = false;
  const id = ++toastSeq;
  toastState.value = { id, message, kind: opts.kind ?? 'ok', action: opts.action };
  const ms = opts.ms ?? (opts.action ? 5500 : 2600);
  toastTimer = setTimeout(() => hideToast(id), ms);
}

function hideToast(id: number) {
  if (toastState.value?.id !== id) return;
  toastLeaving.value = true;
  setTimeout(() => {
    if (toastState.value?.id === id) toastState.value = null;
    toastLeaving.value = false;
  }, 250);
}

export function ToastHost() {
  const t = toastState.value;
  if (!t) return null;
  return (
    <div class="toast-wrap" aria-live="polite">
      <div class={`toast ${t.kind}${toastLeaving.value ? ' leaving' : ''}`} key={t.id} role="status">
        <span class="ico">{t.kind === 'error' ? <IconAlert size={22} /> : <IconCheck size={22} />}</span>
        <span class="msg">{t.message}</span>
        {t.action && (
          <button
            class="act"
            onClick={() => {
              t.action!.run();
              hideToast(t.id);
            }}
          >
            {t.action.label}
          </button>
        )}
      </div>
    </div>
  );
}

// ================================================================ Segmented Control

export function Segmented<T extends string>(props: {
  value: T;
  options: { value: T; label: ComponentChildren; aria?: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  const idx = Math.max(0, props.options.findIndex((o) => o.value === props.value));
  const n = props.options.length;
  return (
    <div class="segmented" role="group" aria-label={props.label}>
      <span class="thumb" style={{ width: `calc((100% - 6px) / ${n})`, transform: `translateX(${idx * 100}%)` }} />
      {props.options.map((o) => (
        <button type="button" aria-pressed={o.value === props.value} aria-label={o.aria} onClick={() => props.onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ================================================================ Felder

export function Field(props: { label: string; children: ComponentChildren; error?: string | null; hint?: string; for?: string }) {
  return (
    <div class="field">
      <label class="label" for={props.for}>
        {props.label}
      </label>
      {props.children}
      {props.error && <div class="field-error">{props.error}</div>}
      {props.hint && !props.error && <div class="footnote">{props.hint}</div>}
    </div>
  );
}

export function DateField(props: { value: string; onChange: (v: string) => void; id?: string }) {
  return (
    <div class="date-field">
      <span class="badge neutral small">
        <IconCalendar size={17} />
      </span>
      <span class="main">
        {fmtDateRelative(props.value)}
        {props.value === today() && <span class="faint"> · {fmtDate(props.value)}</span>}
      </span>
      <span class="faint">Ändern</span>
      <input
        id={props.id}
        type="date"
        aria-label="Datum"
        value={props.value}
        max="2100-12-31"
        onInput={(e) => {
          const v = (e.target as HTMLInputElement).value;
          if (v) props.onChange(v);
        }}
      />
    </div>
  );
}

export function Stepper(props: { value: number; min: number; max: number; onChange: (v: number) => void; label: string }) {
  return (
    <div class="stepper" role="group" aria-label={props.label}>
      <button type="button" aria-label="weniger" disabled={props.value <= props.min} onClick={() => props.onChange(props.value - 1)}>
        <IconMinus size={18} />
      </button>
      <span class="val" aria-live="polite">
        {props.value}
      </span>
      <button type="button" aria-label="mehr" disabled={props.value >= props.max} onClick={() => props.onChange(props.value + 1)}>
        <IconPlus size={18} />
      </button>
    </div>
  );
}

export function Switch(props: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label class="switch">
      <input type="checkbox" role="switch" checked={props.checked} aria-label={props.label} onChange={(e) => props.onChange((e.target as HTMLInputElement).checked)} />
      <span />
    </label>
  );
}

/** Eingabefeld mit Vorschlägen als Chip-Reihe (iOS-freundlich, statt schwebender Liste). */
export function SuggestInput(props: {
  value: string;
  onInput: (v: string) => void;
  suggestions: (query: string) => string[];
  placeholder?: string;
  class?: string;
  ariaLabel: string;
  autoFocus?: boolean;
}) {
  const [focus, setFocus] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (props.autoFocus) ref.current?.focus();
  }, []);
  const list = focus ? props.suggestions(props.value).slice(0, 12) : [];
  return (
    <div>
      <input
        ref={ref}
        class={`input ${props.class ?? ''}`}
        value={props.value}
        placeholder={props.placeholder}
        aria-label={props.ariaLabel}
        autocomplete="off"
        autocapitalize="sentences"
        enterkeyhint="next"
        onInput={(e) => props.onInput((e.target as HTMLInputElement).value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setTimeout(() => setFocus(false), 120)}
      />
      {list.length > 0 && (
        <div class="suggest-row" role="listbox" aria-label="Vorschläge">
          {list.map((s) => (
            <button
              type="button"
              role="option"
              class="chip suggest"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => {
                props.onInput(s);
                ref.current?.blur();
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ================================================================ Leere Zustände, Zeilen

export function EmptyState(props: { art: JSX.Element; title: string; text: string; children?: ComponentChildren; inline?: boolean }) {
  return (
    <div class={`empty${props.inline ? ' inline' : ''}`}>
      <div class="art">{props.art}</div>
      <h2>{props.title}</h2>
      <p>{props.text}</p>
      {props.children}
    </div>
  );
}

export function Row(props: {
  icon?: JSX.Element;
  title: ComponentChildren;
  sub?: ComponentChildren;
  value?: ComponentChildren;
  onClick?: () => void;
  chevron?: boolean;
  class?: string;
}) {
  const inner = (
    <>
      {props.icon}
      <span class="main">
        <div class="title">{props.title}</div>
        {props.sub && <div class="sub">{props.sub}</div>}
      </span>
      {props.value != null && <span class="value">{props.value}</span>}
      {(props.chevron ?? !!props.onClick) && (
        <span class="chev">
          <IconChevronRight size={18} />
        </span>
      )}
    </>
  );
  const cls = `list-row${props.icon ? ' with-icon' : ''} ${props.class ?? ''}`;
  return props.onClick ? (
    <button type="button" class={cls} onClick={props.onClick}>
      {inner}
    </button>
  ) : (
    <div class={cls}>{inner}</div>
  );
}
