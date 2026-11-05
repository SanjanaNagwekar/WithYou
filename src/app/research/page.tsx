import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, AudioLines, FlaskConical, LockKeyhole, Users } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Voice Research — WithYou',
  description: 'How WithYou compared Cartesia and ElevenLabs through automated evaluation and provider-blinded listening.',
};

const results = [
  { label: 'Speaker similarity', question: 'Sounds like the reference person', cartesia: 48, eleven: 5, tie: 19 },
  { label: 'Naturalness', question: 'Sounds natural and human', cartesia: 38, eleven: 2, tie: 32 },
  { label: 'Pronunciation', question: 'Clear and accurate pronunciation', cartesia: 6, eleven: 16, tie: 50 },
];

function percent(value: number) {
  return `${((value / 72) * 100).toFixed(1)}%`;
}

export default function ResearchPage() {
  return (
    <div className="research-page">
      <header className="research-header">
        <Link className="brand" href="/" aria-label="WithYou home"><AudioLines /> WithYou</Link>
        <Link className="research-back" href="/"><ArrowLeft size={14} /> Back home</Link>
      </header>
      <main>
        <section className="research-hero">
          <span className="eyebrow">PRODUCT RESEARCH · VOICE MODEL EVALUATION</span>
          <h1>Choosing a voice model with <em>evidence.</em></h1>
          <p>WithYou compared Cartesia and ElevenLabs using the same consented speakers, enrollment recordings, prompts, and delivery settings—then combined automated measurements with a provider-blinded human study.</p>
          <div className="research-facts"><span><strong>4</strong> consented speakers</span><span><strong>24</strong> paired cases</span><span><strong>3</strong> blind reviewers</span><span><strong>216</strong> listening decisions</span></div>
        </section>
        <section className="research-results" aria-labelledby="human-results">
          <div className="research-section-heading"><div><span className="eyebrow">HUMAN EVALUATION</span><h2 id="human-results">What listeners heard</h2></div><p>Every reviewer heard the real held-out reference plus anonymous Voice A and Voice B. Provider order was independently randomized for every reviewer.</p></div>
          <div className="research-legend" aria-label="Chart legend"><span className="cartesia">Cartesia</span><span className="eleven">ElevenLabs</span><span className="tie">Tie</span></div>
          <div className="research-chart">
            {results.map((result) => (
              <article key={result.label}>
                <div><strong>{result.label}</strong><small>{result.question}</small></div>
                <div className="research-bar" aria-label={`${result.label}: ${result.cartesia} Cartesia, ${result.eleven} ElevenLabs, ${result.tie} ties`}>
                  <span className="cartesia" style={{ width: percent(result.cartesia) }}><b>{percent(result.cartesia)}</b></span>
                  <span className="eleven" style={{ width: percent(result.eleven) }}><b>{result.eleven > 4 ? percent(result.eleven) : ''}</b></span>
                  <span className="tie" style={{ width: percent(result.tie) }}><b>{percent(result.tie)}</b></span>
                </div>
                <p>{result.cartesia} Cartesia · {result.eleven} ElevenLabs · {result.tie} ties</p>
              </article>
            ))}
          </div>
        </section>
        <section className="research-decision">
          <div><span className="research-icon"><FlaskConical /></span><span className="eyebrow">PRODUCT DECISION</span><h2>Cartesia remains the quality-gated choice.</h2><p>Cartesia received 48 of 53 non-tied speaker-similarity preferences and 38 of 40 non-tied naturalness preferences. It also had stronger automated speaker similarity and lower median latency. Because recognizability is WithYou’s core promise, those signals outweigh a marginal proxy score in isolation.</p></div>
          <dl><div><dt>Similarity preference</dt><dd>90.6%</dd><span>Cartesia, excluding ties</span></div><div><dt>Naturalness preference</dt><dd>95.0%</dd><span>Cartesia, excluding ties</span></div><div><dt>Median latency</dt><dd>604 ms</dd><span>faster with Cartesia</span></div></dl>
        </section>
        <section className="research-method">
          <div className="research-section-heading"><div><span className="eyebrow">HOW THE STUDY WORKED</span><h2>Designed to reduce bias.</h2></div><p>The survey was built into WithYou rather than conducted through a spreadsheet, making the evaluation faster for reviewers and reproducible for future model experiments.</p></div>
          <ol><li><span>01</span><div><strong>Reference first</strong><p>Reviewers learned the real speaker’s voice from a held-out recording never used for cloning.</p></div></li><li><span>02</span><div><strong>Anonymous A/B audio</strong><p>Model names stayed server-side while A/B orientation and case order changed per reviewer.</p></div></li><li><span>03</span><div><strong>Three focused choices</strong><p>Each pair was judged separately for identity similarity, naturalness, and pronunciation.</p></div></li><li><span>04</span><div><strong>Private, resumable links</strong><p>Hashed invite tokens gated private R2 audio, and every response auto-saved to D1.</p></div></li></ol>
        </section>
        <section className="research-participate">
          <LockKeyhole /><div><span className="eyebrow">RESPONSIBLE PARTICIPATION</span><h2>Help with a future listening round.</h2><p>Participant voices are not exposed through an unrestricted public survey. Future reviewers receive a scoped private link after the study purpose and audio-handling expectations are shared.</p></div>
          <div className="research-actions"><a className="primary" href="mailto:sanjana.nagwekar1@gmail.com?subject=WithYou%20listening%20study%20volunteer">Request reviewer access <Users size={15} /></a><a href="https://github.com/SanjanaNagwekar/WithYou/blob/main/docs/BENCHMARKING.md">Read the full protocol <ArrowUpRight size={14} /></a></div>
        </section>
        <p className="research-limit">This was a controlled initial evaluation, not a population-level statistical claim. Raw audio, participant identities, provider voice IDs, consent records, and reviewer tokens remain private.</p>
      </main>
      <footer className="research-footer"><Link href="/">WithYou</Link><Link href="/privacy">Privacy</Link><a href="https://github.com/SanjanaNagwekar/WithYou">Source</a></footer>
    </div>
  );
}
