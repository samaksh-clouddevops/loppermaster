import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react';
import { isSupportedAudioFile } from '../lib/localMedia';
import { loadLocalFile, setInputValue, store, submitUrl } from '../state/store';
import { usePracticeState } from '../state/hooks';

function pickAudioFile(files: FileList | null | undefined) {
  if (!files?.length) return null;
  return Array.from(files).find(isSupportedAudioFile) ?? null;
}

function openDroppedAudio(files: FileList | null | undefined) {
  const file = pickAudioFile(files);
  if (!file) {
    store.set({ inputError: 'Drop an MP3, WAV, or FLAC file.' });
    return;
  }
  void loadLocalFile(file);
}

function transferHasFiles(transfer: DataTransfer | null) {
  return Boolean(transfer && [...transfer.types].includes('Files'));
}

export function VideoLoader({ prominent = false }: { prominent?: boolean }) {
  const { inputValue, inputError, mediaSource } = usePracticeState();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
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

  function clearDrag() {
    dragDepth.current = 0;
    setDragging(false);
  }

  function onDragEnter(event: DragEvent) {
    if (!transferHasFiles(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current += 1;
    setDragging(true);
  }

  function onDragOver(event: DragEvent) {
    if (!transferHasFiles(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
  }

  function onDragLeave(event: DragEvent) {
    if (!transferHasFiles(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    clearDrag();
    openDroppedAudio(event.dataTransfer.files);
  }

  useEffect(() => {
    function onWindowDragOver(event: globalThis.DragEvent) {
      if (!transferHasFiles(event.dataTransfer)) return;
      event.preventDefault();
    }

    function onWindowDrop(event: globalThis.DragEvent) {
      if (!transferHasFiles(event.dataTransfer)) return;
      event.preventDefault();
      clearDrag();
      openDroppedAudio(event.dataTransfer?.files);
    }

    function onWindowDragEnd() {
      clearDrag();
    }

    window.addEventListener('dragover', onWindowDragOver);
    window.addEventListener('drop', onWindowDrop);
    window.addEventListener('dragend', onWindowDragEnd);
    return () => {
      window.removeEventListener('dragover', onWindowDragOver);
      window.removeEventListener('drop', onWindowDrop);
      window.removeEventListener('dragend', onWindowDragEnd);
    };
  }, []);

  return (
    <div
      className={`${prominent ? 'url-block url-block-prominent' : 'url-block'}${dragging ? ' is-drop-target' : ''}`}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
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
            placeholder="Paste a YouTube URL, or drop an MP3 / WAV / FLAC"
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
            accept="audio/mpeg,audio/mp3,audio/wav,audio/wave,audio/x-wav,audio/flac,audio/x-flac,.mp3,.wav,.flac"
            onChange={onPickFile}
          />
        </div>
      </form>
      {dragging && (
        <p className="url-drop-hint" role="status">
          Drop MP3, WAV, or FLAC to practice
        </p>
      )}
      {prominent && !inputError && !dragging && (
        <p id="url-help" className="url-help">
          Paste a YouTube URL, or drag in an MP3 / WAV / FLAC for clearer slow practice.
        </p>
      )}
      {!prominent && mediaSource === 'local' && !inputError && !dragging && (
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
