import { signal } from '@preact/signals';
import { useState } from 'preact/hooks';
import { today } from '../lib/dates';
import { SPORT_LABEL, type Sport } from '../lib/types';
import { highlightId, tab } from '../store';
import { confirmDialog, showToast } from '../ui/components';
import { IconChevronLeft, SportBadge } from '../ui/icons';
import { newDraft, SessionForm, submitDraft, type Draft } from '../ui/SessionForm';

/** Entwurf bleibt erhalten, wenn zwischendurch der Tab gewechselt wird. */
const draftSig = signal<Draft | null>(null);
const errorsSig = signal<Record<string, string>>({});

const SUBTITLES: Record<Sport, string> = {
  bouldern: 'Halle und Session-Maximum',
  kraft: 'Übungen, Sätze, Gewichte',
  laufen: 'Distanz, Dauer, Pace',
};

function isDirty(d: Draft): boolean {
  const fresh = newDraft(d.sport, d.datum);
  const strip = (x: Draft) => JSON.stringify({ ...x, uebungen: x.uebungen.map((u) => ({ ...u, key: '', saetze: u.saetze.map((s) => ({ ...s, key: '' })) })) });
  return strip(d) !== strip(fresh);
}

export function NewPage() {
  const draft = draftSig.value;
  const [saving, setSaving] = useState(false);

  if (!draft) {
    return (
      <div class="page">
        <header class="page-header">
          <div>
            <div class="eyebrow">Erfassen</div>
            <h1 class="large-title">Neue Einheit</h1>
          </div>
        </header>
        <div class="sport-pick">
          {(['bouldern', 'kraft', 'laufen'] as Sport[]).map((sp) => (
            <button
              class="sport-card"
              onClick={() => {
                errorsSig.value = {};
                draftSig.value = newDraft(sp, today());
              }}
            >
              <SportBadge sport={sp} />
              <span>
                <div class="name">{SPORT_LABEL[sp]}</div>
                <div class="sub">{SUBTITLES[sp]}</div>
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const back = async () => {
    if (isDirty(draft) && !(await confirmDialog({ title: 'Eingaben verwerfen?', confirmLabel: 'Verwerfen', destructive: true }))) return;
    draftSig.value = null;
  };

  const save = async () => {
    setSaving(true);
    try {
      const r = await submitDraft(draft);
      errorsSig.value = r.errors;
      if (r.saved) {
        draftSig.value = null;
        highlightId.value = r.saved.id;
        tab.value = 'verlauf';
        window.scrollTo(0, 0);
        showToast('Einheit gespeichert');
      } else {
        showToast('Bitte die markierten Felder prüfen.', { kind: 'error' });
        requestAnimationFrame(() => document.querySelector('.invalid, .field-error')?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
      }
    } catch (e) {
      console.error(e);
      showToast('Speichern fehlgeschlagen.', { kind: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div class="page">
      <header class="form-head">
        <button class="icon-btn" aria-label="Zurück zur Sportauswahl" onClick={back}>
          <IconChevronLeft />
        </button>
        <SportBadge sport={draft.sport} />
        <div>
          <div class="eyebrow">Neue Einheit</div>
          <h1 class="large-title" style={{ fontSize: '28px' }}>
            {SPORT_LABEL[draft.sport]}
          </h1>
        </div>
      </header>
      <SessionForm draft={draft} onChange={(d) => (draftSig.value = d)} errors={errorsSig.value} />
      <div class="save-bar">
        <button class="btn primary block" disabled={saving} onClick={save}>
          Speichern
        </button>
      </div>
    </div>
  );
}
