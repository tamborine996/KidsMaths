const { test, expect, devices } = require('playwright/test');

const baseURL = process.env.STORY_TITLE_TOGGLE_BASE_URL || 'http://127.0.0.1:8125/';

test.use({
  ...devices['Pixel 7'],
  viewport: { width: 412, height: 915 },
});

test('Show English title does not change reader text size or reset reading position', async ({ page }) => {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Open Urdu/i }).click();
  await page.getByRole('button', { name: /Start reading/i }).click();

  const titleToggle = page.locator('#story-title-translation-toggle');
  await expect(titleToggle).toHaveText(/Show English title/i);

  const storyContent = page.locator('#story-content');
  await storyContent.evaluate((node) => {
    node.scrollTop = 260;
  });

  const before = await page.evaluate(() => {
    const storyText = document.getElementById('story-text');
    const storyContent = document.getElementById('story-content');
    return {
      inlineFontSize: storyText?.style.fontSize || '',
      computedFontSize: storyText ? getComputedStyle(storyText).fontSize : '',
      scrollTop: storyContent?.scrollTop || 0,
    };
  });

  await titleToggle.click();

  const afterShow = await page.evaluate(() => {
    const storyText = document.getElementById('story-text');
    const storyContent = document.getElementById('story-content');
    const subtitle = document.getElementById('story-title-subtitle');
    return {
      inlineFontSize: storyText?.style.fontSize || '',
      computedFontSize: storyText ? getComputedStyle(storyText).fontSize : '',
      scrollTop: storyContent?.scrollTop || 0,
      subtitleHidden: subtitle?.classList.contains('hidden'),
    };
  });

  expect(afterShow.subtitleHidden).toBe(false);
  expect(afterShow.inlineFontSize).toBe(before.inlineFontSize);
  expect(afterShow.computedFontSize).toBe(before.computedFontSize);
  expect(afterShow.scrollTop).toBe(before.scrollTop);

  await titleToggle.click();

  const afterHide = await page.evaluate(() => {
    const storyText = document.getElementById('story-text');
    const storyContent = document.getElementById('story-content');
    const subtitle = document.getElementById('story-title-subtitle');
    return {
      inlineFontSize: storyText?.style.fontSize || '',
      computedFontSize: storyText ? getComputedStyle(storyText).fontSize : '',
      scrollTop: storyContent?.scrollTop || 0,
      subtitleHidden: subtitle?.classList.contains('hidden'),
    };
  });

  expect(afterHide.subtitleHidden).toBe(true);
  expect(afterHide.inlineFontSize).toBe(before.inlineFontSize);
  expect(afterHide.computedFontSize).toBe(before.computedFontSize);
  expect(afterHide.scrollTop).toBe(before.scrollTop);
});
