# Architecture

## System overview

WithYou is a TypeScript web application built with React, the Next.js App Router API surface, Vinext, and Cloudflare's local/deployment runtime.

```text
Browser
  |  account UI, session cookie, uploads, playback, delivery controls
  v
Route handlers
  |  session identity, origin, validation, ownership, rate limits
  +--------------------+
  |                    |
  v                    v
Cloudflare D1       Cloudflare R2
metadata            private audio bytes
  |
  v
VoiceProvider interface
  +-- Cartesia adapter (live)
  +-- deterministic mock (test/demo only)
```

## Boundaries and responsibilities

- `app/page.tsx` is the public product landing page and adapts its primary action for signed-in visitors.
- `app/studio/page.tsx` is the authenticated server boundary for the private library.
- `app/studio.tsx` owns the interactive client experience and calls server routes.
- `app/sign-in/**`, `app/reset-password/**`, and the authentication form components own account creation, sign-in, verification, and recovery UI.
- `app/account/**` and `components/account-settings.tsx` own profile, password, session, and account-deletion controls.
- `app/api/auth/**` exposes the email/password and Google OAuth endpoints.
- `app/api/**` implements library, audio, voice-sample, recording-bank, generation, update, and delete operations.
- `app/auth.ts` resolves server-validated Better Auth sessions and maps them to app owners.
- `lib/auth.ts` configures Better Auth against D1, including Google OAuth, email lifecycle hooks, session policy, token encryption, and rate limits.
- `lib/account.ts` reads linked identity methods and removes all owner-scoped metadata and R2 objects during account deletion.
- `lib/email.ts` sends verification and recovery messages without exposing the email provider credential to the browser.
- `lib/server.ts` enforces authentication, same-origin writes, and storage availability.
- `lib/validation.ts` contains reusable input and business-rule validation.
- `lib/voice-generation.ts` coordinates cloning/generation, locks, quotas, D1 writes, and R2 objects.
- `lib/providers/**` isolates the speech provider behind a small interface.
- `db/schema.ts` defines D1 metadata tables; `drizzle/**` contains ordered migrations.

## Data model

- `user`, `session`, `account`, and `verification`: account identities, password hashes/OAuth links, and expiring sessions or one-time challenges.
- `authRateLimit`: database-backed request counters for authentication abuse protection.
- `voices`: owner-scoped profiles, consent timestamp, and optional provider voice ID.
- `recordings`: owner-scoped original or generated audio metadata and delivery settings.
- `generation_locks`: short-lived, per-voice concurrency protection.
- `generation_events`: successful generation history used for daily quotas and auditing.

Audio bytes are never stored in D1. Each recording points to a private R2 object key. API handlers verify ownership before returning or changing metadata and objects.

Deleting a voice is an owner-checked cascading application operation: it removes the remote provider clone first, deletes every associated R2 object, then removes generation locks, events, recordings, and the voice row from D1. A provider failure stops the local deletion so the application retains the identifier needed to retry remote cleanup.

## Trust and privacy model

Email/password credentials use the authentication library's password hashing and are never stored in plaintext. Google access, refresh, and ID tokens are encrypted at rest with AES-256-GCM; a migration removes legacy plaintext provider tokens. Verification identifiers are hashed. Sessions expire after seven days, refresh at most daily, and use HTTP-only, same-site cookies that become secure-only in production. Sensitive operations require a session created within the last 15 minutes unless the user confirms their password. Google OAuth is enabled only when both provider credentials are present. Production also requires a high-entropy authentication secret and an explicit public base URL.

Reference recordings and requested text are sent to the configured speech provider when generating. Provider credentials stay server-side. Mock mode requires a second explicit opt-in so an accidental environment-value change cannot silently enable it.

The guided recorder uses the Web Audio API only inside the browser to measure microphone energy. Its adaptive noise threshold and faster pacing model are an activity-based guide rather than semantic transcription. After capture, the client mixes the signal to mono, trims leading and trailing silence, applies bounded level normalization and short edge fades, and encodes a 16-bit PCM WAV. It does not transcribe the prompt or send live microphone data to a speech-recognition service. Prepared bytes are uploaded only when the user explicitly saves the form.

## Request lifecycle

1. The server validates the session cookie, resolves the account owner, and rejects unauthenticated access.
2. Write routes reject cross-origin browser requests.
3. Shared validators constrain text, files, consent, and delivery settings.
4. Database queries include the owner boundary.
5. Generation acquires a per-voice lock and checks the daily quota.
6. The provider returns WAV bytes, which are stored in R2 before metadata is committed to D1.
7. Updates regenerate the same logical keepsake and replace its audio object.

## Near-term extension points

Translation, billing, asynchronous generation, provider benchmarking, and observability should enter through explicit adapters/services. Keep route handlers thin and preserve the current owner, validation, and provider boundaries when adding them.
