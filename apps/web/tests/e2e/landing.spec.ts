import { expect, test } from '@playwright/test';

test('landing page renders', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Project ready!' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Button' })).toBeVisible();
});
