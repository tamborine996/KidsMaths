const { test, expect, devices } = require('playwright/test');
const path = require('path');

const baseURL = process.env.ALICE_PROOF_BASE_URL || 'http://127.0.0.1:8124/';
const outputDir = path.join(process.cwd(), 'tmp', 'urdu-reader-proof');

test.use({
  ...devices['Pixel 7'],
  viewport: { width: 412, height: 915 },
});

test('Urdu shelf is article-focused and reader uses popup + inline paragraph translation', async ({ page }) => {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Open Urdu/i }).click();

  await expect(page.getByRole('heading', { name: /Continue your Urdu reading/i })).toBeVisible();
  await expect(page.getByText(/Only the two live article reads stay on the main shelf/i)).toBeVisible();
  await expect(page.getByText(/Reading-ready|Needs smoothing/i)).toHaveCount(0);
  await page.screenshot({ path: path.join(outputDir, '01-urdu-shelf.png'), fullPage: false });

  await page.getByRole('button', { name: /Start reading/i }).click();
  await expect(page.locator('#bookmark-btn')).toBeVisible();

  const urduWord = page.locator('.urdu-word-button', { hasText: 'کردار' }).first();
  await urduWord.scrollIntoViewIfNeeded();
  await urduWord.click();

  const popup = page.locator('#story-selection-controls');
  await expect(popup).toBeVisible();
  await expect(page.locator('#story-selection-bookmark-meta')).not.toHaveText(/^\s*$/);
  await page.screenshot({ path: path.join(outputDir, '02-urdu-word-popup.png'), fullPage: false });

  await page.locator('#story-selection-clear-btn').click();
  await expect(popup).toBeHidden();

  const paragraphTranslate = page.locator('[data-paragraph-translate="1"]').first();
  await paragraphTranslate.scrollIntoViewIfNeeded();
  await paragraphTranslate.click();
  const paragraphTranslation = page.locator('.urdu-paragraph-translation:not(.hidden)').first();
  await expect(paragraphTranslation).toBeVisible();
  await page.screenshot({ path: path.join(outputDir, '03-urdu-inline-paragraph-translation.png'), fullPage: false });
});
