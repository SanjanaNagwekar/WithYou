'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AudioLines,
  ChevronRight,
  Heart,
  LockKeyhole,
  LogOut,
  Mic,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Trash2,
  UserRound,
  WandSparkles,
} from 'lucide-react';
import { AudioSource, type AudioSourceMode } from '@/components/audio-source';
import { RecordingCard, type Recording } from '@/components/recording-card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VoiceRecorder } from '@/components/voice-recorder';
import { authClient } from '@/lib/auth-client';

type Voice = { id: string; name: string; relationship: string; voice_id: string | null };
type LibraryResponse = {
  error?: string;
  id?: string;
  voices: Voice[];
  recordings: Recording[];
  configured: boolean;
};

const moodOptions = [
  { value: 'natural', label: 'Natural', description: 'Let the words guide the delivery' },
  { value: 'warm', label: 'Warm', description: 'Gentle and affectionate' },
  { value: 'calm', label: 'Calm', description: 'Steady and reassuring' },
  { value: 'joyful', label: 'Joyful', description: 'Bright and happy' },
  { value: 'nostalgic', label: 'Nostalgic', description: 'Reflective and wistful' },
  { value: 'proud', label: 'Proud', description: 'Confident and encouraging' },
] as const;

type Mood = (typeof moodOptions)[number]['value'];
type BusyAction = 'create' | 'replace' | 'record' | 'generate' | 'delete-voice' | null;

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : 'We could not complete that request.';
}

export default function Home({ user }: { user: { displayName: string; email: string } }) {
  const router = useRouter();
  const [voices, setVoices] = useState<Voice[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [selected, setSelected] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [deleteVoiceOpen, setDeleteVoiceOpen] = useState(false);
  const [createSource, setCreateSource] = useState<AudioSourceMode>('upload');
  const [replaceSource, setReplaceSource] = useState<AudioSourceMode>('upload');
  const [createRecording, setCreateRecording] = useState<File | null>(null);
  const [replaceRecording, setReplaceRecording] = useState<File | null>(null);
  const [bankRecording, setBankRecording] = useState<File | null>(null);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [text, setText] = useState('');
  const [tab, setTab] = useState('keepsakes');
  const [ready, setReady] = useState(false);
  const [mood, setMood] = useState<Mood>('natural');
  const [pace, setPace] = useState([1]);
  const [volume, setVolume] = useState([1]);

  const selectedVoice = useMemo(
    () => voices.find((voice) => voice.id === selected),
    [voices, selected],
  );
  const selectedRecordings = useMemo(
    () => recordings.filter((recording) => recording.voice_id === selected),
    [recordings, selected],
  );
  const originalRecordings = useMemo(
    () => selectedRecordings.filter((recording) => recording.kind === 'original'),
    [selectedRecordings],
  );
  const generatedKeepsakes = useMemo(
    () => selectedRecordings.filter((recording) => recording.kind === 'generated'),
    [selectedRecordings],
  );
  const keepsakeCountsByVoice = useMemo(() => {
    const counts = new Map<string, number>();
    for (const recording of recordings) {
      if (recording.kind === 'generated') {
        counts.set(recording.voice_id, (counts.get(recording.voice_id) || 0) + 1);
      }
    }
    return counts;
  }, [recordings]);
  const moodDescription = moodOptions.find((option) => option.value === mood)?.description ?? '';

  async function refresh() {
    try {
      const response = await fetch('/api/library');
      const data = (await response.json()) as LibraryResponse;
      if (!response.ok) throw new Error(data.error || 'Your library could not be loaded.');
      setVoices(data.voices);
      setRecordings(data.recordings);
      setReady(data.configured);
      setSelected((current) =>
        data.voices.some((voice) => voice.id === current) ? current : data.voices[0]?.id || '',
      );
    } catch (caught) {
      setError(messageFrom(caught));
    }
  }

  useEffect(() => {
    // Loading after mount keeps the page shell instant while the private library resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, []);

  useEffect(() => {
    const modelContext = (
      document as Document & { modelContext?: { registerTool: (tool: unknown, options: unknown) => void } }
    ).modelContext;
    if (!modelContext) return;
    const lifecycle = new AbortController();
    try {
      modelContext.registerTool(
        {
          name: 'stage_keepsake_text',
          description: 'Place words in the keepsake editor without generating audio.',
          inputSchema: {
            type: 'object',
            properties: { text: { type: 'string', minLength: 1, maxLength: 1000 } },
            required: ['text'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false },
          execute(input: unknown) {
            const value = input as { text?: unknown };
            if (typeof value?.text !== 'string' || !value.text.trim() || value.text.length > 1000) {
              throw new Error('Enter 1 to 1,000 characters.');
            }
            setText(value.text);
            setTab('keepsakes');
            return { staged: true, characters: value.text.length };
          },
        },
        { signal: lifecycle.signal },
      );
      modelContext.registerTool(
        {
          name: 'stage_keepsake_delivery',
          description: 'Set the feeling, pace, and volume for the next keepsake.',
          inputSchema: {
            type: 'object',
            properties: {
              mood: { type: 'string', enum: moodOptions.map((option) => option.value) },
              pace: { type: 'number', minimum: 0.6, maximum: 1.5 },
              volume: { type: 'number', minimum: 0.5, maximum: 2 },
            },
            required: ['mood', 'pace', 'volume'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false },
          execute(input: unknown) {
            const value = input as { mood?: unknown; pace?: unknown; volume?: unknown };
            const validMood = moodOptions.some((option) => option.value === value.mood);
            if (
              !validMood ||
              typeof value.pace !== 'number' ||
              value.pace < 0.6 ||
              value.pace > 1.5 ||
              typeof value.volume !== 'number' ||
              value.volume < 0.5 ||
              value.volume > 2
            ) {
              throw new Error('Choose a valid feeling, pace, and volume.');
            }
            setMood(value.mood as Mood);
            setPace([value.pace]);
            setVolume([value.volume]);
            setTab('keepsakes');
            return { staged: true, mood: value.mood, pace: value.pace, volume: value.volume };
          },
        },
        { signal: lifecycle.signal },
      );
    } catch {
      // The app still works normally in browsers that do not support WebMCP.
    }
    return () => lifecycle.abort();
  }, []);

  function startAction() {
    setError('');
    setStatus('');
  }

  function openCreateDialog() {
    setError('');
    setCreateSource('upload');
    setCreateRecording(null);
    setCreateOpen(true);
  }

  function openReplaceDialog() {
    setError('');
    setReplaceSource('upload');
    setReplaceRecording(null);
    setReplaceOpen(true);
  }

  function openRecordDialog() {
    setError('');
    setBankRecording(null);
    setRecordOpen(true);
  }

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startAction();
    setBusy('create');
    try {
      const form = new FormData(event.currentTarget);
      if (createSource === 'record') {
        if (!createRecording) throw new Error('Record a voice clip before saving.');
        form.set('audio', createRecording);
      }
      const response = await fetch('/api/library', { method: 'POST', body: form });
      const data = (await response.json()) as LibraryResponse;
      if (!response.ok) throw new Error(data.error || 'The voice could not be saved.');
      if (data.id) setSelected(data.id);
      setCreateOpen(false);
      setCreateRecording(null);
      setStatus('Voice and original recording saved.');
      await refresh();
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setBusy(null);
    }
  }

  async function replaceReference(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    startAction();
    setBusy('replace');
    try {
      const form = new FormData(event.currentTarget);
      if (replaceSource === 'record') {
        if (!replaceRecording) throw new Error('Record a voice clip before saving.');
        form.set('audio', replaceRecording);
      }
      const response = await fetch(`/api/voices/${selected}/reference`, {
        method: 'POST',
        body: form,
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || 'The new voice sample could not be saved.');
      setReplaceOpen(false);
      setReplaceRecording(null);
      setStatus('New voice sample saved. The next keepsake will rebuild the voice from it.');
      await refresh();
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setBusy(null);
    }
  }

  async function saveRecording(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    startAction();
    setBusy('record');
    try {
      if (!bankRecording) throw new Error('Record something before saving.');
      const form = new FormData(event.currentTarget);
      form.set('audio', bankRecording);
      const response = await fetch(`/api/voices/${selected}/recordings`, {
        method: 'POST',
        body: form,
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || 'The recording could not be saved.');
      setRecordOpen(false);
      setBankRecording(null);
      setStatus(`Recording saved to ${selectedVoice?.name || 'this voice'}’s library.`);
      await refresh();
      setTab('source');
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setBusy(null);
    }
  }

  async function generate() {
    startAction();
    setBusy('generate');
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceId: selected, text, mood, pace: pace[0], volume: volume[0] }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || 'The keepsake could not be created.');
      await refresh();
      setTab('keepsakes');
      setStatus('Your new keepsake is ready.');
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setBusy(null);
    }
  }

  async function recordingChanged(message: string) {
    setError('');
    setStatus(message);
    await refresh();
  }

  async function deleteVoice() {
    if (!selected) return;
    startAction();
    setBusy('delete-voice');
    try {
      const response = await fetch(`/api/voices/${selected}`, { method: 'DELETE' });
      const data = response.status === 204 ? null : ((await response.json()) as { error?: string });
      if (!response.ok) throw new Error(data?.error || 'The voice could not be removed.');
      const deletedName = selectedVoice?.name || 'Voice';
      setDeleteVoiceOpen(false);
      setStatus(`${deletedName} and all associated recordings were removed.`);
      await refresh();
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setBusy(null);
    }
  }

  async function signOut() {
    await authClient.signOut();
    router.replace('/');
    router.refresh();
  }

  return (
    <div className="shell">
      <header className="studio-header">
        {/* vinext's development Link shim can load a second React copy after hot reload. */}
        <a className="brand" href="/studio"><AudioLines /> WithYou<span>PRIVATE STUDIO</span></a>
        <div className="account-summary">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a className="about-link" href="/">About WithYou</a>
          <span><LockKeyhole size={14} /><span><strong>{user.displayName}</strong><small>{user.email}</small></span></span>
          <a href="/account" aria-label="Account settings"><UserRound size={15} /></a>
          <button type="button" onClick={() => void signOut()} aria-label="Sign out"><LogOut size={15} /></button>
        </div>
      </header>
      <main className="studio-main">
        <section className="profile-directory" aria-labelledby="profiles-heading">
          <div className="profile-directory-heading">
            <div><span className="eyebrow">YOUR PRIVATE LIBRARY</span><h1 id="profiles-heading">Voice profiles</h1><p>Choose someone to manage their source recordings and create personal keepsakes.</p></div>
            <button className="primary" onClick={openCreateDialog}><Plus size={17} /> Add a voice profile</button>
          </div>

          {voices.length ? (
            <div className="profile-list" aria-label="Voice profiles">
              {voices.map((voice) => {
                const keepsakeCount = keepsakeCountsByVoice.get(voice.id) || 0;
                return (
                  <button
                    className={`profile-card ${selected === voice.id ? 'active' : ''}`}
                    key={voice.id}
                    onClick={() => { setSelected(voice.id); setTab('keepsakes'); }}
                    aria-pressed={selected === voice.id}
                  >
                    <span className="profile-avatar">{voice.name[0]}</span>
                    <span className="profile-card-copy"><strong>{voice.name}</strong><small>{voice.relationship || 'Someone special'}</small><em>{keepsakeCount} keepsake{keepsakeCount === 1 ? '' : 's'}</em></span>
                    <ChevronRight size={18} />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="profile-empty"><span><Heart /></span><h2>Start with someone special</h2><p>Create a profile with one clear recording. From there, you can preserve originals and make voice keepsakes in one private place.</p><button className="primary" onClick={openCreateDialog}><Plus size={16} /> Add your first voice profile</button></div>
          )}
        </section>

        <div className="studio-notices">
          {error && <div className="notice" role="alert">{error}</div>}
          {status && <div className="notice success" role="status">{status}</div>}
        </div>

        {selectedVoice && (
          <section className="profile-workspace" aria-labelledby="selected-profile-heading">
            <div className="profile-identity">
              <span className="profile-avatar large">{selectedVoice.name[0]}</span>
              <div><span className="eyebrow">VOICE PROFILE</span><h2 id="selected-profile-heading">{selectedVoice.name}</h2><p>{selectedVoice.relationship || 'Someone special'}</p></div>
              <dl>
                <div><dt>VOICE RECORDINGS</dt><dd>{originalRecordings.length}</dd></div>
                <div><dt>KEEPSAKES</dt><dd>{generatedKeepsakes.length}</dd></div>
              </dl>
            </div>

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="profile-tabs" variant="line">
                <TabsTrigger value="keepsakes"><WandSparkles size={15} /> Keepsakes <span>{generatedKeepsakes.length}</span></TabsTrigger>
                <TabsTrigger value="source"><Mic size={15} /> Voice recordings <span>{originalRecordings.length}</span></TabsTrigger>
              </TabsList>
            </Tabs>
            {tab === 'keepsakes' ? (
              <div className="keepsake-workspace">
                <section className="keepsake-composer" aria-labelledby="composer-heading">
                <div className="studio-title"><span className="iconbox"><WandSparkles /></span><div><span className="eyebrow">CREATE WITH {selectedVoice.name.toUpperCase()}’S VOICE</span><h3 id="composer-heading">Words to hold onto</h3><p>Write something you’d like to hear in their voice.</p></div></div>
                <label htmlFor="words">YOUR WORDS</label>
                <textarea id="words" placeholder="A little reminder, a favorite saying, a few words of love…" maxLength={1000} value={text} onChange={(event) => setText(event.target.value)} />
                <div className="text-meta"><span>New audio is an AI recreation, not an original recording.</span><span>{text.length}/1,000</span></div>
                <div className="suggestions">
                  <span>A PLACE TO START</span>
                  {['I love you, always.', 'I’m so proud of you.', 'Take it one day at a time.'].map((suggestion) => <button key={suggestion} onClick={() => setText(suggestion)}>{suggestion}</button>)}
                </div>

                <section className="delivery-panel" aria-labelledby="delivery-heading">
                  <div className="delivery-header"><span className="delivery-icon"><SlidersHorizontal size={17} /></span><div><h3 id="delivery-heading">Voice delivery</h3><p>Shape how this keepsake feels and sounds.</p></div></div>
                  <div className="delivery-grid">
                    <div className="delivery-control mood-control">
                      <label htmlFor="mood">FEELING</label>
                      <div className="select-wrap">
                        <select
                          id="mood"
                          aria-label="Feeling"
                          value={mood}
                          onChange={(event) => setMood(event.target.value as Mood)}
                        >
                          {moodOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                      <p>{moodDescription}</p>
                    </div>
                    <div className="delivery-control">
                      <div className="control-label"><label htmlFor="pace">PACE</label><span>{pace[0].toFixed(2)}×</span></div>
                      <Slider className="delivery-slider" id="pace" aria-label="Speaking pace" min={0.6} max={1.5} step={0.05} value={pace} onValueChange={setPace} />
                      <div className="slider-ends"><span>Slower</span><span>Faster</span></div>
                    </div>
                    <div className="delivery-control">
                      <div className="control-label"><label htmlFor="volume">VOLUME</label><span>{volume[0].toFixed(2)}×</span></div>
                      <Slider className="delivery-slider" id="volume" aria-label="Voice volume" min={0.5} max={2} step={0.05} value={volume} onValueChange={setVolume} />
                      <div className="slider-ends"><span>Softer</span><span>Fuller</span></div>
                    </div>
                  </div>
                  <p className="delivery-note">These choices shape this keepsake only.</p>
                </section>

                <div className="generate-row">
                  <p><LockKeyhole size={14} /> Just for you. Yours to download.</p>
                  <button className="primary" disabled={busy !== null || !selected || !text.trim() || !ready} onClick={() => void generate()}><WandSparkles size={16} />{busy === 'generate' ? 'Creating…' : 'Create audio'}</button>
                </div>
                {!ready && <p className="setup-note">Voice generation is not available yet. You can start preserving recordings now.</p>}
                </section>

                <section className="recent-keepsakes" aria-labelledby="recent-keepsakes-heading">
                  <div className="section-heading-row"><div><span className="eyebrow">SAVED FOR {selectedVoice.name.toUpperCase()}</span><h3 id="recent-keepsakes-heading">Recent keepsakes</h3></div><span>{generatedKeepsakes.length} total</span></div>
                  <div className="recordings keepsake-recordings">
                    {generatedKeepsakes.map((recording) => (
                      <RecordingCard key={recording.id} recording={recording} generationReady={ready} onChanged={recordingChanged} />
                    ))}
                    {!generatedKeepsakes.length && <div className="library-empty compact"><WandSparkles /><h3>No keepsakes yet</h3><p>Your first generated keepsake will appear here, separate from the original voice recordings.</p></div>}
                  </div>
                </section>
              </div>
            ) : (
              <div className="source-workspace">
                <div className="source-heading">
                  <div><span className="eyebrow">ORIGINAL AUDIO ONLY</span><h3>{selectedVoice.name}’s voice recordings</h3><p>The newest recording is the active sample used to create future keepsakes. Generated audio never appears in this section.</p></div>
                  <button className="primary" onClick={openRecordDialog}><Plus size={15} /> Add voice recording</button>
                </div>
                <div className="source-tools">
                  <div><AudioLines size={19} /><span><strong>Active voice sample</strong><small>Improve the sample when you have a clearer or more expressive recording.</small></span></div>
                  <button className="secondary inline" onClick={openReplaceDialog}><RefreshCw size={14} /> Improve sample</button>
                </div>
                <div className="recordings source-recordings">
                  {originalRecordings.map((recording, index) => (
                    <RecordingCard
                      key={recording.id}
                      recording={recording}
                      generationReady={ready}
                      onChanged={recordingChanged}
                      contextLabel={index === 0 ? 'ACTIVE VOICE SAMPLE' : 'ORIGINAL RECORDING'}
                    />
                  ))}
                  {!originalRecordings.length && <div className="library-empty compact"><Mic /><h3>No original recordings</h3><p>Add a clear voice recording before creating a keepsake.</p><button className="primary" onClick={openRecordDialog}><Plus size={15} /> Add a recording</button></div>}
                </div>
                <div className="profile-danger"><div><strong>Remove this voice profile</strong><p>Deletes every original recording and generated keepsake associated with {selectedVoice.name}.</p></div><button className="secondary remove-voice" onClick={() => setDeleteVoiceOpen(true)}><Trash2 size={14} /> Remove profile</button></div>
              </div>
            )}
          </section>
        )}

        <footer><span className="brand small"><AudioLines size={18} /> WithYou</span><p>Made for memories. Held with care.</p><span>PRIVATE MVP · AI AUDIO IS LABELED</span></footer>
      </main>

      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) setCreateRecording(null); }}>
        <DialogContent className="voice-dialog">
          <DialogHeader><DialogTitle>Preserve a familiar voice</DialogTitle><DialogDescription>Upload something you have, or make a new recording now.</DialogDescription></DialogHeader>
          <form onSubmit={create}>
            <label>Name<input name="name" required maxLength={80} placeholder="What do you call them?" /></label>
            <label>Relationship<input name="relationship" maxLength={80} placeholder="Mom, grandpa, a dear friend…" /></label>
            <AudioSource
              idPrefix="create"
              mode={createSource}
              onModeChange={setCreateSource}
              recordedFile={createRecording}
              onRecordedFileChange={setCreateRecording}
              uploadLabel="Choose an audio recording"
              disabled={busy !== null}
            />
            <label className="consent"><Checkbox name="consent" value="yes" required aria-label="Permission to preserve and recreate this voice" />I have permission or the appropriate authority to preserve and recreate this person’s voice, and permission to use this recording.</label>
            <p className="setup-note">Creating audio sends your reference recording and words to our voice-generation service for processing.</p>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary" disabled={busy !== null || (createSource === 'record' && !createRecording)}>{busy === 'create' ? 'Saving recording…' : 'Save voice & recording'}</button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={replaceOpen} onOpenChange={(open) => { setReplaceOpen(open); if (!open) setReplaceRecording(null); }}>
        <DialogContent className="voice-dialog">
          <DialogHeader><DialogTitle>Improve {selectedVoice?.name || 'this voice'}</DialogTitle><DialogDescription>Replace the reference with a natural, expressive 10–60 second clip of one person speaking clearly.</DialogDescription></DialogHeader>
          <form onSubmit={replaceReference}>
            <div className="sample-tip"><AudioLines size={19} /><p>A quiet room, natural pauses, and the emotion you want to preserve will give the best result.</p></div>
            <AudioSource
              idPrefix="replace"
              mode={replaceSource}
              onModeChange={setReplaceSource}
              recordedFile={replaceRecording}
              onRecordedFileChange={setReplaceRecording}
              uploadLabel="Choose a better recording"
              disabled={busy !== null}
            />
            <label className="consent"><Checkbox name="consent" value="yes" required aria-label="Permission to replace this voice sample" />I have permission or the appropriate authority to use this recording to recreate this person’s voice.</label>
            <p className="setup-note">The next keepsake rebuilds this voice from the newest sample. Existing recordings stay in your library.</p>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary" disabled={busy !== null || (replaceSource === 'record' && !replaceRecording)}><RefreshCw size={15} />{busy === 'replace' ? 'Saving new sample…' : 'Replace & rebuild voice'}</button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={recordOpen} onOpenChange={(open) => { setRecordOpen(open); if (!open) setBankRecording(null); }}>
        <DialogContent className="voice-dialog recording-dialog">
          <DialogHeader><DialogTitle>Add a voice recording</DialogTitle><DialogDescription>Capture another original recording for {selectedVoice?.name || 'this voice'}’s voice profile.</DialogDescription></DialogHeader>
          <form onSubmit={saveRecording}>
            <label>Recording title<input name="name" required maxLength={100} placeholder="A favorite story, a birthday wish…" /></label>
            <VoiceRecorder id="memory-recorder" file={bankRecording} onFileChange={setBankRecording} disabled={busy !== null} />
            <label className="consent"><Checkbox name="consent" value="yes" required aria-label="Permission to save this recording" />I have permission or the appropriate authority to record and save this voice.</label>
            <p className="setup-note">This saves original audio—not an AI recreation—and makes it the active sample for future keepsakes.</p>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary" disabled={busy !== null || !bankRecording}><Mic size={15} />{busy === 'record' ? 'Saving recording…' : 'Save voice recording'}</button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteVoiceOpen} onOpenChange={setDeleteVoiceOpen}>
        <AlertDialogContent className="delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {selectedVoice?.name || 'this voice'}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the voice profile, {originalRecordings.length} original recording{originalRecordings.length === 1 ? '' : 's'}, {generatedKeepsakes.length} generated keepsake{generatedKeepsakes.length === 1 ? '' : 's'}, and the cloned provider voice. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy === 'delete-voice'}>Keep voice</AlertDialogCancel>
            <AlertDialogAction disabled={busy === 'delete-voice'} onClick={() => void deleteVoice()}>
              {busy === 'delete-voice' ? 'Removing…' : 'Remove profile and audio'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
