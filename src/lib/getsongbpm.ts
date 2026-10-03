import { practiceQuery } from './songQuery';

export interface SongMatch {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  keyName: string;
  openKey: string;
  beatsPerBar: number;
  notes: string[];
  pageUrl: string;
}

export type LookupResult =
  | { status: 'found'; match: SongMatch }
  | { status: 'empty' }
  | { status: 'invalid-key' }
  | { status: 'failed' };

const PITCHES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const FLATS: Record<string, string> = { DB: 'C#', EB: 'D#', GB: 'F#', AB: 'G#', BB: 'A#' };
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];

interface RawSong {
  id?: string;
  title?: string;
  uri?: string;
  tempo?: number | string;
  time_sig?: number | string;
  key_of?: string;
  open_key?: string;
  artist?: unknown;
}

function artistName(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return artistName(value[0]);
  if (value && typeof value === 'object' && 'name' in value) return String((value as { name?: unknown }).name ?? '');
  return '';
}

function asNumber(value: unknown) {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function scaleNotes(keyName: string): string[] {
  const match = keyName.trim().match(/^([A-G])\s*([#♯b♭])?\s*(m|min|minor|maj|major)?$/i);
  if (!match || !match[3]) return [];
  const accidental = (match[2] ?? '').replace('♯', '#').replace('♭', 'b');
  const spelled = `${match[1].toUpperCase()}${accidental.toUpperCase()}`;
  const pitch = FLATS[spelled] ?? spelled;
  const root = PITCHES.indexOf(pitch as (typeof PITCHES)[number]);
  if (root < 0) return [];
  const minor = /^m/i.test(match[3]);
  const steps = minor ? MINOR : MAJOR;
  return steps.map((step) => PITCHES[(root + step) % 12]);
}

function beatsPerBar(value: unknown) {
  if (typeof value === 'string' && value.includes('/')) {
    const numerator = Number(value.split('/')[0]);
    if (numerator >= 2 && numerator <= 12) return numerator;
  }
  const number = asNumber(value);
  if (number >= 2 && number <= 12) return Math.round(number);
  return 4;
}

function pageUrl(song: RawSong) {
  if (song.uri?.startsWith('http')) return song.uri;
  if (song.uri) return `https://getsongbpm.com/${song.uri.replace(/^\//, '')}`;
  if (song.id) return `https://getsongbpm.com/song/${song.id}`;
  return 'https://getsongbpm.com/';
}

function toMatch(song: RawSong): SongMatch | null {
  const bpm = Math.round(asNumber(song.tempo));
  if (bpm < 40 || bpm > 240) return null;
  const keyName = song.key_of?.trim() || '';
  return {
    id: song.id ?? '',
    title: song.title?.trim() || 'Untitled song',
    artist: artistName(song.artist),
    bpm,
    keyName,
    openKey: song.open_key?.trim() || '',
    beatsPerBar: beatsPerBar(song.time_sig),
    notes: keyName ? scaleNotes(keyName) : [],
    pageUrl: pageUrl(song),
  };
}

function score(song: RawSong, artist: string, title: string) {
  const songArtist = artistName(song.artist).toLowerCase();
  const songTitle = (song.title ?? '').toLowerCase();
  let value = 0;
  if (artist && songArtist.includes(artist.toLowerCase())) value += 3;
  if (title && songTitle.includes(title.toLowerCase())) value += 3;
  return value;
}

export async function lookupSong(apiKey: string, videoTitle: string, videoArtist: string): Promise<LookupResult> {
  const query = practiceQuery(videoTitle, videoArtist);
  const lookup = query.artist ? `artist:${query.artist} song:${query.song}` : query.song;
  const params = new URLSearchParams({
    api_key: apiKey,
    type: query.artist ? 'both' : 'song',
    lookup,
    limit: '5',
  });

  let payload: { search?: RawSong[]; error?: string };
  try {
    const response = await fetch(`https://api.getsong.co/search/?${params.toString()}`);
    payload = (await response.json()) as { search?: RawSong[]; error?: string };
  } catch {
    return { status: 'failed' };
  }

  if (payload.error?.toLowerCase().includes('api key')) return { status: 'invalid-key' };
  const songs = Array.isArray(payload.search) ? payload.search : [];
  const ranked = songs
    .map((song) => ({ song, match: toMatch(song), rank: score(song, query.artist, query.song) }))
    .filter((item): item is { song: RawSong; match: SongMatch; rank: number } => item.match !== null)
    .sort((a, b) => b.rank - a.rank);
  const best = ranked[0]?.match;
  return best ? { status: 'found', match: best } : { status: 'empty' };
}
