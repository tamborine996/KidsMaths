const { test, expect, devices } = require('playwright/test');
const path = require('path');

const baseURL = process.env.ALICE_PROOF_BASE_URL || 'http://127.0.0.1:8125/';
const outputDir = path.join(process.cwd(), 'tmp', 'alice-selection-proof');

async function selectedTokens(page) {
  return await page.locator('#story-text .story-word-button.is-selected').evaluateAll((nodes) =>
    nodes.map((node) => ({
      token: Number(node.dataset.tokenIndex),
      text: (node.textContent || '').trim(),
      selected: node.classList.contains('is-selected'),
      edge: node.classList.contains('is-range-edge'),
    }))
  );
}

async function selectedFragments(page) {
  return await page.locator('#story-text .story-selection-fragment.is-selected').evaluateAll((nodes) =>
    nodes.map((node) => ({
      text: node.textContent || '',
      whitespaceOnly: !String(node.textContent || '').replace(/\u00a0|\s/g, ''),
      hasPunctuation: /[^\p{L}\p{N}\s]/u.test(node.textContent || ''),
    }))
  );
}

async function selectedUnitBoxForToken(page, tokenIndex) {
  return await page.locator(`.story-selection-unit:has(.story-word-button[data-token-index="${tokenIndex}"])`).boundingBox();
}

test.use({
  ...devices['Pixel 7'],
  viewport: { width: 412, height: 915 },
});

test('Alice selection handles support backward and continued downward extension', async ({ page }) => {
  await page.goto(baseURL, { waitUntil: 'networkidle' });

  await page.getByRole('button', { name: /Open stories/i }).click();
  await page.getByRole('button', { name: /^Our Stories$/i }).click();
  await page.getByRole('button', { name: /Alice's Adventures in Wonderland/i }).click();

  const middleWord = page.locator('.story-word-button[data-token-index="102"]'); // thought
  await expect(middleWord).toBeVisible();
  await middleWord.click();

  const startHandle = page.locator('#story-selection-start-handle');
  const endHandle = page.locator('#story-selection-end-handle');
  await expect(startHandle).toBeVisible();
  await expect(endHandle).toBeVisible();

  const middleBox = await middleWord.boundingBox();
  const middleUnitBox = await selectedUnitBoxForToken(page, 102);
  const startBox = await startHandle.boundingBox();
  const endBox = await endHandle.boundingBox();
  expect(middleBox).toBeTruthy();
  expect(middleUnitBox).toBeTruthy();
  expect(startBox).toBeTruthy();
  expect(endBox).toBeTruthy();

  // Initial proof: two visible handles sit at the left/right boundaries of the selected word
  // and attach to the actual highlighted unit, not the taller button line box.
  expect(startBox.x).toBeLessThan(middleBox.x + 5);
  expect(endBox.x + endBox.width).toBeGreaterThan(middleBox.x + middleBox.width - 5);
  expect(startBox.y).toBeLessThanOrEqual(middleUnitBox.y + middleUnitBox.height);
  expect(endBox.y).toBeLessThanOrEqual(middleUnitBox.y + middleUnitBox.height);
  expect(startBox.y).toBeGreaterThanOrEqual(middleUnitBox.y + middleUnitBox.height - 5);
  expect(endBox.y).toBeGreaterThanOrEqual(middleUnitBox.y + middleUnitBox.height - 5);

  await page.screenshot({ path: path.join(outputDir, '01-middle-word-with-handles.png'), fullPage: false });

  const earlierWord = page.locator('.story-word-button[data-token-index="58"]'); // book, on line above
  const earlierBox = await earlierWord.boundingBox();
  expect(earlierBox).toBeTruthy();

  await page.mouse.move(startBox.x + startBox.width / 2, startBox.y + 8);
  await page.mouse.down();
  await page.mouse.move(earlierBox.x + earlierBox.width / 2, earlierBox.y + earlierBox.height / 2, { steps: 20 });
  await page.mouse.up();

  const backwardSelection = await selectedTokens(page);
  expect(backwardSelection.length).toBeGreaterThan(1);
  expect(backwardSelection[0].token).toBe(58);
  expect(backwardSelection[backwardSelection.length - 1].token).toBe(102);
  const backwardFragments = await selectedFragments(page);
  expect(backwardFragments.some((fragment) => fragment.whitespaceOnly)).toBeTruthy();
  expect(backwardFragments.some((fragment) => fragment.hasPunctuation)).toBeTruthy();

  await page.screenshot({ path: path.join(outputDir, '02-left-handle-dragged-backward.png'), fullPage: false });

  const endBoxAfterBackward = await endHandle.boundingBox();
  expect(endBoxAfterBackward).toBeTruthy();

  const downwardStageOneWord = page.locator('.story-word-button[data-token-index="108"]'); // daisies
  const stageOneBox = await downwardStageOneWord.boundingBox();
  expect(stageOneBox).toBeTruthy();

  await page.mouse.move(endBoxAfterBackward.x + endBoxAfterBackward.width / 2, endBoxAfterBackward.y + 8);
  await page.mouse.down();
  await page.mouse.move(stageOneBox.x + stageOneBox.width / 2, stageOneBox.y + stageOneBox.height / 2, { steps: 12 });
  await page.mouse.up();

  const afterStageOne = await selectedTokens(page);
  expect(afterStageOne[0].token).toBe(58);
  expect(afterStageOne[afterStageOne.length - 1].token).toBe(108);

  await page.screenshot({ path: path.join(outputDir, '03-right-handle-stage-one-downward.png'), fullPage: false });

  const endBoxAfterStageOne = await endHandle.boundingBox();
  expect(endBoxAfterStageOne).toBeTruthy();

  const downwardStageTwoWord = page.locator('.story-word-button[data-token-index="120"]'); // her
  const stageTwoBox = await downwardStageTwoWord.boundingBox();
  expect(stageTwoBox).toBeTruthy();

  await page.mouse.move(endBoxAfterStageOne.x + endBoxAfterStageOne.width / 2, endBoxAfterStageOne.y + 8);
  await page.mouse.down();
  await page.mouse.move(stageTwoBox.x + stageTwoBox.width / 2, stageTwoBox.y + stageTwoBox.height / 2, { steps: 18 });
  await page.mouse.up();

  const afterStageTwo = await selectedTokens(page);
  expect(afterStageTwo[0].token).toBe(58);
  expect(afterStageTwo[afterStageTwo.length - 1].token).toBe(120);
  expect(afterStageTwo.length).toBeGreaterThan(afterStageOne.length);

  await page.screenshot({ path: path.join(outputDir, '04-right-handle-stage-two-further-downward.png'), fullPage: false });

  const summary = {
    baseURL,
    initialWord: { token: 102, text: 'thought' },
    backwardDragReached: backwardSelection[0],
    stageOneEnd: afterStageOne[afterStageOne.length - 1],
    stageTwoEnd: afterStageTwo[afterStageTwo.length - 1],
    selectedRangeAfterStageTwo: afterStageTwo.map((item) => item.token),
    screenshots: [
      path.join(outputDir, '01-middle-word-with-handles.png'),
      path.join(outputDir, '02-left-handle-dragged-backward.png'),
      path.join(outputDir, '03-right-handle-stage-one-downward.png'),
      path.join(outputDir, '04-right-handle-stage-two-further-downward.png'),
    ],
  };

  console.log(JSON.stringify(summary, null, 2));
});
