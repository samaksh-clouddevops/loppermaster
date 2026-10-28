const DB_NAME = 'loopmaster.localMedia';
const STORE = 'files';
const DB_VERSION = 1;

export const LOCAL_ID_PREFIX = 'local:';

export function isLocalMediaId(id: string | null | undefined): boolean {
  return Boolean(id && id.startsWith(LOCAL_ID_PREFIX));
}

export function createLocalMediaId() {
  return `${LOCAL_ID_PREFIX}${crypto.randomUUID()}`;
}

export function titleFromFileName(name: string) {
  return name.replace(/\.[^.]+$/, '').replace(/[_+]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Audio file';
}

export function isSupportedAudioFile(file: File) {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  if (type === 'audio/mpeg' || type === 'audio/mp3' || type === 'audio/wav' || type === 'audio/wave' || type === 'audio/x-wav') {
    return true;
  }
  return name.endsWith('.mp3') || name.endsWith('.wav');
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open local media storage.'));
  });
}

export async function saveLocalMedia(id: string, file: File) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(
      {
        id,
        name: file.name,
        type: file.type || (file.name.toLowerCase().endsWith('.wav') ? 'audio/wav' : 'audio/mpeg'),
        blob: file,
        savedAt: Date.now(),
      },
      id,
    );
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Could not save the audio file.'));
  });
  db.close();
}

export async function loadLocalMedia(id: string): Promise<{ name: string; type: string; blob: Blob } | null> {
  const db = await openDb();
  const record = await new Promise<{ name: string; type: string; blob: Blob } | null>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).get(id);
    request.onsuccess = () => {
      const value = request.result as { name?: string; type?: string; blob?: Blob } | undefined;
      if (!value?.blob) {
        resolve(null);
        return;
      }
      resolve({
        name: value.name || 'Audio file',
        type: value.type || value.blob.type || 'audio/mpeg',
        blob: value.blob,
      });
    };
    request.onerror = () => reject(request.error ?? new Error('Could not read the audio file.'));
  });
  db.close();
  return record;
}
