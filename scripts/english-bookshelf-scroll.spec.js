const { test, expect, devices } = require('playwright/test');
const path = require('path');

const baseURL = process.env.BOOKSHELF_PROOF_BASE_URL || 'http://127.0.0.1:8125/';
const outputDir = path.join(process.cwd(), 'tmp', 'english-bookshelf-scroll-proof');

test.use({
  ...devices['Pixel 7'],
  viewport: { width: 412, height: 915 },
});

test('Our Stories uses Last Read + scrollable collection with explicit latest-bookmark actions', async ({ page }) => {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const key = 'kidsmaths_state';
    const state = JSON.parse(localStorage.getItem(key) || '{}');
    state.bookmarks = {
      ...(state.bookmarks || {}),
      'r5-04': { page: 26, date: '2026-04-19T13:00:00.000Z' },
      'r5-05': { page: 13, date: '2026-04-19T12:00:00.000Z' },
      'r4-02': { page: 5, date: '2026-04-18T10:00:00.000Z' }
    };
    state.readStories = ['r4-03'];
    state.recentItems = [
      { type: 'story', storyId: 'r5-04', page: 26, key: 'story:r5-04', updatedAt: '2026-04-19T13:05:00.000Z' }
    ];
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Open stories/i }).click();
  await page.getByRole('button', { name: /^Our Stories$/i }).click();

  await expect(page.getByText(/Last Read/i)).toBeVisible();
  await expect(page.getByText(/Your collection/i)).toBeVisible();
  await expect(page.getByText(/Scroll through your books/i)).toBeVisible();
  await expect(page.locator('#reading-level-select')).toBeHidden();
  await expect(page.locator('#reading-search-toggle')).toBeHidden();

  const latestBookmarkButtons = page.getByRole('button', { name: /Latest bookmark/i });
  await expect(latestBookmarkButtons.first()).toBeVisible();
  await expect(latestBookmarkButtons).toHaveCount(4);

  const shelfRows = page.locator('.our-stories-book-row');
  await expect(shelfRows).toHaveCount(7);

  await expect(page.locator('.our-stories-last-read-title')).toContainText("Alice's Adventures in Wonderland");
  await expect(page.locator('.our-stories-book-row').filter({ hasText: "Alice's Adventures in Wonderland" })).toHaveCount(1);
  await expect(page.locator('.our-stories-book-row').filter({ hasText: 'A Christmas Carol' })).toHaveCount(1);
  await expect(page.locator('.our-stories-book-row').filter({ hasText: "The Cartographer's Compass" })).toHaveCount(1);
  await expect(page.locator('.our-stories-book-row').filter({ hasText: 'The Keeper of Forgotten Things' })).toHaveCount(1);
  await expect(page.locator('.our-stories-book-row').filter({ hasText: 'Beyond the Storm' })).toHaveCount(1);
  await expect(page.locator('.our-stories-book-row').filter({ hasText: 'Island of Whispers' })).toHaveCount(1);
  await expect(page.locator('.our-stories-book-row').filter({ hasText: 'The Last Library' })).toHaveCount(1);

  await page.screenshot({ path: path.join(outputDir, '01-last-read-top.png'), fullPage: false });

  await page.mouse.wheel(0, 1400);
  await expect(page.locator('.our-stories-book-row').filter({ hasText: 'Island of Whispers' })).toBeVisible();
  await expect(page.locator('.our-stories-book-row').filter({ hasText: 'The Last Library' })).toBeVisible();
  await page.screenshot({ path: path.join(outputDir, '02-browse-state.png'), fullPage: false });
});
