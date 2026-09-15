# Security Policy

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability or include private recordings, credentials, access tokens, or personal data in a report.

Use the repository's private security advisory form at:

https://github.com/SanjanaNagwekar/WithYou/security/advisories/new

Include the affected route or component, reproduction conditions, expected impact, and a minimal proof of concept that does not contain another person's data. You should receive an acknowledgment within seven days. Public disclosure should wait until a fix or mitigation is available.

## Supported version

Until the first tagged release, security fixes apply to the latest commit on `main` only.

## Credential handling

Never commit `.env`, provider keys, recordings, local Cloudflare state, browser reports, or database files. If a secret is exposed, revoke and replace it immediately; deleting it from the latest commit is not sufficient because Git history retains prior content.

OAuth tokens are encrypted at rest, passwords are stored only as one-way hashes, and one-time verification identifiers are hashed. Production authentication secrets and provider credentials must be stored in the deployment platform's encrypted secret store. Account deletion removes owner-scoped D1 records and their private R2 audio objects before removing the identity record.
