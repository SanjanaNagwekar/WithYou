'use client';

import { useState } from 'react';
import { Download, RefreshCw, SlidersHorizontal, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Slider } from '@/components/ui/slider';

const moodOptions = [
  { value: 'natural', label: 'Natural', description: 'Let the words guide the delivery' },
  { value: 'warm', label: 'Warm', description: 'Gentle and affectionate' },
  { value: 'calm', label: 'Calm', description: 'Steady and reassuring' },
  { value: 'joyful', label: 'Joyful', description: 'Bright and happy' },
  { value: 'nostalgic', label: 'Nostalgic', description: 'Reflective and wistful' },
  { value: 'proud', label: 'Proud', description: 'Confident and encouraging' },
] as const;

type Mood = (typeof moodOptions)[number]['value'];

export type Recording = {
  id: string;
  name: string;
  kind: string;
  transcript: string;
  voice_id: string;
  mood?: Mood;
  pace?: number;
  volume?: number;
  updated_at?: string;
  created_at?: string;
};

type RecordingCardProps = {
  recording: Recording;
  generationReady: boolean;
  onChanged: (message: string) => Promise<void>;
  contextLabel?: string;
};

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : 'We could not complete that request.';
}

export function RecordingCard({ recording, generationReady, onChanged, contextLabel }: RecordingCardProps) {
  const generated = recording.kind === 'generated';
  const savedMood = recording.mood || 'natural';
  const savedPace = recording.pace || 1;
  const savedVolume = recording.volume || 1;
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<'delete' | 'update' | null>(null);
  const [issue, setIssue] = useState('');
  const [mood, setMood] = useState<Mood>(savedMood);
  const [pace, setPace] = useState([savedPace]);
  const [volume, setVolume] = useState([savedVolume]);

  const moodDescription =
    moodOptions.find((option) => option.value === mood)?.description || '';
  const audioVersion = recording.updated_at || recording.created_at || recording.id;

  async function deleteRecording() {
    setIssue('');
    setBusy('delete');
    try {
      const response = await fetch(`/api/recordings/${recording.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || 'The recording could not be deleted.');
      }
      await onChanged(generated ? 'Keepsake deleted.' : 'Original recording deleted.');
    } catch (error) {
      setIssue(messageFrom(error));
    } finally {
      setBusy(null);
    }
  }

  async function updateDelivery() {
    setIssue('');
    setBusy('update');
    try {
      const response = await fetch(`/api/recordings/${recording.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mood, pace: pace[0], volume: volume[0] }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'The keepsake could not be updated.');
      }
      setEditing(false);
      await onChanged('Keepsake updated. Press play to hear the new delivery.');
    } catch (error) {
      setIssue(messageFrom(error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="recording-card">
      <div className="recording-summary">
        <div className="recording-copy">
          <small>{contextLabel || (generated ? 'AI RECREATION' : 'ORIGINAL RECORDING')}</small>
          <h3>{recording.name}</h3>
          {recording.transcript && <p>{recording.transcript}</p>}
          {generated && (
            <span className="delivery-summary">
              {moodOptions.find((option) => option.value === savedMood)?.label || 'Natural'}
              {' · '}{savedPace.toFixed(2)}× pace · {savedVolume.toFixed(2)}× volume
            </span>
          )}
        </div>
        <div className="recording-actions">
          {generated && (
            <button
              className="icon-action"
              aria-label={`Adjust delivery for ${recording.name}`}
              aria-expanded={editing}
              onClick={() => {
                setIssue('');
                if (!editing) {
                  setMood(savedMood);
                  setPace([savedPace]);
                  setVolume([savedVolume]);
                }
                setEditing((current) => !current);
              }}
              disabled={busy !== null || !generationReady}
            >
              <SlidersHorizontal size={17} />
            </button>
          )}
          <a
            className="icon-action"
            href={`/api/audio/${recording.id}?download=1&v=${encodeURIComponent(audioVersion)}`}
            aria-label={`Download ${recording.name}`}
          >
            <Download size={18} />
          </a>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                className="icon-action danger"
                aria-label={`Delete ${recording.name}`}
                disabled={busy !== null}
              >
                <Trash2 size={17} />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="delete-dialog" size="sm">
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Delete {generated ? 'this keepsake' : 'this recording'}?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes the private audio file from your library. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep it</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={() => void deleteRecording()}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <audio
        key={audioVersion}
        controls
        preload="none"
        src={`/api/audio/${recording.id}?v=${encodeURIComponent(audioVersion)}`}
      />

      {generated && editing && (
        <section className="recording-delivery" aria-label={`Delivery for ${recording.name}`}>
          <div className="recording-delivery-heading">
            <div>
              <strong>Adjust this keepsake</strong>
              <p>Keep the words, then replace the audio with a new delivery.</p>
            </div>
            <RefreshCw size={17} />
          </div>
          <div className="delivery-grid compact">
            <div className="delivery-control mood-control">
              <label htmlFor={`${recording.id}-mood`}>FEELING</label>
              <div className="select-wrap">
                <select
                  id={`${recording.id}-mood`}
                  value={mood}
                  onChange={(event) => setMood(event.target.value as Mood)}
                  disabled={busy !== null}
                >
                  {moodOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <p>{moodDescription}</p>
            </div>
            <div className="delivery-control">
              <div className="control-label">
                <label htmlFor={`${recording.id}-pace`}>PACE</label>
                <span>{pace[0].toFixed(2)}×</span>
              </div>
              <Slider
                className="delivery-slider"
                id={`${recording.id}-pace`}
                aria-label={`Speaking pace for ${recording.name}`}
                min={0.6}
                max={1.5}
                step={0.05}
                value={pace}
                onValueChange={setPace}
                disabled={busy !== null}
              />
            </div>
            <div className="delivery-control">
              <div className="control-label">
                <label htmlFor={`${recording.id}-volume`}>VOLUME</label>
                <span>{volume[0].toFixed(2)}×</span>
              </div>
              <Slider
                className="delivery-slider"
                id={`${recording.id}-volume`}
                aria-label={`Voice volume for ${recording.name}`}
                min={0.5}
                max={2}
                step={0.05}
                value={volume}
                onValueChange={setVolume}
                disabled={busy !== null}
              />
            </div>
          </div>
          <div className="recording-delivery-footer">
            <p>Updating uses the voice service and counts toward your daily generation limit.</p>
            <div>
              <button className="secondary inline" onClick={() => setEditing(false)} disabled={busy !== null}>
                Cancel
              </button>
              <button className="primary" onClick={() => void updateDelivery()} disabled={busy !== null}>
                <RefreshCw size={15} /> {busy === 'update' ? 'Updating…' : 'Update audio'}
              </button>
            </div>
          </div>
        </section>
      )}

      {issue && <p className="recording-error" role="alert">{issue}</p>}
    </article>
  );
}
