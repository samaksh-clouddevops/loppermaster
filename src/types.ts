export type View = 'practice' | 'saved' | 'history';

export type Status = 'idle' | 'loading' | 'ready' | 'error';

export interface SavedLoop {
  id: string;
  name: string;
  videoId: string;
  videoTitle: string;
  author: string;
  thumbnailUrl: string;
  loopStart: number;
  loopEnd: number;
  playbackRate: number;
  createdAt: number;
}

export interface HistoryEntry {
  videoId: string;
  videoTitle: string;
  author: string;
  thumbnailUrl: string;
  lastOpenedAt: number;
}

export interface PracticeState {
  view: View;
  settingsOpen: boolean;
  inputValue: string;
  inputError: string | null;
  videoId: string | null;
  videoTitle: string;
  author: string;
  thumbnailUrl: string;
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  playbackRate: number;
  appliedRate: number;
  fineRateSupported: boolean | null;
  availableRates: number[];
  rateNotice: string | null;
  volume: number;
  muted: boolean;
  loopEnabled: boolean;
  loopStart: number;
  loopEnd: number;
  status: Status;
  playerError: string | null;
  loadToken: number;
  savedLoops: SavedLoop[];
  history: HistoryEntry[];
}

export interface LoadOptions {
  force?: boolean;
  start?: number;
  end?: number;
  rate?: number;
  loop?: boolean;
  autoplay?: boolean;
  title?: string;
  author?: string;
  thumbnailUrl?: string;
}

export interface VideoMetadata {
  title: string;
  author: string;
  thumbnailUrl: string;
}
