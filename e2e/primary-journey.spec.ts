import { devices, expect, test } from '@playwright/test';

const wav = Buffer.from([
  82, 73, 70, 70, 36, 0, 0, 0, 87, 65, 86, 69, 102, 109, 116, 32,
  16, 0, 0, 0, 1, 0, 1, 0, 64, 31, 0, 0, 128, 62, 0, 0,
  2, 0, 16, 0, 100, 97, 116, 97, 0, 0, 0, 0,
]);

test.beforeEach(async ({ page }, testInfo) => {
  if (testInfo.title === 'public landing guides visitors into the product') {
    await page.goto('/');
    return;
  }
  await page.goto('/studio');
  await expect(page).toHaveURL(/\/sign-in/);
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('YOUR NAME').fill('E2E User');
  await page
    .getByLabel('EMAIL')
    .fill(`e2e-${Date.now()}-${testInfo.workerIndex}-${testInfo.retry}-${testInfo.title.replace(/\W/g, '-')}@example.test`);
  await page.getByLabel('PASSWORD').fill('secure-test-password');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page).toHaveURL('/studio');
});

test('public landing guides visitors into the product', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Keep the voices that feel like home.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Create your private library' }).first()).toHaveAttribute(
    'href',
    '/sign-in?return_to=%2Fstudio',
  );
  await expect(page.getByRole('heading', { name: 'From a recording to something you can hold onto.' })).toBeVisible();
  await expect(page.getByText('Translation support is planned for a future phase.')).toBeVisible();
});

test('navigation stays focused between the landing page and private library', async ({ page }) => {
  const studioHeader = page.getByRole('banner');
  await expect(studioHeader.getByRole('link', { name: 'WithYou home' })).toHaveAttribute('href', '/');
  await expect(studioHeader.getByText('PRIVATE STUDIO')).toHaveCount(0);
  await expect(studioHeader.getByRole('link', { name: 'About WithYou' })).toHaveCount(0);

  await studioHeader.getByRole('link', { name: 'WithYou home' }).click();
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: 'Keep the voices that feel like home.' })).toBeVisible();
  const landingHeader = page.getByRole('banner');
  await expect(landingHeader.getByText('VOICE KEEPSAKES')).toHaveCount(0);
  await landingHeader.getByRole('link', { name: /Open library/ }).click();
  await expect(page).toHaveURL('/studio');
  await expect(page.getByRole('heading', { name: 'Voice profiles' })).toBeVisible();
});

test('user can preserve a voice and manage a generated keepsake', async ({ page }) => {
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: 'Voice profiles' })).toBeVisible();

  await page.getByRole('button', { name: 'Add a voice profile' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('Name').fill('E2E Demo Voice');
  await page.getByLabel('Relationship').fill('Demo family member');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'e2e-sample.wav',
    mimeType: 'audio/wav',
    buffer: wav,
  });
  await page.getByLabel('Permission to preserve and recreate this voice').check();
  await page.getByRole('button', { name: 'Save voice & recording' }).click();
  await expect(page.getByRole('status')).toContainText('Voice and original recording saved.');

  await page.getByLabel('YOUR WORDS').fill('You are loved, always.');
  await page.getByLabel('Feeling').selectOption('warm');
  await page.getByRole('button', { name: 'Create audio' }).click();
  await expect(page.getByRole('status')).toContainText('Your new keepsake is ready.');
  const keepsakeHeading = page.getByRole('heading', { name: 'You are loved, always.' });
  await expect(keepsakeHeading).toBeVisible();
  await expect(page.getByText(/Warm.*1\.00.*pace.*1\.00.*volume/)).toBeVisible();

  await page.getByRole('tab', { name: /Voice recordings/ }).click();
  await expect(page.getByText('ACTIVE VOICE SAMPLE', { exact: true })).toBeVisible();
  await expect(keepsakeHeading).toHaveCount(0);
  await page.getByRole('tab', { name: /Keepsakes/ }).click();
  await expect(keepsakeHeading).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download You are loved, always.' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^withyou-generated-.+\.wav$/);

  await page.getByRole('button', { name: 'Adjust delivery for You are loved, always.' }).click();
  await page.getByRole('region', { name: 'Delivery for You are loved, always.' }).getByLabel('FEELING').selectOption('proud');
  await page.getByRole('button', { name: 'Update audio' }).click();
  await expect(page.getByRole('status')).toContainText('Keepsake updated.');
  await expect(page.getByText(/Proud.*pace.*volume/)).toBeVisible();

  await page.getByRole('button', { name: 'Delete You are loved, always.' }).click();
  await expect(page.getByRole('heading', { name: 'Delete this keepsake?' })).toBeVisible();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Keepsake deleted.');
  await expect(keepsakeHeading).toHaveCount(0);

  await page.getByRole('tab', { name: /Voice recordings/ }).click();
  await expect(page.getByText('ORIGINAL AUDIO ONLY')).toBeVisible();
  await page.getByRole('button', { name: 'Remove profile' }).click();
  await expect(page.getByRole('heading', { name: 'Remove E2E Demo Voice?' })).toBeVisible();
  await page.getByRole('button', { name: 'Remove profile and audio' }).click();
  await expect(page.getByRole('status')).toContainText('E2E Demo Voice and all associated recordings were removed.');
  await expect(page.getByRole('heading', { name: 'Start with someone special' })).toBeVisible();
});

test('user can update profile and secure other sessions', async ({ page }) => {
  await page.getByRole('link', { name: 'Account settings' }).click();
  await expect(page).toHaveURL('/account');
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
  await page.getByLabel('DISPLAY NAME').fill('Updated E2E User');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.getByRole('status')).toContainText('Profile updated.');

  await page.getByRole('button', { name: 'Sign out other devices' }).click();
  await expect(page.getByRole('status')).toContainText('Other devices have been signed out.');

  await page.getByRole('link', { name: 'Back to library' }).click();
  await expect(page).toHaveURL('/studio');
  await expect(page.getByText('Updated E2E User')).toBeVisible();

  await page.getByRole('button', { name: 'Add a voice profile' }).click();
  await page.getByRole('button', { name: 'Record now' }).click();
  await expect(page.getByText('READ THIS ALOUD')).toBeVisible();
  await expect(page.getByText(/Every morning, I open the window/)).toBeVisible();
  await page.keyboard.press('Escape');
});

test.describe('mobile layout', () => {
  const pixel = devices['Pixel 7'];
  test.use({
    viewport: pixel.viewport,
    userAgent: pixel.userAgent,
    deviceScaleFactor: pixel.deviceScaleFactor,
    isMobile: pixel.isMobile,
    hasTouch: pixel.hasTouch,
  });

  test('exposes the primary controls', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Add a voice profile' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Start with someone special' })).toBeVisible();
  });
});
