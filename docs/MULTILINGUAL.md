# Multilingual keepsakes

WithYou treats speaker similarity as a release requirement, not a best-effort option. The language selector is therefore limited to the languages Cartesia documents for dedicated voice localization rather than every language Google Cloud Translation can translate.

## Supported production flow

1. A user writes an English source message.
2. The server translates it with Google Cloud Translation Advanced v3.
3. On the first keepsake for a language, WithYou asks Cartesia to create a localized derivative of the profile's original clone using a verified localizable accent ID.
4. The localized provider voice ID is cached in D1 and reused for later keepsakes in that language.
5. Cartesia immediately synthesizes the translated text with the matching language code.

English continues to use the original clone. Replacing a profile's active reference recording deletes the prior base clone and all localized variants so future generations are rebuilt from the improved sample. Existing audio files remain playable.

The approved language set is English, German, Spanish (Spain), French (France), Japanese, Portuguese (Brazil), Mandarin Chinese, Hindi, Italian, Korean, Dutch, Polish, Russian, Swedish, and Turkish. Each non-English option is mapped to an accent currently marked localizable in Cartesia's accent catalog. The mapping lives in `lib/languages.ts` and must be revalidated against `GET /accents?is_localizable=true` when the provider API changes.

## Google Cloud setup

Use a dedicated service account rather than the OAuth client used for Google sign-in. The two credentials have different responsibilities.

1. Open the Google Cloud project used for WithYou, or create a dedicated production project.
2. Attach a billing account. Cloud Translation requires billing even when usage remains inside a free allowance.
3. Open **APIs & Services → Library**, search for **Cloud Translation API**, and enable it.
4. Open **IAM & Admin → Service Accounts** and create a service account named `withyou-translation`.
5. Grant only **Cloud Translation API User** (`roles/cloudtranslate.user`). Do not grant Owner or Editor.
6. Open the new service account, select **Keys → Add key → Create new key → JSON**, and download the file.
7. Keep the JSON outside the repository. Do not copy it into a tracked file or expose it to browser code.
8. For local development, place the compact, single-line contents in `.env` as `GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON`. Wrapping the JSON in single quotes is the safest shell-style `.env` representation.
9. For production, upload that entire JSON value as a Cloudflare Worker secret named `GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON`.
10. Apply migration `drizzle/0004_low_molly_hayes.sql` to production D1 before deploying the application code.

If Google Cloud prevents service-account key creation, use an organization-approved workload identity approach rather than weakening the policy. The current Worker adapter expects a service-account JSON key, so workload identity would require a follow-up adapter.

## Configuration

```dotenv
GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\\n...","client_email":"..."}'
WITHYOU_TRANSLATION_PROVIDER=google
WITHYOU_ALLOW_MOCK_TRANSLATION=false
```

The application exchanges the signed service-account assertion for a short-lived access token and caches that token in memory. The JSON key and access token never enter API responses, D1, R2, or client-side bundles.

## Stored provenance

Generated keepsakes retain the English source text, translated transcript, source and target languages, and translation provider. This allows the exact spoken text to be audited and makes future provider-quality comparisons reproducible.

## Quality release policy

Before expanding the approved language list, evaluate speaker similarity, pronunciation, intelligibility, emotional delivery, and failure rate using consistent reference clips. A language should remain unavailable if localization sounds less like the source speaker, even when text translation and generic synthesis are technically supported.
