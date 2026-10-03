import { MAX_RATE, MIN_RATE, SPEED_PRESETS } from '../lib/range';
import { formatRate } from '../lib/time';
import { nudgeRate, setPlaybackRate } from '../state/store';
import { usePracticeState } from '../state/hooks';

export function SpeedControl() {
  const { playbackRate, availableRates, rateNotice } = usePracticeState();
  const fill = ((playbackRate - MIN_RATE) / (MAX_RATE - MIN_RATE)) * 100;

  return (
    <section className="panel speed" aria-labelledby="speed-label">
      <div className="speed-head">
        <h2 id="speed-label">Playback speed</h2>
      </div>
      <div className="speed-scale">
        <span>{formatRate(MIN_RATE)}</span>
        <span>{formatRate(MAX_RATE)}</span>
      </div>
      <input
        id="playback-speed"
        className="range speed-range"
        type="range"
        min={MIN_RATE}
        max={MAX_RATE}
        step={0.05}
        value={playbackRate}
        aria-labelledby="speed-label"
        aria-valuetext={formatRate(playbackRate)}
        aria-describedby={rateNotice ? 'speed-note' : undefined}
        style={{ ['--fill' as string]: `${fill}%` }}
        onChange={(event) => setPlaybackRate(Number(event.target.value))}
      />
      <div className="speed-readout">
        <button className="nudge" type="button" onClick={() => nudgeRate(-1)} aria-label="Decrease playback speed">
          −
        </button>
        <strong className="speed-value">{formatRate(playbackRate)}</strong>
        <button className="nudge" type="button" onClick={() => nudgeRate(1)} aria-label="Increase playback speed">
          +
        </button>
      </div>
      <div className="presets" role="group" aria-label="Speed presets">
        {SPEED_PRESETS.map((preset) => {
          const available =
            availableRates.length === 0 || availableRates.some((rate) => Math.abs(rate - preset) < 0.02);
          const active = Math.abs(playbackRate - preset) < 0.02;
          return (
            <button
              key={preset}
              className="preset"
              type="button"
              aria-pressed={active}
              disabled={!available}
              onClick={() => setPlaybackRate(preset)}
            >
              {preset.toFixed(2)}×
            </button>
          );
        })}
      </div>
      {rateNotice && (
        <p id="speed-note" className="rate-note" role="status">
          {rateNotice}
        </p>
      )}
    </section>
  );
}
