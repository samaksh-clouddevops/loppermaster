import { useRef, type ChangeEvent, type FormEvent } from 'react';
import { loadLocalFile, setInputValue, submitUrl } from '../state/store';
import { usePracticeState } from '../state/hooks';

export function VideoLoader({ prominent = false }: { prominent?: boolean }) {
  const { inputValue, inputError, mediaSource } = usePracticeState();
  const fileRef = useRef<HTMLInputElement>(null);
  const helpId = prominent ? 'url-help' : undefined;
  const errorId = 'url-error';

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    submitUrl(inputValue);
  }

  function onPickFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    void loadLocalFile(file);
  }

  return (
    <div className={prominent ? 'url-block url-block-prominent' : 'url-block'}>
      <form className="url-form" onSubmit={onSubmit}>
        <label className={prominent ? 'url-label' : 'section-label'} htmlFor="youtube-url">
          {prominent ? 'Practice any YouTube video or audio file' : 'YouTube URL or local audio'}
        </label>
        <div className="url-row" data-tour="paste">
          <input
            id="youtube-url"
            className="field"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder="Paste a YouTube URL, or open an MP3 / WAV"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            aria-invalid={inputError ? true : undefined}
            aria-describedby={inputError ? errorId : helpId}
          />
          <button className="btn btn-primary" type="submit">
            Load
          </button>
          <button className="btn" type="button" onClick={() => fileRef.current?.click()}>
            Open audio
          </button>
          <input
            ref={fileRef}
            className="sr-only"
            type="file"
            accept="audio/mpeg,audio/mp3,audio/wav,audio/wave,audio/x-wav,.mp3,.wav"
            onChange={onPickFile}
          />
        </div>
      </form>
      {prominent && !inputError && (
        <p id="url-help" className="url-help">
          Paste a YouTube URL, or open an MP3 / WAV for clearer slow practice.
        </p>
      )}
      {!prominent && mediaSource === 'local' && !inputError && (
        <p className="url-help">Local audio keeps pitch when you slow it down.</p>
      )}
      {inputError && (
        <p id={errorId} className="url-error" role="alert">
          {inputError}
        </p>
      )}
    </div>
  );
}
