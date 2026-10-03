import { useEffect, useRef, type RefObject } from 'react';
import { MIN_LOOP_GAP } from '../lib/range';
import { fetchOEmbed, loadYouTubeApi, playerErrorMessage, type YouTubePlayer } from '../lib/youtube';
import {
  applyMetadata,
  bindEngine,
  markError,
  markReady,
  noteDuration,
  reportAppliedRate,
  store,
} from '../state/store';

export function useYouTubePlayer(hostRef: RefObject<HTMLDivElement | null>, videoId: string | null, loadToken: number) {
  const playerRef = useRef<YouTubePlayer | null>(null);

  useEffect(() => {
    if (!videoId || !hostRef.current) return;
    const host = hostRef.current;
    const activeId = videoId;
    let cancelled = false;
    let player: YouTubePlayer | null = null;
    let pollId = 0;
    let rafId = 0;
    let rateTimer = 0;
    const playingRef = { current: false };
    const stateRef = { current: store.getState() };
    let lastPolled = store.getState().currentTime;
    let lastPollAt = performance.now();
    let loopLockedUntil = 0;

    const syncState = () => {
      stateRef.current = store.getState();
    };
    syncState();
    const unsubscribe = store.subscribe(syncState);
    const unsubscribeTime = store.subscribeTime(syncState);

    const target = document.createElement('div');
    target.className = 'player-target';
    host.appendChild(target);

    const enforceLoop = (time: number) => {
      const state = stateRef.current;
      if (!state.loopEnabled || state.loopEnd - state.loopStart < MIN_LOOP_GAP) return time;
      const now = performance.now();
      if (time >= state.loopEnd - 0.04) {
        if (now < loopLockedUntil) return state.loopStart;
        loopLockedUntil = now + 360;
        player?.seekTo(state.loopStart, true);
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
      if (!player || document.hidden || store.isScrubbing) return;
      if (performance.now() < store.ignorePollUntil) return;
      try {
        const raw = player.getCurrentTime() || 0;
        lastPolled = raw;
        lastPollAt = performance.now();
        publish(raw);
        const duration = player.getDuration() || 0;
        if (duration > 0) noteDuration(duration);
      } catch {
        /* Player can throw while it is being replaced. */
      }
    };

    const frame = () => {
      rafId = window.requestAnimationFrame(frame);
      if (!playingRef.current || document.hidden || store.isScrubbing) return;
      const elapsed = Math.min(0.3, (performance.now() - lastPollAt) / 1000);
      const predicted = lastPolled + elapsed * (stateRef.current.playbackRate || 1);
      publish(predicted);
    };

    const scheduleRateCheck = (requested: number) => {
      window.clearTimeout(rateTimer);
      rateTimer = window.setTimeout(() => {
        if (cancelled || !player) return;
        try {
          reportAppliedRate(requested, player.getPlaybackRate());
        } catch {
          /* Ignore readback while the player is closing. */
        }
      }, 180);
    };

    const timeout = window.setTimeout(() => {
      if (!cancelled && store.getState().status === 'loading' && store.getState().videoId === activeId) {
        markError("We couldn't load this video. Try again.");
      }
    }, 15000);

    fetchOEmbed(activeId)
      .then((result) => {
        if (!cancelled && result) applyMetadata(activeId, result);
      })
      .catch(() => undefined);

    loadYouTubeApi()
      .then(() => {
        if (cancelled || !host.isConnected || !window.YT?.Player) {
          if (!cancelled) markError("We couldn't load this video. Try again.");
          return;
        }

        player = new window.YT.Player(target, {
          videoId: activeId,
          width: '100%',
          height: '100%',
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            iv_load_policy: 3,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              if (cancelled || !player) return;
              window.clearTimeout(timeout);
              const state = store.getState();
              try {
                player.setPlaybackRate(state.playbackRate);
                player.setVolume(state.muted ? 0 : state.volume);
                if (state.muted) player.mute();
                else player.unMute();
                if (state.loopStart > 0) player.seekTo(state.loopStart, true);
                const data = player.getVideoData() || {};
                const rates = player.getAvailablePlaybackRates?.() || [];
                markReady({
                  title: data.title || '',
                  author: data.author || '',
                  duration: player.getDuration() || 0,
                  availableRates: rates,
                });
                scheduleRateCheck(state.playbackRate);
                player.playVideo();
              } catch {
                markError("We couldn't load this video. Try again.");
              }
            },
            onStateChange: (event) => {
              if (cancelled) return;
              if (event.data === 1) {
                playingRef.current = true;
                store.set({ isPlaying: true });
                try {
                  player?.setPlaybackRate(store.getState().playbackRate);
                } catch {
                  /* Rate can be applied again on the next interaction. */
                }
              } else if (event.data === 2 || event.data === 0) {
                playingRef.current = false;
                store.set({ isPlaying: false });
              }
              if (event.data === 0 && store.getState().loopEnabled && player) {
                const start = store.getState().loopStart;
                player.seekTo(start, true);
                player.playVideo();
                playingRef.current = true;
                lastPolled = start;
                lastPollAt = performance.now();
                store.set({ isPlaying: true });
              }
            },
            onError: (event) => {
              if (cancelled) return;
              window.clearTimeout(timeout);
              markError(playerErrorMessage(event.data));
            },
          },
        });
        if (cancelled) {
          try {
            player.destroy();
          } catch {
            /* Ignore a player closed during setup. */
          }
          return;
        }
        playerRef.current = player;

        bindEngine({
          seek: (seconds) => {
            player?.seekTo(seconds, true);
            lastPolled = seconds;
            lastPollAt = performance.now();
          },
          play: () => player?.playVideo(),
          pause: () => player?.pauseVideo(),
          setRate: (rate) => {
            try {
              player?.setPlaybackRate(rate);
              scheduleRateCheck(rate);
            } catch {
              /* Player may not accept a rate until playback starts. */
            }
          },
          setVolume: (volume) => player?.setVolume(volume),
          mute: () => player?.mute(),
          unmute: () => player?.unMute(),
        });

        pollId = window.setInterval(poll, 100);
        rafId = window.requestAnimationFrame(frame);
      })
      .catch(() => {
        if (!cancelled) markError("We couldn't load this video. Try again.");
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      window.clearTimeout(rateTimer);
      window.clearInterval(pollId);
      window.cancelAnimationFrame(rafId);
      unsubscribe();
      unsubscribeTime();
      bindEngine(null);
      playingRef.current = false;
      try {
        player?.destroy();
      } catch {
        /* The iframe may already be gone. */
      }
      host.replaceChildren();
    };
  }, [hostRef, loadToken, videoId]);
}
