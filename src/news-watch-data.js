import {floodSummary} from './flood-readiness.js';

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
  const cities = new Map();
  for (const location of locations) {
    const name = location.city || (location.type === 'kas' ? location.name : '');
    const key = normalize(name);
    const coords = location.legacyCityCoords;
    if (!key || !Array.isArray(coords) || coords.length !== 2 || !coords.every(Number.isFinite)) continue;
    if (!cities.has(key)) cities.set(key, {key, name, coords, offices: [], articles: []});
    const city = cities.get(key);
    if (location.type === 'kpw') {
      if (!city.offices.length) city.coords = coords;
      city.offices.push(location);
    }
  }

  const seen = new Set();
  for (const article of articles) {
    const url = safeArticleUrl(article.url);
    if (!url || seen.has(url) || !Number.isFinite(Date.parse(article.publishedAt))) continue;
    seen.add(url);
    const headline = ` ${normalize(article.title)} `;
    const matches = [...cities.keys()].filter(key => headline.includes(` ${key} `));
    for (const key of matches) {
      // Preserve standalone mentions when a headline also contains a longer city name.
      let remaining = headline;
      for (const other of matches) {
        if (other !== key && ` ${other} `.includes(` ${key} `)) {
          remaining = remaining.replaceAll(new RegExp(`(?<= )${other}(?= )`, 'g'), ' ');
        }
      }
      if (remaining.includes(` ${key} `)) cities.get(key).articles.push({...article, url});
    }
  }

  return [...cities.values()].filter(city => city.articles.length).map(city => ({
    ...city,
    articles: city.articles.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)),
  }));
}

export function rankFloodWatch(cities, readiness) {
  return cities.flatMap(city => {
    const articles = city.articles.filter(article => article.topics?.includes('flood'));
    if (!articles.length) return [];
    const offices = city.offices.map(office => ({office, summary: floodSummary(readiness, office.id)}));
    const gaps = offices.reduce((total, {summary}) => total + summary.gaps, 0);
    return [{...city, articles, offices, gaps}];
  }).sort((a, b) => b.gaps - a.gaps
    || Date.parse(b.articles[0].publishedAt) - Date.parse(a.articles[0].publishedAt)
    || a.name.localeCompare(b.name, 'id'));
}
