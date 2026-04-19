const { test, expect, devices } = require('playwright/test');

const baseURL = process.env.ALICE_PROOF_BASE_URL || 'http://127.0.0.1:8124/';
const storyId = 'bbc-urdu-pakistan-talks-2026-04-12';

test.use({
  ...devices['Pixel 7'],
  viewport: { width: 412, height: 915 },
});

test('Direct Urdu story deep link opens the exact article page without manual navigation', async ({ page }) => {
  await page.goto(`${baseURL}?screen=story&story=${encodeURIComponent(storyId)}&page=3`, { waitUntil: 'networkidle' });

  await expect(page.locator('#story-screen')).toHaveClass(/active/);
  await expect(page.locator('#story-title')).toHaveText(/ثالثی کے لیے/);
  await expect(page.locator('#story-page-text')).toHaveText('Page 3 of 11');
  await expect(page.locator('#story-text')).toContainText('ڈاکٹر فاروق حسنات');
});
