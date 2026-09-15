'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Circle, Mic, RotateCcw, Square } from 'lucide-react';

const maximumRecordingMs = 10 * 60 * 1000;

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

function preferredMimeType() {
  if (typeof MediaRecorder === 'undefined') return '';
  return [
    'audio/webm;codecs=opus',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/webm',
    'audio/mp4',
  ].find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

function extensionFor(type: string) {
  const base = type.split(';')[0].toLowerCase();
  if (base === 'audio/mp4' || base === 'audio/m4a') return 'm4a';
  if (base === 'audio/ogg') return 'ogg';
  return 'webm';
}

type VoiceRecorderProps = {
  id: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
};

export function VoiceRecorder({ id, file, onFileChange, disabled }: VoiceRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [issue, setIssue] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stopTimerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : ''), [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => {
      setSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 250);
    return () => window.clearInterval(timer);
  }, [recording]);

  useEffect(() => {
    return () => {
      if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current);
      if (recorderRef.current?.state === 'recording') {
        recorderRef.current.onstop = null;
        recorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function releaseMicrophone() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current);
    stopTimerRef.current = null;
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (recorder?.state === 'recording') recorder.stop();
  }

  async function startRecording() {
    setIssue('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setIssue('Live recording is not supported in this browser. You can upload an audio file instead.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const mimeType = preferredMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      setSeconds(0);
      startedAtRef.current = Date.now();
      onFileChange(null);

      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setIssue('The recording stopped unexpectedly. Please try again.');
        setRecording(false);
        releaseMicrophone();
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        if (blob.size) {
          onFileChange(
            new File([blob], `live-recording-${Date.now()}.${extensionFor(type)}`, { type }),
          );
        } else {
          setIssue('No audio was captured. Check the microphone and try again.');
        }
        setRecording(false);
        releaseMicrophone();
      };

      recorder.start(500);
      setRecording(true);
      stopTimerRef.current = window.setTimeout(stopRecording, maximumRecordingMs);
    } catch (error) {
      const name = error instanceof DOMException ? error.name : '';
      setIssue(
        name === 'NotAllowedError'
          ? 'Microphone access was not allowed. Enable it for this site or upload a recording instead.'
          : 'The microphone could not start. Check that it is available and try again.',
      );
      releaseMicrophone();
    }
  }

  function retry() {
    setIssue('');
    setSeconds(0);
    onFileChange(null);
  }

  return (
    <div className="voice-recorder" id={id}>
      {!recording && !file && (
        <button className="record-start" type="button" onClick={() => void startRecording()} disabled={disabled}>
          <Mic size={18} /> Start recording
        </button>
      )}
      {recording && (
        <div className="recording-live" role="status" aria-live="polite">
          <span><Circle size={10} fill="currentColor" /> Recording · {formatTime(seconds)}</span>
          <button type="button" onClick={stopRecording}><Square size={15} fill="currentColor" /> Stop</button>
        </div>
      )}
      {file && previewUrl && (
        <div className="recording-preview">
          <div><strong>Recording ready</strong><small>{formatTime(seconds)}</small></div>
          <audio controls preload="metadata" src={previewUrl} />
          <button type="button" onClick={retry} disabled={disabled}><RotateCcw size={14} /> Record again</button>
        </div>
      )}
      <p className="recording-help">Speak naturally in a quiet place. You can listen before saving.</p>
      {issue && <p className="recording-error" role="alert">{issue}</p>}
    </div>
  );
}
