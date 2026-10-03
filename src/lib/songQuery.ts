const NOISE = /official|video|audio|lyric|remaster|visualizer|\bhd\b|\bhq\b|\b4k\b|\bmv\b|clip/i;

export interface SongQuery {
  artist: string;
  song: string;
}

function tidy(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function stripNoise(title: string) {
  return tidy(
    title
      .replace(/\s*[([].*?[)\]]/g, (chunk) => (NOISE.test(chunk) ? '' : chunk))
      .replace(/\s+[-–—|]\s+official\b.*$/i, ''),
  );
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

  const parts = cleanedTitle.split(/\s+[-–—]\s+/);
  if (parts.length >= 2) {
    const titleArtist = parts[0];
    const song = parts.slice(1).join(' - ');
    push(titleArtist, song);
    push(channel, song);
    push('', song);
  }

  push(channel, cleanedTitle);
  push('', cleanedTitle);
  return queries.length > 0 ? queries : [{ artist: channel, song: tidy(title) }];
}

export function practiceQuery(title: string, artist: string): SongQuery {
  return practiceQueries(title, artist)[0] ?? { artist: tidy(artist), song: tidy(title) };
}
