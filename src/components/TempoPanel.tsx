import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { analyzePreview } from '../lib/audioAnalysis';
import { getApiKey, subscribeApiKey } from '../lib/apiKey';
import { lookupSong, type LookupResult, type SongMatch } from '../lib/getsongbpm';
import { createMetronome, type Metronome } from '../lib/metronome';
import { usePracticeState } from '../state/hooks';

type Source = 'catalog' | 'preview' | 'tap' | 'manual';

export function TempoPanel() {
  const { videoId, videoTitle, author, status, playbackRate, view } = usePracticeState();
  const apiKey = useSyncExternalStore(subscribeApiKey, getApiKey, getApiKey);
  const [lookup, setLookup] = useState<LookupResult | { status: 'idle' } | { status: 'loading' } | { status: 'needs-key' }>({
    status: 'idle',
  });
  const [baseBpm, setBaseBpm] = useState(0);
  const [source, setSource] = useState<Source>('manual');
  const [beats, setBeats] = useState(4);
  const [running, setRunning] = useState(false);
  const [beatIndex, setBeatIndex] = useState(-1);
  const [clickVolume, setClickVolume] = useState(70);
  const taps = useRef<number[]>([]);
  const metro = useRef<Metronome | null>(null);

  const clickBpm = (source === 'catalog' || source === 'preview') && baseBpm > 0 ? Math.round(baseBpm * playbackRate) : baseBpm;
  const match = lookup.status === 'found' ? lookup.match : null;

  function engine() {
    metro.current ??= createMetronome((index) => setBeatIndex(index));
    return metro.current;
  }

  useEffect(() => {
    const player = engine();
    player.setBpm(clickBpm || 120);
    player.setBeats(beats);
    player.setVolume(clickVolume / 100);
  }, [clickBpm, beats, clickVolume]);

  useEffect(() => {
    if (view === 'practice') return;
    engine().stop();
    setRunning(false);
    setBeatIndex(-1);
  }, [view]);

  useEffect(() => {
    return () => metro.current?.stop();
  }, []);

  useEffect(() => {
    if (status !== 'ready' || !videoId || !videoTitle) return;
    let cancelled = false;
    setLookup({ status: 'loading' });
    const apply = (match: SongMatch, nextSource: Source) => {
      setLookup({ status: 'found', match });
      setBaseBpm(match.bpm);
      setBeats(match.beatsPerBar || 4);
      setSource(nextSource);
    };
    void (async () => {
      if (apiKey) {
        const catalog = await lookupSong(apiKey, videoTitle, author);
        if (cancelled) return;
        if (catalog.status === 'found') {
          apply(catalog.match, 'catalog');
          return;
        }
        if (catalog.status === 'invalid-key') setLookup(catalog);
      }
      const preview = await analyzePreview(videoTitle, author);
      if (cancelled) return;
      if (preview) {
        apply(
          {
            id: '',
            title: preview.title,
            artist: preview.artist,
            bpm: preview.bpm,
            keyName: preview.keyName,
            openKey: '',
            beatsPerBar: 4,
            notes: preview.notes,
            pageUrl: preview.pageUrl,
            sourceName: 'a preview',
          },
          'preview',
        );
        return;
      }
      if (!cancelled) setLookup(apiKey ? { status: 'empty' } : { status: 'needs-key' });
    })();
    return () => {
      cancelled = true;
    };
  }, [apiKey, author, status, videoId, videoTitle]);

  function applyBpm(next: number, nextSource: Source) {
    const bpm = Math.min(240, Math.max(40, Math.round(next)));
    setBaseBpm(bpm);
    setSource(nextSource);
  }

  function tap() {
    const now = performance.now();
    const previous = taps.current[taps.current.length - 1];
    if (previous && now - previous < 180) return;
    if (!previous || now - previous > 2000) taps.current = [now];
    else taps.current = [...taps.current, now].slice(-6);
    if (taps.current.length < 2) return;
    const intervals: number[] = [];
    for (let index = 1; index < taps.current.length; index += 1) {
      intervals.push(taps.current[index] - taps.current[index - 1]);
    }
    const average = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    applyBpm(60000 / average, 'tap');
  }

  function toggleMetronome() {
    const player = engine();
    if (running) {
      player.stop();
      setRunning(false);
      setBeatIndex(-1);
      return;
    }
    if (clickBpm < 40) return;
    player.setBpm(clickBpm);
    player.setBeats(beats);
    player.setVolume(clickVolume / 100);
    player.start();
    setRunning(true);
  }

  return (
    <section className="panel tempo-panel" aria-labelledby="tempo-label">
      <div className="tempo-head">
        <h2 id="tempo-label">Tempo and key</h2>
        <button className="btn" type="button" onClick={tap}>
          Tap tempo
        </button>
      </div>
      <LookupStatus lookup={lookup} hasKey={Boolean(apiKey)} />
      {match && (
        <p className="tempo-match">
          {match.artist ? `${match.artist} — ` : ''}
          {match.title}
        </p>
      )}
      <div className="tempo-stats">
        <div className="stat">
          <p className="section-label">Click tempo</p>
          <div className="tempo-bpm">
            <button className="nudge" type="button" aria-label="Decrease tempo" onClick={() => applyBpm(clickBpm - 1, 'manual')} disabled={clickBpm <= 40}>
              −
            </button>
            <strong>{clickBpm > 0 ? clickBpm : '—'}</strong>
            <button className="nudge" type="button" aria-label="Increase tempo" onClick={() => applyBpm(clickBpm > 0 ? clickBpm + 1 : 100, 'manual')} disabled={clickBpm >= 240}>
              +
            </button>
          </div>
          <TempoCaption source={source} baseBpm={baseBpm} playbackRate={playbackRate} clickBpm={clickBpm} />
        </div>
        <div className="stat">
          <p className="section-label">Key</p>
          <strong className="tempo-key">{match?.keyName || '—'}</strong>
          {match?.openKey && <p className="rate-note">Open key {match.openKey}</p>}
          {match && match.notes.length > 0 && (
            <ul className="scale-notes" aria-label="Scale notes">
              {match.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="metro-row">
        <button
          className={running ? 'btn loop-toggle is-on' : 'btn btn-primary'}
          type="button"
          aria-pressed={running}
          disabled={clickBpm < 40}
          onClick={toggleMetronome}
        >
          {running ? 'Stop metronome' : 'Start metronome'}
        </button>
        <div className="beat-dots" aria-hidden="true">
          {Array.from({ length: beats }, (_, index) => (
            <span key={index} className={running && beatIndex === index ? 'is-on' : ''} />
          ))}
        </div>
        <label className="click-volume">
          <span className="section-label">Click</span>
          <input
            className="range volume-slider"
            type="range"
            min={0}
            max={100}
            value={clickVolume}
            aria-label="Metronome volume"
            aria-valuetext={`${clickVolume} percent`}
            style={{ ['--fill' as string]: `${clickVolume}%` }}
            onChange={(event) => setClickVolume(Number(event.target.value))}
          />
        </label>
      </div>
      <p className="rate-note">
        The metronome follows the tempo you hear, so slowing the video slows the click.
        {match && (
          <>
            {' '}
            Song data from{' '}
            <a href={match.pageUrl} target="_blank" rel="noreferrer">
              {match.sourceName}
            </a>
            .
          </>
        )}
      </p>
    </section>
  );
}

function TempoCaption({
  source,
  baseBpm,
  playbackRate,
  clickBpm,
}: {
  source: Source;
  baseBpm: number;
  playbackRate: number;
  clickBpm: number;
}) {
  if (clickBpm <= 0) return <p className="rate-note">Look up the song, or tap along with it.</p>;
  if (source === 'tap') return <p className="rate-note">From your taps, at the speed you are hearing.</p>;
  if (source === 'manual') return <p className="rate-note">Set by hand for this practice speed.</p>;
  if (source === 'preview') {
    return (
      <p className="rate-note">
        From a preview of the song{Math.abs(playbackRate - 1) < 0.001 ? `, ${baseBpm} BPM` : `. At ${playbackRate.toFixed(2)}× the click is ${clickBpm}`}.
      </p>
    );
  }
  if (Math.abs(playbackRate - 1) < 0.001) return <p className="rate-note">Catalog tempo, {baseBpm} BPM.</p>;
  return (
    <p className="rate-note">
      Catalog tempo {baseBpm} BPM. At {playbackRate.toFixed(2)}× the click is {clickBpm}.
    </p>
  );
}

function LookupStatus({
  lookup,
  hasKey,
}: {
  lookup: LookupResult | { status: 'idle' } | { status: 'loading' } | { status: 'needs-key' };
  hasKey: boolean;
}) {
  if (!hasKey && lookup.status === 'needs-key') {
    return <p className="rate-note">No song preview was found. Tap the tempo, or add a GetSongBPM key in Settings.</p>;
  }
  if (lookup.status === 'loading' || lookup.status === 'idle') {
    return (
      <p className="rate-note" role="status">
        Looking up this song…
      </p>
    );
  }
  if (lookup.status === 'invalid-key') {
    return <p className="url-error">That API key was rejected. Check it in Settings.</p>;
  }
  if (lookup.status === 'failed') {
    return <p className="url-error">We couldn't reach GetSongBPM. Try again in a moment.</p>;
  }
  if (lookup.status === 'empty') {
    return <p className="rate-note">No catalog match for this title. Tap the tempo instead.</p>;
  }
  return null;
}
