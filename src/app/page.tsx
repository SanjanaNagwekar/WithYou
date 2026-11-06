import {
  ArrowDown,
  ArrowUpRight,
  Check,
  FlaskConical,
  Globe2,
  LockKeyhole,
  Mic2,
  Sparkles,
} from 'lucide-react';
import { getAuthenticatedUser } from '@/app/auth';
import { KeepsakeJourney } from '@/components/keepsake-journey';
import { LivingSignal } from '@/components/living-signal';
import { WithYouBrand } from '@/components/withyou-brand';

export const dynamic = 'force-dynamic';

export default async function LandingPage() {
  const user = await getAuthenticatedUser();
  const primaryHref = user ? '/studio' : '/sign-in?return_to=%2Fstudio';
  const primaryLabel = user ? 'Open your library' : 'Create your private library';

  return (
    <div className="signal-page">
      <header className="signal-header">
        <WithYouBrand />
        <nav className="signal-nav" aria-label="Primary navigation">
          <a href="/research">Research</a>
          {user ? null : <a href="/sign-in?return_to=%2Fstudio">Sign in</a>}
          <a className="signal-nav-cta" href={primaryHref}>
            {user ? 'Open library' : 'Enter the studio'} <ArrowUpRight size={14} />
          </a>
        </nav>
      </header>

      <main className="signal-main">
        <section className="signal-hero">
          <div className="signal-hero-copy">
            <h1>Keep the voices<br />that feel like <em>home.</em></h1>
            <p className="signal-hero-lede">Preserve the voices of the people you love—and create personal keepsakes for the words you never want time to take away.</p>
            <div className="signal-actions">
              <a className="signal-primary" href={primaryHref}>{primaryLabel} <ArrowUpRight size={16} /></a>
              <a className="signal-text-link" href="#how-it-works">Explore the system <ArrowDown size={14} /></a>
            </div>
          </div>

          <LivingSignal />

          <div className="signal-hero-foot">
            <span><i /> Permission first</span><span><i /> Yours alone</span><span><i /> Recreated audio labeled</span>
          </div>
        </section>

        <section className="journey-section" id="how-it-works">
          <div className="journey-intro">
            <h2 className="journey-title">How a keepsake is made.</h2>
            <div className="journey-intro-rail">
              <p className="journey-subtitle">From a recording to something you can hold onto.</p>
              <i aria-hidden="true" />
              <p className="journey-description">Press play to follow one message from a real recording to a private keepsake—or choose any moment to explore it yourself.</p>
            </div>
          </div>
          <KeepsakeJourney />
        </section>

        <section className="signal-system" id="system">
          <div className="signal-system-copy">
            <span className="signal-index light">03 / MADE WITH CARE</span>
            <h2>Tender by design.<br /><em>Thoughtful underneath.</em></h2>
            <p>The experience stays gentle because the system does the difficult work quietly: local audio preparation, authenticated ownership boundaries, private storage, controlled voice generation, and evidence-led quality checks.</p>
            <a href="/research">Open the research brief <ArrowUpRight size={15} /></a>
          </div>
          <div className="signal-pipeline" aria-label="WithYou technical pipeline">
            <div className="pipeline-row source"><span>01</span><div><small>INPUT</small><strong>Consented recording</strong></div><Mic2 /></div>
            <div className="pipeline-connector"><i /><span>TRIM · NORMALIZE · PCM WAV</span><i /></div>
            <div className="pipeline-row processing"><span>02</span><div><small>VOICE ENGINE</small><strong>Quality-gated synthesis</strong></div><Sparkles /></div>
            <div className="pipeline-split"><i /><span>OWNER-CHECKED ROUTES</span><i /></div>
            <div className="pipeline-outputs">
              <div><Globe2 /><small>15 LOCALIZED<br />VOICE PATHS</small></div>
              <div><LockKeyhole /><small>PRIVATE R2<br />AUDIO OBJECTS</small></div>
              <div><FlaskConical /><small>BLINDED<br />EVALUATION</small></div>
            </div>
          </div>
        </section>

        <section className="signal-evidence" id="evidence">
          <div className="signal-evidence-heading">
            <span className="signal-evidence-kicker">INSIDE THE LISTENING ROOM</span>
            <h2>Care deserves more than a demo.</h2>
            <p>We did not choose a voice provider from a polished sample. We compared the same recordings and prompts, measured the system, and asked listeners which result still felt most recognizable.</p>
          </div>
          <div className="signal-stats">
            <article>
              <header className="metric-header"><span>01</span><span>Speaker similarity</span></header>
              <div className="metric-result">
                <div className="metric-value"><strong>48</strong><small>/53</small></div>
                <p>listener<br />preferences</p>
              </div>
              <p className="metric-detail">Cartesia led the non-tied speaker-similarity comparisons.</p>
            </article>
            <article>
              <header className="metric-header"><span>02</span><span>Study design</span></header>
              <div className="metric-result">
                <div className="metric-value"><strong>24</strong></div>
                <p>paired<br />cases</p>
              </div>
              <p className="metric-detail">The same prompts and enrollment audio were used across providers.</p>
            </article>
            <article>
              <header className="metric-header"><span>03</span><span>Initial benchmark</span></header>
              <div className="metric-result">
                <div className="metric-value"><strong>1,126</strong><small>ms</small></div>
                <p>median<br />generation</p>
              </div>
              <p className="metric-detail">Median generation latency measured in the initial benchmark.</p>
            </article>
          </div>
          <a className="signal-research-link" href="/research"><span>Read how the model decision was made</span><ArrowUpRight /></a>
        </section>

        <section className="signal-language" id="languages">
          <div className="signal-language-marquee" aria-hidden="true">
            <span>ENGLISH</span><i /><span>ESPAÑOL</span><i /><span>FRANÇAIS</span><i /><span>हिन्दी</span><i /><span>日本語</span><i /><span>PORTUGUÊS</span>
          </div>
          <div className="signal-language-body">
            <div className="signal-language-intro">
              <span className="signal-language-kicker">ONE VOICE · FIFTEEN SUPPORTED PATHS</span>
              <h2>Love rarely lives<br /><em>in just one language.</em></h2>
              <p>Choose from 15 supported languages while preserving the selected voice. Quality-gated translation keeps every option tied to a dedicated voice path—not an unlimited language claim.</p>
              <span className="signal-verified"><Check size={14} /> QUALITY-GATED TRANSLATION</span>
            </div>
            <div className="signal-language-route" aria-label="One familiar voice connected to fifteen supported language paths">
              <div><small>FAMILIAR VOICE</small><strong>Someone special</strong></div>
              <span aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><b /></span>
              <div><small>SUPPORTED PATHS</small><strong>15</strong></div>
            </div>
            <div className="signal-language-list" aria-label="Example supported languages">
              <span>English</span><span>Español</span><span>Français</span><span>हिन्दी</span><span>日本語</span><span>Português</span>
            </div>
          </div>
        </section>

        <section className="signal-final">
          <span className="signal-final-label">A PRIVATE PLACE TO REMEMBER</span>
          <h2>Keep a little<br /><em>of them close.</em></h2>
          <p>Begin with one voice and one moment that still feels like home.</p>
          <a className="signal-final-cta" href={primaryHref}><span>{primaryLabel}</span><ArrowUpRight /></a>
        </section>
      </main>

      <footer className="signal-footer">
        <WithYouBrand className="inverted" />
        <p>Made for memories. Held with care.</p>
        <div><a href="/research">Research</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="https://github.com/SanjanaNagwekar/WithYou">Source</a></div>
      </footer>
    </div>
  );
}
