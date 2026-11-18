import {test} from 'node:test';
import assert from 'node:assert/strict';
import {groupPublisherPoints, matchNewsCities, rankFloodWatch} from '../src/news-watch-data.js';

const locations = [
  {id: 'kpw-a', type: 'kpw', city: 'Jakarta', legacyCityCoords: [-6.18, 106.83]},
  {id: 'kt-a', type: 'kas', name: 'Jakarta Selatan', legacyCityCoords: [-6.25, 106.8], coords: null},
  {id: 'kt-b', type: 'kas', name: 'Batang', legacyCityCoords: [-6.9, 109.7]},
  {id: 'kpw-b', type: 'kpw', city: 'Semarang', legacyCityCoords: [-6.99, 110.42]},
];

function story(title, id, publishedAt = '2026-11-17T05:00:00Z', topics = ['flood']) {
  return {title, url: `https://example.com/${id}`, publishedAt, topics};
}

test('groups headlines for the reading list and validates article links', () => {
  const article = story('BANJIR di Jakarta Selatan dan Semarang', 'a');
  const cities = matchNewsCities(locations, [
    article, article,
    story('Banjir Batanghari', 'b'),
    {...story('Banjir Jakarta', 'c'), url: 'javascript:alert(1)'},
    {...story('Banjir Jakarta', 'd'), url: 'https://account:password@example.com/d'},
    story('Banjir Jakarta', 'e', 'invalid'),
  ]);
  assert.deepEqual(cities.map(city => city.name), ['Jakarta Selatan', 'Semarang']);
  assert.deepEqual(cities[0].articles.map(item => item.url), [article.url]);
  const distinct = matchNewsCities(locations, [story('Jakarta dan Jakarta Selatan banjir', 'f')]);
  assert.deepEqual(distinct.map(city => city.name), ['Jakarta', 'Jakarta Selatan']);
});

test('ranks flood coverage by known equipment gaps and then newest flood article', () => {
  const cities = matchNewsCities(locations, [
    story('Hujan di Jakarta Selatan', 'a', '2026-11-19T05:00:00Z', ['weather']),
    story('Jakarta banjir', 'b'),
    story('Semarang banjir', 'c', '2026-11-18T05:00:00Z'),
    story('Banjir di Batang', 'd'),
  ]);
  const readiness = {offices: {
    'kpw-a': {hazards: {Banjir: {values: {C: 0, D: 0.5, O: 1}}}},
  }};
  const ranked = rankFloodWatch(cities, readiness);
  assert.deepEqual(ranked.map(city => [city.name, city.gaps]), [
    ['Jakarta', 2], ['Semarang', 0], ['Batang', 0],
  ]);
  assert.equal(ranked[1].offices[0].summary.evidence, 0);
  assert.deepEqual(ranked[2].offices, []);
});

test('only valid coordinates supplied by a publisher produce map points', () => {
  const direct = {...story('Banjir Jakarta', 'direct'), coords: [-6.2, 106.8], via: 'RSS'};
  const points = groupPublisherPoints([
    direct, direct, story('Banjir Jakarta', 'title-only'),
    {...direct, url: 'https://example.com/indexed', via: 'Google News'},
    {...direct, url: 'https://example.com/swapped', coords: [106.8, -6.2]},
    {...direct, url: 'https://example.com/invalid', coords: ['-6.2', 106.8]},
    {...direct, url: 'https://example.com/overseas', coords: [35, 139]},
  ]);
  assert.deepEqual(points.map(point => [point.coords, point.articles.map(item => item.url)]), [
    [[-6.2, 106.8], [direct.url]],
  ]);
});
