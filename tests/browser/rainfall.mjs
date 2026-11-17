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
    await page.locator('#rainfall-toggle').click();
    await page.waitForFunction(() => document.querySelector('#rainfall-status')?.textContent.includes('Pekan 1 aktif'));
    assert.equal(await page.locator('#rainfall-toggle').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#rainfall-week option').count(), 2);
    assert.equal(await page.locator('.rainfall-scale span').count(), 10);
    assert.match(await page.locator('.rainfall-source').innerText(), /CHIRPS3-GEFS/);
    const image = page.locator('.leaflet-rainfallOverlay-pane > .leaflet-layer');
    assert.equal(await image.count(), 1);
    assert.ok(await image.locator('canvas').count() > 1);
    assert.ok(await image.locator('canvas').evaluateAll(tiles => tiles.every(tile => tile.width === 256 && tile.height === 256)));
    assert.equal(await page.locator('.leaflet-rainfallOverlay-pane img').count(), 0);
    await page.locator('#rainfall-opacity').fill('40');
    assert.equal(await image.evaluate(element => element.style.opacity), '0.4');
    // A first-time image request failure must preserve the current week.
    await page.route('**/rainfall/week2-render.f32*', route => route.fulfill({status: 503, body: 'Unavailable'}));
    await page.locator('#rainfall-week').selectOption('week2');
    await page.waitForFunction(() => document.querySelector('#rainfall-status')?.textContent.includes('Layer sebelumnya'));
    assert.equal(await page.locator('#rainfall-week').inputValue(), 'week1');
    assert.equal(await image.locator('canvas').first().getAttribute('data-week'), 'week1');
    await page.unroute('**/rainfall/week2-render.f32*');
    await page.locator('#rainfall-week').selectOption('week2');
    await page.waitForFunction(() => document.querySelector('#rainfall-status')?.textContent.includes('Pekan 2 aktif'));
    assert.equal(await image.locator('canvas').first().getAttribute('data-week'), 'week2');
    assert.equal(await image.count(), 1);
    assert.equal(await image.evaluate(element => element.style.opacity), '0.4');
    if (width > 1000) {
      const target = await page.locator('#map').evaluate(element => {
        const [lat, lng] = element.dataset.viewCenter.split(',').map(Number), z = Number(element.dataset.viewZoom);
        const project = (latitude, longitude) => { const n = 256 * 2 ** z; return [(longitude + 180) / 360 * n, (.5 - Math.log(Math.tan(Math.PI / 4 + latitude * Math.PI / 360)) / (2 * Math.PI)) * n]; };
        const a = project(lat, lng), b = project(.5, 114.5), box = element.getBoundingClientRect();
        return {x: box.x + box.width / 2 + b[0] - a[0], y: box.y + box.height / 2 + b[1] - a[1]};
      });
      await page.mouse.click(target.x, target.y);
      await page.waitForFunction(() => document.querySelector('#rainfall-point')?.textContent.includes('mm/hari'));
      assert.match(await page.locator('#rainfall-point').innerText(), /Pekan 2/);
    }
    const originalZoom = Number((await image.locator('canvas').first().getAttribute('data-tile')).split('/')[0]);
    await page.locator('#rainfall-close').click();
    for(let i=0;i<4;i++){await page.locator('#zoom-in').click();await page.waitForTimeout(350);}
    await page.waitForFunction(z => [...document.querySelectorAll('.leaflet-rainfallOverlay-pane canvas')].some(c => Number(c.dataset.tile.split('/')[0]) > z), originalZoom);
    assert.equal(await image.count(),1);
    const painted = await image.locator('canvas').evaluateAll(tiles=>tiles.some(tile=>{const data=tile.getContext('2d').getImageData(0,0,256,256).data;for(let n=3;n<data.length;n+=4)if(data[n])return true;return false;}));
    assert.ok(painted, 'rainfall still renders after zoom');
    const beforePan = await image.locator('canvas').evaluateAll(tiles=>tiles.map(tile=>tile.dataset.tile).join(','));
    const box = await page.locator('#map').boundingBox();
    await page.mouse.move(box.x+box.width*.5,box.y+box.height*.4);await page.mouse.down();await page.mouse.move(box.x+box.width*.5+80,box.y+box.height*.4+20,{steps:8});await page.mouse.up();
    await page.waitForTimeout(500);
    assert.equal(await image.count(),1);
    assert.ok(await image.locator('canvas').count()>0);
    await page.locator('#rainfall-toggle').click();
    assert.equal(await image.count(), 0);
    await page.locator('#rainfall-toggle').click();
    await page.waitForFunction(() => document.querySelector('#rainfall-status')?.textContent.includes('Pekan 2 aktif'));
    await page.screenshot({path: `/tmp/rainfall-${width}.png`});
    await page.locator('#rainfall-close').click();
    assert.equal(await image.count(), 1);
    await page.locator('#rainfall-toggle').click();
    assert.equal(await image.count(), 0);
    await page.locator('#rainfall-toggle').click();
    await page.waitForFunction(() => document.querySelector('#rainfall-status')?.textContent.includes('Pekan 2 aktif'));
    assert.ok(await page.locator('.rainfall-panel').isVisible());
    await page.locator('#rainfall-off').click();
    assert.equal(await image.count(), 0);
    assert.equal(await page.locator('#rainfall-toggle').getAttribute('aria-pressed'), 'false');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(errors, []);
    await page.close();
    console.log('PASS: native-grid XYZ tiles, zoom/pan, week switch, opacity, retained layer on failure, close/reopen/off', width);
  }
} finally { await browser.close(); }
