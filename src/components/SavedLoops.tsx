import { useEffect, useState } from 'react';
import { formatRate, formatTime, formatWhen } from '../lib/time';
import { deleteSavedLoop, loadVideo, playSavedLoop, renameSavedLoop } from '../state/store';
import { useFocusHeading, usePracticeState } from '../state/hooks';
import type { SavedLoop } from '../types';

export function SavedLoops() {
  const { savedLoops, view } = usePracticeState();
  const headingRef = useFocusHeading('saved', view === 'saved');

  return (
    <section className="library" data-screen="saved" aria-labelledby="saved-title">
      <div className="library-head">
        <h1 id="saved-title" data-view-title tabIndex={-1} ref={headingRef}>
          Saved loops
        </h1>
        <p className="library-copy">Sections you save stay in this browser, ready for the next practice session.</p>
      </div>
      {savedLoops.length === 0 ? (
        <div className="empty-panel">
          <h2>No saved loops yet</h2>
          <p>Set A and B on a video, then save the section you want to practice again.</p>
        </div>
      ) : (
        <ul className="loop-list">
          {savedLoops.map((loop) => (
            <SavedLoopRow key={loop.id} loop={loop} />
          ))}
        </ul>
      )}
    </section>
  );
}

function SavedLoopRow({ loop }: { loop: SavedLoop }) {
  const [mode, setMode] = useState<'view' | 'rename' | 'delete'>('view');
  const [name, setName] = useState(loop.name);

  useEffect(() => {
    setName(loop.name);
  }, [loop.name]);

  function commitRename() {
    renameSavedLoop(loop.id, name);
    setMode('view');
  }

  return (
    <li className="loop-row">
      <button className="row-open" type="button" onClick={() => playSavedLoop(loop)}>
        {loop.thumbnailUrl ? (
          <img className="thumb" src={loop.thumbnailUrl} alt="" width={160} height={90} />
        ) : (
          <span className="thumb thumb-empty" aria-hidden="true" />
        )}
        <span className="row-copy">
          {mode === 'rename' ? (
            <span className="row-name">{name}</span>
          ) : (
            <span className="row-name">{loop.name}</span>
          )}
          <span className="row-meta">
            {loop.author ? `${loop.author} · ` : ''}
            {formatTime(loop.loopStart, true)} → {formatTime(loop.loopEnd, true)} · {formatRate(loop.playbackRate)}
          </span>
        </span>
      </button>
      <div className="row-actions">
        {mode === 'rename' ? (
          <form
            className="rename-form"
            onSubmit={(event) => {
              event.preventDefault();
              commitRename();
            }}
          >
            <label className="sr-only" htmlFor={`rename-${loop.id}`}>
              Loop name
            </label>
            <input
              id={`rename-${loop.id}`}
              className="field"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  setName(loop.name);
                  setMode('view');
                }
              }}
            />
            <button className="btn btn-primary" type="submit">
              Save name
            </button>
            <button
              className="btn"
              type="button"
              onClick={() => {
                setName(loop.name);
                setMode('view');
              }}
            >
              Cancel
            </button>
          </form>
        ) : mode === 'delete' ? (
          <div className="confirm-row">
            <span>Delete this loop?</span>
            <button className="btn btn-danger" type="button" onClick={() => deleteSavedLoop(loop.id)}>
              Delete
            </button>
            <button className="btn" type="button" onClick={() => setMode('view')}>
              Keep
            </button>
          </div>
        ) : (
          <>
            <button className="btn btn-primary" type="button" onClick={() => playSavedLoop(loop)}>
              Play
            </button>
            <button className="btn" type="button" onClick={() => setMode('rename')}>
              Rename
            </button>
            <button className="btn" type="button" onClick={() => setMode('delete')}>
              Delete
            </button>
          </>
        )}
      </div>
    </li>
  );
}

export function HistoryPanel() {
  const { history, view } = usePracticeState();
  const headingRef = useFocusHeading('history', view === 'history');

  return (
    <section className="library" data-screen="history" aria-labelledby="history-title">
      <div className="library-head">
        <h1 id="history-title" data-view-title tabIndex={-1} ref={headingRef}>
          History
        </h1>
        <p className="library-copy">Videos you load on this browser.</p>
      </div>
      {history.length === 0 ? (
        <div className="empty-panel">
          <h2>Nothing played yet</h2>
          <p>Videos you load will be listed here.</p>
        </div>
      ) : (
        <ul className="loop-list">
          {history.map((entry) => (
            <HistoryRow key={entry.videoId} entry={entry} />
          ))}
        </ul>
      )}
    </section>
  );
}

function HistoryRow({
  entry,
}: {
  entry: { videoId: string; videoTitle: string; author: string; thumbnailUrl: string; lastOpenedAt: number };
}) {
  return (
    <li className="loop-row">
      <button
        className="row-open"
        type="button"
        onClick={() =>
          loadVideo(entry.videoId, {
            force: true,
            title: entry.videoTitle,
            author: entry.author,
            thumbnailUrl: entry.thumbnailUrl,
          })
        }
      >
        {entry.thumbnailUrl ? (
          <img className="thumb" src={entry.thumbnailUrl} alt="" width={160} height={90} />
        ) : (
          <span className="thumb thumb-empty" aria-hidden="true" />
        )}
        <span className="row-copy">
          <span className="row-name">{entry.videoTitle}</span>
          <span className="row-meta">
            {entry.author ? `${entry.author} · ` : ''}
            {formatWhen(entry.lastOpenedAt)}
          </span>
        </span>
      </button>
    </li>
  );
}
