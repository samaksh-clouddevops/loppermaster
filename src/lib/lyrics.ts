import { practiceQuery } from './songQuery';

export interface LyricLine {
  time: number | null;
  text: string;
}

export interface Lyrics {
  trackName: string;
  artistName: string;
  instrumental: boolean;
  synced: boolean;
  lines: LyricLine[];
}

export type LyricsResult = { status: 'found'; lyrics: Lyrics } | { status: 'empty' } | { status: 'failed' };

interface RawLyrics {
  id?: number;
  trackName?: string;
  artistName?: string;
  duration?: number;
  instrumental?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
}

function parseSynced(value: string): LyricLine[] {
  const lines: LyricLine[] = [];
  for (const raw of value.split('\n')) {
    const match = raw.match(/^\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)$/);
    if (!match) continue;
    const text = match[3].trim();
    if (!text) continue;
    lines.push({
      time: Number(match[1]) * 60 + Number(match[2]),
      text,
    });
  }
  return lines;
}

function parsePlain(value: string): LyricLine[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text) => ({ time: null, text }));
}

function cleanArtist(name: string) {
  const parts = name.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length > 1 && parts.every((part) => part.toLowerCase() === parts[0].toLowerCase())) return parts[0];
  return name;
}

function usable(item: RawLyrics) {
  const plain = item.plainLyrics?.trim() ?? '';
  const synced = item.syncedLyrics?.trim() ?? '';
  if (plain.toLowerCase() === 'probe' || synced.toLowerCase().includes(']probe')) return false;
  return Boolean(plain || synced);
}

function score(item: RawLyrics, song: string, artist: string, duration: number) {
  const title = (item.trackName ?? '').toLowerCase();
  const name = (item.artistName ?? '').toLowerCase();
  const wantedTitle = song.toLowerCase();
  const wantedArtist = artist.toLowerCase();
  let value = 0;
  if (title === wantedTitle) value += 6;
  else if (wantedTitle && title.includes(wantedTitle)) value += 3;
  if (wantedArtist && name.includes(wantedArtist)) value += 4;
  if (duration > 0 && item.duration) {
    const delta = Math.abs(item.duration - duration);
    if (delta <= 3) value += 4;
    else if (delta <= 10) value += 1;
    else value -= 2;
  }
  if (item.syncedLyrics) value += 2;
  return value;
}

function toLyrics(item: RawLyrics): Lyrics | null {
  if (!usable(item)) return null;
  const syncedLines = item.syncedLyrics ? parseSynced(item.syncedLyrics) : [];
  const lines = syncedLines.length > 0 ? syncedLines : parsePlain(item.plainLyrics ?? '');
  if (lines.length === 0 && !item.instrumental) return null;
  return {
    trackName: item.trackName?.trim() || 'Untitled song',
    artistName: cleanArtist(item.artistName?.trim() || ''),
    instrumental: Boolean(item.instrumental),
    synced: syncedLines.length > 0,
    lines,
  };
}

export function lineAtTime(lines: LyricLine[], seconds: number) {
  let active = -1;
  for (let index = 0; index < lines.length; index += 1) {
    const time = lines[index].time;
    if (time == null) continue;
    if (time <= seconds + 0.05) active = index;
    else break;
  }
  return active;
}

export async function fetchLyrics(videoTitle: string, videoArtist: string, duration: number): Promise<LyricsResult> {
  const query = practiceQuery(videoTitle, videoArtist);
  const params = new URLSearchParams({ track_name: query.song });
  if (query.artist) params.set('artist_name', query.artist);

  let payload: unknown;
  try {
    const response = await fetch(`https://lrclib.net/api/search?${params.toString()}`);
    if (!response.ok) return response.status === 404 ? { status: 'empty' } : { status: 'failed' };
    payload = await response.json();
  } catch {
    return { status: 'failed' };
  }

  const results = Array.isArray(payload) ? (payload as RawLyrics[]) : [];
  const best = results
    .map((item) => ({ item, rank: score(item, query.song, query.artist, duration) }))
    .sort((a, b) => b.rank - a.rank)
    .map((entry) => toLyrics(entry.item))
    .find((lyrics) => lyrics !== null);

  return best ? { status: 'found', lyrics: best } : { status: 'empty' };
}
