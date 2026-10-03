const ID_PATTERN = /^[\w-]{11}$/;

function idFromPath(pathname: string, markers: string[]): string | null {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length < 2) return null;
  if (!markers.includes(parts[0])) return null;
  return ID_PATTERN.test(parts[1]) ? parts[1] : null;
}

export function parseYouTubeId(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  if (ID_PATTERN.test(value)) return value;

  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '');
    if (host === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0];
      return id && ID_PATTERN.test(id) ? id : null;
    }

    const youtubeHosts = new Set([
      'youtube.com',
      'music.youtube.com',
      'youtube-nocookie.com',
    ]);
    if (!youtubeHosts.has(host)) return null;

    const watchId = url.searchParams.get('v');
    if (url.pathname === '/watch' && watchId && ID_PATTERN.test(watchId)) {
      return watchId;
    }

    return idFromPath(url.pathname, ['embed', 'shorts', 'live', 'v']);
  } catch {
    return null;
  }
}

export function canonicalWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

interface YouTubePlayerOptions {
  videoId: string;
  width?: string;
  height?: string;
  host?: string;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: (event: { target: YouTubePlayer }) => void;
    onStateChange?: (event: { data: number; target: YouTubePlayer }) => void;
    onError?: (event: { data: number; target: YouTubePlayer }) => void;
  };
}

export interface YouTubePlayer {
  destroy: () => void;
  loadVideoById: (args: { videoId: string; startSeconds?: number }) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  setPlaybackRate: (rate: number) => void;
  getPlaybackRate: () => number;
  getAvailablePlaybackRates: () => number[];
  setVolume: (volume: number) => void;
  mute: () => void;
  unMute: () => void;
  getVideoData: () => { title?: string; author?: string; video_id?: string };
  getIframe: () => HTMLIFrameElement;
}

declare global {
  interface Window {
    YT?: {
      Player: new (element: HTMLElement, options: YouTubePlayerOptions) => YouTubePlayer;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;

export function loadYouTubeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };

    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => {
      apiPromise = null;
      reject(new Error('youtube-api'));
    };
    document.head.appendChild(script);
  });

  return apiPromise;
}

export function playerErrorMessage(code: number): string {
  if (code === 2 || code === 100 || code === 101 || code === 150) {
    return "This video can't be played.";
  }
  return "We couldn't load this video. Try again.";
}

export async function fetchOEmbed(videoId: string) {
  const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(
    canonicalWatchUrl(videoId),
  )}&format=json`;
  const response = await fetch(endpoint);
  if (!response.ok) return null;
  const data = (await response.json()) as {
    title?: string;
    author_name?: string;
    thumbnail_url?: string;
  };
  return {
    title: data.title?.trim() || '',
    author: data.author_name?.trim() || '',
    thumbnailUrl: data.thumbnail_url || '',
  };
}
