export function audioBufferToWav(buffer: AudioBuffer, startSeconds = 0, endSeconds = buffer.duration): Blob {
  const sampleRate = buffer.sampleRate;
  const start = Math.max(0, Math.floor(startSeconds * sampleRate));
  const end = Math.min(buffer.length, Math.ceil(endSeconds * sampleRate));
  const frameCount = Math.max(0, end - start);
  const channels = buffer.numberOfChannels;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataSize = frameCount * blockAlign;
  const array = new ArrayBuffer(44 + dataSize);
  const view = new DataView(array);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const sample = buffer.getChannelData(channel)[start + frame] ?? 0;
      const clipped = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, clipped < 0 ? clipped * 0x8000 : clipped * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([array], { type: 'audio/wav' });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function exportLoopWav(buffer: AudioBuffer, start: number, end: number, filename: string) {
  const blob = audioBufferToWav(buffer, start, end);
  downloadBlob(blob, filename.endsWith('.wav') ? filename : `${filename}.wav`);
}

function writeString(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}
