import test from 'node:test';
import assert from 'node:assert/strict';
import {parseNews,safeUrl} from '../api/news.js';
const article=(title,link='https://www.antaranews.com/berita/1/test')=>`<item><title>${title}</title><link>${link}</link><pubDate>Tue, 17 Nov 2026 05:00:00 GMT</pubDate><description><![CDATA[<img src="https://cdn.antaranews.com/foto.jpg">Laporan peristiwa Indonesia]]></description></item>`;
test('news preserves source metadata and images and filters unrelated stories',()=>{const items=parseNews(`<rss><channel>${article('Banjir melanda kota')}${article('Harga emas hari ini')}</channel></rss>`);assert.equal(items.length,1);assert.equal(items[0].source,'ANTARA News');assert.equal(items[0].publishedAt,'2026-11-17T05:00:00.000Z');assert.equal(items[0].image,'https://cdn.antaranews.com/foto.jpg');});
test('news rejects unsafe links, malformed XML and external entities',()=>{assert.deepEqual(parseNews(`<rss><channel>${article('Gempa','javascript:alert(1)')}</channel></rss>`),[]);assert.equal(safeUrl('https://antaranews.com.evil.test/a',['antaranews.com']),null);assert.equal(safeUrl('https://user:pass@www.antaranews.com/a',['antaranews.com']),null);assert.throws(()=>parseNews('<rss>'));assert.throws(()=>parseNews('<!DOCTYPE rss [<!ENTITY a SYSTEM "file:///etc/passwd">]><rss/>'));});

import {createNewsLoader, indexedFeed} from '../api/news.js';
import {NEWS_REFRESH_MS, NEWS_SOURCES, classifyNews, filterNews, selectHeadlines} from '../src/news-data.js';
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

test('filters allow broader issues as well as flood, publisher and keyword combinations', () => {
  assert.ok(classifyNews('BMKG memantau cuaca ekstrem').includes('weather'));
  assert.ok(classifyNews('Climate mitigation and drought').includes('climate'));
  assert.deepEqual(classifyNews('Hasil pertandingan sepak bola'), []);
  const items = [
    {title: 'Banjir Jakarta', summary: '', source: 'CNN Indonesia', sourceId: 'cnn', topics: ['flood']},
    {title: 'Gempa Jepang', summary: '', source: 'Reuters', sourceId: 'reuters', topics: ['earthquake']},
    {title: 'Hujan lebat', summary: '', source: 'CNN Indonesia', sourceId: 'cnn', topics: ['weather']},
  ];
  assert.equal(filterNews(items).length, 3);
  assert.equal(filterNews(items, {topic: 'flood', source: 'cnn', query: 'jakarta'}).length, 1);
  assert.equal(filterNews(items, {topic: 'flood', source: 'reuters'}).length, 0);
  assert.equal(filterNews(items, {topic: 'weather'}).length, 1);
});

test('three headlines prioritize floods, diversify publishers and handle fewer than three results', () => {
  const item = (title, sourceId, hour, topics = ['flood']) => ({title, sourceId, topics, publishedAt: `2026-11-17T0${hour}:00:00Z`});
  const items = [item('Other disaster', 'ap', 7, ['earthquake']), item('Flood A', 'cnn', 6), item('Flood B', 'cnn', 5), item('Flood C', 'metro', 4), item('Flood D', 'antara', 3)];
  assert.deepEqual(selectHeadlines(items).map(item => item.title), ['Flood A', 'Flood C', 'Flood D']);
  assert.equal(selectHeadlines(items.slice(0, 2)).length, 2);
  assert.deepEqual(selectHeadlines([]), []);
  assert.equal(selectHeadlines(items.filter(item => item.sourceId === 'cnn')).length, 2);
});

test('loader caches for four hours, refreshes at expiry and supports manual refresh', async () => {
  let time = Date.parse('2026-11-17T05:00:00Z'), requests = 0;
  const fetcher = async url => { requests++; const source = NEWS_SOURCES.find(source => new URL(url).searchParams.get('q')?.includes(`site:${source.domain}`)) || NEWS_SOURCES[0]; return new Response(rss(indexedItem(source))); };
  const load = createNewsLoader({fetcher, now: () => time});
  const first = await load();
  assert.equal(first.sources.length, 8);
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
  assert.equal((await load()).items.length, 8);
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
  const load = createNewsLoader({fetcher});
  const [a, b] = await Promise.all([load(), load({force: true})]);
  assert.equal(requests, 11); // Three direct feeds, then eight indexed feeds.
  assert.equal(a.items.length, 8);
  assert.deepEqual(a, b);
});
