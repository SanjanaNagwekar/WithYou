# WithYou

WithYou is a private voice-keepsake application with a public product landing page and an authenticated personal studio. It preserves consented reference recordings, stores original memories, and creates clearly labeled synthetic keepsakes through a configurable speech provider. A keepsake can be replayed, downloaded, deleted, or regenerated in place with a different feeling, pace, and volume.

## Current capabilities

- Create a voice profile from an uploaded file or a guided browser recording with responsive local activity feedback, silence trimming, level normalization, and voice-ready PCM WAV output.
- Create an account with email and password, sign in with a secure session, and sign out.
- Sign in with Google and safely link a verified Google identity to the same account.
- Update a profile, change a password, revoke other sessions, and delete an account with all owned data.
- Enable email verification and password recovery through optional server-side email delivery.
- Organize each person as a voice profile with separate original-audio management, keepsake creation, and recent generated keepsakes.
- Generate a WAV keepsake through Cartesia or a deterministic local mock.
- Change delivery settings without creating a second keepsake record.
- Remove an individual recording or permanently remove a voice profile with all associated recordings, keepsakes, stored audio, and provider clones.
- Enforce per-owner access, same-origin writes, daily generation limits, and per-voice generation locks.
- Store metadata in Cloudflare D1 and private audio objects in Cloudflare R2.
- Test validation, provider behavior, API/data boundaries, and the primary browser journey.

## Local setup

Prerequisites: an even-numbered Node.js release supported by the toolchain (22.13+, 24, or 26+) and npm. Continuous integration uses Node.js 24.

```bash
npm ci
cp .env.example .env
npm run build
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_new_makkari.sql
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_bizarre_cardiac.sql
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_dark_thunderball.sql
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0003_auth_rate_limits.sql
npm run dev
```

## Production deployment

The production Cloudflare resource identifiers live in `deployment.json`. Build and deploy with:

```bash
npm run deploy:production
```

Production credentials must be stored as encrypted Worker secrets. They are declared as required in
the generated Wrangler configuration and must never be committed as plain-text variables.

Open `http://localhost:5173`, create an account, and sign in. Development uses an explicitly local-only session secret when `BETTER_AUTH_SECRET` is empty; production refuses to start without a configured secret and base URL. The first local account automatically takes ownership of data created by the earlier local prototype so existing recordings are not lost.

To enable live voice generation, add `CARTESIA_API_KEY` to `.env`. The browser never receives this secret. Without it, original recordings can still be uploaded, played, downloaded, and deleted.

## Safe demo data

The deterministic mock provider is limited to environments that explicitly opt in. Start a local server with both controls enabled, then seed it:

```bash
WITHYOU_VOICE_PROVIDER=mock WITHYOU_ALLOW_MOCK_PROVIDER=true npm run dev
npm run seed
```

The seed command is idempotent and refuses to run against Cartesia. Do not enable the mock provider in production.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `CARTESIA_API_KEY` | For live generation | Server-side Cartesia credential. |
| `CARTESIA_MODEL_ID` | No | Cartesia model; defaults to `sonic-3.6`. |
| `WITHYOU_VOICE_PROVIDER` | No | `cartesia` by default; `mock` for controlled demos/tests. |
| `WITHYOU_ALLOW_MOCK_PROVIDER` | For mock mode | Must be `true` before mock generation is allowed. |
| `BETTER_AUTH_SECRET` | Production | High-entropy secret of at least 32 characters used to protect sessions. |
| `BETTER_AUTH_URL` | Production | Public application origin, such as `https://withyou.example`. |
| `GOOGLE_CLIENT_ID` | For Google sign-in | Google OAuth web client ID. Must be set with its client secret. |
| `GOOGLE_CLIENT_SECRET` | For Google sign-in | Google OAuth web client secret. Must be set with its client ID. |
| `RESEND_API_KEY` | For verification/recovery email | Server-side Resend credential. Must be set with the sender address. |
| `AUTH_EMAIL_FROM` | For verification/recovery email | Verified sender email address used for account messages. |
| `WITHYOU_BASE_URL` | Seed only | Seed target; defaults to `http://localhost:5173`. |
| `WITHYOU_PERSIST_PATH` | Test tooling only | Overrides local Cloudflare state location. |

Provider configuration is validated before the authenticated application renders. Invalid modes and unsafe mock configuration fail immediately. A missing Cartesia credential disables generation with an explicit server-side response while leaving original-recording features available.

## Verification

```bash
npm run lint
npm run typecheck
npm run test:coverage
npm run test:integration
npm run test:e2e
npm run build
```

`npm run validate` runs every non-browser check. Integration tests create isolated temporary D1 and R2 resources. End-to-end tests rebuild the application, reset a dedicated local state directory, start the mock provider, and run Chromium through the main user journey.

## Production requirements

Production uses D1-backed accounts, encrypted OAuth tokens, hashed verification identifiers, database-backed authentication rate limits, and secure HTTP-only session cookies. Set `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` before deployment. To enable Google sign-in, create a separate production Google OAuth web client and register `https://YOUR_DOMAIN/api/auth/callback/google` as an authorized redirect URI, then configure both Google variables. To require email verification and expose password recovery, configure both email delivery variables with a verified sender.

The current pilot has no payment processing, family sharing, subscription logic, background job queue, malware scanning, or legal-authority verification. It accepts MP3, WAV, M4A, and WebM reference files up to 15 MB; generations are limited to 1,000 characters and 30 successful generations per user per day.

See [Architecture](docs/ARCHITECTURE.md), [Testing](docs/TESTING.md), [Contributing](CONTRIBUTING.md), and [Security](SECURITY.md) for more detail.
