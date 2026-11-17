import { test, expect } from '@playwright/test';

test('林啸内部样板依次打七场，第三战有转折，终战后可选结局', async ({ page }) => {
  await page.goto('/?story=lin-pilot');
  await page.getByTestId('title-screen').click();
  await page.getByTestId('mode-arcade').click();
  await page.getByTestId('select-ok').click();
  await page.getByTestId('select-ok').click();
  const readLine = () => page.evaluate(() => window.__game.cutscene().text);
  const opponents = ['c06', 'c05', 'c02', 'c04', 'c08', 'c03', 'c07'];
  for (const [index, opponent] of opponents.entries()) {
    await expect(page.getByTestId('cutscene')).toBeVisible();
    if (index === 0) expect(await readLine()).toContain('替我问过了');
    if (index === 3) expect(await readLine()).toContain('三个「同意」');
    if (index === 6) expect(await readLine()).toContain('我爸那场');
    await page.getByTestId('cutscene-skip').click();
    await page.waitForFunction(({ index, opponent }) => {
      const arcade = window.__game.arcade();
      return window.__game.isRunning() && arcade?.index === index && arcade.opponent === opponent;
    }, { index, opponent });
    await page.evaluate(() => window.__game.arcadeWin());
  }
  await page.getByTestId('cutscene-skip').click();
  await page.getByRole('button', { name: '请当事人开口，我来答疑' }).click();
  await expect(page.getByTestId('ending')).toContainText('老班工到了会场');
});
