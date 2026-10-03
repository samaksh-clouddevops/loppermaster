import { scaleNotes } from './getsongbpm';
import { practiceQueries, type SongQuery } from './songQuery';

export interface PreviewAnalysis {
  title: string;
  artist: string;
  bpm: number;
  keyName: string;
  notes: string[];
  pageUrl: string;
}

interface PreviewHit {
  trackName?: string;
  artistName?: string;
  previewUrl?: string;
  trackViewUrl?: string;
}

const MAJOR = [5, 2, 3.5, 2, 4.5, 4, 2, 4.5, 2, 3.5, 1.5, 4];
const MINOR = [5, 2, 3.5, 4.5, 2, 4, 2, 4.5, 3.5, 2, 1.5, 4];
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function titleHit(hit: PreviewHit, query: SongQuery) {
  const title = (hit.trackName ?? '').toLowerCase();
  const artist = (hit.artistName ?? '').toLowerCase();
  const song = query.song.toLowerCase();
  const wantedArtist = query.artist.toLowerCase();
  if (!hit.previewUrl || !song || !title.includes(song)) return false;
  if (!wantedArtist) return true;
  return artist.includes(wantedArtist.split(' ')[0] ?? wantedArtist);
}

async function findPreview(query: SongQuery): Promise<PreviewHit | null> {
  const term = `${query.artist} ${query.song}`.trim();
  if (!term) return null;
  const response = await fetch(
    `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=8`,
  );
  if (!response.ok) return null;
  const payload = (await response.json()) as { results?: PreviewHit[] };
  const results = payload.results ?? [];
  return results.find((hit) => titleHit(hit, query)) ?? results.find((hit) => hit.previewUrl) ?? null;
}

function mono(buffer: AudioBuffer) {
  const length = buffer.length;
  const mixed = new Float32Array(length);
  const channels = [];
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) channels.push(buffer.getChannelData(channel));
  for (let index = 0; index < length; index += 1) {
    let sum = 0;
    for (const channel of channels) sum += channel[index] ?? 0;
    mixed[index] = sum / channels.length;
  }
  return mixed;
}

function spectralFlux(samples: Float32Array, sampleRate: number) {
  const size = 2048;
  const hop = 512;
  const frames = Math.max(0, Math.floor((samples.length - size) / hop));
  const flux = new Float32Array(frames);
  const real = new Float32Array(size);
  const imag = new Float32Array(size);
  let previous: Float32Array | null = null;
  const lowestBin = Math.ceil((200 * size) / sampleRate);
  for (let frame = 0; frame < frames; frame += 1) {
    const start = frame * hop;
    for (let index = 0; index < size; index += 1) {
      const hann = 0.5 * (1 - Math.cos((2 * Math.PI * index) / (size - 1)));
      real[index] = (samples[start + index] ?? 0) * hann;
      imag[index] = 0;
    }
    fft(real, imag);
    const magnitude = new Float32Array(size / 2);
    for (let bin = lowestBin; bin < size / 2; bin += 1) {
      magnitude[bin] = Math.hypot(real[bin] ?? 0, imag[bin] ?? 0);
    }
    if (previous) {
      let rise = 0;
      for (let bin = lowestBin; bin < magnitude.length; bin += 1) {
        const delta = (magnitude[bin] ?? 0) - (previous[bin] ?? 0);
        if (delta > 0) rise += delta;
      }
      flux[frame] = rise;
    }
    previous = magnitude;
  }
  let mean = 0;
  for (const value of flux) mean += value;
  mean /= flux.length || 1;
  for (let index = 0; index < flux.length; index += 1) flux[index] = Math.max(0, (flux[index] ?? 0) - mean);
  return { flux, hop };
}

export function detectBpmFromChannel(samples: Float32Array, sampleRate: number) {
  const { flux, hop } = spectralFlux(samples, sampleRate);
  const hopSeconds = hop / sampleRate;
  const minLag = Math.max(1, Math.round(60 / 180 / hopSeconds));
  const maxLag = Math.min(flux.length - 1, Math.round(60 / 70 / hopSeconds));
  let bestLag = minLag;
  let bestScore = -1;
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let score = 0;
    const overlaps = flux.length - lag;
    for (let index = 0; index < overlaps; index += 1) score += (flux[index] ?? 0) * (flux[index + lag] ?? 0);
    const bpm = 60 / (lag * hopSeconds);
    const preferred = Math.exp(-0.5 * ((bpm - 115) / 48) ** 2);
    score = (score / (overlaps || 1)) * preferred;
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }
  return Math.round(60 / (bestLag * hopSeconds));
}

function fft(real: Float32Array, imag: Float32Array) {
  const size = real.length;
  for (let index = 1, reversed = 0; index < size; index += 1) {
    let bit = size >> 1;
    for (; reversed & bit; bit >>= 1) reversed ^= bit;
    reversed ^= bit;
    if (index < reversed) {
      const realSwap = real[index] ?? 0;
      real[index] = real[reversed] ?? 0;
      real[reversed] = realSwap;
      const imagSwap = imag[index] ?? 0;
      imag[index] = imag[reversed] ?? 0;
      imag[reversed] = imagSwap;
    }
  }
  for (let length = 2; length <= size; length <<= 1) {
    const angle = (-2 * Math.PI) / length;
    const stepReal = Math.cos(angle);
    const stepImag = Math.sin(angle);
    for (let start = 0; start < size; start += length) {
      let twiddleReal = 1;
      let twiddleImag = 0;
      for (let offset = 0; offset < length / 2; offset += 1) {
        const evenReal = real[start + offset] ?? 0;
        const evenImag = imag[start + offset] ?? 0;
        const oddReal = real[start + offset + length / 2] ?? 0;
        const oddImag = imag[start + offset + length / 2] ?? 0;
        const mixedReal = oddReal * twiddleReal - oddImag * twiddleImag;
        const mixedImag = oddReal * twiddleImag + oddImag * twiddleReal;
        real[start + offset] = evenReal + mixedReal;
        imag[start + offset] = evenImag + mixedImag;
        real[start + offset + length / 2] = evenReal - mixedReal;
        imag[start + offset + length / 2] = evenImag - mixedImag;
        const nextReal = twiddleReal * stepReal - twiddleImag * stepImag;
        twiddleImag = twiddleReal * stepImag + twiddleImag * stepReal;
        twiddleReal = nextReal;
      }
    }
  }
}

function correlation(chroma: Float64Array, profile: number[], root: number) {
  const shifted = new Float64Array(12);
  for (let pitch = 0; pitch < 12; pitch += 1) shifted[pitch] = chroma[(root + pitch) % 12] ?? 0;
  let chromaMean = 0;
  let profileMean = 0;
  for (let pitch = 0; pitch < 12; pitch += 1) {
    chromaMean += shifted[pitch] ?? 0;
    profileMean += profile[pitch] ?? 0;
  }
  chromaMean /= 12;
  profileMean /= 12;
  let product = 0;
  let chromaEnergy = 0;
  let profileEnergy = 0;
  for (let pitch = 0; pitch < 12; pitch += 1) {
    const chromaDelta = (shifted[pitch] ?? 0) - chromaMean;
    const profileDelta = (profile[pitch] ?? 0) - profileMean;
    product += chromaDelta * profileDelta;
    chromaEnergy += chromaDelta * chromaDelta;
    profileEnergy += profileDelta * profileDelta;
  }
  return product / Math.sqrt(chromaEnergy * profileEnergy || 1);
}

export function detectKeyFromChannel(samples: Float32Array, sampleRate: number) {
  const size = 8192;
  const hop = 8192;
  const chroma = new Float64Array(12);
  const real = new Float32Array(size);
  const imag = new Float32Array(size);
  const lowestBin = Math.ceil((65 * size) / sampleRate);
  const highestBin = Math.floor((500 * size) / sampleRate);
  for (let start = 0; start + size < samples.length; start += hop) {
    for (let index = 0; index < size; index += 1) {
      const hann = 0.5 * (1 - Math.cos((2 * Math.PI * index) / (size - 1)));
      real[index] = (samples[start + index] ?? 0) * hann;
      imag[index] = 0;
    }
    fft(real, imag);
    for (let bin = lowestBin; bin <= highestBin; bin += 1) {
      const frequency = (bin * sampleRate) / size;
      const midi = 69 + 12 * Math.log2(frequency / 440);
      const wrapped = ((midi % 12) + 12) % 12;
      const lower = Math.floor(wrapped);
      const fraction = wrapped - lower;
      const weight = Math.hypot(real[bin] ?? 0, imag[bin] ?? 0);
      chroma[lower % 12] = (chroma[lower % 12] ?? 0) + weight * (1 - fraction);
      chroma[(lower + 1) % 12] = (chroma[(lower + 1) % 12] ?? 0) + weight * fraction;
    }
  }
  let bestName = 'C major';
  let bestScore = -Infinity;
  for (let root = 0; root < 12; root += 1) {
    const major = correlation(chroma, MAJOR, root);
    const minor = correlation(chroma, MINOR, root);
    if (major > bestScore) {
      bestScore = major;
      bestName = `${NAMES[root]} major`;
    }
    if (minor > bestScore) {
      bestScore = minor;
      bestName = `${NAMES[root]} minor`;
    }
  }
  return { keyName: bestName, notes: scaleNotes(bestName) };
}

export async function analyzePreview(videoTitle: string, videoArtist: string): Promise<PreviewAnalysis | null> {
  const queries = practiceQueries(videoTitle, videoArtist).filter((query) => query.song);
  for (const query of queries) {
    try {
      const hit = await findPreview(query);
      if (!hit?.previewUrl) continue;
      const response = await fetch(hit.previewUrl);
      if (!response.ok) continue;
      const bytes = await response.arrayBuffer();
      const context = new AudioContext();
      try {
        const decoded = await context.decodeAudioData(bytes.slice(0));
        const samples = mono(decoded);
        const bpm = detectBpmFromChannel(samples, decoded.sampleRate);
        const key = detectKeyFromChannel(samples, decoded.sampleRate);
        if (bpm < 40 || bpm > 220) continue;
        return {
          title: hit.trackName?.trim() || query.song,
          artist: hit.artistName?.trim() || query.artist,
          bpm,
          keyName: key.keyName,
          notes: key.notes,
          pageUrl: hit.trackViewUrl || 'https://music.apple.com/',
        };
      } finally {
        await context.close();
      }
    } catch {
      /* Try the next title variation. */
    }
  }
  return null;
}
