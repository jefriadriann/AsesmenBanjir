import {compareNewsArticles} from './news-data.js';
import {newsPoint} from './news-location.js';
import {extraCities, provinceCapitals} from './news-areas.js';
import {floodSummary} from './flood-readiness.js';

const isWatchArticle = article => article.topics?.some(topic => topic === 'flood' || topic === 'landslide');
const normalize = value => String(value ?? '').normalize('NFC').toLocaleLowerCase('id')
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

function safeArticleUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
  } catch {
    // Skip unusable article links.
  }
  return null;
}

export function matchNewsCities(locations, articles) {
  const cities = new Map(), aliases = new Map();
  function add(names, coords, kind = 'area', capital) {
    const [name, ...alternates] = names.split('|');
    const key = normalize(name);
    const area = cities.get(key) || {key, name, coords, kind, capital, offices: [], articles: []};
    cities.set(key, area);
    for (const alias of [name, ...alternates]) aliases.set(normalize(alias), area);
    return area;
  }

  for (const location of locations) {
    if (location.type !== 'kpw' && location.type !== 'kas') continue;
    const name = location.city || (location.type === 'kas' ? location.name : '');
    if (!name || (location.type === 'kas' && name === 'Tanjung')) continue;
    const legacy = location.legacyCityCoords;
    const area = add(name, Array.isArray(legacy) && legacy.length === 2 ? newsPoint(...legacy) : null);
    if (location.type === 'kpw') area.offices.push(location);
  }
  for (const [names, lat, lng] of extraCities) add(names, [lat, lng]);
  for (const [names, capital, lat, lng] of provinceCapitals) {
    const city = add(capital, [lat, lng]);
    city.coords = [lat, lng];
    const provinceName = names.split('|')[0];
    const province = add(names, city.coords, 'province', capital);
    const office = locations.find(location => location.type === 'kpw' && location.name === provinceName);
    if (province !== city && office && !province.offices.includes(office)) province.offices.push(office);
    if (province === city) aliases.set(normalize(`Provinsi ${provinceName}`), {
      ...city, key: `provinsi ${city.key}`, name: `Provinsi ${provinceName}`, kind: 'province', capital, articles: [],
    });
  }
  for (const [alias, name] of [
    ['Tanjung Pinang', 'Tanjungpinang'], ['Palangkaraya', 'Palangka Raya'],
    ['Jogja', 'Yogyakarta'], ['Yogya', 'Yogyakarta'], ['Solo', 'Surakarta'],
  ]) {
    const area = aliases.get(normalize(name));
    const previous = aliases.get(normalize(alias));
    if (!area) continue;
    if (previous && previous !== area) {
      area.offices.push(...previous.offices.filter(office => !area.offices.includes(office)));
      cities.delete(previous.key);
    }
    aliases.set(normalize(alias), area);
  }
  for (const area of aliases.values()) cities.set(area.key, area);

  const seen = new Set();
  for (const article of articles) {
    const url = safeArticleUrl(article.url);
    if (!url || seen.has(url) || !Number.isFinite(Date.parse(article.publishedAt))) continue;
    seen.add(url);
    const headline = ` ${normalize(article.title)} `;
    const matches = [...aliases].filter(([key]) => headline.includes(` ${key} `));
    const named = new Set();
    for (const [key, area] of matches) {
      let remaining = headline;
      for (const [other] of matches) {
        if (other !== key && ` ${other} `.includes(` ${key} `)) {
          remaining = remaining.replaceAll(new RegExp(`(?<= )${other}(?= )`, 'g'), ' ');
        }
      }
      if (area.kind === 'province') {
        // A province immediately after a city qualifies that city.
        for (const [cityKey, city] of matches) {
          if (city.kind === 'area' && cityKey !== key) {
            remaining = remaining.replaceAll(new RegExp(`(?<= )${cityKey} ${key}(?= )`, 'g'), ' ');
          }
        }
      }
      if (remaining.includes(` ${key} `)) named.add(area);
    }
    for (const area of named) area.articles.push({...article, url});

  }

  return [...cities.values()].filter(city => city.articles.length).map(city => ({
    ...city,
    articles: city.articles.sort(compareNewsArticles),
  }));
}

export function rankNewsWatch(cities, readiness) {
  return cities.flatMap(city => {
    const articles = city.articles.filter(isWatchArticle);
    if (!articles.length) return [];
    const offices = city.offices.map(office => ({office, summary: floodSummary(readiness, office.id)}));
    const gaps = offices.reduce((total, {summary}) => total + summary.gaps, 0);
    return [{...city, articles, offices, gaps}];
  }).sort((a, b) => b.gaps - a.gaps
    || compareNewsArticles(a.articles[0], b.articles[0])
    || a.name.localeCompare(b.name, 'id'));
}

export function groupPublisherPoints(articles) {
  const points = new Map();
  for (const article of articles) {
    const url = safeArticleUrl(article.url);
    const coords = article.via === 'RSS' && Array.isArray(article.coords)
      && article.coords.length === 2 && newsPoint(...article.coords);
    if (!coords || !url || !Number.isFinite(Date.parse(article.publishedAt))) continue;
    const key = coords.join(',');
    if (!points.has(key)) points.set(key, {key, coords, articles: []});
    const group = points.get(key);
    if (!group.articles.some(item => item.url === url)) group.articles.push({...article, url});
  }
  return [...points.values()];
}

export function groupNewsPoints(articles, areas) {
  const direct = groupPublisherPoints(articles.filter(isWatchArticle));
  const located = new Set(direct.flatMap(point => point.articles.map(article => article.url)));
  const fallback = new Map();
  for (const area of areas) {
    const matches = area.articles.filter(article => isWatchArticle(article) && !located.has(article.url));
    if (!area.coords || !matches.length) continue;
    const key = `wilayah:${area.coords.join(',')}`;
    if (!fallback.has(key)) fallback.set(key, {key, coords: area.coords, areas: [], articles: []});
    const point = fallback.get(key);
    point.areas.push(area);
    for (const article of matches) {
      if (!point.articles.some(item => item.url === article.url)) point.articles.push(article);
    }
  }
  return [...direct, ...fallback.values()];
}
