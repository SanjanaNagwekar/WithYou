# Testing

## Test layers

| Layer | Command | Scope |
| --- | --- | --- |
| Static analysis | `npm run lint` | ESLint rules and common implementation mistakes. |
| Type safety | `npm run typecheck` | TypeScript without emitting build files. |
| Unit | `npm run test:coverage` | Validation, environment configuration, and provider behavior. |
| API integration | `npm run test:integration` | Real auth/app route handlers against temporary isolated D1 and R2 resources. |
| Browser | `npm run test:e2e` | Account creation, desktop primary journey, and mobile control smoke test in Chromium. |
| Production build | `npm run build` | Complete Vinext build and route compilation. |

## Isolation

Unit tests do not require network services. API integration tests create Miniflare runtimes with temporary D1 and R2 resources, apply the checked-in migrations, and destroy the runtimes afterward. Authentication coverage verifies password account creation, session cookies, repeat sign-in, and Google OAuth authorization URL creation without contacting Google.

End-to-end preparation deletes only `.wrangler/e2e-state`, rebuilds the application, and reapplies migrations. Playwright starts the server with the deterministic mock voice provider. It never calls Cartesia and never reads a live provider key.

The normal local state in `.wrangler/state` is separate and is not reset by automated tests.

## Adding tests

- Put pure business-rule cases in `tests/unit`.
- Put full route/storage behavior in `tests/integration` using `tests/helpers/test-runtime.ts`.
- Extend `e2e/primary-journey.spec.ts` only for high-value user-visible flows.
- Assert behavior and accessibility roles instead of implementation-specific CSS selectors where possible.
- Use synthetic audio in tests; do not commit personal voice recordings or credentials.

## Continuous integration

The CI workflow runs quality and browser jobs on pushes to `main` and on pull requests. Failed browser runs retain a Playwright report for seven days. Dependency review rejects newly introduced dependencies with moderate-or-higher known vulnerabilities, and CodeQL scans JavaScript/TypeScript changes.
