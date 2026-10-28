import { useState } from 'react';
import { MIN_LOOP_GAP } from '../lib/range';
import { formatRate, formatTime } from '../lib/time';
import { exportLoopWav } from '../lib/wavExport';
import { saveCurrentLoop, setView } from '../state/store';
import { usePracticeState } from '../state/hooks';
import { useLocalAnalysis } from '../state/useLocalAnalysis';

export function CurrentLoopCard() {
  const { videoTitle, author, loopStart, loopEnd, playbackRate, loopEnabled, mediaSource, localFileName } =
    usePracticeState();
  const { status: analysisStatus, analysis } = useLocalAnalysis();
  const [notice, setNotice] = useState('');
  const title = videoTitle || 'Untitled video';
  const heading =
    author && !title.toLowerCase().includes(author.toLowerCase()) ? `${author} – ${title}` : title;
  const canExport =
    mediaSource === 'local' &&
    analysisStatus === 'ready' &&
    Boolean(analysis?.buffer) &&
    loopEnd - loopStart >= MIN_LOOP_GAP;

  function onSave() {
    const saved = saveCurrentLoop();
    if (!saved) return;
    setNotice('Saved in this browser.');
  }

  function onDownload() {
    if (!analysis?.buffer || !canExport) return;
    const base = (localFileName || videoTitle || 'loop').replace(/\.[^.]+$/, '');
    const name = `${base}-${formatTime(loopStart, true).replace(':', '-')}-${formatTime(loopEnd, true).replace(':', '-')}.wav`;
    exportLoopWav(analysis.buffer, loopStart, loopEnd, name);
    setNotice('Loop downloaded as WAV.');
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
        {mediaSource === 'local' && (
          <button
            className="btn"
            type="button"
            onClick={onDownload}
            disabled={!canExport}
            title={
              analysisStatus === 'loading'
                ? 'Wait for audio analysis'
                : loopEnd - loopStart < MIN_LOOP_GAP
                  ? 'Set a longer A–B range'
                  : 'Download the A–B section as WAV'
            }
          >
            Download loop
          </button>
        )}
        {notice && (
          <p className="save-note" role="status">
            {notice}{' '}
            {notice.startsWith('Saved') && (
              <button className="text-btn" type="button" onClick={() => setView('saved')}>
                View saved loops
              </button>
            )}
          </p>
        )}
      </div>
    </section>
  );
}
