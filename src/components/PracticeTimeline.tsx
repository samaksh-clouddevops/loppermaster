import {
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import { MIN_LOOP_GAP } from '../lib/range';
import { formatSpoken, formatTime, timelineTicks } from '../lib/time';
import { scrubTo, seekTo, setLoopBound, store, togglePlay } from '../state/store';
import { usePracticeState } from '../state/hooks';

function timeFromClientX(clientX: number, track: HTMLElement, duration: number) {
  const rect = track.getBoundingClientRect();
  if (rect.width <= 0 || duration <= 0) return 0;
  const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  return ratio * duration;
}

export function PracticeTimeline() {
  const { duration, loopStart, loopEnd, loopEnabled } = usePracticeState();
  const trackRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLButtonElement>(null);
  const [hover, setHover] = useState<{ x: number; time: number } | null>(null);
  const dragging = useRef(false);
  const ticks = timelineTicks(duration);
  const span = Math.max(duration, 0.001);
  const regionStart = (loopStart / span) * 100;
  const regionWidth = (Math.max(loopEnd - loopStart, 0) / span) * 100;

  useLayoutEffect(() => {
    const write = () => {
      const state = store.getState();
      const length = state.duration || 1;
      const ratio = Math.min(1, Math.max(0, state.currentTime / length));
      if (progressRef.current) progressRef.current.style.width = `${ratio * 100}%`;
      if (playheadRef.current) {
        playheadRef.current.style.left = `${ratio * 100}%`;
        playheadRef.current.setAttribute('aria-valuenow', state.currentTime.toFixed(1));
        playheadRef.current.setAttribute('aria-valuetext', formatSpoken(state.currentTime));
      }
    };
    write();
    return store.subscribeTime(write);
  }, [duration]);

  function scrubFrom(clientX: number, commit: boolean) {
    const track = trackRef.current;
    if (!track) return;
    scrubTo(timeFromClientX(clientX, track, duration), commit);
  }

  function onTrackPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.closest('.handle, .playhead')) return;
    const track = event.currentTarget;
    try {
      track.setPointerCapture(event.pointerId);
    } catch {
      /* Capture can fail before the pointer is active. Listening still tracks the drag. */
    }
    dragging.current = true;
    setHover(null);
    scrubFrom(event.clientX, false);

    function onMove(moveEvent: PointerEvent) {
      scrubFrom(moveEvent.clientX, false);
    }
    function onUp(upEvent: PointerEvent) {
      dragging.current = false;
      scrubFrom(upEvent.clientX, true);
      track.removeEventListener('pointermove', onMove);
      track.removeEventListener('pointerup', onUp);
    }
    track.addEventListener('pointermove', onMove);
    track.addEventListener('pointerup', onUp);
  }

  function onTrackPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse' || dragging.current || duration <= 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.min(rect.width, Math.max(0, event.clientX - rect.left));
    setHover({ x, time: timeFromClientX(event.clientX, event.currentTarget, duration) });
  }

  return (
    <section className="timeline" aria-labelledby="timeline-label">
      <div className="timeline-meta">
        <span>{formatTime(0)}</span>
        <p id="timeline-label" className="timeline-mid">
          <span>A {formatTime(loopStart, true)}</span>
          <span>B {formatTime(loopEnd, true)}</span>
          <span>Length {formatTime(Math.max(0, loopEnd - loopStart), true)}</span>
          <span>{loopEnabled ? 'Loop on' : 'Loop off'}</span>
        </p>
        <span>{formatTime(duration)}</span>
      </div>
      <div
        className="track"
        ref={trackRef}
        onPointerDown={onTrackPointerDown}
        onPointerMove={onTrackPointerMove}
        onPointerLeave={() => setHover(null)}
      >
        <div className="lane" aria-hidden="true">
          {ticks.map((tick) => (
            <span key={tick} className="tick" style={{ left: `${(tick / span) * 100}%` }} />
          ))}
          <div ref={progressRef} className="progress" />
          <div
            className={loopEnabled ? 'loop-region is-on' : 'loop-region'}
            style={{ left: `${regionStart}%`, width: `${regionWidth}%` }}
          >
            {regionWidth > 14 && <span className="loop-chip">{loopEnabled ? 'Looping' : 'Loop'}</span>}
          </div>
        </div>
        {hover && (
          <span className="hover-tip" style={{ left: hover.x }} aria-hidden="true">
            {formatTime(hover.time, true)}
          </span>
        )}
        <Playhead playheadRef={playheadRef} duration={duration} />
        <LoopStartHandle duration={duration} value={loopStart} end={loopEnd} />
        <LoopEndHandle duration={duration} value={loopEnd} start={loopStart} />
      </div>
      <p className="sr-only">
        Drag along the timeline to seek. Drag A or B to change the loop, or use the Set A and Set B buttons. Arrow keys move a focused handle.
      </p>
    </section>
  );
}

function Playhead({
  playheadRef,
  duration,
}: {
  playheadRef: RefObject<HTMLButtonElement | null>;
  duration: number;
}) {
  function onPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    event.stopPropagation();
    const handle = event.currentTarget;
    const track = handle.parentElement;
    if (!track) return;
    try {
      handle.setPointerCapture(event.pointerId);
    } catch {
      /* Capture can fail before the pointer is active. Listening still tracks the drag. */
    }
    const seek = (clientX: number, commit: boolean) => {
      scrubTo(timeFromClientX(clientX, track, duration), commit);
    };
    seek(event.clientX, false);
    function onMove(moveEvent: PointerEvent) {
      seek(moveEvent.clientX, false);
    }
    function onUp(upEvent: PointerEvent) {
      seek(upEvent.clientX, true);
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
    }
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const direction = event.key === 'ArrowLeft' ? -1 : 1;
      seekTo(store.getState().currentTime + direction * (event.shiftKey ? 1 : 5));
    } else if (event.key === 'Home') {
      event.preventDefault();
      seekTo(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      seekTo(duration);
    } else if (event.key === ' ') {
      event.preventDefault();
      togglePlay();
    }
  }

  return (
    <button
      ref={playheadRef}
      className="playhead"
      type="button"
      role="slider"
      aria-label="Playback position"
      aria-orientation="horizontal"
      aria-valuemin={0}
      aria-valuemax={Math.max(0, duration)}
      aria-valuenow={Number(store.getState().currentTime.toFixed(1))}
      aria-valuetext={formatSpoken(store.getState().currentTime)}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    >
      <span className="playhead-line" />
    </button>
  );
}

function LoopStartHandle({ duration, value, end }: { duration: number; value: number; end: number }) {
  return (
    <LoopHandle
      edge="start"
      label="A"
      className="handle handle-a"
      value={value}
      duration={duration}
      ariaValueMax={Math.max(0, end - MIN_LOOP_GAP)}
    />
  );
}

function LoopEndHandle({ duration, value, start }: { duration: number; value: number; start: number }) {
  return (
    <LoopHandle
      edge="end"
      label="B"
      className="handle handle-b"
      value={value}
      duration={duration}
      ariaValueMin={start + MIN_LOOP_GAP}
    />
  );
}

function LoopHandle({
  edge,
  label,
  className,
  value,
  duration,
  ariaValueMin = 0,
  ariaValueMax,
}: {
  edge: 'start' | 'end';
  label: string;
  className: string;
  value: number;
  duration: number;
  ariaValueMin?: number;
  ariaValueMax?: number;
}) {
  const [draggingHandle, setDraggingHandle] = useState(false);

  function onPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    event.stopPropagation();
    const handle = event.currentTarget;
    const track = handle.parentElement;
    if (!track) return;
    try {
      handle.setPointerCapture(event.pointerId);
    } catch {
      /* Capture can fail before the pointer is active. Listening still tracks the drag. */
    }
    setDraggingHandle(true);
    const move = (clientX: number, commit: boolean) => {
      setLoopBound(edge, timeFromClientX(clientX, track, duration), commit);
    };
    move(event.clientX, false);
    function onMove(moveEvent: PointerEvent) {
      move(moveEvent.clientX, false);
    }
    function onUp(upEvent: PointerEvent) {
      setDraggingHandle(false);
      move(upEvent.clientX, true);
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
    }
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    const step = event.shiftKey ? 1 : 0.1;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setLoopBound(edge, value - step, true);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      setLoopBound(edge, value + step, true);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setLoopBound(edge, edge === 'start' ? 0 : store.getState().loopStart + MIN_LOOP_GAP, true);
    } else if (event.key === 'End') {
      event.preventDefault();
      setLoopBound(edge, edge === 'end' ? duration : store.getState().loopEnd - MIN_LOOP_GAP, true);
    }
  }

  return (
    <button
      type="button"
      className={draggingHandle ? `${className} is-dragging` : className}
      style={{ left: `${(value / Math.max(duration, 0.001)) * 100}%` }}
      role="slider"
      aria-label={edge === 'start' ? 'Loop start' : 'Loop end'}
      aria-orientation="horizontal"
      aria-valuemin={ariaValueMin}
      aria-valuemax={ariaValueMax ?? duration}
      aria-valuenow={Number(value.toFixed(1))}
      aria-valuetext={`${label}, ${formatSpoken(value)}`}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    >
      <span className="handle-flag">{label}</span>
      <span className="handle-stem" />
      <span className="handle-knob" />
    </button>
  );
}
