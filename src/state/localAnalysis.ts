import { analyzeLocalObjectUrl, type LocalAudioAnalysis } from '../lib/audioAnalysis';

export type AnalysisStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface LocalAnalysisState {
  mediaId: string | null;
  objectUrl: string | null;
  status: AnalysisStatus;
  analysis: LocalAudioAnalysis | null;
  error: string | null;
}

type Listener = () => void;

const listeners = new Set<Listener>();
let state: LocalAnalysisState = {
  mediaId: null,
  objectUrl: null,
  status: 'idle',
  analysis: null,
  error: null,
};
let requestToken = 0;

function emit() {
  for (const listener of listeners) listener();
}

function setState(patch: Partial<LocalAnalysisState>) {
  state = { ...state, ...patch };
  emit();
}

export function getLocalAnalysisState() {
  return state;
}

export function subscribeLocalAnalysis(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function clearLocalAnalysis() {
  requestToken += 1;
  setState({ mediaId: null, objectUrl: null, status: 'idle', analysis: null, error: null });
}

export function startLocalAnalysis(mediaId: string, objectUrl: string) {
  if (!mediaId || !objectUrl) {
    clearLocalAnalysis();
    return;
  }
  if (
    state.mediaId === mediaId &&
    state.objectUrl === objectUrl &&
    (state.status === 'loading' || state.status === 'ready')
  ) {
    return;
  }

  const token = ++requestToken;
  setState({ mediaId, objectUrl, status: 'loading', analysis: null, error: null });

  void (async () => {
    try {
      const analysis = await analyzeLocalObjectUrl(objectUrl);
      if (token !== requestToken) return;
      setState({ mediaId, objectUrl, status: 'ready', analysis, error: null });
    } catch {
      if (token !== requestToken) return;
      setState({
        mediaId,
        objectUrl,
        status: 'error',
        analysis: null,
        error: 'Could not analyze this audio file.',
      });
    }
  })();
}
