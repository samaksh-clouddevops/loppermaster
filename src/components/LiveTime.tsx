import { useLayoutEffect, useRef } from 'react';
import { formatTime } from '../lib/time';
import { store } from '../state/store';

export function LiveTime({ tenths = false, className }: { tenths?: boolean; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const write = () => {
      if (ref.current) ref.current.textContent = formatTime(store.getState().currentTime, tenths);
    };
    write();
    return store.subscribeTime(write);
  }, [tenths]);

  return (
    <span ref={ref} className={className}>
      {formatTime(store.getState().currentTime, tenths)}
    </span>
  );
}
