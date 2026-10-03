import { useEffect, useRef, useState } from 'react';
import { clearHistory, closeSettings } from '../state/store';
import { usePracticeState } from '../state/hooks';
import { IconClose } from './Icons';

const shortcuts = [
  ['Space', 'Play or pause'],
  ['A', 'Set loop start'],
  ['B', 'Set loop end'],
  ['L', 'Turn the loop on or off'],
  ['← / →', 'Seek 5 seconds'],
  ['Shift + ← / →', 'Seek 1 second'],
  ['↑ / ↓ or − / +', 'Change speed'],
];

export function SettingsDialog() {
  const { settingsOpen, history } = usePracticeState();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (!settingsOpen) {
      setConfirmClear(false);
      return;
    }
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () =>
      [...dialog.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(
        (element) => !element.hasAttribute('disabled'),
      );
    focusable()[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeSettings();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus();
    };
  }, [settingsOpen]);

  if (!settingsOpen) return null;

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeSettings();
      }}
    >
      <div
        ref={dialogRef}
        id="settings-dialog"
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="dialog-head">
          <h2 id="settings-title">Settings</h2>
          <button className="icon-btn" type="button" aria-label="Close settings" onClick={closeSettings}>
            <IconClose />
          </button>
        </div>
        <p className="library-copy">Saved loops and history stay in this browser.</p>
        <h3 className="section-label">Keyboard shortcuts</h3>
        <ul className="shortcut-list">
          {shortcuts.map(([keys, description]) => (
            <li key={keys}>
              <kbd>{keys}</kbd>
              <span>{description}</span>
            </li>
          ))}
        </ul>
        <p className="rate-note">Shortcuts apply while the practice workspace is focused, outside the video frame.</p>
        <div className="dialog-footer">
          {confirmClear ? (
            <div className="confirm-row">
              <span>Clear {history.length} video{history.length === 1 ? '' : 's'} from history?</span>
              <button
                className="btn btn-danger"
                type="button"
                onClick={() => {
                  clearHistory();
                  setConfirmClear(false);
                }}
              >
                Clear history
              </button>
              <button className="btn" type="button" onClick={() => setConfirmClear(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <button className="btn" type="button" onClick={() => setConfirmClear(true)} disabled={history.length === 0}>
              Clear history
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
