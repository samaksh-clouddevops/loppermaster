export interface Metronome {
  start: () => void;
  stop: () => void;
  setBpm: (bpm: number) => void;
  setBeats: (beats: number) => void;
  setVolume: (volume: number) => void;
}

export function createMetronome(onBeat: (index: number, accent: boolean) => void): Metronome {
  let context: AudioContext | null = null;
  let timer = 0;
  let nextNote = 0;
  let beat = 0;
  let bpm = 120;
  let beatsPerBar = 4;
  let volume = 0.6;
  let running = false;

  function audio() {
    context ??= new AudioContext();
    return context;
  }

  function click(time: number, accent: boolean) {
    const output = audio();
    const oscillator = output.createOscillator();
    const gain = output.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(accent ? 1660 : 1040, time);
    const level = Math.max(0.001, (accent ? 0.85 : 0.5) * volume);
    gain.gain.setValueAtTime(level, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.045);
    oscillator.connect(gain);
    gain.connect(output.destination);
    oscillator.start(time);
    oscillator.stop(time + 0.05);
  }

  function schedule() {
    if (!running) return;
    const output = audio();
    while (nextNote < output.currentTime + 0.12) {
      const index = beat % beatsPerBar;
      const accent = index === 0;
      click(nextNote, accent);
      const delay = Math.max(0, (nextNote - output.currentTime) * 1000);
      window.setTimeout(() => {
        if (running) onBeat(index, accent);
      }, delay);
      beat += 1;
      nextNote += 60 / Math.max(30, bpm);
    }
    timer = window.setTimeout(schedule, 25);
  }

  return {
    start() {
      const output = audio();
      void output.resume();
      if (running) this.stop();
      running = true;
      beat = 0;
      nextNote = output.currentTime + 0.05;
      schedule();
    },
    stop() {
      running = false;
      window.clearTimeout(timer);
    },
    setBpm(value: number) {
      bpm = value;
    },
    setBeats(value: number) {
      beatsPerBar = Math.max(2, Math.round(value));
    },
    setVolume(value: number) {
      volume = Math.min(1, Math.max(0, value));
    },
  };
}
