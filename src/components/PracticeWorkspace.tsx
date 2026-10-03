import { useEffect, useRef } from 'react';
import { getEngine } from '../state/store';
import { useFocusHeading, usePracticeState } from '../state/hooks';
import { EmptyState } from './EmptyState';
import { VideoLoader } from './VideoLoader';
import { VideoPlayer } from './VideoPlayer';
import { PlaybackControls } from './PlaybackControls';
import { PracticeTimeline } from './PracticeTimeline';
import { LoopControls } from './LoopControls';
import { SpeedControl } from './SpeedControl';
import { CurrentLoopCard } from './CurrentLoopCard';
import { TempoPanel } from './TempoPanel';
import { LyricsPanel } from './LyricsPanel';

export function PracticeWorkspace() {
  const view = usePracticeState().view;
  const videoId = usePracticeState().videoId;

  useEffect(() => {
    if (view !== 'practice') getEngine()?.pause();
  }, [view]);

  return (
    <div data-screen="practice" hidden={view !== 'practice'}>
      {videoId ? <Session active={view === 'practice'} /> : <EmptyState view={view} />}
    </div>
  );
}

function Session({ active }: { active: boolean }) {
  const { status, videoTitle, author } = usePracticeState();
  const stageRef = useRef<HTMLDivElement>(null);
  const headingRef = useFocusHeading('practice', active);
  const ready = status === 'ready';

  return (
    <div className="session">
      <VideoLoader />
      <div className="session-head">
        {videoTitle ? (
          <h1 className="session-title" data-view-title tabIndex={-1} ref={headingRef}>
            {videoTitle}
          </h1>
        ) : (
          <div className="skeleton skeleton-title" />
        )}
        {author ? <p className="session-author">{author}</p> : status === 'loading' && <div className="skeleton skeleton-author" />}
      </div>
      <div className="studio" ref={stageRef} aria-busy={status === 'loading'}>
        <div className="stage">
          <div className="video-fit">
            <VideoPlayer />
          </div>
          {ready && (
            <>
              <PlaybackControls stageRef={stageRef} />
              <PracticeTimeline />
              <LoopControls />
            </>
          )}
          {status === 'loading' && (
            <div className="skeleton-stack" aria-hidden="true">
              <div className="skeleton skeleton-transport" />
              <div className="skeleton skeleton-timeline" />
              <div className="skeleton skeleton-buttons" />
            </div>
          )}
        </div>
        <div className="rail">
          {ready ? <LyricsPanel /> : <div className="lyrics-slot" aria-hidden="true"><div className="panel lyrics-panel lyrics-pending" /></div>}
          {ready && <TempoPanel />}
          {status === 'loading' && <div className="skeleton skeleton-panel" aria-hidden="true" />}
        </div>
        {ready && (
          <>
            <div className="practice-grid">
              <SpeedControl />
              <CurrentLoopCard />
            </div>
            <p className="hint">
              <span>
                <kbd>Space</kbd> play
              </span>
              <span>
                <kbd>A</kbd> set start
              </span>
              <span>
                <kbd>B</kbd> set end
              </span>
              <span>
                <kbd>L</kbd> loop
              </span>
              <span>
                <kbd>←</kbd>
                <kbd>→</kbd> seek
              </span>
              <span>
                <kbd>−</kbd>
                <kbd>+</kbd> speed
              </span>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
