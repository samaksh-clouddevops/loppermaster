import { useEffect } from 'react';
import { nudgeRate, seekBy, setLoopAtPlayhead, store, toggleLoop, togglePlay } from '../state/store';

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

export function KeyboardShortcuts() {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const state = store.getState();
      if (state.view !== 'practice' || state.settingsOpen || state.walkthroughOpen) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest('[role="slider"]')) return;
      if ((event.key === ' ' || event.key === 'Enter') && target?.closest('button, a')) return;

      const key = event.key.toLowerCase();
      const repeatable = event.key.startsWith('Arrow') || key === '-' || key === '_' || key === '=' || key === '+';
      if (event.repeat && !repeatable) return;

      if (event.key === ' ') {
        event.preventDefault();
        togglePlay();
        return;
      }
      if (key === 'a') {
        event.preventDefault();
        setLoopAtPlayhead('a');
        return;
      }
      if (key === 'b') {
        event.preventDefault();
        setLoopAtPlayhead('b');
        return;
      }
      if (key === 'l') {
        event.preventDefault();
        toggleLoop();
        return;
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        const direction = event.key === 'ArrowLeft' ? -1 : 1;
        seekBy(direction * (event.shiftKey ? 1 : 5));
        return;
      }
      if (event.key === 'ArrowUp' || key === '=' || key === '+') {
        event.preventDefault();
        nudgeRate(1);
        return;
      }
      if (event.key === 'ArrowDown' || key === '-' || key === '_') {
        event.preventDefault();
        nudgeRate(-1);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return null;
}
