const { test, expect, devices } = require('playwright/test');

const baseURL = process.env.ALICE_PROOF_BASE_URL || 'http://127.0.0.1:8125/';
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
  await page.getByRole('button', { name: /Read together|Continue together|Open/i }).first().click();
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

  const startBox = await page.locator('#story-selection-start-handle').boundingBox();
  const endBox = await page.locator('#story-selection-end-handle').boundingBox();
  expect(startBox).toBeTruthy();
  expect(endBox).toBeTruthy();
  expect(startBox.x).toBeGreaterThan(endBox.x);
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

test('Urdu reader stops selection growth once the drag leaves the reading surface above the first line', async ({ page }) => {
  await openUrduArticle(page);

  const anchorWord = page.locator('.story-word-button[data-paragraph-index="0"][data-token-index="4"]').first();
  await anchorWord.scrollIntoViewIfNeeded();
  await anchorWord.click();

  const startHandle = page.locator('#story-selection-start-handle');
  await expect(startHandle).toBeVisible();

  const beforeTokens = await page.locator('#story-text .story-word-button.is-selected').evaluateAll((nodes) =>
    nodes.map((node) => Number(node.dataset.tokenIndex))
  );
  expect(beforeTokens).toEqual([4]);

  const startBox = await startHandle.boundingBox();
  const storyTextBox = await page.locator('#story-text').boundingBox();
  expect(startBox).toBeTruthy();
  expect(storyTextBox).toBeTruthy();

  await page.mouse.move(startBox.x + startBox.width / 2, startBox.y + 8);
  await page.mouse.down();
  await page.mouse.move(storyTextBox.x + 30, storyTextBox.y - 56, { steps: 12 });
  await page.mouse.up();

  const afterTokens = await page.locator('#story-text .story-word-button.is-selected').evaluateAll((nodes) =>
    nodes.map((node) => Number(node.dataset.tokenIndex))
  );
  expect(afterTokens).toEqual([4]);
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
