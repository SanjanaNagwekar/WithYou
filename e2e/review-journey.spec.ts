import { expect, test } from '@playwright/test';

const reviewUrl = '/review/e2e-private-review-token-1234567890';

test('reviewer completes the provider-blinded A/B survey without an account', async ({ page }) => {
  await page.goto(reviewUrl);
  await expect(page.getByRole('heading', { name: 'Which voice feels closer?' })).toBeVisible();
  await expect(page.getByText('PRIVATE · PROVIDER-BLINDED')).toBeVisible();
  await page.getByRole('button', { name: /Begin review/ }).click();

  await expect(page.getByText('Comparison 1 of 1')).toBeVisible();
  await expect(page.locator('audio')).toHaveCount(3);
  await expect(page.getByText('provider-one')).toHaveCount(0);
  await expect(page.getByText('provider-two')).toHaveCount(0);

  await page.getByRole('group', { name: 'Which sounds more like the reference person?' }).getByRole('button', { name: 'Voice A' }).click();
  await page.getByRole('group', { name: 'Which sounds more natural and human?' }).getByRole('button', { name: 'About the same' }).click();
  await page.getByRole('group', { name: 'Which has clearer, more accurate pronunciation?' }).getByRole('button', { name: 'Voice B' }).click();
  await page.getByRole('button', { name: /Save and finish/ }).click();

  await expect(page.getByText('REVIEW COMPLETE')).toBeVisible();
  await page.reload();
  await expect(page.getByText('REVIEW COMPLETE')).toBeVisible();
});
