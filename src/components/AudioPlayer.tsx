import { retryVideo } from '../state/store';
import { usePracticeState } from '../state/hooks';
import { useAudioPlayer } from '../engine/useAudioPlayer';
import { IconSpeed } from './Icons';

export function AudioPlayer() {
  const { videoId, objectUrl, loadToken, status, playerError, videoTitle, localFileName, playbackRate } =
    usePracticeState();
  useAudioPlayer(objectUrl, videoId, loadToken);

  return (
    <div className="player-frame audio-frame">
      {status === 'loading' && (
        <div className="player-overlay">
          <div className="skeleton skeleton-player" />
          <p className="loading-label" role="status">
            Loading audio…
          </p>
        </div>
      )}
      {status === 'error' && playerError && (
        <div className="player-overlay">
          <div className="player-message" role="alert">
            <h2>{playerError}</h2>
            <p>Choose the MP3 or WAV file again to keep practicing at high quality.</p>
            <button className="btn btn-primary" type="button" onClick={retryVideo}>
              Try again
            </button>
          </div>
        </div>
      )}
      {status !== 'error' && (
        <div className="audio-stage" aria-hidden={status === 'loading'}>
          <span className="audio-mark">
            <IconSpeed />
          </span>
          <div className="audio-copy">
            <p className="audio-kicker">Local audio</p>
            <p className="audio-title">{videoTitle || localFileName || 'Audio file'}</p>
            <p className="audio-note">
              Slowing keeps pitch. Current speed {playbackRate.toFixed(2)}×.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
