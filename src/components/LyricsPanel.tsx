import { useEffect, useRef, useState, type RefObject } from 'react';
import { fetchLyrics, lineAtTime, versionSearchUrl, type LyricLine, type LyricsResult } from '../lib/lyrics';
import { formatTime } from '../lib/time';
import { seekTo, store } from '../state/store';
import { usePracticeState } from '../state/hooks';

export function LyricsPanel() {
  const { videoId, videoTitle, author, duration, status } = usePracticeState();
  const [result, setResult] = useState<LyricsResult | { status: 'loading' } | { status: 'idle' }>({ status: 'idle' });
  const [activeIndex, setActiveIndex] = useState(-1);
  const [offset, setOffset] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const lines = result.status === 'found' ? result.lyrics.lines : [];
  const follows = result.status === 'found' && result.lyrics.matchesVideo;

  useEffect(() => {
    if (!videoId) return;
    setOffset(readLyricOffset(videoId));
  }, [videoId]);

  function changeOffset(next: number) {
    const value = clampOffset(next);
    setOffset(value);
    if (videoId) writeLyricOffset(videoId, value);
  }

  useEffect(() => {
    if (status !== 'ready' || !videoId || !videoTitle) return;
    let cancelled = false;
    setResult({ status: 'loading' });
    setActiveIndex(-1);
    fetchLyrics(videoTitle, author, duration).then((next) => {
      if (!cancelled) setResult(next);
    });
    return () => {
      cancelled = true;
    };
  }, [author, duration, status, videoId, videoTitle]);

  useEffect(() => {
    if (result.status !== 'found' || !result.lyrics.matchesVideo) return;
    const lyricLines = result.lyrics.lines;
    const update = () => {
      const next = lineAtTime(lyricLines, store.getState().currentTime, offset);
      setActiveIndex((current) => (current === next ? current : next));
    };
    update();
    return store.subscribeTime(update);
  }, [offset, result]);

  useEffect(() => {
    const current = scroller.current?.querySelector<HTMLElement>('[aria-current="true"]');
    const parent = scroller.current;
    if (!current || !parent) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const nextTop =
      parent.scrollTop +
      (current.getBoundingClientRect().top - parent.getBoundingClientRect().top) -
      parent.clientHeight / 2 +
      current.clientHeight / 2;
    parent.scrollTo({ top: Math.max(0, nextTop), behavior: reduce ? 'auto' : 'smooth' });
  }, [activeIndex]);

  return (
    <div className="lyrics-slot">
      <section className="panel lyrics-panel" aria-labelledby="lyrics-label">
      <div className="tempo-head">
        <h2 id="lyrics-label">Lyrics</h2>
        {follows && <span className="transport-status">Follows video</span>}
        {result.status === 'found' && result.lyrics.synced && !result.lyrics.matchesVideo && (
          <span className="transport-status timing-differs">Different version</span>
        )}
      </div>
      {follows && (
        <div className="lyric-sync">
          <button
            className="btn lyric-nudge"
            type="button"
            onClick={() => {
              setOffset((value) => {
                const next = clampOffset(value - 0.5);
                if (videoId) writeLyricOffset(videoId, next);
                return next;
              });
            }}
          >
            Earlier
          </button>
          <label className="lyric-sync-slider">
            <span className="sr-only">Lyric sync</span>
            <input
              className="range"
              type="range"
              min={-20}
              max={20}
              step={0.1}
              value={offset}
              aria-valuetext={formatOffset(offset)}
              onChange={(event) => changeOffset(Number(event.target.value))}
            />
          </label>
          <button
            className="btn lyric-nudge"
            type="button"
            onClick={() => {
              setOffset((value) => {
                const next = clampOffset(value + 0.5);
                if (videoId) writeLyricOffset(videoId, next);
                return next;
              });
            }}
          >
            Later
          </button>
          <span className="lyric-sync-readout">{formatOffset(offset)}</span>
        </div>
      )}
      {result.status === 'found' && (
        <p className="tempo-match">
          {result.lyrics.artistName ? `${result.lyrics.artistName} — ` : ''}
          {result.lyrics.trackName}
        </p>
      )}
      <LyricsBody result={result} lines={lines} activeIndex={activeIndex} scroller={scroller} />
      <p className="rate-note">
        {result.status === 'found' ? (
          <>
            Lyrics from{' '}
            <a href={result.lyrics.sourceUrl} target="_blank" rel="noreferrer">
              {result.lyrics.source}
            </a>
            .
          </>
        ) : (
          <>
            Lyrics from <a href="https://lrclib.net/" target="_blank" rel="noreferrer">LRCLIB</a>, then{' '}
            <a href="https://lyrics.ovh/" target="_blank" rel="noreferrer">lyrics.ovh</a> if needed.
          </>
        )}{' '}
        {result.status === 'found' && result.lyrics.synced && !result.lyrics.matchesVideo && duration > 0 && (
          <>
            These timings match {result.lyrics.albumName ? `“${result.lyrics.albumName}”` : 'another recording'} (
            {formatTime(result.lyrics.duration)}), not this {formatTime(duration)} video.{' '}
            <a
              href={versionSearchUrl(result.lyrics.artistName, result.lyrics.trackName, result.lyrics.albumName)}
              target="_blank"
              rel="noreferrer"
            >
              Find that version
            </a>
            .{' '}
          </>
        )}
        Click a timed line to jump the video there.
      </p>
      </section>
    </div>
  );
}

function clampOffset(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(20, Math.max(-20, Math.round(value * 10) / 10));
}

function formatOffset(offset: number) {
  if (Math.abs(offset) < 0.05) return 'In sync';
  const seconds = Math.abs(offset).toFixed(1);
  return offset > 0 ? `${seconds}s later` : `${seconds}s earlier`;
}

function readLyricOffset(videoId: string) {
  try {
    return clampOffset(Number(localStorage.getItem(`loopmaster.lyricSync.${videoId}`)));
  } catch {
    return 0;
  }
}

function writeLyricOffset(videoId: string, offset: number) {
  try {
    localStorage.setItem(`loopmaster.lyricSync.${videoId}`, String(offset));
  } catch {
    /* Sync still works until the page reloads. */
  }
}

function LyricsBody({
  result,
  lines,
  activeIndex,
  scroller,
}: {
  result: LyricsResult | { status: 'loading' } | { status: 'idle' };
  lines: LyricLine[];
  activeIndex: number;
  scroller: RefObject<HTMLDivElement | null>;
}) {
  if (result.status === 'loading' || result.status === 'idle') {
    return (
      <p className="rate-note" role="status">
        Looking up lyrics…
      </p>
    );
  }
  if (result.status === 'failed') {
    return <p className="url-error">We couldn't load lyrics for this video. Try again in a moment.</p>;
  }
  if (result.status === 'empty') {
    return <p className="rate-note">No lyrics were found for this title.</p>;
  }
  if (result.lyrics.instrumental && lines.length === 0) {
    return <p className="rate-note">This recording is marked as instrumental.</p>;
  }

  return (
    <div className="lyrics-scroll" ref={scroller}>
      {lines.map((line, index) =>
        line.time == null ? (
          <p key={`${line.text}-${index}`} className="lyric-line">
            {line.text}
          </p>
        ) : (
          <button
            key={`${line.time}-${index}`}
            className={index === activeIndex ? 'lyric-line is-current' : 'lyric-line'}
            type="button"
            aria-current={index === activeIndex ? 'true' : undefined}
            onClick={() => seekTo(line.time ?? 0)}
          >
            {line.text}
          </button>
        ),
      )}
    </div>
  );
}
