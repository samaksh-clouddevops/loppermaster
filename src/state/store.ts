import { formatTime } from '../lib/time';
import { canonicalWatchUrl, parseYouTubeId } from '../lib/youtube';
import {
  loadHistory,
  loadPreferences,
  loadSavedLoops,
  saveHistory,
  savePreferences,
  saveSavedLoops,
} from '../lib/storage';
import { MAX_RATE, MIN_LOOP_GAP, MIN_RATE, clamp, nearestRate, orderLoop, roundRate } from '../lib/range';
import type { HistoryEntry, LoadOptions, PracticeState, SavedLoop, VideoMetadata, View } from '../types';

export interface PlaybackEngine {
  seek: (seconds: number) => void;
  play: () => void;
  pause: () => void;
  setRate: (rate: number) => void;
  setVolume: (volume: number) => void;
  mute: () => void;
  unmute: () => void;
}

type Listener = () => void;

function readNumber(value: string | null): number | null {
  if (value == null || value.trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function readInitial(): PracticeState {
  const params = new URLSearchParams(window.location.search);
  const requestedId = params.get('v');
  const videoId = requestedId && /^[\w-]{11}$/.test(requestedId) ? requestedId : null;
  const start = Math.max(0, readNumber(params.get('a')) ?? 0);
  const endRaw = readNumber(params.get('b'));
  const end = endRaw != null && endRaw > start + MIN_LOOP_GAP ? endRaw : 0;
  const rateRaw = readNumber(params.get('r'));
  const playbackRate = clamp(roundRate(rateRaw ?? 1), MIN_RATE, MAX_RATE);
  const preferences = loadPreferences();

  return {
    view: 'practice',
    settingsOpen: false,
    inputValue: videoId ? canonicalWatchUrl(videoId) : '',
    inputError: null,
    videoId,
    videoTitle: '',
    author: '',
    thumbnailUrl: '',
    duration: 0,
    currentTime: start,
    isPlaying: false,
    playbackRate,
    appliedRate: playbackRate,
    fineRateSupported: null,
    availableRates: [],
    rateNotice: null,
    volume: preferences.volume,
    muted: preferences.muted,
    loopEnabled: params.get('loop') === '1' && end > start,
    loopStart: start,
    loopEnd: end,
    status: videoId ? 'loading' : 'idle',
    playerError: null,
    loadToken: videoId ? 1 : 0,
    savedLoops: loadSavedLoops(),
    history: loadHistory(),
  };
}

function createStore(initial: PracticeState) {
  let state = initial;
  const listeners = new Set<Listener>();
  const timeListeners = new Set<Listener>();

  return {
    isScrubbing: false,
    ignorePollUntil: 0,
    getState: () => state,
    set(partial: Partial<PracticeState>) {
      state = { ...state, ...partial };
      listeners.forEach((listener) => listener());
    },
    setTime(currentTime: number) {
      if (Math.abs(state.currentTime - currentTime) < 0.001) return;
      state = { ...state, currentTime };
      timeListeners.forEach((listener) => listener());
    },
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    subscribeTime(listener: Listener) {
      timeListeners.add(listener);
      return () => {
        timeListeners.delete(listener);
      };
    },
  };
}

export const store = createStore(readInitial());

let engine: PlaybackEngine | null = null;
let focusTarget: View | null = null;
let lastScrubSeek = 0;

export function bindEngine(next: PlaybackEngine | null) {
  engine = next;
}

export function getEngine() {
  return engine;
}

function syncUrl() {
  const state = store.getState();
  if (!state.videoId) return;
  const params = new URLSearchParams();
  params.set('v', state.videoId);
  params.set('a', state.loopStart.toFixed(1));
  params.set('b', state.loopEnd.toFixed(1));
  params.set('r', state.playbackRate.toFixed(2));
  if (state.loopEnabled) params.set('loop', '1');
  const next = `${window.location.pathname}?${params.toString()}`;
  const current = `${window.location.pathname}${window.location.search}`;
  if (next !== current) window.history.replaceState(null, '', next);
}

function rememberPreferences() {
  const state = store.getState();
  savePreferences({ volume: state.volume, muted: state.muted });
}

function commitRate(rate: number) {
  const state = store.getState();
  let next = clamp(roundRate(rate), MIN_RATE, MAX_RATE);
  if (state.fineRateSupported === false && state.availableRates.length > 0) {
    next = nearestRate(next, state.availableRates);
  }
  store.set({ playbackRate: next, appliedRate: next, rateNotice: state.fineRateSupported === false ? state.rateNotice : null });
  syncUrl();
  engine?.setRate(next);
}

export function setInputValue(inputValue: string) {
  store.set({ inputValue, inputError: null });
}

export function setView(view: View) {
  focusTarget = view;
  store.set({ view, settingsOpen: false });
}

export function takeViewFocus(view: View) {
  if (focusTarget !== view) return false;
  focusTarget = null;
  return true;
}

export function submitUrl(raw = store.getState().inputValue) {
  const videoId = parseYouTubeId(raw);
  if (!videoId) {
    store.set({ inputError: 'Please enter a valid YouTube URL.' });
    return;
  }
  loadVideo(videoId, { force: true });
}

export function openSettings() {
  store.set({ settingsOpen: true });
}

export function closeSettings() {
  store.set({ settingsOpen: false });
}

export function loadVideo(videoId: string, options: LoadOptions = {}) {
  const state = store.getState();
  const sameReady = state.videoId === videoId && state.status === 'ready' && !options.force;
  if (sameReady) {
    const rate = options.rate ?? state.playbackRate;
    const loopStart = options.start ?? state.loopStart;
    const loopEnd = options.end ?? state.loopEnd;
    store.set({
      view: 'practice',
      loopStart,
      loopEnd,
      loopEnabled: options.loop ?? true,
      playbackRate: rate,
      appliedRate: rate,
      inputError: null,
      playerError: null,
    });
    engine?.setRate(rate);
    if (options.start != null) seekTo(options.start);
    if (options.autoplay !== false) {
      engine?.play();
      store.set({ isPlaying: true });
    }
    syncUrl();
    return;
  }

  const playbackRate = clamp(roundRate(options.rate ?? state.playbackRate), MIN_RATE, MAX_RATE);
  store.set({
    view: 'practice',
    videoId,
    inputValue: canonicalWatchUrl(videoId),
    inputError: null,
    playerError: null,
    videoTitle: options.title ?? '',
    author: options.author ?? '',
    thumbnailUrl: options.thumbnailUrl ?? '',
    duration: 0,
    currentTime: options.start ?? 0,
    loopStart: options.start ?? 0,
    loopEnd: options.end ?? 0,
    loopEnabled: options.loop ?? false,
    playbackRate,
    appliedRate: playbackRate,
    fineRateSupported: null,
    availableRates: [],
    rateNotice: null,
    isPlaying: false,
    status: 'loading',
    loadToken: state.loadToken + 1,
  });
  document.title = 'Loading — Loopmaster';
  syncUrl();
}

export function retryVideo() {
  const state = store.getState();
  if (!state.videoId) return;
  loadVideo(state.videoId, {
    force: true,
    start: state.loopStart,
    end: state.loopEnd,
    rate: state.playbackRate,
    loop: state.loopEnabled,
    title: state.videoTitle,
    author: state.author,
    thumbnailUrl: state.thumbnailUrl,
  });
}

export function applyMetadata(videoId: string, metadata: VideoMetadata) {
  const state = store.getState();
  if (state.videoId !== videoId) return;
  const videoTitle = metadata.title || state.videoTitle;
  const author = metadata.author || state.author;
  const thumbnailUrl = metadata.thumbnailUrl || state.thumbnailUrl;
  const history = state.history.map((entry) =>
    entry.videoId === videoId
      ? { ...entry, videoTitle: videoTitle || entry.videoTitle, author, thumbnailUrl }
      : entry,
  );
  store.set({ videoTitle, author, thumbnailUrl, history });
  if (videoTitle) document.title = `${videoTitle} — Loopmaster`;
  if (history !== state.history) saveHistory(history);
}

export function markReady(info: {
  title: string;
  author: string;
  duration: number;
  availableRates: number[];
}) {
  const state = store.getState();
  const duration = info.duration || state.duration;
  const videoTitle = info.title || state.videoTitle || 'Untitled video';
  const author = info.author || state.author;
  const ordered = orderLoop(state.loopStart, state.loopEnd > 0 ? state.loopEnd : duration, duration);
  const entry: HistoryEntry = {
    videoId: state.videoId || '',
    videoTitle,
    author,
    thumbnailUrl: state.thumbnailUrl,
    lastOpenedAt: Date.now(),
  };
  const history = [
    entry,
    ...state.history.filter((item) => item.videoId !== entry.videoId),
  ].slice(0, 12);

  store.set({
    status: 'ready',
    playerError: null,
    videoTitle,
    author,
    duration,
    loopStart: ordered.loopStart,
    loopEnd: ordered.loopEnd,
    availableRates: info.availableRates,
    history,
  });
  saveHistory(history);
  document.title = `${videoTitle} — Loopmaster`;
  syncUrl();
}

export function noteDuration(duration: number) {
  const state = store.getState();
  if (duration <= 0 || Math.abs(state.duration - duration) < 0.25) return;
  const ordered = orderLoop(state.loopStart, state.loopEnd > 0 ? Math.min(state.loopEnd, duration) : duration, duration);
  store.set({ duration, loopStart: ordered.loopStart, loopEnd: ordered.loopEnd });
  syncUrl();
}

export function markError(playerError: string) {
  store.set({ status: 'error', playerError, isPlaying: false });
  document.title = 'Loopmaster';
}

export function togglePlay() {
  const state = store.getState();
  if (state.status !== 'ready' || !engine) return;
  if (state.isPlaying) {
    engine.pause();
    store.set({ isPlaying: false });
    return;
  }
  engine.play();
  store.set({ isPlaying: true });
}

export function seekTo(time: number) {
  const state = store.getState();
  const limit = state.duration > 0 ? state.duration : Math.max(time, 0);
  const next = clamp(time, 0, limit);
  store.isScrubbing = false;
  store.ignorePollUntil = performance.now() + 450;
  store.setTime(next);
  engine?.seek(next);
}

export function scrubTo(time: number, commit = false) {
  const state = store.getState();
  const limit = state.duration > 0 ? state.duration : Math.max(time, 0);
  const next = clamp(time, 0, limit);
  store.isScrubbing = !commit;
  store.setTime(next);
  const now = performance.now();
  if (commit || now - lastScrubSeek > 90) {
    lastScrubSeek = now;
    engine?.seek(next);
  }
  if (commit) {
    store.isScrubbing = false;
    store.ignorePollUntil = performance.now() + 450;
  }
}

export function seekBy(delta: number) {
  seekTo(store.getState().currentTime + delta);
}

export function setPlaybackRate(rate: number) {
  if (store.getState().status !== 'ready' && !store.getState().videoId) {
    store.set({ playbackRate: clamp(roundRate(rate), MIN_RATE, MAX_RATE) });
    return;
  }
  commitRate(rate);
}

export function nudgeRate(direction: -1 | 1) {
  const state = store.getState();
  if (state.fineRateSupported === false && state.availableRates.length > 0) {
    const sorted = [...state.availableRates].sort((a, b) => a - b);
    const index = sorted.findIndex((rate) => Math.abs(rate - state.playbackRate) < 0.02);
    const current = index >= 0 ? index : 0;
    const nextIndex = clamp(current + direction, 0, sorted.length - 1);
    commitRate(sorted[nextIndex] ?? state.playbackRate);
    return;
  }
  commitRate(state.playbackRate + direction * 0.05);
}

export function reportAppliedRate(requested: number, applied: number) {
  const state = store.getState();
  if (Math.abs(state.playbackRate - requested) > 0.03) return;
  if (!Number.isFinite(applied) || applied <= 0) return;

  if (Math.abs(applied - requested) <= 0.03) {
    const matchesPreset = state.availableRates.some((rate) => Math.abs(rate - requested) < 0.02);
    store.set({
      appliedRate: applied,
      rateNotice: null,
      fineRateSupported: matchesPreset ? state.fineRateSupported : true,
    });
    return;
  }

  const available = state.availableRates.length > 0 ? state.availableRates : [applied];
  const snapped = nearestRate(applied, available);
  store.set({
    fineRateSupported: false,
    playbackRate: snapped,
    appliedRate: snapped,
    rateNotice: 'This video uses fixed speeds, so the closest available rate is selected.',
  });
  syncUrl();
}

export function setVolume(volume: number) {
  const next = clamp(Math.round(volume), 0, 100);
  const muted = next === 0;
  store.set({ volume: next, muted });
  engine?.setVolume(next);
  if (muted) engine?.mute();
  else engine?.unmute();
  rememberPreferences();
}

export function toggleMute() {
  const state = store.getState();
  const muted = !state.muted;
  if (muted) {
    store.set({ muted: true });
    engine?.mute();
  } else {
    const volume = state.volume === 0 ? 80 : state.volume;
    store.set({ muted: false, volume });
    engine?.unmute();
    engine?.setVolume(volume);
  }
  rememberPreferences();
}

export function setLoopBound(edge: 'start' | 'end', value: number, commit = false) {
  const state = store.getState();
  const duration = state.duration || Math.max(state.loopEnd, value, MIN_LOOP_GAP);
  let start = state.loopStart;
  let end = state.loopEnd > 0 ? state.loopEnd : duration;
  if (edge === 'start') start = value;
  else end = value;
  start = clamp(start, 0, duration);
  end = clamp(end, 0, duration);
  if (edge === 'start' && end - start < MIN_LOOP_GAP) start = Math.max(0, end - MIN_LOOP_GAP);
  if (edge === 'end' && end - start < MIN_LOOP_GAP) end = Math.min(duration, start + MIN_LOOP_GAP);
  store.set({ loopStart: start, loopEnd: end });
  if (commit) syncUrl();
}

export function setLoopAtPlayhead(edge: 'a' | 'b') {
  const state = store.getState();
  if (state.status !== 'ready') return;
  const ordered =
    edge === 'a'
      ? orderLoop(state.currentTime, state.loopEnd || state.duration, state.duration)
      : orderLoop(state.loopStart, state.currentTime, state.duration);
  store.set(ordered);
  syncUrl();
}

export function resetLoop() {
  const state = store.getState();
  store.set({
    loopStart: 0,
    loopEnd: state.duration,
    loopEnabled: false,
  });
  syncUrl();
}

export function toggleLoop() {
  const state = store.getState();
  if (state.status !== 'ready') return;
  const loopEnabled = !state.loopEnabled;
  store.set({ loopEnabled });
  if (loopEnabled && state.currentTime >= state.loopEnd) seekTo(state.loopStart);
  syncUrl();
}

export function playLoop() {
  const state = store.getState();
  if (state.status !== 'ready') return;
  store.set({ loopEnabled: true, isPlaying: true });
  seekTo(state.loopStart);
  engine?.play();
  syncUrl();
}

export function saveCurrentLoop() {
  const state = store.getState();
  if (!state.videoId || state.status !== 'ready') return null;
  const title = state.videoTitle || 'Practice loop';
  const loop: SavedLoop = {
    id: crypto.randomUUID(),
    name: `${title} · ${formatTime(state.loopStart, true)}–${formatTime(state.loopEnd, true)}`,
    videoId: state.videoId,
    videoTitle: state.videoTitle || 'Untitled video',
    author: state.author,
    thumbnailUrl: state.thumbnailUrl,
    loopStart: state.loopStart,
    loopEnd: state.loopEnd,
    playbackRate: state.playbackRate,
    createdAt: Date.now(),
  };
  const savedLoops = [loop, ...state.savedLoops].slice(0, 100);
  store.set({ savedLoops });
  saveSavedLoops(savedLoops);
  return loop;
}

export function renameSavedLoop(id: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  const savedLoops = store.getState().savedLoops.map((loop) =>
    loop.id === id ? { ...loop, name: trimmed } : loop,
  );
  store.set({ savedLoops });
  saveSavedLoops(savedLoops);
}

export function deleteSavedLoop(id: string) {
  const savedLoops = store.getState().savedLoops.filter((loop) => loop.id !== id);
  store.set({ savedLoops });
  saveSavedLoops(savedLoops);
}

export function playSavedLoop(loop: SavedLoop) {
  loadVideo(loop.videoId, {
    start: loop.loopStart,
    end: loop.loopEnd,
    rate: loop.playbackRate,
    loop: true,
    autoplay: true,
    title: loop.videoTitle,
    author: loop.author,
    thumbnailUrl: loop.thumbnailUrl,
  });
}

export function clearHistory() {
  store.set({ history: [] });
  saveHistory([]);
}
