import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { hasSeenTour } from '../lib/storage';
import { closeWalkthrough, openWalkthrough, store } from '../state/store';
import { usePracticeState } from '../state/hooks';

interface Step {
  target: string;
  title: string;
  body: string;
  hint: string;
}

const steps: Step[] = [
  {
    target: 'paste',
    title: 'Paste a video',
    body: 'Drop in a YouTube link or a video ID, then press Load. Watch links, youtu.be links, and Shorts all work.',
    hint: 'Start here whenever you want a new song.',
  },
  {
    target: 'transport',
    title: 'Find the tricky part',
    body: 'Play, pause, and skip in five-second jumps until you reach the phrase you want to practice.',
    hint: 'Arrow keys seek once the player is loaded.',
  },
  {
    target: 'timeline',
    title: 'Mark it on the timeline',
    body: 'Drag A to the start of the phrase and B to the end. Clicking the timeline moves the playhead.',
    hint: 'The green region is the section you will repeat.',
  },
  {
    target: 'loop',
    title: 'Set A and B',
    body: 'Set A stores the current time as the start. Set B stores the end. Play loop jumps to A and keeps repeating.',
    hint: 'A and B on the keyboard do the same thing.',
  },
  {
    target: 'speed',
    title: 'Slow it down',
    body: 'Use the slider, the plus and minus buttons, or a preset. 0.75× is a comfortable place to start on a fast passage.',
    hint: 'You can change speed while the loop is running.',
  },
  {
    target: 'save',
    title: 'Save the loop',
    body: 'Save loop keeps the video, the A–B range, and the speed in this browser. Open it later from Saved.',
    hint: 'That is the whole practice loop.',
  },
];

export function Walkthrough() {
  const open = usePracticeState().walkthroughOpen;
  const [index, setIndex] = useState(0);
  const [trackedOpen, setTrackedOpen] = useState(open);
  if (open !== trackedOpen) {
    setTrackedOpen(open);
    if (open) setIndex(0);
  }
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [highlight, setHighlight] = useState<DOMRect | null>(null);
  const [place, setPlace] = useState({ top: 24, left: 16, width: 420 });
  const step = steps[index] ?? steps[0];

  useEffect(() => {
    if (hasSeenTour()) return;
    if (store.getState().videoId) return;
    const timer = window.setTimeout(() => {
      const state = store.getState();
      if (!state.walkthroughOpen && !state.settingsOpen) openWalkthrough();
    }, 600);
    return () => window.clearTimeout(timer);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;

    const measure = () => {
      const node = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      const rect = node?.getBoundingClientRect();
      const onScreen = Boolean(rect && rect.width > 8 && rect.height > 8 && rect.bottom > 48 && rect.top < window.innerHeight - 48);
      setHighlight(onScreen && rect ? rect : null);

      const card = dialogRef.current;
      const cardHeight = card?.offsetHeight ?? 280;
      const cardWidth = Math.min(420, window.innerWidth - 32);
      const narrow = window.innerWidth < 760;

      if (narrow) {
        setPlace({ top: Math.max(16, window.innerHeight - cardHeight - 16), left: 16, width: cardWidth });
        return;
      }

      if (!onScreen || !rect) {
        setPlace({
          top: Math.max(24, (window.innerHeight - cardHeight) / 2),
          left: Math.max(16, (window.innerWidth - cardWidth) / 2),
          width: cardWidth,
        });
        return;
      }

      let top = rect.bottom + 16;
      if (top + cardHeight > window.innerHeight - 16) top = rect.top - cardHeight - 16;
      if (top < 16) top = 16;
      let left = rect.left;
      if (left + cardWidth > window.innerWidth - 16) left = window.innerWidth - 16 - cardWidth;
      if (left < 16) left = 16;
      setPlace({ top, left, width: cardWidth });
    };

    const node = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    node?.scrollIntoView({ block: window.innerWidth < 760 ? 'start' : 'center', inline: 'nearest' });
    const frame = window.requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open, step.target, index]);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.querySelector<HTMLElement>('[data-tour-primary]')?.focus();

    const focusable = () =>
      [...(dialog?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea') ?? [])].filter(
        (element) => !element.hasAttribute('disabled'),
      );

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeWalkthrough();
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setIndex((current) => Math.min(steps.length - 1, current + 1));
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setIndex((current) => Math.max(0, current - 1));
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
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
    document.body.classList.add('tour-open');
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.classList.remove('tour-open');
      previouslyFocused?.focus();
    };
  }, [open, index]);

  if (!open) return null;

  const last = index === steps.length - 1;

  return (
    <div className="tour-root">
      <div className="tour-backdrop" />
      {highlight && (
        <div
          className="tour-ring"
          style={{
            top: highlight.top - 6,
            left: highlight.left - 6,
            width: highlight.width + 12,
            height: highlight.height + 12,
          }}
        />
      )}
      <div
        ref={dialogRef}
        id="tour-dialog"
        className="tour-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{ top: place.top, left: place.left, width: place.width }}
      >
        <div className="tour-card-head">
          <p className="section-label">
            Step {index + 1} of {steps.length}
          </p>
          <button className="text-btn" type="button" onClick={closeWalkthrough}>
            Skip
          </button>
        </div>
        <TourSketch target={step.target} />
        <h2 id={titleId}>{step.title}</h2>
        <p>{step.body}</p>
        <p className="tour-hint">{highlight ? step.hint : 'Load a video and this control appears under the player.'}</p>
        <div className="tour-dots" aria-hidden="true">
          {steps.map((item, dot) => (
            <span key={item.target} className={dot === index ? 'is-on' : ''} />
          ))}
        </div>
        <div className="tour-actions">
          <button className="btn" type="button" onClick={() => setIndex((current) => Math.max(0, current - 1))} disabled={index === 0}>
            Back
          </button>
          <button
            className="btn btn-primary"
            type="button"
            data-tour-primary
            onClick={() => {
              if (last) closeWalkthrough();
              else setIndex((current) => current + 1);
            }}
          >
            {last ? 'Start practicing' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TourSketch({ target }: { target: string }) {
  return (
    <svg className="tour-sketch" viewBox="0 0 320 72" aria-hidden="true">
      {target === 'paste' && (
        <>
          <rect x="8" y="20" width="230" height="32" rx="8" />
          <rect x="246" y="20" width="66" height="32" rx="8" className="is-fill" />
        </>
      )}
      {target === 'transport' && (
        <>
          <circle cx="36" cy="36" r="14" />
          <circle cx="72" cy="36" r="18" className="is-fill" />
          <circle cx="108" cy="36" r="14" />
          <rect x="140" y="28" width="92" height="8" rx="4" />
          <rect x="140" y="42" width="48" height="6" rx="3" />
        </>
      )}
      {target === 'timeline' && (
        <>
          <rect x="16" y="30" width="288" height="18" rx="6" />
          <rect x="78" y="30" width="130" height="18" className="is-fill" />
          <circle cx="78" cy="39" r="7" className="is-knob" />
          <circle cx="208" cy="39" r="7" className="is-knob" />
          <path d="M150 18v36" />
        </>
      )}
      {target === 'loop' && (
        <>
          <rect x="12" y="22" width="58" height="28" rx="8" />
          <rect x="78" y="22" width="58" height="28" rx="8" />
          <rect x="144" y="22" width="58" height="28" rx="8" />
          <rect x="214" y="22" width="94" height="28" rx="8" className="is-fill" />
        </>
      )}
      {target === 'speed' && (
        <>
          <rect x="16" y="32" width="288" height="6" rx="3" />
          <rect x="16" y="32" width="150" height="6" rx="3" className="is-fill" />
          <circle cx="166" cy="35" r="8" className="is-knob" />
          <rect x="118" y="50" width="84" height="12" rx="4" />
        </>
      )}
      {target === 'save' && (
        <>
          <rect x="16" y="12" width="200" height="10" rx="3" />
          <rect x="16" y="30" width="140" height="8" rx="3" />
          <rect x="16" y="46" width="92" height="16" rx="6" className="is-fill" />
        </>
      )}
    </svg>
  );
}
