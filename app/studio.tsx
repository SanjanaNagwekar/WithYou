'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowUpRight,
  AudioLines,
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
  const [tab, setTab] = useState('studio');
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
            setTab('studio');
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
            setTab('studio');
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
      setTab('library');
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
      setTab('library');
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
    router.replace('/sign-in');
    router.refresh();
  }

  return (
    <div className="shell">
      <header>
        {/* vinext's development Link shim can load a second React copy after hot reload. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="brand" href="/"><AudioLines /> WithYou<span>VOICE KEEPSAKES</span></a>
        <div className="account-summary">
          <span><LockKeyhole size={14} /><span><strong>{user.displayName}</strong><small>{user.email}</small></span></span>
          <a href="/account" aria-label="Account settings"><UserRound size={15} /></a>
          <button type="button" onClick={() => void signOut()} aria-label="Sign out"><LogOut size={15} /></button>
        </div>
      </header>
      <main>
        <section className="intro">
          <div className="eyebrow">A LITTLE CLOSER, ALWAYS</div>
          <h1>Their voice.<br /><em>Still with you.</em></h1>
          <p>A place for the voices you never want to forget.<br />Keep a recording. Create a keepsake. Take your time.</p>
          <div className="sound-art" aria-hidden="true">
            {Array.from({ length: 51 }, (_, index) => (
              <i key={index} style={{ height: Math.round(18 + Math.sin(index * 0.55) ** 2 * 90 + Math.sin(index * 0.17) ** 2 * 70) }} />
            ))}
          </div>
          <span className="art-caption">Some things stay with us.</span>
        </section>

        <div className="workspace-heading">
          <div><span className="eyebrow">YOUR COLLECTION</span><h2>A familiar voice, a little closer.</h2></div>
          <button className="primary" onClick={openCreateDialog}><Plus size={17} /> Preserve a voice</button>
        </div>

        <div className="workspace">
          <aside>
            <div className="aside-label">PRESERVED VOICES <span>{voices.length.toString().padStart(2, '0')}</span></div>
            {voices.map((voice) => (
              <button className={`voice ${selected === voice.id ? 'active' : ''}`} key={voice.id} onClick={() => setSelected(voice.id)}>
                <span className="avatar">{voice.name[0]}</span>
                <span><strong>{voice.name}</strong><small>{voice.relationship || 'Someone special'}</small></span>
                <AudioLines size={19} />
              </button>
            ))}
            {!voices.length && (
              <div className="empty-voice"><Heart size={25} /><h3>Start with someone special</h3><p>A short recording is the first step to preserving their voice.</p><button className="text-button" onClick={openCreateDialog}>Add your first voice <ArrowUpRight size={15} /></button></div>
            )}
            {selectedVoice && (
              <div className="voice-actions">
                <button className="secondary record-memory" onClick={openRecordDialog}><Mic size={14} /> Record a memory</button>
                <button className="secondary" onClick={openReplaceDialog}><RefreshCw size={14} /> Improve voice sample</button>
                <button className="secondary remove-voice" onClick={() => setDeleteVoiceOpen(true)}><Trash2 size={14} /> Remove voice</button>
                <p>Save new moments here, or improve the sample used for recreated audio.</p>
              </div>
            )}
            <div className="gentle"><Heart size={19} /><p>There’s no right time.<br />Go at your own pace.</p></div>
          </aside>

          <section className="studio">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="studio-tabs" variant="line">
                <TabsTrigger value="studio">Create a keepsake</TabsTrigger>
                <TabsTrigger value="library">Recordings <span>{selectedRecordings.length}</span></TabsTrigger>
              </TabsList>
            </Tabs>
            {error && <div className="notice" role="alert">{error}</div>}
            {status && <div className="notice success" role="status">{status}</div>}

            {tab === 'studio' ? (
              <>
                <div className="studio-title"><span className="iconbox"><AudioLines /></span><div><h3>Words to hold onto</h3><p>Write something you’d like to hear in their voice.</p></div></div>
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
              </>
            ) : (
              <div className="recordings">
                {selectedRecordings.map((recording) => (
                  <RecordingCard
                    key={recording.id}
                    recording={recording}
                    generationReady={ready}
                    onChanged={recordingChanged}
                  />
                ))}
                {!selectedRecordings.length && <div className="library-empty"><AudioLines /><h3>A home for their voice</h3><p>Your original recordings and new keepsakes will appear here.</p></div>}
              </div>
            )}
          </section>
        </div>

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
          <DialogHeader><DialogTitle>Record a memory</DialogTitle><DialogDescription>Capture something new for {selectedVoice?.name || 'this voice'}’s private recording bank.</DialogDescription></DialogHeader>
          <form onSubmit={saveRecording}>
            <label>Recording title<input name="name" required maxLength={100} placeholder="A favorite story, a birthday wish…" /></label>
            <VoiceRecorder id="memory-recorder" file={bankRecording} onFileChange={setBankRecording} disabled={busy !== null} />
            <label className="consent"><Checkbox name="consent" value="yes" required aria-label="Permission to save this recording" />I have permission or the appropriate authority to record and save this voice.</label>
            <p className="setup-note">This saves the original recording to the private library. It is not an AI recreation.</p>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary" disabled={busy !== null || !bankRecording}><Mic size={15} />{busy === 'record' ? 'Saving recording…' : 'Save to recording bank'}</button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteVoiceOpen} onOpenChange={setDeleteVoiceOpen}>
        <AlertDialogContent className="delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {selectedVoice?.name || 'this voice'}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the voice profile, its {selectedRecordings.length} recording{selectedRecordings.length === 1 ? '' : 's'}, every generated keepsake, and the cloned provider voice. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy === 'delete-voice'}>Keep voice</AlertDialogCancel>
            <AlertDialogAction disabled={busy === 'delete-voice'} onClick={() => void deleteVoice()}>
              {busy === 'delete-voice' ? 'Removing…' : 'Remove voice and recordings'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
