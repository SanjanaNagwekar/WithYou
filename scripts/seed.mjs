const baseUrl = process.env.WITHYOU_BASE_URL || 'http://localhost:5173';
const seedName = 'WithYou Demo Voice';

const libraryResponse = await fetch(`${baseUrl}/api/library`);
if (!libraryResponse.ok) throw new Error(`Could not load ${baseUrl}/api/library.`);
const library = await libraryResponse.json();
if (library.providerMode !== 'mock') {
  throw new Error('Seeding is allowed only when the explicitly enabled mock voice provider is active.');
}

let voice = library.voices.find((candidate) => candidate.name === seedName);
if (!voice) {
  const form = new FormData();
  form.set('name', seedName);
  form.set('relationship', 'Demo profile');
  form.set('consent', 'yes');
  form.set('audio', new File([minimalWav()], 'demo-voice.wav', { type: 'audio/wav' }));
  const response = await fetch(`${baseUrl}/api/library`, { method: 'POST', body: form });
  if (!response.ok) throw new Error(`Could not create demo voice: ${await response.text()}`);
  voice = { id: (await response.json()).id, name: seedName };
}

const refreshed = await (await fetch(`${baseUrl}/api/library`)).json();
const hasKeepsake = refreshed.recordings.some(
  (recording) => recording.voice_id === voice.id && recording.transcript === 'You are loved, always.',
);
if (!hasKeepsake) {
  const response = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: 'You are loved, always.',
      voiceId: voice.id,
      mood: 'warm',
      pace: 1,
      volume: 1,
    }),
  });
  if (!response.ok) throw new Error(`Could not create demo keepsake: ${await response.text()}`);
}

console.log(`Demo data is ready at ${baseUrl}.`);

function minimalWav() {
  return new Uint8Array([
    82, 73, 70, 70, 36, 0, 0, 0, 87, 65, 86, 69, 102, 109, 116, 32,
    16, 0, 0, 0, 1, 0, 1, 0, 64, 31, 0, 0, 128, 62, 0, 0,
    2, 0, 16, 0, 100, 97, 116, 97, 0, 0, 0, 0,
  ]);
}
