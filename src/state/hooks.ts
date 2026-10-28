import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { View } from '../types';
import { store, takeViewFocus } from './store';

export function usePracticeState() {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

export function usePracticeTime() {
  return useSyncExternalStore(
    store.subscribeTime,
    () => store.getState().currentTime,
    () => store.getState().currentTime,
  );
}

export function useFocusHeading(view: View, active: boolean) {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (active && takeViewFocus(view)) ref.current?.focus();
  }, [active, view]);

  return ref;
}
