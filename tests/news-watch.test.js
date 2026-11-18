import {test} from 'node:test';
import assert from 'node:assert/strict';
import {groupNewsPoints, groupPublisherPoints, isRecentIncident, selectMapAlerts, matchNewsCities, rankNewsWatch} from '../src/news-watch-data.js';

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

test('ranks flood and landslide coverage by known equipment gaps and then newest flood article', () => {
  const cities = matchNewsCities(locations, [
    story('Hujan di Jakarta Selatan', 'a', '2026-11-19T05:00:00Z', ['weather']),
    story('Jakarta banjir', 'b'),
    story('Semarang banjir', 'c', '2026-11-18T05:00:00Z'),
    story('Longsor di Batang', 'd', undefined, ['landslide']),
  ]);
  const readiness = {offices: {
    'kpw-a': {hazards: {Banjir: {values: {C: 0, D: 0.5, O: 1}}}},
  }};
  const ranked = rankNewsWatch(cities, readiness);
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

test('maps city and provincial coverage to reference centres when RSS has no coordinates', () => {
  const city = story('Longsor di Bogor, Jawa Barat', 'bogor');
  const province = story('Banjir melanda Kalimantan Utara', 'kaltara');
  const sameCapital = story('Banjir di Tanjung Selor', 'selor');
  const direct = {...story('Banjir Jakarta', 'rss'), via: 'RSS', coords: [-6.3, 106.9]};
  const articles = [city, province, sameCapital, direct, story('Longsor tanpa nama wilayah', 'unknown')];
  const areas = matchNewsCities(locations, articles);
  const points = groupNewsPoints(articles, areas);
  assert.equal(points.length, 3);
  assert.deepEqual(points[0].coords, [-6.3, 106.9]);
  const bogor = points.find(point => point.articles.some(item => item.url === city.url));
  assert.deepEqual(bogor.coords, [-6.60, 106.80]);
  assert.deepEqual(bogor.areas.map(area => area.name), ['Bogor']);
  const kaltara = points.find(point => point.articles.some(item => item.url === province.url));
  assert.deepEqual(kaltara.coords, [2.84, 117.37]);
  assert.deepEqual(kaltara.areas.map(area => [area.name, area.capital]), [
    ['Tanjung Selor', undefined], ['Kalimantan Utara', 'Tanjung Selor'],
  ]);
});

test('more specific names do not create a separate pin for a province substring', () => {
  const articles = [story('Banjir di Banda Aceh dan Papua Barat Daya', 'specific')];
  assert.deepEqual(matchNewsCities(locations, articles).map(area => area.name), ['Banda Aceh', 'Papua Barat Daya']);
});

test('alerts accept recent confirmed damage or independent coverage and cap repeated reports', () => {
  const now = Date.parse('2026-11-18T00:00:00Z');
  const major = {
    ...story('Longsor di Bogor, dua warga tertimbun', 'major', '2026-11-17T05:00:00Z'),
    topics: ['landslide'], impact: 2,
  };
  assert.equal(isRecentIncident(major, now), true);
  assert.equal(isRecentIncident({...major, impact: 1}, now), true);
  assert.equal(isRecentIncident({...major, topics: ['weather']}, now), false);
  assert.equal(isRecentIncident({...major, publishedAt: '2026-11-14T05:00:00Z'}, now), false);
  const points = [
    {key: 'one', articles: [major, ...Array.from({length: 4}, (_, i) => ({...major, title: `Longsor Bogor ${i}`}))]},
    {key: 'duplicate', articles: [{...major, url: 'https://example.com/duplicate'}]},
    ...Array.from({length: 7}, (_, i) => ({key: `other${i}`, articles: [{...major, title: `Banjir di lokasi ${i}`}]})),
  ];
  const alerts = selectMapAlerts(points);
  assert.equal(alerts.length, 8);
  assert.equal(alerts[0].articles.length, 2);
  assert.equal(alerts.some(point => point.key === 'duplicate'), false);
});

test('local reports identify Lhokseumawe and Aceh Utara separately and prioritize coverage', () => {
  const incident = (title, id, sourceId, impact = 0) => ({...story(title, id), sourceId, impact});
  const articles = [
    incident('Banjir melanda Lhokseumawe', 'a', 'serambi'),
    incident('Banjir di Lhokseumawe meluas', 'b', 'ajnn'),
    incident('Banjir di Aceh Utara, tiga rumah terendam', 'c', 'rri', 1),
    incident('Banjir di Aceh Tamiang', 'd', 'serambi'),
    incident('Banjir melanda Aceh Tamiang', 'e', 'tribun'),
  ];
  const areas = matchNewsCities([
    {id: 'kpw-lhok', type: 'kpw', city: 'Lhokseumawe', region: 'Sumatera', legacyCityCoords: [5.18, 97.15]},
  ], articles);
  const alerts = selectMapAlerts(groupNewsPoints(articles, areas));
  assert.deepEqual(alerts.map(point => [point.areas[0].name, point.coverage]), [
    ['Aceh Utara', 1], ['Lhokseumawe', 2],
  ]);
});
