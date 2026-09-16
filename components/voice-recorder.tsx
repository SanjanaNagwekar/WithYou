'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Circle, Mic, RotateCcw, Square, Volume2 } from 'lucide-react';
import { encodePcmWav, prepareVoicePcm } from '@/lib/audio-processing';

export const guidedVoicePrompt =
  'Every morning, I open the window, breathe in slowly, and smile. The world feels peaceful, hopeful, and full of little moments worth remembering.';

const promptWords = guidedVoicePrompt.split(' ');
const targetSpeakingMs = (promptWords.length / 2.65) * 1000;
const maximumRecordingMs = 60 * 1000;
const finishingSilenceMs = 1500;
const minimumVoiceThreshold = 0.009;

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

type VoiceRecorderProps = {
  id: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
};

export function VoiceRecorder({ id, file, onFileChange, disabled }: VoiceRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [issue, setIssue] = useState('');
  const [wordProgress, setWordProgress] = useState(0);
  const [meterLevel, setMeterLevel] = useState(0);
  const [detectedSpeech, setDetectedSpeech] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stopTimerRef = useRef<number | null>(null);
  const animationRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const startedAtRef = useRef(0);
  const lastFrameRef = useRef(0);
  const speakingMsRef = useRef(0);
  const silenceStartedRef = useRef(0);
  const detectedSpeechRef = useRef(false);
  const noiseFloorRef = useRef(0.004);
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
      if (animationRef.current) window.cancelAnimationFrame(animationRef.current);
      if (recorderRef.current?.state === 'recording') {
        recorderRef.current.onstop = null;
        recorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (audioContextRef.current) void audioContextRef.current.close().catch(() => {});
    };
  }, []);

  function releaseMicrophone() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current);
    stopTimerRef.current = null;
    if (animationRef.current) window.cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
    if (audioContextRef.current) void audioContextRef.current.close().catch(() => {});
    audioContextRef.current = null;
    setMeterLevel(0);
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (recorder?.state === 'recording') recorder.stop();
  }

  function followVoice(analyser: AnalyserNode, samples: Float32Array<ArrayBuffer>) {
    const now = performance.now();
    const elapsed = lastFrameRef.current ? Math.min(now - lastFrameRef.current, 150) : 0;
    lastFrameRef.current = now;
    analyser.getFloatTimeDomainData(samples);
    let energy = 0;
    for (const sample of samples) energy += sample * sample;
    const volume = Math.sqrt(energy / samples.length);
    const nextMeter = Math.min(10, Math.round(volume * 150));
    setMeterLevel((current) => (current === nextMeter ? current : nextMeter));
    const threshold = Math.max(minimumVoiceThreshold, noiseFloorRef.current * 2.25);

    if (volume >= threshold) {
      if (!detectedSpeechRef.current) {
        detectedSpeechRef.current = true;
        setDetectedSpeech(true);
      }
      speakingMsRef.current += elapsed;
      silenceStartedRef.current = 0;
      const progress = Math.min(1, speakingMsRef.current / targetSpeakingMs);
      const words = Math.min(promptWords.length, Math.max(1, Math.ceil(progress * promptWords.length)));
      setWordProgress((current) => (current === words ? current : words));
    } else {
      noiseFloorRef.current = noiseFloorRef.current * 0.98 + volume * 0.02;
    }

    if (volume < threshold && speakingMsRef.current >= targetSpeakingMs) {
      silenceStartedRef.current ||= now;
      if (now - silenceStartedRef.current >= finishingSilenceMs) {
        stopRecording();
        return;
      }
    }

    if (recorderRef.current?.state === 'recording') {
      animationRef.current = window.requestAnimationFrame(() => followVoice(analyser, samples));
    }
  }

  async function createPreparedFile(blob: Blob) {
    const decodingContext = new AudioContext();
    try {
      const decoded = await decodingContext.decodeAudioData(await blob.arrayBuffer());
      const channels = Array.from(
        { length: decoded.numberOfChannels },
        (_, index) => decoded.getChannelData(index),
      );
      const prepared = prepareVoicePcm(channels, decoded.sampleRate);
      const wav = encodePcmWav(prepared, decoded.sampleRate);
      return new File([wav], `guided-recording-${Date.now()}.wav`, { type: 'audio/wav' });
    } finally {
      await decodingContext.close().catch(() => {});
    }
  }

  async function startRecording() {
    setIssue('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setIssue('Live recording is not supported in this browser. You can upload an audio file instead.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: { ideal: 1 },
          sampleRate: { ideal: 48000 },
          sampleSize: { ideal: 16 },
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      const mimeType = preferredMimeType();
      const recorderOptions = { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 192000 };
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, recorderOptions);
      } catch {
        recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      }
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      speakingMsRef.current = 0;
      silenceStartedRef.current = 0;
      detectedSpeechRef.current = false;
      noiseFloorRef.current = 0.004;
      lastFrameRef.current = 0;
      setDetectedSpeech(false);
      setWordProgress(0);
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
      recorder.onstop = async () => {
        const type = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        setRecording(false);
        releaseMicrophone();
        if (blob.size && detectedSpeechRef.current) {
          setProcessing(true);
          try {
            onFileChange(await createPreparedFile(blob));
          } catch {
            setIssue('We could not clean up this recording. Please try again or upload a WAV file.');
          } finally {
            setProcessing(false);
          }
        } else {
          setIssue('No clear speech was detected. Move closer to the microphone and try again.');
        }
      };

      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.35;
      audioContext.createMediaStreamSource(stream).connect(analyser);
      audioContextRef.current = audioContext;

      recorder.start(250);
      setRecording(true);
      const samples = new Float32Array(new ArrayBuffer(analyser.fftSize * 4));
      animationRef.current = window.requestAnimationFrame(() => followVoice(analyser, samples));
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
    setWordProgress(0);
    setDetectedSpeech(false);
    onFileChange(null);
  }

  const guidance = !detectedSpeech
    ? 'Listening for your voice…'
    : wordProgress < promptWords.length
      ? 'Keep reading at your natural pace'
      : 'Prompt complete — pause and we’ll finish';

  return (
    <div className="voice-recorder guided-recorder" id={id}>
      <div className="guided-prompt" aria-label="Recording prompt">
        <span className="eyebrow">READ THIS ALOUD</span>
        <p>
          {promptWords.map((word, index) => (
            <span className={index < wordProgress ? 'spoken' : index === wordProgress && recording ? 'current' : ''} key={`${word}-${index}`}>
              {word}{' '}
            </span>
          ))}
        </p>
      </div>

      {!recording && !processing && !file && (
        <button className="record-start" type="button" onClick={() => void startRecording()} disabled={disabled}>
          <Mic size={18} /> Start guided recording
        </button>
      )}
      {processing && <p className="recording-processing" role="status">Preparing a clear, voice-ready sample…</p>}
      {recording && (
        <div className="guided-live" role="status" aria-live="polite">
          <div className="recording-live">
            <span><Circle size={10} fill="currentColor" /> Recording · {formatTime(seconds)}</span>
            <button type="button" onClick={stopRecording}><Square size={15} fill="currentColor" /> Finish now</button>
          </div>
          <div className="voice-meter" aria-hidden="true">
            <Volume2 size={15} />
            {Array.from({ length: 10 }, (_, index) => <i className={index < meterLevel ? 'active' : ''} key={index} />)}
          </div>
          <p className="recording-guidance">{guidance}</p>
        </div>
      )}
      {file && previewUrl && (
        <div className="recording-preview">
          <div><strong>Recording ready</strong><small>{formatTime(seconds)}</small></div>
          <audio controls preload="metadata" src={previewUrl} />
          <button type="button" onClick={retry} disabled={disabled}><RotateCcw size={14} /> Record again</button>
        </div>
      )}
      <p className="recording-help">For the clearest voice, use a quiet room and stay 6–12 inches from the microphone. The guide follows microphone activity locally, then trims silence and prepares a voice-ready WAV without transcribing your words.</p>
      {issue && <p className="recording-error" role="alert">{issue}</p>}
    </div>
  );
}
