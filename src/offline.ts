/**
 * Offline support: service worker registration (with a "new version" prompt), connection status
 * and downloads. Uploads live in IndexedDB, so they play offline once the app shell is cached;
 * streamed audio files are saved to Cache Storage when downloaded.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { t } from './i18n';

export const AUDIO_CACHE = 'asf-audio-v1';
export const MEDIA_CACHE = 'asf-media-v1';

// --- service worker ----------------------------------------------------------------------------

type SwStatus = 'unsupported' | 'dev' | 'installing' | 'ready' | 'error';
let swStatus: SwStatus = 'serviceWorker' in navigator ? (import.meta.env.PROD ? 'installing' : 'dev') : 'unsupported';
let waiting: ServiceWorker | null = null;
const swListeners = new Set<() => void>();
const swEmit = () => swListeners.forEach((l) => l());

export function registerServiceWorker() {
  if (swStatus !== 'installing') return;
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      const track = (w: ServiceWorker | null) => {
        w?.addEventListener('statechange', () => {
          // A new worker installed while an old one controls the page = an update is ready.
          if (w.state === 'installed' && navigator.serviceWorker.controller) {
            waiting = w;
            swEmit();
          }
        });
      };
      if (reg.waiting && navigator.serviceWorker.controller) waiting = reg.waiting;
      track(reg.installing);
      reg.addEventListener('updatefound', () => track(reg.installing));
      await navigator.serviceWorker.ready;
      swStatus = 'ready';
      swEmit();
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloading || !waiting) return;
        reloading = true;
        window.location.reload();
      });
      // Check for a new deploy now and then (the browser also checks on navigation).
      setInterval(() => void reg.update().catch(() => undefined), 60 * 60_000);
    } catch {
      swStatus = 'error';
      swEmit();
    }
  });
}

export function useServiceWorker(): { status: SwStatus; updateReady: boolean; applyUpdate: () => void } {
  const snap = useSyncExternalStore(
    (l) => (swListeners.add(l), () => swListeners.delete(l)),
    () => `${swStatus}|${!!waiting}`,
  );
  const [status, ready] = snap.split('|');
  return { status: status as SwStatus, updateReady: ready === 'true', applyUpdate: () => waiting?.postMessage({ type: 'SKIP_WAITING' }) };
}

// --- connection ------------------------------------------------------------------------------------

export function useOnline(): boolean {
  return useSyncExternalStore(
    (l) => {
      window.addEventListener('online', l);
      window.addEventListener('offline', l);
      return () => {
        window.removeEventListener('online', l);
        window.removeEventListener('offline', l);
      };
    },
    () => navigator.onLine,
  );
}

// --- downloads -------------------------------------------------------------------------------------

/** Audio that has to come over the network (not synthesized, not a local blob). */
export function isStreamed(url: string | undefined): url is string {
  return !!url && !/^(blob|data):/.test(url);
}

const hasCaches = () => typeof caches !== 'undefined';

export async function isCached(url: string): Promise<boolean> {
  if (!hasCaches()) return false;
  return !!(await (await caches.open(AUDIO_CACHE)).match(url));
}

/** Save audio files (and their artwork) for offline use. Reports progress per file. */
export async function saveForOffline(audio: string[], images: string[], onProgress?: (done: number, total: number) => void) {
  if (!hasCaches()) throw new Error(t('pages.offline.unavailable'));
  const audioCache = await caches.open(AUDIO_CACHE);
  const media = await caches.open(MEDIA_CACHE);
  let done = 0;
  onProgress?.(0, audio.length);
  for (const url of audio) {
    if (!(await audioCache.match(url))) {
      const res = await fetch(url);
      if (!res.ok) throw new Error(t('pages.offline.failedStatus', { status: res.status }));
      await audioCache.put(url, res);
    }
    onProgress?.(++done, audio.length);
  }
  await Promise.all(images.filter((u) => !/^(blob|data):/.test(u)).map((u) => media.add(u).catch(() => undefined)));
}

export async function removeFromOffline(audio: string[]) {
  if (!hasCaches()) return;
  const c = await caches.open(AUDIO_CACHE);
  await Promise.all(audio.map((u) => c.delete(u)));
  audio.forEach((u) => {
    const local = localUrls.get(u);
    if (local) URL.revokeObjectURL(local);
    localUrls.delete(u);
  });
}

export async function clearOffline() {
  if (!hasCaches()) return;
  await caches.delete(AUDIO_CACHE);
  await caches.delete(MEDIA_CACHE);
  localUrls.forEach((u) => URL.revokeObjectURL(u));
  localUrls.clear();
}

const localUrls = new Map<string, string>();

/** For the player: play a downloaded copy when there is one (works with no connection). */
export async function resolveAudioUrl(url: string): Promise<string> {
  if (!isStreamed(url) || !hasCaches()) return url;
  const known = localUrls.get(url);
  if (known) return known;
  const hit = await (await caches.open(AUDIO_CACHE)).match(url);
  if (!hit) return url;
  const local = URL.createObjectURL(await hit.blob());
  localUrls.set(url, local);
  return local;
}

export interface StorageInfo {
  usage: number;
  quota: number;
  persisted: boolean;
}

export function useStorageInfo(deps: unknown[] = []): [StorageInfo | null, () => void] {
  const [info, setInfo] = useState<StorageInfo | null>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    let live = true;
    (async () => {
      if (!navigator.storage?.estimate) return;
      const est = await navigator.storage.estimate();
      const persisted = (await navigator.storage.persisted?.()) ?? false;
      if (live) setInfo({ usage: est.usage ?? 0, quota: est.quota ?? 0, persisted });
    })();
    return () => {
      live = false;
    };
  }, [n, ...deps]);
  return [info, () => setN((x) => x + 1)];
}

export async function requestPersistence(): Promise<boolean> {
  return (await navigator.storage?.persist?.()) ?? false;
}
