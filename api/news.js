import {publisherPoint} from '../src/news-location.js';
import {XMLParser, XMLValidator} from 'fast-xml-parser';
import {NEWS_SOURCES, NEWS_REFRESH_MS, NEWS_REFRESH_MINUTES, classifyNews} from '../src/news-data.js';

const DIRECT_FEEDS = {
  antara: 'https://www.antaranews.com/rss/terkini.xml',
  cnn: 'https://www.cnnindonesia.com/nasional/rss',
  detik: 'https://news.detik.com/berita/rss',
};
const IMAGE_HOSTS = ['antaranews.com', 'cnnindonesia.com', 'detik.com', 'detik.net.id', 'metrotvnews.com', 'reuters.com', 'reutersmedia.net', 'apnews.com', 'ap.org', 'kompas.com', 'kompas.id', 'kompas.tv', 'kompascloud.net', 'kompas.cloud', 'bbci.co.uk', 'bbc.com', 'bbc.co.uk', ...NEWS_SOURCES.map(source => source.domain)];
const parser = new XMLParser({ignoreAttributes: false, processEntities: false});
const text = value => typeof value === 'string' ? value : typeof value === 'number' ? String(value) : value?.['#text'] || '';
const clean = value => text(value).replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
export function safeUrl(value, hosts) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && (!url.port || url.port === '443') && hosts.some(host => url.hostname === host || url.hostname.endsWith('.' + host)) ? url.href : null;
  } catch { return null; }
}
export function indexedFeed(source) {
  const terms = '(banjir OR "banjir rob" OR "tanah longsor" OR longsor)';
  return 'https://news.google.com/rss/search?' + new URLSearchParams({q: `${terms} site:${source.domain} when:14d`, hl: 'id', gl: 'ID', ceid: 'ID:id'});
}
export function parseNews(xml, source = NEWS_SOURCES[0], indexed = false) {
  if (xml.length > 2_000_000 || /<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) throw Error('Feed tidak valid');
  const feed = parser.parse(xml);
  if (!feed?.rss?.channel) throw Error('Format RSS tidak tersedia');
  const raw = feed.rss.channel.item || [];
  return (Array.isArray(raw) ? raw : [raw]).flatMap(item => {
    let title = clean(item.title);
    // Indexed feeds must identify the requested publisher, not merely mention it.
    if (indexed) {
      const publisher = text(item.source?.['@_url']).replace(/^http:/, 'https:');
      if (!safeUrl(publisher, [source.domain])) return [];
      const suffix = ' - ' + clean(item.source);
      if (title.endsWith(suffix)) title = title.slice(0, -suffix.length);
    }
    const url = safeUrl(text(item.link), indexed ? ['news.google.com', source.domain] : [source.domain]);
    const description = text(item.description);
    const published = Date.parse(text(item.pubDate));
    const topics = classifyNews(title);
    if (!url || !title || !topics.length || !Number.isFinite(published)) return [];
    const media = item['media:group'] || item;
    const image = item.enclosure?.['@_url'] || media['media:content']?.['@_url'] || media['media:thumbnail']?.['@_url'] || description.match(/<img[^>]+src=["']([^"']+)/i)?.[1];
    // Only the publisher's item-level GeoRSS point can place an article.
    const coords = indexed ? null : publisherPoint(text(item['georss:point']));
    return [{title, url, ...(coords && {coords}), source: source.name, sourceId: source.id, publishedAt: new Date(published).toISOString(), image: safeUrl(image, IMAGE_HOSTS), summary: indexed ? '' : clean(description).slice(0, 240), topics, via: indexed ? 'Google News' : 'RSS'}];
  });
}
async function readFeed(fetcher, url, source, indexed) {
  const response = await fetcher(url, {signal: AbortSignal.timeout(8000), redirect: 'error', headers: {Accept: 'application/rss+xml, application/xml, text/xml', 'User-Agent': 'RuangRisiko/1.0'}});
  if (!response.ok) throw Error('Feed unavailable');
  return parseNews(await response.text(), source, indexed);
}
export function createNewsLoader({fetcher = fetch, now = Date.now} = {}) {
  let cached = null, pending = null;
  return async function load({force = false} = {}) {
    if (!force && cached && now() < Date.parse(cached.nextRefreshAt)) return cached;
    if (pending) return pending;
    pending = (async () => {
      const results = await Promise.allSettled(NEWS_SOURCES.map(async source => {
        const indexed = readFeed(fetcher, indexedFeed(source), source, true);
        if (!DIRECT_FEEDS[source.id]) return {source, items: await indexed};
        const direct = readFeed(fetcher, DIRECT_FEEDS[source.id], source, false);
        const feeds = await Promise.allSettled([direct, indexed]);
        if (feeds.every(feed => feed.status === 'rejected')) throw Error('Feed unavailable');
        return {source, items: feeds.flatMap(feed => feed.status === 'fulfilled' ? feed.value : [])};
      }));
      const successful = results.filter(result => result.status === 'fulfilled');
      if (!successful.length) {
        if (cached) return {...cached, stale: true, partial: true, sources: cached.sources.map(source => ({...source, status: 'unavailable'}))};
        throw Error('Sumber berita belum dapat dihubungi. Silakan coba lagi.');
      }
      const sources = NEWS_SOURCES.map((source, index) => {
        const result = results[index];
        return {...source, status: result.status === 'fulfilled' ? 'available' : 'unavailable', count: result.status === 'fulfilled' ? result.value.items.length : 0};
      });
      const retained = (cached?.items || []).filter(item => sources.some(source => source.id === item.sourceId && source.status === 'unavailable')).map(item => ({...item, stale: true}));
      const fresh = successful.flatMap(result => result.value.items);
      const time = now();
      const urls = new Set(), headlines = new Set(), items = [];
      for (const item of [...fresh, ...retained]) {
        const title = item.title.normalize('NFC').toLocaleLowerCase('id').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
        const key = `${item.sourceId}:${title}`;
        const age = time - Date.parse(item.publishedAt);
        if (age > 14 * 86400000 || age < -3600000 || urls.has(item.url) || headlines.has(key)) continue;
        urls.add(item.url);
        headlines.add(key);
        items.push(item);
      }
      items.sort((a, b) => Number(Boolean(a.stale)) - Number(Boolean(b.stale))
        || Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
      cached = {items: items.slice(0, 300), sources, fetchedAt: new Date(time).toISOString(),
        nextRefreshAt: new Date(time + NEWS_REFRESH_MS).toISOString(), refreshIntervalMinutes: NEWS_REFRESH_MINUTES,
        partial: successful.length < NEWS_SOURCES.length, stale: false};
      return cached;
    })();
    try { return await pending; } finally { pending = null; }
  };
}
export const loadNews = createNewsLoader();
export default async function news(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') { res.statusCode = 405; res.setHeader('Allow', 'GET'); return res.end(JSON.stringify({error: 'Metode tidak didukung'})); }
  const force = new URL(req.url, 'http://localhost').searchParams.get('refresh') === '1';
  try {
    const data = await loadNews({force});
    // Revalidate from the origin when the snapshot expires, even after a late CDN cache fill.
    const ttl = Math.max(0, Math.floor((Date.parse(data.nextRefreshAt) - Date.now()) / 1000));
    res.setHeader('Cache-Control', data.stale || force || ttl === 0 ? 'no-store' : `public, max-age=0, s-maxage=${ttl}, must-revalidate`);
    res.end(JSON.stringify(data));
  } catch {
    res.statusCode = 502; res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({error: 'Sumber berita belum dapat dihubungi. Silakan coba lagi.'}));
  }
}
