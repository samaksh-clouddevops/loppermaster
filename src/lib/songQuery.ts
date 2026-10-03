const NOISE = /official|video|audio|lyric|remaster|visualizer|\bhd\b|\bhq\b|\b4k\b|\bmv\b|clip/i;

export function practiceQuery(title: string, artist: string) {
  let song = title.replace(/\s*[([].*?[)\]]/g, (chunk) => (NOISE.test(chunk) ? '' : chunk));
  song = song.replace(/\s+[-–—|]\s+official\b.*$/i, '');
  song = song.replace(/\s+/g, ' ').trim();

  const cleanedArtist = artist.replace(/\s+/g, ' ').trim();
  if (cleanedArtist && song.toLowerCase().startsWith(cleanedArtist.toLowerCase())) {
    song = song.slice(cleanedArtist.length).replace(/^[\s\-–—:]+/, '').trim();
  }

  return {
    artist: cleanedArtist,
    song: song || title.trim(),
  };
}
