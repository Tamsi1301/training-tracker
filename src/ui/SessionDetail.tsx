/** Detailansicht einer Einheit mit Bearbeiten und Löschen. */
import { useState } from 'preact/hooks';
import { fmtDate, weekdayName } from '../lib/dates';
import { fmtClock, fmtDuration, fmtNum } from '../lib/format';
import { fmtPace, paceSecPerKm } from '../lib/pace';
import { satzVolumen } from '../lib/stats';
import { SPORT_LABEL, type Session } from '../lib/types';
import { uebungLabel } from '../lib/uebungen';
import { data, deleteSession, restoreSession, uebungenById } from '../store';
import { confirmDialog, Sheet, showToast, useSheet } from './components';
import { SportBadge } from './icons';
import { draftFromSession, SessionForm, submitDraft, type Draft } from './SessionForm';
import { sessionTitle } from './sessionText';

function Stat({ k, v, unit }: { k: string; v: string; unit?: string }) {
  return (
    <div class="stat">
      <div class="k">{k}</div>
      <div class="v">
        {v}
        {unit && <small>{unit}</small>}
      </div>
    </div>
  );
}

function DetailBody({ s }: { s: Session }) {
  return (
    <>
      <div class="detail-hero">
        <SportBadge sport={s.sport} />
        <div>
          <div class="eyebrow">
            {SPORT_LABEL[s.sport]} · {weekdayName(s.datum)}
          </div>
          <div style={{ fontSize: '24px', fontWeight: 500 }}>{sessionTitle(s)}</div>
          <div class="muted" style={{ fontSize: '15px' }}>
            {fmtDate(s.datum)}
          </div>
        </div>
      </div>

      {s.sport === 'bouldern' && (
        <div class="kv">
          <Stat k="Session-Maximum" v={String(s.sessionMaxGrad)} unit={`von ${s.hallenMaxGrad}`} />
          <Stat k="Dauer" v={s.dauerSekunden ? fmtDuration(s.dauerSekunden) : '–'} />
        </div>
      )}
      {s.sport === 'laufen' && (
        <div class="kv three">
          <Stat k="Distanz" v={fmtNum(s.distanzKm)} unit="km" />
          <Stat k="Dauer" v={fmtClock(s.dauerSekunden)} />
          <Stat k="Pace" v={fmtPace(paceSecPerKm(s.distanzKm, s.dauerSekunden), false)} unit={paceSecPerKm(s.distanzKm, s.dauerSekunden) ? '/km' : undefined} />
        </div>
      )}
      {s.sport === 'kraft' && (
        <>
          <div class="kv" style={{ marginBottom: '14px' }}>
            <Stat k="Dauer" v={s.dauerSekunden ? fmtDuration(s.dauerSekunden) : '–'} />
            <Stat k="Volumen" v={fmtNum(Math.round(s.uebungen.flatMap((e) => e.saetze).reduce((a, x) => a + satzVolumen(x), 0)))} unit="kg" />
          </div>
          <div class="card">
            {s.uebungen.map((e) => (
              <div class="ex-block">
                <h4>{uebungLabel(uebungenById.value.get(e.uebungId))}</h4>
                {e.notiz && <div class="faint" style={{ fontSize: '14px' }}>{e.notiz}</div>}
                {e.saetze.length > 0 && (
                  <table class="sets-table">
                    <tbody>
                      {e.saetze.map((x, i) => (
                        <tr>
                          <td>{i + 1}</td>
                          <td>
                            {x.notiz && <span class="note">{x.notiz}</span>}
                          </td>
                          <td class="num">
                            {x.dauerSekunden && x.wiederholungen == null
                              ? fmtClock(x.dauerSekunden)
                              : `${x.wiederholungen != null ? fmtNum(x.wiederholungen) : '–'} ×`}
                          </td>
                          <td class="num" style={{ width: '112px' }}>
                            {x.gewichtKg != null ? `${fmtNum(x.gewichtKg)} kg` : x.dauerSekunden && x.wiederholungen == null ? '' : 'Körpergew.'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
          {s.fokusMuskulatur.length > 0 && (
            <p class="footnote">Fokus: {s.fokusMuskulatur.join(', ')}</p>
          )}
        </>
      )}
      {s.notizen && (
        <div class="section">
          <div class="section-title">Notizen</div>
          <div class="card" style={{ whiteSpace: 'pre-wrap' }}>
            {s.notizen}
          </div>
        </div>
      )}
    </>
  );
}

export function SessionSheet({ id, onClose, startEditing }: { id: string; onClose: () => void; startEditing?: boolean }) {
  const s = data.value.sessions.find((x) => x.id === id);
  const [draft, setDraft] = useState<Draft | null>(() => (startEditing && s ? draftFromSession(s) : null));
  const [errors, setErrors] = useState<Record<string, string>>({});
  if (!s) return null;

  const remove = async (close: () => void) => {
    const ok = await confirmDialog({
      title: 'Einheit löschen?',
      message: `${SPORT_LABEL[s.sport]} vom ${fmtDate(s.datum)}`,
      confirmLabel: 'Löschen',
      destructive: true,
    });
    if (!ok) return;
    const removed = await deleteSession(s.id);
    close();
    if (removed)
      showToast('Einheit gelöscht', {
        action: { label: 'Rückgängig', run: () => void restoreSession(removed).then(() => showToast('Wiederhergestellt')) },
      });
  };

  if (draft) {
    return (
      <Sheet
        title="Bearbeiten"
        onClose={onClose}
        left={() => (
          <button class="btn ghost" onClick={() => setDraft(null)}>
            Abbrechen
          </button>
        )}
        right={(close) => (
          <button
            class="btn ghost strong"
            onClick={async () => {
              const r = await submitDraft(draft);
              setErrors(r.errors);
              if (r.saved) {
                showToast('Änderungen gespeichert');
                setDraft(null);
                if (startEditing) close();
              } else showToast('Bitte die markierten Felder prüfen.', { kind: 'error' });
            }}
          >
            Sichern
          </button>
        )}
      >
        <SessionForm draft={draft} onChange={setDraft} errors={errors} />
      </Sheet>
    );
  }

  return (
    <Sheet
      title=""
      label={`${SPORT_LABEL[s.sport]} vom ${fmtDate(s.datum)}`}
      onClose={onClose}
      right={() => (
        <button class="btn ghost strong" onClick={() => setDraft(draftFromSession(s))}>
          Bearbeiten
        </button>
      )}
    >
      <DetailBody s={s} />
      <SheetDelete onDelete={remove} />
    </Sheet>
  );
}

function SheetDelete({ onDelete }: { onDelete: (close: () => void) => void }) {
  const { close } = useSheet();
  return (
    <div class="section">
      <button class="btn danger block" onClick={() => onDelete(close)}>
        Einheit löschen
      </button>
    </div>
  );
}
