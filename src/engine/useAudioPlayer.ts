import { useEffect, useRef } from 'react';
import { MIN_LOOP_GAP } from '../lib/range';
import { bindEngine, markError, markReady, noteDuration, store } from '../state/store';

export function useAudioPlayer(objectUrl: string | null, mediaId: string | null, loadToken: number) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!objectUrl || !mediaId) return;
    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = objectUrl;
    audio.preservesPitch = true;
    // Safari still uses the prefixed form.
    (audio as HTMLAudioElement & { mozPreservesPitch?: boolean }).mozPreservesPitch = true;
    (audio as HTMLAudioElement & { webkitPreservesPitch?: boolean }).webkitPreservesPitch = true;
    audioRef.current = audio;

    let cancelled = false;
    let pollId = 0;
    let rafId = 0;
    let loopLockedUntil = 0;
    const playingRef = { current: false };
    const stateRef = { current: store.getState() };
    let lastPolled = store.getState().currentTime;
    let lastPollAt = performance.now();

    const syncState = () => {
      stateRef.current = store.getState();
    };
    syncState();
    const unsubscribe = store.subscribe(syncState);
    const unsubscribeTime = store.subscribeTime(syncState);

    const enforceLoop = (time: number) => {
      const state = stateRef.current;
      if (!state.loopEnabled || state.loopEnd - state.loopStart < MIN_LOOP_GAP) return time;
      const now = performance.now();
      if (time >= state.loopEnd - 0.04) {
        if (now < loopLockedUntil) return state.loopStart;
        loopLockedUntil = now + 360;
        audio.currentTime = state.loopStart;
        lastPolled = state.loopStart;
        lastPollAt = now;
        store.ignorePollUntil = now + 360;
        return state.loopStart;
      }
      return time;
    };

    const publish = (time: number) => {
      if (store.isScrubbing) return;
      const duration = stateRef.current.duration;
      const capped = duration > 0 ? Math.min(time, duration + 0.05) : time;
      store.setTime(enforceLoop(Math.max(0, capped)));
    };

    const poll = () => {
      if (document.hidden || store.isScrubbing) return;
      if (performance.now() < store.ignorePollUntil) return;
      lastPolled = audio.currentTime || 0;
      lastPollAt = performance.now();
      publish(lastPolled);
      if (audio.duration && Number.isFinite(audio.duration)) noteDuration(audio.duration);
    };

    const tick = () => {
      if (!playingRef.current) return;
      if (!store.isScrubbing && performance.now() >= store.ignorePollUntil) {
        const elapsed = (performance.now() - lastPollAt) / 1000;
        const rate = stateRef.current.playbackRate || 1;
        publish(lastPolled + elapsed * rate);
      }
      rafId = window.requestAnimationFrame(tick);
    };

    const applyVolume = () => {
      const state = store.getState();
      audio.muted = state.muted;
      audio.volume = Math.max(0, Math.min(1, state.volume / 100));
    };

    bindEngine({
      seek: (seconds) => {
        audio.currentTime = Math.max(0, seconds);
        lastPolled = audio.currentTime;
        lastPollAt = performance.now();
      },
      play: () => {
        void audio.play().catch(() => undefined);
      },
      pause: () => {
        audio.pause();
      },
      setRate: (rate) => {
        audio.playbackRate = rate;
        audio.preservesPitch = true;
      },
      setVolume: (volume) => {
        audio.volume = Math.max(0, Math.min(1, volume / 100));
      },
      mute: () => {
        audio.muted = true;
      },
      unmute: () => {
        audio.muted = false;
      },
    });

    const onReady = () => {
      if (cancelled || store.getState().videoId !== mediaId) return;
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      const state = store.getState();
      audio.playbackRate = state.playbackRate;
      audio.preservesPitch = true;
      applyVolume();
      markReady({
        title: state.videoTitle || state.localFileName || 'Local audio',
        author: state.author || 'Local file',
        duration,
        availableRates: [],
      });
      if (state.currentTime > 0) audio.currentTime = state.currentTime;
      if (state.loopEnabled || state.isPlaying) {
        void audio.play().catch(() => undefined);
      }
      pollId = window.setInterval(poll, 100);
    };

    const onPlay = () => {
      playingRef.current = true;
      lastPolled = audio.currentTime || 0;
      lastPollAt = performance.now();
      store.set({ isPlaying: true });
      window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(tick);
    };

    const onPause = () => {
      playingRef.current = false;
      window.cancelAnimationFrame(rafId);
      store.set({ isPlaying: false });
      publish(audio.currentTime || 0);
    };

    const onEnded = () => {
      const state = stateRef.current;
      if (state.loopEnabled && state.loopEnd - state.loopStart >= MIN_LOOP_GAP) {
        audio.currentTime = state.loopStart;
        void audio.play().catch(() => undefined);
        return;
      }
      playingRef.current = false;
      window.cancelAnimationFrame(rafId);
      store.set({ isPlaying: false });
      publish(audio.currentTime || 0);
    };

    const onError = () => {
      if (cancelled || store.getState().videoId !== mediaId) return;
      markError('We could not play that audio file. Try another MP3, WAV, or FLAC.');
    };

    audio.addEventListener('loadedmetadata', onReady);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    audio.load();

    return () => {
      cancelled = true;
      unsubscribe();
      unsubscribeTime();
      window.clearInterval(pollId);
      window.cancelAnimationFrame(rafId);
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      audioRef.current = null;
      if (store.getState().videoId === mediaId) bindEngine(null);
    };
  }, [loadToken, mediaId, objectUrl]);
}
