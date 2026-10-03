import { useEffect } from 'react';
import { loadYouTubeApi } from './lib/youtube';
import { usePracticeState } from './state/hooks';
import { Header } from './components/Header';
import { PracticeWorkspace } from './components/PracticeWorkspace';
import { HistoryPanel, SavedLoops } from './components/SavedLoops';
import { SettingsDialog } from './components/SettingsDialog';
import { KeyboardShortcuts } from './components/KeyboardShortcuts';
import { Walkthrough } from './components/Walkthrough';

export function App() {
  const { view, settingsOpen, walkthroughOpen } = usePracticeState();

  useEffect(() => {
    loadYouTubeApi().catch(() => undefined);
  }, []);

  return (
    <div className="app">
      <div className="shell" inert={settingsOpen || walkthroughOpen ? true : undefined}>
        <a className="skip" href="#workspace">
          Skip to workspace
        </a>
        <Header />
        <main id="workspace">
          <PracticeWorkspace />
          {view === 'saved' && <SavedLoops />}
          {view === 'history' && <HistoryPanel />}
        </main>
      </div>
      <SettingsDialog />
      <Walkthrough />
      <KeyboardShortcuts />
    </div>
  );
}
