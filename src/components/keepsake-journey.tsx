'use client';

import {
  Archive,
  Check,
  LockKeyhole,
  Mic2,
  Pause,
  Play,
  SlidersHorizontal,
  Type,
} from 'lucide-react';
import { useEffect, useState, type CSSProperties } from 'react';

const FRAME_DURATION = 3600;

const steps = [
  { number: '01', title: 'Preserve', subtitle: 'Record or upload a real moment', detail: 'ADD A FAMILIAR VOICE', badge: 'WITH PERMISSION', footer: 'The original recording is kept intact and private.', icon: Mic2 },
  { number: '02', title: 'Write', subtitle: 'Put the words into your own voice', detail: 'WRITE THE WORDS TO KEEP', badge: 'YOURS TO EDIT', footer: 'Nothing is created until you decide the message feels right.', icon: Type },
  { number: '03', title: 'Shape', subtitle: 'Choose the voice and delivery', detail: 'CHOOSE HOW IT SHOULD FEEL', badge: 'CLEARLY LABELED', footer: 'Voice, feeling, pace, and language stay under your control.', icon: SlidersHorizontal },
  { number: '04', title: 'Return', subtitle: 'Hear it and keep it close', detail: 'A KEEPSAKE TO RETURN TO', badge: 'YOURS ALONE', footer: 'Listen, download, replace, or permanently remove it.', icon: Archive },
];

const wave = [18, 31, 24, 49, 68, 42, 76, 58, 84, 47, 64, 37, 72, 53, 79, 44, 61, 35, 52, 27, 39, 20];

function Waveform({ animated = false }: { animated?: boolean }) {
  return (
    <div className={`journey-wave${animated ? ' animated' : ''}`} aria-hidden="true">
      {wave.map((height, index) => (
        <i key={index} style={{ '--journey-height': `${height}%`, '--journey-index': index } as CSSProperties} />
      ))}
      <span />
    </div>
  );
}

function JourneyScene({ active, playing }: { active: number; playing: boolean }) {
  if (active === 0) {
    return (
      <div className="journey-capture" aria-label="Record or upload a familiar voice">
        <div className="journey-capture-meta"><span>Someone special</span><small>00:34</small></div>
        <Waveform animated={playing} />
        <div className="journey-capture-note"><i /><span>Silence trimmed</span><i /><span>Levels balanced</span><i /><span>Original kept</span></div>
      </div>
    );
  }

  if (active === 1) {
    return (
      <div className="journey-message" aria-label="Write a personal message">
        <div className="journey-message-top"><span>YOUR WORDS</span><small>24 / 500</small></div>
        <p><span>I’m proud of you. Always.</span><i aria-hidden="true" /></p>
        <div className="journey-message-prompts"><span>Words for a hard day</span><span>A family story</span><span>Just because</span></div>
        <div className="journey-message-status"><Check size={12} /><span>Saved privately</span></div>
      </div>
    );
  }

  if (active === 2) {
    return (
      <div className="journey-voice" aria-label="Choose a voice and delivery">
        <div className="journey-voice-list">
          <button type="button"><span>S</span><div><strong>Original moment</strong><small>Source recording</small></div><Play size={11} /></button>
          <button type="button" className="selected"><span>S</span><div><strong>Someone special</strong><small>Familiar voice</small></div><Check size={12} /></button>
        </div>
        <div className="journey-controls">
          <div><span>FEELING</span><strong>Warm</strong><i><b style={{ width: '68%' }} /></i></div>
          <div><span>PACE</span><strong>Unhurried</strong><i><b style={{ width: '47%' }} /></i></div>
          <div><span>LANGUAGE</span><strong>English</strong><i><b style={{ width: '82%' }} /></i></div>
        </div>
      </div>
    );
  }

  return (
    <div className="journey-library" aria-label="Finished private voice keepsake">
      <div className="journey-library-card back-two" aria-hidden="true" />
      <div className="journey-library-card back-one" aria-hidden="true" />
      <div className="journey-library-card front">
        <div className="journey-library-person"><span>S</span><div><strong>Someone special</strong><small>3 keepsakes · Private</small></div></div>
        <blockquote>“I’m proud of you. Always.”</blockquote>
        <div className="journey-finished-wave" aria-hidden="true">{wave.slice(0, 16).map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div>
        <div className="journey-library-action"><span><Play size={12} fill="currentColor" /> 00:18</span><small>WARM · ENGLISH</small></div>
      </div>
    </div>
  );
}

export function KeepsakeJourney() {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const current = steps[active];

  useEffect(() => {
    if (!playing) return;

    const timer = window.setTimeout(() => {
      if (active === steps.length - 1) {
        setPlaying(false);
        return;
      }
      setActive((step) => step + 1);
    }, FRAME_DURATION);

    return () => window.clearTimeout(timer);
  }, [active, playing]);

  function selectStep(index: number) {
    setActive(index);
    setPlaying(false);
  }

  function togglePlayback() {
    if (!playing && active === steps.length - 1) setActive(0);
    setPlaying((value) => !value);
  }

  return (
    <div className={`keepsake-journey${playing ? ' is-playing' : ''}`}>
      <div className="journey-tabs" role="tablist" aria-label="Keepsake creation steps">
        {steps.map(({ number, title, subtitle, icon: Icon }, index) => (
          <button type="button" role="tab" id={`journey-tab-${index}`} aria-controls="journey-panel" aria-selected={active === index} className={active === index ? 'active' : ''} key={number} onClick={() => selectStep(index)}>
            <span>{number}</span><Icon size={17} /><div><strong>{title}</strong><small>{subtitle}</small></div><i />
          </button>
        ))}
      </div>

      <div className="journey-panel" id="journey-panel" role="tabpanel" aria-labelledby={`journey-tab-${active}`} aria-live="polite" key={active}>
        <div className="journey-panel-head">
          <span><i /><span>WITHYOU · VISUAL WALKTHROUGH</span></span>
          <strong>{current.detail}</strong>
          <small><i /> {current.badge}</small>
        </div>
        <div className="journey-panel-scene"><JourneyScene active={active} playing={playing} /></div>
        <div className="journey-panel-foot">
          <button type="button" className="journey-transport" onClick={togglePlayback} aria-label={playing ? 'Pause how it works animation' : 'Play how it works animation'}>
            {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
            <span>{playing ? 'Pause story' : active === steps.length - 1 ? 'Replay story' : 'Play story'}</span>
          </button>
          <div className="journey-scrubber" aria-label="Jump to a part of the walkthrough">
            {steps.map((step, index) => (
              <button type="button" key={step.number} className={index === active ? 'active' : index < active ? 'passed' : ''} onClick={() => selectStep(index)} aria-label={`Jump to ${step.title}`}>
                <span>{step.number}</span><i><b className={playing && index === active ? 'running' : ''} /></i><small>{step.title}</small>
              </button>
            ))}
          </div>
          <div className="journey-time"><span>00:{String(active * 4).padStart(2, '0')}</span><i>/</i><span>00:16</span></div>
          <p><LockKeyhole size={12} />{current.footer}</p>
        </div>
      </div>
    </div>
  );
}
