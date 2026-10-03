export const MIN_RATE = 0.25;
export const MAX_RATE = 2;
export const RATE_STEP = 0.05;
export const MIN_LOOP_GAP = 0.2;
export const SPEED_PRESETS = [0.5, 0.75, 1, 1.25, 1.5] as const;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function roundRate(value: number): number {
  return Math.round(value * 20) / 20;
}

export function nearestRate(value: number, rates: number[]): number {
  return rates.reduce((best, rate) =>
    Math.abs(rate - value) < Math.abs(best - value) ? rate : best,
  );
}

export function orderLoop(start: number, end: number, duration: number) {
  const limit = duration > 0 ? duration : Math.max(start, end, MIN_LOOP_GAP);
  let loopStart = clamp(Math.min(start, end), 0, limit);
  let loopEnd = clamp(Math.max(start, end), 0, limit);
  if (loopEnd - loopStart < MIN_LOOP_GAP) {
    loopEnd = Math.min(limit, loopStart + MIN_LOOP_GAP);
  }
  if (loopEnd - loopStart < MIN_LOOP_GAP) {
    loopStart = Math.max(0, loopEnd - MIN_LOOP_GAP);
  }
  return { loopStart, loopEnd };
}
