'use client';

import { useState, useSyncExternalStore } from 'react';

type ViewMode = 'all' | 'decisive';

const results = [
  { label: 'Speaker similarity', question: 'Sounds like the reference person', cartesia: 48, eleven: 5, tie: 19 },
  { label: 'Naturalness', question: 'Sounds natural and human', cartesia: 38, eleven: 2, tie: 32 },
  { label: 'Pronunciation', question: 'Clear and accurate pronunciation', cartesia: 6, eleven: 16, tie: 50 },
];

const subscribeToHydration = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

function percent(value: number, total: number) {
  return total ? (value / total) * 100 : 0;
}

export function ResearchListeningChart() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [view, setView] = useState<ViewMode>('all');
  const isReady = useSyncExternalStore(subscribeToHydration, getClientSnapshot, getServerSnapshot);
  const active = results[activeIndex];
  const activeTotal = active.cartesia + active.eleven;
  const activeShare = percent(active.cartesia, active.cartesia + active.eleven);

  return (
    <div
      className="listening-atlas"
      role="region"
      aria-label="Interactive listening study results"
      aria-busy={!isReady}
      data-ready={isReady}
    >
      <header className="atlas-toolbar">
        <div>
          <span>THE LISTENING RESULTS</span>
          <strong>Which voice did listeners prefer?</strong>
        </div>
        <div className="listening-view" aria-label="Chart denominator">
          <button type="button" disabled={!isReady} className={view === 'all' ? 'active' : ''} aria-pressed={view === 'all'} onClick={() => setView('all')}>All decisions</button>
          <button type="button" disabled={!isReady} className={view === 'decisive' ? 'active' : ''} aria-pressed={view === 'decisive'} onClick={() => setView('decisive')}>Decisive only</button>
        </div>
      </header>

      <div className="ballot-list">
        {results.map((result, rowIndex) => {
          const total = result.cartesia + result.eleven + (view === 'all' ? result.tie : 0);
          const series = [
            { key: 'cartesia', label: 'Cartesia', value: result.cartesia },
            { key: 'eleven', label: 'ElevenLabs', value: result.eleven },
            ...(view === 'all' ? [{ key: 'tie', label: 'Tie', value: result.tie }] : []),
          ];

          return (
            <button
              key={`${result.label}-${view}`}
              type="button"
              disabled={!isReady}
              className={`ballot-row ${activeIndex === rowIndex ? 'active' : ''}`}
              aria-pressed={activeIndex === rowIndex}
              onClick={() => setActiveIndex(rowIndex)}
              onMouseEnter={() => setActiveIndex(rowIndex)}
              onFocus={() => setActiveIndex(rowIndex)}
            >
              <span className="ballot-copy">
                <i>0{rowIndex + 1}</i>
                <strong>{result.label}</strong>
                <small>{result.question}</small>
                <small className="ballot-total">{total} {view === 'all' ? 'decisions' : 'non-tied decisions'}</small>
              </span>
              <span className="preference-bars">
                {series.map((seriesItem, seriesIndex) => (
                  <span className={`preference-line ${seriesItem.key}`} key={seriesItem.key}>
                    <span className="preference-label">{seriesItem.label}</span>
                    <span className="preference-track" aria-hidden="true">
                      <i style={{ width: `${percent(seriesItem.value, total)}%`, animationDelay: `${rowIndex * 220 + seriesIndex * 100}ms` }} />
                    </span>
                    <span className="preference-value"><strong>{seriesItem.value}</strong><small>{percent(seriesItem.value, total).toFixed(1)}%</small></span>
                  </span>
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <footer className="atlas-readout" aria-live="polite">
        <div><span>SELECTED QUESTION</span><strong>{active.label}</strong><small>{active.question}</small></div>
        <p><strong>{activeShare.toFixed(1)}%</strong> of the {activeTotal} non-tied decisions preferred Cartesia.</p>
      </footer>
    </div>
  );
}
