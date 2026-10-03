import { playLoop, resetLoop, setLoopAtPlayhead, toggleLoop } from '../state/store';
import { usePracticeState } from '../state/hooks';
import { IconPlay, IconRepeat } from './Icons';

export function LoopControls() {
  const { loopEnabled } = usePracticeState();

  return (
    <div className="loop-actions" data-tour="loop">
      <button className="btn set-btn" type="button" onClick={() => setLoopAtPlayhead('a')} aria-keyshortcuts="A">
        Set A
      </button>
      <button className="btn set-btn" type="button" onClick={resetLoop}>
        Reset A/B
      </button>
      <button className="btn set-btn" type="button" onClick={() => setLoopAtPlayhead('b')} aria-keyshortcuts="B">
        Set B
      </button>
      <button
        className={loopEnabled ? 'btn loop-toggle is-on' : 'btn loop-toggle'}
        type="button"
        aria-pressed={loopEnabled}
        aria-keyshortcuts="L"
        onClick={toggleLoop}
      >
        <IconRepeat />
        {loopEnabled ? 'Looping' : 'Loop A–B'}
      </button>
      <button className="btn btn-primary play-loop" type="button" onClick={playLoop}>
        <IconPlay className="icon" />
        Play loop
      </button>
    </div>
  );
}
