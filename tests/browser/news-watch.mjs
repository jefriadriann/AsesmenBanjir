import assert from 'node:assert/strict';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'],
});
const base = process.env.BASE_URL || 'http://localhost:3001';
const now = Date.now();
const items = [
  {title: 'Banjir di Semarang, 35 rumah terendam', topics: ['flood'], via: 'RSS', coords: [-7.01, 110.41]},
  {title: 'Hujan di Semarang', topics: ['weather']},
  {title: 'Banjir di Meulaboh, ratusan warga mengungsi', topics: ['flood']},
  {title: 'Gempa di Jepang', topics: ['earthquake']},
  {title: 'Pemda di Bangka Belitung Diminta Tingkatkan Antisipasi Banjir', topics: ['flood']},
  {title: '[KLARIFIKASI] Ini Video Tanah Longsor Sibolga pada 2025, Bukan 2026', topics: ['landslide']},
  {title: 'Longsor Sibolga 2025, rumah tertimbun', topics: ['landslide']},
  {title: 'Banjir di Bogor', topics: ['flood']},
  {title: 'Longsor di Bogor, dua warga tertimbun', topics: ['landslide'], age: 73 * 60 * 60_000},
  ...Array.from({length: 14}, (_, index) => ({title: `Banjir di Meulaboh, 200 warga mengungsi dari desa ${index + 1}`, topics: ['flood']})),
].map((item, index) => ({
  ...item, source: 'ANTARA News', sourceId: 'antara',
  url: `https://www.antaranews.com/berita/${index}`,
  publishedAt: new Date(now - (item.age ?? index * 60_000)).toISOString(),
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
    const semarang = page.getByRole('button', {name: 'Berita: Banjir di Semarang, 35 rumah terendam'});
    await semarang.waitFor();
    assert.equal(await page.locator('.news-city-marker').count(), 2);
    const meulaboh = page.getByRole('button', {name: 'Berita: Meulaboh'});
    await meulaboh.focus();
    await page.keyboard.press('Enter');
    const areaPopup = page.locator('.watch-popup');
    await areaPopup.getByRole('heading', {name: 'Meulaboh', exact: true}).waitFor();
    assert.equal(await areaPopup.getByText('Penanda wilayah', {exact: true}).count(), 0);
    assert.equal(await areaPopup.getByRole('link', {name: 'Banjir di Meulaboh, ratusan warga mengungsi', exact: true}).getAttribute('href'), items[2].url);
    assert.ok(await areaPopup.evaluate(panel => {
      const frame = panel.closest('.map-frame').getBoundingClientRect();
      const bounds = panel.getBoundingClientRect();
      const h = panel.querySelector('header').getBoundingClientRect();
      const scroll = panel.querySelector('.watch-popup-articles');
      const link = scroll.querySelector('a').getBoundingClientRect();
      return bounds.top >= frame.top && bounds.bottom <= frame.bottom
        && bounds.left >= frame.left && bounds.right <= frame.right
        && h.top < link.top
        && panel.contains(document.elementFromPoint(link.left + 2, link.top + 2));
    }));
    assert.equal(await areaPopup.getByRole('link').count(), 2);
    await areaPopup.getByRole('button', {name: 'Tutup berita di peta'}).click();
    await areaPopup.waitFor({state: 'hidden'});
    const korwil = page.getByRole('group', {name: 'Korwil jaringan pada peta'});
    await korwil.getByRole('button', {name: 'Sumatera'}).click();
    assert.equal(await page.locator('.news-city-marker').count(), 1);
    assert.equal(await semarang.count(), 0);
    assert.equal(await meulaboh.count(), 1);
    await page.getByRole('button', {name: 'Prioritas Pantauan', exact: true}).click();
    assert.deepEqual(await page.locator('#watch-dialog h3').allTextContents(), ['Meulaboh']);
    await page.locator('#watch-close').click();
    await korwil.getByRole('button', {name: 'Jawa'}).click();
    assert.equal(await meulaboh.count(), 0);
    assert.equal(await semarang.count(), 1);
    await korwil.getByRole('button', {name: 'Semua'}).click();
    await meulaboh.waitFor();
    await semarang.waitFor();
    assert.equal(await page.locator('.news-city-marker').count(), 2);
    assert.equal(await semarang.evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(250, 204, 21)');
    await semarang.focus();
    await page.keyboard.press('Enter');
    const popup = page.locator('.watch-popup');
    await popup.waitFor();
    assert.equal(await popup.getByRole('link', {name: 'Banjir di Semarang, 35 rumah terendam'}).getAttribute('href'), items[0].url);
    assert.equal(await popup.getByRole('link', {name: 'Banjir di Semarang, 35 rumah terendam'}).getAttribute('target'), '_blank');
    assert.equal(await popup.getByRole('link', {name: 'Hujan di Semarang'}).count(), 0);
    assert.match(await popup.innerText(), /ANTARA News.*WIB/);

    await page.getByRole('button', {name: 'Prioritas Pantauan', exact: true}).click();
    const dialog = page.getByRole('dialog', {name: 'Prioritas Pantauan'});
    await dialog.waitFor();
    assert.deepEqual(await dialog.getByRole('heading', {level: 3}).allTextContents(), ['Meulaboh', 'Semarang']);
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
    assert.equal(await meulaboh.count(), 0);
    assert.match(await page.locator('#news-map-status').textContent(), /area peta/);
    // Open the panel without displacing the selected point.
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
    await page.locator('.network-popup').filter({hasText: 'Perkiraan Senen'}).locator('.popup-detail-button').press('Enter');
    await page.locator('#location-detail').getByText(/Prajurit KKO Usman dan Harun/).waitFor();
    assert.equal(await page.locator('#view-area').isDisabled(), false);
    await page.goto(base + '/#berita');
    await page.locator('.news-card').first().waitFor();
    await page.getByRole('searchbox', {name: 'Cari berita'}).fill('Banjir di Bogor');
    assert.equal(await page.getByRole('link', {name: 'Banjir di Bogor', exact: true}).count(), 1);
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
