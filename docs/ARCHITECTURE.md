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

- `app/studio.tsx` owns the interactive client experience and calls server routes.
- `app/sign-in/**` and `components/auth-form.tsx` own account creation and sign-in UI.
- `app/api/auth/**` exposes the email/password and Google OAuth endpoints.
- `app/api/**` implements library, audio, voice-sample, recording-bank, generation, update, and delete operations.
- `app/auth.ts` resolves server-validated Better Auth sessions and maps them to app owners.
- `lib/auth.ts` configures Better Auth against the existing D1 binding.
- `lib/server.ts` enforces authentication, same-origin writes, and storage availability.
- `lib/validation.ts` contains reusable input and business-rule validation.
- `lib/voice-generation.ts` coordinates cloning/generation, locks, quotas, D1 writes, and R2 objects.
- `lib/providers/**` isolates the speech provider behind a small interface.
- `db/schema.ts` defines D1 metadata tables; `drizzle/**` contains ordered migrations.

## Data model

- `user`, `session`, `account`, and `verification`: account identities, credentials/OAuth links, and expiring sessions.
- `voices`: owner-scoped profiles, consent timestamp, and optional provider voice ID.
- `recordings`: owner-scoped original or generated audio metadata and delivery settings.
- `generation_locks`: short-lived, per-voice concurrency protection.
- `generation_events`: successful generation history used for daily quotas and auditing.

Audio bytes are never stored in D1. Each recording points to a private R2 object key. API handlers verify ownership before returning or changing metadata and objects.

## Trust and privacy model

Email/password credentials are hashed by the authentication library and never stored in plaintext. Session tokens are sent in HTTP-only cookies and resolved on the server before app data is queried. Google OAuth is enabled only when both provider credentials are present. Production also requires a high-entropy authentication secret and an explicit public base URL.

Reference recordings and requested text are sent to the configured speech provider when generating. Provider credentials stay server-side. Mock mode requires a second explicit opt-in so an accidental environment-value change cannot silently enable it.

## Request lifecycle

1. The server validates the session cookie, resolves the account owner, and rejects unauthenticated access.
2. Write routes reject cross-origin browser requests.
3. Shared validators constrain text, files, consent, and delivery settings.
4. Database queries include the owner boundary.
5. Generation acquires a per-voice lock and checks the daily quota.
6. The provider returns WAV bytes, which are stored in R2 before metadata is committed to D1.
7. Updates regenerate the same logical keepsake and replace its audio object.

## Near-term extension points

Email verification and account recovery should extend the authentication service. Translation, billing, asynchronous generation, provider benchmarking, and observability should enter through explicit adapters/services. Keep route handlers thin and preserve the current owner, validation, and provider boundaries when adding them.
