import type { FormEvent } from 'react';
import { setInputValue, submitUrl } from '../state/store';
import { usePracticeState } from '../state/hooks';

export function VideoLoader({ prominent = false }: { prominent?: boolean }) {
  const { inputValue, inputError } = usePracticeState();
  const helpId = prominent ? 'url-help' : undefined;
  const errorId = 'url-error';

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    submitUrl(inputValue);
  }

  return (
    <div className={prominent ? 'url-block url-block-prominent' : 'url-block'}>
      <form className="url-form" onSubmit={onSubmit}>
        <label className={prominent ? 'url-label' : 'section-label'} htmlFor="youtube-url">
          {prominent ? 'Practice any YouTube video' : 'YouTube URL'}
        </label>
        <div className="url-row">
          <input
            id="youtube-url"
            className="field"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder="Paste a YouTube URL or video ID"
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
        </div>
      </form>
      {prominent && !inputError && (
        <p id="url-help" className="url-help">
          Paste a YouTube URL or video ID to get started.
        </p>
      )}
      {inputError && (
        <p id={errorId} className="url-error" role="alert">
          {inputError}
        </p>
      )}
    </div>
  );
}
