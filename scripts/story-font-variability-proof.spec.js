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

test('Visible story font controls can shrink and regrow Urdu article text', async ({ page }) => {
  await seedState(page, { storyFontScale: 1.65, readingTab: 'urdu' });
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Open Urdu/i }).click();
  await page.getByRole('button', { name: /Start reading/i }).click();

  const decreaseBtn = page.locator('#story-font-decrease-btn');
  const increaseBtn = page.locator('#story-font-increase-btn');
  const label = page.locator('#story-font-label');

  await expect(decreaseBtn).toBeVisible();
  await expect(increaseBtn).toBeVisible();
  await expect(label).toBeVisible();
  await expect(label).toContainText(/Text size/i);

  const before = await page.evaluate(() => {
    const storyText = document.getElementById('story-text');
    return {
      scale: JSON.parse(localStorage.getItem('kidsmaths_state') || '{}').storyFontScale,
      computedFontSize: storyText ? parseFloat(getComputedStyle(storyText).fontSize) : 0,
    };
  });

  await decreaseBtn.click();

  const afterDecrease = await page.evaluate(() => {
    const storyText = document.getElementById('story-text');
    return {
      scale: JSON.parse(localStorage.getItem('kidsmaths_state') || '{}').storyFontScale,
      computedFontSize: storyText ? parseFloat(getComputedStyle(storyText).fontSize) : 0,
    };
  });

  expect(afterDecrease.scale).toBeLessThan(before.scale);
  expect(afterDecrease.computedFontSize).toBeLessThan(before.computedFontSize);

  await increaseBtn.click();

  const afterIncrease = await page.evaluate(() => {
    const storyText = document.getElementById('story-text');
    return {
      scale: JSON.parse(localStorage.getItem('kidsmaths_state') || '{}').storyFontScale,
      computedFontSize: storyText ? parseFloat(getComputedStyle(storyText).fontSize) : 0,
    };
  });

  expect(afterIncrease.scale).toBeGreaterThan(afterDecrease.scale);
  expect(afterIncrease.computedFontSize).toBeGreaterThan(afterDecrease.computedFontSize);
});
