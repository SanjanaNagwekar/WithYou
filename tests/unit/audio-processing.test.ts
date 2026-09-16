import { describe, expect, it } from 'vitest';
import { encodePcmWav, prepareVoicePcm } from '@/lib/audio-processing';

describe('voice recording preparation', () => {
  it('mixes channels, trims silence, limits duration, and normalizes the signal', () => {
    const sampleRate = 1000;
    const left = new Float32Array(14000);
    const right = new Float32Array(14000);
    for (let index = 1000; index < 13000; index += 1) {
      left[index] = index % 2 ? 0.1 : -0.1;
      right[index] = index % 2 ? 0.2 : -0.2;
    }

    const prepared = prepareVoicePcm([left, right], sampleRate);
    let peak = 0;
    for (const sample of prepared) peak = Math.max(peak, Math.abs(sample));

    expect(prepared.length).toBe(11000);
    expect(peak).toBeCloseTo(0.9, 3);
    expect(prepared[0]).toBe(0);
    expect(prepared.at(-1)).toBe(0);
  });

  it('rejects empty or inaudible recordings', () => {
    expect(() => prepareVoicePcm([new Float32Array(1000)], 1000)).toThrow(
      'No clear speech was detected.',
    );
  });

  it('encodes mono 16-bit PCM WAV data with the correct header', () => {
    const wav = encodePcmWav(new Float32Array([-1, 0, 1]), 48000);
    const view = new DataView(wav);
    const text = (start: number, length: number) =>
      String.fromCharCode(...new Uint8Array(wav, start, length));

    expect(text(0, 4)).toBe('RIFF');
    expect(text(8, 4)).toBe('WAVE');
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(48000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(text(36, 4)).toBe('data');
    expect(view.getUint32(40, true)).toBe(6);
  });
});
