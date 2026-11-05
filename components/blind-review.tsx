'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, AudioLines, Check, Headphones, LockKeyhole } from 'lucide-react';

type Choice = 'a' | 'b' | 'tie';
type ResponseValue = { similarity: Choice; naturalness: Choice; pronunciation: Choice };
type ReviewItem = {
  id: string;
  position: number;
  promptText: string;
  audio: { reference: string; a: string; b: string };
  response: ResponseValue | null;
};
type ReviewData = {
  title: string;
  reviewerLabel: string;
  completed: number;
  total: number;
  items: ReviewItem[];
};

const emptyResponse: Partial<ResponseValue> = {};

function ChoiceButtons({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: Choice;
  onChange: (choice: Choice) => void;
}) {
  return (
    <fieldset className="review-question">
      <legend>{label}</legend>
      <div>
        {([
          ['a', 'Voice A'],
          ['tie', 'About the same'],
          ['b', 'Voice B'],
        ] as const).map(([choice, copy]) => (
          <button
            key={choice}
            type="button"
            className={value === choice ? 'selected' : ''}
            aria-pressed={value === choice}
            onClick={() => onChange(choice)}
          >
            {value === choice && <Check size={14} />} {copy}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function BlindReview({ token }: { token: string }) {
  const [data, setData] = useState<ReviewData | null>(null);
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [response, setResponse] = useState<Partial<ResponseValue>>(emptyResponse);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch(`/api/review/${token}`, { cache: 'no-store' })
      .then(async (result) => {
        const body = (await result.json()) as ReviewData & { error?: string };
        if (!result.ok) throw new Error(body.error || 'The review could not be loaded.');
        if (!active) return;
        setData(body);
        const firstIncomplete = body.items.findIndex((item) => !item.response);
        const nextIndex = firstIncomplete === -1 ? Math.max(0, body.items.length - 1) : firstIncomplete;
        setIndex(nextIndex);
        setResponse(body.items[nextIndex]?.response || emptyResponse);
        setFinished(firstIncomplete === -1);
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : 'The review could not be loaded.');
      });
    return () => {
      active = false;
    };
  }, [token]);

  const item = data?.items[index];
  const completed = data?.items.filter((candidate) => candidate.response).length || 0;
  const canSave = Boolean(response.similarity && response.naturalness && response.pronunciation);

  function move(nextIndex: number) {
    if (!data) return;
    const bounded = Math.min(Math.max(nextIndex, 0), data.items.length - 1);
    setIndex(bounded);
    setResponse(data.items[bounded].response || emptyResponse);
    setError('');
  }

  async function saveAndContinue() {
    if (!data || !item || !canSave) return;
    setBusy(true);
    setError('');
    try {
      const result = await fetch(`/api/review/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, ...response }),
      });
      const body = (await result.json()) as { error?: string };
      if (!result.ok) throw new Error(body.error || 'Your response could not be saved.');
      const items = data.items.map((candidate) =>
        candidate.id === item.id ? { ...candidate, response: response as ResponseValue } : candidate,
      );
      setData({ ...data, items });
      const nextIndex = items.findIndex((candidate, candidateIndex) => candidateIndex > index && !candidate.response);
      if (nextIndex === -1) {
        setFinished(true);
      } else {
        setIndex(nextIndex);
        setResponse(items[nextIndex].response || emptyResponse);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Your response could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) {
    return (
      <main className="review-shell review-state">
        <LockKeyhole />
        <h1>Review unavailable</h1>
        <p>{error}</p>
      </main>
    );
  }

  if (!data || !item) {
    return <main className="review-shell review-state"><AudioLines className="review-pulse" /><p>Preparing your private review…</p></main>;
  }

  if (!started && !finished) {
    return (
      <main className="review-shell">
        <header className="review-brand"><AudioLines /> WithYou <span>VOICE STUDY</span></header>
        <section className="review-intro">
          <span className="review-icon"><Headphones /></span>
          <p className="review-kicker">PRIVATE · PROVIDER-BLINDED</p>
          <h1>Which voice feels closer?</h1>
          <p>You will hear one real reference and two generated versions of the same sentence. Choose A, B, or “about the same” for three quick questions.</p>
          <ul>
            <li><strong>{data.total} comparisons</strong><span>Your progress saves after every screen.</span></li>
            <li><strong>Use headphones</strong><span>Keep the volume and listening setup consistent.</span></li>
            <li><strong>Keep audio private</strong><span>Do not download, forward, or identify the speakers.</span></li>
          </ul>
          <button className="review-start" type="button" onClick={() => setStarted(true)}>Begin review <ArrowRight /></button>
        </section>
      </main>
    );
  }

  if (finished) {
    return (
      <main className="review-shell review-state review-complete">
        <span><Check /></span>
        <p className="review-kicker">REVIEW COMPLETE</p>
        <h1>Thank you for listening carefully.</h1>
        <p>All {data.total} comparisons are saved. You can close this page now.</p>
        <button type="button" onClick={() => { setFinished(false); setStarted(true); move(0); }}>Review my answers</button>
      </main>
    );
  }

  const percent = Math.round((completed / data.total) * 100);
  return (
    <main className="review-shell">
      <header className="review-brand"><AudioLines /> WithYou <span>VOICE STUDY</span></header>
      <section className="review-progress" aria-label={`${completed} of ${data.total} complete`}>
        <div><span>Comparison {index + 1} of {data.total}</span><strong>{percent}% complete</strong></div>
        <i><b style={{ width: `${percent}%` }} /></i>
      </section>

      <section className="review-card">
        <div className="review-reference">
          <div><span>1</span><p><strong>Listen to the real reference</strong><small>Learn the speaker&apos;s voice first.</small></p></div>
          <audio controls preload="metadata" src={item.audio.reference}>Your browser cannot play this audio.</audio>
        </div>

        <div className="review-prompt">
          <span>2</span><p><strong>Read the sentence</strong><q>{item.promptText}</q></p>
        </div>

        <div className="review-candidates">
          <div className="review-step-label"><span>3</span><p><strong>Compare the two generated voices</strong><small>The provider order is hidden and randomized.</small></p></div>
          <div className="review-audio-grid">
            <article><span>VOICE A</span><audio controls preload="metadata" src={item.audio.a}>Your browser cannot play this audio.</audio></article>
            <article><span>VOICE B</span><audio controls preload="metadata" src={item.audio.b}>Your browser cannot play this audio.</audio></article>
          </div>
        </div>

        <div className="review-questions">
          <p className="review-step-label"><span>4</span><strong>Choose what you hear</strong></p>
          <ChoiceButtons label="Which sounds more like the reference person?" value={response.similarity} onChange={(similarity) => setResponse((current) => ({ ...current, similarity }))} />
          <ChoiceButtons label="Which sounds more natural and human?" value={response.naturalness} onChange={(naturalness) => setResponse((current) => ({ ...current, naturalness }))} />
          <ChoiceButtons label="Which has clearer, more accurate pronunciation?" value={response.pronunciation} onChange={(pronunciation) => setResponse((current) => ({ ...current, pronunciation }))} />
        </div>

        {error && <p className="review-error" role="alert">{error}</p>}
        <footer className="review-actions">
          <button type="button" className="review-back" disabled={index === 0 || busy} onClick={() => move(index - 1)}><ArrowLeft /> Back</button>
          <button type="button" className="review-save" disabled={!canSave || busy} onClick={() => void saveAndContinue()}>{busy ? 'Saving…' : index === data.total - 1 ? 'Save and finish' : 'Save and continue'} <ArrowRight /></button>
        </footer>
      </section>
      <p className="review-privacy"><LockKeyhole /> Private study audio · Provider identities remain hidden until reviews are final.</p>
    </main>
  );
}
