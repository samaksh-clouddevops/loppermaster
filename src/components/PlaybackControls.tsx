import { useEffect, useState, type RefObject } from 'react';
import { seekBy, toggleMute, togglePlay, setVolume } from '../state/store';
import { usePracticeState } from '../state/hooks';
import { formatTime } from '../lib/time';
import { LiveTime } from './LiveTime';
import {
  IconExitFullscreen,
  IconFullscreen,
  IconPause,
  IconPlay,
  IconSkipBack,
  IconSkipForward,
  IconVolume,
  IconVolumeMuted,
} from './Icons';

export function PlaybackControls({ stageRef }: { stageRef: RefObject<HTMLDivElement | null> }) {
  const { isPlaying, duration, volume, muted, loopEnabled } = usePracticeState();
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    function onChange() {
      setFullscreen(document.fullscreenElement === stageRef.current);
    }
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [stageRef]);

  async function toggleFullscreen() {
    const stage = stageRef.current;
    if (!stage) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await stage.requestFullscreen();
    } catch {
      /* Fullscreen can be denied by the browser. */
    }
  }

  const silent = muted || volume === 0;

  return (
    <div className="transport" data-tour="transport">
      <div className="transport-main">
        <button className="skip-btn" type="button" onClick={() => seekBy(-5)} aria-label="Back 5 seconds">
          <IconSkipBack />
        </button>
        <button className="play-btn" type="button" onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'} aria-keyshortcuts="Space">
          {isPlaying ? <IconPause /> : <IconPlay />}
        </button>
        <button className="skip-btn" type="button" onClick={() => seekBy(5)} aria-label="Forward 5 seconds">
          <IconSkipForward />
        </button>
      </div>

      <div className="times">
        <span className="time-readout">
          <span className="sr-only">Elapsed </span>
          <LiveTime tenths className="time-value" />
        </span>
        {loopEnabled && <span className="transport-status">Looping</span>}
        <span className="time-readout time-duration">
          <span className="sr-only">Duration </span>
          <span className="time-value">{formatTime(duration)}</span>
        </span>
      </div>

      <div className="transport-tools">
        <div className="volume">
          <button className="icon-btn" type="button" onClick={toggleMute} aria-label={silent ? 'Unmute' : 'Mute'} aria-pressed={silent}>
            {silent ? <IconVolumeMuted /> : <IconVolume />}
          </button>
          <input
            className="range volume-slider"
            type="range"
            min={0}
            max={100}
            step={1}
            value={silent ? 0 : volume}
            style={{ ['--fill' as string]: `${silent ? 0 : volume}%` }}
            aria-label="Volume"
            aria-valuetext={silent ? 'Muted' : `${volume} percent`}
            onChange={(event) => setVolume(Number(event.target.value))}
          />
        </div>
        <button className="icon-btn" type="button" onClick={toggleFullscreen} aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>
          {fullscreen ? <IconExitFullscreen /> : <IconFullscreen />}
        </button>
      </div>
    </div>
  );
}
