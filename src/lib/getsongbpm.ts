import { practiceQueries } from './songQuery';

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
  sourceName: string;
}

export type LookupResult =
  | { status: 'found'; match: SongMatch }
  | { status: 'empty' }
  | { status: 'invalid-key' }
  | { status: 'failed' };

const PITCHES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const FLATS: Record<string, string> = { DB: 'C#', EB: 'D#', GB: 'F#', AB: 'G#', BB: 'A#' };
const SHARP_TO_FLAT: Record<string, string> = { 'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb' };
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
  const minor = /^(m|min|minor)$/i.test(match[3]);
  const useFlats = (minor ? ['D', 'G', 'C', 'F', 'BB', 'EB'] : ['F', 'BB', 'EB', 'AB', 'DB', 'GB']).includes(spelled);
  const pitch = FLATS[spelled] ?? spelled;
  const root = PITCHES.indexOf(pitch as (typeof PITCHES)[number]);
  if (root < 0) return [];
  const steps = minor ? MINOR : MAJOR;
  return steps.map((step) => {
    const note = PITCHES[(root + step) % 12];
    return useFlats ? (SHARP_TO_FLAT[note] ?? note) : note;
  });
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
    sourceName: 'GetSongBPM',
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

async function searchCatalog(apiKey: string, artist: string, song: string): Promise<LookupResult> {
  const lookup = artist ? `artist:${artist} song:${song}` : song;
  const params = new URLSearchParams({
    api_key: apiKey,
    type: artist ? 'both' : 'song',
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
    .map((item) => ({ item, match: toMatch(item), rank: score(item, artist, song) }))
    .filter((entry): entry is { item: RawSong; match: SongMatch; rank: number } => entry.match !== null)
    .sort((a, b) => b.rank - a.rank);
  const best = ranked[0]?.match;
  return best ? { status: 'found', match: best } : { status: 'empty' };
}

export async function lookupSong(apiKey: string, videoTitle: string, videoArtist: string): Promise<LookupResult> {
  const queries = practiceQueries(videoTitle, videoArtist);
  let failed = false;
  for (const query of queries) {
    const result = await searchCatalog(apiKey, query.artist, query.song);
    if (result.status === 'found' || result.status === 'invalid-key') return result;
    if (result.status === 'failed') failed = true;
  }
  return failed ? { status: 'failed' } : { status: 'empty' };
}
