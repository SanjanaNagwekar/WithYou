import type { Metadata } from 'next';
import Link from 'next/link';
import { AudioLines, ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Terms of Use — WithYou',
  description: 'Rules for the responsible use of WithYou voice keepsakes.',
};

export default function TermsPage() {
  return (
    <div className="legal-page">
      <header className="legal-header">
        <Link className="brand" href="/" aria-label="WithYou home"><AudioLines /> WithYou</Link>
        <Link className="legal-back" href="/"><ArrowLeft size={14} /> Back home</Link>
      </header>
      <main className="legal-content">
        <span className="eyebrow">WITHYOU TERMS OF USE</span>
        <h1>Preserve voices responsibly.</h1>
        <p className="legal-updated">Last updated October 4, 2026</p>
        <section><h2>Purpose and acceptance</h2><p>WithYou is a portfolio-stage service for preserving authorized recordings and creating clearly identified synthetic voice keepsakes. By using the service, you agree to these terms and the Privacy Policy. If you do not agree, do not use the service.</p></section>
        <section><h2>Permission is required</h2><p>You may upload or recreate a voice only when it is your own voice or when you have the speaker’s informed permission and legal authority to do so. Permission must cover synthetic voice generation, not merely possession of an old recording. You are responsible for honoring withdrawal of consent and removing the affected profile.</p></section>
        <section><h2>Prohibited uses</h2><p>Do not use WithYou to impersonate, deceive, defraud, threaten, harass, discriminate, bypass authentication, violate intellectual-property or privacy rights, misrepresent synthetic audio as authentic evidence, or influence financial, employment, medical, legal, political, or identity-verification decisions. Do not remove synthetic-audio disclosures when doing so could mislead another person.</p></section>
        <section><h2>Your content</h2><p>You retain responsibility for the recordings, text, and other content you provide. You grant WithYou and its service providers the limited permission necessary to store, translate, process, synthesize, and return that content at your direction. WithYou does not claim ownership of your recordings or keepsakes.</p></section>
        <section><h2>Accounts and security</h2><p>Keep your account credentials secure and notify the project owner if you suspect unauthorized access. You may not probe, scrape, overload, reverse engineer, or circumvent limits or security controls. Accounts may be limited or removed to protect users, providers, or the service.</p></section>
        <section><h2>Generated output</h2><p>Synthetic audio can contain pronunciation errors, unnatural delivery, translation mistakes, or speaker-similarity failures. Review output before relying on or sharing it. WithYou is not an identity-verification, evidentiary, emergency, medical, legal, or financial service.</p></section>
        <section><h2>Pilot availability</h2><p>WithYou is offered as a portfolio-stage pilot and may change, experience outages, enforce usage limits, or discontinue features. Third-party voice, translation, authentication, hosting, and email services may impose additional restrictions. The service is provided without a guarantee of uninterrupted availability or a particular quality level.</p></section>
        <section><h2>Deletion and termination</h2><p>You can delete content or your account through the application. WithYou may suspend access when reasonably necessary to address abuse, security, provider requirements, or legal obligations. Provisions concerning permission, prohibited uses, responsibility, and limitations continue to apply to prior use.</p></section>
        <section><h2>Contact</h2><p>Questions or responsible-use concerns can be sent to <a href="mailto:sanjana.nagwekar1@gmail.com">sanjana.nagwekar1@gmail.com</a>. Never email passwords, access tokens, or private recordings.</p></section>
      </main>
      <footer className="legal-footer"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/">WithYou</Link></footer>
    </div>
  );
}
