import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, LockKeyhole, Users } from 'lucide-react';
import { ResearchDecisionChart } from '@/components/research-decision-chart';
import { ResearchListeningChart } from '@/components/research-listening-chart';
import { WithYouBrand } from '@/components/withyou-brand';

export const metadata: Metadata = {
  title: 'Voice Research — WithYou',
  description: 'How WithYou compared Cartesia and ElevenLabs through automated evaluation and provider-blinded listening.',
};

export default function ResearchPage() {
  return (
    <div className="research-page">
      <header className="research-header">
        <WithYouBrand />
        <Link className="research-back" href="/"><ArrowLeft size={14} /> Back home</Link>
      </header>
      <main>
        <section className="research-hero">
          <div className="research-hero-grid">
            <div className="research-hero-copy">
              <span className="eyebrow">PRODUCT RESEARCH · VOICE MODEL EVALUATION</span>
              <h1>Choosing a voice model with <em>evidence.</em></h1>
              <p>WithYou compared Cartesia and ElevenLabs using the same consented speakers, enrollment recordings, prompts, and delivery settings—then combined automated measurements with a provider-blinded human study.</p>
            </div>
            <div className="research-signal" aria-label="Animated visualization of a blinded voice comparison">
              <header><span><i /> BLINDED LISTENING SIGNAL</span><small>A / B</small></header>
              <div className="research-signal-field" aria-hidden="true">
                {Array.from({ length: 31 }, (_, index) => <i key={index} style={{ height: `${24 + ((index * 17) % 61)}%`, animationDelay: `${(index % 9) * -0.12}s` }} />)}
                <b />
              </div>
              <footer><span>REFERENCE</span><span>ANONYMOUS OUTPUTS</span><span>DECISION</span></footer>
            </div>
          </div>
          <div className="research-facts"><span><strong>4</strong> consented speakers</span><span><strong>24</strong> paired cases</span><span><strong>3</strong> blind reviewers</span><span><strong>216</strong> listening decisions</span></div>
        </section>
        <section className="research-results" aria-labelledby="human-results">
          <div className="research-section-heading"><div><span className="eyebrow">HUMAN EVALUATION</span><h2 id="human-results">What listeners heard</h2></div><p>Every reviewer heard the real held-out reference plus anonymous Voice A and Voice B. Provider order was independently randomized for every reviewer.</p></div>
          <ResearchListeningChart />
        </section>
        <section className="research-decision">
          <header><span className="eyebrow">PRODUCT DECISION · THE SIGNAL THAT MATTERS</span><h2>The result holds across the two questions that matter most.</h2><p>The same provider led on both recognizability and naturalness. Hover or tap the chart to inspect the exact non-tied preference counts behind each point.</p></header>
          <ResearchDecisionChart />
          <div className="decision-conclusion"><span>THE DECISION</span><strong>Cartesia remains the quality-gated choice.</strong><p>It led the identity and naturalness comparisons, produced stronger automated speaker similarity, and generated audio faster in the initial benchmark.</p></div>
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
      <footer className="product-footer">
        <WithYouBrand className="inverted" />
        <p>Evidence before novelty. Care before scale.</p>
        <div><Link href="/">Home</Link><Link href="/privacy">Privacy</Link><a href="https://github.com/SanjanaNagwekar/WithYou">Source</a></div>
      </footer>
    </div>
  );
}
