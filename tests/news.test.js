import test from 'node:test';
import assert from 'node:assert/strict';
import {parseNews,safeUrl} from '../api/news.js';
const article=(title,link='https://www.antaranews.com/berita/1/test')=>`<item><title>${title}</title><link>${link}</link><pubDate>Tue, 17 Nov 2026 05:00:00 GMT</pubDate><description><![CDATA[<img src="https://cdn.antaranews.com/foto.jpg">Laporan peristiwa Indonesia]]></description></item>`;
test('news preserves source metadata and images and filters unrelated stories',()=>{const items=parseNews(`<rss><channel>${article('Banjir melanda kota')}${article('Harga emas hari ini')}</channel></rss>`);assert.equal(items.length,1);assert.equal(items[0].source,'ANTARA News');assert.equal(items[0].publishedAt,'2026-11-17T05:00:00.000Z');assert.equal(items[0].image,'https://cdn.antaranews.com/foto.jpg');});
test('news rejects unsafe links, malformed XML and external entities',()=>{assert.deepEqual(parseNews(`<rss><channel>${article('Gempa','javascript:alert(1)')}</channel></rss>`),[]);assert.equal(safeUrl('https://antaranews.com.evil.test/a',['antaranews.com']),null);assert.equal(safeUrl('https://user:pass@www.antaranews.com/a',['antaranews.com']),null);assert.throws(()=>parseNews('<rss>'));assert.throws(()=>parseNews('<!DOCTYPE rss [<!ENTITY a SYSTEM "file:///etc/passwd">]><rss/>'));});

import {createNewsLoader, indexedFeed} from '../api/news.js';
import {NEWS_REFRESH_MS, NEWS_SOURCES, classifyIncident, compareNewsArticles, classifyNews, filterNews, selectHeadlines} from '../src/news-data.js';
const rss = items => `<rss><channel>${items}</channel></rss>`;
const indexedItem = (publisher, title = 'Flood displaces residents') => `<item><title>${title} - ${publisher.name}</title><link>https://news.google.com/rss/articles/${publisher.id}</link><source url="https://www.${publisher.domain}">${publisher.name}</source><pubDate>Tue, 17 Nov 2026 05:00:00 GMT</pubDate></item>`;

test('indexed news verifies original publisher and preserves attribution in English and Indonesian', () => {
  for (const source of NEWS_SOURCES) {
    const items = parseNews(rss(indexedItem(source)), source, true);
    assert.equal(items.length, 1);
    assert.equal(items[0].sourceId, source.id);
    assert.equal(items[0].source, source.name);
    assert.equal(items[0].title, 'Flood displaces residents');
    assert.equal(items[0].via, 'Google News');
    assert.deepEqual(items[0].topics, ['flood']);
    assert.ok(new URL(indexedFeed(source)).searchParams.get('q').includes(`site:${source.domain}`));
  }
  assert.deepEqual(parseNews(rss(indexedItem(NEWS_SOURCES[0])), NEWS_SOURCES[3], true), []);
});

test('filters only flood and landslide with publisher and keyword combinations', () => {
  assert.deepEqual(classifyNews('BMKG memantau cuaca ekstrem'), []);
  assert.deepEqual(classifyNews('Toko banjir diskon'), []);
  assert.deepEqual(classifyNews('Banjir rob dan tanah longsor di Jawa'), ['flood', 'landslide']);
  assert.deepEqual(classifyNews('Hasil pertandingan sepak bola'), []);
  const items = [
    {title: 'Banjir Jakarta', summary: '', source: 'CNN Indonesia', sourceId: 'cnn', topics: ['flood']},
    {title: 'Longsor Bogor', summary: '', source: 'Reuters', sourceId: 'reuters', topics: ['landslide']},
    {title: 'Hujan lebat', summary: '', source: 'CNN Indonesia', sourceId: 'cnn', topics: ['weather']},
  ];
  assert.equal(filterNews(items).length, 2);
  assert.equal(filterNews(items, {topic: 'flood', source: 'cnn', query: 'jakarta'}).length, 1);
  assert.equal(filterNews(items, {topic: 'flood', source: 'reuters'}).length, 0);
  assert.equal(filterNews(items, {topic: 'landslide'}).length, 1);
});

test('three headlines cover floods and landslides, diversify publishers and handle fewer than three results', () => {
  const item = (title, sourceId, hour, topics = ['flood']) => ({title, sourceId, topics, publishedAt: `2026-11-17T0${hour}:00:00Z`});
  const items = [item('Longsor A', 'ap', 7, ['landslide']), item('Flood A', 'cnn', 6), item('Flood B', 'cnn', 5), item('Flood C', 'metro', 4), item('Flood D', 'antara', 3)];
  assert.deepEqual(selectHeadlines(items).map(item => item.title), ['Flood A', 'Longsor A', 'Flood C']);
  assert.equal(selectHeadlines(items.slice(0, 2)).length, 2);
  assert.deepEqual(selectHeadlines([]), []);
  assert.equal(selectHeadlines(items.filter(item => item.sourceId === 'cnn')).length, 2);
});

test('loader caches for thirty minutes, refreshes at expiry and supports manual refresh', async () => {
  let time = Date.parse('2026-11-17T05:00:00Z'), requests = 0;
  const fetcher = async url => { requests++; const source = NEWS_SOURCES.find(source => new URL(url).searchParams.get('q')?.includes(`site:${source.domain}`)) || NEWS_SOURCES[0]; return new Response(rss(indexedItem(source))); };
  const load = createNewsLoader({fetcher, now: () => time});
  const first = await load();
  assert.equal(first.sources.length, NEWS_SOURCES.length);
  assert.equal(first.partial, false);
  assert.equal(Date.parse(first.nextRefreshAt) - Date.parse(first.fetchedAt), NEWS_REFRESH_MS);
  const count = requests;
  time += NEWS_REFRESH_MS - 1;
  assert.deepEqual(await load(), first);
  assert.equal(requests, count);
  time++;
  assert.notEqual((await load()).fetchedAt, first.fetchedAt);
  assert.ok(requests > count);
  const after = requests;
  await load({force: true});
  assert.ok(requests > after);
});

test('failed publishers retain labeled previous stories while other feeds update; total failure is stale', async () => {
  let time = Date.parse('2026-11-17T05:00:00Z'), broken = false, allBroken = false;
  const fetcher = async url => {
    const source = NEWS_SOURCES.find(source => new URL(url).searchParams.get('q')?.includes(`site:${source.domain}`));
    if (!source || allBroken || broken && source.id === 'reuters') throw Error('Unavailable');
    return new Response(rss(indexedItem(source)));
  };
  const load = createNewsLoader({fetcher, now: () => time});
  assert.equal((await load()).items.length, NEWS_SOURCES.length);
  time += NEWS_REFRESH_MS; broken = true;
  const partial = await load();
  assert.equal(partial.partial, true);
  assert.equal(partial.sources.find(source => source.id === 'reuters').status, 'unavailable');
  assert.equal(partial.items.find(item => item.sourceId === 'reuters').stale, true);
  time += NEWS_REFRESH_MS; allBroken = true;
  const stale = await load();
  assert.equal(stale.stale, true);
  assert.equal(stale.fetchedAt, partial.fetchedAt);
  await assert.rejects(createNewsLoader({fetcher})(), /belum dapat dihubungi/);
});

test('simultaneous refresh requests reuse one feed load and duplicate story URLs collapse', async () => {
  let requests = 0;
  const fetcher = async url => {
    requests++;
    const source = NEWS_SOURCES.find(source => new URL(url).searchParams.get('q')?.includes(`site:${source.domain}`));
    if (!source) return new Response(rss(''));
    return new Response(rss(indexedItem(source) + indexedItem(source)));
  };
  const load = createNewsLoader({fetcher, now: () => Date.parse('2026-11-18T05:00:00Z')});
  const [a, b] = await Promise.all([load(), load({force: true})]);
  assert.equal(requests, NEWS_SOURCES.length + 3);
  assert.equal(a.items.length, NEWS_SOURCES.length);
  assert.deepEqual(a, b);
});

test('parses item-level GeoRSS only from the direct publisher', () => {
  const point = '<georss:point>-6.2 106.8</georss:point>';
  const tagged = item => item.replace('</item>', point + '</item>');
  const wrap = item => `<rss xmlns:georss="http://www.georss.org/georss"><channel>${item}</channel></rss>`;
  assert.deepEqual(parseNews(wrap(tagged(article('Banjir Jakarta'))))[0].coords, [-6.2, 106.8]);
  assert.equal(parseNews(wrap(article('Banjir Jakarta')))[0].coords, undefined);
  assert.equal(parseNews(wrap(tagged(indexedItem(NEWS_SOURCES[0]))), NEWS_SOURCES[0], true)[0].coords, undefined);
});

test('merges direct and indexed feeds and keeps publisher coordinates on duplicate headlines', async () => {
  const fetcher = async url => {
    if (url.includes('antaranews.com/rss/')) {
      return new Response(rss(article('Banjir Jakarta').replace('</item>', '<georss:point>-6.2 106.8</georss:point></item>')));
    }
    if (url.includes('site%3Aantaranews.com')) {
      const source = NEWS_SOURCES.find(item => item.id === 'antara');
      return new Response(rss(indexedItem(source, 'Banjir Jakarta')
        + indexedItem(source, 'Longsor lama').replace('/antara', '/lama').replace('17 Nov', '01 Nov')
        + indexedItem(source, 'Longsor Bogor').replace('/antara', '/bogor')));
    }
    return new Response(rss(''));
  };
  const data = await createNewsLoader({fetcher, now: () => Date.parse('2026-11-18T05:00:00Z')})();
  assert.deepEqual(data.items.map(item => [item.title, item.coords]), [
    ['Banjir Jakarta', [-6.2, 106.8]], ['Longsor Bogor', undefined],
  ]);
});

test('rejects preparedness and forecasts without discarding reports of confirmed impacts', () => {
  for (const title of [
    'Pemda di Bangka Belitung Diminta Tingkatkan Antisipasi Banjir',
    'Musim Hujan Mulai Tiba, BPBD Babel Ingatkan Ancaman Banjir hingga Pohon Tumbang',
    'BPBD Bangka Belitung Ingatkan Daerah Segera Tangani Titik Rawan Banjir',
    'Banjir diprediksi akan melanda Jakarta',
    'Waspada, ratusan rumah bisa terendam banjir',
    'Simulasi banjir, warga dievakuasi dengan perahu',
    'Pemkab siapkan posko jika warga mengungsi akibat longsor',
  ]) assert.equal(classifyIncident(title), null, title);

  for (const title of [
    'Siapkan Bantuan untuk 300 Warga Terdampak Banjir di Aceh',
    'Banjir melanda Semarang, 3 rumah terendam',
    'Longsor timbun dua rumah di Bogor',
    'Jembatan Putus akibat Longsor di Cianjur',
    'Pascabanjir di Aceh, warga mulai membersihkan rumah',
  ]) assert.ok(classifyIncident(title), title);
});

test('reports of significant impact outrank newer unquantified coverage', () => {
  const stories = [
    {title: 'Banjir di Jakarta', publishedAt: '2026-11-18T08:00:00Z'},
    {title: 'Longsor di Bogor, 2 warga tertimbun', publishedAt: '2026-11-18T07:00:00Z'},
    {title: 'Banjir di Aceh, 250 rumah terendam', publishedAt: '2026-11-18T06:00:00Z'},
  ].map(item => ({...item, ...classifyIncident(item.title)}));
  assert.deepEqual(stories.sort(compareNewsArticles).map(item => item.impact), [2, 2, 0]);
});
