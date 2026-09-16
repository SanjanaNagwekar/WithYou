import { ArrowUpRight, AudioLines, Heart, LockKeyhole, Mic, WandSparkles } from 'lucide-react';
import { getAuthenticatedUser } from '@/app/auth';

export const dynamic = 'force-dynamic';

const steps = [
  { number: '01', title: 'Preserve a voice', copy: 'Upload a meaningful recording or capture a clear guided sample in the moment.', icon: Mic },
  { number: '02', title: 'Write what matters', copy: 'Turn a favorite phrase, reassurance, or memory into a private voice keepsake.', icon: Heart },
  { number: '03', title: 'Listen and keep', copy: 'Shape the feeling and delivery, then return to your saved collection anytime.', icon: WandSparkles },
];

export default async function LandingPage() {
  const user = await getAuthenticatedUser();
  const primaryHref = user ? '/studio' : '/sign-in?return_to=%2Fstudio';
  const primaryLabel = user ? 'Open your library' : 'Create your private library';

  return (
    <div className="landing-page">
      <header className="landing-header">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="brand" href="/" aria-label="WithYou home"><AudioLines /> WithYou</a>
        <nav className="landing-nav" aria-label="Primary navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#privacy">Privacy</a>
          {user ? (
            <a className="landing-nav-cta" href="/studio">Open library <ArrowUpRight size={14} /></a>
          ) : (
            <>
              <a href="/sign-in?return_to=%2Fstudio">Sign in</a>
              <a className="landing-nav-cta" href="/sign-in?return_to=%2Fstudio">Get started <ArrowUpRight size={14} /></a>
            </>
          )}
        </nav>
      </header>

      <main className="landing-main">
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <span className="eyebrow">A PRIVATE HOME FOR FAMILIAR VOICES</span>
            <h1>Keep the voices<br />that feel like <em>home.</em></h1>
            <p>Preserve meaningful recordings and create personal voice keepsakes you can return to whenever you need them.</p>
            <div className="landing-actions">
              <a className="primary landing-primary" href={primaryHref}>{primaryLabel} <ArrowUpRight size={15} /></a>
              <a className="landing-secondary" href="#how-it-works">See how it works</a>
            </div>
            <div className="landing-trust-row">
              <span><LockKeyhole size={13} /> Private account</span>
              <span><Heart size={13} /> Consent first</span>
              <span><AudioLines size={13} /> AI audio labeled</span>
            </div>
          </div>

          <div className="landing-visual" aria-label="Voice keepsake preview">
            <div className="landing-orbit orbit-one" />
            <div className="landing-orbit orbit-two" />
            <div className="landing-preview-card">
              <div className="landing-preview-label"><span>VOICE KEEPSAKE</span><LockKeyhole size={13} /></div>
              <div className="landing-preview-person"><span>S</span><div><strong>Someone special</strong><small>A familiar voice, kept close</small></div></div>
              <div className="landing-wave" aria-hidden="true">
                {Array.from({ length: 37 }, (_, index) => (
                  <i key={index} style={{ height: Math.round(12 + Math.sin(index * 0.64) ** 2 * 48 + Math.sin(index * 0.19) ** 2 * 22) }} />
                ))}
              </div>
              <blockquote>“A little reminder that you are loved, always.”</blockquote>
              <div className="landing-preview-meta"><span>Warm</span><span>Private</span><span>Saved</span></div>
            </div>
          </div>
        </section>

        <section className="landing-purpose">
          <p>Some moments deserve more than a place in your camera roll.</p>
          <strong>WithYou gives meaningful voices a private place to stay.</strong>
        </section>

        <section className="landing-how" id="how-it-works">
          <div className="landing-section-heading">
            <span className="eyebrow">HOW IT WORKS</span>
            <h2>From a recording to something you can hold onto.</h2>
            <p>A gentle, guided flow designed to make each step clear.</p>
          </div>
          <div className="landing-steps">
            {steps.map(({ number, title, copy, icon: Icon }) => (
              <article key={number}>
                <div><span>{number}</span><Icon size={19} /></div>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-private" id="privacy">
          <div>
            <span className="landing-lock"><LockKeyhole /></span>
            <span className="eyebrow">BUILT WITH CARE</span>
            <h2>Your memories belong to you.</h2>
            <p>Your library is tied to your account. Recordings are stored privately, voice recreation requires explicit permission, and generated audio is clearly identified.</p>
          </div>
          <ul>
            <li><span>01</span><div><strong>Private by default</strong><p>Audio is served through authenticated, owner-checked routes.</p></div></li>
            <li><span>02</span><div><strong>You stay in control</strong><p>Download, replace, or permanently remove voices and keepsakes.</p></div></li>
            <li><span>03</span><div><strong>Transparent recreation</strong><p>Synthetic keepsakes are labeled so originals and recreations stay distinct.</p></div></li>
          </ul>
        </section>

        <section className="landing-roadmap">
          <div>
            <span className="eyebrow">ACROSS LANGUAGES</span>
            <h2>Familiar words, in more languages.</h2>
            <p>Choose a language for a keepsake while preserving the selected voice—designed for families whose memories cross borders and generations.</p>
          </div>
          <div className="language-preview" aria-label="Language selection preview">
            <span>KEEPSAKE LANGUAGE</span>
            <strong>English <span>⌄</span></strong>
            <p>Quality-gated translation keeps every supported language tied to a dedicated localized voice.</p>
          </div>
        </section>

        <section className="landing-final">
          <AudioLines />
          <h2>Keep something meaningful close.</h2>
          <p>Start with one voice and one moment worth remembering.</p>
          <a className="primary landing-primary" href={primaryHref}>{primaryLabel} <ArrowUpRight size={15} /></a>
        </section>
      </main>

      <footer className="landing-footer">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="brand small" href="/"><AudioLines /> WithYou</a>
        <p>Made for memories. Held with care.</p>
        <span>PRIVATE VOICE KEEPSAKES · AI AUDIO IS LABELED</span>
      </footer>
    </div>
  );
}
