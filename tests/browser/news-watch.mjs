import assert from 'node:assert/strict';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'],
});
const base = process.env.BASE_URL || 'http://localhost:3001';
const now = Date.now();
const items = [
  {title: 'Banjir di Semarang', topics: ['flood']},
  {title: 'Hujan di Semarang', topics: ['weather']},
  {title: 'Banjir di Meulaboh', topics: ['flood']},
  {title: 'Gempa di Jepang', topics: ['earthquake']},
].map((item, index) => ({
  ...item, source: 'ANTARA News', sourceId: 'antara',
  url: `https://www.antaranews.com/berita/${index}`,
  publishedAt: new Date(now - index * 60_000).toISOString(),
}));
const data = {
  items, sources: [], fetchedAt: new Date(now).toISOString(),
  nextRefreshAt: new Date(now + 4 * 60 * 60_000).toISOString(),
};

try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({viewport: {width, height: 900}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let requests = 0, fail = false;
    await page.route('https://**', route => route.abort());
    await page.route('**/api/news*', route => {
      requests++;
      return route.fulfill({status: fail ? 502 : 200, json: fail ? {} : data});
    });
    await page.goto(base + '/#peta');
    const markerToggle = page.getByRole('button', {name: 'Penanda berita'});
    await markerToggle.waitFor();
    assert.equal(requests, 0);
    await markerToggle.click();
    const semarang = page.getByRole('button', {name: 'Berita: Semarang'});
    await semarang.waitFor();
    assert.equal(await page.locator('.news-city-marker').count(), 2);
    assert.equal(await semarang.evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(250, 204, 21)');
    await semarang.focus();
    await page.keyboard.press('Enter');
    const popup = page.locator('.watch-popup');
    await popup.waitFor();
    assert.equal(await popup.getByRole('link', {name: 'Banjir di Semarang'}).getAttribute('href'), items[0].url);
    assert.equal(await popup.getByRole('link', {name: 'Hujan di Semarang'}).getAttribute('target'), '_blank');
    assert.match(await popup.innerText(), /ANTARA News.*WIB/);

    await page.getByRole('button', {name: 'Prioritas Pantauan', exact: true}).click();
    const dialog = page.getByRole('dialog', {name: 'Prioritas Pantauan'});
    await dialog.waitFor();
    assert.deepEqual(await dialog.getByRole('heading', {level: 3}).allTextContents(), ['Semarang', 'Meulaboh']);
    assert.equal(await dialog.getByRole('link', {name: 'KPw Jawa Tengah'}).getAttribute('href'), '#sarpras/KPW-20');
    assert.equal(await dialog.getByRole('link', {name: 'Hujan di Semarang'}).count(), 0);
    assert.equal(requests, 1);
    fail = true;
    await dialog.getByRole('button', {name: 'Perbarui berita'}).click();
    await dialog.getByText(/Sumber berita belum dapat dihubungi/).waitFor();
    assert.equal(await dialog.locator('.watch-city').count(), 2);
    assert.match(await page.locator('#news-map-status').textContent(), /salinan terakhir/);

    await dialog.getByRole('button', {name: 'Lihat di peta'}).first().click();
    await popup.waitFor();
    assert.equal(await dialog.isVisible(), false);
    await markerToggle.click();
    assert.equal(await page.locator('.news-city-marker').count(), 0);
    await popup.waitFor({state: 'hidden'});

    await page.goto(base + '/#berita');
    await page.locator('.news-card').first().waitFor();
    assert.equal(requests, 2);
    assert.deepEqual(errors, []);
    await page.close();
    console.log('PASS: yellow markers, keyboard popup, article URLs, flood priorities and retained data', width);
  }
} finally {
  await browser.close();
}
