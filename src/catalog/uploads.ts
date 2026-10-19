/** Uploaded audio lives in IndexedDB (blobs); track metadata lives in localStorage. */
const DB = 'asf-uploads';
const STORE = 'audio';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadAudio(id: string): Promise<Blob | null> {
  try {
    const db = await open();
    const blob = await new Promise<Blob | null>((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).get(id);
      req.onsuccess = () => resolve((req.result as Blob) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return blob;
  } catch {
    return null;
  }
}

export async function deleteAudio(id: string): Promise<void> {
  try {
    const db = await open();
    db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id);
    db.close();
  } catch {
    /* ignore */
  }
}

/** Decode a file and reduce it to `n` normalized peaks for the waveform, plus its duration. */
export async function analyzeAudio(file: Blob, n = 160): Promise<{ duration: number; peaks: number[] }> {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ac = new AC();
  try {
    const buf = await ac.decodeAudioData(await file.arrayBuffer());
    const data = buf.getChannelData(0);
    const block = Math.floor(data.length / n);
    const peaks: number[] = [];
    for (let i = 0; i < n; i++) {
      let max = 0;
      for (let j = i * block; j < (i + 1) * block; j += 16) max = Math.max(max, Math.abs(data[j]));
      peaks.push(max);
    }
    const top = Math.max(...peaks, 0.01);
    return { duration: buf.duration, peaks: peaks.map((p) => Math.max(0.06, p / top)) };
  } finally {
    void ac.close();
  }
}
