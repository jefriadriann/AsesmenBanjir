const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import assert from 'node:assert/strict';
const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox']});
try {
 for (const width of [1440, 390]) {
  const page = await browser.newPage({viewport: {width, height: 950}}), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://**', route => route.abort());
  await page.route('**/api/inarisk?*', route => route.fulfill({json: {services: []}}));
  await page.goto((process.env.BASE_URL || 'http://localhost:3002') + '/#peta');
  await page.waitForSelector('#map-measure');
  assert.equal(await page.locator('#data-nav, #distance-nav, #mobile-distance-nav').count(), 0);
  assert.match(await page.locator('.nav-placeholder').textContent(), /X/);
  await page.locator('#map-measure').click();
  assert.equal(await page.locator('#distance-panel select').count(), 0);
  const map = await page.locator('#map').boundingBox();
  const click = async (x, y) => page.mouse.click(map.x + map.width * x, map.y + map.height * y);
  await click(.45, .2); await click(.55, .25); await click(.65, .2);
  await page.waitForFunction(() => document.querySelector('#distance-result')?.dataset.pointCount === '3');
  const meters = Number(await page.locator('#distance-result').getAttribute('data-meters'));
  assert.ok(meters > 0);
  await page.locator('#distance-undo').click();
  assert.equal(await page.locator('#distance-result').getAttribute('data-point-count'), '2');
  assert.ok(Number(await page.locator('#distance-result').getAttribute('data-meters')) < meters);
  await page.locator('#distance-finish').click();
  await click(.4, .2);
  assert.equal(await page.locator('#distance-result').getAttribute('data-point-count'), '2');
  await page.screenshot({path: `/tmp/map-measure-${width}.png`});
  await page.locator('#distance-clear').click();
  assert.equal(await page.locator('#distance-result').getAttribute('data-point-count'), '0');
  await page.keyboard.press('Escape');
  assert.ok(await page.locator('#distance-panel').isHidden());
  assert.equal(await page.locator('#map-measure').getAttribute('aria-pressed'), 'false');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(errors, []);
  await page.close();
  console.log('PASS: map drawing, multiple segments, undo, finish, restart, Escape and navigation; viewport', width);
 }
} finally { await browser.close(); }
