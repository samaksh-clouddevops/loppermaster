import { useState } from 'react';
import { formatRate, formatTime } from '../lib/time';
import { saveCurrentLoop, setView } from '../state/store';
import { usePracticeState } from '../state/hooks';

export function CurrentLoopCard() {
  const { videoTitle, author, loopStart, loopEnd, playbackRate, loopEnabled } = usePracticeState();
  const [notice, setNotice] = useState('');
  const title = videoTitle || 'Untitled video';
  const heading =
    author && !title.toLowerCase().includes(author.toLowerCase()) ? `${author} – ${title}` : title;

  function onSave() {
    const saved = saveCurrentLoop();
    if (!saved) return;
    setNotice('Saved in this browser.');
  }

  return (
    <section className="panel loop-card" aria-labelledby="current-loop-title" data-tour="save">
      <h2 id="current-loop-title" className="section-label">
        Current loop
      </h2>
      <p className="loop-card-title">{heading}</p>
      <p className="loop-range">
        {formatTime(loopStart, true)}
        <span aria-hidden="true"> → </span>
        <span className="sr-only"> to </span>
        {formatTime(loopEnd, true)}
      </p>
      <dl className="loop-stats">
        <div className="stat">
          <dt>Speed</dt>
          <dd>{formatRate(playbackRate)}</dd>
        </div>
        <div className="stat">
          <dt>Loop</dt>
          <dd>{loopEnabled ? 'On' : 'Off'}</dd>
        </div>
      </dl>
      <div className="save-row">
        <button className="btn btn-primary" type="button" onClick={onSave}>
          Save loop
        </button>
        {notice && (
          <p className="save-note" role="status">
            {notice}{' '}
            <button className="text-btn" type="button" onClick={() => setView('saved')}>
              View saved loops
            </button>
          </p>
        )}
      </div>
    </section>
  );
}
