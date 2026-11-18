const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import assert from 'node:assert/strict';
const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox']});
const REFRESH_MS = 30 * 60 * 1000;
const base = process.env.BASE_URL || 'http://localhost:3000';
const stories = [
  ['Banjir melanda Jakarta', 'cnn', 'CNN Indonesia', 'flood'],
  ['Banjir di Aceh', 'antara', 'ANTARA News', 'flood'],
  ['Banjir pesisir Semarang', 'metro', 'Metro TV', 'flood'],
  ['Longsor di Bogor', 'folkative', 'Folkative', 'landslide'],
  ...Array.from({length: 38}, (_, index) => [`Longsor di lokasi ${index}`, 'ussfeed', 'USS Feed', 'landslide']),
  ['BPBD Ingatkan Ancaman Longsor di Bogor', 'antara', 'ANTARA News', 'landslide'],
  ['Earthquake hits Japan', 'reuters', 'Reuters', 'earthquake'],
  ['Climate and drought response', 'ap', 'Associated Press', 'climate'],
  ['BMKG: hujan lebat', 'bbc', 'BBC', 'weather'],
].map(([title, sourceId, source, topic], index) => ({title, sourceId, source, topics: [topic], url: `https://news.google.com/rss/articles/story${index}`, publishedAt: '2026-11-17T05:00:00Z', image: null, summary: '', via: 'Google News'}));
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({viewport: {width, height: 900}});
    let time = Date.parse('2026-11-17T05:01:00Z'), calls = 0, fail = false;
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install({time: new Date(time)});
    time += 1000;
    await page.clock.pauseAt(new Date(time));
    await page.route('https://**', route => route.abort());
    await page.route('**/api/news*', route => {
      calls++;
      return route.fulfill({status: fail ? 502 : 200, json: fail ? {error: 'Sumber belum tersedia'} : {items: stories, sources: [], fetchedAt: new Date(time).toISOString(), nextRefreshAt: new Date(time + REFRESH_MS).toISOString()}});
    });
    await page.goto(base + '/#berita');
    await page.waitForSelector('.news-headline');
    assert.equal(await page.locator('.news-headline').count(), 3);
    assert.equal(await page.locator('.news-card').count(), 39);
    assert.match(await page.locator('.news-headline').first().innerText(), /12.00 WIB/);
    assert.match(await page.locator('.news-schedule').innerText(), /Tanpa email/);
    assert.match(await page.locator('.news-headline').nth(1).innerText(), /Folkative/);
    assert.match(await page.locator('.news-headline').nth(1).innerText(), /situs editorial/);
    assert.match(await page.locator('.news-schedule').innerText(), /30 menit/);
    assert.equal(await page.getByText('Earthquake hits Japan', {exact: true}).count(), 0);
    assert.equal(await page.getByText('BPBD Ingatkan Ancaman Longsor di Bogor', {exact: true}).count(), 0);
    await page.locator('#news-more').click();
    assert.equal(await page.locator('.news-card').count(), 42);
    assert.equal(await page.locator('#news-more').isVisible(), false);
    await page.locator('#news-topic').selectOption('flood');
    assert.equal(await page.locator('.news-card').count(), 3);
    await page.locator('#news-source').selectOption('cnn');
    assert.equal(await page.locator('.news-card').count(), 1);
    await page.locator('#news-search').fill('Aceh');
    assert.equal(await page.locator('.news-card').count(), 0);
    assert.ok(await page.locator('#news-empty').isVisible());
    await page.locator('#news-reset').click();
    assert.equal(await page.locator('.news-card').count(), 39);
    assert.equal(await page.locator('#news-source option').count(), 17);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const beforeTimer = calls;
    time += REFRESH_MS - 1000;
    await page.clock.fastForward(REFRESH_MS - 1000);
    assert.equal(calls, beforeTimer);
    time += 1000;
    await page.clock.fastForward(1000);
    await page.waitForFunction(() => !document.querySelector('#news-refresh').disabled);
    assert.equal(calls, beforeTimer + 1);
    assert.equal(await page.locator('#news-refresh').innerText(), 'Perbarui berita');
    await page.screenshot({path: `/tmp/ruang-news-${width}.png`, fullPage: true});
    fail = true;
    await page.locator('#news-refresh').click();
    await page.waitForSelector('.news-error');
    assert.equal(await page.locator('.news-card').count(), 39);
    assert.equal(await page.locator('#news-refresh').innerText(), 'Perbarui berita');
    await page.reload();
    await page.waitForSelector('.news-error');
    assert.equal(await page.locator('.news-card').count(), 0);
    assert.ok(await page.locator('#news-empty').isVisible());
    await page.goto(base + '/#sarpras');
    await page.locator('[data-office]').first().click();
    await page.waitForSelector('.sarpras-image');
    assert.equal(await page.locator('.sarpras-image').count(), 28);
    await page.locator('.sarpras-image').evaluateAll(images => images.forEach(image => image.loading = 'eager'));
    await page.waitForFunction(() => [...document.querySelectorAll('.sarpras-image')].every(image => image.complete && image.naturalWidth > 0));
    assert.ok(await page.locator('.source-item-title').first().evaluate(element => parseFloat(getComputedStyle(element).fontSize) >= 15));
    assert.match(await page.locator('.topbar').evaluate(element => getComputedStyle(element).backgroundImage), /linear-gradient/);
    assert.deepEqual(errors, []);
    await page.close();
    console.log('PASS: 3 headlines, source/topic/search/reset filters, 30-minute automatic refresh, manual/cold failure, sarpras regression; viewport', width);
  }
} finally { await browser.close(); }
