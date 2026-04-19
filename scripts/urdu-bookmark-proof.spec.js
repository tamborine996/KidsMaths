const { test, expect, devices } = require('playwright/test');

const baseURL = process.env.ALICE_PROOF_BASE_URL || 'http://127.0.0.1:8124/';
const storyId = 'bbc-urdu-pakistan-talks-2026-04-12';

test.use({
  ...devices['Pixel 7'],
  viewport: { width: 412, height: 915 },
});

test('Urdu article page-1 proof shows restored bookmark semantics and page bookmark state', async ({ page }) => {
  await page.goto(`${baseURL}?screen=story&story=${encodeURIComponent(storyId)}&page=1`, { waitUntil: 'networkidle' });

  await expect(page.locator('#story-page-text')).toHaveText('Page 1 of 11');
  await page.locator('#bookmark-btn').click();
  await expect(page.locator('#story-page-bookmark-state')).toHaveText('Page bookmarked: page 1');

  const selectedWord = page.locator('.story-word-button', { hasText: 'کردار' }).first();
  await selectedWord.scrollIntoViewIfNeeded();
  await selectedWord.click();

  const box = await selectedWord.boundingBox();
  await selectedWord.dispatchEvent('pointerdown', {
    pointerId: 11,
    pointerType: 'touch',
    isPrimary: true,
    bubbles: true,
    clientX: box.x + box.width / 2,
    clientY: box.y + box.height / 2,
    button: 0,
    buttons: 1,
  });
  await page.waitForTimeout(650);
  await selectedWord.dispatchEvent('pointerup', {
    pointerId: 11,
    pointerType: 'touch',
    isPrimary: true,
    bubbles: true,
    clientX: box.x + box.width / 2,
    clientY: box.y + box.height / 2,
    button: 0,
    buttons: 0,
  });

  await expect(page.locator('#story-selection-controls')).toBeVisible();
  await expect(page.locator('#story-selection-bookmark-btn .story-selection-btn-label')).toHaveText('Bookmark');
});
