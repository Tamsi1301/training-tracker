import { useMemo, useState } from 'preact/hooks';
import { APP_CONFIG, APP_VERSION } from '../config';
import { backupFileName, backupToJson, createBackup, parseBackup, previewBackup, type BackupPreview } from '../lib/backup';
import { csvDateRange, importCsv, templateCsv, templateFileName, type CsvImportResult } from '../lib/csv';
import { daysBetween, fmtDate, today } from '../lib/dates';
import { pickFile, readText, shareOrDownload } from '../lib/files';
import { plural } from '../lib/format';
import { MUSKELGRUPPEN, SPORT_LABEL, type AppData, type Backup, type Halle, type Muskelgruppe, type Sport } from '../lib/types';
import { importZuordnung, isZuordnungCsv, zuordnungVorlage, type ZuordnungResult } from '../lib/zuordnung';
import { normText, sortUebungen, uebungLabel } from '../lib/uebungen';
import {
  data, deleteHalle, deleteUebung, importCsvResult, importMerge, importReplace, lastBackup, markBackup, mergeUebungen,
  updateUebung, importZuordnungResult, saveHalle, sessionsForHalle, sessionsForUebung, setTheme, theme, type Theme,
} from '../store';
import { actionSheet, confirmDialog, Field, Row, Segmented, Sheet, showToast, Switch, useSheet } from '../ui/components';
import {
  IconDownload, IconInfo, IconKraft, IconMerge, IconPin, IconPlus, IconShield, IconTable, IconUpload, SportBadge,
} from '../ui/icons';
import { GradeGrid } from '../ui/SessionForm';

type Open =
  | { kind: 'halle'; id: string | null }
  | { kind: 'uebungen' }
  | { kind: 'json'; backup: Backup; preview: BackupPreview }
  | { kind: 'csv'; result: CsvImportResult; fileName: string }
  | { kind: 'zuordnung'; result: ZuordnungResult; fileName: string }
  | { kind: 'vorlagen' }
  | null;

export function SettingsPage() {
  const [open, setOpen] = useState<Open>(null);
  const d = data.value;
  const lb = lastBackup.value;

  const exportBackup = async () => {
    const json = backupToJson(createBackup(data.value));
    const r = await shareOrDownload(backupFileName(), json, 'application/json');
    if (r === 'abgebrochen') return;
    await markBackup();
    showToast(r === 'geteilt' ? 'Sicherung erstellt' : 'Sicherung heruntergeladen');
  };

  const importFile = async (kind: 'json' | 'csv') => {
    const file = await pickFile(kind === 'json' ? '.json,application/json' : '.csv,text/csv,text/plain');
    if (!file) return;
    const text = await readText(file);
    if (kind === 'json') {
      const r = parseBackup(text);
      if (!r.ok) return showToast(r.error, { kind: 'error', ms: 4500 });
      setOpen({ kind: 'json', backup: r.backup, preview: previewBackup(r.backup) });
    } else if (isZuordnungCsv(text)) {
      setOpen({ kind: 'zuordnung', result: importZuordnung(text, data.value), fileName: file.name });
    } else {
      const result = importCsv(text, data.value);
      setOpen({ kind: 'csv', result, fileName: file.name });
    }
  };

  const backupText = lb
    ? (() => {
        const n = daysBetween(lb.slice(0, 10), today());
        return n === 0 ? 'Zuletzt heute' : n === 1 ? 'Zuletzt gestern' : `Zuletzt vor ${n} Tagen`;
      })()
    : 'Noch nie gesichert';

  return (
    <div class="page">
      <header class="page-header">
        <div>
          <div class="eyebrow">{APP_CONFIG.name}</div>
          <h1 class="large-title">Einstellungen</h1>
        </div>
      </header>

      <section>
        <h2 class="section-title">Darstellung</h2>
        <Segmented<Theme>
          label="Darstellung"
          value={theme.value}
          onChange={(t) => void setTheme(t)}
          options={[
            { value: 'auto', label: 'Automatisch' },
            { value: 'hell', label: 'Hell' },
            { value: 'dunkel', label: 'Dunkel' },
          ]}
        />
      </section>

      <section class="section">
        <h2 class="section-title">Hallen</h2>
        <div class="list">
          {[...d.hallen]
            .sort((a, b) => a.name.localeCompare(b.name, 'de'))
            .map((h) => (
              <Row
                icon={<span class="badge bouldern"><IconPin size={19} /></span>}
                title={h.name}
                sub={`Höchster Grad ${h.maxGrad} · ${plural(sessionsForHalle(h.id).length, 'Einheit', 'Einheiten')}`}
                onClick={() => setOpen({ kind: 'halle', id: h.id })}
              />
            ))}
          <Row
            class="accent"
            icon={<span class="badge gold"><IconPlus size={19} /></span>}
            title="Halle hinzufügen"
            chevron={false}
            onClick={() => setOpen({ kind: 'halle', id: null })}
          />
        </div>
      </section>

      <section class="section">
        <h2 class="section-title">Übungen</h2>
        <div class="list">
          <Row
            icon={<span class="badge kraft"><IconKraft size={20} /></span>}
            title="Übungen verwalten"
            sub="Umbenennen und zusammenführen"
            value={String(d.uebungen.length)}
            onClick={() => setOpen({ kind: 'uebungen' })}
          />
        </div>
      </section>

      <section class="section">
        <h2 class="section-title">Daten</h2>
        <div class="list">
          <Row icon={<span class="badge gold"><IconShield size={19} /></span>} title="Backup exportieren" sub={backupText} onClick={exportBackup} />
          <Row icon={<span class="badge neutral"><IconUpload size={19} /></span>} title="Backup importieren" sub="JSON-Sicherung einspielen" onClick={() => importFile('json')} />
          <Row icon={<span class="badge neutral"><IconTable size={19} /></span>} title="CSV importieren" sub="Altdaten je Sportart oder Übungen-Zuordnung" onClick={() => importFile('csv')} />
          <Row icon={<span class="badge neutral"><IconDownload size={19} /></span>} title="CSV-Vorlagen" sub="Bouldern, Kraftsport, Laufen, Zuordnung" onClick={() => setOpen({ kind: 'vorlagen' })} />
        </div>
        <p class="footnote">
          Alle Daten liegen nur auf diesem Gerät. Die installierte App vom Home-Bildschirm hat einen eigenen Speicher, getrennt von Safari.
          Exportiere regelmäßig ein Backup und sichere es in „Dateien“ oder iCloud Drive.
        </p>
      </section>

      <section class="section">
        <div class="list">
          <Row
            icon={<span class="badge neutral"><IconInfo size={19} /></span>}
            title={APP_CONFIG.name}
            sub={`Version ${APP_VERSION} · ${plural(d.sessions.length, 'Einheit', 'Einheiten')}`}
            chevron={false}
          />
        </div>
        <p class="footnote">Schrift: Jost (SIL Open Font License).</p>
      </section>

      {open?.kind === 'halle' && <HalleSheet id={open.id} onClose={() => setOpen(null)} />}
      {open?.kind === 'uebungen' && <UebungenSheet onClose={() => setOpen(null)} />}
      {open?.kind === 'json' && <JsonImportSheet backup={open.backup} preview={open.preview} onClose={() => setOpen(null)} />}
      {open?.kind === 'csv' && <CsvImportSheet result={open.result} fileName={open.fileName} onClose={() => setOpen(null)} />}
      {open?.kind === 'vorlagen' && <VorlagenSheet onClose={() => setOpen(null)} />}
      {open?.kind === 'zuordnung' && <ZuordnungImportSheet result={open.result} fileName={open.fileName} onClose={() => setOpen(null)} />}
    </div>
  );
}

// ================================================================ Halle

function HalleSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const existing = id ? data.value.hallen.find((h) => h.id === id) : undefined;
  const [name, setName] = useState(existing?.name ?? '');
  const [maxGrad, setMaxGrad] = useState(existing?.maxGrad ?? 8);
  const [err, setErr] = useState<string | null>(null);
  const linked = id ? sessionsForHalle(id).length : 0;

  const save = async (close: () => void) => {
    const n = name.trim();
    if (!n) return setErr('Bitte einen Namen eingeben.');
    if (data.value.hallen.some((h) => h.id !== id && normText(h.name) === normText(n))) return setErr('Eine Halle mit diesem Namen gibt es schon.');
    await saveHalle({ id: id ?? undefined, name: n, maxGrad });
    showToast(existing ? 'Halle gespeichert' : 'Halle angelegt');
    close();
  };

  return (
    <Sheet
      title={existing ? 'Halle' : 'Neue Halle'}
      onClose={onClose}
      left={(close) => (
        <button class="btn ghost" onClick={close}>
          Abbrechen
        </button>
      )}
      right={(close) => (
        <button class="btn ghost strong" onClick={() => save(close)}>
          Sichern
        </button>
      )}
    >
      <Field label="Name" error={err} for="h-name">
        <input id="h-name" class={`input${err ? ' invalid' : ''}`} value={name} placeholder="z. B. Kletterzentrum Nord" onInput={(e) => setName((e.target as HTMLInputElement).value)} />
      </Field>
      <Field label="Höchster Grad der Halle" hint={linked ? 'Bestehende Einheiten behalten das Hallen-Maximum, das beim Training galt.' : undefined}>
        <GradeGrid gold max={10} value={maxGrad} onChange={setMaxGrad} label="Höchster Grad der Halle" />
      </Field>
      {existing && <HalleDelete halle={existing} linked={linked} />}
    </Sheet>
  );
}

function HalleDelete({ halle, linked }: { halle: Halle; linked: number }) {
  const { close } = useSheet();
  const others = data.value.hallen.filter((h) => h.id !== halle.id);
  const remove = async () => {
    if (linked === 0) {
      if (!(await confirmDialog({ title: `„${halle.name}“ löschen?`, confirmLabel: 'Löschen', destructive: true }))) return;
      await deleteHalle(halle.id);
      showToast('Halle gelöscht');
      return close();
    }
    if (!others.length) {
      showToast(`Die Halle ist mit ${plural(linked, 'Einheit', 'Einheiten')} verknüpft und kann nicht gelöscht werden.`, { kind: 'error', ms: 4500 });
      return;
    }
    const target = await actionSheet({
      title: 'Halle ist verknüpft',
      message: `${plural(linked, 'Einheit gehört', 'Einheiten gehören')} zu „${halle.name}“. In welche Halle sollen sie verschoben werden, bevor gelöscht wird?`,
      actions: others.map((h) => ({ label: h.name, value: h.id })),
    });
    if (!target) return;
    const tName = others.find((h) => h.id === target)?.name;
    if (!(await confirmDialog({ title: `Nach „${tName}“ verschieben und „${halle.name}“ löschen?`, confirmLabel: 'Verschieben und löschen', destructive: true })))
      return;
    await deleteHalle(halle.id, target);
    showToast('Verschoben und gelöscht');
    close();
  };
  return (
    <div class="section">
      <button class="btn danger block" onClick={remove}>
        Halle löschen
      </button>
      {linked > 0 && <p class="footnote">Verknüpft mit {plural(linked, 'Einheit', 'Einheiten')}. Beim Löschen werden diese in eine andere Halle verschoben.</p>}
    </div>
  );
}

// ================================================================ Übungen

function UebungenSheet({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<string | null>(null);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of data.value.sessions) if (s.sport === 'kraft') for (const id of new Set(s.uebungen.map((e) => e.uebungId))) m.set(id, (m.get(id) ?? 0) + 1);
    return m;
  }, [data.value.sessions]);
  const list = sortUebungen(data.value.uebungen).filter((u) => !q || normText(uebungLabel(u)).includes(normText(q)));

  return (
    <Sheet title="Übungen" onClose={onClose}>
      <input class="input" type="search" placeholder="Suchen" aria-label="Übungen durchsuchen" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
      <div style={{ height: '12px' }} />
      {data.value.uebungen.length === 0 ? (
        <p class="footnote">Übungen entstehen automatisch, wenn du sie bei einer Kraft-Einheit einträgst oder Altdaten importierst.</p>
      ) : (
        <div class="list">
          {list.map((u) => (
            <Row
              title={u.name}
              sub={[u.variante ? `Variante: ${u.variante}` : '', u.muskelgruppen?.length ? u.muskelgruppen.join(', ') : 'ohne Muskelgruppe']
                .filter(Boolean)
                .join(' · ')}
              value={String(counts.get(u.id) ?? 0)}
              onClick={() => setEdit(u.id)}
            />
          ))}
          {list.length === 0 && <div class="list-row faint">Keine Treffer</div>}
        </div>
      )}
      <p class="footnote">Die Zahl rechts zeigt, in wie vielen Einheiten die Übung vorkommt. Name und Variante zusammen bilden eine Übung.</p>
      {edit && <UebungEditSheet id={edit} onClose={() => setEdit(null)} />}
    </Sheet>
  );
}

function UebungEditSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const u = data.value.uebungen.find((x) => x.id === id);
  const [name, setName] = useState(u?.name ?? '');
  const [variante, setVariante] = useState(u?.variante ?? '');
  const [gruppen, setGruppen] = useState<Muskelgruppe[]>(u?.muskelgruppen ?? []);
  const [err, setErr] = useState<string | null>(null);
  const [pickMerge, setPickMerge] = useState(false);
  const [q, setQ] = useState('');
  if (!u) return null;
  const used = sessionsForUebung(id).length;

  const doMerge = async (targetId: string, close: () => void) => {
    const target = data.value.uebungen.find((x) => x.id === targetId);
    if (!target) return;
    const ok = await confirmDialog({
      title: 'Übungen zusammenführen?',
      message: `„${uebungLabel(u)}“ wird in „${uebungLabel(target)}“ übernommen (${plural(used, 'Einheit', 'Einheiten')}). Verläufe und Bestleistungen werden danach gemeinsam ausgewertet.`,
      confirmLabel: 'Zusammenführen',
      destructive: true,
    });
    if (!ok) return;
    await mergeUebungen(u.id, target.id);
    showToast('Übungen zusammengeführt');
    close();
  };

  const save = async (close: () => void) => {
    if (!name.trim()) return setErr('Bitte einen Namen eingeben.');
    const r = await updateUebung(id, name, variante, gruppen);
    if (r.conflict) {
      await doMerge(r.conflict.id, close);
      return;
    }
    showToast('Übung gespeichert');
    close();
  };

  if (pickMerge) {
    const candidates = sortUebungen(data.value.uebungen).filter((x) => x.id !== id && (!q || normText(uebungLabel(x)).includes(normText(q))));
    return (
      <Sheet
        title="Zusammenführen mit …"
        onClose={onClose}
        left={() => (
          <button class="btn ghost" onClick={() => setPickMerge(false)}>
            Zurück
          </button>
        )}
      >
        <p class="footnote" style={{ marginTop: 0, marginBottom: '12px' }}>
          Wähle die Übung, in die „{uebungLabel(u)}“ übernommen werden soll.
        </p>
        <input class="input" type="search" placeholder="Suchen" aria-label="Zielübung suchen" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
        <div style={{ height: '12px' }} />
        <MergeList candidates={candidates} onPick={doMerge} />
      </Sheet>
    );
  }

  return (
    <Sheet
      title="Übung"
      onClose={onClose}
      left={(close) => (
        <button class="btn ghost" onClick={close}>
          Abbrechen
        </button>
      )}
      right={(close) => (
        <button class="btn ghost strong" onClick={() => save(close)}>
          Sichern
        </button>
      )}
    >
      <Field label="Name" error={err} for="u-name">
        <input id="u-name" class={`input${err ? ' invalid' : ''}`} value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
      </Field>
      <Field label="Gerät/Variante" for="u-var" hint="Leer lassen, wenn es keine Variante gibt.">
        <input id="u-var" class="input" value={variante} placeholder="optional" onInput={(e) => setVariante((e.target as HTMLInputElement).value)} />
      </Field>
      <Field label="Muskelgruppen" hint="Mehrfachauswahl. Daraus wird der Fokus der Einheiten abgeleitet, sofern er nicht von Hand gewählt wurde.">
        <div class="chips">
          {MUSKELGRUPPEN.map((m) => (
            <button
              type="button"
              class="chip"
              aria-pressed={gruppen.includes(m)}
              onClick={() => setGruppen(gruppen.includes(m) ? gruppen.filter((x) => x !== m) : [...gruppen, m])}
            >
              {m}
            </button>
          ))}
        </div>
      </Field>
      <p class="footnote">Verwendet in {plural(used, 'Einheit', 'Einheiten')}. Gibt es Name und Variante schon, bietet die App das Zusammenführen an.</p>
      <div class="section stack">
        <button class="btn secondary block" onClick={() => setPickMerge(true)} disabled={data.value.uebungen.length < 2}>
          <IconMerge size={19} /> Mit anderer Übung zusammenführen
        </button>
        {used === 0 && <UebungDelete id={id} />}
      </div>
    </Sheet>
  );
}

function MergeList({ candidates, onPick }: { candidates: AppData['uebungen']; onPick: (id: string, close: () => void) => void }) {
  const { close } = useSheet();
  return (
    <div class="list">
      {candidates.map((x) => (
        <Row title={uebungLabel(x)} onClick={() => onPick(x.id, close)} />
      ))}
      {candidates.length === 0 && <div class="list-row faint">Keine Treffer</div>}
    </div>
  );
}

function UebungDelete({ id }: { id: string }) {
  const { close } = useSheet();
  return (
    <button
      class="btn danger block"
      onClick={async () => {
        if (!(await confirmDialog({ title: 'Übung löschen?', message: 'Sie wird in keiner Einheit verwendet.', confirmLabel: 'Löschen', destructive: true }))) return;
        await deleteUebung(id);
        showToast('Übung gelöscht');
        close();
      }}
    >
      Übung löschen
    </button>
  );
}

// ================================================================ JSON-Import

function JsonImportSheet({ backup, preview, onClose }: { backup: Backup; preview: BackupPreview; onClose: () => void }) {
  const { sessions: n } = preview;
  const current = data.value.sessions.length;
  return (
    <Sheet title="Backup importieren" onClose={onClose} left={(close) => <button class="btn ghost" onClick={close}>Abbrechen</button>}>
      <div class="card">
        <div class="eyebrow">Inhalt der Sicherung</div>
        <div class="row" style={{ alignItems: 'baseline', marginTop: '8px' }}>
          <span class="preview-num">{n}</span>
          <span class="muted">{n === 1 ? 'Einheit' : 'Einheiten'}</span>
        </div>
        <p class="muted" style={{ margin: '8px 0 0', fontSize: '15px' }}>
          {plural(preview.hallen, 'Halle', 'Hallen')} · {plural(preview.uebungen, 'Übung', 'Übungen')}
          {preview.von && (
            <>
              <br />
              {fmtDate(preview.von)} – {fmtDate(preview.bis!)}
            </>
          )}
          <br />
          Erstellt am {fmtDate(preview.exportiert.slice(0, 10))}
        </p>
      </div>
      <ImportActions backup={backup} current={current} />
    </Sheet>
  );
}

function ImportActions({ backup, current }: { backup: Backup; current: number }) {
  const { close } = useSheet();
  const merge = async () => {
    const r = await importMerge(backup);
    showToast(`${plural(r.sessions.neu, 'Einheit', 'Einheiten')} neu, ${r.sessions.aktualisiert} aktualisiert`);
    close();
  };
  const replace = async () => {
    const ok = await confirmDialog({
      title: 'Alle Daten ersetzen?',
      message: `Die ${plural(current, 'vorhandene Einheit', 'vorhandenen Einheiten')} auf diesem Gerät werden durch die Sicherung ersetzt.`,
      confirmLabel: 'Ersetzen',
      destructive: true,
    });
    if (!ok) return;
    await importReplace(backup);
    showToast('Daten ersetzt');
    close();
  };
  return (
    <div class="section stack">
      <button class="btn primary block" onClick={merge}>
        Zusammenführen
      </button>
      <p class="footnote" style={{ marginTop: '-4px' }}>
        Vorhandene Einträge bleiben erhalten. Gleiche Einträge (gleiche ID) werden erkannt; der neuere Stand gewinnt.
      </p>
      <button class="btn danger block" onClick={replace}>
        Ersetzen
      </button>
      <p class="footnote" style={{ marginTop: '-4px' }}>
        Alle Daten auf diesem Gerät werden durch die Sicherung ersetzt – ideal beim Handywechsel.
      </p>
    </div>
  );
}

// ================================================================ CSV-Import

function CsvImportSheet({ result, fileName, onClose }: { result: CsvImportResult; fileName: string; onClose: () => void }) {
  const [skip, setSkip] = useState(true);
  const [showAllU, setShowAllU] = useState(false);
  const dubs = result.dubletten.filter(Boolean).length;
  const count = result.sessions.length - (skip ? dubs : 0);
  const range = csvDateRange(result);
  const sport = result.sport;

  return (
    <Sheet title="CSV importieren" onClose={onClose} left={(close) => <button class="btn ghost" onClick={close}>Abbrechen</button>}>
      <div class="card">
        <div class="row">
          {sport && <SportBadge sport={sport} />}
          <div class="spacer" style={{ minWidth: 0 }}>
            <div class="eyebrow">{sport ? SPORT_LABEL[sport] : 'Unbekannt'}</div>
            <div class="faint" style={{ fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {fileName}
            </div>
          </div>
        </div>
        {result.sessions.length > 0 && (
          <>
            <div class="row" style={{ alignItems: 'baseline', marginTop: '14px' }}>
              <span class="preview-num">{result.sessions.length}</span>
              <span class="muted">{result.sessions.length === 1 ? 'Einheit erkannt' : 'Einheiten erkannt'}</span>
            </div>
            <p class="muted" style={{ margin: '8px 0 0', fontSize: '15px' }}>
              {plural(result.zeilenOk, 'Zeile', 'Zeilen')} gelesen
              {sport === 'kraft' && ` · ${plural(result.saetze, 'Satz', 'Sätze')}`}
              {range && (
                <>
                  <br />
                  {fmtDate(range.von)} – {fmtDate(range.bis)}
                </>
              )}
            </p>
          </>
        )}
      </div>

      {result.neueUebungen.length > 0 && (
        <div class="section">
          <h3 class="section-title">
            <span>Neue Übungen ({result.neueUebungen.length})</span>
          </h3>
          <div class="card">
            <div class="tag-list">
              {(showAllU ? result.neueUebungen : result.neueUebungen.slice(0, 24)).map((u) => (
                <span class="tag">{uebungLabel(u)}</span>
              ))}
            </div>
            {result.neueUebungen.length > 24 && (
              <button class="link" onClick={() => setShowAllU(!showAllU)}>
                {showAllU ? 'Weniger' : `Alle ${result.neueUebungen.length} anzeigen`}
              </button>
            )}
          </div>
          <p class="footnote">Werden beim Import angelegt. Doppelte Schreibweisen kannst du später unter „Übungen verwalten“ zusammenführen.</p>
        </div>
      )}

      {result.neueHallen.length > 0 && (
        <div class="section">
          <h3 class="section-title">
            <span>Neue Hallen ({result.neueHallen.length})</span>
          </h3>
          <div class="card tag-list">
            {result.neueHallen.map((h) => (
              <span class="tag">
                {h.name} · max {h.maxGrad}
              </span>
            ))}
          </div>
        </div>
      )}

      {dubs > 0 && (
        <div class="section">
          <div class="card switch-row">
            <div class="spacer">
              <div>Mögliche Dubletten überspringen</div>
              <div class="faint" style={{ fontSize: '14px' }}>
                {plural(dubs, 'Einheit scheint', 'Einheiten scheinen')} schon vorhanden zu sein
                {sport === 'kraft' ? ' (Kraft am selben Tag)' : ''}.
              </div>
            </div>
            <Switch checked={skip} onChange={setSkip} label="Dubletten überspringen" />
          </div>
        </div>
      )}

      {result.fehler.length > 0 && (
        <div class="section">
          <h3 class="section-title">
            <span style={{ color: 'var(--danger)' }}>Fehlerbericht ({result.fehler.length})</span>
          </h3>
          <div class="card">
            <div class="error-list">
              {result.fehler.map((f) => (
                <div>
                  <b>{f.zeile ? `Zeile ${f.zeile}` : 'Datei'}</b>
                  {f.problem}
                </div>
              ))}
            </div>
          </div>
          <p class="footnote">Fehlerhafte Zeilen werden übersprungen. Du kannst die Datei korrigieren und erneut importieren.</p>
        </div>
      )}

      <CsvConfirm result={result} skip={skip} count={count} />
    </Sheet>
  );
}

function CsvConfirm({ result, skip, count }: { result: CsvImportResult; skip: boolean; count: number }) {
  const { close } = useSheet();
  const [busy, setBusy] = useState(false);
  return (
    <div class="section">
      <button
        class="btn primary block"
        disabled={count === 0 || busy}
        onClick={async () => {
          setBusy(true);
          try {
            const n = await importCsvResult(result, skip);
            showToast(`${plural(n, 'Einheit', 'Einheiten')} importiert`);
            close();
          } catch (e) {
            console.error(e);
            showToast('Import fehlgeschlagen.', { kind: 'error' });
            setBusy(false);
          }
        }}
      >
        {count > 0 ? `${plural(count, 'Einheit', 'Einheiten')} importieren` : 'Nichts zu importieren'}
      </button>
    </div>
  );
}

// ================================================================ Vorlagen

function VorlagenSheet({ onClose }: { onClose: () => void }) {
  const dl = async (sport: Sport) => {
    await shareOrDownload(templateFileName(sport), templateCsv(sport), 'text/csv');
  };
  return (
    <Sheet title="CSV-Vorlagen" onClose={onClose}>
      <div class="list">
        {(['kraft', 'bouldern', 'laufen'] as Sport[]).map((sp) => (
          <Row icon={<SportBadge sport={sp} />} title={SPORT_LABEL[sp]} sub={templateFileName(sp)} value={<IconDownload size={20} />} chevron={false} onClick={() => dl(sp)} />
        ))}
      </div>
      <div class="list" style={{ marginTop: '12px' }}>
        <Row
          icon={<span class="badge kraft"><IconKraft size={20} /></span>}
          title="Übungen-Zuordnung"
          sub={data.value.uebungen.length ? `Mit deinen ${data.value.uebungen.length} Übungen zum Ergänzen` : 'uebungen_zuordnung.csv'}
          value={<IconDownload size={20} />}
          chevron={false}
          onClick={() => shareOrDownload('uebungen_zuordnung.csv', zuordnungVorlage(data.value), 'text/csv')}
        />
      </div>
      <div class="section">
        <h3 class="section-title">Format</h3>
        <div class="card" style={{ fontSize: '15px' }}>
          <p style={{ margin: '0 0 8px' }}>Trennzeichen Semikolon „;“, Datum TT.MM.JJJJ, Dezimalkomma (z. B. 12,5). UTF-8 mit oder ohne BOM. Die Kopfzeile ist optional.</p>
          <p style={{ margin: '0 0 8px' }}>
            <b style={{ fontWeight: 500 }}>Kraftsport:</b> eine Zeile pro Satz. Alle Zeilen eines Datums bilden eine Einheit. Name + Gerät/Variante ergeben die Übung.
            Ohne Satznummer, aber mit dauer_min: zeitbasierter Satz. Ohne beides: Übung ohne Sätze (Notiz wird übernommen).
          </p>
          <p style={{ margin: '0 0 8px' }}>
            <b style={{ fontWeight: 500 }}>Bouldern:</b> eine Zeile pro Einheit. Neue Hallen brauchen halle_max_grad (1–10).
          </p>
          <p style={{ margin: '0 0 8px' }}>
            <b style={{ fontWeight: 500 }}>Laufen:</b> eine Zeile pro Lauf, Dauer als h:mm:ss.
          </p>
          <p style={{ margin: 0 }}>
            <b style={{ fontWeight: 500 }}>Übungen-Zuordnung:</b> uebung;geraet_variante;anzahl_einheiten;muskelgruppe – eine Muskelgruppe je Übung
            ({MUSKELGRUPPEN.join(', ')}). anzahl_einheiten dient nur zur Kontrolle.
          </p>
        </div>
      </div>
    </Sheet>
  );
}

// ================================================================ Übungen-Zuordnung

const STATUS_LABEL: Record<ZuordnungResult['zeilen'][number]['status'], string> = {
  neu: 'neu',
  gesetzt: 'zugeordnet',
  geaendert: 'geändert',
  unveraendert: 'unverändert',
};

function ZuordnungImportSheet({ result, fileName, onClose }: { result: ZuordnungResult; fileName: string; onClose: () => void }) {
  const [showAll, setShowAll] = useState(false);
  const n = (st: string) => result.zeilen.filter((z) => z.status === st).length;
  const abweichend = result.zeilen.filter((z) => z.anzahlDatei != null && z.anzahlDatei !== z.anzahlApp);
  const aenderungen = result.neueUebungen.length + result.geaenderteUebungen.length + result.fokusEinheiten.length;
  const zeilen = showAll ? result.zeilen : result.zeilen.slice(0, 30);

  return (
    <Sheet title="Übungen-Zuordnung" onClose={onClose} left={(close) => <button class="btn ghost" onClick={close}>Abbrechen</button>}>
      <div class="card">
        <div class="row">
          <span class="badge kraft"><IconKraft size={20} /></span>
          <div class="spacer" style={{ minWidth: 0 }}>
            <div class="eyebrow">Muskelgruppen je Übung</div>
            <div class="faint" style={{ fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</div>
          </div>
        </div>
        <div class="row" style={{ alignItems: 'baseline', marginTop: '14px' }}>
          <span class="preview-num">{result.zeilen.length}</span>
          <span class="muted">{result.zeilen.length === 1 ? 'Übung erkannt' : 'Übungen erkannt'}</span>
        </div>
        <p class="muted" style={{ margin: '8px 0 0', fontSize: '15px' }}>
          {n('gesetzt')} zugeordnet · {n('geaendert')} geändert · {n('neu')} neu · {n('unveraendert')} unverändert
          <br />
          Fokus wird für {plural(result.fokusEinheiten.length, 'Kraft-Einheit', 'Kraft-Einheiten')} abgeleitet
        </p>
      </div>

      {result.zeilen.length > 0 && (
        <div class="section">
          <h3 class="section-title">
            <span>Kontrolle</span>
            <span style={{ textTransform: 'none', letterSpacing: 0 }}>Datei · App</span>
          </h3>
          <div class="list">
            {zeilen.map((z) => (
              <Row
                title={z.variante ? `${z.name} (${z.variante})` : z.name}
                sub={`${z.muskelgruppe} · ${STATUS_LABEL[z.status]}`}
                value={
                  <span style={z.anzahlDatei != null && z.anzahlDatei !== z.anzahlApp ? { color: 'var(--danger)' } : undefined}>
                    {z.anzahlDatei ?? '–'} · {z.anzahlApp}
                  </span>
                }
                chevron={false}
              />
            ))}
            {result.zeilen.length > 30 && (
              <button class="list-row accent" onClick={() => setShowAll(!showAll)}>
                <span class="main"><div class="title">{showAll ? 'Weniger anzeigen' : `Alle ${result.zeilen.length} anzeigen`}</div></span>
              </button>
            )}
          </div>
          <p class="footnote">
            Rechts: Anzahl Einheiten laut Datei · in der App. Die Zahl aus der Datei dient nur zur Kontrolle und wird nicht gespeichert.
            {abweichend.length > 0 && ` ${plural(abweichend.length, 'Übung weicht', 'Übungen weichen')} ab (rot) – z. B. wenn der Kraft-Import noch fehlt oder Dubletten übersprungen wurden.`}
          </p>
        </div>
      )}

      {result.fehler.length > 0 && (
        <div class="section">
          <h3 class="section-title">
            <span style={{ color: 'var(--danger)' }}>Fehlerbericht ({result.fehler.length})</span>
          </h3>
          <div class="card">
            <div class="error-list">
              {result.fehler.map((f) => (
                <div>
                  <b>{f.zeile ? `Zeile ${f.zeile}` : 'Datei'}</b>
                  {f.problem}
                </div>
              ))}
            </div>
          </div>
          <p class="footnote">Diese Zeilen werden übersprungen.</p>
        </div>
      )}
      <ZuordnungConfirm result={result} count={aenderungen} />
    </Sheet>
  );
}

function ZuordnungConfirm({ result, count }: { result: ZuordnungResult; count: number }) {
  const { close } = useSheet();
  const [busy, setBusy] = useState(false);
  return (
    <div class="section">
      <button
        class="btn primary block"
        disabled={count === 0 || busy}
        onClick={async () => {
          setBusy(true);
          try {
            await importZuordnungResult(result);
            showToast(`Zuordnung übernommen · Fokus für ${plural(result.fokusEinheiten.length, 'Einheit', 'Einheiten')}`);
            close();
          } catch (e) {
            console.error(e);
            showToast('Import fehlgeschlagen.', { kind: 'error' });
            setBusy(false);
          }
        }}
      >
        {count > 0 ? 'Zuordnung übernehmen' : 'Keine Änderungen'}
      </button>
    </div>
  );
}
