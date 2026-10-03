import type { HistoryEntry, SavedLoop } from '../types';

const LOOPS_KEY = 'loopmaster.loops';
const HISTORY_KEY = 'loopmaster.history';
const PREFS_KEY = 'loopmaster.preferences';
const TOUR_KEY = 'loopmaster.tourSeen';

export interface Preferences {
  volume: number;
  muted: boolean;
}

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Storage can be unavailable or full. The session still works. */
  }
}

function isSavedLoop(value: unknown): value is SavedLoop {
  if (!value || typeof value !== 'object') return false;
  const loop = value as Partial<SavedLoop>;
  return (
    typeof loop.id === 'string' &&
    typeof loop.videoId === 'string' &&
    typeof loop.name === 'string' &&
    typeof loop.loopStart === 'number' &&
    typeof loop.loopEnd === 'number' &&
    typeof loop.playbackRate === 'number'
  );
}

function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<HistoryEntry>;
  return typeof entry.videoId === 'string' && typeof entry.videoTitle === 'string';
}

export function loadSavedLoops(): SavedLoop[] {
  const value = readJson(LOOPS_KEY);
  if (!Array.isArray(value)) return [];
  return value.filter(isSavedLoop).slice(0, 100).map((loop) => ({
    ...loop,
    author: loop.author || '',
    thumbnailUrl: loop.thumbnailUrl || '',
    videoTitle: loop.videoTitle || 'Untitled video',
    createdAt: loop.createdAt || Date.now(),
  }));
}

export function saveSavedLoops(loops: SavedLoop[]) {
  writeJson(LOOPS_KEY, loops);
}

export function loadHistory(): HistoryEntry[] {
  const value = readJson(HISTORY_KEY);
  if (!Array.isArray(value)) return [];
  return value.filter(isHistoryEntry).slice(0, 12).map((entry) => ({
    videoId: entry.videoId,
    videoTitle: entry.videoTitle,
    author: entry.author || '',
    thumbnailUrl: entry.thumbnailUrl || '',
    lastOpenedAt: entry.lastOpenedAt || Date.now(),
  }));
}

export function saveHistory(history: HistoryEntry[]) {
  writeJson(HISTORY_KEY, history);
}

export function loadPreferences(): Preferences {
  const value = readJson(PREFS_KEY);
  if (!value || typeof value !== 'object') return { volume: 80, muted: false };
  const prefs = value as Partial<Preferences>;
  const volume = typeof prefs.volume === 'number' ? prefs.volume : 80;
  return {
    volume: Math.min(100, Math.max(0, Math.round(volume))),
    muted: Boolean(prefs.muted),
  };
}

export function savePreferences(preferences: Preferences) {
  writeJson(PREFS_KEY, preferences);
}

export function hasSeenTour(): boolean {
  try {
    return localStorage.getItem(TOUR_KEY) === '1';
  } catch {
    return false;
  }
}

export function markTourSeen() {
  try {
    localStorage.setItem(TOUR_KEY, '1');
  } catch {
    /* The tour can still close if storage is blocked. */
  }
}
