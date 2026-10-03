import { writeFileSync } from 'node:fs';
import { lookupSong } from '../src/lib/getsongbpm';
import { fetchLyrics } from '../src/lib/lyrics';
import { songs } from './songs';

interface Row {
  artist: string;
  title: string;
  videoId: string;
  youtubeTitle: string;
  youtubeAuthor: string;
  videoSeconds: number;
  lyrics: 'found' | 'missing' | 'failed';
  source: string;
  syncedFile: boolean;
  matchesVideo: boolean;
  lyricSeconds: number;
  album: string;
  suggestion: string;
  tempo: 'found' | 'missing' | 'failed' | 'no-key' | 'invalid-key';
  bpm: number;
  keyName: string;
}

const userAgent = 'Mozilla/5.0 (compatible; LoopmasterCatalogCheck/1.0)';

async function mapPool<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await task(items[index]);
    }
  }
  await Promise.all(Array.from({ length: limit }, () => worker()));
  return results;
}

async function text(url: string) {
  const response = await fetch(url, { headers: { 'user-agent': userAgent } });
  if (!response.ok) throw new Error(String(response.status));
  return response.text();
}

async function officialVideo(artist: string, title: string) {
  const search = await text(
    `https://www.youtube.com/results?search_query=${encodeURIComponent(`${artist} ${title} official video`)}`,
  );
  const videoId = search.match(/"videoId":"([A-Za-z0-9_-]{11})"/)?.[1];
  if (!videoId) return null;
  const [watch, oembed] = await Promise.all([
    text(`https://www.youtube.com/watch?v=${videoId}`),
    fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`).then(
      (response) => response.json() as Promise<{ title?: string; author_name?: string }>,
    ),
  ]);
  const videoSeconds = Number(watch.match(/lengthSeconds":"(\d+)"/)?.[1] ?? 0);
  return {
    videoId,
    videoSeconds,
    youtubeTitle: oembed.title ?? '',
    youtubeAuthor: oembed.author_name ?? '',
  };
}

async function check(song: { artist: string; title: string }, apiKey: string): Promise<Row> {
  const base: Row = {
    artist: song.artist,
    title: song.title,
    videoId: '',
    youtubeTitle: '',
    youtubeAuthor: '',
    videoSeconds: 0,
    lyrics: 'failed',
    source: '',
    syncedFile: false,
    matchesVideo: false,
    lyricSeconds: 0,
    album: '',
    suggestion: '',
    tempo: apiKey ? 'failed' : 'no-key',
    bpm: 0,
    keyName: '',
  };

  try {
    const video = await officialVideo(song.artist, song.title).catch(() => null);
    if (video) Object.assign(base, video);
    const lyrics = await fetchLyrics(
      base.youtubeTitle || `${song.artist} - ${song.title} (Official Video)`,
      base.youtubeAuthor || `${song.artist.replace(/\s+/g, '')}VEVO`,
      base.videoSeconds,
    );
    if (lyrics.status === 'found') {
      base.lyrics = 'found';
      base.source = lyrics.lyrics.source;
      base.syncedFile = lyrics.lyrics.synced;
      base.matchesVideo = lyrics.lyrics.matchesVideo;
      base.lyricSeconds = Math.round(lyrics.lyrics.duration);
      base.album = lyrics.lyrics.albumName;
      if (lyrics.lyrics.synced && !lyrics.lyrics.matchesVideo) {
        base.suggestion = `${lyrics.lyrics.albumName || 'another recording'} (${base.lyricSeconds}s)`;
      }
    } else {
      base.lyrics = lyrics.status === 'empty' ? 'missing' : 'failed';
    }
  } catch {
    base.lyrics = 'failed';
  }

  if (apiKey) {
    try {
      const tempo = await lookupSong(apiKey, base.youtubeTitle || song.title, base.youtubeAuthor || song.artist);
      base.tempo = tempo.status === 'found' ? 'found' : tempo.status === 'invalid-key' ? 'invalid-key' : tempo.status === 'empty' ? 'missing' : 'failed';
      if (tempo.status === 'found') {
        base.bpm = tempo.match.bpm;
        base.keyName = tempo.match.keyName;
      }
    } catch {
      base.tempo = 'failed';
    }
  }

  return base;
}

const apiKey = process.env.GETSONGBPM_API_KEY?.trim() ?? '';
const started = Date.now();
const rows = await mapPool(songs, 4, (song) => check(song, apiKey));
const lyricsFound = rows.filter((row) => row.lyrics === 'found');
const syncedToVideo = rows.filter((row) => row.matchesVideo);
const otherVersion = rows.filter((row) => row.syncedFile && !row.matchesVideo && row.suggestion);
const tempoFound = rows.filter((row) => row.tempo === 'found');

const summary = {
  songs: rows.length,
  lyricsFound: lyricsFound.length,
  syncedToThisVideo: syncedToVideo.length,
  syncedToAnotherRecording: otherVersion.length,
  lyricsMissing: rows.filter((row) => row.lyrics === 'missing').length,
  lyricsFailed: rows.filter((row) => row.lyrics === 'failed').length,
  tempoFound: tempoFound.length,
  tempoStatus: apiKey ? 'checked' : 'skipped, no GETSONGBPM_API_KEY',
  seconds: Math.round((Date.now() - started) / 1000),
};

writeFileSync(new URL('./catalog-report.json', import.meta.url), JSON.stringify({ summary, rows }, null, 2));
console.log(JSON.stringify(summary, null, 2));
console.log('\nNot synced to the YouTube video that search returned:');
for (const row of otherVersion.slice(0, 15)) {
  console.log(`- ${row.artist} — ${row.title}: video ${row.videoSeconds}s, lyrics ${row.suggestion} [${row.videoId}]`);
}
console.log('\nNo lyrics:');
for (const row of rows.filter((item) => item.lyrics !== 'found').slice(0, 15)) {
  console.log(`- ${row.artist} — ${row.title} (${row.lyrics})`);
}
