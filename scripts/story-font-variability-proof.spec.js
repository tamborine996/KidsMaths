const { test, expect, devices } = require('playwright/test');

const baseURL = process.env.STORY_FONT_PROOF_BASE_URL || 'http://127.0.0.1:8125/';
const storageKey = 'kidsmaths_state';

async function seedState(page, patch = {}) {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ storageKey, patch }) => {
    const current = JSON.parse(localStorage.getItem(storageKey) || '{}');
    localStorage.setItem(storageKey, JSON.stringify({ ...current, ...patch }));
  }, { storageKey, patch });
}

test.use({
  ...devices['Pixel 7'],
  viewport: { width: 412, height: 915 },
});

test('Story font info stays visible for enlarged Urdu article text without button clutter', async ({ page }) => {
  await seedState(page, { storyFontScale: 1.65, readingTab: 'urdu' });
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Open Urdu/i }).click();
  await page.getByRole('button', { name: /Read together|Continue together|Open/i }).first().click();

  const label = page.locator('#story-font-label');
  const decreaseBtn = page.locator('#story-font-decrease-btn');
  const increaseBtn = page.locator('#story-font-increase-btn');
  const resetBtn = page.locator('#story-font-reset-btn');

  await expect(label).toBeVisible();
  await expect(label).toContainText('Text size 165%');
  await expect(decreaseBtn).toHaveCount(0);
  await expect(increaseBtn).toHaveCount(0);
  await expect(resetBtn).toHaveCount(0);

  const current = await page.evaluate(() => {
    const storyText = document.getElementById('story-text');
    return {
      scale: JSON.parse(localStorage.getItem('kidsmaths_state') || '{}').storyFontScale,
      computedFontSize: storyText ? parseFloat(getComputedStyle(storyText).fontSize) : 0,
    };
  });

  expect(current.scale).toBe(1.65);
  expect(current.computedFontSize).toBeGreaterThan(0);
});
