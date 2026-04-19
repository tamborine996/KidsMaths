const { test, expect, devices } = require('playwright/test');
const path = require('path');

const baseURL = process.env.READING_REWRITE_PROOF_BASE_URL || 'http://127.0.0.1:8125/';
const outputDir = path.join(process.cwd(), 'tmp', 'reading-rewrite-proof');

test.use({
  ...devices['Pixel 7'],
  viewport: { width: 412, height: 915 },
});

test('Home is reading-first and Reading splits into English and Urdu only', async ({ page }) => {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const key = 'kidsmaths_state';
    const state = JSON.parse(localStorage.getItem(key) || '{}');
    state.homeMathsVisible = false;
    state.bookmarks = {
      ...(state.bookmarks || {}),
      'r5-04': { page: 26, date: '2026-04-19T13:00:00.000Z' },
      'r5-05': { page: 13, date: '2026-04-19T12:00:00.000Z' }
    };
    state.recentItems = [
      { type: 'story', storyId: 'r5-04', page: 26, key: 'story:r5-04', updatedAt: '2026-04-19T13:05:00.000Z' }
    ];
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload({ waitUntil: 'networkidle' });

  await expect(page.locator('#home-reading-hub')).toContainText('English');
  await expect(page.locator('#home-urdu-hub')).toContainText('Urdu');
  await expect(page.locator('#home-maths-hub')).toBeHidden();
  await page.screenshot({ path: path.join(outputDir, '01-home-reading-first.png'), fullPage: false });

  await page.locator('#home-reading-hub').click();
  await expect(page.getByRole('button', { name: 'English' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Urdu' })).toBeVisible();
  await expect(page.locator('.our-stories-last-read .reading-library-kicker')).toHaveText('Last Read');
  await expect(page.locator('#reading-level-select')).toBeHidden();
  await expect(page.locator('#reading-search-toggle')).toBeHidden();
  await expect(page.locator('.our-stories-book-row')).toHaveCount(2);
  await expect(page.locator('.our-stories-book-row').filter({ hasText: "Alice's Adventures in Wonderland" })).toHaveCount(1);
  await expect(page.locator('.our-stories-book-row').filter({ hasText: 'A Christmas Carol' })).toHaveCount(1);
  await expect(page.locator('.our-stories-book-row').filter({ hasText: 'The Cartographer' })).toHaveCount(0);
  await page.screenshot({ path: path.join(outputDir, '02-reading-english-only.png'), fullPage: false });
});
