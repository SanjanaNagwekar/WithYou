# Contributing

## Development workflow

1. Create a focused branch from `main`.
2. Install exact dependencies with `npm ci`.
3. Make one coherent change with tests at the appropriate layer.
4. Run `npm run validate`; run `npm run test:e2e` for user-facing changes.
5. Open a pull request using the repository template.

Keep credentials, personal recordings, local databases, generated reports, and build output out of commits. Use synthetic audio and the explicitly enabled mock provider for automated or shared demos.

## Commit and review expectations

- Keep commits small enough to review independently.
- Explain behavior and risk, not only filenames changed.
- Include migration and rollback notes for schema changes.
- Preserve owner checks on every data and audio operation.
- Preserve visible disclosure for generated voice audio.
- Add environment variables to `.env.example` with safe defaults and document them.

Security vulnerabilities should follow [SECURITY.md](SECURITY.md), not a public issue.

