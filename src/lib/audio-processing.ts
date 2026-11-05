const minimumSignalPeak = 0.008;
const trimThresholdFloor = 0.004;
const trimPaddingSeconds = 0.12;
const maximumSampleSeconds = 11;
const targetPeak = 0.9;

export function prepareVoicePcm(channels: readonly Float32Array[], sampleRate: number): Float32Array {
  if (!channels.length || !Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new Error('The recording could not be processed.');
  }
  const length = Math.min(...channels.map((channel) => channel.length));
  if (!length) throw new Error('The recording is empty.');

  const mono = new Float32Array(length);
  let peak = 0;
  for (let index = 0; index < length; index += 1) {
    let mixed = 0;
    for (const channel of channels) mixed += channel[index] ?? 0;
    const sample = mixed / channels.length;
    mono[index] = sample;
    peak = Math.max(peak, Math.abs(sample));
  }
  if (peak < minimumSignalPeak) throw new Error('No clear speech was detected.');

  const threshold = Math.max(trimThresholdFloor, peak * 0.018);
  let start = 0;
  while (start < mono.length && Math.abs(mono[start]) < threshold) start += 1;
  let end = mono.length - 1;
  while (end > start && Math.abs(mono[end]) < threshold) end -= 1;

  const padding = Math.round(sampleRate * trimPaddingSeconds);
  start = Math.max(0, start - padding);
  end = Math.min(mono.length, end + padding + 1);
  end = Math.min(end, start + Math.round(sampleRate * maximumSampleSeconds));

  const prepared = mono.slice(start, end);
  let preparedPeak = 0;
  for (const sample of prepared) preparedPeak = Math.max(preparedPeak, Math.abs(sample));
  const gain = Math.min(6, targetPeak / preparedPeak);
  const fadeSamples = Math.min(Math.round(sampleRate * 0.008), Math.floor(prepared.length / 2));
  for (let index = 0; index < prepared.length; index += 1) {
    const fadeIn = fadeSamples ? Math.min(1, index / fadeSamples) : 1;
    const fadeOut = fadeSamples ? Math.min(1, (prepared.length - 1 - index) / fadeSamples) : 1;
    prepared[index] = Math.max(-1, Math.min(1, prepared[index] * gain * fadeIn * fadeOut));
  }
  return prepared;
}

export function encodePcmWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const write = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  write(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  samples.forEach((sample, index) => {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(44 + index * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  });
  return buffer;
}
