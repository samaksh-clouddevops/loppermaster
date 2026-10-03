import { openSettings, setView } from '../state/store';
import { usePracticeState } from '../state/hooks';
import { IconSettings } from './Icons';

export function Header() {
  const { view, savedLoops, settingsOpen } = usePracticeState();

  return (
    <header className="header">
      <button className="brand" type="button" onClick={() => setView('practice')}>
        <span className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 32 32">
            <path
              d="M9 16a7 7 0 1 1 2.2 5.1"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <path
              d="M9 13.5V18H13.2"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="brand-name">Loopmaster</span>
      </button>
      <nav className="nav" aria-label="Primary">
        <button className="nav-btn" type="button" aria-current={view === 'practice' ? 'page' : undefined} onClick={() => setView('practice')}>
          Practice
        </button>
        <button className="nav-btn" type="button" aria-current={view === 'saved' ? 'page' : undefined} onClick={() => setView('saved')}>
          Saved
          {savedLoops.length > 0 && <span className="nav-count">{savedLoops.length}</span>}
        </button>
        <button className="nav-btn" type="button" aria-current={view === 'history' ? 'page' : undefined} onClick={() => setView('history')}>
          History
        </button>
      </nav>
      <div className="header-actions">
        <button
          className="icon-btn"
          type="button"
          aria-label="Settings"
          aria-haspopup="dialog"
          aria-expanded={settingsOpen}
          aria-controls="settings-dialog"
          onClick={openSettings}
        >
          <IconSettings />
        </button>
      </div>
    </header>
  );
}
