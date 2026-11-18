import assert from 'node:assert/strict';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'],
});
const base = process.env.BASE_URL || 'http://localhost:3001';
const now = Date.now();
const items = [
  {title: 'Banjir di Semarang', topics: ['flood'], via: 'RSS', coords: [-7.01, 110.41]},
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
    assert.equal(await markerToggle.getAttribute('aria-pressed'), 'true');
    const semarang = page.getByRole('button', {name: 'Berita: Banjir di Semarang'});
    await semarang.waitFor();
    assert.equal(await page.locator('.news-city-marker').count(), 2);
    const meulaboh = page.getByRole('button', {name: 'Berita: Meulaboh'});
    await meulaboh.focus();
    await page.keyboard.press('Enter');
    const areaPopup = page.locator('.watch-popup');
    await areaPopup.getByText('Meulaboh · pusat wilayah').waitFor();
    assert.match(await areaPopup.innerText(), /Lokasi persis kejadian belum diketahui/);
    assert.equal(await areaPopup.getByRole('link', {name: 'Banjir di Meulaboh'}).getAttribute('href'), items[2].url);
    await areaPopup.locator('.leaflet-popup-close-button').click();
    await areaPopup.waitFor({state: 'hidden'});
    assert.equal(await semarang.evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(250, 204, 21)');
    await semarang.focus();
    await page.keyboard.press('Enter');
    const popup = page.locator('.watch-popup');
    await popup.waitFor();
    assert.equal(await popup.getByRole('link', {name: 'Banjir di Semarang'}).getAttribute('href'), items[0].url);
    assert.equal(await popup.getByRole('link', {name: 'Banjir di Semarang'}).getAttribute('target'), '_blank');
    assert.equal(await popup.getByRole('link', {name: 'Hujan di Semarang'}).count(), 0);
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

    await dialog.getByRole('button', {name: 'Lihat titik dari penerbit'}).first().click();
    await popup.waitFor();
    assert.equal(await dialog.isVisible(), false);
    // Leaflet can pan slightly to keep the popup entirely within the viewport.
    const center = (await page.locator('#map').getAttribute('data-view-center')).split(',').map(Number);
    assert.ok(center.every((value, index) => Math.abs(value - items[0].coords[index]) < .1));
    await markerToggle.click();
    assert.equal(await page.locator('.news-city-marker').count(), 0);
    await popup.waitFor({state: 'hidden'});

    await page.locator('#panel-toggle').click();
    await page.locator('[data-office-view="BI-PUSAT"]').click();
    assert.match(await page.locator('#location-detail').innerText(), /M\.H\. Thamrin No\. 2/);
    assert.equal(await page.locator('#view-area').isDisabled(), false);
    assert.match(await page.locator('#location-detail').innerText(), /Perkiraan Thamrin/);
    await page.goto(base + '/#peta/BI-PUSAT');
    await page.locator('.network-popup').getByRole('heading', {name: 'Kantor Pusat Bank Indonesia'}).waitFor();
    assert.equal(await page.locator('.network-popup .popup-network-button').count(), 0);
    await page.goto(base + '/#peta/KPW-13');
    await page.locator('.network-popup').getByText('Perkiraan Senen · titik gedung belum tersedia').waitFor();
    await page.locator('.network-popup').filter({hasText: 'Perkiraan Senen'}).locator('.popup-detail-button').click();
    await page.locator('#location-detail').getByText(/Prajurit KKO Usman dan Harun/).waitFor();
    assert.equal(await page.locator('#view-area').isDisabled(), false);
    await page.goto(base + '/#berita');
    await page.locator('.news-card').first().waitFor();
    assert.equal(requests, 2);
    assert.deepEqual(errors, []);
    await page.goto(base + '/#peta');
    await page.reload();
    await page.locator('#news-map-status').getByText(/Feed belum tersedia/).waitFor();
    assert.equal(await page.locator('.news-city-marker').count(), 0);
    fail = false;
    await page.getByRole('button', {name: 'Prioritas Pantauan'}).click();
    await page.locator('#watch-refresh').click();
    await page.locator('#watch-close').click();
    await page.getByRole('button', {name: 'Berita: Meulaboh'}).waitFor();
    await page.close();
    console.log('PASS: yellow markers, keyboard popup, article URLs, flood priorities and retained data', width);
  }
} finally {
  await browser.close();
}
