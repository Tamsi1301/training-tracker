/** Dateien teilen/herunterladen und einlesen (iOS: Teilen-Menü → „In Dateien sichern“). */

export type ShareResult = 'geteilt' | 'heruntergeladen' | 'abgebrochen';

/**
 * Muss direkt aus einer Benutzeraktion aufgerufen werden (kein await davor),
 * sonst blockiert Safari das Teilen-Menü.
 */
export async function shareOrDownload(filename: string, content: string, mime: string): Promise<ShareResult> {
  const file = new File([content], filename, { type: mime });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  const isTouch = matchMedia('(pointer: coarse)').matches;
  if (isTouch && nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: filename });
      return 'geteilt';
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return 'abgebrochen';
      // sonst: auf Download ausweichen
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'heruntergeladen';
}

export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    input.onchange = () => {
      resolve(input.files?.[0] ?? null);
      input.remove();
    };
    document.body.appendChild(input);
    input.click();
  });
}

export async function readText(file: File): Promise<string> {
  // UTF-8; BOM wird von den Parsern entfernt
  return await file.text();
}
