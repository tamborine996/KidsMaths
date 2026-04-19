const { test, expect, devices } = require('playwright/test');

const baseURL = process.env.ALICE_PROOF_BASE_URL || 'http://127.0.0.1:8125/';

test.use({
  ...devices['Pixel 7'],
  viewport: { width: 412, height: 915 },
});

test('Alice popup exposes Speak Save Bookmark and bookmark restores anchored word location', async ({ page }) => {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Open stories/i }).click();
  await page.getByRole('button', { name: /^Our Stories$/i }).click();
  await page.getByRole('button', { name: /Alice's Adventures in Wonderland/i }).click();

  const targetWord = page.locator('.story-word-button[data-token-index="102"]');
  await expect(targetWord).toBeVisible();
  await targetWord.click();

  const box = await targetWord.boundingBox();
  await targetWord.dispatchEvent('pointerdown', {
    pointerId: 21,
    pointerType: 'touch',
    isPrimary: true,
    bubbles: true,
    clientX: box.x + box.width / 2,
    clientY: box.y + box.height / 2,
    button: 0,
    buttons: 1,
  });
  await page.waitForTimeout(650);
  await targetWord.dispatchEvent('pointerup', {
    pointerId: 21,
    pointerType: 'touch',
    isPrimary: true,
    bubbles: true,
    clientX: box.x + box.width / 2,
    clientY: box.y + box.height / 2,
    button: 0,
    buttons: 0,
  });

  const controls = page.locator('#story-selection-controls');
  await expect(controls).toBeVisible();
  await expect(page.locator('#story-selection-speak-btn .story-selection-btn-label')).toHaveText('Speak');
  await expect(page.locator('#story-selection-save-btn .story-selection-btn-label')).toHaveText('Save');
  await expect(page.locator('#story-selection-bookmark-btn .story-selection-btn-label')).toHaveText('Bookmark');

  await page.locator('#story-selection-save-btn').click();

  let appState = await page.evaluate(() => JSON.parse(localStorage.getItem('kidsmaths_state') || '{}'));
  expect(Array.isArray(appState.storySavedWords)).toBeTruthy();
  expect(appState.storySavedWords.some((item) => item.storyId === 'r5-04' && Number(item.page) === 0 && Number(item.startTokenIndex) === 102)).toBeTruthy();

  await page.locator('#story-selection-bookmark-btn').click();

  appState = await page.evaluate(() => JSON.parse(localStorage.getItem('kidsmaths_state') || '{}'));
  const bookmark = appState.bookmarks?.['r5-04'];
  expect(bookmark).toBeTruthy();
  expect(Number(bookmark.page)).toBe(0);
  expect(bookmark.anchor).toBeTruthy();
  expect(Number(bookmark.anchor.paragraphIndex)).toBe(1);
  expect(Number(bookmark.anchor.startTokenIndex)).toBe(102);
  expect(Number(bookmark.anchor.endTokenIndex)).toBe(102);
  expect(String(bookmark.anchor.text || '').toLowerCase()).toBe('thought');

  await page.locator('#story-selection-backdrop').click({ force: true });
  await expect(page.locator('#story-selection-controls')).toBeHidden();

  await page.locator('#story-next-btn').click();
  await expect(page.locator('#story-page-text')).toHaveText('Page 2 of 161');

  await page.locator('#bookmark-btn').click();
  await expect(page.locator('#story-page-text')).toHaveText('Page 1 of 161');

  const restoredSelectedWord = page.locator('.story-word-button.is-selected[data-token-index="102"]');
  await expect(restoredSelectedWord).toHaveCount(1);
  await expect(page.locator('#story-selection-status')).toHaveText(/thought/i);
});
