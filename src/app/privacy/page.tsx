import type { Metadata } from 'next';
import Link from 'next/link';
import { AudioLines, ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy — WithYou',
  description: 'How WithYou handles account information, recordings, and generated audio.',
};

export default function PrivacyPage() {
  return (
    <div className="legal-page">
      <header className="legal-header">
        <Link className="brand" href="/" aria-label="WithYou home"><AudioLines /> WithYou</Link>
        <Link className="legal-back" href="/"><ArrowLeft size={14} /> Back home</Link>
      </header>
      <main className="legal-content">
        <span className="eyebrow">WITHYOU PRIVACY POLICY</span>
        <h1>Your voice data deserves clear boundaries.</h1>
        <p className="legal-updated">Last updated October 4, 2026</p>
        <section><h2>What WithYou collects</h2><p>WithYou stores the account information needed to operate your private library, such as your name, email address, linked sign-in method, and session records. When you choose to preserve a voice, WithYou stores the recordings you upload or record, the profile details you provide, your keepsake text, translations, delivery settings, generated audio, and the consent timestamp associated with the voice profile.</p><p>Security records may include an IP address, browser user agent, request counters, and timestamps. WithYou does not sell personal information or use private recordings to train its own model.</p></section>
        <section><h2>How the information is used</h2><p>Account information authenticates you and keeps libraries separated. Recordings are used to create the private voice profile and audio you request. Keepsake text may be translated and synthesized only when you initiate generation. Technical records protect accounts, enforce usage limits, investigate failures, and prevent abuse.</p></section>
        <section><h2>Service providers</h2><p>Cloudflare hosts the application, database, and private object storage. Cartesia receives a reference recording and requested text when creating or using a voice clone. Google Cloud Translation receives source text for non-English keepsakes. Google may provide account identity when you choose Google sign-in. Resend may deliver verification and recovery messages when email delivery is enabled. These providers process data under their own terms and privacy policies.</p></section>
        <section><h2>Storage and security</h2><p>Audio objects are stored in a private bucket and served only through authenticated, owner-checked routes. Passwords are one-way hashed, OAuth tokens are encrypted at rest, and production sessions use secure HTTP-only cookies. No internet service can guarantee absolute security, so do not upload a recording unless you are comfortable entrusting it to these systems.</p></section>
        <section><h2>Retention and deletion</h2><p>Account content is retained while your account exists. You can delete individual recordings, generated keepsakes, an entire voice profile, or your account. Voice-profile and account deletion attempts to remove associated application records, stored audio, and provider voice clones. Provider or infrastructure failures can delay deletion; contact the address below if a deletion does not complete.</p></section>
        <section><h2>Your choices</h2><p>Upload only voices you own or have clear permission to preserve and recreate. You may download or delete your content through the application. You can revoke Google account access through your Google Account settings, but doing so does not itself delete your WithYou library. Use WithYou’s account deletion control for that purpose.</p></section>
        <section><h2>Children</h2><p>WithYou is not directed to children under 13, and children should not create accounts or provide recordings.</p></section>
        <section><h2>Contact</h2><p>For privacy, access, or deletion questions, contact <a href="mailto:sanjana.nagwekar1@gmail.com">sanjana.nagwekar1@gmail.com</a>. Do not send private recordings or credentials by email.</p></section>
      </main>
      <footer className="legal-footer"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/">WithYou</Link></footer>
    </div>
  );
}
