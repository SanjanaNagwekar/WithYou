import { expect, test } from '@playwright/test';

test('email signup and sign-in load the requested page with the new session', async ({ page }) => {
  const email = `auth-navigation-${Date.now()}@example.test`;
  const password = 'secure-navigation-test-password';
  await page.goto('/sign-in?return_to=%2Faccount');
  await page.getByRole('button', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('YOUR NAME').fill('Navigation Test');
  await page.getByLabel('EMAIL', { exact: true }).fill(email);
  await page.getByLabel('PASSWORD', { exact: true }).fill(password);

  // Authentication changes the server session. Require a document request so a
  // stale anonymous router payload cannot leave a successful signup on this form.
  const signupNavigation = page.waitForRequest(
    (request) => request.isNavigationRequest() && new URL(request.url()).pathname === '/account',
    { timeout: 10_000 },
  );
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await signupNavigation;
  await expect(page).toHaveURL('/account');
  await expect(page.getByRole('heading', { name: 'Navigation Test', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Profile', exact: true })).toBeVisible();

  const signout = await page.request.post('/api/auth/sign-out', {
    headers: { Origin: new URL(page.url()).origin },
    data: {},
  });
  expect(signout.ok()).toBeTruthy();
  await page.goto('/sign-in?return_to=%2Faccount');
  await page.getByLabel('EMAIL', { exact: true }).fill(email);
  await page.getByLabel('PASSWORD', { exact: true }).fill('incorrect-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled();

  await page.getByLabel('PASSWORD', { exact: true }).fill(password);
  const signinNavigation = page.waitForRequest(
    (request) => request.isNavigationRequest() && new URL(request.url()).pathname === '/account',
    { timeout: 10_000 },
  );
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await signinNavigation;
  await expect(page).toHaveURL('/account');
  await expect(page.getByRole('heading', { name: 'Navigation Test', exact: true })).toBeVisible();
});
