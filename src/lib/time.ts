export function formatTime(seconds: number, tenths = false): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const units = Math.round(safe * (tenths ? 10 : 1));
  const wholeSeconds = tenths ? Math.floor(units / 10) : units;
  const tenth = tenths ? units % 10 : 0;
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const secs = wholeSeconds % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  const clock = hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
  return tenths ? `${clock}.${tenth}` : clock;
}

export function formatSpoken(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const tenths = Math.round(safe * 10);
  const whole = Math.floor(tenths / 10);
  const fraction = tenths % 10;
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const secs = whole % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`);
  parts.push(`${secs}.${fraction} seconds`);
  return parts.join(' ');
}

export function formatRate(rate: number): string {
  return `${rate.toFixed(2)}×`;
}

export function formatWhen(timestamp: number): string {
  const diff = Math.max(0, Date.now() - timestamp);
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function timelineTicks(duration: number): number[] {
  if (duration <= 0) return [];
  const candidates = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
  const step = candidates.find((candidate) => duration / candidate <= 8) ?? 600;
  const ticks: number[] = [];
  for (let time = 0; time <= duration + 0.001; time += step) {
    ticks.push(Math.min(time, duration));
  }
  const last = ticks[ticks.length - 1];
  if (last !== undefined && duration - last > step * 0.35 && last !== duration) {
    ticks.push(duration);
  }
  return ticks;
}
