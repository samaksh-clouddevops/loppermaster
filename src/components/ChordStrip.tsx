import { seekTo } from '../state/store';
import { usePracticeState, usePracticeTime } from '../state/hooks';
import { useLocalAnalysis } from '../state/useLocalAnalysis';

export function ChordStrip() {
  const { mediaSource, duration } = usePracticeState();
  const currentTime = usePracticeTime();
  const { status, analysis } = useLocalAnalysis();

  if (mediaSource !== 'local') return null;

  if (status === 'loading' || status === 'idle') {
    return (
      <div className="chord-strip is-pending" role="status">
        Analyzing chords…
      </div>
    );
  }

  if (status === 'error' || !analysis || analysis.chords.length === 0) {
    return (
      <div className="chord-strip is-empty">
        <p className="rate-note">No clear chord changes detected. Approximate on full mixes.</p>
      </div>
    );
  }

  const span = Math.max(duration || analysis.duration, 0.001);
  const active = analysis.chords.find((chord) => currentTime >= chord.start && currentTime < chord.end);

  return (
    <section className="chord-strip" aria-label="Detected chords">
      <div className="chord-strip-head">
        <p className="section-label">Chords</p>
        <p className="rate-note">{active ? active.label : '—'} · approximate</p>
      </div>
      <div className="chord-lane" role="list">
        {analysis.chords.map((chord) => {
          const left = (chord.start / span) * 100;
          const width = (Math.max(chord.end - chord.start, 0) / span) * 100;
          const isActive = active === chord;
          return (
            <button
              key={`${chord.start}-${chord.label}`}
              className={isActive ? 'chord-seg is-active' : 'chord-seg'}
              type="button"
              role="listitem"
              style={{ left: `${left}%`, width: `${Math.max(width, 0.4)}%` }}
              title={`${chord.label} at ${chord.start.toFixed(1)}s`}
              onClick={() => seekTo(chord.start)}
            >
              <span>{chord.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
