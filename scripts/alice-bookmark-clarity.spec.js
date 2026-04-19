const { test, expect, devices } = require('playwright/test');
const path = require('path');

const baseURL = process.env.ALICE_PROOF_BASE_URL || 'http://127.0.0.1:8124/';
const outputDir = path.join(process.cwd(), 'tmp', 'alice-bookmark-proof');

test.use({
  ...devices['Pixel 7'],
  viewport: { width: 412, height: 915 },
});

test('Alice selected word can be bookmarked and stays softly pink after clearing selection', async ({ page }) => {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Open stories/i }).click();
  await page.getByRole('button', { name: /^Our Stories$/i }).click();
  await page.getByRole('button', { name: /Alice's Adventures in Wonderland/i }).click();

  const middleWord = page.locator('.story-word-button[data-token-index="102"]');
  await middleWord.click();

  await middleWord.dispatchEvent('pointerdown', { pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true, clientX: 180, clientY: 520, button: 0, buttons: 1 });
  await page.waitForTimeout(600);
  await middleWord.dispatchEvent('pointerup', { pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true, clientX: 180, clientY: 520, button: 0, buttons: 0 });
  await page.waitForTimeout(100);

  const controls = page.locator('#story-selection-controls');
  await expect(controls).toBeVisible();

  const statusText = page.locator('#story-selection-status');
  await expect(statusText).toHaveText(/thought/i);

  const pageMeta = page.locator('#story-selection-bookmark-meta');
  await expect(pageMeta).toHaveText(/bookmark word/i);

  const bookmarkButton = page.locator('#story-selection-bookmark-btn');
  await expect(bookmarkButton).toHaveAttribute('aria-label', /bookmark word thought/i);
  await expect(controls).toContainText('Word');
  await expect(page.locator('#bookmark-btn')).toHaveAttribute('aria-label', /bookmark this page/i);

  await page.screenshot({ path: path.join(outputDir, '01-bookmark-meaning-clear-before-save.png'), fullPage: false });

  await bookmarkButton.click();
  await expect(pageMeta).toHaveText(/bookmarked word/i);

  const selectedUnit = page.locator('.story-selection-unit.is-bookmarked-word').filter({ has: page.locator('.story-word-button[data-token-index="102"]') });
  await expect(selectedUnit).toHaveCount(1);

  await page.locator('#story-selection-clear-btn').click();
  await expect(controls).toBeHidden();
  await expect(selectedUnit).toHaveCount(1);

  await page.screenshot({ path: path.join(outputDir, '02-bookmark-meaning-clear-after-save.png'), fullPage: false });
});
