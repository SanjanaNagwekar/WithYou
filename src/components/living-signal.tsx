'use client';

import { Pause, Play } from 'lucide-react';
import { useRef, useState, type CSSProperties, type PointerEvent } from 'react';

const bars = Array.from({ length: 58 }, (_, index) => {
  const envelope = Math.sin((index / 57) * Math.PI);
  const texture = 0.42 + Math.abs(Math.sin(index * 1.71)) * 0.58;
  return Math.round(10 + envelope * texture * 79);
});

export function LivingSignal() {
  const [isMoving, setIsMoving] = useState(true);
  const signalRef = useRef<HTMLDivElement>(null);

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.round(((event.clientX - bounds.left) / bounds.width) * 100);
    const y = Math.round(((event.clientY - bounds.top) / bounds.height) * 100);
    event.currentTarget.style.setProperty('--pointer-x', `${x}%`);
    event.currentTarget.style.setProperty('--pointer-y', `${y}%`);
  }

  function resetPointer() {
    signalRef.current?.style.setProperty('--pointer-x', '54%');
    signalRef.current?.style.setProperty('--pointer-y', '42%');
  }

  return (
    <div
      className={`living-signal${isMoving ? ' is-moving' : ''}`}
      ref={signalRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetPointer}
      aria-label="Interactive voice keepsake memory thread"
    >
      <div className="living-signal-head">
        <div><i /><span>A MEMORY, HELD CLOSE</span><small>WY–001</small></div>
        <button type="button" aria-pressed={isMoving} onClick={() => setIsMoving((value) => !value)}>
          {isMoving ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
          {isMoving ? 'Let it rest' : 'Bring it to life'}
        </button>
      </div>
      <div className="living-signal-field">
        <div className="living-signal-grid" aria-hidden="true" />
        <div className="living-signal-bars" aria-hidden="true">
          {bars.map((height, index) => (
            <i key={index} style={{ '--bar-height': `${height}%`, '--bar-delay': `${index * -0.037}s` } as CSSProperties} />
          ))}
        </div>
        <div className="living-signal-playhead" aria-hidden="true"><i /><span>00:18</span></div>
        <div className="living-signal-message">
          <small>A NOTE TO RETURN TO</small>
          <blockquote>“A little reminder that<br />you are loved, always.”</blockquote>
          <span>Someone special</span>
        </div>
      </div>
      <div className="living-signal-foot"><span>00:00</span><span>KEPT PRIVATE · HELD WITH CARE</span><span>00:34</span></div>
    </div>
  );
}
