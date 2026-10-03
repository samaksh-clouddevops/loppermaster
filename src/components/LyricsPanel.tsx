import { useEffect, useRef, useState, type RefObject } from 'react';
import { fetchLyrics, lineAtTime, type LyricLine, type LyricsResult } from '../lib/lyrics';
import { seekTo, store } from '../state/store';
import { usePracticeState } from '../state/hooks';

export function LyricsPanel() {
  const { videoId, videoTitle, author, duration, status } = usePracticeState();
  const [result, setResult] = useState<LyricsResult | { status: 'loading' } | { status: 'idle' }>({ status: 'idle' });
  const [activeIndex, setActiveIndex] = useState(-1);
  const scroller = useRef<HTMLDivElement>(null);
  const lines = result.status === 'found' ? result.lyrics.lines : [];

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
    if (result.status !== 'found' || !result.lyrics.synced) return;
    const lyricLines = result.lyrics.lines;
    const update = () => {
      const next = lineAtTime(lyricLines, store.getState().currentTime);
      setActiveIndex((current) => (current === next ? current : next));
    };
    update();
    return store.subscribeTime(update);
  }, [result]);

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
        {result.status === 'found' && result.lyrics.synced && <span className="transport-status">Follows video</span>}
      </div>
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
        Click a timed line to jump the video there.
      </p>
      </section>
    </div>
  );
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
