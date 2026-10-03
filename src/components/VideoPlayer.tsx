import { useRef } from 'react';
import { retryVideo } from '../state/store';
import { usePracticeState } from '../state/hooks';
import { useYouTubePlayer } from '../engine/useYouTubePlayer';

export function VideoPlayer() {
  const hostRef = useRef<HTMLDivElement>(null);
  const { videoId, loadToken, status, playerError } = usePracticeState();
  useYouTubePlayer(hostRef, videoId, loadToken);

  return (
    <div className="player-frame">
      <div ref={hostRef} className="player-mount" />
      {status === 'loading' && (
        <div className="player-overlay">
          <div className="skeleton skeleton-player" />
          <p className="loading-label" role="status">
            Loading video…
          </p>
        </div>
      )}
      {status === 'error' && playerError && (
        <div className="player-overlay">
          <div className="player-message" role="alert">
            <h2>{playerError}</h2>
            <p>
              {playerError === "This video can't be played."
                ? 'It may be private, deleted, or blocked from embedding.'
                : 'Check your connection and try again.'}
            </p>
            <button className="btn btn-primary" type="button" onClick={retryVideo}>
              Try again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
