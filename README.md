# WithYou

WithYou is a private voice-keepsake application. It preserves consented reference recordings, stores original memories, and creates clearly labeled synthetic keepsakes through a configurable speech provider. A keepsake can be replayed, downloaded, deleted, or regenerated in place with a different feeling, pace, and volume.

## Current capabilities

- Create a voice profile from an uploaded file or browser recording.
- Keep multiple original recordings in a private recording bank.
- Generate a WAV keepsake through Cartesia or a deterministic local mock.
- Change delivery settings without creating a second keepsake record.
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
npm run dev
```

Open `http://localhost:5173`. Local development injects a simulated user only for loopback requests. Never use this mechanism as production authentication.

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

Production must put a trusted authentication layer in front of WithYou that supplies `x-withyou-user-id`, `x-withyou-user-email`, and optionally `x-withyou-user-full-name`. Do not expose the application publicly until the upstream layer strips untrusted versions of these headers and supplies verified identity values.

The current pilot has no payment processing, family sharing, account/profile deletion, subscription logic, background job queue, malware scanning, or legal-authority verification. It accepts MP3, WAV, M4A, and WebM reference files up to 15 MB; generations are limited to 1,000 characters and 30 successful generations per user per day.

See [Architecture](docs/ARCHITECTURE.md), [Testing](docs/TESTING.md), [Contributing](CONTRIBUTING.md), and [Security](SECURITY.md) for more detail.
