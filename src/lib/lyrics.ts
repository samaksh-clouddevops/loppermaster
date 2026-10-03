import { practiceQueries, type SongQuery } from './songQuery';

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
  source: string;
  sourceUrl: string;
  duration: number;
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
    value += Math.max(-12, 6 - delta / 2);
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
    source: 'LRCLIB',
    sourceUrl: item.id ? `https://lrclib.net/tracks/${item.id}` : 'https://lrclib.net/',
    duration: item.duration && item.duration > 0 ? item.duration : 0,
  };
}

async function searchLrcLib(query: SongQuery): Promise<RawLyrics[]> {
  const params = new URLSearchParams({ track_name: query.song });
  if (query.artist) params.set('artist_name', query.artist);
  const response = await fetch(`https://lrclib.net/api/search?${params.toString()}`);
  if (!response.ok) return [];
  const payload: unknown = await response.json();
  return Array.isArray(payload) ? (payload as RawLyrics[]) : [];
}

async function searchLyricsOvh(query: SongQuery): Promise<Lyrics | null> {
  if (!query.artist || !query.song) return null;
  const response = await fetch(
    `https://api.lyrics.ovh/v1/${encodeURIComponent(query.artist)}/${encodeURIComponent(query.song)}`,
  );
  if (!response.ok) return null;
  const payload = (await response.json()) as { lyrics?: string; error?: string };
  const text = payload.lyrics?.trim();
  if (!text) return null;
  const lines = parsePlain(text);
  if (lines.length === 0) return null;
  return {
    trackName: query.song,
    artistName: query.artist,
    instrumental: false,
    synced: false,
    lines,
    source: 'lyrics.ovh',
    sourceUrl: 'https://lyrics.ovh/',
    duration: 0,
  };
}

function bestFrom(results: RawLyrics[], query: SongQuery, duration: number) {
  return results
    .map((item) => ({ lyrics: toLyrics(item), rank: score(item, query.song, query.artist, duration) }))
    .filter((entry): entry is { lyrics: Lyrics; rank: number } => entry.lyrics !== null)
    .sort((a, b) => b.rank - a.rank)[0];
}

export async function fetchLyrics(videoTitle: string, videoArtist: string, duration: number): Promise<LyricsResult> {
  const queries = practiceQueries(videoTitle, videoArtist);
  let winner: { lyrics: Lyrics; rank: number } | undefined;
  let sawFailure = false;

  for (const query of queries) {
    try {
      const results = await searchLrcLib(query);
      const best = bestFrom(results, query, duration);
      if (best && (!winner || best.rank > winner.rank)) winner = best;
      if (winner && winner.rank >= 8 && durationClose(winner.lyrics.duration, duration)) {
        return { status: 'found', lyrics: winner.lyrics };
      }
    } catch {
      sawFailure = true;
    }
  }

  if (winner) return { status: 'found', lyrics: winner.lyrics };

  for (const query of queries) {
    try {
      const plain = await searchLyricsOvh(query);
      if (plain) return { status: 'found', lyrics: plain };
    } catch {
      sawFailure = true;
    }
  }

  return sawFailure ? { status: 'failed' } : { status: 'empty' };
}

export function lineAtTime(lines: LyricLine[], seconds: number, offset = 0) {
  const lookup = seconds - offset;
  let active = -1;
  for (let index = 0; index < lines.length; index += 1) {
    const time = lines[index].time;
    if (time == null) continue;
    if (time <= lookup + 0.05) active = index;
    else break;
  }
  return active;
}

function durationClose(lyricDuration: number, videoDuration: number) {
  if (lyricDuration <= 0 || videoDuration <= 0) return true;
  return Math.abs(lyricDuration - videoDuration) <= 8;
}
