const KEY = 'loopmaster.getsongbpmKey';

let current = readStoredKey();
const listeners = new Set<() => void>();

function readStoredKey() {
  try {
    return localStorage.getItem(KEY)?.trim() ?? '';
  } catch {
    return '';
  }
}

export function getApiKey() {
  return current;
}

export function subscribeApiKey(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setApiKey(value: string) {
  const next = value.trim();
  if (next === current) return;
  current = next;
  try {
    if (current) localStorage.setItem(KEY, current);
    else localStorage.removeItem(KEY);
  } catch {
    /* The session can still use the key until reload. */
  }
  listeners.forEach((listener) => listener());
}
