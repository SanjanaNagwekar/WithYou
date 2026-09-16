import type { CloneVoiceInput, VoiceProvider } from '@/lib/providers/voice-provider';
import type { DeliverySettings } from '@/lib/validation';

export class MockVoiceProvider implements VoiceProvider {
  async cloneVoice(input: CloneVoiceInput): Promise<string> {
    return `mock-${stableHash(`${input.name}:${input.fileName}:${input.audio.byteLength}`)}`;
  }

  async deleteVoice(): Promise<void> {}

  async synthesize(
    transcript: string,
    providerVoiceId: string,
    delivery: DeliverySettings,
  ): Promise<ArrayBuffer> {
    const sampleRate = 8000;
    const seconds = Math.max(0.2, Math.min(1, transcript.length / 100));
    const sampleCount = Math.floor(sampleRate * seconds);
    const dataSize = sampleCount * 2;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);
    writeAscii(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeAscii(view, 8, 'WAVEfmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeAscii(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    const frequency = 220 + (stableHash(`${providerVoiceId}:${delivery.mood}`) % 220);
    const amplitude = Math.min(0.25, 0.12 * delivery.volume);
    for (let index = 0; index < sampleCount; index += 1) {
      const time = index / sampleRate;
      const sample = Math.sin(2 * Math.PI * frequency * delivery.pace * time) * amplitude;
      view.setInt16(44 + index * 2, Math.round(sample * 32767), true);
    }
    return buffer;
  }
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}
