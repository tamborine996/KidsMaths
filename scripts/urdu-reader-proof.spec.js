const { test, expect, devices } = require('playwright/test');
const path = require('path');

const baseURL = process.env.ALICE_PROOF_BASE_URL || 'http://127.0.0.1:8125/';
const outputDir = path.join(process.cwd(), 'tmp', 'urdu-reader-proof');

test.use({
  ...devices['Pixel 7'],
  viewport: { width: 412, height: 915 },
});

test('Urdu shelf is reading-first and reader uses popup + inline paragraph translation', async ({ page }) => {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Open Urdu/i }).click();

  await expect(page.getByText(/Last Read/i)).toBeVisible();
  await expect(page.getByText(/Your collection/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /Put away for now/i })).toHaveCount(0);
  await expect(page.getByText(/Supportive Urdu reads stay first/i)).toBeVisible();
  await expect(page.getByText(/Reading-ready|Needs smoothing/i)).toHaveCount(0);
  await page.screenshot({ path: path.join(outputDir, '01-urdu-shelf.png'), fullPage: false });

  await page.getByRole('button', { name: /Read together|Continue together|Open/i }).first().click();
  await expect(page.locator('#bookmark-btn')).toBeVisible();

  const urduWord = page.locator('.story-word-button', { hasText: 'کردار' }).first();
  await urduWord.scrollIntoViewIfNeeded();
  await urduWord.click();
  await expect(page.locator('#story-selection-adjusters')).toBeVisible();

  const box = await urduWord.boundingBox();
  await urduWord.dispatchEvent('pointerdown', {
    pointerId: 7,
    pointerType: 'touch',
    isPrimary: true,
    bubbles: true,
    clientX: box.x + box.width / 2,
    clientY: box.y + box.height / 2,
    button: 0,
    buttons: 1,
  });
  await page.waitForTimeout(650);
  await urduWord.dispatchEvent('pointerup', {
    pointerId: 7,
    pointerType: 'touch',
    isPrimary: true,
    bubbles: true,
    clientX: box.x + box.width / 2,
    clientY: box.y + box.height / 2,
    button: 0,
    buttons: 0,
  });
  await page.waitForTimeout(100);

  const popup = page.locator('#story-selection-controls');
  await expect(popup).toBeVisible();
  await expect(page.locator('#story-selection-bookmark-meta')).not.toHaveText(/^\s*$/);
  await page.screenshot({ path: path.join(outputDir, '02-urdu-word-popup.png'), fullPage: false });

  await page.locator('#story-selection-backdrop').dispatchEvent('click');
  await expect(popup).toBeHidden();

  const paragraphTranslate = page.locator('[data-paragraph-translate="1"]').first();
  await paragraphTranslate.scrollIntoViewIfNeeded();
  await paragraphTranslate.click();
  const paragraphTranslation = page.locator('.urdu-paragraph-translation:not(.hidden)').first();
  await expect(paragraphTranslation).toBeVisible();
  await page.screenshot({ path: path.join(outputDir, '03-urdu-inline-paragraph-translation.png'), fullPage: false });
});
