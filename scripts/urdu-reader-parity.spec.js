const { test, expect, devices } = require('playwright/test');

const baseURL = process.env.ALICE_PROOF_BASE_URL || 'http://127.0.0.1:8124/';
const storageKey = 'kidsmaths_state';

async function seedState(page, patch = {}) {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ storageKey, patch }) => {
    const current = JSON.parse(localStorage.getItem(storageKey) || '{}');
    localStorage.setItem(storageKey, JSON.stringify({ ...current, ...patch }));
  }, { storageKey, patch });
}

async function openUrduArticle(page, statePatch = {}) {
  await seedState(page, statePatch);
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Open Urdu/i }).click();
  await page.getByRole('button', { name: /Start reading/i }).click();
  await expect(page.locator('#story-title')).toBeVisible();
}

test.use({
  ...devices['Pixel 7'],
  viewport: { width: 412, height: 915 },
});

test('Urdu reader exposes the same handle-based selection affordance as English', async ({ page }) => {
  await openUrduArticle(page);

  const firstUrduWord = page.locator('.story-word-button').nth(8);
  await firstUrduWord.click();

  await expect(page.locator('#story-selection-controls')).toBeHidden();
  await expect(page.locator('#story-selection-adjusters')).toBeVisible();
  await expect(page.locator('#story-selection-start-handle')).toBeVisible();
  await expect(page.locator('#story-selection-end-handle')).toBeVisible();
});

test('Urdu article title can be fully read in-story without forced header ellipsis', async ({ page }) => {
  await openUrduArticle(page);

  const metrics = await page.locator('#story-title').evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      whiteSpace: style.whiteSpace,
      overflow: style.overflow,
      textOverflow: style.textOverflow,
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
    };
  });

  expect(metrics.whiteSpace).not.toBe('nowrap');
  expect(metrics.textOverflow).not.toBe('ellipsis');
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
});

test('Paragraph EN translation stays visible after maximum pinch-style zoom', async ({ page }) => {
  await openUrduArticle(page, { storyFontScale: 1.65 });

  const translateBtn = page.locator('[data-paragraph-translate="3"]').first();
  await translateBtn.scrollIntoViewIfNeeded();
  await translateBtn.click();

  const translation = page.locator('.urdu-paragraph-translation:not(.hidden)').first();
  await expect(translation).toBeVisible();
  await expect.poll(async () => {
    const rect = await translation.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, height: r.height };
    });
    return rect.top;
  }).toBeLessThan(page.viewportSize().height);

  const rect = await translation.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, height: r.height };
  });
  const viewportHeight = page.viewportSize().height;

  expect(rect.top).toBeGreaterThanOrEqual(0);
  expect(rect.top).toBeLessThan(viewportHeight);
});
