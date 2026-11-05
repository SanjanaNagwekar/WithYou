'use client';

import { Mic, Upload } from 'lucide-react';
import { VoiceRecorder } from '@/components/voice-recorder';

export type AudioSourceMode = 'upload' | 'record';

const acceptedAudio =
  'audio/aac,audio/m4a,audio/mp4,audio/mpeg,audio/ogg,audio/wav,audio/x-m4a,audio/x-wav,audio/webm';

type AudioSourceProps = {
  idPrefix: string;
  mode: AudioSourceMode;
  onModeChange: (mode: AudioSourceMode) => void;
  recordedFile: File | null;
  onRecordedFileChange: (file: File | null) => void;
  uploadLabel: string;
  disabled?: boolean;
};

export function AudioSource({
  idPrefix,
  mode,
  onModeChange,
  recordedFile,
  onRecordedFileChange,
  uploadLabel,
  disabled,
}: AudioSourceProps) {
  return (
    <div className="audio-source">
      <div className="source-method" aria-label="Recording source">
        <button
          type="button"
          className={mode === 'upload' ? 'active' : ''}
          aria-pressed={mode === 'upload'}
          onClick={() => onModeChange('upload')}
          disabled={disabled}
        >
          <Upload size={15} /> Upload a file
        </button>
        <button
          type="button"
          className={mode === 'record' ? 'active' : ''}
          aria-pressed={mode === 'record'}
          onClick={() => onModeChange('record')}
          disabled={disabled}
        >
          <Mic size={15} /> Record now
        </button>
      </div>
      {mode === 'upload' ? (
        <label className="upload">
          <Upload /> {uploadLabel}
          <small>MP3, WAV, M4A, AAC, OGG or WebM · up to 15 MB</small>
          <input type="file" name="audio" accept={acceptedAudio} required />
        </label>
      ) : (
        <VoiceRecorder
          id={`${idPrefix}-recorder`}
          file={recordedFile}
          onFileChange={onRecordedFileChange}
          disabled={disabled}
        />
      )}
    </div>
  );
}
