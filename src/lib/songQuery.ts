const NOISE = /official|video|audio|lyric|remaster|visualizer|\bhd\b|\bhq\b|\b4k\b|\bmv\b|clip/i;

export interface SongQuery {
  artist: string;
  song: string;
}

function tidy(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function stripNoise(title: string) {
  const phrases = [
    /\bfull\s+audio\s+songs?\b/gi,
    /\bfull\s+video\s+songs?\b/gi,
    /\baudio\s+songs?\b/gi,
    /\bvideo\s+songs?\b/gi,
    /\blyrical(?:\s+video)?\b/gi,
    /\bofficial\s+audio\b/gi,
    /\bofficial\s+video\b/gi,
    /\bfull\s+audio\b/gi,
    /\bfull\s+video\b/gi,
    /\bfull\s+songs?\b/gi,
    /\bwith\s+lyrics\b/gi,
    /\bm\/?v\b/gi,
  ];
  let value = title.replace(/\s*[([].*?[)\]]/g, (chunk) => (NOISE.test(chunk) ? '' : chunk));
  for (const phrase of phrases) value = value.replace(phrase, ' ');
  return tidy(value.replace(/\s+[-–—|]\s+official\b.*$/i, ''));
}

function cleanChannel(artist: string) {
  const withoutSuffix = artist
    .replace(/\s*[-–—]\s*topic$/i, '')
    .replace(/\s+topic$/i, '')
    .replace(/vevo$/i, '')
    .replace(/official$/i, '');
  return tidy(withoutSuffix.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'));
}

export function practiceQueries(title: string, artist: string): SongQuery[] {
  const cleanedTitle = stripNoise(title);
  const channel = cleanChannel(artist);
  const queries: SongQuery[] = [];

  const push = (nextArtist: string, nextSong: string) => {
    const song = tidy(nextSong);
    const artistName = tidy(nextArtist);
    if (!song) return;
    const key = `${artistName.toLowerCase()}|${song.toLowerCase()}`;
    if (queries.some((query) => `${query.artist.toLowerCase()}|${query.song.toLowerCase()}` === key)) return;
    queries.push({ artist: artistName, song });
  };

  const quoted = title.match(/(?:^|[\s|(])["“']([^"“'”]{1,80})["”']/);
  if (quoted?.[1]) {
    const song = tidy(quoted[1]);
    push('', song);
    push(channel, song);
  }

  const addDashSplit = (value: string) => {
    const parts = value.split(/\s+[-–—]\s+/);
    if (parts.length < 2) return;
    const titleArtist = parts[0];
    const song = parts.slice(1).join(' - ');
    push(titleArtist, song);
    push(channel, song);
    push('', song);
  };

  if (cleanedTitle.includes('|')) {
    const segments = cleanedTitle.split('|').map((segment) => tidy(segment)).filter(Boolean);
    const lead = segments[0] ?? '';
    push('', lead);
    push(channel, lead);
    for (const segment of segments.slice(1, 5)) push(segment, lead);
    addDashSplit(lead);
  } else {
    addDashSplit(cleanedTitle);
  }

  push(channel, cleanedTitle);
  push('', cleanedTitle);
  return queries.length > 0 ? queries : [{ artist: channel, song: tidy(title) }];
}

export function practiceQuery(title: string, artist: string): SongQuery {
  return practiceQueries(title, artist)[0] ?? { artist: tidy(artist), song: tidy(title) };
}
