# Authentication

WithYou supports email/password accounts and Google OAuth through Better Auth. Account, provider, and session records are stored in Cloudflare D1. Session cookies are HTTP-only, same-site, and secure in production; OAuth tokens are encrypted before storage.

## Google account lifecycle

`Continue with Google` serves both registration and sign-in:

1. The browser requests an authorization URL from `/api/auth/sign-in/social`.
2. Google returns to `/api/auth/callback/google` with a short-lived authorization code.
3. The server validates the OAuth state and exchanges the code directly with Google.
4. A first-time verified Google identity creates one `user` row and one linked `account` row. A session is then issued and the user is sent to `/studio`.
5. Later sign-ins resolve the linked provider account and create a fresh session without creating a duplicate user.

An existing email/password account is linked only when its local email is already verified and Google confirms the same email. WithYou does not force-link an unverified identity and does not allow linking accounts with different email addresses.

The app requests only Google's standard OpenID Connect identity scopes: `openid`, `email`, and `profile`. It does not request Gmail, Drive, Contacts, or other sensitive Google data.

## Google Auth Platform setup

Use a **Web application** OAuth client. For the current deployment, configure:

- Authorized JavaScript origin: `https://withyou.sanjana-nagwekar.workers.dev`
- Authorized redirect URI: `https://withyou.sanjana-nagwekar.workers.dev/api/auth/callback/google`

In Google Cloud Console:

1. Open **Google Auth Platform → Branding** and provide the app name, user support email, and developer contact email.
2. Under **Audience**, select **External** so consumer Google accounts are eligible.
3. Under **Data Access**, keep only the basic identity scopes (`openid`, email, and profile).
4. Under **Clients**, create or update the Web application client with the exact production origin and callback above. HTTPS, hostname, path, and trailing slash must match exactly.
5. For a controlled pilot, keep the app in **Testing**. Because WithYou requests only basic Sign in with Google identity scopes, Google currently exempts this flow from the test-user allowlist, warning screen, and seven-day authorization expiry; any Google Account can authenticate once the audience is External. Select **Publish app** when you are ready to mark the OAuth project as **In production** and complete any branding or verification steps Google requests.
6. Store the client ID and secret as Cloudflare Worker secrets named `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Never place the downloaded client JSON in this repository or expose the secret to browser code.

If the public hostname changes, update `BETTER_AUTH_URL`, the Google JavaScript origin, and the Google callback URI together. A custom domain is optional; the current `workers.dev` hostname can be used as long as the callback exactly matches it.

## Email/password public-launch requirement

Before opening email/password registration to unlisted testers, configure `RESEND_API_KEY` and `AUTH_EMAIL_FROM` with a verified sender. That enables email verification and password recovery. Google-only registration does not depend on Resend.

## Manual acceptance check

Use a Google account that has never signed into WithYou:

1. Open a private/incognito browser window and choose **Continue with Google**.
2. Approve the basic identity request.
3. Confirm the browser lands on the empty private studio instead of returning to sign-in.
4. Create a small test voice profile, sign out, and sign in with Google again.
5. Confirm the same profile is present and no duplicate user or library was created.
6. Cancel a separate Google sign-in attempt and confirm WithYou shows a recoverable cancellation message.

The integration suite exercises authorization, the callback, first-user provisioning, and session creation against a locally signed mock Google identity. CI never contains a test user's Google password or a production OAuth secret. The real provider flow should still be exercised with the manual acceptance check before a public release.
