# WithYou

A private voice-keepsake MVP: preserve a reference recording, record new memories into a private recording bank, create a familiar voice through the configured speech provider, generate labeled AI audio, and play, download, or delete original and generated recordings. Generated keepsakes can be regenerated in place with new mood, pace, and volume settings.

## Run locally

Requires Node 22.13+. Run `npm ci`, then `npm run build`. Apply the local schema migrations:

```
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_new_makkari.sql
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_bizarre_cardiac.sql
```

Copy `.env.example` to `.env` and optionally supply `CARTESIA_API_KEY`. Run `npm run dev` and open the printed URL. Development uses a local-only simulated user. Production must supply trusted `x-withyou-user-id`, `x-withyou-user-email`, and optional `x-withyou-user-full-name` headers through an authentication layer; do not expose the application publicly until that layer is configured. Owner checks protect every library and audio operation. D1 stores metadata and R2 stores private audio.

## Cartesia setup

Set `CARTESIA_API_KEY` as a secret in the Site environment and redeploy. `CARTESIA_MODEL_ID` defaults to `sonic-3.6`. Never put a provider key in client code. The reference clip is sent to Cartesia only on first generation, after permission was recorded when creating the profile. Generated audio is returned as WAV. Without a key, originals can still be uploaded, played, and downloaded.

Official API references:
- https://docs.cartesia.ai/api-reference/voices/clone
- https://docs.cartesia.ai/api-reference/tts/bytes
- https://docs.cartesia.ai/build-with-cartesia/tts-models/latest

## MVP limits

15 MB per source recording; MP3/WAV/M4A/WebM. Users can upload a file or record in the browser when creating or improving a voice, and can save multiple original recordings to each profile's recording bank. Browser recording requires microphone permission and stops automatically after 10 minutes. Generations and in-place keepsake updates are limited to 1,000 characters, 30 successful generations per user per day, and one in-flight generation per voice. Consent is an attestation, not identity or legal-authority verification. Files are checked by size and declared audio MIME type; no transcoding or audio quality analysis is included. Short, clean, single-speaker clips are best. Generation uses synchronous provider calls with a timeout; failed provider work may incur charges even when no keepsake is saved. There is no payment processing, family sharing, profile deletion, subscription logic, or background queue yet. This is a private pilot, not a paid public launch.

## Verification

Build and TypeScript checks pass. Locally verified upload persistence, browser recording with a synthetic microphone stream, recording-bank storage and playback, microphone-permission recovery, consent rejection, anonymous library/audio rejection, byte-identical playback/download, missing-provider errors, UI recording selection, and valid/invalid WebMCP phrase staging. Live provider cloning and generation require a configured API key.
